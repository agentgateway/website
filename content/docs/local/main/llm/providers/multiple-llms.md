---
title: Multiple LLM providers
weight: 40
---

Create a group of LLM providers for the same route. Then, agentgateway automatically load balances requests across the providers. Agentgateway picks two random providers and selects the one with the highest score based on health and performance to return the response. If a provider fails, traffic is automatically routed to healthy providers.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}} The example sets two providers, OpenAI and Gemini. Each provider can have its own individual settings, such as host and path overrides, API keys, backend TLS, and more.

```yaml
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
