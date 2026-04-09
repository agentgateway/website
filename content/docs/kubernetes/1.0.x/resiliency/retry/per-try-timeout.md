---
title: Per-try timeout
weight: 20
description: Set up per-try timeouts.
test:
  per-try-timeout-in-httproute:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-httproute
  per-try-timeout-in-agentgateway:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-agentgateway
  per-try-timeout-in-gatewaylistener:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/retry/per-try-timeout.md
    path: per-try-timeout-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/retry/per-try-timeout.md" >}}
