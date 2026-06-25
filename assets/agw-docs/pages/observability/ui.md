Use the agentgateway Admin UI to inspect your Kubernetes proxy configuration.

## About

The agentgateway Admin UI is a built-in web interface that runs on port 15000 of the `agentgateway-proxy` pod. In Kubernetes mode, the UI is **read-only**. It reflects the configuration that the agentgateway controller pushes to the proxy over xDS, the protocol that the control plane uses to deliver configuration to the proxy.

{{< callout type="info" >}}
The Admin UI is read-only in Kubernetes mode. Unlike standalone mode, you cannot use the UI to add features such as models, LLM providers, or MCP servers. Instead, make configuration changes by updating your Kubernetes resources, such as through GitOps, not through the UI.
{{< /callout >}}


The Admin UI is useful for debugging and verifying the configuration that the proxy received from the controller, such as confirming that a Gateway, HTTPRoute, AgentgatewayBackend, or AgentgatewayPolicy resource took effect.

## Access the Admin UI {#access-admin-ui}

The Admin UI is not exposed as a Kubernetes Service. To access it, use `kubectl port-forward` to forward the pod's port to your local machine.

1. Forward port 15000 from the `agentgateway-proxy` deployment to your local machine.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

   Example output:

   ```
   Forwarding from 127.0.0.1:15000 -> 15000
   Forwarding from [::1]:15000 -> 15000
   ```

2. While the port-forward is running, open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

   The **Gateway Overview** opens in read-only mode and summarizes the resources that the proxy currently serves, such as the number of listeners, routes, and policies.

   {{< reuse-image-light src="img/agentgateway-ui-kube-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-kube-landing-dark.png" >}}

{{< doc-test paths="ui-k8s" >}}
YAMLTest -f - <<'EOF'
- name: Admin UI returns HTTP 200
  retries: 3
  http:
    url: "http://localhost:15000/ui/"
    method: GET
  source:
    type: pod
    usePortForward: true
    selector:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

{{< doc-test paths="ui-k8s-capture" >}}
# Screenshot-capture fixture (not rendered on the page). Adds an LLM backend + route and a
# CORS policy on top of the MCP and httpbin routes so the read-only Listeners, Routes, and
# Policies views render content. A placeholder LLM key keeps capture free of external calls.
kubectl create secret generic openai-secret -n agentgateway-system \
  --from-literal=Authorization=sk-doc-capture-placeholder --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f- <<'EOF'
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: openai
  namespace: agentgateway-system
spec:
  ai:
    provider:
      openai:
        model: gpt-3.5-turbo
  policies:
    auth:
      secretRef:
        name: openai-secret
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: agentgateway-system
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /openai
    backendRefs:
    - name: openai
      namespace: agentgateway-system
      group: agentgateway.dev
      kind: AgentgatewayBackend
---
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: mcp-cors
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: mcp
  traffic:
    cors:
      allowOrigins:
      - https://example.com
      allowMethods:
      - GET
      - POST
      - OPTIONS
      allowHeaders:
      - Authorization
      - Content-Type
      maxAge: 3600
EOF

YAMLTest -f - <<'EOF'
- name: wait for openai backend to be accepted
  wait:
    target:
      kind: AgentgatewayBackend
      metadata:
        namespace: agentgateway-system
        name: openai
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF
{{< /doc-test >}}

{{< callout type="info" >}}
The port-forward connection closes when you stop the <code>kubectl port-forward</code> command. Run it in a dedicated terminal tab or in the background if you need persistent access.
{{< /callout >}}

{{% version exclude-if="1.2.x,1.1.x,1.0.x,2.2.x" %}}
## Explore the read-only views {#explore}

Because configuration is managed by xDS, every page shows a read-only mode banner and editing is disabled. The views reflect the configuration that the proxy currently runs, so use them to verify that the proxy received the configuration that you expect. The navigation menu groups the views into **Gateway**, **Traffic**, and **Tools**.

### Listeners {#listeners}

The **Listeners** page lists the ports that the proxy binds and the routes that are attached to each listener. Use it to confirm the proxy's port bindings and how routes map to each listener.

{{< reuse-image-light src="img/agentgateway-ui-kube-listeners.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-listeners-dark.png" >}}

### Routes {#routes}

The **Routes** page is an inventory of the routes that the proxy currently runs. Each row shows the route name, type, listener, path match, backends, and the number of attached policies. To inspect a single route in more detail, click the view (eye) icon in its row.

{{< reuse-image-light src="img/agentgateway-ui-kube-routes.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-routes-dark.png" >}}

### Policies {#policies}

The **Policies** page lists the policies that the proxy currently runs, including the resource that each policy targets, the policy type, and how the policy is inherited.

{{< reuse-image-light src="img/agentgateway-ui-kube-policies.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-policies-dark.png" >}}

### CEL Playground {#cel-playground}

The **CEL Playground**, under **Tools**, lets you evaluate Common Expression Language (CEL) expressions against sample input. It is the only interactive tool available in Kubernetes mode, and it does not modify any configuration. For more information about where agentgateway uses CEL, see the [CEL expressions reference]({{< link-hextra path="/reference/cel/" >}}).

{{< reuse-image-light src="img/agentgateway-ui-kube-cel.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-cel-dark.png" >}}
{{% /version %}}
