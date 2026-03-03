Configure stateful or stateless session routing to MCP backends. 

## About MCP sessions

An MCP session is a set of related interactions between a client and an MCP server that starts with the client-server initialization phase. According to the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#session-management), a session for the Streamable HTTP transport is established if the server sends back an `Mcp-Session-Id` header during the initialization phase. Clients include this header in subsequent requests to keep the stateful session. 

If you run multiple agentgateway proxy instances without stateful sessions, the first request might be forwarded to one instance and a session is created for that instance. However, later requests might be forwarded to a different proxy instance that does not know about the session. 

To ensure that subsequent requests are routed to the same agentgateway proxy instance, the proxy exposes streamable HTTP endpoints as stateful endpoints by default and sends back the session ID in the `Mcp-Session-Id` header. You can disable this setting and instead use stateless MCP servers by using the `sessionRouting: Stateless` setting in the {{< reuse "agw-docs/snippets/backend.md" >}} resource. 


## Stateless

The following configuration disables stateful session routing for a streamable HTTP endpoint. You typically use this configuration if you have stateless agents that connect to your MCP server or where the state is handled in the client directly. The MCP server treats every request as a new request and therefore requires the entire context to be sent as part of the request.

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  namespace: default
  name: mcp-static-no-protocol
spec:
  mcp:
    targets:
    - name: mcp-target
      static:
        host: mcp-website-fetcher.default.svc.cluster.local
        port: 80
        protocol: SSE   
    sessionRouting: Stateless
```

## Stateful (default)

The following configuration enables stateful session routing for a streamable HTTP endpoint. During the client-server handshake, the agentgateway proxy instance that handles the request sends back the `mcp-session-id` header with the session ID that was assigned. The client includes this header in subsequent requests to keep the session alive. 

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  namespace: default
  name: mcp-static-no-protocol
spec:
  mcp:
    targets:
    - name: mcp-target
      static:
        host: mcp-website-fetcher.default.svc.cluster.local
        port: 80
        protocol: SSE   
    sessionRouting: Stateful
```

