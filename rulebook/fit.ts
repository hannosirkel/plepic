/** English size first, then one-point-percent steps down to 90%, never below 6 pt. */
export function fitSizes(englishSize: number): number[] {
  if (englishSize < 6) return [englishSize];
  const sizes: number[] = [];
  for (let percent = 100; percent >= 90; percent -= 1) {
    const size = Math.round(englishSize * percent) / 100;
    if (size < 6) break;
    if (!sizes.includes(size)) sizes.push(size);
  }
  return sizes;
}

export async function fitFrame(
  englishSize: number,
  englishLeading: number,
  fits: (size: number, leading: number) => boolean | Promise<boolean>,
): Promise<{ size: number; scale: number; leading: number; leadingScale: number }> {
  for (const size of fitSizes(englishSize)) {
    for (let percent = 100; percent >= 95; percent -= 1) {
      const leading = Math.round(englishLeading * size / englishSize * percent) / 100;
      if (await fits(size, leading)) return {
        size, scale: Math.round(size / englishSize * 10000) / 100,
        leading, leadingScale: percent,
      };
    }
  }
  throw new Error(`Text does not fit at 90% of ${englishSize} pt or the 6 pt floor`);
}
