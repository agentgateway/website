Configure stateful or stateless session routing to MCP backends. 

## About MCP sessions

An MCP session is a set of related interactions between a client and an MCP server that starts with the client-server initialization phase. According to the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#session-management), a session for the Streamable HTTP transport is established if the server sends back an `Mcp-Session-Id` header during the initialization phase. Clients include this header in subsequent requests to keep the stateful session. 

If you run multiple agentgateway proxy instances without stateful sessions, the first request might be forwarded to one instance and a session is created for that instances. However, later requests might be forwarded to a different proxy instance that does not know about the session. 

To ensure that subsequent requests are routed to the same agentgateway proxy instance, the proxy exposes streamable HTTP endpoints as stateful endpoints by default and sends back the session ID in the `Mcp-Session-Id` header. You can disable this setting and instead use stateless MCP servers by using the `sessionRouting: Stateless` setting in the {{< reuse "agw-docs/snippets/backend.md" >}} resource. 


## Stateless


```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
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

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
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

