export interface Rgba {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/**
 * 画像の外周とつながっている「背景色に近い」ピクセルを透明にする（塗りつぶしツールと同じ考え方）。
 * キャラクター内部の白（目のハイライトなど）は外周とつながっていなければ残る。
 * tolerance は 0〜255 の RGB 距離のしきい値。
 */
export function removeBackground(src: Rgba, tolerance: number): Rgba {
  const { width: w, height: h } = src;
  const data = new Uint8ClampedArray(src.data);
  const bg = estimateBackground(src);
  if (!bg) return { data, width: w, height: h };
  const tol2 = tolerance * tolerance * 3;
  const near = (i: number) => {
    if (data[i + 3] === 0) return true;
    const dr = data[i] - bg[0];
    const dg = data[i + 1] - bg[1];
    const db = data[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= tol2;
  };
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (near(p * 4)) stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  const edge = new Uint8Array(w * h);
  while (stack.length) {
    const p = stack.pop()!;
    data[p * 4 + 3] = 0;
    edge[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // 境界のジャギーを和らげるため、透明になった領域に接するピクセルを背景色との近さに応じて半透明にする
  const soft = tol2 * 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (edge[p]) continue;
      const touches =
        (x > 0 && edge[p - 1]) || (x < w - 1 && edge[p + 1]) || (y > 0 && edge[p - w]) || (y < h - 1 && edge[p + w]);
      if (!touches) continue;
      const i = p * 4;
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < soft) data[i + 3] = Math.round(data[i + 3] * Math.min(1, 0.4 + (0.6 * (d - tol2)) / (soft - tol2)));
    }
  }
  return { data, width: w, height: h };
}

/** 四隅の色から背景色を推定する。すでに透過されている画像なら null */
export function estimateBackground(src: Rgba): [number, number, number] | null {
  const { width: w, height: h, data } = src;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => p * 4);
  const opaque = corners.filter((i) => data[i + 3] > 200);
  if (opaque.length < 3) return null;
  const avg = [0, 1, 2].map((c) => Math.round(opaque.reduce((s, i) => s + data[i + c], 0) / opaque.length));
  return avg as [number, number, number];
}

export function hasTransparency(src: Rgba): boolean {
  for (let i = 3; i < src.data.length; i += 4) if (src.data[i] < 250) return true;
  return false;
}

/** 不透明ピクセルを囲む最小の矩形。全部透明なら null */
export function opaqueBounds(src: Rgba, alphaThreshold = 8): { x: number; y: number; w: number; h: number } | null {
  const { width: w, height: h, data } = src;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function crop(src: Rgba, r: { x: number; y: number; w: number; h: number }): Rgba {
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const from = ((r.y + y) * src.width + r.x) * 4;
    out.set(src.data.subarray(from, from + r.w * 4), y * r.w * 4);
  }
  return { data: out, width: r.w, height: r.h };
}
