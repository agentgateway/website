---
title: Policies
weight: 11
description: 
---

Policies are a powerful feature of agentgateway that allow you to manipulate traffic as it flows through your gateway.
Policies can be used to manipulate traffic, configurable observability, enforce rich security rules, and more.

Policies can be configured on a listener, route, or backend level to provide fine-grained control over traffic.
Policies at multiple levels will all be applied

|Section|Available Policies|Phase|
|-|-|-|
|Listener|JWT, External Authorization, External Processing, Transformation, Basic Authentication, API Key authentication|Runs before route selection|
|Route|All Policies|Runs after route selection, before backend selection|
|Backend|Backend TLS, Backend Authentication, Backend HTTP, Backend TCP, AI/LLM, MCP Authorization, MCP Authentication, Header modification|Runs after backend selection|

Below shows an example configuration that uses one of each policy type.

```yaml
binds:
- port: 3000
  listeners:
  # A listener level policy, enforcing that incoming requests have a valid API key
  - policies:
      apiKey:
        mode: strict
        keys:
        - key: sk-testkey-1
          metadata:
            user: test
            role: admin
    routes:
    # A route level policy, adding a header (based on a CEL expression) with the authenticated user (based on the API key)
    - policies:
        transformations:
          request:
            set:
              x-authenticated-user: apiKey.user
      backends:
      - host: localhost:8080
        # A backend level policy, adding an Authorization header to outgoing requests
        policies:
          backendAuth:
            key: my-authorization-header
```

For more information about available policies, view the list of policies:

{{< cards >}}
   {{< card link="traffic-management" title="Traffic management" >}}
   {{< card link="resiliency" title="Resiliency" >}}
   {{< card link="security" title="Security" >}}
{{< /cards >}}
