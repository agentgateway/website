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
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
     | sed -n 's/^data: //p' | jq -r '.result.tools[].name'
   ```

   Example output:

   ```console
   mcp-server-everything-3001_echo
   mcp-server-everything-3001_get-annotated-message
   mcp-server-everything-3001_get-env
   ...
   mcp-server-everything-3001_simulate-research-query
   ```

5. Initialize another session with `x-include-fetcher: true` and list its tools. Include the header on every request. Verify that the list now includes `mcp-website-fetcher_fetch`.

   ```sh
   export MCP_SESSION_ID=$(curl -s -D - $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "x-include-fetcher: true" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
     | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
   curl -s $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "x-include-fetcher: true" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
   curl -s $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "x-include-fetcher: true" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
     | sed -n 's/^data: //p' | jq -r '.result.tools[].name'
   ```

   Example output:

   ```console
   mcp-server-everything-3001_echo
   mcp-server-everything-3001_get-annotated-message
   mcp-server-everything-3001_get-env
   ...
   mcp-server-everything-3001_simulate-research-query
   mcp-website-fetcher_fetch
   ```

6. In the same session, send a request without the header. The conditions now select different targets, so agentgateway rejects the request.

   ```sh
   curl -i -s $MCP_URL \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "mcp-session-id: $MCP_SESSION_ID" \
     -d '{"jsonrpc":"2.0","id":3,"method":"tools/list"}'
   ```

   Example output:

   ```console
   HTTP/1.1 404 Not Found
   content-type: text/plain
   content-length: 17

   session not found
   ```

Conditions run on every request. Keep these behaviors in mind:

* **Stateful sessions (default)**: Each request must select the same targets as at initialization. A change, such as dropping the header, returns `404` with `session not found`.
* **Session recovery**: After a session `404`, the MCP specification requires the client to start a new session. Its requests determine the new target selection.
* **Stateless sessions**: With `sessionRouting: Stateless`, each request uses the targets its conditions select.
* **Stable names**: Tool and prompt names keep their target-name prefix even when only one target remains.
* **Excluded targets**: Their tools are absent from lists. Calls to those tools fail because the target is not part of the session.
* **Evaluation errors**: Agentgateway excludes the target if its condition fails to evaluate, such as when it reads a missing JWT claim.
* **Invalid expressions**: Invalid CEL excludes the target from all sessions. See [Check for invalid conditions](#invalid-conditions).
* **No targets**: If every condition returns `false`, clients see a virtual MCP server with no tools, prompts, or resources.
* **Selector targets**: Conditions apply to each selected Service. The `mcp.target.name` variable holds that Service's generated name. Set the name with the `agentgateway.dev/mcp-target-name` annotation. Otherwise, it defaults to `<service>-<port name>`, or `<service>-<port>` for an unnamed port, such as `mcp-server-everything-3001`.
* **Validation**: A condition requires at least two targets in the {{< reuse "agw-docs/snippets/backend.md" >}}, unless the target uses a `selector`.

| Field | Description |
| ----- | ----------- |
| `spec.mcp.targets[].condition` | Optional CEL expression that controls whether the target participates in the virtual MCP server. The expression must return a boolean value. |
| `mcp.target.name` | CEL variable that holds the name of the target under evaluation. |

### Check for invalid conditions {#invalid-conditions}

An invalid CEL `condition` causes the {{< reuse "agw-docs/snippets/backend.md" >}} to report `Accepted: True` with reason `PartiallyValid`. The status message identifies the expression.

The affected target is excluded from all sessions. Other targets keep working.

Check the status of the {{< reuse "agw-docs/snippets/backend.md" >}}.

```sh
kubectl get {{< reuse "agw-docs/snippets/backend.md" >}} mcp -o jsonpath='{.status.conditions}' | jq
```

Example output for a condition that is missing its right operand:

```json
[
  {
    "lastTransitionTime": "2026-10-23T19:34:16Z",
    "message": "failed to translate backend: MCP target condition is not a valid CEL expression: request.headers[\"x-include-fetcher\"] ==",
    "observedGeneration": 2,
    "reason": "PartiallyValid",
    "status": "True",
    "type": "Accepted"
  }
]
```
