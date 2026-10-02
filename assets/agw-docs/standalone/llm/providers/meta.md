Configure Meta as an LLM provider in agentgateway. The `meta` preset supports the Chat Completions, Messages, and Responses APIs.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You need agentgateway 1.6.0 or later and a Meta Model API key. Create a key in the [Meta Model API dashboard](https://dev.meta.ai/).

## Configuration

Use the `meta` preset to route requests to the Meta Model API. The preset supplies the provider URL and supported request formats.

1. Set your API key in the terminal where you will run agentgateway.

   ```sh
   export META_API_KEY='<your-api-key>'
   ```

   {{< doc-test paths="meta-validate" >}}
   # Validate the configuration without calling the Meta API. A placeholder key
   # is sufficient because --validate-only resolves environment variables.
   {{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
   export META_API_KEY="test"
   {{< /doc-test >}}

2. Create a `config.yaml` file with the following configuration.

   ```sh {paths="meta-validate"}
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: meta
       params:
         apiKey: "$META_API_KEY"
         # Optional: use this upstream model for every matching request.
         # model: muse-spark-1.3
         # Optional: override the default provider URL.
         # baseUrl: https://api.meta.ai/v1
   EOF
   ```

   | Setting | Description |
   |---------|-------------|
   | `name` | The model name to match in incoming requests. Use `*` to accept any model name. |
   | `provider` | The provider preset. Set to `meta`. |
   | `params.apiKey` | Your Meta Model API key. Use `$META_API_KEY` to read the key from the environment. |
   | `params.model` | Optional. The upstream model to use for every matching request. Omit to use the model from the request. |
   | `params.baseUrl` | Optional. Overrides the provider URL. Defaults to `https://api.meta.ai/v1`. |

3. Validate the configuration.

   ```sh {paths="meta-validate"}
   agentgateway -f config.yaml --validate-only
   ```

   Example output:

   ```text
   Configuration is valid!
   ```

4. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

## Example request

From another terminal, send a Chat Completions request to the gateway. This example uses `muse-spark-1.3`, as shown in the [Meta quickstart](https://dev.meta.ai/docs/cookbook/quickstart-chat-completions). Use a model that your Meta account can access.

```sh
curl http://localhost:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "muse-spark-1.3",
    "messages": [{"role": "user", "content": "Hello from Meta!"}]
  }'
```

<!-- The meta-validate test checks configuration parsing only. This request needs
     a real Meta API key and is intentionally excluded from that test. -->
