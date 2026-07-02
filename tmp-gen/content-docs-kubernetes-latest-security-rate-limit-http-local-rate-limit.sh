#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/latest/install/helm.md:32 paths=standard
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/standard-install.yaml

# Source: content/docs/kubernetes/latest/install/helm.md:61 paths=standard,experimental
helm upgrade -i --create-namespace \
  --namespace agentgateway-system \
  --version v1.3.1 agentgateway-crds oci://cr.agentgateway.dev/charts/agentgateway-crds

# Source: content/docs/kubernetes/latest/install/helm.md:87 paths=standard
helm upgrade -i -n agentgateway-system agentgateway oci://cr.agentgateway.dev/charts/agentgateway \
--version v1.3.1

# Hidden source: content/docs/kubernetes/latest/install/helm.md:160 paths=standard,experimental
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

# Source: content/docs/kubernetes/latest/setup/gateway.md:22 paths=all
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

# Hidden source: content/docs/kubernetes/latest/setup/gateway.md:86 paths=all
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

# Source: content/docs/kubernetes/latest/install/sample-app.md:44 paths=install-httpbin
kubectl apply -f https://raw.githubusercontent.com/kgateway-dev/kgateway/refs/heads/main/examples/httpbin.yaml

# Hidden source: content/docs/kubernetes/latest/install/sample-app.md:48 paths=install-httpbin
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

# Source: content/docs/kubernetes/latest/install/sample-app.md:77 paths=install-httpbin
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

# Hidden source: content/docs/kubernetes/latest/install/sample-app.md:97 paths=install-httpbin
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

# Hidden source: content/docs/kubernetes/latest/install/sample-app.md:130 paths=install-httpbin
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" && break
  sleep 2
done

# Hidden source: content/docs/kubernetes/latest/install/sample-app.md:137 paths=install-httpbin
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

# Source: content/docs/kubernetes/latest/install/sample-app.md:161 paths=install-httpbin
export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
echo $INGRESS_GW_ADDRESS

# Source: content/docs/kubernetes/latest/security/rate-limit-http.md:159 paths=local-rate-limit
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: httpbin-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      local:
      - requests: 3
        unit: Seconds
        burst: 3
EOF

# Hidden source: content/docs/kubernetes/latest/security/rate-limit-http.md:180 paths=local-rate-limit
YAMLTest -f - <<'EOF'
- name: wait for httpbin rate limit policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: httpbin
        name: httpbin-rate-limit
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/latest/security/rate-limit-http.md:292 paths=local-rate-limit
# Test rate limiting by sending requests in rapid succession
for i in $(seq 1 6); do
  curl -s -o /dev/null http://${INGRESS_GW_ADDRESS}:80/anything -H "host: www.example.com" &
done
wait

# Now verify the rate limit is active
YAMLTest -f - <<'EOF'
- name: Verify rate limit kicks in after burst
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything"
    method: GET
    headers:
      host: www.example.com
  source:
    type: local
  expect:
    statusCode: 429
  retries: 3
EOF

# Source: content/docs/kubernetes/latest/security/rate-limit-http.md:333 paths=local-rate-limit
kubectl delete AgentgatewayPolicy httpbin-rate-limit -n httpbin
