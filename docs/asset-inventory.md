# Storefront asset inventory

Status: implemented, 2026-08-11. The selected authentic assets are bound in the storefront and covered by rendered and source-level tests.

## Scope and method

The cleared source libraries were inventoried before selecting any imagery:

- `/home/hanno/plepicfiles`: 65 files, about 796 KB. Publisher marks, palette guidance, icons, and social exports.
- `/home/hanno/lunarfiles`: 147 files, about 169 MB. Launch-site artwork, web exports, fonts and licence text, print material, and video.
- `/home/hanno/lunarsnips`: 868 files, about 3.7 GB. Product renders, tabletop photography, team photography, campaign exports, video masters, archives, duplicates, and macOS resource forks.

The table records every artifact relevant to the proposed storefront direction. A family row names the exact representative source path where siblings are simple size or colour variants. Production-print files, archive contents, resource forks (`._*`), temporary saved-site files, duplicates, and obsolete Kickstarter/social states are excluded from web selection and described after the table.

## Selected and evaluated artifacts

| source | path | type | dimensions | web usability | role | action |
|---|---|---|---|---|---|---|
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-wordmark-primary.svg` | SVG | 325 × 108 viewBox | Excellent | Default publisher header/footer mark on light surfaces | Use; existing byte-equivalent storefront asset is `/brand/plepic-wordmark-primary.svg` |
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-wordmark-dark-background.svg` | SVG | 325 × 108 viewBox | Excellent | Publisher mark over Lunar/dark surfaces | Use; map to the existing dark wordmark asset |
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-wordmark-small-print.svg` | SVG | 325 × 105 viewBox | Excellent | Compact/mobile mark where the full wordmark loses detail | Retain as responsive option; existing storefront asset is available |
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-icon-primary.svg` | SVG | 80 × 80 viewBox | Excellent | Favicon/app-icon source and compact brand stamp | Use only in genuinely compact placements; existing storefront asset is available |
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-icon-black.svg` | SVG | 80 × 80 viewBox | Excellent | Monochrome production fallback | Retain; do not prefer in the storefront UI |
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-icon-white.svg` | SVG | 80 × 80 viewBox | Excellent | Monochrome dark-background fallback | Retain; do not substitute for the approved colour mark |
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-wordmark-black.svg` | SVG | 325 × 108 viewBox | Excellent | Monochrome production fallback | Retain; not selected for primary web use |
| Plepic cleared library | `/home/hanno/plepicfiles/vector/plepic-games-wordmark-white.svg` | SVG | 325 × 108 viewBox | Excellent | Monochrome dark-background fallback | Retain; not selected for primary web use |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/Lunar Base website logo v1.svg` | SVG | 200 × 50 viewBox | Excellent | Product wordmark in game hero and product navigation | Use; existing storefront derivative is `/brand/lunar-base-logo.svg` |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/Lunar Base website icon v1.svg` | SVG | 300 × 304 viewBox | Excellent | Product emblem and restrained decorative stamp | Use sparingly; existing storefront derivative is `/brand/lunar-base-icon.svg` |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/rectangle LB logo.svg` | SVG | 183.64 × 35 viewBox | Excellent | Legacy compact lock-up | Retain for provenance; prefer the website logo above |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/Hero image 1920 x 1200.jpg` | JPEG | 1920 × 1200 | Excellent | Full-bleed Lunar hero atmosphere | Use as the desktop art source; existing responsive WebP derivatives are `/images/hero/lunar-hero-*` |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/About Game background.jpg` | JPEG | 1920 × 1200 | Excellent | Line-art texture behind component spread/about-game band | Used as responsive `/images/textures/lunar-linework-*` WebP derivatives |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/Hand cards.png` | transparent PNG | 782 × 600 | Excellent | Component spread and featured-game art | Use; existing responsive derivatives are `/images/components/hand-cards-*` |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/Layed out card base.png` | transparent PNG | 1062 × 676 | Excellent | Rules explanation / player-base diagram | Use; existing responsive derivatives are `/images/components/layout-base-*` |
| Lunar cleared library | `/home/hanno/lunarfiles/Web/Elements/Lunar Base web footer v1.jpg` | JPEG | 1920 × 1000 | Good | Optional closing atmosphere behind product footer | Keep in reserve; the hero and line-art texture provide enough visual continuity without another large background |
| Lunar cleared library | `/home/hanno/lunarsnips/LB pics TRANSPARENT/LB box front and back transparent 2_1.png` | transparent PNG | 1852 × 1000 | Excellent | Homepage publisher hero product cut-out | Used as responsive `/images/box/box-front-back-*` WebP derivatives |
| Lunar cleared library | `/home/hanno/lunarsnips/LB pics TRANSPARENT/LB box open 3_1.png` | transparent PNG | 1238 × 1000 | Excellent | Product-page purchase hero | Use; existing responsive derivatives are `/images/box/box-open-*` |
| Lunar cleared library | `/home/hanno/lunarsnips/Lunar Base_Quatermaster_ package/Photos/Lunar Base 3D box components.png` | transparent PNG | 1238 × 1000 | Excellent but duplicates the open-box master | Alternate product render | Deduplicate against the open-box master; do not ship both if pixels match |
| Lunar cleared library | `/home/hanno/lunarsnips/Lunar Baes table view v1.jpg` | JPEG | 4096 × 2160 | Excellent | Wide, cinematic tabletop proof on the product page | Used as responsive `/images/table/table-view-*` WebP derivatives with the composition preserved |
| Lunar cleared library | `/home/hanno/lunarsnips/lunar_base_game.JPG` | JPEG | 5472 × 3648 | Excellent | Documentary game-night image | Use as secondary table photography; preserve natural colour and do not fabricate people or play state |
| Lunar cleared library | `/home/hanno/lunarsnips/ims/LB-cards1.jpg` | JPEG | 4608 × 3456 | Good | Detailed component photography | Keep in reserve for support/rules content if the transparent diagrams are insufficient |
| Lunar cleared library | `/home/hanno/lunarsnips/ims/LB-cards2.jpg` | JPEG | 4608 × 3456 | Good | Detailed component photography | Keep in reserve; avoid redundant gallery density |
| Lunar cleared library | `/home/hanno/lunarsnips/lbteam.jpg` | JPEG | 9248 × 6936 | Excellent | About-page team photograph | Use; existing responsive derivatives are `/images/team/team-*`; show the real six-person team without invented names or roles |
| Lunar cleared library | `/home/hanno/lunarsnips/Lunar Base card game – Plepic Games.mp4` | H.264/AAC MP4 | 1184 × 720, 10:51 | Local master is too large for direct storefront delivery | Tutorial/game overview source evidence | Do not host directly; use the verified public tutorial embed listed below |
| Lunar cleared library | `/home/hanno/lunarsnips/Kickstarter 4.2-splash-subs.mp4` | H.264/AAC MP4 | 1920 × 1080, 4:00 | Too large; campaign-specific | Launch-film master | Do not ship; use the official YouTube launch video |
| Lunar cleared library | `/home/hanno/lunarsnips/Pre-Launch Clip 2 v1.8a-Facebook.mp4` | H.264/AAC MP4 | 1920 × 1080, 1:46 | Too large; campaign/social framing | Historical teaser | Archive only; it is not the clearest product media for a shop |
| Existing storefront | `/home/hanno/app/plepic/storefront/public/documents/lunar-base-rulebook.pdf` | tagged PDF | 25 pages, 8.9 MB | Good; large but accessible and verified | Rulebook download | Preserve byte-for-byte and retain the disclosed download size |
| Lunar cleared library | `/home/hanno/lunarfiles/Fonts/MADE Evolve Sans/` | OTF plus licensed webfont materials | five weights | Conditional | Brand typeface source/licence evidence | Never commit OTF. Only existing licensed WOFF/WOFF2 plus the complete Fontspring banner may be used; invoice/pageview cap remains an operator item |

## Verified external media

The product page should use two purposeful embeds, not a carousel of campaign history:

| title | source | placement | decision |
|---|---|---|---|
| Lunar Base Kickstarter Launch Video | `https://www.youtube.com/watch?v=2D_y7t7DDYM` (official Lunar Base channel) | Product page, “Watch” band | Used as the primary trailer in a responsive, lazy, privacy-enhanced 16:9 embed |
| Lunar Base - Tutorial and Playthrough | `https://www.youtube.com/watch?v=SOW3l7kdu7k` (Gaming Rules!) | Product page “Watch” band and support tutorial | Used as the instructional privacy-enhanced embed on both routes |

Official teaser parts `QZ_Pqf3eY4o`, `KSuIqu5qzTM`, `JjlDpS2ByXY`, and `v0lS1aenCXU` are verified but remain archive/context material. They add campaign chronology rather than purchase confidence.

## Exclusions and gaps

- Exclude print-production packages and source formats from public delivery: packaging layouts, print PDFs, InDesign/Illustrator sources, and large production exports are not web assets.
- Exclude macOS resource forks, archive duplicates, temporary saved HTML/CSS, and copies differentiated only by download suffixes.
- Exclude obsolete campaign-state graphics (pre-launch countdowns, Kickstarter goal graphics, review composites, and social platform crops) unless future copy explicitly requires historical campaign reporting.
- No gap requires generative imagery. The cleared libraries already contain genuine product renders, components, tabletop scenes, and the real team. Image generation would reduce provenance and is not proposed.
- The line-art, cinematic table-photo, and front/back box derivatives are now present in the public asset set. Their cleared masters remain outside the repository as provenance evidence.
