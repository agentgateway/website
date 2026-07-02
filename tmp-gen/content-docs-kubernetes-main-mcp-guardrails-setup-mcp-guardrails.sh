#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/main/quickstart/install.md:37 paths=experimental
kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/experimental-install.yaml

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

# Source: content/docs/kubernetes/main/mcp/guardrails/setup.md:31 paths=mcp-guardrails
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

# Source: content/docs/kubernetes/main/mcp/guardrails/setup.md:82 paths=mcp-guardrails
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ext-mcp-server
spec:
  selector:
    matchLabels:
      app: ext-mcp-server
  template:
    metadata:
      labels:
        app: ext-mcp-server
    spec:
      securityContext:
        sysctls:
        - name: net.ipv4.ip_unprivileged_port_start
          value: "0"
      containers:
      - name: ext-mcp-server
        image: gcr.io/solo-public/docs/testbox:latest
        readinessProbe:
          httpGet:
            path: /
            port: 80
          periodSeconds: 5
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: ext-mcp
  labels:
    app: ext-mcp
spec:
  selector:
    app: ext-mcp-server
  ports:
  - port: 4445
    targetPort: 9001
    protocol: TCP
    appProtocol: kubernetes.io/h2c
EOF

# Hidden source: content/docs/kubernetes/main/mcp/guardrails/setup.md:128 paths=mcp-guardrails
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
- name: wait for ext-mcp-server deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: ext-mcp-server
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/mcp/guardrails/setup.md:165 paths=mcp-guardrails
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

# Source: content/docs/kubernetes/main/mcp/guardrails/setup.md:186 paths=mcp-guardrails
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

# Source: content/docs/kubernetes/main/mcp/guardrails/setup.md:212 paths=mcp-guardrails
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: mcp-guardrails
spec:
  targetRefs:
    - group: agentgateway.dev
      kind: AgentgatewayBackend
      name: mcp-backend
  backend:
    mcp:
      guardrails:
        processors:
        - remote:
            backendRef:
              name: ext-mcp
              port: 4445
            failureMode: FailClosed
          methods:
            tools/call: Request
            tools/list: Response
EOF

# Hidden source: content/docs/kubernetes/main/mcp/guardrails/setup.md:246 paths=mcp-guardrails
YAMLTest -f - <<'EOF'
- name: wait for mcp-guardrails policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-guardrails
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/mcp/guardrails/setup.md:359 paths=mcp-guardrails
YAMLTest -f - <<'EOF'
- name: MCP endpoint accepts initialize request
  retries: 10
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /mcp
    method: POST
    headers:
      content-type: application/json
      accept: "application/json, text/event-stream"
      mcp-protocol-version: "2025-03-26"
    body: |
      {"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
  source:
    type: local
  expect:
    statusCode: 200
EOF

# Hidden source: content/docs/kubernetes/main/mcp/guardrails/setup.md:380 paths=mcp-guardrails
# Assert the guardrails behaviors end-to-end: response-phase mutation,
# request-phase deny, and request-phase allow.
MCP_ADDR="http://${INGRESS_GW_ADDRESS}:80/mcp"
HDRS=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "MCP-Protocol-Version: 2025-03-26")

# Retry until the route is programmed and the policy-server connection is warm.
LIST=""
for attempt in $(seq 1 20); do
  SID=$(curl -s --max-time 10 -D - "${HDRS[@]}" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
    | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r')
  if [ -z "$SID" ]; then sleep 5; continue; fi
  curl -s --max-time 10 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true
  LIST=$(curl -s --max-time 15 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
  echo "$LIST" | grep -q '\[extmcp\]' && break
  sleep 5
done

# Response phase: the policy server appended " [extmcp]" to tool descriptions.
echo "$LIST" | grep -q '\[extmcp\]' || { echo "FAIL: tools/list was not mutated: $LIST"; exit 1; }

# Request phase: a tool whose name contains "forbidden" is denied.
DENY=$(curl -s --max-time 10 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"forbidden-tool","arguments":{}}}')
echo "$DENY" | grep -q 'is not allowed' || { echo "FAIL: forbidden tool was not denied: $DENY"; exit 1; }

# Request phase: the allowed "fetch" tool passes through and returns a result.
ALLOW=$(curl -s --max-time 15 "${HDRS[@]}" -H "mcp-session-id: $SID" "$MCP_ADDR" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"fetch","arguments":{"url":"https://example.com"}}}')
echo "$ALLOW" | grep -q '"result"' || { echo "FAIL: allowed tool did not return a result: $ALLOW"; exit 1; }

echo "PASS: MCP guardrails mutate, deny, and allow behaviors verified"
