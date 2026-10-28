// ─── DEATH DRIVE UI: input, HUD, overlays, leaderboard, touch controls ────────
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var titleOv = $('titleOverlay'), endOv = $('endOverlay');
  var touch = DD.isTouch;
  document.body.classList.toggle('touch', touch);
  if (touch) { $('pressText').textContent = 'TAP TO RACE'; $('controlsText').innerHTML = 'Turn the <b>wheel</b> to steer &nbsp; hold <b>GAS</b> &nbsp; tap wheel centre for <b>horn</b>'; $('againHint').textContent = ''; }

  // ── menu state helpers ──
  function setMenu(on) { document.body.classList.toggle('menu', on); }
  setMenu(true);

  function startRace() {
    AudioEngine.init(); AudioEngine.startEngine();
    titleOv.classList.remove('show'); endOv.classList.remove('show'); setMenu(false);
    DD.startCountdown();
    showCount('3');
    AudioEngine.fadeMusic(1, 1.5);
  }
  function goTitle() {
    endOv.classList.remove('show'); titleOv.classList.add('show'); setMenu(true);
    DD.resetRace(); DD.state = 'title';
    AudioEngine.fadeMusic(0, 0.8);
    updateTitleLeaderboard();
  }

  // ── countdown / flash ──
  var cd = $('countdown');
  function showCount(txt) { cd.textContent = txt; cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); }
  DD.hooks.onCount = function (c) { showCount(String(c)); };
  DD.hooks.onGo = function () { showCount('GO!'); };
  var flashT = null;
  function flash(txt, ms) { var f = $('flash'); f.innerHTML = txt; f.style.opacity = 1; clearTimeout(flashT); flashT = setTimeout(function () { f.style.opacity = 0; }, ms || 2600); }
  DD.hooks.onLap = function (lap, t, best, last) {
    if (last) flash('FINISH!', 2000);
    else flash('LAP ' + lap + ' &nbsp;' + fmt(t) + (best ? ' &nbsp;BEST LAP!' : '') + '<br><span style="font-size:.7em">FINAL LAP</span>', 2800);
  };
  DD.hooks.onFinish = showEnd;

  // ── HUD (DOM updates only when changed) ──
  var hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  setInterval(function () {
    setText('lapVal', Math.min(DD.lap, TOTAL_LAPS) + '/' + TOTAL_LAPS);
    setText('timeVal', fmt(DD.raceTime));
    setText('bestVal', DD.bestLap ? fmt(DD.bestLap) : '--');
    $('hud').style.visibility = DD.state === 'title' ? 'hidden' : 'visible';
  }, 100);

  // ── keyboard ──
  var KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'b', s: 'b', S: 'b' };
  function setKey(k, on) { if (k === 'l') keyLeft = on; else if (k === 'r') keyRight = on; else if (k === 'u') keyFaster = on; else if (k === 'b') keySlower = on; }
  var endReadyAt = 0;
  document.addEventListener('keydown', function (e) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') return;
    if (DD.state === 'title') { if (!e.repeat) { e.preventDefault(); startRace(); } return; }
    if (DD.state === 'finished') {
      if ((e.key === 'Enter' || e.key === ' ') && performance.now() > endReadyAt) { e.preventDefault(); startRace(); }
      return;
    }
    var k = KEYS[e.key]; if (k) { setKey(k, true); e.preventDefault(); }
    if (e.key === ' ') { e.preventDefault(); AudioEngine.playHorn(); }
  });
  document.addEventListener('keyup', function (e) { var k = KEYS[e.key]; if (k) setKey(k, false); });
  window.addEventListener('blur', function () { keyLeft = keyRight = keyFaster = keySlower = false; });

  // title: click / tap anywhere
  titleOv.addEventListener('pointerdown', function (e) { e.preventDefault(); startRace(); });
  $('againBtn').addEventListener('click', startRace);
  $('titleBtn').addEventListener('click', goTitle);

  // ── volume / mute / fullscreen ──
  var vol = $('vol'), muteBtn = $('muteBtn');
  vol.value = Math.round(AudioEngine.volume * 100);
  function muteIcon() { muteBtn.innerHTML = AudioEngine.muted || AudioEngine.volume == 0 ? '&#128263;' : '&#128266;'; }
  muteIcon();
  vol.addEventListener('input', function () { AudioEngine.setVolume(vol.value / 100); if (AudioEngine.muted && vol.value > 0) AudioEngine.setMuted(false); muteIcon(); });
  muteBtn.addEventListener('click', function (e) { e.stopPropagation(); AudioEngine.setMuted(!AudioEngine.muted); muteIcon(); muteBtn.blur(); });
  ['pointerdown', 'keydown'].forEach(function (ev) { $('hudButtons').addEventListener(ev, function (e) { e.stopPropagation(); }); });
  if (touch) $('volWrap').style.display = 'none';
  var fsBtn = $('fsBtn'), de = document.documentElement;
  var canFs = de.requestFullscreen || de.webkitRequestFullscreen;
  if (!canFs) fsBtn.style.display = 'none';
  fsBtn.addEventListener('click', function (e) {
    e.stopPropagation(); fsBtn.blur();
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    var p = (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
    if (p && p.then) p.then(function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); }).catch(function () {});
  });

  // ── leaderboard (existing shared Firebase board; left as-is) ──
  var cachedScores = [], hsRef = null;
  try {
    var firebaseConfig = { apiKey: "AIzaSyCO1jJVET2TBOMfrJD839jxU0ENYShQ1Fg", authDomain: "pitstop-wall.firebaseapp.com", databaseURL: "https://pitstop-wall-default-rtdb.firebaseio.com", projectId: "pitstop-wall", storageBucket: "pitstop-wall.firebasestorage.app", messagingSenderId: "767668528451", appId: "1:767668528451:web:107ef2d7230f7560fdfbf6" };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    hsRef = firebase.database().ref('highscores/death-drive');
    hsRef.orderByChild('raceTime').limitToFirst(10).on('value', function (snap) {
      var d = snap.val(); cachedScores = d ? Object.values(d).sort(function (a, b) { return a.raceTime - b.raceTime; }) : [];
      updateTitleLeaderboard();
    }, function () { cachedScores = []; updateTitleLeaderboard(); });
  } catch (e) { hsRef = null; }

  function fmtLb(t) { var s = parseFloat(t) || 0, m = Math.floor(s / 60), sec = (s % 60).toFixed(2).padStart(5, '0'); return m > 0 ? m + ':' + sec : sec + 's'; }
  function esc(s) { return String(s || '???').replace(/[^A-Z0-9?]/gi, '').slice(0, 3) || '???'; }
  function updateTitleLeaderboard() {
    var el = $('titleLeaderboard');
    if (!cachedScores.length) {
      el.innerHTML = DD.bestRace ? '<div class="pb">YOUR BEST RACE &nbsp;' + fmt(DD.bestRace) + '</div>' : '<div class="lb-row normal" style="justify-content:center">Be the first to set a time</div>';
      return;
    }
    var colors = ['gold', 'silver', 'bronze'];
    el.innerHTML = cachedScores.slice(0, 5).map(function (s, i) {
      return '<div class="lb-row ' + (colors[i] || 'normal') + '"><span>' + (i + 1) + '. ' + esc(s.name) + '</span><span>' + fmtLb(s.raceTime) + '</span></div>';
    }).join('') + (DD.bestRace ? '<div class="pb" style="margin-top:6px">YOUR BEST &nbsp;' + fmt(DD.bestRace) + '</div>' : '');
  }
  updateTitleLeaderboard();
  function isHighScore(t) { return cachedScores.length < 10 || t < cachedScores[cachedScores.length - 1].raceTime; }
  function renderLeaderboard(myTime) {
    var colors = ['gold', 'silver', 'bronze'];
    $('leaderboardSection').innerHTML = cachedScores.slice(0, 5).map(function (s, i) {
      var me = s.raceTime === myTime && s.timestamp > Date.now() - 10000;
      return '<div class="lb-row ' + (me ? 'highlight' : (colors[i] || 'normal')) + '"><span>' + (i + 1) + '. ' + esc(s.name) + '</span><span>' + fmtLb(s.raceTime) + '</span></div>';
    }).join('');
  }

  // ── end screen ──
  function showEnd() {
    var total = DD.raceTime, prev = DD.prevBestRace;
    $('endTotal').textContent = fmt(total);
    $('endLaps').textContent = DD.lapTimes.map(function (t, i) { return 'LAP ' + (i + 1) + ' ' + fmt(t); }).join('   ') + '   BEST LAP ' + fmt(DD.bestLap);
    var d = $('endDelta');
    if (!prev) { d.textContent = 'FIRST FINISH — TIME TO BEAT SET'; d.className = 'good'; }
    else if (total < prev) { d.textContent = 'NEW PERSONAL BEST!  -' + (prev - total).toFixed(1) + 's'; d.className = 'good'; }
    else { d.textContent = '+' + (total - prev).toFixed(1) + 's OFF YOUR BEST (' + fmt(prev) + ')'; d.className = 'bad'; }
    $('leaderboardSection').innerHTML = '';
    var initSec = $('initialsSection');
    initSec.style.display = 'none';
    if (hsRef && isHighScore(total)) {
      initSec.style.display = 'flex';
      var input = $('initialsInput'); input.value = '';
      if (!touch) setTimeout(function () { input.focus(); }, 80);
      var submit = function () {
        var name = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA';
        try { hsRef.push({ name: name, raceTime: total, timestamp: Date.now() }); } catch (e) {}
        initSec.style.display = 'none'; input.blur();
        setTimeout(function () { renderLeaderboard(total); }, 600);
      };
      $('initialsSubmit').onclick = submit;
      input.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); } };
    } else renderLeaderboard(total);
    endReadyAt = performance.now() + 900;
    endOv.classList.add('show'); setMenu(true);
    AudioEngine.fadeMusic(0.35, 1.5);
  }

  // ── touch controls: smaller corner wheel + pedals ──
  function bindPedal(id, k) {
    var el = $(id);
    el.addEventListener('touchstart', function (e) { e.preventDefault(); el.classList.add('pressed'); setKey(k, true); }, { passive: false });
    el.addEventListener('touchend', function (e) { e.preventDefault(); if (e.targetTouches.length === 0) { el.classList.remove('pressed'); setKey(k, false); } }, { passive: false });
    el.addEventListener('touchcancel', function () { el.classList.remove('pressed'); setKey(k, false); });
  }
  bindPedal('mob-gas', 'u'); bindPedal('mob-brake', 'b');
  var wc = $('mob-wheel-canvas'), wctx = wc.getContext('2d');
  var CX = 70, CY = 70, R = 56, BALL_R = 9, angle = 0, dragging = false, wid = null, lastTA = 0, snapT = null;
  var DEAD = 0.12, MAX_A = Math.PI * 0.65;
  function local(t) { var r = wc.getBoundingClientRect(); return { x: (t.clientX - r.left) * 140 / r.width, y: (t.clientY - r.top) * 140 / r.height }; }
  function ptAngle(x, y) { return Math.atan2(x - CX, -(y - CY)); }
  function findT(list, id) { for (var i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i]; return null; }
  function drawWheel(a) {
    wctx.clearRect(0, 0, 140, 140); wctx.save(); wctx.translate(CX, CY);
    wctx.beginPath(); wctx.arc(0, 0, R, 0, Math.PI * 2); wctx.fillStyle = 'rgba(10,0,25,0.35)'; wctx.fill();
    wctx.strokeStyle = 'rgba(220,50,50,0.9)'; wctx.lineWidth = 9; wctx.stroke();
    wctx.strokeStyle = 'rgba(200,40,40,0.75)'; wctx.lineWidth = 5;
    for (var i = 0; i < 3; i++) { var s = a + i * Math.PI * 2 / 3; wctx.beginPath(); wctx.moveTo(0, 0); wctx.lineTo(Math.sin(s) * R * 0.85, -Math.cos(s) * R * 0.85); wctx.stroke(); }
    wctx.beginPath(); wctx.arc(0, 0, 14, 0, Math.PI * 2); wctx.fillStyle = 'rgba(200,40,40,0.95)'; wctx.fill();
    if (Math.abs(a) > DEAD) { var s0 = -Math.PI / 2, s1 = s0 + a; wctx.beginPath(); wctx.arc(0, 0, R + 7, Math.min(s0, s1), Math.max(s0, s1)); wctx.strokeStyle = a > 0 ? 'rgba(255,220,0,0.8)' : 'rgba(0,220,255,0.8)'; wctx.lineWidth = 3; wctx.stroke(); }
    wctx.beginPath(); wctx.arc(Math.sin(a) * R, -Math.cos(a) * R, BALL_R, 0, Math.PI * 2); wctx.fillStyle = 'rgba(255,255,220,0.95)'; wctx.fill();
    wctx.restore();
  }
  function applyAngle(a) { keyLeft = a < -DEAD; keyRight = a > DEAD; }
  wc.addEventListener('touchstart', function (e) {
    e.preventDefault(); if (dragging) return;
    var t = e.changedTouches[0], p = local(t), dx = p.x - CX, dy = p.y - CY;
    if (Math.sqrt(dx * dx + dy * dy) < 18) { AudioEngine.playHorn(); return; }
    clearInterval(snapT); dragging = true; wid = t.identifier; lastTA = ptAngle(p.x, p.y);
  }, { passive: false });
  wc.addEventListener('touchmove', function (e) {
    e.preventDefault(); if (!dragging) return;
    var t = findT(e.touches, wid); if (!t) return;
    var p = local(t), cur = ptAngle(p.x, p.y), d = cur - lastTA;
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    lastTA = cur; angle = Math.max(-MAX_A, Math.min(MAX_A, angle + d)); drawWheel(angle); applyAngle(angle);
  }, { passive: false });
  wc.addEventListener('touchend', function (e) {
    e.preventDefault(); if (findT(e.touches, wid)) return;
    dragging = false; wid = null;
    snapT = setInterval(function () { angle *= 0.7; if (Math.abs(angle) < 0.01) { angle = 0; clearInterval(snapT); } drawWheel(angle); applyAngle(angle); }, 16);
  }, { passive: false });
  wc.addEventListener('touchcancel', function () { dragging = false; wid = null; angle = 0; drawWheel(0); applyAngle(0); });
  drawWheel(0);
  document.addEventListener('touchmove', function (e) { if (e.target.tagName !== 'INPUT') e.preventDefault(); }, { passive: false });

  window.DDUI = { startRace: startRace, goTitle: goTitle };
  DD.boot(window.DD_EXTRA_IMAGES || [], window.DD_ON_READY);
})();
