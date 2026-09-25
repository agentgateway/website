Reduce duplication between an AI provider group and other backends that connect to the same endpoint, without changing how the provider group load balances or fails over.

## About sharing connection settings {#about}

When you [load balance across multiple providers]({{< link-hextra path="/documentation/llm/load-balancing/#multiple-providers" >}}), each provider entry in a priority group is its own set of connection settings: hostname, port, authentication, TLS, and any proxy tunnel. If you also need to reach one of those same endpoints for a different purpose — for example, a dedicated route that scrapes a per-instance metrics endpoint — you end up creating a second {{< reuse "agw-docs/snippets/backend.md" >}} with its own copy of those settings.

There is no way to reference an existing {{< reuse "agw-docs/snippets/backend.md" >}} from inside an AI provider group. The `custom` provider type's `backendRef` field targets only a `Service` or `InferencePool`, not another {{< reuse "agw-docs/snippets/backend.md" >}}. This is intentional: a provider group is designed to describe each provider's endpoint directly, not to compose other backend resources.

You can still avoid duplicating the **authentication, TLS, and tunnel** settings. Each provider inside an AI provider group has a `name`, and policies can target that specific provider by name using `sectionName`. An {{< reuse "agw-docs/snippets/policy.md" >}} with a `backend` section can list multiple `targetRefs` at once, so a single policy can attach to one provider inside the aggregate {{< reuse "agw-docs/snippets/backend.md" >}} **and** to a separate {{< reuse "agw-docs/snippets/backend.md" >}} that reaches the same endpoint. Both then share the same `auth`, `tls`, and `tunnel` configuration from one place.

> [!IMPORTANT]
> This shares only the connection policy fields (`auth`, `tls`, `tunnel`). The `host` and `port` for the endpoint are still set separately on the provider entry and on the other {{< reuse "agw-docs/snippets/backend.md" >}}, because those fields live directly on each spec and aren't part of the shared policy. Full reuse of a backend definition inside an AI provider group isn't supported.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. Set up [API access to each LLM provider]({{< link-hextra path="/documentation/llm/api-keys/" >}}) that you want to use.
3. Understand how [load balancing across multiple providers]({{< link-hextra path="/documentation/llm/load-balancing/#multiple-providers" >}}) works, since this guide builds on that setup.

{{< doc-test paths="shared-connection-settings" >}}
# The guide references two provider secrets and a forward-proxy backend that a
# reader would already have from setting up their own providers and, optionally,
# a tunnel. Create minimal stand-ins so the resources in this test resolve.
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: on-prem-instance-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: test-on-prem-token
---
apiVersion: v1
kind: Secret
metadata:
  name: cloud-instance-1-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: test-cloud-instance-1-token
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: forward-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: forward-proxy.internal
    port: 3128
EOF
{{< /doc-test >}}

## Share settings between a provider group and a dedicated backend {#share-settings}

The following steps set up an AI provider group with an on-premises instance and two individually addressable cloud instances, plus a separate {{< reuse "agw-docs/snippets/backend.md" >}} that reaches one of the cloud instances for its own dedicated route. A shared {{< reuse "agw-docs/snippets/policy.md" >}} keeps the authentication, TLS, and tunnel settings for that cloud instance in one place.

1. Create the aggregate {{< reuse "agw-docs/snippets/backend.md" >}} with an AI provider group. Each cloud provider uses the `custom` provider type so you can declare explicit API paths. Leave `auth`, `tls`, and `tunnel` off of the providers that you plan to share settings for — the policy in step 3 supplies them.

   ```yaml,paths="shared-connection-settings"
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: llm-providers
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       groups:
         - providers:
             - name: on-prem-instance
               custom:
                 model: custom-model
                 formats:
                   - type: Completions
                     path: /api/v1/chat/completions
               host: on-prem-instance.internal
               port: 443
               policies:
                 auth:
                   secretRef:
                     name: on-prem-instance-secret
             - name: cloud-instance-1
               custom:
                 model: custom-model
                 formats:
                   - type: Completions
                     path: /api/v1/chat/completions
               host: cloud-instance-1.example.com
               port: 443
             - name: cloud-instance-2
               custom:
                 model: custom-model
                 formats:
                   - type: Completions
                     path: /api/v1/chat/completions
               host: cloud-instance-2.example.com
               port: 443
   EOF
   ```

   {{< doc-test paths="shared-connection-settings" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for llm-providers backend to be accepted
     wait:
       target:
         kind: AgentgatewayBackend
         metadata:
           namespace: agentgateway-system
           name: llm-providers
       jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 60
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

2. Create a dedicated {{< reuse "agw-docs/snippets/backend.md" >}} for the same cloud instance, used by a separate route, such as one that scrapes a per-instance metrics endpoint. This example uses the `openai` provider type with `/metrics` configured as passthrough, matching a common pattern for a non-inference route that reaches the same host. Leave `auth`, `tls`, and `tunnel` off here too.

   ```yaml,paths="shared-connection-settings"
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: cloud-instance-1-metrics
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: custom-model
       host: cloud-instance-1.example.com
       port: 443
     policies:
       ai:
         routes:
           "/metrics": "Passthrough"
   EOF
   ```

   {{< doc-test paths="shared-connection-settings" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for cloud-instance-1-metrics backend to be accepted
     wait:
       target:
         kind: AgentgatewayBackend
         metadata:
           namespace: agentgateway-system
           name: cloud-instance-1-metrics
       jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 60
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that targets both the `cloud-instance-1` provider inside the aggregate {{< reuse "agw-docs/snippets/backend.md" >}} (using `sectionName`) and the dedicated metrics {{< reuse "agw-docs/snippets/backend.md" >}}. The `backend` section on the policy supplies the shared `auth`, `tls`, and `tunnel` settings to both targets.

   ```yaml,paths="shared-connection-settings"
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: cloud-instance-1-connection
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         name: llm-providers
         sectionName: cloud-instance-1
       - group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         name: cloud-instance-1-metrics
     backend:
       auth:
         secretRef:
           name: cloud-instance-1-secret
       tls:
         sni: cloud-instance-1.example.com
       tunnel:
         backendRef:
           group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
           name: forward-proxy
           port: 3128
   EOF
   ```

   {{< doc-test paths="shared-connection-settings" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for cloud-instance-1-connection policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: cloud-instance-1-connection
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 60
         intervalSeconds: 2
   - name: wait for cloud-instance-1-connection policy second target to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: cloud-instance-1-connection
       jsonPath: "$.status.ancestors[1].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 60
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

   | Field | Description |
   |-------|-------------|
   | `targetRefs[0].sectionName` | Selects the `cloud-instance-1` provider by name inside the `llm-providers` AI provider group. Without a `sectionName`, the policy would apply to every provider in the group, including `on-prem-instance` and `cloud-instance-2`. |
   | `targetRefs[1]` | The separate {{< reuse "agw-docs/snippets/backend.md" >}} used for the dedicated metrics route. A policy's `targetRefs` can list multiple targets, so one policy applies to both. |
   | `backend.auth.secretRef` | The Secret with credentials for `cloud-instance-1`, now defined once instead of on each backend. |
   | `backend.tls.sni` | The TLS Server Name Indication to use when connecting to `cloud-instance-1`, shared by both targets. |
   | `backend.tunnel.backendRef` | Routes both targets' connections through the same forward proxy {{< reuse "agw-docs/snippets/backend.md" >}}, such as for an HTTP CONNECT proxy. See [Tunnel through a proxy]({{< link-hextra path="/integrations/llm/providers/backend-tunnel-proxy/" >}}) for how to set up the proxy backend itself. |

   Repeat step 3 for `cloud-instance-2` and any other cloud instance that needs its own dedicated backend, each with its own policy and secret.

## What this does not change {#no-change}

The AI provider group itself is unchanged: `llm-providers` still has the same three providers in the same priority group. Because of that:

- **Load balancing** still uses the same Power of Two Choices (P2C) algorithm across `on-prem-instance`, `cloud-instance-1`, and `cloud-instance-2`. See [Load balancing]({{< link-hextra path="/documentation/llm/load-balancing/" >}}).
- **Failover, retries, and provider eviction** behave the same way, since they're determined by the provider group and priority group structure, not by how connection settings are attached. See [Failover]({{< link-hextra path="/documentation/llm/failover/" >}}).
- **Provider identity in telemetry** is unaffected. Each provider keeps its own `name`, model, and API paths, so metrics, traces, and cost tracking still attribute requests to the correct provider.
- **Metrics scraping stays independent per instance**, because the dedicated {{< reuse "agw-docs/snippets/backend.md" >}} and route for each cloud instance are untouched — only their connection settings move into the shared policy.

No traffic distribution moves to weighted `HTTPRoute` `backendRefs`. The provider group remains the single mechanism that selects and balances across providers.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```shell
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} cloud-instance-1-connection -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} cloud-instance-1-metrics -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} llm-providers -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Next steps

- Review [Targeting and merging]({{< link-hextra path="/documentation/about/policies/target-merge/#backend-ai" >}}) for how inline AI policies on a backend merge with attached {{< reuse "agw-docs/snippets/policy.md" >}} resources.
- Set up a [tunnel through a proxy]({{< link-hextra path="/integrations/llm/providers/backend-tunnel-proxy/" >}}) if your provider connections need to go through a forward proxy.
- Configure [failover]({{< link-hextra path="/documentation/llm/failover/" >}}) with priority groups for high availability.
