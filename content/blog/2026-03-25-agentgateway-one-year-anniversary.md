---
title: "Happy 1st birthday, agentgateway!"
publishDate: 2026-03-23
author: "Lin Sun"
description: "Agentgateway celebrates 1 million pulls, 175+ contributors, and 2,000+ stars in 1 year"
---

On this day in 2025, we created agentgateway after first carefully evaluating Envoy Proxy. As a company deeply invested in Envoy, we initially didn’t want to start a new project, but we needed to keep pace with the rapid evolution of AI. Building on our success developing the new proxy for Istio Ambient, we ultimately decided to create agentgateway from the ground up.

## Rapid adoption among users

Since we donated the project to the Linux Foundation in August 2025, we have witnessed continued strong growth of the project. In the most recent quarter alone, we’ve reached 1 million image pulls of agentgateway.

{{< reuse-image src="img/blog/1year-anniversary/agw-1M-img-pulls.png" width="800px" >}}
{{< reuse-image-dark srcDark="img/blog/1year-anniversary/agw-1M-img-pulls.png" width="800px" >}}

We have over 2,000 GitHub stars on [agentgateway’s main repository](https://github.com/agentgateway/agentgateway), with continuing growth. Thank you everyone who starred the agentgateway repo.

![Star History Chart](https://api.star-history.com/image?repos=agentgateway/agentgateway&type=date&legend=top-left)

Scroll through birthday wishes from some of our users and contributors.

{{< testimonials-carousel >}}
  {{< testimonial author=`Joseph Sandoval` title=`Platform Product Manager, Adobe` link=`https://www.linkedin.com/in/josephrsandoval/` >}}
  As platform teams start running AI agents alongside their services, the communication layer becomes the new control plane. Agentgateway gets this right. It brings the policy, observability, and traffic management primitives the cloud native community already trusts to agent-to-agent communication. This is infrastructure the cloud-native ecosystem needs.
  {{< /testimonial >}}
  {{< testimonial author=`Chris Matcham` title=`Senior Platform Engineer, Helcim` link=`https://www.linkedin.com/in/christophermatcham/` >}}
  Happy Birthday, Agentgateway! While the world was obsessed with the magic of AI agents, this project was busy building the essential guardrails and observability needed to make them prod ready. It's the unsung hero of secure agent communication.
  {{< /testimonial >}}
  {{< testimonial author=`Roi Dayan` title=`VP R&D, Data & AI, Amdocs` link=`https://www.linkedin.com/in/roi-dayan-9954124/` >}}
  At telco scale, an agentic system requires an AI Gateway by design. It acts as the proxy for traffic management and policy enforcement across A2A, MCP, and LLM interactions. We’re excited to see this project maturing under the Linux Foundation, reinforcing the importance of Kubernetes-native agentgateway for secure, portable, and scalable deployments across platforms.
  {{< /testimonial >}}
  {{< testimonial author=`Shane O’Donnell` title=`VP of Engineering, Solo.io` link=`https://www.linkedin.com/in/irishshane/` >}}
  We use agentgateway internally for all of our engineers’ LLM usage. It’s made onboarding faster and easier while giving engineers access to more providers than ever before, all from one centralized place. The improved visibility, user-level metrics, and rich telemetry have helped us drive increased AI usage while identifying optimization opportunities to keep costs down.
  {{< /testimonial >}}
{{< /testimonials-carousel >}}

## Amazing diversity of contributors and partners

The [LFX Insights](https://insights.linuxfoundation.org/) provide project insight for many open source projects including agentgateway, and I was pleased to see the project currently has 179 active contributors:

{{< reuse-image src="img/blog/1year-anniversary/agw-contributors.png" width="800px" >}}
{{< reuse-image-dark srcDark="img/blog/1year-anniversary/agw-contributors.png" width="800px" >}}

Since we created the project, we are thrilled to witness contributions from many companies including but not limited to Microsoft, Apple, Alibaba, AWS, Adobe, Huawei, Amdocs, Cisco, and Salesforce. 

Scroll through some thoughts from leaders and contributors in our community.

{{< testimonials-carousel >}}
  {{< testimonial author=`Vincent Caldeira` title=`Chief Technology Officer, APAC at Red Hat` link=`https://www.linkedin.com/in/caldeirav/overlay/about-this-profile/` >}}
  As a developer building agentic systems, I have found that bridging the gap between local prototypes and secure, production-grade deployments is typically a massive hurdle, and this is exactly where agentgateway shines. Instead of forcing teams to hardcode authentication, routing, and monitoring logic directly into their AI applications, agentgateway acts as a drop-in AI-native data plane that deeply understands both the Model Context Protocol (MCP) and Agent-to-Agent (A2A) traffic. Through its cloud-native approach leveraging the Kubernetes Gateway API and xDS for dynamic configuration, it allows platform teams to quickly onboard agentic workflows alongside existing application micro services on multi-tenant platforms, making it easy to bridge to production without refactoring core agent or tool code.
  {{< /testimonial >}}
  {{< testimonial author=`Matt White` title=`CTO of AI at the Linux Foundation` link=`https://www.linkedin.com/in/mdwdata/` >}}
  Agentgateway's first anniversary is an exciting milestone for the open source AI agent community. In its first year, the project has helped convene contributors and adopters around open approaches to AI agent infrastructure, with support for protocols such as A2A and MCP and growing participation from across the ecosystem. It is encouraging to see this level of collaboration around technologies intended to support agent-to-agent, agent-to-tool, and agent-to-LLM interactions. As the ecosystem continues to develop, open, interoperable, and community-driven infrastructure will play an important role in supporting innovation.
  {{< /testimonial >}}
  {{< testimonial author=`Mehmet Hilmi Emel` title=`AI & MLOps Engineer, ACEDEMAND IT Consulting Services` link=`https://www.linkedin.com/in/mehmet-hilmi-emel/overlay/about-this-profile/` >}}
  As AI agents and LLMs become essential components of modern infrastructure, navigating this landscape requires far more than just connecting to models — and that's exactly where agentgateway shines. Through my experience, I've seen how powerfully it handles LLM consumption, alongside critical architectural needs like robust authorization, seamless MCP integration, and secure agent-to-agent (A2A) communication. It truly is a game-changer for building reliable AI ecosystems. Here's to the amazing community and many more milestones ahead!
  {{< /testimonial >}}
  {{< testimonial author=`Kevin Cao` title=`Contributor of agentgateway and DevOps Engineer, Independent` link=`https://github.com/apexlnc` >}}
  Agentgateway is valuable because it treats AI workloads as a first-class part of the platform, not as something that needs its own parallel infrastructure. By unifying traffic management, policy, security, and observability across both AI and traditional services, it helps create a more coherent operating model for modern systems. That convergence reduces fragmentation, strengthens control, and gives platform teams a foundation that can scale with the next generation of workloads.
  {{< /testimonial >}}
  {{< testimonial author=`Huzefa Hamdard` title=`Senior Site Reliability Engineer, NIQ` link=`https://www.linkedin.com/in/huzefa-hamdard/` >}}
  We're really excited about agentgateway, as it brings a much-needed governance and security layer to agentic systems. We're using it as the central control plane to route and enforce policies on MCP traffic. It integrates really well with our MCP-G solution, giving us both enforcement and visibility. And it's been great to work with agentgateway especially for implementing JWT authentication, RBAC, and fine-grained control over tool access.
  {{< /testimonial >}}
  {{< testimonial author=`Keith Mattix` title=`Principal Software Engineer Lead, Microsoft` link=`https://www.linkedin.com/in/keithmattix/` >}}
  Agentgateway is evidence that we really can just build things. Its native support for cloud native AI scenarios are best-in-class, and we're excited by the work of two Istio maintainers to bring agentgateway into the Istio project, evolving the project towards an agentic mesh.
  {{< /testimonial >}}
  {{< testimonial author=`Hasith Kalpage` title=`Director, Platform Engineering & CISO, Outshift by Cisco` link=`https://www.linkedin.com/in/haskalpa/` >}}
  The agentgateway open-source project enables a secure, observable MCP proxy for us to confidently deploy the Community AI platform engineer (CAIPE.io) at Outshift by Cisco. It's been a great collaboration so far and I wish the project continued success.
  {{< /testimonial >}}
{{< /testimonials-carousel >}}

## Agentgateway travels around the world

{{< cards >}}
  {{< card link=`https://www.linkedin.com/posts/ramvennam_opensource-agenticai-agentgateway-activity-7365691039963090944-8-KK` title=`Open Source Summit Europe 2025` subtitle=`Ram Vennam gave a keynote at Open Source Summit Europe in Amsterdam, announcing the agentgateway donation to the Linux Foundation with Jim Zemlin.` image=`/img/blog/1year-anniversary/2025-europe-oss.jpeg` >}}
  {{< card link=`https://www.linkedin.com/posts/lin-sun-a9b7a81_keynote-done-at-aidev-in-amsterdam-demoed-activity-7366820125624213505-3qiV` title=`AI_dev Europe 2025` subtitle=`Lin Sun gave a keynote at AI_dev in Amsterdam with a live demo of agentgateway running as part of Istio service mesh, enabling security, observability and traffic control for AI agents and MCP servers.` image=`/img/blog/1year-anniversary/2025-europe-ai-dev.jpeg` >}}
  {{< card link=`https://www.youtube.com/watch?v=qa5vSE86z-s` title=`KubeCon and CloudNativeCon NA 2025` subtitle=`John Howard shared lessons learned building the next gen AI gateway, including the technical reasons why we created agentgateway from the ground up.` image=`/img/blog/1year-anniversary/2025-kubecon.png` >}}
  {{< card title=`Boston Kubernetes Meetup Nov 2025` subtitle=`Nina Polshakova gave a talk including a live demo around kagent and agentgateway, keeping everyone engaged throughout the session.` image=`/img/blog/1year-anniversary/2025-boston.png` >}}
  {{< card link=`https://www.linkedin.com/posts/mehmet-hilmi-emel_linuxfoundation-opensourcesummit-oss2025-activity-7392217929171431424-GLyn` title=`Open Source Summit South Korea 2025` subtitle=`Mehmet Hilmi Emel gave his very first international talk on building custom MCP servers with FastMCP and integrating AI agents using Google ADK and agentgateway — so popular he gave it twice!` image=`/img/blog/1year-anniversary/2025-korea-oss.jpeg` >}}
  {{< card link=`https://www.linkedin.com/posts/christiandussol_cloudnative-mcp-kubernetes-activity-7404776961526439936-bjA-` title=`API Days Paris 2025` subtitle=`Lin Sun spoke about securing MCP servers with agentgateway at apidays Paris.` image=`/img/blog/1year-anniversary/2025-paris-mcp.jpeg` >}}
  {{< card link=`https://www.linkedin.com/posts/lin-sun-a9b7a81_mobile-world-congress-is-overwhelmingly-huge-activity-7434693491311624193-Ugcj` title=`Mobile World Congress Barcelona 2026` subtitle=`Agentgateway traveled to Mobile World Congress Barcelona with two talks — one in the iconic talent arena, the other in the open gateway summit.` image=`/img/blog/1year-anniversary/2026-barcelona.jpeg` >}}
  {{< card title=`MCPConference London 2026` subtitle=`Duncan Doyle gave a talk at MCPConference London in February about securing MCP servers with agentgateway.` image=`/img/blog/1year-anniversary/2026-london.png` >}}
  {{< card link=`https://www.linkedin.com/posts/lin-sun-a9b7a81_thank-you-everyone-for-attending-my-securing-activity-7437857198472597504-e7h0` title=`MCPConference NY 2026` subtitle=`Agentgateway traveled to the MCPConference in NY, showing the value of securing MCP servers with agentgateway made simpler.` image=`/img/blog/1year-anniversary/2026-nyc-mcp.jpeg` >}}
{{< /cards >}}

## Continuous technical innovation

Since Day 1, agentgateway keeps innovating: from the best performing AI gateway, to simplified configuration for LLM and MCP, to the ability to release faster, and more. Agentgateway also becomes an experimental dataplane for my favorite service mesh (also the most popular one), Istio. To learn more about the latest innovation in agentgateway, check out our recent 1.0 release [blog](https://agentgateway.dev/blog/2026-03-12-agentgateway-v1.0/).

## Learn more about agentgateway

If you are in Amsterdam this week for KubeCon \+ CloudNativeCon Europe, join us at the [Solo.io](https://www.solo.io/events) booth for the agentgateway birthday celebration on March 25th.

We welcome anyone passionate about the future of AI agents to join our community. Since launching community meetings in July, we’ve seen early participation and contributions from leading organizations including AWS, Microsoft, Red Hat, IBM, Zayo, Shell, Cisco, and Huawei.

To get involved:

* Visit the [agentgateway project GitHub](https://github.com/agentgateway/agentgateway).  
* Join the conversation on [Discord](https://discord.com/invite/y9efgEmppm).
* Attend our weekly [community meetings](https://github.com/agentgateway/agentgateway?tab=readme-ov-file#community-meetings).

Let’s secure and govern the future of AI agents together.
