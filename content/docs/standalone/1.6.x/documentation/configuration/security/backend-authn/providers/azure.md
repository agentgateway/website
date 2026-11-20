---
title: Azure
weight: 30
description: Authenticate to an Azure service from the gateway with a Microsoft Entra ID token.
test:
  backend-authn-azure:
  - file: ${versionRoot}/documentation/configuration/security/backend-authn/providers/azure.md
    path: backend-authn-azure
---

Attaches to: {{< badge content="Backend" path="/documentation/configuration/backends/" >}}

{{< reuse "agw-docs/pages/security/backend-authn-azure-standalone.md" >}}
