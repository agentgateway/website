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

# Source: content/docs/kubernetes/main/llm/providers/openai.md:42 paths=openai-setup
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

# Source: content/docs/kubernetes/main/llm/providers/openai.md:59 paths=openai-setup
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

# Source: content/docs/kubernetes/main/llm/providers/openai.md:117 paths=openai-setup
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

# Hidden source: content/docs/kubernetes/main/llm/providers/openai.md:143 paths=openai-setup
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

# Hidden source: content/docs/kubernetes/main/llm/providers/openai.md:239 paths=openai-setup
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

# Hidden source: content/docs/kubernetes/main/llm/transformations.md:41 paths=llm-transformations
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
    - backendRefs:
        - name: openai
          namespace: agentgateway-system
          group: agentgateway.dev
          kind: AgentgatewayBackend
EOF

# Hidden source: content/docs/kubernetes/main/llm/transformations.md:61 paths=llm-transformations
YAMLTest -f - <<'EOF'
- name: wait for openai HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: openai
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Source: content/docs/kubernetes/main/llm/transformations.md:82 paths=llm-transformations
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: cap-max-tokens
  namespace: agentgateway-system
  labels:
    app: agentgateway
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: openai
  backend:
    ai:
      transformations:
      - field: max_completion_tokens
        expression: "min(llmRequest.max_completion_tokens, 10)"
EOF

# Hidden source: content/docs/kubernetes/main/llm/transformations.md:104 paths=llm-transformations
YAMLTest -f - <<'EOF'
- name: wait for cap-max-tokens policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: cap-max-tokens
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/main/llm/transformations.md:185 paths=llm-transformations
YAMLTest -f - <<'EOF'
- name: verify request succeeds with max_completion_tokens transformation applied
  http:
    url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
    body: |
      {"model": "gpt-4", "max_completion_tokens": 5000, "messages": [{"role": "user", "content": "Tell me a short story"}]}
  source:
    type: local
  expect:
    statusCode: 200
EOF

# Source: content/docs/kubernetes/main/llm/transformations.md:459 paths=llm-transformations,llm-model-headers
kubectl delete AgentgatewayPolicy cap-max-tokens -n agentgateway-system --ignore-not-found
kubectl delete AgentgatewayPolicy llm-model-headers -n agentgateway-system --ignore-not-found

# Hidden source: content/docs/kubernetes/main/llm/transformations.md:464 paths=llm-transformations,llm-model-headers
kubectl delete httproute openai -n agentgateway-system --ignore-not-found
