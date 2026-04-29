Create a 3-level route delegation hierarchy with a parent, child, and grandchild HTTPRoute.

## Configuration overview

In this guide, you set up a 3-level route delegation hierarchy. The parent HTTPRoute delegates to a child, and the child delegates to a grandchild that forwards traffic to an httpbin sample app.

The following image illustrates the route delegation hierarchy:

{{< reuse-image src="img/route-delegation-multi-level.svg" >}}
{{< reuse-image-dark srcDark="img/route-delegation-multi-level-dark.svg" >}}

**`parent` HTTPRoute**:
* Delegates traffic as follows:
  * `/anything/team1` is delegated to the child HTTPRoute `child-team1` in namespace `team1`.
  * `/anything/team2` is delegated to the child HTTPRoute `child-team2` in namespace `team2`.

**`child-team1` HTTPRoute**:
* Matches incoming traffic for the `/anything/team1/foo` prefix path and routes that traffic to the httpbin app in the `team1` namespace.

**`child-team2` HTTPRoute**:
* Delegates traffic on the `/anything/team2/grandchild/` prefix to a grandchild HTTPRoute in the `team2` namespace.

**`grandchild` HTTPRoute**:
* Matches incoming traffic for the `/anything/team2/grandchild/.*` regex path and routes that traffic to the httpbin app in the `team2` namespace.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-delegation.md" >}}

## Setup

1. Create the parent HTTPRoute that matches incoming traffic on the `delegation.example` domain. The HTTPRoute specifies two routes:
   * `/anything/team1`: The routing decision is delegated to a child HTTPRoute in the `team1` namespace.
   * `/anything/team2`: The routing decision is delegated to a child HTTPRoute in the `team2` namespace.
   ```yaml {paths="multi-level"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: parent
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     hostnames:
     - delegation.example
     parentRefs:
     - name: agentgateway-proxy
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team1
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: "*"
         namespace: team1
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team2
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: "*"
         namespace: team2
   EOF
   ```

2. Create the `child-team1` HTTPRoute in the `team1` namespace that matches traffic on the `/anything/team1/foo` prefix and routes traffic to the httpbin app.
   ```yaml {paths="multi-level"}
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

3. Create the `child-team2` HTTPRoute in the `team2` namespace that matches traffic on the `/anything/team2/grandchild/` prefix and delegates traffic to a grandchild HTTPRoute in the `team2` namespace. Because the child delegates to a grandchild, the rule must use a `PathPrefix` matcher.
   ```yaml {paths="multi-level"}
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
           value: /anything/team2/grandchild/
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: "*"
         namespace: team2
   EOF
   ```

4. Create a grandchild HTTPRoute that matches traffic on the `/anything/team2/grandchild/.*` regex path and routes traffic to the httpbin app in the `team2` namespace.
   ```yaml {paths="multi-level"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: grandchild
     namespace: team2
   spec:
     rules:
     - matches:
       - path:
           type: RegularExpression
           value: /anything/team2/grandchild/.*
       backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

   {{< doc-test paths="multi-level" >}}
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
   - name: wait for child-team1 HTTPRoute to be accepted
     wait:
       target:
         kind: HTTPRoute
         metadata:
           namespace: team1
           name: child-team1
       jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   - name: wait for child-team2 HTTPRoute to be accepted
     wait:
       target:
         kind: HTTPRoute
         metadata:
           namespace: team2
           name: child-team2
       jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   - name: wait for grandchild HTTPRoute to be accepted
     wait:
       target:
         kind: HTTPRoute
         metadata:
           namespace: team2
           name: grandchild
       jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

   {{< doc-test paths="multi-level" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo" -H "host: delegation.example" && break
     sleep 2
   done
   {{< /doc-test >}}

5. Send a request to the `delegation.example` domain along the `/anything/team1/foo` path. Verify that you get a 200 HTTP response.
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

   {{< doc-test paths="multi-level" >}}
   YAMLTest -f - <<'EOF'
   - name: /anything/team1/foo returns 200 via child-team1
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

6. Send another request to the `delegation.example` domain along the `/anything/team1/bar` path. Verify that you get a 404 HTTP response, because this path is not specified in `child-team1`.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="multi-level" >}}
   YAMLTest -f - <<'EOF'
   - name: /anything/team1/bar returns 404 (no matching child path)
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/bar"
       method: GET
       headers:
         host: delegation.example
     source:
       type: local
     expect:
       statusCode: 404
   EOF
   {{< /doc-test >}}

   Example output:
   ```
   HTTP/1.1 404 Not Found
   content-type: text/plain
   server: agentgateway
   ```

7. Send another request to the `delegation.example` domain. This time, use the `/anything/team2/grandchild/bar` path that is matched by the `grandchild` HTTPRoute. Verify that you get a 200 HTTP response.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team2/grandchild/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team2/grandchild/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="multi-level" >}}
   YAMLTest -f - <<'EOF'
   - name: /anything/team2/grandchild/bar returns 200 via grandchild
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team2/grandchild/bar"
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
   ```

8. Send another request along the `/anything/team2/grandchild/foo` path. Because the grandchild HTTPRoute uses a regular expression to match incoming traffic, any path that begins with `/anything/team2/grandchild/` is routed to the httpbin app in the `team2` namespace.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team2/grandchild/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team2/grandchild/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="multi-level" >}}
   YAMLTest -f - <<'EOF'
   - name: /anything/team2/grandchild/foo returns 200 (regex match)
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team2/grandchild/foo"
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
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="multi-level"}
kubectl delete httproute parent -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute child-team1 -n team1
kubectl delete httproute child-team2 -n team2
kubectl delete httproute grandchild -n team2
kubectl delete namespaces team1 team2
```
