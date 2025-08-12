---
title: MCP Authorization the Easy Way
toc: false
publishDate: 2025-08-12T00:00:00-00:00
author: Christian Posta, Rinor Maloku
---


In June 2025, the MCP community [updated the specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) to alleviate some of the [concerns from the previous version](https://blog.christianposta.com/the-updated-mcp-oauth-spec-is-a-mess/) regarding MCP Authorization. However, this update introduces new concerns, [especially around enterprise usage](https://www.solo.io/blog/enterprise-challenges-with-mcp-adoption). Nevertheless, many public facing MCP clients (Claude, VS Code, etc) do implement the MCP Authorization spec, and many public facing MCP services are expecting this. 

In `agentgateway`, we are trying to make this easier for those building MCP servers. In recent builds, we've [introduced a way to configure mcpAuthentication](https://github.com/agentgateway/agentgateway/pull/212) which leverages an external OAuth provider, specifically implementing the MCP server side of the MCP Authorization spec for you via configuration. 


The [MCP specification says](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization#authorization-server-location) the following about the MCP Server's responsibilities in the authorization spec:

> MCP servers MUST use the HTTP header WWW-Authenticate when returning a 401 Unauthorized to indicate the location of the resource server metadata URL as described in RFC9728 Section 5.1 “WWW-Authenticate Response”.

And also...

> MCP servers MUST implement the OAuth 2.0 Protected Resource Metadata (RFC9728) specification to indicate the locations of authorization servers. The Protected Resource Metadata document returned by the MCP server MUST include the authorization_servers field containing at least one authorization server.

For example, if you've built an MCP server (npx, python, remote, whatever), and you want to handle these spec requirements consistently for your MCP server (and potentially exposing many others), you can use `agentgateway` to do this. 

For example, if this is how you route to your MCP Server:

```yaml
binds:
- listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: hello-world
            stdio:
              args:
              - 'run' 
              - 'src/main.py'
              cmd: 'uv'
      matches:
      - path:
          exact: /hello/mcp
      policies:
        cors:
          allowHeaders:
          - mcp-protocol-version
          - content-type
          allowOrigins:
          - '*'
  port: 3000
```

Then you can add the new `mcpAuthentication` configuration to implement this behavior:

```yaml
        mcpAuthentication:
          issuer: http://localhost:7080/realms/mcp
          jwksUrl: http://localhost:7080/realms/mcp/protocol/openid-connect/certs
          audience: mcp_proxy
          provider:
            keycloak: {}
          resourceMetadata:
            resource: http://localhost:3000/hello/mcp
            scopesSupported:
            - profile
            - offline_access
            - openid
            bearerMethodsSupported:
            - header
            - body
            - query
            resourceDocumentation: http://localhost:3000/hello/docs
            resourcePolicyUri: http://localhost:3000/hello/policies
```

There are a couple important points to make here. When we use this configuration, we automatically get a spec-compliant implementation for MCP Auth. But, depending on the OAuth provider we use, it may need some massaging. For example, Keycloak has some challenges with Dynamic Client Registration (ie, registration endpoint, CORS, etc). `agentgateway` can automatically wrap this and expose it in a way that's spec compliant. That's the point of the `provider: keycloak{}` configuration. 

Out of the box `provider: auth0{}` is also supported. If your provider correctly supports all of the OAuth RFC / specs, then you can ommit `provider: ` completely. 

Take a look at this demo video to see how it all works:

<iframe width="560" height="315" src="https://www.youtube.com/embed/P0ay9C8QDlQ?si=ch_l7piaQM1F1BZA" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>