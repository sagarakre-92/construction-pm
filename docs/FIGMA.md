# Using Figma for design

This project is set up so designs in Figma can be used as the source of truth for UI. Development uses the same colors, spacing, and typography as the Figma file.

## Figma file

- **Design file:** [Add your Figma file URL here]
- **Team / org:** Share the link with developers so they can use Dev Mode for specs and assets.

## Design–dev workflow

1. **Design in Figma** – Create and update screens and components in the shared file.
2. **Dev Mode** – Developers use Figma’s Dev Mode to inspect spacing, colors, typography, and copy.
3. **Token alignment** – The app’s theme (see below) is kept in sync with Figma styles so implementation matches the file.

## How the codebase matches Figma

| Figma | This project |
|-------|----------------|
| **Colors** (e.g. Primary 500, Background) | [`tailwind.config.ts`](../tailwind.config.ts) `theme.extend.colors` and [`src/app/globals.css`](../src/app/globals.css) CSS variables |
| **Spacing** | Tailwind spacing scale (default; override in `tailwind.config.ts` if Figma uses a custom scale) |
| **Typography** | Tailwind `fontSize`, `fontFamily` in `tailwind.config.ts`; set to match Figma text styles |
| **Components** | React components under `src/components/` and `src/app/`; name and structure to mirror Figma components where it helps |

### Keeping colors in sync

- In Figma: use **Styles** for colors (e.g. `Primary/500`, `Background`, `Text/Primary`).
- In code: `tailwind.config.ts` defines `primary.*` and `globals.css` defines `--foreground`, `--background`. When Figma colors change, update these to match.
- Optional: use a [Figma Tokens](https://tokens.studio/) or [Style Dictionary](https://amzn.github.io/style-dictionary/) workflow to export Figma tokens and generate Tailwind/CSS.

## Useful Figma features

- **Dev Mode** – Turn on Dev Mode to see CSS, copy values, and inspect layout.
- **Inspect panel** – Use the right-hand panel for spacing, font, and color values when building components.
- **Components & variants** – Mirror Figma component variants with React props (e.g. `variant="primary"`).

## Adding a new design token

1. Define the style in Figma (color, text, or effect).
2. Add or update the matching value in:
   - **Colors:** `tailwind.config.ts` → `theme.extend.colors` or `globals.css` → `:root`
   - **Typography:** `tailwind.config.ts` → `theme.extend.fontSize` / `fontFamily`
3. Use the token in components (e.g. `className="text-primary-600"` or `var(--background)`).
