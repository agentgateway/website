Connect AI coding assistants to MCP servers exposed through your agentgateway proxy running in Kubernetes.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. Deploy an MCP server and expose it through agentgateway with an [HTTPRoute]({{< link-hextra path="/documentation/mcp/static-mcp" >}}).

## Get the MCP endpoint URL

The MCP endpoint URL depends on how you exposed the MCP server through agentgateway.

{{< tabs >}}

{{% tab name="LoadBalancer" %}}
```bash
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "MCP URL: http://$INGRESS_GW_ADDRESS/mcp/mcp"
```
{{% /tab %}}

{{% tab name="Port-forward" %}}
```bash
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80 &
```

The MCP endpoint is available at `http://localhost:8080/mcp/mcp`.
{{% /tab %}}

{{< /tabs >}}

> [!NOTE]
> The path `/mcp/mcp` assumes the default HTTPRoute path prefix of `/mcp` from the [Static MCP guide]({{< link-hextra path="/documentation/mcp/static-mcp" >}}). If you configured a different path in your HTTPRoute, adjust accordingly.

{{< doc-test paths="mcp-clients-k8s" >}}
for i in $(seq 1 60); do
  RESP=$(curl -s --max-time 5 -X POST "http://${INGRESS_GW_ADDRESS}:80/mcp/mcp" \
    -H "Accept: application/json, text/event-stream" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}')
  if echo "$RESP" | grep -q "protocolVersion"; then break; fi
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="mcp-clients-k8s" >}}
YAMLTest -f - <<'EOF'
- name: verify MCP initialize through gateway
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /mcp/mcp
    method: POST
    headers:
      Content-Type: application/json
      Accept: application/json, text/event-stream
    body: '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
  source:
    type: local
  retries: 1
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Connect your IDE

Use the MCP endpoint URL from the previous step to configure your IDE. Replace `<MCP_URL>` with your endpoint, such as `http://localhost:8080/mcp/mcp` for port-forward setups.

> [!NOTE]
> **Multiplexed tool names**: If your agentgateway backend routes to more than one [Virtual MCP]({{< link-hextra path="/documentation/mcp/virtual" >}}) target, agentgateway namespaces each tool and prompt name with its target name by default, for example `mcp-server-everything_echo`. When you add a second target, tools in your client's tool list might get new names because of this prefixing. Control it with the `prefixMode` field on the MCP backend; see [Virtual MCP]({{< link-hextra path="/documentation/mcp/virtual" >}}) for the available modes.

{{< cards >}}
  {{< card link="claude-desktop" title="Claude Desktop" subtitle="Connect Claude Desktop" >}}
  {{< card link="claude-code" title="Claude Code" subtitle="Connect the Claude Code CLI" >}}
  {{< card link="cursor" title="Cursor" subtitle="Connect Cursor" >}}
  {{< card link="vscode" title="VS Code (GitHub Copilot)" subtitle="Connect VS Code and GitHub Copilot" >}}
  {{< card link="devin" title="Devin Desktop" subtitle="Connect Devin Desktop (formerly Windsurf)" >}}
{{< /cards >}}

## Authentication

If you configured [MCP auth]({{< link-hextra path="/documentation/mcp/auth/" >}}) on your agentgateway proxy, include the required headers in your client configuration. The following example shows a Bearer token.

{{< tabs >}}

{{% tab name="Claude Code CLI" %}}
```bash
claude mcp add agentgateway --transport http <MCP_URL> \
  --header "Authorization: Bearer <your-token>"
```
{{% /tab %}}

{{% tab name="JSON config (Claude Desktop / Cursor / VS Code / Devin Desktop)" %}}
```json
{
  "mcpServers": {
    "agentgateway": {
      "url": "<MCP_URL>",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```
{{% /tab %}}

{{< /tabs >}}

## Next steps

{{< cards >}}
  {{< card path="/documentation/mcp/static-mcp" title="Static MCP" subtitle="Deploy and expose an MCP server" >}}
  {{< card path="/documentation/mcp/auth/" title="MCP auth" subtitle="Secure MCP endpoints with authentication" >}}
  {{< card path="/documentation/mcp/rate-limit" title="MCP rate limiting" subtitle="Control MCP request rates" >}}
{{< /cards >}}
