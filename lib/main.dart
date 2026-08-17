import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const ShadowCourierApp());
}

class ShadowCourierApp extends StatelessWidget {
  const ShadowCourierApp({super.key});
  @override Widget build(BuildContext context) => MaterialApp(debugShowCheckedModeBanner: false, theme: ThemeData.dark(), home: const GameScreen());
}

class GameScreen extends StatefulWidget { const GameScreen({super.key}); @override State<GameScreen> createState() => _GameScreenState(); }

class _GameScreenState extends State<GameScreen> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker(_tick)..start();
  Duration _last = Duration.zero;
  final FocusNode focus = FocusNode();
  bool shadow = false, paused = false, won = false, left = false, right = false;
  double px = 110, py = 0, vx = 0, vy = 0, sx = 170, sy = 0, svx = 0, svy = 0;
  double shadowEnergy = 100, rewind = 0, health = 100;
  bool switchOn = false, doorOpen = false;
  final List<Offset> history = [];
  final List<Rect> platforms = const [Rect.fromLTWH(0, 500, 1300, 100), Rect.fromLTWH(180, 400, 180, 20), Rect.fromLTWH(430, 330, 180, 20), Rect.fromLTWH(690, 430, 190, 20), Rect.fromLTWH(960, 350, 200, 20)];
  final List<Enemy> enemies = [Enemy(560, 455, false), Enemy(820, 385, true)];
  double get ground => 500;

  void _tick(Duration now) {
    final dt = _last == Duration.zero ? .016 : math.min(.033, (now - _last).inMicroseconds / 1e6);
    _last = now;
    if (!paused && !won) _update(dt);
    setState(() {});
  }

  void _update(double dt) {
    final target = (right ? 1 : 0) - (left ? 1 : 0);
    if (!shadow) {
      vx += (target * 420 - vx) * math.min(1, dt * 9);
      vy += 1100 * dt;
      px += vx * dt; py += vy * dt;
      if (py > ground - 70) { py = ground - 70; vy = 0; }
      px = px.clamp(25, 1240);
    } else {
      svx += (target * 360 - svx) * math.min(1, dt * 8);
      svy += 800 * dt;
      sx += svx * dt; sy += svy * dt;
      if (sy > ground - 60) { sy = ground - 60; svy = 0; }
      sx = sx.clamp(25, 1240);
      if (history.length > 180) history.removeAt(0);
      history.add(Offset(sx, sy));
      shadowEnergy = math.min(100, shadowEnergy + dt * 5);
    }
    rewind = math.max(0, rewind - dt);
    for (final e in enemies) e.update(dt, shadow ? sx : px, shadow ? sy : py, shadow);
    if (switchOn && px > 930 && !doorOpen) doorOpen = true;
    if (px > 1160 && doorOpen) won = true;
  }

  void jump() { if (paused || won) return; if (!shadow && py >= ground - 72) { vy = -560; } else if (shadow && py >= ground - 62) { svy = -520; } }
  void dash() { if (paused || won) return; if (!shadow) px = (px + (right ? 150 : left ? -150 : 150)).clamp(25, 1240); else sx = (sx + (right ? 150 : left ? -150 : 150)).clamp(25, 1240); }
  void interact() { if (!shadow && px > 690 && px < 850) switchOn = true; if (shadow && sx > 690 && sx < 850) switchOn = true; }
  void toggleShadow() { if (paused || won) return; shadow = !shadow; }
  void doRewind() { if (!shadow || rewind > 0 || history.length < 20) return; final p = history[math.max(0, history.length - 90)]; sx = p.dx; sy = p.dy; history.clear(); rewind = 3; }

  @override void dispose() { _ticker.dispose(); focus.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) {
    return Scaffold(backgroundColor: const Color(0xff05070d), body: KeyboardListener(focusNode: focus..requestFocus(), autofocus: true, onKeyEvent: (e) { if (e is KeyDownEvent) { if (e.logicalKey == LogicalKeyboardKey.keyA) left = true; if (e.logicalKey == LogicalKeyboardKey.keyD) right = true; if (e.logicalKey == LogicalKeyboardKey.space) jump(); if (e.logicalKey == LogicalKeyboardKey.keyQ) toggleShadow(); if (e.logicalKey == LogicalKeyboardKey.keyR) doRewind(); if (e.logicalKey == LogicalKeyboardKey.shiftLeft) dash(); if (e.logicalKey == LogicalKeyboardKey.keyE) interact(); if (e.logicalKey == LogicalKeyboardKey.escape) setState(() => paused = !paused); } else if (e is KeyUpEvent) { if (e.logicalKey == LogicalKeyboardKey.keyA) left = false; if (e.logicalKey == LogicalKeyboardKey.keyD) right = false; } }, child: Stack(children: [CustomPaint(painter: GamePainter(px: px, py: py, sx: sx, sy: sy, shadow: shadow, platforms: platforms, enemies: enemies, switchOn: switchOn, doorOpen: doorOpen, health: health, energy: shadowEnergy), child: const SizedBox.expand()), _hud(), _touchControls(), if (paused) _overlay('PAUSED', 'Tap pause to continue'), if (won) _overlay('MISSION COMPLETE', 'The Shadow remembers.')]));
  }

  Widget _hud() => Positioned(top: 18, left: 20, right: 20, child: Row(children: [Text(shadow ? 'SHADOW' : 'COURIER', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: shadow ? const Color(0xffb36cff) : const Color(0xffffd43b))), const Spacer(), _bar('HP', health, const Color(0xffffd43b)), const SizedBox(width: 12), _bar('SHADOW', shadowEnergy, const Color(0xffb36cff)), const SizedBox(width: 12), Text('Q  SWITCH   R  REWIND', style: TextStyle(color: Colors.white.withOpacity(.6), fontSize: 11))]));
  Widget _bar(String label, double value, Color color) => SizedBox(width: 130, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold)), const SizedBox(height: 3), LinearProgressIndicator(value: value / 100, minHeight: 5, color: color, backgroundColor: Colors.white12)]));
  Widget _touchControls() => Positioned(bottom: 18, left: 18, right: 18, child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Row(children: [_btn('◀', () => setState(() => left = true), () => setState(() => left = false)), const SizedBox(width: 8), _btn('▶', () => setState(() => right = true), () => setState(() => right = false))]), Row(children: [_btn('JUMP', jump, null), const SizedBox(width: 8), _btn('DASH', dash, null), const SizedBox(width: 8), _btn(shadow ? 'COURIER' : 'SHADOW', toggleShadow, null), const SizedBox(width: 8), _btn('REWIND', doRewind, null), const SizedBox(width: 8), _btn('ACT', interact, null), const SizedBox(width: 8), _btn('Ⅱ', () => setState(() => paused = !paused), null)])]));
  Widget _btn(String text, VoidCallback down, VoidCallback? up) { final b = ElevatedButton(onPressed: down, style: ElevatedButton.styleFrom(backgroundColor: Colors.white.withOpacity(.10), foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12)), child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11))); return b; }
  Widget _overlay(String title, String sub) => Positioned.fill(child: Container(color: Colors.black.withOpacity(.72), child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(title, style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, letterSpacing: 4, color: Color(0xffffd43b))), const SizedBox(height: 10), Text(sub, style: const TextStyle(color: Colors.white60)), const SizedBox(height: 18), ElevatedButton(onPressed: () => setState(() { if (won) { won = false; px = 110; switchOn = false; doorOpen = false; } else { paused = false; } }), child: Text(won ? 'PLAY AGAIN' : 'RESUME'))]))));
}

class Enemy { double x, y; final bool hunter; double hp = 100; Enemy(this.x, this.y, this.hunter); void update(double dt, double tx, double ty, bool isShadow) { if (hunter != isShadow && (tx-x).abs() < 260) x += (tx > x ? 1 : -1) * 45 * dt; } }

class GamePainter extends CustomPainter {
  final double px, py, sx, sy, health, energy; final bool shadow, switchOn, doorOpen; final List<Rect> platforms; final List<Enemy> enemies;
  GamePainter({required this.px, required this.py, required this.sx, required this.sy, required this.shadow, required this.platforms, required this.enemies, required this.switchOn, required this.doorOpen, required this.health, required this.energy});
  @override void paint(Canvas c, Size s) {
    final scale = s.width / 1280; c.scale(scale, scale); final w = 1280.0, h = s.height / scale;
    c.drawRect(Rect.fromLTWH(0, 0, w, h), Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xff070b18), Color(0xff111329)]).createShader(Rect.fromLTWH(0,0,w,h)));
    final grid = Paint()..color = const Color(0xff18213a); for (double x=0;x<w;x+=80) c.drawLine(Offset(x,0), Offset(x,h), grid); for (double y=80;y<h;y+=70) c.drawLine(Offset(0,y), Offset(w,y), grid);
    for (final r in platforms) { c.drawRect(r, Paint()..color=const Color(0xff171c2c)); c.drawLine(Offset(r.left,r.top), Offset(r.right,r.top), Paint()..color=const Color(0xffffd43b)..strokeWidth=2); }
    _sign(c, 70, 180, 'NΞON // SLUMS'); _sign(c, 390, 140, 'SHADOW // 03'); _sign(c, 900, 170, 'COURIER');
    final door = Rect.fromLTWH(1040, 270, 90, 230); c.drawRect(door, Paint()..color=(doorOpen?const Color(0xff1e684f):const Color(0xff301e2e))); if (!doorOpen) c.drawRect(door.deflate(7), Paint()..color=const Color(0xff090b13));
    c.drawCircle(const Offset(760, 410), 14, Paint()..color=(switchOn?const Color(0xffb36cff):const Color(0xffffd43b))); c.drawCircle(const Offset(760,410), 25, Paint()..style=PaintingStyle.stroke..strokeWidth=2..color=const Color(0x55ffffff));
    for(final e in enemies) { c.drawCircle(Offset(e.x,e.y), 22, Paint()..color=(e.hunter?const Color(0xffb36cff):const Color(0xffff465c))); c.drawCircle(Offset(e.x,e.y), 30, Paint()..style=PaintingStyle.stroke..strokeWidth=2..color=(e.hunter?const Color(0xffb36cff):const Color(0xffff465c))); }
    _character(c, px, py, false); _character(c, sx, sy, true);
  }
  void _character(Canvas c,double x,double y,bool isShadow){ final active = shadow==isShadow; final col=isShadow?const Color(0xffb36cff):const Color(0xffffd43b); final p=Paint()..color=(active?col:col.withOpacity(.18)); c.drawCircle(Offset(x,y+30), 25, p); c.drawRect(Rect.fromLTWH(x-13,y+10,26,45), p); c.drawCircle(Offset(x,y), 14, p); if(active) { c.drawCircle(Offset(x,y+25),32,Paint()..style=PaintingStyle.stroke..strokeWidth=2..color=col); } }
  void _sign(Canvas c,double x,double y,String t){ final p=Paint()..color=const Color(0xff172039); c.drawRect(Rect.fromLTWH(x,y,190,45),p); final tp=TextPainter(text:TextSpan(text:t,style:const TextStyle(color:Color(0xff56d9ff),fontSize:14,fontWeight:FontWeight.bold)),textDirection:TextDirection.ltr)..layout(); tp.paint(c,Offset(x+10,y+13)); }
  @override bool shouldRepaint(covariant GamePainter old) => true;
}
