import 'package:flutter/material.dart';
import '../controllers/face_controller.dart';
import '../models/expression.dart';
import '../widgets/buddy_face.dart';

class BuddyScreen extends StatefulWidget {
  const BuddyScreen({super.key});
  @override
  State<BuddyScreen> createState() => _BuddyScreenState();
}

class _BuddyScreenState extends State<BuddyScreen> {
  final _controller = FaceController();
  Expression _selected = Expression.idle;

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Center(child: BuddyFace(controller: _controller)),
              ),
            ),
            _ExpressionBar(
              selected: _selected,
              onSelect: (e) {
                setState(() => _selected = e);
                _controller.setExpression(e);
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class _ExpressionBar extends StatelessWidget {
  final Expression selected;
  final ValueChanged<Expression> onSelect;
  const _ExpressionBar({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8, runSpacing: 8,
      children: Expression.values.map((e) {
        final active = e == selected;
        return GestureDetector(
          onTap: () => onSelect(e),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: active
                  ? const Color(0xFF00FFDD).withOpacity(0.10)
                  : const Color(0xFF1A1A1A),
              border: Border.all(
                color: active
                    ? const Color(0xFF00FFDD).withOpacity(0.88)
                    : const Color(0xFF2A2A2A),
              ),
              borderRadius: BorderRadius.circular(6),
              boxShadow: active
                  ? [const BoxShadow(color: Color(0x3300FFDD), blurRadius: 8)]
                  : [],
            ),
            child: Text(
              e.name.toUpperCase(),
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: 1.2,
                color: active
                    ? const Color(0xFF00FFDD)
                    : const Color(0xFF00FFDD).withOpacity(0.55),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
