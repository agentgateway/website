---
title: Admin UI
weight: 10
description: Use the built-in Admin UI to inspect your Kubernetes agentgateway proxy configuration.
test:
  admin-ui:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/observability/ui.md
    path: ui-k8s
  capture:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/quickstart/mcp.md
    path: setup-mcp-server
  - file: content/docs/kubernetes/main/quickstart/non-agentic-http.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/observability/ui.md
    path: ui-k8s-capture
---

{{< reuse "agw-docs/pages/observability/ui.md" >}}
