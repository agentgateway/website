#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/main/install/helm.md:32 paths=standard
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/standard-install.yaml

# Source: content/docs/kubernetes/main/install/helm.md:61 paths=standard,experimental
helm upgrade -i --create-namespace \
  --namespace agentgateway-system \
  --version 0.0.0-latest-dev agentgateway-crds oci://cr.agentgateway.dev/charts/agentgateway-crds

# Source: content/docs/kubernetes/main/install/helm.md:87 paths=standard
helm upgrade -i -n agentgateway-system agentgateway oci://cr.agentgateway.dev/charts/agentgateway \
--version 0.0.0-latest-dev

# Hidden source: content/docs/kubernetes/main/install/helm.md:160 paths=standard,experimental
YAMLTest -f - <<'EOF'
- name: wait for agentgateway deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: verify agentgateway GatewayClass exists
  wait:
    target:
      kind: GatewayClass
      metadata:
        name: agentgateway
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/setup/gateway.md:22 paths=all
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: agentgateway-system
spec:
  gatewayClassName: agentgateway
  listeners:
  - protocol: HTTP
    port: 80
    name: http
    allowedRoutes:
      namespaces:
        from: All
EOF

# Hidden source: content/docs/kubernetes/main/setup/gateway.md:86 paths=all
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
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
  setVars:
    INGRESS_GW_ADDRESS:
      value: true
EOF

export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

# Hidden source: content/docs/kubernetes/main/setup/gateway.md:124 paths=all
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
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/llm/providers/httpbun.md:53 paths=setup-httpbun-llm
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbun
  namespace: default
  labels:
    app: httpbun
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbun
  template:
    metadata:
      labels:
        app: httpbun
    spec:
      containers:
        - name: httpbun
          image: sharat87/httpbun
          env:
            - name: HTTPBUN_BIND
              value: "0.0.0.0:3090"
          ports:
            - containerPort: 3090
---
apiVersion: v1
kind: Service
metadata:
  name: httpbun
  namespace: default
  labels:
    app: httpbun
spec:
  selector:
    app: httpbun
  ports:
    - protocol: TCP
      port: 3090
      targetPort: 3090
  type: ClusterIP
EOF

# Hidden source: content/docs/kubernetes/main/llm/providers/httpbun.md:99 paths=setup-httpbun-llm
YAMLTest -f - <<'EOF'
- name: wait for httpbun deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: httpbun
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/llm/providers/httpbun.md:139 paths=setup-httpbun-llm
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: httpbun-llm
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: gpt-4
      host: httpbun.default.svc.cluster.local
      port: 3090
      path: "/llm/chat/completions"
EOF

# Source: content/docs/kubernetes/main/llm/providers/httpbun.md:171 paths=setup-httpbun-llm
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: httpbun-llm
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /v1/chat/completions
      backendRefs:
        - name: httpbun-llm
          namespace: agentgateway-system
          group: agentgateway.dev
          kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/llm/providers/httpbun.md:195 paths=setup-httpbun-llm
YAMLTest -f - <<'EOF'
- name: wait for httpbun-llm HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: httpbun-llm
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
- name: wait for httpbun-llm HTTPRoute refs to be resolved
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: httpbun-llm
    jsonPath: "$.status.parents[0].conditions[?(@.type=='ResolvedRefs')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/llm/providers/httpbun.md:236 paths=setup-httpbun-llm
# Get the gateway address
export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

# Test httpbun LLM endpoint
YAMLTest -f - <<'EOF'
- name: Verify httpbun LLM responds with mock completion
  http:
    url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello!"}],
        "httpbun": {"content": "Test response"}
      }
  source:
    type: local
  expect:
    statusCode: 200
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:68 paths=failover
# Create an AgentgatewayBackend with 2 priority groups using httpbun as mock LLM.
# Group 1 (highest priority): httpbun /status/500 — always returns 500 to trigger eviction.
# Group 2 (fallback): httpbun /llm/chat/completions — returns normal 200 responses.
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: model-failover
  namespace: agentgateway-system
spec:
  ai:
    groups:
      - providers:
          - name: primary-llm
            openai:
              model: gpt-4
            host: httpbun.default.svc.cluster.local
            port: 3090
            path: "/status/500"
      - providers:
          - name: fallback-llm
            openai:
              model: gpt-4
            host: httpbun.default.svc.cluster.local
            port: 3090
            path: "/llm/chat/completions"
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:98 paths=failover
YAMLTest -f - <<'EOF'
- name: wait for model-failover backend to be accepted
  wait:
    target:
      kind: AgentgatewayBackend
      metadata:
        namespace: agentgateway-system
        name: model-failover
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:117 paths=failover
# Create the HTTPRoute for the failover backend.
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: model-failover
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /model
    backendRefs:
    - name: model-failover
      namespace: agentgateway-system
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:142 paths=failover
YAMLTest -f - <<'EOF'
- name: wait for model-failover HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: model-failover
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
- name: wait for model-failover HTTPRoute refs to be resolved
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: model-failover
    jsonPath: "$.status.parents[0].conditions[?(@.type=='ResolvedRefs')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:175 paths=failover
# Create the AgentgatewayPolicy with health/eviction settings.
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: model-failover-health
  namespace: agentgateway-system
spec:
  targetRefs:
  - group: agentgateway.dev
    kind: AgentgatewayBackend
    name: model-failover
  backend:
    health:
      unhealthyCondition: "response.code >= 500 || response.code == 429"
      eviction:
        duration: 10s
        consecutiveFailures: 1
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:197 paths=failover
YAMLTest -f - <<'EOF'
- name: wait for model-failover-health policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: model-failover-health
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:216 paths=failover
# Get the gateway address.
export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

# First request hits the primary group (/status/500) — triggers eviction.
# The client receives a 500 for this request.
curl -s -o /dev/null -w "%{http_code}" "http://${INGRESS_GW_ADDRESS}/model" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'

# Brief pause for eviction to take effect.
sleep 2

# Second request: primary is evicted, so it routes to the fallback group (/llm/chat/completions) — should return 200.
YAMLTest -f - <<'EOF'
- name: verify failover to fallback group returns 200
  http:
    url: "http://${INGRESS_GW_ADDRESS}/model"
    method: POST
    headers:
      Content-Type: application/json
    body: |
      {
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  retries: 3
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.total_tokens"
        comparator: greaterThan
        value: 0
EOF

# Hidden source: content/docs/kubernetes/main/llm/failover.md:253 paths=failover
# Cleanup test resources
kubectl delete AgentgatewayBackend model-failover -n agentgateway-system --ignore-not-found
kubectl delete AgentgatewayPolicy model-failover-health -n agentgateway-system --ignore-not-found
kubectl delete httproute model-failover -n agentgateway-system --ignore-not-found
