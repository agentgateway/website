Agentgateway gives you three ways to control what Model Context Protocol (MCP) clients can reach through a virtual MCP server. Each way acts at a different point in the request and filters something different:

* **Filter a request** with [guardrail processors]({{< link-hextra path="/documentation/mcp/guardrails/processors" >}}) (`mcpGuardrails`). Reject or rewrite an entire MCP request or response, such as a `tools/call` request whose arguments contain sensitive data.
* **Filter a target** with a {{< conditional-text include-if="kubernetes" >}}[target `condition`]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[target `condition`]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}){{< /conditional-text >}}. Leave an entire upstream MCP server out of a virtual MCP server, so that agentgateway never contacts it for that client.
* **Filter tools and other resources** with {{< conditional-text include-if="kubernetes" >}}[MCP authorization]({{< link-hextra path="/documentation/mcp/tool-access" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[MCP authorization (`mcpAuthorization`)]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}){{< /conditional-text >}}. Hide individual tools, prompts, and resources from list responses, and reject calls to them.

All three use Common Expression Language (CEL) expressions, so they can make decisions based on the same request attributes, such as headers and JWT claims. They differ in what they can see, what they can change, and whether agentgateway contacts the upstream MCP server.

## Compare the options {#compare}

| | Filter a request | Filter a target | Filter tools and other resources |
|--|--|--|--|
| **Configure with** | {{< conditional-text include-if="kubernetes" >}}`backend.mcp.guardrails` in an {{< reuse "agw-docs/snippets/policy.md" >}}{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}`mcpGuardrails` policy{{< /conditional-text >}} | {{< conditional-text include-if="kubernetes" >}}`spec.mcp.targets[].condition` in an {{< reuse "agw-docs/snippets/backend.md" >}}{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}`condition` on an MCP target{{< /conditional-text >}} | {{< conditional-text include-if="kubernetes" >}}`backend.mcp.authorization` in an {{< reuse "agw-docs/snippets/policy.md" >}}{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}`mcpAuthorization` policy{{< /conditional-text >}} |
| **What it filters** | One MCP request or response, for the methods that you select | One upstream MCP server | One tool, prompt, or resource at a time |
| **When it runs** | Before agentgateway contacts any target (request phase), after the targets respond (response phase), or both | When the client initializes a session, before agentgateway initializes any target. In stateless mode, on every request. | On each item in a list response, and on each call to a single tool, prompt, or resource |
| **What it can read** | The full request parameters (`mcp.params`) or response result (`mcp.result`), plus the request context | The request context and the name of the target (`mcp.target.name`) | The item, such as `mcp.tool.name` and `mcp.tool.target`, plus the request context. Tool arguments are not available. |
| **Can rewrite content** | Yes. Mask or replace fields with a CEL `transform` or a remote ExtMCP server. | No | No |
| **Contacts the upstream server** | No, for a rejected request | No. An excluded target is never initialized, listed, or called. | Yes. Every target is initialized and listed, and agentgateway removes the items that are not allowed afterward. |
| **What the client sees** | An error with your rejection message. For `tools/call`, a tool result with `isError: true`. | A virtual MCP server without that target's tools, prompts, or resources | Lists without the denied items. A call to a denied tool fails as if the tool does not exist. |

## Choose an option {#choose}

Use the option that matches what you want to keep from the client.

* **To keep a client away from an entire MCP server, use a target condition.** MCP authorization can hide every tool of a target, for example with a rule on `mcp.tool.target`. However, agentgateway still initializes that target and fans out `initialize` and `tools/list` requests to it for every client, because authorization filters the results only after the target responds. A target condition removes the target before agentgateway contacts it.
* **To hide specific tools, prompts, or resources, use MCP authorization.** Authorization rules evaluate each item separately, so you can allow a few tools of a target and hide the rest, based on JWT claims or other request attributes. Hidden tools look the same to the client as tools that do not exist.
* **To inspect or change the content of a request or response, use guardrail processors.** Processors can read tool arguments and results, which the other options cannot. Use a CEL expression processor to reject calls with disallowed arguments or to mask data, such as with the `regexReplace` and `regexReplaceAll` functions. Use a remote processor to call an external policy service.

You can combine all three. For example, use a target condition to expose an admin MCP server only to administrators, MCP authorization to hide destructive tools from some of those administrators, and a guardrail processor to mask secrets in every tool result.

## Example: keep a client away from an MCP server {#example}

A common goal is to expose an admin MCP server only to administrators. The following MCP authorization rule hides the tools of the `admin-tools` target from every client that does not have the `admin` role. However, agentgateway still initializes the `admin-tools` target and sends it the `tools/list` request for every client, and then removes its tools from the response.

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
To keep agentgateway from contacting the `admin-tools` target for other clients at all, move the check to a condition on the target instead.

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
Both examples assume that the request is authenticated, so that the `jwt` variable holds the client's claims. Do not base access decisions on a header that the client controls.

## How the options work together {#order}

When a client sends a request to a virtual MCP server, agentgateway applies the options in the following order.

1. **Authentication**: If you configure MCP authentication or JWT authentication, agentgateway validates the client's token first. The resulting claims are available to all three options as `jwt`.
2. **Target conditions**: Agentgateway evaluates the condition of each target and keeps only the targets whose condition returns `true`. In a stateful session, which is the default, this step happens once, when the client initializes the session. If a condition fails to evaluate, such as when it reads a JWT claim and the request has no JWT, the target is excluded.
3. **Request-phase guardrail processors**: Agentgateway runs the processors for the request's method in order. The first processor that rejects the request stops the chain, and agentgateway does not contact any target. For a fanout method such as `tools/list`, the processors run once for the whole request.
4. **Authorization of calls**: For a call to a single tool, prompt, or resource, such as `tools/call`, MCP authorization checks the item. If the item is not allowed, agentgateway rejects the call.
5. **Upstream request**: Agentgateway forwards the request to the selected target, or fans it out to every selected target.
6. **Authorization of lists**: For list methods such as `tools/list`, MCP authorization removes the items that the client is not allowed to see from each target's response. Then, agentgateway merges the responses and adds the target-name prefixes.
7. **Response-phase guardrail processors**: Agentgateway runs the processors on the response. For a fanout method, the processors run once, on the merged response.

Because request-phase guardrail processors run before authorization, a processor that rejects a call takes precedence over an authorization rule for the same call.

## Next steps {#next-steps}

* Reject or mask requests and responses with [CEL guardrails]({{< link-hextra path="/documentation/mcp/guardrails/cel" >}}) or [remote guardrails]({{< link-hextra path="/documentation/mcp/guardrails/setup" >}}).
* Include targets conditionally in a {{< conditional-text include-if="kubernetes" >}}[virtual MCP server]({{< link-hextra path="/documentation/mcp/virtual/#target-conditions" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[virtual MCP server]({{< link-hextra path="/integrations/mcp/servers/virtual/#target-conditions" >}}){{< /conditional-text >}}.
* Hide tools from clients with {{< conditional-text include-if="kubernetes" >}}[MCP authorization]({{< link-hextra path="/documentation/mcp/tool-access" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[MCP authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}){{< /conditional-text >}}.
