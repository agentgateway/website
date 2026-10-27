---
title: Token exchange for MCP servers
weight: 30
description: Exchange the caller's credential for a backend-scoped token before the gateway forwards a request to an MCP server.
test:
  te-mcp:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/backend-authn/token-exchange/mcp.md
    path: te-mcp
---

{{< reuse "agw-docs/pages/security/backend-authn-te-mcp.md" >}}
