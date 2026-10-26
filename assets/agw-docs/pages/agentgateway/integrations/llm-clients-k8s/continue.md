Configure [Continue](https://continue.dev/), the open-source AI code assistant for VS Code, to use agentgateway deployed in Kubernetes.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}
3. Install the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) in VS Code.

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Configure Continue

1. Edit the `~/.continue/config.yaml` file to add your agentgateway endpoint. If the file already has a `models` list, add the model to that list.
2. Replace `<INGRESS_GW_ADDRESS>` and `<route-path>` with your gateway address and the path from your HTTPRoute configuration.

```yaml
name: agentgateway
version: 0.0.1
schema: v1
models:
  - name: agentgateway (Kubernetes)
    provider: openai
    model: gpt-4o-mini
    apiBase: http://<INGRESS_GW_ADDRESS>/<route-path>
    apiKey: anything
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Field | Description |
|-------|-------------|
| `name` | At the top level, a name for the configuration. In the `models` list, the display name shown in the Continue model selector. |
| `version`, `schema` | Required by the Continue `config.yaml` format. Keep `schema: v1`. |
| `provider` | Set to `openai` for any OpenAI-compatible endpoint. |
| `model` | The model name from your agentgateway backend configuration. |
| `apiBase` | Your gateway address and the route path from your HTTPRoute. |
| `apiKey` | A placeholder value if agentgateway has no authentication, or your gateway API key. |

## Verify the connection

1. Open the Continue sidebar in VS Code (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Select **agentgateway (Kubernetes)** from the model dropdown.
3. Send a test message to confirm the connection.
