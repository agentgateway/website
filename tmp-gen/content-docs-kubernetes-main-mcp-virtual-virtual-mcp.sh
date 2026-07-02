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

# Source: content/docs/kubernetes/main/mcp/virtual.md:33 paths=virtual-mcp
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server-everything
  labels:
    app: mcp-server-everything
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-server-everything
  template:
    metadata:
      labels:
        app: mcp-server-everything
    spec:
      containers:
        - name: mcp-server-everything
          image: node:20-alpine
          command: ["npx"]
          args: ["-y", "@modelcontextprotocol/server-everything", "streamableHttp"]
          ports:
            - containerPort: 3001
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-server-everything
  labels:
    app: mcp-server-everything
spec:
  selector:
    app: mcp-server-everything
  ports:
    - protocol: TCP
      port: 3001
      targetPort: 3001
      appProtocol: agentgateway.dev/mcp
  type: ClusterIP
EOF

# Source: content/docs/kubernetes/main/mcp/virtual.md:79 paths=virtual-mcp
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

# Hidden source: content/docs/kubernetes/main/mcp/virtual.md:115 paths=virtual-mcp
YAMLTest -f - <<'EOF'
- name: wait for mcp-server-everything deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: mcp-server-everything
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
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

# Source: content/docs/kubernetes/main/mcp/virtual.md:150 paths=virtual-mcp
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: mcp
spec:
  mcp:
    targets:
      - name: mcp-server-everything
        selector:
          services:
            matchLabels:
              app: mcp-server-everything
      - name: mcp-website-fetcher
        static:
          host: mcp-website-fetcher.default.svc.cluster.local
          port: 80
          protocol: SSE
EOF

# Source: content/docs/kubernetes/main/mcp/virtual.md:192 paths=virtual-mcp
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
    - backendRefs:
      - name: mcp
        group: agentgateway.dev
        kind: AgentgatewayBackend
      matches:
      - path:
          type: PathPrefix
          value: /mcp
EOF

# Hidden source: content/docs/kubernetes/main/mcp/virtual.md:214 paths=virtual-mcp
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

# Hidden source: content/docs/kubernetes/main/mcp/virtual.md:233 paths=virtual-mcp
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/mcp" && break
  sleep 2
done

# Hidden source: content/docs/kubernetes/main/mcp/virtual.md:240 paths=virtual-mcp
YAMLTest -f - <<'EOF'
- name: MCP endpoint accepts initialize request
  retries: 5
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /mcp
    method: POST
    headers:
      content-type: application/json
      accept: "application/json, text/event-stream"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
EOF

# Source: content/docs/kubernetes/main/mcp/virtual.md:367 paths=virtual-mcp
kubectl delete Deployment mcp-server-everything mcp-website-fetcher
kubectl delete Service mcp-server-everything mcp-website-fetcher
kubectl delete AgentgatewayBackend mcp
kubectl delete HTTPRoute mcp
