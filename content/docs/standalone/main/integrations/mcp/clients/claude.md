---
title: Claude
weight: 1
description: Connect Claude Desktop and Claude Code to agentgateway
---

Configure Anthropic's Claude Desktop app or Claude Code CLI to use agentgateway as an MCP server.

> [!NOTE]
> This page covers connecting Claude as an **MCP client**. To proxy Claude Code's **LLM traffic** (prompts and responses) through agentgateway, see the [Claude Code LLM client guide]({{< link-hextra path="/integrations/llm/clients/claude-code" >}}).

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

## Claude Desktop

Claude Desktop reads `claude_desktop_config.json` for local MCP servers that run as a command (stdio). The file does not accept a remote `url`. Choose one of the following options to connect to agentgateway.

### Option 1: Local gateway with mcp-remote {#mcp-remote}

Use the `mcp-remote` package as a stdio bridge. Claude Desktop starts `mcp-remote`, and `mcp-remote` connects to agentgateway over streamable HTTP. This option works with a gateway on `localhost` or a port-forwarded gateway.

1. Install [Node.js](https://nodejs.org/) 18 or later. Claude Desktop uses `npx` to run `mcp-remote`.
2. Open the Claude Desktop configuration file. In Claude Desktop, go to **Settings** > **Developer** > **Edit Config**. If you do not see **Developer**, go to **Settings** > **Desktop app**.

   {{< tabs >}}
   {{< tab name="macOS" >}}
   The file is at `~/Library/Application Support/Claude/claude_desktop_config.json`.
   {{< /tab >}}
   {{< tab name="Windows" >}}
   The file is at `%APPDATA%\Claude\claude_desktop_config.json`.
   {{< /tab >}}
   {{< /tabs >}}

3. Add agentgateway to the `mcpServers` section.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "http://localhost:3000/mcp"]
       }
     }
   }
   ```

   The `mcp-remote` bridge allows plain `http://` URLs for `localhost`. For any other host, use an `https://` URL or add `"--allow-http"` to `args`.

4. Fully quit Claude Desktop, and open it again. On macOS, press `Cmd+Q`. Closing the window is not enough.
5. In a new chat, open the tools menu, and verify that `agentgateway` is listed with its tools.

If the server shows as failed, check the log at `~/Library/Logs/Claude/mcp-server-agentgateway.log` on macOS or in `%APPDATA%\Claude\logs\` on Windows.

To send a token to a gateway that requires authentication, see [Authentication](#authentication).

### Option 2: Gateway on public HTTPS {#custom-connector}

If your gateway is reachable on a public HTTPS URL, add it as a custom connector instead. Claude connects to custom connectors from Anthropic's cloud, not from your device. Therefore, the following requirements apply.

* The URL must be reachable on the public internet over HTTPS on port 443. A `localhost` URL and a URL with another port do not work.
* Sending a custom request header, such as an `Authorization` token, is not available to every organization. For the current status and the steps, see [Add custom connectors](https://claude.com/docs/connectors/custom/add-unlisted) and [Getting started with custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp) in the Claude docs.

1. In Claude Desktop, go to **Settings** > **Connectors**, and click **Add custom connector**.
2. Enter your MCP URL, such as `https://mcp.example.com/mcp`.
3. If the gateway uses MCP authentication, complete the OAuth sign-in. Otherwise, select **No sign in**.


## Claude Code CLI

Configure Claude Code to connect to agentgateway.

```bash
claude mcp add --transport http agentgateway http://localhost:3000/mcp
```

Or, add to your project's `.mcp.json`.

```json
{
  "mcpServers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

> [!WARNING]
> The SSE transport (`/sse`) is deprecated. Use the streamable HTTP transport (`/mcp`) for all new setups.

## Authentication {#authentication}

If agentgateway requires authentication, send the token in the `Authorization` header. Do not put the token in the URL.

{{< tabs >}}
{{< tab name="Claude Code" >}}
Use the `--header` flag.

```bash
claude mcp add --transport http agentgateway http://localhost:3000/mcp \
  --header "Authorization: Bearer <token>"
```

Or, set `headers` in your project's `.mcp.json`.

```json
{
  "mcpServers": {
    "agentgateway": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```
{{< /tab >}}
{{< tab name="Claude Desktop" >}}
Pass the header to `mcp-remote` with `--header`. Put the token in an `env` variable, and reference the variable in the header value. Write the header as `Authorization:${AUTH_HEADER}` with no space after the colon. The `Bearer ` prefix goes in the variable. This form avoids an argument-parsing problem with spaces in Claude Desktop on Windows.

```json
{
  "mcpServers": {
    "agentgateway": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/mcp",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer <token>"
      }
    }
  }
}
```
{{< /tab >}}
{{< /tabs >}}
