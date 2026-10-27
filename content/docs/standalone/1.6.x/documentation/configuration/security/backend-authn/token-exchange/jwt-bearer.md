---
title: JWT bearer grant (RFC 7523)
weight: 20
description: Exchange the incoming request credential for a per-backend token with the RFC 7523 JWT bearer grant.
test:
  te-jwt-bearer-standalone:
  - path: te-jwt-bearer-standalone
---

Attaches to: {{< badge content="Backend" path="/documentation/configuration/backends/" >}}

{{< reuse "agw-docs/pages/security/backend-authn-te-jwt-bearer-standalone.md" >}}
