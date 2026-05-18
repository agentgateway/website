Configure [Claude Desktop](https://claude.ai/download) to route requests through your agentgateway proxy using a Claude Teams or Pro account.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install [Claude Desktop](https://claude.ai/download).
3. Install the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`). This is required to run `claude setup-token` and obtain your bearer token.
4. Have a Claude Teams or Pro subscription.

## Configure agentgateway

Start agentgateway with the Teams configuration. Agentgateway listens on port `4001` and exposes Claude at the `/claude` path.

1. Create a configuration file.

   ```yaml
   cat > config.yaml << 'EOF'
   binds:
   - port: 4001
     listeners:
     - name: default
       protocol: HTTP
       routes:
       - name: claude-agent
         matches:
         - path:
             pathPrefix: /claude
         policies:
           urlRewrite:
             path:
               prefix: /
         backends:
         - ai:
             name: claude-agent
             provider:
               anthropic: {}
             policies:
               ai:
                 routes:
                   /v1/messages: messages
                   /v1/messages/count_tokens: anthropicTokenCount
                   '*': passthrough
   EOF
   ```

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

{{< callout type="info" >}}
Claude Code automatically sends the `anthropic-beta: oauth-2025-04-20` header required for OAuth-based authentication. Claude Desktop may require this header to be set as well depending on your client version. If requests fail with a 400 error, add the following to the `passthrough` route policy in your config:

```yaml
policies:
  requestHeaderModifier:
    add:
      anthropic-beta: oauth-2025-04-20
```
{{< /callout >}}

## Configure Claude Desktop

1. Get a bearer token for your Claude account.

   ```bash
   claude setup-token
   ```

   Copy the token printed to the terminal.

2. Open Claude Desktop and enable developer mode: **Help → Troubleshooting → Enable Developer Mode**. Then fully quit and relaunch Claude Desktop. A new **Developer** menu appears in the menu bar.

3. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

4. Enter the gateway URL. Use `127.0.0.1` rather than `localhost`.

   ```
   http://127.0.0.1:4001/claude
   ```

5. Enter the bearer token you copied in step 1.

6. Click **Save** and restart Claude Desktop.

## Verify the connection

Send a message in Claude Desktop. If the connection is successful, responses flow through your agentgateway proxy and appear in the terminal where agentgateway is already running.

Look for log entries like the following in your running agentgateway output:

```
info  request gateway=default/default listener=http route=claude-agent endpoint=api.anthropic.com:443 http.method=POST http.path=/v1/messages http.status=200 protocol=llm
```

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
