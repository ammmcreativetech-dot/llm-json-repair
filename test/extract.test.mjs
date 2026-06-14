import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractJsonObjects,
  scanBalanced,
  extractStringFields,
  createStreamingExtractor,
} from '../dist/index.js';

test('extracts multiple complete objects and ignores braces inside strings', () => {
  // a contains LaTeX with braces; q contains a set with braces — neither must break the scan
  const buffer = '[{"q":"the set {1,2,3}","a":"\\\\frac{1}{2}"},{"q":"x","a":"y"}]';
  const objs = extractJsonObjects(buffer);
  assert.equal(objs.length, 2);
  assert.equal(objs[0].q, 'the set {1,2,3}');
  assert.equal(objs[0].a, '\\frac{1}{2}');
});

test('leaves a trailing incomplete object alone', () => {
  const objs = extractJsonObjects('{"a":1},{"b":2');
  assert.equal(objs.length, 1);
  assert.deepEqual(objs[0], { a: 1 });
});

test('handles escaped quotes inside strings', () => {
  const objs = extractJsonObjects('{"text":"he said \\"hi\\" to {everyone}"}');
  assert.equal(objs.length, 1);
  assert.equal(objs[0].text, 'he said "hi" to {everyone}');
});

test('streaming extractor yields objects only as they complete', () => {
  const ex = createStreamingExtractor();
  assert.deepEqual(ex.push('[{"a":1'), []);
  assert.deepEqual(ex.push('},{"b":2}'), [{ a: 1 }, { b: 2 }]);
  assert.deepEqual(ex.push(',{"c":3'), []);
  assert.deepEqual(ex.push('}]'), [{ c: 3 }]);
});

test('field-level recovery from a truncated object', () => {
  const partial = '{"front":"What is \\\\pi?","back":"3.14';
  const fields = extractStringFields(partial, ['front', 'back']);
  assert.equal(fields.front, 'What is \\pi?');
  // back is truncated (no closing quote) → not recovered
  assert.equal(fields.back, undefined);
});

test('requireKeys / excludeKeys filtering', () => {
  const buffer = '{"front":"a","back":"b"}{"title":"a source block"}';
  const cards = extractJsonObjects(buffer, {
    requireKeys: ['"front"', '"back"'],
    excludeKeys: ['"title"'],
  });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].front, 'a');
});

test('scanBalanced returns -1 for an unfinished object', () => {
  assert.equal(scanBalanced('{"a":{"b":1}', 0), -1);
  assert.equal(scanBalanced('{"a":{"b":1}}', 0), 12);
});
