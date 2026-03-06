enum Expression {
  idle,
  happy,
  sad,
  mad,
  curious,
  sleepy,
  startled,
  talking,
}

const Map<Expression, String?> expressionIcon = {
  Expression.idle:     null,
  Expression.happy:    '♥',
  Expression.sad:      null,
  Expression.mad:      '✖',
  Expression.curious:  '?',
  Expression.sleepy:   'Zzz',
  Expression.startled: '!',
  Expression.talking:  null,
};

const Map<Expression, int> blinkIntervalMs = {
  Expression.idle:     4200,
  Expression.happy:    6000,
  Expression.sad:      7000,
  Expression.mad:      8000,
  Expression.curious:  5500,
  Expression.sleepy:   9000,
  Expression.startled: 3000,
  Expression.talking:  5000,
};
