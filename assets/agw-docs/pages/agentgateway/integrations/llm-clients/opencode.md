Configure [OpenCode](https://opencode.ai/), the open source AI coding agent, to send its LLM requests through agentgateway. OpenCode holds only a virtual key for agentgateway, and the provider API key stays on the gateway host.

To connect OpenCode to MCP servers through agentgateway instead, see [OpenCode MCP client]({{< link-hextra path="/integrations/mcp/clients/opencode/" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. [Install OpenCode](https://opencode.ai/docs/). This guide was tested with OpenCode 1.18.35.

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

## Configure agentgateway

Start agentgateway with an OpenAI model and a virtual key for OpenCode. OpenCode sends the virtual key, and agentgateway replaces it with the OpenAI API key before it forwards the request.

1. Create a configuration file. List each model that OpenCode can use. A request for any other model is rejected.

   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     policies:
       apiKey:
         mode: strict
         keys:
         - key: vk-opencode-4f9c2a
           metadata:
             user: alice
     models:
     - name: gpt-4o-mini
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `apiKey.keys` | The virtual key that OpenCode sends to agentgateway. Create one key for each user or workspace, so that you can revoke them separately. For more information, see [Virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}). |
   | `params.apiKey` | The OpenAI API key that agentgateway sends to OpenAI. OpenCode never receives this key. To rotate the key without restarting agentgateway, read it from a file instead. For more information, see [Provider API keys]({{< link-hextra path="/documentation/llm/api-keys/" >}}). |

2. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

## Connect OpenCode to agentgateway

1. Save the virtual key in an environment variable. This key authenticates OpenCode to agentgateway. It is not the OpenAI API key.

   ```sh
   export AGENTGATEWAY_API_KEY='vk-opencode-4f9c2a'
   ```

2. Create an `opencode.json` file in your project directory. To use agentgateway in every project instead, add the same settings to the global OpenCode configuration file, `~/.config/opencode/opencode.json`.

   ```sh
   cat > opencode.json <<'EOF'
   {
     "$schema": "https://opencode.ai/config.json",
     "model": "agentgateway/gpt-4o-mini",
     "provider": {
       "agentgateway": {
         "npm": "@ai-sdk/openai-compatible",
         "name": "Agentgateway",
         "options": {
           "baseURL": "http://localhost:4000/v1",
           "apiKey": "{env:AGENTGATEWAY_API_KEY}"
         },
         "models": {
           "gpt-4o-mini": {
             "name": "gpt-4o-mini"
           }
         }
       }
     }
   }
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `model` | The default model, in `<provider>/<model>` format. |
   | `provider.agentgateway.npm` | The AI SDK package for an OpenAI-compatible API. |
   | `options.baseURL` | The agentgateway address. The `/v1` suffix is required. |
   | `options.apiKey` | The virtual key. The `{env:AGENTGATEWAY_API_KEY}` value reads the key from the environment variable, so the key is not stored in the file. Instead of the environment variable, you can also enter the key with the `/connect` command in OpenCode. |
   | `models` | The models that agentgateway serves. Use the same names as the `models` in the agentgateway configuration. |

3. Start OpenCode from the same directory.

   ```sh
   opencode
   ```

## Verify the connection

1. Send a prompt from OpenCode. To send a single prompt without the interactive interface, run the following command.

   ```sh
   opencode run "Say hello"
   ```

2. Verify that the request appears in the agentgateway logs.

   Example output:

   ```
   info  request gateway=default/default listener=llm route=internal/llm:request endpoint=api.openai.com:443 http.method=POST http.path=/v1/chat/completions http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-4o-mini ...
   ```

If the virtual key is missing, unknown, or revoked, OpenCode shows the `401` response from agentgateway.

```
Error: Unauthorized: api key authentication failure: invalid credentials
```

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/protect-provider-keys/" title="Protect provider API keys" subtitle="Rotate and revoke keys without changing clients" >}}
  {{< card path="/documentation/llm/cost-controls/virtual-keys/" title="Virtual keys" subtitle="Issue virtual keys with token budgets and per-key metrics" >}}
{{< /cards >}}
