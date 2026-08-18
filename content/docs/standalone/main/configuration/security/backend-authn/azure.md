---
title: Azure
weight: 5
description: Authenticate to an Azure service from the gateway with a Microsoft Entra ID token.
test:
  backend-authn-azure:
  - file: ${versionRoot}/configuration/security/backend-authn/azure.md
    path: backend-authn-azure
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

{{< reuse "agw-docs/pages/security/backend-authn-azure-standalone.md" >}}
