// ─── DEATH DRIVE visual effects ──────────────────────────────────────────────
// headlights + van glow, traffic tail lights, lamp/pumpkin glow, sparks & dust,
// speed lines with a slight zoom-out at top speed, camera shake, finish-line moment.
var FX = (function () {
  var parts = [], streaks = [], shake = 0, finishT = 0, vignette = null, vigKey = '';
  var W = 640, H = 480;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function spawn(p) { if (parts.length < 400) parts.push(p); }

  function hit(kind, px, py, power) {
    shake = Math.max(shake, 0.3 * (power || 1));
    var r = DD.playerRect; if (!r) return;
    var side = (playerX > 0 ? 1 : -1), x0 = r.x + r.w / 2 + side * r.w * 0.45, y0 = r.y + r.h * 0.55;
    var n = kind === 'crash' ? 46 : 26;
    for (var i = 0; i < n; i++) {
      var a = rnd(-Math.PI, 0), v = rnd(H * 0.3, H * 1.1) * (power || 1);
      spawn({ t: 'spark', x: kind === 'crash' ? x0 : r.x + r.w * rnd(0.25, 0.75), y: kind === 'crash' ? y0 : r.y + r.h * 0.15,
        vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v, life: rnd(0.25, 0.6), max: 0.6, size: rnd(1.2, 2.6) * H / 480 });
    }
    if (kind === 'crash') for (var j = 0; j < 14; j++)
      spawn({ t: 'dust', x: x0, y: r.y + r.h * 0.9, vx: rnd(-1, 1) * H * 0.25, vy: -rnd(0.05, 0.3) * H, life: rnd(0.5, 0.9), max: 0.9, size: rnd(10, 22) * H / 480, c: '120,100,140' });
  }

  function update(dt) {
    shake = Math.max(0, shake - dt);
    finishT = Math.max(0, finishT - dt);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t === 'spark') p.vy += H * 2.2 * dt;
      else if (p.t === 'dust') { p.vx *= 0.96; p.vy *= 0.96; p.size *= 1 + dt * 1.2; }
      else if (p.t === 'confetti') { p.vy += H * 0.5 * dt; p.vx *= 0.99; p.rot += p.vr * dt; }
    }
    // off-road dust from the rear wheels
    var r = DD.playerRect;
    if (r && DD.offroad > 0.08 && Math.random() < 0.9) {
      for (var k = 0; k < 2; k++) {
        var wx = r.x + r.w * (k ? 0.85 : 0.15);
        spawn({ t: 'dust', x: wx + rnd(-4, 4), y: r.y + r.h * 0.95, vx: rnd(-0.3, 0.3) * H * DD.offroad, vy: -rnd(0.05, 0.22) * H, life: rnd(0.35, 0.7), max: 0.7, size: rnd(6, 12) * H / 480, c: '150,110,170' });
      }
    }
  }

  function preWorld(ctx, w, h) {
    W = w; H = h;
    if (shake > 0) { var a = shake * h * 0.035; ctx.translate(rnd(-0.5, 0.5) * a, rnd(-0.5, 0.5) * a); }
  }

  // glows are pre-rendered once per colour and stamped with drawImage (no per-frame gradients)
  var glowCache = {};
  function glowSprite(rgb) {
    var c = glowCache[rgb]; if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (glowCache[rgb] = c);
  }
  function glowDot(ctx, x, y, r, rgb, alpha) {
    if (r < 0.5 || alpha <= 0.01) return;
    var a = ctx.globalAlpha; ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = a;
  }

  // traffic tail lights
  function afterCar(ctx, r, sprite, fog, rgb) {
    if (r.w < 3) return;
    var a = Math.max(0, Math.min(1, fog * 1.2)) * 0.95;
    if (a < 0.05) return;
    var L = sprite.lights || [0.3, 0.7, 0.72];
    var rad = Math.max(2, r.w * 0.07);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, r.x + r.w * L[0], r.y + r.h * L[2], rad, rgb || '255,30,40', a);
    glowDot(ctx, r.x + r.w * L[1], r.y + r.h * L[2], rad, rgb || '255,30,40', a);
    ctx.restore();
  }

  // gas lamps and jack-o-lanterns glow
  function afterProp(ctx, r, src, fog) {
    var a = Math.max(0, Math.min(1, fog * 1.3));
    if (a < 0.05 || r.w < 2) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (src.glow === 'lamp') glowDot(ctx, r.x + r.w * 0.5, r.y + r.h * 0.1, r.w * 0.7, '210,255,110', 0.55 * a);
    else glowDot(ctx, r.x + r.w * 0.5, r.y + r.h * 0.6, r.w * 0.75, '255,140,20', 0.45 * a);
    ctx.restore();
  }

  // headlight beams on the road ahead + under-glow
  function beforePlayer(ctx, x, y, scale, sp) {
    var P = SPRITES.PLAYER, vw = P.w * P.scale * scale * XS * SPRITES.SCALE * roadWidth;
    var vh = P.h * P.scale * scale * XS * SPRITES.SCALE * roadWidth;
    var top = y - vh * 0.6, far = Math.max(H * 0.42, y - vh * 3.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(0, top, 0, far);
    g.addColorStop(0, 'rgba(255,250,200,0.16)'); g.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = g;
    var lean = (keyLeft && DD.state === 'racing' ? -1 : keyRight && DD.state === 'racing' ? 1 : 0) * vw * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - vw * 0.35, top); ctx.lineTo(x + vw * 0.35, top);
    ctx.lineTo(x + vw * 1.5 + lean, far); ctx.lineTo(x - vw * 1.5 + lean, far); ctx.closePath(); ctx.fill();
    glowDot(ctx, x, y - vh * 0.05, vw * 0.9, '200,255,0', 0.18 + 0.12 * sp);
    ctx.restore();
  }

  function afterPlayer(ctx, r, sp) {
    // van tail lights + brake flare, anchored to the lamps painted on the current frame
    var spr = DD.playerSprite || SPRITES.PLAYER, L = spr.lights || [0.11, 0.88, 0.69];
    var brake = keySlower && DD.state === 'racing';
    var a = brake ? 1 : 0.5, rad = r.w * (brake ? 0.2 : 0.11);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, r.x + r.w * L[0], r.y + r.h * L[2], rad, '255,30,40', a);
    glowDot(ctx, r.x + r.w * L[1], r.y + r.h * L[2], rad, '255,30,40', a);
    ctx.restore();
    lastPlayer = r; lastPlayerSprite = spr;
    // damaged van trails smoke
    if (DD.damage >= 3 && DD.state === 'racing' && Math.random() < 0.35 + 0.3 * sp)
      spawn({ t: 'dust', x: r.x + r.w * rnd(0.3, 0.7), y: r.y + r.h * rnd(0.1, 0.4), vx: rnd(-0.1, 0.1) * H, vy: -rnd(0.08, 0.2) * H, life: rnd(0.5, 0.9), max: 0.9, size: rnd(5, 10) * H / 480, c: '40,36,48' });
  }
  var lastPlayer = null, lastPlayerSprite = null;
  // exhaust backfire: flame bursts out of the twin pipes
  function backfire(power) {
    var r = lastPlayer; if (!r) return;
    AudioEngine.backfire && AudioEngine.backfire(power);
    var nm = lastPlayerSprite && lastPlayerSprite.name || '';
    var steer = /_L2?$/.test(nm) ? -1 : /_R2?$/.test(nm) ? 1 : 0; // art-side: _L frames have the rear on the left
    var pipes = steer < 0 ? [0.2, 0.55] : steer > 0 ? [0.45, 0.8] : [0.3, 0.7];
    pipes.forEach(function (px) {
      var n = Math.round(6 + 6 * power);
      for (var i = 0; i < n; i++)
        spawn({ t: 'flame', x: r.x + r.w * px + rnd(-2, 2), y: r.y + r.h * 0.9, vx: rnd(-0.08, 0.08) * H, vy: rnd(0.05, 0.25) * H, life: rnd(0.08, 0.22), max: 0.22, size: rnd(4, 9) * H / 480 * (0.6 + power) });
    });
    shake = Math.max(shake, 0.05 * power);
  }

  function renderDepthFactor(sp) { return 1 - 0.1 * Math.max(0, (sp - 0.55) / 0.45); }

  function overlay(ctx, w, h, sp) {
    W = w; H = h;
    // speed lines
    if (sp > 0.72 && (DD.state === 'racing')) {
      var n = Math.random() < (sp - 0.72) * 6 ? 1 : 0;
      for (var i = 0; i < n; i++) {
        var ang = rnd(0, Math.PI * 2), cx = w / 2, cy = h * 0.45;
        streaks.push({ ang: ang, d: rnd(0.62, 0.8), life: 0.16 });
      }
    }
    if (streaks.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      var R = Math.hypot(w, h) * 0.5;
      for (var j = streaks.length - 1; j >= 0; j--) {
        var s = streaks[j]; s.life -= 1 / 60; s.d += 0.06;
        if (s.life <= 0) { streaks.splice(j, 1); continue; }
        var c = Math.cos(s.ang), si = Math.sin(s.ang), x1 = w / 2 + c * R * s.d, y1 = h * 0.45 + si * R * s.d * 0.8;
        ctx.strokeStyle = 'rgba(220,255,200,' + (s.life * 1.5) + ')'; ctx.lineWidth = Math.max(1, h / 400);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + c * R * 0.12, y1 + si * R * 0.1); ctx.stroke();
      }
      ctx.restore();
    }
    // particles
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k], t = p.life / p.max;
      if (p.t === 'spark') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,' + (150 + 100 * t | 0) + ',60,' + t + ')'; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); ctx.restore();
      } else if (p.t === 'dust') {
        ctx.fillStyle = 'rgba(' + p.c + ',' + (0.35 * t) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.t === 'flame') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, p.x, p.y, p.size * (1.6 - t * 0.6), t > 0.5 ? '255,220,120' : '255,110,20', Math.min(1, t * 1.6));
        ctx.restore();
      } else if (p.t === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillStyle = p.c; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
      }
    }
    // finish-line moment: checkered banner sweeps across
    if (finishT > 0) {
      var prog = 1 - finishT / 2.2, bh = h * 0.07, off = (prog * 6) % 2;
      var alpha = Math.min(1, finishT * 2, prog * 6);
      ctx.save(); ctx.globalAlpha = alpha * 0.9;
      [h * 0.06, h - bh - h * 0.04].forEach(function (by, row) {
        var sq = bh / 2;
        for (var x = -sq * 2; x < w + sq * 2; x += sq) {
          for (var yy = 0; yy < 2; yy++) {
            var shift = (row ? -1 : 1) * off * sq;
            ctx.fillStyle = (((x / sq | 0) + yy) % 2) ? '#111' : '#f4f4f4';
            ctx.fillRect(x + shift, by + yy * sq, sq + 1, sq + 1);
          }
        }
      });
      ctx.restore();
      if (Math.random() < 0.6) for (var q = 0; q < 3; q++)
        spawn({ t: 'confetti', x: rnd(0, w), y: -10, vx: rnd(-0.1, 0.1) * h, vy: rnd(0.1, 0.35) * h, rot: rnd(0, 6), vr: rnd(-8, 8), life: 2.4, max: 2.4, size: rnd(6, 12) * h / 480, c: Util.randomChoice(['#c8ff00', '#ff2bd6', '#ffb000', '#7df9ff']) });
    }
    // vignette (cached)
    var key = w + 'x' + h;
    if (vigKey !== key) {
      vigKey = key; vignette = document.createElement('canvas'); vignette.width = w; vignette.height = h;
      var vc = vignette.getContext('2d'), g = vc.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, Math.hypot(w, h) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,0,15,0.55)'); vc.fillStyle = g; vc.fillRect(0, 0, w, h);
    }
    ctx.drawImage(vignette, 0, 0);
  }

  function finish() { finishT = 2.2; }
  function reset() { parts.length = 0; streaks.length = 0; shake = 0; finishT = 0; }

  return { hit: hit, update: update, preWorld: preWorld, afterCar: afterCar, afterProp: afterProp, beforePlayer: beforePlayer,
    afterPlayer: afterPlayer, backfire: backfire, overlay: overlay, renderDepthFactor: renderDepthFactor, finish: finish, reset: reset,
    get count() { return parts.length; } };
})();
