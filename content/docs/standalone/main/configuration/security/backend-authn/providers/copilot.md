---
title: GitHub Copilot
weight: 40
description: Authenticate to GitHub Copilot with a token that agentgateway reads from your environment.
test:
  backend-authn-copilot:
  - file: ${versionRoot}/configuration/security/backend-authn/providers/copilot.md
    path: backend-authn-copilot
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

{{< reuse "agw-docs/pages/security/backend-authn-copilot-standalone.md" >}}
