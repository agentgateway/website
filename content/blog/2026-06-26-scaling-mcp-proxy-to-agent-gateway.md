---
title: "Scaling Model Context Protocol: From a Proxy to an Agent Gateway"
category: "Community"
publishDate: 2026-06-26
author: "Mason Price, Imagine Learning"
description: "How Imagine Learning's read-only MCP proxy grew into the control plane for its agentic workflows — and why betting on an open protocol let the ecosystem do much of the work."
toc: false
---

Almost a year ago, we wrote about a bet we made on [Model Context Protocol (MCP)](https://modelcontextprotocol.io/): that one proxy could collapse our sprawl of internal tools, spanning services like AWS, ArgoCD, Jira, and Confluence, into a single endpoint engineers could reach from inside their IDE. We containerized a handful of stdio MCP servers behind a single HTTP interface, kept access read-only, and shipped it. It did what we hoped for. Engineers spent less time hunting for answers, onboarding got shorter, and the platform team fielded fewer "where do I find this" questions.

What we didn't expect was what happened next. The proxy quietly stopped being a developer convenience and became the backbone of how we run agentic workflows at Imagine Learning. This article is about that evolution: how we re-platformed it, how it grew, and where we're taking it.

## Moving to agentgateway

{{< reuse-image src="img/blog/scaling-mcp-proxy-to-agent-gateway/moving-to-agentgateway.png" alt="Before and after architecture for the MCP proxy. Before: one container running NGINX plus two SuperGateway instances bridging stdio MCP servers, with a hand-maintained config. After: a single stateless agentgateway binary on Kubernetes, speaking MCP natively, driven by one declarative config file." caption="From three processes in a container to one binary and one config file." >}}

The first version was held together by SuperGateway, which bridged our stdio servers to HTTP, with NGINX in front routing requests by path. One container ran two SuperGateway instances plus NGINX, with a hand-rolled log format and a config file we maintained by hand. It worked, but every new server meant a new routing block and a new process to supervise, and NGINX understood nothing about the protocol it was forwarding.

In July 2025 we replaced all of it with agentgateway, a proxy built specifically for MCP traffic. agentgateway speaks MCP natively, so the stdio bridging, the routing, the CORS handling, and the health endpoint all folded into a single binary driven by one declarative config file. NGINX and SuperGateway disappeared from our Dockerfile entirely. A few weeks later we made the whole thing stateless, which let it scale cleanly in Kubernetes. Adding a server went from standing up a new process to adding a route in a YAML file.

## Betting on an open standard

A month after we migrated, agentgateway was donated to the Linux Foundation. Then in December 2025, the Linux Foundation announced the Agentic AI Foundation, bringing the protocols themselves under neutral, open governance, including MCP from Anthropic, goose from Block, and AGENTS.md from OpenAI. And just this month, agentgateway itself joined the AAIF as a hosted project, putting the gateway under the same neutral governance as the protocols it speaks.

That matters because enterprises don't standardize on single-vendor protocols; they standardize on open ones. The question organizations are asking now, how to secure and govern an agentic architecture built on MCP, is one we had been answering in production for months. We picked this pattern because it was pragmatic. The industry went on to make it a standard.

## From developer convenience to agentic coordination

{{< reuse-image src="img/blog/scaling-mcp-proxy-to-agent-gateway/gateway-topology.png" alt="agentgateway acting as a single auth boundary in front of twelve MCP servers grouped into developer references (aws-docs, github, jira, confluence, internal docs), deployment (argocd, argo workflows), observability (grafana, opensearch), quality and contracts (pact broker, e2e test results), and cost and operations (aws cost, dlq tooling). Both an engineer in an IDE and agents connect through the same gateway." caption="One gateway, one auth boundary: twelve MCP servers behind a single endpoint, serving both engineers and agents." >}}

When the first article went out, the proxy fronted five servers. Today it fronts twelve, spanning developer references like AWS documentation and GitHub to operational tooling: deployment state, observability, cost reporting, contract testing, and dead-letter queues. Some are open-source servers and some we wrote ourselves; the gateway treats them all the same way, as stdio backends behind a route.

The original framing was developer efficiency, a human in an IDE reaching for a tool. That still holds, but it's no longer the main event. The same fleet of servers is now a control plane for our agents. When an agent investigates a production incident, it can search OpenSearch for the application logs around the error, check Grafana for the matching metric anomaly, review recent GitHub activity to see what changed, and confirm deployment state in ArgoCD, all through one gateway and one auth boundary. Instead of a human stitching the story together, the agent gathers its own evidence.

This is also why the observability servers matter so much to us. Grafana and OpenSearch sit behind the proxy so that agents can verify their hypotheses against real telemetry rather than act on them blindly. And because agentgateway was designed to observe agent traffic, we can watch the gateway itself: which agent called which tool, how often, and to what effect. Closing that loop is one of our next investments.

## Where we're headed

The headline item is OAuth token exchange. Today the proxy acts with service-level credentials. We want per-user identity propagation, so that an agent acting on an engineer's behalf carries that engineer's scopes and authorization decisions are made about a real person rather than a shared role.

When we shipped the first version, we thought we were building a convenience. It turned out to be the foundation for Imagine Learning's SDLC process. Betting on an open protocol meant the ecosystem did much of the work for us, and putting every tool behind one gateway gave us a single place to add capability, observe behavior, and enforce policy. The proxy became a platform, and the platform is how our agents reach everything.

---

*Want to try agentgateway? Start with the getting-started guides for [standalone](https://agentgateway.dev/docs/standalone/latest/documentation/quickstart/) or [Kubernetes](https://agentgateway.dev/docs/kubernetes/latest/documentation/quickstart/), and join the conversation on [Discord](https://discord.gg/BdJpzaPjHv).*

*This post was originally published on the [Imagine Learning Engineering blog](https://medium.com/imaginelearning/scaling-model-context-protocol-from-a-proxy-to-an-agent-gateway-91d91b3c604f).*
