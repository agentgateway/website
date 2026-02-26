---
title: gRPC routing
weight: 10
description:
---

Route traffic to gRPC services using the GRPCRoute resource for protocol-aware routing.

## About

GRPCRoute provides protocol-aware routing for gRPC traffic within the Kubernetes Gateway API. Unlike the HTTPRoute, which requires matching on HTTP paths and methods, GRPCRoute allows you to define routing rules using gRPC-native concepts like service and method names.

Consider the difference:
- **HTTPRoute Match**: `path:/com.example.User/Login`, `method: POST`
- **GRPCRoute Match**: `service: yages.Echo`, `method: Ping`

The GRPCRoute approach is more readable, less error-prone, and aligns with the Gateway API's role-oriented philosophy.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}
3. [Install `grpcurl`](https://github.com/fullstorydev/grpcurl) for testing on your computer.

## Deploy a sample gRPC service {#sample-grpc}

Deploy a sample gRPC service for testing purposes. The sample service has two APIs:

- `yages.Echo.Ping`: Takes no input (empty message) and returns a `pong` message.
- `yages.Echo.Reverse`: Takes input content and returns the content in reverse order, such as `hello world` becomes `dlrow olleh`.

Steps to set up the sample gRPC service:

1. Deploy the gRPC echo server and client.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: grpc-echo
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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
   ```


## Create a GRPCRoute {#create-grpcroute}

1. Create the GRPCRoute, HTTPRoute, and AgentgatewayPolicy. The GRPCRoute includes a match for `grpc.reflection.v1alpha.ServerReflection` to enable dynamic API exploration and a match for the `Ping` method. The AgentgatewayPolicy adds the `x-grpc-response: from-grpc` response header for gRPC traffic. For detailed information about GRPCRoute fields and configuration options, see the [Gateway API GRPCRoute documentation](https://gateway-api.sigs.k8s.io/reference/spec/#gateway.networking.k8s.io/v1.GRPCRoute).

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: GRPCRoute
metadata:
  name: example-route # same name and namespace as HTTPRoute
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
  hostnames:
    - "grpc.com"
  rules:
    - matches:
        - method:
            method: Echo
            service: proto.EchoTestService
      backendRefs:
        - name: grpc-echo-svc
          port: 3000
EOF
```

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: GRPCRoute
   metadata:
     name: example-route
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
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
   ```

2. Verify that the GRPCRoute is applied successfully.

   ```bash
   kubectl get grpcroute example-route -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
   ```

   Example output:
   ```yaml
   status:
     parents:
     - conditions:
       - lastTransitionTime: "2024-11-21T16:22:52Z"
         message: ""
         observedGeneration: 1
         reason: Accepted
         status: "True"
         type: Accepted
       - lastTransitionTime: "2024-11-21T16:22:52Z"
         message: ""
         observedGeneration: 1
         reason: ResolvedRefs
         status: "True"
         type: ResolvedRefs
       controllerName: kgateway.dev/kgateway
       parentRef:
         group: gateway.networking.k8s.io
         kind: Gateway
         name: gateway
         namespace: agentgateway-base
   ```

## Verify the gRPC route {#verify-grpcroute}

Verify that the gRPC route to the echo service is working. Responses from the gRPC backend include the `x-grpc-response: from-grpc` header that the AgentgatewayPolicy sets.

1. Get the gateway address. If the gateway is exposed as a Service in the cluster, use the gateway Service name and port (for example, `gateway:80` for plaintext). For local testing, port-forward to the gateway:

   ```bash
   kubectl port-forward svc/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```

2. From a pod in the cluster (for example, the `grpcurl-client` pod), send a gRPC request. Use `-plaintext` for port 80 and `-authority example.com` to match the GRPCRoute hostname. Use `-vv` to see response headers.

   ```bash
   kubectl exec -n {{< reuse "agw-docs/snippets/namespace.md" >}} grpcurl-client -c grpcurl -- \
     grpcurl -plaintext -authority grpc.com -vv agentgateway-proxy:80 yages.Echo/Ping
   ```

   For local testing with port-forward, use:

   ```bash
   grpcurl -plaintext -authority example.com -vv localhost:80 yages.Echo/Ping
   ```

   The response includes the `x-grpc-response: from-grpc` header and a body such as:

   ```json
   {
     "text": "pong"
   }
   ```

3. Optionally, explore the API dynamically.

   ```bash
   grpcurl -plaintext -authority grpc.com agentgateway-proxy:80 list
   grpcurl -plaintext -authority grpc.com agentgateway-proxy:80 describe yages.Echo
   ```

   Expected list output:
   ```
   grpc.health.v1.Health
   grpc.reflection.v1alpha.ServerReflection
   yages.Echo
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```bash
kubectl delete grpcroute example-route httproute example-route agentgatewaypolicy example-agw-policy-for-grpc -n agentgateway-base
kubectl delete deployment grpc-echo service grpc-echo-svc pod grpcurl-client -n agentgateway-base
```

