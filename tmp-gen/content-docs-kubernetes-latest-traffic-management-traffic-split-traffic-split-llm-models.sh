#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/latest/quickstart/install.md:31 paths=standard
kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/standard-install.yaml

# Source: content/docs/kubernetes/latest/quickstart/install.md:45 paths=standard,experimental
helm upgrade -i agentgateway-crds oci://cr.agentgateway.dev/charts/agentgateway-crds \
--create-namespace --namespace agentgateway-system \
--version v1.3.1 \
--set controller.image.pullPolicy=Always

# Source: content/docs/kubernetes/latest/quickstart/install.md:54 paths=standard,experimental
helm upgrade -i agentgateway oci://cr.agentgateway.dev/charts/agentgateway \
  --namespace agentgateway-system \
  --version v1.3.1 \
  --set controller.image.pullPolicy=Always \
  --set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true \
  --wait

# Source: content/docs/kubernetes/latest/quickstart/install.md:81 paths=all
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

# Hidden source: content/docs/kubernetes/latest/quickstart/install.md:145 paths=all
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

# Hidden source: content/docs/kubernetes/latest/setup/gateway.md:124 paths=all
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

# Source: content/docs/kubernetes/latest/llm/providers/openai.md:42 paths=openai-setup
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: openai-secret
  namespace: agentgateway-system
type: Opaque
stringData:
  Authorization: $OPENAI_API_KEY
EOF

# Source: content/docs/kubernetes/latest/llm/providers/openai.md:59 paths=openai-setup
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
        # Optional: specify a default  model
        model: gpt-3.5-turbo
     # Optional: custom host and port, if needed
     # host: api.openai.com  
     # port: 443
  policies:
    auth:
      secretRef:
        name: openai-secret
EOF

# Source: content/docs/kubernetes/latest/llm/providers/openai.md:117 paths=openai-setup
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

# Hidden source: content/docs/kubernetes/latest/llm/providers/openai.md:143 paths=openai-setup
YAMLTest -f - <<'EOF'
- name: wait for openai backend to be ready
  wait:
    target:
      kind: AgentgatewayBackend
      metadata:
        namespace: agentgateway-system
        name: openai
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/latest/llm/providers/openai.md:239 paths=openai-setup
YAMLTest -f - <<'EOF'
- name: send request to OpenAI and verify response with token usage
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/openai"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [
          {
            "role": "user",
            "content": "Say hello in one word"
          }
        ]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.total_tokens"
        comparator: greaterThan
        value: 0
      - path: "$.usage.prompt_tokens"
        comparator: greaterThan
        value: 0
      - path: "$.usage.completion_tokens"
        comparator: greaterThan
        value: 0
EOF

# Source: content/docs/kubernetes/latest/traffic-management/traffic-split.md:177 paths=traffic-split-llm
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai-mini-backend
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: gpt-4o-mini
  policies:
    auth:
      secretRef:
        name: openai-secret
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai-premium-backend
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: gpt-4o
  policies:
    auth:
      secretRef:
        name: openai-secret
EOF

# Source: content/docs/kubernetes/latest/traffic-management/traffic-split.md:215 paths=traffic-split-llm
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: test
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /test
      backendRefs:
        - name: openai-mini-backend
          namespace: agentgateway-system
          group: agentgateway.dev
          kind: AgentgatewayBackend
          weight: 80
        - name: openai-premium-backend
          namespace: agentgateway-system
          group: agentgateway.dev
          kind: AgentgatewayBackend
          weight: 20
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/traffic-split.md:288 paths=traffic-split-llm
# Test that traffic is being split between models
# Send multiple requests and verify we get valid responses with model names
YAMLTest -f - <<'EOF'
- name: verify traffic split returns valid responses
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/test"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.model"
        comparator: exists
      - path: "$.choices[0].message.content"
        comparator: exists
EOF
