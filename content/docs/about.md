---
title: About
weight: 20
description:
---

Agentgateway provides secure, scalable, stateful, bidirectional communication for MCP servers, tools, LLMs, and AI agents in any environment. It is built to solve the common challenges with traditional gateway proxies and missing specification in the MCP and A2A protocols by providing enterprise-grade security, observabiity, resiliency, reliability, and multi-tenancy.

{{< reuse "docs/snippets/kgateway-callout.md" >}}

## Why agentgateway?

To understand the benefits of agentgateway and why you shoud use it, let's dive into how agentic AI environments work, the challenges they come with, and why traditional gateways fall short of solving these challenges. 

### About MCP and A2A 

{{< reuse "docs/snippets/about-mcp-a2a.md" >}}

### Challenges with MCP and A2A

{{< reuse "docs/snippets/about-mcp-challenges.md" >}}

### Traditional gateways vs. agentgateway

{{< reuse "docs/snippets/about-traditional-gw.md" >}}

Agentgateway on the other hand is purposely designed and built to handle stateful, bidirectional communication between agents, MCP servers, tools, and LLMs at any scale on any platform. With enterprise-grade drop-in security, observability, governance, resiliency, and multi-tenancy, agentgateway addresses the common challenges with MCP and A2A, and allows enterprises to adopt and quicklly scale their agentic AI environments. 

## Key features

Agentgateway comes with the following key features: 

{{< reuse "docs/snippets/key-benefits.md" >}}

## Architecture

The following figure shows how agentgateway provides AI connectivity for agents and tools in any environment.

{{< reuse-image src="img/agentgateway-architecture.svg" caption="Figure: agentgateway works across compute environments to provide connectivity to various agentic tools, including MCP servers, agents, and OpenAPI endpoints." >}}

## Policies

Agentgateway provides policies to govern how traffic for MCP and A2A backends is managed, transformed, and secured. 

Based on the [schema](https://github.com/agentgateway/agentgateway/blob/main/schema/local.json), you can configure the following policies. Each policy can be applied individually or in combination, allowing you to tailor security and traffic management to your needs.

**Traffic management**: 
* **Header manipulation**: Add, set, or remove HTTP request and response headers.
* **Redirect**: Redirect incoming requests to a different scheme, authority, path, or status code.
* **Rewrites**: Rewrite the authority or path of requests before forwarding.
* **Direct response**: Return a fixed response (body and status) directly, without forwarding to a backend.

**Security**: 
* **CORS**: Configure Cross-Origin Resource Sharing (CORS) settings for allowed origins, headers, methods, and credentials.
* **MCP Authorization**: Apply custom authorization rules using the MCP model.
* **MCP Authentication**: Enforce authentication using an external provider (e.g., Auth0, Keycloak) with issuer, scopes, and audience.
* **A2A**: Enable agent-to-agent (A2A) communication features.
* **AI**: Attach AI-specific configuration for routes that use AI backends.
* **Backend TLS**: Configure TLS settings for secure backend connections, including certificates and trust roots.
* **Backend Auth**: Set up authentication for backend services (e.g., passthrough, key, GCP, AWS).
* **Local Rate Limit**: Apply local rate limiting to control request rates.
* **Remote Rate Limit**: Apply distributed rate limiting using an external service.
* **JWT Auth**: Enforce JWT authentication with issuer, audiences, and JWKS (key set) configuration.
* **External Authorization (extAuthz)**: Integrate with an external authorization service.

**Resiliency**: 
* **Request mirroring**: Mirror a percentage of requests to an additional backend for testing or analysis.
* **Timeout**: Set request and backend timeouts.
* **Retries**: Configure retry attempts, backoff, and which response codes should trigger retries.
