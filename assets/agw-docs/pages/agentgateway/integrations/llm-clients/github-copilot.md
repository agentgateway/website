Configure [GitHub Copilot](https://github.com/features/copilot) in VS Code to route requests through agentgateway.

{{< callout type="info" >}}
Custom endpoint configuration for GitHub Copilot requires a GitHub Copilot Business or Enterprise plan. Individual Copilot plans do not support custom proxy endpoints. For more information, see the [GitHub Copilot documentation](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference).
{{< /callout >}}

## Before you begin

- Agentgateway running at `http://localhost:3000` with a configured LLM backend.
- VS Code with the [GitHub Copilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) installed.
- A GitHub Copilot Business or Enterprise subscription.

## Example agentgateway configuration

```yaml {paths="copilot-validate"}
cat > /tmp/test-copilot.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
```

{{< doc-test paths="copilot-validate" >}}
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
agentgateway -f /tmp/test-copilot.yaml --validate-only
{{< /doc-test >}}

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

## Troubleshooting

### Copilot suggestions stop working

**What's happening:**

Copilot does not provide completions or chat responses after configuring the proxy URL.

**Why it's happening:**

The proxy URL may be incorrect, agentgateway may not be running, or the Copilot plan does not support custom endpoints.

**How to fix it:**

1. Verify agentgateway is running:
   ```sh
   curl http://localhost:3000/v1/models
   ```
2. Confirm the `debug.overrideProxyUrl` value includes the `/v1` path.
3. Check that your GitHub Copilot subscription supports custom endpoints (Business or Enterprise plan required).
4. Remove the `debug.overrideProxyUrl` setting and reload VS Code to restore default behavior.
