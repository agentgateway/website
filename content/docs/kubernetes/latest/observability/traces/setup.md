---
title: Set up and customize traces
description: Configure distributed tracing for the agentgateway proxy using OpenTelemetry.
weight: 10
test:
  tracing:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/observability/traces/setup.md
    path: tracing
---

{{< reuse "agw-docs/pages/observability/traces/setup.md" >}}

