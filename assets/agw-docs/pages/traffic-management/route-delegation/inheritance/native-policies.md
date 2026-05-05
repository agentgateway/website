Learn how policy inheritance and overrides work for Kubernetes Gateway API-native policies in a route delegation setup.

{{< callout type="info" >}}
Want to learn more about policy inheritance and overrides for `AgentgatewayPolicy` resources? See [AgentgatewayPolicy resources]({{< link-hextra path="/traffic-management/route-delegation/inheritance/trafficpolicies/" >}}).
{{< /callout >}}

## About policy inheritance

{{< reuse "agw-docs/snippets/policy-inheritance-native.md" >}}

## Configuration overview

In this guide, you set up a route delegation chain where a child HTTPRoute inherits or overrides a timeout that is set on the parent HTTPRoute. The child routes use a `URLRewrite` filter to expose httpbin's `/delay/N` endpoint, which holds a request open for N seconds. You verify the inherited or overridden timeout by sending a request that takes longer than the timeout to complete.

The following image illustrates the route delegation hierarchy and policy inheritance:

{{< reuse-image src="img/route-delegation-inheritance-native.svg" width="700px" >}}
{{< reuse-image-dark srcDark="img/route-delegation-inheritance-native-dark.svg" width="700px" >}}

**`parent` HTTPRoute**:
* Delegates traffic as follows:
  * `/anything/team1` is delegated to the child HTTPRoute `child-team1` in namespace `team1`. The rule defines a `1s` request timeout.
  * `/anything/team2` is delegated to the child HTTPRoute `child-team2` in namespace `team2`. The rule also defines a `1s` request timeout.

**`child-team1` HTTPRoute**:
* Matches incoming traffic for the `/anything/team1/delay` prefix path. Rewrites the prefix to `/delay` and routes traffic to the httpbin app in the `team1` namespace.
* Does not define a timeout, so it inherits the `1s` timeout from the parent's `/anything/team1` rule.

**`child-team2` HTTPRoute**:
* Matches incoming traffic for the `/anything/team2/delay` prefix path. Rewrites the prefix to `/delay` and routes traffic to the httpbin app in the `team2` namespace.
* Defines a custom `5s` request timeout that overrides the `1s` timeout from the parent's `/anything/team2` rule.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-delegation.md" >}}

## Setup

1. Create the parent HTTPRoute that matches incoming traffic on the `delegation.example` domain. Each rule defines a `1s` request timeout.
   ```yaml {paths="native-policies"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: parent
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
     hostnames:
     - "delegation.example"
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team1
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: child-team1
         namespace: team1
       timeouts:
         request: 1s
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team2
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: child-team2
         namespace: team2
       timeouts:
         request: 1s
   EOF
   ```

2. Create the `child-team1` HTTPRoute. The HTTPRoute matches `/anything/team1/delay` and uses a `URLRewrite` filter to forward traffic to httpbin's `/delay` endpoint. The route does not define a timeout, so the `1s` timeout from the parent is inherited.
   ```yaml {paths="native-policies"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: child-team1
     namespace: team1
   spec:
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team1/delay
       filters:
       - type: URLRewrite
         urlRewrite:
           path:
             type: ReplacePrefixMatch
             replacePrefixMatch: /delay
       backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

3. Create the `child-team2` HTTPRoute. The HTTPRoute matches `/anything/team2/delay`, forwards to httpbin's `/delay` endpoint, and defines a custom `5s` request timeout that overrides the parent's `1s` timeout.
   ```yaml {paths="native-policies"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: child-team2
     namespace: team2
   spec:
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team2/delay
       filters:
       - type: URLRewrite
         urlRewrite:
           path:
             type: ReplacePrefixMatch
             replacePrefixMatch: /delay
       backendRefs:
       - name: httpbin
         port: 8000
       timeouts:
         request: 5s
   EOF
   ```

   {{< doc-test paths="native-policies" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for parent HTTPRoute to be accepted
     wait:
       target:
         kind: HTTPRoute
         metadata:
           namespace: agentgateway-system
           name: parent
       jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

   {{< doc-test paths="native-policies" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/anything/team1/delay/0" -H "host: delegation.example" && break
     sleep 2
   done
   {{< /doc-test >}}

4. Send a request to the `delegation.example` domain along the `/anything/team1/delay/3` path. The httpbin app holds the request open for 3 seconds, but the inherited `1s` timeout cuts the request short. You get a 504 HTTP response after about 1 second.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   time curl -i --max-time 8 http://$INGRESS_GW_ADDRESS:8080/anything/team1/delay/3 \
     -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   time curl -i --max-time 8 localhost:8080/anything/team1/delay/3 \
     -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="native-policies" >}}
   YAMLTest -f - <<'EOF'
   - name: child-team1 inherits parent 1s timeout - returns 504 on /delay/3
     retries: 1
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/delay/3"
       method: GET
       headers:
         host: delegation.example
     source:
       type: local
     expect:
       statusCode: 504
   EOF
   {{< /doc-test >}}

   Example output:
   ```
   HTTP/1.1 504 Gateway Timeout
   content-type: text/plain
   server: agentgateway

   curl ...  total 1.034
   ```

5. Send a request along the `/anything/team2/delay/3` path. The `child-team2` route's `5s` timeout overrides the parent's `1s` timeout, so the 3-second httpbin delay completes. You get a 200 HTTP response after about 3 seconds.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   time curl -i --max-time 8 http://$INGRESS_GW_ADDRESS:8080/anything/team2/delay/3 \
     -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   time curl -i --max-time 8 localhost:8080/anything/team2/delay/3 \
     -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="native-policies" >}}
   YAMLTest -f - <<'EOF'
   - name: child-team2 5s override beats parent 1s - returns 200 on /delay/3
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team2/delay/3"
       method: GET
       headers:
         host: delegation.example
     source:
       type: local
     expect:
       statusCode: 200
   EOF
   {{< /doc-test >}}

   Example output:
   ```
   HTTP/1.1 200 OK
   access-control-allow-credentials: true
   access-control-allow-origin: *
   content-type: application/json; encoding=utf-8
   server: agentgateway

   curl ...  total 3.032
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="native-policies"}
kubectl delete httproute parent -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute child-team1 -n team1
kubectl delete httproute child-team2 -n team2
kubectl delete namespaces team1 team2
```
