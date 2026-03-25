---
title: Request retries
weight: 10
description: Set up retries for requests.
test:
  retry-in-httproute:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/retry/retry.md
    path: retry-in-httproute
  retry-in-agentgateway:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/retry/retry.md
    path: retry-in-agentgateway
  retry-in-gatewaylistener:
  - file: content/docs/kubernetes/latest/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/resiliency/retry/retry.md
    path: retry-in-gatewaylistener
---

{{< reuse "agw-docs/pages/resiliency/retry/retry.md" >}}
