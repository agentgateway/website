## Include targets conditionally {#target-conditions}

Set `condition` on an MCP target to include it only when a Common Expression Language (CEL) expression returns `true`. Omit `condition` to always include the target.

The expression can read request attributes, such as headers, and `mcp.target.name`, the target under evaluation. With authentication configured, it can also read identity attributes, such as JWT claims.

Agentgateway evaluates conditions before contacting targets. Excluded targets receive no requests from the client. [MCP authorization]({{< link-hextra path="/documentation/mcp/tool-access/" >}}) filters list responses after agentgateway contacts the targets. See [About MCP guardrails]({{< link-hextra path="/documentation/mcp/guardrails/about" >}}) to compare the filtering options.

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

2. Save the MCP endpoint of your agentgateway proxy in an environment variable. Select the connection method that you used in [Step 3](#verify).

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export MCP_URL="http://${INGRESS_GW_ADDRESS}/mcp"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   export MCP_URL=http://localhost:8080/mcp
   ```
   {{% /tab %}}
   {{< /tabs >}}

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

* **Evaluation timing**: With `Stateful` routing (the default), conditions run at session initialization. The selected targets apply to all later requests in that session, even without the header. Conditions run again if agentgateway rebuilds the session from its session ID, such as on another replica. With `sessionRouting: Stateless`, conditions run on every request.
* **Stable names**: Tool and prompt names keep their target-name prefix even when only one target remains.
* **Excluded targets**: Their tools are absent from lists. Calls to those tools fail because the target is not part of the session.
* **Evaluation errors**: Agentgateway excludes the target if its condition fails to evaluate, such as when it reads a missing JWT claim.
* **No targets**: If every condition returns `false`, clients see a virtual MCP server with no tools, prompts, or resources.
* **Selector targets**: Conditions apply to each selected Service. The `mcp.target.name` variable holds that Service's generated name. Set the name with the `agentgateway.dev/mcp-target-name` annotation. Otherwise, it defaults to `<service>-<port name>`, or `<service>-<port>` for an unnamed port, such as `mcp-server-everything-3001`.
* **Validation**: A condition requires at least two targets in the {{< reuse "agw-docs/snippets/backend.md" >}}, unless the target uses a `selector`.

| Field | Description |
| ----- | ----------- |
| `spec.mcp.targets[].condition` | Optional CEL expression that controls whether the target participates in the virtual MCP server. The expression must return a boolean value. |
| `mcp.target.name` | CEL variable that holds the name of the target under evaluation. |
