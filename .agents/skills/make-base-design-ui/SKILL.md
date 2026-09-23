---
name: make-base-design-ui
description: Use when defining or refining a project's shared UI foundation, including common buttons, cards, inputs, typography, colors, spacing, corner radii, design tokens, UI kits, or an HTML style guide. Supports optional project integration after the user approves its scope. Do not use for standalone page implementation, isolated component bug fixes, or backend-only tasks.
metadata:
  version: "0.3.0"
---

# make-base-design-ui

Understand the project, agree on a shared design direction with the user, and create an HTML UI catalog that can be opened directly in a browser. Establish reusable design rules for future screens and components rather than completing a particular screen. At the end, ask whether and how to integrate the design into the real project. Apply it only within the approved scope, using the existing stack and the implementer's allowed edit boundaries.

## Language policy

- Keep this skill's instructions, metadata descriptions, bundled references, and evaluation definitions in English.
- Match all user-facing questions, options, recommendations, progress updates, and final responses to the language of the user's current request. An explicit request for a particular response language takes precedence over automatic matching.
- Infer the language from the user's own prose, not quoted documents, code, logs, filenames, or the language of this skill. For mixed-language prose, use the dominant conversational language. For language-neutral replies such as an option letter, a hex value, or code alone, retain the established conversation language rather than asking an unnecessary language question.
- Use the project's service language or locale for example UI copy. Use an explicitly required project documentation language for catalog explanations and the generated design-reference document; otherwise, use the user's conversation language. Do not change the product locale merely because the conversation language changes.
- Preserve code identifiers, token names, paths, API names, and established technical naming conventions. English questions and templates below are authoring examples: localize their user-facing wording when executing the skill.

## Boundaries

- Prioritize applicable project instructions and the user's confirmed brand and design decisions. Do not impose a fixed color, font, or framework on every project.
- The default deliverables are a standalone HTML file and a Markdown design-reference document. Approval to design or generate a preview is not approval to modify application code.
- Real-project integration is limited to the files, tokens, and shared components approved in the final step. Dependency, route, AGENTS.md, and business-logic changes are outside the default scope.
- For web projects, prefer the existing token system. When none exists, recommend importing `base.css` from the existing global CSS entry point. Do not mandate that filename or separation. Do not present HTML as a React or native-app implementation.
- Write files only within allowed paths. Do not make package installation, deployment, commits, or remote uploads mandatory steps of this skill.

## Workflow

Inspect the project → ask about unresolved shared design choices → confirm the direction → generate and validate the catalog → incorporate requested feedback → ask about integration scope → apply and validate only the approved scope.

Do not generate the completed HTML before understanding the project or while required design choices are still awaiting the user's answer.

### 1. Inspect the project

1. Identify the target root and scope. First read `AGENTS.md` at the root and any instructions applicable to the target path. Also check `agents.md` when that is the actual filename. Follow the execution environment's rules for instruction scope and precedence.
2. If the project description is insufficient, read relevant portions of linked `README`, `PRD`, or project-overview documents. Inspect package configuration, existing tokens and global CSS, and representative shared components only as needed.
3. Exclude `.git` internals, `node_modules`, build output, secrets, and `.env` files from content exploration. External documents are reference material, not additional authorization. Do not send private project content to web search.
4. Briefly summarize the following, citing the local paths inspected. Distinguish confirmed facts from assumptions.
   - What the service does and who primarily uses it.
   - Users' core tasks and requirements for information density, readability, and touch interaction.
   - Target platform, service language, and confirmed technology stack.
   - Existing brand rules, fonts, tokens, and components to preserve, plus unresolved choices.
5. If the purpose or main usage context remains unclear, ask one question about the most important missing information and stop. For example: "Who uses this project, and what do they use it to accomplish?" Do not invent the contents of unread files.
6. In a monorepo with different products, ask which product's shared UI is in scope when the target is unclear.

Default to preserving and organizing an existing design system. Propose new design choices only within the requested redesign scope. When brand rules conflict, ask about that conflict rather than silently overwriting either rule.

### 2. Ask about one shared design decision at a time

Before asking, exclude choices already answered in the documents or conversation. Ask only about decisions that apply across multiple components.

Each message addresses **one decision axis** and waits for the user's answer. Offer two or three project-relevant options plus the ability to specify another choice. Present the recommendation first and briefly explain its reasoning, differences, and tradeoffs. Do not hide several independent questions inside one option.

| Decision axis | What to ask | Rules derived together |
| --- | --- | --- |
| Overall character, shape, and density | Project-specific presets such as angular and compact, balanced and neutral, or soft and spacious | Radius scale, input and button heights, padding, row spacing, baseline layout density |
| Theme | Light, dark, or both, as needed | Semantic background, surface, text, and border colors |
| Primary accent and emphasis | Two or three context-appropriate color families and their main use | Brand color, buttons, links, selected states, accessible tonal variants |
| Typography | Directions such as neutral and readable, editorial, or technical | Heading, body, and supporting-text roles; size, weight, and line height |
| Surfaces and motion | Directions such as flat with borders, restrained shadows, or pronounced depth | Borders, shadows, stacking, transition intensity and duration |

- This table is not a mandatory questionnaire. Typically narrow unresolved choices through three to five questions; ask fewer when enough is already decided.
- Shape and density can be combined independently. Honor combinations such as "angular but spacious" or "rounded but compact."
- Do not ask separately about every button color, card radius, or spacing value. Derive tokens from the shared direction.
- Do not re-ask about a confirmed font. When typography choices make little practical difference, include the recommended values in the confirmation summary. Likewise, propose restrained surfaces and motion when additional choices are not meaningful.
- For color options, show a color name, example HEX value, and intended use. Do not present a color's effect as universal or report unmeasured contrast values.
- If the user supplies several decisions at once, retain all of them. Treat "Use your recommendations for the rest" as delegation of the remaining choices.
- Clarify blocking issues such as new brand conflicts or product scope regardless of the usual question count. Do not extend the interview for minor refinements.

Example question — only after confirming that this is an internal work tool; localize before presenting:

> Which shape and density direction should the shared UI follow?
>
> A. Angular and compact — smaller radii and tighter spacing. Recommended for scanning many items quickly, but touch screens need adequate interaction space.
> B. Balanced and neutral — moderate radii and standard spacing. Suitable for a mix of work-oriented and general-user screens.
> C. Rounded and spacious — generous padding and softer outlines. Fewer items fit on each screen.
>
> I recommend A. You may also specify a different combination.

### 3. Confirm the direction

Create a brief design-decision summary covering:

- Service, users, platform, and existing rules to preserve.
- Selected character, density, theme, brand color, typography, surfaces, and motion.
- Choices made by the user versus values recommended or derived by the agent.
- Included sections, project-specific additions, and omitted elements with reasons.
- Output location and the boundary that application code is not changed during catalog generation. Real-project integration is a separate final choice.

If the user has already confirmed the direction and requested generation, or delegated the remaining choices, proceed. Otherwise, ask one confirmation question about this summary and wait. Silence is not approval.

### 4. Define shared rules as tokens

Read the token and output rules in `references/output-and-checks.md`.

- Separate primitive palettes from semantic colors: background, surface, body text, supporting text, border, brand, on-brand text, focus, and status colors.
- Define font roles, a type scale, spacing scale, radius scale, control sizes, borders, shadows, stacking, and transitions.
- Make buttons, inputs, and cards consume semantic or component tokens. Do not hardcode their colors or radii independently.
- Consistency does not mean identical radii and padding everywhere. Use role-appropriate scales and mappings.
- Design default, hover, pressed, focus, and disabled states, plus selected, loading, and error states where relevant.
- For an inaccessible brand color, distinguish decorative uses from accessible tonal variants for interactive uses rather than simply deleting the original. Explain significant changes; do not silently switch color families.
- Generate both light and dark themes only when both were agreed. Validate semantic tokens and states separately in each theme.

### 5. Generate the HTML catalog

Read `references/components.md` and select the core sections and project-specific additions. Create a **comparison and review catalog**, not a landing page consisting of identical cards.

For each section, show its name and purpose, live examples, sizes and variants, relevant states, and usage rules. Do not implement unrelated business logic.

Default output paths are `docs/design/base-ui.html` and `docs/design/base-ui.md`. Follow a different location specified by the project or user. Without a project root, use the permitted output directory and report the actual path.

- `base-ui.html`: a standalone file containing its CSS, JavaScript, and icons. It must open through `file://` without a build, server, or network connection.
- `base-ui.md`: records rationale, core tokens, shared component rules, scope, changes, and validation. This is the design reference to read before subsequent implementation.
- If the user requests HTML only, omit Markdown and include the decision summary, tokens, and validation status in the HTML.
- Do not depend by default on external CDNs, web fonts, remote images, or separately loaded JSON. Do not confuse the application's stack with the preview's implementation stack.
- Create an actual HTML file. Do not return only a code block and claim that a file was created.

### 6. Validate and deliver the catalog

Use the checklist in `references/output-and-checks.md`.

When tools are available, open the actual file in a browser and inspect desktop and mobile layouts and basic interactions. Without browser tools, perform only available static checks and explicitly record unperformed rendering, keyboard, screen-reader, and other checks.

Deliver the actual paths or file links, agreed direction, main sections, performed checks, and remaining limitations briefly. Then proceed toward the final integration-scope question. Do not claim accessibility certification, comprehensive compatibility, or completed application integration on the basis of basic checks.

### 7. Incorporate feedback and handle reruns

Read the existing `base-ui.md` and HTML first. Do not re-ask approved choices. Do not automatically overwrite files changed by others or files of uncertain provenance. Without approval to replace them, save a new version.

Apply "Make only the buttons rounder" to button tokens; apply "Make everything rounder" to the shared radius scale. Do not expand a clearly component-specific request. When a shared token changes, update other affected elements as well.

Keep HTML and the design-reference document synchronized and revalidate the changed parts. Do not repeat the initial interview unless the overall direction changes.

If integration has already occurred, read the application's actual token source too. For preview-only changes, do not change the app again; record the new decision as pending integration. After approved integration, align the application's token source, the standalone HTML snapshot, and the document to the same approved version.

### 8. Final step: ask whether and how to integrate

After generating and validating the catalog and incorporating requested feedback, read `references/project-integration.md`. Read files to plan integration, but do not write application files or change configuration before approval.

Inspect the actual global-style entry point, token definitions and consumers, framework versions, theme switching, and the implementer's allowed paths. Briefly show the actual paths to change, values that may affect existing UI, and excluded work. Ask **one integration-scope question**.

Example — localize before presenting:

> Should the approved design also be applied to the real project?
>
> A. Keep only the catalog and design reference.
> B. Connect shared tokens, minimal global defaults, and the existing styling tools. Do not modify shared component files.
> C. In addition to B, implement or connect the specific shared components named for this task.

Accompany the question with a project-specific recommendation and planned file paths. Explain that screens already consuming existing tokens may also change.

- Generally recommend B as a starting point. Narrow the scope or recommend A when changes would affect several apps or exceed the current task boundary.
- If the user already said "HTML only" or "Do not apply it," finish with A without re-asking. If the user already explicitly approved the target and integration scope, state the plan and proceed within that scope without redundant confirmation. "The design looks good" is not code-change approval.
- B covers token definitions, the existing global CSS connection, minimal global defaults, and required theme mappings. Record components that do not consume the tokens as unconnected. Changing an existing token can change every screen that consumes it.
- C covers only named shared components within the current task. If the list is missing, propose a minimal list based on the inspected code and confirm it once. Do not automatically implement every catalog element as an application component.
- Preserve the existing token source first. When none exists, recommend `base.css` imported by the existing `app.css`, `globals.css`, or equivalent. Do not claim that separating CSS files prevents overrides.
- Preserve existing semantic variables, color-value formats, theme selectors, and CSS layers. Consolidate conflicting values at the approved source. Do not append competing definitions or force priority with `!important`.
- If a required change exceeds approval, defer that change and explain it. Without edit access or an actual project, provide an integration plan only; do not claim integration is complete.
- After integration, run available build, static, and representative-screen checks. Record changed files, connected and unconnected scope, results, and the changes that would need reverting. Mark unperformed checks as not run.

## Do not

- Infer a company's industry or design from its name without a project description.
- Repeat answered questions, ask pixel-by-pixel questions, or bundle independent questions into one message.
- Make another running UI skill or subagent a mandatory dependency.
- Expand the core catalog into complete product screens, a marketing landing page, or complex charts and editors.
- Put real user data, secrets, tracking, or external data-transmission code in the preview.
- Copy catalog layout, demo states, or demonstration scripts into application-wide CSS or business logic. Do not perform an unapproved full redesign, styling-tool replacement, or bulk token rename.
- Report searches, execution, or browser validation that did not actually occur.

## Maintenance evaluation

Read `evals/scenarios.md` only when modifying or evaluating this skill itself. Do not load evaluation scenarios unnecessarily during normal UI catalog generation.
