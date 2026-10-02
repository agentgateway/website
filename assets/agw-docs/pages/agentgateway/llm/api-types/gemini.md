Serve clients that send the native Gemini wire format, such as the Gemini and Vertex AI SDKs, through {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

## About

The [Gemini API](https://ai.google.dev/api/generate-content) addresses a model through the request path rather than the request body, as `models/{model}:generateContent`. A client that is built on the Gemini or Vertex AI SDK sends this format directly, so pointing that client at {{< reuse "agw-docs/snippets/agentgateway.md" >}} needs no OpenAI-compatible shim.

Two route types carry the format:

| Route type | Endpoints |
|------------|-----------|
| `GenerateContent` | `models/{model}:generateContent` and `models/{model}:streamGenerateContent` |
| `GeminiCountTokens` | `models/{model}:countTokens` |

Because the model name comes from the path, any Gemini model works without a per-model entry in your configuration. The `tunedModels/{model}` form is preserved as well.

Native Gemini requests reach Gemini-family backends only:

- The Gemini API
- Vertex AI with a Gemini model

A native Gemini request that is routed to any other provider is rejected with an unsupported-conversion error rather than translated.

> [!NOTE]
> Guardrails apply to `GenerateContent`. They are skipped for `GeminiCountTokens`, which counts tokens and never reaches a model. Thinking configuration in `generationConfig.thinkingConfig`, returned thought parts, and `thoughtsTokenCount` all pass through unchanged.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Set up access to the [Gemini]({{< link-hextra path="/integrations/llm/providers/gemini/" >}}) or [Vertex AI]({{< link-hextra path="/integrations/llm/providers/vertex/" >}}) LLM provider.

{{< doc-test paths="gemini-inbound" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Step 1": the AgentgatewayBackend applies against the real CRD schema, so
#     `GenerateContent` and `GeminiCountTokens` are confirmed to be valid values
#     of the `policies.ai.routes` enum, and `provider.gemini` accepts the empty
#     form with no `model` set. This is the main point of the test: the
#     standalone docs spell these route types `generateContent` and
#     `geminiCountTokens`, and the API server rejects that casing here.
#   * "Step 2": the HTTPRoute applies and resolves its AgentgatewayBackend
#     backendRef (ResolvedRefs=True), so the group/kind wiring in the example is
#     correct.
#   * "Step 4": a `:streamGenerateContent` request without `alt=sse` is rejected
#     with the documented status (400) and the documented INVALID_ARGUMENT
#     message. This check needs no provider, because agentgateway answers it
#     before any upstream call.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The request and response in "Step 3" - external dependency; a real
#     generateContent call needs a live Gemini API key and bills for it, so the
#     secret below holds a placeholder.
#   * The `:countTokens` request mentioned at the end of "Step 3" - same
#     external dependency.
#   * A successful `alt=sse` stream in "Step 4" - same external dependency. Only
#     the rejection path is asserted, because that one resolves locally.
#   * The `tunedModels/{model}` form named in "About" - exercising it needs a
#     real tuned model on a real project.
#   * Vertex AI as the backend, named in "About" and "Before you begin" - the
#     test configures the Gemini provider only.

# The Backend in Step 1 references google-secret. Create it with a placeholder so
# the test needs no real key: every assertion below resolves before agentgateway
# calls the provider.
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: google-secret
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  Authorization: "${GOOGLE_KEY:-test}"
EOF
{{< /doc-test >}}

## Step 1: Add the Gemini route types

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that maps the Gemini method suffixes to their route types. The default behavior routes all traffic as `Completions`, so the native Gemini paths must be mapped explicitly.

If you already set up [multiple endpoints]({{< link-hextra path="/integrations/llm/providers/multiple-endpoints/" >}}), add these paths to your existing {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml {paths="gemini-inbound"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: google-native
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      gemini: {}
  policies:
    auth:
      secretRef:
        name: google-secret
    ai:
      routes:
        ":generateContent": "GenerateContent"
        ":streamGenerateContent": "GenerateContent"
        ":countTokens": "GeminiCountTokens"
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `ai.provider.gemini` | Define the Gemini provider. Leave `model` unset so that the model from the request path is used. |
| `policies.auth` | The authentication token to use to authenticate to the LLM provider. The example refers to the `google-secret` secret from the Gemini provider setup. |
| `policies.ai.routes` | Map each Gemini method suffix to its route type. The keys are matched as path suffixes, so the method suffix on its own matches whatever version prefix the client sends. |

## Step 2: Create an HTTPRoute

Create an HTTPRoute that routes the native Gemini paths to the {{< reuse "agw-docs/snippets/backend.md" >}}.

```yaml {paths="gemini-inbound"}
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: google-native
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /v1beta/models
    backendRefs:
    - name: google-native
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      group: {{< reuse "agw-docs/snippets/group.md" >}}
      kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

{{< doc-test paths="gemini-inbound" >}}
YAMLTest -f - <<'EOF'
- name: wait for the google-native backend with the Gemini route types to be accepted
  wait:
    target:
      kind: AgentgatewayBackend
      metadata:
        namespace: agentgateway-system
        name: google-native
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
- name: wait for the google-native HTTPRoute to resolve its backendRef
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: google-native
    jsonPath: "$.status.parents[0].conditions[?(@.type=='ResolvedRefs')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF
{{< /doc-test >}}

{{< doc-test paths="gemini-inbound" >}}
# google-native is a new HTTPRoute name, so the data plane needs a moment to pick
# it up. Any HTTP answer means the proxy knows the path; the assertion follows.
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/v1beta/models/gemini-2.5-flash:generateContent" && break
  sleep 2
done
{{< /doc-test >}}

## Step 3: Send a native Gemini request

Send a request to `models/{model}` with the Gemini method suffix. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} forwards the body unchanged and returns the Gemini response shape to the client.

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}

```sh
curl "$INGRESS_GW_ADDRESS/v1beta/models/gemini-2.5-flash:generateContent" \
  -H content-type:application/json \
  -d '{
    "contents": [{"role": "user", "parts": [{"text": "Say hello"}]}]
  }' | jq
```

{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}

```sh
curl "localhost:8080/v1beta/models/gemini-2.5-flash:generateContent" \
  -H content-type:application/json \
  -d '{
    "contents": [{"role": "user", "parts": [{"text": "Say hello"}]}]
  }' | jq
```

{{% /tab %}}
{{< /tabs >}}

To estimate the size of a request before you send it, use the `:countTokens` suffix with the same body.

## Step 4: Stream a response

Streaming uses the `:streamGenerateContent` suffix, and requires the `alt=sse` query parameter.

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}

```sh
curl -N "$INGRESS_GW_ADDRESS/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse" \
  -H content-type:application/json \
  -d '{
    "contents": [{"role": "user", "parts": [{"text": "Count to five"}]}]
  }'
```

{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}

```sh
curl -N "localhost:8080/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse" \
  -H content-type:application/json \
  -d '{
    "contents": [{"role": "user", "parts": [{"text": "Count to five"}]}]
  }'
```

{{% /tab %}}
{{< /tabs >}}

Without `alt=sse`, the Gemini API streams a JSON array instead of server-sent events, which {{< reuse "agw-docs/snippets/agentgateway.md" >}} cannot parse incrementally. Rather than fail partway through a response, the request is rejected before it reaches the provider.

```json
{
  "error": {
    "code": 400,
    "message": "streamGenerateContent requires alt=sse; the JSON-array streaming variant is not supported",
    "status": "INVALID_ARGUMENT"
  }
}
```

{{< doc-test paths="gemini-inbound" >}}
YAMLTest -f - <<'EOF'
- name: streamGenerateContent without alt=sse is rejected before the provider is called
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: "/v1beta/models/gemini-2.5-flash:streamGenerateContent"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "contents": [{"role": "user", "parts": [{"text": "Count to five"}]}]
      }
  source:
    type: local
  expect:
    statusCode: 400
    bodyJsonPath:
      - path: "$.error.status"
        comparator: equals
        value: "INVALID_ARGUMENT"
      - path: "$.error.message"
        comparator: contains
        value: "streamGenerateContent requires alt=sse"
EOF
{{< /doc-test >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="gemini-inbound"}
kubectl delete httproute google-native -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} google-native -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

{{< doc-test paths="gemini-inbound" >}}
# Remove the placeholder secret that the test created before Step 1.
kubectl delete secret google-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
{{< /doc-test >}}
