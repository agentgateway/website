Configure [Cursor](https://cursor.com/), the AI code editor, to route requests to your LLM through your agentgateway proxy.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. [Install Cursor](https://cursor.com/).

## Example agentgateway configuration

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

## Configure Cursor

1. Open the Cursor Settings.
   - **macOS**: `Cmd + ,` or **Cursor** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Navigate to the **Models** tab.

3. Enable **Override OpenAI Base URL** and enter your agentgateway address.

   ```
   http://localhost:3000
   ```

   {{< callout type="info" >}}
   You do not need to provide LLM provider credentials (such as an API key) through Cursor. The credentials are configured in agentgateway. Toggle off any API key overrides in Cursor.
   {{< /callout >}}

## Verify the connection

1. Open the Cursor chat panel (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Send a message such as "test".
3. Cursor responds through your agentgateway backend.
