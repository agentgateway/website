Configure [Claude Desktop](https://claude.ai/download) to route requests through your agentgateway proxy running in Kubernetes using a Claude Teams or Pro account.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Install [Claude Desktop](https://claude.ai/download).
3. Install the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`). This is required to run `claude setup-token` and obtain your bearer token.
4. Have a Claude Teams or Pro subscription.

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Set up the Anthropic backend

1. Create an `AgentgatewayBackend` for the Anthropic provider. No API key is needed — authentication uses your Claude subscription via OAuth.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic-desktop
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic: {}
     policies:
       ai:
         routes:
           '/v1/messages': Messages
           '/v1/messages/count_tokens': AnthropicTokenCount
           '*': Passthrough
   EOF
   ```

2. Create an `{{< reuse "agw-docs/snippets/trafficpolicy.md" >}}` to raise the body buffer limit to 10 MB for the OAuth token flow.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: claude-desktop-buffer
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       http:
         maxBufferSize: 10485760
   EOF
   ```

3. Create an `HTTPRoute` that matches the `/claude` path prefix and rewrites it to `/` before forwarding to the backend.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: claude-desktop
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
         - path:
             type: PathPrefix
             value: /claude
         backendRefs:
         - name: anthropic-desktop
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           group: agentgateway.dev
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         filters:
         - type: URLRewrite
           urlRewrite:
             path:
               type: ReplacePrefixMatch
               replacePrefixMatch: /
   EOF
   ```

{{< callout type="info" >}}
Claude Code automatically sends the `anthropic-beta: oauth-2025-04-20` header required for OAuth-based authentication. Claude Desktop may require this header to be set as well depending on your client version. If requests fail with a 400 error, add a request transformation to the `AgentgatewayPolicy` that injects the header:

```yaml
backend:
  transformation:
    request:
      set:
      - name: anthropic-beta
        value: oauth-2025-04-20
```
{{< /callout >}}

## Configure Claude Desktop

1. Get a bearer token for your Claude account.

   ```bash
   claude setup-token
   ```

   Copy the token printed to the terminal.

2. Open Claude Desktop and enable developer mode: **Help → Developer Mode**.

3. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

4. Enter the gateway URL. Use `127.0.0.1` rather than `localhost`.

   {{< tabs items="LoadBalancer,Port-forward" >}}

   {{% tab tabName="LoadBalancer" %}}
   ```
   http://$INGRESS_GW_ADDRESS/claude
   ```
   {{% /tab %}}

   {{% tab tabName="Port-forward" %}}
   ```bash
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 4001:80 &
   ```
   Then enter:
   ```
   http://127.0.0.1:4001/claude
   ```
   {{% /tab %}}

   {{< /tabs >}}

5. Enter the bearer token you copied in step 1.

6. Click **Save** and restart Claude Desktop.

## Verify the connection

Send a message in Claude Desktop, then check the proxy logs to confirm traffic is flowing through agentgateway.

```bash
kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
```

## Cleanup

```bash
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} claude-desktop-buffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute claude-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} anthropic-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic Provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
