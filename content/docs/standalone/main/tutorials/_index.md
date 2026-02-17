---
title: Tutorials
weight: 23
description: Step-by-step guides for common agentgateway use cases
---

Learn how to use agentgateway through hands-on tutorials. Start with the basics and progress to more advanced configurations.

## Getting Started

{{< cards >}}
  {{< card link="basic" title="Basic MCP Server" subtitle="Your first agentgateway setup" icon="play" >}}
  {{< card link="multiplex" title="Multiplex MCP Servers" subtitle="Combine multiple tool servers" icon="collection" >}}
{{< /cards >}}

## Core Use Cases

{{< cards >}}
  {{< card link="mcp-federation" title="MCP Federation" subtitle="Federate tools from multiple MCP servers" icon="puzzle" >}}
  {{< card link="llm-gateway" title="LLM Gateway" subtitle="Route requests to multiple LLM providers" icon="sparkles" >}}
  {{< card link="a2a" title="Agent-to-Agent" subtitle="Enable secure agent communication" icon="users" >}}
  {{< card link="openapi" title="OpenAPI to MCP" subtitle="Expose REST APIs as MCP tools" icon="code" >}}
{{< /cards >}}

## Security

{{< cards >}}
  {{< card link="authorization" title="JWT Authorization" subtitle="Secure with JWT and fine-grained access control" icon="lock-closed" >}}
  {{< card link="mcp-authentication" title="MCP Authentication" subtitle="OAuth-based auth using the MCP auth spec" icon="key" >}}
  {{< card link="tls" title="TLS / HTTPS" subtitle="Enable encrypted connections" icon="shield-check" >}}
  {{< card link="oauth2-proxy" title="OAuth2 Proxy" subtitle="GitHub, Google, Azure AD authentication" icon="user-circle" >}}
  {{< card link="tailscale-auth" title="Tailscale Authentication" subtitle="Zero-trust access with Tailscale" icon="globe-alt" >}}
  {{< card link="ai-prompt-guard" title="AI Prompt Guard" subtitle="Block prompt injection and PII" icon="shield-exclamation" >}}
{{< /cards >}}

## Operations

{{< cards >}}
  {{< card link="telemetry" title="Telemetry & Observability" subtitle="OpenTelemetry tracing and metrics" icon="chart-bar" >}}
  {{< card link="http-routing" title="HTTP Routing & Policies" subtitle="Advanced routing and traffic management" icon="arrows-expand" >}}
{{< /cards >}}
