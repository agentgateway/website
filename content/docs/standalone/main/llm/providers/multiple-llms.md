---
title: Multiple LLM providers
weight: 40
---

Create a group of LLM providers for the same route. Then, agentgateway automatically load balances requests across the providers using the Power of Two Choices (P2C) algorithm. This intelligent load balancing strategy picks two random providers and selects the one with the highest score based on health, latency, and pending requests to return the response. If a provider fails, traffic is automatically routed to healthy providers.

The P2C algorithm provides better performance than simple round-robin, random, or least-connections strategies by adapting in real-time to each provider's health and performance characteristics.

## Configuration

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
