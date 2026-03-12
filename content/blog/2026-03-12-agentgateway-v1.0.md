---
title: "A Year In: agentgateway Hits v1.0.0 — and the Pieces Are Converging"
publishDate: 2026-03-12
author: "Sebastian Maniak"
description: "A Year In: agentgateway Hits v1.0.0 — and the Pieces Are Converging"
---

# A Year In: agentgateway Hits v1.0.0 — and the Pieces Are Converging

A lot of open-source projects feel "promising" for a long time. And then, suddenly, a few signals land at once and you realize: it's been a year, you've crossed 1 million image pulls, you're approaching 2K GitHub stars… and v1.0.0 is here.

For agentgateway, that convergence looks like this:

- **~1 year of project velocity** — the repo was created in March 2025
- **Crossing into the v1.0.0 release line**
- **~2K stars on GitHub** — nearing the threshold where adoption starts to accelerate
- **~1M image pulls** — the usage curve is real

None of those numbers alone tell the story. All of them arriving together do.

<img width="1304" height="613" alt="Screenshot 2026-03-12 at 12 28 40 PM" src="https://github.com/user-attachments/assets/6c8f6ed9-d03f-4900-859e-fbdc7e4dfbf7" />

---

## What Is agentgateway?

Agentgateway is an open-source LLM, MCP, and A2A gateway hosted under the Linux Foundation. It's a connectivity data plane for agentic AI — designed for the traffic patterns that traditional API gateways were never built to handle.

Where a conventional gateway routes HTTP requests, agentgateway is purpose-built for LLM inference traffic, MCP tool servers, and A2A agent-to-agent communication. It focuses on the gaps that show up the moment you try to run these workloads in production: governance, observability, multi-tenancy, and protocol-aware routing.

A few things that define the project:

- **Enterprise-grade security and multi-tenancy** — built for shared infrastructure, not just single-tenant demos
- **Deep observability** — including native OpenTelemetry support
- **Run anywhere** — standalone binary or Kubernetes, same gateway either way
- **Performance and reliability first** — designed to be the most mature LLM/MCP gateway available

---

## Why v1.0 Matters

The headline for v1.0 isn't a single feature. It's project independence.

### Decoupling from kgateway

This is the most important detail in the release. Until now, agentgateway's Kubernetes deployment shipped through kgateway and followed kgateway's versioning scheme. That meant if you were running agentgateway on Kubernetes, you had to reason about *two* version numbers — the controller and the dataplane — tied to a project that wasn't actually agentgateway.

With v1.0, that's over. agentgateway is fully decoupled from kgateway. One project, one version, one set of release artifacts.

### One release, one set of artifacts

The v1.0.0 alpha releases publish everything under a single, consistent version.

**Docker images** — controller and gateway:

```
cr.agentgateway.dev/agentgateway:v1.0.0-alpha.4
cr.agentgateway.dev/controller:v1.0.0-alpha.4
```

**Helm charts** — the gateway and its CRDs:

```
cr.agentgateway.dev/charts/agentgateway:v1.0.0-alpha.4
cr.agentgateway.dev/charts/agentgateway-crds:v1.0.0-alpha.4
```

No more cross-referencing versions between two projects. No more explaining which version goes with what.

### What the v1 label signals

Moving to v1 is a public commitment. It tells teams that the project is drawing a line around scope, solidifying APIs (CRDs and config models), and standardizing install paths. The packaging story is clean: unified artifacts, clear operational paths, and the end of the "two versions" mental model.

Put simply: agentgateway is becoming something teams can run.

---

## Looking Ahead

The reason agentgateway feels like it's hitting escape velocity isn't any single milestone — it's that all of the maturity signals are landing together. A year of velocity. A v1 release line. Real adoption numbers. And a packaging story that finally matches the ambition of the project.

The pieces are converging. This is what that looks like.
