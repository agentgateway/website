---
title: Overview
weight: 1
description: Learn about the different policy sections.
test: skip
---

The {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} custom resource lets you apply traffic management, security, observability, and backend connection policies to your agentgateway resources.

## Policy sections

Each {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} has three top-level sections in the `spec` field that control different stages of request processing. You can include one or more of these sections in a single policy.

| Section | Description | Available fields |
| -- | -- | -- |
| `frontend` | Controls how the gateway accepts incoming connections. Applies at the gateway level before routing decisions. | `tcp`, `tls`, `http`, `networkAuthorization`, `accessLog`, `tracing` |
| `traffic` | Controls how agentgateway processes traffic. Applies at the listener, route, or route rule level. Fields are listed in execution order. | `cors`, `jwtAuthentication`, `basicAuthentication`, `apiKeyAuthentication`, `extAuth`, `authorization`, `rateLimit`, `extProc`, `transformation`, `csrf`, `headerModifiers`, `hostRewrite`, `directResponse`, `timeouts`, `retry` |
| `backend` | Controls how agentgateway connects to destination backends. Applies at the backend, service, route, or gateway level. | `tcp`, `tls`, `http`, `tunnel`, `transformation`, `auth`, `health`, `ai`, `mcp` |

## Example guides

Check out the following sections for policy examples.

{{< cards >}}
  {{< card path="/security" title="Security" >}}
  {{< card path="/traffic-management" title="Traffic management" >}}
  {{< card path="/resiliency" title="Resiliency" >}}
{{< /cards >}}
