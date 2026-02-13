---
title: "Explore Gateway API and Agentgateway with ExtAuth Match 💕 Game"
publishDate: 2026-02-13
author: "Lin Sun & Yuval Kohavi"
description: "Let’s have some fun and share love while learning Kubernetes Gateway API and agentgateway with the ExtAuth Match game."
---
{{< reuse-image src="img/blog/happy-v-day/V-card.png" width="600px" >}}
Over the past few months, we’ve been blown away by the number of contributions and the growing interest in agentgateway. Not only did agentgateway make it onto the [CNCF Agentic AI Tech Radar](https://www.cncf.io/wp-content/uploads/2025/11/cncf_report_techradar_111025a.pdf) in the Trial category, but the Istio community has also [started integrating](https://github.com/istio/istio/pull/58619) more deeply with agentgateway after validating its performance and scalability benefits.

With Valentine’s Day around the corner, we started thinking about the amazing contributors and users in our community. What better way to celebrate than by sending some love ❤️ — while having a little fun learning together?

So we built something playful: a swipe-based authorization match game powered by external auth. Think “swipe the card right to allow traffic, swipe left to deny” — but running on Kubernetes with Gateway API and agentgateway.

---

## What is agentgateway?

Agentgateway is a high-performance, lightweight gateway designed specifically for MCP and AI agents — while still working seamlessly with traditional microservices.

There are many gateways available today, but most were designed before the rise of AI agents. As a result, they often struggle to support modern AI protocols without significant rearchitecture. To keep pace with rapid innovation in the age of AI, we needed a purpose-built solution designed specifically for AI-driven workloads. That’s how agentgateway was born.

Since launching agentgateway last year, one of the biggest challenges in Kubernetes has been ensuring that the control plane evolves as quickly as the rapidly changing data plane. In the newly released agentgateway 2.2 version, we re-engineered the control plane and its APIs to enable much faster iteration. This allows us to maintain strong feature parity between standalone and Kubernetes deployments while significantly improving control plane performance.

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

1. Visit or refresh the match app and scan the QR code to connect your phone. 

{{< reuse-image src="img/blog/happy-v-day/UI.png" width="500px" >}}

2. Once connected, refresh the match app to trigger a request that enters agentgateway. Alternatively, you can click the **Not seeing requests? Try again** button. The request is routed using `Gateway` and `HTTPRoute`. 

3. Before the request is matched, agentgateway triggers an external authorization check.

{{< reuse-image src="img/blog/happy-v-day/UI-pending-match.png" width="500px" >}}

4. The external auth match check appears in a playful swipe card on your phone.
5. You swipe:
   - 👉 Right = allow  
   - 👈 Left = deny  

{{< reuse-image src="img/blog/happy-v-day/Match-card.png" width="400px" >}}
6. The decision is returned to the gateway, which either approves or denies the match.

7. You are presented with five cards in total, representing external authorization checks for five different resources.

Under the hood, this demonstrates a production-grade pattern with agentgateway:

- External auth policy enforcement
- Dynamic request evaluation
- Real-time traffic control

It’s a fun, interactive way to understand how agentgateway enforces external auth policy — made with ❤️ by the agentgateway community.

---

## Have Fun! ❤️

If you have a Kubernetes cluster, this Valentine’s Day, we invite you to:

- Follow the [quick start guide](https://github.com/yuval-k/extauthz-match/tree/master?tab=readme-ov-file#quick-start---kubernetes-deployment-no-need-to-clone-repo) to deploy the game.
- Explore Gateway API resources.
- Experiment with `AgentGatewayPolicy`.
- Visit/refresh the match app from your browser following the [instruction](#how-the-extauth-match-game-works) to trigger a request to agentgateway. Swipe the cards left or right on your phone to approve or deny.
- Learn something new. 
- Share your love for Kubernetes Gateway API and agentgateway in the open. Tag @agentgateway when you share on LinkedIn — we’ll select one lucky winner on February 20th for the most fun post.

Got questions? Join us on our [discord](https://discord.gg/y9efgEmppm). We'd love to help with your NGINX ingress migration or support you on your agentic AI journey.
