---
title: Policies
weight: 11
description: 
---

Policies are a powerful feature of agentgateway that allow you to manipulate traffic as it flows through your gateway.
Policies can be used to manipulate traffic, configurable observability, enforce rich security rules, and more.

## Attachment points

You can attach policies at the listener, route, or backend level to provide fine-grained control over traffic.

Policies that are attached at multiple levels are applied at all levels.

|Section|Available Policies|Phase|
|-|-|-|
|Listener|JWT, External Authorization, External Processing, Transformation, Basic Authentication, API Key authentication|Runs before route selection|
|Route|All Policies|Runs after route selection, before backend selection|
|Backend|Backend TLS, Backend Authentication, Backend HTTP, Backend TCP, AI/LLM, MCP Authorization, MCP Authentication, Header modification|Runs after backend selection|

## Example policy configuration

Review the following example configuration that uses one of each policy type.

```yaml
binds:
- port: 3000
  listeners:
  # Listener level policy
  # Enforces that incoming requests have a valid API key
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
    # Adds a header (based on a CEL expression) with the authenticated user (based on the API key)
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
