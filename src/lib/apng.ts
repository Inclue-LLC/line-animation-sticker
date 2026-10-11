import UPNG from 'upng-js';
import { LINE_SPEC } from './spec';

/** 試す色数の順番。0 は可逆（減色なし） */
export const COLOR_STEPS = [0, 256, 192, 128, 96, 64, 48, 32] as const;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * acTL チャンクの num_plays（ループ回数）を書き換える。
 * UPNG は常に 0（無限ループ）で書き出すが、LINE は 1〜4 回の指定が必要。
 */
export function setLoopCount(png: ArrayBuffer, loops: number): ArrayBuffer {
  const bytes = new Uint8Array(png.slice(0));
  const view = new DataView(bytes.buffer);
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    if (type === 'acTL') {
      view.setUint32(off + 12, loops);
      view.setUint32(off + 8 + len, crc32(bytes, off + 4, off + 8 + len));
      return bytes.buffer;
    }
    if (type === 'IDAT' || type === 'IEND') break;
    off += 12 + len;
  }
  throw new Error('acTL chunk not found (not an animated PNG)');
}

export interface EncodeResult {
  data: ArrayBuffer;
  /** 0 = 減色なし */
  colors: number;
  bytes: number;
  withinLimit: boolean;
}

/**
 * RGBA フレーム列を APNG にする。300KB を超える場合は色数を段階的に減らして収める。
 * どうしても収まらない場合は最も小さい結果を withinLimit=false で返す。
 */
export function encodeApng(
  frames: ArrayBuffer[],
  width: number,
  height: number,
  delays: number[],
  loops: number,
  maxBytes: number = LINE_SPEC.maxFileBytes,
): EncodeResult {
  if (frames.length !== delays.length) throw new Error('frames and delays length mismatch');
  let best: EncodeResult | null = null;
  for (const colors of COLOR_STEPS) {
    // UPNG は入力バッファを書き換えることがあるのでコピーを渡す
    const raw = UPNG.encode(
      frames.map((f) => f.slice(0)),
      width,
      height,
      colors,
      delays,
    );
    const data = setLoopCount(raw, loops);
    const result = { data, colors, bytes: data.byteLength, withinLimit: data.byteLength <= maxBytes };
    if (result.withinLimit) return result;
    if (!best || result.bytes < best.bytes) best = result;
  }
  return best!;
}

/** 静止画 PNG（タブ画像用） */
export function encodePng(frame: ArrayBuffer, width: number, height: number): ArrayBuffer {
  return UPNG.encode([frame.slice(0)], width, height, 0);
}

export interface ApngInfo {
  width: number;
  height: number;
  frames: number;
  loops: number;
  /** 1ループの長さ（ms） */
  loopMs: number;
}

/** 書き出したファイルを読み直して仕様確認に使う */
export function inspectApng(data: ArrayBuffer): ApngInfo {
  const img = UPNG.decode(data);
  const actl = img.tabs.acTL;
  return {
    width: img.width,
    height: img.height,
    frames: actl?.num_frames ?? 1,
    loops: actl?.num_plays ?? 0,
    loopMs: img.frames.reduce((s, f) => s + f.delay, 0),
  };
}

export function decodeFrames(data: ArrayBuffer): ArrayBuffer[] {
  return UPNG.toRGBA8(UPNG.decode(data));
}
