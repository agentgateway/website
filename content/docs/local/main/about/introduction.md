---
title: Introduction
weight: 10 
description:
---

{{< reuse "docs/snippets/about-agw.md" >}}

{{< reuse "docs/snippets/kgateway-callout.md" >}}

## Why agentgateway?

To understand the benefits of agentgateway and why you should use it, let's dive into how agentic AI environments work, the challenges they come with, and why traditional gateways fall short of solving these challenges.

### About MCP and A2A 

{{< reuse "docs/snippets/about-mcp-a2a.md" >}}

### Challenges with MCP and A2A

{{< reuse "docs/snippets/about-mcp-challenges.md" >}}

### Traditional gateways vs. agentgateway

{{< reuse "docs/snippets/about-traditional-gw.md" >}}

In contrast, {{< reuse "docs/snippets/about-agw.md" >}}

## Key features

Agentgateway comes with the following key features: 

{{< reuse "docs/snippets/key-benefits.md" >}}

## Policies

Agentgateway provides {{< gloss "Policy" >}}policies{{< /gloss >}} to govern how traffic for MCP and A2A {{< gloss "Backend" >}}backends{{< /gloss >}} is managed, {{< gloss "Transformation" >}}transformed{{< /gloss >}}, and secured. 

Based on the [schema](https://github.com/agentgateway/agentgateway/blob/main/schema/local.json), you can configure the following policies. Each policy can be applied individually or in combination, allowing you to tailor security and traffic management to your needs.

**Traffic management**: 
* **Header manipulation**: Add, set, or remove HTTP request and response headers.
* **{{< gloss "Redirect" >}}Redirect{{< /gloss >}}**: Redirect incoming requests to a different scheme, authority, path, or status code.
* **{{< gloss "Rewrite" >}}Rewrites{{< /gloss >}}**: Rewrite the authority or path of requests before forwarding.
* **{{< gloss "Direct Response" >}}Direct response{{< /gloss >}}**: Return a fixed response (body and status) directly, without forwarding to a backend.

**Security**: 
* **{{< gloss "CORS (Cross-Origin Resource Sharing)" >}}CORS{{< /gloss >}}**: Configure Cross-Origin Resource Sharing (CORS) settings for allowed origins, headers, methods, and credentials.
* **MCP {{< gloss "Authorization (AuthZ)" >}}Authorization{{< /gloss >}}**: Apply custom authorization rules using the MCP model.
* **MCP {{< gloss "Authentication (AuthN)" >}}Authentication{{< /gloss >}}**: Enforce authentication using an external provider (e.g., Auth0, Keycloak) with issuer, scopes, and audience.
* **A2A**: Enable agent-to-agent (A2A) communication features.
* **AI**: Attach AI-specific configuration for routes that use AI backends.
* **Backend {{< gloss "TLS (Transport Layer Security)" >}}TLS{{< /gloss >}}**: Configure TLS settings for secure backend connections, including certificates and trust roots.
* **Backend Auth**: Set up authentication for backend services (e.g., passthrough, key, GCP, AWS).
* **Local Rate Limit**: Apply local rate limiting to control request rates.
* **Remote Rate Limit**: Apply distributed rate limiting using an external service.
* **{{< gloss "JWT (JSON Web Token)" >}}JWT{{< /gloss >}} Auth**: Enforce JWT authentication with issuer, audiences, and JWKS (key set) configuration.
* **External {{< gloss "Authorization (AuthZ)" >}}Authorization{{< /gloss >}} (extAuthz)**: Integrate with an external authorization service.

**Resiliency**: 
* **Request {{< gloss "Mirroring" >}}mirroring{{< /gloss >}}**: Mirror a percentage of requests to an additional backend for testing or analysis.
* **{{< gloss "Timeout" >}}Timeout{{< /gloss >}}**: Set request and backend timeouts.
* **{{< gloss "Retry" >}}Retries{{< /gloss >}}**: Configure retry attempts, backoff, and which response codes should trigger retries.