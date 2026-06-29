---
title: Admin UI
weight: 10
description: Use the built-in Admin UI to inspect your Kubernetes agentgateway proxy configuration.
test:
  admin-ui:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/observability/ui.md
    path: ui-k8s
  capture:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/quickstart/mcp.md
    path: setup-mcp-server
  - file: ${versionRoot}/quickstart/non-agentic-http.md
    path: install-httpbin
  - file: ${versionRoot}/observability/ui.md
    path: ui-k8s-capture
---

{{< reuse "agw-docs/pages/observability/ui.md" >}}
