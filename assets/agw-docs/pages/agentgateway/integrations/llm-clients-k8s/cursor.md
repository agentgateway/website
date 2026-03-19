Configure [Cursor](https://cursor.com/), the AI code editor, to route requests to your LLM through your agentgateway proxy.

## Before you begin

[Get the gateway URL]({{< link-hextra path="/integrations/llm-clients/" >}}).

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

4. Click **Verify** to confirm the connection.

## Verify the connection

1. Open the Cursor chat panel (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Send a message such as "test".
3. Cursor responds through your agentgateway backend.

## Troubleshooting

### Unable to reach the model provider

**What's happening:**

You get an error similar to the following:

```
Request failed with status code 400: {"error":{"type":"client","reason":"ssrf_blocked","message":"connection to private IP is blocked","retryable":false}}
```

**Why it's happening:**

The LLM provider was not able to process the request. You might have tried including an API key that is not valid. 

**How to fix it:**

When you configure agentgateway, you include credentials to the LLM provider, such as an API key. As such, you do not need to provide the credentials through Cursor as well. Toggle off any API key overrides.

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
