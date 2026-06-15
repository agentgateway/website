---
title: LLM providers
weight: 10
description: Compatibility landing page for LLM provider links in standalone docs
test: skip
---

Use this page if you followed an older integration-oriented link for LLM providers.

The canonical list of standalone provider guides now lives under [Providers]({{< link-hextra path="/llm/providers/" >}}), where you can find the full provider directory and setup details for each supported backend.

## Quick start

To configure an LLM provider in standalone mode, add a model configuration to the `llm` section.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
```

For provider-specific setup, start with [Providers]({{< link-hextra path="/llm/providers/" >}}). Existing provider URLs under `/integrations/llm-providers/` are still kept for compatibility with older links.
