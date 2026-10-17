/* Ghoul Box — Horror Punk Band Name Generator */
(function () {
  'use strict';
  var W = window.BN_WORDS, BL = window.BN_BLOCKLIST, GB = window.GB;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('cover'), ctx = canvas.getContext('2d');
  var current = null;

  function plural(w) {
    if (/VHS$/.test(w)) return w + ' Tapes';
    if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + 'ies';
    if (/(s|x|ch|sh)$/i.test(w)) return w + 'es';
    return w + 's';
  }
  function tokens(t) { var m = t.match(/\{(\w+)\}/g) || []; return m.map(function (x) { return x.slice(1, -1); }); }
  function render(tlist, code) {
    // code = [templateIdx, tokenIdx...]
    var t = tlist[code[0]], ks = tokens(t), i = 0;
    return t.replace(/\{(\w+)\}(s?)/g, function (_, k, s) { var w = W[k][code[1 + i++]]; return s ? plural(w) : w; });
  }
  function valid(tlist, code) {
    if (!code || isNaN(code[0]) || code[0] < 0 || code[0] >= tlist.length) return false;
    var ks = tokens(tlist[code[0]]);
    if (code.length !== ks.length + 1) return false;
    for (var i = 0; i < ks.length; i++) { var v = code[i + 1]; if (isNaN(v) || v < 0 || v >= W[ks[i]].length) return false; }
    return true;
  }
  function roll(tlist) {
    var ti = Math.floor(Math.random() * tlist.length), code = [ti];
    tokens(tlist[ti]).forEach(function (k) { code.push(Math.floor(Math.random() * W[k].length)); });
    return code;
  }
  function badName(s) {
    var low = s.toLowerCase(); if (BL.indexOf(low) !== -1 || BL.indexOf(low.replace(/^the /, '')) !== -1) return true;
    var words = low.replace(/[^a-z ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; });
    var seen = {}; for (var i = 0; i < words.length; i++) { var r = words[i].replace(/(ies|es|s)$/, ''); if (seen[r]) return true; seen[r] = 1; }
    return s.length > 42;
  }
  function generate() {
    var n, a, tries = 0;
    do { n = roll(W.nameT); tries++; } while (badName(render(W.nameT, n)) && tries < 60);
    tries = 0;
    do { a = roll(W.albumT); tries++; } while (render(W.albumT, a).length > 46 && tries < 60);
    return { n: n, a: a, g: Math.floor(Math.random() * W.genre.length), s: Math.floor(Math.random() * 2176782335) };
  }
  var enc = function (c) { return c.map(function (x) { return x.toString(36); }).join('.'); };
  var dec = function (s) { return String(s || '').split('.').map(function (x) { return parseInt(x, 36); }); };
  function fromURL() {
    var p = new URLSearchParams(location.search);
    if (!p.get('n')) return null;
    var r = { n: dec(p.get('n')), a: dec(p.get('a')), g: parseInt(p.get('g'), 36), s: parseInt(p.get('s'), 36) };
    if (!valid(W.nameT, r.n) || !valid(W.albumT, r.a) || isNaN(r.g) || r.g < 0 || r.g >= W.genre.length) return null;
    if (isNaN(r.s) || r.s < 0) r.s = 1138;
    return r;
  }
  function shareURL(r) {
    var u = new URL(location.href); u.search = '';
    u.searchParams.set('n', enc(r.n)); u.searchParams.set('a', enc(r.a));
    u.searchParams.set('g', r.g.toString(36)); u.searchParams.set('s', r.s.toString(36));
    return u.toString();
  }
  function texts(r) {
    return { band: render(W.nameT, r.n), album: render(W.albumT, r.a), genre: W.genre[r.g] };
  }

  /* ---------- album cover art ---------- */
  var PALS = [
    ['#0b0010', '#3a0066', '#39ff14', '#bf00ff'], ['#050508', '#00353a', '#00ffff', '#ff2bd6'], ['#120004', '#5a0018', '#ff1744', '#fbbf24'],
    ['#00120a', '#0b3d1c', '#39ff14', '#e8e0d4'], ['#0a0420', '#ff2bd6', '#00ffff', '#fbbf24'], ['#100818', '#2b1055', '#c084fc', '#39ff14']
  ];
  function wrapLines(text, font, maxW) {
    ctx.font = font; var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines;
  }
  function fitText(text, family, weight, maxW, maxSize, minSize, maxLines) {
    for (var s = maxSize; s >= minSize; s -= 4) {
      var f = weight + ' ' + s + 'px ' + family, lines = wrapLines(text, f, maxW);
      if (lines.length <= maxLines && lines.every(function (l) { return ctx.measureText(l).width <= maxW; })) return { font: f, size: s, lines: lines };
    }
    var f2 = weight + ' ' + minSize + 'px ' + family; return { font: f2, size: minSize, lines: wrapLines(text, f2, maxW) };
  }
  function bg(R, p) {
    var style = Math.floor(R() * 4), S = 1080;
    var g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, p[0]); g.addColorStop(1, p[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    if (style === 0) { // 80s horizon grid
      ctx.save(); ctx.strokeStyle = p[3]; ctx.globalAlpha = .55; ctx.lineWidth = 3; var hz = 700;
      for (var i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 30, hz); ctx.lineTo(540 + i * 160, S); ctx.stroke(); }
      for (var y = 0; y < 9; y++) { var yy = hz + Math.pow(y / 8, 2) * (S - hz); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(S, yy); ctx.stroke(); }
      ctx.restore();
    } else if (style === 1) { // checkerboard floor
      ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = p[3];
      for (var cx = 0; cx < 12; cx++) for (var cy = 0; cy < 12; cy++) if ((cx + cy) % 2) ctx.fillRect(cx * 90, cy * 90, 90, 90);
      ctx.restore();
    } else if (style === 2) { // starfield
      ctx.save(); for (var k = 0; k < 220; k++) { ctx.globalAlpha = R() * .8 + .2; ctx.fillStyle = R() > .8 ? p[2] : '#fff'; var r = R() * 2.6; ctx.beginPath(); ctx.arc(R() * S, R() * S, r, 0, 7); ctx.fill(); } ctx.restore();
    } else { // radial burst
      ctx.save(); ctx.translate(540, 520); ctx.globalAlpha = .16; ctx.fillStyle = p[3];
      for (var a = 0; a < 24; a++) { ctx.rotate(Math.PI / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, -60); ctx.lineTo(900, 60); ctx.closePath(); if (a % 2) ctx.fill(); }
      ctx.restore();
    }
    // drips along top
    ctx.save(); ctx.fillStyle = p[2]; ctx.globalAlpha = .9;
    ctx.fillRect(0, 0, S, 14);
    for (var d = 0; d < 26; d++) { var x = R() * S, h = 20 + R() * 90, w = 8 + R() * 18; ctx.beginPath(); ctx.moveTo(x - w / 2, 10); ctx.lineTo(x - w / 2, h); ctx.arc(x, h, w / 2, Math.PI, 0, true); ctx.lineTo(x + w / 2, 10); ctx.fill(); }
    ctx.restore();
  }
  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  var MOTIFS = {
    skull: function (c) {
      ctx.fillStyle = '#e8e0d4'; glow(c, 50);
      ctx.beginPath(); ctx.ellipse(0, -30, 170, 160, 0, 0, 7); ctx.fill(); ctx.fillRect(-100, 80, 200, 90); ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.ellipse(-68, -10, 50, 58, 0, 0, 7); ctx.ellipse(68, -10, 50, 58, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(-22, 95); ctx.lineTo(22, 95); ctx.fill();
      for (var i = -3; i <= 3; i++) ctx.fillRect(i * 28 - 3, 120, 6, 50);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-68, -6, 12, 0, 7); ctx.arc(68, -6, 12, 0, 7); ctx.fill();
    },
    coffin: function (c) {
      ctx.fillStyle = '#2a1408'; ctx.strokeStyle = c; ctx.lineWidth = 12; glow(c, 40);
      ctx.beginPath(); ctx.moveTo(-90, -220); ctx.lineTo(90, -220); ctx.lineTo(150, -90); ctx.lineTo(95, 220); ctx.lineTo(-95, 220); ctx.lineTo(-150, -90); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = c; ctx.fillRect(-14, -140, 28, 200); ctx.fillRect(-70, -80, 140, 28);
    },
    bat: function (c) {
      ctx.fillStyle = '#0a0a10'; ctx.strokeStyle = c; ctx.lineWidth = 8; glow(c, 50);
      ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(-30, -100); ctx.lineTo(-40, -50);
      ctx.quadraticCurveTo(-180, -140, -300, -40); ctx.quadraticCurveTo(-240, -20, -230, 40); ctx.quadraticCurveTo(-180, 0, -140, 50); ctx.quadraticCurveTo(-100, 20, -60, 80); ctx.quadraticCurveTo(-30, 50, 0, 110);
      ctx.quadraticCurveTo(30, 50, 60, 80); ctx.quadraticCurveTo(100, 20, 140, 50); ctx.quadraticCurveTo(180, 0, 230, 40); ctx.quadraticCurveTo(240, -20, 300, -40); ctx.quadraticCurveTo(180, -140, 40, -50); ctx.lineTo(30, -100); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-14, -50, 7, 0, 7); ctx.arc(14, -50, 7, 0, 7); ctx.fill();
    },
    tombstone: function (c) {
      ctx.fillStyle = '#6b6b78'; glow(c, 40);
      ctx.beginPath(); ctx.moveTo(-150, 220); ctx.lineTo(-150, -80); ctx.arc(0, -80, 150, Math.PI, 0); ctx.lineTo(150, 220); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#3a3a44'; ctx.font = '120px Creepster, cursive'; ctx.textAlign = 'center'; ctx.fillText('RIP', 0, 40);
      ctx.fillStyle = c; ctx.fillRect(-260, 210, 520, 26);
    },
    moon: function (c) {
      glow(c, 80); ctx.fillStyle = '#f4f0c8'; ctx.beginPath(); ctx.arc(0, 0, 210, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,.12)'; [[-60, -50, 40], [70, 30, 55], [-20, 100, 30], [90, -90, 22]].forEach(function (k) { ctx.beginPath(); ctx.arc(k[0], k[1], k[2], 0, 7); ctx.fill(); });
      ctx.fillStyle = '#050508'; ctx.beginPath(); ctx.moveTo(-260, 230); ctx.lineTo(-180, 60); ctx.lineTo(-150, 120); ctx.lineTo(-120, 20); ctx.lineTo(-60, 230); ctx.fill();
      ctx.beginPath(); ctx.moveTo(60, 230); ctx.lineTo(140, 90); ctx.lineTo(150, 140); ctx.lineTo(230, 40); ctx.lineTo(280, 230); ctx.fill();
    },
    pizza: function (c) {
      glow(c, 40); ctx.fillStyle = '#c47a2c'; ctx.beginPath(); ctx.moveTo(0, 220); ctx.lineTo(-190, -170); ctx.quadraticCurveTo(0, -250, 190, -170); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(0, 190); ctx.lineTo(-165, -140); ctx.quadraticCurveTo(0, -205, 165, -140); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#39ff14'; ctx.beginPath(); ctx.moveTo(-60, -80); ctx.quadraticCurveTo(-50, 40, -30, 90); ctx.lineTo(-15, 90); ctx.quadraticCurveTo(-30, 20, -40, -80); ctx.fill(); // slime drip
      ctx.fillStyle = '#b3122e'; [[40, -110], [-90, -110], [10, -20], [60, 40], [-20, 90]].forEach(function (k) { ctx.beginPath(); ctx.arc(k[0], k[1], 24, 0, 7); ctx.fill(); });
    },
    eyeball: function (c) {
      glow(c, 60); ctx.fillStyle = '#f8f8f0'; ctx.beginPath(); ctx.arc(0, 0, 190, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d0213a'; ctx.lineWidth = 4; for (var i = 0; i < 12; i++) { var a = i / 12 * 6.28; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 185, Math.sin(a) * 185); ctx.quadraticCurveTo(Math.cos(a + .2) * 140, Math.sin(a + .2) * 140, Math.cos(a) * 95, Math.sin(a) * 95); ctx.stroke(); }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 90, 0, 7); ctx.fill(); ctx.fillStyle = '#050508'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-26, -26, 14, 0, 7); ctx.fill();
    }
  };
  var MOTIF_KEYS = Object.keys(MOTIFS);
  function drawCover(r) {
    var t = texts(r), R = GB.rng(r.s), p = PALS[Math.floor(R() * PALS.length)], S = 1080;
    ctx.save(); ctx.clearRect(0, 0, S, S); bg(R, p);
    // motif
    ctx.save(); ctx.translate(540, 560); var sc = .9 + R() * .25; ctx.scale(sc, sc); ctx.rotate((R() - .5) * .25);
    MOTIFS[MOTIF_KEYS[Math.floor(R() * MOTIF_KEYS.length)]](p[2]); ctx.restore();
    // band name
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var bn = fitText(t.band.toUpperCase(), 'Creepster, cursive', '400', 960, 150, 64, 3), y = 120 + bn.size;
    ctx.font = bn.font; ctx.lineJoin = 'round';
    bn.lines.forEach(function (l) {
      ctx.lineWidth = 16; ctx.strokeStyle = '#000'; ctx.strokeText(l, 540, y);
      glow(p[2], 30); ctx.fillStyle = p[2]; ctx.fillText(l, 540, y); ctx.shadowBlur = 0; y += bn.size * .98;
    });
    // album title banner
    var al = fitText(t.album, 'Inter, sans-serif', '800', 880, 54, 30, 2), lh = al.size * 1.15, bh = al.lines.length * lh + 40, by = S - 150 - bh;
    ctx.save(); ctx.translate(540, by + bh / 2); ctx.rotate(-.025); ctx.fillStyle = 'rgba(5,5,8,.82)'; ctx.strokeStyle = p[3]; ctx.lineWidth = 5;
    ctx.fillRect(-470, -bh / 2, 940, bh); ctx.strokeRect(-470, -bh / 2, 940, bh);
    ctx.fillStyle = '#e8e0d4'; ctx.font = al.font; ctx.textBaseline = 'middle';
    al.lines.forEach(function (l, i) { ctx.fillText(l, 0, -bh / 2 + 20 + lh * (i + .5)); }); ctx.restore();
    // genre sticker
    ctx.save(); ctx.translate(890, by - 70); ctx.rotate(.22); glow(p[3], 20); ctx.fillStyle = p[3];
    ctx.beginPath(); for (var i = 0; i < 24; i++) { var rr = i % 2 ? 108 : 128, a = i / 24 * 6.283; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#050508'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var gl = fitText(t.genre.toUpperCase(), 'Inter, sans-serif', '900', 170, 34, 18, 3);
    ctx.font = gl.font; gl.lines.forEach(function (l, i) { ctx.fillText(l, 0, (i - (gl.lines.length - 1) / 2) * gl.size * 1.05); }); ctx.restore();
    // advisory label
    ctx.save(); ctx.translate(40, S - 118); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 250, 78); ctx.fillStyle = '#000'; ctx.fillRect(5, 5, 240, 68);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 16px Inter, sans-serif'; ctx.fillText('GHOULISH ADVISORY', 125, 30);
    ctx.font = '600 13px Inter, sans-serif'; ctx.fillText('EXPLICIT SKELETON CONTENT', 125, 54); ctx.restore();
    // footer credit
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.font = '700 26px Inter, sans-serif'; ctx.fillStyle = 'rgba(232,224,212,.85)';
    ctx.fillText('GHOUL BOX · thejurn.com', S - 40, S - 48);
    // VHS scanlines
    ctx.globalAlpha = .07; ctx.fillStyle = '#000'; for (var sy = 0; sy < S; sy += 6) ctx.fillRect(0, sy, S, 2);
    ctx.restore();
  }

  /* ---------- UI ---------- */
  function show(r, push) {
    current = r; var t = texts(r);
    $('band').textContent = t.band; $('album').textContent = t.album; $('genre').textContent = t.genre;
    $('result').hidden = false;
    GB.fontsReady().then(function () { drawCover(r); });
    var url = shareURL(r);
    $('xshare').href = GB.xIntent('My horror punk band is ' + t.band + ' 💀 Debut album: "' + t.album + '" (' + t.genre + '). Get yours in the Ghoul Box:', url);
    if (push) history.replaceState(null, '', url);
    document.title = t.band + ' — Horror Punk Band Name Generator | Ghoul Box';
  }
  function shareText(t) { return 'My horror punk band is ' + t.band + ' 💀 Debut album: "' + t.album + '" (' + t.genre + ').'; }
  $('go').addEventListener('click', function () { show(generate(), true); $('go').textContent = '🎲 Roll Again'; });
  $('dl').addEventListener('click', function () { if (current) GB.download(canvas, texts(current).band.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-album-cover.png'); });
  $('copy').addEventListener('click', function () { if (current) { var t = texts(current); GB.copy(shareText(t) + ' ' + shareURL(current)); } });
  $('share').addEventListener('click', function () {
    if (!current) return; var t = texts(current);
    GB.share({ title: t.band + ' — Ghoul Box', text: shareText(t), url: shareURL(current), canvas: canvas, filename: 'ghoulbox-band.png' });
  });
  var fromLink = fromURL();
  if (fromLink) { show(fromLink, false); $('go').textContent = '🎲 Roll My Own'; $('shared').hidden = false; }
  else { show(generate(), false); }
})();
