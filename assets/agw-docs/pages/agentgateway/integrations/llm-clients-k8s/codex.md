Configure [Codex](https://chatgpt.com/codex), the AI coding tool by OpenAI, to
route requests through agentgateway running in Kubernetes.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. [Set up access to the OpenAI LLM provider]({{< link-hextra path="/llm/providers/openai/" >}}).
3. Install either the [Codex CLI](https://developers.openai.com/codex/cli/) or
   the [ChatGPT desktop app](https://chatgpt.com/download/).

## Set the gateway URL

The [installation quickstart]({{< link-hextra path="/quickstart/install/" >}})
sets `INGRESS_GW_ADDRESS` to the Gateway address. Set the Codex base URL from
that value. The `/v1` suffix is required because Codex sends Responses API
requests to `/v1/responses`.

```sh
export AGENTGATEWAY_BASE_URL="http://${INGRESS_GW_ADDRESS}/v1"
```

For a TLS-enabled gateway, set `AGENTGATEWAY_BASE_URL` to its HTTPS URL ending
in `/v1`.

## Verify gateway connectivity

Follow [Step 4 of the OpenAI quickstart]({{< link-hextra path="/quickstart/llm/#step-4-send-a-request-to-the-llm" >}})
to verify that the configured Gateway can reach the LLM provider.

## Connect Codex to agentgateway

### Codex CLI

Point Codex at agentgateway through one of the following methods.

{{< tabs >}}
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

#### Verify the CLI connection

1. Send a test prompt through agentgateway. For the profile configuration,
   include the profile name:

   ```sh
   codex --profile agentgateway "Hello"
   ```

2. Verify that the request appears in the agentgateway proxy logs.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --since=5m \
     | grep 'http.path=/v1/responses' \
     | tail -n 5
   ```

   A successful entry has `http.status=200` and `http.path=/v1/responses`.

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
cat > ~/.codex/config.toml <<EOF
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "OpenAI via agentgateway"
base_url = "${AGENTGATEWAY_BASE_URL}"
wire_api = "responses"
EOF
```

To edit the file through the app instead, open **Settings > Configuration >
Open config.toml** and apply the same provider configuration.

#### Verify the app connection

1. Send a task from Codex in the ChatGPT desktop app.

2. Verify that the request appears in the agentgateway proxy logs.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --since=5m \
     | grep 'http.path=/v1/responses' \
     | tail -n 5
   ```

   A successful entry has `http.status=200` and `http.path=/v1/responses`.

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
