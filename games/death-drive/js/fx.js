// Visual effects layer. Part 1: camera shake only.
var FX = {
  shake: 0,
  hit: function (kind, x, y, power) { FX.shake = Math.max(FX.shake, 0.35 * (power || 1)); },
  update: function (dt) { FX.shake = Math.max(0, FX.shake - dt); },
  preWorld: function (ctx, w, h) {
    if (FX.shake > 0) { var a = FX.shake * h * 0.03; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
  },
  afterCar: function () {}, afterPlayer: function () {}, overlay: function () {},
  renderDepthFactor: function () { return 1; },
  finish: function () {}, reset: function () { FX.shake = 0; }
};
