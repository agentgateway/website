---
title: "Documentation"
linkTitle: "Docs"
menu:
  main:
    weight: 3
    identifier: docs
---

Agentgateway can be deployed in two ways. Choose your deployment type to view the relevant documentation.

<div class="hx-block dark:hx-hidden">
{{< cards >}}
  {{< card link="/docs/local/" title="Local Binary" subtitle="Run agentgateway as a standalone binary or in Docker on your local machine or server. Perfect for development, testing, and simple deployments." image="/logo-local-binary.svg" >}}
  {{< card link="/docs/kubernetes/" title="Kubernetes" subtitle="Deploy agentgateway on Kubernetes by using the kgateway control plane. Ideal for production environments with advanced orchestration needs." image="/logo-kubernetes.svg" >}}
{{< /cards >}}