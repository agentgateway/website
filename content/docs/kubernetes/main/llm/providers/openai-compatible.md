---
title: OpenAI-compatible providers
weight: 20
description: Configure OpenAI-compatible providers like Mistral, DeepSeek, or Groq with custom host and path overrides.
---

{{< callout type="info" >}}
Use the `openai` provider type when the upstream provider behaves like OpenAI
for the APIs that you need. If the provider supports only a subset of OpenAI
APIs, supports multiple API shapes, or needs per-format paths, use a
[custom provider]({{< link-hextra path="/llm/providers/custom/" >}}) instead.
{{< /callout >}}

{{< reuse "agw-docs/pages/agentgateway/llm/providers/openai-compatible.md" >}}
