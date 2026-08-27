---
title: API types
weight: 12
description: LLM API endpoint types and the route types that serve them.
test: skip
---

Serve clients that send a particular LLM API format.

Clients reach a model through a specific API endpoint, such as the OpenAI Chat Completions endpoint or the native Gemini `models/{model}:generateContent` endpoint. Each endpoint has a matching route type that you set in the `policies.ai.routes` field of an {{< reuse "agw-docs/snippets/backend.md" >}} resource. Requests default to the `Completions` route type, so an endpoint in another format must be mapped explicitly.

This section covers the API types that take configuration of their own. For the full list of route types, and to map several endpoints on the same {{< reuse "agw-docs/snippets/backend.md" >}}, see [Multiple endpoints]({{< link-hextra path="/llm/providers/multiple-endpoints/" >}}).

- [Gemini]({{< link-hextra path="/llm/api-types/gemini/" >}}): The native Gemini `models/{model}:generateContent`, `models/{model}:streamGenerateContent`, and `models/{model}:countTokens` endpoints for Gemini models.
