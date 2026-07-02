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

# Source: content/docs/kubernetes/latest/traffic-management/grpc.md:42 paths=grpc
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grpc-echo
  namespace: agentgateway-system
  labels:
    app.kubernetes.io/name: grpc-echo
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: grpc-echo
  replicas: 1
  template:
    metadata:
      labels:
       app.kubernetes.io/name: grpc-echo
    spec:
      containers:
        - name: grpc-echo
          image: ghcr.io/projectcontour/yages:v0.1.0
          ports:
            - containerPort: 9000
              protocol: TCP
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: GRPC_ECHO_SERVER
              value: "true"
            - name: SERVICE_NAME
              value: grpc-echo
---
apiVersion: v1
kind: Service
metadata:
  name: grpc-echo-svc
  namespace: agentgateway-system
  labels:
    app.kubernetes.io/name: grpc-echo
spec:
  type: ClusterIP
  ports:
    - port: 3000
      protocol: TCP
      targetPort: 9000
      appProtocol: kubernetes.io/h2c
  selector:
    app.kubernetes.io/name: grpc-echo
---
apiVersion: v1
kind: Pod
metadata:
  name: grpcurl-client
  namespace: agentgateway-system
  labels:
    app.kubernetes.io/name: grpcurl-client
spec:
 containers:
    - name: grpcurl
      image: docker.io/fullstorydev/grpcurl:v1.8.7-alpine
      command:
        - sleep
        - "infinity"
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/grpc.md:115 paths=grpc
YAMLTest -f - <<'EOF'
- name: wait for grpc-echo deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: grpc-echo
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for grpcurl-client pod to be running
  wait:
    target:
      kind: Pod
      metadata:
        namespace: agentgateway-system
        name: grpcurl-client
    jsonPath: "$.status.phase"
    jsonPathExpectation:
      comparator: equals
      value: "Running"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/latest/traffic-management/grpc.md:163 paths=grpc
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: grpc              
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

# Source: content/docs/kubernetes/latest/traffic-management/grpc.md:184 paths=grpc
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: GRPCRoute
metadata:
  name: example-route
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: grpc
  hostnames:
    - "grpc.com"
  rules:
    - matches:
        - method:
            method: ServerReflectionInfo
            service: grpc.reflection.v1alpha.ServerReflection
        - method:
            method: Ping
      backendRefs:
        - name: grpc-echo-svc
          port: 3000
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/grpc.md:209 paths=grpc
YAMLTest -f - <<'EOF'
- name: wait for GRPCRoute to be accepted
  wait:
    target:
      kind: GRPCRoute
      metadata:
        namespace: agentgateway-system
        name: example-route
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF

# Hidden source: content/docs/kubernetes/latest/traffic-management/grpc.md:263 paths=grpc
success=false
for i in $(seq 1 30); do
  if kubectl exec -n agentgateway-system grpcurl-client -c grpcurl -- \
    grpcurl -plaintext -authority grpc.com grpc:80 yages.Echo/Ping 2>&1 | grep -q '"text": "pong"'; then
    success=true
    break
  fi
  sleep 5
done
$success
