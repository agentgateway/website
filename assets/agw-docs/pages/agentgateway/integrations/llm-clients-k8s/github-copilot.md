Configure [GitHub Copilot](https://github.com/features/copilot) in VS Code to use agentgateway deployed in Kubernetes.

> [!NOTE]
> Custom endpoint configuration for GitHub Copilot requires a GitHub Copilot Business or Enterprise plan. Individual Copilot plans do not support custom proxy endpoints.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}
3. Install the [GitHub Copilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) in VS Code.
4. Have a GitHub Copilot Business or Enterprise subscription.

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Configure GitHub Copilot

1. Open VS Code Settings (`Cmd + ,` on macOS, `Ctrl + ,` on Windows/Linux).

2. Search for `github.copilot` in the settings search bar.

3. Set the proxy URL to your agentgateway address. Click **Edit in settings.json** and add:

   ```json
   {
     "github.copilot.advanced": {
       "debug.overrideProxyUrl": "http://<INGRESS_GW_ADDRESS>/v1"
     }
   }
   ```

   Replace `<INGRESS_GW_ADDRESS>` with your gateway address. This base URL needs the route from the **OpenAI v1/chat/completions** tab of the [OpenAI provider guide]({{< link-hextra path="/integrations/llm/providers/openai/" >}}), which forwards every path to the backend. The **Custom route** tab rewrites every request to `/v1/chat/completions`, so it does not work with clients that add their own path, such as `/chat/completions`.

4. Save the file and reload VS Code (`Cmd + Shift + P` > **Developer: Reload Window**).

## Verify the connection

1. Open a code file in VS Code.
2. Start typing and wait for Copilot suggestions to appear.
3. Open the Copilot chat panel and send a test message.
