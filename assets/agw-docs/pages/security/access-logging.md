## About access logging

Access logs, sometimes referred to as audit logs, represent all traffic requests that pass through the gateway proxy. The access log entries can be customized to include data from the request, the routing destination, and the response. 

### Data that can be logged

Access log content is controlled by [CEL (Common Expression Language)](https://agentgateway.dev/docs/kubernetes/main/reference/cel/) expressions. You can filter which requests are logged and define custom attributes from the request and response.

For logging, CEL exposes these variable groups when enabled or applicable:

* **request**: method, URI, host, path, headers, body, and timing
* **response**: status code, headers, and body
* **source**: client address, port, and TLS identity
* **backend**: backend name, type, and protocol
* **Auth and metadata**: `jwt`, `apiKey`, or `basicAuth`, plus `extauthz` and `extproc` metadata
* **LLM**: model, provider, token counts, and optional prompt/completion{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x" >}}/tool calls{{< /version >}}
* **MCP**: tool, prompt, and resource name and target
<!-- Gated by excluding the older versions, not by including "main", so the
     section stays put when the next release freezes this line under a number.
     Only OSS versions need listing: solo-io/docs reaches this file through
     the rebase shortcode, which passes the OSS version its ossDir points at, so
     every
     enterprise line resolves to one of the tokens above. -->
{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
* **Guardrails**: `guardrails`, with one entry per prompt-guard intervention naming the phase, the guard, and the action
{{< /version >}}

Use the `filter` field in the {{< reuse "agw-docs/snippets/policy.md" >}} to [filter which requests are logged](#filter-access-logs) by path, response code, or any other request attribute. Use the `attributes` list to [add or remove log fields](#add-and-remove-log-fields) by using CEL expressions. For the full variable table, available functions, and examples, see the [CEL expressions reference]({{< link-hextra path="/reference/cel/" >}}).


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

3. [Set up the OTel stack]({{< link path="/documentation/observability/otel-stack/" >}}) to export logs to an OTel collector and forward them to Loki. 

## Enable access logs {#access-log-stdout-filesink}

Access logs are written to `stdout` automatically for every request that passes through the gateway proxy. No policy configuration is required to enable them.

1. Send a request to the httpbin app on the `www.example.com` domain.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Check the gateway logs to see the access log entry for the request.

   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1
   ```

   Example output:
   ```console
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080
   src.addr=127.0.0.1:46886 http.method=GET http.host=www.example.com
   http.path=/get http.version=HTTP/1.1 http.status=200
   protocol=http duration=0ms
   ```

To filter which requests are logged or customize log fields, see [Filter access logs](#filter-access-logs) and [Add and remove log fields](#add-and-remove-log-fields). To export access logs to an external backend over OTLP, see [Export logs over OTLP]({{< link-hextra path="/documentation/observability/access-logs/export/" >}}).

  {{< doc-test paths="access-logging" >}}
  YAMLTest -f - <<'EOF'
  - name: verify request to httpbin returns 200
    http:
      url: "http://${INGRESS_GW_ADDRESS}"
      path: /get
      method: GET
      headers:
        host: www.example.com
    source:
      type: local
    expect:
      statusCode: 200
  - name: verify access log entry appears in stdout
    command:
      command: "kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployments/agentgateway-proxy"
    source:
      type: local
    expect:
      exitCode: 0
      stdout:
        contains: "http.path=/get"
  EOF
  {{< /doc-test >}}

## Filter access logs

Use a [CEL expression]({{< link path="/reference/cel/" >}}) to log only a subset of requests. Requests that do not match the expression are not logged. 

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource with a `filter` expression. The following example produces access logs only for requests with a response code of 400 or greater.

   ```yaml {linenos=table,paths="access-logging"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: access-logs
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       accessLog:
         filter: 'response.code >= 400'
   EOF
   ```

2. Send a request that returns a 400 response code.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/status/400 -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/status/400 -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Check the gateway logs and verify that an access log entry was written for the 400 request.

   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1
   ```

   Example output:
   ```console {hl_lines=[4]}
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080
   src.addr=127.0.0.1:46886 http.method=GET http.host=www.example.com
   http.path=/status/400 http.version=HTTP/1.1 http.status=400
   protocol=http duration=0ms
   ```

4. Send a successful request.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

5. Check the logs again and verify that no new entry appears. Because the response code was `200`, the filter expression `response.code >= 400` does not match and no log is written.

   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1
   ```

   Example output (the last entry is still the 400 request from step 2):
   ```console {hl_lines=[4]}
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080
   src.addr=127.0.0.1:46886 http.method=GET http.host=www.example.com
   http.path=/status/400 http.version=HTTP/1.1 http.status=400
   protocol=http duration=0ms
   ```

  {{< doc-test paths="access-logging" >}}
  YAMLTest -f - <<'EOF'
  - name: verify 400 request is returned
    http:
      url: "http://${INGRESS_GW_ADDRESS}"
      path: /status/400
      method: GET
      headers:
        host: www.example.com
    source:
      type: local
    expect:
      statusCode: 400
  - name: verify 400 request was logged
    command:
      command: "kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployments/agentgateway-proxy"
    source:
      type: local
    expect:
      exitCode: 0
      stdout:
        contains: "http.status=400"
  - name: verify 200 request is returned
    http:
      url: "http://${INGRESS_GW_ADDRESS}"
      path: /get
      method: GET
      headers:
        host: www.example.com
    source:
      type: local
    expect:
      statusCode: 200
  - name: verify 200 request was not logged (last log entry is still the 400)
    command:
      command: "kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployments/agentgateway-proxy | tail -1"
    source:
      type: local
    expect:
      exitCode: 0
      stdout:
        contains: "http.status=400"
  EOF
  {{< /doc-test >}}

## Add and remove log fields

You can add custom fields to every access log line by using CEL expressions that are evaluated against the request and response context. You can also remove default fields that you do not need.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that adds custom attributes and removes a default field. The following example adds 3 fields to every access log entry:
   - `user_id`: Extracts the value of the `x-user-id` request header.
   - `env`: Adds a static string of `production`.

   The example also removes the `http.host` default field.

   ```yaml {linenos=table,paths="access-logging"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: access-logs
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       accessLog:
         attributes:
           add:
           - name: user_id
             expression: 'request.headers["x-user-id"]'
           - name: env
             expression: '"production"'
           remove:
           - http.host
   EOF
   ```

2. Send a request with an `x-user-id` header.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/get -H "host: www.example.com" -H "x-user-id: user-123"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/get -H "host: www.example.com" -H "x-user-id: user-123"
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Check the gateway logs and verify you can see the custom fields in your log entry, and that the `http.host` field is absent.

   ```sh
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} logs deployments/agentgateway-proxy | tail -1
   ```

   Example output:
   ```console {hl_lines=[5]}
   info	request gateway=agentgateway-system/agentgateway-proxy
   listener=http route=httpbin/httpbin endpoint=10.244.0.4:8080
   src.addr=127.0.0.1:46886 http.method=GET http.path=/get
   http.version=HTTP/1.1 http.status=200 protocol=http duration=0ms
   user_id="user-123" env="production"
   ```

  {{< doc-test paths="access-logging" >}}
  YAMLTest -f - <<'EOF'
  - name: verify request with x-user-id header returns 200
    http:
      url: "http://${INGRESS_GW_ADDRESS}"
      path: /get
      method: GET
      headers:
        host: www.example.com
        x-user-id: user-123
    source:
      type: local
    expect:
      statusCode: 200
  - name: verify user_id custom field appears in logs
    command:
      command: "kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployments/agentgateway-proxy"
    source:
      type: local
    expect:
      exitCode: 0
      stdout:
        contains: "user_id=\"user-123\""
  - name: verify env custom field appears in logs
    command:
      command: "kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployments/agentgateway-proxy"
    source:
      type: local
    expect:
      exitCode: 0
      stdout:
        contains: "env=\"production\""
  EOF
  {{< /doc-test >}}

<!-- Gated by excluding the older versions, not by including "main", so the
     section stays put when the next release freezes this line under a number.
     Only OSS versions need listing: solo-io/docs reaches this file through
     the rebase shortcode, which passes the OSS version its ossDir points at, so
     every
     enterprise line resolves to one of the tokens above. -->
{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}

## Log guardrail interventions {#guardrails}

A prompt guard that masks or rejects content records what it did in the request's dynamic metadata, under the `guardrails` variable. Add that variable to an access log field to keep an audit trail of every intervention, including which guard acted and why.

The variable holds one entry per intervention, in either the request or the response phase, so a request that both a request guard and a response guard act on produces two entries.

| Field | Description |
| ------- | ----------- |
| `guardrails[].phase` | The phase that the guardrail intervened in, either `request` or `response`. |
| `guardrails[].guard` | The guard kind that intervened, such as `regex`, `webhook`, `openAIModeration`, `bedrockGuardrails`, `googleModelArmor`, or `azureContentSafety`. |
| `guardrails[].action` | The action that the guardrail took, one of `mask`, `reject`, `audit`, or `failOpen`. |
| `guardrails[].guardrailId` | The configured guardrail identifier. |
| `guardrails[].guardrailVersion` | The configured guardrail version. |
| `guardrails[].actionReason` | The reason that the guardrail reported for its action. |
| `guardrails[].assessments` | The assessment detail that the guardrail provider reported, redacted to metadata only. Content-bearing fields, such as the matched text, are never included. |

> [!NOTE]
> Only CEL that runs after the request completes, such as an access log field or a metric field, receives the `guardrails` variable. An authorization or transformation expression that runs mid-request never sees it.

The following {{< reuse "agw-docs/snippets/policy.md" >}} adds the whole list as one log field, and filters the log down to the requests that a guardrail acted on. To record a single value instead, use an expression such as `guardrails[0].action`.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: guardrail-access-logs
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    accessLog:
      filter: guardrails.size() > 0
      attributes:
        add:
        - name: guardrails
          expression: guardrails
EOF
```

Access logging is a frontend policy, so it attaches to a Gateway rather than to the LLM backend that the prompt guard attaches to. To set up a guard that produces these entries, see the [guardrails]({{< link-hextra path="/documentation/llm/guardrails/" >}}) docs.

{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,2.2.x" >}}
## View access logs in Loki {#view-in-loki}

If you set up the [OTel stack]({{< link-hextra path="/documentation/observability/otel-stack/" >}}), the `opentelemetry-collector-logs` deployment is ready to receive access logs via OTLPs. Configure the agentgateway proxy to send access logs to it, then query them in Grafana through Loki.

1. Create a {{< reuse "agw-docs/snippets/policy.md" >}} resource that points the agentgateway proxy at the OTel collector.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: access-logs
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       accessLog:
         otlp:
           backendRef:
             name: opentelemetry-collector-logs
             namespace: telemetry
             port: 4317
           protocol: GRPC
   EOF
   ```

   > [!TIP]
   > To filter which logs are exported, add custom fields, or send logs to a different backend, see [Export logs over OTLP]({{< link-hextra path="/documentation/observability/access-logs/export/" >}}).

2. Open Grafana.  

   1. Port-forward the Grafana service.
      ```sh
      kubectl port-forward svc/kube-prometheus-stack-grafana -n telemetry 3000:80
      ```
   2. Open Grafana at [http://localhost:3000](http://localhost:3000).

   3. Log in to Grafana with the `admin` username `prom-operator` password .

3. Go to **Explore** and select **Loki** as the data source.

4. Use the **Label browser** to find your log stream, then add filters to narrow results. Each proxied request is stored as a log entry with structured metadata attributes such as `http.method`, `http.path`, and `http.status`. Use the following filter patterns:

   | Goal | LogQL filter |
   |---|---|
   | Requests to a specific path | `\| http_path="/get"` |
   | Error responses (4xx/5xx) | `\| http_status="400"` or `\| http_status="500"` |
   | Logs from a specific gateway | `\| gateway="agentgateway-system/agentgateway-proxy"` |

   {{< reuse-image src="img/agw-grafana-loki.png" srcDark="img/agw-grafana-loki.png"  >}}

{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following command.

```sh {paths="access-logging"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} access-logs -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```




