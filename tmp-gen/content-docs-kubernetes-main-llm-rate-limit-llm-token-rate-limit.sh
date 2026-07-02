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

# Source: content/docs/kubernetes/main/llm/rate-limit.md:84 paths=llm-token-rate-limit
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: llm-token-budget
  namespace: agentgateway-system
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbun-llm
  traffic:
    rateLimit:
      local:
      - tokens: 100
        unit: Minutes
EOF

# Hidden source: content/docs/kubernetes/main/llm/rate-limit.md:104 paths=llm-token-rate-limit
YAMLTest -f - <<'EOF'
- name: wait for llm-token-budget policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: llm-token-budget
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/llm/rate-limit.md:239 paths=llm-token-rate-limit
# Send requests to consume the 100 token budget
# httpbun returns ~32 tokens per request, so 4 requests = 128 tokens (exceeds 100 limit)
for i in $(seq 1 4); do
  curl -s http://${INGRESS_GW_ADDRESS}/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Test"}]}' > /dev/null
  sleep 0.1
done

# Verify the rate limit is now active (4 requests × ~32 tokens = ~128, exceeds 100 limit)
YAMLTest -f - <<'EOF'
- name: Verify token rate limit is enforced
  http:
    url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Test"}]
      }
  source:
    type: local
  retries: 5
  expect:
    statusCode: 429
EOF

# Source: content/docs/kubernetes/main/llm/rate-limit.md:343 paths=llm-token-rate-limit
kubectl delete AgentgatewayPolicy llm-token-budget -n agentgateway-system
