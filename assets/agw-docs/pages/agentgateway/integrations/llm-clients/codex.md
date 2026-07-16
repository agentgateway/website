Configure [Codex](https://chatgpt.com/codex), the AI coding tool by OpenAI, to route requests through your agentgateway proxy.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install either the [Codex CLI](https://developers.openai.com/codex/cli/) or
   the [ChatGPT desktop app](https://chatgpt.com/download/).

## Configure agentgateway

Start agentgateway with an OpenAI backend configuration. The wildcard `*` model name accepts any model. Codex sends the model in each request, so you do not need to pin a specific model.

1. Create a configuration file.

   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
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

### Codex CLI

Point Codex at agentgateway through one of the following methods.

{{< tabs >}}
{{% tab name="CLI override" %}}

To override the base URL for a single run, set `model_provider` and the provider's `name` and `base_url` (the `-c` values are TOML).

```sh
codex -c 'model_provider="proxy"' -c 'model_providers.proxy.name="OpenAI via agentgateway"' -c 'model_providers.proxy.base_url="http://localhost:4000/v1"'
```

{{% /tab %}}
{{% tab name="Profile" %}}

To configure the base URL persistently without changing your default Codex
configuration, create a profile. For more information, see [Codex
profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles).
The `name` field is required for custom providers.

```sh
mkdir -p ~/.codex
cat > ~/.codex/agentgateway.config.toml <<'EOF'
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "http://localhost:4000/v1"
wire_api = "responses"
EOF
```

Start Codex with the profile:

```sh
codex --profile agentgateway
```

{{% /tab %}}
{{< /tabs >}}

#### Verify the CLI connection

1. Send a test prompt through agentgateway. For the profile configuration,
   include the profile name:

   ```bash
   codex --profile agentgateway "Hello"
   ```

2. Verify that the request appears in the agentgateway logs.

   Example output:

   ```
   info  request gateway=default/default listener=llm route=internal/model:* endpoint=api.openai.com:443 http.method=POST http.path=/v1/responses http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai duration=1687ms
   ```

{{< callout type="info" >}}
This configuration was tested with `codex-cli 0.144.4`.
{{< /callout >}}

For more configuration options, see the [**Codex CLI documentation**](https://developers.openai.com/codex/cli/).

### Codex in the ChatGPT Desktop App

Codex is available in the ChatGPT desktop app. To use the same provider
configuration with the app, back up and replace the user-level configuration,
then restart the ChatGPT desktop app:

```sh
cp ~/.codex/config.toml ~/.codex/config.toml.bak
cat > ~/.codex/config.toml <<'EOF'
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "http://localhost:4000/v1"
wire_api = "responses"
EOF
```

Replacing `~/.codex/config.toml` also replaces other user-level Codex settings.
To edit the file through the app instead, open **Settings > Configuration >
Open config.toml** and apply the same provider configuration.

#### Verify the app connection

1. Send a task from Codex in the ChatGPT desktop app.

2. Verify that the request appears in the agentgateway logs.

   Example output:

   ```
   info  request gateway=default/default listener=llm route=internal/model:* endpoint=api.openai.com:443 http.method=POST http.path=/v1/responses http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai duration=1687ms
   ```

{{< callout type="info" >}}
This configuration was tested with ChatGPT desktop app version `26.707.72221`.
{{< /callout >}}

For more information, see the [**Codex app documentation**](https://learn.chatgpt.com/docs/environments/modes)
and [**Codex configuration basics**](https://learn.chatgpt.com/docs/config-file/config-basic).

Codex also probes `/v1/models` to discover model metadata. Until
[agentgateway issue #1462](https://github.com/agentgateway/agentgateway/issues/1462)
adds a gateway-generated model list, Codex may warn that model metadata is not
found. That warning does not prevent `/v1/responses` traffic from routing.

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/openai" title="OpenAI provider" subtitle="Complete OpenAI provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
