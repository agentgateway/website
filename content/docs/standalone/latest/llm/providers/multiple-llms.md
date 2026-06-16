---
title: Multiple LLM providers
weight: 90
description: Configure load balancing across multiple LLM providers with Power of Two Choices algorithm
---

Create a group of LLM providers for the same route. agentgateway automatically load balances requests across the providers in the group using the **Power of Two Choices (P2C)** algorithm. This algorithm picks two random providers, scores each one based on health, latency, and pending requests, and routes the request to the higher-scoring provider. All providers in a single group are treated as equally preferred — P2C distributes traffic across healthy providers but does not implement failover.

**Load balancing vs. failover:** The single-group configuration on this page is load balancing, not failover. Failover requires multiple priority groups and a health/eviction policy. When all providers in a priority group are evicted (for example, due to repeated errors or rate limiting), the gateway automatically routes to the next priority group. For a failover example, see the [Kubernetes deployment of agentgateway](https://agentgateway.dev/docs/kubernetes/latest/llm/failover/).

The P2C algorithm provides better performance than simple round-robin, random, or least-connections strategies by adapting in real-time to each provider's health and performance characteristics.

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
