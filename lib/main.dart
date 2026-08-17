import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/scheduler.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: ShadowCourier(),
  ));
}

class ShadowCourier extends StatefulWidget {
  const ShadowCourier({super.key});

  @override
  State<ShadowCourier> createState() => _GameState();
}

class _GameState extends State<ShadowCourier>
    with SingleTickerProviderStateMixin {
  late final Ticker ticker = createTicker(loop)..start();
  Duration last = Duration.zero;

  double x = 120;
  double y = 420;
  double vx = 0;
  double vy = 0;
  double sx = 190;
  double sy = 440;
  double svx = 0;
  double svy = 0;

  bool shadow = false;
  bool left = false;
  bool right = false;
  bool paused = false;
  bool won = false;
  bool switchOn = false;
  bool door = false;
  double energy = 100;
  final history = <Offset>[];

  void loop(Duration t) {
    final dt = last == Duration.zero
        ? 0.016
        : math.min(0.032, (t - last).inMicroseconds / 1000000);
    last = t;

    if (!paused && !won) {
      final dir = (right ? 1 : 0) - (left ? 1 : 0);

      if (!shadow) {
        vx += (dir * 420 - vx) * math.min(1, dt * 10);
        vy += 1000 * dt;
        x += vx * dt;
        y += vy * dt;
        if (y > 420) {
          y = 420;
          vy = 0;
        }
        x = x.clamp(30, 1240).toDouble();
      } else {
        svx += (dir * 360 - svx) * math.min(1, dt * 9);
        svy += 850 * dt;
        sx += svx * dt;
        sy += svy * dt;
        if (sy > 440) {
          sy = 440;
          svy = 0;
        }
        sx = sx.clamp(30, 1240).toDouble();
        history.add(Offset(sx, sy));
        if (history.length > 180) history.removeAt(0);
        energy = math.min(100, energy + dt * 5);
      }

      if (switchOn && x > 900) door = true;
      if (x > 1160 && door) won = true;
    }

    if (mounted) setState(() {});
  }

  void jump() {
    if (paused || won) return;
    if (!shadow && y >= 415) vy = -560;
    if (shadow && sy >= 435) svy = -520;
  }

  void dash() {
    if (paused || won) return;
    final d = right ? 150 : left ? -150 : 150;
    if (shadow) {
      sx = (sx + d).clamp(30, 1240).toDouble();
    } else {
      x = (x + d).clamp(30, 1240).toDouble();
    }
  }

  void switchChar() {
    if (!paused && !won) setState(() => shadow = !shadow);
  }

  void rewind() {
    if (shadow && history.length > 30) {
      final p = history[math.max(0, history.length - 90)];
      sx = p.dx;
      sy = p.dy;
      history.clear();
    }
  }

  void act() {
    if ((x > 650 && x < 850) || (sx > 650 && sx < 850)) {
      setState(() => switchOn = true);
    }
  }

  @override
  void dispose() {
    ticker.dispose();
    super.dispose();
  }

  Widget btn(String text, VoidCallback action) {
    return Padding(
      padding: const EdgeInsets.all(3),
      child: ElevatedButton(
        onPressed: action,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white10,
          foregroundColor: Colors.white,
          side: const BorderSide(color: Colors.white24),
        ),
        child: Text(
          text,
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget buildPauseOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black87,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                won ? 'MISSION COMPLETE' : 'PAUSED',
                style: const TextStyle(
                  color: Color(0xffffd43b),
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 18),
              btn(
                won ? 'PLAY AGAIN' : 'RESUME',
                () => setState(() {
                  if (won) {
                    won = false;
                    x = 120;
                    y = 420;
                    sx = 190;
                    sy = 440;
                    vx = 0;
                    vy = 0;
                    svx = 0;
                    svy = 0;
                    door = false;
                    switchOn = false;
                    energy = 100;
                    history.clear();
                  } else {
                    paused = false;
                  }
                }),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xff05070d),
      body: KeyboardListener(
        autofocus: true,
        focusNode: FocusNode(),
        onKeyEvent: (event) {
          if (event is KeyDownEvent) {
            if (event.logicalKey == LogicalKeyboardKey.keyA) {
              setState(() => left = true);
            }
            if (event.logicalKey == LogicalKeyboardKey.keyD) {
              setState(() => right = true);
            }
            if (event.logicalKey == LogicalKeyboardKey.space) jump();
            if (event.logicalKey == LogicalKeyboardKey.keyQ) switchChar();
            if (event.logicalKey == LogicalKeyboardKey.keyR) rewind();
            if (event.logicalKey == LogicalKeyboardKey.shiftLeft) dash();
            if (event.logicalKey == LogicalKeyboardKey.keyE) act();
            if (event.logicalKey == LogicalKeyboardKey.escape) {
              setState(() => paused = !paused);
            }
          } else if (event is KeyUpEvent) {
            if (event.logicalKey == LogicalKeyboardKey.keyA) {
              setState(() => left = false);
            }
            if (event.logicalKey == LogicalKeyboardKey.keyD) {
              setState(() => right = false);
            }
          }
        },
        child: Stack(
          children: [
            CustomPaint(
              painter: ScenePainter(
                x,
                y,
                sx,
                sy,
                shadow,
                switchOn,
                door,
              ),
              child: const SizedBox.expand(),
            ),
            Positioned(
              top: 12,
              left: 16,
              right: 16,
              child: Row(
                children: [
                  Text(
                    shadow ? 'SHADOW' : 'COURIER',
                    style: TextStyle(
                      color: shadow
                          ? const Color(0xffb36cff)
                          : const Color(0xffffd43b),
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: 140,
                    child: LinearProgressIndicator(
                      value: energy / 100,
                      color: const Color(0xffb36cff),
                      backgroundColor: Colors.white12,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Q switch  R rewind',
                    style: TextStyle(color: Colors.white54, fontSize: 10),
                  ),
                ],
              ),
            ),
            Positioned(
              bottom: 10,
              left: 10,
              right: 10,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      btn('◀', () => setState(() => left = true)),
                      btn('▶', () => setState(() => right = true)),
                    ],
                  ),
                  Row(
                    children: [
                      btn('JUMP', jump),
                      btn('DASH', dash),
                      btn(shadow ? 'COURIER' : 'SHADOW', switchChar),
                      btn('REWIND', rewind),
                      btn('ACT', act),
                      btn('Ⅱ', () => setState(() => paused = !paused)),
                    ],
                  ),
                ],
              ),
            ),
            if (paused || won) buildPauseOverlay(),
          ],
        ),
      ),
    );
  }
}

class ScenePainter extends CustomPainter {
  final double x;
  final double y;
  final double sx;
  final double sy;
  final bool shadow;
  final bool switchOn;
  final bool door;

  ScenePainter(
    this.x,
    this.y,
    this.sx,
    this.sy,
    this.shadow,
    this.switchOn,
    this.door,
  );

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 1280;
    canvas.scale(k, k);
    final h = size.height / k;

    canvas.drawRect(
      Rect.fromLTWH(0, 0, 1280, h),
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xff060a18), Color(0xff12142a)],
        ).createShader(Rect.fromLTWH(0, 0, 1280, h)),
    );

    final grid = Paint()..color = const Color(0xff1a2440);
    for (double a = 0; a < 1280; a += 80) {
      canvas.drawLine(Offset(a, 0), Offset(a, h), grid);
    }
    for (double a = 80; a < h; a += 70) {
      canvas.drawLine(Offset(0, a), Offset(1280, a), grid);
    }

    canvas.drawRect(
      const Rect.fromLTWH(0, 500, 1280, 100),
      Paint()..color = const Color(0xff171d30),
    );
    canvas.drawLine(
      const Offset(0, 500),
      const Offset(1280, 500),
      Paint()
        ..color = const Color(0xffffd43b)
        ..strokeWidth = 3,
    );

    for (final rect in [
      const Rect.fromLTWH(180, 400, 180, 20),
      const Rect.fromLTWH(430, 330, 180, 20),
      const Rect.fromLTWH(690, 430, 190, 20),
      const Rect.fromLTWH(960, 350, 200, 20),
    ]) {
      canvas.drawRect(rect, Paint()..color = const Color(0xff202840));
    }

    canvas.drawRect(
      const Rect.fromLTWH(1040, 270, 90, 230),
      Paint()..color = door
          ? const Color(0xff195b47)
          : const Color(0xff311c2d),
    );

    if (!door) {
      canvas.drawRect(
        const Rect.fromLTWH(1047, 277, 76, 216),
        Paint()..color = const Color(0xff080a12),
      );
    }

    canvas.drawCircle(
      const Offset(760, 465),
      15,
      Paint()
        ..color = switchOn
            ? const Color(0xffb36cff)
            : const Color(0xffffd43b),
    );

    for (final e in [const Offset(560, 455), const Offset(820, 385)]) {
      canvas.drawCircle(
        e,
        22,
        Paint()
          ..color = e.dx == 820
              ? const Color(0xffb36cff)
              : const Color(0xffff465c),
      );
    }

    player(canvas, x, y, false);
    player(canvas, sx, sy, true);
  }

  void player(Canvas canvas, double a, double b, bool isShadow) {
    final active = shadow == isShadow;
    final color = isShadow
        ? const Color(0xffb36cff)
        : const Color(0xffffd43b);
    final paint = Paint()..color = active ? color : color.withOpacity(.16);

    canvas.drawCircle(Offset(a, b), 14, paint);
    canvas.drawRect(Rect.fromLTWH(a - 13, b + 12, 26, 42), paint);

    if (active) {
      canvas.drawCircle(
        Offset(a, b + 25),
        32,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(covariant ScenePainter oldDelegate) => true;
}
