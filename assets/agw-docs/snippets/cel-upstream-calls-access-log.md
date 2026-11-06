#### Log outbound calls from access logs {#log-outbound-calls-from-access-logs}

Access log expressions can use `upstreamCalls` to inspect the outbound HTTP calls made for a request, such as MCP target calls and policy callouts. The `upstreamCalls` list is filled in only when a logging, tracing, or metrics expression references `upstreamCalls`. Calls to `stdio` MCP targets are not in the list, because a `stdio` target does not use HTTP.

The following example adds two fields to the access log:

- `mcp_token_audiences`: The `aud` claim of the bearer token that each MCP target receives in the `authorization` header, after backend authentication or token exchange.
- `upstream_call_statuses`: The kind, subtype, target, and HTTP status code of each outbound call.

{{< conditional-text include-if="kubernetes" >}}
```yaml
spec:
  frontend:
    accessLog:
      attributes:
        add:
        - name: mcp_token_audiences
          expression: 'upstreamCalls.filter(c, c.subtype == "Mcp" && has(c.request.headers.authorization) && c.request.headers.authorization.startsWith("Bearer ")).map(c, unvalidatedJwtPayload(c.request.headers.authorization.split(" ")[1]).aud)'
        - name: upstream_call_statuses
          expression: 'upstreamCalls.map(c, {"kind": c.kind, "subtype": c.subtype, "target": c.target, "status": c.response.code})'
```
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
```yaml
frontendPolicies:
  accessLog:
    add:
      mcp_token_audiences: 'upstreamCalls.filter(c, c.subtype == "Mcp" && has(c.request.headers.authorization) && c.request.headers.authorization.startsWith("Bearer ")).map(c, unvalidatedJwtPayload(c.request.headers.authorization.split(" ")[1]).aud)'
      upstream_call_statuses: 'upstreamCalls.map(c, {"kind": c.kind, "subtype": c.subtype, "target": c.target, "status": c.response.code})'
```
{{< /conditional-text >}}

Each entry in `upstreamCalls` has the following fields that the example uses. For every field, see the {{< conditional-text include-if="kubernetes" >}}[CEL reference]({{< link-hextra path="/reference/cel/cel-context-interactive" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[CEL reference]({{< link-hextra path="/reference/cel/cel-context" >}}){{< /conditional-text >}}.

| Field | Description |
|-------|-------------|
| `kind` | `Primary` for the backend request, or `Policy` for a policy callout. |
| `subtype` | The type of call, such as `Mcp`, `Llm`, `ExtAuthz`, or `Http`. |
| `target` | For an MCP call, the name of the MCP target. For other calls, the connection address in `host:port` form. |
| `request.headers` | The headers sent to the backend, after backend authentication. The top-level `request.headers` variable still has the headers from the client. |
| `response.code` | The HTTP status code. Empty when the call got no response. To find out why a call failed, read the `error` field. |
