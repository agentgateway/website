---
title: MCP observability
weight: 70
description: Track MCP tool calls with agentgateway metrics, logs, and distributed traces.
---

Review MCP-specific metrics, logs, and traces. 

## Before you begin

Complete an MCP guide, such as the [stdio](../connect/stdio) guide. This guide uses the agentgateway playground to interact with an MCP tool server, which generates metrics, logs, and traces.  

## View MCP metrics

You can access the agentgateway metrics endpoint to view MCP-specific metrics, such as the number of tool calls that were performed. 

1. Open the agentgateway [metrics endpoint](http://localhost:15020/metrics). 
2. Look for the `mcp_requests_total` metric. This metric counts the MCP requests that agentgateway processed and includes labels that describe each request, such as:
   * `server`: The MCP server that was used for the request.
   * `method`: The MCP method that was invoked, such as `tools/call` or `tools/list`.
   * `resource`: The name of the tool or resource that was accessed.
   * `resource_type`: The type of resource, such as `tool`, `prompt`, or `resource`.

   To count only tool calls, filter the metric on the `method` label.

## View traces

1. {{< reuse "agw-docs/snippets/jaeger.md" >}}

2. Configure your agentgateway proxy to emit traces and send them to the built-in OpenTelemetry collector agent. This example uses static tracing configuration. For per-route dynamic tracing configuration, see [Dynamic tracing]({{< link-hextra path="/reference/observability/traces#dynamic-tracing" >}}). 
   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:  
     tracing:
       otlpEndpoint: http://localhost:4317
       randomSampling: true
   mcp:
     port: 3000
     targets:
     - name: everything
       stdio:
         cmd: npx
         args: ["@modelcontextprotocol/server-everything"]
   EOF
   ```

3. Run your agentgateway proxy. 
   ```sh
   agentgateway -f config.yaml
   ```

4. Open the [agentgateway playground](http://localhost:15000/ui/playground/) and click **Connect**. Then, select a tool, such as `echo`, enter any message, and click **Run Tool**. 

5. Open the [Jaeger UI](http://localhost:16686/search) and select the `call_tool` operation. Then, verify that you can see traces for your MCP tool call. 
   

## View logs

Agentgateway automatically logs information to stdout. When you run agentgateway on your local machine, you can view a log entry for each request that is sent to agentgateway in your CLI output. 

Example for a successful MCP tool call:
```
INFO request ... protocol=mcp mcp.method.name=tools/call mcp.target=everything gen_ai.tool.name=echo mcp.session.id=6b497ee9-3710-428a-96d2-31ebeab73dcd trace.id=286cb6c44380a45e1f77f29ce4d146fd span.id=f7f30629c29d9089
```

### MCP logging fields

Agentgateway includes the following MCP-specific fields in structured logs:

| Field | Description |
|-------|-------------|
| `mcp.method.name` | The MCP method being invoked, such as `initialize`, `tools/list`, or `tools/call`. |
| `mcp.session.id` | The unique session identifier for the MCP connection. |
| `mcp.target` | The target MCP server name. |
| `mcp.resource.type` | The type of resource, such as `tool`, `prompt`, `resource`, or `templates`. |
| `mcp.resource.uri` | The URI of the resource being accessed. Emitted for resource requests. |
| `gen_ai.tool.name` | The name of the tool being called. Emitted for tool-call requests. |

These fields are part of default structured logging and are emitted automatically for every MCP request. To customize access logs further, you can use [CEL expressions]({{< link-hextra path="/reference/cel/variables" >}}) to filter which requests are logged and add post-request fields that are not captured by default. For example, the following access log policy filters access log entries to only tool calls and adds the tool arguments and result to each log entry:

```yaml
frontendPolicies:
  accessLog:
    filter: 'mcp.methodName == "tools/call"'
    add:
      tool_args: 'mcp.tool.arguments'
      tool_result: 'mcp.tool.result'
      tool_error: 'mcp.tool.error'
```

The following CEL variables are available in access log policies but are **not** included in default structured logs:

| Variable | Availability | Description |
|----------|-------------|-------------|
| `mcp.methodName` | Request-time | The MCP JSON-RPC method name, such as `tools/call` or `tools/list`. |
| `mcp.sessionId` | Request-time | The MCP session ID. |
| `mcp.tool.name` | Request-time | The name of the tool being called. |
| `mcp.tool.target` | Request-time | The target backend handling the tool call. |
| `mcp.tool.arguments` | Request-time | The JSON arguments passed to the tool call. |
| `mcp.tool.result` | Post-request | The tool call result payload. |
| `mcp.tool.error` | Post-request | The tool call error payload. |

For the full list of CEL variables, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables" >}}).