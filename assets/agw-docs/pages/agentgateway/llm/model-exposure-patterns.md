## Choose how to expose models

Clients choose a model by setting the `model` field in each request. The model names that you match decide which models clients can reach, how many entries you maintain, and whether clients can tell which provider serves a request. {{% conditional-text include-if="standalone" %}}Each pattern sets the `name` field of an `llm.models` entry.{{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}}Each pattern sets the `spec.match.model` field of an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}`. When you omit `spec.match`, the model matches its `metadata.name` exactly. For more information about the API, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}). If you configure LLMs with an {{< reuse "agw-docs/snippets/backend.md" >}} and an `HTTPRoute` instead, see [Model aliasing]({{< link-hextra path="/documentation/llm/alias/" >}}).{{% /conditional-text %}}

| Pattern | Example | Entries to maintain | Use it when |
|---------|---------|---------------------|-------------|
| [Provider prefix](#provider-prefix) (recommended) | `openai/*` | One per provider | You want a good general default. Clients can request any model from each provider, and the model name shows which provider serves it. |
| [Exact model name](#exact-model-name) | `gpt-5.6-luna` | One per model | You want an explicit list of the models that clients can use. |
| [Prefix without a provider](#prefix-without-a-provider) | `gpt-*`, `claude-*` | One per model family | You want plain model names from several providers without listing each model, and each model family comes from only one provider. |
| [Catch-all](#catch-all) | `*` | One | You use one provider and want to expose all of its models{{% conditional-text include-if="standalone" %}}, or you want one fallback provider for every model that no other entry matches{{% /conditional-text %}}. |
| [Custom model name](#custom-model-name) | `fast`, `support-bot` | One per name | You want to hide the underlying model from clients, so that you can change it without updating clients. |

{{% conditional-text include-if="standalone" %}}You can combine these patterns in one configuration. For how agentgateway picks an entry when more than one matches, see [Combine patterns](#combine-patterns).{{% /conditional-text %}}

### Provider prefix

Match every model name that starts with a provider prefix, such as `openai/`, and remove the prefix before the request goes to the provider. One entry exposes every model from that provider, including models that the provider releases later. Clients send names such as `openai/gpt-5-mini` or `anthropic/claude-sonnet-4-5`, so every request shows which provider serves it.

{{% conditional-text include-if="standalone" %}}
```yaml
llm:
  models:
  - name: "openai/*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("openai/")
  - name: "anthropic/*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("anthropic/")
```
{{% /conditional-text %}}
{{% conditional-text include-if="kubernetes" %}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: openai
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  match:
    model: "openai/*"
  provider: OpenAI
  policies:
    auth:
      secretRef:
        name: openai-secret
    transformations:
    - field: model
      expression: 'llmRequest.model.stripPrefix("openai/")'
```

Create one resource like this for each provider, such as `anthropic/*` with `provider: Anthropic`.
{{% /conditional-text %}}

The `/v1/models` endpoint lists each model from the [model catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) with the prefix, such as `openai/gpt-5-mini`, so that clients can discover what they can request. To limit clients to some of the provider's models, list [exact model names](#exact-model-name) instead{{% conditional-text include-if="standalone" %}}, or restrict each API key to model patterns such as `openai/gpt-5*` with [`allowedModels`]({{< link-hextra path="/documentation/configuration/security/apikey-authn/#llm-budgets-and-model-access" >}}){{% /conditional-text %}}.

### Exact model name

Match one model name, and send it to the provider unchanged. Clients can reach only the models that you list, so you need a new entry before clients can use a new model. That makes this pattern a good fit when you approve models one at a time.

{{% conditional-text include-if="standalone" %}}
```yaml
llm:
  models:
  - name: gpt-5.6-luna
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
  - name: claude-sonnet-4-5
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```
{{% /conditional-text %}}
{{% conditional-text include-if="kubernetes" %}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  # With no spec.match, clients request the model by this name
  name: gpt-5.6-luna
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  provider: OpenAI
  policies:
    auth:
      secretRef:
        name: openai-secret
```

Set `spec.match.model` when the model name is not a valid Kubernetes resource name, such as a name with uppercase letters, a `/`, or a `:`.
{{% /conditional-text %}}

### Prefix without a provider

Match a model family by the start of its name, such as `gpt-*` or `claude-*`, and send the name to the provider unchanged. Clients use the plain model names that they already know, even when the models come from different providers, and you do not list each model. This pattern is useful in fewer setups than a provider prefix, because of the following limits.

- Each model family maps to one provider, so you cannot offer the same model from two providers, such as `claude-haiku-4-5` from both Anthropic and Amazon Bedrock. Use a [provider prefix](#provider-prefix) for that case.
- A prefix matches only the names that start with it. For example, `gpt-*` does not match the OpenAI models `o3` or `text-embedding-3-small`.
{{% conditional-text include-if="standalone" %}}- Patterns can overlap. For example, `claude-*` and `*-latest` both match `claude-sonnet-latest`. When two patterns have the same number of characters other than `*`, the entry that is listed first wins.{{% /conditional-text %}}

{{% conditional-text include-if="standalone" %}}
```yaml
llm:
  models:
  - name: "gpt-*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
  - name: "claude-*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```
{{% /conditional-text %}}
{{% conditional-text include-if="kubernetes" %}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: claude-models
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  match:
    model: "claude-*"
  provider: Anthropic
  policies:
    auth:
      secretRef:
        name: anthropic-secret
```
{{% /conditional-text %}}

### Catch-all

Match any model name with `*`, and send it to the provider unchanged. This pattern is the simplest way to expose every model when you use one provider. Clients can request any model name, so a name that the provider does not serve fails at the provider instead of at the gateway.

{{% conditional-text include-if="standalone" %}}Because `*` is the least specific match, it also works as a fallback next to other entries. Requests for models that no other entry matches go to the catch-all provider. For an example, see [Combine patterns](#combine-patterns).

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{% /conditional-text %}}
{{% conditional-text include-if="kubernetes" %}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: all-openai-models
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  match:
    model: "*"
  provider: OpenAI
  policies:
    auth:
      secretRef:
        name: openai-secret
```
{{% /conditional-text %}}

### Custom model name

Publish a name of your own, such as `fast` or `support-bot`, and set the provider model that it maps to. Clients never depend on a provider model name, so you can switch the model behind a name in one place, without updating clients.

{{% conditional-text include-if="standalone" %}}
```yaml
llm:
  models:
  - name: fast
    provider: openAI
    params:
      model: gpt-5-mini
      apiKey: "$OPENAI_API_KEY"
  - name: support-bot
    provider: anthropic
    params:
      model: claude-haiku-4-5
      apiKey: "$ANTHROPIC_API_KEY"
```

The `params.model` field sets the model that the provider receives.
{{% /conditional-text %}}
{{% conditional-text include-if="kubernetes" %}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
metadata:
  name: fast
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    sectionName: http
  provider: OpenAI
  policies:
    auth:
      secretRef:
        name: openai-secret
    transformations:
    - field: model
      expression: '"gpt-5-mini"'
```

The `model` transformation sets the model that the provider receives.
{{% /conditional-text %}}

To serve one custom name from several models, such as to split traffic during a migration or to fail over when a provider degrades, use a {{% conditional-text include-if="standalone" %}}[virtual model]({{< link-hextra path="/documentation/llm/virtual-models/" >}}){{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}}[virtual model]({{< link-hextra path="/documentation/llm/models/virtual/" >}}){{% /conditional-text %}}.

{{% conditional-text include-if="standalone" %}}
### Combine patterns

You can mix the patterns in one configuration. The following example exposes all OpenAI and Anthropic models with provider prefixes, publishes a `support-bot` model, and sends every other model name to OpenRouter as a fallback.

```yaml
llm:
  models:
  - name: "openai/*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("openai/")
  - name: "anthropic/*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("anthropic/")
  - name: support-bot
    provider: anthropic
    params:
      model: claude-haiku-4-5
      apiKey: "$ANTHROPIC_API_KEY"
  - name: "*"
    provider: openrouter
    params:
      apiKey: "$OPENROUTER_API_KEY"
```

When more than one entry matches a request, agentgateway selects one in the following order.

1. A [virtual model]({{< link-hextra path="/documentation/llm/virtual-models/" >}}) with the exact requested name.
2. The most specific matching entry, which is the entry with the most characters other than `*`. An exact name beats a wildcard that matches the same request, and `openai/*` beats `*`, no matter where each entry is listed.
3. The entry that is listed first, when two matching entries are equally specific.

An entry is skipped when its `matches` headers do not match the request, or when its `authorization` rules deny the request. Agentgateway then tries the next matching entry, and returns an error only when no matching entry allows the request. So a broader entry, such as a catch-all, serves requests that a more specific entry denies. If you restrict a model with `authorization`, apply the same rules to every broader entry that also matches it, or leave out the catch-all.
{{% /conditional-text %}}
