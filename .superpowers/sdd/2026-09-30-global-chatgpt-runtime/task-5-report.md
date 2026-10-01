# Task 5 Report

## Status

Implemented and reviewed the frontend global ChatGPT runtime UI and provider settings page.

## Changes

- Added `getAiRuntime`, `selectAiRuntimeModel`, redacted parsing, and safe error mapping in `apps/web/src/lib/ai-runtime.ts`.
- Added focused runtime client tests covering redaction, server ordering, model payloads, unavailable catalogs, and safe errors.
- Added an accessible searchable model combobox with global-impact copy and pending-save disabling.
- Integrated runtime status and model selection into the chat without coupling it to conversation history loading.
- Retained the temporary ChatGPT OAuth connection card.
- Added the admin-only `/settings/ai-providers` page with ChatGPT status and disabled `Em breve` future-provider cards.
- Fixed the model picker to use a keyboard-accessible combobox/listbox pattern with active-option tracking, arrow/Home/End navigation, Enter selection, Escape close, focus/blur behavior, and no nested button inside an option.
- Linked `/settings/ai-providers` from the admin-only sidebar and settings page entry points.

## Verification

- RED: `npx --yes tsx --test src/lib/ai-runtime.spec.ts` initially failed because `ai-runtime.ts` did not exist.
- PASS: `npx --yes tsx --test src/lib/ai-runtime.spec.ts src/lib/ai-oauth.spec.ts src/lib/ai-chat.test.ts` (19 tests).
- PASS: `npx tsc --noEmit` from `apps/web`.
- PASS: `npm run build` from `apps/web`.
- PASS: `git diff --check`.
- PASS: focused keyboard-index regression test in `src/components/ai/AiModelCombobox.spec.ts`.

## Concerns

- The provider settings endpoint intentionally exposes status only, so the settings page does not duplicate OAuth connection controls.
- No component-test runner is configured in `apps/web`; the interaction index behavior is covered by a lightweight Node test, while the full component is covered by typecheck/build.
