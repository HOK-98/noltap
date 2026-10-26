import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, createQuestionSequence, limitForQuestion, pointsForAnswer, questionAt } from '../src/game-engine.js';

test('question timer starts at 3 seconds and drops by 100ms every three questions', () => {
  assert.equal(limitForQuestion(1), 3000);
  assert.equal(limitForQuestion(3), 3000);
  assert.equal(limitForQuestion(4), 2900);
  assert.equal(limitForQuestion(7), 2800);
  assert.equal(limitForQuestion(31), 2000);
  assert.equal(limitForQuestion(60), 1100);
  assert.equal(limitForQuestion(61), 1000);
  assert.equal(limitForQuestion(1000), 1000);
});

test('same seed generates the same ordered color questions', () => {
  const first = createQuestionSequence(4179821);
  const second = createQuestionSequence(4179821);
  for (let index = 0; index < 120; index += 1) {
    assert.deepEqual(first.next(), second.next());
  }
});

test('question word meaning and ink color are independently represented', () => {
  const question = questionAt(91274, 0);
  assert.equal(question.word, ['RED', 'BLUE', 'GREEN', 'YELLOW'][question.wordIndex]);
  assert.ok(question.colorIndex >= 0 && question.colorIndex < COLORS.length);
  assert.equal(question.correctColor, question.colorIndex);
  assert.equal(question.backgroundIndex, null);
});

test('backgrounds begin at question 31 and never match the ink color', () => {
  assert.equal(questionAt(123, 29).backgroundIndex, null);
  assert.notEqual(questionAt(123, 30).backgroundIndex, null);
  for (let index = 30; index < 150; index += 1) {
    const question = questionAt(123, index);
    assert.notEqual(question.backgroundIndex, question.colorIndex);
  }
});

test('answer score uses the requested proportional speed bonus and capped combo bonus', () => {
  assert.deepEqual(pointsForAnswer(0, 3000, 1), { speedBonus: 100, comboBonus: 0, total: 200 });
  assert.deepEqual(pointsForAnswer(1500, 3000, 5), { speedBonus: 50, comboBonus: 20, total: 170 });
  assert.deepEqual(pointsForAnswer(3000, 3000, 20), { speedBonus: 0, comboBonus: 50, total: 150 });
});
