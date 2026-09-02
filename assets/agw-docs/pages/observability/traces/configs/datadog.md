[Datadog](https://www.datadoghq.com/) collects metrics and OpenTelemetry traces
from {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Choose the setup that
matches what you want to observe.

| Setup | Telemetry | When to use it |
| --- | --- | --- |
| Complete example | Proxy and controller metrics, LLM traces, and a dashboard | Evaluate the integration end to end or use it as a production reference |
| Direct trace export | LLM traces | Add tracing to an existing Kubernetes deployment with the fewest components |

The complete example is the recommended starting point. It uses the Datadog
Agent for OpenMetrics collection and an OpenTelemetry Collector for trace
processing. The direct setup sends traces from the proxy to the Agent.

## Before you begin

For either setup, you need:

- A Kubernetes cluster, `kubectl`, and Helm.
- A Datadog organization, API key, and the correct
  [Datadog site](https://docs.datadoghq.com/getting_started/site/).
- Agent Observability enabled in your Datadog organization to view LLM traces.

The complete example also uses Docker, Kind, `curl`, and
[uv](https://docs.astral.sh/uv/). You can use an existing cluster instead of
Kind.

## Run the complete example

The
[Datadog Kubernetes example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog/kubernetes)
deploys the agentgateway controller and a controller-provisioned proxy, a
synthetic OpenAI-compatible provider, an OpenTelemetry Collector, and the
Datadog Agent. It does not call a paid model.

1. Clone the agentgateway repository and change to the example directory.

   ```sh
   git clone https://github.com/agentgateway/agentgateway.git
   cd agentgateway/examples/datadog/kubernetes
   ```

2. Export your Datadog API key and site. The example creates the Kubernetes
   Secret for you; do not add the key to a manifest.

   ```sh
   export DD_API_KEY="replace-with-your-datadog-api-key"
   export DD_SITE="us3.datadoghq.com"
   ```

3. Follow the example README to create or select a cluster, install the pinned
   Datadog Agent and agentgateway versions, and deploy the test resources.

4. Generate synthetic traffic and verify the local telemetry assertions.

   ```sh
   ./smoke.sh
   ```

5. Verify that the Agent discovered both OpenMetrics endpoints. Counter metrics
   need successive scrapes before rate samples appear.

   ```sh
   export DD_AGENT_POD="$(kubectl get pods \
     --namespace datadog \
     --selector app=datadog \
     --output jsonpath='{.items[0].metadata.name}')"

   kubectl exec --namespace datadog "${DD_AGENT_POD}" -- \
     agent check openmetrics --check-rate
   ```

The output should report healthy instances tagged `component:proxy` and
`component:controller`, with metric samples for each endpoint. The example
collects all proxy and controller metric families except the per-resource MCP
request counter, whose `resource` label can contain unbounded or sensitive
values. Review custom-metric usage and tag cardinality before adapting the
wildcard configuration for production.

The example provides two alternative ways to annotate a proxy. Use
`proxy-parameters.yaml` for a controller-provisioned proxy. Use
`proxy-values.yaml` only with the standalone proxy Helm chart. Do not apply both
to the same workload.

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

This direct path does not configure OpenMetrics collection, a dashboard, or the
v1.5.0 trace compatibility processor included in the complete example.

{{< reuse "agw-docs/pages/observability/traces/configs/datadog-verify.md" >}}

## Troubleshooting

### Metrics are missing

A healthy OpenMetrics service check proves that the endpoint responded; it does
not prove that counter samples reached Datadog. Run traffic between scrape
intervals, repeat the check with `--check-rate`, allow several minutes for
indexing, and confirm that `DD_SITE` selects the organization that owns the API
key.

Inspect raw proxy metrics directly when you need to distinguish a scrape issue
from an agentgateway issue.

```sh
kubectl port-forward --namespace agentgateway-system \
  deployment/agentgateway-proxy 18520:15020
curl --fail http://127.0.0.1:18520/metrics
```

For controller metrics, port-forward `service/agentgateway 19092:9092` instead.
Keep management ports private outside troubleshooting.

### An OpenMetrics check is missing

Confirm that the Autodiscovery annotation identifier matches the container
name: `agentgateway` for the proxy and `controller` for the controller. Do not
scrape the same endpoint through both Autodiscovery and a separate Prometheus
discovery configuration.

### Traces are missing

Confirm that Agent Observability is enabled, the Agent is healthy, and the
Datadog site is correct. For the complete example, inspect the Collector logs
and tracing policy.

```sh
kubectl logs --namespace agentgateway-system \
  deployment/datadog-collector --tail 200
kubectl get agentgatewaypolicy datadog-tracing \
  --namespace agentgateway-system
```

A successful OTLP response alone does not prove ingestion into Agent
Observability.

## Cleanup

For the complete example, follow its README to remove the Kind cluster or the
resources installed in an existing cluster.

For the direct trace setup, remove the policy and Agent.

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}}
helm uninstall datadog-agent -n datadog
kubectl delete namespace datadog
```

## Learn more

- [Observability overview]({{< link-hextra path="/observability/" >}})
- [Observe LLM traffic]({{< link-hextra path="/llm/observability/" >}})
- [LLM observability integrations]({{< link-hextra path="/integrations/llm-observability/" >}})
- [Datadog OpenMetrics](https://docs.datadoghq.com/integrations/openmetrics/)
- [Kubernetes Autodiscovery](https://docs.datadoghq.com/containers/kubernetes/integrations/)
- [OTLP ingestion by the Datadog Agent](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)
- [Agent Observability with OpenTelemetry](https://docs.datadoghq.com/llm_observability/instrument/otel_instrumentation/)
