---
title: "Agentgateway v1.2.0: we're shipping like the agents are watching"
publishDate: 2026-05-11
author: "Sebastian Maniak"
description: "Agentgateway v1.2.0 lands route delegation, backend external auth, conditional policies with CEL, the new agctl debugger, and a stack of LLM gateway upgrades."
---

The agent ecosystem isn't waiting for anyone. New models drop weekly. New protocols land monthly. New attack surfaces, new auth schemes, new deployment topologies — every quarter the ground shifts under whatever you built last year. A gateway that ships on a yearly cadence is a gateway that's already obsolete.

So we don't.

v1.2.0 packs twenty-plus new capabilities into one release: route delegation, backend external auth with credential exchange, conditional policies with CEL, an honest-to-god debugger CLI, automatic xDS TLS, PROXY protocol, locality-aware failover, post-quantum key exchange, and a stack of LLM gateway upgrades that finally make Azure and Copilot first-class.

Here are the four that change how you'll run agentgateway day to day — with code, context, and the reason we built them.

---

## Heads up: one breaking change before you upgrade

Before you update: xDS TLS is no longer a boolean. The Helm value moved from `controller.xds.tls.enabled: true` to `controller.xds.mode: tls | plaintext | either`.

The Helm chart now defaults to `tls`, and the controller can manage its own xDS certs (more on that below).

If you've got automation pinning the old key, swap it before you `helm upgrade`.

---

## 1. Route delegation: stop being the YAML bottleneck

Every platform team eventually hits the same wall: app teams keep filing PRs against a centralized gateway config because they need a new path, a new header rewrite, a new backend. The platform team becomes the bottleneck. Velocity dies. Tickets pile up.

Route delegation kills that pattern. A parent `HTTPRoute`, owned by platform, hands off a sub-path to child routes in a different namespace, owned by the app team. The children show up, register themselves under the parent's tree, and the gateway figures out the rest.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: parent
  namespace: default
spec:
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team1
    backendRefs:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      name: "*"
      namespace: team1
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: child-team1-foo
  namespace: team1
spec:
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team1/foo
    backendRefs:
    - name: httpbin
      port: 8000
```

Platform owns the trunk. Teams own their branches. Nobody opens a PR against `gateway.yaml` ever again. This is the multi-tenant story a *lot* of you have been asking for, and it's straight Gateway API — no proprietary CRDs in the hot path.

For a walkthrough, see the [route delegation docs](https://agentgateway.dev/docs/kubernetes/main/traffic-management/route-delegation/).

## 2. Backend external auth: token exchange without the sidecar tax

Here's the pattern everyone ends up building eventually: a user logs in, hits your gateway with a JWT, and the gateway needs to call three different upstreams — each of which wants a different credential. One wants a GCP service account token. One wants a partner-issued API key. One wants a short-lived OAuth token scoped to that user.

Until now, the "right" answer was a sidecar, an envoy filter chain held together with hope, or a homegrown proxy in front of your proxy. That's done.

External auth can now run as a **backend policy after backend selection**. The gateway knows exactly which upstream is about to be called, calls out to your token-exchange service, gets the right credential, and injects it where that backend wants it — header, query param, or cookie. You configure it once. The gateway handles the per-backend dance.

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: backend-token-exchange
spec:
  targetRefs:
  - kind: Backend
    name: partner-api
  extAuth:
    backend: token-exchange-svc
    forwardCredential:
      location: header
      name: Authorization
      prefix: "Bearer "
```

Combine it with the new credential-location overrides (JWT, basic auth, API key, and backend auth can now read from or write to any of headers, query, or cookies) and explicit Secret-backed GCP credentials, and the awkward "auth proxy in front of the auth proxy" pattern just collapsed into one CRD.

## 3. Conditional policies: one block, many code paths

You've all built this monstrosity: three near-identical rate-limit policies, gated by header matchers on the route, because the existing API made you express "if admin, do X; else do Y" by duplicating the entire policy block. Or worse — you punted to an ext-proc service just to get an `if` statement.

Now policies branch on CEL directly. External auth, transformations, rate limiting, ext-proc, and direct responses all support `conditional:` lists. The gateway walks them top-down, applies the first match, and falls back to the unconditional tail if nothing hits.

```yaml
traffic:
  transformation:
    conditional:
    - condition: request.headers["x-user"] == "admin"
      policy:
        request:
          set:
          - name: x-role
            value: admin
    - policy:
        request:
          set:
          - name: x-role
            value: user
```

That's the whole pattern. One policy, two paths, zero duplication. And CEL means you can branch on anything in the request — headers, path, JWT claims, even response state for response-side policies.

For details, see the [conditional policies docs](https://agentgateway.dev/docs/kubernetes/main/about/policies/conditional-policies/).

## 4. agctl: the debugger you've been asking for

Real talk: debugging a gateway in production has historically been a mix of `kubectl logs`, hope, and human pattern matching. Envoy's admin interface gets you part of the way. The rest is detective work.

The new experimental `agctl` CLI changes that. Two commands. Both useful on day one.

```bash
# What does the proxy actually think about my backends right now?
agctl config backends
# → live view of every backend the gateway sees, including
#   resolved endpoints, current health, observed latency, circuit state.

# Trace a single request end-to-end through filters, policies, and upstream
agctl trace --request-id 7c1f...
# → every CEL evaluation, policy hit, header mutation, retry attempt,
#   and the exact bytes that left the gateway.
```

When somebody slacks you "the gateway is returning 502s on /v1/checkout," you stop guessing. You run `agctl trace`, you see the JWT failed validation because the JWKS cache went stale at 03:14, and you fix it before the standup ends.

Pair it with the new `/debug/pprof/heap` endpoint — yes, you can pull heap snapshots now — and the gateway stops being a black box.

---

## Everything else that landed (it's a lot)

**Automatic xDS TLS.** Controller mints a local CA, issues short-lived serving certs, rotates them. Bring your own if you prefer. Either way, no more pre-creating xDS certs.

**Networking & TLS.** PROXY protocol v1/v2 (strict or optional). Locality-aware load balancing and failover for multi-zone and multi-region. HBONE gateway tunnel protocol for Istio ambient. Listeners can now use Istio workload certs for simple or mutual TLS. Unix Domain Socket backends. Post-quantum TLS via `X25519_MLKEM768`. Max connection duration on HTTP listeners. HTTP/2 pooling that no longer bottlenecks on a single connection.

**LLM gateway.** Azure OpenAI and Azure AI Foundry are now first-class providers. Copilot auth. Gemini Responses API. Custom path prefixes across every provider — Gemini, Vertex, Bedrock, Azure. Azure Content Safety guardrails. Bedrock guardrail masking. OpenAI requests normalize `max_tokens` to `max_completion_tokens` automatically.

**MCP.** Idle session TTL. Cleaner stateless lifecycle. `ListResourcesRequest` works across multiplexed targets.

**Policy targeting.** `AgentgatewayPolicy` now accepts selector-based targets and can attach to `ListenerSet` and `InferencePool`. Custom Prometheus metric labels via CEL.

**Performance.** New allocator → higher throughput, lower RSS. Plus a long tail of fixes across CEL, JWKS caching, header/`:authority` alignment, hop-by-hop header stripping, and Gateway status update churn.

For the complete list, see the [release notes](https://agentgateway.dev/docs/kubernetes/main/reference/release-notes/).

## How fast are we shipping?

We shipped this in months, not quarters. The roadmap moves on the same cadence as the agent ecosystem it serves — because the alternative is being the slow part of someone else's stack, and that's not a future we're interested in.

## Availability

Agentgateway v1.2.0 is available for download on [GitHub](https://github.com/agentgateway/agentgateway/releases).

To get started with agentgateway, check out our getting started guide for [standalone](https://agentgateway.dev/docs/standalone/latest/quickstart/) or [Kubernetes](https://agentgateway.dev/docs/kubernetes/latest/quickstart/).

## Get involved

Star the repo at [github.com/agentgateway/agentgateway](https://github.com/agentgateway/agentgateway), join us on [Discord](https://discord.gg/BdJpzaPjHv), and come hang out at our [community meetings](https://calendar.google.com/calendar/u/0?cid=Y18zZTAzNGE0OTFiMGUyYzU2OWI1Y2ZlOWNmOWM4NjYyZTljNTNjYzVlOTdmMjdkY2I5ZTZmNmM5ZDZhYzRkM2ZmQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20).
