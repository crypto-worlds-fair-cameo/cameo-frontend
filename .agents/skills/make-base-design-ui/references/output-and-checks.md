# Output contract and quality checks

Read this document before designing tokens and generating HTML, and check it again before delivery. Output requirements here are design choices of this skill; distinguish them from the accessibility thresholds and behavioral guidance in the official references at the end.

## 1. Standalone HTML

Default path: `docs/design/base-ui.html`.

- Include `<!doctype html>`, an appropriate `lang`, UTF-8 encoding, a viewport declaration, and a document title. Match `lang` to the document's main language and mark differently localized example regions when appropriate.
- Put CSS in `<style>` and required JavaScript in a regular inline `<script>`. Do not require external module imports or build output.
- Do not depend by default on external CDNs, remote fonts, remote images, separate CSS or JavaScript, or JSON loaded through `fetch()`.
- Use inline SVG with consistent strokes and sizes, or simple CSS, for demo icons. Do not mix emoji as inconsistently styled UI icons.
- Render with available system fonts and suitable fallbacks. If the recommended font is unavailable, distinguish the recommended font from the font used in the preview. Do not include font files in the deliverables.
- Core UI must work through `file://`. If optional browser features such as clipboard or storage are used, handle failure and keep the catalog reviewable without them. Do not require persistent storage merely to switch themes.
- Prevent form submission from navigating or sending network requests; perform local demonstrations only. Label timer-driven loading or progress states as demos.
- Insert user-supplied values safely as text. Do not put arbitrary input directly into `innerHTML`.

At the top, provide a compact project and design-decision summary plus section navigation. Do not add unnecessary hero sections, promotional copy, or autoplay animation to the catalog itself.

When both themes were agreed, provide a light/dark switch. Do not invent an unused second theme when only one was selected.

Follow the language policy in `../SKILL.md`. Write catalog explanations in the explicitly required documentation language or, otherwise, the user's conversation language. Keep example UI copy in the project's service language; localize example templates rather than defaulting to English because this file is English.

## 2. Token rules

During catalog generation, CSS custom properties embedded in the HTML define the preview values. Swatches and samples must reference the same variables. Displayed numbers and colors must match the actual CSS.

After real-project integration, the approved application token file becomes the source of truth. Maintain the HTML as a standalone snapshot of that approved version. Do not break offline `file://` operation by replacing its inline styles with external CSS imports. When the HTML and app use different token names or value formats, document the mapping and compare the rendered values. Mark preview-only changes as pending integration.

| Type | Example names | Rule |
| --- | --- | --- |
| Primitive colors | `--palette-neutral-100`, `--palette-brand-600` | Define only necessary shades; do not inflate the palette. |
| Semantic colors | `--color-background`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-brand`, `--color-on-brand`, `--color-focus` | Elements reference roles rather than raw values. |
| Status colors | `--color-success`, `--color-warning`, `--color-danger`, with background and foreground variants | Define each status's text/background pair together. |
| Typography | `--font-body`, `--font-heading`, `--text-body`, `--text-small`, `--leading-body` | Define weight, line height, and role as well as size. |
| Spacing | `--space-1` through `--space-8` | Preserve an existing scale; otherwise derive one from a consistent base unit. |
| Shape | `--radius-control`, `--radius-card`, `--radius-overlay` | Map role-specific radii to a shared scale. |
| Size | `--control-height-sm`, `--control-height-md`, `--control-height-lg` | Distinguish visual size from the actual interaction target. |
| Surfaces | `--border-width`, `--shadow-sm`, `--shadow-overlay` | Maintain the agreed visual intensity. |
| Motion and stacking | `--duration-fast`, `--duration-base`, `--easing-standard`, `--z-overlay` | Define only necessary levels and support reduced motion. |

These names are examples. Reuse existing project tokens with the same meaning. Do not replace the entire project's token naming system without a user decision.

For two themes, switch semantic values through selectors such as `:root` and `[data-theme="dark"]`, following existing conventions when present. Do not invert only the body while leaving forms, modals, and status colors unchanged.

Do not repeat numeric and color values independently across components. Small SVG geometry values and explicit exceptions are acceptable, but distinguish them from system-level rules.

## 3. Design-reference document

Default path: `docs/design/base-ui.md`. For an HTML-only request, include this information in the HTML's explanatory sections instead.

The outline below is an English authoring template, not a requirement to produce an English document. Use an explicitly required project documentation language, or otherwise the user's conversation language. Preserve token names and paths.

```markdown
# Shared UI foundation

## Project context
Purpose, users, platform, service language, and paths of local reference documents.

## Approved design decisions
Choices by axis, existing rules to preserve, reasoning, and whether each choice
was selected by the user, delegated, or derived.

## Tokens and shared rules
Core tokens and roles; token location in the catalog;
after integration, the source file path and HTML snapshot version;
button, input, card, and state mappings and exceptions.

## Catalog scope
Included sections, conditional additions, omitted elements, and reasons.

## Real-project integration
Status: not applied / pending integration / tokens connected /
applied through the named shared components.
User-approved scope, changed files, existing-token mappings, affected screens.
Preserved rules, unconnected components, and out-of-scope work.
Approved version and the changes that would need reverting.
Do not treat HTML examples as production-ready accessibility or business logic.

## Validation
Checks actually performed, results, unperformed checks, and unresolved issues.

## Change log
What changed and which shared elements it affects.
```

Do not create application components or implementation style files during the catalog phase. If integration is approved in the final step, add or modify only approved files according to `project-integration.md`. Connect `base.css`, the existing token source, or framework mappings without creating competing definitions. Generate separate CSS, JSON, or other files only within the explicit scope, and verify that HTML, documentation, and the app represent the same approved version.

## 4. Responsive layout and readability

Unless the project specifies other targets, inspect widths of 375px, 768px, and 1440px, plus a narrow width of 320px. These are this skill's sample checks, not a guarantee of compatibility with every device.

Avoid unintended horizontal scrolling across the whole page. Content that needs width, such as tables, should use explicit internal scrolling. Collapse side navigation or place it above the content on narrow screens so it does not obscure examples.

At 200% text enlargement, check whether essential copy, buttons, or input values are clipped. Test long service-language text, relevant Latin strings, and numbers. For a Korean service, include long Korean copy. Do not mark an unperformed check as complete.

## 5. Accessibility and states

- Apply WCAG's 4.5:1 contrast threshold for normal text and 3:1 for large text. Check whether large text is approximately 24 CSS px or greater, or approximately 18.7 CSS px or greater when bold. A heading does not automatically qualify for the 3:1 threshold.
- Calculate actual text/background combinations rather than evaluating a color in isolation. Check non-text contrast for required UI boundaries and state indicators. Account for the composited background when transparency or gradients are involved.
- Aim for 44 by 44 CSS px interaction targets for small touch controls where practical. This is a recommendation of this skill. WCAG 2.2 AA criterion 2.5.8 covers 24 by 24 CSS px targets or exceptions such as spacing; do not describe 44px as the mandatory AA minimum.
- Prefer native buttons, links, and form controls. Verify associated labels, help text, and errors. Do not remove a visible focus indicator.
- Support Tab and Shift+Tab navigation, Enter or Space activation as appropriate, and arrow keys and Escape where needed. Do not let sticky navigation or modals obscure focus.
- Prefer native `<dialog>` where appropriate. Actually test the accessible name, initial focus, focus containment, background inactivity, Escape dismissal, and return of focus to the trigger.
- Make tooltips accessible through the keyboard. Do not provide essential explanations only in tooltips.
- Do not express selection, error, or success through color alone. Use appropriate live regions and state attributes for loading, toasts, and input errors when needed.
- Remove or reduce unnecessary movement under `prefers-reduced-motion` without removing information or state changes.

These checks do not replace a complete WCAG conformance assessment. Criteria have exceptions, including for some disabled controls; automated numerical checks alone do not establish conformance.

## 6. Pre-delivery checklist

### Always check

- [ ] Project understanding is based on inspected documents or user answers, and unresolved design choices were not silently decided.
- [ ] User-facing communication follows the user's request language or explicit language preference; example UI copy follows the service locale, not the English skill source.
- [ ] HTML exists as an actual file without external runtime, CDN, or server dependencies.
- [ ] Agreed theme, shape, density, and typography are reflected in tokens and all sections.
- [ ] All nine core sections are covered, or reasons are documented for unsuitable elements.
- [ ] Main control variants and relevant states are comparable.
- [ ] Demonstrations are distinct from actual business operations, and no external data is transmitted.
- [ ] HTML and the design-reference document agree on decisions and core tokens.
- [ ] Application changes are limited to the files and scope explicitly approved for the final integration step. Catalog-only work leaves application files unchanged.
- [ ] AGENTS.md, dependencies, routes, and business logic were not changed without approval.
- [ ] If integration was selected, the post-integration checks in `project-integration.md` were performed or reasons for not running them were recorded.

### Actually run when tools are available

- [ ] Open the HTML through `file://` and check for console errors and network dependencies.
- [ ] Inspect wide and narrow layouts, long copy, and enlarged text in the rendered page.
- [ ] Operate included demos such as tabs, forms, switches, accordions, modals, and toasts.
- [ ] Verify main examples and modal focus entry and return using the keyboard.
- [ ] Calculate actual foreground/background contrast and fix necessary combinations.
- [ ] Check both themes when present, and reduced-motion behavior where applicable.

Record each item as `pass`, `fail`, `not run`, or `not applicable`, localizing user-facing labels. Explicitly mark screen-reader or browser-specific checks as not run when they were not performed. The existence of a checklist item does not make it a passing result.

## Official references

- W3C, Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C, Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- W3C, Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C APG, Dialog (Modal) Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

When consulting external references, read only the relevant guidance. Do not claim to have checked current documentation when you did not read it or had no tools to access it.
