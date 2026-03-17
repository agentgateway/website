Configure [Cursor](https://cursor.com/), the AI code editor, to use agentgateway deployed in Kubernetes.

## Before you begin

- Retrieve your gateway URL and set the `INGRESS_GW_ADDRESS` environment variable. See [Get the gateway URL]({{% link-hextra path="/integrations/llm-clients/" %}}) for instructions.
- Cursor installed (version 0.30 or later).

## Configure Cursor

1. Open Cursor Settings.
   - **macOS**: `Cmd + ,` or **Cursor** → **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** → **Preferences** → **Settings**

2. Navigate to the **Models** tab.

3. Under **OpenAI API Key**, enter a placeholder value such as `anything` if agentgateway has no authentication configured, or your gateway API key if authentication is enabled.

4. Enable **Override OpenAI Base URL** and enter your gateway address and the route path from your HTTPRoute configuration:

   ```
   http://<INGRESS_GW_ADDRESS>/<route-path>
   ```

   For example, if your HTTPRoute uses path `/openai`: `http://<INGRESS_GW_ADDRESS>/openai`.

5. Click **Verify** to confirm the connection.

## Verify the connection

1. Open the Cursor chat panel (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Send a message, for example: "Hello, are you working?"
3. Cursor should respond using your agentgateway backend.

## Troubleshooting

### "Failed to fetch" error

**What's happening:**

Cursor cannot connect to agentgateway.

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
