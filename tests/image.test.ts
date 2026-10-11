import { describe, expect, it } from 'vitest';
import { crop, opaqueBounds, removeBackground } from '../src/lib/image';

function img(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}

describe('removeBackground', () => {
  it('clears the white background but keeps white enclosed by the character', () => {
    // 白背景に黒い枠の四角、その内側は白
    const src = img(20, 20, (x, y) => {
      const inSquare = x >= 5 && x < 15 && y >= 5 && y < 15;
      const border = inSquare && (x === 5 || x === 14 || y === 5 || y === 14);
      return border ? [0, 0, 0, 255] : [255, 255, 255, 255];
    });
    const out = removeBackground(src, 30);
    const a = (x: number, y: number) => out.data[(y * 20 + x) * 4 + 3];
    expect(a(0, 0)).toBe(0);
    expect(a(19, 10)).toBe(0);
    expect(a(10, 10)).toBe(255); // 枠の内側の白は残る
    expect(a(5, 5)).toBe(255);
  });

  it('leaves already-transparent images alone', () => {
    const src = img(4, 4, () => [255, 255, 255, 0]);
    expect(removeBackground(src, 30).data).toEqual(src.data);
  });
});

describe('bounds / crop', () => {
  it('finds the opaque bounding box and crops to it', () => {
    const src = img(10, 8, (x, y) => (x >= 2 && x <= 6 && y >= 3 && y <= 4 ? [1, 2, 3, 255] : [0, 0, 0, 0]));
    const b = opaqueBounds(src)!;
    expect(b).toEqual({ x: 2, y: 3, w: 5, h: 2 });
    const c = crop(src, b);
    expect([c.width, c.height]).toEqual([5, 2]);
    expect(Array.from(c.data.slice(0, 4))).toEqual([1, 2, 3, 255]);
  });
});
