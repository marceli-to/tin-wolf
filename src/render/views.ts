export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SplitMode = 'vertical' | 'horizontal';

/** Screen rectangles (CSS pixels, top-left origin) for each player view. */
export function computeViewRects(count: number, width: number, height: number, split: SplitMode): ViewRect[] {
  if (count <= 1) return [{ x: 0, y: 0, w: width, h: height }];
  if (count === 2) {
    if (split === 'vertical') {
      const hw = Math.floor(width / 2);
      return [
        { x: 0, y: 0, w: hw, h: height },
        { x: hw, y: 0, w: width - hw, h: height },
      ];
    }
    const hh = Math.floor(height / 2);
    return [
      { x: 0, y: 0, w: width, h: hh },
      { x: 0, y: hh, w: width, h: height - hh },
    ];
  }
  const hw = Math.floor(width / 2);
  const hh = Math.floor(height / 2);
  return [
    { x: 0, y: 0, w: hw, h: hh },
    { x: hw, y: 0, w: width - hw, h: hh },
    { x: 0, y: hh, w: hw, h: height - hh },
    { x: hw, y: hh, w: width - hw, h: height - hh },
  ].slice(0, count);
}
