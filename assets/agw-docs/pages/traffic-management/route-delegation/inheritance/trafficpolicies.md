Learn how policy inheritance and overrides work for `AgentgatewayPolicy` resources in a route delegation setup.

{{< callout type="info" >}}
Want to learn more about policy inheritance and overrides for Kubernetes Gateway API-native policies, such as timeouts and retries? See [Native Gateway API policies]({{< link-hextra path="/traffic-management/route-delegation/inheritance/native-policies/" >}}).
{{< /callout >}}

## About policy inheritance

{{< reuse "agw-docs/snippets/policy-inheritance.md" >}}

In short, for most policy types the child's policy overrides the parent's. If the child does not define a particular policy, the child inherits the parent's policy. Authorization rules are an exception, and merge across the chain.

## Configuration overview

In this guide, you walk through two route delegation examples.

1. **Transformation and rate limit**: A parent `AgentgatewayPolicy` defines both a transformation and a local rate limit. The child `AgentgatewayPolicy` defines only a transformation. You verify that the child's transformation overrides the parent's, but the parent's rate limit still applies because the child does not define one.
2. **Authorization merge**: A parent `AgentgatewayPolicy` and a child `AgentgatewayPolicy` each define a `Require` authorization rule. You verify that both rules must match for the request to be allowed.

The following image illustrates the route delegation hierarchy:

**`parent` HTTPRoute**:
* Delegates traffic on the `/anything/team1` prefix to HTTPRoutes in the `team1` namespace.

**`child-team1` HTTPRoute**:
* Matches incoming traffic for the `/anything/team1/foo` prefix path and routes that traffic to the httpbin app in the `team1` namespace.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-delegation.md" >}}

## Set up the routes

1. Create the parent HTTPRoute that matches incoming traffic on the `delegation.example` domain and delegates to HTTPRoutes in the `team1` namespace.
   ```yaml {paths="trafficpolicies"}
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
   EOF
   ```

2. Create the `child-team1` HTTPRoute in the `team1` namespace that matches traffic on the `/anything/team1/foo` prefix and routes traffic to the httpbin app.
   ```yaml {paths="trafficpolicies"}
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
           value: /anything/team1/foo
       backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

   {{< doc-test paths="trafficpolicies" >}}
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

   {{< doc-test paths="trafficpolicies" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo" -H "host: delegation.example" && break
     sleep 2
   done
   {{< /doc-test >}}

## Transformation override and rate limit inheritance

In this section, you attach an `AgentgatewayPolicy` to the parent and a different `AgentgatewayPolicy` to the child. The parent policy defines both a transformation and a local rate limit. The child policy defines only a transformation. The child's transformation overrides the parent's. The child does not define a rate limit, so the parent's rate limit is inherited.

1. Create an `AgentgatewayPolicy` that targets the `parent` HTTPRoute. The policy adds an `x-parent-policy` header to requests and limits requests to 1 per minute.
   ```yaml {paths="trafficpolicies"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: parent-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: parent
     traffic:
       transformation:
         request:
           set:
           - name: x-parent-policy
             value: "'This policy is inherited from the parent.'"
       rateLimit:
         local:
         - requests: 1
           unit: Minutes
   EOF
   ```

2. Create an `AgentgatewayPolicy` that targets the `child-team1` HTTPRoute. The policy adds an `x-child-policy` header to requests. It does not define a rate limit.
   ```yaml {paths="trafficpolicies"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: child-policy
     namespace: team1
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: child-team1
     traffic:
       transformation:
         request:
           set:
           - name: x-child-policy
             value: "'This is the child-team1 policy.'"
   EOF
   ```

3. Verify that both policies are accepted.
   ```sh
   kubectl get agentgatewaypolicy parent-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get agentgatewaypolicy child-policy -n team1
   ```

   Example output:
   ```
   NAME            ACCEPTED   ATTACHED   AGE
   parent-policy   True       True       3s
   NAME           ACCEPTED   ATTACHED   AGE
   child-policy   True       True       3s
   ```

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for parent-policy to be attached
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: parent-policy
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 5
   - name: wait for child-policy to be attached
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: team1
           name: child-policy
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

4. Send a request to the `delegation.example` domain along the `/anything/team1/foo` path. Verify that the response includes the `X-Child-Policy` header but not the `X-Parent-Policy` header. The child's transformation overrides the parent's because both define the same `transformation` policy.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -s localhost:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: child transformation wins over parent transformation
     retries: 1
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
       method: GET
       headers:
         host: delegation.example
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.headers.X-Child-Policy[0]"
           comparator: contains
           value: "This is the child-team1 policy."
   EOF
   {{< /doc-test >}}

   Example output (truncated):
   ```json
   {
     "headers": {
       "Host": ["delegation.example"],
       "X-Child-Policy": ["This is the child-team1 policy."]
     }
   }
   ```

5. Send a second request to the same path within one minute. Verify that you get a 429 HTTP response, because the child inherits the parent's rate limit of 1 request per minute.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: second request hits inherited parent rate limit
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
       method: GET
       headers:
         host: delegation.example
     source:
       type: local
     expect:
       statusCode: 429
   EOF
   {{< /doc-test >}}

   Example output:
   ```
   HTTP/1.1 429 Too Many Requests
   content-type: text/plain
   server: agentgateway

   local_rate_limited
   ```

6. Delete both policies before continuing to the next section.
   ```sh {paths="trafficpolicies"}
   kubectl delete agentgatewaypolicy parent-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete agentgatewaypolicy child-policy -n team1
   ```

## Authorization merging

In this section, you attach a `Require` authorization rule to the parent and a different `Require` authorization rule to the child. Authorization policies merge across the delegation chain, so both rules must be satisfied for the request to be allowed.

1. Create an `AgentgatewayPolicy` that targets the `parent` HTTPRoute. The policy requires the `x-parent-required: true` request header.
   ```yaml {paths="trafficpolicies"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: parent-authz
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: parent
     traffic:
       authorization:
         action: Require
         policy:
           matchExpressions:
           - 'request.headers["x-parent-required"] == "true"'
   EOF
   ```

2. Create an `AgentgatewayPolicy` that targets the `child-team1` HTTPRoute. The policy requires the `x-child-required: true` request header.
   ```yaml {paths="trafficpolicies"}
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: child-authz
     namespace: team1
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: child-team1
     traffic:
       authorization:
         action: Require
         policy:
           matchExpressions:
           - 'request.headers["x-child-required"] == "true"'
   EOF
   ```

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for parent-authz to be attached
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: parent-authz
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 5
   - name: wait for child-authz to be attached
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: team1
           name: child-authz
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Attached')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

3. Send a request without either header. Verify that you get a 403 HTTP response, because both `Require` rules must match.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: no headers - 403 (both Require rules unmet)
     retries: 1
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
       method: GET
       headers:
         host: delegation.example
     source:
       type: local
     expect:
       statusCode: 403
   EOF
   {{< /doc-test >}}

   Example output:
   ```
   HTTP/1.1 403 Forbidden
   content-type: text/plain
   server: agentgateway
   ```

4. Send a request with only the parent's required header. Verify that you still get a 403 HTTP response, because the child's `Require` rule is not satisfied.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo \
     -H "host: delegation.example" \
     -H "x-parent-required: true"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/foo \
     -H "host: delegation.example" \
     -H "x-parent-required: true"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: only x-parent-required - 403 (child Require unmet)
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
       method: GET
       headers:
         host: delegation.example
         x-parent-required: "true"
     source:
       type: local
     expect:
       statusCode: 403
   EOF
   {{< /doc-test >}}

   Example output:
   ```
   HTTP/1.1 403 Forbidden
   content-type: text/plain
   server: agentgateway
   ```

5. Send a request with only the child's required header. Verify that you still get a 403 HTTP response, because the parent's `Require` rule is not satisfied.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo \
     -H "host: delegation.example" \
     -H "x-child-required: true"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/foo \
     -H "host: delegation.example" \
     -H "x-child-required: true"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: only x-child-required - 403 (parent Require unmet)
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
       method: GET
       headers:
         host: delegation.example
         x-child-required: "true"
     source:
       type: local
     expect:
       statusCode: 403
   EOF
   {{< /doc-test >}}

   Example output:
   ```
   HTTP/1.1 403 Forbidden
   content-type: text/plain
   server: agentgateway
   ```

6. Send a request with both required headers. Verify that you get a 200 HTTP response, because both the parent's and child's `Require` rules match.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo \
     -H "host: delegation.example" \
     -H "x-parent-required: true" \
     -H "x-child-required: true"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/foo \
     -H "host: delegation.example" \
     -H "x-parent-required: true" \
     -H "x-child-required: true"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="trafficpolicies" >}}
   YAMLTest -f - <<'EOF'
   - name: both required headers - 200 (both Require rules met)
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo"
       method: GET
       headers:
         host: delegation.example
         x-parent-required: "true"
         x-child-required: "true"
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
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="trafficpolicies"}
kubectl delete agentgatewaypolicy parent-authz -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete agentgatewaypolicy child-authz -n team1 --ignore-not-found
kubectl delete agentgatewaypolicy parent-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete agentgatewaypolicy child-policy -n team1 --ignore-not-found
kubectl delete httproute parent -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute child-team1 -n team1
kubectl delete namespaces team1 team2
```
