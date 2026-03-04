---
title: Anthropic
weight: 50
description: Configuration and setup for Anthropic Claude provider
---

Configure Anthropic (Claude models) as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: claude-haiku-4-5-20251001
    provider: anthropic
    params:
      model: claude-haiku-4-5-20251001
      apiKey: "$ANTHROPIC_API_KEY"
```
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The name identifier for this model configuration. |
| `provider` | The LLM provider, set to `anthropic` for Claude models. |
| `params.model` | The specific Claude model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The Anthropic API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |

## Example request

After running agentgateway with the configuration from the previous section, you can send a request to the `v1/messages` endpoint. Agentgateway automatically adds the `x-api-key` authorization and `anthropic-version` headers to the request. The request is forwarded to the Anthropic API and the response is returned to the client.

```json
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-haiku-20241022",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Example response:

```json
{
  "model": "claude-haiku-4-5-20251001",
  "usage": {
    "input_tokens": 9,
    "output_tokens": 21,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0,
    "cache_creation": {
      "ephemeral_5m_input_tokens": 0,
      "ephemeral_1h_input_tokens": 0
    },
    "service_tier": "standard"
  },
  "content": [
    {
      "text": "Hi there! How are you doing today? Is there anything I can help you with?",
      "type": "text"
    }
  ],
  "id": "msg_01QdUEuzvXfjLh1HfMQd4UHP",
  "type": "message",
  "role": "assistant",
  "stop_reason": "end_turn",
  "stop_sequence": null
}
```

## Token counting

Anthropic's `count_tokens` API is supported for estimating token usage before making a request. Agentgateway automatically handles the required `anthropic-version` header and formats the request correctly for Anthropic's API.

```bash
curl -X POST http://localhost:3000/v1/messages/count_tokens \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "messages": [{"role": "user", "content": "Hello!"}],
    "system": "You are a helpful assistant."
  }'
```

Example response:

```json
{
  "input_tokens": 15
}
```

## Connect to Claude Code

Connect to Claude Code locally to verify access to the Anthropic provider through agentgateway.

1. Get your Anthropic API key from the [Anthropic Console](https://console.anthropic.com) and save it as an environment variable.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-api03-your-actual-key-here"
   ```

2. Start agentgateway with the following configuration.
   ```yaml
   cat > config.yaml << EOF
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config

   llm:
     models:
     - name: claude-haiku-4-5-20251001
       provider: anthropic
       params:
         model: claude-haiku-4-5-20251001
         apiKey: "$ANTHROPIC_API_KEY"
   EOF

   agentgateway -f config.yaml
   ```

3. In another terminal, configure Claude Code to use the agentgateway instance that is running on your localhost.

   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:3000"
   ```

4. Start Claude Code with the new configuration.

   ```bash
   claude
   ```

5. Send a test request through Claude Code, such as `Hello`.

6. In the terminal where you run agentgateway, check the logs. You should see the requests in agentgateway logs. Claude Code continues to work normally while benefiting from any agentgateway features that you added, such as traffic management, security, and monitoring.
   
   Example output:
   
   ```
   2025-10-16T20:10:17.919575Z	info	request gateway=bind/3000 listener=listener0 route_rule=route0/default route=route0 endpoint=api.anthropic.com:443 src.addr=[::1]:59011 http.method=POST http.host=localhost http.path=/v1/messages?beta=true http.version=HTTP/1.1 http.status=200 gen_ai.operation.name=chat gen_ai.provider.name=anthropic gen_ai.request.model=claude-haiku-4-5-20251001 gen_ai.response.model=claude-haiku-4-5-20251001 gen_ai.usage.input_tokens=4734 gen_ai.usage.output_tokens=32 gen_ai.request.temperature=0 gen_ai.request.max_tokens=512 duration=1900ms
   ```
