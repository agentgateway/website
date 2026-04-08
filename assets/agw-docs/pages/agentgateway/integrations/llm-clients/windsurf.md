Configure [Windsurf](https://codeium.com/windsurf), the AI code editor by Codeium, to route requests to your LLM through your agentgateway proxy.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install [Windsurf](https://codeium.com/windsurf).

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
