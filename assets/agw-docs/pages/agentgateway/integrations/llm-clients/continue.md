Configure [Continue](https://continue.dev/), the open-source AI code assistant for VS Code, to route requests through agentgateway.

## Before you begin

- Agentgateway running at `http://localhost:3000` with a configured LLM backend.
- VS Code with the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) installed.

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

## Configure Continue

1. Edit `~/.continue/config.json` to add your agentgateway endpoint.
2. Save the file and reload Continue in VS Code.

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
  ]
}
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Field | Description |
|-------|-------------|
| `title` | Display name shown in the Continue model selector. |
| `provider` | Set to `openai` for any OpenAI-compatible endpoint. |
| `model` | The model name from your agentgateway backend configuration. |
| `apiBase` | Your agentgateway URL with the `/v1` path. |
| `apiKey` | A placeholder value if agentgateway has no authentication, or your gateway API key. |

## Verify the connection

1. Open the Continue sidebar in VS Code (`Cmd + M` on macOS, `Ctrl + M` on Windows/Linux).
2. Select **agentgateway** from the model dropdown.
3. Send a test message: "Hello, are you working?"

## Troubleshooting

### Connection refused

**What's happening:**

Continue cannot reach agentgateway.

**Why it's happening:**

Agentgateway is not running, or the `apiBase` URL is incorrect.

**How to fix it:**

1. Verify agentgateway is running:
   ```sh
   curl http://localhost:3000/v1/models
   ```
2. Confirm the `apiBase` value includes the `/v1` path.
