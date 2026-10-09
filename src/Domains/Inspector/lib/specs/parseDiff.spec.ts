import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../parseDiff';

describe('parseUnifiedDiff', () => {
  it('returns [] for an empty patch', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });

  it('returns [] for a whitespace-only patch', () => {
    expect(parseUnifiedDiff('   \n  \n')).toEqual([]);
  });

  it('classifies +, - and context lines with double incremental numbering (D1)', () => {
    const hunks = parseUnifiedDiff(
      ['@@ -1,3 +1,3 @@', ' context', '-removed', '+added'].join('\n'),
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0].header).toBe('@@ -1,3 +1,3 @@');
    expect(hunks[0].oldStart).toBe(1);
    expect(hunks[0].oldCount).toBe(3);
    expect(hunks[0].newStart).toBe(1);
    expect(hunks[0].newCount).toBe(3);
    expect(hunks[0].lines).toEqual([
      { kind: 'context', content: 'context', oldNumber: 1, newNumber: 1 },
      { kind: 'removed', content: 'removed', oldNumber: 2, newNumber: null },
      { kind: 'added', content: 'added', oldNumber: null, newNumber: 2 },
    ]);
  });

  it('parses multiple hunks and defaults count to 1 when omitted (D2)', () => {
    const hunks = parseUnifiedDiff(
      ['@@ -1 +1 @@', '-a', '+b', '@@ -5,2 +5,2 @@', ' c', ' d'].join('\n'),
    );

    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toMatchObject({
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
    });
    expect(hunks[0].lines.map((line) => line.kind)).toEqual([
      'removed',
      'added',
    ]);
    expect(hunks[1]).toMatchObject({
      oldStart: 5,
      oldCount: 2,
      newStart: 5,
      newCount: 2,
    });
    expect(hunks[1].lines.map((line) => line.oldNumber)).toEqual([5, 6]);
    expect(hunks[1].lines.map((line) => line.newNumber)).toEqual([5, 6]);
  });

  it('turns the no-newline marker into a meta line without numbers or spurious lines (D3)', () => {
    const hunks = parseUnifiedDiff(
      ['@@ -1 +1 @@', '-old', '+new', '\\ No newline at end of file'].join(
        '\n',
      ),
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines).toHaveLength(3);
    expect(hunks[0].lines[0]).toEqual({
      kind: 'removed',
      content: 'old',
      oldNumber: 1,
      newNumber: null,
    });
    expect(hunks[0].lines[1]).toEqual({
      kind: 'added',
      content: 'new',
      oldNumber: null,
      newNumber: 1,
    });
    expect(hunks[0].lines[2]).toEqual({
      kind: 'meta',
      content: '\\ No newline at end of file',
      oldNumber: null,
      newNumber: null,
    });
  });

  it('defaults the count to 1 independently on each side when omitted (D2)', () => {
    const added = parseUnifiedDiff(
      ['@@ -1 +1,3 @@', '+a', '+b', '+c'].join('\n'),
    );
    expect(added[0]).toMatchObject({
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 3,
    });
    expect(added[0].lines.map((line) => line.newNumber)).toEqual([1, 2, 3]);

    const removed = parseUnifiedDiff(
      ['@@ -1,3 +1 @@', '-a', '-b', '-c'].join('\n'),
    );
    expect(removed[0]).toMatchObject({
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 1,
    });
    expect(removed[0].lines.map((line) => line.oldNumber)).toEqual([1, 2, 3]);
    expect(removed[0].lines.map((line) => line.newNumber)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('parses an added-file hunk (-0,0) numbering the new lines (D1)', () => {
    const hunks = parseUnifiedDiff(
      ['@@ -0,0 +1,2 @@', '+first', '+second'].join('\n'),
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: 2,
    });
    expect(hunks[0].lines).toEqual([
      { kind: 'added', content: 'first', oldNumber: null, newNumber: 1 },
      { kind: 'added', content: 'second', oldNumber: null, newNumber: 2 },
    ]);
  });

  it('parses a deleted-file hunk (+0,0) numbering the old lines (D1)', () => {
    const hunks = parseUnifiedDiff(
      ['@@ -1,2 +0,0 @@', '-first', '-second'].join('\n'),
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({
      oldStart: 1,
      oldCount: 2,
      newStart: 0,
      newCount: 0,
    });
    expect(hunks[0].lines).toEqual([
      { kind: 'removed', content: 'first', oldNumber: 1, newNumber: null },
      { kind: 'removed', content: 'second', oldNumber: 2, newNumber: null },
    ]);
  });

  it('recognizes a hunk header with trailing function context', () => {
    const hunks = parseUnifiedDiff(
      ['@@ -10,2 +10,2 @@ function foo() {', '-a', '+b'].join('\n'),
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0].header).toBe('@@ -10,2 +10,2 @@ function foo() {');
    expect(hunks[0].lines.map((line) => line.kind)).toEqual([
      'removed',
      'added',
    ]);
  });

  it('returns a hunk with no body lines when the patch only has the header', () => {
    const hunks = parseUnifiedDiff('@@ -1,2 +1,2 @@');

    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines).toEqual([]);
  });

  it('returns [] for a rename-only preamble without hunks (D5)', () => {
    expect(
      parseUnifiedDiff(
        ['diff --git a/x b/y', 'similarity index 100%', 'rename from x', 'rename to y'].join(
          '\n',
        ),
      ),
    ).toEqual([]);
  });

  it('does not throw on unexpected headers or non-textual content (D5)', () => {
    expect(() => parseUnifiedDiff('random\nnot a diff\n')).not.toThrow();
    expect(parseUnifiedDiff('random\nnot a diff\n')).toEqual([]);

    expect(() =>
      parseUnifiedDiff(
        [
          'diff --git a/x b/x',
          'index 000000..111111 100644',
          '--- a/x',
          '+++ b/x',
          '@@ -1 +1 @@',
          '?bogus',
          '\\ No newline at end of file',
        ].join('\n'),
      ),
    ).not.toThrow();
  });
});
