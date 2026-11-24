Claude Desktop reads `claude_desktop_config.json` for local MCP servers that run as a command (stdio). The file does not accept a remote `url`. Choose one of the following options to connect to agentgateway.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-mcp-clients-k8s.md" >}}

## Option 1: Local or port-forwarded gateway with mcp-remote {#mcp-remote}

Use the `mcp-remote` package as a stdio bridge. Claude Desktop starts `mcp-remote`, and `mcp-remote` connects to agentgateway over streamable HTTP. This option works when you port-forward the gateway to `localhost`.

1. Install [Node.js](https://nodejs.org/) 18 or later. Claude Desktop uses `npx` to run `mcp-remote`.

2. Open the Claude Desktop configuration file. In Claude Desktop, go to **Settings** > **Developer** > **Edit Config**. If you do not see **Developer**, go to **Settings** > **Desktop app**.

   {{< tabs >}}
   {{% tab name="macOS" %}}
   The file is at `~/Library/Application Support/Claude/claude_desktop_config.json`.
   {{% /tab %}}
   {{% tab name="Windows" %}}
   The file is at `%APPDATA%\Claude\claude_desktop_config.json`.
   {{% /tab %}}
   {{< /tabs >}}

3. Add agentgateway to the `mcpServers` section. Replace `<MCP_URL>` with your MCP endpoint URL, such as `http://localhost:8080/mcp` for a port-forwarded gateway.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "<MCP_URL>"]
       }
     }
   }
   ```

   The `mcp-remote` bridge allows plain `http://` URLs for `localhost`. For any other host, use an `https://` URL or add `"--allow-http"` to `args`.

   If the gateway requires a token, pass it in a header. Put the token in an `env` variable, and reference the variable in the header value. Write the header as `Authorization:${AUTH_HEADER}` with no space after the colon. The `Bearer ` prefix goes in the variable. This form avoids an argument-parsing problem with spaces in Claude Desktop on Windows.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "<MCP_URL>",
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

4. Fully quit Claude Desktop, and open it again. On macOS, press `Cmd+Q`. Closing the window is not enough.

5. In a new chat, open the tools menu, and verify that `agentgateway` is listed with its tools.

If the server shows as failed, check the log at `~/Library/Logs/Claude/mcp-server-agentgateway.log` on macOS or in `%APPDATA%\Claude\logs\` on Windows.

## Option 2: Gateway on public HTTPS {#custom-connector}

If your gateway is reachable on a public HTTPS URL, add it as a custom connector instead. Claude connects to custom connectors from Anthropic's cloud, not from your device. Therefore, the following requirements apply.

* The URL must be reachable on the public internet over HTTPS on port 443. A `localhost` URL and a URL with another port do not work.
* Sending a custom request header, such as an `Authorization` token, is not available to every organization. For the current status and the steps, see [Add custom connectors](https://claude.com/docs/connectors/custom/add-unlisted) and [Getting started with custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp) in the Claude docs.

1. In Claude Desktop, go to **Settings** > **Connectors**, and click **Add custom connector**.
2. Enter your MCP URL, such as `https://mcp.example.com/mcp`.
3. If the gateway uses MCP authentication, complete the OAuth sign-in. Otherwise, select **No sign in**.

