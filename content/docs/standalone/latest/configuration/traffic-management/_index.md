---
title: Traffic management
weight: 40
prev: /docs/configuration/backends
next: /docs/configuration/resiliency
---

Control traffic and route requests through agentgateway.

> [!TIP]
> {{< reuse "agw-docs/snippets/policies-gateway-api.md" >}}

{{< reuse "agw-docs/snippets/policy-apply.md" >}}

{{< cards >}}
  {{< card link="matching" title="Request matching" >}}
  {{< card link="manipulation" title="Header manipulation" >}}
  {{< card link="redirects" title="Redirects" >}}
  {{< card link="transformations" title="Transformations" >}}
  {{< card link="rewrites" title="Rewrites" >}}
  {{< card link="direct-response" title="Direct Response" >}}
  {{< card link="extproc" title="External processing (ExtProc)" >}}
  {{< card link="llm" title="AI (LLM) Policies" >}}
{{< /cards >}}