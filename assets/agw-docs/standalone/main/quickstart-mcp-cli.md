To add the server from the terminal instead of the UI in Steps 3 and 4, [install agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) and apply an MCP target resource.

```sh
cat <<'EOF' > mcp-target.yaml
kind: mcp.target
value:
  name: server-everything
  mcp:
    host: http://localhost:3005/mcp
EOF
agctl standalone apply -f mcp-target.yaml
agctl standalone get mcp.target server-everything -o yaml
```

The generated gateway configuration serves MCP alongside the UI on port `4000`. Open the UI and continue with Step 5 to test a tool; the CLI lists the target configuration, not its tools. To remove the target afterward, run `agctl standalone delete mcp.target server-everything`.
