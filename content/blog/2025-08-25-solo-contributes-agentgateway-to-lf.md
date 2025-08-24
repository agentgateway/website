---
title: Solo.io Contributes agentgateway to Linux Foundation to Make AI Agents More Accessible, Capable, and Secure
toc: false
publishDate: 2025-08-25T00:00:00-00:00
author: Lin Sun
---

Today at Open Source Summit Europe, the [Linux Foundation accepted **agentgateway**](https://www.linuxfoundation.org/press/linux-foundation-welcomes-agentgateway-project-to-accelerate-ai-agent-adoption-while-maintaining-security-observability-and-governance), a new open source AI-native project created by [Solo.io](http://Solo.io). [Agentgateway](https://agentgateway.dev/) provides drop-in security, observability, and governance for agent-to-agent and agent-to-tool communication and supports leading interoperable protocols, including [Agent2Agent (A2A)](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) and [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction).

### **Building the Go-To AI Gateway**

There are many gateways available today, but most were designed before the rise of AI agents and struggle to support modern AI protocols without major rearchitecture. As a company with deep expertise in Envoy, we initially considered it as the foundation for agentgateway. However, we quickly realized that supporting modern agent protocols like A2A and MCP would require a significant re-architecture of Envoy itself. 

To keep pace with rapid innovation in the age of AI, we needed a purposely built solution designed specifically for AI agents. That’s how agentgateway was born.

We didn’t create agentgateway from scratch. Over the past three years, we've been building Istio ambient service mesh within the community. A key component of Istio ambient is the zero trust tunnel (ztunnel) — a purpose-built, lightweight proxy designed to handle the secure overlay layer. Today, many adopters run Ambient with ztunnel in production at scale. 

We’ve taken the lessons learned from building ztunnel and applied them to agentgateway, enabling us to create the most advanced AI-native proxy in the ecosystem. Agentgateway is the first and only data plane built from the ground up for AI agents, governing and securing communication across agent-to-agent, agent-to-tool and agent-to-LLM interactions.

“The future of software is agentic and that changes everything about how systems connect and communicate. Existing API gateways weren’t designed for the rapidly evolving networking demands of AI and agentic architectures, and they can’t adapt fast enough.” said Idit Levine, CEO of Solo.io. “We built agentgateway from the ground up to handle the protocols, patterns, and scale required for agentic infrastructure  \- from A2A and MCP to LLM provider APIs and high-volume inferencing. Agentgateway is the connective tissue for the next generation of intelligent systems.”

### **Enterprise Use Cases Take Off**

As enterprises rapidly adopt agentic AI to automate workflows and enhance productivity, they face a growing challenge: **ensuring secure, observable, and governed connectivity** between AI agents, tools, and large language models.

In real-world enterprise environments:

* **Agents do not operate in isolation**. They interact with each other (agent-to-agent), with internal systems (agent-to-tool), and with external or foundational models (agent-to-LLM).

* These interactions are often dynamic, multi-modal, and span organizational and data boundaries.

This creates **new vectors for risk and complexity**, including:

* **Security**: How do we authenticate, authorize, and audit agent interactions across tools and services?  
* **Governance**: How do we enforce policies (e.g., data residency, access control) across autonomous workflows?  
* **Observability**: How do we gain visibility into what agents are doing, when, and why?

Agentgateway is designed to tackle these enterprise challenges—security, governance, and observability—at their core.

### **End User & Community Excitement Abounds**

"The future won’t be built by standalone agents, MCP servers or LLMs — it’s shaped by their interconnection and ability to work together seamlessly. To unlock their full potential, we must apply policies, ensure control and maintain clear visibility into their interactions. This is where agentgateway plays a pivotal role — bridging not only agent-to-agent (A2A) communication but also agent-to-MCP servers, filling a critical gap in the ecosystem. I look forward to seeing the project’s continued momentum within the Linux Foundation.”  
**– John Roese, global chief technology officer & chief AI officer, Dell**

“AI agents are rapidly transforming how enterprises work and innovate. To adopt them responsibly at scale, organizations need open and interoperable gateways that provide governance, visibility, and security. Agentgateway delivers the foundation enterprises need. I’m excited to see the community come together to accelerate the open foundation our customers need to scale AI on cloud platforms like CoreWeave.”  
**– Chen Goldberg, senior vice president of engineering at CoreWeave.**

"Agentic AI demands purpose-built infrastructure, not just another software layer. This requires rethinking compute, storage, and data movement from the ground up, so retrofitting legacy systems doesn't work. The agentgateway project is a solid step toward that future. We're happy to see it hosted by the Linux Foundation, where open source and community can drive the adoption and longevity that AI infrastructure requires."  
**– Jon Alexander, senior vice president, cloud technology, Akamai**

“We are excited to welcome the agentgateway project to the Linux Foundation, ensuring that best practices for agentic workflows remain free and open to all. Agentgateway complements emerging specifications like A2A and MCP, and offers scalable, specification-aligned infrastructure for agent communication thereby empowering customers and developers to build robust agentic workflows across platforms.”  
**– Mitch Connors, CNCF Ambassador (Microsoft)**

“I'm excited to see Solo.io donate the agentgateway project to the Linux Foundation. Open sourcing an AI-native connectivity solution that understands MCP and A2A is a big win for the community. It helps us scale AI responsibly, with the security, flexibility, and governance we need in the real world.”  
**— Rob Hansen, director, digital product engineering and platforms, T-Mobile**

“Building reliable AI agents is a challenge, especially when every step involves non-deterministic calls to LLMs, tools, and autonomous agents. Agentgateway’s integration with OpenTelemetry provides a robust foundation for observability, allowing us to treat each request-response pair as an evaluable unit. This capability is crucial for ensuring system-level accuracy and trustworthiness, paving the way for a true ‘AI mesh' that empowers teams to scale, secure and optimize their AI workflows.”  
**— Sathish Krishnan, executive director/distinguished engineer, cloud & AI, UBS**

“One of the biggest open security problems today is how to do MCP security effectively. While there are a lot of problems in this space that the community doesn't know how to address, the agentgateway project provides a first step toward addressing some of the important issues with basic role-based access control and visibility of actions to MCP servers. I look forward to seeing how this project adapts and evolves to handle the complex, evolving threats in this space under open source governance.”   
**– Justin Cappos, professor at New York University and creator of the TUF, Uptane and in-toto projects**

“The rapid evolution of the AI landscape demands robust, vendor-neutral infrastructure for how agents communicate with each other and with external tools. Without it, we risk stifling innovation and adoption. The agentgateway project, hosted by the Linux Foundation, is a crucial step in creating that common ground. We are excited to partner with Solo.io and support a community-driven foundation for the future of interoperable AI."  
**– Jim Bugwadia, creator, Kyverno and CEO, Nirmata**

This is a critical time in our industry as organizations seek to gain compelling benefits from AI agents. The acceptance of agentgateway as an open source project by The Linux Foundation fills a vital need in the ecosystem of AI open standards. The leadership demonstrated by [Solo.io](http://solo.io/) enables tech vendors to continue delivering AI innovations at an unprecedented pace."  
**— Mitch Ashley, vice president and practice lead, software lifecycle engineering, The Futurum Group**

### **The Next Chapter Under the Linux Foundation**  

The agentgateway project under the neutral governance of the Linux Foundation will ensure that this critical component remains vendor-agnostic and community-driven. This move is designed to accelerate the adoption and development of the agentgateway by providing a full feature purposefully designed for AI agent gateway for open collaboration, intellectual property management, and long-term stewardship.

“The rise of AI agents depends on a strong foundation of open source infrastructure that is built to last. The agentgateway project provides a centralized and secure management layer for AI agent interactions, supporting emerging standards like the Model Context Protocol, " said Jim Zemlin. "We're pleased to welcome agentgateway to the Linux Foundation where it will benefit from the neutral governance and global community needed to build open, interoperable, secure agent systems for the next generation of AI applications."

We continue to build the best open agentgateway for AI agents with our partners and others in the space, leveraging a broader set of open standards such as A2A or MCP across topics like:

* Agent identity (impersonation and delegation)  
* Agent naming services  
* Agent security  
* Interoperability with various agent frameworks, and more

### **Join the Agentgateway Community**

We welcome anyone passionate about the future of AI agents to join us. Since launching community meetings in July, we’ve seen early participation and contributions from leading organizations including AWS, Microsoft, Red Hat, IBM, Zayo, Shell, Cisco, and Huawei.

To get involved:

* Visit the [agentgateway project GitHub](https://github.com/agentgateway/agentgateway)
* Join the conversation on [Discord](https://discord.com/invite/y9efgEmppm)
* Attend our weekly [community meetings](https://github.com/agentgateway/agentgateway?tab=readme-ov-file#community-meetings)

Let’s build the future of AI agents—together.