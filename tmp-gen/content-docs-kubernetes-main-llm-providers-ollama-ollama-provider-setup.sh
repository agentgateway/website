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

# Source: content/docs/kubernetes/main/llm/providers/ollama.md:116 paths=ollama-provider-setup
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: ollama
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: llama3.2
      host: ollama.agentgateway-system.svc.cluster.local
      port: 11434
      path: /v1/chat/completions
EOF

# Source: content/docs/kubernetes/main/llm/providers/ollama.md:146 paths=ollama-provider-setup
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ollama
  namespace: agentgateway-system
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: agentgateway-system
  rules:
  - backendRefs:
    - name: ollama
      namespace: agentgateway-system
      group: agentgateway.dev
      kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/llm/providers/ollama.md:166 paths=ollama-provider-setup
kubectl apply -f- <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbun-ollama
  namespace: agentgateway-system
  labels:
    app: httpbun-ollama
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbun-ollama
  template:
    metadata:
      labels:
        app: httpbun-ollama
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
  name: httpbun-ollama
  namespace: agentgateway-system
spec:
  selector:
    app: httpbun-ollama
  ports:
  - protocol: TCP
    port: 3090
    targetPort: 3090
EOF

YAMLTest -f - <<'EOF'
- name: wait for httpbun-ollama deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: httpbun-ollama
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
EOF

HTTPBUN_OLLAMA_POD_IP=$(kubectl get pod -n agentgateway-system -l app=httpbun-ollama -o jsonpath='{.items[0].status.podIP}')
kubectl apply -f- <<EOF
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: agentgateway-system
spec:
  type: ClusterIP
  clusterIP: None
  ports:
  - port: 11434
    targetPort: 11434
    protocol: TCP
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ollama
  namespace: agentgateway-system
  labels:
    kubernetes.io/service-name: ollama
addressType: IPv4
endpoints:
- addresses:
  - ${HTTPBUN_OLLAMA_POD_IP}
ports:
- port: 3090
  protocol: TCP
EOF
kubectl patch AgentgatewayBackend ollama -n agentgateway-system --type merge -p '{"spec":{"ai":{"provider":{"openai":{"model":"llama3.2"},"port":3090,"path":"/llm/chat/completions"}}}}'

YAMLTest -f - <<'EOF'
- name: wait for ollama HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: ollama
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
- name: wait for ollama HTTPRoute refs to be resolved
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: ollama
    jsonPath: "$.status.parents[0].conditions[?(@.type=='ResolvedRefs')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

YAMLTest -f - <<'EOF'
- name: verify ollama route serves chat-completions responses
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/ollama"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "model": "llama3.2",
        "messages": [
          {
            "role": "user",
            "content": "Respond with the word hello."
          }
        ],
        "httpbun": {
          "content": "ollama provider route is working"
        }
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.choices[0].message.content"
        comparator: contains
        value: "ollama provider route is working"
EOF
