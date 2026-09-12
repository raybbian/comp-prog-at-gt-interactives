import { describe, expect, it } from 'vitest';
import {
  MAX_SNIPPET_COLUMNS,
  MAX_SNIPPET_LINES,
  QUESTIONS,
  questionById,
  widestLine,
} from './questions.ts';

describe('the question table', () => {
  it('is numbered, in order, with unique ids', () => {
    QUESTIONS.forEach((question, i) => {
      expect(question.index, question.id).toBe(i);
      expect(questionById(question.id)).toBe(question);
    });
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });

  it('opens with a warm-up and counts everything after it', () => {
    expect(QUESTIONS[0]?.counts).toBe(false);
    for (const question of QUESTIONS.slice(1)) {
      expect(question.counts, question.id).toBe(true);
    }
  });

  /**
   * The size limits are the difference between a snippet a team debugs and one they pan
   * around. A phone is 390 points wide; sixty-four columns of 13px JetBrains Mono is about
   * 330 of them, and sixteen lines is what is left above the answer boxes.
   */
  it('keeps every snippet readable on a phone', () => {
    for (const question of QUESTIONS) {
      const lines = question.code.split('\n');
      expect(lines.length, `${question.id} lines`).toBeLessThanOrEqual(MAX_SNIPPET_LINES);
      expect(widestLine(question.code), `${question.id} columns`).toBeLessThanOrEqual(
        MAX_SNIPPET_COLUMNS,
      );
    }
  });

  it('lands flush left, with no tabs and no trailing blank lines', () => {
    for (const question of QUESTIONS) {
      const lines = question.code.split('\n');
      expect(question.code, question.id).not.toContain('\t');
      expect(lines[0]?.startsWith(' '), `${question.id} first line`).toBe(false);
      expect(lines.at(-1)?.trim().length, `${question.id} last line`).toBeGreaterThan(0);
    }
  });

  /**
   * The snippets are broken on purpose, and the intent line is the only thing that makes
   * "wrong" meaningful — you cannot call a loop bound wrong without knowing what it was for.
   * It must say what the code is *for* and never what it does instead, which is the line
   * between a specification and a hint.
   */
  it('says what each snippet is meant to do without hinting at the bugs', () => {
    for (const question of QUESTIONS) {
      expect(question.intent.length, question.id).toBeGreaterThan(10);
      for (const tell of ['bug', 'wrong', 'should', 'instead', 'overflow', 'off by', 'careful']) {
        expect(question.intent.toLowerCase(), `${question.id}: ${tell}`).not.toContain(tell);
      }
    }
  });
});
