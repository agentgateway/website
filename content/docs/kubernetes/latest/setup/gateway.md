---
title: Set up an agentgateway
weight: 10
description:
---

Set up an agentgateway proxy.

## Before you begin

{{< reuse "agw-docs/snippets/agentgateway-prereq.md" >}}

## Set up an agentgateway proxy

{{< reuse "agw-docs/snippets/agentgateway-setup.md" >}}

{{< doc-test paths="all" >}}
YAMLTest -f - <<'EOF'
- name: wait for agentgateway-proxy deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: wait for agentgateway-proxy service LB address
  wait:
    target:
      kind: Service
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    targetEnv: INGRESS_GW_ADDRESS
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}


## Next

Explore how you can use {{< reuse "agw-docs/snippets/agentgateway.md" >}} by checking out guides for the most common use cases:
* [LLM consumption]({{< link-hextra path="/llm" >}})
* [Inference routing]({{< link-hextra path="/inference" >}})
* [MCP connectivity]({{< link-hextra path="/mcp" >}})
* [Agent connectivity]({{< link-hextra path="/agent" >}})

You can also install the [httpbin sample app]({{< link-hextra path="/install/sample-app/" >}}) and use this app to test traffic management, security, and resiliency guides with your agentgateway proxy.

## Other configuration examples

Review other common configuration examples for your Gateway. To customize your Gateway even further, such as with Kubernetes overlays, check out [Customize the gateway]({{< link-hextra path="/setup/customize" >}}). 

### Same namespace HTTPRoutes

Allow only HTTPRoutes that are in the same namespace as the Gateway to be attached to this Gateway (`allowedRoutes.namespaces.from=Same`). 

```yaml
kind: Gateway
apiVersion: gateway.networking.k8s.io/v1
metadata:
  name: agentgateway-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
  listeners:
    - protocol: HTTP
      port: 80
      name: http
      allowedRoutes:
        namespaces:
          from: Same
```