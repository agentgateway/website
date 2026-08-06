---
title: Set up Okta
weight: 50
description: Configure Okta as an OAuth identity provider for MCP authentication with agentgateway.
test:
  setup-okta:
  - file: ${versionRoot}/install/helm.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/mcp/static-mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/mcp/auth/okta.md
    path: setup-okta
---

{{< reuse "agw-docs/pages/agentgateway/mcp/mcp-auth-okta.md" >}}
