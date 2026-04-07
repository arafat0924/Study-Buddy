declare module 'upng-js' {
  const UPNG: {
    /** Encodes RGBA frames to PNG. `cnum` 0 = lossless, otherwise the palette size for lossy quantisation. */
    encode(frames: ArrayBuffer[], w: number, h: number, cnum: number, delays?: number[]): ArrayBuffer;
  };
  export default UPNG;
}
