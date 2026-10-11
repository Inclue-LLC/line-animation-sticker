import type { BuiltApng } from './lib/pipeline';
import type { SceneSettings, SourceImage } from './lib/render';
import type { TimingSettings } from './lib/spec';

export interface StickerSettings {
  scene: SceneSettings;
  timing: TimingSettings;
  removeBg: boolean;
  bgTolerance: number;
}

export interface Sticker {
  id: string;
  name: string;
  original: ImageData;
  /** 元画像がすでに透過されているか（背景除去の項目を出すかどうか） */
  transparent: boolean;
  /** 背景除去・切り抜き後の描画用画像 */
  source: SourceImage;
  /** 元画像をサムネイル表示する用 */
  thumbUrl: string;
  settings: StickerSettings;
  /** 最後に書き出した結果。設定を変えると消える */
  built?: BuiltApng;
}

export interface OutputSize {
  label: string;
  width: number;
  height: number;
}

export const OUTPUT_SIZES: OutputSize[] = [
  { label: '320×270（最大・横長）', width: 320, height: 270 },
  { label: '270×270（正方形）', width: 270, height: 270 },
  { label: '320×240（横長・低め）', width: 320, height: 240 },
];

export const defaultSettings = (removeBg: boolean): StickerSettings => ({
  scene: {
    layers: [{ id: 'bounce', amp: 1, cycles: 1 }],
    effects: [],
    layout: { padding: 10, zoom: 1, autoFit: true },
    text: { content: '', position: 'bottom', color: '#ff6b81', size: 44, followMotion: false },
  },
  timing: { frames: 12, totalSeconds: 2, loops: 2 },
  removeBg,
  bgTolerance: 40,
});

let seq = 0;
export const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;
