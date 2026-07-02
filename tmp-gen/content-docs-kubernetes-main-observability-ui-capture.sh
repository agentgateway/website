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

# Source: content/docs/kubernetes/main/quickstart/mcp.md:31 paths=setup-mcp-server
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-website-fetcher
spec:
  selector:
    matchLabels:
      app: mcp-website-fetcher
  template:
    metadata:
      labels:
        app: mcp-website-fetcher
    spec:
      containers:
      - name: mcp-website-fetcher
        image: ghcr.io/peterj/mcp-website-fetcher:main
        imagePullPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-website-fetcher
  labels:
    app: mcp-website-fetcher
spec:
  selector:
    app: mcp-website-fetcher
  ports:
  - port: 80
    targetPort: 8000
    appProtocol: agentgateway.dev/mcp
EOF

# Hidden source: content/docs/kubernetes/main/quickstart/mcp.md:67 paths=setup-mcp-server
YAMLTest -f - <<'EOF'
- name: wait for mcp-website-fetcher deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: mcp-website-fetcher
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/quickstart/mcp.md:92 paths=setup-mcp-server
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: mcp-backend
spec:
  mcp:
    targets:
    - name: mcp-target
      static:
        host: mcp-website-fetcher.default.svc.cluster.local
        port: 80
        protocol: SSE   
EOF

# Source: content/docs/kubernetes/main/quickstart/mcp.md:134 paths=setup-mcp-server
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /mcp
      backendRefs:
      - name: mcp-backend
        group: agentgateway.dev
        kind: AgentgatewayBackend  
EOF

# Hidden source: content/docs/kubernetes/main/quickstart/mcp.md:156 paths=setup-mcp-server
YAMLTest -f - <<'EOF'
- name: wait for mcp HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: default
        name: mcp
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Source: content/docs/kubernetes/main/quickstart/non-agentic-http.md:42 paths=install-httpbin
kubectl apply -f https://raw.githubusercontent.com/kgateway-dev/kgateway/refs/heads/main/examples/httpbin.yaml

# Hidden source: content/docs/kubernetes/main/quickstart/non-agentic-http.md:46 paths=install-httpbin
YAMLTest -f - <<'EOF'
- name: wait for httpbin deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: httpbin
        name: httpbin
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 400
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/quickstart/non-agentic-http.md:75 paths=install-httpbin
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: httpbin
  namespace: httpbin
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  hostnames:
    - "www.example.com"
  rules:
    - backendRefs:
        - name: httpbin
          port: 8000
EOF

# Hidden source: content/docs/kubernetes/main/quickstart/non-agentic-http.md:95 paths=install-httpbin
YAMLTest -f - <<'EOF'
- name: wait for httpbin HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
- name: wait for httpbin HTTPRoute refs to be resolved
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin
    jsonPath: "$.status.parents[0].conditions[?(@.type=='ResolvedRefs')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

# Hidden source: content/docs/kubernetes/main/quickstart/non-agentic-http.md:128 paths=install-httpbin
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" && break
  sleep 2
done

# Hidden source: content/docs/kubernetes/main/quickstart/non-agentic-http.md:135 paths=install-httpbin
YAMLTest -f - <<'EOF'
- name: verify httpbin returns 200 for www.example.com
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/headers"
    method: GET
    headers:
      host: "www.example.com"
  source:
    type: local
  expect:
    statusCode: 200
EOF

# Source: content/docs/kubernetes/main/quickstart/non-agentic-http.md:159 paths=install-httpbin
export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
echo $INGRESS_GW_ADDRESS

# Hidden source: content/docs/kubernetes/main/observability/ui.md:83 paths=ui-k8s-capture
# Screenshot-capture fixture (not rendered on the page). Adds an LLM backend + route and a
# CORS policy on top of the MCP and httpbin routes so the read-only Listeners, Routes, and
# Policies views render content. A placeholder LLM key keeps capture free of external calls.
kubectl create secret generic openai-secret -n agentgateway-system \
  --from-literal=Authorization=sk-doc-capture-placeholder --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f- <<'EOF'
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
---
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
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: mcp-cors
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: mcp
  traffic:
    cors:
      allowOrigins:
      - https://example.com
      allowMethods:
      - GET
      - POST
      - OPTIONS
      allowHeaders:
      - Authorization
      - Content-Type
      maxAge: 3600
EOF

YAMLTest -f - <<'EOF'
- name: wait for openai backend to be accepted
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
