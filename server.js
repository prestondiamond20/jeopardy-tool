const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

process.on('uncaughtException', (err) => {
  console.error('Unexpected error (server stayed up):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unexpected rejection (server stayed up):', err);
});

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));

// ---- Image upload (host picks a file from their own computer) ----
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

app.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
    const finalName = req.file.filename + ext;
    fs.renameSync(req.file.path, path.join(UPLOAD_DIR, finalName));
    res.json({ url: '/uploads/' + finalName });
  });
});

// ---- Game state (single shared game, lives in memory + autosaved to disk) ----
let state = {
  board: null,
  players: {},
  phase: 'setup',
  active: null,
  buzzedId: null,
  locked: false
};

// Grace-period timers for players who disconnect (e.g. a page refresh) live
// outside `state` so they never get serialized or broadcast.
const disconnectTimers = new Map();
const DISCONNECT_GRACE_MS = 90 * 1000;

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      state.board = saved.board || null;
      state.players = saved.players || {};
      Object.values(state.players).forEach(p => { p.connected = false; });
      state.phase = state.board ? 'board' : 'setup';
      state.active = null;
      state.buzzedId = null;
      state.locked = false;
      console.log('Loaded saved board and scores from disk.');
    }
  } catch (e) {
    // no saved state yet, or it's corrupt — start fresh
  }
}
loadState();

let saveTimer = null;
function saveStateToDisk() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = { board: state.board, players: state.players };
    fs.writeFile(STATE_FILE, JSON.stringify(toSave), (err) => {
      if (err) console.error('Failed to save state:', err.message);
    });
  }, 400);
}

let nextPlayerId = 1;
Object.keys(state.players).forEach(id => {
  const n = parseInt(id.replace('p', ''), 10);
  if (!isNaN(n) && n >= nextPlayerId) nextPlayerId = n + 1;
});

const clients = new Map(); // ws -> { id, role }

function broadcast() {
  const payload = JSON.stringify({ type: 'state', state: publicState() });
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
  saveStateToDisk();
}

function publicState() {
  const s = JSON.parse(JSON.stringify(state));
  if (s.board) {
    for (const cat of s.board.categories) {
      for (const clue of cat.clues) {
        delete clue.correctIndex;
        delete clue.answer;
      }
    }
  }
  return s;
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {
  clients.set(ws, { id: null, role: null });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const info = clients.get(ws);

    try {
      switch (msg.type) {
      case 'host-join': {
        info.role = 'host';
        send(ws, { type: 'full-board', board: state.board });
        broadcast();
        break;
      }

      case 'player-join':
      case 'player-rejoin': {
        info.role = 'player';
        const wantedId = msg.id;
        if (msg.type === 'player-rejoin' && wantedId && state.players[wantedId]) {
          info.id = wantedId;
          state.players[wantedId].connected = true;
          if (disconnectTimers.has(wantedId)) {
            clearTimeout(disconnectTimers.get(wantedId));
            disconnectTimers.delete(wantedId);
          }
          send(ws, { type: 'joined', id: wantedId });
        } else {
          const id = 'p' + (nextPlayerId++);
          info.id = id;
          state.players[id] = { name: (msg.name || 'Player').slice(0, 24), score: 0, connected: true, avatar: msg.avatar || '' };
          send(ws, { type: 'joined', id });
        }
        broadcast();
        break;
      }

      case 'update-avatar': {
        if (info.role !== 'player' || !info.id) return;
        if (state.players[info.id]) state.players[info.id].avatar = msg.avatar || '';
        broadcast();
        break;
      }

      case 'set-board': {
        if (info.role !== 'host') return;
        state.board = msg.board;
        state.phase = 'board';
        state.active = null;
        broadcast();
        send(ws, { type: 'full-board', board: state.board });
        break;
      }

      case 'select-clue': {
        if (info.role !== 'host') return;
        const { catIdx, clueIdx } = msg;
        if (!state.board || !state.board.categories) return;
        const cat = state.board.categories[catIdx];
        if (!cat || !cat.clues || !cat.clues[clueIdx]) return;
        const clue = cat.clues[clueIdx];
        if (clue.answered) return;
        clue.revealed = true;
        state.active = { catIdx, clueIdx };
        state.phase = 'clue';
        state.buzzedId = null;
        state.locked = false;
        broadcast();
        break;
      }

      case 'unlock-buzzers': {
        if (info.role !== 'host') return;
        state.locked = false;
        state.buzzedId = null;
        broadcast();
        break;
      }

      case 'buzz': {
        if (info.role !== 'player') return;
        if (state.phase !== 'clue' || state.locked) return;
        state.locked = true;
        state.buzzedId = info.id;
        broadcast();
        break;
      }

      case 'select-choice': {
        if (info.role !== 'player') return;
        state.lastChoice = { playerId: info.id, choiceIndex: msg.choiceIndex };
        broadcast();
        break;
      }

      case 'award': {
        if (info.role !== 'host') return;
        const { playerId, delta } = msg;
        if (state.players[playerId]) state.players[playerId].score += delta;
        broadcast();
        break;
      }

      case 'rename-player': {
        if (info.role !== 'host') return;
        const { playerId, name } = msg;
        if (state.players[playerId] && name) state.players[playerId].name = name.slice(0, 24);
        broadcast();
        break;
      }

      case 'kick-player': {
        if (info.role !== 'host') return;
        delete state.players[msg.playerId];
        if (disconnectTimers.has(msg.playerId)) {
          clearTimeout(disconnectTimers.get(msg.playerId));
          disconnectTimers.delete(msg.playerId);
        }
        broadcast();
        break;
      }

      case 'close-clue': {
        if (info.role !== 'host') return;
        const { catIdx, clueIdx } = state.active || msg || {};
        if (state.board && state.board.categories && state.board.categories[catIdx] && state.board.categories[catIdx].clues[clueIdx]) {
          state.board.categories[catIdx].clues[clueIdx].answered = true;
        }
        state.phase = 'board';
        state.active = null;
        state.buzzedId = null;
        state.locked = false;
        state.lastChoice = null;
        broadcast();
        break;
      }

      case 'reset-game': {
        if (info.role !== 'host') return;
        for (const t of disconnectTimers.values()) clearTimeout(t);
        disconnectTimers.clear();
        state = { board: null, players: {}, phase: 'setup', active: null, buzzedId: null, locked: false };
        broadcast();
        break;
      }

      case 'get-full-board': {
        if (info.role !== 'host') return;
        send(ws, { type: 'full-board', board: state.board });
        break;
      }
      }
    } catch (err) {
      console.error('Error handling message', msg && msg.type, ':', err.message);
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (info && info.role === 'player' && info.id && state.players[info.id]) {
      state.players[info.id].connected = false;
      const timer = setTimeout(() => {
        if (state.players[info.id] && !state.players[info.id].connected) {
          delete state.players[info.id];
          broadcast();
        }
        disconnectTimers.delete(info.id);
      }, DISCONNECT_GRACE_MS);
      disconnectTimers.set(info.id, timer);
      broadcast();
    }
    clients.delete(ws);
  });

  send(ws, { type: 'state', state: publicState() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Jeopardy tool running on http://localhost:${PORT}  (host: /host.html, players: /, display: /display.html)`));
