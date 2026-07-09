---
title: Cost dashboard
weight: 30
description: View LLM spend, tokens, and traffic in the built-in Admin UI when running agentgateway on Kubernetes.
test: skip
---

The built-in **Admin UI** includes a cost dashboard: the same **LLM > Analytics** page available in standalone mode. It plots spend, tokens, and calls over time, broken down by model, provider, user, group, or user agent. It works in Kubernetes too, but unlike standalone it is not enabled by default. The proxy ships without a request-log database, so the dashboard has nothing to show until you configure one.

## Requirements

Two pieces of configuration power the dashboard:

- A request-log database (`config.database`). The Kubernetes {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource has no typed field for it, so you set it through `rawConfig`, which merges raw agentgateway configuration into the proxy's config file. Point it at a writable path in the pod, such as the `/tmp` volume.
- A [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) (`spec.modelCatalog`) so requests are priced. Without a catalog, the dashboard still shows token and call volume, but the cost is `0`.

{{< callout type="warning" >}}
The `/tmp` path is an ephemeral `emptyDir`, so the request-log history is per-pod and is lost when the pod restarts or scales. For durable history, back `config.database` with a persistent volume, and note that each replica keeps its own local database.
{{< /callout >}}

## Enable the dashboard

1. Create (or update) a Gateway-level {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that enables the database through `rawConfig` and attaches a model catalog. The catalog `configMap` must already exist in the Gateway's namespace (see [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}})).

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: cost-dashboard-params
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     modelCatalog:
       sources:
         - configMap:
             name: my-model-costs
             key: catalog.json
     rawConfig:
       config:
         database:
           url: "sqlite:////tmp/data.db?mode=rwc"
   EOF
   ```

2. Attach the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to your Gateway with `infrastructure.parametersRef`. `modelCatalog` and `rawConfig` are honored only on a Gateway-level resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-proxy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     infrastructure:
       parametersRef:
         name: cost-dashboard-params
         group: {{< reuse "agw-docs/snippets/gatewayparam-group.md" >}}
         kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
     listeners:
       - name: http
         port: 80
         protocol: HTTP
         allowedRoutes:
           namespaces:
             from: All
   EOF
   ```

3. Wait for the proxy to roll out with the new configuration.

   ```sh
   kubectl rollout status deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

## Open the dashboard

Every request that flows through the proxy is now recorded and priced. Port-forward the proxy's Admin UI and open the Analytics page.

1. Port-forward the Admin UI port.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

2. Open [http://localhost:15000/ui/llm/analytics](http://localhost:15000/ui/llm/analytics). Send some LLM traffic through the gateway, then refresh to see traffic over time with a running tally of cost, tokens, and calls, plus a breakdown below the chart.

   {{< reuse-image-light src="img/agentgateway-ui-kube-cost-dashboard.png" alt="agentgateway Analytics cost dashboard in the Kubernetes Admin UI" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-kube-cost-dashboard-dark.png" alt="agentgateway Analytics cost dashboard in the Kubernetes Admin UI" >}}

{{< callout type="info" >}}
In Kubernetes (xds) mode the Admin UI is read-only. You view the dashboard, but you manage configuration through Kubernetes resources rather than the UI.
{{< /callout >}}

### Group by and measure

Use the **Group by** control to break the same traffic down by model, provider, user, group, or user agent*, and toggle **Measure** between tokens, cost, and requests. Set to **Cost** to see realized spend in dollars. Use **Export** to pull the underlying numbers out for reporting.
