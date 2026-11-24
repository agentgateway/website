Configure [CoreWeave Serverless Inference](https://docs.coreweave.com/products/inference/serverless) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}. CoreWeave Serverless Inference serves open models and your custom LoRA adapters through an OpenAI-compatible Chat Completions API.

You can connect to CoreWeave with an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} or an {{< reuse "agw-docs/snippets/backend.md" >}}. The `CoreWeave` model preset sends Chat Completions requests to `https://api.inference.wandb.ai/v1`. Agentgateway converts Messages and Responses requests to Chat Completions before it sends them to CoreWeave. The {{< reuse "agw-docs/snippets/backend.md" >}} approach sends Chat Completions requests only.

For translated Responses requests, include the conversation history in `input` on each turn. Use `/v1/chat/completions` for image inputs because Responses conversion drops images.

CoreWeave model names use the Hugging Face `<vendor>/<model>` format, such as `meta-llama/Llama-3.1-8B-Instruct`. LoRA adapters use a `wandb-artifact:///<team>/<project>/<artifact-name>:<alias-or-version>` URI as the model name.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. To use the {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} approach, allow the `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}` route kind on the `http` listener of the `agentgateway-proxy` Gateway. For the steps, see [Enable LLM serving on a listener]({{< link-hextra path="/documentation/llm/models/serve/#enable-llm-serving-on-a-listener" >}}).

## Set up provider credentials

Store your CoreWeave API key in a Secret. The model and backend examples both reference this Secret.

1. Get an API key from your [CoreWeave settings](https://forge.coreweave.com/settings).

2. Save the API key in an environment variable.

   ```sh
   export COREWEAVE_API_KEY='<your-api-key>'
   ```

3. Create a Kubernetes Secret to store your API key.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: coreweave-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $COREWEAVE_API_KEY
   EOF
   ```

## Chat Completions requests with an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} {#coreweave-model}

The models attach directly to the Gateway listener, so you do not create an {{< reuse "agw-docs/snippets/backend.md" >}} or an HTTPRoute.

1. Create the following {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} resources. The `coreweave-llama` model serves `meta-llama/Llama-3.1-8B-Instruct`. The `coreweave-lora` model serves every LoRA adapter in the `my-team/my-project` CoreWeave project.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayModel
   metadata:
     name: coreweave-llama
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: meta-llama/Llama-3.1-8B-Instruct
     provider: CoreWeave
     policies:
       auth:
         secretRef:
           name: coreweave-secret
   ---
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayModel
   metadata:
     name: coreweave-lora
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: wandb-artifact:///my-team/my-project/*
     provider: CoreWeave
     policies:
       auth:
         secretRef:
           name: coreweave-secret
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#agentgatewaymodelspec" >}}).

   | Setting | Description |
   |---------|-------------|
   | `spec.match.model` | The model name that clients send in requests. The model forwards the same name to CoreWeave. The `wandb-artifact:///my-team/my-project/*` pattern matches every LoRA artifact URI in the `my-team/my-project` project. |
   | `spec.provider` | The `CoreWeave` preset. The preset supplies the default URL, `https://api.inference.wandb.ai/v1`, and the Chat Completions request format. |
   | `spec.policies.auth.secretRef` | The Secret that holds your CoreWeave API key. |

2. Send a Chat Completions request to the `meta-llama/Llama-3.1-8B-Instruct` model.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "meta-llama/Llama-3.1-8B-Instruct",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "meta-llama/Llama-3.1-8B-Instruct",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Attribute usage to a Forge project

By default, CoreWeave attributes usage to the `inference` project in your default team. To attribute usage to a different project, add the following under `spec.policies` in the model resource and replace `my-team/my-project` with your Forge team and project.

```yaml
headers:
  request:
    set:
    - name: OpenAI-Project
      value: my-team/my-project
```

## Serve a custom LoRA adapter {#lora}

CoreWeave Serverless Inference can serve a LoRA adapter on top of a supported base model. You upload the adapter to your CoreWeave team as a `lora` artifact. Then, you send the artifact URI as the model name. The `coreweave-lora` model from the previous section forwards the URI to CoreWeave without changes, so you do not need a separate {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} for each adapter.

1. Train or export a LoRA adapter in PEFT format for a base model that supports LoRA. For the list of base models and the maximum LoRA rank for each, see [Bring your own LoRA](https://docs.coreweave.com/products/inference/serverless/lora).

2. Upload the adapter as a `lora` artifact. Set `wandb.base_model` to the base model and `storage_region` to `coreweave-us`. For a complete example, see the [Create a LoRA tutorial](https://docs.coreweave.com/products/inference/serverless/tutorials/creating-lora).

   ```python
   import wandb

   run = wandb.init(entity="my-team", project="my-project")

   artifact = wandb.Artifact(
       "my_lora",
       type="lora",
       metadata={"wandb.base_model": "meta-llama/Llama-3.1-8B-Instruct"},
       storage_region="coreweave-us",
   )
   artifact.add_dir("<path-to-lora-weights>")
   run.log_artifact(artifact)
   ```

3. Send a Chat Completions request with the artifact URI as the model name.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "wandb-artifact:///my-team/my-project/my_lora:latest",
       "messages": [{"role": "user", "content": "Say hello."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/v1/chat/completions" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "wandb-artifact:///my-team/my-project/my_lora:latest",
       "messages": [{"role": "user", "content": "Say hello."}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

The built-in model catalog includes prices for the CoreWeave base models. The catalog does not include LoRA artifact URIs, so agentgateway does not compute a cost for LoRA requests unless you add the URIs to a custom model catalog.

## Response settings and prefix caching {#response-settings}

For Chat Completions requests, agentgateway forwards the CoreWeave [response settings](https://docs.coreweave.com/products/inference/serverless/response-settings/json-mode), including JSON mode and structured output (`response_format`), tool calling (`tools` and `tool_choice`), and streaming (`stream`). For streaming requests, agentgateway sets `stream_options.include_usage` so that it can record token usage.

CoreWeave caches prompt prefixes automatically on supported models. When a response reuses the cache, CoreWeave reports the cached tokens in `usage.prompt_tokens_details.cached_tokens`. Agentgateway records these tokens as cache reads and uses the cache read price from the model catalog to compute the cost.

CoreWeave can reuse a cached prefix for any request that has the same prefix and the same `cache_salt` value. All requests through agentgateway use the same CoreWeave API key. To keep the cache of one caller separate from the cache of other callers, set `cache_salt` for each caller. Use a final transformation, so that agentgateway sets `cache_salt` after it converts Messages and Responses requests to Chat Completions. A transformation that runs before the conversion does not keep `cache_salt`.

The following example adds `cache_salt` to the `coreweave-llama` model from the `sub` claim of the caller's JWT. The example requires JWT authentication on the Gateway.

```yaml
kubectl patch AgentgatewayModel coreweave-llama -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge -p '
spec:
  policies:
    finalTransformations:
    - field: cache_salt
      expression: "\"tenant-\" + jwt.sub"
'
```

## Chat Completions requests with an {{< reuse "agw-docs/snippets/backend.md" >}} {#coreweave-backend}

Use this approach to select the backend with an HTTPRoute.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} that points the `openai` provider at CoreWeave.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: coreweave
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: meta-llama/Llama-3.1-8B-Instruct
         host: api.inference.wandb.ai
         port: 443
         path: /v1/chat/completions
     policies:
       auth:
         secretRef:
           name: coreweave-secret
       tls:
         sni: api.inference.wandb.ai
   EOF
   ```

2. Create an HTTPRoute that routes requests on the `/coreweave` path to the {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: coreweave
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches:
       - path:
           type: PathPrefix
           value: /coreweave
       backendRefs:
       - name: coreweave
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

3. Send a Chat Completions request to the route.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "http://$INGRESS_GW_ADDRESS/coreweave" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "meta-llama/Llama-3.1-8B-Instruct",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/coreweave" \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "meta-llama/Llama-3.1-8B-Instruct",
       "messages": [{"role": "user", "content": "Explain retrieval-augmented generation in one sentence."}]
     }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Next steps

To connect other providers that expose an OpenAI-compatible API, see [OpenAI-compatible providers]({{< link-hextra path="/integrations/llm/providers/openai-compatible/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete AgentgatewayModel coreweave-llama coreweave-lora -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete HTTPRoute coreweave -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} coreweave -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret coreweave-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
