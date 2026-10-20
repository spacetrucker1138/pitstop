/* Ghoul Box — Horror Movie Night Roulette */
(function () {
  'use strict';
  var GB = window.GB, L = window.MN_LISTS, $ = function (id) { return document.getElementById(id); };
  var canvas = $('ticket'), ctx = canvas.getContext('2d'), cur = null, spinning = false;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rnd = function (n) { return Math.floor(Math.random() * n); };
  var KEYS = { m: 'movies', s: 'snacks', r: 'rules' };
  function roll() { return { m: rnd(L.movies.length), s: rnd(L.snacks.length), r: rnd(L.rules.length), x: rnd(1679616) }; }
  function fromURL() {
    var p = new URLSearchParams(location.search), r = {}, ok = true;
    Object.keys(KEYS).forEach(function (k) { var v = parseInt(p.get(k), 36); if (isNaN(v) || v < 0 || v >= L[KEYS[k]].length) ok = false; r[k] = v; });
    r.x = parseInt(p.get('x'), 36); if (isNaN(r.x) || r.x < 0) r.x = 1138;
    return ok ? r : null;
  }
  function shareURL(r) {
    var u = new URL(location.href); u.search = ''; u.hash = '';
    ['m', 's', 'r', 'x'].forEach(function (k) { u.searchParams.set(k, r[k].toString(36)); }); return u.toString();
  }
  function texts(r) { var mv = L.movies[r.m]; return { title: mv[0], year: mv[1], tag: mv[2], snack: L.snacks[r.s], rule: L.rules[r.r] }; }
  function shareText(t) { return '🎬 Horror movie night: ' + t.title + ' (' + t.year + ') + ' + t.snack.toLowerCase() + '. Cursed house rule: ' + t.rule; }
  function paint(r) {
    var t = texts(r);
    $('v-movie').textContent = t.title; $('v-year').textContent = t.year + ' · ' + t.tag; $('v-snack').textContent = t.snack; $('v-rule').textContent = t.rule;
  }
  function animate(target, keys) {
    return new Promise(function (done) {
      if (reduce) { done(); return; }
      var reels = document.querySelectorAll('.reel'), start = performance.now(), dur = [700, 1000, 1300];
      reels.forEach(function (el, i) { if (keys.indexOf('msr'[i]) !== -1) el.classList.add('spin'); });
      (function tick(now) {
        var all = true;
        ['m', 's', 'r'].forEach(function (k, i) {
          if (keys.indexOf(k) === -1) return;
          if (now - start < dur[i]) {
            all = false; var v = rnd(L[KEYS[k]].length);
            if (k === 'm') { $('v-movie').textContent = L.movies[v][0]; $('v-year').textContent = L.movies[v][1]; }
            if (k === 's') $('v-snack').textContent = L.snacks[v];
            if (k === 'r') $('v-rule').textContent = L.rules[v];
          } else { reels[i].classList.remove('spin'); var tt = texts(target); if (k === 'm') { $('v-movie').textContent = tt.title; $('v-year').textContent = tt.year + ' · ' + tt.tag; } if (k === 's') $('v-snack').textContent = tt.snack; if (k === 'r') $('v-rule').textContent = tt.rule; }
        });
        if (all) done(); else setTimeout(function () { requestAnimationFrame(tick); }, 55);
      })(start);
    });
  }

  /* ---------- ticket / VHS share image ---------- */
  function wrapLines(text, font, maxW) {
    ctx.font = font; var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) { var tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { lines.push(line); line = w; } else line = tt; });
    if (line) lines.push(line); return lines;
  }
  function fit(text, fam, maxW, maxS, minS, maxL) {
    for (var s = maxS; s >= minS; s -= 3) { var f = fam.replace('%', s), ls = wrapLines(text, f, maxW); if (ls.length <= maxL && ls.every(function (l) { return ctx.measureText(l).width <= maxW; })) return { font: f, size: s, lines: ls }; }
    var f2 = fam.replace('%', minS); return { font: f2, size: minS, lines: wrapLines(text, f2, maxW) };
  }
  var PALS = [['#39ff14', '#bf00ff'], ['#00ffff', '#ff2bd6'], ['#ff1744', '#fbbf24'], ['#fbbf24', '#bf00ff'], ['#c084fc', '#39ff14']];
  function drawTicket(r) {
    var t = texts(r), W = 1080, H = 1350, R = GB.rng(r.x + r.m * 31), p = PALS[r.x % PALS.length];
    ctx.save();
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12001f'); g.addColorStop(1, '#050508'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 80s sunset grid
    ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = p[1]; ctx.lineWidth = 3; var hz = 980;
    for (var i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 26, hz); ctx.lineTo(540 + i * 150, H); ctx.stroke(); }
    for (var y = 0; y < 8; y++) { var yy = hz + Math.pow(y / 7, 2) * (H - hz); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    ctx.restore();
    for (var k = 0; k < 120; k++) { ctx.globalAlpha = R() * .7 + .2; ctx.fillStyle = '#fff'; ctx.fillRect(R() * W, R() * 900, 2, 2); } ctx.globalAlpha = 1;
    // header
    ctx.textAlign = 'center'; ctx.fillStyle = '#c084fc'; ctx.font = '800 34px Inter, sans-serif'; ctx.fillText('GHOUL BOX PRESENTS', 540, 90);
    ctx.font = '400 104px Creepster, cursive'; ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#000';
    ctx.strokeText('MOVIE NIGHT', 540, 200); ctx.shadowColor = p[0]; ctx.shadowBlur = 30; ctx.fillStyle = p[0]; ctx.fillText('MOVIE NIGHT', 540, 200); ctx.shadowBlur = 0;
    // VHS tape label card
    var x0 = 90, y0 = 250, w = 900, h = 560;
    ctx.fillStyle = '#0b0b10'; ctx.strokeStyle = p[1]; ctx.lineWidth = 6; ctx.shadowColor = p[1]; ctx.shadowBlur = 40; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, 26) : ctx.rect(x0, y0, w, h); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8e0d4'; ctx.fillRect(x0 + 40, y0 + 40, w - 80, 300);
    ctx.fillStyle = p[1]; ctx.fillRect(x0 + 40, y0 + 40, w - 80, 46); ctx.fillStyle = '#fff'; ctx.font = '900 26px Inter, sans-serif'; ctx.fillText('TONIGHT\'S FEATURE  ·  BE KIND, REWIND', 540, y0 + 73);
    var tf = fit(t.title.toUpperCase(), '400 %px Creepster, cursive', w - 140, 104, 44, 2);
    ctx.fillStyle = '#12001f'; ctx.font = tf.font; ctx.textBaseline = 'middle';
    var ty = y0 + 40 + 46 + (254 - tf.lines.length * tf.size * 1.02) / 2 - 10;
    tf.lines.forEach(function (l, i) { ctx.fillText(l, 540, ty + tf.size * 1.02 * (i + .5)); });
    ctx.font = '800 34px Inter, sans-serif'; ctx.fillStyle = '#5a0018'; ctx.fillText(t.year + '  ·  ' + t.tag.toUpperCase(), 540, y0 + 315);
    // tape reels
    ctx.textBaseline = 'alphabetic';
    [[x0 + 250, y0 + 455], [x0 + 650, y0 + 455]].forEach(function (c) {
      ctx.fillStyle = '#1b1b22'; ctx.beginPath(); ctx.arc(c[0], c[1], 78, 0, 7); ctx.fill(); ctx.fillStyle = '#e8e0d4'; ctx.beginPath(); ctx.arc(c[0], c[1], 36, 0, 7); ctx.fill();
      ctx.fillStyle = '#1b1b22'; for (var s = 0; s < 6; s++) { var a = s / 6 * 6.283; ctx.fillRect(c[0] + Math.cos(a) * 24 - 5, c[1] + Math.sin(a) * 24 - 5, 10, 10); }
    });
    ctx.fillStyle = '#26262e'; ctx.fillRect(x0 + 340, y0 + 420, 220, 70);
    // snack + rule
    function section(label, body, y, color, maxL) {
      ctx.textAlign = 'left'; ctx.font = '800 28px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(label, 100, y);
      var b = fit(body, '700 %px Inter, sans-serif', 880, 44, 26, maxL); ctx.font = b.font; ctx.fillStyle = '#fff';
      b.lines.forEach(function (l, i) { ctx.fillText(l, 100, y + 18 + b.size * 1.18 * (i + 1)); }); return y + 18 + b.size * 1.18 * b.lines.length;
    }
    var yy2 = section('🍿 SNACK', t.snack, 880, p[0], 2);
    section('🕯 CURSED HOUSE RULE', t.rule, yy2 + 60, '#ff1744', 3);
    ctx.textAlign = 'center'; ctx.font = '700 30px Inter, sans-serif'; ctx.fillStyle = '#00ff88'; ctx.fillText('Spin yours: thejurn.com/ghoulbox', 540, H - 40);
    ctx.globalAlpha = .07; ctx.fillStyle = '#000'; for (var sy = 0; sy < H; sy += 6) ctx.fillRect(0, sy, W, 2);
    ctx.restore();
  }
  function show(r, push) {
    cur = r; var t = texts(r);
    $('result').hidden = false; $('rerolls').hidden = false;
    GB.fontsReady().then(function () { drawTicket(r); });
    var url = shareURL(r);
    $('amazon').href = 'https://www.amazon.com/s?k=' + encodeURIComponent(t.title + ' ' + t.year) + '&i=instant-video&tag=thejurn-20';
    $('xshare').href = GB.xIntent(shareText(t) + ' Spin yours:', url);
    if (push) history.replaceState(null, '', url);
    document.title = t.title + ' (' + t.year + ') — Horror Movie Night Roulette | Ghoul Box';
  }
  function spin(keys) {
    if (spinning) return; spinning = true;
    var next = roll(); if (cur) Object.keys(KEYS).forEach(function (k) { if (keys.indexOf(k) === -1) next[k] = cur[k]; });
    if (cur && keys.length === 1) while (next[keys] === cur[keys] && L[KEYS[keys]].length > 1) next[keys] = rnd(L[KEYS[keys]].length);
    animate(next, keys).then(function () { paint(next); show(next, true); spinning = false; $('spin').textContent = '🎰 Spin Again'; });
  }
  $('spin').addEventListener('click', function () { spin('msr'); });
  Array.prototype.forEach.call(document.querySelectorAll('#rerolls button'), function (b) { b.addEventListener('click', function () { spin(b.dataset.k); }); });
  var fname = function () { return 'movie-night-' + texts(cur).title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '.png'; };
  $('dl').addEventListener('click', function () { if (cur) GB.fontsReady().then(function () { drawTicket(cur); GB.download(canvas, fname()); }); });
  $('copy').addEventListener('click', function () { if (cur) GB.copy(shareText(texts(cur)) + ' ' + shareURL(cur)); });
  $('share').addEventListener('click', function () { if (!cur) return; var t = texts(cur); GB.share({ title: 'Horror Movie Night: ' + t.title, text: shareText(t), url: shareURL(cur), canvas: canvas, filename: fname() }); });
  var link = fromURL();
  if (link) { paint(link); show(link, false); $('shared').hidden = false; $('spin').textContent = '🎰 Spin My Own'; }
  window.MN_DEBUG = { cur: function () { return cur; } };
})();
