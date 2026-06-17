---
title: OpenAI-compatible providers
weight: 20
description: Configure providers without built-in support that expose the OpenAI API format, such as Perplexity.
---

{{< callout type="info" >}}
Use the `openai` provider type for providers without a first-class page that
behave like OpenAI for the APIs that you need. If agentgateway already has a
dedicated provider page, prefer that shortcut instead of re-creating it as an
OpenAI-compatible backend. If the upstream supports only a subset of OpenAI
APIs, supports multiple API shapes, or needs non-default per-format paths, use
a [custom provider]({{< link-hextra path="/llm/providers/custom/" >}}) instead.
{{< /callout >}}

{{< reuse "agw-docs/pages/agentgateway/llm/providers/openai-compatible.md" >}}
