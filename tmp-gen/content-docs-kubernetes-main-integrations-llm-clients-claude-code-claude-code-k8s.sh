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

# Source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:65 paths=claude-code-k8s
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:71 paths=claude-code-k8s
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: anthropic-secret
  namespace: agentgateway-system
type: Opaque
stringData:
  Authorization: $ANTHROPIC_API_KEY
EOF

# Source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:91 paths=claude-code-k8s
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: anthropic
  namespace: agentgateway-system
spec:
  ai:
    provider:
      anthropic: {}
  policies:
    ai:
      routes:
        '/v1/messages': Messages
        '*': Passthrough
    auth:
      secretRef:
        name: anthropic-secret
EOF

# Hidden source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:143 paths=claude-code-k8s
YAMLTest -f - <<'EOF'
- name: wait for anthropic backend to be accepted
  wait:
    target:
      kind: AgentgatewayBackend
      metadata:
        namespace: agentgateway-system
        name: anthropic
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:164 paths=claude-code-k8s
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: claude
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /
      backendRefs:
      - name: anthropic
        namespace: agentgateway-system
        group: agentgateway.dev
        kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:188 paths=claude-code-k8s
YAMLTest -f - <<'EOF'
- name: wait for claude HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: claude
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF

# Hidden source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:207 paths=claude-code-k8s
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null -w "%{http_code}" -X POST "http://${INGRESS_GW_ADDRESS}:80/v1/messages" -H "Content-Type: application/json" -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' && break
  sleep 2
done

# Hidden source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:214 paths=claude-code-k8s
YAMLTest -f - <<'EOF'
- name: verify Anthropic messages endpoint is routed through gateway
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /v1/messages
    method: POST
    headers:
      Content-Type: application/json
    body: '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
  source:
    type: local
  expect:
    statusCode: 401
EOF

# Hidden source: content/docs/kubernetes/main/integrations/llm-clients/claude-code.md:281 paths=claude-code-k8s
kubectl delete agentgatewaybackend anthropic -n agentgateway-system --ignore-not-found
kubectl delete httproute claude -n agentgateway-system --ignore-not-found
kubectl delete secret anthropic-secret -n agentgateway-system --ignore-not-found
