---
title: Anthropic
weight: 50
description: Configuration and setup for Anthropic Claude provider
---

Configure Anthropic (Claude models) as an LLM provider in agentgateway.

## Configuration

{{< reuse "docs/snippets/review-configuration.md" >}}

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: anthropic
          provider:
            anthropic:
              model: claude-3-5-haiku-20241022
          routes:
            /v1/messages: messages
            /v1/chat/completions: completions
            /v1/models: passthrough
            "*": passthrough
      policies:
        backendAuth:
          key: "$ANTHROPIC_API_KEY"
```
{{< reuse "docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The name of the LLM provider for this AI backend, `anthropic`. |
| `model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
| `routes` | Include the URL paths to route types. The keys are URL suffix matches, such as `"/v1/messages"` and `"/v1/chat/completions"`. The special `*` wildcard matches any path. If not specified, all traffic is treated as OpenAI's chat completions format. The `messages` format processes requests in Anthropic's native messages format. This enables full compatibility with Claude Code and other Anthropic-native tools.|
| `backendAuth` | Anthropic uses API keys for authentication. You can optionally configure a policy to attach an API key that authenticates to the LLM provider on outgoing requests. If you do not include an API key, each request must pass in a valid API key. |

## Connect to Claude Code

Connect to Claude Code locally to verify access to the Anthropic provider through agentgateway.

1. Get your Anthropic API key from the [Anthropic Console](https://console.anthropic.com) and save it as an environment variable.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-api03-your-actual-key-here"
   ```

2. Start agentgateway with the following configuration. Make sure that the `v1/messages` route is set so that Claude Code can connect to agentgateway.
   
   ```bash
   cat > config.yaml << EOF
   binds:
   - port: 3000
     listeners:
     - routes:
       - backends:
         - ai:
             name: anthropic
             provider:
               anthropic:
                 model: claude-3-5-haiku-20241022
             routes:
               /v1/messages: messages
               /v1/chat/completions: completions
               /v1/models: passthrough
               "*": passthrough
         policies:
           backendAuth:
             key: "$ANTHROPIC_API_KEY"
   EOF
   
   agentgateway -f config.yaml
   ```

3. In another terminal, configure Claude Code to use agentgateway.

   ```bash
   export ANTHROPIC_API_URL="http://localhost:3000/v1/messages"
   ```

4. Start Claude Code with the new configuration with your local environment variable.

   ```bash
   claude
   ```

5. Send a test request through Claude Code, such as `Briefly tell me what you can do.` 

6. In the terminal where you run agentgateway, check the logs. You should see the requests in agentgateway logs. Claude Code continues to work normally while benefiting from any agentgateway features that you added, such as traffic management, security, and monitoring.
   
   Example output:
   ```
   ```
