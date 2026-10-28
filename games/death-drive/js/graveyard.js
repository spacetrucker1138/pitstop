// ─── Graveyard Dimension scenery (replaces the original palm trees / columns) ───
(function () {
  var G = {
    DEADTREE2: { s: 1, x: 0, y: 0, w: 303, h: 470 }, DEADTREE1: { s: 1, x: 307, y: 0, w: 289, h: 430 },
    LAMP: { s: 1, x: 600, y: 0, w: 234, h: 430, glow: 'lamp' }, OBELISK: { s: 1, x: 838, y: 0, w: 253, h: 380 },
    CRYPT: { s: 2, x: 0, y: 0, w: 492, h: 340, scale: 1.25 }, ANGEL: { s: 2, x: 496, y: 0, w: 218, h: 330 },
    TOMB2: { s: 2, x: 718, y: 0, w: 200, h: 300 }, TOMBS: { s: 2, x: 922, y: 0, w: 282, h: 190 },
    FENCE: { s: 3, x: 0, y: 0, w: 285, h: 190 }, TOMB1: { s: 3, x: 289, y: 0, w: 171, h: 170 },
    PUMPKINS: { s: 3, x: 464, y: 0, w: 192, h: 130, glow: 'pumpkin' }, SKULLS: { s: 3, x: 660, y: 0, w: 157, h: 105 }
  };
  for (var k in G) SPRITES['GY_' + k] = G[k];
  var SMALL = [G.TOMB1, G.TOMBS, G.TOMB2, G.SKULLS, G.PUMPKINS, G.TOMB1, G.TOMBS];
  var BIG = [G.DEADTREE1, G.DEADTREE2, G.ANGEL, G.OBELISK, G.DEADTREE1, G.DEADTREE2];
  var ALL = SMALL.concat(BIG, [G.CRYPT]);

  window.DD_EXTRA_IMAGES = ['gy1.webp', 'gy2.webp', 'gy3.webp', 'background_gy.webp'];
  window.DD_ON_READY = function (imgs) {
    var ok = true;
    for (var k in G) { var im = imgs['gy' + G[k].s + '.webp']; if (im && im.naturalWidth) G[k].sheet = im; else ok = false; }
    if (!ok) window.resetSprites = null; // fall back to the original scenery if a sheet failed
    var bg = imgs['background_gy.webp'];
    if (bg && bg.naturalWidth) background = bg;
  };

  window.resetSprites = function () {
    var n, i, side, L = segments.length;
    // billboards stay exactly where they were
    [SPRITES.BILLBOARD07, SPRITES.BILLBOARD06, SPRITES.BILLBOARD08, SPRITES.BILLBOARD09, SPRITES.BILLBOARD01, SPRITES.BILLBOARD02, SPRITES.BILLBOARD03, SPRITES.BILLBOARD04, SPRITES.BILLBOARD05]
      .forEach(function (b, k) { addSprite(20 + k * 20, b, -1); });
    addSprite(240, SPRITES.BILLBOARD07, -1.2); addSprite(240, SPRITES.BILLBOARD06, 1.2);
    addSprite(L - 25, SPRITES.BILLBOARD07, -1.2); addSprite(L - 25, SPRITES.BILLBOARD06, 1.2);

    // opening stretch: gas lamps light the way out of the graveyard gates
    for (n = 10; n < 200; n += 6) {
      addSprite(n, G.LAMP, 1.15);
      addSprite(n + 3, Util.randomChoice(SMALL), 1.6 + Math.random() * 1.6);
      if (n % 12 == 4) addSprite(n, Util.randomChoice(BIG), 2.6 + Math.random() * 2);
    }
    // long cemetery fence on the right, dead woods on the left
    for (n = 250; n < 1000; n += 5) {
      addSprite(n, G.FENCE, 1.1);
      addSprite(n + Util.randomInt(0, 4), Util.randomChoice(BIG), -1.2 - Math.random() * 2);
      if (n % 25 == 0) addSprite(n + 2, G.LAMP, -1.15);
      if (n % 15 == 0) addSprite(n + 1, Util.randomChoice(SMALL), 2 + Math.random() * 2);
      if (n % 100 == 50) addSprite(n + 3, G.CRYPT, 2.4);
    }
    // the rest of the track: scattered graves, trees, lamps, crypts
    for (n = 1000; n < L; n += 3) {
      var s = Util.randomChoice(ALL);
      addSprite(n, s, Util.randomChoice([1, -1]) * (s === G.CRYPT ? 3 + Math.random() * 3 : 1.6 + Math.random() * 5));
      if (n % 30 == 0) { addSprite(n, G.LAMP, 1.15); addSprite(n, G.LAMP, -1.15); }
    }
    for (n = 1000; n < L - 50; n += 100) {
      side = Util.randomChoice([1, -1]);
      addSprite(n + Util.randomInt(0, 50), Util.randomChoice(SPRITES.BILLBOARDS), -side);
      for (i = 0; i < 14; i++) addSprite(n + Util.randomInt(0, 50), Util.randomChoice(ALL), side * (1.5 + Math.random()));
    }
  };
})();
