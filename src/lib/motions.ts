import { type Mat, identity, mul, rotate, scale, translate } from './affine';

/**
 * ある瞬間の姿勢。x / y はイラストの幅・高さに対する割合、rotate はラジアン。
 * 省略した値は「変化なし」として扱う。
 */
export interface Pose {
  x?: number;
  y?: number;
  rotate?: number;
  sx?: number;
  sy?: number;
  opacity?: number;
}

export type Pivot = 'center' | 'bottom';

export type MotionId =
  | 'bounce'
  | 'float'
  | 'swing'
  | 'shake'
  | 'spin'
  | 'heartbeat'
  | 'jelly'
  | 'bow'
  | 'waddle'
  | 'peek'
  | 'pop'
  | 'slide'
  | 'fade'
  | 'flash';

export interface MotionDef {
  id: MotionId;
  label: string;
  emoji: string;
  description: string;
  pivot: Pivot;
  /**
   * 登場系の動き（ループの最初に一度だけ起きる）。
   * 速さ（周期数）を上げても繰り返さない。
   */
  oneShot?: boolean;
  /** 画面外から出入りする動き。はみ出し防止の計算から外す */
  offscreen?: boolean;
  /** t は 0〜1（1周期）、amp は強さ 0〜2 */
  pose: (t: number, amp: number) => Pose;
}

const TAU = Math.PI * 2;
const deg = (d: number) => (d * Math.PI) / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (v: number) => 1 - Math.pow(1 - v, 3);
const easeInCubic = (v: number) => v * v * v;
function easeOutBack(v: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
}
/** 周期 1 でつながるガウス型の山（t=0 と t=1 で同じ値になる） */
function bump(t: number, center: number, width: number): number {
  const d = Math.abs(t - center) % 1;
  return Math.exp(-Math.pow(Math.min(d, 1 - d) / width, 2));
}

export const MOTIONS: MotionDef[] = [
  {
    id: 'bounce',
    label: 'ぴょんぴょん',
    emoji: '🐰',
    description: '跳ねる。着地でむにっとつぶれる',
    pivot: 'bottom',
    pose: (t, a) => {
      const h = Math.sin(Math.PI * t); // 0 → 1 → 0
      const squash = Math.pow(1 - h, 8); // 着地の瞬間だけ 1 に近い
      return {
        y: -0.18 * a * h,
        sx: 1 + 0.12 * a * squash - 0.04 * a * h,
        sy: 1 - 0.12 * a * squash + 0.06 * a * h,
      };
    },
  },
  {
    id: 'float',
    label: 'ふわふわ',
    emoji: '🎈',
    description: '上下にゆっくり浮かぶ',
    pivot: 'center',
    pose: (t, a) => ({ y: -0.06 * a * Math.sin(TAU * t), rotate: deg(3 * a) * Math.sin(TAU * t + Math.PI / 2) }),
  },
  {
    id: 'swing',
    label: 'ゆらゆら',
    emoji: '🌿',
    description: '足元を支点に左右に揺れる',
    pivot: 'bottom',
    pose: (t, a) => ({ rotate: deg(12 * a) * Math.sin(TAU * t) }),
  },
  {
    id: 'shake',
    label: 'ぶるぶる',
    emoji: '🥶',
    description: '小刻みに震える',
    pivot: 'center',
    pose: (t, a) => ({
      x: 0.035 * a * Math.sin(TAU * 4 * t),
      rotate: deg(3 * a) * Math.sin(TAU * 4 * t + 1),
    }),
  },
  {
    id: 'spin',
    label: 'くるくる',
    emoji: '🌀',
    description: '一回転する（強さを0.5未満にすると逆回転）',
    pivot: 'center',
    pose: (t, a) => ({ rotate: (a < 0.5 ? -1 : 1) * TAU * t }),
  },
  {
    id: 'heartbeat',
    label: 'どきどき',
    emoji: '💓',
    description: '鼓動のように2回ふくらむ',
    pivot: 'center',
    pose: (t, a) => {
      const beat = bump(t, 0.15, 0.07) + 0.7 * bump(t, 0.38, 0.07);
      const s = 1 + 0.14 * a * beat;
      return { sx: s, sy: s };
    },
  },
  {
    id: 'jelly',
    label: 'ぷにぷに',
    emoji: '🍮',
    description: '縦横に伸び縮みする',
    pivot: 'bottom',
    pose: (t, a) => {
      const s = Math.sin(TAU * t);
      return { sx: 1 + 0.1 * a * s, sy: 1 - 0.1 * a * s };
    },
  },
  {
    id: 'bow',
    label: 'ぺこり',
    emoji: '🙇',
    description: 'おじぎをする',
    pivot: 'bottom',
    pose: (t, a) => {
      // 0〜0.35 で倒れ、0.35〜0.6 キープ、0.6〜1 で戻る
      const v = t < 0.35 ? easeOutCubic(t / 0.35) : t < 0.6 ? 1 : 1 - easeOutCubic((t - 0.6) / 0.4);
      return { rotate: deg(-22 * a) * v, sy: 1 - 0.05 * a * v };
    },
  },
  {
    id: 'waddle',
    label: 'よちよち',
    emoji: '🐧',
    description: '左右に体を傾けながら歩く',
    pivot: 'bottom',
    pose: (t, a) => ({
      rotate: deg(9 * a) * Math.sin(TAU * t),
      y: -0.05 * a * Math.abs(Math.sin(TAU * t)),
    }),
  },
  {
    id: 'peek',
    label: 'ひょっこり',
    emoji: '👀',
    description: '下からひょこっと顔を出して引っ込む',
    pivot: 'bottom',
    offscreen: true,
    pose: (t, a) => {
      const depth = Math.min(1, 0.6 + 0.3 * a);
      let hidden: number;
      if (t < 0.3) hidden = 1 - easeOutBack(t / 0.3);
      else if (t < 0.75) hidden = 0;
      else hidden = easeInCubic((t - 0.75) / 0.25);
      return { y: hidden * depth * 1.1 };
    },
  },
  {
    id: 'pop',
    label: 'ポン！',
    emoji: '💥',
    description: '小さい状態から弾むように登場',
    pivot: 'center',
    oneShot: true,
    pose: (t, a) => {
      const v = t < 0.4 ? easeOutBack(t / 0.4) : 1;
      const s = Math.max(0, 1 + (v - 1) * Math.max(0.3, a));
      return { sx: s, sy: s, opacity: clamp01(t / 0.08) };
    },
  },
  {
    id: 'slide',
    label: 'スライドイン',
    emoji: '🏃',
    description: '横からすべり込んでくる',
    pivot: 'center',
    oneShot: true,
    offscreen: true,
    pose: (t, a) => {
      const v = t < 0.4 ? easeOutBack(t / 0.4) : 1;
      return { x: -(1 - v) * (0.6 + 0.6 * Math.min(1, a)), opacity: clamp01(t / 0.1) };
    },
  },
  {
    id: 'fade',
    label: 'じわっ',
    emoji: '🌫️',
    description: 'ふんわり浮かび上がる',
    pivot: 'center',
    oneShot: true,
    pose: (t, a) => ({ opacity: clamp01(t / 0.5), y: 0.05 * a * (1 - easeOutCubic(clamp01(t / 0.5))) }),
  },
  {
    id: 'flash',
    label: 'ちかちか',
    emoji: '✨',
    description: '点滅する',
    pivot: 'center',
    pose: (t, a) => ({ opacity: 1 - Math.min(0.9, 0.6 * a) * (t % 0.5 < 0.25 ? 0 : 1) }),
  },
];

export const MOTION_MAP: Record<MotionId, MotionDef> = Object.fromEntries(MOTIONS.map((m) => [m.id, m])) as Record<
  MotionId,
  MotionDef
>;

export interface MotionLayer {
  id: MotionId;
  /** 0〜2。1 が標準 */
  amp: number;
  /** 1ループ中に何周期動くか（整数なのでループの継ぎ目が自然につながる） */
  cycles: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 複数の動きを重ねた変換行列と不透明度を求める。
 * 先に並んでいる動きほど外側（後から適用）になる。
 */
export function composeMotion(layers: MotionLayer[], t: number, box: Box): { matrix: Mat; opacity: number } {
  let m = identity();
  let opacity = 1;
  for (const layer of layers) {
    const def = MOTION_MAP[layer.id];
    if (!def) continue;
    const local = def.oneShot ? t : (t * layer.cycles) % 1;
    const p = def.pose(local, layer.amp);
    const px = box.x + box.w / 2;
    const py = def.pivot === 'bottom' ? box.y + box.h : box.y + box.h / 2;
    let lm = translate(px + (p.x ?? 0) * box.w, py + (p.y ?? 0) * box.h);
    lm = mul(lm, rotate(p.rotate ?? 0));
    lm = mul(lm, scale(p.sx ?? 1, p.sy ?? 1));
    lm = mul(lm, translate(-px, -py));
    m = mul(m, lm);
    opacity *= p.opacity ?? 1;
  }
  return { matrix: m, opacity: clamp01(opacity) };
}
