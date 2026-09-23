---
title: DeepKeep
weight: 20
description: Use the DeepKeep AI Firewall as an external guardrail through the Guardrail Webhook API.
test: skip
---

You can use [DeepKeep](https://www.deepkeep.ai/) as an external guardrail provider by running the [DeepKeep agentgateway webhook adapter](https://github.com/Deepkeepai/agentgateway-deepkeep-webhook). The adapter exposes the default Guardrail Webhook API paths that agentgateway calls and forwards checks to DeepKeep's pre-model and post-model moderation endpoints.

## Run the adapter {#run}

Run the adapter with the DeepKeep connection settings for your environment.

```sh
docker run --rm -p 8000:8000 \
  -e DEEPKEEP_BASE_URL=https://deepkeep.example \
  -e DEEPKEEP_API_KEY=dk_... \
  -e DEEPKEEP_MODEL=your-firewall-id \
  ghcr.io/deepkeepai/agentgateway-deepkeep-webhook:latest
```

## Configure agentgateway {#configure}

Configure agentgateway to send request and response guardrail checks to the adapter.

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - webhook:
          target:
            host: localhost:8000
      response:
      - webhook:
          target:
            host: localhost:8000
```

The adapter maps DeepKeep `block`, `redact`, `modify`, and `alert` actions to the Guardrail Webhook API actions that agentgateway understands.

## More information {#more-information}

- [Custom webhooks]({{< link-hextra path="/documentation/llm/prompt-guards/webhooks/" >}}) for the webhook contract, the timeout, and the `failureMode` setting.
- [Prompt guards]({{< link-hextra path="/documentation/llm/prompt-guards/overview/" >}}) for the built-in guards that you can run alongside a webhook.
