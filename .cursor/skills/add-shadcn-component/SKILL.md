---
name: add-shadcn-component
description: Add a new shadcn-style UI primitive backed by Radix UI to src/components/ui/ in the ORAT project. Use when the user asks to add a new UI component, install a shadcn component, or wrap a Radix primitive (e.g. tooltip, popover, accordion, toast, switch, slider).
---

# Add a shadcn-style UI primitive

This project uses Radix UI primitives wrapped in shadcn-style files under
`src/components/ui/`. There is **no `shadcn` CLI** wired in — components are
hand-authored to match our existing patterns.

## Workflow

```
- [ ] 1. Check it doesn't already exist in src/components/ui/
- [ ] 2. Install the @radix-ui/react-* package (if needed)
- [ ] 3. Create src/components/ui/<name>.tsx using button.tsx as the template
- [ ] 4. Use cva for variants and cn() for class merging
- [ ] 5. Export both the component(s) and the variants object
- [ ] 6. Run `npm run lint` and `npm run build`
```

## Step 1 — Check for duplicates

```bash
ls src/components/ui/
```

We already have: badge, button, checkbox, dialog, dropdown-menu, input,
label, select, tabs, textarea. Don't recreate what exists.

## Step 2 — Install Radix package

Most shadcn-style primitives wrap a `@radix-ui/react-*` package. Examples:

| Component  | Package                          |
|------------|----------------------------------|
| Tooltip    | `@radix-ui/react-tooltip`        |
| Popover    | `@radix-ui/react-popover`        |
| Switch     | `@radix-ui/react-switch`         |
| Accordion  | `@radix-ui/react-accordion`      |
| Slider     | `@radix-ui/react-slider`         |
| Toast      | already covered by `sonner` — use that, don't add Radix toast |

```bash
npm install @radix-ui/react-tooltip
```

## Step 3 — Author the file

Use `src/components/ui/button.tsx` as the canonical template. Stateless
primitives (Badge) follow the simpler shape; compound primitives (Dialog,
Select) follow the multi-export shape. **Look at an existing file of the
same complexity first.**

Required ingredients in any new file:

```tsx
"use client"; // ONLY if the underlying Radix primitive needs it (most do)

import * as React from "react";
import * as Primitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tooltipContentVariants = cva(
  "z-50 overflow-hidden rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white shadow-md",
  {
    variants: { /* … */ },
    defaultVariants: { /* … */ },
  }
);

const TooltipProvider = Primitive.Provider;
const Tooltip = Primitive.Root;
const TooltipTrigger = Primitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content> & VariantProps<typeof tooltipContentVariants>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <Primitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(tooltipContentVariants({ className }))}
    {...props}
  />
));
TooltipContent.displayName = Primitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

## Step 4 — Style rules

- **Tailwind only.** Use the project's named tokens (`primary-600`,
  `slate-*`, etc.) — see `tailwind.config.ts`. No raw hex.
- **`cn()` always.** Never concatenate class strings.
- **CVA for variants** when there's more than one visual style.
- **Match button.tsx's variant naming**: `default | destructive | outline |
  ghost | link` and sizes `default | sm | lg | icon` — only deviate when the
  primitive genuinely needs different variants (e.g. Badge already does).

## Step 5 — Exports

Always export:
- The component(s)
- The variants object (e.g. `tooltipContentVariants`) for downstream
  composition

## Step 6 — Verify

```bash
npm run lint
npm run build
```

Both must pass before declaring done.

## Anti-patterns

- ❌ Adding a non-Radix UI library (Headless UI, Mantine, MUI, Ariakit).
- ❌ Inline styles. Tailwind only.
- ❌ Forgetting `"use client"` on a Radix-backed component (most need it).
- ❌ A component that imports `next/headers` or server-only modules.
- ❌ Adding a Toast primitive — use `sonner` (already installed, see
  `import { toast } from "sonner"`).
