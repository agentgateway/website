## Include targets conditionally {#target-conditions}

Use the `condition` field on an MCP target to include that target only when a Common Expression Language (CEL) expression returns `true`. The expression can read request attributes, such as headers, and the `mcp.target.name` variable, which is set to the target under evaluation. When authentication is configured, it can also read the authenticated identity, such as JWT claims. Omit `condition` to include the target for every request.

Agentgateway evaluates the condition before it initializes or contacts the target. An excluded target does not receive the `initialize`, `tools/list`, or any other request from that client. By contrast, [MCP authorization]({{< link-hextra path="/documentation/mcp/tool-access/" >}}) filters tools after every target responds, so agentgateway still initializes the target and fans out list requests to it. For a comparison of the ways to filter MCP traffic, see [About MCP guardrails]({{< link-hextra path="/documentation/mcp/guardrails/about" >}}).

1. Update the {{< reuse "agw-docs/snippets/backend.md" >}} to include the `mcp-website-fetcher` target only when the request has the `x-include-fetcher: true` header.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: mcp
   spec:
     mcp:
       targets:
         - name: mcp-server-everything
           selector:
             services:
               matchLabels:
                 app: mcp-server-everything
         - name: mcp-website-fetcher
           static:
             host: mcp-website-fetcher.default.svc.cluster.local
             port: 80
             protocol: SSE
           condition: '"x-include-fetcher" in request.headers && request.headers["x-include-fetcher"] == "true"'
   EOF
   ```

2. Save the MCP endpoint of your agentgateway proxy in an environment variable. Use the address from [Step 3](#verify), such as `http://${INGRESS_GW_ADDRESS}/mcp` for a load balancer address or `http://localhost:8080/mcp` for a port-forward.

   ```sh
   export MCP_URL=http://localhost:8080/mcp
   ```

3. Initialize an MCP session without the header, and save the session ID.

   ```sh
   export MCP_SESSION_ID=$(curl -s -D - $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
     | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
   curl -s $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
   ```

4. List the tools in the session. Verify that the list includes only the `mcp-server-everything-3001_*` tools, such as `mcp-server-everything-3001_echo`, and not the `mcp-website-fetcher_fetch` tool.

   ```sh
   curl -s $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
   ```

5. Repeat the previous two steps, and add the `-H "x-include-fetcher: true"` header to the `initialize` request. Verify that the tool list now also includes the `mcp-website-fetcher_fetch` tool.

Keep the following behaviors in mind when you write target conditions:

* **When conditions are evaluated**: With the default `Stateful` session routing, agentgateway evaluates the conditions when the client initializes the session. The selected targets apply to every later request in that session, whether or not those requests send the header. With `sessionRouting: Stateless`, agentgateway evaluates the conditions for every request.
* **Names stay prefixed**: Tool and prompt names keep their target-name prefix even when only one target remains, so that names stay stable across requests.
* **Calls to excluded targets fail**: The tools of an excluded target are not listed. If a client calls one anyway, agentgateway returns an error because the target is not part of the session.
* **Errors exclude the target**: If a condition fails to evaluate, such as when it reads a JWT claim and the request has no JWT, agentgateway excludes the target.
* **No targets**: If every condition returns `false`, clients see a virtual MCP server with no tools, prompts, or resources.
* **Selector targets**: A condition on a `selector` target applies to each selected Service. In the condition, `mcp.target.name` is the generated name of the selected Service, not the `name` of the target. The generated name is the value of the Service's `agentgateway.dev/mcp-target-name` annotation. If the annotation is not set, the name is `<service>-<port name>`, or `<service>-<port>` when the port has no name, such as `mcp-server-everything-3001`.
* **Validation**: A condition requires at least two targets in the {{< reuse "agw-docs/snippets/backend.md" >}}, unless the target uses a `selector`.

| Field | Description |
| ----- | ----------- |
| `spec.mcp.targets[].condition` | Optional CEL expression that controls whether the target participates in the virtual MCP server. The expression must return a boolean value. |
| `mcp.target.name` | CEL variable that holds the name of the target under evaluation. |
