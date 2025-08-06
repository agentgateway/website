---
title: Anthropic
weight: 50
description: Configuration and setup for Anthropic Claude provider
---

## Configuration

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: anthropic
          provider:
            anthropic:
              model: claude-3-5-haiku-20241022
      policies:
        backendAuth:
          key: "$ANTHROPIC_API_KEY"
```

Anthropic uses API keys for authentication.
To automatically attach a key to all requests, the `backendAuth` policy can be used.
Otherwise, this can be removed, and users will be required to pass in their own valid API key in the request.
