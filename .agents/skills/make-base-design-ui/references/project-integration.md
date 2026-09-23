# Real-project integration: recommended structure and conflict handling

Read this when delivering the catalog and proposing real-project integration. Paths and structures below are recommendations, not mandates. Applicable project instructions, the existing stack, and edit permissions take precedence. Before approval, read only for planning; do not write application files. Localize questions and reports according to `../SKILL.md` while preserving actual code identifiers and paths.

## 1. Preflight and scope approval

Reuse applicable AGENTS.md instructions, project documents already inspected, and decisions in the current conversation. Do not reread the entire repository. Inspect only the relevant parts of:

- The target app or package, paths the implementer may edit, and existing uncommitted changes. Preserve existing changes; do not automatically commit, reset, or force a restore.
- The actual loaded global CSS entry point and import graph. Do not assume that a file is the entry point merely because it is named `app.css`.
- Existing token files, definitions and references of the same variables, theme providers and selectors, font loading, and how shared components consume styles.
- Installed versions and configuration of styling tools such as Tailwind, plus existing build scripts. Do not insert current syntax or upgrade versions without inspecting the installed version.
- Whether integration affects the whole document or only a particular app, path, or container, and how shared-token changes affect other screens or packages.

Briefly summarize significant changes as `current definition → approved value or handling → affected scope`. For example, changing `--primary` may affect other buttons that reference it. When many conflicts exist, recommend a narrower integration plan rather than changing everything at once.

The final question selects one scope: no application changes, tokens and global foundations, or those foundations plus named shared components. Do not re-ask a scope the user already explicitly approved. Confirm again only when changing an existing decision or expanding the scope.

## 2. Preferred file organization

1. If `tokens.css`, `theme.css`, a token section in global CSS, or a shared theme package already exists, preserve and extend that source. Do not create a second token system with the same meaning.
2. If no dedicated token structure exists and separation is useful, recommend placing shared tokens and minimal global defaults in `base.css`, imported once by the existing global entry point.
3. In a small project or one whose conventions use a single global CSS file, integrating into a clearly marked section of that file is also acceptable. Do not add files only for the sake of separation.

Example structure, not fixed paths:

```text
src/
├── styles/
│   └── base.css       # Shared tokens and approved global defaults
├── app.css            # Existing global entry point and styling-tool connection
└── components/
    └── ui/            # Edit or add only when shared-component work is approved
```

Plain CSS import example:

```css
/* app.css: position within the existing imports and tool-processing rules. */
@import "./styles/base.css";

/* Preserve existing application rules. Review conflicting tokens separately. */
```

In standard CSS, `@import` must precede style declarations and most at-rules. Account for the exceptions for `@charset` and statement-form `@layer` ordering declarations. Do not blindly append an import at the end of global CSS. With a preprocessor or bundler, check the applicable version's processing rules and the generated CSS.

`base.css` and `@layer base` are different concepts. Do not mechanically wrap the entire file in `@layer base`. Position token definitions, Tailwind theme mappings, and base styles according to the existing project setup.

## 3. What belongs in the global foundation

Tokens may include semantic colors, font roles, type and spacing scales, radii, control sizes, borders and shadows, motion, and stacking levels. Define only shared values that are actually needed.

Limit global defaults to approved values such as font family, body text color, background, and baseline line height. Adding tokens does not automatically restyle every existing element. Check whether elements, mapped utilities, or components actually consume those values.

- Do not duplicate or remove an existing reset or Preflight, font loader, focus rules, or reduced-motion rules.
- Do not force shared padding or radii onto `*`, or overwrite every `button`, `input`, or card-like `div` with one style.
- Include global background, text, and font changes in the approval plan because they can affect existing screens. Apply only the necessary scope; keep component states and layout within the components' existing implementation model.
- Do not import catalog section layout, sample-wrapper cards, state-preview classes, or demonstration JavaScript into the app.

## 4. Overrides and conflicting definitions

File separation provides an organizational boundary, not style isolation. The CSS cascade involves origin and importance, layers, specificity, scope proximity, and source order. Also inspect custom-property inheritance and theme scope.

1. Inspect existing tokens by name, meaning, and value format. Reuse names and consumption contracts when their meaning matches. Add names only when necessary; do not force a new prefix across the entire system.
2. Do not repeat the same token across two files under identical selectors, conditions, and layers just so the later declaration wins. Update the approved source definition, or consolidate it through an approved structural change. Preserve intentional dark-theme or brand-specific overrides as separate definitions.
3. Preserve existing CSS layer order. Within the same author origin, normal unlayered declarations take precedence over normal layered declarations; important declarations reverse layer priority. Do not assume that a later file or an extra layer solves a conflict.
4. Do not hide conflicts with `!important`, escalating specificity, unconditional addition of `.dark`, or resetting the entire Tailwind theme.
5. Explain the impact of intentional changes to existing tokens and change only approved values. Narrow or defer changes that propagate to other apps.
6. For partial integration, new tokens or an approved theme container may provide the required scope. Connecting existing components to new tokens requires component-edit approval. Check that portaled elements such as modals also receive the intended theme.

## 5. Connect to the actual stack

### Plain CSS, CSS Modules, or Sass

Preserve the existing styling pipeline. Put shared values in global scope or an approved theme scope and let component styles consume them through `var(...)`. CSS Modules do not automatically isolate global `:root` tokens. Do not force a Sass project into a different plain-CSS organization.

### Tailwind CSS 4

Preserve the existing CSS entry point and import setup. Connect tokens used by utilities to the required `@theme` namespaces. Consider `@theme inline` for mappings that reference other CSS variables. Keep `@theme` at the top level, not inside selectors, media queries, or ordinary layer blocks.

Do not confuse a plain `:root` declaration with generation of new Tailwind classes. Inspect the mapping between semantic variables and actual consuming classes such as `bg-primary`, `text-foreground`, and `rounded-*`. Do not create self-referential aliases.

Do not reset the whole theme with `--*: initial` or change wide-reaching values such as `--spacing` without approval. Check how font, breakpoint, and shared-radius changes affect existing classes.

### Tailwind CSS 3

Preserve the existing `theme.extend` and CSS-variable integration in `tailwind.config.*`. Extend only necessary mappings for colors, fonts, radii, and similar values. Do not insert version 4 `@theme` syntax or turn this task into an upgrade.

When color channels are consumed through expressions such as `hsl(var(--primary))` or `rgb(var(--primary) / <alpha-value>)`, preserve that contract. Do not replace channel values with a complete `oklch(...)` function or HEX value that makes the surrounding color function invalid. Test opacity combinations actually used by the project.

### Existing shared components such as shadcn/ui

Read the installed configuration and actual style files. Prefer existing semantics and theme selectors for variables such as `--background`, `--foreground`, `--primary`, `--primary-foreground`, and `--radius`. Do not replace the full setup without approval when current documentation examples differ from local configuration.

Record which components already consume these tokens and therefore respond to token changes alone. Do not assume fixed color, padding, or radius classes are automatically connected. Only when component work is approved, update their styling while preserving existing variant and size structures, props, and accessibility behavior.

### React, Vue, and environments without global CSS

Do not add a styling tool merely because the app uses React or Vue. For CSS-in-JS, use the existing theme or provider model. For targets such as React Native that do not consume global CSS files, do not impose `app.css`; propose integration with their existing JavaScript or TypeScript theme and token system. The HTML catalog is a visual reference, not a native implementation.

## 6. When named shared components are included

Prefer existing components from the approved minimal list, such as Button, Input, or Card. Create a new file only when no component serves that role and its creation is approved.

Connect color, typography, sizes, and states to shared tokens while preserving behavior, props, variants, and accessibility contracts. Do not add business features, routing, form-validation policy, or data requests. Do not perform an arbitrary page-wide redesign or bulk replacement of all hardcoded styles.

Do not treat permission to edit CSS as permission to change React files. If a required file is outside allowed paths, record that connection as not applied and clarify only the additional change needed.

## 7. Synchronize sources and previews; handle reruns

After integration, the app's existing or approved token file is the source of truth. Embed a snapshot of the same approved values and required aliases in the standalone HTML. Do not blindly overwrite application values from the HTML on every run.

Record the source path, preview-to-app token mappings, approved scope, integration status, and unconnected elements in the document. When value formats differ, compare actual rendered values such as computed colors and sizes. Mark preview-only updates as pending integration; applying them again requires approval for that scope.

Do not duplicate imports, token declarations, theme aliases, or component files on reruns. Read existing human changes first. Preserve unresolved conflicts and ask only about the specific conflict.

## 8. Validate and report after integration

- Verify that the diff is limited to approved files and scope. Check that the source and imports are connected once, without unintended duplicate tokens, circular references, or lost dark-theme definitions.
- Run available project build, lint, type-check, and relevant test commands. If they require package installation or network operations, do not proceed automatically; report why the check was not run and what is required.
- With browser tools, inspect representative existing screens and approved shared components in default, focus, hover, disabled, and error states, at narrow and wide widths, in the agreed themes. Use actual computed styles to verify important token and utility connections.
- Distinguish preview-to-app value agreement, unconnected components, pre-existing test failures, and failures caused by this change.
- Record actual changed files, applied scope, locations of changes that would need reverting, and checks not run. Do not suggest removing unrelated user changes when reverting this work.

Without application sources or execution tools, provide integration guidance only to the extent supported. Distinguish file creation, static inspection, successful builds, and rendered-screen validation. Creating a token file does not establish that the entire UI has been integrated.

## Official references

Consult only relevant portions of official documentation for the installed version. Distinguish these sources from the organizational recommendations of this skill, and do not assert unverified current behavior.

- Tailwind CSS, Theme variables: https://tailwindcss.com/docs/theme
- Tailwind CSS 3, Customizing colors: https://v3.tailwindcss.com/docs/customizing-colors
- shadcn/ui, Theming: https://ui.shadcn.com/docs/theming
- MDN, @import: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@import
- MDN, @layer: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@layer
