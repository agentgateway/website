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

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:81 paths=locality-aware-routing
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.27/manifests/charts/base/files/crd-all.gen.yaml

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:103 paths=locality-aware-routing
NODE_NAME=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
kubectl label node "$NODE_NAME" topology.kubernetes.io/region=region topology.kubernetes.io/zone=zone --overwrite
kubectl rollout restart deployment/agentgateway -n agentgateway-system
kubectl rollout status deployment/agentgateway -n agentgateway-system --timeout=180s

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:120 paths=locality-aware-routing
kubectl apply -f- <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: agentgateway-locality
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: gateway
  namespace: agentgateway-locality
spec:
  gatewayClassName: agentgateway
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:144 paths=locality-aware-routing
YAMLTest -f - <<'EOF'
- name: wait for locality Gateway to be programmed
  wait:
    target:
      kind: Gateway
      metadata:
        namespace: agentgateway-locality
        name: gateway
    jsonPath: "$.status.conditions[?(@.type=='Programmed')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:165 paths=locality-aware-routing
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-zone-a
  namespace: agentgateway-locality
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: backend-zone-a
  template:
    metadata:
      labels:
        app: backend-zone-a
        app.kubernetes.io/name: backend-zone-a
    spec:
      containers:
        - name: agnhost
          image: registry.k8s.io/e2e-test-images/agnhost:2.45
          args: ["netexec", "--http-port=80"]
          ports:
            - name: http
              containerPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-zone-b
  namespace: agentgateway-locality
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: backend-zone-b
  template:
    metadata:
      labels:
        app: backend-zone-b
        app.kubernetes.io/name: backend-zone-b
    spec:
      containers:
        - name: agnhost
          image: registry.k8s.io/e2e-test-images/agnhost:2.45
          args: ["netexec", "--http-port=80"]
          ports:
            - name: http
              containerPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-region-b
  namespace: agentgateway-locality
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: backend-region-b
  template:
    metadata:
      labels:
        app: backend-region-b
        app.kubernetes.io/name: backend-region-b
    spec:
      containers:
        - name: agnhost
          image: registry.k8s.io/e2e-test-images/agnhost:2.45
          args: ["netexec", "--http-port=80"]
          ports:
            - name: http
              containerPort: 80
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:241 paths=locality-aware-routing
YAMLTest -f - <<'EOF'
- name: wait for backend-zone-a deployment
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-locality
        name: backend-zone-a
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
- name: wait for backend-zone-b deployment
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-locality
        name: backend-zone-b
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
- name: wait for backend-region-b deployment
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-locality
        name: backend-region-b
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:290 paths=locality-aware-routing
kubectl apply -f- <<EOF
apiVersion: v1
kind: Service
metadata:
  name: locality-svc
  namespace: agentgateway-locality
spec:
  selector:
    app: locality-svc-workloadentry
  ports:
    - name: http
      port: 80
      targetPort: 80
      protocol: TCP
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: locality-route
  namespace: agentgateway-locality
spec:
  parentRefs:
    - name: gateway
  hostnames:
    - locality.test
  rules:
    - backendRefs:
        - name: locality-svc
          port: 80
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:323 paths=locality-aware-routing
YAMLTest -f - <<'EOF'
- name: wait for locality-route to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-locality
        name: locality-route
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:344 paths=locality-aware-routing
ZONE_A_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-zone-a -o jsonpath='{.items[0].status.podIP}')
ZONE_B_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-zone-b -o jsonpath='{.items[0].status.podIP}')
REGION_B_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-region-b -o jsonpath='{.items[0].status.podIP}')

kubectl apply -f- <<EOF
apiVersion: networking.istio.io/v1
kind: WorkloadEntry
metadata:
  name: we-zone-a
  namespace: agentgateway-locality
  labels:
    app: locality-svc-workloadentry
spec:
  address: ${ZONE_A_IP}
  locality: "region/zone"
  ports:
    http: 80
---
apiVersion: networking.istio.io/v1
kind: WorkloadEntry
metadata:
  name: we-zone-b
  namespace: agentgateway-locality
  labels:
    app: locality-svc-workloadentry
spec:
  address: ${ZONE_B_IP}
  locality: "region/other-zone"
  ports:
    http: 80
---
apiVersion: networking.istio.io/v1
kind: WorkloadEntry
metadata:
  name: we-region-b
  namespace: agentgateway-locality
  labels:
    app: locality-svc-workloadentry
spec:
  address: ${REGION_B_IP}
  locality: "other-region/zone"
  ports:
    http: 80
EOF

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:395 paths=locality-aware-routing
export INGRESS_GW_ADDRESS=$(kubectl get gateway gateway -n agentgateway-locality -o jsonpath='{.status.addresses[0].value}')
echo $INGRESS_GW_ADDRESS

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:407 paths=locality-aware-routing
# Warm up the new locality.test hostname so the proxy populates xDS for it.
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}/hostname" -H "host: locality.test" && break
  sleep 2
done

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:441 paths=locality-aware-routing
kubectl apply -f- <<EOF
apiVersion: v1
kind: Service
metadata:
  name: locality-svc
  namespace: agentgateway-locality
spec:
  selector:
    app: locality-svc-workloadentry
  ports:
    - name: http
      port: 80
      targetPort: 80
      protocol: TCP
  trafficDistribution: PreferSameZone
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:475 paths=locality-aware-routing
# Wait for PreferSameZone to take effect in the proxy's xDS endpoint weights.
for i in $(seq 1 60); do
  body=$(curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "")
  case "$body" in
    backend-zone-a-*) break ;;
  esac
  sleep 2
done

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:486 paths=locality-aware-routing
# Assert all requests go to backend-zone-a after PreferSameZone is enabled.
EXPECTED=20
EXPECTED_PREFIX=backend-zone-a
for attempt in $(seq 1 12); do
  COUNT=0
  for i in $(seq 1 ${EXPECTED}); do
    body=$(curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "")
    case "$body" in
      ${EXPECTED_PREFIX}-*) COUNT=$((COUNT+1)) ;;
    esac
  done
  if [ "$COUNT" -eq "$EXPECTED" ]; then
    echo "PASS: ${COUNT}/${EXPECTED} requests routed to ${EXPECTED_PREFIX}"
    break
  fi
  echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} to ${EXPECTED_PREFIX}, retrying..."
  sleep 5
done
if [ "$COUNT" -ne "$EXPECTED" ]; then
  echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to ${EXPECTED_PREFIX}, got ${COUNT}"
  exit 1
fi

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:513 paths=locality-aware-routing
kubectl delete workloadentry we-zone-a -n agentgateway-locality
sleep 2

for i in $(seq 1 20); do
  curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname"
  echo
done | sort | uniq -c

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:529 paths=locality-aware-routing
# Assert traffic shifts to backend-zone-b after we-zone-a is deleted.
EXPECTED=20
EXPECTED_PREFIX=backend-zone-b
for attempt in $(seq 1 12); do
  COUNT=0
  for i in $(seq 1 ${EXPECTED}); do
    body=$(curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "")
    case "$body" in
      ${EXPECTED_PREFIX}-*) COUNT=$((COUNT+1)) ;;
    esac
  done
  if [ "$COUNT" -eq "$EXPECTED" ]; then
    echo "PASS: ${COUNT}/${EXPECTED} requests routed to ${EXPECTED_PREFIX}"
    break
  fi
  echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} to ${EXPECTED_PREFIX}, retrying..."
  sleep 5
done
if [ "$COUNT" -ne "$EXPECTED" ]; then
  echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to ${EXPECTED_PREFIX}, got ${COUNT}"
  exit 1
fi

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:556 paths=locality-aware-routing
kubectl delete workloadentry we-zone-b -n agentgateway-locality
sleep 2

for i in $(seq 1 20); do
  curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname"
  echo
done | sort | uniq -c

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:572 paths=locality-aware-routing
# Assert traffic shifts to backend-region-b after we-zone-b is also deleted.
EXPECTED=20
EXPECTED_PREFIX=backend-region-b
for attempt in $(seq 1 12); do
  COUNT=0
  for i in $(seq 1 ${EXPECTED}); do
    body=$(curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "")
    case "$body" in
      ${EXPECTED_PREFIX}-*) COUNT=$((COUNT+1)) ;;
    esac
  done
  if [ "$COUNT" -eq "$EXPECTED" ]; then
    echo "PASS: ${COUNT}/${EXPECTED} requests routed to ${EXPECTED_PREFIX}"
    break
  fi
  echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} to ${EXPECTED_PREFIX}, retrying..."
  sleep 5
done
if [ "$COUNT" -ne "$EXPECTED" ]; then
  echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to ${EXPECTED_PREFIX}, got ${COUNT}"
  exit 1
fi

# Source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:652 paths=locality-aware-routing
kubectl apply -f- <<EOF
apiVersion: v1
kind: Service
metadata:
  name: locality-svc
  namespace: agentgateway-locality
spec:
  selector:
    app: locality-svc-workloadentry
  ports:
    - name: http
      port: 80
      targetPort: 80
      protocol: TCP
  internalTrafficPolicy: Local
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:687 paths=locality-aware-routing
# Assert all requests return 503 under internalTrafficPolicy: Local.
EXPECTED=10
for attempt in $(seq 1 12); do
  COUNT=0
  for i in $(seq 1 ${EXPECTED}); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "0")
    if [ "$code" = "503" ]; then
      COUNT=$((COUNT+1))
    fi
  done
  if [ "$COUNT" -eq "$EXPECTED" ]; then
    echo "PASS: ${COUNT}/${EXPECTED} requests returned 503"
    break
  fi
  echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} returned 503, retrying..."
  sleep 5
done
if [ "$COUNT" -ne "$EXPECTED" ]; then
  echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to return 503, got ${COUNT}"
  exit 1
fi

# Hidden source: content/docs/kubernetes/latest/traffic-management/locality-aware-routing.md:719 paths=locality-aware-routing
kubectl delete namespace agentgateway-locality --ignore-not-found --wait=false
