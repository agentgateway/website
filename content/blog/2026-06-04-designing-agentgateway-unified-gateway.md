---
title: "Designing agentgateway: A Unified High-Performance Gateway for AI and API Traffic"
category: "Deep Dive"
publishDate: 2026-06-04
author: "Lin Sun"
description: "Why we built agentgateway as a unified control plane and data plane for HTTP, gRPC, MCP, A2A, and LLM traffic — the design decisions, the choice of Rust, the performance numbers, and the road to AAIF."
toc: false
---

> _Originally published by the [Agentic AI Foundation](https://aaif.io/blog/designing-agentgateway-a-unified-high-performance-gateway-for-ai-and-api-traffic/)._

When we started building agentgateway at Solo.io, one of the first questions we asked ourselves was whether the world really needed another gateway instead of simply reusing an existing reverse proxy like Envoy.

The answer became obvious pretty quickly.

Not because existing API gateways are broken. And not because AI traffic somehow replaces traditional application traffic.

The reason is that organizations deploying AI systems are running into a new category of operational problems that existing infrastructure was never specifically designed to address.

### AI systems create new infrastructure concerns

As agents become more capable, they stop looking like isolated chatbot experiences and start behaving more like distributed systems.

They call tools. They route requests across APIs and models. They coordinate workflows across multiple services. They interact with MCP servers, LLM providers, databases, and internal platforms.

And suddenly the infrastructure questions become much bigger than simple request routing.

* How do you govern which tools an agent can access?
* How do you apply consistent authentication and authorization policies across AI systems and traditional services?
* How do you observe what agents are actually doing across complex workflows?
* How do you rate limit model usage, apply routing policies, or enforce organizational controls around AI traffic?
* How do you minimize impact between AI agents and MCP servers with fast evolving MCP protocols?
* How do you gain security, governance and visibility into the emerging context layer ("layer 8") that is becoming increasingly important for AI traffic?

These are not theoretical questions anymore. Teams deploying AI systems are dealing with them right now.

### Why separate AI gateways and API gateways becomes painful

One of the earliest architectural decisions we made was to avoid creating a completely separate infrastructure stack for AI systems.

At first glance, splitting them apart sounds reasonable. Traditional APIs and AI workloads appear different enough to justify separate operational layers.

But in practice, organizations running agents are also running the APIs, services, and infrastructure those agents depend on.

That means platform teams quickly end up duplicating operational concerns across multiple systems:

* separate policy models
* separate authentication configurations
* separate observability pipelines
* separate routing infrastructure
* separate governance controls

The complexity compounds fast.

For example, an internal developer platform might expose several MCP servers for documentation search, ticket creation, deployment workflows, and database access. Without a shared gateway layer, each team may need to configure authentication, authorization, audit logging, rate limits, and routing separately. agentgateway gives platform teams a centralized place to manage those controls while still allowing individual tools and services to evolve independently.

We believed the better approach was unification.

agentgateway was designed as a unified gateway control plane and proxy data plane that can handle HTTP, gRPC, MCP, A2A, and LLM traffic together through the same operational surface. That means organizations can manage AI and non-AI traffic using the same infrastructure patterns instead of standing up parallel systems for each.

### Tool federation and protocol-aware routing

One of the challenges that emerges quickly in real AI deployments is fragmentation.

Different teams expose different MCP servers. Organizations adopt multiple model providers. Agents interact with internal APIs, external services, and specialized tooling spread across environments.

From both an operational and security perspective, managing those integrations individually becomes difficult.

agentgateway introduces a federation layer that allows organizations to aggregate and route traffic across tools, models, and services while applying centralized policy enforcement and visibility controls.

Clients can interact through a unified endpoint while administrators retain control over authentication, authorization, observability, and routing behavior.

This becomes increasingly important as interoperability protocols like MCP and A2A continue gaining adoption across the ecosystem.

### Why we chose Rust

We didn't create agentgateway entirely from scratch.

Over the past three years, we've been building Istio ambient service mesh within the community. A key component of Istio ambient is ztunnel, a Rust-based, purpose-built lightweight proxy designed to handle the secure overlay layer.

We applied many of the lessons learned from building ztunnel, as well as years of experience operating Envoy at scale, to agentgateway, enabling us to create an AI-native proxy optimized for performance, security, and operational simplicity.

Like ztunnel, we built agentgateway in Rust because performance and memory safety are non-negotiable for this kind of system.

Rust has a strong history of success in high performance, low resource utilization applications, especially in network applications (including service mesh). We built agentgateway on top of Tokio and Hyper, two extensively battle-tested libraries for asynchronous networking, along with Tonic, cel-rust, and other core ecosystem components.

### Performance

When evaluating infrastructure components like gateways, performance and scalability are critical.

Common gateway performance metrics include:

* Throughput
* Latency
* CPU and memory utilization
* Route propagation time
* Error rates
* The ability to safely handle route updates without downtime

Equally important is how the system behaves at scale: tens of thousands of services, MCP servers, and routes operating simultaneously within highly dynamic distributed systems.

agentgateway uses an xDS control plane architecture that allows dynamic configuration updates without restarting the data plane. Routes, policies, integrations, and backend services can evolve continuously while traffic continues flowing.

Using traffic performance as one example, agentgateway achieves approximately 500k QPS with 512 connections in our benchmark testing, outperforming peer proxies under similar conditions.

In another benchmark, agentgateway maintained less than 0.2 ms P99 latency at 30k QPS with 512 concurrent connections.

For a deeper dive into methodology and additional metrics beyond traffic performance, check out John Howard's [Gateway API benchmark v2](https://github.com/howardjohn/gateway-api-bench/blob/main/README-v2.md).

### Why we donated agentgateway to AAIF

From the beginning, we wanted agentgateway to live under vendor-neutral governance.

After creating the project in March 2025, we initially donated it to the Linux Foundation on August 25, 2025 because neutral governance was important to both contributors and users.

At the same time, we continued searching for a foundation more specifically aligned with agentic AI infrastructure. When the Agentic AI Infrastructure Foundation (AAIF) launched, it became clear that it was a strong long-term fit.

AAIF provides a neutral, open foundation to help critical AI infrastructure evolve transparently and collaboratively while accelerating adoption of open-source AI projects.

agentgateway complements existing AAIF projects such as MCP and Goose by acting as the connective layer between:

* Agent-to-LLM interactions
* Agent-to-MCP interactions
* Agent-to-agent interactions

It provides the security, governance, and observability enterprises need to confidently adopt AI agents, MCP servers, and LLM-based systems.

On April 8, we [submitted](https://github.com/aaif/project-proposals/issues/11) the agentgateway proposal to AAIF through the project proposal process. The project was approved by the Technical Committee on May 13 and by the Governing Board on May 21 as a Growth-stage project.

### Tremendous Growth

Since February, we've seen rapid adoption of agentgateway.

Weekly downloads grew from approximately 100,000 per week to more than 1 million per week, surpassing 7 million total downloads.

We also [use agentgateway extensively at Solo.io](https://aaif.io/blog/use-agentgateway-to-mediate-mcp-and-llm-traffic-at-solo-io/) to mediate both LLM and MCP traffic, giving us consistent security, governance, and observability across these systems.

In parallel, we've been working closely with organizations including Microsoft, Apple, Adobe, Amdocs, T-Mobile, and Expedia, along with many other enterprises adopting agentgateway.

agentgateway has also been [adopted](https://www.cncf.io/announcements/2026/03/25/istio-brings-future-ready-service-mesh-to-the-ai-era-with-new-ambient-multicluster-gateway-api-inference-extension-and-more/) by Istio as a data plane option for AI gateway use cases.

### What's next

As agentic systems move from experiments into production environments, the community will need shared infrastructure patterns for routing, policy enforcement, observability, and interoperability.

We want agentgateway to become a unified gateway layer to secure, connect, and observe agentic and cloud native workloads.

Over the next 12 months, we plan to continue expanding the project through deeper integrations, broader protocol support, and continued collaboration with the open-source community.

Some planned areas include:

* Enhancing our UI to include historical analytics and request information, as well as broader support for AI integrations
* Expanding our inference workload support through integration with LLM-d and vLLM Semantic Router
* Continuing to engage with, and implement, new MCP proposals such as Stateless MCP
* Expanding MCP functionality with richer guardrails and cost optimization features such as progressive disclosure and code mode
* Integration with [Agent Client Protocol (ACP)](https://agentclientprotocol.com/get-started/introduction)
* Publishing more production case studies and architecture patterns
* Expanding internationalization and community-driven translation workflows
* Continuing collaboration with the Kubernetes community on [agentic networking](https://github.com/kubernetes-sigs/kube-agentic-networking/) and [AI Gateway](https://github.com/kubernetes-sigs/wg-ai-gateway) APIs

With agentgateway now part of AAIF, we welcome contributors, users, and platform teams to help shape the roadmap in the open under neutral governance.

If you are building AI systems, operating MCP infrastructure, or thinking about the operational maturity required for agentic workflows, we would love to collaborate with you.

* Explore the [docs](https://agentgateway.dev) and [get started](https://agentgateway.dev/#getting-started) today.
* Star and contribute on [GitHub](https://github.com/agentgateway/agentgateway).
* Engage with us in the community [Discord](https://discord.com/invite/y9efgEmppm) or an upcoming [community meeting](https://github.com/agentgateway/agentgateway?tab=readme-ov-file#community-meetings).
