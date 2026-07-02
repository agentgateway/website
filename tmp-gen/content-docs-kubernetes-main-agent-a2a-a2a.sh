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

# Source: content/docs/kubernetes/main/agent/a2a.md:99 paths=a2a
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: a2a-agent
  labels:
    app: a2a-agent
spec:
  selector:
    matchLabels:
      app: a2a-agent
  template:
    metadata:
      labels:
        app: a2a-agent
    spec:
      containers:
        - name: a2a-agent
          image: gcr.io/solo-public/docs/test-a2a-agent:latest
          ports:
            - containerPort: 9090
---
apiVersion: v1
kind: Service
metadata:
  name: a2a-agent
spec:
  selector:
    app: a2a-agent
  type: ClusterIP
  ports:
    - protocol: TCP
      port: 9090
      targetPort: 9090
EOF

# Source: content/docs/kubernetes/main/agent/a2a.md:139 paths=a2a
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: a2a-backend
spec:
  a2a:
    host: a2a-agent.default.svc.cluster.local
    port: 9090
EOF

# Source: content/docs/kubernetes/main/agent/a2a.md:154 paths=a2a
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: a2a
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: agentgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /myagent
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
    backendRefs:
      - name: a2a-backend
        group: agentgateway.dev
        kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/agent/a2a.md:256 paths=a2a
kubectl wait deployment/a2a-agent --for=condition=Available --timeout=120s

# Source: content/docs/kubernetes/main/agent/a2a.md:269 paths=a2a
export INGRESS_GW_ADDRESS=$(kubectl get gateway agentgateway-proxy -n agentgateway-system -o=jsonpath="{.status.addresses[0].value}")
echo $INGRESS_GW_ADDRESS

# Hidden source: content/docs/kubernetes/main/agent/a2a.md:281 paths=a2a
for i in $(seq 1 30); do
  STATUS=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" -X POST "http://${INGRESS_GW_ADDRESS}:80/myagent" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":"test","method":"tasks/send","params":{"id":"test","message":{"role":"user","parts":[{"type":"text","text":"ping"}]}}}')
  [ "$STATUS" = "200" ] && break
  sleep 2
done

# Source: content/docs/kubernetes/main/agent/a2a.md:295 paths=a2a
curl -X POST http://$INGRESS_GW_ADDRESS/myagent \
  -H "Content-Type: application/json" \
    -v \
    -d '{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tasks/send",
  "params": {
    "id": "1",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "hello gateway!"
        }
      ]
    }
  }
  }' | jq

# Source: content/docs/kubernetes/main/agent/a2a.md:369 paths=a2a
kubectl delete Deployment a2a-agent --ignore-not-found
kubectl delete Service a2a-agent --ignore-not-found
kubectl delete HTTPRoute a2a --ignore-not-found
kubectl delete AgentgatewayBackend a2a-backend --ignore-not-found
