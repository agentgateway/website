[KServe](https://kserve.github.io/website/) is a Kubernetes-native platform for serving machine learning models. With agentgateway in front of KServe, you can enforce traffic management policies, such as token-based rate limiting, for inference requests without modifying your inference services.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Step 1: Install cert-manager

1. Install cert-manager, which KServe requires for webhook certificates.
   
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

3. Verify that the Gateway is programmed.

   ```shell
   kubectl get gateway kserve-ingress-gateway -n kserve
   ```

   Example output:

   ```
   NAME                     CLASS          ADDRESS   PROGRAMMED   AGE
   kserve-ingress-gateway   agentgateway             True         11s
   ```

## Step 3: Install KServe

1. Install the KServe CRDs.
   ```shell
   helm install kserve-crd oci://ghcr.io/kserve/charts/kserve-crd --version v0.19.0
   ```

2. Install KServe resources using Helm.
   ```shell
   helm install kserve oci://ghcr.io/kserve/charts/kserve-resources \
     --version v0.19.0 \
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

3. Verify that the KServe controller is available.

   ```shell
   kubectl wait --for=condition=available deployment/kserve-controller-manager -n kserve --timeout=180s
   kubectl get deployment kserve-controller-manager -n kserve
   ```

   Example output:

   ```
   deployment.apps/kserve-controller-manager condition met
   NAME                        READY   UP-TO-DATE   AVAILABLE   AGE
   kserve-controller-manager   1/1     1            1           45s
   ```

## Step 4: Deploy a mocked LLM with llm-d-inference-sim

Instead of a real model, this guide uses [llm-d-inference-sim](https://github.com/llm-d/llm-d-inference-sim) to serve a mock OpenAI compatible endpoint. llm-d-inference-sim's `/v1/chat/completions` path returns a properly structured OpenAI chat completion response, including `usage.total_tokens` in the response body, which agentgateway reads to enforce token-based rate limits.

1. Create the test namespace.

   ```shell
   kubectl create namespace kserve-test
   ```

2. Deploy an `InferenceService` using llm-d-inference-sim directly via `spec.predictor.containers`. This approach bypasses KServe's model runtime machinery entirely, no `ClusterServingRuntime` or model storage is needed.
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
           image: ghcr.io/llm-d/llm-d-inference-sim:v0.9.0-rc3
           args:
             - --model
             - mock-llm
             - --port
             - "8080"
             - --mode
             - echo
           ports:
             - containerPort: 8080
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

3. Wait for the `InferenceService` to become ready.
   
   ```shell
   kubectl get inferenceservices mock-llm -n kserve-test --watch
   ```
   
## Optional Step 4b: Apply a transformation policy to the KServe-generated HTTPRoute

Without a policy, agentgateway forwards requests and responses as-is. This
step shows how a transformation policy can enrich responses with additional
headers — without touching the inference service itself.

1. Verify that KServe created an HTTPRoute after the Gateway becomes `READY`. The route attaches to `kserve/kserve-ingress-gateway` with hostname `mock-llm-kserve-test.example.com`.
   
   ```shell
   kubectl get httproute mock-llm -n kserve-test -o yaml
   ```

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
2. Get the external address of the gateway and save it in an environment variable.
   ```shell
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kserve agentgateway-proxy \
     -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```

3. Confirm that the response contains no custom headers.
   ```shell
   curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Host: mock-llm-kserve-test.example.com" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mock-llm",
       "messages": [{"role": "user", "content": "Hello"}]
     }' -v 2>&1 | grep "^<"
   ```

   Example Output:
   ```shell
   < HTTP/1.1 200 OK
   < server: fasthttp
   < date: Mon, 18 May 2026 21:55:33 GMT
   < content-type: application/json
   < content-length: 353
   ```

4. Apply a transformation policy that reads the model name from the request and response body and injects them as response headers.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: model-echo-headers
     namespace: kserve-test
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: mock-llm
     traffic:
       transformation:
         response:
           set:
             - name: x-requested-model
               value: 'string(json(request.body).model)'
             - name: x-actual-model
               value: 'string(json(response.body).model)'
   EOF
   ```

5. Send the same request again and check the headers.
   ```shell
   curl -s -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Host: mock-llm-kserve-test.example.com" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mock-llm",
       "messages": [{"role": "user", "content": "Hello"}]
     }' -v 2>&1 | grep "^<"
   ```
   Example output:
   ```shell
   < HTTP/1.1 200 OK
   < server: fasthttp
   < date: Mon, 18 May 2026 21:56:12 GMT
   < content-type: application/json
   < content-length: 353
   < x-requested-model: mock-llm
   < x-actual-model: mock-llm
   ```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
2. Port-forward the gateway to your local machine.

   ```shell
   kubectl port-forward -n kserve svc/kserve-ingress-gateway 8080:80
   ```

3. Confirm that the response contains no custom headers.
   ```shell
   curl -s -X POST http://localhost:8080/v1/chat/completions \
     -H "Host: mock-llm-kserve-test.example.com" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mock-llm",
       "messages": [{"role": "user", "content": "Hello"}]
     }' -v 2>&1 | grep "^<"
   ```

   Example Output:
   ```shell
   < HTTP/1.1 200 OK
   < server: fasthttp
   < date: Mon, 18 May 2026 21:55:33 GMT
   < content-type: application/json
   < content-length: 353
   ```

4. Apply a transformation policy that reads the model name from the request and response body and injects them as response headers.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: model-echo-headers
     namespace: kserve-test
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: mock-llm
     traffic:
       transformation:
         response:
           set:
             - name: x-requested-model
               value: 'string(json(request.body).model)'
             - name: x-actual-model
               value: 'string(json(response.body).model)'
   EOF
   ```

5. Send the same request again and check the headers.
   ```shell
   curl -s -X POST http://localhost:8080/v1/chat/completions \
     -H "Host: mock-llm-kserve-test.example.com" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mock-llm",
       "messages": [{"role": "user", "content": "Hello"}]
     }' -v 2>&1 | grep "^<"
   ```
   Example output:
   ```shell
   < HTTP/1.1 200 OK
   < server: fasthttp
   < date: Mon, 18 May 2026 21:56:12 GMT
   < content-type: application/json
   < content-length: 353
   < x-requested-model: mock-llm
   < x-actual-model: mock-llm
   ```
{{% /tab %}}
{{< /tabs >}}


## Step 5: Create a backend

KServe generates the `HTTPRoute` with a plain Kubernetes `Service` as the `backendRef`. However, to apply a token-based rate limiting policy, agentgateway needs the backend to be an {{< reuse "agw-docs/snippets/backend.md" >}}. This way, agentgateway knows that the backend is an LLM that has a response body with the `usage.total_tokens` field to count against the rate limit bucket. In the following steps, you create an {{< reuse "agw-docs/snippets/backend.md" >}} and a second HTTPRoute to route to it as a workaround to the KServe-created, Service-based setup.

1. Create an `{{< reuse "agw-docs/snippets/backend.md" >}}` that points at the llm-d-inference-sim service.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
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
         path: "/v1/chat/completions"
   EOF
   ```

2. Create a second `HTTPRoute` that routes to the `{{< reuse "agw-docs/snippets/backend.md" >}}`. This route uses the same hostname as the KServe-generated route but matches only the `/v1/chat/completions` path, so the gateway prefers it for LLM traffic.
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
               value: /v1/chat/completions
         backendRefs:
           - name: mock-llm-backend
             namespace: kserve-test
             group: {{< reuse "agw-docs/snippets/trafficpolicy-group.md" >}}
             kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

## Step 6: Test the endpoint

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
1. Get the external address of the gateway and save it in an environment variable.
   ```shell
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kserve agentgateway-proxy \
     -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```

2. Send a request to verify the setup works end-to-end.
   ```shell
   curl -s http://$INGRESS_GW_ADDRESS/v1/chat/completions \
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
     "model": "mock-llm",
     "usage": {
       "prompt_tokens": 6,
       "completion_tokens": 1,
       "total_tokens": 7,
       "prompt_tokens_detail": {
         "cached_tokens": 0
       }
     },
     "choices": [
       {
         "message": {
           "content": "Hello",
           "role": "assistant"
         },
         "index": 0,
         "finish_reason": "stop"
       }
     ],
     "id": "chatcmpl-98473698-57bc-5d69-b91e-af0aace83ac9",
     "object": "chat.completion",
     "kv_transfer_params": null,
     "created": 1779134384
   }
   ```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
1. Port-forward the gateway to your local machine.

   ```shell
   kubectl port-forward -n kserve svc/kserve-ingress-gateway 8080:80
   ```

2. Send a single request to confirm the setup works end-to-end.

   ```shell
   curl -s -X POST http://localhost:8080/v1/chat/completions \
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
     "model": "mock-llm",
     "usage": {
       "prompt_tokens": 6,
       "completion_tokens": 1,
       "total_tokens": 7,
       "prompt_tokens_detail": {
         "cached_tokens": 0
       }
     },
     "choices": [
       {
         "message": {
           "content": "Hello",
           "role": "assistant"
         },
         "index": 0,
         "finish_reason": "stop"
       }
     ],
     "id": "chatcmpl-98473698-57bc-5d69-b91e-af0aace83ac9",
     "object": "chat.completion",
     "kv_transfer_params": null,
     "created": 1779134384
   }
   ```
{{% /tab %}}
{{< /tabs >}}

## Optional Step 7: Apply token-based rate limiting

How token counting works: Agentgateway reads `usage.total_tokens` from the JSON response body returned by the inference service. Each request deducts that many tokens from the bucket. When the bucket empties, subsequent requests receive `429 Too Many Requests` until the next fill interval.

1. Apply an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that caps requests at **70 tokens per minute**. The policy targets the `mock-llm-ai` route that selects the `{{< reuse "agw-docs/snippets/backend.md" >}}`.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
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
           - tokens: 70
             unit: Minutes
   EOF
   ```

2. Verify the policy is accepted and attached. Both `Accepted` and `Attached` conditions must be `True`.
   ```shell
   kubectl get agentgatewaypolicy llm-token-budget -n kserve-test \
     -o jsonpath='{.status.ancestors[0].conditions}'
   ```

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
3. Get the external address of the gateway and save it in an environment variable.
   ```shell
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kserve agentgateway-proxy \
     -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```

3. Run a burst of requests to trigger the token rate limit. With `tokens: 70` and each response consuming 7 tokens, the budget exhausts after roughly 10 requests.
   ```shell
   for i in $(seq 1 30); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
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
   200
   200
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
{{% tab name="Port-forward for local testing" %}}
3. Port-forward the gateway to your local machine.

   ```shell
   kubectl port-forward -n kserve svc/kserve-ingress-gateway 8080:80
   ```

4. Run a burst of requests to trigger the token rate limit. With `tokens: 70` and each response consuming 7 tokens, the budget exhausts after roughly 10 requests.

   ```shell
   for i in $(seq 1 30); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://localhost:8080/v1/chat/completions \
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
   200
   200
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
   kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} -n kserve-test model-echo-headers
   kubectl delete httproute mock-llm-ai -n kserve-test
   kubectl delete agentgatewaybackend mock-llm-backend -n kserve-test
   kubectl delete inferenceservice mock-llm -n kserve-test
   kubectl delete namespace kserve-test
   helm uninstall kserve -n kserve
   helm uninstall kserve-crd
   kubectl delete gateway kserve-ingress-gateway -n kserve
   kubectl delete namespace kserve
   ```
