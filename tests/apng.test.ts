import { describe, expect, it } from 'vitest';
import { decodeFrames, encodeApng, encodePng, inspectApng } from '../src/lib/apng';
import { frameDelays } from '../src/lib/spec';

const W = 320;
const H = 270;

/** 透明背景の上を色付きの円が動くテスト用フレーム */
function makeFrames(n: number, noisy = false): ArrayBuffer[] {
  const frames: ArrayBuffer[] = [];
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let f = 0; f < n; f++) {
    const d = new Uint8ClampedArray(W * H * 4);
    const cx = 60 + f * 10;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = Math.hypot(x - cx, y - 135);
        if (r < 70) {
          d[i] = noisy ? rnd() * 255 : 255;
          d[i + 1] = noisy ? rnd() * 255 : (x * 2) & 255;
          d[i + 2] = noisy ? rnd() * 255 : f * 12;
          d[i + 3] = r > 68 ? 128 : 255;
        }
      }
    }
    frames.push(d.buffer);
  }
  return frames;
}

describe('encodeApng', () => {
  it('writes the requested frame count, loop count and timing, and decodes back losslessly', () => {
    const frames = makeFrames(12);
    const timing = { frames: 12, totalSeconds: 2, loops: 2 };
    const res = encodeApng(frames, W, H, frameDelays(timing), timing.loops);
    expect(res.withinLimit).toBe(true);
    expect(res.colors).toBe(0);
    const info = inspectApng(res.data);
    expect(info).toEqual({ width: W, height: H, frames: 12, loops: 2, loopMs: 1000 });

    const decoded = decodeFrames(res.data);
    expect(decoded).toHaveLength(12);
    let mismatches = 0;
    for (let f = 0; f < 12; f++) {
      const a = new Uint8Array(frames[f]);
      const b = new Uint8Array(decoded[f]);
      for (let i = 0; i < a.length; i += 4) {
        if (b[i + 3] !== a[i + 3]) mismatches++;
        else if (a[i + 3] === 255 && (b[i] !== a[i] || b[i + 1] !== a[i + 1] || b[i + 2] !== a[i + 2])) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });

  it('reduces colours to fit under the size limit', () => {
    const frames = makeFrames(20, true);
    const timing = { frames: 20, totalSeconds: 4, loops: 1 };
    const res = encodeApng(frames, W, H, frameDelays(timing), 1, 300 * 1024);
    // ノイズ画像は可逆だと上限を超えるので、減色されているはず
    expect(res.colors).not.toBe(0);
    expect(res.bytes).toBe(res.data.byteLength);
    expect(inspectApng(res.data).frames).toBe(20);
  });

  it('encodes a still PNG for the tab image', () => {
    const png = encodePng(makeFrames(1)[0].slice(0, 96 * 74 * 4), 96, 74);
    const info = inspectApng(png);
    expect([info.width, info.height, info.frames]).toEqual([96, 74, 1]);
  });
});
