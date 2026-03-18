Configure [Windsurf](https://codeium.com/windsurf), the AI code editor by Codeium, to use agentgateway deployed in Kubernetes.

## Before you begin

[Get the gateway URL]({{< link-hextra path="/integrations/llm-clients/" >}}).

## Configure Windsurf

1. Open Windsurf Settings.
   - **macOS**: `Cmd + ,` or **Windsurf** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Search for **AI Provider** or navigate to the AI settings section.

3. Select **OpenAI Compatible** as the provider.

4. Enter your agentgateway details.
   - **API Base URL**: `http://<INGRESS_GW_ADDRESS>/<route-path>`
   - **API Key**: A placeholder value such as `anything` if agentgateway has no authentication configured, or your gateway API key if authentication is enabled.
   - **Model**: The model name from your agentgateway backend configuration.

   For example, if your HTTPRoute uses path `/openai`, use `http://<INGRESS_GW_ADDRESS>/openai`.

5. Save the settings.

## Verify the connection

1. Open the Windsurf chat panel.
2. Send a message such as "Hello, are you working?"
3. Windsurf should respond using your agentgateway backend.

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
