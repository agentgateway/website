---
title: Resiliency
weight: 50
prev: /configuration/traffic-management
next: /configuration/security
---

Simulate failures, disruptions, and adverse conditions to test that your gateway and apps continue to function.

> [!TIP]
> {{< reuse "agw-docs/snippets/policies-gateway-api.md" >}}

{{< reuse "agw-docs/snippets/policy-apply.md" >}}

{{< cards >}}
  {{< card link="mirroring" title="Mirroring" subtitle="Duplicate traffic for testing" >}}
  {{< card link="rate-limits" title="Rate limiting" subtitle="Budget and spend limits for requests and tokens" >}}
  {{< card link="retries" title="Retries" subtitle="Automatic request retry policies" >}}
  {{< card link="timeouts" title="Timeouts" subtitle="Request and connection timeout settings" >}}
{{< /cards >}}