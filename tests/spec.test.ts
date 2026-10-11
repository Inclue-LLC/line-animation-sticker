import { describe, expect, it } from 'vitest';
import { allowedLoopsFor, checkStickerSize, frameDelays, isValidTiming } from '../src/lib/spec';

describe('timing', () => {
  it('splits a loop into integer ms delays that sum exactly', () => {
    for (const totalSeconds of [1, 2, 3, 4]) {
      for (const loops of allowedLoopsFor(totalSeconds)) {
        for (let frames = 5; frames <= 20; frames++) {
          const d = frameDelays({ frames, totalSeconds, loops });
          expect(d).toHaveLength(frames);
          expect(d.reduce((a, b) => a + b, 0) * loops).toBe(totalSeconds * 1000);
          expect(Math.max(...d) - Math.min(...d)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('only allows loop counts that give whole-ms loops', () => {
    expect(allowedLoopsFor(1)).toEqual([1, 2, 4]);
    expect(allowedLoopsFor(3)).toEqual([1, 2, 3, 4]);
    expect(isValidTiming({ frames: 10, totalSeconds: 1, loops: 3 })).toBe(false);
    expect(isValidTiming({ frames: 4, totalSeconds: 2, loops: 1 })).toBe(false);
    expect(isValidTiming({ frames: 21, totalSeconds: 2, loops: 1 })).toBe(false);
    expect(isValidTiming({ frames: 20, totalSeconds: 5, loops: 1 })).toBe(false);
    expect(isValidTiming({ frames: 12, totalSeconds: 2, loops: 2 })).toBe(true);
  });
});

describe('size', () => {
  it('accepts 320x270 and rejects oversize / undersize', () => {
    expect(checkStickerSize(320, 270)).toEqual([]);
    expect(checkStickerSize(270, 200)).toEqual([]);
    expect(checkStickerSize(321, 270).length).toBe(1);
    expect(checkStickerSize(200, 200).length).toBe(1);
  });
});
