---
title: TypeSafe
weight: 20
icon: /integrations/providers/bw/typesafe.svg
description: Route agentgateway LLM traffic to TypeSafe Jev with the built-in provider preset.
---

Use TypeSafe Jev as an LLM provider in agentgateway. The `typesafe` preset uses the TypeSafe API and the SystemOne provider format for OpenAI Decisions API requests.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: jev-latest
    visibility: internal
    provider: typesafe
    params:
      apiKey: "$TYPESAFE_API_KEY"
  virtualModels:
  - name: guardrail
    routing:
      weighted:
        targets:
        - model: jev-latest
          weight: 100
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name that matches incoming requests or virtual model targets. |
| `visibility` | Set to `internal` when clients must not call the TypeSafe model directly. |
| `provider` | The LLM provider, set to `typesafe`. |
| `params.apiKey` | The TypeSafe API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Use this setting to override the provider base URL. The default is `https://api.typesafe.ai/v1`. |
| `virtualModels[].routing.weighted.targets[].model` | The TypeSafe model that the virtual model targets. |

## Next steps

After you run agentgateway with the configuration from the Configuration section, you can send OpenAI Decisions API requests to the virtual model. The configured TypeSafe provider translates the requests to TypeSafe's native `/v1/systemone` API before the requests reach TypeSafe. For a full guardrail workflow that uses this provider, see [Jev]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).
