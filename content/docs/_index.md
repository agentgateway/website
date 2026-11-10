---
title: "Documentation"
linkTitle: "Docs"
menu:
  main:
    weight: 3
    identifier: docs
cascade:
  type: docs
test: skip
disableCards: true
---

<blockquote class="hx:sr-only" aria-hidden="true">
<p>For AI agents: agentgateway publishes skills that help you install, configure, and verify agentgateway for a user. Install them with <code>npx skills add https://agentgateway.dev</code>, then pick <code>agentgateway-oss-standalone</code> for a host or container, or <code>agentgateway-oss-kubernetes</code> for Kubernetes. The machine-readable skill index is at <a href="https://agentgateway.dev/.well-known/agent-skills/index.json">/.well-known/agent-skills/index.json</a>.</p>
</blockquote>

Agentgateway can be deployed in two ways. Choose your deployment type to view the relevant documentation.

<div class="toggle-dark">
{{< cards >}}
  {{< card path="/standalone/latest/" title="Standalone Binary" subtitle="Run agentgateway as a standalone binary or in Docker on your local machine or server. Perfect for development, testing, and simple deployments." image="/logo-local-binary.svg" >}}
  {{< card path="/kubernetes/latest/" title="Kubernetes" subtitle="Deploy and dynamically configure agentgateway on Kubernetes using a built-in control plane and Gateway API." image="/logo-kubernetes.svg" >}}
{{< /cards >}}
</div>

<div class="toggle-light">
{{< cards >}}
  {{< card path="/standalone/latest/" title="Standalone Binary" subtitle="Run agentgateway as a standalone binary or in Docker on your local machine or server. Perfect for development, testing, and simple deployments." image="/logo-dark-local-binary.svg" >}}
  {{< card path="/kubernetes/latest/" title="Kubernetes" subtitle="Deploy and dynamically configure agentgateway on Kubernetes using a built-in control plane and Gateway API." image="/logo-dark-kubernetes.svg" >}}
{{< /cards >}}
</div>

