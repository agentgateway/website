Configure [Windsurf](https://codeium.com/windsurf), the AI code editor by Codeium, to route requests to your LLM through your agentgateway proxy.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

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
