---
title: Export logs over OTLP
weight: 20
description: Export agentgateway access logs as OTLP LogRecord objects to an OpenTelemetry Collector or any compatible backend.
test:
  access-log-otlp:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/observability/access-logs/export.md
    path: access-log-otlp
---

{{< reuse "agw-docs/pages/observability/access-logs/export.md" >}}

