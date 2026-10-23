Dynamically resolve upstream hosts at request time.

## About Dynamic Forward Proxy

Dynamic Forward Proxy (DFP) is a filter in Envoy that allows a gateway proxy to act as a generic HTTP(S) forward proxy without the need to preconfigure all possible upstream hosts. Instead, the DFP dynamically resolves the upstream host at request time by using DNS. 

DFPs are especially useful in highly dynamic environments where services come up and down frequently. Such churn makes it hard for a service registry to list all available endpoints at a given time. With DFP, you do not need to have pre-defined destinations. This approach gives you more flexibility to resolve endpoints as the request comes in. 
	
Another common use case for DFPs is to control and monitor all egress traffic. For example, you can apply policies, such as rate limiting, authentication, authorization, and access logging. You can also easily access metrics for the egress traffic that is routed through the forward proxy. 

DFPs are configured in a Backend resource and an HTTPRoute that routes traffic to the DFP Backend. If a request reaches the gateway proxy, the proxy extracts the host header value from the request and uses DNS to resolve the host to an IP address. Then, the request is forwarded to the resolved IP address.

### Considerations

DFPs offer great flexibility for defining routing patterns for your upstream hosts. However, consider the following downsides when using a DFP:

* You cannot configure failover or client-side load balancing policies for DFP-configured routes because no pre-defined upstream hosts exist that determine the desired upstream service.
* DNS resolution is done at runtime, which can have performance implications. If Envoy detects a new domain name, Envoy pauses the request and synchronously resolves this domain to get the IP address of the endpoint. Then, Envoy caches the IP address locally. 


## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Set up a Dynamic Forward Proxy

1. Create a Backend for the Dynamic Forward Proxy.
   ```yaml {paths="dfp"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: dfp-backend
     namespace: httpbin
   spec:
     dynamicForwardProxy: {}
   EOF
   ```

2. Create an HTTPRoute that routes incoming traffic to the DFP Backend.
   ```yaml {paths="dfp"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     namespace: httpbin
     name: dfp-httproute
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - backendRefs:
           - name: dfp-backend
             group: agentgateway.dev
             kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

{{< doc-test paths="dfp" >}}
YAMLTest -f - <<'EOF'
- name: wait for dfp-httproute HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: dfp-httproute
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="dfp" >}}
YAMLTest -f - <<'EOF'
- name: dfp - request with host httpbin.httpbin.svc.cluster.local returns 200
  retries: 5
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    method: GET
    headers:
      host: httpbin.httpbin.svc.cluster.local:8000
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

3. Send a request to a hostname of your choice, such as `httpbin.org`. The Dynamic Forward Proxy resolves the host at request time and forwards the request to it, so the host's welcome page is returned. Because no upstream hosts are pre-defined in the Backend, you can send a request to any reachable host without changing the configuration. For example, for quick testing, you might send a request with the host header set to an in-cluster service, such as `httpbin.httpbin.svc.cluster.local:8000`.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vik http://$INGRESS_GW_ADDRESS:80 -H "host: httpbin.org" 
   ```
   {{% /tab %}}
   {{% tab name="Port forward for local testing" %}}
   1. Port-forward the gateway proxy on port 8080.
      ```sh
      kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
      ```
   2. Send a request to the gateway proxy.
      ```sh
      curl -vik http://localhost:8080 -H "host: httpbin.org"
      ```
   {{% /tab %}}
   {{< /tabs >}}

  
   Example output: 
   ```console
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...
   <!DOCTYPE html>
   <html lang="en">

   <head>
        <meta charset="UTF-8">
        <title>httpbin.org</title>
        <link rel="stylesheet" type="text/css" href="/flasgger_static/swagger-ui.css">
        <link rel="icon" type="image/png" href="/static/favicon.ico" sizes="64x64 32x32 16x16" />
        <style>
   ...
   ```

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## Loopback and link-local destinations {#loopback-destinations}

A Dynamic Forward Proxy connects to whatever host the request names. Without a limit, any client that can reach the route could also reach services that listen only inside the agentgateway proxy pod or on its node. Examples are the proxy's admin interface on `localhost:15000` and the cloud metadata server at `169.254.169.254`, which can issue cloud credentials. This attack is called server-side request forgery (SSRF).

To prevent this attack, a Dynamic Forward Proxy refuses to connect to the following addresses.

| Address type | IPv4 | IPv6 |
| -- | -- | -- |
| Loopback | `127.0.0.0/8` | `::1` |
| Link-local, including the cloud metadata server | `169.254.0.0/16` | `fe80::/10` |
| Unspecified, which connects to the local host | `0.0.0.0` | `::` |

Review the following details about the check.

* **The check runs after DNS resolution.** A hostname that resolves to one of these addresses, such as `localhost`, is refused too. So is an IPv4 address in IPv4-mapped IPv6 form, such as `::ffff:127.0.0.1`.
* **In-cluster destinations are not refused.** Pod and Service IP addresses are private network addresses, not loopback addresses, so a request to a host such as `httpbin.httpbin.svc.cluster.local:8000` still works.
* **Only the Dynamic Forward Proxy is checked.** Other backends, such as a Service or a static {{< reuse "agw-docs/snippets/backend.md" >}}, are not affected.

A refused request fails with a `503` response and the body `backend not allowed`.

### Allow loopback destinations {#allow-dynamic-loopback}

The {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource has no dedicated field for this setting. To let the Dynamic Forward Proxy connect to loopback and link-local addresses, set `config.backend.allowDynamicLoopback` in `rawConfig`. The following steps show the default behavior first. They use the proxy's readiness endpoint on `localhost:15021` as the local service.

1. Send a request with the host header set to the proxy's own readiness endpoint. The request is refused.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/healthz/ready -H "host: localhost:15021"
   ```
   {{% /tab %}}
   {{% tab name="Port forward for local testing" %}}
   ```sh
   curl -i http://localhost:8080/healthz/ready -H "host: localhost:15021"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console
   HTTP/1.1 503 Service Unavailable
   content-type: text/plain
   content-length: 19

   backend not allowed
   ```

2. Check the proxy logs for the reason.
   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep loopback
   ```

   Example output:
   ```console
   error	request gateway={{< reuse "agw-docs/snippets/namespace.md" >}}/agentgateway-proxy listener=http route=httpbin/dfp-httproute endpoint=localhost:15021 ... http.status=503 protocol=http error="dynamic backend resolved to a loopback or link-local address" reason=NoHealthyBackend
   ```

3. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that allows loopback destinations.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: dfp-loopback
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     rawConfig:
       config:
         backend:
           allowDynamicLoopback: true
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `spec.rawConfig.config.backend.allowDynamicLoopback` | Set to `true` to let every Dynamic Forward Proxy on the Gateway connect to loopback, link-local, and unspecified addresses. The default is `false`. |

4. Reference the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource from the Gateway. If your Gateway already references an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, add the `rawConfig` setting to that resource instead. If the GatewayClass's {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource also sets `rawConfig`, the Gateway's `rawConfig` replaces it as a whole. The two are not merged.
   ```sh
   kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge \
     -p '{"spec":{"infrastructure":{"parametersRef":{"group":"{{< reuse "agw-docs/snippets/group.md" >}}","kind":"{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}","name":"dfp-loopback"}}}}'
   ```

   Example output:
   ```console
   gateway.gateway.networking.k8s.io/agentgateway-proxy patched
   ```

5. Wait for the proxy to restart with the new configuration. The proxy reads `rawConfig` at startup, so the change rolls out new proxy pods.
   ```sh
   kubectl rollout status deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:
   ```console
   Waiting for deployment "agentgateway-proxy" rollout to finish: 1 old replicas are pending termination...
   deployment "agentgateway-proxy" successfully rolled out
   ```

6. Send the request again. If you use port-forwarding, restart the `kubectl port-forward` command first, because the old pod is gone. The proxy now forwards the request to the readiness endpoint.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/healthz/ready -H "host: localhost:15021"
   ```
   {{% /tab %}}
   {{% tab name="Port forward for local testing" %}}
   ```sh
   curl -i http://localhost:8080/healthz/ready -H "host: localhost:15021"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console
   HTTP/1.1 200 OK
   content-type: text/plain
   content-length: 6

   ready
   ```

> [!WARNING]
> This setting applies to every Dynamic Forward Proxy route on the Gateway. A client that can reach one of those routes can then reach every service inside the proxy pod, including the admin interface. Limit the hosts that those routes forward to with HTTPRoute `hostnames`, and limit who can use them with an authorization policy.
{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} dfp-backend -n httpbin
kubectl delete httproute dfp-httproute -n httpbin
```
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
If you allowed loopback destinations, remove the reference from the Gateway and delete the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.

```sh
kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type json \
  -p '[{"op":"remove","path":"/spec/infrastructure/parametersRef"}]'
kubectl delete {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} dfp-loopback -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
{{< /version >}}




