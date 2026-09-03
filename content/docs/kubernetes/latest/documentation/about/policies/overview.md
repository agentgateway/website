---
title: Overview
weight: 1
description: Learn about the different policy sections.
test: skip
---

The {{< reuse "agw-docs/snippets/policy.md" >}} custom resource lets you apply traffic management, security, observability, and backend connection policies to your agentgateway resources.

## Policy sections

Each {{< reuse "agw-docs/snippets/policy.md" >}} has three top-level sections in the `spec` field that control different stages of request processing. You can include one or more of these sections in a single policy.

| Section | Description | Available fields |
| -- | -- | -- |
| `frontend` | Controls how the gateway accepts incoming connections. Applies at the gateway level before routing decisions. | `tcp`, `tls`, `http`, `networkAuthorization`, `accessLog`, `tracing` |
| `traffic` | Controls how agentgateway processes traffic. Applies at the listener, route, or route rule level. Fields are listed in execution order. | `cors`, `jwtAuthentication`, `basicAuthentication`, `apiKeyAuthentication`, `extAuth`, `authorization`, `rateLimit`, `extProc`, `transformation`, `csrf`, `headerModifiers`, `hostRewrite`, `directResponse`, `buffer`, `timeouts`, `retry` |
| `backend` | Controls how agentgateway connects to destination backends. Applies at the backend, service, route, or gateway level. | `tcp`, `tls`, `http`, `tunnel`, `transformation`, `auth`, `extAuth`, `health`, `ai`, `mcp` |

### Backend policy fields

A `traffic` policy processes a request as it passes through a Gateway listener or route. A `backend` policy applies to the destination that agentgateway selects for that request, and each field configures one aspect of the connection to it.

Combine fields in one policy when they share a target and a lifecycle. For the resources that each field can attach to, and for how two policies that set the same field merge, see [Targeting and merging]({{< link-hextra path="/documentation/about/policies/target-merge/" >}}).

| Field | Purpose | Guide |
| -- | -- | -- |
| `backend.tcp` | Set the connection timeout and TCP keepalive probes. | [Backend timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/backend/" >}}) and [HTTP connection settings]({{< link-hextra path="/documentation/resiliency/connection/#backend" >}}) |
| `backend.http` | Select the upstream HTTP version and set the backend response deadline. | [Backend timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/backend/" >}}) and [HTTP connection settings]({{< link-hextra path="/documentation/resiliency/connection/#backend" >}}) |
| `backend.tls` | Originate TLS or mutual TLS (mTLS) and configure certificate validation. | [Backend TLS]({{< link-hextra path="/documentation/security/backendtls/" >}}) |
| `backend.tunnel` | Reach the destination through an HTTP CONNECT proxy. | [Policy API reference]({{< link-hextra path="/reference/api/" >}}) |
| `backend.auth` | Add credentials or exchange, sign, or pass through tokens for the destination. | [Backend authentication]({{< link-hextra path="/documentation/security/backend-authn/" >}}) |
| `backend.extAuth` | Run external authorization after agentgateway selects the destination. | [Bring your own external authorization service]({{< link-hextra path="/documentation/security/extauth/byo-ext-auth-service/" >}}) |
| `backend.transformation` | Transform requests sent to the destination and responses returned from it. | [Transformations]({{< link-hextra path="/documentation/traffic-management/transformations/" >}}) |
| `backend.health` | Detect unhealthy endpoints, evict them, and restore them after recovery. | [Backend health]({{< link-hextra path="/documentation/resiliency/backend-health/" >}}) |
| `backend.ai` | Configure prompt guards, routing, transformations, and other AI-specific behavior. | [LLM features]({{< link-hextra path="/documentation/llm/" >}}) |
| `backend.mcp` | Configure Model Context Protocol (MCP) authorization, authentication, and guardrails. | [MCP features]({{< link-hextra path="/documentation/mcp/" >}}) |

## Example guides

Check out the following sections for policy examples.

{{< cards >}}
  {{< card path="/documentation/security" title="Security" >}}
  {{< card path="/documentation/traffic-management" title="Traffic management" >}}
  {{< card path="/documentation/resiliency" title="Resiliency" >}}
{{< /cards >}}
