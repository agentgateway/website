Proxy OpenAI Realtime API traffic through {{< reuse "agw-docs/snippets/agentgateway.md" >}} to get token usage tracking and observability for WebSocket-based interactions.

## About

The [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) uses WebSocket connections for low-latency, multimodal interactions. {{< reuse "agw-docs/snippets/agentgateway.md" >}} can proxy these WebSocket connections and parse the `response.done` events to extract token usage data, including input tokens, output tokens, and cached token counts.

To enable token usage tracking, you must prevent the client and server from negotiating WebSocket frame compression. When the `sec-websocket-extensions: permessage-deflate` header is present, the WebSocket frames are compressed and {{< reuse "agw-docs/snippets/agentgateway.md" >}} cannot parse the token usage data. Remove this header from the request so that frames remain uncompressed and parseable.

{{< callout type="info" >}}
The `Realtime` route type supports token usage tracking and observability. Other LLM policies such as prompt guards, prompt enrichment, and request-body rate limiting are not supported for WebSocket traffic.
{{< /callout >}}

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Set up access to the [OpenAI]({{< link-hextra path="/llm/providers/openai/" >}}) or an [OpenAI API-compatible]({{< link-hextra path="/llm/providers/openai-compatible/" >}}) LLM provider.

## Step 1: Add the Realtime route type

Verify that your OpenAI {{< reuse "agw-docs/snippets/backend.md" >}} includes the `Realtime` route type in the `policies.ai.routes` map. The default behavior routes all traffic as `Completions`. You must explicitly add the `Realtime` route type for the `/v1/realtime` path.

If you already set up [multiple endpoints]({{< link-hextra path="/llm/providers/multiple-endpoints/" >}}), add the `/v1/realtime` path to your existing {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml {paths="realtime"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai:
        model: gpt-4
  policies:
    auth:
      secretRef:
        name: openai-secret
    ai:
      routes:
        "/v1/chat/completions": "Completions"
        "/v1/realtime": "Realtime"
        "*": "Passthrough"
EOF
```

{{< doc-test paths="realtime" >}}
YAMLTest -f - <<'EOF'
- name: wait for openai backend with realtime route to be ready
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
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Step 2: Remove the WebSocket compression header

Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that removes the `sec-websocket-extensions` header from requests to the OpenAI Realtime endpoint. This step prevents the client and server from negotiating `permessage-deflate` compression, which would make WebSocket frames unreadable for token tracking.

1. Create the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to strip the header. Target the HTTPRoute section that handles the `/v1/realtime` path.

   ```yaml {paths="realtime"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: realtime-strip-websocket-extensions
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
       sectionName: openai-realtime
     traffic:
       transformation:
         request:
           remove:
           - sec-websocket-extensions
   EOF
   ```

   {{< doc-test paths="realtime" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for realtime-strip-websocket-extensions policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: realtime-strip-websocket-extensions
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

2. Verify that the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} is accepted.

   ```sh
   kubectl get agentgatewaypolicy realtime-strip-websocket-extensions -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

## Step 3: Send a Realtime request

Send a request to the OpenAI Realtime API through {{< reuse "agw-docs/snippets/agentgateway.md" >}} using a WebSocket client. The Realtime API uses WebSocket connections, so standard HTTP tools like `curl` do not work. Use a WebSocket client such as [`websocat`](https://github.com/vi/websocat), [`wscat`](https://github.com/websockets/wscat), or a custom application.

Connect to the {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy URL with the `model` query parameter and send the following [client events](https://developers.openai.com/api/docs/guides/realtime) as JSON messages.

1. Create a conversation item with a text message.

   ```json
   {"type":"conversation.item.create","item":{"type":"message","role":"user","content":[{"type":"input_text","text":"Say hello in one word."}]}}
   ```

2. Trigger a text response.

   ```json
   {"type":"response.create","response":{"modalities":["text"]}}
   ```

3. Look for a `response.done` event in the server output. This event contains the token usage data that {{< reuse "agw-docs/snippets/agentgateway.md" >}} extracts for metrics.

   ```json
   {"type":"response.done","response":{...,"usage":{"total_tokens":225,"input_tokens":150,"output_tokens":75}}}
   ```

## Step 4: Verify token tracking

After the Realtime request completes, verify that {{< reuse "agw-docs/snippets/agentgateway.md" >}} recorded the token usage metrics.

1. Open the {{< reuse "agw-docs/snippets/agentgateway.md" >}} [metrics endpoint](http://localhost:15020/metrics).
2. Look for the `agentgateway_gen_ai_client_token_usage` metric. The metric includes labels for the token type (`input` or `output`) and the model used.

For more information about LLM metrics and observability, see {{< conditional-text include-if="standalone" >}}[Observe traffic]({{< link-hextra path="/llm/observability/" >}}){{< /conditional-text >}}{{< conditional-text include-if="kubernetes" >}}[LLM cost tracking]({{< link-hextra path="/llm/cost-tracking/" >}}){{< /conditional-text >}}.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="realtime"}
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} realtime-strip-websocket-extensions -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
