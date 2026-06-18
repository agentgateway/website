---
title: Multiple LLM providers
weight: 90
description: Configure load balancing across multiple LLM providers.
---

Create a group of LLM providers for the same route. agentgateway automatically load balances requests across the providers in the group using the **Power of Two Choices (P2C)** algorithm. This algorithm picks two random providers, scores each one based on health, latency, and pending requests, and routes the request to the higher-scoring provider. All providers in a single group are treated as equally preferred — P2C distributes traffic across healthy providers but does not implement failover.

**Load balancing vs. failover:** The single-group configuration on this page is load balancing, not failover. Failover requires multiple priority groups and a health/eviction policy. When all providers in a priority group are evicted (for example, due to repeated errors or rate limiting), the gateway automatically routes to the next priority group. For a failover example, see the [Kubernetes deployment of agentgateway](https://agentgateway.dev/docs/kubernetes/latest/llm/failover/).

The P2C algorithm provides better performance than simple round-robin, random, or least-connections strategies by adapting in real-time to each provider's health and performance characteristics.

## Reusable providers in simplified LLM mode

For simplified `llm` configuration, you can define named provider defaults once in `llm.providers[]` and reference them from multiple `llm.models[]` entries with `provider.reference`. This is different from the previous group example. Here, the reusable provider acts as a preset, not as a load-balancing pool.

```yaml
llm:
  providers:
  - name: openai-default
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
  - name: openai-backup
    provider: openAI
    params:
      apiKey: "$OPENAI_BACKUP_API_KEY"

  models:
  - name: fast
    provider:
      reference: openai-default
    params:
      model: gpt-4o-mini
  - name: smart
    provider:
      reference: openai-backup
    params:
      model: gpt-4o
```

When a model references a named provider with `provider.reference`, the provider's settings are reused automatically. A named provider holds two kinds of reusable settings, and they merge differently:

- **Connection settings (`params`)**: Fields like `apiKey`, `baseUrl`, and other request parameters are copied to every model that references the provider. A referencing model can set only `params.model` (to choose which upstream model to send). Setting any other `params` field on a referencing model is an error.
- **Policy defaults (`defaults`)**: Fields like `auth`, `tls`, `health`, and request-body `defaults` or `overrides` are applied to referencing models, but a model can override them by setting the same field directly. For policy fields, the model-level value wins; for the `defaults` and `overrides` maps, model-level keys win on a per-key basis.

The following example keeps a shared API key and a default request parameter on `llm.providers[]`, then overrides the default per model:

```yaml
llm:
  providers:
  - name: openai-default
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    defaults:
      defaults:
        temperature: 0.2

  models:
  - name: fast
    provider:
      reference: openai-default
    params:
      model: gpt-4o-mini
  - name: smart
    provider:
      reference: openai-default
    params:
      model: gpt-4o
    defaults:
      temperature: 0.7
```

In this example, both models inherit `apiKey` from `llm.providers[]`. The `fast` model also inherits the provider's default `temperature` of `0.2`, while `smart` overrides it with `0.7`.

Named providers can hold any shared connection settings (`params`, such as the API key or base URL) and policy defaults (`defaults`, such as authentication, TLS, or request defaults) that you want to reuse. Keep the shared values on `llm.providers[]`, and on referencing models set only `params.model` plus any policy fields you want to override.

## Configuration

{{< callout type="info" >}}
Provider groups with load balancing require the traditional `binds/listeners/routes` configuration format. For more information, see the [Routing-based configuration guide]({{< link-hextra path="/llm/configuration-modes/" >}}).
{{< /callout >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}} The example sets two providers, OpenAI and Gemini. Each provider can have its own individual settings, such as host and path overrides, API keys, backend TLS, and more.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          groups:
          - providers: 
            - name: openai
              provider:
                openAI:
                  # Optional; overrides the model in requests
                  model: gpt-3.5-turbo
              backendAuth:
                key: "$OPENAI_API_KEY"
            - name: gemini
              provider:
                gemini:
                  # Optional; overrides the model in requests
                  model: gemini-1.5-flash-latest
              backendAuth:
                key: "$GEMINI_API_KEY"
```
