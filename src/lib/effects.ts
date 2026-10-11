/** イラストのまわりに重ねる飾り。t は 0〜1 で、t=0 と t=1 が同じ見た目になる（ループが自然につながる） */
export type EffectId = 'sparkle' | 'heart' | 'sweat' | 'anger' | 'note';

export interface EffectDef {
  id: EffectId;
  label: string;
  emoji: string;
}

export const EFFECTS: EffectDef[] = [
  { id: 'sparkle', label: 'キラキラ', emoji: '✨' },
  { id: 'heart', label: 'ハート', emoji: '💕' },
  { id: 'sweat', label: 'あせ', emoji: '💦' },
  { id: 'anger', label: 'ぷんぷん', emoji: '💢' },
  { id: 'note', label: '音符', emoji: '🎵' },
];

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const TAU = Math.PI * 2;

function outlined(ctx: Ctx, fill: string, lineWidth: number) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function star(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.28;
    const a = (i / 8) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function heart(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
}

function drop(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 0.4, x + s * 0.65, y, x + s * 0.65, y + s * 0.35);
  ctx.arc(x, y + s * 0.35, s * 0.65, 0, Math.PI);
  ctx.bezierCurveTo(x - s * 0.65, y, x - s * 0.2, y - s * 0.4, x, y - s);
  ctx.closePath();
}

function angerMark(ctx: Ctx, x: number, y: number, s: number) {
  // 4つの角が向かい合う「💢」型
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const cx = x + Math.cos(a) * s * 0.55;
    const cy = y + Math.sin(a) * s * 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.42, a + Math.PI - 0.9, a + Math.PI + 0.9);
    ctx.lineWidth = s * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.lineWidth = s * 0.24;
    ctx.strokeStyle = '#e8384f';
    ctx.stroke();
  }
}

function musicNote(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.42, s * 0.3, -0.4, 0, TAU);
  ctx.rect(x + s * 0.3, y - s * 1.3, s * 0.14, s * 1.3);
  ctx.moveTo(x + s * 0.44, y - s * 1.3);
  ctx.quadraticCurveTo(x + s * 0.95, y - s * 1.0, x + s * 0.85, y - s * 0.55);
  ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.95, x + s * 0.44, y - s * 1.0);
  ctx.closePath();
}

/** 画像サイズ (w, h) のキャンバス全体に飾りを描く */
export function drawEffect(ctx: Ctx, id: EffectId, t: number, w: number, h: number) {
  const u = Math.min(w, h);
  ctx.save();
  switch (id) {
    case 'sparkle': {
      const spots = [
        [0.12, 0.2, 0],
        [0.88, 0.16, 0.25],
        [0.9, 0.7, 0.5],
        [0.1, 0.75, 0.75],
      ];
      for (const [px, py, ph] of spots) {
        const v = Math.max(0, Math.sin(TAU * (t + ph)));
        if (v <= 0.02) continue;
        star(ctx, px * w, py * h, u * 0.09 * v);
        outlined(ctx, '#ffd23f', u * 0.02);
      }
      break;
    }
    case 'heart': {
      const lanes = [
        [0.14, 0],
        [0.86, 0.33],
        [0.78, 0.66],
      ];
      for (const [px, ph] of lanes) {
        const p = (t + ph) % 1;
        const y = h * (0.95 - p * 0.85);
        const x = w * px + Math.sin(TAU * p * 2) * u * 0.03;
        ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * p) * 2);
        heart(ctx, x, y, u * 0.075);
        outlined(ctx, '#ff5c8a', u * 0.02);
      }
      break;
    }
    case 'sweat': {
      const p = t % 1;
      const x = w * 0.84;
      const y = h * (0.12 + p * 0.22);
      ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * p) * 2.5);
      drop(ctx, x, y, u * 0.07);
      outlined(ctx, '#5cc8ff', u * 0.02);
      drop(ctx, x - u * 0.09, y + u * 0.06, u * 0.045);
      outlined(ctx, '#5cc8ff', u * 0.016);
      break;
    }
    case 'anger': {
      const pulse = 1 + 0.18 * Math.max(0, Math.sin(TAU * 2 * t));
      angerMark(ctx, w * 0.85, h * 0.17, u * 0.09 * pulse);
      break;
    }
    case 'note': {
      const lanes = [
        [0.12, 0],
        [0.88, 0.5],
      ];
      for (const [px, ph] of lanes) {
        const p = (t + ph) % 1;
        const x = w * px + Math.sin(TAU * p) * u * 0.04;
        const y = h * (0.6 - p * 0.45);
        ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * p) * 2);
        musicNote(ctx, x, y, u * 0.09);
        outlined(ctx, '#7a5cff', u * 0.022);
      }
      break;
    }
  }
  ctx.restore();
}
