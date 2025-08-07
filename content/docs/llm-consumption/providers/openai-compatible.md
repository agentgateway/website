---
title: OpenAI compatible
weight: 10
description: Configuration and setup for arbitrary OpenAI compatible LLM providers
---

Many LLM providers provide OpenAI compatible endpoints which can be integrated with agentgateway.

## Configuration

Below shows an example of integration with [Cohere AI](https://cohere.com/).
Similar patterns work with other providers as well; consult their documentation to find the appropriate URL to use

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          # Rewrite th hostname of the upstream request to match the provider's expectations
          # By default, the hostname of the incoming request is forwarded
          authority:
            full: api.cohere.ai
          # Rewrite the path to the appropriate provider endpoint
          # This is optional if the request is already sent to this path
          path:
            full: "/compatibility/v1/chat/completions"
        # Configure usage of TLS when connecting to the provider
        backendTLS: {}
        # Attach an API key to outgoing requests
        backendAuth:
          key: $COHERE_API_KEY
      backends:
      - ai:
          name: cohere
          # Override the hostname (if not set, this would use `api.openai.com`)
          hostOverride: api.cohere.ai:443
          provider:
            openAI: # Mark this as an OpenAI compatible provider
              # Optional; if not set, use the model in the request
              model: command
```
