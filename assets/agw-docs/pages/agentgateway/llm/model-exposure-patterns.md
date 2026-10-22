## Choose how to expose models

Clients select a model with the request's `model` field. Choose a matching pattern to control which models they can request and how you name them.

{{% conditional-text include-if="standalone" %}}Each pattern sets the `name` field of an `llm.models` entry.{{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}}Each pattern sets the name that clients request in an `{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}`. For a wildcard pattern, set `spec.match.model`. Otherwise, omit `spec.match` to match `metadata.name` exactly.

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
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Models** in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
2. From the **Provider** dropdown, select **OpenAI**. The UI fills in `openai/*` for the **Incoming model match**.
3. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`. The variable must be set in the environment that agentgateway runs in, or the save fails.
4. For the **Outgoing model**, make sure that **Strip openai/** is selected. This option writes the `stripPrefix("openai/")` transformation.

   {{< reuse-image src="img/ui-llm-model-prefixed.png" srcDark="img/ui-llm-model-prefixed-dark.png" >}}

5. Click **Save model**.
6. Repeat the previous steps with the **Anthropic** provider and the `ANTHROPIC_API_KEY` environment variable. The UI fills in `anthropic/*` and selects **Strip anthropic/**.

The UI writes the providers as `openai` and `anthropic`. Agentgateway accepts both spellings.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/provider-prefix-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/provider-prefix-config.md" >}}
{{% /version %}}
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
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Models**, and click **Add model**.
2. From the **Provider** dropdown, select **OpenAI**.
3. Replace the **Incoming model match** with `gpt-5.6-luna`.
4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.
5. For the **Outgoing model**, make sure that **Incoming model** is selected.

   {{< reuse-image src="img/ui-llm-model-exact.png" srcDark="img/ui-llm-model-exact-dark.png" >}}

6. Click **Save model**.
7. Repeat the previous steps with the **Anthropic** provider, the `claude-sonnet-4-5` match, and the `ANTHROPIC_API_KEY` environment variable.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/exact-model-name-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/exact-model-name-config.md" >}}
{{% /version %}}
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
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Models**, and click **Add model**.
2. From the **Provider** dropdown, select **OpenAI**.
3. Replace the **Incoming model match** with `gpt-*`.
4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.
5. For the **Outgoing model**, select **Incoming model**.
6. Click **Save model**.
7. Repeat the previous steps with the **Anthropic** provider, the `claude-*` match, and the `ANTHROPIC_API_KEY` environment variable.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/prefix-without-provider-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/prefix-without-provider-config.md" >}}
{{% /version %}}
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

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Models**, and click **Add model**.
2. From the **Provider** dropdown, select **OpenAI**.
3. Replace the **Incoming model match** with `*`.
4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.
5. For the **Outgoing model**, make sure that **Incoming model** is selected.

   {{< reuse-image src="img/ui-llm-model-passthrough.png" srcDark="img/ui-llm-model-passthrough-dark.png" >}}

6. Click **Save model**.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/catch-all-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/catch-all-config.md" >}}
{{% /version %}}
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

{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
> [!WARNING]
> In version 1.6, agentgateway does not rank models by how specific their match is. It selects the first matching model in alphabetical order of `metadata.name`. A catch-all model can therefore take requests that are meant for an exact name or a provider prefix, and the request reaches the provider without the prefix stripped. Do not attach a catch-all model to the same listener as other models.
{{< /version >}}
{{% /conditional-text %}}

### Custom model name

Publish a custom name, such as `fast` or `support-bot`, and map it to a provider model. Change that mapping to switch models without updating clients.

{{% conditional-text include-if="standalone" %}}
{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< tabs >}}
{{% tab name="UI" %}}
1. Open **LLM** > **Models**, and click **Add model**.
2. From the **Provider** dropdown, select **OpenAI**.
3. Replace the **Incoming model match** with `fast`.
4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.
5. For the **Outgoing model**, select **Explicit**. In the **Explicit outgoing model** field, enter or select `gpt-5-mini`.

   {{< reuse-image src="img/ui-llm-model-alias.png" srcDark="img/ui-llm-model-alias-dark.png" >}}

6. Click **Save model**.
7. Repeat the previous steps for `support-bot`, with the **Anthropic** provider, the `ANTHROPIC_API_KEY` environment variable, and `claude-haiku-4-5` as the explicit outgoing model.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/custom-model-name-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/llm/model-patterns/custom-model-name-config.md" >}}
{{% /version %}}

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

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}The UI adds each new model to the end of the list and cannot reorder models. To set the order for ties, add the models in the UI in the order that you want them listed.{{< /version >}}

Agentgateway skips entries if their `matches` headers do not match or their `authorization` rules deny the request. It returns an error only if no matching entry allows the request.

A broader entry can therefore serve a request denied by a more specific entry. Apply the same authorization rules to broader matches, including the catch-all, or remove those entries.
{{% /conditional-text %}}
