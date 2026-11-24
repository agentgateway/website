Cap the number of requests and connections that clients can open to the gateway proxy at the same time. Over a limit, the proxy rejects new work immediately and does not queue it. As a result, a traffic spike or a client that opens many connections cannot exhaust the proxy's memory and file descriptors.

{{< conditional-text exclude-if="standalone" >}}
You set both limits in the `frontend` section of an {{< reuse "agw-docs/snippets/policy.md" >}} that targets a Gateway. Each limit counts separately for each port of the Gateway and for each proxy replica. By default, both limits are unset, so the number of requests and connections is not limited.

| Setting | What the limit counts | What happens over the limit |
| -- | -- | -- |
| `frontend.http.maxConcurrentRequests` | In-flight HTTP requests, including HTTP/1 requests and HTTP/2 streams. The minimum value is `1`. | The proxy returns a `503` response with the body `request limit exceeded`, and increments the `agentgateway_requests_shed_total` metric. |
| `frontend.tcp.maxConnections` | Active client connections. The minimum value is `1`. | The proxy closes the new connection without a response, and increments the `agentgateway_downstream_connections_shed_total` metric. |

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that allows 2 in-flight requests on the Gateway.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: connection-limits
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       http:
         maxConcurrentRequests: 2
   EOF
   ```

2. Send 3 requests at the same time to the httpbin `/delay/3` endpoint, which responds after 3 seconds. The first 2 requests take all the request slots, so the proxy rejects the third request immediately with a `503` response.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in 1 2 3; do
     curl -s -o /dev/null -w "request $i: %{http_code}\n" http://$INGRESS_GW_ADDRESS:80/delay/3 -H "host: www.example.com:80" &
     sleep 0.2
   done; wait
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   for i in 1 2 3; do
     curl -s -o /dev/null -w "request $i: %{http_code}\n" localhost:8080/delay/3 -H "host: www.example.com" &
     sleep 0.2
   done; wait
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   request 3: 503
   request 1: 200
   request 2: 200
   ```

3. Update the {{< reuse "agw-docs/snippets/policy.md" >}} so that it sets a connection limit of 1 and no request limit. With 1 connection slot, you can test the connection limit with 2 requests.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: connection-limits
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       tcp:
         maxConnections: 1
   EOF
   ```

4. Open a connection with a slow request, and then open a second connection. The first connection takes the only connection slot, so the proxy closes the second connection without a response. Curl reports `Connection reset by peer`, or `Empty reply from server` through a port-forward.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s -o /dev/null -w "connection 1: %{http_code}\n" http://$INGRESS_GW_ADDRESS:80/delay/3 -H "host: www.example.com:80" &
   sleep 0.5
   curl -sS -o /dev/null -w "connection 2: %{http_code}\n" http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com:80"
   wait
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -s -o /dev/null -w "connection 1: %{http_code}\n" localhost:8080/delay/3 -H "host: www.example.com" &
   sleep 0.5
   curl -sS -o /dev/null -w "connection 2: %{http_code}\n" localhost:8080/headers -H "host: www.example.com"
   wait
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   curl: (56) Recv failure: Connection reset by peer
   connection 2: 000
   connection 1: 200
   ```

5. Check the metrics that count the rejected requests and connections. The `bind` label names the port and the Gateway.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15020 & PF_PID=$!
   sleep 2
   curl -s localhost:15020/metrics | grep -E '^agentgateway_(requests|downstream_connections)_shed'
   kill $PF_PID
   ```

   Example output:

   ```console
   agentgateway_downstream_connections_shed_total{bind="80/{{< reuse "agw-docs/snippets/namespace.md" >}}/agentgateway-proxy"} 1
   agentgateway_requests_shed_total{bind="80/{{< reuse "agw-docs/snippets/namespace.md" >}}/agentgateway-proxy"} 1
   ```

6. Optional: Delete the {{< reuse "agw-docs/snippets/policy.md" >}}.

   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} connection-limits -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
You set both limits in the top-level `frontendPolicies` section of the configuration file. Each limit counts separately for each gateway port. By default, both limits are unset, so the number of requests and connections is not limited.

| Setting | What the limit counts | What happens over the limit |
| -- | -- | -- |
| `frontendPolicies.http.maxConcurrentRequests` | In-flight HTTP requests, including HTTP/1 requests and HTTP/2 streams. The minimum value is `1`. | Agentgateway returns a `503` response with the body `request limit exceeded`, and increments the `agentgateway_requests_shed_total` metric. |
| `frontendPolicies.tcp.maxConnections` | Active client connections. The minimum value is `1`. | Agentgateway closes the new connection without a response, and increments the `agentgateway_downstream_connections_shed_total` metric. |

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. {{< reuse "agw-docs/snippets/prereq-docker.md" >}}

## Limit requests and connections {#limits}

Set a request limit and a connection limit in turn, and send more traffic than each limit allows.

1. Start the httpbin sample app in Docker. The app listens on port 8000 on your machine.

   ```sh
   docker run -d --name httpbin -p 8000:8080 mccutchen/go-httpbin:v2.17.0
   ```

2. Create a configuration file that allows 2 in-flight requests.

   ```yaml
   cat > config.yaml <<EOF
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     http:
       maxConcurrentRequests: 2
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - host: localhost:8000
   EOF
   ```

3. Run agentgateway with the configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

4. In another terminal, send 3 requests at the same time to the httpbin `/delay/3` endpoint, which responds after 3 seconds. The first 2 requests take all the request slots, so agentgateway rejects the third request immediately with a `503` response.

   ```sh
   for i in 1 2 3; do
     curl -s -o /dev/null -w "request $i: %{http_code}\n" http://localhost:3000/delay/3 &
     sleep 0.2
   done; wait
   ```

   Example output:

   ```console
   request 3: 503
   request 1: 200
   request 2: 200
   ```

5. In the configuration file, replace the `frontendPolicies` section with the following section. The new section sets a connection limit of 1 and no request limit. Agentgateway reloads the file when it changes.

   ```yaml
   frontendPolicies:
     tcp:
       maxConnections: 1
   ```

6. Open a connection with a slow request, and then open a second connection. The first connection takes the only connection slot, so agentgateway closes the second connection without a response.

   ```sh
   curl -s -o /dev/null -w "connection 1: %{http_code}\n" http://localhost:3000/delay/3 &
   sleep 0.5
   curl -sS -o /dev/null -w "connection 2: %{http_code}\n" http://localhost:3000/headers
   wait
   ```

   Example output:

   ```console
   curl: (56) Recv failure: Connection reset by peer
   connection 2: 000
   connection 1: 200
   ```

7. Check the metrics that count the rejected requests and connections. The `bind` label names the gateway port.

   ```sh
   curl -s localhost:15020/metrics | grep -E '^agentgateway_(requests|downstream_connections)_shed'
   ```

   Example output:

   ```console
   agentgateway_downstream_connections_shed_total{bind="bind/3000"} 1
   agentgateway_requests_shed_total{bind="bind/3000"} 1
   ```

## Cleanup

1. Stop agentgateway by pressing `Ctrl+C` in the terminal where agentgateway runs.

2. Remove the httpbin container and the configuration file.

   ```sh
   docker rm -f httpbin
   rm config.yaml
   ```
{{< /conditional-text >}}
