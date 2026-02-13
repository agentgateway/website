---
title: Policies
weight: 11
description: 
---

{{< gloss "Policy" >}}Policies{{< /gloss >}} are a powerful feature of agentgateway that allow you to manipulate traffic as it flows through your gateway.
Policies can be used to manipulate traffic, configurable observability, enforce rich security rules, and more.

## Attachment points

You can attach policies at the {{< gloss "Listener" >}}listener{{< /gloss >}}, {{< gloss "Route" >}}route{{< /gloss >}}, or {{< gloss "Backend" >}}backend{{< /gloss >}} level to provide fine-grained control over traffic.

Policies that are attached at multiple levels are applied at all levels.

|Section|Available Policies|Phase|
|-|-|-|
|Listener|{{< gloss "JWT (JSON Web Token)" >}}JWT{{< /gloss >}}, External Authorization, {{< gloss "ExtProc (External Processing)" >}}External Processing{{< /gloss >}}, {{< gloss "Transformation" >}}Transformation{{< /gloss >}}, Basic {{< gloss "Authentication (AuthN)" >}}Authentication{{< /gloss >}}, {{< gloss "API Key" >}}API Key{{< /gloss >}} authentication|Runs before route selection|
|Route|All Policies|Runs after route selection, before backend selection|
|Backend|Backend TLS, Backend Authentication, Backend HTTP, Backend TCP, AI/LLM, MCP Authorization, MCP Authentication, Header modification|Runs after backend selection|

## Example policy configuration

Review the following example configuration that uses one of each policy type.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  # Listener level policy
  # Enforces that incoming requests have a valid {{< gloss "API Key" >}}API key{{< /gloss >}}
  - policies:
      apiKey:
        mode: strict
        keys:
        - key: sk-testkey-1
          metadata:
            user: test
            role: admin
    routes:
    # Route level policy
    # Adds a header (based on a {{< gloss "CEL (Common Expression Language)" >}}CEL{{< /gloss >}} expression) with the authenticated user (based on the API key)
    - policies:
        transformations:
          request:
            set:
              x-authenticated-user: apiKey.user
      backends:
      - host: localhost:8080
        # Backend level policy
        # Adds an Authorization header to outgoing requests
        policies:
          backendAuth:
            key: my-authorization-header
```

## More policy configuration guides

For more information about available policies, review the following guides:

{{< cards >}}
   {{< card link="traffic-management" title="Traffic management" >}}
   {{< card link="resiliency" title="Resiliency" >}}
   {{< card link="security" title="Security" >}}
{{< /cards >}}
