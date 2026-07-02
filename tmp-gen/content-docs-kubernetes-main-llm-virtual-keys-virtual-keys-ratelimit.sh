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

# Source: content/docs/kubernetes/main/security/rate-limit-global.md:188 paths=global-rate-limit-by-ip,deploy-rate-limit-server
kubectl create namespace ratelimit

# Source: content/docs/kubernetes/main/security/rate-limit-global.md:194 paths=global-rate-limit-by-ip,deploy-rate-limit-server
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: ratelimit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: ratelimit
spec:
  selector:
    app: redis
  ports:
    - port: 6379
EOF

# Source: content/docs/kubernetes/main/security/rate-limit-global.md:232 paths=global-rate-limit-by-ip,deploy-rate-limit-server
kubectl apply -f- <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: ratelimit-config
  namespace: ratelimit
data:
  config.yaml: |
    domain: agentgateway
    descriptors:
      # Rate limit by client IP: 10 requests per minute
      - key: remote_address
        rate_limit:
          unit: minute
          requests_per_unit: 10

      # Per-user LLM token budget (see the virtual keys guide).
      # Deliberately small so you can exhaust it in a few requests; raise for production.
      - key: user_id
        rate_limit:
          unit: day
          requests_per_unit: 100

      # Rate limit by path
      - key: path
        value: "/api/v1"
        rate_limit:
          unit: minute
          requests_per_unit: 100
      - key: path
        value: "/api/v2"
        rate_limit:
          unit: minute
          requests_per_unit: 200

      # Rate limit by user ID header
      - key: x-user-id
        rate_limit:
          unit: minute
          requests_per_unit: 50

      # Rate limit by user ID with specific value (VIP user)
      - key: x-user-id
        value: vip-user-123
        rate_limit:
          unit: minute
          requests_per_unit: 500

      # Generic service tier rate limit
      - key: service
        value: premium
        rate_limit:
          unit: minute
          requests_per_unit: 1000
      - key: service
        value: standard
        rate_limit:
          unit: minute
          requests_per_unit: 100
EOF

# Source: content/docs/kubernetes/main/security/rate-limit-global.md:309 paths=global-rate-limit-by-ip,deploy-rate-limit-server
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ratelimit
  namespace: ratelimit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ratelimit
  template:
    metadata:
      labels:
        app: ratelimit
    spec:
      containers:
        - name: ratelimit
          image: envoyproxy/ratelimit:master
          command: ["/bin/ratelimit"]
          env:
            - name: REDIS_SOCKET_TYPE
              value: tcp
            - name: REDIS_URL
              value: redis:6379
            - name: RUNTIME_ROOT
              value: /data
            - name: RUNTIME_SUBDIRECTORY
              value: ratelimit
            - name: RUNTIME_WATCH_ROOT
              value: "false"
            - name: USE_STATSD
              value: "false"
          ports:
            - containerPort: 8081
              name: grpc
          volumeMounts:
            - name: config
              mountPath: /data/ratelimit/config/config.yaml
              subPath: config.yaml
      volumes:
        - name: config
          configMap:
            name: ratelimit-config
---
apiVersion: v1
kind: Service
metadata:
  name: ratelimit
  namespace: ratelimit
spec:
  selector:
    app: ratelimit
  ports:
    - name: grpc
      port: 8081
      targetPort: 8081
EOF

# Hidden source: content/docs/kubernetes/main/security/rate-limit-global.md:370 paths=global-rate-limit-by-ip,deploy-rate-limit-server
YAMLTest -f - <<'EOF'
- name: wait for redis deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: ratelimit
        name: redis
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for ratelimit deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: ratelimit
        name: ratelimit
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
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

# Source: content/docs/kubernetes/main/llm/virtual-keys.md:207 paths=virtual-keys-with-ratelimit
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
    rateLimit:
      global:
        domain: agentgateway
        backendRef:
          kind: Service
          name: ratelimit
          namespace: ratelimit
          port: 8081
        descriptors:
          - entries:
              - name: user_id
                expression: 'apiKey.user_id'
            unit: Tokens
EOF

# Hidden source: content/docs/kubernetes/main/llm/virtual-keys.md:244 paths=virtual-keys-with-ratelimit
YAMLTest -f - <<'EOF'
- name: wait for api-key-auth policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: api-key-auth
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
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

# Hidden source: content/docs/kubernetes/main/llm/virtual-keys.md:494 paths=virtual-keys-ratelimit-test
# Drain Alice's 100-token daily budget. httpbun returns ~20-30 tokens per response,
# so a handful of requests pushes Alice over the budget.
for i in $(seq 1 10); do
  curl -s -o /dev/null \
    "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk-alice-abc123def456" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"Say hello"}]}'
  sleep 0.3
done

YAMLTest -f - <<'EOF'
- name: Alice is rejected with 429 after exhausting her token budget
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer sk-alice-abc123def456"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  retries: 3
  expect:
    statusCode: 429
- name: Bob still succeeds because he has an independent budget
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer sk-bob-xyz789uvw012"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
EOF
