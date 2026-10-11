import { EFFECTS, type EffectId } from '../lib/effects';
import { MOTIONS, MOTION_MAP, type MotionId, type MotionLayer } from '../lib/motions';
import { LINE_SPEC, allowedLoopsFor, frameDelays } from '../lib/spec';
import type { StickerSettings } from '../state';

interface Props {
  settings: StickerSettings;
  onChange: (s: StickerSettings) => void;
  /** 透過PNGでない画像のときだけ背景除去の項目を出す */
  canRemoveBg: boolean;
}

const MAX_LAYERS = 3;

export function SettingsPanel({ settings, onChange, canRemoveBg }: Props) {
  const { scene, timing } = settings;
  const setScene = (patch: Partial<StickerSettings['scene']>) => onChange({ ...settings, scene: { ...scene, ...patch } });
  const setLayers = (layers: MotionLayer[]) => setScene({ layers });
  const setTiming = (patch: Partial<StickerSettings['timing']>) => {
    const next = { ...timing, ...patch };
    const loops = allowedLoopsFor(next.totalSeconds);
    if (!loops.includes(next.loops)) next.loops = loops.filter((l) => l <= next.loops).pop() ?? 1;
    onChange({ ...settings, timing: next });
  };

  const toggleMotion = (id: MotionId) => {
    const i = scene.layers.findIndex((l) => l.id === id);
    if (i >= 0) setLayers(scene.layers.filter((_, j) => j !== i));
    else if (scene.layers.length < MAX_LAYERS) setLayers([...scene.layers, { id, amp: 1, cycles: 1 }]);
    else setLayers([...scene.layers.slice(1), { id, amp: 1, cycles: 1 }]);
  };

  const toggleEffect = (id: EffectId) =>
    setScene({ effects: scene.effects.includes(id) ? scene.effects.filter((e) => e !== id) : [...scene.effects, id] });

  const delays = frameDelays(timing);

  return (
    <div className="settings">
      <section>
        <h3>
          動き <small>最大{MAX_LAYERS}つまで重ねられます</small>
        </h3>
        <div className="motion-grid">
          {MOTIONS.map((m) => {
            const on = scene.layers.some((l) => l.id === m.id);
            return (
              <button
                key={m.id}
                className={`motion-chip ${on ? 'on' : ''}`}
                onClick={() => toggleMotion(m.id)}
                title={m.description}
                aria-pressed={on}
              >
                <span className="emoji">{m.emoji}</span>
                {m.label}
              </button>
            );
          })}
        </div>
        {scene.layers.length === 0 && <p className="hint">動きを選ばないと静止画のままです（飾りだけ動かすこともできます）</p>}
        {scene.layers.map((layer, i) => {
          const def = MOTION_MAP[layer.id];
          const update = (patch: Partial<MotionLayer>) =>
            setLayers(scene.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)));
          return (
            <div key={layer.id} className="layer">
              <div className="layer-head">
                <strong>
                  {def.emoji} {def.label}
                </strong>
                <span className="muted">{def.description}</span>
              </div>
              <label className="row">
                <span>強さ</span>
                <input
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={layer.amp}
                  onChange={(e) => update({ amp: Number(e.target.value) })}
                />
                <output>{layer.amp.toFixed(1)}</output>
              </label>
              {!def.oneShot && (
                <div className="row">
                  <span>回数</span>
                  <div className="seg small">
                    {[1, 2, 3].map((c) => (
                      <button key={c} className={layer.cycles === c ? 'on' : ''} onClick={() => update({ cycles: c })}>
                        {c}回
                      </button>
                    ))}
                  </div>
                  <span className="muted">/ 1ループ</span>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h3>飾り</h3>
        <div className="motion-grid">
          {EFFECTS.map((e) => {
            const on = scene.effects.includes(e.id);
            return (
              <button key={e.id} className={`motion-chip ${on ? 'on' : ''}`} onClick={() => toggleEffect(e.id)} aria-pressed={on}>
                <span className="emoji">{e.emoji}</span>
                {e.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3>文字</h3>
        <textarea
          rows={2}
          placeholder="例：ありがとう（改行で2行）"
          value={scene.text.content}
          onChange={(e) => setScene({ text: { ...scene.text, content: e.target.value } })}
        />
        {scene.text.content.trim() && (
          <>
            <div className="row">
              <span>位置</span>
              <div className="seg small">
                {(['top', 'bottom'] as const).map((p) => (
                  <button
                    key={p}
                    className={scene.text.position === p ? 'on' : ''}
                    onClick={() => setScene({ text: { ...scene.text, position: p } })}
                  >
                    {p === 'top' ? '上' : '下'}
                  </button>
                ))}
              </div>
              <input
                type="color"
                value={scene.text.color}
                onChange={(e) => setScene({ text: { ...scene.text, color: e.target.value } })}
                aria-label="文字色"
              />
            </div>
            <label className="row">
              <span>大きさ</span>
              <input
                type="range"
                min={24}
                max={72}
                value={scene.text.size}
                onChange={(e) => setScene({ text: { ...scene.text, size: Number(e.target.value) } })}
              />
              <output>{scene.text.size}</output>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={scene.text.followMotion}
                onChange={(e) => setScene({ text: { ...scene.text, followMotion: e.target.checked } })}
              />
              文字もイラストと一緒に動かす
            </label>
          </>
        )}
      </section>

      <section>
        <h3>配置</h3>
        <label className="row">
          <span>大きさ</span>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.02}
            value={scene.layout.zoom}
            onChange={(e) => setScene({ layout: { ...scene.layout, zoom: Number(e.target.value) } })}
          />
          <output>{Math.round(scene.layout.zoom * 100)}%</output>
        </label>
        <label className="row">
          <span>余白</span>
          <input
            type="range"
            min={0}
            max={40}
            value={scene.layout.padding}
            onChange={(e) => setScene({ layout: { ...scene.layout, padding: Number(e.target.value) } })}
          />
          <output>{scene.layout.padding}px</output>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={scene.layout.autoFit}
            onChange={(e) => setScene({ layout: { ...scene.layout, autoFit: e.target.checked } })}
          />
          動いてもはみ出さないよう自動で縮小する
        </label>
      </section>

      <section>
        <h3>再生</h3>
        <label className="row">
          <span>コマ数</span>
          <input
            type="range"
            min={LINE_SPEC.minFrames}
            max={LINE_SPEC.maxFrames}
            value={timing.frames}
            onChange={(e) => setTiming({ frames: Number(e.target.value) })}
          />
          <output>{timing.frames}枚</output>
        </label>
        <div className="row">
          <span>合計時間</span>
          <div className="seg small">
            {LINE_SPEC.allowedTotalSeconds.map((s) => (
              <button key={s} className={timing.totalSeconds === s ? 'on' : ''} onClick={() => setTiming({ totalSeconds: s })}>
                {s}秒
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <span>ループ</span>
          <div className="seg small">
            {[1, 2, 3, 4].map((l) => {
              const ok = allowedLoopsFor(timing.totalSeconds).includes(l);
              return (
                <button
                  key={l}
                  className={timing.loops === l ? 'on' : ''}
                  disabled={!ok}
                  title={ok ? undefined : '1ループの長さがミリ秒で割り切れないため選べません'}
                  onClick={() => setTiming({ loops: l })}
                >
                  {l}回
                </button>
              );
            })}
          </div>
        </div>
        <p className="hint">
          1ループ {(timing.totalSeconds * 1000) / timing.loops}ms ・ 1コマ約{Math.round(delays[0])}ms（
          {(1000 / delays[0]).toFixed(1)}fps）
        </p>
      </section>

      {canRemoveBg && (
        <section>
          <h3>背景</h3>
          <label className="check">
            <input type="checkbox" checked={settings.removeBg} onChange={(e) => onChange({ ...settings, removeBg: e.target.checked })} />
            背景を自動で透明にする
          </label>
          {settings.removeBg && (
            <label className="row">
              <span>しきい値</span>
              <input
                type="range"
                min={5}
                max={120}
                value={settings.bgTolerance}
                onChange={(e) => onChange({ ...settings, bgTolerance: Number(e.target.value) })}
              />
              <output>{settings.bgTolerance}</output>
            </label>
          )}
          <p className="hint">外周とつながった背景色だけを透明にします。うまくいかない場合は透過PNGを用意してください。</p>
        </section>
      )}
    </div>
  );
}
