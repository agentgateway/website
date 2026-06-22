---
title: API types
weight: 15
description: Supported LLM API endpoint types and route configurations
test: skip
---

Agentgateway natively supports multiple LLM API endpoint types.
These are automatically exposed on the gateway, and translated as appropriate based on the provider.

The following API types have dedicated guides:

- **[Chat completions]({{< link-hextra path="/llm/api-types/completions/" >}})**: The OpenAI `/v1/chat/completions` endpoint. This is the most widely used API type for text generation and chat applications.
- **[Responses]({{< link-hextra path="/llm/api-types/responses/" >}})**: The OpenAI `/v1/responses` endpoint for stateful, multi-step model interactions.
- **[Messages]({{< link-hextra path="/llm/api-types/messages/" >}})**: The Anthropic `/v1/messages` endpoint for Claude models.
- **[Embeddings]({{< link-hextra path="/llm/api-types/embeddings/" >}})**: The OpenAI-compatible `/v1/embeddings` endpoint for creating vector representations of text.
- **[Realtime]({{< link-hextra path="/llm/api-types/realtime/" >}})**: The OpenAI Realtime API for low-latency, streaming voice and text interactions over WebSockets.
- **[Rerank]({{< link-hextra path="/llm/api-types/rerank/" >}})**: The Cohere-compatible `/v2/rerank` endpoint for ranking documents by relevance to a query.
- **[Models]({{< link-hextra path="/llm/api-types/models/" >}})**: The OpenAI-compatible `/v1/models` endpoint for listing available models.
- **[Token count]({{< link-hextra path="/llm/api-types/token-count/" >}})**: The Anthropic `/v1/messages/count_tokens` endpoint for estimating input tokens.
- **[Passthrough]({{< link-hextra path="/llm/api-types/passthrough/" >}})**: Forwards requests directly to the backend provider without transformation.
