import { describe, expect, it } from 'vitest';
import { apply } from '../src/lib/affine';
import { MOTIONS, composeMotion } from '../src/lib/motions';
import { type SceneSettings, layoutImage } from '../src/lib/render';

const scene = (id: (typeof MOTIONS)[number]['id']): SceneSettings => ({
  layers: [{ id, amp: 2, cycles: 1 }],
  effects: [],
  layout: { padding: 10, zoom: 1, autoFit: true },
  text: { content: '', position: 'bottom', color: '#000', size: 40, followMotion: false },
});

describe('autoFit', () => {
  it('keeps every on-screen motion inside the padded area at max strength', () => {
    for (const m of MOTIONS.filter((m) => !m.offscreen)) {
      const s = scene(m.id);
      const { box } = layoutImage({ width: 300, height: 400 }, s, 320, 270);
      for (let i = 0; i < 20; i++) {
        const { matrix, opacity } = composeMotion(s.layers, i / 20, box);
        if (opacity < 0.05) continue;
        for (const [x, y] of [[box.x, box.y], [box.x + box.w, box.y + box.h], [box.x + box.w, box.y], [box.x, box.y + box.h]]) {
          const [px, py] = apply(matrix, x, y);
          expect(px, m.id).toBeGreaterThanOrEqual(10 - 0.5);
          expect(px, m.id).toBeLessThanOrEqual(310 + 0.5);
          expect(py, m.id).toBeGreaterThanOrEqual(10 - 0.5);
          expect(py, m.id).toBeLessThanOrEqual(260 + 0.5);
        }
      }
    }
  });
});
