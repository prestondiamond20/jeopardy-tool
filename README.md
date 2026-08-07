# Jeopardy Board Tool

A self-hosted Jeopardy-style board for let's-play style videos: you (the host) control
the board and score from one page, contestants join from a separate page on their own
devices, and there's a big-screen "Display" page you can capture in OBS for viewers.

## Setup

```
npm install
node server.js
```

This starts a server on **http://localhost:3000**.

- **Host** (you): `http://localhost:3000/host.html`
- **Contestants**: `http://localhost:3000/` (share this URL, e.g. your ngrok link)
- **Display / OBS capture** (optional, for stream viewers): `http://localhost:3000/display.html`
  — read-only big board, no controls, no answers shown, just the clue, buzz-in banner,
  and live scores. Add it as a Browser Source in OBS.

## Sharing with contestants over ngrok

```
ngrok http 3000
```

Share the plain ngrok root URL with contestants. Keep `/host.html` and `/display.html`
to yourself/your stream setup.

## How it works

1. **Build tab** (host page): pick a **theme** — Classic, Pokémon, Deep Space, Retro Neon,
   or **Custom Colors** (pick your own background/panel/accent/text/border colors with
   color pickers, live preview). The theme applies everywhere: host, contestant, and
   display pages.
2. Fill in 5 categories, each with an optional emoji icon, and 5 clues. Each clue gets a
   point value, question text, and an image — either **upload a file straight from your
   computer** or paste a URL — plus an optional "multiple choice" toggle with up to 4
   answers.
3. **Export/Import**: save your board as a `.json` file so you can reuse it later or
   build it in advance and load it right before recording.
4. Click **Save Board & Go to Run Game**.
5. **Run Game tab**: click any unanswered cell to reveal that clue.
   - Plain clues: contestants get a BUZZ button and see the full question on their own
     screen; first to buzz is locked in (you'll hear a buzz sound and see their name).
     **Unlock Buzzers** lets others try again.
   - Multiple-choice clues: contestants see the question and tap an answer directly, no
     buzzer.
6. Award points to anyone, any amount, any time — the +/- buttons default to the clue's
   value, or use "+/- other" for a custom amount. A chime plays either way.
7. **Close Clue & Back to Board** marks it answered and returns to the grid.

Sound effects (buzz, reveal, correct/wrong, join) are all synthesized in-browser — no
audio files to manage. Contestants can mute them from their own page.

## Reliability

- **Board and scores autosave to disk** (`data/state.json`) — if you have to restart the
  server mid-game, your board, categories, and everyone's scores come right back.
- **Contestants can refresh their page without losing their spot or score** — their
  browser remembers who they are for this game and silently reconnects. A "not you?"
  link on their page lets them clear that and rejoin as someone new.
- The host's Scoreboard shows a green/gray dot per player so you can see who's actually
  connected right now vs. still in a reconnect grace window.
- You can remove a player entirely with the ✕ button on their scoreboard card.

## Notes / current limits

- Uploaded images are saved under `public/uploads/` on your machine — they're not
  automatically cleaned up, so periodically clearing that folder is fine between games.
- One game/board running at a time; "Reset Everything" wipes the board, scores, and
  saved state on disk and starts fresh.

Want more themes, a Final Jeopardy wagering round, or anything else added — just ask.
