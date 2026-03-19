Configure [Cursor](https://cursor.com/), the AI code editor, to route requests to your LLM through your agentgateway proxy.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Configure Cursor

1. Open the Cursor Settings.
   - **macOS**: `Cmd + ,` or **Cursor** → **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** → **Preferences** → **Settings**

2. Navigate to the **Models** tab.

3. Enable **Override OpenAI Base URL** and enter your gateway address and the route path from your HTTPRoute configuration.

   ```
   http://<INGRESS_GW_ADDRESS>/<route-path>
   ```

   For example, if your HTTPRoute uses path `/openai` on your `ai-example.com` secured host, use `https://ai-example.com/openai`.

   {{< callout type="info" >}}
   You do not need to provide LLM provider credentials (such as an API key) through Cursor. The credentials are configured in agentgateway. Toggle off any API key overrides in Cursor.
   {{< /callout >}}

## Verify the connection

1. Open the Cursor chat panel (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Send a message such as "test".
3. Cursor responds through your agentgateway backend.
