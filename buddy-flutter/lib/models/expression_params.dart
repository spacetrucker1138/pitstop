import 'eye_params.dart';
import 'expression.dart';

const double _EW = 108, _EH = 100;
const double _LX = 62,  _LY = 60;
const double _RX = 210, _RY = 60;
const double _RXD = 18.0;

const Map<Expression, EyeParams> expressionParams = {

  Expression.idle: EyeParams(
    lx: _LX, ly: _LY, lw: _EW, lh: _EH, lrx: _RXD,
    rx: _RX, ry: _RY, rw: _EW, rh: _EH, rrx: _RXD,
  ),

  Expression.talking: EyeParams(
    lx: _LX, ly: _LY, lw: _EW, lh: _EH, lrx: _RXD,
    rx: _RX, ry: _RY, rw: _EW, rh: _EH, rrx: _RXD,
    showWave: true,
  ),

  Expression.happy: EyeParams(
    lx: _LX, ly: _LY, lw: _EW, lh: _EH, lrx: _RXD,
    rx: _RX, ry: _RY, rw: _EW, rh: _EH, rrx: _RXD,
    botLid: 0.42,
  ),

  Expression.sad: EyeParams(
    lx: _LX, ly: _LY + 8, lw: _EW, lh: _EH - 8, lrx: _RXD,
    rx: _RX, ry: _RY + 8, rw: _EW, rh: _EH - 8, rrx: _RXD,
    topLid: 0.28,
  ),

  Expression.mad: EyeParams(
    lx: _LX, ly: _LY, lw: _EW, lh: _EH, lrx: 0,
    rx: _RX, ry: _RY, rw: _EW, rh: _EH, rrx: 0,
    useMadTriangles: true,
  ),

  Expression.curious: EyeParams(
    lx: _LX,     ly: _LY + 10, lw: _EW * 0.85, lh: _EH * 0.85, lrx: _RXD,
    rx: _RX - 4, ry: _RY - 6,  rw: _EW * 1.05, rh: _EH * 1.10, rrx: _RXD,
  ),

  Expression.sleepy: EyeParams(
    lx: _LX, ly: _LY, lw: _EW, lh: _EH, lrx: _RXD,
    rx: _RX, ry: _RY, rw: _EW, rh: _EH, rrx: _RXD,
    topLid: 0.65,
  ),

  Expression.startled: EyeParams(
    lx: _LX - 4, ly: _LY - 12, lw: _EW + 8, lh: _EH + 20, lrx: _RXD,
    rx: _RX - 4, ry: _RY - 12, rw: _EW + 8, rh: _EH + 20, rrx: _RXD,
  ),
};
