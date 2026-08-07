Configure [Devin Desktop](https://devin.ai/desktop), the AI-powered code editor from Cognition (formerly Windsurf), to route requests to your LLM through your agentgateway proxy.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install [Devin Desktop](https://devin.ai/desktop).

{{< doc-test paths="devin-validate" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Example agentgateway configuration

```yaml {paths="devin-validate"}
cat > /tmp/test-devin.yaml << 'EOF'
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

{{< doc-test paths="devin-validate" >}}
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
agentgateway -f /tmp/test-devin.yaml --validate-only
{{< /doc-test >}}

## Configure Devin Desktop

Configure Devin Desktop to route LLM requests through agentgateway. For more information, review the [Devin Desktop documentation](https://docs.devin.ai/desktop/troubleshooting/windsurf-proxy-configuration).

1. Open Devin Desktop Settings.
   - **macOS**: `Cmd + ,` or **Devin Desktop** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Search for **Http: Proxy**.

3. Enter your agentgateway URL.

   ```
   http://localhost:3000
   ```

4. Save the settings.

## Verify the connection

1. Open the Devin Desktop chat panel.
2. Send a message such as "test".
3. Devin Desktop responds through your agentgateway backend.
