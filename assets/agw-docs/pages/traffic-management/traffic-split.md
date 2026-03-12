Set up weight-based routing between multiple apps for A/B testing, traffic splitting, and canary deployments.

## About A/B testing and traffic splitting {#about}

A/B testing, traffic splitting, and canary deployments are techniques for gradually introducing changes by distributing traffic across multiple versions of an app or service based on weight percentages.

**Common use cases:**

- **A/B testing**: Compare two versions of an app by routing a percentage of traffic to each version to measure performance, user engagement, or business metrics.
- **Traffic splitting**: Distribute load across multiple backends, such as different LLM models or providers, to balance cost, performance, or capacity.
- **Canary deployments**: Gradually roll out a new version of your app by routing a small percentage of traffic to the new version, then increasing the percentage as confidence grows.

These patterns use weighted `backendRefs` in HTTPRoute (a standard Gateway API feature) to control the percentage of requests sent to each backend. Unlike [failover]({{< link-hextra path="/llm/failover/" >}}), which uses priority groups to switch between backends when one fails, traffic splitting distributes traffic based on static weight ratios.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Example 1: A/B testing with multiple app versions {#app-versions}

This example demonstrates A/B testing and canary deployments by distributing traffic across 3 versions of the Helloworld sample app.

### Deploy the Helloworld sample app 

1. Create the helloworld namespace.  
   ```sh
   kubectl create namespace helloworld
   ```

2. Deploy the Hellworld sample apps. 
   ```sh
   kubectl -n helloworld apply -f https://raw.githubusercontent.com/solo-io/gloo-edge-use-cases/main/docs/sample-apps/helloworld.yaml
   ```

   Example output: 
   ```
   service/helloworld-v1 created
   service/helloworld-v2 created
   service/helloworld-v3 created
   deployment.apps/helloworld-v1 created
   deployment.apps/helloworld-v2 created
   deployment.apps/helloworld-v3 created
   ```

3. Verify that the Helloworld pods are up and running. 
   ```sh
   kubectl -n default get pods -n helloworld
   ```

   Example output: 
   ```
   NAME                             READY   STATUS    RESTARTS   AGE
   helloworld-v1-5c457458f-rfkc7    3/3     Running   0          30s
   helloworld-v2-6594c54f6b-8dvjp   3/3     Running   0          29s
   helloworld-v3-8576f76d87-czdll   3/3     Running   0          29s
   ```

### Set up weighted routing

1. Create an HTTPRoute resource for the `traffic.split.example` domain that routes 10% of the traffic to `helloworld-v1`, 10% to `helloworld-v2`, and 80% to `helloworld-v3`.

   This configuration demonstrates a canary deployment pattern where version 3 (the stable version) receives most traffic while versions 1 and 2 (canary versions) receive smaller amounts for testing.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: traffic-split
     namespace: helloworld
   spec:
     parentRefs:
     - name: http
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
     - traffic.split.example
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /
       backendRefs:
       - name: helloworld-v1
         port: 5000
         weight: 10
       - name: helloworld-v2
         port: 5000
         weight: 10
       - name: helloworld-v3
         port: 5000
         weight: 80
   EOF
   ```

   |Setting|Description|
   |--|--|
   |`spec.parentRefs.name`|The name and namespace of the gateway resource that serves the route. In this example, you use the gateway that you created when you set up the [Sample app]({{< link-hextra path="/install/sample-app#deploy-app/" >}}). |
   |`spec.hostnames`| The hostname for which you want to apply traffic splitting.|
   |`spec.rules.matches.path`|The path prefix to match on. In this example, `/` is used. |
   |`spec.rules.backendRefs`| A list of services you want to forward traffic to. Use the `weight` option to define the amount of traffic that you want to forward to each service. |

2. Verify that the HTTPRoute is applied successfully. 
   ```sh
   kubectl get httproute/traffic-split -n helloworld -o yaml
   ```

3. Send a few requests to the `/hello` path. Verify that you see responses from all 3 Helloworld apps, and that most responses are returned from `helloworld-v3`. 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in {1..20}; do curl -i http://$INGRESS_GW_ADDRESS:80/hello \
   -H "host: traffic.split.example:8080"; done
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   for i in {1..20}; do curl -i localhost:8080/hello \
   -H "host: traffic.split.example"; done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```
   HTTP/1.1 200 OK
   server: envoy
   date: Wed, 12 Mar 2025 20:59:35 GMT
   content-type: text/html; charset=utf-8
   content-length: 60
   x-envoy-upstream-service-time: 110

   Hello version: v3, instance: helloworld-v3-55bfdf76cf-nv545
   ```

## Example 2: A/B testing with LLM models {#llm-models}

This example demonstrates traffic splitting for LLM workloads, distributing requests across multiple models or providers for cost optimization or A/B testing.

### Set up weighted routing for LLM models

1. Create separate {{< reuse "agw-docs/snippets/backend.md" >}} resources for each model you want to include in the traffic split.

   This example creates two backends: one for the cheaper `gpt-4o-mini` model and one for the more capable `gpt-4o` model.

   ```yaml,paths="traffic-split-llm"
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openai-mini-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: gpt-4o-mini
     policies:
       auth:
         secretRef:
           name: openai-secret
   ---
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openai-premium-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: gpt-4o
     policies:
       auth:
         secretRef:
           name: openai-secret
   EOF
   ```

2. Create an HTTPRoute resource with weighted `backendRefs` to distribute traffic between the two backends.

   This example routes 80% of traffic to the cheaper `gpt-4o-mini` model and 20% to the more capable `gpt-4o` model, allowing you to optimize costs while testing the premium model's performance.

   ```yaml,paths="traffic-split-llm"
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: test
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /test
       backendRefs:
       - name: openai-mini-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         weight: 80
       - name: openai-premium-backend
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: agentgateway.dev
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         weight: 20
   EOF
   ```

   |Setting|Description|
   |--|--|
   |`spec.rules[].backendRefs[].weight`| The relative weight for traffic distribution. In this example, weights of 80 and 20 result in an 80/20 traffic split. The default weight is 1 if not specified. |

3. Send multiple requests to observe the traffic distribution. In your request, do not specify a model. Instead, the HTTPRoute distributes traffic according to the backend weights (80% to gpt-4o-mini, 20% to gpt-4o).

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```bash
   for i in {1..10}; do
     curl -s "$INGRESS_GW_ADDRESS/test" \
       -H "Content-Type: application/json" \
       -d '{"messages": [{"role": "user", "content": "What is 2+2?"}]}' | \
       jq -r '.model'
   done
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```bash
   for i in {1..10}; do
     curl -s "localhost:8080/test" \
       -H "Content-Type: application/json" \
       -d '{"messages": [{"role": "user", "content": "What is 2+2?"}]}' | \
       jq -r '.model'
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output showing ~80% gpt-4o-mini and ~20% gpt-4o responses:
   ```
   gpt-4o-mini-2024-07-18
   gpt-4o-mini-2024-07-18
   gpt-4o-2024-08-06
   gpt-4o-mini-2024-07-18
   gpt-4o-mini-2024-07-18
   gpt-4o-mini-2024-07-18
   gpt-4o-mini-2024-07-18
   gpt-4o-2024-08-06
   gpt-4o-mini-2024-07-18
   gpt-4o-mini-2024-07-18
   ```

{{< doc-test paths="traffic-split-llm" >}}
# Test that traffic is being split between models
# Send multiple requests and verify we get valid responses with model names
YAMLTest -f - <<'EOF'
- name: verify traffic split returns valid responses
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/test"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    jsonPath:
      - path: "$.model"
        comparator: exists
      - path: "$.choices[0].message.content"
        comparator: exists
EOF
{{< /doc-test >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Remove the backends and routes.
   ```sh
   kubectl delete httproute traffic-split -n helloworld
   kubectl delete httproute test -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} openai-mini-backend openai-premium-backend -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Remove the Helloworld apps. 
   ```sh
   kubectl delete -n helloworld -f https://raw.githubusercontent.com/solo-io/gloo-edge-use-cases/main/docs/sample-apps/helloworld.yaml
   ```
