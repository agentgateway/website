---
title: OpenAI
weight: 10
description: Configuration and setup for OpenAI LLM provider
---

Configure OpenAI as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

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

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `ai.provider.openAI.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
| `backendAuth` | OpenAI uses API keys for authentication. You can optionally configure a policy to attach an API key that authenticates to the LLM provider on outgoing requests. If you do not include an API key, each request must pass in a valid API key. |

### Multiple endpoints

Optionally, to support multiple LLM endpoints, you can set the `routes` field inside the `ai` configuration (not to be confused with the `routes` field under `listeners`).

The `ai.routes` field maps URL paths to one of the following route types:

* `completions`: Transforms to the LLM provider format and processes the request with the LLM provider. This route type supports full LLM features such as tokenization, rate limiting, transformations, and other policies like prompt guards.
* `passthrough`: Forwards the request to the LLM provider as-is. This route type does not support LLM features like route processing and policies. You might use this route type for non-chat endpoints such as health checks, `GET` requests like listing models, or custom endpoints that you want to pass through to.

The keys are URL suffix matches, like `/v1/models`. The wildcard character `*` can be used to match anything.

If no route is set, the route defaults to the `completions` endpoint.

In the following example, the `/v1/chat/completions` route is fully processed by the LLM provider. The `/v1/models` route and any other route (`*`) are passed through to the LLM provider as-is.

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
          routes:
            /v1/chat/completions: completions
            /v1/models: passthrough
            "*": passthrough
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```
