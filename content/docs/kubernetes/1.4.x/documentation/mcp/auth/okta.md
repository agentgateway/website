---
title: Set up Okta
weight: 50
description: Configure Okta as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-okta:
  - file: ${versionRoot}/documentation/install/helm.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/documentation/mcp/auth/okta.md
    path: setup-okta
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-okta.md" >}}
