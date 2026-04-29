Use header and query matchers in a route delegation setup.

## Configuration overview

In this guide, you add headers and query parameters as matchers on a parent HTTPRoute and on its children. The delegation chain works only when the child defines the same header and query matchers that the parent defines. You can optionally define additional header or query matchers on the child.

For example, if the parent specifies the `header1` header, the child must also specify a matcher for `header1`.

The following image illustrates the route delegation hierarchy:

{{< reuse-image src="img/route-delegation-header-query.svg" width="800" >}}
{{< reuse-image-dark srcDark="img/route-delegation-header-query-dark.svg" width="800" >}}

**`parent` HTTPRoute**:
* Delegates traffic as follows:
  * `/anything/team1` is delegated to `child-team1` in namespace `team1` for requests that include the `header1: val1` request header and the `query1=val1` query parameter.
  * `/anything/team2` is delegated to `child-team2` in namespace `team2` for requests that include the `header2: val2` request header and the `query2=val2` query parameter.

**`child-team1` HTTPRoute**:
* Matches incoming traffic for the `/anything/team1/foo` prefix path when the request includes the `header1: val1` and `headerX: valX` headers and the `query1=val1` and `queryX=valX` query parameters. Matching requests are forwarded to the httpbin app in the `team1` namespace. The child's headers and query parameters are a superset of the parent's.

**`child-team2` HTTPRoute**:
* Matches incoming traffic for the `/anything/team2/bar` exact path when the request includes the `headerX: valX` header and the `queryX=valX` query parameter. The child does not include the same header and query parameters that the parent specified for the `/anything/team2` route (`header2: val2` and `query2=val2`), so the parent's rule never matches the request and delegation never happens.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-delegation.md" >}}

## Setup

1. Create the parent HTTPRoute that matches incoming traffic on the `delegation.example` domain. The HTTPRoute specifies two routes:
   * Route 1 matches on the following conditions. If they are met, the routing decision is delegated to a child HTTPRoute in the `team1` namespace.
     * path prefix match on `/anything/team1`
     * exact header match on `header1=val1`
     * exact query parameter match on `query1=val1`
   * Route 2 matches on the following conditions. If they are met, the routing decision is delegated to a child HTTPRoute in the `team2` namespace.
     * path prefix match on `/anything/team2`
     * exact header match on `header2=val2`
     * exact query parameter match on `query2=val2`
   ```yaml {paths="header-query"}
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
         headers:
         - type: Exact
           name: header1
           value: val1
         queryParams:
         - type: Exact
           name: query1
           value: val1
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: "*"
         namespace: team1
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team2
         headers:
         - type: Exact
           name: header2
           value: val2
         queryParams:
         - type: Exact
           name: query2
           value: val2
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: "*"
         namespace: team2
   EOF
   ```

2. Create the `child-team1` HTTPRoute in the `team1` namespace that matches traffic on the `/anything/team1/foo` path prefix when the `header1: val1` and `headerX: valX` request headers and the `query1=val1` and `queryX=valX` query parameters are present. Requests that meet these conditions are forwarded to the httpbin app.
   ```yaml {paths="header-query"}
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
         headers:
         - type: Exact
           name: header1
           value: val1
         - type: Exact
           name: headerX
           value: valX
         queryParams:
         - type: Exact
           name: query1
           value: val1
         - type: Exact
           name: queryX
           value: valX
       backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

3. Create the `child-team2` HTTPRoute in the `team2` namespace that matches traffic on the `/anything/team2/bar` exact path when the `headerX: valX` request header and the `queryX=valX` query parameter are present. The child does not restate the parent's `header2: val2` or `query2=val2` matchers, which makes this route invalid for the parent's `/anything/team2` rule.
   ```yaml {paths="header-query"}
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
           type: Exact
           value: /anything/team2/bar
         headers:
         - type: Exact
           name: headerX
           value: valX
         queryParams:
         - type: Exact
           name: queryX
           value: valX
       backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

   {{< doc-test paths="header-query" >}}
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
   EOF
   {{< /doc-test >}}

   {{< doc-test paths="header-query" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null \
       "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo?query1=val1&queryX=valX" \
       -H "host: delegation.example" \
       -H "header1: val1" \
       -H "headerX: valX" && break
     sleep 2
   done
   {{< /doc-test >}}

4. Send a request to the `delegation.example` domain along the `/anything/team1/foo` path with the `header1: val1` request header and the `query1=val1` query parameter. Verify that you get a 404 HTTP response. Although you included the header and query parameter that are defined on the parent, the headers and query parameters that the child also matches on (`headerX` and `queryX`) are missing.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo?query1=val1" \
     -H "host: delegation.example" -H "header1: val1"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i "localhost:8080/anything/team1/foo?query1=val1" \
     -H "host: delegation.example" -H "header1: val1"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="header-query" >}}
   YAMLTest -f - <<'EOF'
   - name: /team1/foo with only parent headers/query returns 404
     retries: 1
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo?query1=val1"
       method: GET
       headers:
         host: delegation.example
         header1: val1
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

5. Send another request along the `/anything/team1/foo` path. This time, include all of the headers and query parameters that the parent and child define. Verify that you get a 200 HTTP response.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo?query1=val1&queryX=valX" \
     -H "host: delegation.example" -H "header1: val1" -H "headerX: valX"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i "localhost:8080/anything/team1/foo?query1=val1&queryX=valX" \
     -H "host: delegation.example" -H "header1: val1" -H "headerX: valX"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="header-query" >}}
   YAMLTest -f - <<'EOF'
   - name: /team1/foo with full superset of headers/query returns 200
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo?query1=val1&queryX=valX"
       method: GET
       headers:
         host: delegation.example
         header1: val1
         headerX: valX
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

6. Send a request along the `/anything/team2/bar` path that is configured on `child-team2`. Include all of the parent's and child's headers and query parameters. Verify that you get a 404 HTTP response. The parent's rule matches `header2` and `query2`, and the child's rule matches `headerX` and `queryX`. Because the child does not also match `header2` and `query2`, the parent's `/anything/team2` rule never selects this child as a valid delegation target.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "http://$INGRESS_GW_ADDRESS:8080/anything/team2/bar?queryX=valX&query2=val2" \
     -H "host: delegation.example" -H "headerX: valX" -H "header2: val2"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i "localhost:8080/anything/team2/bar?queryX=valX&query2=val2" \
     -H "host: delegation.example" -H "headerX: valX" -H "header2: val2"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="header-query" >}}
   YAMLTest -f - <<'EOF'
   - name: /team2/bar returns 404 because child-team2 does not restate parent matchers
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team2/bar?queryX=valX&query2=val2"
       method: GET
       headers:
         host: delegation.example
         headerX: valX
         header2: val2
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

   To make the child eligible for delegation from the parent's `/anything/team2` rule, update `child-team2` to also match on the `header2: val2` request header and `query2=val2` query parameter.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="header-query"}
kubectl delete httproute parent -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute child-team1 -n team1
kubectl delete httproute child-team2 -n team2
kubectl delete namespaces team1 team2
```
