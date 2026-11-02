1. Set your API key in the terminal where you will run agentgateway.

   ```sh
   export META_API_KEY='<your-api-key>'
   ```

2. Create a `config.yaml` file with the following configuration.

   ```sh
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

   ```sh
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
