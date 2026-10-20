/* Ghoul Box — Graveyard Dimension Passport */
(function () {
  'use strict';
  var GB = window.GB, L = window.PP_LISTS, $ = function (id) { return document.getElementById(id); };
  var canvas = $('pass'), ctx = canvas.getContext('2d'), W = 1080, H = 1350;
  var NAV = 6, PLOTS = L.rows.length * 666;               // avatars, plot numbers
  // f = [avatar, class, cause, plot, allergy, visa, stamp1, stamp2, stamp3, expiry]
  var SIZES = function () { return [NAV, L.classes.length, L.causes.length, PLOTS, L.allergies.length, L.visas.length, L.stamps.length, L.stamps.length, L.stamps.length, L.expiry.length]; };
  var KEYI = { a: 0, k: 1, c: 2, p: 3, l: 4, v: 5, s: 6, x: 9 };
  var state = { n: '', f: null, d: '' }, photo = null;
  var rnd = function (n) { return Math.floor(Math.random() * n); };
  var clean = function (v) { return String(v || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28); };
  function today() { var d = new Date(); return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  function validDate(s) { if (!/^\d{8}$/.test(s || '')) return false; var y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6); var t = new Date(y, m - 1, d); return y >= 2024 && y <= 2100 && t.getMonth() === m - 1 && t.getDate() === d; }
  function fmtDate(s) { return s.slice(6) + ' ' + ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][+s.slice(4, 6) - 1] + ' ' + s.slice(0, 4); }
  function pickStamps(f) { var n = L.stamps.length, a = rnd(n), b, c; do { b = rnd(n); } while (b === a); do { c = rnd(n); } while (c === a || c === b); f[6] = a; f[7] = b; f[8] = c; }
  function roll(keep) {
    var sz = SIZES(), f = sz.map(function (n) { return rnd(n); }); pickStamps(f);
    if (keep) f[0] = keep[0]; return f;
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function passNo() { var h = hash(state.n.toUpperCase() + '|' + state.f.join('.') + '|' + state.d), s = (h % 2176782336).toString(36).toUpperCase(); return 'GD' + ('000000' + s).slice(-6) + (state.f[3] % 10); }
  function plot() { var p = state.f[3]; return 'ROW ' + L.rows[p % L.rows.length] + ' · PLOT ' + (Math.floor(p / L.rows.length) + 1); }
  function nameOr() { return state.n || 'Unknown Ghoul'; }
  function mrzName() {
    var s = nameOr().normalize ? nameOr().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : nameOr();
    return s.toUpperCase().replace(/[^A-Z ]/g, '').trim().replace(/ +/g, '<') || 'UNKNOWN<GHOUL';
  }

  /* ---------- URL ---------- */
  function shareURL() {
    var u = new URL(location.href); u.search = ''; u.hash = '';
    if (state.n) u.searchParams.set('n', state.n);
    u.searchParams.set('f', state.f.map(function (x) { return x.toString(36); }).join('.')); u.searchParams.set('d', state.d); return u.toString();
  }
  function fromURL() {
    var p = new URLSearchParams(location.search), raw = p.get('f'); if (!raw) return null;
    var f = raw.split('.').map(function (x) { return /^[0-9a-z]{1,4}$/.test(x) ? parseInt(x, 36) : NaN; }), sz = SIZES();
    if (f.length !== sz.length) return null;
    for (var i = 0; i < sz.length; i++) if (isNaN(f[i]) || f[i] < 0 || f[i] >= sz[i]) return null;
    if (f[6] === f[7] || f[6] === f[8] || f[7] === f[8]) return null;
    return { n: clean(p.get('n')), f: f, d: validDate(p.get('d')) ? p.get('d') : today() };
  }

  /* ---------- avatars (drawn, no images) ---------- */
  function avatar(x, i, X, Y, w, h) {
    x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip();
    var g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, ['#2b0b4a', '#0b2a3a', '#1d0a33', '#3a1a05', '#3d0610', '#0b3020'][i]); g.addColorStop(1, '#050508');
    x.fillStyle = g; x.fillRect(X, Y, w, h);
    var cx = X + w / 2, u = w / 100;
    function shoulders(col) { x.fillStyle = col; x.beginPath(); x.ellipse(cx, Y + h * 1.02, 46 * u, 34 * u, 0, Math.PI, 0); x.fill(); }
    function head(col, r) { x.fillStyle = col; x.beginPath(); x.ellipse(cx, Y + h * .42, (r || 26) * u, (r || 26) * 1.18 * u, 0, 0, 7); x.fill(); }
    function eyes(col, glow) { x.save(); x.shadowColor = col; x.shadowBlur = glow ? 12 * u : 0; x.fillStyle = col; x.beginPath(); x.ellipse(cx - 9 * u, Y + h * .41, 4.5 * u, 5.5 * u, 0, 0, 7); x.ellipse(cx + 9 * u, Y + h * .41, 4.5 * u, 5.5 * u, 0, 0, 7); x.fill(); x.restore(); }
    if (i === 0) { shoulders('#0a0a10'); head('#0a0a10'); eyes('#39ff14', true); }                         // silhouette
    else if (i === 1) { shoulders('#1b1b22'); head('#e8e0d4', 27); x.fillStyle = '#0a0a10'; x.beginPath(); x.ellipse(cx - 10 * u, Y + h * .41, 7 * u, 8 * u, 0, 0, 7); x.ellipse(cx + 10 * u, Y + h * .41, 7 * u, 8 * u, 0, 0, 7); x.fill();
      x.beginPath(); x.moveTo(cx, Y + h * .47); x.lineTo(cx - 4 * u, Y + h * .52); x.lineTo(cx + 4 * u, Y + h * .52); x.fill(); for (var t = -2; t <= 2; t++) x.fillRect(cx + t * 6 * u - u, Y + h * .56, 2 * u, 7 * u); } // skull
    else if (i === 2) { x.fillStyle = '#f2f0ff'; x.beginPath(); x.moveTo(cx - 34 * u, Y + h); x.lineTo(cx - 30 * u, Y + h * .45); x.ellipse(cx, Y + h * .45, 30 * u, 32 * u, 0, Math.PI, 0); x.lineTo(cx + 34 * u, Y + h); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx - 10 * u, Y + h * .42, 5 * u, 8 * u, 0, 0, 7); x.ellipse(cx + 10 * u, Y + h * .42, 5 * u, 8 * u, 0, 0, 7); x.ellipse(cx, Y + h * .55, 5 * u, 7 * u, 0, 0, 7); x.fill(); } // ghost
    else if (i === 3) { shoulders('#1b1b22'); x.fillStyle = '#ff8a00'; x.beginPath(); x.ellipse(cx, Y + h * .45, 34 * u, 28 * u, 0, 0, 7); x.fill(); x.fillStyle = '#2f6b1f'; x.fillRect(cx - 3 * u, Y + h * .45 - 34 * u, 6 * u, 10 * u);
      x.save(); x.shadowColor = '#ffd34d'; x.shadowBlur = 10 * u; x.fillStyle = '#ffd34d'; x.beginPath(); x.moveTo(cx - 16 * u, Y + h * .4); x.lineTo(cx - 6 * u, Y + h * .4); x.lineTo(cx - 11 * u, Y + h * .34); x.fill(); x.beginPath(); x.moveTo(cx + 16 * u, Y + h * .4); x.lineTo(cx + 6 * u, Y + h * .4); x.lineTo(cx + 11 * u, Y + h * .34); x.fill();
      x.beginPath(); x.moveTo(cx - 20 * u, Y + h * .5); x.lineTo(cx + 20 * u, Y + h * .5); x.lineTo(cx + 12 * u, Y + h * .56); x.lineTo(cx, Y + h * .52); x.lineTo(cx - 12 * u, Y + h * .56); x.fill(); x.restore(); } // pumpkin
    else if (i === 4) { shoulders('#0a0a10'); x.fillStyle = '#b3122e'; x.beginPath(); x.moveTo(cx - 40 * u, Y + h); x.lineTo(cx - 30 * u, Y + h * .66); x.lineTo(cx + 30 * u, Y + h * .66); x.lineTo(cx + 40 * u, Y + h); x.fill(); head('#d8d3e6');
      x.fillStyle = '#111'; x.beginPath(); x.moveTo(cx - 28 * u, Y + h * .36); x.quadraticCurveTo(cx, Y + h * .12, cx + 28 * u, Y + h * .36); x.lineTo(cx, Y + h * .3); x.fill(); eyes('#ff1744', true);
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(cx - 6 * u, Y + h * .53); x.lineTo(cx - 4 * u, Y + h * .58); x.lineTo(cx - 2 * u, Y + h * .53); x.moveTo(cx + 2 * u, Y + h * .53); x.lineTo(cx + 4 * u, Y + h * .58); x.lineTo(cx + 6 * u, Y + h * .53); x.fill(); } // vampire
    else { shoulders('#3a2a1a'); head('#7fae6a'); x.strokeStyle = '#2c3b22'; x.lineWidth = 2 * u; x.beginPath(); x.moveTo(cx - 20 * u, Y + h * .3); x.lineTo(cx + 4 * u, Y + h * .33); for (var k = 0; k < 5; k++) { x.moveTo(cx - 16 * u + k * 5 * u, Y + h * .29); x.lineTo(cx - 16 * u + k * 5 * u, Y + h * .345); } x.stroke();
      eyes('#fbbf24', false); x.fillStyle = '#2c3b22'; x.fillRect(cx - 9 * u, Y + h * .53, 18 * u, 3 * u); } // zombie
    x.restore();
  }

  /* ---------- drawing ---------- */
  function fitFont(text, fam, size, maxW, min) { for (var s = size; s > min; s--) { ctx.font = fam.replace('%', s); if (ctx.measureText(text).width <= maxW) return; } ctx.font = fam.replace('%', min); }
  function wrap(text, maxW) { var w = text.split(' '), out = [], line = ''; w.forEach(function (x) { var t = line ? line + ' ' + x : x; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = x; } else line = t; }); if (line) out.push(line); return out; }
  var sc = document.createElement('canvas'); sc.width = sc.height = 520;   // offscreen, so worn-ink knockouts only hit the stamp
  function stamp(text, cx, cy, rot, col, R, round) {
    var x = sc.getContext('2d'), keep = ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 520, 520);
    ctx = x; x.save(); x.translate(260, 260); x.rotate(rot); x.strokeStyle = col; x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (round) {
      x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 104, 0, 7); x.stroke(); x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 91, 0, 7); x.stroke();
      var words = text.split(' '), lines = [], line = ''; x.font = '26px "Special Elite", monospace';
      words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (x.measureText(t).width > 150 && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line);
      lines.forEach(function (l, i) { fitFont(l, '%px "Special Elite", monospace', 26, 160, 14); x.fillText(l, 0, (i - (lines.length - 1) / 2) * 28); });
      x.font = '18px "Special Elite", monospace'; x.fillText('★ G.D. ★', 0, -72); x.fillText('★ ★ ★', 0, 74);
    } else {
      fitFont(text, '%px "Special Elite", monospace', 34, 420, 16); var tw = x.measureText(text).width + 44;
      x.lineWidth = 5; x.strokeRect(-tw / 2, -34, tw, 68); x.lineWidth = 2; x.strokeRect(-tw / 2 + 7, -27, tw - 14, 54); x.fillText(text, 0, 2);
    }
    x.restore(); ctx = keep;
    x.globalCompositeOperation = 'destination-out';
    for (var k = 0; k < 420; k++) x.fillRect(R() * 520, R() * 520, 2 + R() * 3, 2 + R() * 3);
    x.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha = .88; ctx.drawImage(sc, cx - 260, cy - 260); ctx.restore();
  }
  function draw() {
    var f = state.f, R = GB.rng(hash(state.f.join('.') + state.d));
    ctx.save(); ctx.clearRect(0, 0, W, H);
    // backdrop
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0430'); g.addColorStop(1, '#050508'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (var k = 0; k < 90; k++) { ctx.globalAlpha = R() * .6 + .2; ctx.fillStyle = '#fff'; ctx.fillRect(R() * W, R() * 170, 2, 2); } ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.fillStyle = '#c084fc'; ctx.font = '800 26px Inter, sans-serif'; ctx.fillText('OFFICE OF THE GROUNDSKEEPER · BORDER CROSSING DIVISION', W / 2, 62);
    ctx.font = '400 92px Creepster, cursive'; ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#000'; ctx.strokeText('GRAVEYARD DIMENSION', W / 2, 160);
    ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 26; ctx.fillStyle = '#39ff14'; ctx.fillText('GRAVEYARD DIMENSION', W / 2, 160); ctx.shadowBlur = 0;
    // data page
    var px = 50, py = 196, pw = 980, ph = 740;
    ctx.save(); ctx.shadowColor = 'rgba(191,0,255,.5)'; ctx.shadowBlur = 40; ctx.fillStyle = '#e9e2cf'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, 22) : ctx.rect(px, py, pw, ph); ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, pw, ph, 22) : ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.globalAlpha = .16; ctx.lineWidth = 1.5;   // guilloche
    for (var q = 0; q < 26; q++) { ctx.strokeStyle = q % 2 ? '#6a00b8' : '#1f7a3a'; ctx.beginPath(); for (var xx = px; xx <= px + pw; xx += 8) { var yy = py + 120 + q * 22 + Math.sin(xx / 38 + q * .7) * 14 + Math.sin(xx / 97 + q) * 8; xx === px ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); }
    ctx.globalAlpha = .07; ctx.fillStyle = '#2c0322'; ctx.font = '400 300px Creepster, cursive'; ctx.fillText('RIP', px + pw - 200, py + ph - 120);
    ctx.globalAlpha = 1; ctx.fillStyle = '#2c0322'; ctx.fillRect(px, py, pw, 74);
    ctx.fillStyle = '#e9e2cf'; ctx.textAlign = 'left'; ctx.font = '800 26px Inter, sans-serif'; ctx.fillText('PASSPORT · PASSE-MORT', px + 30, py + 47);
    ctx.textAlign = 'right'; ctx.fillStyle = '#39ff14'; ctx.font = '22px "Share Tech Mono", monospace'; ctx.fillText('TYPE P  ·  CODE GRV  ·  No ' + passNo(), px + pw - 30, py + 46);
    // photo
    var fx = px + 36, fy = py + 106, fw = 290, fh = 380;
    ctx.fillStyle = '#111'; ctx.fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
    if (photo) {
      var s = Math.max(fw / photo.width, fh / photo.height), sw = fw / s, sh = fh / s;
      ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip(); try { ctx.filter = 'grayscale(.35) contrast(1.08)'; } catch (e) {}
      ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2.6, sw, sh, fx, fy, fw, fh); ctx.filter = 'none';
      var tint = ctx.createLinearGradient(0, fy, 0, fy + fh); tint.addColorStop(0, 'rgba(57,255,20,.05)'); tint.addColorStop(1, 'rgba(60,0,110,.28)'); ctx.fillStyle = tint; ctx.fillRect(fx, fy, fw, fh); ctx.restore();
    } else avatar(ctx, f[0], fx, fy, fw, fh);
    ctx.strokeStyle = '#2c0322'; ctx.lineWidth = 3; ctx.strokeRect(fx, fy, fw, fh);
    // ghost-print hologram
    ctx.save(); ctx.globalAlpha = .18; avatar(ctx, f[0], px + 36, py + 510, 90, 115); ctx.restore();
    ctx.textAlign = 'left';
    // fields
    var lx = px + 360, ly = py + 120, colW = pw - 400;
    function field(label, val, y, maxW) {
      ctx.fillStyle = '#6b5a66'; ctx.font = '700 15px Inter, sans-serif'; ctx.fillText(label, lx, y);
      ctx.fillStyle = '#16101a'; fitFont(val, '%px "Special Elite", monospace', 30, maxW || colW, 16); ctx.fillText(val, lx, y + 34);
    }
    ctx.fillStyle = '#6b5a66'; ctx.font = '700 15px Inter, sans-serif'; ctx.fillText('NAME OF TRAVELER / NOM DU FANTÔME', lx, ly);
    ctx.fillStyle = '#16101a'; fitFont(nameOr().toUpperCase(), '%px "Special Elite", monospace', 44, colW, 18); ctx.fillText(nameOr().toUpperCase(), lx, ly + 46);
    field('UNDEAD CLASS', L.classes[f[1]].toUpperCase(), ly + 92);
    field('HOME PLOT', plot(), ly + 168, colW / 2 - 10);
    var hx = lx; lx = lx + colW / 2 + 10; field('ALLERGIES', L.allergies[f[4]].toUpperCase(), ly + 168, colW / 2 - 10); lx = hx;
    ctx.fillStyle = '#6b5a66'; ctx.font = '700 15px Inter, sans-serif'; ctx.fillText('CAUSE OF ENTRY', lx, ly + 244);
    ctx.fillStyle = '#16101a'; ctx.font = '25px "Special Elite", monospace'; wrap(L.causes[f[2]], colW).slice(0, 2).forEach(function (l, i) { ctx.fillText(l, lx, ly + 276 + i * 30); });
    field('DATE OF ISSUE', fmtDate(state.d), ly + 356, colW / 2 - 10);
    lx = lx + colW / 2 + 10; field('EXPIRES', L.expiry[f[9]], ly + 356, colW / 2 - 10); lx = hx;
    // signature
    ctx.fillStyle = '#6b5a66'; ctx.font = '700 15px Inter, sans-serif'; ctx.fillText('ISSUING AUTHORITY', lx, ly + 434);
    ctx.fillStyle = '#3a1f8a'; ctx.font = 'italic 40px "IM Fell English", Georgia, serif'; ctx.fillText('Grave Hog', lx, ly + 476);
    ctx.fillStyle = '#6b5a66'; ctx.font = '600 15px Inter, sans-serif'; ctx.fillText('Official Groundskeeper (actual authority: none whatsoever)', lx, ly + 502, colW);
    // MRZ
    var nm = mrzName(), l1 = ('P<GRV' + nm + '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<').slice(0, 44);
    var l2 = (passNo() + '<GRV' + state.d.slice(2) + '<NO<PULSE<NO<SUNLIGHT<KEEP<YOUR<RIBS<OPEN<<<<<<<<').slice(0, 44);
    ctx.fillStyle = '#16101a'; ctx.font = '33px "Share Tech Mono", monospace'; ctx.textAlign = 'center';
    fitFont(l1, '%px "Share Tech Mono", monospace', 33, pw - 70, 18); ctx.fillText(l1, px + pw / 2, py + ph - 62); ctx.fillText(l2, px + pw / 2, py + ph - 22);
    ctx.restore();
    // visa page stamps
    var cols = ['#c8102e', '#1f5fbf', '#1f7a3a', '#6a00b8'];
    stamp(L.visas[f[5]], 330, 1000, -.06 + (R() - .5) * .06, '#39ff14', R, false);
    stamp(L.stamps[f[6]], 170, 1186, (R() - .5) * .5, '#ff1744', R, true);
    stamp(L.stamps[f[7]], 540, 1192, (R() - .5) * .5, '#00ffff', R, true);
    stamp(L.stamps[f[8]], 910, 1180, (R() - .5) * .5, '#fbbf24', R, true);
    ctx.save(); ctx.translate(840, 1000); ctx.rotate(.12); ctx.fillStyle = '#c084fc'; ctx.textAlign = 'center'; ctx.font = '22px "Special Elite", monospace';
    ctx.fillText('ENTRY: ' + fmtDate(state.d), 0, -10); ctx.fillText('PORT: DOUBLE FUTURE RADIO', 0, 22); ctx.restore();
    ctx.textAlign = 'center'; ctx.font = '700 28px Inter, sans-serif'; ctx.fillStyle = '#00ff88'; ctx.fillText('Get your papers: thejurn.com/ghoulbox', W / 2, H - 20);
    ctx.restore();
  }
  var fontsP = null;
  function render() {
    fontsP = fontsP || GB.fontsReady().then(function () { return document.fonts && document.fonts.load ? Promise.all(['28px "Special Elite"', '28px "Share Tech Mono"', 'italic 40px "IM Fell English"'].map(function (f) { return document.fonts.load(f); })).catch(function () {}) : null; });
    return fontsP.then(draw);
  }
  function shareText() { return '🛂 ' + (state.n ? state.n + ' just got' : 'I just got') + ' papers for the Graveyard Dimension: ' + L.classes[state.f[1]] + ', allergic to ' + L.allergies[state.f[4]].toLowerCase() + '. Stamped by Grave Hog. Get yours:'; }
  var tmr;
  function sync(push) {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      render(); $('xshare').href = GB.xIntent(shareText(), shareURL());
      if (push) history.replaceState(null, '', shareURL());
      document.title = (state.n ? state.n + '’s ' : '') + 'Graveyard Dimension Passport | Ghoul Box';
    }, 100);
  }
  /* ---------- UI ---------- */
  $('f-name').addEventListener('input', function () { state.n = clean($('f-name').value); sync(true); });
  var box = $('avatars');
  for (var i = 0; i < NAV; i++) (function (a) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', ['Silhouette', 'Skull', 'Ghost', 'Pumpkin head', 'Vampire', 'Zombie'][a]); b.dataset.a = a;
    var c = document.createElement('canvas'); c.width = 90; c.height = 120; c.style.width = '100%'; c.style.height = '100%'; avatar(c.getContext('2d'), a, 0, 0, 90, 120); b.appendChild(c);
    b.addEventListener('click', function () { state.f[0] = a; mark(); sync(true); }); box.appendChild(b);
  })(i);
  function mark() { Array.prototype.forEach.call(box.children, function (b) { var on = +b.dataset.a === state.f[0] && !photo; b.setAttribute('aria-checked', String(on)); b.tabIndex = +b.dataset.a === state.f[0] ? 0 : -1; }); }
  box.addEventListener('keydown', function (e) { var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return; e.preventDefault(); state.f[0] = (state.f[0] + d + NAV) % NAV; mark(); box.children[state.f[0]].focus(); sync(true); });
  $('f-photo').addEventListener('change', function () {
    var file = this.files && this.files[0]; if (!file) return;
    if (!/^image\//.test(file.type)) { GB.toast('That file isn\'t an image'); return; }
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var s = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');   // downscale, stays in memory only
      c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); photo = c; $('rm-photo').hidden = false; mark(); render(); GB.toast('Photo added (it stays on your device) 📷');
    };
    im.onerror = function () { URL.revokeObjectURL(url); GB.toast('Could not read that image'); };
    im.src = url;
  });
  $('rm-photo').addEventListener('click', function () { photo = null; $('f-photo').value = ''; $('rm-photo').hidden = true; mark(); render(); });
  $('reroll').addEventListener('click', function () { state.f = roll(state.f); state.d = today(); mark(); sync(true); });
  Array.prototype.forEach.call(document.querySelectorAll('.pp-rr button'), function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.k, sz = SIZES();
      if (k === 's') pickStamps(state.f); else { var i = KEYI[k], v; do { v = rnd(sz[i]); } while (v === state.f[i] && sz[i] > 1); state.f[i] = v; }
      sync(true);
    });
  });
  var fname = function () { return 'graveyard-passport-' + (nameOr().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ghoul') + '.png'; };
  $('dl').addEventListener('click', function () { render().then(function () { GB.download(canvas, fname()); }); });
  $('copy').addEventListener('click', function () { GB.copy(shareURL()); });
  $('share').addEventListener('click', function () { render().then(function () { GB.share({ title: 'Graveyard Dimension Passport', text: shareText(), url: shareURL(), canvas: canvas, filename: fname() }); }); });
  var link = fromURL();
  if (link) { state = link; $('f-name').value = state.n; $('shared').hidden = false; }
  else { state.f = roll(null); state.f[0] = 0; state.d = today(); }
  mark(); sync(false);
  window.PP_DEBUG = { state: function () { return state; }, render: render, hasPhoto: function () { return !!photo; } };
})();
