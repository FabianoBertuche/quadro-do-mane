# Task 5 Report

## Status

Implemented the frontend global ChatGPT runtime UI and provider settings page.

## Changes

- Added `getAiRuntime`, `selectAiRuntimeModel`, redacted parsing, and safe error mapping in `apps/web/src/lib/ai-runtime.ts`.
- Added focused runtime client tests covering redaction, server ordering, model payloads, unavailable catalogs, and safe errors.
- Added an accessible searchable model combobox with global-impact copy and pending-save disabling.
- Integrated runtime status and model selection into the chat without coupling it to conversation history loading.
- Retained the temporary ChatGPT OAuth connection card.
- Added the admin-only `/settings/ai-providers` page with ChatGPT status and disabled `Em breve` future-provider cards.

## Verification

- RED: `npx --yes tsx --test src/lib/ai-runtime.spec.ts` initially failed because `ai-runtime.ts` did not exist.
- PASS: `npx --yes tsx --test src/lib/ai-runtime.spec.ts src/lib/ai-oauth.spec.ts src/lib/ai-chat.test.ts` (19 tests).
- PASS: `npx tsc --noEmit` from `apps/web`.
- PASS: `npm run build` from `apps/web`.
- PASS: `git diff --check`.

## Concerns

- No component-test runner is configured in `apps/web`; UI behavior was typechecked and covered through the client contract tests.
- The provider settings endpoint intentionally exposes status only, so the settings page does not duplicate OAuth connection controls.
