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
# under `metrics/`. Aliases are relative to the parent of this page's URL, so a
# copied version tree redirects inside itself. Do not write
# `/docs/<section>/<version>/...`: that prefix goes stale when the tree is copied
# for a release. A bare `/...` alias builds at the site root, where every version
# tree collides.
aliases:
  - ../../../observability/control-plane-metrics/
  - ../control-plane-metrics/
---

{{< reuse "agw-docs/pages/observability/metrics/control-plane.md" >}}

{{< reuse "agw-docs/snippets/metrics-control-plane-main.md" >}}

