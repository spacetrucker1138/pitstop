/* Ghoul Box — Tombstone Maker */
(function () {
  'use strict';
  var GB = window.GB, CFG = window.TS_CONFIG, RND = window.TS_RANDOM;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('stone'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  var F = { n: $('f-name'), b: $('f-born'), d: $('f-died'), c: $('f-cause'), e: $('f-epi') };
  var MAX = { n: 40, b: 22, d: 22, c: 60, e: 90 };
  var state = { n: '', b: '', d: '', c: '', e: '', s: 1 };
  var imgs = {}, edited = false;
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var clean = function (v, k) { return String(v || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX[k]); };
  var pad = function (i) { return (i < 10 ? '0' : '') + i; };

  /* ---------- procedural stones (used until the photo art is processed, and as an image-error fallback) ---------- */
  var PAL = [
    ['#0b0018', '#2b0b4a', '#8d8d99', '#39ff14'], ['#020812', '#0b2a3a', '#9a9a92', '#00ffff'], ['#120004', '#3d0610', '#7d7a80', '#ff1744'],
    ['#00100a', '#0b3020', '#a5a59a', '#39ff14'], ['#0a0420', '#3a0a4a', '#6f6a78', '#ff2bd6'], ['#0b0b10', '#26262e', '#b3b0a8', '#fbbf24'],
    ['#06000f', '#1d0a33', '#59565f', '#c084fc'], ['#001014', '#08323a', '#8b9693', '#0f8'], ['#140800', '#3a1a05', '#948a7c', '#ffaa00'], ['#050508', '#1a1a24', '#d6d2c8', '#bf00ff']];
  var FALLBACK_BOX = { x: 0.31, y: 0.38, w: 0.38, h: 0.42 };
  function drawProcedural(c, x, s, W, H) {
    var p = PAL[(s - 1) % PAL.length], R = GB.rng(s * 7919);
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, p[0]); g.addColorStop(1, p[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (var i = 0; i < 90; i++) { x.globalAlpha = R() * .7 + .2; x.fillStyle = '#fff'; x.fillRect(R() * W, R() * H * .55, 2 * W / 1080, 2 * W / 1080); }
    x.globalAlpha = 1; x.save(); x.shadowColor = p[3]; x.shadowBlur = 60 * W / 1080; x.fillStyle = '#f2eccb';
    x.beginPath(); x.arc(W * (.15 + R() * .7), H * .13, W * .07, 0, 7); x.fill(); x.restore();
    // stone
    var L = W * .25, Rr = W * .75, T = H * .2, B = H * .86, rad = (Rr - L) / 2;
    x.save(); x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 40 * W / 1080; x.shadowOffsetY = 10 * W / 1080;
    var sg = x.createLinearGradient(L, 0, Rr, 0); sg.addColorStop(0, shade(p[2], -30)); sg.addColorStop(.45, p[2]); sg.addColorStop(1, shade(p[2], -55));
    x.fillStyle = sg; x.beginPath(); x.moveTo(L, B); x.lineTo(L, T + rad); x.arc(W / 2, T + rad, rad, Math.PI, 0); x.lineTo(Rr, B); x.closePath(); x.fill(); x.restore();
    x.save(); x.beginPath(); x.moveTo(L, B); x.lineTo(L, T + rad); x.arc(W / 2, T + rad, rad, Math.PI, 0); x.lineTo(Rr, B); x.closePath(); x.clip();
    for (var k = 0; k < 900; k++) { x.globalAlpha = R() * .12; x.fillStyle = R() > .5 ? '#000' : '#fff'; x.fillRect(L + R() * (Rr - L), T + R() * (B - T), 3 * W / 1080, 3 * W / 1080); } x.restore();
    x.globalAlpha = 1; x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 6 * W / 1080; x.beginPath(); x.moveTo(L + 30 * W / 1080, B); x.lineTo(L + 30 * W / 1080, T + rad); x.arc(W / 2, T + rad, rad - 30 * W / 1080, Math.PI, 0); x.lineTo(Rr - 30 * W / 1080, B); x.stroke();
    // ground + grass + fog
    x.fillStyle = '#07070a'; x.fillRect(0, H * .84, W, H * .16);
    x.fillStyle = shade(p[1], -10); for (var gx = 0; gx < W; gx += 9 * W / 1080) { var gh = (10 + R() * 40) * W / 1080; x.fillRect(gx, H * .84 - gh, 4 * W / 1080, gh + 2); }
    var fg = x.createLinearGradient(0, H * .78, 0, H); fg.addColorStop(0, 'rgba(200,200,220,0)'); fg.addColorStop(.5, 'rgba(200,200,220,.12)'); fg.addColorStop(1, 'rgba(200,200,220,.04)');
    x.fillStyle = fg; x.fillRect(0, H * .78, W, H * .22);
  }
  function shade(hex, amt) { var n = parseInt(hex.slice(1), 16), r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, (n >> 8 & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt)); return 'rgb(' + r + ',' + g + ',' + b + ')'; }

  /* ---------- images ---------- */
  function loadImg(s) {
    if (!CFG.ready) return Promise.resolve(null);
    if (imgs[s]) return imgs[s];
    imgs[s] = new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = 'img/stone-' + pad(s) + '.webp'; });
    return imgs[s];
  }
  function boxFor(s, im) { if (!im) return FALLBACK_BOX; return (CFG.overrides && CFG.overrides[s]) || CFG.box; }

  /* ---------- text layout ---------- */
  function wrap(text, font, maxW) {
    ctx.font = font; var words = [], lines = [], line = '';
    text.split(' ').forEach(function (w) { // hard-break words wider than the stone (e.g. "AAAAAAAA…")
      while (w.length > 1 && ctx.measureText(w).width > maxW) { var k = w.length - 1; while (k > 1 && ctx.measureText(w.slice(0, k)).width > maxW) k--; words.push(w.slice(0, k)); w = w.slice(k); }
      words.push(w);
    });
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines;
  }
  function block(text, fam, size, maxW, maxLines, minSize) {
    for (var sz = size; sz >= minSize; sz -= Math.max(1, sz * .05)) {
      var f = fam.replace('%', Math.round(sz)), lines = wrap(text, f, maxW);
      if (lines.length <= maxLines && lines.every(function (l) { return ctx.measureText(l).width <= maxW; })) return { font: f, size: sz, lines: lines };
    }
    var f2 = fam.replace('%', Math.round(minSize)), all = wrap(text, f2, maxW), l2 = all.slice(0, maxLines);
    if (all.length > maxLines) l2[maxLines - 1] = l2[maxLines - 1].replace(/.$/, '…');
    return { font: f2, size: minSize, lines: l2 };
  }
  function layout(st, bw, bh) {
    var dates = st.b && st.d ? st.b + ' – ' + st.d : (st.b || st.d);
    for (var k = 1; k >= 0.3; k -= 0.04) {
      var U = bh * .16 * k, items = [], gap = U * .28, maxW = bw;
      var nm = st.n ? block(st.n.toUpperCase(), '800 %px Cinzel, Georgia, serif', U, maxW, 2, 8) : null;
      items.push({ b: block('R.I.P.', '800 %px Cinzel, Georgia, serif', Math.min(U * .5, nm ? nm.size * .8 : U), maxW, 1, 8), sp: .9 });
      if (nm) items.push({ b: nm, sp: 1.05 });
      if (dates) items.push({ b: block(dates, '600 %px Cinzel, Georgia, serif', U * .42, maxW, 2, 7), sp: 1.15 });
      if (st.c || st.e) items.push({ rule: true, h: U * .35 });
      if (st.c) { items.push({ b: block('CAUSE OF DEATH', '600 %px Cinzel, Georgia, serif', U * .26, maxW, 1, 6), sp: 1 }); items.push({ b: block(st.c, 'italic %px "IM Fell English", Georgia, serif', U * .42, maxW, 3, 7), sp: 1.08, tight: true }); }
      if (st.e) items.push({ b: block('“' + st.e + '”', 'italic %px "IM Fell English", Georgia, serif', U * .46, maxW, 3, 7), sp: 1.1 });
      var total = 0; items.forEach(function (it, i) { total += it.rule ? it.h : it.b.lines.length * it.b.size * it.sp; if (i) total += it.tight ? gap * .2 : gap; });
      if (total <= bh) return { items: items, total: total, gap: gap };
    }
    return { items: items, total: total, gap: gap };
  }
  function stoneStats(bx, by, bw, bh) {
    try {
      var d = ctx.getImageData(Math.round(bx), Math.round(by), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh))).data, n = 0, sum = 0, sq = 0, r = 0, g = 0, b = 0;
      for (var i = 0; i < d.length; i += 4 * 7) { var L = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; sum += L; sq += L * L; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      var m = sum / n; return { lum: m, sd: Math.sqrt(Math.max(0, sq / n - m * m)), rgb: [r / n | 0, g / n | 0, b / n | 0] };
    } catch (e) { return { lum: 140, sd: 20, rgb: [140, 140, 140] }; }
  }
  function draw() {
    var s = state.s;
    return GB.fontsReady().then(function () {
      return document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 40px Cinzel'), document.fonts.load('600 40px Cinzel'), document.fonts.load('italic 40px "IM Fell English"')]).catch(function () {}) : null;
    }).then(function () { return loadImg(s); }).then(function (im) {
      if (s !== state.s) return;
      var W = 1080, H = im ? Math.round(1080 * im.naturalHeight / im.naturalWidth) : 1350;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (im) ctx.drawImage(im, 0, 0, W, H); else drawProcedural(canvas, ctx, s, W, H);
      var box = boxFor(s, im), bx = box.x * W, by = box.y * H, bw = box.w * W, bh = box.h * H;
      var st = stoneStats(bx, by, bw, bh), light = st.lum > 105;
      if (st.sd > 42) { // busy texture: lightly "polish" the face so the carving stays readable
        var pg = ctx.createRadialGradient(bx + bw / 2, by + bh / 2, 10, bx + bw / 2, by + bh / 2, Math.max(bw, bh) * .7);
        pg.addColorStop(0, 'rgba(' + st.rgb.join(',') + ',.55)'); pg.addColorStop(1, 'rgba(' + st.rgb.join(',') + ',0)'); ctx.fillStyle = pg; ctx.fillRect(bx - bw * .15, by - bh * .1, bw * 1.3, bh * 1.2);
      }
      var L = layout(state, bw, bh), y = by + (bh - L.total) / 2, cx = bx + bw / 2, u = W / 1080;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var ink = light ? 'rgba(28,24,22,.86)' : 'rgba(236,230,218,.93)', hi = light ? 'rgba(255,255,255,.42)' : 'rgba(0,0,0,.75)', lo = light ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.18)';
      function carve(text, x, yy) {
        ctx.fillStyle = hi; ctx.fillText(text, x + 1.2 * u, yy + 2 * u);   // lit lower edge (or drop shadow on dark stone)
        ctx.fillStyle = lo; ctx.fillText(text, x - 1 * u, yy - 1.4 * u);  // shaded upper lip of the cut
        ctx.fillStyle = ink; ctx.fillText(text, x, yy);
      }
      L.items.forEach(function (it, i) {
        if (i) y += it.tight ? L.gap * .2 : L.gap;
        if (it.rule) {
          var rw = Math.min(bw * .6, 260 * u), my = y + it.h / 2;
          ctx.fillStyle = hi; ctx.fillRect(cx - rw / 2, my + 1.5 * u, rw, 2.5 * u); ctx.fillStyle = ink; ctx.fillRect(cx - rw / 2, my - 1 * u, rw, 2.5 * u);
          ctx.beginPath(); ctx.arc(cx, my, 7 * u, 0, 7); ctx.fill();
          y += it.h; return;
        }
        ctx.font = it.b.font; var lh = it.b.size * it.sp;
        it.b.lines.forEach(function (ln) { carve(ln, cx, y + lh / 2); y += lh; });
      });
      // credit
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.font = '700 ' + Math.round(24 * u) + 'px Inter, sans-serif';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 8 * u; ctx.fillStyle = 'rgba(232,224,212,.9)'; ctx.fillText('GHOUL BOX · thejurn.com/ghoulbox', W - 28 * u, H - 26 * u);
      ctx.restore();
    });
  }

  /* ---------- state + URL ---------- */
  function shareURL() {
    var u = new URL(location.href); u.search = ''; u.hash = '';
    ['n', 'b', 'd', 'c', 'e'].forEach(function (k) { if (state[k]) u.searchParams.set(k, state[k]); });
    u.searchParams.set('s', String(state.s)); return u.toString();
  }
  function fromURL() {
    var p = new URLSearchParams(location.search), any = false, st = { s: 1 };
    ['n', 'b', 'd', 'c', 'e'].forEach(function (k) { st[k] = clean(p.get(k), k); if (st[k]) any = true; });
    var s = parseInt(p.get('s'), 10); if (s >= 1 && s <= CFG.count) { st.s = s; any = true; }
    return any ? st : null;
  }
  function shareText() { return (state.n ? 'Here lies ' + state.n + '. ' : 'I carved a tombstone. ') + (state.c ? 'Cause of death: ' + state.c + '. ' : '') + '🪦 Carve yours in the Ghoul Box:'; }
  var tmr;
  function sync(push) {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      draw(); $('xshare').href = GB.xIntent(shareText(), shareURL());
      if (push) history.replaceState(null, '', shareURL());
      document.title = (state.n ? 'R.I.P. ' + state.n + ' — ' : '') + 'Tombstone Maker | Ghoul Box';
    }, 120);
  }
  function setFields() { Object.keys(F).forEach(function (k) { F[k].value = state[k]; }); markStone(); }
  Object.keys(F).forEach(function (k) {
    F[k].addEventListener('input', function () { state[k] = clean(F[k].value, k); edited = true; sync(true); });
  });
  function randomize(keys) {
    if (keys.indexOf('n') !== -1) state.n = pick(RND.names);
    if (keys.indexOf('b') !== -1) state.b = pick(RND.born);
    if (keys.indexOf('d') !== -1) state.d = pick(RND.died);
    if (keys.indexOf('c') !== -1) state.c = pick(RND.causes);
    if (keys.indexOf('e') !== -1) state.e = pick(RND.epitaphs);
    if (keys.indexOf('s') !== -1) state.s = 1 + Math.floor(Math.random() * CFG.count);
    setFields();
  }
  $('r-dates').addEventListener('click', function () { randomize(['b', 'd']); sync(true); });
  $('r-cause').addEventListener('click', function () { randomize(['c']); sync(true); });
  $('r-epi').addEventListener('click', function () { randomize(['e']); sync(true); });
  $('r-all').addEventListener('click', function () { randomize(['n', 'b', 'd', 'c', 'e', 's']); sync(true); });

  /* ---------- stone picker ---------- */
  var box = $('stones');
  for (var i = 1; i <= CFG.count; i++) (function (s) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'Tombstone ' + s); b.dataset.s = s;
    if (CFG.ready) { var im = document.createElement('img'); im.src = 'img/thumb-' + pad(s) + '.webp'; im.alt = ''; im.loading = 'lazy'; im.width = 120; im.height = 150; b.appendChild(im); }
    else { var c = document.createElement('canvas'); c.width = 120; c.height = 150; c.style.width = '100%'; c.style.height = '100%'; drawProcedural(c, c.getContext('2d'), s, 120, 150); b.appendChild(c); }
    var n = document.createElement('span'); n.textContent = s; b.appendChild(n);
    b.addEventListener('click', function () { state.s = s; edited = true; markStone(); sync(true); });
    box.appendChild(b);
  })(i);
  function markStone() { Array.prototype.forEach.call(box.children, function (b) { b.setAttribute('aria-checked', String(+b.dataset.s === state.s)); b.tabIndex = +b.dataset.s === state.s ? 0 : -1; }); }
  box.addEventListener('keydown', function (e) {
    var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return; e.preventDefault();
    state.s = (state.s - 1 + d + CFG.count) % CFG.count + 1; markStone(); box.children[state.s - 1].focus(); sync(true);
  });

  /* ---------- actions ---------- */
  var fname = function () { return 'rip-' + ((state.n || 'tombstone').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'tombstone') + '.png'; };
  $('dl').addEventListener('click', function () { draw().then(function () { GB.download(canvas, fname()); }); });
  $('copy').addEventListener('click', function () { GB.copy(shareURL()); });
  $('share').addEventListener('click', function () { draw().then(function () { GB.share({ title: 'R.I.P. ' + (state.n || 'Somebody'), text: shareText(), url: shareURL(), canvas: canvas, filename: fname() }); }); });

  var link = fromURL();
  if (link) { state = link; $('shared').hidden = false; setFields(); sync(false); }
  else { randomize(['n', 'b', 'd', 'c', 'e', 's']); sync(false); }
  window.TS_DEBUG = { state: function () { return state; }, draw: draw, shareURL: shareURL };
})();
