# Cursor

Configure [Cursor](https://cursor.sh/), the AI-powered code editor, to use agentgateway as its LLM backend.

## Overview

Cursor supports custom OpenAI-compatible endpoints through its model configuration settings. This allows you to route all Cursor AI requests through agentgateway.

## Before you begin

- agentgateway running and accessible (e.g., `http://localhost:3000`).
- A configured LLM backend in agentgateway.
- Cursor installed (version 0.30+).

## Configuration

### Method 1: Settings UI

1. Open Cursor Settings.
   - **macOS**: `Cmd + ,` or **Cursor** → **Settings**.
   - **Windows/Linux**: `Ctrl + ,` or **File** → **Preferences** → **Settings**.

2. Navigate to **Models** section.

3. Click **Add Model** or **Configure Custom Model**.

4. Enter your agentgateway details.
   - **API Base URL**: `http://localhost:3000/v1` (or your gateway URL with `/v1` path).
   - **API Key**: Your gateway API key, or `anything` if no authentication.
   - **Model Name**: The model configured in your agentgateway backend (e.g., `gpt-4o-mini`, `claude-sonnet-4-20250514`).

5. Save and restart Cursor.

### Method 2: Settings JSON

Cursor stores configuration in a JSON file. You can edit this directly for more control.

1. Open Command Palette.
   - **macOS**: `Cmd + Shift + P`.
   - **Windows/Linux**: `Ctrl + Shift + P`.

2. Type `Preferences: Open User Settings (JSON)` and select it.

3. Add your custom model configuration.

```json
{
  "cursor.models": [
    {
      "name": "agent-gateway",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "anything",
      "model": "gpt-4o-mini"
    }
  ]
}
```

4. Save the file and restart Cursor.

## Multi-provider setup

You can configure multiple gateway backends as different models in Cursor:

```json
{
  "cursor.models": [
    {
      "name": "gateway-openai",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "anything",
      "model": "gpt-4o-mini"
    },
    {
      "name": "gateway-anthropic",
      "apiBase": "http://localhost:3001/v1",
      "apiKey": "anything",
      "model": "claude-sonnet-4-20250514"
    }
  ]
}
```

Then switch between them in Cursor's model selector.

## Using environment variables

Cursor respects OpenAI environment variables. Set these before launching Cursor:

```bash
export OPENAI_API_BASE=http://localhost:3000/v1
export OPENAI_API_KEY=anything
cursor .
```

## Example agentgateway configuration

Here's a complete gateway configuration for Cursor with OpenAI backend:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        backendAuth:
          key: $OPENAI_API_KEY  # Your OpenAI API key
      backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-4o-mini
```

## Verification

Test your configuration:

1. Open a file in Cursor
2. Open the Cursor chat panel (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux)
3. Ask a question: "What is this file about?"
4. Cursor should respond using your agentgateway backend

## Troubleshooting

### "Failed to fetch" error

- Verify agentgateway is running: `curl http://localhost:3000/v1/models`
- Check the base URL includes `/v1` path
- Ensure no firewall blocking the connection

### "Invalid API key" error

- If agentgateway has no auth configured, set API key to any placeholder value (`anything`)
- If using `backendAuth` policy, ensure your gateway has valid provider credentials

### Model not found

- Verify the model name matches your agentgateway backend configuration
- Check agentgateway logs for backend connection errors

## Related documentation

- [agentgateway LLM Configuration]({{< link-hextra path="/llm/" >}})
- [Backend Authentication]({{< link-hextra path="/security/policies/backend-auth/" >}})
