## Choose how to expose models

Clients select a model with the request's `model` field. Choose a matching pattern to control which models they can request and how you name them.

{{% conditional-text include-if="standalone" %}}Each pattern sets the `name` field of an `llm.models` entry.{{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}}Each pattern sets `spec.match.model` in an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}`. Omit `spec.match` to match `metadata.name` exactly.

For API details, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}). For configurations that use an {{< reuse "agw-docs/snippets/backend.md" >}} and an `HTTPRoute`, see [Model aliasing]({{< link-hextra path="/documentation/llm/alias/" >}}).{{% /conditional-text %}}

| Pattern | Example | Entries to maintain | Use it to |
|---------|---------|---------------------|-------------|
| [Provider prefix](#provider-prefix) (recommended) | `openai/*` | One per provider | Expose all models with names that identify the provider. |
| [Exact model name](#exact-model-name) | `gpt-5.6-luna` | One per model | Allow only explicitly listed models. |
| [Prefix without a provider](#prefix-without-a-provider) | `gpt-*`, `claude-*` | One per model family | Use plain model names with one provider per family. |
| [Catch-all](#catch-all) | `*` | One | Expose all models from one provider{{% conditional-text include-if="standalone" %}}, or use it as a fallback for unmatched names{{% /conditional-text %}}. |
| [Custom model name](#custom-model-name) | `fast`, `support-bot` | One per name | Change the underlying model without updating clients. |

{{% conditional-text include-if="standalone" %}}For matching priority when you mix patterns, see [Combine patterns](#combine-patterns).{{% /conditional-text %}}

### Provider prefix

Match names with a provider prefix, such as `openai/gpt-5-mini`, and strip the prefix before forwarding the request. One entry exposes all of the provider's models, including new releases.

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

The `/v1/models` endpoint lists prefixed names from the [model catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}), such as `openai/gpt-5-mini`.

To restrict access, list [exact model names](#exact-model-name){{% conditional-text include-if="standalone" %}}, or set per-key patterns such as `openai/gpt-5*` with [`allowedModels`]({{< link-hextra path="/documentation/configuration/security/apikey-authn/#llm-budgets-and-model-access" >}}){{% /conditional-text %}}.

### Exact model name

Match a single model name and forward it unchanged. Add an entry for each model you allow clients to use.

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

Set `spec.match.model` for names that Kubernetes does not allow in `metadata.name`, such as those containing uppercase letters, `/`, or `:`.
{{% /conditional-text %}}

### Prefix without a provider

Match a model family, such as `gpt-*` or `claude-*`, and forward the name unchanged. Maintain one entry per family.

This pattern has the following limits.

- Each family maps to one provider. To offer the same model through Anthropic and Amazon Bedrock, for example, use a [provider prefix](#provider-prefix).
- A prefix matches only the names that start with it. For example, `gpt-*` does not match the OpenAI models `o3` or `text-embedding-3-small`.

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

Match any model name with `*` and forward it unchanged. Use this pattern to expose all models from one provider. Unsupported model names fail at the provider rather than the gateway.

{{% conditional-text include-if="standalone" %}}The `*` pattern has the lowest priority, so it can serve as a fallback for unmatched names. See [Combine patterns](#combine-patterns).

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

Publish a custom name, such as `fast` or `support-bot`, and map it to a provider model. Change that mapping to switch models without updating clients.

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

To split traffic or fail over between models behind one custom name, use a {{% conditional-text include-if="standalone" %}}[virtual model]({{< link-hextra path="/documentation/llm/virtual-models/" >}}){{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}}[virtual model]({{< link-hextra path="/documentation/llm/models/virtual/" >}}){{% /conditional-text %}}.

{{% conditional-text include-if="standalone" %}}
### Combine patterns

This example exposes OpenAI and Anthropic models with provider prefixes. It also maps `support-bot` to a specific model and uses OpenRouter for unmatched names.

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

When patterns overlap, agentgateway selects a match in the following order.

1. A [virtual model]({{< link-hextra path="/documentation/llm/virtual-models/" >}}) with the exact requested name.
2. The entry with the most characters other than `*`, regardless of list order. Exact names take priority over matching wildcards, and `openai/*` takes priority over `*`.
3. The first listed entry if matches have the same number of characters other than `*`. For example, list order breaks the tie between `claude-*` and `*-latest` for `claude-sonnet-latest`.

Agentgateway skips entries if their `matches` headers do not match or their `authorization` rules deny the request. It returns an error only if no matching entry allows the request.

A broader entry can therefore serve a request denied by a more specific entry. Apply the same authorization rules to broader matches, including the catch-all, or remove those entries.
{{% /conditional-text %}}
