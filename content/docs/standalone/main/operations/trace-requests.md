---
title: Trace requests with agctl
weight: 16
description: Capture a per-request trace as a standalone agentgateway instance handles the request.
test:
  trace-validate:
  - file: ${versionRoot}/operations/trace-requests.md
    path: trace-validate
---

> [!WARNING]
> {{< reuse "agw-docs/snippets/feature-experimental.md">}}

{{< reuse "agw-docs/pages/operations/trace-requests-standalone.md" >}}
