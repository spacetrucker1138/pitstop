import 'package:flutter/material.dart';
import '../controllers/face_controller.dart';
import '../painters/face_painter.dart';

class BuddyFace extends StatelessWidget {
  final FaceController controller;
  const BuddyFace({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (ctx, _) {
        return AspectRatio(
          aspectRatio: 380 / 240,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00FFDD).withOpacity(
                    0.08 + controller.pulseGlow * 0.06),
                  blurRadius: 24, spreadRadius: 4,
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CustomPaint(
                    painter: FacePainter(
                      params:         controller.currentParams,
                      blinkLid:       controller.blinkLid,
                      waveform:       controller.waveform,
                      waveAmplitude:  controller.waveAmplitude,
                      pulseGlow:      controller.pulseGlow,
                    ),
                  ),
                  if (controller.iconLabel != null)
                    _IconOverlay(
                      label:      controller.iconLabel!,
                      expression: controller.currentExpression,
                      pulse:      controller.pulseGlow,
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _IconOverlay extends StatelessWidget {
  final String label;
  final dynamic expression;
  final double pulse;
  const _IconOverlay({required this.label, required this.expression, required this.pulse});

  @override
  Widget build(BuildContext context) {
    Alignment align; Color color; double size;
    switch (label) {
      case '♥':  align = const Alignment(0.0,  -0.75); color = const Color(0xFFFF5599); size = 28; break;
      case 'Zzz': align = const Alignment(0.72, -0.72); color = const Color(0xFF00FFDD); size = 16; break;
      case '!':  align = const Alignment(0.0,  -0.80); color = const Color(0xFFFFDD00); size = 30; break;
      case '?':  align = const Alignment(0.68, -0.75); color = const Color(0xFF00FFDD); size = 24; break;
      case '✖':  align = const Alignment(-0.80,-0.72); color = Colors.white;             size = 22; break;
      default:   align = Alignment.topCenter;           color = const Color(0xFF00FFDD); size = 20;
    }
    return Align(
      alignment: align,
      child: Opacity(
        opacity: 0.65 + pulse * 0.35,
        child: Text(label, style: TextStyle(
          color: color, fontSize: size,
          shadows: [
            Shadow(color: color.withOpacity(0.8), blurRadius: 12),
            Shadow(color: color.withOpacity(0.4), blurRadius: 24),
          ],
        )),
      ),
    );
  }
}
