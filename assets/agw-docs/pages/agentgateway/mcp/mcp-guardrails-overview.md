Agentgateway provides three ways to filter Model Context Protocol (MCP) traffic through a virtual MCP server. Use them separately or together:

* **Filter a request** with [guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}) (`mcpGuardrails`). Inspect tool arguments and results to reject disallowed calls or mask sensitive data. Use a remote processor to call an external policy service.
* **Filter a target** with a {{< conditional-text include-if="kubernetes" >}}[target `condition`]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[target `condition`]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}){{< /conditional-text >}}. Exclude an upstream MCP server before agentgateway contacts it.
* **Filter tools and other resources** with {{< conditional-text include-if="kubernetes" >}}[MCP authorization]({{< link-hextra path="/documentation/mcp/tool-access" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[MCP authorization (`mcpAuthorization`)]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}){{< /conditional-text >}}. Hide individual tools, prompts, and resources from list responses, and reject calls to them. Rules evaluate each item separately, so you can allow some tools and hide the rest.

All three support Common Expression Language (CEL) expressions that read request attributes, such as headers and JWT claims. Their scope and timing differ.

## Compare the options {#compare}

Use this table to compare what each option filters, when it runs, and whether agentgateway contacts upstream servers.

| | Filter a request | Filter a target | Filter tools and other resources |
|--|--|--|--|
| **Configure with** | {{% conditional-text include-if="kubernetes" %}}`backend.mcp.guardrails` in an {{< reuse "agw-docs/snippets/policy.md" >}}{{% /conditional-text %}}{{% conditional-text include-if="standalone" %}}`mcpGuardrails` policy{{% /conditional-text %}} | {{% conditional-text include-if="kubernetes" %}}`spec.mcp.targets[].condition` in an {{< reuse "agw-docs/snippets/backend.md" >}}{{% /conditional-text %}}{{% conditional-text include-if="standalone" %}}`condition` on an MCP target{{% /conditional-text %}} | {{% conditional-text include-if="kubernetes" %}}`backend.mcp.authorization` in an {{< reuse "agw-docs/snippets/policy.md" >}}{{% /conditional-text %}}{{% conditional-text include-if="standalone" %}}`mcpAuthorization` policy{{% /conditional-text %}} |
| **What it filters** | One MCP request or response, for the methods that you select | One upstream MCP server | One tool, prompt, or resource at a time |
| **When it runs** | Before forwarding the request, after receiving the response, or both | At session initialization (stateful), or on every request (stateless) | On each listed item or call to an individual item |
| **What it can read** | The full request parameters (`mcp.params`) or response result (`mcp.result`), plus the request context | The request context and the name of the target (`mcp.target.name`) | The item, such as `mcp.tool.name` and `mcp.tool.target`, plus the request context. Tool arguments are not available. |
| **Can rewrite content** | Yes. Mask or replace fields with a CEL `transform` or a remote ExtMCP server. | No | No |
| **Contacts the upstream server** | No, for a rejected request | No, for an excluded target | Yes. Agentgateway initializes and lists every included target, then removes denied items. |
| **What the client sees** | An error with your rejection message. For `tools/call`, a tool result with `isError: true`. | A virtual MCP server without that target's tools, prompts, or resources | Lists without the denied items. Denied tools appear not to exist. |

## Example: Keep a client away from an MCP server {#example}

The following authorization rule hides the `admin-tools` target's tools from clients without the `admin` role. Agentgateway still initializes the target and sends it `tools/list` requests for those clients.

{{< conditional-text include-if="kubernetes" >}}
```yaml
backend:
  mcp:
    authorization:
      action: Allow
      policy:
        matchExpressions:
          - 'mcp.tool.target != "admin-tools" || (has(jwt.roles) && "admin" in jwt.roles)'
```
{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}
```yaml
mcpAuthorization:
  rules:
  - 'mcp.tool.target != "admin-tools" || (has(jwt.roles) && "admin" in jwt.roles)'
```
{{< /conditional-text >}}
To exclude `admin-tools` before agentgateway contacts it, move the role check to the target's `condition`:

{{< conditional-text include-if="kubernetes" >}}
```yaml
spec:
  mcp:
    targets:
    - name: public-tools
      static:
        host: public-tools.default.svc.cluster.local
        port: 80
    - name: admin-tools
      static:
        host: admin-tools.default.svc.cluster.local
        port: 80
      condition: 'has(jwt.roles) && "admin" in jwt.roles'
```
{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}
```yaml
targets:
- name: public-tools
  mcp:
    host: http://public-tools:8080/mcp
- name: admin-tools
  mcp:
    host: http://admin-tools:8080/mcp
  condition: 'has(jwt.roles) && "admin" in jwt.roles'
```
{{< /conditional-text >}}
Both examples require an authenticated request with claims in the `jwt` variable. Do not base access decisions on a header that the client controls.

## How the options work together {#order}

When a client sends a request to a virtual MCP server, agentgateway applies the options in the following order.

1. **Authentication**: If you configure MCP authentication or JWT authentication, agentgateway validates the client's token first. The resulting claims are available to all three options as `jwt`.
2. **Target conditions**: Agentgateway includes only targets whose condition returns `true`. Evaluation errors exclude the target. Conditions run once at initialization for stateful sessions (the default), or on every request in stateless mode.
3. **Request-phase guardrail processors**: Agentgateway runs the processors for the request's method in order. The first processor that rejects the request stops the chain, and agentgateway does not contact any target. For a fanout method such as `tools/list`, the processors run once for the whole request.
4. **Authorization of calls**: For a call to a single tool, prompt, or resource, such as `tools/call`, MCP authorization checks the item. If the item is not allowed, agentgateway rejects the call.
5. **Upstream request**: Agentgateway forwards the request to the selected target, or fans it out to every selected target.
6. **Authorization of lists**: For methods such as `tools/list`, MCP authorization removes denied items from each target's response. Agentgateway then merges the responses and adds target-name prefixes.
7. **Response-phase guardrail processors**: Agentgateway runs the processors on the response. For a fanout method, the processors run once, on the merged response.

## Next steps {#next-steps}

* Reject or mask requests and responses with [CEL guardrails]({{< link-hextra path="/documentation/mcp/guardrails/cel" >}}) or [remote guardrails]({{< link-hextra path="/documentation/mcp/guardrails/setup" >}}).
* Include targets conditionally in a {{< conditional-text include-if="kubernetes" >}}[virtual MCP server]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[virtual MCP server]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}){{< /conditional-text >}}.
* Hide tools from clients with {{< conditional-text include-if="kubernetes" >}}[MCP authorization]({{< link-hextra path="/documentation/mcp/tool-access" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[MCP authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}){{< /conditional-text >}}.
