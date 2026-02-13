---
title: "Explore Gateway API and agentgateway with ExtAuth Match – A Valentine’s Game"
publishDate: 2026-02-13
author: "Lin Sun & Yuval Kohavi"
description: "Let’s have some fun and share some love while learning Kubernetes Gateway API and agentgateway with the extAuth match game."
---

## Introduction

Over the past few months, we’ve been blown away by the number of contributions and the growing interest in agentgateway. Not only did agentgateway make it onto the CNCF Agentic AI Tech Radar in the Trial category, but the Istio community has also started integrating more deeply with agentgateway after validating its performance and scalability benefits.

With Valentine’s Day around the corner, we started thinking about the amazing contributors and users in our community. What better way to celebrate than by sending some love ❤️ — while having a little fun learning together?

So we built something playful: a swipe-based authorization match game powered by external auth. Think “swipe the card right to allow traffic, swipe left to deny” — but running on Kubernetes with Gateway API and agentgateway.

---

## What is agentgateway?

Agentgateway is a high-performance, lightweight gateway designed specifically for MCP and AI agents — while still working seamlessly with traditional microservices.

There are many gateways available today, but most were designed before the rise of AI agents. As a result, they often struggle to support modern AI protocols without significant rearchitecture. To keep pace with rapid innovation in the age of AI, we needed a purpose-built solution designed specifically for AI-driven workloads. That’s how agentgateway was born.

One of the biggest challenge of agentgateway in Kubernetes is that the control plane doesn't envolve fast enough with the rapid change from the agentgateway data plane. In the new agentgateway 2.2 release, we re-engineered the control plane and its API to allow us to iterate much faster. This enabled us to have feature parity as much as possible as you move from agentgateway standalone to kubernetes, while improving control plane performance significantly. 

---

## What You'll Learn

In this fun Valentine’s Day game, you’ll learn:

- How to use the **Kubernetes Gateway API** (`Gateway` and `HTTPRoute`) to manage traffic.
- How to extend behavior with agentgateway-specific resources such as `AgentGatewayPolicy`.
- How external authorization works in practice.
- How policy decisions dynamically control request flow.

You’ll see it in action, with a human in the loop making real-time decisions.

---

## How the ExtAuth Match Game Works

Here’s the flow:

1. Visit or refresh the app to trigger a request to enter agentgateway.

{{< reuse-image src="img/blog/happy-v-day/UI.png"  >}}

2. It is routed using `Gateway` and `HTTPRoute`.
3. Before getting your requests matched, agentgateway triggers external auth checks.

{{< reuse-image src="img/blog/happy-v-day/UI-pending-match.png"  >}}

4. The external auth match check appears in a playful swipe card on your phone.
5. You swipe:
   - 👉 Right = allow  
   - 👈 Left = deny  
6. The decision is returned to the gateway, which approve or deny the match.

{{< reuse-image src="img/blog/happy-v-day/Match-card.png"  >}}

7. You are presented 5 cards total, representing external auth match check for 5 different resources.

Under the hood, this demonstrates a production-grade pattern with agentgateway:

- External auth policy enforcement.
- Dynamic request evaluation. 
- Real-time traffic control.

It’s a fun, interactive way to understand how agentgateway enforces external auth policy — made with ❤️ by the agentgateway community.

---

## Have Fun! ❤️

This Valentine’s Day, we invite you to:

- Follow the [quick start guide](https://github.com/yuval-k/extauthz-match/tree/master?tab=readme-ov-file#quick-start---kubernetes-deployment-no-need-to-clone-repo) to deploy the demo.
- Explore Gateway API resources.
- Experiment with `AgentGatewayPolicy`.
- Swipe the cards left and/or right.
- Learn something new. 
- Share your love of Kubernetes Gateway API and agentgateway in the open. Tag @agentgateway when you share on LinkedIn, we'll select one lucky winner on Feb 20th for the most fun post.

Got questions? 💌 Join us on our [discord](https://discord.gg/y9efgEmppm), we'd love to help with your NGINX ingress migration or support you on your agentic AI journey.
