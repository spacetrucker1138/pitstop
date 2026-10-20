/* Ghoul Box — Undead Horoscope. A reading is a pure function of (sign slug, ISO week): same sign + same week = same
   reading for everyone. Weeks roll over Monday 00:00 UTC so the whole world flips at once.
   APPEND-ONLY LOGIC: never reorder the R() draws in reading(); add new draws at the end only. */
(function () {
  'use strict';
  var GB = window.GB, L = window.HR_LISTS, $ = function (id) { return document.getElementById(id); };
  var S = L.signs, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var canvas = $('card'), ctx = canvas.getContext('2d'), cur = null;

  /* ---------- weeks (UTC) ---------- */
  function weekKey(d) {
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + ('0' + Math.ceil(((t - y0) / 864e5 + 1) / 7)).slice(-2);
  }
  function monday(key) { var m = /^(\d{4})-W(\d{2})$/.exec(key), j4 = new Date(Date.UTC(+m[1], 0, 4)), r = new Date(j4); r.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() || 7) - 1) + (+m[2] - 1) * 7); return r; }
  function shift(key, n) { var d = monday(key); d.setUTCDate(d.getUTCDate() + 7 * n + 3); return weekKey(d); }
  function validWeek(k) { if (!/^\d{4}-W\d{2}$/.test(k || '')) return false; var m = monday(k); return weekKey(new Date(m.getTime() + 3 * 864e5)) === k && k >= '2026-W01' && k <= weekKey(new Date()); }
  function weekLabel(k) { var a = monday(k), b = new Date(a.getTime() + 6 * 864e5), f = function (d) { return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); }; return f(a) + ' – ' + f(b) + ', ' + b.getUTCFullYear(); }
  function counts(k) { var v = L.versions[0]; L.versions.forEach(function (x) { if (x.from <= k) v = x; }); return v.n; }

  /* ---------- signs ---------- */
  function range(i) { var a = S[i].from, b = S[(i + 1) % 12].from, end = new Date(Date.UTC(2001, b[0] - 1, b[1] - 1)); return MON[a[0] - 1] + ' ' + a[1] + ' – ' + MON[end.getUTCMonth()] + ' ' + end.getUTCDate(); }
  function signFor(m, d) { var best = 11; S.forEach(function (s, i) { if (m > s.from[0] || (m === s.from[0] && d >= s.from[1])) best = i; }); return best; }
  function bySlug(slug) { for (var i = 0; i < S.length; i++) if (S[i].slug === slug) return i; return -1; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function reading(i, k) {
    var R = GB.rng(hash(k + '|' + S[i].slug)), n = counts(k), pick = function (len) { return Math.floor(R() * len); };
    var r = {
      sign: i, week: k, text: L.readings[pick(n.readings)], haunt: L.haunts[pick(n.haunts)], number: 1 + pick(99),
      compat: (i + 1 + pick(11)) % 12, avoid: L.avoid[pick(n.avoid)], album: L.albums[pick(n.albums)], era: L.eras[pick(n.eras)]
    };
    r.meters = [['DOOM', 1 + pick(5)], ['LUCK', 1 + pick(5)], ['CHAOS', 1 + pick(5)]];
    return r;
  }
  function shareURL(r) { var u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('s', S[r.sign].slug); u.searchParams.set('w', r.week); return u.toString(); }
  function shareText(r) { return '🔮 ' + S[r.sign].name + ' this week: "' + r.text + '" Lucky haunt: ' + r.haunt + '. What does your death sign say?'; }

  /* ---------- canvas ---------- */
  function wrap(text, maxW) { var w = text.split(' '), out = [], line = ''; w.forEach(function (x) { var t = line ? line + ' ' + x : x; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = x; } else line = t; }); if (line) out.push(line); return out; }
  function fit(text, fam, size, maxW, min) { for (var s = size; s > min; s -= 2) { ctx.font = fam.replace('%', s); if (ctx.measureText(text).width <= maxW) return s; } ctx.font = fam.replace('%', min); return min; }
  function sigil(cx, cy, rad, i, glow) {
    ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = '#39ff14'; ctx.shadowColor = '#39ff14'; ctx.shadowBlur = glow; ctx.lineWidth = rad / 18;
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.stroke(); ctx.lineWidth = rad / 45; ctx.beginPath(); ctx.arc(0, 0, rad * .84, 0, 7); ctx.stroke();
    for (var k = 0; k < 12; k++) { var a = k / 12 * 6.283 - 1.5708; ctx.fillStyle = k === i ? '#39ff14' : 'rgba(192,132,252,.7)'; ctx.beginPath(); ctx.arc(Math.cos(a) * rad * .92, Math.sin(a) * rad * .92, k === i ? rad / 14 : rad / 26, 0, 7); ctx.fill(); }
    ctx.shadowBlur = 0; ctx.fillStyle = '#e8e0d4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '400 ' + Math.round(rad) + 'px Creepster, cursive';
    ctx.fillText(S[i].name.replace(/^The /, '').charAt(0), 0, rad * .06); ctx.restore();
  }
  function draw(r) {
    var W = 1080, H = 1350, s = S[r.sign], R = GB.rng(hash(r.week + s.slug + 'art'));
    ctx.save();
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12001f'); g.addColorStop(1, '#050508'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (var k = 0; k < 220; k++) { ctx.globalAlpha = R() * .7 + .15; ctx.fillStyle = R() > .85 ? '#c084fc' : '#fff'; ctx.fillRect(R() * W, R() * H, 2, 2); } ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffb000'; ctx.font = '30px VT323, monospace'; ctx.fillText('DOUBLE FUTURE RADIO · WEEKLY DEATH-SCOPE', W / 2, 62);
    sigil(W / 2, 200, 105, r.sign, 30);
    ctx.lineJoin = 'round'; fit(s.name.toUpperCase(), '400 %px Creepster, cursive', 96, 980, 50); ctx.lineWidth = 10; ctx.strokeStyle = '#000'; ctx.strokeText(s.name.toUpperCase(), W / 2, 395);
    ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 24; ctx.fillStyle = '#39ff14'; ctx.fillText(s.name.toUpperCase(), W / 2, 395); ctx.shadowBlur = 0;
    ctx.fillStyle = '#c084fc'; ctx.font = '700 28px Inter, sans-serif'; ctx.fillText(range(r.sign).toUpperCase() + '  ·  WEEK OF ' + weekLabel(r.week).toUpperCase(), W / 2, 445);
    // reading
    ctx.fillStyle = '#fff'; var fs = 46; ctx.font = '600 ' + fs + 'px Inter, sans-serif'; var lines = wrap('“' + r.text + '”', 900);
    while (lines.length > 4 && fs > 30) { fs -= 3; ctx.font = '600 ' + fs + 'px Inter, sans-serif'; lines = wrap('“' + r.text + '”', 900); }
    var y = 530; lines.forEach(function (l) { ctx.fillText(l, W / 2, y); y += fs * 1.25; });
    // details box
    y = Math.max(y + 20, 760); var bx = 70, bw = W - 140;
    ctx.fillStyle = 'rgba(17,17,25,.85)'; ctx.strokeStyle = 'rgba(191,0,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, y, bw, 420, 22) : ctx.rect(bx, y, bw, 420); ctx.fill(); ctx.stroke();
    var rows = [['LUCKY HAUNT', r.haunt], ['LUCKY NUMBER', String(r.number)], ['COMPATIBLE WITH', S[r.compat].name], ['AVOID', r.avoid], ['COSMIC SOUNDTRACK', r.album + ', ' + r.era]];
    ctx.textAlign = 'left'; var ry = y + 58;
    rows.forEach(function (row) {
      ctx.fillStyle = '#0f8'; ctx.font = '800 22px Inter, sans-serif'; ctx.fillText(row[0], bx + 36, ry);
      ctx.fillStyle = '#e8e0d4'; fit(row[1], '600 %px Inter, sans-serif', 32, bw - 340, 18); ctx.fillText(row[1], bx + 300, ry); ry += 64;
    });
    // meters
    ctx.textAlign = 'center'; var my = y + 465;
    r.meters.forEach(function (m, j) {
      var cx = W / 2 + (j - 1) * 320; ctx.fillStyle = '#c084fc'; ctx.font = '800 24px Inter, sans-serif'; ctx.fillText(m[0], cx, my);
      for (var q = 0; q < 5; q++) { ctx.fillStyle = q < m[1] ? ['#ff1744', '#39ff14', '#fbbf24'][j] : 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(cx - 72 + q * 36, my + 34, 13, 0, 7); ctx.fill(); }
    });
    ctx.fillStyle = '#00ff88'; ctx.font = '700 28px Inter, sans-serif'; ctx.fillText('Read yours: thejurn.com/ghoulbox', W / 2, H - 30);
    ctx.restore();
  }

  /* ---------- UI ---------- */
  function show(r, push) {
    cur = r; var s = S[r.sign];
    $('result').hidden = false;
    $('r-name').textContent = s.name; $('r-range').textContent = range(r.sign) + ' · ruled by ' + s.ruler; $('r-trait').textContent = s.trait;
    $('r-week').textContent = (r.week === weekKey(new Date()) ? 'This week: ' : 'Archived broadcast: ') + weekLabel(r.week) + ' (' + r.week + ')';
    $('r-text').textContent = r.text; $('r-haunt').textContent = r.haunt; $('r-num').textContent = r.number; $('r-compat').textContent = S[r.compat].name;
    $('r-avoid').textContent = r.avoid; $('r-sound').textContent = r.album + ', ' + r.era;
    $('r-meters').textContent = r.meters.map(function (m) { return m[0] + ' ' + '●'.repeat(m[1]) + '○'.repeat(5 - m[1]); }).join('   ');
    $('next').disabled = r.week >= weekKey(new Date()); $('prev').disabled = r.week <= '2026-W01';
    Array.prototype.forEach.call($('signs').children, function (b) { b.setAttribute('aria-pressed', String(+b.dataset.i === r.sign)); });
    var url = shareURL(r); $('xshare').href = GB.xIntent(shareText(r), url);
    if (push) history.replaceState(null, '', url);
    document.title = s.name + ' — Undead Horoscope, ' + r.week + ' | Ghoul Box';
    Promise.all([GB.fontsReady(), document.fonts && document.fonts.load ? document.fonts.load('30px VT323').catch(function () {}) : null]).then(function () { if (cur === r) draw(r); });
  }
  var box = $('signs');
  S.forEach(function (s, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'sign'; b.dataset.i = i; b.setAttribute('aria-pressed', 'false');
    var n = document.createElement('b'); n.textContent = s.name.replace(/^The /, ''); var d = document.createElement('span'); d.textContent = range(i);
    b.appendChild(n); b.appendChild(d); b.addEventListener('click', function () { show(reading(i, cur ? cur.week : weekKey(new Date())), true); $('shared').hidden = true; });
    box.appendChild(b);
  });
  var msel = $('f-month'); MON.forEach(function (m, i) { var o = document.createElement('option'); o.value = i + 1; o.textContent = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][i]; msel.appendChild(o); });
  $('find').addEventListener('click', function () {
    var m = +msel.value, d = parseInt($('f-day').value, 10); if (!m) { GB.toast('Pick your birth month first 🦇'); return; }
    var max = new Date(Date.UTC(2000, m, 0)).getUTCDate(); if (isNaN(d) || d < 1 || d > max) d = 10;
    var i = signFor(m, d); show(reading(i, weekKey(new Date())), true); $('shared').hidden = true;
    GB.toast('Your death sign: ' + S[i].name); $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('prev').addEventListener('click', function () { if (cur) show(reading(cur.sign, shift(cur.week, -1)), true); });
  $('next').addEventListener('click', function () { if (cur && cur.week < weekKey(new Date())) show(reading(cur.sign, shift(cur.week, 1)), true); });
  $('now').addEventListener('click', function () { if (cur) show(reading(cur.sign, weekKey(new Date())), true); });
  var fname = function () { return 'undead-horoscope-' + S[cur.sign].slug + '-' + cur.week.toLowerCase() + '.png'; };
  $('dl').addEventListener('click', function () { if (cur) GB.fontsReady().then(function () { draw(cur); GB.download(canvas, fname()); }); });
  $('copy').addEventListener('click', function () { if (cur) GB.copy(shareText(cur) + ' ' + shareURL(cur)); });
  $('share').addEventListener('click', function () { if (!cur) return; GB.fontsReady().then(function () { draw(cur); GB.share({ title: S[cur.sign].name + ' — Undead Horoscope', text: shareText(cur), url: shareURL(cur), canvas: canvas, filename: fname() }); }); });
  // countdown to next Monday 00:00 UTC
  function tick() {
    var next = monday(weekKey(new Date())); next.setUTCDate(next.getUTCDate() + 7);
    var ms = Math.max(0, next - new Date()), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    $('countdown').textContent = d + 'd ' + h + 'h ' + m + 'm';
    $('flip').textContent = next.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }
  tick(); setInterval(tick, 30000);
  var p = new URLSearchParams(location.search), si = bySlug(p.get('s'));
  if (si !== -1) { var w = validWeek(p.get('w')) ? p.get('w') : weekKey(new Date()); show(reading(si, w), false); $('shared').hidden = false; }
  window.HR_DEBUG = { reading: reading, weekKey: weekKey, signFor: signFor, shift: shift, cur: function () { return cur; } };
})();
