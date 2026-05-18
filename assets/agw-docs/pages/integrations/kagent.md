[Kagent](https://github.com/kagent-dev/kagent) is a Kubernetes-native AI agent framework that brings autonomous agents to cloud-native environments. It leverages Kubernetes primitives for agent lifecycle management, scaling, and orchestration.

## What is Kagent?

Kagent provides a Kubernetes-native approach to running AI agents:

- **CRD-based Configuration** - Define agents as Kubernetes resources
- **Native Scaling** - Horizontal pod autoscaling for agent workloads
- **MCP Support** - Built-in Model Context Protocol for tool access
- **A2A Communication** - Agent-to-agent messaging via Kubernetes services
- **GitOps Ready** - Declarative agent definitions for Flux/ArgoCD

## Why Use agentgateway with Kagent?

Kagent agents running in Kubernetes need enterprise governance:

| Kubernetes Challenge | agentgateway Solution |
|---------------------|----------------------|
| Multi-tenant clusters | Namespace-aware policies |
| Service-to-service auth | mTLS and JWT validation |
| Distributed tracing | OpenTelemetry integration |
| Cost allocation | Per-namespace token tracking |
| Compliance requirements | Centralized audit logging |

## Before you begin
{{< reuse "agw-docs/snippets/prereq.md" >}}

4. Follow the [Ollama](https://agentgateway.dev/docs/kubernetes/latest/llm/providers/ollama/) guide to install and setup Ollama

## Architecture
```
┌───────────────────────────────────────────┐
│              kind cluster                 │
│                                           │
│  ┌──────────┐    ┌─────────────────────┐  │   ┌────────────┐
│  │  kagent  │───▶│   agentgateway      │──│──▶│   Ollama   │
│  │  agent   │    │   (agentgateway-    │  │   │   (host)   │
│  │  pods    │    │    system ns)       │  │   └────────────┘
│  └──────────┘    │  - auth / authz     │  │
│                  │  - rate limiting    │  │
│                  │  - audit logging    │  │
│                  │  - observability    │  │
│                  └─────────────────────┘  │
└───────────────────────────────────────────┘
```

## Install Kagent
1. install kagent crds.
   ```shell
   helm install kagent-crds oci://ghcr.io/kagent-dev/kagent/helm/kagent-crds \
       --namespace kagent \
       --create-namespace
   ```

2. install kagent.
   ```shell
   helm install kagent oci://ghcr.io/kagent-dev/kagent/helm/kagent \
     --namespace kagent \
     --create-namespace \
     --set providers.default=ollama \
     --set providers.ollama.baseUrl=http://agentgateway-proxy.agentgateway-system.svc.cluster.local/v1 \
     --set providers.ollama.apiKey=dummy
   ```

3. Make sure erverthing is up and running.
   ```shell
   kubectl get pods -n kagent
   ```

   Example Output:
   ```shell
   argo-rollouts-conversion-agent-7f8cdbd6f7-6tvl2   1/1     Running   0              5h2m
   cilium-debug-agent-6588998448-gr8tc               1/1     Running   0              5h2m
   cilium-manager-agent-d9468b549-tbqmk              1/1     Running   0              5h2m
   cilium-policy-agent-68d6c9bbf8-tgrzc              1/1     Running   0              5h2m
   helm-agent-66845fccdb-65wj5                       1/1     Running   0              5h2m
   istio-agent-6968fddf87-qtcrg                      1/1     Running   0              5h2m
   k8s-agent-64858b5476-6nw76                        1/1     Running   0              168m
   kagent-controller-9bfbc5b5b-lfxfx                 1/1     Running   0              5h5m
   kagent-grafana-mcp-64c84f5b59-jpp98               1/1     Running   0              5h5m
   kagent-kmcp-controller-manager-877f8dd7c-brw5h    1/1     Running   0              5h5m
   kagent-postgresql-7956f487fd-fznnz                1/1     Running   0              5h5m
   kagent-querydoc-865fb84c44-kbl2m                  1/1     Running   0              5h5m
   kagent-tools-55cc7db799-qrk5c                     1/1     Running   0              5h5m
   kagent-ui-6d78884f6f-c64b5                        1/1     Running   0              5h5m
   kgateway-agent-876d7c9dc-jpcbv                    1/1     Running   0              5h2m
   observability-agent-7f8b568666-zvmbh              1/1     Running   0              5h2m
   promql-agent-5499d6db5-lvf77                      1/1     Running   0              5h2m
   ```

## Setup Kagent
1. Create a ModelConfig that points to Ollama:
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: kagent.dev/v1alpha2
   kind: ModelConfig
   metadata:
     name: ollama-model-config
     namespace: kagent
   spec:
     provider: Ollama
     model: llama3.2
     baseUrl: http://agentgateway-proxy.agentgateway-system.svc.cluster.local/v1
   EOF
   ```

2. Verify that Kagent is accessible and correctly functioning.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2"  >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n kagent kagent-ui -o jsonpath="{.spec.clusterIP}")
   echo $INGRESS_GW_ADDRESS  
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing"  %}}
   ```shell
   kubectl port-forward -n kagent service/kagent-ui 8082:8080
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Open the Kagent GUI and try defult Kagent for example k8s-agent.
   {{< reuse-image src="img/kagent-default-k8s-agent.png" >}}
   {{< reuse-image-dark srcDark="img/kagent-default-k8s-agent.png" >}}

## Governance Capabilities
### Apply Ratelimiting
1. Create an `AgentgatewayPolicy` resource to apply token based rateliming on the agentgateway.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: llm-token-budget
     namespace: agentgateway-system
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: ollama
     traffic:
       rateLimit:
         local:
           - tokens: 1
             unit: Hours
   EOF
   ```

2. Verify
   What would be the best method?

## Best Practices

1. **Namespace Isolation** - Separate teams with namespace-aware policies
2. **Resource Quotas** - Set token budgets per namespace
3. **Audit Everything** - Log all LLM, MCP, and A2A traffic
4. **GitOps Policies** - Manage authorization policies declaratively

## Cleanup
To be done
