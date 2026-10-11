import { useCallback, useMemo, useRef, useState } from 'react';
import { Preview } from './components/Preview';
import { SettingsPanel } from './components/SettingsPanel';
import {
  type BuiltApng,
  type ZipEntry,
  buildApng,
  buildTab,
  buildZip,
  download,
  isTransparent,
  loadImageFile,
  nextTick,
  prepareSource,
} from './lib/pipeline';
import { LINE_SPEC, checkSetCount, checkStickerSize } from './lib/spec';
import { OUTPUT_SIZES, type Sticker, type StickerSettings, defaultSettings, newId } from './state';

const kb = (n: number) => `${(n / 1024).toFixed(1)}KB`;
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function App() {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainId, setMainId] = useState<string | null>(null);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const size = OUTPUT_SIZES[sizeIdx];
  const selected = stickers.find((s) => s.id === selectedId) ?? null;
  const mainSticker = stickers.find((s) => s.id === mainId) ?? stickers[0] ?? null;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setError(null);
    setBusy('画像を読み込み中…');
    const added: Sticker[] = [];
    try {
      for (const file of list) {
        const original = await loadImageFile(file);
        const removeBg = !isTransparent(original);
        const settings = defaultSettings(removeBg);
        added.push({
          id: newId(),
          name: file.name.replace(/\.[^.]+$/, ''),
          original,
          transparent: !removeBg,
          source: prepareSource(original, settings.removeBg, settings.bgTolerance),
          thumbUrl: URL.createObjectURL(file),
          settings,
        });
        await nextTick();
      }
    } catch (e) {
      setError(`画像を読み込めませんでした: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
    if (added.length) {
      setStickers((prev) => {
        const next = [...prev, ...added].slice(0, Math.max(...LINE_SPEC.allowedCounts));
        if (next.length < prev.length + added.length) setError(`スタンプは最大${Math.max(...LINE_SPEC.allowedCounts)}個までです`);
        return next;
      });
      setSelectedId((cur) => cur ?? added[0].id);
    }
  }, []);

  const updateSettings = (id: string, settings: StickerSettings) => {
    setStickers((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const bgChanged = s.settings.removeBg !== settings.removeBg || s.settings.bgTolerance !== settings.bgTolerance;
        if (s.built) URL.revokeObjectURL(s.built.url);
        return {
          ...s,
          settings,
          built: undefined,
          source: bgChanged ? prepareSource(s.original, settings.removeBg, settings.bgTolerance) : s.source,
        };
      }),
    );
  };

  const applyToAll = () => {
    if (!selected) return;
    const { scene, timing } = selected.settings;
    stickers.forEach((s) => {
      if (s.id !== selected.id) updateSettings(s.id, { ...s.settings, scene: structuredClone(scene), timing: { ...timing } });
    });
  };

  const remove = (id: string) => {
    const s = stickers.find((x) => x.id === id);
    if (!s) return;
    URL.revokeObjectURL(s.thumbUrl);
    if (s.built) URL.revokeObjectURL(s.built.url);
    const next = stickers.filter((x) => x.id !== id);
    setStickers(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
    if (mainId === id) setMainId(null);
  };

  const move = (id: string, dir: -1 | 1) =>
    setStickers((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /** 書き出し済みでサイズが同じならそれを使い、なければ作り直す */
  const ensureBuilt = async (s: Sticker): Promise<BuiltApng> => {
    if (s.built && s.built.width === size.width && s.built.height === size.height) return s.built;
    const built = await buildApng(s.source, s.settings.scene, s.settings.timing, size.width, size.height);
    setStickers((prev) =>
      prev.map((x) => {
        if (x.id !== s.id) return x;
        if (x.built) URL.revokeObjectURL(x.built.url);
        return { ...x, built };
      }),
    );
    return built;
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    await nextTick();
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(`書き出しに失敗しました: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const exportOne = () =>
    selected &&
    run('APNGを書き出し中…', async () => {
      const built = await ensureBuilt(selected);
      download(new Blob([built.data], { type: 'image/png' }), `${selected.name}.png`);
    });

  const exportZip = () =>
    run('セットを書き出し中…', async () => {
      const entries: ZipEntry[] = [];
      for (let i = 0; i < stickers.length; i++) {
        setBusy(`スタンプを書き出し中… (${i + 1}/${stickers.length})`);
        await nextTick();
        const built = await ensureBuilt(stickers[i]);
        entries.push({ name: `${pad2(i + 1)}.png`, data: built.data });
      }
      if (mainSticker) {
        setBusy('メイン画像・タブ画像を作成中…');
        await nextTick();
        const m = await buildApng(
          mainSticker.source,
          mainSticker.settings.scene,
          mainSticker.settings.timing,
          LINE_SPEC.main.width,
          LINE_SPEC.main.height,
        );
        URL.revokeObjectURL(m.url);
        entries.push({ name: 'main.png', data: m.data });
        entries.push({ name: 'tab.png', data: await buildTab(mainSticker.source, mainSticker.settings.scene) });
      }
      download(await buildZip(entries), 'line_animation_stickers.zip');
    });

  const setIssues = useMemo(() => [...checkSetCount(stickers.length), ...checkStickerSize(size.width, size.height)], [stickers.length, size]);

  return (
    <div
      className={`app ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <header className="topbar">
        <h1>
          <span className="logo">🐣</span> うごくスタンプメーカー
        </h1>
        <p className="tagline">イラストを動かして、LINEアニメーションスタンプ用のAPNGを作成</p>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {stickers.length === 0 ? (
        <main className="empty">
          <button className="dropzone" onClick={() => fileInput.current?.click()}>
            <span className="big">🖼️</span>
            <strong>イラストをドロップ、またはクリックして選択</strong>
            <span>PNG / JPEG / WebP ・ 複数まとめてOK（最大24枚）</span>
            <span className="muted">背景が透明なPNGがおすすめ。白背景の画像は自動で透過できます。</span>
          </button>
          <ol className="steps">
            <li>
              <b>1.</b> 静止画イラストをアップロード
            </li>
            <li>
              <b>2.</b> 「ぴょんぴょん」「ゆらゆら」などの動きを選ぶ
            </li>
            <li>
              <b>3.</b> LINEの規定（APNG・320×270px・300KB以下など）に合わせて自動で書き出し
            </li>
          </ol>
        </main>
      ) : (
        <main className="workspace">
          <aside className="list">
            <div className="list-head">
              <strong>スタンプ {stickers.length}個</strong>
              <button className="ghost" onClick={() => fileInput.current?.click()}>
                ＋ 追加
              </button>
            </div>
            <ul>
              {stickers.map((s, i) => (
                <li key={s.id} className={s.id === selectedId ? 'on' : ''}>
                  <button className="thumb" onClick={() => setSelectedId(s.id)}>
                    <span className="num">{pad2(i + 1)}</span>
                    <img src={s.built?.url ?? s.thumbUrl} alt={s.name} />
                    {mainSticker?.id === s.id && <span className="badge">メイン</span>}
                    {s.built && !s.built.withinLimit && <span className="badge warn">容量超過</span>}
                  </button>
                  <div className="thumb-actions">
                    <button title="前へ" onClick={() => move(s.id, -1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button title="後ろへ" onClick={() => move(s.id, 1)} disabled={i === stickers.length - 1}>
                      ↓
                    </button>
                    <button title="削除" onClick={() => remove(s.id)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          {selected && (
            <>
              <section className="center">
                <Preview
                  source={selected.source}
                  scene={selected.settings.scene}
                  timing={selected.settings.timing}
                  width={size.width}
                  height={size.height}
                />
                <div className="actions">
                  <button className="primary" onClick={exportOne} disabled={!!busy}>
                    このスタンプをAPNGで保存
                  </button>
                  <button className="ghost" onClick={() => setMainId(selected.id)} disabled={mainSticker?.id === selected.id}>
                    メイン画像にする
                  </button>
                  {stickers.length > 1 && (
                    <button className="ghost" onClick={applyToAll}>
                      この設定を全スタンプに適用
                    </button>
                  )}
                </div>
                {selected.built && (
                  <div className={`result ${selected.built.withinLimit ? 'ok' : 'ng'}`}>
                    <span>
                      {selected.built.withinLimit ? '✅ 規定内' : '⚠️ 300KBを超えています'} ・ {kb(selected.built.bytes)} ・{' '}
                      {selected.built.colors ? `${selected.built.colors}色に減色` : '減色なし'} ・ {selected.built.width}×
                      {selected.built.height}px ・ {selected.built.timing.frames}コマ ・ {selected.built.timing.loops}ループ ・{' '}
                      {selected.built.timing.totalSeconds}秒
                    </span>
                    {!selected.built.withinLimit && <span>コマ数を減らすか、イラストを小さくしてください。</span>}
                  </div>
                )}

                <div className="export-box">
                  <h3>セットで書き出し</h3>
                  <label className="row">
                    <span>サイズ</span>
                    <select value={sizeIdx} onChange={(e) => setSizeIdx(Number(e.target.value))}>
                      {OUTPUT_SIZES.map((o, i) => (
                        <option key={o.label} value={i}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="muted">
                    ZIPの中身：01.png〜{pad2(stickers.length)}.png（APNG）、main.png（240×240 APNG）、tab.png（96×74 PNG）
                  </p>
                  {setIssues.map((i) => (
                    <p key={i.message} className={i.level}>
                      {i.level === 'error' ? '⛔' : '⚠️'} {i.message}
                    </p>
                  ))}
                  <button className="primary" onClick={exportZip} disabled={!!busy}>
                    {stickers.length}個をまとめてZIPで保存
                  </button>
                </div>
              </section>

              <section className="side">
                <SettingsPanel
                  key={selected.id}
                  settings={selected.settings}
                  onChange={(s) => updateSettings(selected.id, s)}
                  canRemoveBg={!selected.transparent}
                />
              </section>
            </>
          )}
        </main>
      )}

      {busy && (
        <div className="overlay">
          <div className="spinner" />
          {busy}
        </div>
      )}
      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      <footer>
        画像はブラウザ内だけで処理され、サーバーには送信されません。・ 申請前に
        <a href="https://creator.line.me/ja/guideline/animationsticker/" target="_blank" rel="noreferrer">
          LINE Creators Market の制作ガイドライン
        </a>
        も確認してください。
      </footer>
    </div>
  );
}
