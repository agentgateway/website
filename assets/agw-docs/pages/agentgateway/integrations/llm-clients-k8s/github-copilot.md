Configure [GitHub Copilot](https://github.com/features/copilot) in VS Code to use agentgateway deployed in Kubernetes.

{{< callout type="info" >}}
Custom endpoint configuration for GitHub Copilot requires a GitHub Copilot Business or Enterprise plan. Individual Copilot plans do not support custom proxy endpoints.
{{< /callout >}}

## Before you begin

- [Get the gateway URL]({{< link-hextra path="/integrations/llm-clients/" >}}).
- VS Code with the [GitHub Copilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) installed.
- A GitHub Copilot Business or Enterprise subscription.

## Configure GitHub Copilot

1. Open VS Code Settings (`Cmd + ,` on macOS, `Ctrl + ,` on Windows/Linux).

2. Search for `github.copilot` in the settings search bar.

3. Set the proxy URL to your agentgateway address. Click **Edit in settings.json** and add:

   ```json
   {
     "github.copilot.advanced": {
       "debug.overrideProxyUrl": "http://<INGRESS_GW_ADDRESS>/<route-path>"
     }
   }
   ```

   For example, if your HTTPRoute uses path `/openai`, use `http://<INGRESS_GW_ADDRESS>/openai`.

4. Save the file and reload VS Code (`Cmd + Shift + P` > **Developer: Reload Window**).

## Verify the connection

1. Open a code file in VS Code.
2. Start typing and wait for Copilot suggestions to appear.
3. Open the Copilot chat panel and send a test message.

## Troubleshooting

### Copilot suggestions stop working

**What's happening:**

Copilot does not provide completions or chat responses after configuring the proxy URL.

**Why it's happening:**

The gateway address or route path may be incorrect, the agentgateway proxy service may not be reachable, or the Copilot plan does not support custom endpoints.

**How to fix it:**

1. Verify the gateway is reachable:
   ```sh
   curl http://$INGRESS_GW_ADDRESS/<route-path> -v
   ```
2. Confirm you are using the correct route path from your HTTPRoute configuration:
   ```sh
   kubectl get httproute -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml | grep -A 5 "path:"
   ```
3. Check that your GitHub Copilot subscription supports custom endpoints (Business or Enterprise plan required).
4. Remove the `debug.overrideProxyUrl` setting and reload VS Code to restore default behavior.
