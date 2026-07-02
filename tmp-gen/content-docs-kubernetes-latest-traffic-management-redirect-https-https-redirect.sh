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

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:29 paths=https-redirect,https-listener
mkdir example_certs

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:34 paths=https-redirect,https-listener
# root cert
openssl req -x509 -sha256 \
-nodes -days 365 \
-newkey rsa:2048 \
-subj '/O=any domain/CN=*' \
-keyout example_certs/root.key \
-out example_certs/root.crt

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:45 paths=https-redirect,https-listener
cat <<'EOF' > example_certs/gateway.cnf
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext
[ dn ]
CN = *.example.com
O = any domain
[ req_ext ]
subjectAltName = @alt_names
[ alt_names ]
DNS.1 = *.example.com
DNS.2 = example.com
EOF

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:65 paths=https-redirect,https-listener
openssl req -new -nodes -keyout example_certs/gateway.key -out example_certs/gateway.csr -config example_certs/gateway.cnf
openssl x509 -req -sha256 -days 365 \
  -CA example_certs/root.crt -CAkey example_certs/root.key -set_serial 0 \
  -in example_certs/gateway.csr -out example_certs/gateway.crt \
  -extfile example_certs/gateway.cnf -extensions req_ext

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:74 paths=https-redirect,https-listener
kubectl create secret tls -n agentgateway-system https \
  --key example_certs/gateway.key \
  --cert example_certs/gateway.crt
kubectl label secret https example=httpbin-https --namespace agentgateway-system

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:82 paths=https-redirect
kubectl apply -f- <<EOF
kind: Gateway
apiVersion: gateway.networking.k8s.io/v1
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
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs:
        - name: https
          kind: Secret
    allowedRoutes:
      namespaces:
        from: All
EOF

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:115 paths=https-redirect
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: httpbin-https-redirect
  namespace: httpbin
  labels:
    gateway: https
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
      sectionName: http
  hostnames: 
    - redirect.example
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
EOF

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:154 paths=https-redirect
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: httpbin-https
  namespace: httpbin
  labels:
    gateway: https
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
      sectionName: https
  hostnames: 
    - redirect.example
  rules:
    - backendRefs:
        - name: httpbin
          port: 8000
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:253 paths=https-redirect
YAMLTest -f - <<'EOF'
- name: wait for httpbin-https-redirect HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin-https-redirect
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:272 paths=https-redirect
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/status/200" -H "host: redirect.example" && break
  sleep 2
done

# Hidden source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:279 paths=https-redirect
YAMLTest -f - <<'EOF'
- name: https redirect - HTTP request returns 301 with https location
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /status/200
    method: GET
    headers:
      host: redirect.example
  source:
    type: local
  expect:
    statusCode: 301
    headers:
      - name: location
        comparator: contains
        value: https://redirect.example
EOF

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:305 paths=https-redirect
kubectl delete httproute,secret -A -l gateway=https --ignore-not-found

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:310 paths=https-redirect
rm -rf example_certs

# Source: content/docs/kubernetes/latest/traffic-management/redirect/https.md:315 paths=https-redirect
kubectl apply -f- <<EOF
kind: Gateway
apiVersion: gateway.networking.k8s.io/v1
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
