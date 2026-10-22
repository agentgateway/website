Route LLM requests from [OpenCode](https://opencode.ai/) through {{< reuse "agw-docs/snippets/agentgateway.md" >}} in Kubernetes. In this guide, OpenCode uses a virtual key, and the provider API key stays in a Kubernetes Secret.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. [Set up access to the OpenAI LLM provider]({{< link-hextra path="/integrations/llm/providers/openai/" >}}). Use the **OpenAI v1/chat/completions** tab to create a route that allows requests to `/v1/chat/completions`.
3. Require [virtual key authentication]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/#set-up-virtual-keys" >}}) for the Gateway. This guide uses the `vk-alice-4f9c2a` example key. Token budgets are optional.
4. [Install OpenCode](https://opencode.ai/docs/). This guide was tested with OpenCode 1.18.35.

> [!TIP]
> The OpenAI provider guide sets up a route that passes the model that OpenCode requests through to OpenAI. If you publish models with `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` resources instead, OpenCode must request a model name that one of the resources publishes. For the naming options, see [Choose how to expose models]({{< link-hextra path="/documentation/llm/about/#choose-how-to-expose-models" >}}).

## Set the gateway URL and virtual key

1. Set the base URL with the required `/v1` suffix. Use `INGRESS_GW_ADDRESS` from the [installation quickstart]({{< link-hextra path="/documentation/quickstart/install/" >}}), or `http://localhost:8080/v1` for port-forwarding.

   ```sh
   export AGENTGATEWAY_BASE_URL="http://${INGRESS_GW_ADDRESS}/v1"
   ```

2. Save the virtual key in an environment variable.

   ```sh
   export AGENTGATEWAY_API_KEY='vk-alice-4f9c2a'
   ```

> [!NOTE]
> For a TLS-enabled Gateway, set `AGENTGATEWAY_BASE_URL` to its HTTPS URL ending in `/v1`.

## Connect OpenCode to agentgateway

1. Create `opencode.json` in your project directory. For settings that apply to all projects, use `~/.config/opencode/opencode.json`.

   ```sh
   cat > opencode.json <<'EOF'
   {
     "$schema": "https://opencode.ai/config.json",
     "model": "agentgateway/gpt-4o-mini",
     "provider": {
       "agentgateway": {
         "npm": "@ai-sdk/openai-compatible",
         "name": "Agentgateway",
         "options": {
           "baseURL": "{env:AGENTGATEWAY_BASE_URL}",
           "apiKey": "{env:AGENTGATEWAY_API_KEY}"
         },
         "models": {
           "gpt-4o-mini": {
             "name": "gpt-4o-mini"
           }
         }
       }
     }
   }
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `model` | The default model, in `<provider>/<model>` format. |
   | `provider.agentgateway.npm` | The AI SDK package for an OpenAI-compatible API. |
   | `options.baseURL` | Reads the Gateway base URL from `AGENTGATEWAY_BASE_URL`. |
   | `options.apiKey` | Reads the virtual key from `AGENTGATEWAY_API_KEY` to keep it out of the file. You can also enter the key with OpenCode's `/connect` command. |
   | `models` | The models that OpenCode can request. List only models that the Gateway allows. |

2. Start OpenCode from the same directory.

   ```sh
   opencode
   ```

## Verify the connection

1. Send a prompt in OpenCode, or run a single prompt from the command line:

   ```sh
   opencode run "Say hello"
   ```

2. Verify that the request appears in the {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy logs.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --since=5m \
     | grep 'http.path=/v1/chat/completions' \
     | tail -n 5
   ```

   A successful entry has `http.status=200` and `http.path=/v1/chat/completions`.

If the virtual key is missing, unknown, or revoked, OpenCode shows the `401` response from the proxy.

```
Error: Unauthorized: api key authentication failure: invalid credentials
```

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/cost-controls/virtual-keys/" title="Virtual keys" subtitle="Protect provider keys and add optional budgets and usage tracking" >}}
{{< /cards >}}
