Use labels to delegate traffic to child HTTPRoutes. The parent HTTPRoute selects children by a label key and value, instead of by name.

## About label-based selection

In agentgateway, the parent HTTPRoute encodes a label selector in the `backendRefs.name` field by using the `<key>=<value>` syntax. Agentgateway selects any child HTTPRoute in the target namespace whose `metadata.labels[<key>]` equals `<value>`.

Use the label-selector pattern when you want to add new child HTTPRoutes to the delegation chain without updating the parent's `backendRefs` each time. New children only need the agreed-upon label.

The following image illustrates the route delegation hierarchy:

{{< reuse-image src="img/route-delegation-labels.svg" >}}
{{< reuse-image-dark srcDark="img/route-delegation-labels-dark.svg" >}}

**`parent` HTTPRoute**:
* Delegates traffic as follows:
  * `/anything/team1` is delegated to HTTPRoutes in the `team1` namespace that are labeled `team: team1`.
  * `/anything/team2` is delegated to HTTPRoutes in the `team2` namespace that are labeled `team: team2`.

**`child-team1` HTTPRoute**:
* Carries the `team: team1` label and matches incoming traffic for the `/anything/team1/foo` prefix path. Routes traffic to the httpbin app in the `team1` namespace.

**`child-team2` HTTPRoute**:
* Carries the `team: team2` label and matches incoming traffic for the `/anything/team2/bar` exact path. Routes traffic to the httpbin app in the `team2` namespace.

{{< callout type="info" >}}
The label key and value are arbitrary. Pick a convention that makes sense for your environment, such as `team`, `app`, or `tier`. The parent and the children must agree on both the key and the value.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-delegation.md" >}}

## Setup

1. Create the parent HTTPRoute that matches incoming traffic on the `delegation.example` domain. The HTTPRoute specifies two routes:
   * `/anything/team1` delegates to HTTPRoutes in the `team1` namespace that have the `team: team1` label, by encoding `team=team1` in the `backendRefs.name` field.
   * `/anything/team2` delegates to HTTPRoutes in the `team2` namespace that have the `team: team2` label.
   ```yaml {paths="label"}
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
     - delegation.example
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team1
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: team=team1
         namespace: team1
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team2
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: team=team2
         namespace: team2
   EOF
   ```

2. Create the `child-team1` HTTPRoute in the `team1` namespace. The HTTPRoute carries the `team: team1` label and matches traffic on the `/anything/team1/foo` path prefix. Without that label, the parent does not select this child as a delegation target.
   ```yaml {paths="label"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: child-team1
     namespace: team1
     labels:
       team: team1
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

3. Create the `child-team2` HTTPRoute in the `team2` namespace with the `team: team2` label.
   ```yaml {paths="label"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: child-team2
     namespace: team2
     labels:
       team: team2
   spec:
     rules:
     - matches:
       - path:
           type: Exact
           value: /anything/team2/bar
       backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

   {{< doc-test paths="label" >}}
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

   {{< doc-test paths="label" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/anything/team1/foo" -H "host: delegation.example" && break
     sleep 2
   done
   {{< /doc-test >}}

4. Send a request to the `delegation.example` domain along the `/anything/team1/foo` path. Verify that you get a 200 HTTP response.
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

   {{< doc-test paths="label" >}}
   YAMLTest -f - <<'EOF'
   - name: /team1/foo returns 200 via labeled child-team1
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

5. Send a request along the `/anything/team2/bar` path. Verify that you get a 200 HTTP response.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team2/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team2/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="label" >}}
   YAMLTest -f - <<'EOF'
   - name: /team2/bar returns 200 via labeled child-team2
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything/team2/bar"
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

6. Optionally, verify that an unlabeled HTTPRoute in `team1` does not receive traffic from the parent.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: child-team1-unlabeled
     namespace: team1
   spec:
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team1/baz
       backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

   Send a request to `/anything/team1/baz` and verify that you get a 404 HTTP response, because the route is missing the `team: team1` label.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/baz -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/baz -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```
   HTTP/1.1 404 Not Found
   content-type: text/plain
   server: agentgateway
   ```

   Clean up the unlabeled route.
   ```sh
   kubectl delete httproute child-team1-unlabeled -n team1
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="label"}
kubectl delete httproute parent -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute child-team1 -n team1
kubectl delete httproute child-team2 -n team2
kubectl delete namespaces team1 team2
```
