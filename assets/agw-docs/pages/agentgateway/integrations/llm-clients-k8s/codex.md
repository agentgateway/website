Configure [Codex](https://chatgpt.com/codex), the AI coding tool by OpenAI, to
route requests through agentgateway running in Kubernetes.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. [Set up access to the OpenAI LLM provider]({{< link-hextra path="/llm/providers/openai/" >}}).
3. Install either the [Codex CLI](https://developers.openai.com/codex/cli/) or
   the [ChatGPT desktop app](https://chatgpt.com/download/).

## Set the gateway URL

The [OpenAI quickstart]({{< link-hextra path="/quickstart/llm/#step-4-send-a-request-to-the-llm" >}})
uses `INGRESS_GW_ADDRESS` for the Gateway address. Set the Codex base URL from
that value. The `/v1` suffix is required because Codex sends Responses API
requests to `/v1/responses`.

```sh
export AGENTGATEWAY_BASE_URL="http://${INGRESS_GW_ADDRESS}/v1"
```

For a TLS-enabled gateway, set `AGENTGATEWAY_BASE_URL` to its HTTPS URL ending
in `/v1`.

## Connect Codex to agentgateway

### Codex CLI

For more configuration options, see the [Codex CLI documentation](https://developers.openai.com/codex/cli/).

Point Codex at agentgateway through one of the following methods.

{{< tabs >}}
{{% tab name="Environment variable" %}}

Codex uses the [OPENAI_BASE_URL](https://developers.openai.com/codex/config-advanced)
environment variable to override the default OpenAI endpoint.

```sh
export OPENAI_BASE_URL="$AGENTGATEWAY_BASE_URL"
codex
```

{{% /tab %}}
{{% tab name="CLI override" %}}

To override the base URL for a single run, set `model_provider` and the
provider's `name` and `base_url` (the `-c` values are TOML).

```sh
codex -c 'model_provider="agentgateway"' \
  -c 'model_providers.agentgateway.name="OpenAI via agentgateway"' \
  -c "model_providers.agentgateway.base_url=\"${AGENTGATEWAY_BASE_URL}\"" \
  -c 'model_providers.agentgateway.wire_api="responses"'
```

{{% /tab %}}
{{% tab name="Profile" %}}

To configure the base URL persistently without changing your default Codex
configuration, create a profile. For more information, see [Codex
profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles).

```sh
mkdir -p ~/.codex
cat > ~/.codex/agentgateway.config.toml <<EOF
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "${AGENTGATEWAY_BASE_URL}"
wire_api = "responses"
EOF
```

Start Codex with the profile:

```sh
codex --profile agentgateway
```

{{% /tab %}}
{{< /tabs >}}

### Codex in the ChatGPT Desktop App

Codex is available in the ChatGPT desktop app. This configuration was tested
with ChatGPT desktop app version `26.707.72221`. For more information, see the
[Codex app documentation](https://learn.chatgpt.com/docs/environments/modes)
and [Codex configuration basics](https://learn.chatgpt.com/docs/config-file/config-basic).

To use the same provider configuration with the app, back up and replace the
user-level configuration, then restart the ChatGPT desktop app:

```sh
cp ~/.codex/config.toml ~/.codex/config.toml.bak
cat > ~/.codex/config.toml <<EOF
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "${AGENTGATEWAY_BASE_URL}"
wire_api = "responses"
EOF
```

Replacing `~/.codex/config.toml` also replaces other user-level Codex settings.
To edit the file through the app instead, open **Settings > Configuration >
Open config.toml** and apply the same provider configuration.

## Verify the connection

1. Follow [Step 4 of the OpenAI quickstart]({{< link-hextra path="/quickstart/llm/#step-4-send-a-request-to-the-llm" >}})
   to verify that the configured Gateway can reach the LLM provider.

2. Send a test prompt through agentgateway from the configured Codex CLI. For
   the profile configuration, include the profile name:

   ```sh
   codex --profile agentgateway "Hello"
   ```

   Or send a task from Codex in the ChatGPT desktop app.

3. Verify that the request appears in the agentgateway proxy logs.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --since=5m \
     | grep 'http.path=/v1/responses' \
     | tail -n 5
   ```

   A successful entry has `http.status=200` and `http.path=/v1/responses`.

Codex also probes `/v1/models` to discover model metadata. Until
[agentgateway issue #1462](https://github.com/agentgateway/agentgateway/issues/1462)
adds a gateway-generated model list, Codex may warn that model metadata is not
found. That warning does not prevent `/v1/responses` traffic from routing.

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/openai" title="OpenAI provider" subtitle="Complete OpenAI provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
