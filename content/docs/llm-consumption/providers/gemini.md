---
title: Gemini
weight: 30
description: Configuration and setup for Google Gemini provider
---

## Configuration

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: gemini
          provider:
            gemini:
              # Optional; overrides the model in requests
              model: gemini-1.5-flash
      policies:
        backendAuth:
          key: "$GEMINI_API_KEY"
```

Gemini uses API keys for authentication.
To automatically attach a key to all requests, the `backendAuth` policy can be used.
Otherwise, this can be removed, and users will be required to pass in their own valid API key in the request.
