import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/expression.dart';
import '../models/expression_params.dart';
import '../models/eye_params.dart';

class FaceController extends ChangeNotifier {
  EyeParams currentParams = expressionParams[Expression.idle]!;
  Expression currentExpression = Expression.idle;

  EyeParams _fromParams = expressionParams[Expression.idle]!;
  EyeParams _toParams   = expressionParams[Expression.idle]!;
  double _morphT = 1.0;
  Timer? _morphTimer;

  double blinkLid = 0.0;
  Timer? _blinkTimer;
  bool _blinking = false;

  double pulseGlow  = 0.5;
  double pulseScale = 1.0;
  Timer? _pulseTimer;
  double _pulsePhase = 0.0;

  List<double> waveform = List.filled(60, 0.0);
  double waveAmplitude  = 0.0;
  double _waveTargetAmp = 0.0;
  Timer? _waveTimer;
  double _wavePhase = 0.0;

  String? iconLabel;

  FaceController() {
    _startPulse();
    _startWave();
    _scheduleBlink();
  }

  void setExpression(Expression expr) {
    if (expr == currentExpression) return;
    currentExpression = expr;
    iconLabel = expressionIcon[expr];
    _waveTargetAmp = expr == Expression.talking ? 13.0 : 0.0;

    _fromParams = currentParams;
    _toParams   = expressionParams[expr]!;
    _morphT     = 0.0;
    _morphTimer?.cancel();

    const steps = 20;
    int step = 0;
    _morphTimer = Timer.periodic(
      const Duration(milliseconds: 17), // ~350ms / 20
      (t) {
        step++;
        _morphT = Curves.easeOut.transform((step / steps).clamp(0.0, 1.0));
        currentParams = EyeParams.lerp(_fromParams, _toParams, _morphT);
        if (step >= steps) t.cancel();
        notifyListeners();
      },
    );
    _scheduleBlink();
    notifyListeners();
  }

  void _startPulse() {
    _pulseTimer = Timer.periodic(const Duration(milliseconds: 40), (_) {
      _pulsePhase += 0.025;
      pulseGlow  = 0.4 + 0.3  * (math.sin(_pulsePhase) * 0.5 + 0.5);
      pulseScale = 1.0 + 0.015 * (math.sin(_pulsePhase) * 0.5 + 0.5);
      notifyListeners();
    });
  }

  void _scheduleBlink() {
    _blinkTimer?.cancel();
    final interval = blinkIntervalMs[currentExpression] ?? 4200;
    final rng = math.Random();
    _blinkTimer = Timer(
      Duration(milliseconds: interval + rng.nextInt(600) - 300),
      () { if (currentExpression != Expression.sleepy) _doBlink(); _scheduleBlink(); },
    );
  }

  Future<void> _doBlink() async {
    if (_blinking) return;
    _blinking = true;
    for (int i = 1; i <= 5; i++) {
      blinkLid = i / 5.0 * 0.9; notifyListeners();
      await Future.delayed(const Duration(milliseconds: 12));
    }
    for (int i = 4; i >= 0; i--) {
      blinkLid = i / 5.0 * 0.9; notifyListeners();
      await Future.delayed(const Duration(milliseconds: 14));
    }
    _blinking = false;
  }

  void _startWave() {
    _waveTimer = Timer.periodic(const Duration(milliseconds: 16), (_) {
      waveAmplitude += (_waveTargetAmp - waveAmplitude) * 0.10;
      if (waveAmplitude.abs() < 0.01) waveAmplitude = 0.0;
      _wavePhase += 0.12;
      waveform = List.generate(60, (i) =>
        math.sin(i * 0.30 + _wavePhase)        * (waveAmplitude / 13)
      + math.sin(i * 0.58 + _wavePhase * 1.4)  * (waveAmplitude / 13 * 0.35)
      + math.sin(i * 0.13 + _wavePhase * 0.6)  * (waveAmplitude / 13 * 0.20));
      notifyListeners();
    });
  }

  void feedMicAmplitude(double amp) {
    if (currentExpression == Expression.talking) {
      _waveTargetAmp = amp * 18.0;
    }
  }

  @override
  void dispose() {
    _morphTimer?.cancel();
    _blinkTimer?.cancel();
    _pulseTimer?.cancel();
    _waveTimer?.cancel();
    super.dispose();
  }
}
