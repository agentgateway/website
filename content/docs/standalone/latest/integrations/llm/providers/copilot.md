---
title: GitHub Copilot
weight: 20
icon: /integrations/providers/bw/copilot.svg
description: Route agentgateway LLM traffic to models available through GitHub Copilot.
test: skip
---

Configure GitHub Copilot as an LLM provider in agentgateway.

> [!NOTE]
> This page describes how to send requests to the GitHub Copilot API. To use agentgateway as the model endpoint for the Copilot extension in VS Code instead, see [GitHub Copilot as a client]({{< link-hextra path="/integrations/llm/clients/github-copilot/" >}}).

## Before you begin

Have a GitHub Copilot credential that the Copilot API accepts, for an account with access to the models that you want to use. Agentgateway does not obtain, exchange, or refresh the credential. An arbitrary GitHub personal access token might not work.

By default, agentgateway finds the credential on its own, from an environment variable or from the files that the GitHub Copilot tools and the GitHub CLI write. For the lookup order, see [GitHub Copilot backend authentication]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/copilot/" >}}). To supply the credential directly, set `params.apiKey`.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: copilot
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `copilot`. Write the provider as a string. The `copilot: {}` map form is not valid in `llm.models`. |
| `params.model` | Optional. If you set this field, this model is used for all requests. If you omit this field, the request must include the model to use. |
| `params.apiKey` | Optional. A credential to send instead of the one that agentgateway discovers. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.githubcopilot.com`. Agentgateway discovers the credential only for the default upstream, so set `params.apiKey` when you override this field. |

To pass the credential from an environment variable instead of discovering it, set `params.apiKey`.

```yaml
llm:
  models:
  - name: "*"
    provider: copilot
    params:
      apiKey: "$GH_COPILOT_TOKEN"
```

The provider also sets the protocol headers that the Copilot API expects, such as `editor-version` and `x-initiator`. For the full list, see [GitHub Copilot backend authentication]({{< link-hextra path="/documentation/configuration/security/backend-authn/providers/copilot/#what-agentgateway-sends" >}}). To configure Copilot on a route instead of in `llm.models`, use the `backendAuth: copilot` method that the same page describes.

## Example request

After you run agentgateway with the configuration from the previous section, send a Chat Completions request to the `/v1/chat/completions` endpoint. Use a model that your Copilot account can use.

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1",
    "messages": [{"role": "user", "content": "Hello from GitHub Copilot!"}]
  }'
```

## Request formats

Copilot models do not all accept the same API format. Agentgateway chooses the formats that it sends to Copilot from the model name, and it converts the client request when the client calls a different format.

| Model name | Formats that agentgateway sends |
|------------|---------------------------------|
| `claude-*` | Messages, which is sent unchanged to `/v1/messages`, and Chat Completions. |
| `gpt-3*`, `gpt-4*`, `gemini-*` | Chat Completions. |
| `gpt-5.4`, `gpt-5-mini` | Chat Completions and Responses. |
| Other `gpt-*`, `grok-*`, `mai-*` | Responses. |
| Any other name | Chat Completions. |

Tags in the model catalog take precedence over these built-in rules.

For example, a Responses request to `gpt-4.1` is converted to Chat Completions, and a Messages request to a `claude-*` model passes through. A Chat Completions request to a model that accepts only Responses, such as `gpt-5`, fails.

## Troubleshoot

| Symptom | Cause and resolution |
|---------|----------------------|
| A request returns `500` with `backend authentication failed`. The logs show `Copilot token not found`. | Agentgateway found no credential. Set `GH_COPILOT_TOKEN`, run `gh auth login`, or set `params.apiKey`. The configuration still passes `--validate-only` because the lookup happens on each request. |
| A request returns `400` with `unsupported conversion: from Completions to provider copilot`. | The model does not accept the API format of the request. The error lists the supported formats. Send the request in one of those formats. |
| GitHub rejects the credential. | The credential is expired, is not accepted by the Copilot API, or belongs to an account without access to the model. Confirm the credential and the account entitlement with GitHub. |
| Requests to a custom `params.baseUrl` have no `Authorization` header. | Agentgateway discovers the credential only for the default upstream. Set `params.apiKey`. |
