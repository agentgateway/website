Configure [Codex](https://chatgpt.com/codex), the AI coding tool by OpenAI, to route requests through your agentgateway proxy.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install [Codex](https://chatgpt.com/codex) (`npm install -g @openai/codex`).

## Configure agentgateway

Start agentgateway with an OpenAI backend configuration. Do not pin a specific model so that Codex's model choice is used.

1. Create a configuration file.

   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config

   llm:
     models:
     - name: openai
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   EOF
   ```

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

{{< callout type="info" >}}
For wildcard model matching, rate limiting, and other options, see the [OpenAI provider page]({{< link-hextra path="/llm/providers/openai" >}}).
{{< /callout >}}

## Connect Codex to agentgateway

Point Codex at agentgateway through one of the following methods.

{{< tabs items="Environment variable,CLI override,Config file" totalItems="3" >}}
{{% tab tabName="Environment variable" %}}

Codex uses the [OPENAI_BASE_URL](https://developers.openai.com/codex/config-advanced) environment variable to override the default OpenAI endpoint. Use a base URL that includes `/v1` so requests go to `/v1/responses` and OpenAI does not return 404.

```sh
export OPENAI_BASE_URL="http://localhost:4000/v1"
codex
```

{{% /tab %}}
{{% tab tabName="CLI override" %}}

To override the base URL for a single run, set `model_provider` and the provider's `name` and `base_url` (the `-c` values are TOML).

```sh
codex -c 'model_provider="proxy"' -c 'model_providers.proxy.name="OpenAI via agentgateway"' -c 'model_providers.proxy.base_url="http://localhost:4000/v1"'
```

{{% /tab %}}
{{% tab tabName="Config file" %}}

To configure the base URL permanently, add the following to your `~/.codex/config.toml`. For more information, see [Advanced Configuration](https://developers.openai.com/codex/config-advanced). The `name` field is required for custom providers.

```toml
[model_providers.proxy]
name = "OpenAI via agentgateway"
base_url = "http://localhost:4000/v1"
```

{{% /tab %}}
{{< /tabs >}}

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/openai" title="OpenAI provider" subtitle="Complete OpenAI provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
