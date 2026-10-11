import { type EffectId, drawEffect } from './effects';
import { apply } from './affine';
import { type Box, MOTION_MAP, type MotionLayer, composeMotion } from './motions';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface TextSettings {
  content: string;
  position: 'top' | 'bottom';
  color: string;
  /** 270px 高さ基準のフォントサイズ */
  size: number;
  /** 文字もイラストと一緒に動かすか */
  followMotion: boolean;
}

export interface LayoutSettings {
  /** 外周の余白（270px 高さ基準） */
  padding: number;
  /** 余白内に収めたときに対する拡大率 0.3〜1 */
  zoom: number;
  /** 動いたときに余白からはみ出さないよう自動で縮小する */
  autoFit: boolean;
}

export interface SceneSettings {
  layers: MotionLayer[];
  effects: EffectId[];
  layout: LayoutSettings;
  text: TextSettings;
}

export const FONT_FAMILY = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';

export interface SourceImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

function textLines(text: TextSettings): string[] {
  const content = text.content.trim();
  return content ? content.split('\n').map((l) => l.trim()) : [];
}

/** 出力サイズ (w, h) にイラストを置く位置を求める */
export function layoutImage(src: { width: number; height: number }, scene: SceneSettings, w: number, h: number) {
  const k = h / 270;
  const pad = scene.layout.padding * k;
  const lines = textLines(scene.text);
  const band = lines.length ? scene.text.size * k * 1.15 * lines.length + pad * 0.3 : 0;
  const areaX = pad;
  const areaY = pad + (scene.text.position === 'top' ? band : 0);
  const areaW = Math.max(1, w - pad * 2);
  const areaH = Math.max(1, h - pad * 2 - band);
  const fit = Math.min(areaW / src.width, areaH / src.height) * scene.layout.zoom;
  const iw = src.width * fit;
  const ih = src.height * fit;
  let box: Box = { x: areaX + (areaW - iw) / 2, y: areaY + (areaH - ih) / 2, w: iw, h: ih };
  if (scene.layout.autoFit) {
    const area = { x: areaX, y: areaY, w: areaW, h: areaH };
    const layers = scene.layers.filter((l) => !MOTION_MAP[l.id]?.offscreen);
    // 動きの量は箱の大きさに比例するので、数回縮めれば収束する
    for (let i = 0; i < 4; i++) {
      const s = fitRatio(layers, box, area);
      if (s >= 0.999) break;
      box = shrink(box, s * 0.995, area);
    }
  }
  return { box, band, pad, k, lines };
}

const FIT_SAMPLES = 40;

/** 全フレームでの外接矩形が area に収まるための縮小率（1 なら収まっている） */
function fitRatio(layers: MotionLayer[], box: Box, area: Box): number {
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  let ratio = 1;
  for (let i = 0; i < FIT_SAMPLES; i++) {
    const { matrix, opacity } = composeMotion(layers, i / FIT_SAMPLES, box);
    if (opacity < 0.05) continue;
    for (const [x, y] of [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x, box.y + box.h],
      [box.x + box.w, box.y + box.h],
    ]) {
      const [px, py] = apply(matrix, x, y);
      // 中心からの距離で、はみ出している方向の比率を求める
      if (px < area.x) ratio = Math.min(ratio, (cx - area.x) / (cx - px));
      if (px > area.x + area.w) ratio = Math.min(ratio, (area.x + area.w - cx) / (px - cx));
      if (py < area.y) ratio = Math.min(ratio, (cy - area.y) / (cy - py));
      if (py > area.y + area.h) ratio = Math.min(ratio, (area.y + area.h - cy) / (py - cy));
    }
  }
  return ratio;
}

function shrink(box: Box, s: number, area: Box): Box {
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  return { x: cx + (box.x - cx) * s, y: cy + (box.y - cy) * s, w: box.w * s, h: box.h * s };
}

/** t（0〜1）時点の 1 フレームを描く。キャンバスは事前にクリアしておくこと */
export function renderFrame(ctx: Ctx2D, src: SourceImage, scene: SceneSettings, t: number, w: number, h: number) {
  const { box, band, pad, k, lines } = layoutImage(src, scene, w, h);
  const { matrix, opacity } = composeMotion(scene.layers, t, box);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(...matrix);
  ctx.globalAlpha = opacity;
  ctx.drawImage(src.image, box.x, box.y, box.w, box.h);
  ctx.restore();

  if (lines.length) {
    ctx.save();
    if (scene.text.followMotion) {
      ctx.setTransform(...matrix);
      ctx.globalAlpha = opacity;
    }
    let size = scene.text.size * k;
    ctx.font = `800 ${size}px ${FONT_FAMILY}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const maxW = w - pad * 2;
    if (widest > maxW) {
      size *= maxW / widest;
      ctx.font = `800 ${size}px ${FONT_FAMILY}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const lineH = size * 1.15;
    const top = scene.text.position === 'top' ? pad : h - pad - band;
    lines.forEach((line, i) => {
      const y = top + lineH * (i + 0.5);
      ctx.lineWidth = Math.max(2, size * 0.24);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(line, w / 2, y);
      ctx.fillStyle = scene.text.color;
      ctx.fillText(line, w / 2, y);
    });
    ctx.restore();
  }

  for (const e of scene.effects) drawEffect(ctx, e, t, w, h);
}
