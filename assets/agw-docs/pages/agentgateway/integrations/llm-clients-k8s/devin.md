Configure [Devin Desktop](https://devin.ai/desktop), the AI-powered code editor from Cognition (formerly Windsurf), to route requests to your LLM through your agentgateway proxy.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Configure Devin Desktop

Configure Devin Desktop to route LLM requests through agentgateway. For more information, review the [Devin Desktop documentation](https://docs.devin.ai/desktop/troubleshooting/windsurf-proxy-configuration).

1. Open Devin Desktop Settings.
   - **macOS**: `Cmd + ,` or **Devin Desktop** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Search for **Http: Proxy**.

3. Enter your agentgateway URL.

   ```
   http://<INGRESS_GW_ADDRESS>/<route-path>
   ```

   For example, if your HTTPRoute uses path `/openai` on your `ai-example.com` secured host, use `https://ai-example.com/openai`.

4. Save the settings.

## Verify the connection

1. Open the Devin Desktop chat panel.
2. Send a message such as "test".
3. Devin Desktop responds through your agentgateway backend.
