# Buddy Face – Flutter Project

OLED robot face UI for the Samsung A14 LLM companion buddy.

## Project structure

```
lib/
  main.dart                    # Entry point — landscape + immersive mode
  models/
    expression.dart            # Expression enum + icon/blink maps
    eye_params.dart            # EyeParams struct + lerp + Tween
    expression_params.dart     # Ground-truth params for all 8 expressions
  painters/
    face_painter.dart          # CustomPainter — draws everything
  controllers/
    face_controller.dart       # All animation state (morph, blink, pulse, wave)
  widgets/
    buddy_face.dart            # Face widget + icon overlay
  screens/
    buddy_screen.dart          # Full screen — face + dev controls
```

## Build (debug APK for BlueStacks / A14 sideload)

```bash
# Install dependencies
flutter pub get

# Build APK
flutter build apk --debug

# Output path:
# build/app/outputs/flutter-apk/app-debug.apk
```

Drag `app-debug.apk` into BlueStacks to install.

## Features implemented

- All 8 expressions: idle, happy, sad, mad, curious, sleepy, startled, talking
- Mad = right-angle triangle eyes (outer edge vertical, hypotenuse slashes inward-down)
- Smooth morphing between expressions (350ms ease-out tween on all geometry)
- Eyelid system (top + bottom coverage fraction)
- Auto-blink (expression-specific interval, random jitter)
- Breathing pulse — subtle 2.5s glow + scale oscillation
- CRT scanlines overlay
- Phosphor vignette (radial dark falloff)
- Cyan glow (multi-pass blur)
- Waveform mouth (talking state, amplitude-driven)
- Icon overlays: ♥ ! ? Zzz ✖
- `feedMicAmplitude()` hook ready for voice wiring
- Landscape + immersive full-screen

## Next: voice wiring

When ready to wire mic input:
1. Add `mic_stream` or `flutter_sound` package
2. Feed RMS amplitude to `controller.feedMicAmplitude(amp)`
3. Set `controller.setExpression(Expression.talking)` on speech detected
4. Wire LLM response → TTS → `controller.setExpression(Expression.idle)` when done
