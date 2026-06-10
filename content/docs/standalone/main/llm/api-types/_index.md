---
title: API types
weight: 15
description: Supported LLM API endpoint types and route configurations
test: skip
---

Agentgateway supports multiple LLM API endpoint types, called *route types*, that determine how clients interact with the gateway and how requests are routed to backends. In the simplified `llm` configuration, agentgateway maps standard endpoint paths to these route types automatically. In the `binds/listeners/routes` configuration, you set the route type explicitly in the `policies.ai.routes` map.

The following API types have dedicated guides:

- **[Chat completions]({{< link-hextra path="/llm/api-types/completions/" >}})** — The OpenAI `/v1/chat/completions` endpoint. This is the most widely used API type for text generation and chat applications.
- **[Responses]({{< link-hextra path="/llm/api-types/responses/" >}})** — The OpenAI `/v1/responses` endpoint for stateful, multi-step model interactions.
- **[Messages]({{< link-hextra path="/llm/api-types/messages/" >}})** — The Anthropic `/v1/messages` endpoint for Claude models.
- **[Realtime]({{< link-hextra path="/llm/api-types/realtime/" >}})** — The OpenAI Realtime API for low-latency, streaming voice and text interactions over WebSockets.
- **[Passthrough]({{< link-hextra path="/llm/api-types/passthrough/" >}})** — Forwards requests directly to the backend provider without transformation.

Agentgateway also recognizes additional route types for specific endpoints, including `embeddings` (`/v1/embeddings`), `models` (`/v1/models`), and `anthropicTokenCount` (`/v1/messages/count_tokens`).
