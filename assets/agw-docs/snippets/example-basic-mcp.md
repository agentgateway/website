| Field | Description |
| ----- | ----------- |
| `mcp` | The top-level MCP configuration block that defines how agentgateway connects to MCP servers. |
| `port` | The port on which agentgateway listens for incoming MCP requests, such as `3000`. If not specified, a default port is used. |
| `targets` | A list of MCP targets to connect to. Each target defines an MCP server that agentgateway proxies requests to. At least one target is required. |
| `name` | A unique name for the MCP target, such as `server-everything`. This name identifies the target in logs and the UI. |
| `stdio` | Configuration for connecting to an MCP server via standard input/output. Use this for local MCP servers that run as a command. Contains `cmd` (the command to run) and `args` (arguments for the command). In this example, `npx` runs the `@modelcontextprotocol/server-everything` package. |
| `mcp` | Configuration for connecting to a remote MCP server via streamable HTTP. Use this for remote MCP servers. Contains `host` (the URL of the MCP server endpoint). |