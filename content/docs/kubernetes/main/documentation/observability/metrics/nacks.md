---
title: Monitor proxy config rejections
description: Monitor and troubleshoot proxy configuration rejections with metrics and events.
weight: 30
test:
  nacks:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/observability/metrics/nacks.md
    path: nacks
# This page used to be `observability/nacks.md`. One alias per old URL shape: the
# pre-docTabs layout, then the docTabs layout before the page moved under
# `metrics/`. Aliases are WHOLE URL paths, so keep the `/docs/kubernetes/main`
# prefix. Without it, both redirects build at the site root and collide with the
# identical aliases in `latest`, and whichever tree builds last wins.
aliases:
  - /docs/kubernetes/main/observability/nacks/
  - /docs/kubernetes/main/documentation/observability/nacks/
---

{{< reuse "agw-docs/pages/observability/metrics/nacks.md" >}}

