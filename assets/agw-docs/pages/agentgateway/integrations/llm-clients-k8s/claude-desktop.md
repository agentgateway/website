Configure [Claude Desktop](https://claude.com/download) to route requests through your agentgateway proxy running in Kubernetes using a Claude Teams or Pro account.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Install [Claude Desktop](https://claude.com/download).
3. Install the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`). This is required to run `claude setup-token` and obtain your bearer token.
4. Have a Claude Teams or Pro subscription.

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Set up the Anthropic backend

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the Anthropic provider. No API key is needed because authentication uses your Claude subscription via OAuth.

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

   {{< callout type="info" >}}
   Claude Code automatically sends the `anthropic-beta: oauth-2025-04-20` header required for OAuth-based authentication. Claude Desktop might require this header to be set as well depending on your client version. If requests fail with a 400 error, add a request transformation to the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} that injects the header.
   
   ```yaml
   backend:
     transformation:
       request:
         set:
         - name: anthropic-beta
           value: oauth-2025-04-20
   ```
   {{< /callout >}}

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
           group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         filters:
         - type: URLRewrite
           urlRewrite:
             path:
               type: ReplacePrefixMatch
               replacePrefixMatch: /
   EOF
   ```

## Configure Claude Desktop

1. Get a bearer token for your Claude account. Store the value in a safe place.

   ```bash
   claude setup-token
   ```

2. Open Claude Desktop and enable developer mode from the menu bar: **Help → Troubleshooting → Enable Developer Mode**. Then fully quit and relaunch Claude Desktop. A new **Developer** menu appears in the menu bar.

3. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

4. Enter the **Gateway base URL**.

   {{< tabs >}}

   {{% tab name="LoadBalancer" %}}
   ```
   http://$INGRESS_GW_ADDRESS/claude
   ```
   {{% /tab %}}

   {{% tab name="Port-forward" %}}
   Use `127.0.0.1` rather than `localhost`.
   
   ```bash
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 4001:80 &
   ```
   For the gateway address in Claude Desktop, enter:
   ```
   http://127.0.0.1:4001/claude
   ```
   {{% /tab %}}

   {{< /tabs >}}

5. For the **Credential kind** dropdown, select `Static API key` and then in the **Gateway API key** field, enter the bearer token you copied in step 1.

6. Click **Save Changes** and restart Claude Desktop.

## Verify the connection

1. Send a message in Claude Desktop, such as `test`.

2. Check the proxy logs to confirm traffic is flowing through agentgateway.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

## Cleanup

1. Remove the resources that you created.

   ```bash
   kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} claude-desktop-buffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete httproute claude-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} anthropic-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Restore Claude Desktop to your original settings. For example, you might delete the `~/Library/Application Support/Claude-3p/` direcotry to remove third-party inference settings and use the default `~/Library/Application Support/Claude/` settings. For more information, see the [Claude docs](https://claude.com/docs/cowork/3p/overview).


## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic Provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
