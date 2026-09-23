# UI catalog scope

Read this file when generating the HTML catalog. Cover every core section below, but document the reason when an individual element does not fit the platform or project. Add conditional elements only when their need is confirmed.

The goal is to check whether a small set of shared rules works consistently across diverse elements, not to reproduce the entire component inventory of every UI library. Follow the language policy in `../SKILL.md`: localize catalog explanations as appropriate and use the project's service language for example UI copy.

## Shared presentation rules

- Include a section title, brief purpose, examples, relevant states, and usage rules.
- Align comparable elements by size and baseline. The catalog's decoration must not compete with the samples.
- Give each state a text label; do not explain states through color or shape alone.
- Label static hover-state comparisons as state examples. Also provide actual hover and keyboard-focus behavior separately.
- Use fictional data suited to the project. Do not copy actual user names, email addresses, or report content.
- Do not give each component arbitrarily different radii or shadows. Conversely, do not wrap every sample in an identical card.

## Core sections

| Section | Core elements | What to demonstrate |
| --- | --- | --- |
| 1. Foundations | Colors, font roles and type scale, spacing, radii, control sizes, borders, shadows, icons, motion | Semantic colors with token names, values, and uses; headings, body, supporting text; project-language text, relevant Latin text, and numerals; spacing bars, radius comparisons, surface levels |
| 2. Actions | Buttons, icon buttons, text links | Relevant primary, secondary, outlined, subtle, and destructive variants; small, medium, and large sizes; default, hover, pressed, focus, disabled, and loading states |
| 3. Input and selection | Text input, textarea, search input, native select, checkbox, radio, switch | Labels, help text, required-field guidance, errors, focus, disabled and selected states, and read-only states where needed |
| 4. Navigation | Tabs, breadcrumbs, pagination | Current location, selected state, long labels, keyboard operation, narrow-screen behavior |
| 5. Containers | Basic card, header/body/action card, list row, divider, accordion | Interactive versus noninteractive elements, alignment, padding and surface rules, expanded and collapsed states |
| 6. Data display | Badges, status tags, avatars, basic table | Information, success, warning, and error; avatars without images; numeric alignment; long text; narrow-screen table handling |
| 7. Feedback and states | Inline alert, toast, spinner, skeleton, progress indicator, empty state, error state | Textual status explanations, loading transitions, retry and next actions, dismissal where appropriate |
| 8. Overlays and help | Modal or confirmation dialog, tooltip | Opening, closing, Escape, focus entry and return, title and description, distinction between live and demonstrated behavior |
| 9. Composed examples | One or two small project-relevant patterns | Small compositions such as a settings form, search with a results list, or a content form, reusing the preceding tokens and components only |

## Section-specific guidance

### Foundations

Separate the brand color from semantic success, warning, and error colors. Show foreground colors such as `on-brand` alongside their backgrounds. Use the same tokens in swatches and live samples.

Show radii as shared small, medium, and large steps mapped to roles such as controls, cards, and popovers. Reserve pill shapes for suitable roles such as tags; do not turn every component into a pill.

Show the selected typography direction without implying that an unavailable font is installed or rendered. Use the scripts and numerals relevant to the service to inspect width and line height. For a Korean-language service, include mixed Korean and Latin text with numbers; do not impose Korean samples on unrelated locales.

### Actions

Button variant names must describe roles such as primary action, secondary action, cancel, and delete. Keep destructive actions distinct from brand emphasis.

Prevent repeated activation while loading without losing the visible label or accessible name. Give icon-only buttons accessible names. Demo clicks produce local feedback only, not real service operations.

### Input and selection

Placeholders do not replace labels. Associate error text near the affected field instead of only changing its color. Make checkbox, radio, and switch values actually changeable.

Prefer native input elements for web demos. Add a custom select only when its keyboard behavior is justified and implemented. Login, payment, and password examples are fictional and must not transmit data.

### Navigation

Connect tabs to actual panels and implement selection and arrow-key behavior. Do not mark simple section-jump links as ARIA tabs. Pagination should switch local sample items or clearly identify itself as a demonstration.

Add compact examples of a navigation bar, sidebar, or mobile bottom navigation only when the usage pattern warrants them. Do not expand these into a complete application shell.

### Containers and data

Provide interactive hover and focus behavior only for clickable cards. Avoid conflicts between buttons inside a card and a parent click target. Prefer simple link or button structures where possible.

Preserve table-header and data relationships. At narrow widths, use clearly described internal scrolling or a meaningful alternative layout. Do not conceal layout problems by hiding page-wide horizontal overflow.

### Feedback and overlays

Do not make a toast the only way essential information is communicated. Announce state changes to assistive technology when appropriate, without treating every nonurgent message as an urgent alert.

Move focus into a modal when it opens and return it to the trigger on close. Prevent interaction or focus from escaping behind an active modal. Make tooltips available through keyboard interaction as well as hover.

## Conditional elements

| Confirmed project need | Candidate additions |
| --- | --- |
| Data or administration tools | Filters, sorting, bulk selection, row actions, simple metric cards, description lists |
| Content or community services | Search-filter chips, author details, content-list cards, upload area |
| Commerce | Product card, price, quantity controls, options, sold-out state |
| Mobile-first services | Bottom navigation, bottom sheet, larger touch areas, safe-area examples |
| Tools that depend on scheduling or date ranges | Date or range input, step indicator, relevant empty states |

Normally limit conditional additions to two to four elements or fewer. Do not add unrelated uploads, charts, and calendars simply because they are common elsewhere.

## Excluded from the default scope

Exclude complete login, registration, or checkout flows; hero sections and marketing landing pages; advanced charts; rich-text editors; maps; kanban boards; actual uploads, authentication, or API connections; and complex table engines. Leave those to subsequent feature work or a separate skill when needed.
