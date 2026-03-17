Configure [Cursor](https://cursor.com/), the AI code editor, to route requests through agentgateway.

## Before you begin

- agentgateway running at `http://localhost:3000` with a configured LLM backend.
- Cursor installed (version 0.30 or later).

## Configure Cursor

1. Open Cursor Settings.
   - **macOS**: `Cmd + ,` or **Cursor** → **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** → **Preferences** → **Settings**

2. Navigate to the **Models** tab.

3. Under **OpenAI API Key**, enter a placeholder value such as `anything` if agentgateway has no authentication configured, or your gateway API key if authentication is enabled.

4. Enable **Override OpenAI Base URL** and enter your agentgateway address:

   ```
   http://localhost:3000
   ```

5. Click **Verify** to confirm the connection.

## Verify the connection

1. Open the Cursor chat panel (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Send a message, for example: "Hello, are you working?"
3. Cursor should respond using your agentgateway backend.

## Troubleshooting

### "Failed to fetch" error

**What's happening:**

Cursor cannot connect to agentgateway.

**Why it's happening:**

agentgateway may not be running, or the base URL is incorrect.

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
