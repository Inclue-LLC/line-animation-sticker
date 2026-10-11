declare module 'upng-js' {
  interface DecodedImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: { rect: { x: number; y: number; width: number; height: number }; delay: number; dispose: number; blend: number }[];
    tabs: Record<string, unknown> & { acTL?: { num_frames: number; num_plays: number } };
  }
  const UPNG: {
    encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number, dels?: number[], forbidPlte?: boolean): ArrayBuffer;
    decode(buf: ArrayBuffer): DecodedImage;
    toRGBA8(img: DecodedImage): ArrayBuffer[];
  };
  export default UPNG;
}
