Configure [Windsurf](https://codeium.com/windsurf), the AI code editor by Codeium, to use agentgateway deployed in Kubernetes.

## Before you begin

[Get the gateway URL]({{< link-hextra path="/integrations/llm-clients/" >}}).

## Configure Windsurf

Configure Windsurf to route LLM requests through agentgateway. For more information, review the [Windsurf documentation](https://docs.windsurf.com/troubleshooting/windsurf-proxy-configuration).

1. Open Windsurf Settings.
   - **macOS**: `Cmd + ,` or **Windsurf** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Search for **Http: Proxy**.

3. Enter your agentgateway URL.

   ```
   http://<INGRESS_GW_ADDRESS>/<route-path>
   ```

   For example, if your HTTPRoute uses path `/openai` on your `ai-example.com` secured host, use `https://ai-example.com/openai`.

4. Save the settings.

## Verify the connection

1. Open the Windsurf chat panel.
2. Send a message such as "test".
3. Windsurf responds through your agentgateway backend.

## Troubleshooting

### "Failed to fetch" or connection error

**What's happening:**

Windsurf cannot connect to agentgateway.

**Why it's happening:**

The gateway address or route path may be incorrect, or the agentgateway proxy service may not be reachable.

**How to fix it:**

1. Verify the gateway is reachable:
   ```sh
   curl http://$INGRESS_GW_ADDRESS/<route-path> -v
   ```
2. Confirm you are using the correct route path from your HTTPRoute configuration:
   ```sh
   kubectl get httproute -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml | grep -A 5 "path:"
   ```
