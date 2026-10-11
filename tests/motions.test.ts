import { describe, expect, it } from 'vitest';
import { apply } from '../src/lib/affine';
import { MOTIONS, composeMotion } from '../src/lib/motions';

const box = { x: 60, y: 20, w: 200, h: 230 };

function corners(t: number, layers: Parameters<typeof composeMotion>[0]) {
  const { matrix, opacity } = composeMotion(layers, t, box);
  return {
    pts: [
      apply(matrix, box.x, box.y),
      apply(matrix, box.x + box.w, box.y + box.h),
    ].flat(),
    opacity,
  };
}

describe('motions', () => {
  it('looping motions return to the start pose at t=1 so loops are seamless', () => {
    // flash（点滅）はわざと不連続なステップ関数なので対象外
    for (const m of MOTIONS.filter((m) => !m.oneShot && m.id !== 'flash')) {
      for (const cycles of [1, 2, 3]) {
        const layers = [{ id: m.id, amp: 1, cycles }];
        const a = corners(0, layers);
        const b = corners(1 - 1e-9, layers);
        a.pts.forEach((v, i) => expect(b.pts[i]).toBeCloseTo(v, 1));
      }
    }
  });

  it('one-shot motions end at the rest pose', () => {
    for (const m of MOTIONS.filter((m) => m.oneShot)) {
      const r = corners(0.95, [{ id: m.id, amp: 1, cycles: 3 }]);
      expect(r.opacity).toBeCloseTo(1);
      expect(r.pts).toEqual([box.x, box.y, box.x + box.w, box.y + box.h].map((v) => expect.closeTo(v, 5)));
    }
  });

  it('bottom-pivot motions keep the feet in place when not translating', () => {
    const { matrix } = composeMotion([{ id: 'swing', amp: 1, cycles: 1 }], 0.25, box);
    const [x, y] = apply(matrix, box.x + box.w / 2, box.y + box.h);
    expect(x).toBeCloseTo(box.x + box.w / 2);
    expect(y).toBeCloseTo(box.y + box.h);
  });

  it('no layers means identity', () => {
    const r = corners(0.3, []);
    expect(r.pts).toEqual([box.x, box.y, box.x + box.w, box.y + box.h]);
    expect(r.opacity).toBe(1);
  });
});
