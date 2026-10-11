import { access } from "node:fs/promises";
import { resolve } from "node:path";

export type FontSpec = { name: string; family: string; weight: number; style: "normal" | "italic"; file: string };

/** Every live-text face in the printed PDF. Minion Pro's lone space on sheet 6 is omitted. */
export function fontSpecs(fontDir: string, root: string): FontSpec[] {
  const made = (name: string, weight: number, file: string): FontSpec => ({ name, family: "MADE Evolve Sans", weight, style: "normal", file: resolve(fontDir, file) });
  const lato = (name: string, weight: number, folder: string): FontSpec => ({ name, family: "Lato", weight, style: "italic", file: resolve(root, `node_modules/lato-font/fonts/${folder}/${folder}.woff2`) });
  return [
    made("MADEEvolveSans", 400, "made_evolve_sans_regular.otf"),
    made("MADEEvolveSansEVO", 401, "made_evolve_sans_regular_evo.otf"),
    made("MADEEvolveSans-Light", 300, "made_evolve_sans_light.otf"),
    made("MADEEvolveSans-Medium", 500, "made_evolve_sans_medium.otf"),
    made("MADEEvolveSans-Bold", 700, "made_evolve_sans_bold.otf"),
    lato("Lato-Italic", 400, "lato-normal-italic"),
    lato("Lato-MediumItalic", 500, "lato-medium-italic"),
    lato("Lato-BoldItalic", 700, "lato-bold-italic"),
    lato("Lato-HeavyItalic", 800, "lato-heavy-italic"),
    { name: "JosefinSans-Bold", family: "Josefin Sans", weight: 700, style: "normal", file: resolve(root, "node_modules/@fontsource/josefin-sans/files/josefin-sans-latin-700-normal.woff2") },
  ];
}

export async function requireFonts(specs: readonly FontSpec[]): Promise<void> {
  for (const spec of specs) {
    try { await access(spec.file); }
    catch { throw new Error(`Required font file is missing: ${spec.file}`); }
  }
}

export function frameFont(family: string, weight: number, style: string): FontSpec["name"] {
  const key = `${family}/${weight}/${style}`;
  const map: Record<string, string> = {
    "MADE Evolve Sans/300/normal": "MADEEvolveSans-Light",
    "MADE Evolve Sans/400/normal": "MADEEvolveSans",
    "MADE Evolve Sans/500/normal": "MADEEvolveSans-Medium",
    "MADE Evolve Sans/700/normal": "MADEEvolveSans-Bold",
    "Lato/400/italic": "Lato-Italic",
    "Lato/500/italic": "Lato-MediumItalic",
    "Lato/700/italic": "Lato-BoldItalic",
    "Lato/800/italic": "Lato-HeavyItalic",
    "Josefin Sans/700/normal": "JosefinSans-Bold",
  };
  const name = map[key];
  if (!name) throw new Error(`Unmapped rulebook font: ${key}`);
  return name;
}
