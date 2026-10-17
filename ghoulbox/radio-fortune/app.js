/* Ghoul Box — Double Future Radio Fortune */
(function () {
  'use strict';
  var GB = window.GB, L = window.DFR_LISTS, $ = function (id) { return document.getElementById(id); };
  var ORDER = ['openers', 'prophecies', 'items', 'warnings', 'albums', 'signoffs'], NUMS = 99;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = null, typing = 0;
  var clean = function (v) { return String(v || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24); };

  /* ---------- ISO week ---------- */
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + ('0' + Math.ceil(((t - y0) / 864e5 + 1) / 7)).slice(-2);
  }
  function weekLabel(key) {
    var m = /^(\d{4})-W(\d{2})$/.exec(key || ''); if (!m) return '';
    var jan4 = new Date(Date.UTC(+m[1], 0, 4)), mon = new Date(jan4); mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (+m[2] - 1) * 7);
    return 'WEEK OF ' + mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- fortune ---------- */
  function make(name, week) {
    var R = name ? GB.rng(hash(name.toLowerCase() + '|' + week)) : Math.random, f = ORDER.map(function (k) { return Math.floor(R() * L[k].length); });
    f.push(Math.floor(R() * NUMS)); return { f: f, n: name, w: week };
  }
  function fromURL() {
    var p = new URLSearchParams(location.search), raw = p.get('f'); if (!raw) return null;
    var f = raw.split('.').map(function (x) { return parseInt(x, 36); }); if (f.length !== ORDER.length + 1) return null;
    for (var i = 0; i < ORDER.length; i++) if (isNaN(f[i]) || f[i] < 0 || f[i] >= L[ORDER[i]].length) return null;
    if (isNaN(f[6]) || f[6] < 0 || f[6] >= NUMS) return null;
    var w = p.get('w'); if (!/^\d{4}-W\d{2}$/.test(w || '')) w = isoWeek(new Date());
    return { f: f, n: clean(p.get('n')), w: w };
  }
  function shareURL(r) {
    var u = new URL(location.href); u.search = ''; u.hash = '';
    u.searchParams.set('f', r.f.map(function (x) { return x.toString(36); }).join('.')); u.searchParams.set('w', r.w); if (r.n) u.searchParams.set('n', r.n);
    return u.toString();
  }
  function lines(r) {
    var f = r.f;
    return [
      { t: '> ' + L.openers[f[0]], c: 'amb' },
      { t: '> TRANSMISSION FOR: ' + (r.n ? r.n.toUpperCase() : 'UNKNOWN LISTENER') + ' · ' + weekLabel(r.w), c: 'dim' },
      { t: L.prophecies[f[1]], c: 'big' },
      { t: '> LUCKY ITEM: ' + L.items[f[2]].toUpperCase() },
      { t: '> LUCKY NUMBER: ' + (f[6] + 1) },
      { t: '> BEWARE: ' + L.warnings[f[3]].toUpperCase() },
      { t: '> PRESCRIBED LISTENING: ' + L.albums[f[4]] },
      { t: '> ' + L.signoffs[f[5]], c: 'amb' }
    ];
  }
  function shareText(r) { return '📻 Double Future Radio sent ' + (r.n ? r.n + ' ' : 'me ') + 'a transmission from next week: "' + L.prophecies[r.f[1]] + '"'; }

  /* ---------- static + sound ---------- */
  var sc = $('static'), sx = sc.getContext('2d'), simg = sx.createImageData(sc.width, sc.height), crt = $('crt');
  function noise() {
    var d = simg.data; for (var i = 0; i < d.length; i += 4) { var v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    sx.putImageData(simg, 0, 0);
  }
  (function loop() { if (!document.hidden && (!reduce || crt.classList.contains('tuning'))) noise(); setTimeout(function () { requestAnimationFrame(loop); }, 70); })();
  var actx = null;
  function crackle(ms) {
    if (!$('sound').checked) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var len = Math.floor(actx.sampleRate * ms / 1000), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < .003 ? 1 : .35) * (1 - i / len * .6);
      var src = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .7; g.gain.value = .25;
      src.buffer = buf; src.connect(bp); bp.connect(g); g.connect(actx.destination); src.start();
    } catch (e) { /* audio is optional */ }
  }

  /* ---------- render ---------- */
  function type(r) {
    var my = ++typing, box = $('tx'), ls = lines(r); box.textContent = '';
    crt.classList.add('tuning'); crackle(900);
    $('freq').textContent = 'FREQ ' + (88 + (r.f[0] * 7 + r.f[1] * 3) % 20 + (r.f[6] % 10) / 10).toFixed(1) + ' · DFR';
    return new Promise(function (done) {
      setTimeout(function () {
        crt.classList.remove('tuning'); var li = 0;
        (function nextLine() {
          if (my !== typing) return;
          if (li >= ls.length) { done(); return; }
          var p = document.createElement('p'); if (ls[li].c) p.className = ls[li].c; box.appendChild(p);
          var text = ls[li].t, ci = 0; p.classList.add('cur');
          if (reduce) { p.textContent = text; p.classList.remove('cur'); li++; nextLine(); return; }
          (function ch() {
            if (my !== typing) return;
            ci = Math.min(text.length, ci + 2); p.textContent = text.slice(0, ci);
            if (ci < text.length) setTimeout(ch, 14); else { p.classList.remove('cur'); li++; setTimeout(nextLine, 160); }
          })();
        })();
      }, reduce ? 0 : 900);
    });
  }
  function wrapLines(x, text, maxW) {
    var words = text.split(' '), out = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line); return out;
  }
  function drawCard(r) {
    var c = $('card'), x = c.getContext('2d'), W = 1080, H = 1350, R = GB.rng(r.f.reduce(function (a, b) { return a * 31 + b; }, 7));
    x.fillStyle = '#1a1a20'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#0c0c10'; x.beginPath(); x.roundRect ? x.roundRect(40, 40, W - 80, H - 80, 50) : x.rect(40, 40, W - 80, H - 80); x.fill();
    var g = x.createRadialGradient(540, 640, 80, 540, 640, 760); g.addColorStop(0, '#08280f'); g.addColorStop(1, '#010602');
    x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(80, 80, W - 160, H - 220, 36) : x.rect(80, 80, W - 160, H - 220); x.fill();
    x.save(); x.beginPath(); x.rect(80, 80, W - 160, H - 220); x.clip();
    for (var k = 0; k < 3500; k++) { x.globalAlpha = R() * .18; x.fillStyle = '#9f9'; x.fillRect(80 + R() * (W - 160), 80 + R() * (H - 220), 2, 2); }
    x.globalAlpha = 1; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.font = '44px VT323, monospace'; x.fillStyle = '#ffb000'; x.shadowColor = '#ffb000'; x.shadowBlur = 10;
    x.fillText('DOUBLE FUTURE RADIO', 130, 150); x.textAlign = 'right'; x.fillStyle = '#ff3b3b'; x.shadowColor = '#f00'; x.fillText('● LIVE', W - 130, 150);
    x.textAlign = 'left'; x.fillStyle = '#5dff7a'; x.shadowColor = '#5dff7a';
    var y = 230;
    lines(r).forEach(function (ln, i) {
      var big = ln.c === 'big', size = big ? 64 : 40, lh = size * 1.08;
      x.font = size + 'px VT323, monospace'; x.fillStyle = ln.c === 'amb' ? '#ffb000' : big ? '#d4ffd9' : ln.c === 'dim' ? '#3fbf55' : '#5dff7a';
      x.shadowColor = x.fillStyle;
      wrapLines(x, ln.t, W - 260).forEach(function (l) { x.fillText(l, 130, y); y += lh; }); y += big ? 26 : 12;
    });
    x.shadowBlur = 0; x.globalAlpha = .28; x.fillStyle = '#000'; for (var sy = 80; sy < H - 140; sy += 5) x.fillRect(80, sy, W - 160, 2);
    x.restore(); x.globalAlpha = 1;
    var v = x.createRadialGradient(540, 640, 400, 540, 640, 820); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)'); x.fillStyle = v; x.fillRect(80, 80, W - 160, H - 220);
    x.textAlign = 'center'; x.font = '700 30px Inter, sans-serif'; x.fillStyle = '#00ff88'; x.fillText('Tune in: thejurn.com/ghoulbox', 540, H - 78);
    return c;
  }
  function show(r, push) {
    cur = r; $('result').hidden = false;
    var url = shareURL(r); $('xshare').href = GB.xIntent(shareText(r) + ' Tune in:', url);
    if (push) history.replaceState(null, '', url);
    document.title = (r.n ? r.n + '\'s' : 'Your') + ' Double Future Radio Fortune | Ghoul Box';
    return type(r);
  }
  function withCard(fn) {
    var ready = document.fonts && document.fonts.load ? Promise.all([GB.fontsReady(), document.fonts.load('40px VT323')]).catch(function () {}) : Promise.resolve();
    ready.then(function () { fn(drawCard(cur)); });
  }
  $('tune').addEventListener('click', function () { var n = clean($('f-name').value); show(make(n, isoWeek(new Date())), true); $('shared').hidden = true; $('tune').textContent = '📻 Re-tune'; });
  var fname = function () { return 'double-future-radio-' + (cur.n ? cur.n.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' : '') + cur.w.toLowerCase() + '.png'; };
  $('dl').addEventListener('click', function () { if (cur) withCard(function (c) { GB.download(c, fname()); }); });
  $('copy').addEventListener('click', function () { if (cur) GB.copy(shareText(cur) + ' ' + shareURL(cur)); });
  $('share').addEventListener('click', function () { if (cur) withCard(function (c) { GB.share({ title: 'Double Future Radio Fortune', text: shareText(cur), url: shareURL(cur), canvas: c, filename: fname() }); }); });
  var link = fromURL();
  if (link) { $('f-name').value = link.n; $('shared').hidden = false; show(link, false); }
  window.DFR_DEBUG = { cur: function () { return cur; }, make: make, isoWeek: isoWeek, done: function () { return typing; } };
})();
