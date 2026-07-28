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

2. Create a `Gateway` resource that agentgateway manages. KServe attaches
   `HTTPRoute` resources to this gateway automatically for each
   `LLMInferenceService` you deploy.
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

1. Install the KServe `LLMInferenceService` CRDs.
   ```shell
   helm install kserve-llmisvc-crd \
     oci://ghcr.io/kserve/charts/kserve-llmisvc-crd \
     --version v0.19.0 \
     --namespace kserve
   ```

2. Install the KServe `LLMInferenceService` resources by using Helm.
   ```shell
   helm install kserve-llmisvc-resources \
     oci://ghcr.io/kserve/charts/kserve-llmisvc-resources \
     --version v0.19.0 \
     --namespace kserve \
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

3. Install the default `LLMInferenceServiceConfig` resources. KServe merges
   these defaults with the settings in each `LLMInferenceService`.

   ```shell
   helm install kserve-runtime-configs \
     oci://ghcr.io/kserve/charts/kserve-runtime-configs \
     --version v0.19.0 \
     --namespace kserve \
     --set kserve.llmisvcConfigs.enabled=true
   ```

4. Verify that the KServe `LLMInferenceService` controller is available.

   ```shell
   kubectl wait --for=condition=available \
     deployment/llmisvc-controller-manager \
     -n kserve \
     --timeout=180s
   kubectl get deployment llmisvc-controller-manager -n kserve
   ```

   Example output:

   ```
   deployment.apps/llmisvc-controller-manager condition met
   NAME                           READY   UP-TO-DATE   AVAILABLE   AGE
   llmisvc-controller-manager     1/1     1            1           45s
   ```

## Step 4: Deploy a mocked LLM with llm-d-inference-sim

Instead of a real model, this guide uses [llm-d-inference-sim](https://github.com/llm-d/llm-d-inference-sim) to serve a mock OpenAI compatible endpoint. llm-d-inference-sim's `/v1/chat/completions` path returns a properly structured OpenAI chat completion response, including `usage.total_tokens` in the response body, which agentgateway reads to enforce token-based rate limits.

1. Create the test namespace.

   ```shell
   kubectl create namespace kserve-test
   ```

2. Create an `{{< reuse "agw-docs/snippets/backend.md" >}}` that points
   to the workload service that KServe creates for the
   `LLMInferenceService`. The backend identifies the endpoint as an
   OpenAI-compatible LLM so that agentgateway can apply LLM-aware features.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: mock-llm-backend
     namespace: kserve-test
   spec:
     ai:
       provider:
         openai:
           model: mock-llm
         host: mock-llm-kserve-workload-svc.kserve-test.svc.cluster.local
         port: 8000
         path: "/v1/chat/completions"
   EOF
   ```

3. Deploy an `LLMInferenceService` that runs llm-d-inference-sim. The
   `spec.router.route.http` settings instruct KServe to generate an
   `HTTPRoute` that references the
   `{{< reuse "agw-docs/snippets/backend.md" >}}` directly. Because the
   simulator does not need model files, the example disables KServe's storage
   initializer.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: serving.kserve.io/v1alpha1
   kind: LLMInferenceService
   metadata:
     name: mock-llm
     namespace: kserve-test
   spec:
     model:
       name: mock-llm
       uri: hf://mock/mock-llm
     replicas: 1
     storageInitializer:
       enabled: false
     router:
       route:
         http:
           spec:
             parentRefs:
               - group: gateway.networking.k8s.io
                 kind: Gateway
                 name: kserve-ingress-gateway
                 namespace: kserve
             hostnames:
               - mock-llm-kserve-test.example.com
             rules:
               - backendRefs:
                   - group: {{< reuse "agw-docs/snippets/group.md" >}}
                     kind: {{< reuse "agw-docs/snippets/backend.md" >}}
                     name: mock-llm-backend
                 matches:
                   - path:
                       type: PathPrefix
                       value: /v1/chat/completions
                 timeouts:
                   backendRequest: 0s
                   request: 0s
     template:
       containers:
         - name: main
           image: ghcr.io/llm-d/llm-d-inference-sim:v0.9.0-rc3
           command:
             - /app/llm-d-inference-sim
           args:
             - --model
             - mock-llm
             - --port
             - "8000"
             - --mode
             - echo
           ports:
             - name: http
               containerPort: 8000
           resources:
             requests:
               cpu: "100m"
               memory: "128Mi"
             limits:
               cpu: "500m"
               memory: "256Mi"
   EOF
   ```

4. Wait for the `LLMInferenceService` to become ready.
   
   ```shell
   kubectl wait --for=condition=Ready \
     llminferenceservice/mock-llm \
     -n kserve-test \
     --timeout=300s
   ```

5. Verify that KServe created one `HTTPRoute` whose backend is the
   `{{< reuse "agw-docs/snippets/backend.md" >}}`.

   ```shell
   kubectl get httproute mock-llm-kserve-route -n kserve-test \
     -o jsonpath='{.spec.rules[0].backendRefs[0]}'
   ```

   Example output:

   ```json
   {"group":"agentgateway.dev","kind":"AgentgatewayBackend","name":"mock-llm-backend","weight":1}
   ```

## Optional Step 4b: Apply a transformation policy to the KServe-generated HTTPRoute

Without a policy, agentgateway forwards requests and responses as-is. This
step shows how a transformation policy can enrich responses with additional
headers — without touching the inference service itself.

1. Verify that KServe created an HTTPRoute after the
   `LLMInferenceService` becomes `Ready`. The route attaches to
   `kserve/kserve-ingress-gateway` with hostname
   `mock-llm-kserve-test.example.com`.
   
   ```shell
   kubectl get httproute mock-llm-kserve-route -n kserve-test -o yaml
   ```

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
2. Get the external address of the gateway and save it in an environment variable.
   ```shell
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kserve kserve-ingress-gateway \
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
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: model-echo-headers
     namespace: kserve-test
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: mock-llm-kserve-route
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
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: model-echo-headers
     namespace: kserve-test
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: mock-llm-kserve-route
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


## Step 5: Test the endpoint

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
1. Get the external address of the gateway and save it in an environment variable.
   ```shell
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kserve kserve-ingress-gateway \
     -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```

2. Send a request to verify the setup works end-to-end.
   ```shell
   curl -s http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Host: mock-llm-kserve-test.example.com" \
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

## Optional Step 6: Apply token-based rate limiting

How token counting works: Agentgateway reads `usage.total_tokens` from the JSON response body returned by the inference service. Each request deducts that many tokens from the bucket. When the bucket empties, subsequent requests receive `429 Too Many Requests` until the next fill interval.

1. Apply an {{< reuse "agw-docs/snippets/policy.md" >}} that caps
   requests at **70 tokens per minute**. The policy targets the KServe-generated
   `mock-llm-kserve-route`, which selects the
   `{{< reuse "agw-docs/snippets/backend.md" >}}`.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: llm-token-budget
     namespace: kserve-test
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: mock-llm-kserve-route
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
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kserve kserve-ingress-gateway \
     -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```

3. Run a burst of requests to trigger the token rate limit. With `tokens: 70` and each response consuming 7 tokens, the budget exhausts after roughly 10 requests.
   ```shell
   for i in $(seq 1 30); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
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
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} -n kserve-test model-echo-headers
   kubectl delete llminferenceservice mock-llm -n kserve-test
   kubectl delete agentgatewaybackend mock-llm-backend -n kserve-test
   kubectl delete namespace kserve-test
   helm uninstall kserve-runtime-configs -n kserve
   helm uninstall kserve-llmisvc-resources -n kserve
   helm uninstall kserve-llmisvc-crd -n kserve
   kubectl delete gateway kserve-ingress-gateway -n kserve
   kubectl delete namespace kserve
   ```
