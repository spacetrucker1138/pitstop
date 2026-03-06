import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/eye_params.dart';

const Color _cyan  = Color(0xFF00FFDD);
const Color _black = Colors.black;

class FacePainter extends CustomPainter {
  final EyeParams params;
  final double blinkLid;
  final List<double> waveform;
  final double waveAmplitude;
  final double pulseGlow;

  const FacePainter({
    required this.params,
    this.blinkLid     = 0.0,
    this.waveform     = const [],
    this.waveAmplitude = 0.0,
    this.pulseGlow    = 0.5,
  });

  static const double _dw = 380, _dh = 240;
  double _sx(double x, Size s) => x / _dw * s.width;
  double _sy(double y, Size s) => y / _dh * s.height;
  double _sw(double w, Size s) => w / _dw * s.width;
  double _sh(double h, Size s) => h / _dh * s.height;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = _black);
    if (params.useMadTriangles) {
      _drawMadEyes(canvas, size);
    } else {
      _drawRectEyes(canvas, size);
    }
    if (params.showWave && waveAmplitude > 0.5) {
      _drawWaveform(canvas, size);
    }
    _drawScanlines(canvas, size);
    _drawVignette(canvas, size);
  }

  void _drawRectEyes(Canvas canvas, Size size) {
    _drawOneEye(canvas, size,
      x: params.lx, y: params.ly, w: params.lw, h: params.lh, rx: params.lrx,
      topFrac: params.topLid + blinkLid, botFrac: params.botLid,
      tiltDeg: params.tiltDeg,
    );
    _drawOneEye(canvas, size,
      x: params.rx, y: params.ry, w: params.rw, h: params.rh, rx: params.rrx,
      topFrac: params.topLid + blinkLid, botFrac: params.botLid,
      tiltDeg: -params.tiltDeg,
    );
  }

  void _drawOneEye(Canvas canvas, Size size, {
    required double x, required double y,
    required double w, required double h, required double rx,
    required double topFrac, required double botFrac,
    required double tiltDeg,
  }) {
    final sx = _sx(x, size), sy = _sy(y, size);
    final sw = _sw(w, size), sh = _sh(h, size);
    final srx = _sw(rx, size);
    final rect   = Rect.fromLTWH(sx, sy, sw, sh);
    final rrect  = RRect.fromRectAndRadius(rect, Radius.circular(srx));
    final cx = sx + sw / 2, cy = sy + sh / 2;

    canvas.save();
    if (tiltDeg != 0) {
      canvas.translate(cx, cy);
      canvas.rotate(tiltDeg * math.pi / 180);
      canvas.translate(-cx, -cy);
    }

    final gi = 0.25 + pulseGlow * 0.35;
    for (final blur in [12.0, 6.0, 3.0]) {
      canvas.drawRRect(rrect, Paint()
        ..color = _cyan.withOpacity(gi * (12 / (blur + 4)))
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, blur));
    }
    canvas.drawRRect(rrect, Paint()..color = _cyan);

    if (topFrac > 0) {
      canvas.drawRect(
        Rect.fromLTWH(sx, sy, sw, sh * topFrac.clamp(0.0, 1.0)),
        Paint()..color = _black);
    }
    if (botFrac > 0) {
      final lidH = sh * botFrac.clamp(0.0, 1.0);
      canvas.drawRect(
        Rect.fromLTWH(sx, sy + sh - lidH, sw, lidH),
        Paint()..color = _black);
    }
    canvas.restore();
  }

  void _drawMadEyes(Canvas canvas, Size size) {
    final lx = _sx(params.lx, size), ly = _sy(params.ly, size);
    final lw = _sw(params.lw, size), lh = _sh(params.lh, size);
    final rx = _sx(params.rx, size), ry = _sy(params.ry, size);
    final rw = _sw(params.rw, size), rh = _sh(params.rh, size);

    _drawTriEye(canvas, [
      Offset(lx,      ly + lh * 0.10),
      Offset(lx,      ly + lh),
      Offset(lx + lw, ly + lh),
    ]);
    _drawTriEye(canvas, [
      Offset(rx + rw, ry + rh * 0.10),
      Offset(rx + rw, ry + rh),
      Offset(rx,      ry + rh),
    ]);
  }

  void _drawTriEye(Canvas canvas, List<Offset> pts) {
    final path = Path()
      ..moveTo(pts[0].dx, pts[0].dy)
      ..lineTo(pts[1].dx, pts[1].dy)
      ..lineTo(pts[2].dx, pts[2].dy)
      ..close();
    for (final blur in [12.0, 6.0]) {
      canvas.drawPath(path, Paint()
        ..color = _cyan.withOpacity(0.30)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, blur));
    }
    canvas.drawPath(path, Paint()..color = _cyan);
  }

  void _drawWaveform(Canvas canvas, Size size) {
    const waveW = 200.0, waveH = 36.0;
    const waveX = (380 - waveW) / 2.0, waveY = 240 - 38.0 - waveH;
    final ox = _sx(waveX, size), oy = _sy(waveY, size);
    final ow = _sw(waveW, size), oh = _sh(waveH, size);
    final midY = oy + oh / 2;
    final samples = waveform.isEmpty ? List<double>.filled(60, 0) : waveform;

    final ghost = Path();
    for (int i = 0; i < samples.length; i++) {
      final px = ox + (i / (samples.length - 1)) * ow;
      final py = midY - samples[i] * oh * 0.35;
      i == 0 ? ghost.moveTo(px, py) : ghost.lineTo(px, py);
    }
    canvas.drawPath(ghost, Paint()
      ..color = _cyan.withOpacity(0.18)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke);

    final wave = Path();
    for (int i = 0; i < samples.length; i++) {
      final px = ox + (i / (samples.length - 1)) * ow;
      final py = midY - samples[i] * oh * 0.45;
      i == 0 ? wave.moveTo(px, py) : wave.lineTo(px, py);
    }
    final wavePaint = Paint()
      ..color = _cyan
      ..strokeWidth = _sw(2.5, size)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
    canvas.drawPath(wave, wavePaint);
    canvas.drawPath(wave, wavePaint..maskFilter = null);
  }

  void _drawScanlines(Canvas canvas, Size size) {
    final p = Paint()..color = Colors.black.withOpacity(0.20);
    const lineH = 3.0, gap = 2.0;
    double y = 0;
    while (y < size.height) {
      canvas.drawRect(Rect.fromLTWH(0, y + gap, size.width, lineH - gap), p);
      y += lineH;
    }
  }

  void _drawVignette(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..shader = RadialGradient(
      center: Alignment.center,
      radius: 0.85,
      colors: [Colors.transparent, Colors.transparent, Colors.black.withOpacity(0.55)],
      stops: const [0.0, 0.55, 1.0],
    ).createShader(rect));
  }

  @override
  bool shouldRepaint(FacePainter old) =>
      old.params != params || old.blinkLid != blinkLid ||
      old.waveform != waveform || old.waveAmplitude != waveAmplitude ||
      old.pulseGlow != pulseGlow;
}
