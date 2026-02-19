---
title: OpenAI
weight: 10
description: Configuration and setup for OpenAI LLM provider
---

Configure OpenAI as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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

## Connect to Codex

Use agentgateway as a proxy to your OpenAI provider from the [Codex](https://chatgpt.com/codex) client.

1. Update your agentgateway configuration to include passthrough routes to the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses). Leave the OpenAI provider `model` unset so the Codex client's model choice is used.
   
   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - protocol: HTTP
       routes:
       - backends:
         - ai:
             name: openai
             provider:
               openAI: {}
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
           ai:
             routes:
               /v1/chat/completions: completions
               /v1/responses: passthrough
               /sse: passthrough
   EOF
   ```

2. Point Codex at agentgateway through one of the following methods.

   {{< tabs items="Environment variable,CLI override,Config file" totalItems="3" >}}
{{% tab tabName="Environment variable" %}}

Codex uses the [OPENAI_BASE_URL](https://developers.openai.com/codex/config-advanced) environment variable to override the default OpenAI endpoint. Use a base URL that includes `/v1` so requests go to `/v1/responses` and OpenAI does not return 404.

```sh
export OPENAI_BASE_URL="http://localhost:3000/v1"
codex
```

{{% /tab %}}
{{% tab tabName="CLI override" %}}

To override the base URL for a single run, set `model_provider` and the provider's `name` and `base_url` (the `-c` values are TOML).

```sh
codex -c 'model_provider="proxy"' -c 'model_providers.proxy.name="OpenAI via agentgateway"' -c 'model_providers.proxy.base_url="http://localhost:3000/v1"'
```

{{% /tab %}}
{{% tab tabName="Config file" %}}

To configure the base URL permanently, add the following to your `~/.codex/config.toml`. See [Advanced Configuration](https://developers.openai.com/codex/config-advanced). The `name` field is required for custom providers.

```toml
[model_providers.proxy]
name = "OpenAI via agentgateway"
base_url = "http://localhost:3000/v1"
```

{{% /tab %}}
   {{< /tabs >}}