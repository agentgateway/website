---
title: OpenAI
weight: 10
description: Configuration and setup for OpenAI LLM provider
---

## Configuration

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              # Optional; overrides the model in requests
              model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

OpenAI uses API keys for authentication.
To automatically attach a key to all requests, the `backendAuth` policy can be used.
Otherwise, this can be removed, and users will be required to pass in their own valid API key in the request.
