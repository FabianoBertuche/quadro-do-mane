# Global ChatGPT Runtime Configuration

## Goal

Use one server-wide ChatGPT OAuth connection and one globally selected OpenAI model for every Monte Moria chat, with a live model combobox and an extensible administrative provider settings area.

## Scope

- Replace tenant-user OAuth inference selection with one encrypted server-wide ChatGPT connection.
- Keep the existing copy/paste OpenAI OAuth flow, but make its connection, refresh, revocation, model selection, and model catalog server-wide.
- Use an OAuth connection even when `AI_ENABLED=false`; that flag controls API-key fallback only.
- Fetch the signed-in account's live catalog from `GET https://api.openai.com/v1/models` using the server OAuth token.
- Return only `models[]` where `visibility === "list"`, preserving OpenAI order and exposing `slug` and `display_name` only.
- Persist the selected model slug and display name globally. Use that slug for every Responses API request.
- Show a global model combobox in the AI chat during homologation, allowing immediate model changes.
- Add an administrative settings area prepared for multiple providers. ChatGPT OAuth is functional; future provider cards are visible as `Em breve` and cannot be connected.
- Prevent partially persisted chat messages when provider output or tool-call validation fails.

## Non-Goals

- No API key, Anthropic, Google, Azure, or other provider implementation.
- No per-tenant, per-user, per-conversation, or per-message model selection.
- No frontend access to OAuth tokens or raw provider responses.

## Architecture

Create a singleton `AiServerConfiguration` with exactly one active global ChatGPT connection reference and selected-model metadata. The OAuth credential record remains encrypted and is associated with this configuration rather than a tenant user. OAuth APIs resolve the global configuration, while authorization is temporarily exposed in chat for homologation; future settings routes apply an administrator-only guard without changing credential/provider contracts.

The model catalog is fetched through a server-only service using the OAuth access token. It refreshes an expired token before listing, filters displayable entries, and maps transport/provider errors to safe UI messages. It is cached briefly in server memory and invalidated after connect, disconnect, or account change. Model selection validates the submitted slug against a fresh or cached catalog before persisting it.

`OpenAiResponsesProvider` receives the globally selected model together with the server OAuth credential for every completion. The provider uses `store: false`, `stream: true`, and the selected `slug`. If no server OAuth connection exists, API-key fallback remains available only when `AI_ENABLED=true` and `OPENAI_API_KEY` is configured; otherwise return a recoverable configuration error. `FakeAiProvider` is not selected in production OAuth mode.

Before any user or assistant message is stored, the AI service validates all normalized tool calls against the registered tool schema. Provider completion, tool parsing/validation, and message/proposal persistence execute atomically so failures create no visible partial chat state.

## API

- `GET /api/ai/runtime`: public-to-authenticated-users metadata: active provider, connection status, selected model, and available models; no credentials.
- `POST /api/ai/runtime/model`: accepts `{ slug }`, validates against the server catalog, and saves global selection. Temporarily uses `ai.use`; later moves under administrator settings.
- Existing OAuth start/complete/connections/refresh/disconnect routes operate against the global configuration during homologation and return only redacted connection metadata.
- `GET /api/settings/ai/providers`: administrator-only provider status list: ChatGPT functional and future providers marked `coming_soon`.

## UI

- The AI chat header displays the active ChatGPT connection state and selected model.
- A searchable combobox lists each model as its OpenAI `display_name`, with the `slug` as supporting detail.
- Changing the combobox saves the global model and updates the active chat configuration without exposing credentials.
- Settings adds a `Provedores de IA` area with a functional ChatGPT card and visible disabled `Em breve` provider cards.
- During homologation, the ChatGPT connect/reconnect/disconnect controls remain in chat; their component is reusable by settings.

## Security and Reliability

- OAuth tokens stay encrypted at rest and never leave the API.
- All connection and model mutations are serialized and audited with server-safe metadata only.
- Catalog, model, provider, and tool-validation failures return localized recoverable errors and never persist a partial user/assistant/proposal record.
- The global OAuth connection is intentional: all logged-in users consume the connected ChatGPT account's plan usage.

## Acceptance Criteria

- A connected global ChatGPT account is used for every authenticated user's AI chat, regardless of tenant/user.
- The API calls `/v1/models` with the global OAuth token and the chat combobox displays only server-provided `visibility=list` models in server order.
- Selecting a model globally persists it and every subsequent Responses request uses its `slug`.
- `AI_ENABLED=false` does not select fake responses when a global OAuth connection exists.
- Provider/tool errors leave no partial messages in a conversation.
- AI settings lists ChatGPT and future disabled provider options; only ChatGPT OAuth works in this release.
