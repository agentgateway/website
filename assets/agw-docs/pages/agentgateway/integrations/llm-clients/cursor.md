Configure [Cursor](https://cursor.com/), the AI code editor, to route requests to your LLM through your agentgateway proxy.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. [Install Cursor](https://cursor.com/).

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

## Example agentgateway configuration

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can configure agentgateway in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
{{< reuse "agw-docs/standalone/llm/clients/ui-openai-port-3000.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/cursor-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/cursor-config.md" >}}
{{% /version %}}

## Configure Cursor

1. Open the Cursor Settings.
   - **macOS**: `Cmd + ,` or **Cursor** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Navigate to the **Models** tab.

3. Enable **Override OpenAI Base URL** and enter your agentgateway address.

   ```
   http://localhost:3000
   ```

   > [!NOTE]
   > You do not need to provide LLM provider credentials (such as an API key) through Cursor. The credentials are configured in agentgateway. Toggle off any API key overrides in Cursor.

## Verify the connection

1. Open the Cursor chat panel (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Send a message such as "test".
3. Cursor responds through your agentgateway backend.
