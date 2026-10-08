# Third-party font licenses

The fonts shipped under `src/fonts/` are used in the FieldRunner design
system. They are licensed under permissive open-source terms; the original
files are unmodified.

| Font            | Source                                              | License   | Files                                                |
|-----------------|-----------------------------------------------------|-----------|------------------------------------------------------|
| Bungee          | Google Fonts (David Jonathan Ross, 2008)            | SIL OFL 1.1 | `bungee-400.woff2`                                |
| Spectral        | Google Fonts (Production Type, 2016)                 | SIL OFL 1.1 | `spectral-300.woff2`, `spectral-400.woff2`, `spectral-500.woff2`, `spectral-600.woff2`, `spectral-400-italic.woff2` |
| JetBrains Mono  | JetBrains s.r.o., 2020                              | SIL OFL 1.1 | `jetbrainsmono-400.woff2` (used for all weights via variable font axis) |

The full license texts are available at:
- SIL Open Font License 1.1: <https://scripts.sil.org/OFL>

If a future design change needs a different font, add it to this table and
to the `@font-face` block in `src/styles.css`.
