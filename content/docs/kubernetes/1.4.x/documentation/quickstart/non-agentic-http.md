---
title: Non-agentic HTTP
weight: 13
description: Route HTTP traffic to a backend such as httpbin with agentgateway on Kubernetes.
test:
  httpbin:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/quickstart/non-agentic-http.md
    path: install-httpbin
---

{{< reuse "agw-docs/pages/agentgateway/quickstart/non-agentic-http.md" >}}
