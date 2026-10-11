/**
 * LINE Creators Market「アニメーションスタンプ」の制作ガイドラインに基づく制約値。
 * https://creator.line.me/ja/guideline/animationsticker/
 */
export const LINE_SPEC = {
  /** スタンプ画像の最大サイズ */
  maxWidth: 320,
  maxHeight: 270,
  /** 縦・横どちらかはこの値以上が必要 */
  minLongSide: 270,
  minFrames: 5,
  maxFrames: 20,
  minLoops: 1,
  maxLoops: 4,
  /** 再生時間（ループ込みの合計）は 1〜4 秒の整数秒 */
  allowedTotalSeconds: [1, 2, 3, 4] as const,
  maxFileBytes: 300 * 1024,
  /** メイン画像（APNG） */
  main: { width: 240, height: 240 },
  /** トークルームタブ画像（静止画 PNG） */
  tab: { width: 96, height: 74 },
  /** 1セットのスタンプ数 */
  allowedCounts: [8, 16, 24] as const,
} as const;

export interface TimingSettings {
  frames: number;
  /** ループ込みの合計再生時間（秒） */
  totalSeconds: number;
  loops: number;
}

/** 合計秒数とループ回数の組み合わせで、1ループあたりの ms が整数になるものだけを許可する */
export function isValidTiming({ frames, totalSeconds, loops }: TimingSettings): boolean {
  return (
    Number.isInteger(frames) &&
    frames >= LINE_SPEC.minFrames &&
    frames <= LINE_SPEC.maxFrames &&
    (LINE_SPEC.allowedTotalSeconds as readonly number[]).includes(totalSeconds) &&
    Number.isInteger(loops) &&
    loops >= LINE_SPEC.minLoops &&
    loops <= LINE_SPEC.maxLoops &&
    (totalSeconds * 1000) % loops === 0
  );
}

/** 指定した合計秒数で選べるループ回数 */
export function allowedLoopsFor(totalSeconds: number): number[] {
  const out: number[] = [];
  for (let l = LINE_SPEC.minLoops; l <= LINE_SPEC.maxLoops; l++) {
    if ((totalSeconds * 1000) % l === 0) out.push(l);
  }
  return out;
}

/**
 * 各フレームの表示時間（ms）。合計が 1ループの長さちょうどになるよう余りを均等に配る。
 * APNG の delay は分母 1000 で書き出すので、整数 ms なら合計時間に誤差は出ない。
 */
export function frameDelays({ frames, totalSeconds, loops }: TimingSettings): number[] {
  const loopMs = (totalSeconds * 1000) / loops;
  const base = Math.floor(loopMs / frames);
  const rem = loopMs - base * frames;
  const delays: number[] = [];
  let acc = 0;
  for (let i = 0; i < frames; i++) {
    // 余りを等間隔のフレームに 1ms ずつ割り振る
    const extra = Math.floor(((i + 1) * rem) / frames) - Math.floor((i * rem) / frames);
    delays.push(base + extra);
    acc += base + extra;
  }
  if (acc !== loopMs) throw new Error(`delay sum mismatch: ${acc} != ${loopMs}`);
  return delays;
}

export interface SpecIssue {
  level: 'error' | 'warning';
  message: string;
}

export function checkStickerSize(width: number, height: number): SpecIssue[] {
  const issues: SpecIssue[] = [];
  if (width > LINE_SPEC.maxWidth || height > LINE_SPEC.maxHeight) {
    issues.push({ level: 'error', message: `画像サイズは最大 ${LINE_SPEC.maxWidth}×${LINE_SPEC.maxHeight}px です` });
  }
  if (Math.max(width, height) < LINE_SPEC.minLongSide) {
    issues.push({ level: 'error', message: `縦・横どちらかは ${LINE_SPEC.minLongSide}px 以上必要です` });
  }
  return issues;
}

export function checkSetCount(count: number): SpecIssue[] {
  if ((LINE_SPEC.allowedCounts as readonly number[]).includes(count)) return [];
  return [
    {
      level: 'warning',
      message: `LINEに申請できるのは ${LINE_SPEC.allowedCounts.join(' / ')} 個のセットです（現在 ${count} 個）`,
    },
  ];
}
