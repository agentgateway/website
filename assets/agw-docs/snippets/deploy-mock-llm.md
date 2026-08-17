# Test-only helper: deploy the httpbun mock LLM, an OpenAI-compatible endpoint that
# needs no provider API key, so doc tests never send a live completion. This is the
# same deployment that the httpbun guide documents (/llm/providers/httpbun/); it is
# applied here as two separate resources so the snippet contains no YAML document
# separator. Point a backend at it by patching in
# host: httpbun.default.svc.cluster.local / port: 3090 / path: /llm/chat/completions
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbun
  namespace: default
  labels:
    app: httpbun
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbun
  template:
    metadata:
      labels:
        app: httpbun
    spec:
      containers:
        - name: httpbun
          image: sharat87/httpbun
          env:
            - name: HTTPBUN_BIND
              value: "0.0.0.0:3090"
          ports:
            - containerPort: 3090
EOF
kubectl apply -f- <<EOF
apiVersion: v1
kind: Service
metadata:
  name: httpbun
  namespace: default
  labels:
    app: httpbun
spec:
  selector:
    app: httpbun
  ports:
    - protocol: TCP
      port: 3090
      targetPort: 3090
  type: ClusterIP
EOF
kubectl rollout status deployment/httpbun -n default --timeout=180s
