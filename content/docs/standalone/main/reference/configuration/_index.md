---
title: Configuration reference
weight: 11
icon: settings
description: JSON schema reference for the agentgateway configuration file, plus IDE/editor schema validation.
test: skip
---

The agentgateway configuration file is described by a [JSON schema](https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.json). This section explains how to wire that schema into your editor for inline validation, and provides the complete generated reference for every field.

Standalone 1.3 adds LLM-specific schema coverage that is easiest to explore from the LLM docs:
`llm.virtualModels`, `llm.providers`, `config.modelCatalog`, `llm.models[].auth`,
`llm.models[].authorization`, `llm.policies.guardrails`, `llm.policies.cors`,
`llm.tls`, and shared `llm.port` / `mcp.port` listener behavior.

For usage examples and field semantics, see [virtual models]({{< link-hextra path="/llm/virtual-models/" >}}),
[model costs]({{< link-hextra path="/llm/costs/" >}}),
[provider reuse]({{< link-hextra path="/llm/providers/multiple-llms/" >}}),
[guardrails]({{< link-hextra path="/llm/prompt-guards/overview/" >}}), and
[listener security]({{< link-hextra path="/llm/configuration-modes/" >}}).
