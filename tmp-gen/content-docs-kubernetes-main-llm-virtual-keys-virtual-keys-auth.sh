#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/main/quickstart/install.md:31 paths=standard
kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/standard-install.yaml

# Source: content/docs/kubernetes/main/quickstart/install.md:45 paths=standard,experimental
helm upgrade -i agentgateway-crds oci://cr.agentgateway.dev/charts/agentgateway-crds \
--create-namespace --namespace agentgateway-system \
--version 0.0.0-latest-dev \
--set controller.image.pullPolicy=Always

# Source: content/docs/kubernetes/main/quickstart/install.md:54 paths=standard,experimental
helm upgrade -i agentgateway oci://cr.agentgateway.dev/charts/agentgateway \
  --namespace agentgateway-system \
  --version 0.0.0-latest-dev \
  --set controller.image.pullPolicy=Always \
  --set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true \
  --wait

# Source: content/docs/kubernetes/main/quickstart/install.md:81 paths=all
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

# Hidden source: content/docs/kubernetes/main/quickstart/install.md:145 paths=all
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

# Source: content/docs/kubernetes/main/llm/virtual-keys.md:94 paths=virtual-keys
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: llm-api-keys
  namespace: agentgateway-system
type: Opaque
stringData:
  alice: |
    {
      "key": "sk-alice-abc123def456",
      "metadata": {
        "user_id": "alice"
      }
    }
  bob: |
    {
      "key": "sk-bob-xyz789uvw012",
      "metadata": {
        "user_id": "bob"
      }
    }
EOF

# Source: content/docs/kubernetes/main/llm/virtual-keys.md:136 paths=virtual-keys
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: api-key-auth
  namespace: agentgateway-system
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    apiKeyAuthentication:
      mode: Strict
      secretRef:
        name: llm-api-keys
EOF

# Source: content/docs/kubernetes/main/llm/virtual-keys.md:295 paths=virtual-keys
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: gpt-3.5-turbo
  policies:
    auth:
      secretRef:
        name: openai-secret
EOF

# Source: content/docs/kubernetes/main/llm/virtual-keys.md:320 paths=virtual-keys
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /openai
      backendRefs:
        - name: openai
          namespace: agentgateway-system
          group: agentgateway.dev
          kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/llm/virtual-keys.md:421 paths=virtual-keys-httpbun-test
# Test virtual key authentication and routing against the httpbun route
YAMLTest -f - <<'EOF'
- name: wait for HTTPRoute to be accepted
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
      timeoutSeconds: 60
      intervalSeconds: 2

- name: verify request with Alice's virtual key succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-alice-abc123def456"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}],
        "httpbun": {"content": "Hello from httpbun"}
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request with Bob's virtual key succeeds independently
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-bob-xyz789uvw012"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}],
        "httpbun": {"content": "Hello from httpbun"}
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request without valid API key is rejected
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer invalid-key"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 401
EOF
