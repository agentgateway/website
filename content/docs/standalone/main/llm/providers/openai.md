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

llm:
  models:
  - name: gpt-3.5-turbo
    provider: openai
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The name identifier for this model configuration. |
| `provider` | The LLM provider, set to `openai` for OpenAI models. |
| `params.model` | The specific OpenAI model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The OpenAI API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |

{{< callout type="info" >}}
For advanced routing scenarios that require path-based routing or custom endpoints, use the traditional `binds/listeners/routes` configuration format. See the [Configuration modes guide](../configuration-modes/) for more information.
{{< /callout >}}

## Connect to Codex

Use agentgateway as a proxy to your OpenAI provider from the [Codex](https://chatgpt.com/codex) client.

1. Create an agentgateway configuration without specifying a model, so the Codex client's model choice is used.

   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config

   llm:
     models:
     - name: openai
       provider: openai
       params:
         apiKey: "$OPENAI_API_KEY"
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

To configure the base URL permanently, add the following to your `~/.codex/config.toml`. For more information, see [Advanced Configuration](https://developers.openai.com/codex/config-advanced). The `name` field is required for custom providers.

```toml
[model_providers.proxy]
name = "OpenAI via agentgateway"
base_url = "http://localhost:3000/v1"
```

{{% /tab %}}
   {{< /tabs >}}