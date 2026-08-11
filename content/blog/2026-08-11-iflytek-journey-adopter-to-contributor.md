---
title: "From Adopter to Contributor: iFLYTEK's Journey with agentgateway"
category: "Community"
publishDate: 2026-08-11
author: "Dong Jiang"
description: "How iFLYTEK's evaluation of agentgateway evolved into active contribution and a deeper relationship with the open-source community."
toc: true
---

{{< reuse-image src="/img/blog/iflytek-journey/iflytek-agentgateway.png" >}}

iFLYTEK (科大讯飞) is a publicly listed AI company headquartered in Hefei, China, founded in 1999. We are best known for our speech and language technology — speech recognition, machine translation, and cognitive intelligence — and more recently for our Spark large language model family and the agent platform built on top of it.

Within iFLYTEK, our team builds the infrastructure that powers internal agentic applications, such as [astron-agent](https://github.com/iflytek/astron-agent), which was the No. 1 trending repository on GitHub as of August 7, 2026. Our work includes connecting agents to tools through MCP, enabling agent-to-agent communication through A2A, and routing traffic to LLM backends.

That infrastructure is exactly where agentgateway entered our story.

## Our Journey with agentgateway

We started evaluating agentgateway in spring 2026 and have been running it in our test environments for about three months.

The experience has been surprisingly smooth for a young project. The single-binary deployment model made adoption straightforward—we didn't need to stitch together a proxy, MCP middleware, and separate observability components. Out of the box, we got routing, authentication, and OpenTelemetry-based visibility into our MCP traffic.

And when we did hit rough edges, the community was responsive. Issues we filed received meaningful responses within days. That experience ultimately pulled me deeper into the project and, as you'll see below, from a user into a contributor.

## Why agentgateway?

Three things stood out.

**1. MCP and A2A are first-class citizens.**

Most gateways treat AI traffic as "HTTP with extra steps." agentgateway understands MCP sessions, tool calls, and A2A message flows natively. That means we can apply policy and observability at the level where agents actually operate—per tool, per session, and per interaction—not simply per HTTP URL.

**2. A unified data plane.**

We already had traditional microservice traffic running behind API gateways. Having a single gateway that can handle HTTP, gRPC, MCP, A2A, and LLM traffic—rather than introducing a separate "AI sidecar"—aligned well with our platform team's goal of reducing operational complexity and the number of moving parts.

**3. Performance and governance.**

The Rust implementation has a small enough footprint to run alongside our workloads without significant resource overhead. Just as importantly, the project's governance under the Agentic AI Foundation gave us the vendor-neutral confidence that a large organization needs before standardizing on an open-source component.

## What other projects did we evaluate?

We looked at three broad categories of solutions:

* **Classic API gateways with AI plugins**, such as Kong and Apache APISIX. These are mature and battle-tested, but AI capabilities are largely extensions to an existing API gateway model. They work well for north-south LLM proxying, but are less naturally suited to MCP session semantics.
* **Envoy-based AI gateways**, including Envoy AI Gateway and kgateway. These are powerful and benefit from a mature ecosystem, but achieving the MCP-aware behavior we wanted would have required more extension engineering than we wanted to own ourselves.
* **LLM-focused proxies**, such as LiteLLM-style gateways. These are excellent for model routing and token accounting, but typically stop at the LLM boundary. They don't provide the same level of governance over agent-to-tool and agent-to-agent communication—which is where we see significant operational and security concerns emerging.

agentgateway was the only option that is purposefully built for the **entire agent connectivity path**.

## What key decisions have we made along the way?

Our adoption of agentgateway also led us to make several architectural decisions:

1. **Standardize on MCP.** We chose MCP as the integration contract between our agent platform and internal tools rather than building bespoke REST adapters for each tool.
2. **Put policy at the gateway, not in the agents.** Authentication, authorization, and audit logging for tool access live in agentgateway. This gives every agent—regardless of which framework or team built it—a consistent security posture.
3. **Contribute upstream instead of maintaining a fork.** When we found gaps, we chose to address them in the open and contribute the fixes upstream. This keeps our deployment close to the mainline project while allowing the improvements to benefit the broader community.

## How We Use agentgateway Today

Early on, we spent half a day chasing a mysterious latency spike. Eventually, we discovered that one of our own MCP servers was holding sessions open longer than expected. The gateway's per-session metrics gave us the answer almost immediately, once we stopped guessing and actually looked at the dashboard.

That experience reinforced something we now consider fundamental: **agent infrastructure needs observability from day one.**

## From User to Contributor

About two months after we started running agentgateway, I began reading the source code to answer deployment questions. Before long, I had opened my first pull request in early July.

Since then, I've submitted a dozen pull requests, most of which have been merged, covering several areas of the project.

### Kubernetes controller correctness

I've contributed fixes that align the Kubernetes API with upstream conventions. For example:

* Converting `PolicyConditionType` and `PolicyConditionReason` to string type aliases to match `metav1.Condition` ([#2815](https://github.com/agentgateway/agentgateway/pull/2815)).
* Replacing `reflect.DeepEqual` with `apiequality.Semantic.DeepEqual` to eliminate spurious diffs caused by `metav1.Time` comparisons ([#2687](https://github.com/agentgateway/agentgateway/pull/2687)).

These may sound like relatively small changes, but correctness at the controller layer matters enormously when you're operating Kubernetes infrastructure at scale.

### Performance

Performance has also been an area of focus:

* Parallelizing JWKS fetches with bounded concurrency ([#2594](https://github.com/agentgateway/agentgateway/pull/2594)).
* Working on removing unused fields from informer caches to reduce controller memory consumption ([#2686](https://github.com/agentgateway/agentgateway/pull/2686)).

### Observability

I added an `agentgateway_controller_build_info` metric and fixed a `SetRegistry` lifecycle issue along the way ([#2399](https://github.com/agentgateway/agentgateway/pull/2399)).

### Testing and lint infrastructure

I've also contributed improvements to the project's engineering infrastructure, including:

* Adding `goleak` to detect goroutine leaks in controller packages ([#2419](https://github.com/agentgateway/agentgateway/pull/2419)).
* Fixing `gosec` and `kube-api-linter` configurations ([#2366](https://github.com/agentgateway/agentgateway/pull/2366)).

### MCP itself

One of the contributions closest to our real-world experience is a refactor of MCP session error handling with `MissingClientCapability` support, currently under review ([#2645](https://github.com/agentgateway/agentgateway/pull/2645)).

This is one of the things I appreciate most about contributing to infrastructure projects: real-world usage changes the kinds of problems you notice. Once you've operated MCP sessions yourself, some edge cases stop looking theoretical.

### Not Every Contribution Needs to Be Merged

Of course, not every PR landed.

My proposal to add an `fgprof` profiling endpoint to the admin server ([#2464](https://github.com/agentgateway/agentgateway/pull/2464)) was ultimately closed after discussion.

I actually see that as a sign of a healthy open-source community.

The maintainers didn't simply rubber-stamp the proposal. They engaged with the idea, explained the trade-offs, and ultimately decided not to merge it. The discussion itself sharpened my understanding of the project's admin-server design.

That's an important part of open source: **contributing isn't just about getting your code merged. It's about participating in the engineering conversation.**

## From Individual Contributor to Contributing Company

One of the most rewarding parts of this journey has been seeing the relationship evolve beyond individual contributions.

As someone contributing from China, in a different timezone and corporate environment, what impressed me most was how quickly and constructively the community responded to our contributions.

That same experience happened when I filed [website#826](https://github.com/agentgateway/website/issues/826) to add iFLYTEK to the Contributing Companies section. The maintainers took the time to verify the contribution and engage with us directly.

That kind of interaction matters.

It is what turns an open-source project that you **use** into a project that you **want to contribute to**.

And eventually, it turns an individual contributor into a contributing company.

## Lessons Learned

Our journey with agentgateway has taught us several lessons.

### 1. Agent traffic is not API traffic

Agent communication is fundamentally different from traditional request/response APIs.

Sessions can be long-lived. Communication can be bidirectional. State matters. Tool calls can trigger additional agent interactions.

Infrastructure designed purely around stateless HTTP request/response semantics needs to evolve for this new model. Understanding that distinction early helped us avoid architectural rework.

### 2. Observability should come first

Instrument MCP and A2A traffic from day one.

Without visibility into sessions, tool calls, latency, and errors, it's easy to spend hours debugging symptoms rather than understanding the underlying behavior.

Our own experience with the "mysterious latency spike" made this lesson very real.

### 3. Put policy outside the agents

Security shouldn't depend on every individual agent implementing authentication, authorization, and auditing correctly.

Centralizing those concerns at the gateway gives us a consistent policy surface across agents, tools, and teams—and makes those policies easier to evolve as the platform grows.

### 4. Upstream beats a fork

Every patch we contribute upstream is one less patch we have to maintain ourselves.

More importantly, upstream contributions make the project better for everyone running similar workloads.

For us, reading the source code to answer deployment questions turned out to be one of the fastest ways to understand the project. Contributing those improvements back was the natural next step.

## Conclusion

For iFLYTEK, agentgateway transformed "agent connectivity" from a collection of glue code into a governed and observable infrastructure layer: **one gateway, one policy surface, and one audit trail across MCP, A2A, and LLM traffic.**

But technology is only part of the story.

What started as an evaluation of an open-source project became hands-on adoption, then individual contributions, and ultimately a relationship between iFLYTEK and the agentgateway community.

That journey has been one of the most rewarding parts of working with agentgateway.

If you're building agentic systems and thinking about where security, observability, and connectivity should live, give agentgateway a try. And when you hit a rough edge, don't just work around it. Open an issue. Start a discussion. Send a PR.

You might be surprised where that journey takes you.
