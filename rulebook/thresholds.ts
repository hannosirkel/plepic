/**
 * Every limit of the layout check. The rules come from plan section "How
 * the layout is checked"; the tolerances were tuned on the English proof,
 * and each has the value measured there beside it.
 */
export const thresholds = {
  /** A built sheet may differ from the English sheet by this much. Measured: 0.50 pt, Chromium's rounding. */
  sheetSizePt: 1,

  /** Pixels per point of the renders that are compared and shown to the reviewer: 144 dpi. */
  renderScale: 2,
  /** Both renders are blurred by this radius, so that antialiasing is not counted. */
  compareBlur: 1,
  /** A pixel counts as different beyond this colour distance, so that soft shadows are not counted. */
  compareFuzzPercent: 20,
  /**
   * Share of a sheet's pixels that may differ, text stripped from both.
   * Measured: 1.41% on sheet 25, and 1.18%, 1.11% and 1.00% on sheets 18, 4
   * and 20, all four on 300 dpi raster underlays; at most 0.65% on a vector
   * underlay. Sheet 10 with its artwork moved by 2 pt measures 5.06%.
   */
  artworkPixelRatio: 0.02,
  /**
   * Share of a sheet's pixels in which the English proof may differ from the
   * published sheet. Measured: 7.65% on sheet 9, then 6.69%, 6.38% and 6.11%
   * on sheets 2, 23 and 19. The built type stands up to 2.6 pt higher than the
   * published type, so nearly every glyph counts; two builds of one text
   * differ by 0.1%.
   */
  proofPixelRatio: 0.09,

  /** Type may shrink to this share of its English size. */
  minSizeScale: 0.9,
  /** Type is never set under this size, unless English already is. */
  minSizePt: 6,
  /** Leading may shrink to this share of the English leading at the frame's size. */
  minLeadingScale: 0.95,
  /** Chromium lays out in 1/64 px, so a printed size is off by up to 0.01 pt. Measured: 5 pt type printed at 4.99 pt. */
  sizeSlackPt: 0.02,
  /** Chromium prints every baseline on a whole CSS pixel, which is this many points. */
  baselineGridPt: 0.75,
  /** The same rounding of a size, as a share of the leading. Measured: the tightest English frame has 98.1% of its leading. */
  leadingSlack: 0.005,
  /** The published faces sit this share of their size above the baseline (0.975 to 0.987), which makes a built line's box comparable with `layout/frames.ts`. */
  ascent: 0.98,
  /**
   * A frame's text may stand this far outside its English box, which is also
   * what the build's own fit allows (4 px). Measured: 2.61 pt above the box at
   * s20.f06, the built type standing higher in its line than the published
   * type; 0.48 pt to the right and 0.52 pt below at most. A paragraph of
   * doubled length (s10.f04) stands 18.7 pt below its box at the floor.
   */
  fitSlackPt: 3,
  /** Two frames that do not overlap in English may overlap by this much. Measured: 0 pt; the doubled s10.f04 overlaps s10.f05 by 9 pt. */
  collisionPt: 1,

  /** 16 MB, counted in decimal megabytes, the stricter reading. Measured: 9.4 MB. */
  maxBytes: 16_000_000,
} as const;
