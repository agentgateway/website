---
title: CoreWeave Serverless Inference
weight: 20
icon: /integrations/providers/bw/coreweave.svg
description: Route agentgateway LLM traffic to open models and custom LoRA adapters served by CoreWeave Serverless Inference.
---

Configure [CoreWeave Serverless Inference](https://docs.coreweave.com/products/inference/serverless) as an LLM provider in agentgateway. The `coreweave` provider sends Chat Completions requests to the CoreWeave Serverless Inference API at `https://api.inference.wandb.ai/v1`.

CoreWeave Serverless Inference serves the open models in the [CoreWeave model list](https://docs.coreweave.com/products/inference/serverless/models) and the custom LoRA adapters that you upload to your CoreWeave team. Model names use the Hugging Face `<vendor>/<model>` format, such as `meta-llama/Llama-3.1-8B-Instruct`. LoRA adapters use a `wandb-artifact:///` URI as the model name. For more information, see [Serve a custom LoRA adapter](#lora).

The upstream API supports only Chat Completions. Agentgateway converts Messages and Responses requests to Chat Completions before it sends them to CoreWeave.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Get an API key from your [CoreWeave settings](https://forge.coreweave.com/settings).
3. Optional: Find the team and project to attribute usage to. CoreWeave reads the team and project from the `OpenAI-Project` request header, in the `<team>/<project>` format. If you do not send this header, CoreWeave assigns usage to your default team and a project named `inference`.

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab, without the `OpenAI-Project` header.

1. Set your API key in the `COREWEAVE_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export COREWEAVE_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **CoreWeave Serverless Inference**.
5. Keep the default `coreweave/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `COREWEAVE_API_KEY`.
7. For **Outgoing model**, keep **Strip coreweave/**. This option removes the `coreweave/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.
8. Click **Save model**.

{{< reuse "agw-docs/standalone/llm/providers/ui-add-model-notes.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: "coreweave/*"
    provider: coreweave
    params:
      apiKey: "$COREWEAVE_API_KEY"
    requestHeaders:
      set:
        # Optional. Replace with your CoreWeave team and project.
        OpenAI-Project: my-team/my-project
    transformation:
      model: llmRequest.model.stripPrefix("coreweave/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `coreweave/*` pattern matches any model name that starts with `coreweave/`. |
| `provider` | The LLM provider, set to `coreweave`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your CoreWeave API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.inference.wandb.ai/v1`. |
| `requestHeaders.set.OpenAI-Project` | Optional. The CoreWeave team and project, in the `<team>/<project>` format, that CoreWeave assigns usage to. |
| `transformation.model` | Removes the `coreweave/` prefix from the model name before the request is forwarded, so the provider receives its own model name. CoreWeave model names include the vendor, such as `meta-llama/Llama-3.1-8B-Instruct`. |
{{% /tab %}}
{{< /tabs >}}

## Example request

After you run agentgateway with the configuration from the previous section, send an OpenAI-compatible request to the `/v1/chat/completions` endpoint.

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "coreweave/meta-llama/Llama-3.1-8B-Instruct",
    "messages": [{"role": "user", "content": "Hello from CoreWeave!"}]
  }'
```

## Serve a custom LoRA adapter {#lora}

CoreWeave Serverless Inference can serve a LoRA adapter on top of a supported base model. You upload the adapter to your CoreWeave team as a `lora` artifact. Then, you send the artifact URI as the model name. Agentgateway forwards the URI to CoreWeave without changes, so you do not need a separate model entry for each adapter.

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

3. Send a request with the artifact URI as the model name. The URI has the format `wandb-artifact:///<team>/<project>/<artifact-name>:<alias-or-version>`. Add the `coreweave/` prefix so that the request matches the `coreweave/*` model.

   ```bash
   curl -X POST http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "coreweave/wandb-artifact:///my-team/my-project/my_lora:latest",
       "messages": [{"role": "user", "content": "Say hello."}]
     }'
   ```

   To serve one adapter at a stable name, add a model entry that sets `params.model` to the artifact URI. Clients then send `"model": "my-lora"`.

   ```yaml
   llm:
     models:
     - name: my-lora
       provider: coreweave
       params:
         apiKey: "$COREWEAVE_API_KEY"
         model: "wandb-artifact:///my-team/my-project/my_lora:latest"
   ```

The built-in model catalog includes prices for the CoreWeave base models. The catalog does not include LoRA artifact URIs, so agentgateway does not compute a cost for LoRA requests unless you add the URIs to a custom model catalog.

## Response settings and prefix caching {#response-settings}

Agentgateway forwards the CoreWeave [response settings](https://docs.coreweave.com/products/inference/serverless/response-settings/json-mode) to CoreWeave without changes. These settings include JSON mode and structured output (`response_format`), tool calling (`tools` and `tool_choice`), and streaming (`stream`). For streaming requests, agentgateway sets `stream_options.include_usage` so that it can record token usage.

CoreWeave caches prompt prefixes automatically on supported models. When a response reuses the cache, CoreWeave reports the cached tokens in `usage.prompt_tokens_details.cached_tokens`. Agentgateway records these tokens as cache reads and uses the cache read price from the model catalog to compute the cost.

CoreWeave can reuse a cached prefix for any request that has the same prefix and the same `cache_salt` value. All requests through agentgateway use the same CoreWeave API key. To keep the cache of one caller separate from the cache of other callers, set `cache_salt` for each caller. Use a final transformation, so that agentgateway sets `cache_salt` after it converts Messages and Responses requests to Chat Completions. A transformation that runs before the conversion does not keep `cache_salt`.

The following example sets `cache_salt` from the `sub` claim of the caller's JWT. For the steps to configure JWT authentication, see [JWT authentication]({{< link-hextra path="/documentation/configuration/security/authentication/jwt-authn/" >}}). If you use virtual keys, you can use `apiKey.user` instead.

```yaml
llm:
  models:
  - name: "coreweave/*"
    provider: coreweave
    params:
      apiKey: "$COREWEAVE_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("coreweave/")
    finalTransformation:
      cache_salt: '"tenant-" + jwt.sub'
```

## Use a custom provider in earlier versions {#custom-provider}

Versions of agentgateway before the `coreweave` provider was added can connect to CoreWeave Serverless Inference with a [custom provider]({{< link-hextra path="/integrations/llm/providers/custom/" >}}). Declare only the `completions` format, because CoreWeave serves only the Chat Completions API.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: "coreweave/*"
    provider:
      custom:
        formats:
        - type: completions
    params:
      apiKey: "$COREWEAVE_API_KEY"
      baseUrl: "https://api.inference.wandb.ai/v1"
    requestHeaders:
      set:
        # Optional. Replace with your CoreWeave team and project.
        OpenAI-Project: my-team/my-project
    transformation:
      model: llmRequest.model.stripPrefix("coreweave/")
```
