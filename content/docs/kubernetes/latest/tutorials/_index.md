---
title: Tutorials
weight: 23
description: Step-by-step guides for deploying and managing agentgateway on Kubernetes
---

Learn how to deploy and manage agentgateway on Kubernetes through hands-on tutorials. Each tutorial includes setting up a local kind cluster so you can follow along from scratch.

## Getting Started

{{< cards >}}
  {{< card link="llm-gateway" title="LLM Gateway" subtitle="Route requests to LLM providers on Kubernetes" icon="sparkles" >}}
  {{< card link="azure-ai-foundry" title="Azure AI Foundry" subtitle="Route requests to Azure OpenAI through agentgateway" icon="cloud" >}}
  {{< card link="prompt-enrichment" title="Prompt Enrichment" subtitle="Inject context at the gateway layer to improve LLM output accuracy" icon="pencil" >}}
{{< /cards >}}

## MCP (Model Context Protocol)

{{< cards >}}
  {{< card link="basic" title="Basic MCP Server" subtitle="Deploy and route to an MCP server on Kubernetes" icon="server" >}}
  {{< card link="mcp-federation" title="MCP Federation" subtitle="Federate multiple MCP servers behind a single gateway" icon="collection" >}}
{{< /cards >}}

## Security

{{< cards >}}
  {{< card link="jwt-authorization" title="JWT Authorization" subtitle="Secure your gateway with JWT authentication" icon="lock-closed" >}}
  {{< card link="ai-prompt-guard" title="AI Prompt Guard" subtitle="Protect LLM requests from sensitive data exposure" icon="shield-check" >}}
  {{< card link="claude-code-proxy" title="Claude Code CLI Proxy" subtitle="Proxy and secure Claude Code CLI traffic through the gateway" icon="terminal" >}}
{{< /cards >}}

## Operations

{{< cards >}}
  {{< card link="telemetry" title="Telemetry & Observability" subtitle="Add distributed tracing with OpenTelemetry and Jaeger" icon="chart-bar" >}}
{{< /cards >}}
