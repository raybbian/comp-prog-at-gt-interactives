import { describe, expect, it } from 'vitest';
import { BLOCK, isDropped } from './drops.ts';

const TEAMS = Array.from({ length: 20 }, (_, i) => `t_${i}`);
const RATE = 0.2;

const dropsFor = (team: string, count: number, rate = RATE): boolean[] =>
  Array.from({ length: count }, (_, i) => isDropped('seed', team, 'sender', i, rate));

describe('the lossy channel', () => {
  it('costs every team exactly the same number of messages', () => {
    for (const blocks of [1, 2, 5]) {
      const counts = TEAMS.map(
        (team) => dropsFor(team, BLOCK * blocks).filter(Boolean).length,
      );
      expect(new Set(counts).size, `blocks=${blocks}`).toBe(1);
      expect(counts[0]).toBe(Math.round(BLOCK * RATE) * blocks);
    }
  });

  it('drops different messages for different teams', () => {
    const patterns = new Set(TEAMS.map((team) => dropsFor(team, BLOCK).join('')));
    // If every team lost the same positions, one team's phone would predict another's.
    expect(patterns.size).toBeGreaterThan(TEAMS.length / 2);
  });

  it('is a pure function, so a replay agrees with the live verdict', () => {
    for (const team of TEAMS) {
      expect(dropsFor(team, 40).join('')).toBe(dropsFor(team, 40).join(''));
    }
  });

  it('keeps the two directions on separate schedules', () => {
    // A chatty receiver must not be able to shift what the sender loses.
    const sender = Array.from({ length: 40 }, (_, i) =>
      isDropped('seed', 't_0', 'sender', i, RATE),
    ).join('');
    const receiver = Array.from({ length: 40 }, (_, i) =>
      isDropped('seed', 't_0', 'receiver', i, RATE),
    ).join('');
    expect(sender).not.toBe(receiver);
  });

  it('drops nothing at all when the round is not lossy', () => {
    for (const team of TEAMS) {
      expect(dropsFor(team, 50, 0).some(Boolean)).toBe(false);
    }
  });

  it('changes the schedule from one round to the next', () => {
    const a = Array.from({ length: BLOCK }, (_, i) => isDropped('r5', 't_0', 'sender', i, RATE));
    const b = Array.from({ length: BLOCK }, (_, i) => isDropped('r9', 't_0', 'sender', i, RATE));
    expect(a.join('')).not.toBe(b.join(''));
  });
});
