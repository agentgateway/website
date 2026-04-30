[KServe](https://kserve.github.io/website/) is a Kubernetes-native model inference platform. By fronting KServe with agentgateway, you can apply agent-aware policies, including token-based rate limiting, to your model serving endpoints without modifying your inference services.

## Before you begin

{{< callout type="info" >}}
Make sure you installed the Experimental Version.
{{< /callout >}}

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Step 1: Install cert-manager

1. KServe requires cert-manager for webhook certificates.
   
   ```shell
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.20.2/cert-manager.yaml
   ```

2. Wait for cert-manager to be ready before you continue.
   
   ```shell
   kubectl wait --for=condition=available deployment --all -n cert-manager --timeout=120s
   ```

## Step 2: Create the KServe namespace and gateway

1. Create the `kserve` namespace. 
   ```shell
   kubectl create namespace kserve
   ```

2. Create a `Gateway` resource that agentgateway manages. KServe attaches `HTTPRoute` resources to this gateway automatically for each `InferenceService` you deploy.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: kserve-ingress-gateway
     namespace: kserve
   spec:
     gatewayClassName: agentgateway
     listeners:
       - name: http
         protocol: HTTP
         port: 80
         allowedRoutes:
           namespaces:
             from: All
     infrastructure:
       labels:
         serving.kserve.io/gateway: kserve-ingress-gateway
   EOF
   ```

3. Verify the gateway service is created.

   ```shell
   kubectl get svc -n kserve kserve-ingress-gateway
   ```

   Example output:

   ```
   NAME                     TYPE           CLUSTER-IP   EXTERNAL-IP   PORT(S)                      AGE
   kserve-ingress-gateway   LoadBalancer   10.96.4.5    <pending>     80:32764/TCP,443:31766/TCP   11s
   ```

## Step 3: Install KServe

1. Install the KServe CRDs.
   ```shell
   helm install kserve-crd oci://ghcr.io/kserve/charts/kserve-crd --version v0.17.0
   ```

2. Install KServe resources using Helm.
   ```shell
   helm install kserve oci://ghcr.io/kserve/charts/kserve-resources \
     --version v0.17.0 \
     --namespace kserve \
     --create-namespace \
     --set kserve.controller.deploymentMode=Standard \
     --set kserve.controller.gateway.ingressGateway.enableGatewayApi=true \
     --set kserve.controller.gateway.ingressGateway.createGateway=false \
     --set kserve.controller.gateway.ingressGateway.kserveGateway=kserve/kserve-ingress-gateway \
     --set kserve.controller.gateway.ingressGateway.className=agentgateway \
     --set kserve.controller.gateway.disableIstioVirtualHost=true \
     --set kserve.controller.gateway.disableIngressCreation=false \
     --set kserve.controller.knativeAddressableResolver.enabled=false \
     --set kserve.controller.gateway.localGateway.gateway="" \
     --set kserve.controller.gateway.localGateway.gatewayService=""
   ```

## Step 4: Deploy a mocked LLM with httpbun

Instead of a real model, this guide uses [httpbun](https://httpbun.com/) to serve a mock OpenAI compatible endpoint. httpbun's `/llm/chat/completions` path returns a properly structured OpenAI chat completion response, including `usage.total_tokens` in the response body, which agentgateway reads to enforce token-based rate limits.

1. Create the test namespace.

   ```shell
   kubectl create namespace kserve-test
   ```

2. Deploy an `InferenceService` using httpbun directly via `spec.predictor.containers`. This approach bypasses KServe's model runtime machinery entirely, no `ClusterServingRuntime` or model storage is needed.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: serving.kserve.io/v1beta1
   kind: InferenceService
   metadata:
     name: mock-llm
     namespace: kserve-test
   spec:
     predictor:
       containers:
         - name: kserve-container
           image: sharat87/httpbun:latest
           ports:
             - containerPort: 80
               protocol: TCP
           resources:
             requests:
               cpu: "100m"
               memory: "128Mi"
             limits:
               cpu: "500m"
               memory: "256Mi"
   EOF
   ```

   Wait for the `InferenceService` to become ready.
   
   ```shell
   kubectl get inferenceservices mock-llm -n kserve-test --watch
   ```
   
   Once `READY` is `True`, KServe creates an `HTTPRoute` that attaches to the agentgateway. Verify it. The route attaches to `kserve/kserve-ingress-gateway` with hostname `mock-llm-kserve-test.example.com`.
   
   ```shell
   kubectl get httproute mock-llm -n kserve-test -o yaml
   ```

## Step 5: Create an AgentgatewayBackend

KServe generates the `HTTPRoute` with a plain Kubernetes `Service` as the `backendRef`. Agentgateway only applies token-based rate limiting to traffic that flows through an `AgentgatewayBackend` with `spec.ai.provider` configured, because that is what signals to the proxy that the backend is an LLM and that response bodies contain a `usage.total_tokens` field to count against the rate limit bucket.

1. Create an `AgentgatewayBackend` that points at the httpbun predictor service.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayBackend
   metadata:
     name: mock-llm-backend
     namespace: kserve-test
   spec:
     ai:
       provider:
         openai:
           model: mock-llm
         host: mock-llm-predictor.kserve-test.svc.cluster.local
         port: 80
         path: "/llm/chat/completions"
   EOF
   ```

2. Create a second `HTTPRoute` that routes to the `AgentgatewayBackend`. This route uses the same hostname as the KServe-generated route but matches only the `/llm/chat/completions` path, so the gateway prefers it for LLM traffic.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: mock-llm-ai
     namespace: kserve-test
   spec:
     parentRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: kserve-ingress-gateway
         namespace: kserve
     hostnames:
       - mock-llm-kserve-test.example.com
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /llm/chat/completions
         backendRefs:
           - name: mock-llm-backend
             namespace: kserve-test
             group: agentgateway.dev
             kind: AgentgatewayBackend
   EOF
   ```

   {{< callout type="info" >}}
   This extra `HTTPRoute` is a current workaround. Token-based rate limiting requires traffic to flow through an    `AgentgatewayBackend` so the proxy knows to inspect the response body for `usage.total_tokens`. A future    agentgateway release may support activating LLM-aware response parsing directly on an `AgentgatewayPolicy`,    which would remove the need for this step.
   {{< /callout >}}

## Step 6: Apply token-based rate limiting
How token counting works: Agentgateway reads `usage.total_tokens` from the JSON response body returned by the inference service. Each request deducts that many tokens from the bucket. When the bucket empties, subsequent requests receive `429 Too Many Requests` until the next fill interval.

1. Apply an `AgentgatewayPolicy` that caps requests at **100 tokens per minute**. The policy targets the `mock-llm-ai` route that flows through the `AgentgatewayBackend`.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: llm-token-budget
     namespace: kserve-test
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: mock-llm-ai
     traffic:
       rateLimit:
         local:
           - tokens: 100
             unit: Minutes
   EOF
   ```

   Verify the policy is accepted and attached. Both `Accepted` and `Attached` conditions must be `True`.
   ```shell
   kubectl get agentgatewaypolicy llm-token-budget -n kserve-test \
     -o jsonpath='{.status.ancestors[0].conditions}'
   ```

## Step 7: Test the endpoint
{{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
1. Get the external address of the gateway and save it in an environment variable.
   ```shell
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kserve agentgateway-proxy \
     -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```

2. Send a request to verify the setup works end-to-end.
   ```shell
   curl -s http://$INGRESS_GW_ADDRESS/llm/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mock-llm",
       "messages": [
         {"role": "user", "content": "Hello"}
       ]
     }' | jq
   ```

   Example output:
   ```shell
   {
     "choices": [
       {
         "finish_reason": "stop",
         "index": 0,
         "message": {
           "content": "This is a mock chat response from httpbun.",
           "role": "assistant"
         }
       }
     ],
     "usage": {
       "completion_tokens": 29,
       "prompt_tokens": 3,
       "total_tokens": 32
     }
   }
   ```

3. Run a burst of requests to trigger the token rate limit. With `tokens: 100` and each response consuming 32 tokens, the budget exhausts after roughly three requests.
   ```shell
   for i in $(seq 1 30); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://$INGRESS_GW_ADDRESS/llm/chat/completions \
       -H "Content-Type: application/json" \
       -d '{"model": "mock-llm", "messages": [{"role": "user", "content": "Hello"}]}'
   done
   ```

   Example output:
   
   ```
   200
   200
   200
   200
   429
   429
   429
   ...
   ```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
1. Port-forward the gateway to your local machine.

   ```shell
   kubectl port-forward -n kserve svc/kserve-ingress-gateway 8080:80
   ```

2. Send a single request to confirm the setup works end-to-end.

   ```shell
   curl -s -X POST http://localhost:8080/llm/chat/completions \
     -H "Host: mock-llm-kserve-test.example.com" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mock-llm",
       "messages": [{"role": "user", "content": "Hello"}]
     }' | jq
   ```

   Example output:
   
   ```json
   {
     "choices": [
       {
         "finish_reason": "stop",
         "index": 0,
         "message": {
           "content": "This is a mock chat response from httpbun.",
           "role": "assistant"
         }
       }
     ],
     "created": 1777516976,
     "id": "chatcmpl-0226b1bf7051293ce23450e1",
     "model": "mock-llm",
     "object": "chat.completion",
     "usage": {
       "completion_tokens": 29,
       "prompt_tokens": 3,
       "total_tokens": 32
     }
   }
   ```

3. Run a burst of requests to trigger the token rate limit. With `tokens: 100` and each response consuming 32 tokens, the budget exhausts after roughly three requests.

   ```shell
   for i in $(seq 1 30); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://localhost:8080/llm/chat/completions \
       -H "Host: mock-llm-kserve-test.example.com" \
       -H "Content-Type: application/json" \
       -d '{"model": "mock-llm", "messages": [{"role": "user", "content": "Hello"}]}'
   done
   ```
   
   Example output:
   
   ```
   200
   200
   200
   200
   429
   429
   429
   ...
   ```
{{% /tab %}}
{{< /tabs >}}

## Cleanup

Remove the resources created in this guide.
   ```shell
   kubectl delete agentgatewaypolicy llm-token-budget -n kserve-test
   kubectl delete httproute mock-llm-ai -n kserve-test
   kubectl delete agentgatewaybackend mock-llm-backend -n kserve-test
   kubectl delete inferenceservice mock-llm -n kserve-test
   kubectl delete namespace kserve-test
   helm uninstall kserve -n kserve
   helm uninstall kserve-crd
   kubectl delete gateway kserve-ingress-gateway -n kserve
   kubectl delete namespace kserve
   ```
