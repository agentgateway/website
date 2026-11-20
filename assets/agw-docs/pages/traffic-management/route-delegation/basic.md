Set up basic route delegation between a parent HTTPRoute and two child HTTPRoutes.

## Configuration overview

In this guide, you set up route delegation from a parent HTTPRoute to two child HTTPRoutes that forward traffic to an httpbin sample app.

The following image illustrates the route delegation hierarchy:

{{< reuse-image-light src="img/route-delegation-basic.svg" >}}
{{< reuse-image-dark srcDark="img/route-delegation-basic-dark.svg" >}}

**`parent` HTTPRoute**:
* Delegates traffic as follows:
  * `/anything/team1` is delegated to the child HTTPRoute `child-team1` in namespace `team1`.
  * `/anything/team2` is delegated to the child HTTPRoute `child-team2` in namespace `team2`.

**`child-team1` HTTPRoute**:
* Matches incoming traffic for the `/anything/team1/foo` prefix path and routes that traffic to the httpbin app in the `team1` namespace.
* Does not select a specific parent in `parentRefs`. Any parent HTTPRoute in the delegation chain that matches its namespace and name can delegate to it.

**`child-team2` HTTPRoute**:
* Matches incoming traffic for the `/anything/team2/bar` exact path and routes that traffic to the httpbin app in the `team2` namespace.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-delegation.md" >}}

## Setup

1. Create the parent HTTPRoute that matches incoming traffic on the `delegation.example` domain. The HTTPRoute specifies two routes:
   * `/anything/team1`: The routing decision is delegated to a child HTTPRoute in the `team1` namespace.
   * `/anything/team2`: The routing decision is delegated to a child HTTPRoute in the `team2` namespace.
   ```yaml
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
         name: child-team1
         namespace: team1
     - matches:
       - path:
           type: PathPrefix
           value: /anything/team2
       backendRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: child-team2
         namespace: team2
   EOF
   ```

2. Create the child HTTPRoute for the `team1` namespace that matches traffic on the `/anything/team1/foo` prefix and routes traffic to the httpbin app.
   ```yaml
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

3. Create the child HTTPRoute for the `team2` namespace that matches traffic on the `/anything/team2/bar` exact path and routes traffic to the httpbin app. The HTTPRoute selects the `parent` HTTPRoute in the `parentRefs` field, so the controller reports status back to that parent.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: child-team2
     namespace: team2
   spec:
     parentRefs:
     - name: parent
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
       group: gateway.networking.k8s.io
       kind: HTTPRoute
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

4. Inspect the parent and child HTTPRoutes.
   ```sh
   kubectl get httproute parent -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get httproute child-team1 -n team1
   kubectl get httproute child-team2 -n team2
   ```

   Note that only the parent HTTPRoute has the `delegation.example` hostname.

   ```
   NAME     HOSTNAMES                AGE
   parent   ["delegation.example"]   22s
   NAME          HOSTNAMES   AGE
   child-team1               12s
   NAME          HOSTNAMES   AGE
   child-team2               6s   
   ```

5. Send a request to the `delegation.example` domain along the `/anything/team1/foo` path. Verify that you get a 200 HTTP response.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/foo -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```
   HTTP/1.1 200 OK
   access-control-allow-credentials: true
   access-control-allow-origin: *
   content-type: application/json; encoding=utf-8
   server: agentgateway
   ```

6. Send another request to the `delegation.example` domain along the `/anything/team1/bar` path. Verify that you get a 404 HTTP response, because `child-team1` only matches the `/anything/team1/foo` path.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team1/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team1/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```
   HTTP/1.1 404 Not Found
   content-type: text/plain
   server: agentgateway
   ```

7. Send another request to the `delegation.example` domain along the `/anything/team2/bar` path that is configured on `child-team2`. Verify that you get a 200 HTTP response.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team2/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team2/bar -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```
   HTTP/1.1 200 OK
   access-control-allow-credentials: true
   access-control-allow-origin: *
   content-type: application/json; encoding=utf-8
   server: agentgateway
   ```

8. Send another request along the `/anything/team2/bar/test` path. Verify that you get a 404 HTTP response, because `child-team2` matches traffic only on the `/anything/team2/bar` exact path.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:8080/anything/team2/bar/test -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/anything/team2/bar/test -H "host: delegation.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```
   HTTP/1.1 404 Not Found
   content-type: text/plain
   server: agentgateway
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete httproute parent -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute child-team1 -n team1
kubectl delete httproute child-team2 -n team2
kubectl delete namespaces team1 team2
```
