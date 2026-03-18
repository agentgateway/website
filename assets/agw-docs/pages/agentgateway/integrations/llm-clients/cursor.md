Configure [Cursor](https://cursor.com/), the AI code editor, to route requests through agentgateway.

## Before you begin

- Agentgateway running at `http://localhost:3000` with a configured LLM backend.
- Cursor installed (version 0.30 or later).

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

1. Open Cursor Settings.
   - **macOS**: `Cmd + ,` or **Cursor** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Navigate to the **Models** tab.

3. Enable **Override OpenAI Base URL** and enter your agentgateway address.

   ```
   http://localhost:3000
   ```

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

Agentgateway may not be running, or the base URL is incorrect.

**How to fix it:**

1. Verify agentgateway is running:
   ```sh
   curl http://localhost:3000/v1/models
   ```
2. Confirm the base URL does not include a trailing path such as `/v1`.

### "Invalid API key" error

**What's happening:**

Cursor rejects requests with an authentication error.

**Why it's happening:**

If agentgateway has no authentication configured, Cursor still requires a non-empty API key field. If authentication is configured, the key may be incorrect.

**How to fix it:**

- If agentgateway has no authentication, enter any placeholder value (`anything`) in the API key field.
- If using gateway authentication, enter the correct API key.
