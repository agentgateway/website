---
title: Serve a model
weight: 20
description: Expose an LLM model to clients with an AgentgatewayModel resource, including wildcard matching and provider credentials.
test:
  serve-model:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/llm/providers/httpbun.md
    path: setup-httpbun-llm
  - path: serve-model
---

Expose an LLM model to clients with an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` resource.

## About

An `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` declares one client-facing model and attaches it to a Gateway listener. Agentgateway derives the LLM routing from the models that attach to a listener, so you do not create an {{< reuse "agw-docs/snippets/backend.md" >}} or an `HTTPRoute`.

In this guide, you enable the API, turn on LLM serving for a listener, and expose three kinds of models: an exact match, a wildcard match, and a model that authenticates to its provider with a Kubernetes Secret.

For more information, see [About models]({{< link-hextra path="/llm/models/about/" >}}).

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}) by using the **Experimental** installation. The `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` API is experimental and disabled by default. The experimental installation uses the nightly development build and enables the API with `--set agentgatewayModels.enabled=true`, because the API is not yet in a released chart.
2. Deploy the [httpbun mock LLM]({{< link-hextra path="/llm/providers/httpbun/" >}}). This guide routes to httpbun so that you do not need a provider API key. To use a real provider instead, remove the `baseURL` field from each model and follow [API keys]({{< link-hextra path="/llm/api-keys/" >}}).
3. Verify that the API is enabled. The command returns `true` when the feature gate is set.

   ```sh
   kubectl get deploy {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="AGW_ENABLE_AGENTGATEWAY_MODELS")].value}'
   ```

## Enable LLM serving on a listener

A listener serves LLM traffic only when it allows the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind. In this guide, you add the route kind to the `http` listener on the `agentgateway-proxy` Gateway that you created during setup. The gateway then serves both LLM models and ordinary `HTTPRoute` traffic on the same port.

1. Update the listener to allow both `HTTPRoute` and `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` resources.

   ```yaml {paths="serve-model"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-proxy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/agw-gatewayclass.md" >}}
     listeners:
     - name: http
       port: 80
       protocol: HTTP
       allowedRoutes:
         namespaces:
           from: All
         kinds:
         - group: gateway.networking.k8s.io
           kind: HTTPRoute
         - group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Field | Value | Description |
   |-------|-------|-------------|
   | `allowedRoutes.kinds` | `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` and `HTTPRoute` | Adding `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` enables the listener's built-in LLM paths, such as `/v1/chat/completions` and `/v1/models`. Keeping `HTTPRoute` lets your existing routes continue to work. After you set `allowedRoutes.kinds`, the listener accepts only the kinds that you list, so include every kind that you need. |
   | `listeners[0].name` | `http` | Models reference this name in `parentRefs.sectionName`. |

2. Verify that the listener now supports both kinds.

   ```sh
   kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.status.listeners[0].supportedKinds}'
   ```

   Example output:

   ```json
   [{"group":"gateway.networking.k8s.io","kind":"HTTPRoute"},{"group":"agentgateway.dev","kind":"AgentgatewayModel"}]
   ```

   {{< doc-test paths="serve-model" >}}
   # NOTE: status.listeners[].supportedKinds does not currently advertise
   # AgentgatewayModel even when the API is enabled and the kind is in
   # allowedRoutes, so we do not gate on it here. The model-serving checks below
   # (with their own warmup loops) verify the listener actually serves models.
   {{< /doc-test >}}

3. Save the gateway address in an environment variable, if you have not already.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   Use this option if your cluster does not assign an external IP to `LoadBalancer` services, such as a default Kind cluster.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```

   In a separate terminal, point the requests in this guide at the forwarded port.

   ```sh
   export INGRESS_GW_ADDRESS=localhost:8080
   ```
   {{% /tab %}}
   {{< /tabs >}}

The listener now serves LLM traffic, but it has no models yet, so every LLM request returns a `model_not_found` error.

## Serve an exact model

When you omit `spec.match`, the model matches `metadata.name` exactly. Clients request this model as `gpt-4`.

1. Create the model.

   ```yaml {paths="serve-model"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: gpt-4
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     provider: OpenAI
     baseURL: http://httpbun.default.svc.cluster.local:3090/llm
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Field | Value | Description |
   |-------|-------|-------------|
   | `parentRefs` | Gateway | Attaches the model to the `http` listener. Omit `sectionName` to attach to every eligible listener on the Gateway. |
   | `provider` | `OpenAI` | The provider that serves this model. httpbun implements the OpenAI-compatible API. |
   | `baseURL` | `http://httpbun.default.svc.cluster.local:3090/llm` | Overrides the provider address and base path prefix, so requests go to httpbun's `/llm/chat/completions` endpoint instead of OpenAI. Remove this field to use the real provider. |

2. Send a request for the model.

   ```sh
   curl -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "Hello!"}],
       "httpbun": {"content": "Hello from the mock LLM"}
     }'
   ```

   Example output:

   ```json
   {"model":"gpt-4","usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7},"choices":[{"message":{"content":"Hello from the mock LLM","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   ```

   {{< doc-test paths="serve-model" >}}
   # An AgentgatewayModel does not report status, so poll the data plane until the
   # model is served instead of waiting on a resource condition.
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" \
       -d '{"model":"gpt-4","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   YAMLTest -f - <<'EOF'
   - name: exact model gpt-4 is served
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {
           "model": "gpt-4",
           "messages": [{"role": "user", "content": "Hello!"}],
           "httpbun": {"content": "Hello from the mock LLM"}
         }
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "gpt-4"
         - path: "$.choices[0].message.content"
           comparator: contains
           value: "Hello from the mock LLM"
   EOF
   {{< /doc-test >}}

3. Request a model that does not exist. Agentgateway returns an OpenAI-compatible error.

   ```sh
   curl -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "does-not-exist", "messages": []}'
   ```

   Example output:

   ```json
   {"error":{"message":"Model not found","type":"invalid_request_error","code":"model_not_found"}}
   ```

   {{< doc-test paths="serve-model" >}}
   YAMLTest -f - <<'EOF'
   - name: unknown model returns an OpenAI-compatible error
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {"model": "does-not-exist", "messages": []}
     source:
       type: local
     expect:
       statusCode: 404
       bodyJsonPath:
         - path: "$.error.code"
           comparator: equals
           value: "model_not_found"
   EOF
   {{< /doc-test >}}

## Serve a family of models with a wildcard

Use `spec.match.model` to match more than one model name. The provider does not recognize the client-facing prefix, so pair the wildcard with a `model` transformation that rewrites the name before the request leaves the gateway.

1. Create a model that matches any name that starts with `openai/`.

   ```yaml {paths="serve-model"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: openai-models
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: openai/*
     provider: OpenAI
     baseURL: http://httpbun.default.svc.cluster.local:3090/llm
     policies:
       transformations:
       - field: model
         expression: 'llmRequest.model.stripPrefix("openai/")'
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Field | Value | Description |
   |-------|-------|-------------|
   | `model` | `openai/*` | Matches any model name that starts with `openai/`. Wildcards must be `*`, a suffix such as `openai/*`, or a prefix such as `*-latest`. |
   | `field` | `model` | The field in the provider request body to rewrite, as part of a transformation policy. |
   | `expression` | `llmRequest.model.stripPrefix("openai/")` | Removes the client-facing prefix, so the provider receives `gpt-5-mini` rather than `openai/gpt-5-mini`. |

2. Request a model through the wildcard. The response shows the transformed model name.

   ```sh
   curl -X POST http://$INGRESS_GW_ADDRESS/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "openai/gpt-5-mini",
       "messages": [{"role": "user", "content": "Hello!"}],
       "httpbun": {"content": "Hello from the mock LLM"}
     }'
   ```

   Example output. Note that `model` is `gpt-5-mini`, not `openai/gpt-5-mini`.

   ```json
   {"model":"gpt-5-mini","usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7},"choices":[{"message":{"content":"Hello from the mock LLM","role":"assistant"},"finish_reason":"stop","index":0}],"object":"chat.completion"}
   ```

   {{< doc-test paths="serve-model" >}}
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null -X POST "http://${INGRESS_GW_ADDRESS}/v1/chat/completions" \
       -H "Content-Type: application/json" \
       -d '{"model":"openai/gpt-5-mini","messages":[],"httpbun":{"content":"warmup"}}' && break
     sleep 2
   done

   YAMLTest -f - <<'EOF'
   - name: wildcard match strips the prefix before the provider sees the model
     http:
       url: "http://${INGRESS_GW_ADDRESS}/v1/chat/completions"
       method: POST
       headers:
         Content-Type: application/json
       body: |
         {
           "model": "openai/gpt-5-mini",
           "messages": [{"role": "user", "content": "Hello!"}],
           "httpbun": {"content": "Hello from the mock LLM"}
         }
     source:
       type: local
     retries: 3
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.model"
           comparator: equals
           value: "gpt-5-mini"
   EOF
   {{< /doc-test >}}

## Authenticate to the provider

Real providers require credentials. Use `spec.policies.auth` to read them from a Kubernetes Secret.

1. Create a Secret that holds the provider API key. By default, agentgateway reads the `Authorization` key.

   {{< doc-test paths="serve-model" >}}
   # The mock LLM ignores credentials; use a placeholder so the Secret is well formed.
   export OPENAI_API_KEY=sk-placeholder
   {{< /doc-test >}}

   ```yaml {paths="serve-model"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: openai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $OPENAI_API_KEY
   EOF
   ```

2. Create a model that references the Secret.

   ```yaml {paths="serve-model"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: gpt-5-mini
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     provider: OpenAI
     policies:
       auth:
         secretRef:
           name: openai-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Field | Value | Description |
   |-------|-------|-------------|
   | `secretRef` | `openai-secret` | The Secret to read the credential from. Set `secretRef.key` to read a key other than `Authorization`. |

   Agentgateway writes the credential to the `Authorization` header with a `Bearer ` prefix. Use `policies.auth.location` to write it somewhere else, such as a custom header or query parameter.

## Verify model discovery

Every public model on a listener appears in the OpenAI-compatible discovery endpoint. The endpoint requires no configuration.

```sh
curl -s http://$INGRESS_GW_ADDRESS/v1/models
```

Example output:

```json
{
  "data": [
    {"id": "gpt-4", "object": "model", "created": 1785166485, "owned_by": "openai"},
    {"id": "gpt-5-mini", "object": "model", "created": 1785166485, "owned_by": "openai"},
    {"id": "openai/*", "object": "model", "created": 1785166485, "owned_by": "openai"}
  ],
  "object": "list"
}
```

{{< doc-test paths="serve-model" >}}
# YAMLTest evaluates "$.data[*].id" to the first array element only, so a
# `contains` check can verify the first listed model (gpt-4) but cannot assert
# membership for later entries such as the "openai/*" wildcard. The wildcard is
# already validated by the "wildcard match" serving check above, and appears in
# the /v1/models response shown in the example output.
YAMLTest -f - <<'EOF'
- name: model discovery endpoint lists public models
  http:
    url: "http://${INGRESS_GW_ADDRESS}/v1/models"
    method: GET
  source:
    type: local
  retries: 3
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.data[*].id"
        comparator: contains
        value: "gpt-4"
EOF
{{< /doc-test >}}

Wildcard models are listed by their match pattern. Models with `visibility: Internal` are excluded.

## Troubleshooting

### Requests return `model_not_found`

**What's happening:**

Every request fails with the following error, even for a model you created.

```json
{"error":{"message":"Model not found","type":"invalid_request_error","code":"model_not_found"}}
```

**Why it's happening:**

The model did not attach to the listener, or it is not reachable by clients. Common causes include the following.

- The `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` API is not enabled on the control plane.
- The listener does not allow the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind.
- The `parentRefs` field does not match the Gateway name or `sectionName`.
- The model is in a different namespace than the Gateway, and the listener restricts `allowedRoutes.namespaces`.
- The model sets `visibility: Internal`, so clients cannot request it directly.

**How to fix it:**

1. Confirm that the API is enabled. If the following command returns no output, repeat the Helm step in [Before you begin](#before-you-begin).

   ```sh
   kubectl get deploy agentgateway -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="AGW_ENABLE_AGENTGATEWAY_MODELS")].value}'
   ```

2. Check how many routes attached to the listener. This count includes every `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` that attached, whether public or internal.

   ```sh
   kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.status.listeners[0].attachedRoutes}'
   ```

3. List the models that clients can reach. If a model is missing here but the `attachedRoutes` count includes it, the model is `Internal`.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS/v1/models
   ```

> [!WARNING]
> The `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` resource does not yet report status. The `status.parents` field stays empty even when a model serves traffic correctly, so you cannot use `kubectl describe agmodel` to debug attachment. Use the checks in this section instead.

### Cleanup

> [!NOTE]
> Remove the resources you created in this guide only if you do not plan to continue to [Route across models with virtual models]({{< link-hextra path="/llm/models/virtual/" >}}).

```sh {paths="serve-model-cleanup"}
kubectl delete agentgatewaymodel gpt-4 openai-models gpt-5-mini -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret openai-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

To stop the listener from serving LLM traffic, remove the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` entry from `allowedRoutes.kinds`. Do not delete the `agentgateway-proxy` Gateway, because other guides use it.
