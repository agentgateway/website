#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/latest/quickstart/install.md:31 paths=standard
kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/standard-install.yaml

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

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:42 paths=https-redirect,https-listener
mkdir example_certs

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:47 paths=https-redirect,https-listener
# root cert
openssl req -x509 -sha256 \
-nodes -days 365 \
-newkey rsa:2048 \
-subj '/O=any domain/CN=*' \
-keyout example_certs/root.key \
-out example_certs/root.crt

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:58 paths=https-redirect,https-listener
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

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:78 paths=https-redirect,https-listener
openssl req -new -nodes -keyout example_certs/gateway.key -out example_certs/gateway.csr -config example_certs/gateway.cnf
openssl x509 -req -sha256 -days 365 \
  -CA example_certs/root.crt -CAkey example_certs/root.key -set_serial 0 \
  -in example_certs/gateway.csr -out example_certs/gateway.crt \
  -extfile example_certs/gateway.cnf -extensions req_ext

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:87 paths=https-redirect,https-listener
kubectl create secret tls -n agentgateway-system https \
  --key example_certs/gateway.key \
  --cert example_certs/gateway.crt
kubectl label secret https example=httpbin-https --namespace agentgateway-system

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:102 paths=https-listener
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: https
  namespace: agentgateway-system
  labels:
    example: httpbin-https
spec:
  gatewayClassName: agentgateway
  listeners:
  - protocol: HTTPS
    port: 8443
    name: https
    tls:
      mode: Terminate
      certificateRefs:
        - name: https
          kind: Secret
    allowedRoutes:
      namespaces:
        from: All
EOF

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:227 paths=https-listener
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: httpbin-https
  namespace: httpbin
  labels:
    example: httpbin-https
spec:
  hostnames:
    - https.example.com
  parentRefs:
    - name: https
      namespace: agentgateway-system
  rules:
    - backendRefs:
        - name: httpbin
          port: 8000
EOF

# Hidden source: content/docs/kubernetes/latest/setup/listeners/https.md:276 paths=https-listener
YAMLTest -f - <<'EOF'
- name: wait for https deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: https
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: wait for https service LB address
  wait:
    target:
      kind: Service
      metadata:
        namespace: agentgateway-system
        name: https
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: wait for httpbin-https HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin-https
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

export INGRESS_GW_ADDRESS_HTTPS=$(kubectl get svc -n agentgateway-system https -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

# Hidden source: content/docs/kubernetes/latest/setup/listeners/https.md:326 paths=https-listener
for i in $(seq 1 90); do
  code=$(curl -sk --max-time 30 --resolve "https.example.com:8443:${INGRESS_GW_ADDRESS_HTTPS}" -o /dev/null -w "%{http_code}" https://https.example.com:8443/status/200 || true)
  [ "$code" = "200" ] && break
  sleep 2
done

# Hidden source: content/docs/kubernetes/latest/setup/listeners/https.md:334 paths=https-listener
HTTP_CODE=$(curl -sk --max-time 30 --resolve "https.example.com:8443:${INGRESS_GW_ADDRESS_HTTPS}" -o /dev/null -w "%{http_code}" https://https.example.com:8443/status/200)
echo "HTTPS listener returned status code: ${HTTP_CODE}"
test "${HTTP_CODE}" = "200"

# Source: content/docs/kubernetes/latest/setup/listeners/https.md:482 paths=https-listener
kubectl delete -A gateways,httproutes,secret -l example=httpbin-https
rm -rf example_certs
