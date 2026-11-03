# Typography and white series marks (2026-10-30)

- Archivo Black: Google Fonts official repository `https://github.com/google/fonts/tree/main/ofl/archivoblack`. Latin subset self-hosted as WOFF2. The English KONGBODA / MOTORSPORTS wordmark uses font outlines with uniform scaling and spacing (not stretched browser text).
- Pretendard: official `https://github.com/orioncactus/pretendard`, web variable font. Latin subset for English UI (100–900 weight), preserving current Korean typography. The modified subset is internally renamed Kongboda UI Latin to respect the reserved font name. No external CDN is required at runtime.
- OFL notices are retained in `docs/font-licenses/`. Subsets are not sold independently. Original license text is preserved.
- IMSA: high-resolution existing official-source PNG from `worker/series_logos.js`, vectorized into SVG paths and recolored white. The native official vector was identified through IMSA branding/Wikimedia but its asset download returned HTTP 403; this asset is a vectorized derivative, not represented as a downloaded official native SVG.
- NLS: the owner-supplied RAVENOL Nürburgring Langstrecken Serie artwork in `worker/uploaded-logos.js`, converted to white SVG path outlines; excludes ADAC and divider. This is a vectorized derivative, not represented as an official native SVG release.
- Marks remain trademarks of their respective owners; use identifies the racing series and does not claim affiliation.
- Rendered and visually inspected: white IMSA, white NLS and English brand wordmark. New modules contain paths, no embedded raster images or SVG filters.
