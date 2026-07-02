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

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:71 paths=route-delegation-prereq
kubectl create namespace team1
kubectl create namespace team2

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:77 paths=route-delegation-prereq
curl -sL https://raw.githubusercontent.com/kgateway-dev/kgateway/main/examples/httpbin.yaml \
  | awk 'BEGIN{skip=0} /^kind: Namespace$/{skip=1} skip==0{print} /^---$/{skip=0}' \
  | sed 's/namespace: httpbin/namespace: team1/g' \
  | kubectl apply -f -

curl -sL https://raw.githubusercontent.com/kgateway-dev/kgateway/main/examples/httpbin.yaml \
  | awk 'BEGIN{skip=0} /^kind: Namespace$/{skip=1} skip==0{print} /^---$/{skip=0}' \
  | sed 's/namespace: httpbin/namespace: team2/g' \
  | kubectl apply -f -

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:89 paths=route-delegation-prereq
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

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:139 paths=trafficpolicies
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
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:165 paths=trafficpolicies
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
        value: /anything/team1/foo
    backendRefs:
    - name: httpbin
      port: 8000
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:184 paths=trafficpolicies
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

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:203 paths=trafficpolicies
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo" -H "host: delegation.example" && break
  sleep 2
done

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:215 paths=trafficpolicies
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: parent-policy
  namespace: agentgateway-system
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: parent
  traffic:
    transformation:
      request:
        set:
        - name: x-parent-policy
          value: "'This policy is inherited from the parent.'"
    rateLimit:
      local:
      - requests: 1
        unit: Minutes
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:241 paths=trafficpolicies
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: child-policy
  namespace: team1
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: child-team1
  traffic:
    transformation:
      request:
        set:
        - name: x-child-policy
          value: "'This is the child-team1 policy.'"
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:276 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: wait for parent-policy to be attached
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: parent-policy
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for child-policy to be attached
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: team1
        name: child-policy
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:323 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: child transformation wins over parent transformation
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
    method: GET
    headers:
      host: delegation.example
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.headers.X-Child-Policy[0]"
        comparator: contains
        value: "This is the child-team1 policy."
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:367 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: second request hits inherited parent rate limit
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
    method: GET
    headers:
      host: delegation.example
  source:
    type: local
  expect:
    statusCode: 429
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:392 paths=trafficpolicies
kubectl delete agentgatewaypolicy parent-policy -n agentgateway-system
kubectl delete agentgatewaypolicy child-policy -n team1

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:402 paths=trafficpolicies
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: parent-authz
  namespace: agentgateway-system
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: parent
  traffic:
    authorization:
      action: Require
      policy:
        matchExpressions:
        - 'request.headers["x-parent-required"] == "true"'
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:424 paths=trafficpolicies
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: child-authz
  namespace: team1
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: child-team1
  traffic:
    authorization:
      action: Require
      policy:
        matchExpressions:
        - 'request.headers["x-child-required"] == "true"'
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:445 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: wait for parent-authz to be attached
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: parent-authz
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for child-authz to be attached
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: team1
        name: child-authz
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:492 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: no headers - 403 (both Require rules unmet)
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
    method: GET
    headers:
      host: delegation.example
  source:
    type: local
  expect:
    statusCode: 403
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:533 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: only x-parent-required - 403 (child Require unmet)
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
    method: GET
    headers:
      host: delegation.example
      x-parent-required: "true"
  source:
    type: local
  expect:
    statusCode: 403
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:574 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: only x-child-required - 403 (parent Require unmet)
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
    method: GET
    headers:
      host: delegation.example
      x-child-required: "true"
  source:
    type: local
  expect:
    statusCode: 403
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:617 paths=trafficpolicies
YAMLTest -f - <<'EOF'
- name: both required headers - 200 (both Require rules met)
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
    method: GET
    headers:
      host: delegation.example
      x-parent-required: "true"
      x-child-required: "true"
  source:
    type: local
  expect:
    statusCode: 200
EOF

# Source: content/docs/kubernetes/latest/traffic-management/route-delegation/inheritance/trafficpolicies.md:647 paths=trafficpolicies
kubectl delete agentgatewaypolicy parent-authz -n agentgateway-system --ignore-not-found
kubectl delete agentgatewaypolicy child-authz -n team1 --ignore-not-found
kubectl delete agentgatewaypolicy parent-policy -n agentgateway-system --ignore-not-found
kubectl delete agentgatewaypolicy child-policy -n team1 --ignore-not-found
kubectl delete httproute parent -n agentgateway-system
kubectl delete httproute child-team1 -n team1
kubectl delete namespaces team1 team2
