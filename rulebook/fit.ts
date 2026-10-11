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

export type Fit = { size: number; scale: number; leading: number; leadingScale: number };

/** The ladder is exhausted: the text has to be shortened. */
export class DoesNotFit extends Error {}

/** The last step of the ladder: the smallest size at 95% of its English leading. */
export function fitFloor(englishSize: number, englishLeading: number): Fit {
  const size = fitSizes(englishSize).at(-1) ?? englishSize;
  return {
    size, scale: Math.round(size / englishSize * 10000) / 100,
    leading: Math.round(englishLeading * size / englishSize * 95) / 100, leadingScale: 95,
  };
}

export async function fitFrame(
  englishSize: number,
  englishLeading: number,
  fits: (size: number, leading: number) => boolean | Promise<boolean>,
): Promise<Fit> {
  for (const size of fitSizes(englishSize)) {
    for (let percent = 100; percent >= 95; percent -= 1) {
      const leading = Math.round(englishLeading * size / englishSize * percent) / 100;
      if (await fits(size, leading)) return {
        size, scale: Math.round(size / englishSize * 10000) / 100,
        leading, leadingScale: percent,
      };
    }
  }
  throw new DoesNotFit(`Text does not fit at 90% of ${englishSize} pt or the 6 pt floor`);
}
