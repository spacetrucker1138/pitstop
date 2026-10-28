// ─── DEATH DRIVE AUDIO ENGINE ─────────────────────────────────────────────
var AudioEngine = (function () {
  var ctx = null, master = null, engineOsc = null, engineGain = null, engineLfo = null, lfoGain = null;
  var grassGain = null, grassFilt = null;
  var running = false, lastCollision = 0, lastScreech = 0, lastHorn = 0;
  var volume = parseFloat(localStorage.getItem('dd_vol')); if (isNaN(volume)) volume = 0.7;
  var muted = localStorage.getItem('dd_muted') === '1';
  var musicTarget = 0, musicLevel = 0, musicTimer = null;
  var MUSIC_BASE = 0.32;

  function out() { return muted ? 0 : volume; }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = out(); master.connect(ctx.destination);
  }
  var noiseCache = {};
  function noiseBuffer(sec) {
    var key = Math.round(sec * 20); if (noiseCache[key]) return noiseCache[key];
    var n = ctx.sampleRate * sec | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (noiseCache[key] = b);
  }
  function startEngine() {
    if (!ctx || running) return;
    running = true;
    engineGain = ctx.createGain(); engineGain.gain.value = 0.0; engineGain.connect(master);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
    var dist = ctx.createWaveShaper(), c = new Float32Array(256);
    for (var i = 0; i < 256; i++) { var x = i * 2 / 256 - 1; c[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x)); }
    dist.curve = c;
    var filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 300; filt.Q.value = 1.2;
    engineLfo = ctx.createOscillator(); engineLfo.type = 'sine'; engineLfo.frequency.value = 7;
    lfoGain = ctx.createGain(); lfoGain.gain.value = 12;
    engineLfo.connect(lfoGain); lfoGain.connect(engineOsc.frequency);
    engineOsc.connect(dist); dist.connect(filt); filt.connect(engineGain);
    engineOsc.start(); engineLfo.start();
    // off-road rumble: looping low noise
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
    grassFilt = ctx.createBiquadFilter(); grassFilt.type = 'lowpass'; grassFilt.frequency.value = 220;
    grassGain = ctx.createGain(); grassGain.gain.value = 0;
    src.connect(grassFilt); grassFilt.connect(grassGain); grassGain.connect(master); src.start();
  }
  function setEngineSpeed(s, on) {
    if (!running) return;
    var t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(45 + s * 100, t, 0.08);
    engineGain.gain.setTargetAtTime(on ? 0.08 + s * 0.16 : 0, t, 0.12);
    engineLfo.frequency.setTargetAtTime(5 + s * 14, t, 0.1);
  }
  function setOffroad(intensity) {
    if (!running) return;
    var t = ctx.currentTime;
    grassGain.gain.setTargetAtTime(intensity * 0.55, t, 0.05);
    grassFilt.frequency.setTargetAtTime(160 + intensity * 260 + Math.random() * 60, t, 0.05);
  }
  function thud(t, f0, f1, g0, dur) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.08);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
  function burst(t, freq, q, g0, dur, type) {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain(); g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  // rear-ending a car: dull bump
  function playCollision() {
    if (!ctx) return;
    var t = ctx.currentTime; if (t - lastCollision < 0.3) return; lastCollision = t;
    thud(t, 110, 28, 0.8, 0.3); burst(t, 700, 0.5, 0.55, 0.16);
  }
  // hitting roadside scenery: heavier crunch + metal clang
  function playCrash() {
    if (!ctx) return;
    var t = ctx.currentTime; if (t - lastCollision < 0.3) return; lastCollision = t;
    thud(t, 90, 22, 1.0, 0.45); burst(t, 1200, 0.7, 0.7, 0.35); burst(t + 0.02, 3200, 6, 0.35, 0.5);
    var o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.4);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.5);
  }
  function playScreech(intensity) {
    if (!ctx || intensity < 0.4) return;
    var t = ctx.currentTime; if (t - lastScreech < 0.18) return; lastScreech = t;
    burst(t, 3800, 9, intensity * 0.3, 0.1 + intensity * 0.2);
  }
  function beep(high) {
    if (!ctx) return;
    var t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = high ? 1320 : 660;
    var g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + (high ? 0.6 : 0.25));
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.65);
  }
  function fanfare() {
    if (!ctx) return;
    var t = ctx.currentTime;
    [523, 659, 784, 1047].forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      var g = ctx.createGain(), s = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, t); g.gain.setValueAtTime(0.12, s); g.gain.exponentialRampToValueAtTime(0.001, s + (i == 3 ? 0.9 : 0.2));
      o.connect(g); g.connect(master); o.start(t); o.stop(s + 1);
    });
  }
  function playHorn() {
    var now = Date.now() / 1000; if (now - lastHorn < 1.2) return; lastHorn = now;
    var h = document.getElementById('truckHorn');
    if (h) { h.currentTime = 0; h.volume = Math.min(1, out()); h.play().catch(function () {}); }
  }
  // music fades
  function applyMusic() { var m = document.getElementById('roadMusic'); if (m) m.volume = Math.max(0, Math.min(1, musicLevel * MUSIC_BASE * out() / 0.7 * 0.7)); }
  function fadeMusic(target, sec) {
    var m = document.getElementById('roadMusic'); if (!m) return;
    musicTarget = target;
    if (target > 0 && m.paused) { m.play().catch(function () {}); }
    clearInterval(musicTimer);
    var stepN = Math.max(1, (sec || 1) * 30), d = (musicTarget - musicLevel) / stepN;
    musicTimer = setInterval(function () {
      musicLevel += d;
      if ((d >= 0 && musicLevel >= musicTarget) || (d < 0 && musicLevel <= musicTarget)) {
        musicLevel = musicTarget; clearInterval(musicTimer);
        if (musicLevel <= 0) m.pause();
      }
      applyMusic();
    }, 33);
  }
  function setVolume(v) { volume = v; localStorage.setItem('dd_vol', v); refresh(); }
  function setMuted(b) { muted = b; localStorage.setItem('dd_muted', b ? '1' : '0'); refresh(); }
  function refresh() { if (master) master.gain.setTargetAtTime(out(), ctx.currentTime, 0.05); applyMusic(); }

  // exhaust backfire pop
  var lastPop = 0;
  function backfire(power) {
    if (!ctx) return;
    var t = ctx.currentTime; if (t - lastPop < 0.12) return; lastPop = t;
    thud(t, 160, 45, 0.5 * power, 0.07); burst(t, 450, 0.8, 0.45 * power, 0.09, 'lowpass');
    if (power > 0.8) { thud(t + 0.09, 140, 40, 0.35, 0.06); burst(t + 0.09, 500, 0.8, 0.3, 0.07, 'lowpass'); }
  }
  // ghost overtakes: a short eerie wail
  function ghostWail() {
    if (!ctx) return;
    var t = ctx.currentTime;
    [0, 7].forEach(function (d) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(520 + d, t); o.frequency.linearRampToValueAtTime(880 + d, t + 0.5); o.frequency.linearRampToValueAtTime(420 + d, t + 1.2);
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.2); g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.35);
    });
  }
  return {
    backfire: backfire, ghostWail: ghostWail,
    init: init, startEngine: startEngine, setEngineSpeed: setEngineSpeed, setOffroad: setOffroad,
    playCollision: playCollision, playCrash: playCrash, playScreech: playScreech, playHorn: playHorn,
    beep: beep, fanfare: fanfare, fadeMusic: fadeMusic, setVolume: setVolume, setMuted: setMuted,
    get volume() { return volume; }, get muted() { return muted; }
  };
})();
