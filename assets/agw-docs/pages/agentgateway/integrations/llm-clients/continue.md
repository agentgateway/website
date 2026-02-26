# VS Code Continue

Configure [Continue](https://continue.dev/), the open-source AI code assistant for VS Code, to use agentgateway as its LLM backend.

## Overview

Continue is a VS Code extension that provides AI-powered code completion, chat, and refactoring. It supports custom OpenAI-compatible endpoints via its configuration file.

## Before you begin

- agentgateway running and accessible (e.g., `http://localhost:3000`).
- A configured LLM backend in agentgateway.
- VS Code with Continue extension installed.

## Installation

1. Install Continue from the VS Code marketplace.
   - Open VS Code.
   - Go to Extensions (`Cmd + Shift + X` on macOS, `Ctrl + Shift + X` on Windows/Linux).
   - Search for "Continue".
   - Click **Install**.

2. Continue will create a configuration file at `~/.continue/config.json`.

## Configuration

### Basic setup

Edit `~/.continue/config.json` to add your agentgateway endpoint:

```json
{
  "models": [
    {
      "title": "agentgateway",
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "anything"
    }
  ],
  "tabAutocompleteModel": {
    "title": "agentgateway Autocomplete",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiBase": "http://localhost:3000/v1",
    "apiKey": "anything"
  }
}
```

### Configuration options

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Display name in Continue UI | `"agentgateway"` |
| `provider` | Provider type (use `"openai"` for compatibility) | `"openai"` |
| `model` | Model name from your agentgateway backend | `"gpt-4o-mini"` |
| `apiBase` | agentgateway URL with `/v1` path | `"http://localhost:3000/v1"` |
| `apiKey` | API key (placeholder if no auth) | `"anything"` |

### Multi-model setup

Configure multiple models for different use cases:

```json
{
  "models": [
    {
      "title": "GPT-4o via Gateway",
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "anything"
    },
    {
      "title": "Claude via Gateway",
      "provider": "openai",
      "model": "claude-sonnet-4-20250514",
      "apiBase": "http://localhost:3001/v1",
      "apiKey": "anything"
    }
  ],
  "tabAutocompleteModel": {
    "title": "GPT-4o Autocomplete",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiBase": "http://localhost:3000/v1",
    "apiKey": "anything"
  }
}
```

Switch between models using the Continue sidebar model selector.

## Features

### Chat

1. Open Continue sidebar (`Cmd + M` on macOS, `Ctrl + M` on Windows/Linux).
2. Type your question in the chat input.
3. Continue sends requests to agentgateway.

### Code completion

Continue sends code context to your configured `tabAutocompleteModel` for inline suggestions.

### Slash commands

Use Continue's slash commands with your agentgateway backend:
- `/edit` - Refactor selected code.
- `/comment` - Add documentation comments.
- `/test` - Generate unit tests.
- `/fix` - Fix code issues.

## Example agentgateway configuration

Here's a gateway configuration optimized for Continue with multiple backends:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        backendAuth:
          key: $OPENAI_API_KEY
      backends:
      - ai:
          name: openai-chat
          provider:
            openAI:
              model: gpt-4o-mini

- port: 3001
  listeners:
  - routes:
    - policies:
        backendAuth:
          key: $ANTHROPIC_API_KEY
      backends:
      - ai:
          name: anthropic-chat
          provider:
            anthropic:
              model: claude-sonnet-4-20250514
```

## Environment variables

Continue respects OpenAI environment variables. Set these before launching VS Code:

```bash
export OPENAI_API_BASE=http://localhost:3000/v1
export OPENAI_API_KEY=anything
code .
```

## Verification

1. Open Continue sidebar in VS Code.
2. Select your agentgateway model from the model dropdown.
3. Send a test message: "Hello, are you working?".
4. Continue should respond via agentgateway.

Check agentgateway logs to confirm requests are being received.

## Troubleshooting

### Connection refused

- Verify agentgateway is running: `curl http://localhost:3000/v1/models`.
- Check firewall settings.
- Ensure `apiBase` includes `/v1` path.

### "Model not found" error

- Ensure the `model` field matches your agentgateway backend configuration.
- Check agentgateway logs for backend errors.

### Slow completions

- Check agentgateway latency in observability metrics.
- Consider using a faster model for `tabAutocompleteModel`.
- Adjust Continue's `requestDelay` setting in `config.json`:
  ```json
  {
    "requestDelay": 500
  }
  ```

### API key errors

- If agentgateway has no authentication, use any placeholder: `"anything"`.
- If using `backendAuth`, ensure gateway has valid provider API keys.
- Check agentgateway logs for auth errors.

## Advanced configuration

### Custom context providers

Continue can send additional context with requests. Configure context providers in `config.json`:

```json
{
  "contextProviders": [
    {
      "name": "code",
      "params": {
        "maxSnippets": 10
      }
    },
    {
      "name": "file",
      "params": {}
    }
  ]
}
```

### Temperature and parameters

Adjust model parameters:

```json
{
  "models": [
    {
      "title": "agentgateway",
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "anything",
      "temperature": 0.7,
      "topP": 0.9,
      "maxTokens": 2000
    }
  ]
}
```

## Related documentation

- [Continue Documentation](https://continue.dev/docs)
- [agentgateway LLM Configuration]({{< link-hextra path="/llm/" >}})
- [Backend Authentication]({{< link-hextra path="/security/policies/backend-auth/" >}})
