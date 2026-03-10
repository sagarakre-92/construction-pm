# Design tokens (Figma ↔ code)

Reference for keeping Figma and the app in sync. Update this table when you add or change tokens.

## Colors

| Token / usage      | Figma style (example) | Code |
|--------------------|------------------------|------|
| Primary (buttons, links) | Primary / 500, 600, 700 | `tailwind.config.ts` → `theme.extend.colors.primary` |
| Background         | Background              | `globals.css` → `--background` |
| Text / foreground  | Text Primary            | `globals.css` → `--foreground` |

## Where to edit in code

- **Tailwind theme (colors, fonts, spacing):** [`tailwind.config.ts`](../tailwind.config.ts)
- **CSS variables (e.g. background, foreground):** [`src/app/globals.css`](../src/app/globals.css)

## Optional: export from Figma

To automate token sync:

1. Use [Figma Tokens](https://tokens.studio/) (or similar) and export JSON.
2. Run a script or [Style Dictionary](https://amzn.github.io/style-dictionary/) to generate `tailwind.config` or CSS variables from that JSON.
3. Add the export step to your design workflow and document it in `docs/FIGMA.md`.

Until then, keep this file and the Tailwind/globals theme updated manually when Figma styles change.
