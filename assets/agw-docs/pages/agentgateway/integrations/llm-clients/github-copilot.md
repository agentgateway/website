Configure [GitHub Copilot](https://github.com/features/copilot) in VS Code to route requests through agentgateway.

> [!NOTE]
> Custom endpoint configuration for GitHub Copilot requires a GitHub Copilot Business or Enterprise plan. Individual Copilot plans do not support custom proxy endpoints. For more information, see the [GitHub Copilot documentation](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install VS Code with the [GitHub Copilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot).
3. Have a GitHub Copilot Business or Enterprise subscription.

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

## Example agentgateway configuration

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can configure agentgateway in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
{{< reuse "agw-docs/standalone/llm/clients/ui-openai-port-3000.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/github-copilot-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/github-copilot-config.md" >}}
{{% /version %}}

## Configure GitHub Copilot

1. Open VS Code Settings (`Cmd + ,` on macOS, `Ctrl + ,` on Windows/Linux).

2. Search for `github.copilot` in the settings search bar.

3. Set the proxy URL to your agentgateway address. Click **Edit in settings.json** and add:

   ```json
   {
     "github.copilot.advanced": {
       "debug.overrideProxyUrl": "http://localhost:3000/v1"
     }
   }
   ```

4. Save the file and reload VS Code (`Cmd + Shift + P` > **Developer: Reload Window**).

## Verify the connection

1. Open a code file in VS Code.
2. Start typing and wait for Copilot suggestions to appear.
3. Open the Copilot chat panel (`Cmd + Shift + I` on macOS, `Ctrl + Shift + I` on Windows/Linux) and send a test message.
