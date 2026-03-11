---
title: Release notes
weight: 20
---

Review the release notes for agentgateway.

## 🔥 Breaking changes {#v10-breaking-changes}

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

### New release version pattern

The previous release version pattern was changed to align with the version number pattern that is used for the agentgateway standalone binary. Going forward, both the agentgateway on Kubernetes and agentgateway standalone binary projects use the same release version number. If you have existing CI/CD workflows that depend on the old pattern, update them. 

Note that version 2.2 of the documentation is removed. Use the latest 1.0.0 version instead. 

### New Helm charts

The agentgateway control plane is now independent from the kgateway open source project. Because of that, the Helm paths changed as follows: 

* CRDs: `oci://cr.agentgateway.dev/charts/agentgateway-crds`
* Control plane: `oci://cr.agentgateway.dev/charts/agentgateway`

Make sure to update any CI/CD workflows and processes to use the new Helm chart locations.

### XListenerSet API promoted to ListenerSet

The experimental XListenerSet API is promoted to the standard ListenerSet API in version 1.5.0. You must install the standard channel of the Kubernetes Gateway API to get the ListenerSet API definition. If you use XListenerSet resources in your setup today, update the CRD kind from `XListenerSet` to `ListenerSet` and api version from `gateway.networking.x-k8s.io/v1alpha1` to `gateway.networking.k8s.io/v1` as shown in the following examples. 

**Old XListenerSet example**:
```
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: XListenerSet
metadata:
  name: http-listenerset
  namespace: httpbin
spec:
  parentRef:
    name: agentgateway-proxy-http
    namespace: agentgateway-system
    kind: Gateway
    group: gateway.networking.k8s.io
  listeners:
  - protocol: HTTP
    port: 80
    name: http
    allowedRoutes:
      namespaces:
        from: All
```

**Updated ListenerSet example**: 
```
apiVersion: gateway.networking.k8s.io/v1
kind: ListenerSet
metadata:
  name: http-listenerset
  namespace: httpbin
spec:
  parentRef:
    name: agentgateway-proxy-http
    namespace: agentgateway-system
    kind: Gateway
    group: gateway.networking.k8s.io
  listeners:
  - protocol: HTTP
    port: 80
    name: http
    allowedRoutes:
      namespaces:
        from: All
```

### CEL 2.0 

This release includes a major refactor to the CEL implementation in agentgateway to improve scalability and performance. The following user facing changes were introduced:

* **Function name changes**: <!-- CEL expressions can now be applied directly to rate limiting, authorization, and observability policies. -->Due to dependency updates, function names were changed. Previously, function names followed a camel case pattern, such as `base64Encode`. Now, function names use dot notations, such as `base64.encode`. The old camel case names remain in place for backwards compatibility. 
* **New string functions**: The following string manipulation functions were added to the CEL library: `startsWith`, `endsWith`, `stripPrefix`, and `stripSuffix`. These functions align with the Google [CEL-Go strings extension](https://pkg.go.dev/github.com/google/cel-go/ext#Strings). 
* **Null values fail**: If a top-level variable returns a null value, the CEL expression now fails. Previously, null values always returned true. For example, the `has(jwt)` expression was previously successful if the JWT was missing or could not be found. Now, this expression fails. 
* **Logical operators**:  Logical `||` and `&&` operators now handle evaluation errors gracefully instead of propagating them. For example, `a || b` returns `true` if `a` is true even if `b` errors. Previously, the CEL expression failed. 

Make sure to update and verify any existing CEL expressions that you use in your environment. 

For more information, see the [CEL expression]({{< link-hextra path="/reference/cel/" >}}) reference. 

### External auth fail-closed

External auth policies now fail closed when the `backendRef` to the auth server is invalid. This way, requests are rejected if the auth server cannot be reached or is misconfigured. You are affected if you have an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that specifies the `traffic.extAuth.backendRef` field as shown in the following example. 

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  name: gateway-ext-auth-policy
  labels:
    app: ext-authz
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    extAuth:
      backendRef:
        name: ext-authz
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        port: 4444
      grpc: {}
EOF
```

_Before_: If the `ext-authz` service was missing or misconfigured, the ext auth policy was effectively skipped and all requests passed through.

_After_: Requests to routes protected by this policy are rejected with a failure response until the backend reference is corrected.

### MCP deny-only authorization policies

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1058 -->

A critical correctness bug was fixed in MCP authorization. You are affected if you have an MCP authorization policy that uses `action: Deny` without any corresponding allow rules. 

For example, review the following {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. Previously, this policy denied all tool access, not just access to the `echo` tool. Starting in 1.0.0, only `echo` is denied and all other tools are allowed. 

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
spec:
  targetRefs:
  - group: agentgateway.dev
    kind: AgentgatewayBackend
    name: mcp-backend
  backend:
    mcp:
      authorization:
        action: Deny
        policy:
          matchExpressions:
          - 'mcp.tool.name == "echo"'
```

### MCP authentication mode change

The default MCP authentication mode now defaults to `Strict` mode instead of `Permissive`. Requests to MCP backends without valid credentials are rejected by default. To restore the `Permissive` behavior, see the following example:

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: permissive-mcp-auth
spec:
  targetRefs:
  - group: agentgateway.dev
    kind: AgentgatewayBackend
    name: my-mcp-backend
  backend:
    mcp:
      authentication:
        mode: Permissive
        jwks:
          remote:
            jwksPath: ".well-known/jwks.json"
            backendRef:
              name: idp-service
        issuer: "https://my-idp.example.com"
```


## 🌟 New features {#v10-new-features}

The following features were introduced in 1.0.0.

### Kubernetes Gateway API version 1.5.0

The Kubernetes Gateway API dependency is updated to support version 1.5.0. This version introduces several changes, including: 
* **XListenerSets promoted to ListenerSets**: The experimental XListenerSet API is promoted to the standard ListenerSet API in version 1.5.0. You must install the standard channel of the Kubernetes Gateway API to get the ListenerSet API definition. If you use XListenerSet resources in your setup today, update these resources to use the ListenerSet API instead. 
* **AllowInsecureFallback mode for mTLS listeners**: If you set up mTLS listeners on your agentgateway proxy, you can now configure the proxy to establish a TLS connection, even if the client TLS certificate could not be validated successfully. For more information, see the [mTLS listener docs]({{< link-hextra path="/setup/listeners/mtls/" >}}). 
* **CORS wildcard support**: The `allowOrigins` field now supports wildcard `*` origins to allow any origin. For an example, see the [CORS]({{< link-hextra path="/security/cors/" >}}) guide. 
* **BackendTLS**: You can now apply BackendTLSPolicy resources to your routes to originate a TLS connection to a backend. For an example, see the [BackendTLS]({{< link-hextra path="/security/backendtls/" >}}) guide. 

### Autoscaling policies for agentgateway controller

You can now configure Horizontal Pod Autoscaler or Vertical Pod Autoscaler policies for the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane. To set up these policies, you use the `horizontalPodAutoscaler` or `verticalPodAutoscaler` fields in the Helm chart.  

Review the following Helm configuration examples. For more information, see [Advanced install settings]({{< link-hextra path="/install/advanced/" >}}). 

**Vertical Pod Autoscaler**: 

The following configuration ensures that the control plan pod is always assigned a minimum of 0.1 CPU cores (100millicores) and 128Mi of memory. 

```yaml
verticalPodAutoscaler:
  updatePolicy:
    updateMode: Auto
  resourcePolicy:
    containerPolicies:
    - containerName: "*"
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

**Horizontal Pod Autoscaler**:

Make sure to deploy the Kubernetes `metrics-server` in your cluster. The `metrics-server` retrieves metrics, such as CPU and memory consumption for your workloads. These metrics can be used by the HPA plug-in to determine if the pod must be scaled up or down.

In the following example, you want to have 1 control plane replica running at any given time. If the CPU utilization averages 80%, you want to gradually scale up your replicas. You can have a maximum of 5 replicas at any given time. 
```yaml
horizontalPodAutoscaler:
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```

### Priority class support for agentgateway controller

You can now assign a PriorityClassName to the control plane pods by using the Helm chart. [Priority](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/) indicates the importance of a pod relative to other pods. If a pod cannot be scheduled, the scheduler tries to preempt (evict) lower priority pods to make scheduling of the pending pod possible. 

To assign a PriorityClassName to the control plane, you must first create a PriorityClass resource. The following example creates a PriorityClass with the name `system-cluster-critical` that assigns a priority of 1 Million. 

```yaml
kubectl apply -f- <<EOF
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: system-cluster-critical
value: 1000000
globalDefault: false
description: "Use this priority class on system-critical pods only."
EOF
```

In your Helm values file, add the name of the PriorityClass in the `controller.priorityClassName` field. 

```yaml
controller: 
  priorityClassName: 
```

<!-- 

### Use agw as a mesh egress

https://github.com/solo-io/gloo-gateway/pull/1454

### Multiple OAuth providers

https://github.com/solo-io/gloo-gateway/pull/1462



--> 

### Common labels

Add custom labels to all resources that are created by the {{< reuse "agw-docs/snippets/kgateway.md" >}} Helm charts, including the Deployment, Service, and ServiceAccount of gateway proxies. This allows you to better organize your resources or integrate with external tools. 

The following snippet adds the `label-key` and `agw-managed` labels to all resources. 

```yaml

commonLabels: 
  label-key: label-value
  agw-managed: "true"
```


### Static IP addresses for Gateways

You can now assign a static IP address to the Kubernetes service that exposes your Gateway as shown in the following example. 

```yaml
kind: Gateway
apiVersion: gateway.networking.k8s.io/v1
metadata:
  name: agentgateway-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
  addresses:
    - type: IPAddress
      value: 203.0.113.11
  listeners:
    - protocol: HTTP
      port: 80
      name: http
      allowedRoutes:
        namespaces:
          from: Same
```

### GRPCRoute support

You can now attach GRPCRoutes to your agentgateway proxy to route traffic to gRPC endpoints. For more information, see [gRPC routing]({{< link-hextra path="/traffic-management/grpc/" >}}). 

### PreRouting phase support for auth policies

You can now use the `phase: PreRouting` setting on JWT, basic auth, and API key authentication policies. This setting applies extauth policies before a routing decision is made. Note that the policy must target a Gateway rather than an HTTPRoute. 

The following API key auth example sets the prerouting phase:
```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: apikey-pre-routing
spec:
  targetRefs:
  - kind: Gateway
    name: my-gateway
    group: gateway.networking.k8s.io
  traffic:
    phase: PreRouting
    apiKeyAuthentication:
      secretRefs:
      - name: api-keys-secret
```

### LLM request transformations

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1041 -->

You can now use CEL expressions to dynamically compute and set fields in LLM requests. This allows you to enforce policies such as capping token usage without changing client code.

The following example caps `max_tokens` to 10 for all requests to the `openai` HTTPRoute:

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: cap-max-tokens
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: openai
  backend:
    ai:
      transformations:
      - field: max_tokens
        expression: "min(llmRequest.max_tokens, 10)"
```

For more information, see [Transform requests]({{< link-hextra path="/llm/transformations/" >}}).

### Extended thinking and structured outputs for Claude providers

Extended thinking and structured outputs are now supported for Anthropic and Amazon Bedrock Claude providers.

**Extended thinking** lets Claude reason through complex problems before generating a response. Thinking is opt-in and only activates when you explicitly request it. Use the `thinking.type: adaptive` field in the Anthropic Messages API, the `reasoning_effort` field in the OpenAI-compatible completions API, or the `reasoning.effort` field in the Bedrock Responses API. You can also override the thinking budget directly with `vendor_extensions.thinking_budget_tokens` for Bedrock.

**Structured outputs** constrain the model to respond with a specific JSON schema. Pass a `response_format` or `output_config.format` field with a `json_schema` type in your request. Agentgateway automatically translates these to the provider's native format.

For more information, see the following resources:
* [Anthropic extended thinking and structured outputs]({{< link-hextra path="/llm/providers/anthropic/" >}})
* [Bedrock extended thinking and structured outputs]({{< link-hextra path="/llm/providers/bedrock/" >}})

## 🪲 Bug fixes {#v10-bug-fixes}

### MCP per-request policy evaluation

MCP policies are now re-evaluated on each request rather than only at session start. If an operator updates an authorization policy, such as by revoking access to a tool or changing JWT claim requirements, the change takes effect immediately on the next request, without requiring the client to tear down and re-establish the MCP session.

Note that this is a behavioral improvement. Existing MCP authorization configuration benefits automatically. 

### CORS evaluation ordering

CORS evaluation now runs *before* authentication and *before* rate limiting. Previously, CORS ran after auth and rate limiting, which caused two problems:
  - Browser preflight OPTIONS requests were rejected by auth, making cross-origin requests impossible when auth was enabled
  - Rate-limited 429 responses lacked CORS headers, so browsers saw an opaque CORS error instead of a retryable 

Note that this is a behavioral improvement. Existing configurations that combine CORS policies with extauth and rate limiting policies now work correctly. 


## 🗑️ Deprecated or removed features {#v10-removed-features}


