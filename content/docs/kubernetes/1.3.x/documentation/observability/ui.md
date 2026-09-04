---
title: UI
weight: 10
description: Use the built-in UI to inspect your Kubernetes agentgateway proxy configuration.
test:
  admin-ui:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/observability/ui.md
    path: ui-k8s
  capture:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/quickstart/mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/documentation/quickstart/non-agentic-http.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/observability/ui.md
    path: ui-k8s-capture
---

{{< reuse "agw-docs/pages/observability/ui.md" >}}
