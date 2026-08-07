// Minimal synthesized SFX so the tool needs zero external audio assets.
const SFX = (() => {
  let ctx = null;
  let muted = false;
  function getCtx(){
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type='sine', delay=0, gainVal=0.18){
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(gainVal, c.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + dur);
    } catch (e) { /* audio not available yet (needs user gesture) */ }
  }
  return {
    setMuted(v){ muted = v; },
    isMuted(){ return muted; },
    buzz(){ tone(180, 0.35, 'sawtooth'); },
    reveal(){ tone(660, 0.12, 'triangle', 0); tone(880, 0.15, 'triangle', 0.1); },
    correct(){ tone(523, 0.12, 'sine', 0); tone(659, 0.12, 'sine', 0.1); tone(784, 0.2, 'sine', 0.2); },
    wrong(){ tone(220, 0.25, 'sawtooth', 0); tone(180, 0.3, 'sawtooth', 0.15); },
    join(){ tone(440, 0.1, 'sine', 0); tone(660, 0.15, 'sine', 0.08); }
  };
})();
