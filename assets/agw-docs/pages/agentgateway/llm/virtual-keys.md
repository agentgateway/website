Keep provider API keys on the gateway and give each client a revocable virtual key. Add token budgets and usage tracking as needed.

## About

Clients use virtual keys to authenticate to {{< reuse "agw-docs/snippets/agentgateway.md" >}}. The proxy replaces each virtual key with the provider key stored in a Kubernetes Secret before forwarding the request. Clients never receive the provider key, and the provider never receives the virtual key.

Each client has its own key, so you can revoke one client's access without rotating the provider key or reconfiguring other clients. Provider-key rotation happens in the cluster.

### How virtual keys work

{{% reuse "agw-docs/snippets/llm-provider-key-flow.md" %}}

First, [set up virtual keys](#set-up-virtual-keys) and [manage client access](#manage-client-access). You can stop there, or continue with optional [token budgets](#configure-token-budgets) and [usage tracking](#monitor-per-key-spending).

### Security considerations

All clients depend on the provider key in the Secret. Protect it as you would any other production credential.

* **Restrict who can read the Secret.** Limit the Kubernetes RBAC permissions to read Secrets in the namespace of the {{< reuse "agw-docs/snippets/backend.md" >}}.
* **Encrypt client traffic.** Virtual keys are bearer credentials. Serve clients over [HTTPS]({{< link-hextra path="/documentation/setup/listeners/https/" >}}), or keep the Gateway on a private network.
* **Keep {{< reuse "agw-docs/snippets/agentgateway.md" >}} up to date** with security patches.

**Multiple policies:** Keep authentication, model authorization, and rate limits in the same policy when they target the same Gateway. Separate policies can overwrite one another even when both report `ACCEPTED/ATTACHED`.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

The OpenAI provider guide stores the provider key in `openai-secret`. For other ways to provide it, see [Provider API keys]({{< link-hextra path="/documentation/llm/api-keys/" >}}).

## Set up virtual keys

Create virtual keys for Alice and Bob, configure authentication, and verify their access. This setup does not require a rate limit server.

### Create API keys for users

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
Store a SHA-256 hash of each virtual key in a ConfigMap. The proxy hashes each incoming key and compares it to the stored hash. You do not need to store raw virtual keys in the cluster.

1. Generate a hash for each virtual key. This example creates keys for Alice and Bob. Do not include a trailing newline.

   ```sh
   printf '%s' 'vk-alice-4f9c2a' | sha256sum | awk '{print "sha256:"$1}'   # alice
   printf '%s' 'vk-bob-8d1e7b' | sha256sum | awk '{print "sha256:"$1}'     # bob
   ```

2. Create a ConfigMap with the hash and metadata of each key. The label lets the authentication policy in the next step select the ConfigMap.

   ```yaml,paths="virtual-keys"
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: llm-api-keys
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       agentgateway.dev/apikey: "true"
   data:
     alice: |
       {
         "keyHash": "sha256:84d589f2439e4d9ff4438aa840e63ffcbf231a87e7fef929f975d2bde03dc78c",
         "metadata": {
           "user_id": "alice"
         }
       }
     bob: |
       {
         "keyHash": "sha256:8373319fb10e2e023343d98ade630529f49c53f567cbc6626d09aaf650b2e58c",
         "metadata": {
           "user_id": "bob"
         }
       }
   EOF
   ```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
| -- | -- |
| `metadata.labels` | The label that the authentication policy uses to select the ConfigMap. |
| `data.<name>` | One JSON entry per user, with a `keyHash` and optional `metadata`. |
| `keyHash` | A SHA-256 hash in `sha256:<hex>` format. Clients send the raw key in the `Authorization: Bearer <key>` header. |
| `metadata.user_id` | The user identifier that budget and metrics policies read as `apiKey.user_id`. |

> [!TIP]
> ConfigMaps with hashed keys are the recommended storage format. If you already store keys in Secrets, use [`agctl migrate`]({{< link-hextra path="/reference/agctl/agctl-migrate/" >}}) to convert them, or see [API key authentication]({{< link-hextra path="/documentation/security/apikey/" >}}) for Secret-based configuration.

{{< /version >}}

{{< version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
Create an API key secret that stores keys and metadata for each user.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: llm-api-keys
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  alice: |
    {
      "key": "vk-alice-4f9c2a",
      "metadata": {
        "user_id": "alice"
      }
    }
  bob: |
    {
      "key": "vk-bob-8d1e7b",
      "metadata": {
        "user_id": "bob"
      }
    }
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `stringData.<name>` | Each key in `stringData` represents a user. The value is a JSON object containing the API key and metadata. |
| `key` | The API key value that users include in their `Authorization: Bearer` header. |
| `metadata.user_id` | The user identifier extracted by rate limiting policies to enforce per-user budgets. |
{{< /version >}}

### Configure API key authentication

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
Create an {{< reuse "agw-docs/snippets/policy.md" >}} that requires API key authentication for all requests to the gateway. Unlike Secrets, which you can reference directly by name, ConfigMaps can be selected only by label. Use `configMapSelector` to match every ConfigMap that carries the label you added in the previous step, whether that is a single ConfigMap or several.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: api-key-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    apiKeyAuthentication:
      mode: Strict
      configMapSelector:
        matchLabels:
          agentgateway.dev/apikey: "true"
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `targetRefs` | Apply the policy to the entire Gateway so all routes require API keys. |
| `apiKeyAuthentication.mode` | Set to `Strict` to require a valid API key for all requests. |
| `configMapSelector.matchLabels` | Selects all ConfigMaps that carry the given labels, combining their keys. Every entry in a selected ConfigMap must use `keyHash`; a raw `key` value is rejected because ConfigMaps are not confidential. |
{{< /version >}}

{{< version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
Create an {{< reuse "agw-docs/snippets/policy.md" >}} that requires API key authentication for all requests to the gateway. You can source the API keys from a single Secret with `secretRef`, or from multiple Secrets selected by label with `secretSelector`. Use `secretSelector` when you want to spread keys across many Secrets, such as one Secret per team or tenant, instead of maintaining a single Secret.

{{< tabs >}}
{{% tab name="Single Secret (secretRef)" %}}
Reference a single Secret by name. This example uses the `llm-api-keys` Secret that you created in the previous step.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: api-key-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    apiKeyAuthentication:
      mode: Strict
      secretRef:
        name: llm-api-keys
EOF
```
{{% /tab %}}
{{% tab name="Multiple Secrets (secretSelector)" %}}
Select all Secrets that carry a particular label. Every matching Secret contributes its keys to the same key set, so you do not need to consolidate keys into one Secret. Label each Secret that holds virtual keys, for example:

```sh
kubectl label secret llm-api-keys -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway.dev/apikey=true
```

Then reference the label with `secretSelector` instead of `secretRef`.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: api-key-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    apiKeyAuthentication:
      mode: Strict
      secretSelector:
        matchLabels:
          agentgateway.dev/apikey: "true"
EOF
```

> [!WARNING]
> `secretSelector` matches `Secret` resources only. Keep key identifiers unique across the selected Secrets: if the same key is defined in more than one Secret, the behavior is undefined.
{{% /tab %}}
{{< /tabs >}}

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `targetRefs` | Apply the policy to the entire Gateway so all routes require API keys. |
| `apiKeyAuthentication.mode` | Set to `Strict` to require a valid API key for all requests. |
| `secretRef.name` | References a single Secret containing API keys and user metadata. Use this or `secretSelector`, not both. |
| `secretSelector.matchLabels` | Selects all Secrets that carry the given labels, combining their keys. Use instead of `secretRef` when keys are spread across multiple Secrets. Secret-only. |
{{< /version >}}

### Set up an LLM backend

Create an {{< reuse "agw-docs/snippets/backend.md" >}} that connects to your LLM provider.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      openai: {}
        # Optional: specify a default  model
        #model: {{< reuse "agw-docs/snippets/openai-model.md" >}}
     # Optional: custom host and port, if needed
     # host: api.openai.com  
     # port: 443
  policies:
    auth:
      secretRef:
        name: openai-secret
    ai:
      routes:
        "/v1/responses": "Responses"
        "/v1/chat/completions": "Completions"
        "/v1/models": "Models"          # also silences Codex's model-metadata probe
        "*": "Passthrough"
EOF
```

For detailed instructions on creating backends and storing provider API keys, see the [API keys guide]({{< link-hextra path="/documentation/llm/api-keys/" >}}).

### Create a route to the backend

Create an HTTPRoute that forwards all paths to the OpenAI {{< reuse "agw-docs/snippets/backend.md" >}}. Clients can use the standard `/v1/chat/completions` path.

```yaml,paths="virtual-keys"
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
    - backendRefs:
        - name: openai
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          group: {{< reuse "agw-docs/snippets/group.md" >}}
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

### Test the virtual keys

Verify that a valid key succeeds and an unknown key gets a `401` response. No token budget is configured yet.

{{< doc-test paths="virtual-keys-openai-test" >}}
# Test virtual key authentication and routing against the OpenAI route
YAMLTest -f - <<'EOF'
- name: wait for HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        name: openai
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2

- name: verify request with Alice's virtual key succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer vk-alice-4f9c2a"
    body: |
      {
        "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request with Bob's virtual key succeeds independently
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer vk-bob-8d1e7b"
    body: |
      {
        "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request without valid API key is rejected
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer invalid-key"
    body: |
      {
        "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 401
EOF
{{< /doc-test >}}

{{< doc-test paths="virtual-keys-httpbun-test" >}}
# Test virtual key authentication and routing against the httpbun route
YAMLTest -f - <<'EOF'
- name: wait for HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        name: httpbun-llm
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2

- name: verify request with Alice's virtual key succeeds
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer vk-alice-4f9c2a"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}],
        "httpbun": {"content": "Hello from httpbun"}
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request with Bob's virtual key succeeds independently
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer vk-bob-8d1e7b"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}],
        "httpbun": {"content": "Hello from httpbun"}
      }
  source:
    type: local
  expect:
    statusCode: 200

- name: verify request without valid API key is rejected
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer invalid-key"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 401
EOF
{{< /doc-test >}}

1. Send a request with Alice's API key. Verify that the request succeeds.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H "Authorization: Bearer vk-alice-4f9c2a" \
      -H "Content-Type: application/json" \
     -d '{
       "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/chat/completions" \
     -H "Authorization: Bearer vk-alice-4f9c2a" \
      -H "Content-Type: application/json" \
     -d '{
       "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example successful response:
   ```json
   {
     "id": "chatcmpl-abc123",
     "object": "chat.completion",
     "created": 1234567890,
     "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
     "choices": [{
       "index": 0,
       "message": {
         "role": "assistant",
         "content": "Hello! How can I help you today?"
       },
       "finish_reason": "stop"
     }],
     "usage": {
       "prompt_tokens": 10,
       "completion_tokens": 9,
       "total_tokens": 19
     }
   }
   ```

2. Send a request with an unknown key. Verify that the proxy returns `401`.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" "$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H "Authorization: Bearer vk-unknown" \
     -H "Content-Type: application/json" \
     -d '{"model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}", "messages": [{"role": "user", "content": "Hello!"}]}'
   ```

   Expected response:

   ```
   401
   ```

Configure other clients with the Gateway base URL, such as `http://$INGRESS_GW_ADDRESS/v1`, and their virtual key. See [LLM clients]({{< link-hextra path="/integrations/llm/clients/" >}}) for client-specific settings.

## Manage client access

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}
### Restrict model access {#restrict-model-access}

By default, a key can request any model the provider offers. Add an authorization rule to the existing `api-key-auth` policy to restrict requests to a model list. Include the model used by the examples in this guide.

```sh
kubectl patch {{< reuse "agw-docs/snippets/policy.md" >}} api-key-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --type=merge --patch-file=/dev/stdin <<'EOF'
spec:
  traffic:
    authorization:
      action: Require
      policy:
        matchExpressions:
          - 'request.method != "POST" || json(request.body).model in ["{{< reuse "agw-docs/snippets/openai-model.md" >}}", "gpt-4o-mini", "gpt-4o"]'
EOF
```

The rule allows `POST` requests only for listed models. Other methods, such as `GET` to list models, are allowed. To set access per user, combine the model expression with a metadata check such as `apiKey.user_id == "bob"`.

Request an unlisted model, such as `o3`. The proxy returns `403`, even if the provider key allows that model.

```sh
curl -s -w "\n%{http_code}\n" "$INGRESS_GW_ADDRESS/v1/chat/completions" \
  -H "Authorization: Bearer vk-alice-4f9c2a" \
  -H "Content-Type: application/json" \
  -d '{"model": "o3", "messages": [{"role": "user", "content": "Hello!"}]}'
```
{{< /version >}}

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
### Revoke a virtual key {#revoke-a-virtual-key}

Remove Bob's entry from the ConfigMap. Other keys keep working, and the proxy does not need a restart.

```sh
kubectl patch configmap llm-api-keys -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --type=json -p='[{"op": "remove", "path": "/data/bob"}]'
```

Send a request with Bob's key and verify that the proxy returns `401`.

```sh
curl -s -o /dev/null -w "%{http_code}\n" "$INGRESS_GW_ADDRESS/v1/chat/completions" \
  -H "Authorization: Bearer vk-bob-8d1e7b" \
  -H "Content-Type: application/json" \
  -d '{"model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}", "messages": [{"role": "user", "content": "Hello!"}]}'
```

To continue with the budget examples, restore Bob's key by reapplying the ConfigMap from [Create API keys for users](#create-api-keys-for-users).
{{< /version >}}

### Rotate a provider key {#rotate-a-provider-key}

Update the provider credential on the gateway. Clients keep their virtual keys. Follow [Rotate a provider key]({{< link-hextra path="/documentation/llm/api-keys/#rotate" >}}) to replace the credential, verify requests, and revoke the old provider key.

## Configure token budgets {#configure-token-budgets}

Token budgets are optional. Continue here to give Alice and Bob independent daily budgets, shared across proxy replicas. This example uses only 100 tokens per day so that you can test enforcement quickly.

Rate limiting runs before prompt guards, so requests rejected by those guards can still consume quota. Requests rejected during authentication do not consume a token budget.

### Configure per-key token budgets

{{% reuse "agw-docs/snippets/rate-limit-token-budget-step.md" %}}

### Deploy the rate limit server

{{% reuse "agw-docs/snippets/rate-limit-step.md" %}}

### Verify budget enforcement

{{< doc-test paths="virtual-keys-ratelimit-test" >}}
# Drain Alice's 100-token daily budget. httpbun returns ~20-30 tokens per response,
# so a handful of requests pushes Alice over the budget.
for i in $(seq 1 10); do
  curl -s -o /dev/null \
    "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer vk-alice-4f9c2a" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"Say hello"}]}'
  sleep 0.3
done

YAMLTest -f - <<'EOF'
- name: Alice is rejected with 429 after exhausting her token budget
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer vk-alice-4f9c2a"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  retries: 3
  expect:
    statusCode: 429
- name: Bob still succeeds because he has an independent budget
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/v1/chat/completions"
    method: POST
    headers:
      Content-Type: application/json
      Authorization: "Bearer vk-bob-8d1e7b"
    body: |
      {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Say hello"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

1. Send requests with Alice's API key until her 100-token daily budget is exhausted. Because the LLM provider returns roughly 20-30 tokens per response, a handful of requests pushes Alice over the budget. The request that crosses the budget still completes; subsequent requests are rejected with a 429 status code.

   ```sh
   for i in $(seq 1 10); do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
       "$INGRESS_GW_ADDRESS/v1/chat/completions" \
       -H "Authorization: Bearer vk-alice-4f9c2a" \
       -H "Content-Type: application/json" \
       -d '{"model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}", "messages": [{"role": "user", "content": "Hello!"}]}')
     echo "Request $i: HTTP $STATUS"
   done
   ```

   Example 429 response:
   ```
   HTTP/1.1 429 Too Many Requests
   x-ratelimit-limit: 100
   x-ratelimit-remaining: 0
   x-ratelimit-reset: 43200

   rate limit exceeded
   ```

2. Verify that Bob can still send requests with his own budget, independent of Alice's usage.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H "Authorization: Bearer vk-bob-8d1e7b" \
      -H "Content-Type: application/json" \
     -d '{
       "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/chat/completions" \
     -H "Authorization: Bearer vk-bob-8d1e7b" \
      -H "Content-Type: application/json" \
     -d '{
       "model": "{{< reuse "agw-docs/snippets/openai-model.md" >}}",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Bob's requests succeed because he has his own independent budget.

## Monitor per-key spending

Usage tracking is optional and does not require a token budget. Add per-user labels to Prometheus metrics to attribute token usage and estimate spending.

By default, the {{< reuse "agw-docs/snippets/agentgateway.md" >}} token usage metric (`agentgateway_gen_ai_client_token_usage`) is broken down by dimensions such as the model and token type, but *not* by user. To attribute usage to each virtual key, add a `user_id` label to the metrics with a metrics policy, then query Prometheus.

> [!NOTE]
> The token usage metric only appears after a request *succeeds* and the LLM returns a usage count. Requests that are rejected (for example, a `401` from an invalid key or a `429` from the rate limit) never reach the LLM, so they do not produce token usage metrics.

### Before you begin {#monitor-prereqs}

Set up a Prometheus instance to scrape {{< reuse "agw-docs/snippets/agentgateway.md" >}} metrics, such as by completing the [OpenTelemetry stack guide]({{< link-hextra path="/documentation/observability/otel-stack/" >}}). The following steps assume the `kube-prometheus-stack` release exists in the `telemetry` namespace, as deployed by that guide.

### Add a per-key metric label

You can add a per-key metric label such as to track metrics by user ID. Note that the `user_id` label is high cardinality: every unique value creates a new metric series, which increases Prometheus memory and storage. This is acceptable for tens or hundreds of keys, but avoid attaching unbounded identifiers at large scale. Prefer lower-cardinality dimensions like tier or team when possible.

1. Update the existing `api-key-auth` policy to add the key's `user_id` as a Prometheus label. The merge patch keeps authentication, model restrictions, and any budgets already configured on the Gateway.

   ```yaml
   kubectl patch {{< reuse "agw-docs/snippets/policy.md" >}} api-key-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --type=merge --patch-file=/dev/stdin <<'EOF'
   spec:
     frontend:
       metrics:
         attributes:
           add:
             - name: user_id
               expression: 'apiKey.user_id'
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting     | Description |
   |-------------|-------------|
   | `frontend.metrics.attributes.add[].name` | The name of the Prometheus label to add (`user_id`). |
   | `frontend.metrics.attributes.add[].expression` | A CEL expression that is evaluated per request. Use `apiKey.user_id` to read the `user_id` from the authenticated API key. If the expression fails to evaluate (for example, on an unauthenticated request), the label value is set to `unknown`. |

2. Send a few requests with each virtual key so that the metrics have per-user data to report. You can reuse the requests from [Test the virtual keys](#test-the-virtual-keys).

### Query per-key usage

1. Port-forward the Prometheus server from the OpenTelemetry stack.

   ```sh
   kubectl port-forward -n telemetry svc/kube-prometheus-stack-prometheus 9090:9090
   ```

   Then open the Prometheus UI at `http://localhost:9090/graph` and run the following queries, or send them to the HTTP API with `curl`. For example:

   ```sh
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum)'
   ```

   Example output:

   ```json
   {"status":"success","data":{"resultType":"vector","result":[{"metric":{},"value":[1782410561.391,"720"]},{"metric":{"user_id":"bob"},"value":[1782410561.391,"448"]},{"metric":{"user_id":"alice"},"value":[1782410561.391,"448"]}]}}
   ```

2. Query token usage broken down by user ID. The token usage metric carries a separate series per token type (`input`, `output`, `input_cache_read`), so match both the input and output types in a single selector and sum them, rather than adding two selectors together.

   {{< tabs >}}
   {{% tab name="Query" %}}   
   ```promql
   # Total tokens consumed by user over the last 24 hours
   sum by (user_id) (
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type=~"input|output"}[24h])
   )

   # Percentage of a 100-token daily budget used (adjust the divisor to match your budget)
   (sum by (user_id) (
     increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type=~"input|output"}[24h])
   ) / 100) * 100
   ```
   {{% /tab %}}
   {{% tab name="curl example" %}}
   ```bash
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=sum by (user_id) (increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type=~"input|output"}[24h]))'
   ```

   ```bash
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=(sum by (user_id) (increase(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type=~"input|output"}[24h])) / 100) * 100'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Each result series is labeled with a `user_id`, such as `alice` and `bob`. If a key is missing the `user_id` field, or the request is not attributed to a key, its usage appears under `user_id="unknown"`.

   Example output:

   ```json
   {"status":"success","data":{"resultType":"vector","result":[{"metric":{},"value":[1782411002.488,"0"]},{"metric":{"user_id":"bob"},"value":[1782411002.488,"372.2787929364588"]},{"metric":{"user_id":"alice"},"value":[1782411002.488,"309.56920815395927"]}]}}
   
   {"status":"success","data":{"resultType":"vector","result":[{"metric":{},"value":[1782411059.867,"0"]},{"metric":{"user_id":"bob"},"value":[1782411059.867,"370.95800165527817"]},{"metric":{"user_id":"alice"},"value":[1782411059.867,"307.9427844448483"]}]}}
   ```

   > [!NOTE]
   > `increase()` and `rate()` need at least two samples within the time range to report a value, so a brand-new `user_id` series shows no result until it has been scraped a few times under continuous traffic. For a quick instant check, query the cumulative counter directly: `sum by (user_id) (agentgateway_gen_ai_client_token_usage_sum)`.

3. Calculate costs per user by multiplying token counts by your provider's pricing. Input and output tokens are usually priced differently, so reduce each token type to a per-user series with `sum by (user_id)` before adding them, which keeps the two sides matchable.

   {{< tabs >}}
   {{% tab name="Query" %}}   
   ```promql
   # Cost per user (assuming $0.50 per 1M input tokens, $1.50 per 1M output tokens)
   sum by (user_id) (rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h])) / 1000000 * 0.50
   +
   sum by (user_id) (rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h])) / 1000000 * 1.50
   ```
   {{% /tab %}}
   {{% tab name="curl example" %}}
   ```bash
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=sum by (user_id) (rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h])) / 1000000 * 0.50 + sum by (user_id) (rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h])) / 1000000 * 1.50'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```json
   {"status":"success","data":{"resultType":"vector","result":[{"metric":{},"value":[1782410758.432,"0"]},{"metric":{"user_id":"bob"},"value":[1782410758.432,"6.101636101191084e-09"]},{"metric":{"user_id":"alice"},"value":[1782410758.432,"5.106526900820178e-09"]}]}}
   ```

For more information on cost tracking, see the [cost tracking guide]({{< link-hextra path="/documentation/llm/cost-controls/cost-tracking/" >}}).

## Advanced configuration

For tiered, hourly, and multi-tenant token budgets, see [Advanced per-key budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/#advanced-per-key-budgets" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} api-key-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete configmap llm-api-keys -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete secret llm-api-keys -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete httproute openai -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} openai -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

To remove the rate limit server, follow the [cleanup steps]({{< link-hextra path="/documentation/security/rate-limit-global#cleanup" >}}) in the global rate limiting guide.
