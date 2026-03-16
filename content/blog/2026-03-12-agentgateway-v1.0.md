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

v1.0 marks an important milestone for the agentgateway project: it is now fully independent\!

### Decoupling from kgateway

The agentgateway Kubernetes controller is now included directly as part of the agentgateway project. Previously, the Kubernetes deployment was delivered through kgateway and followed its versioning and release lifecycle. With this change, agentgateway can now evolve and release independently.

We’d like to thank all the kgateway contributors who helped build and support this project along the way.

As part of this transition, the release version pattern has been updated to align with the versioning used by the agentgateway standalone binary. Going forward, both the Kubernetes-based agentgateway and the standalone binary use the same version numbers, simplifying releases and artifacts.

Documentation has also been updated to reflect the new structure, with v1.0.0 becoming the primary documentation version.

### One release, one set of artifacts

* The v1.0.0 alpha releases publish a consistent set of artifacts:
    * Docker images (controller \+ gateway)
    * Helm charts (agentgateway \+ agentgateway-crds)
    * Binaries
        * cr.agentgateway.dev/agentgateway:v1.0.0
        * cr.agentgateway.dev/controller:v1.0.0
        * cr.agentgateway.dev/charts/agentgateway:v1.0.0
        * cr.agentgateway.dev/charts/agentgateway-crds:v1.0.0

## 🌟 New features

agentgateway added a number of exciting features in v1.0. You can find the full list of new features in the [release notes](https://agentgateway.dev/docs/kubernetes/main/reference/release-notes/).

### Kubernetes Gateway API version 1.5.0

The Kubernetes Gateway API dependency is updated to support version 1.5.0. This version introduces several changes, including:

* **XListenerSets promoted to ListenerSets**: The experimental XListenerSet API is promoted to the standard ListenerSet API in version 1.5.0. The experimental XListenerSet API is promoted to ListenerSet in version 1.5.0. You no longer need the `X` prefix—existing experimental resources can continue to use v1alpha, but the API kind should be updated to `ListenerSet`.
* **AllowInsecureFallback mode for mTLS listeners**: If you set up mTLS listeners on your agentgateway proxy, you can now configure the proxy to establish a TLS connection, even if the client TLS certificate could not be validated successfully. For more information, see the \[mTLS listener docs\]({{\< link-hextra path="/setup/listeners/mtls/" \>}}).
* **CORS wildcard support**: The `allowOrigins` field now supports wildcard `*` origins to allow any origin. For an example, see the \[CORS\]({{\< link-hextra path="/security/cors/" \>}}) guide.
* **BackendTLS**: You can now apply BackendTLSPolicy resources to your routes to originate a TLS connection to a backend. For an example, see the \[BackendTLS\]({{\< link-hextra path="/security/backendtls/" \>}}) guide.
* Agentgateway continues to pass all Gateway API conformance tests (standard, extended, and experimental). TLSRoute is promoted; for users on the standard channel, use v1 instead of v1alpha2.

### Simplified LLM configuration

The simplified `llm` configuration is designed specifically for LLM use cases. Use this approach when your primary goal is to route traffic to LLM providers. The docs are updated to use this simplified configuration. You can still use the previous route-based approach for backwards compatibility or for non-LLM use cases.

The simplified LLM configuration makes it easier when:

* You are building an LLM gateway or AI proxy.
* You need to route requests to one or more LLM providers.
* You want model-based routing with header matching.
* You need LLM-specific policies like JWT authentication or authorization.

The benefits of this approach are:

* Concise: Less configuration needed for common LLM scenarios.
* Model-centric: Focus on LLM models rather than HTTP routing.
* LLM policies: Built-in support for JWT auth and authorization rules.
* Easy multi-provider: Simple syntax for routing to multiple providers.

Example configuration:

```
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

You can even do more advanced policies and traffic matching:

```
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  policies:
    jwtAuth:
      issuer: agentgateway.dev
      audiences: [api.example.com]
      jwks:
        file: ./public-key.json
    authorization:
      rules:
      - 'jwt.email.endsWith("@example.com")'
  models:
  - name: claude-haiku
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
    matches:
    - headers:
      - name: x-org
        value:
          exact: engineering
  - name: gpt-4
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
```

### 

### CEL 2.0

This release includes a major refactor to the CEL implementation in agentgateway to improve scalability and performance. The following user facing changes were introduced:

* The `base64` function has been updated for compatibility with CEL-Go. Other functions retain previous names and behavior. Now, function names use dot notations, such as `base64.encode`. The old camel case names remain in place for backwards compatibility.
* **New string functions**: The following string manipulation functions were added to the CEL library: `startsWith`, `endsWith`, `stripPrefix`, and `stripSuffix`. These functions align with the Google [CEL-Go strings extension](https://pkg.go.dev/github.com/google/cel-go/ext#Strings).
* **Null values fail**: If a top-level variable returns a null value, the CEL expression now fails. Previously, null values always returned true. For example, the `has(jwt)` expression was previously successful if the JWT was missing or could not be found. Now, this expression fails.
* **Logical operators**:  Logical `||` and `&&` operators now handle evaluation errors gracefully instead of propagating them. For example, `a || b` returns `true` if `a` is true even if `b` errors. Previously, the CEL expression failed.
* Individual CEL expressions are now 5–500× faster, which has led to 50%+ end-to-end proxy performance improvements in some tests. Learn more in John Howard’s [blog](https://blog.howardjohn.info/posts/cel-fast/).

Make sure to update and verify any existing CEL expressions that you use in your environment.

For more information, see the \[CEL expression\]({{\< link-hextra path="/reference/cel/" \>}}) reference.

### PreRouting phase support for policies

Agentgateway now supports PreRouting phase policies, allowing authentication and authorization checks to influence routing decisions before a route is selected. This makes it possible, for example, to route traffic to different LLM models or services based on request body content, headers, or JWT claims—all natively in the proxy, without external processors.

For example, you might want to route requests based on the model specified in the request body:

```
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: bbr
spec:
  traffic:
    phase: PreRouting
    transformation:
      request:
        set:
        - name: X-Gateway-Model-Name
          value: 'json(request.body).model'
```

This native approach simplifies operations and dramatically improves performance compared to external processors: in tests, throughput increased 4.5x and p50 latency dropped by \~4.5× compared to an Istio-based external processor solution.

## Availability

agentgateway v1.0 is available for download on [GitHub](https://github.com/agentgateway/agentgateway/releases).

To get started with agentgateway, check out our getting started guide for [standalone](https://agentgateway.dev/docs/standalone/latest/quickstart/) or [Kubernetes](https://agentgateway.dev/docs/kubernetes/latest/quickstart/).

## Get Involved

The simplest way to get involved with kgateway is by joining our [Discord](https://discord.gg/BdJpzaPjHv) and [community meetings](https://calendar.google.com/calendar/u/0?cid=Y18zZTAzNGE0OTFiMGUyYzU2OWI1Y2ZlOWNmOWM4NjYyZTljNTNjYzVlOTdmMjdkY2I5ZTZmNmM5ZDZhYzRkM2ZmQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20).

## Contributors

Thanks to the 40+ contributors who made this release possible:   

{{< reuse-image src="img/blog/v1-release-blog/contributors.png" width="500px" >}}

## Closing

The reason agentgateway feels like it's hitting escape velocity isn't any single milestone — it's that all of the maturity signals are landing together. A year of velocity. A v1 release line. Real adoption numbers. And a packaging story that finally matches the ambition of the project.