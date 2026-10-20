Route LLM requests from [OpenCode](https://opencode.ai/) through agentgateway. In this guide, OpenCode uses a virtual key, and the provider API key stays on the gateway host.

To connect OpenCode to MCP servers through agentgateway instead, see [OpenCode MCP client]({{< link-hextra path="/integrations/mcp/clients/opencode/" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Get an [OpenAI API key](https://platform.openai.com/api-keys) and save it in the `OPENAI_API_KEY` environment variable. The configuration in this guide reads the key from that variable.

   ```sh
   export OPENAI_API_KEY=<your-api-key>
   ```

3. [Install OpenCode](https://opencode.ai/docs/). This guide was tested with OpenCode 1.18.35.

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

## Configure agentgateway

Configure an OpenAI model and a virtual key for OpenCode. Agentgateway replaces the virtual key with the OpenAI API key when forwarding requests.

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
   | `apiKey.keys` | The virtual key for OpenCode. Use one per user or workspace to revoke access separately. See [Virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}). |
   | `params.apiKey` | The key for OpenAI. For file-based rotation without a restart, see [Provider API keys]({{< link-hextra path="/documentation/llm/api-keys/" >}}). |

2. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

## Connect OpenCode to agentgateway

1. Save the virtual key in an environment variable.

   ```sh
   export AGENTGATEWAY_API_KEY='vk-opencode-4f9c2a'
   ```

2. Create `opencode.json` in your project directory. For settings that apply to all projects, use `~/.config/opencode/opencode.json`.

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
   | `options.apiKey` | Reads the virtual key from `AGENTGATEWAY_API_KEY` to keep it out of the file. You can also enter the key with OpenCode's `/connect` command. |
   | `models` | The models that agentgateway serves. Use the same names as the `models` in the agentgateway configuration. |

3. Start OpenCode from the same directory.

   ```sh
   opencode
   ```

## Verify the connection

1. Send a prompt in OpenCode, or run a single prompt from the command line:

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
  {{< card path="/documentation/llm/cost-controls/virtual-keys/" title="Virtual keys" subtitle="Protect provider keys and add optional budgets and usage tracking" >}}
{{< /cards >}}
