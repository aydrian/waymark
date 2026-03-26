# Dark Mode Design Spec
**Date:** 2026-03-26
**Status:** Approved

## Overview

Add light/dark/system theme support to the Waymark Astro app. The user's choice is persisted in `localStorage` by device. A floating button (bottom-right) with a popover lets users switch modes. No flash of unstyled content (FOUC) on any mode.

---

## Architecture

### Theme application flow

1. **Blocking `<head>` script** — runs synchronously before first paint. Reads `localStorage.getItem('waymark-theme')`. If `'system'` or missing, checks `prefers-color-scheme: dark`. Adds or removes `dark` class on `<html>`.
2. **CSS variables in `global.css`** — define the full color palette for light mode as `:root` variables. A `.dark` selector on `html` overrides the values.
3. **Components** — replace hardcoded Tailwind color classes with `[var(--color-*)]` arbitrary values referencing the CSS variables.
4. **`ThemeToggle.astro`** — new floating button component rendered in `TripLayout.astro`. Handles popover UI, `localStorage` writes, and live `dark` class toggling.
5. **System mode listener** — when `'system'` is active, a `matchMedia('(prefers-color-scheme: dark)')` listener updates the `dark` class dynamically if the OS preference changes mid-session.

### Files modified / created

| File | Change |
|---|---|
| `src/styles/global.css` | Add CSS variables + `.dark` overrides |
| `src/layouts/TripLayout.astro` | Add blocking `<head>` script, render `<ThemeToggle />` |
| `src/components/ThemeToggle.astro` | **New** — floating button + popover component |
| `package.json` | Add `lucide-astro` dependency |
| `src/components/*.astro` (×11) | Swap hardcoded Tailwind colors for CSS var references |

---

## Color Palette

### CSS variables

```css
:root {
  --color-bg: theme(colors.stone.50);          /* page background */
  --color-surface: #ffffff;                    /* cards, header, sections */
  --color-border: theme(colors.stone.200);     /* dividers, borders */
  --color-text-primary: theme(colors.stone.900);
  --color-text-secondary: theme(colors.stone.500);
  --color-accent: theme(colors.emerald.500);   /* active states, today indicator */

  /* Status badge backgrounds */
  --color-status-booked-bg: theme(colors.emerald.100);
  --color-status-booked-text: theme(colors.emerald.800);
  --color-status-quoted-bg: theme(colors.amber.100);
  --color-status-quoted-text: theme(colors.amber.800);
  --color-status-pending-bg: theme(colors.sky.100);
  --color-status-pending-text: theme(colors.sky.800);
  --color-status-canceled-bg: theme(colors.red.100);
  --color-status-canceled-text: theme(colors.red.700);
}

html.dark {
  --color-bg: theme(colors.stone.950);
  --color-surface: theme(colors.stone.900);
  --color-border: theme(colors.stone.800);
  --color-text-primary: theme(colors.stone.50);
  --color-text-secondary: theme(colors.stone.400);
  --color-accent: theme(colors.emerald.400);

  --color-status-booked-bg: theme(colors.emerald.900);
  --color-status-booked-text: theme(colors.emerald.300);
  --color-status-quoted-bg: theme(colors.amber.900);
  --color-status-quoted-text: theme(colors.amber.300);
  --color-status-pending-bg: theme(colors.sky.900);
  --color-status-pending-text: theme(colors.sky.300);
  --color-status-canceled-bg: theme(colors.red.900);
  --color-status-canceled-text: theme(colors.red.300);
}
```

> Note: Tailwind v4 supports `theme()` inside CSS natively. Map markers in `TripMap.astro` use inline hex colors in JavaScript — these will need separate dark/light hex values driven by reading the current `dark` class on `<html>` at map init time.

---

## ThemeToggle Component

### Behavior

- **Placement:** Fixed, bottom-right corner (`fixed bottom-6 right-6 z-50`)
- **Icons:** Uses `lucide-astro` (new dependency). Icons per mode:
  - System: `Monitor`
  - Light: `Sun`
  - Dark: `Moon`
- **Button:** 40×40px circle, shows the Lucide icon for the current effective mode.
- **Popover:** Opens above the button on click. Contains 3 rows: System / Light / Dark, each with its Lucide icon and label. Current active mode is highlighted. Clicking an option selects it and closes the popover. Clicking anywhere outside dismisses it.
- **Icon switching:** The button icon is updated dynamically via JS by swapping the visible icon element (three icon elements rendered server-side, toggled with `hidden` class).

### localStorage

- Key: `waymark-theme`
- Values: `'light'` | `'dark'` | `'system'`
- Default (key absent): treated as `'system'`

### Script responsibilities

The component's `<script>` handles:
1. Reading current stored preference and rendering correct button icon on load
2. Toggling popover open/close
3. On selection: write to `localStorage`, toggle `dark` class on `<html>`, update button icon, close popover
4. When mode is `'system'`: attach/detach `matchMedia` listener for live OS preference changes

---

## Blocking Head Script

Inlined in `<head>` of `TripLayout.astro` before any stylesheets:

```js
(function() {
  const stored = localStorage.getItem('waymark-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored === 'dark' || (stored !== 'light' && prefersDark);
  if (isDark) document.documentElement.classList.add('dark');
})();
```

---

## Verification

1. **No FOUC:** Hard-reload on each mode (light/dark/system-dark/system-light) — no white flash before dark applies.
2. **Persistence:** Set dark mode, close tab, reopen — preference is retained.
3. **System mode:** With mode set to system, toggle OS dark/light preference — page updates without reload.
4. **All components:** Visually inspect trip page in both light and dark — no hardcoded colors remaining (text readable, borders visible, status badges legible).
5. **Map markers:** Confirm markers are readable in both modes.
6. **Popover UX:** Open popover, click away — dismisses. Select each option — icon updates, mode applies.
7. **Astro build:** `npm run build` passes with no errors.
