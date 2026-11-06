[Datadog](https://www.datadoghq.com/) collects metrics and OpenTelemetry traces
from {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Choose the setup that
matches what you want to observe.

| Setup | Telemetry | When to use it |
| --- | --- | --- |
| Complete example | Proxy and controller metrics, LLM traces, and a dashboard | Evaluate the integration end to end or use it as a production reference |
| Direct trace export | LLM traces | Add tracing to an existing Kubernetes deployment with the fewest components |

The complete example is the recommended starting point. The Datadog Agent
collects proxy and controller metrics through OpenMetrics Autodiscovery and
receives OpenTelemetry Protocol (OTLP) traces over HTTP directly from the proxy. The direct setup sends only
traces from the proxy to the Agent.

## Before you begin

For either setup, you need:

- A Kubernetes cluster, `kubectl`, and Helm.
- A Datadog organization, API key, and the correct
  [Datadog site](https://docs.datadoghq.com/getting_started/site/).
- Agent Observability enabled in your Datadog organization to view LLM traces.

For the complete example, you also need:

- An existing {{< reuse "agw-docs/snippets/agentgateway.md" >}} installation, including the custom
  resource definitions (CRDs), the controller, and the `agentgateway`
  GatewayClass. To install it, see
  [Install with Helm]({{< link-hextra path="/documentation/install/helm/" >}}).
- `curl`.
- Free loopback ports `13000` and `18520` for the port-forwards.

The example deploys its own Gateway and demo model.

The direct trace setup applies a policy to an existing
{{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy, so complete the
following steps first.

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Run the complete example

The
[Datadog Kubernetes example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog/kubernetes)
installs the Datadog Agent and adds OpenMetrics Autodiscovery annotations to the
controller and proxy. The example also deploys a Gateway that routes to the
HomeHub demo model. HomeHub returns fixed OpenAI-compatible responses, so the example does
not call a paid model or need a provider API key. A tracing policy sends the
proxy's traces to the Datadog Agent on the same node.

> [!NOTE]
> The example pins the Datadog Helm chart and Agent versions in `versions.env`.
> The example files use the `agentgateway-system` namespace and the
> `agentgateway` controller Deployment. Check the example README for the tested
> {{< reuse "agw-docs/snippets/agentgateway.md" >}} version, and adjust the files for your installation.

1. Clone the {{< reuse "agw-docs/snippets/agentgateway.md" >}} repository, change to the example directory, and
   load the pinned versions.

   ```sh
   git clone https://github.com/agentgateway/agentgateway.git
   cd agentgateway/examples/datadog/kubernetes
   source versions.env
   ```

2. Export your Datadog API key and site. The example creates the Kubernetes
   Secret for you; do not add the key to a manifest.

   ```sh
   export DD_API_KEY="replace-with-your-datadog-api-key"
   export DD_SITE="us3.datadoghq.com"
   ```

3. Follow the
   [Kubernetes example README](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/kubernetes/README.md)
   to complete the following tasks:

   - Install the Datadog Agent.
   - Add the controller annotation from `controller-annotations.yaml`.
   - Apply `homehub.yaml`, `proxy-parameters.yaml`, and `gateway.yaml`.

   To reuse an existing Gateway, remove the Gateway definition from
   `gateway.yaml` and update the other files to refer to your Gateway.

   The proxy check in `proxy-parameters.yaml` sets `use_latest_spec: true` so
   that the Agent parses the proxy's output as OpenMetrics. Version 1.6 and
   earlier need this setting, or the Agent drops every counter. The controller
   check in `controller-annotations.yaml` sets `use_latest_spec: false`, because
   the controller serves the classic Prometheus text format.

4. Port-forward the gateway and the proxy metrics endpoint. Run each command in
   its own terminal.

   ```sh
   kubectl port-forward --namespace agentgateway-system \
     service/agentgateway-proxy 13000:80
   ```

   ```sh
   kubectl port-forward --namespace agentgateway-system \
     deployment/agentgateway-proxy 18520:15020
   ```

5. Send a request to the HomeHub model.

   ```sh
   curl --fail http://127.0.0.1:13000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -d '{"model":"homehub-support","stream":false,"messages":[{"role":"user","content":"How do I factory-reset my HomeHub X2?"}],"max_tokens":96}'
   ```

   The response describes the HomeHub X2 reset procedure and reports 12 input
   and 24 output tokens.

6. Check the proxy's request and token metrics.

   ```sh
   curl --fail http://127.0.0.1:18520/metrics \
     | grep -E '^agentgateway_(requests|gen_ai_client_token_usage)'
   ```

   The output includes `agentgateway_requests_total` and
   `agentgateway_gen_ai_client_token_usage` samples for the `homehub-support`
   model.

7. Send another request and wait one scrape interval. Counter metrics need two
   scrapes before rate samples appear. Then verify that the Agent discovered the
   OpenMetrics checks for the controller and proxy. If the controller and proxy
   run on different nodes, run the check in the Agent pod on each component's
   node instead, with `--discovery-min-instances 1`.

   ```sh
   export DD_AGENT_POD="$(kubectl get pods \
     --namespace datadog \
     --selector app=datadog \
     --output jsonpath='{.items[0].metadata.name}')"

   kubectl exec --namespace datadog "${DD_AGENT_POD}" -- \
     agent check openmetrics --check-rate \
     --discovery-min-instances 2 --discovery-timeout 30
   ```

   The output reports instances tagged `component:proxy` and
   `component:controller`.

8. In Datadog, open **Metrics > Explorer**, filter by `env:datadog-dev` and
   `service:agentgateway`, and search for an exact metric name. Narrow the
   results with `component:proxy` or `component:controller`.

   - `agentgateway.requests.count`
   - `agentgateway.gen_ai.token.usage.sum`
   - `agentgateway.controller.reconciliations.count`

9. In **Dashboards**, import the example's
   [`dashboard.json`](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/dashboard.json)
   and set the `env` template variable to `datadog-dev`. Enable percentile
   aggregations in Metrics Summary for the latency distributions before you use
   the p95 widgets. Streaming timing, MCP, and guardrail widgets remain empty
   until the corresponding traffic is present. HomeHub has no real provider
   pricing, so estimated-cost widgets can be empty or show **Cost unavailable**.

Traces from the example omit prompt and completion content.

The example collects all proxy and controller metric families. The
`agentgateway.mcp.requests.count` metric's `resource` tag can contain tool names
or resource URIs. Review custom-metric usage, tag cardinality, and resource
values before adapting the wildcard configuration for production.

## Configure direct trace export

Use this smaller setup when you only need traces. First install the Datadog
Agent with OTLP/gRPC ingestion enabled.

1. Add the Datadog Helm repository and create the namespace and API key Secret.

   ```sh
   helm repo add datadog https://helm.datadoghq.com
   helm repo update datadog

   kubectl create namespace datadog
   kubectl create secret generic datadog-secret \
     --namespace datadog \
     --from-literal=api-key=<your-datadog-api-key>
   ```

2. Install the Agent.

   ```sh
   helm install datadog-agent datadog/datadog \
     --namespace datadog \
     --set datadog.apiKeyExistingSecret=datadog-secret \
     --set datadog.otlp.receiver.protocols.grpc.enabled=true \
     --set datadog.otlp.receiver.protocols.grpc.endpoint=0.0.0.0:4317
   ```

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that sends proxy traces
   to the Agent.

   ```sh
   kubectl apply -f- <<EOF_POLICY
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: tracing
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - kind: Gateway
         name: agentgateway-proxy
         group: gateway.networking.k8s.io
     frontend:
       tracing:
         backendRef:
           name: datadog-agent
           namespace: datadog
           port: 4317
         protocol: GRPC
         randomSampling: "true"
   EOF_POLICY
   ```

This direct path does not configure OpenMetrics collection or a dashboard.

> [!NOTE]
> Keep API keys out of Kubernetes manifests and source control.

{{< reuse "agw-docs/pages/observability/traces/configs/datadog-verify.md" >}}

## Troubleshooting

### Metrics are missing

A healthy OpenMetrics service check proves that the endpoint responded; it does
not prove that counter samples reached Datadog. Run traffic between scrape
intervals, repeat the check with `--check-rate`, allow several minutes for
indexing, and confirm that `DD_SITE` selects the organization that owns the API
key.

Inspect raw proxy metrics directly when you need to distinguish a scrape issue
from an {{< reuse "agw-docs/snippets/agentgateway.md" >}} issue.

```sh
kubectl port-forward --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  deployment/agentgateway-proxy 18520:15020
curl --fail http://127.0.0.1:18520/metrics
```

For controller metrics, port-forward `service/agentgateway 19092:9092` instead.
Keep management ports private outside troubleshooting.

### Gauges appear but counters are missing

In version 1.6 and earlier, confirm that the `openmetrics` check for the proxy
sets `use_latest_spec: true`. Without this setting, the Agent parses the proxy's
OpenMetrics output as classic Prometheus text and drops every counter without an
error, while gauges and histograms still arrive. In every version, keep
`use_latest_spec: false` for the controller check, because the controller serves
classic Prometheus text.

### An OpenMetrics check is missing

Confirm that the Autodiscovery annotation identifier matches the container
name: `agentgateway` for the proxy and `controller` for the controller. Do not
scrape the same endpoint through both Autodiscovery and a separate Prometheus
discovery configuration.

### Traces are missing

Confirm that Agent Observability is enabled, the Agent is healthy, and the
Datadog site is correct. For the complete example, check the Agent status and
the tracing policy. Set `DD_AGENT_POD` as in step 7 of the complete example
first.

```sh
kubectl exec --namespace datadog "${DD_AGENT_POD}" -- agent status
kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} datadog-tracing \
  --namespace agentgateway-system --output yaml
```

The Datadog chart's OTLP Service uses `internalTrafficPolicy: Local`, so the
proxy sends traces only to an Agent on its own node. Run an Agent on every node
that hosts an {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy.

A successful OTLP response alone does not prove ingestion into Agent
Observability.

## Cleanup

For the complete example, follow the
[Kubernetes example README](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/kubernetes/README.md)
to remove the example resources, the controller annotation, and the Datadog
Agent. Keep any Gateway that existed before you ran the example.

For the direct trace setup, remove the policy and Agent.

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}}
helm uninstall datadog-agent -n datadog
kubectl delete namespace datadog
```

## Learn more

- [Observability overview]({{< link-hextra path="/documentation/observability/" >}})
- [Observe LLM traffic]({{< link-hextra path="/documentation/llm/observability/" >}})
- [LLM observability integrations]({{< link-hextra path="/integrations/llm/observability/" >}})
- [Datadog OpenMetrics](https://docs.datadoghq.com/integrations/openmetrics/)
- [Kubernetes Autodiscovery](https://docs.datadoghq.com/containers/kubernetes/integrations/)
- [OTLP ingestion by the Datadog Agent](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)
- [Agent Observability with OpenTelemetry](https://docs.datadoghq.com/llm_observability/instrument/otel_instrumentation/)
