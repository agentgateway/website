---
linkTitle: "Get started"
title: Get started
weight: 1
description: Install and run agentgateway, or route traffic to MCP, LLM, or HTTP backends.
---

Get started with agentgateway on Kubernetes. Install the control plane, or jump to a quick start that routes traffic to the backend you need.

{{< cards >}}
  {{< card link="install" title="Install agentgateway" subtitle="Install the agentgateway control plane in your cluster." >}}
  {{< card link="llm" title="LLM (OpenAI)" subtitle="Route requests to OpenAI's chat completions API." >}}
  {{< card link="mcp" title="MCP servers" subtitle="Connect to an MCP server and try tools." >}}
  {{< card link="non-agentic-http" title="Non-agentic HTTP" subtitle="Route HTTP traffic to a backend such as httpbin." >}}
{{< /cards >}}

## Before you begin

These guides assume you have a Kubernetes cluster, `kubectl`, and `helm`. For quick testing, you can use [Kind](https://kind.sigs.k8s.io/).

```sh
kind create cluster
```
