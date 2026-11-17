# ADR-0010: Admin UI rebrand

**Status:** Accepted
**Date:** 2026-04-21
**Linear:** [BAC-127](https://linear.app/bidon/issue/BAC-127/admin-ui-rebrand-adr)

---

## Context

The admin console was PrimeVue's Lara light-teal theme with no BidOn identity. In April 2026 the Nuxt app (`web/bidon_ui`) took on the BidOn brand: wordmark, favicons, the guideline palette, and a light/dark switch.

The brand guidelines PDF, source logos, and a JSX dump of the palette landed in the same change. The JSX file also describes Garet as the typeface and a helper that injects CSS variables at runtime. None of that is what the running UI does. Without a record, the next pass will import the JSX, ship Garet, or paint every control mountain-meadow green.

## Decision

The running theme is CSS custom properties in `web/bidon_ui/assets/css/components.css`, split between `:root` (light) and `html.dark` (dark). Components use `var(--bidon-*)`. Tailwind's `theme.extend.colors.bidon` and `boxShadow.bidon-*` in `tailwind.config.js` mirror the palette for utility classes. Those two files are the tokens. They have to be edited together.

`web/bidon_ui/branding/` is a design reference: the guidelines PDF, source logos, and `bidon-brand-tokens.jsx`. Nothing imports the JSX. `injectCSSVariables()` and `loadGaretFont()` are not called. The browser loads `public/logo-light.png`, `public/logo-dark.png`, and the favicons.

Color mode is the `dark` class on `html`, toggled by `useColorMode` (VueUse `useDark`). The sidebar logo follows that class. Two roles stay distinct:

- **Primary** (`--bidon-primary`, mountain meadow `#10AF6C`, hover moss `#0E9C62`) is the action color in both modes: PrimeVue primary buttons, `.btn-new`, checked checkboxes and radios.
- **Accent** (`--bidon-accent`) is the chrome color. Light mode uses ebony clay `#23283B` (active nav, paginator highlight, input focus, copilot user bubble). Dark mode uses mountain meadow.

Login does not follow the preference. `layouts/auth.vue` always shows `logo-light.png` and resets the variables it reads on `.auth-layout`, because custom properties set on `html.dark` inherit into every descendant.

The typeface is Inter, loaded from Google Fonts in `nuxt.config.ts`. Garet stays in the guidelines and the JSX reference.

PrimeVue stays on `lara-light-teal`. Dark mode is the `html.dark` overrides in `components.css` that remap PrimeVue surfaces onto the BidOn variables. There is no second PrimeVue theme.

Rejected: injecting tokens from `bidon-brand-tokens.jsx` at startup. Also rejected: self-hosting Garet, using mountain meadow as the accent in both modes, and replacing PrimeVue with a dark theme package.

## Consequences

- A color change that touches both a CSS variable and a Tailwind utility has to land in `components.css` and `tailwind.config.js`. Updating only `branding/bidon-brand-tokens.jsx` does not change the UI.
- Login stays light on purpose. Deleting the `.auth-layout` variable overrides lets `html.dark` restyle the login page.
- New surfaces use `var(--bidon-*)` or the `bidon-*` utilities. Hardcoded `#23283B` and `#10AF6C` were the drift the April refactor removed.
- `.btn-edit` is still a non-brand blue (`#3B82F6`). That is not a token. Do not copy it into the palette, and do not recolor it to mountain meadow just to match primary actions.
- The `html.dark` rules that retarget PrimeVue widgets and leftover `background: white` inline styles are load-bearing. A broad override on `.rounded-lg` was removed because it painted the wrong surfaces.
- `branding/` holds large reference binaries. Runtime images are the files under `public/`.
