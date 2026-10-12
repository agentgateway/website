---
title: Set up and customize traces
description: Configure distributed tracing for the agentgateway proxy using OpenTelemetry.
weight: 10
test:
  tracing:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/observability/traces/setup.md
    path: tracing
---

{{< reuse "agw-docs/pages/observability/traces/setup.md" >}}

