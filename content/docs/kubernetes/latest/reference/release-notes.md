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

This release includes a major refactor to the CEL implementation in agentgateway that brings substantial performance improvements and enhanced functionality. Individual CEL expressions are now 5-500x faster, which has improved end-to-end proxy performance by 50%+ in some tests. For more details on the performance improvements, see this [blog post on CEL optimization](https://blog.howardjohn.info/posts/cel-fast/).

The following user-facing changes were introduced:

* **Function name changes**: For compatibility with the CEL-Go implementation, the `base64Encode` and `base64Decode` functions now use dot notation: `base64.encode` and `base64.decode`. The old camel case names remain in place for backwards compatibility.
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

The Kubernetes Gateway API dependency is updated to support version 1.5.0. Gateway API 1.5 also comes with a number of new conformance tests; Agentgateway continues to be on the frontier of Gateway API support and passes all tests (standard, extended, and experimental).

This version introduces several changes, including:
* **XListenerSets promoted to ListenerSets**: The experimental XListenerSet API is promoted to the standard ListenerSet API in version 1.5.0. You must install the standard channel of the Kubernetes Gateway API to get the ListenerSet API definition. If you use XListenerSet resources in your setup today, update these resources to use the ListenerSet API instead.
* **TLSRoute promotion**: TLSRoute has been promoted from experimental to standard. If you are on the standard channel, you need to use `v1` instead of `v1alpha2`. The experimental channel can continue to use `v1alpha2`.
* **AllowInsecureFallback mode for mTLS listeners**: If you set up mTLS listeners on your agentgateway proxy, you can now configure the proxy to establish a TLS connection, even if the client TLS certificate could not be validated successfully. For more information, see the [mTLS listener docs]({{< link-hextra path="/setup/listeners/mtls/" >}}).
* **CORS wildcard support**: The `allowOrigins` field now supports wildcard `*` origins to allow any origin. For an example, see the [CORS]({{< link-hextra path="/security/cors/" >}}) guide. 

### Autoscaling policies for agentgateway controller

You can now configure Horizontal Pod Autoscaler policies for the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane. To set up these policies, you use the `horizontalPodAutoscaler` field in the Helm chart.

Review the following Helm configuration example. For more information, see [Advanced install settings]({{< link-hextra path="/install/advanced/" >}}).

<!-- TODO VPA
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
-->

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

<!--

### Use agw as a mesh egress

https://github.com/solo-io/gloo-gateway/pull/1454

### Multiple OAuth providers

https://github.com/solo-io/gloo-gateway/pull/1462



-->

### GRPCRoute support

You can now attach GRPCRoutes to your agentgateway proxy to route traffic to gRPC endpoints. For more information, see [gRPC routing]({{< link-hextra path="/traffic-management/grpc/" >}}). 

### PreRouting phase support for auth policies

You can now use the `phase: PreRouting` setting on JWT, basic auth, API key authentication, and transformation policies. This setting applies policies before a routing decision is made, which allows the policies to influence how requests are routed. Note that the policy must target a Gateway rather than an HTTPRoute.

A key use case is body-based routing for LLM requests. The following example extracts the `model` field from a JSON request body and sets it as a header, which can then be used for routing decisions:

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: body-based-routing
spec:
  targetRefs:
  - kind: Gateway
    name: my-gateway
    group: gateway.networking.k8s.io
  traffic:
    phase: PreRouting
    transformation:
      request:
        set:
        - name: X-Gateway-Model-Name
          value: 'json(request.body).model'
```

This allows you to route requests to different backends based on the model name specified in the request body. For example, you could route GPT-4 requests to one backend and Claude requests to another:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: route-by-model
spec:
  parentRefs:
  - name: my-gateway
  rules:
  - matches:
    - headers:
      - name: X-Gateway-Model-Name
        value: gpt-4
    backendRefs:
    - name: openai-backend
  - matches:
    - headers:
      - name: X-Gateway-Model-Name
        value: claude-3
    backendRefs:
    - name: anthropic-backend
```

For more details on this pattern, see the [body-based routing blog post](https://blog.howardjohn.info/posts/bbr-agentgateway/).

### LLM request transformations

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1041 -->

You can now use CEL expressions to dynamically compute and set fields in LLM requests. This allows you to enforce policies, such as capping token usage, without changing client code.

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

**Extended thinking** lets Claude reason through complex problems before generating a response. Thinking is opt-in. You must provide specific attributes in your request to enable extended thinking. 

**Structured outputs** constrain the model to respond with a specific JSON schema. You define the JSON schema as part of your request. 

For more information, see the following resources:
* [Anthropic extended thinking and structured outputs]({{< link-hextra path="/llm/providers/anthropic/" >}})
* [Bedrock extended thinking and structured outputs]({{< link-hextra path="/llm/providers/bedrock/" >}})

### Additional features

Several additional capabilities are now available for the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane and Gateway resources:

* **Priority class support**: Assign a PriorityClassName to control plane pods using the `controller.priorityClassName` Helm field. [Priority](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/) indicates the importance of a pod relative to other pods and allows higher priority pods to preempt lower priority ones when scheduling.
* **Common labels**: Add custom labels to all resources created by the Helm charts using the `commonLabels` field, including the Deployment, Service, and ServiceAccount of gateway proxies. This allows you to better organize your resources or integrate with external tools.
* **Static IP addresses for Gateways**: Assign a static IP address to the Kubernetes service that exposes your Gateway using the `spec.addresses` field with `type: IPAddress`.

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


