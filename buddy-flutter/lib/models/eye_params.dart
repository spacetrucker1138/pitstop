import 'package:flutter/material.dart';

class EyeParams {
  final double lx, ly, lw, lh, lrx;
  final double rx, ry, rw, rh, rrx;
  final double topLid;
  final double botLid;
  final double tiltDeg;
  final bool useMadTriangles;
  final double pulseScale;
  final bool showWave;

  const EyeParams({
    required this.lx, required this.ly,
    required this.lw, required this.lh, required this.lrx,
    required this.rx, required this.ry,
    required this.rw, required this.rh, required this.rrx,
    this.topLid          = 0.0,
    this.botLid          = 0.0,
    this.tiltDeg         = 0.0,
    this.useMadTriangles = false,
    this.pulseScale      = 1.0,
    this.showWave        = false,
  });

  static EyeParams lerp(EyeParams a, EyeParams b, double t) {
    return EyeParams(
      lx:  _l(a.lx,  b.lx,  t), ly:  _l(a.ly,  b.ly,  t),
      lw:  _l(a.lw,  b.lw,  t), lh:  _l(a.lh,  b.lh,  t), lrx: _l(a.lrx, b.lrx, t),
      rx:  _l(a.rx,  b.rx,  t), ry:  _l(a.ry,  b.ry,  t),
      rw:  _l(a.rw,  b.rw,  t), rh:  _l(a.rh,  b.rh,  t), rrx: _l(a.rrx, b.rrx, t),
      topLid:    _l(a.topLid,   b.topLid,   t),
      botLid:    _l(a.botLid,   b.botLid,   t),
      tiltDeg:   _l(a.tiltDeg,  b.tiltDeg,  t),
      useMadTriangles: t < 0.5 ? a.useMadTriangles : b.useMadTriangles,
      pulseScale: _l(a.pulseScale, b.pulseScale, t),
      showWave:   t < 0.5 ? a.showWave : b.showWave,
    );
  }

  static double _l(double a, double b, double t) => a + (b - a) * t;
}

class EyeParamsTween extends Tween<EyeParams> {
  EyeParamsTween({required super.begin, required super.end});
  @override
  EyeParams lerp(double t) => EyeParams.lerp(begin!, end!, t);
}
