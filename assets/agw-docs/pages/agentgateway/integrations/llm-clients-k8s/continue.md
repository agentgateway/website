Configure [Continue](https://continue.dev/), the open-source AI code assistant for VS Code, to use agentgateway deployed in Kubernetes.

## Before you begin

- [Get the gateway URL]({{< link-hextra path="/integrations/llm-clients/" >}}) and set `INGRESS_GW_ADDRESS`.
- VS Code with the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) installed.

## Configure Continue

1. Edit the `~/.continue/config.json` file to add your agentgateway endpoint.
2. Replace `<INGRESS_GW_ADDRESS>` and `<route-path>` with your gateway address and the path from your HTTPRoute configuration.

```json
{
  "models": [
    {
      "title": "agentgateway (Kubernetes)",
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiBase": "http://<INGRESS_GW_ADDRESS>/<route-path>",
      "apiKey": "anything"
    }
  ]
}
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Field | Description |
|-------|-------------|
| `title` | Display name shown in the Continue model selector. |
| `provider` | Set to `openai` for any OpenAI-compatible endpoint. |
| `model` | The model name from your agentgateway backend configuration. |
| `apiBase` | Your gateway address and the route path from your HTTPRoute. |
| `apiKey` | A placeholder value if agentgateway has no authentication, or your gateway API key. |

## Verify the connection

1. Open the Continue sidebar in VS Code (`Cmd + M` on macOS, `Ctrl + M` on Windows/Linux).
2. Select **agentgateway (Kubernetes)** from the model dropdown.
3. Send a test message to confirm the connection.

## Troubleshooting

### Connection refused

**What's happening:**

Continue cannot reach agentgateway.

**Why it's happening:**

The `apiBase` URL is incorrect, or the gateway is not reachable from your machine.

**How to fix it:**

1. Verify the gateway is reachable:
   ```sh
   curl http://$INGRESS_GW_ADDRESS/<route-path> -v
   ```
2. Check the route path matches your HTTPRoute:
   ```sh
   kubectl get httproute -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml | grep -A 5 "path:"
   ```
