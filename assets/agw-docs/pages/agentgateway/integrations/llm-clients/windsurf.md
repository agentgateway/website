Configure [Windsurf](https://codeium.com/windsurf), the AI code editor by Codeium, to route requests through agentgateway.

## Before you begin

- Agentgateway running at `http://localhost:3000` with a configured LLM backend.
- Windsurf installed.

## Example agentgateway configuration

```yaml {paths="windsurf-validate"}
cat > /tmp/test-windsurf.yaml << 'EOF'
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

{{< doc-test paths="windsurf-validate" >}}
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
agentgateway -f /tmp/test-windsurf.yaml --validate-only
{{< /doc-test >}}

## Configure Windsurf

Configure Windsurf to route LLM requests through agentgateway. For more information, review the [Windsurf documentation](https://docs.windsurf.com/troubleshooting/windsurf-proxy-configuration).

1. Open Windsurf Settings.
   - **macOS**: `Cmd + ,` or **Windsurf** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Search for **Http: Proxy**.

3. Enter your agentgateway URL.

   ```
   http://localhost:3000
   ```

4. Save the settings.

## Verify the connection

1. Open the Windsurf chat panel.
2. Send a message such as "test".
3. Windsurf responds through your agentgateway backend.

## Troubleshooting

### "Failed to fetch" or connection error

**What's happening:**

Windsurf cannot connect to agentgateway.

**Why it's happening:**

Agentgateway may not be running, or the API base URL is incorrect.

**How to fix it:**

1. Verify agentgateway is running:
   ```sh
   curl http://localhost:3000/v1/models
   ```
2. Confirm the API base URL includes the `/v1` path.

### "Invalid API key" error

**What's happening:**

Windsurf rejects requests with an authentication error.

**Why it's happening:**

If agentgateway has no authentication configured, Windsurf may still require a non-empty API key field. If authentication is configured, the key may be incorrect.

**How to fix it:**

- If agentgateway has no authentication, enter any placeholder value (`anything`) in the API key field.
- If using gateway authentication, enter the correct API key.
