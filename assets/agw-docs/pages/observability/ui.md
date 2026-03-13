Use the agentgateway Admin UI to inspect your Kubernetes proxy configuration.

## About

The agentgateway Admin UI is a built-in web interface that runs on port 15000 of the `agentgateway-proxy` pod. In Kubernetes mode, the UI is **read-only**. It reflects the configuration pushed by the agentgateway controller. Make configuration changes by updating your Kubernetes resources such as via GitOps, not through the UI.

The Admin UI is useful for debugging and verifying what configuration the proxy has received, and for testing MCP tool calls through the built-in Playground.

## Access the Admin UI {#access-admin-ui}

The Admin UI is not exposed as a Kubernetes Service. To access it, use `kubectl port-forward` to forward the pod's port to your local machine.

1. Forward port 15000 from the `agentgateway-proxy` deployment to your local machine.

   ```sh
   kubectl port-forward deploy/agentgateway-proxy -n agentgateway-system 15000
   ```

   Example output:

   ```
   Forwarding from 127.0.0.1:15000 -> 15000
   Forwarding from [::1]:15000 -> 15000
   ```

{{< doc-test paths="ui-k8s" >}}
kubectl port-forward deploy/agentgateway-proxy -n agentgateway-system 15000 &
for i in $(seq 1 20); do curl -s http://localhost:15000/ui/ > /dev/null 2>&1 && break || sleep 2; done
{{< /doc-test >}}

2. While the port-forward is running, open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

   The Admin UI dashboard shows your configured listeners and port binding in **read-only** mode.

   {{< reuse-image src="img/agentgateway-ui-kube-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-kube-landing-dark.png" >}}

{{< doc-test paths="ui-k8s" >}}
YAMLTest -f - <<'EOF'
- name: Admin UI returns HTTP 200
  http:
    url: "http://localhost:15000/ui/"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
EOF
{{< /doc-test >}}

{{< callout type="info" >}}
The port-forward connection closes when you stop the <code>kubectl port-forward</code> command. Run it in a dedicated terminal tab or in the background if you need persistent access.
{{< /callout >}}

## Troubleshooting

### No listeners are shown in the UI

**What's happening:**

The Admin UI loads but shows no listeners or an empty configuration.

**Why it's happening:**

The proxy might not have configuration from the controller yet, or your Gateway and route resources might not be fully reconciled.

**How to fix it:**

- Check that the `agentgateway-proxy` pod is running: `kubectl get pods -n agentgateway-system`.
- Check the controller logs for reconciliation errors: `kubectl logs -n agentgateway-system -l app=agentgateway-controller`.
- Verify your `Gateway` and route resources have no validation errors: `kubectl describe gateway -n <namespace>`.
