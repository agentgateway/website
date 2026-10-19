Configure [OpenCode](https://opencode.ai/), the open source AI coding agent, to send its LLM requests through {{< reuse "agw-docs/snippets/agentgateway.md" >}} running in Kubernetes. OpenCode holds only a virtual key for {{< reuse "agw-docs/snippets/agentgateway.md" >}}, and the provider API key stays in a Kubernetes Secret in your cluster.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. [Set up access to the OpenAI LLM provider]({{< link-hextra path="/integrations/llm/providers/openai/" >}}). Use the HTTPRoute that matches all paths, so that OpenCode can send requests to the `/v1/chat/completions` path.
3. Require a virtual key for requests to the Gateway, such as by following [Protect provider API keys]({{< link-hextra path="/documentation/llm/protect-provider-keys/" >}}) or [Virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}). This guide uses the `vk-alice-4f9c2a` key from the Protect provider API keys guide.
4. [Install OpenCode](https://opencode.ai/docs/).

## Set the gateway URL and virtual key

1. Set the OpenCode base URL from the Gateway address. The [installation quickstart]({{< link-hextra path="/documentation/quickstart/install/" >}}) sets `INGRESS_GW_ADDRESS` to the Gateway address. The `/v1` suffix is required. If you use port-forwarding instead, use `http://localhost:8080/v1`.

   ```sh
   export AGENTGATEWAY_BASE_URL="http://${INGRESS_GW_ADDRESS}/v1"
   ```

2. Save the virtual key in an environment variable. This key authenticates OpenCode to {{< reuse "agw-docs/snippets/agentgateway.md" >}}. It is not the OpenAI API key that the proxy sends upstream.

   ```sh
   export AGENTGATEWAY_API_KEY='vk-alice-4f9c2a'
   ```

> [!NOTE]
> For a TLS-enabled Gateway, set `AGENTGATEWAY_BASE_URL` to its HTTPS URL ending in `/v1`.

## Connect OpenCode to agentgateway

1. Create an `opencode.json` file in your project directory. To use {{< reuse "agw-docs/snippets/agentgateway.md" >}} in every project instead, add the same settings to the global OpenCode configuration file, `~/.config/opencode/opencode.json`.

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
   | `options.baseURL` | The Gateway address. The `{env:AGENTGATEWAY_BASE_URL}` value reads the address from the environment variable. |
   | `options.apiKey` | The virtual key. The `{env:AGENTGATEWAY_API_KEY}` value reads the key from the environment variable, so the key is not stored in the file. Instead of the environment variable, you can also enter the key with the `/connect` command in OpenCode. |
   | `models` | The models that OpenCode can request. If you allow only some models on the Gateway, list only those models. |

2. Start OpenCode from the same directory.

   ```sh
   opencode
   ```

## Verify the connection

1. Send a prompt from OpenCode. To send a single prompt without the interactive interface, run the following command.

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

> [!NOTE]
> This configuration was tested with OpenCode `1.18.35`.

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/protect-provider-keys/" title="Protect provider API keys" subtitle="Rotate and revoke keys without changing clients" >}}
  {{< card path="/documentation/llm/cost-controls/virtual-keys/" title="Virtual keys" subtitle="Issue virtual keys with token budgets and per-key metrics" >}}
{{< /cards >}}
