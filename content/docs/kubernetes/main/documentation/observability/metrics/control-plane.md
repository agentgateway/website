---
title: Control plane metrics
description: View and reference control plane metrics that are emitted by the agentgateway controller.
weight: 10
test:
  control-plane-metrics:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/observability/metrics/control-plane.md
    path: control-plane-metrics
# This page used to be `observability/control-plane-metrics.md`. One alias per old
# URL shape: the pre-docTabs layout, then the docTabs layout before the page moved
# under `metrics/`. Aliases are WHOLE URL paths, so keep the
# `/docs/kubernetes/main` prefix. Without it, both redirects build at the site root
# and collide with the identical aliases in `latest`, and whichever tree builds
# last wins.
aliases:
  - /docs/kubernetes/main/observability/control-plane-metrics/
  - /docs/kubernetes/main/documentation/observability/control-plane-metrics/
---

{{< reuse "agw-docs/pages/observability/metrics/control-plane.md" >}}

{{< reuse "agw-docs/snippets/metrics-control-plane-main.md" >}}

