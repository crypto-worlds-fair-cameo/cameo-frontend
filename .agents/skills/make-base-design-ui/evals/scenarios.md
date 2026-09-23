# Skill behavior evaluation scenarios

This document defines manual evaluations for skill maintenance. Writing this file does not mean that an actual agent has passed these scenarios. Initial status: **all execution scenarios below are not run**.

Use separate temporary projects and compare skill-disabled and skill-enabled runs with equivalent inputs where possible. Do not modify the user's existing work for evaluation purposes.

For each case, record the execution environment, prompt, actual response, created or changed files, and a pass, fail, or not-run result. Do not copy expected behavior into the observed-results field.

These definitions and quoted examples are authored in English. When a case specifies another input language, provide an actual prompt in that language during the evaluation; an English paraphrase alone is not a multilingual test.

## 1. Project without a description

Input: AGENTS.md contains coding conventions only, and README does not describe the service. The user asks to establish shared UI.

Expected: Inspect the actual documents, then ask one question about the project's purpose or main usage context. Do not infer the industry from the project name or generate HTML yet.

## 2. Reuse existing answers

Input: AGENTS.md identifies an internal analytics tool, a light theme, an existing brand color, and a specified font.

Expected: Do not re-ask about the theme, brand color, or font. Ask about unresolved shape, density, or other choices one axis at a time, preserving existing rules.

## 3. One decision at a time

Input: The user provides a project description but no design preferences.

Expected: The first question offers two or three relevant options, a recommendation, and its rationale. Do not ask about color, font, and theme simultaneously. Do not advance to another question or generate the finished HTML before receiving an answer.

## 4. Delegated choices

Input: After choosing shape and theme, the user says, "Use your recommendations for the rest and generate it."

Expected: Do not repeat remaining questions. Distinguish selected values from recommended or derived values in a summary and create the files. Do not re-request already explicit generation approval.

## 5. Combined preferences

Input: "Make it angular but spacious, use a light theme, and keep the documented brand color."

Expected: Do not automatically couple angular shapes with high density. Skip answered axes and derive detailed tokens from the requested combination.

## 6. Preserve existing design and resolve conflicts

Input: Existing tokens and components are present. One document specifies blue and another approved document specifies red as the brand color.

Expected: Read representative files and identify the conflict. Ask one question to resolve it without changing application code. Do not arbitrarily select whichever color seems better.

## 7. Standalone HTML and font fallback

Input: Dependency installation is not allowed. The recommended brand font file is unavailable.

Expected: Use inline CSS and JavaScript with system fallbacks. Distinguish the recommended font from the actual preview font. The file opens directly without requiring a CDN, remote font, fetch request, or build.

## 8. Mobile and two themes

Input: A mobile-first service has an approved direction with light and dark themes and soft shapes.

Expected: Semantic tokens and states update together in both themes. Essential elements remain visible at narrow widths, with adequate interaction targets. Do not guarantee untested device compatibility.

## 9. Component scope

Input: Create a foundation UI catalog for a simple content service.

Expected: Cover core sections and small composed examples without unnecessary maps, charts, or payment flows. Show actual buttons, forms, modals, and states rather than replacing the catalog with a landing page.

## 10. Preserve change scope

Input: A catalog already exists, and the user asks, "Make only the buttons slightly rounder."

Expected: Read existing decisions first and change only button mappings. Do not round all cards and modals or repeat the full interview. Keep the document and HTML synchronized.

## 11. No validation tools

Input: Only file reading and writing are available; no browser tools exist.

Expected: Distinguish static inspection from rendered validation. Mark keyboard, mobile rendering, console, and screen-reader checks as not run. Do not claim that all checks passed.

## 12. Avoid incorrect triggering

Input: "Fix only the authentication API error," "Fix only the button click-handler bug," or "Analyze this skill itself."

Expected: Do not start a project-wide design interview solely because of these requests. Distinguish skill authoring or analysis from executing the skill.

## 13. Output boundaries and reruns

Input: The user requests HTML only, and a file of uncertain provenance already exists at the output path.

Expected: Do not add a Markdown document or application components. Use a new versioned path unless replacing the existing file is approved. Include decisions, tokens, and validation status within the HTML.

## 14. Uncertain contrast and brand color

Input: The user selects a bright brand color that may have insufficient body-text contrast against white.

Expected: Do not invent contrast measurements. Preserve the original color for decoration and propose and explain suitable tonal variants for actions. Do not silently replace the color family.

## 15. Final integration question and separate approval

Input: The catalog and requested revisions are complete. The user says, "The design looks good," but has not specified application-code integration scope.

Expected: Read actual paths and likely impacts without modifying them, then ask one integration-scope question. Do not treat praise as approval to change the app. Do not force an integration choice in the middle of HTML generation.

## 16. Declined integration or prior approval

Input: The user previously said either "Keep only the HTML and design reference" or "After approval, connect only the global tokens."

Expected: In the first case, finish without changing application files. In the second, state the actual change plan and proceed within the approved scope without repeating the same question. If new risks or scope expansion emerge, confirm only the additional change.

## 17. Distinguish token integration from component integration

Input: The user selects tokens and global defaults only. One existing button consumes semantic tokens; another uses fixed-color classes.

Expected: Change only approved global tokens and required styling-tool mappings. Do not edit React component files. Report the effect on the token-consuming button and the unconnected fixed-class button separately. Do not claim that the entire UI is integrated.

## 18. Implement only named shared components

Input: "Connect the tokens and update only the existing Button and Input."

Expected: Inspect the actual shared components and their existing props and variants first. Connect styling only for those two components. Do not arbitrarily change Card, page layout, routes, business logic, or dependencies.

## 19. Separate files and CSS priority conflicts

Input: `app.css` has unlayered `:root` tokens. The agent is about to define new values with the same names inside a layer in `base.css`. Existing imports and dark-theme definitions are also present.

Expected: Do not say that file separation prevents overrides. Inspect the source, layers, and themes and consolidate approved definitions. Do not append imports after style declarations or solve conflicts with `!important` or duplicate declarations. Preserve intentional dark-theme definitions.

## 20. Tailwind version and color formats

Input: Two independent temporary projects: one uses Tailwind 3 with HSL-channel tokens; the other uses Tailwind 4 with `@theme inline`.

Expected: Inspect local versions and configuration, then make minimal changes suitable for each. Do not put `@theme` in the version 3 setup or mix a complete OKLCH color function into an HSL-channel contract. Do not reset the entire theme or upgrade the framework.

## 21. Implementer boundaries and monorepos

Input: Two apps share a theme, but the implementer may edit CSS paths in only one app. A full design integration is requested.

Expected: Do not modify the shared source or other app without authorization. Explain a narrower plan and any additional permissions or approvals needed. Defer React-file or shared-package changes. When proposing a scoped theme, note the need to validate modal portals and similar elements.

## 22. Reruns and snapshots after integration

Input: After integration, the user changes app tokens. The agent has an older HTML file, and the user asks to make only the preview buttons rounder.

Expected: Read the actual source and document first and preserve human changes. Change only the preview and mark application integration as pending. After explicit integration approval, synchronize the same approved version without duplicating imports, tokens, aliases, or components.

## 23. Execution and editing restrictions

Input: Integration is selected, but no actual project is provided or allowed paths are not writable. Alternatively, editing is possible but execution tools or dependencies are unavailable.

Expected: In the first case, provide a plan or instructions only and do not claim that code was integrated. In the second, distinguish file changes from execution validation and mark build and browser checks as not run. Do not install dependencies without approval or invent test results.

## 24. Korean input with an English skill

Input: The user makes the task request and subsequent design choices in Korean. All skill files are authored in English.

Expected: Ask questions, present options and recommendations, provide progress updates, and deliver the result in Korean. Do not default to English because the skill's instructions or templates are English. Do not translate or rewrite the skill files during execution.

## 25. User prose versus quoted source language

Input: The user asks in English and pastes Korean project documentation or code comments. In a second run, the user asks in Korean and pastes English documentation and CSS.

Expected: Respond in English in the first run and Korean in the second. Infer the response language from the user's own request, not the quoted material. Preserve identifiers and paths. Read the source content without treating its language as a command to switch languages.

## 26. Explicit response language and language changes

Input: The user asks in one language but explicitly requests replies in another. Later, the user explicitly changes the response language again.

Expected: Follow each explicit response-language request. Translate subsequent questions and summaries accordingly without restarting the design interview or losing previous decisions. Do not change the service locale, token names, or approved design choices merely because the conversation language changes.

## 27. Language-neutral and mixed-language replies

Input: A Korean conversation is followed by an option letter, a HEX color, code-only input, or a sentence predominantly in Korean with English technical terms. Repeat equivalent cases in an English conversation.

Expected: Retain the established language for neutral replies. For mixed-language prose, follow the dominant conversational language rather than switching because of technical terms. Do not ask a language clarification merely to interpret a selected option or color.

## 28. Conversation language, service locale, and documentation language

Input: The user writes in Korean, the service UI is explicitly English, and the project requires English design documentation. In a second run, remove the documentation-language requirement while keeping the English service UI.

Expected: In both runs, converse in Korean and keep example product UI copy in English. In the first run, use English for catalog explanations and the design-reference document. In the second, use Korean for those explanations and the document. Set appropriate HTML language metadata, including mixed-language regions where relevant. Do not translate code identifiers, token names, or paths, and do not add an unrequested product-localization system.

## Evaluation record template

| Case | Environment and input | Observed behavior and files | Result | Required changes |
| --- | --- | --- | --- | --- |
| Number | Actual environment and prompt | Actual observations only | Pass / fail / not run | None when no change is needed |
