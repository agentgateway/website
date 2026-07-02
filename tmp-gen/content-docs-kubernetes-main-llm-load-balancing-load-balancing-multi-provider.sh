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

# Hidden source: content/docs/kubernetes/main/llm/load-balancing.md:62 paths=load-balancing
export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: openai-secret
  namespace: agentgateway-system
type: Opaque
stringData:
  Authorization: $OPENAI_API_KEY
---
apiVersion: v1
kind: Secret
metadata:
  name: anthropic-secret
  namespace: agentgateway-system
type: Opaque
stringData:
  Authorization: ${ANTHROPIC_API_KEY:-$OPENAI_API_KEY}
EOF

# Source: content/docs/kubernetes/main/llm/load-balancing.md:91 paths=load-balancing
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: loadbalanced-backend
  namespace: agentgateway-system
spec:
  ai:
    groups:
      - providers:
          - name: openai-gpt4
            openai:
              model: gpt-4o
            policies:
              auth:
                secretRef:
                  name: openai-secret
          - name: anthropic-claude
            anthropic:
              model: claude-3-5-sonnet-latest
            policies:
              auth:
                secretRef:
                  name: anthropic-secret
EOF

# Hidden source: content/docs/kubernetes/main/llm/load-balancing.md:119 paths=load-balancing
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: loadbalanced-backend
  namespace: agentgateway-system
spec:
  ai:
    groups:
      - providers:
          - name: openai-gpt4
            openai:
              model: gpt-4o
            policies:
              auth:
                secretRef:
                  name: openai-secret
          - name: openai-gpt35
            openai:
              model: gpt-3.5-turbo
            policies:
              auth:
                secretRef:
                  name: openai-secret
EOF

# Source: content/docs/kubernetes/main/llm/load-balancing.md:149 paths=load-balancing
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: loadbalanced-route
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /chat
      backendRefs:
        - name: loadbalanced-backend
          namespace: agentgateway-system
          group: agentgateway.dev
          kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/llm/load-balancing.md:173 paths=load-balancing
YAMLTest -f - <<'EOF'
- name: wait for loadbalanced-backend to be accepted
  wait:
    target:
      kind: AgentgatewayBackend
      metadata:
        namespace: agentgateway-system
        name: loadbalanced-backend
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2

- name: wait for loadbalanced-route HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: loadbalanced-route
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/llm/load-balancing.md:232 paths=load-balancing
YAMLTest -f - <<'EOF'
- name: verify load balanced request succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/chat"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "messages": [{"role": "user", "content": "Say hello in one word"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.total_tokens"
        comparator: greaterThan
        value: 0

- name: verify second load balanced request succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/chat"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "messages": [{"role": "user", "content": "Say hello in one word"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.total_tokens"
        comparator: greaterThan
        value: 0
EOF
