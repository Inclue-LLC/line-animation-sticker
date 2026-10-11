import { useEffect, useRef, useState } from 'react';
import { makeCanvas } from '../lib/pipeline';
import { type SceneSettings, type SourceImage, renderFrame } from '../lib/render';
import { type TimingSettings, frameDelays } from '../lib/spec';

export type PreviewBg = 'checker' | 'line' | 'white' | 'dark';

const BG_LABEL: Record<PreviewBg, string> = {
  checker: '透過',
  line: 'トーク',
  white: '白',
  dark: 'ダーク',
};

interface Props {
  source: SourceImage;
  scene: SceneSettings;
  timing: TimingSettings;
  width: number;
  height: number;
}

/**
 * 書き出しと同じフレーム数・表示時間でアニメーションを再生する。
 * 「LINEと同じ」モードでは指定ループ回数だけ再生して止まる。
 */
export function Preview({ source, scene, timing, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bg, setBg] = useState<PreviewBg>('line');
  const [repeat, setRepeat] = useState(true);
  const [playToken, setPlayToken] = useState(0);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    const vctx = view.getContext('2d')!;
    const { canvas: off, ctx } = makeCanvas(width, height);
    const delays = frameDelays(timing);
    // ループ境界ごとに開始時刻を足し込むための累積
    const starts = delays.reduce<number[]>((acc, d, i) => [...acc, (acc[i] ?? 0) + d], [0]);
    const loopMs = starts[starts.length - 1];
    const draw = (frame: number) => {
      ctx.clearRect(0, 0, width, height);
      renderFrame(ctx, source, scene, frame / timing.frames, width, height);
      vctx.clearRect(0, 0, view.width, view.height);
      vctx.imageSmoothingEnabled = false;
      vctx.drawImage(off, 0, 0, view.width, view.height);
    };

    setStopped(false);
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      if (!repeat && elapsed >= loopMs * timing.loops) {
        draw(timing.frames - 1);
        setStopped(true);
        return;
      }
      const inLoop = elapsed % loopMs;
      let frame = 0;
      while (frame < timing.frames - 1 && starts[frame + 1] <= inLoop) frame++;
      if (frame !== last) {
        draw(frame);
        last = frame;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source, scene, timing, width, height, repeat, playToken]);

  return (
    <div className="preview">
      <div className={`preview-stage bg-${bg}`}>
        <canvas
          ref={ref}
          width={width * 2}
          height={height * 2}
          style={{ width: `min(100%, ${width * 1.25}px)`, aspectRatio: `${width} / ${height}` }}
          onClick={() => setPlayToken((n) => n + 1)}
          title="クリックで最初から再生"
        />
        {stopped && (
          <button className="replay" onClick={() => setPlayToken((n) => n + 1)}>
            ▶ もう一度
          </button>
        )}
      </div>
      <div className="preview-controls">
        <div className="seg" role="group" aria-label="背景">
          {(Object.keys(BG_LABEL) as PreviewBg[]).map((k) => (
            <button key={k} className={bg === k ? 'on' : ''} onClick={() => setBg(k)}>
              {BG_LABEL[k]}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={!repeat} onChange={(e) => setRepeat(!e.target.checked)} />
          LINEと同じく{timing.loops}回で止める
        </label>
      </div>
    </div>
  );
}
