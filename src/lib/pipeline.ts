import JSZip from 'jszip';
import { type EncodeResult, encodeApng, encodePng } from './apng';
import { type Rgba, crop, hasTransparency, opaqueBounds, removeBackground } from './image';
import { FONT_FAMILY, type SceneSettings, type SourceImage, renderFrame } from './render';
import { LINE_SPEC, type TimingSettings, frameDelays } from './spec';

/** 読み込み時にこれより大きい画像は縮小する（処理を軽くするため） */
const MAX_SOURCE_SIDE = 1024;

export function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D が使えません');
  return { canvas, ctx };
}

export async function loadImageFile(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const s = Math.min(1, MAX_SOURCE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s));
    const h = Math.max(1, Math.round(img.naturalHeight * s));
    const { ctx } = makeCanvas(w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isTransparent(img: ImageData): boolean {
  return hasTransparency(img);
}

/** 背景除去と余白の切り抜きをして、描画に使う画像を作る */
export function prepareSource(img: ImageData, removeBg: boolean, tolerance: number): SourceImage {
  let rgba: Rgba = { data: img.data, width: img.width, height: img.height };
  if (removeBg) rgba = removeBackground(rgba, tolerance);
  const bounds = opaqueBounds(rgba);
  if (bounds) rgba = crop(rgba, bounds);
  const { canvas, ctx } = makeCanvas(rgba.width, rgba.height);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height), 0, 0);
  return { image: canvas, width: rgba.width, height: rgba.height };
}

export async function ensureFonts(scene: SceneSettings) {
  if (!scene.text.content.trim() || !document.fonts) return;
  try {
    await document.fonts.load(`800 40px ${FONT_FAMILY}`, scene.text.content);
  } catch {
    // フォントが読めなくても代替フォントで描画できるので無視
  }
}

export function renderFrames(src: SourceImage, scene: SceneSettings, frames: number, w: number, h: number) {
  const { ctx } = makeCanvas(w, h);
  const out: ArrayBuffer[] = [];
  for (let i = 0; i < frames; i++) {
    ctx.clearRect(0, 0, w, h);
    renderFrame(ctx, src, scene, i / frames, w, h);
    out.push(ctx.getImageData(0, 0, w, h).data.buffer as ArrayBuffer);
  }
  return out;
}

export interface BuiltApng extends EncodeResult {
  url: string;
  width: number;
  height: number;
  timing: TimingSettings;
}

export async function buildApng(
  src: SourceImage,
  scene: SceneSettings,
  timing: TimingSettings,
  w: number,
  h: number,
): Promise<BuiltApng> {
  await ensureFonts(scene);
  const frames = renderFrames(src, scene, timing.frames, w, h);
  const res = encodeApng(frames, w, h, frameDelays(timing), timing.loops);
  const url = URL.createObjectURL(new Blob([res.data], { type: 'image/png' }));
  return { ...res, url, width: w, height: h, timing };
}

/** タブ画像：動きと飾りを外した静止画 */
export async function buildTab(src: SourceImage, scene: SceneSettings): Promise<ArrayBuffer> {
  await ensureFonts(scene);
  const { width: w, height: h } = LINE_SPEC.tab;
  const { ctx } = makeCanvas(w, h);
  const still: SceneSettings = {
    ...scene,
    layers: [],
    effects: [],
    text: { ...scene.text, content: '' },
    layout: { padding: 6, zoom: 1, autoFit: false },
  };
  renderFrame(ctx, src, still, 0, w, h);
  return encodePng(ctx.getImageData(0, 0, w, h).data.buffer as ArrayBuffer, w, h);
}

export interface ZipEntry {
  name: string;
  data: ArrayBuffer;
}

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const zip = new JSZip();
  for (const e of entries) zip.file(e.name, e.data);
  return zip.generateAsync({ type: 'blob' });
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));
