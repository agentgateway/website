Connect AI coding assistants to MCP servers exposed through your agentgateway proxy running in Kubernetes.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Deploy an MCP server and expose it through agentgateway with an [HTTPRoute]({{< link-hextra path="/mcp/static-mcp" >}}).

## Get the MCP endpoint URL

The MCP endpoint URL depends on how you exposed the MCP server through agentgateway.

{{< tabs items="LoadBalancer,Port-forward" >}}

{{% tab tabName="LoadBalancer" %}}
```bash
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "MCP URL: http://$INGRESS_GW_ADDRESS/mcp/mcp"
```
{{% /tab %}}

{{% tab tabName="Port-forward" %}}
```bash
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80 &
```

The MCP endpoint is available at `http://localhost:8080/mcp/mcp`.
{{% /tab %}}

{{< /tabs >}}

{{< callout type="info" >}}
The path `/mcp/mcp` assumes the default HTTPRoute path prefix of `/mcp` from the [Static MCP guide]({{< link-hextra path="/mcp/static-mcp" >}}). If you configured a different path in your HTTPRoute, adjust accordingly.
{{< /callout >}}

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

Review the following table of configuration details by IDE environment.

{{< reuse "agw-docs/snippets/mcp-ide-comparison.md" >}}

### Claude Code

1. Add the MCP server to your Claude configuration.
   
   {{< tabs tabTotal="2" items="CLI, mcp.json file">}}
   {{% tab tabName="CLI" %}}
   ```bash
   claude mcp add agentgateway --transport http <MCP_URL>
   ```
   {{% /tab %}}
   {{% tab tabName="mcp.json file" %}}
   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "url": "<MCP_URL>"
       }
     }
   }
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Verify the connection.

   ```bash
   claude mcp list
   ```

The `agentgateway` server shows up as **Connected**.

### Cursor

1. Create or edit `.cursor/mcp.json` in your project root.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "url": "<MCP_URL>"
       }
     }
   }
   ```

2. Restart Cursor and verify that agentgateway tools appear in the MCP tools list.

### VS Code (GitHub Copilot)

1. Add to your VS Code `settings.json`.

   ```json
   {
     "mcp": {
       "servers": {
         "agentgateway": {
           "url": "<MCP_URL>"
         }
       }
     }
   }
   ```

2. Restart VS Code and verify that agentgateway tools appear in the MCP tools list.


### Windsurf

1. Create or edit `~/.windsurf/mcp.json`.

   ```json
   {
     "mcpServers": {
       "agentgateway": {
         "url": "<MCP_URL>"
       }
     }
   }
   ```

2. Restart Windsurf and verify that agentgateway tools appear in the MCP tools list.


## Authentication

If you configured [MCP auth]({{< link-hextra path="/mcp/auth/" >}}) on your agentgateway proxy, include the required headers in your client configuration. The following example shows a Bearer token.

{{< tabs items="Claude Code CLI,JSON config (Cursor / VS Code / Windsurf)" >}}

{{% tab tabName="Claude Code CLI" %}}
```bash
claude mcp add agentgateway --transport http <MCP_URL> \
  --header "Authorization: Bearer <your-token>"
```
{{% /tab %}}

{{% tab tabName="JSON config (Cursor / VS Code / Windsurf)" %}}
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
  {{< card path="/mcp/static-mcp" title="Static MCP" subtitle="Deploy and expose an MCP server" >}}
  {{< card path="/mcp/auth/" title="MCP auth" subtitle="Secure MCP endpoints with authentication" >}}
  {{< card path="/mcp/rate-limit" title="MCP rate limiting" subtitle="Control MCP request rates" >}}
{{< /cards >}}
