#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/latest/quickstart/install.md:37 paths=experimental
kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/experimental-install.yaml

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

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:74 paths=route-delegation-prereq
kubectl create namespace team1
kubectl create namespace team2

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:80 paths=route-delegation-prereq
curl -sL https://raw.githubusercontent.com/kgateway-dev/kgateway/main/examples/httpbin.yaml \
  | awk 'BEGIN{skip=0} /^kind: Namespace$/{skip=1} skip==0{print} /^---$/{skip=0}' \
  | sed 's/namespace: httpbin/namespace: team1/g' \
  | kubectl apply -f -

curl -sL https://raw.githubusercontent.com/kgateway-dev/kgateway/main/examples/httpbin.yaml \
  | awk 'BEGIN{skip=0} /^kind: Namespace$/{skip=1} skip==0{print} /^---$/{skip=0}' \
  | sed 's/namespace: httpbin/namespace: team2/g' \
  | kubectl apply -f -

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:92 paths=route-delegation-prereq
YAMLTest -f - <<'EOF'
- name: wait for team1 httpbin deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: team1
        name: httpbin
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 400
      intervalSeconds: 5
- name: wait for team2 httpbin deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: team2
        name: httpbin
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 400
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:142 paths=native-policies
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: parent
  namespace: agentgateway-system
spec:
  parentRefs:
  - name: agentgateway-proxy
  hostnames:
  - "delegation.example"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team1
    backendRefs:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      name: child-team1
      namespace: team1
    timeouts:
      request: 1s
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team2
    backendRefs:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      name: child-team2
      namespace: team2
    timeouts:
      request: 1s
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:181 paths=native-policies
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: child-team1
  namespace: team1
spec:
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team1/delay
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /delay
    backendRefs:
    - name: httpbin
      port: 8000
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:207 paths=native-policies
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: child-team2
  namespace: team2
spec:
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /anything/team2/delay
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /delay
    backendRefs:
    - name: httpbin
      port: 8000
    timeouts:
      request: 5s
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:234 paths=native-policies
YAMLTest -f - <<'EOF'
- name: wait for parent HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: parent
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:253 paths=native-policies
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/anything/team1/delay/0" -H "host: delegation.example" && break
  sleep 2
done

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:276 paths=native-policies
YAMLTest -f - <<'EOF'
- name: child-team1 inherits parent 1s timeout - returns 504 on /delay/3
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/delay/3"
    method: GET
    headers:
      host: delegation.example
  source:
    type: local
  expect:
    statusCode: 504
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:317 paths=native-policies
YAMLTest -f - <<'EOF'
- name: child-team2 5s override beats parent 1s - returns 200 on /delay/3
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team2/delay/3"
    method: GET
    headers:
      host: delegation.example
  source:
    type: local
  expect:
    statusCode: 200
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/native-policies.md:347 paths=native-policies
kubectl delete httproute parent -n agentgateway-system
kubectl delete httproute child-team1 -n team1
kubectl delete httproute child-team2 -n team2
kubectl delete namespaces team1 team2
