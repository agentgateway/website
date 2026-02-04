---
title: OpenAI-compatible providers
weight: 10
description: Configuration and setup for arbitrary OpenAI compatible LLM providers
---

Configure any LLM provider that provides OpenAI-compatible endpoints with agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}} The example integrates with [Cohere AI](https://cohere.com/). For a different provider, consult their documentation to find the provider-specific details.

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: api.cohere.ai
          path:
            full: "/compatibility/v1/chat/completions"
        backendTLS: {}
        backendAuth:
          key: $COHERE_API_KEY
      backends:
      - ai:
          name: cohere
          hostOverride: api.cohere.ai:443
          provider:
            openAI:
              model: command
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `urlRewrite` | Configure a policy to rewrite the URL of the upstream requests to match your LLM provider. |
| `authority` | Set the default hostname authority to forward incoming requests. |
| `path` | Rewrite the path to the appropriate LLM provider endpoint. This setting is optional if requests on the provider hostname are already sent on this path. |
| `backendTLS` | Optionally configure a policy to use TLS when connecting to the LLM provider. |
| `backendAuth` | You can optionally configure a policy to attach an API key that authenticates to the LLM provider on outgoing requests. If you do not include an API key, each request must authenticate per the LLM provider requirements. |
| `ai.name` | The name of the LLM provider for this AI backend. |
| `ai.hostOverride` | Override the hostname. If not set, the hostname defaults to OpenAI (`api.openai.com`). This setting is optional if the hostname is already set in the URL rewrite policy's `authority` setting. |
| `ai.provider.openAI.model` | Optionally set the model to use for requests. If not set, the request must include the model to use. |
