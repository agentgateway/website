---
title: MCP observability
weight: 70
description:
---

Review MCP-specific metrics, logs, and traces. 

## Before you begin

Complete an MCP guide, such as the [stdio](../connect/stdio) guide. This guide uses the agentgateway playground to interact with an MCP tool server, wich generates metrics, logs, and traces.  

## View MCP metrics

You can access the agentgateway metrics endpoint to view MCP-specific metrics, such as the number of tool calls that were performed. 

1. Open the agentgateway [metrics endpoint](http://localhost:15020/metrics). 
2. Look for the `list_calls_total` metric. This metric shows the number of tool calls that were performed and includes important information about the call, such as:
   * `server`: The MCP server that was used for the tool call.  
   * `name`: The name of the tool that was used. 

## View traces

1. {{< reuse "docs/snippets/jaeger.md" >}}

2. Configure your agentgateway proxy to emit traces and send them to the built-in OpenTelemetry collector agent. 
   ```yaml
   cat <<EOF > config.yaml
   config:  
     tracing:
       otlpEndpoint: http://localhost:4317
       randomSampling: true
   binds:
   - port: 3000
     listeners:
     - routes:
       - policies:
           cors:
             allowOrigins:
               - "*"
             allowHeaders:
               - mcp-protocol-version
               - content-type
               - cache-control
         backends:
         - mcp:
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
2025-09-04T20:01:40.493660Z	info	mcp::sse	new client message for /sse	
session_id="6b497ee9-3710-428a-96d2-31ebeab73dcd"Request(JsonRpcRequest 
{ jsonrpc: JsonRpcVersion2_0, id: Number(4), request: CallToolRequest(Request
{ method: CallToolRequestMethod, params: CallToolRequestParam { name: "echo", 
arguments: Some({"message": String("hello world")}) }, extensions: Extensions }) })	
```