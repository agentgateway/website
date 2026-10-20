Issue virtual API keys to users or applications with `agctl standalone`. Each key can restrict model access and carry independent dollar or token budgets. Clients use the virtual key to authenticate to agentgateway, while agentgateway uses separate credentials to authenticate to the provider.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/documentation/setup/install/" >}}) and [agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) from the main development builds.
2. Get an OpenAI API key, or adapt the model configuration below to your [LLM provider]({{< link-hextra path="/integrations/llm/providers/" >}}).
3. Use a writable configuration file for this walkthrough. For hybrid storage or a remote gateway, review [Manage config resources]({{< link-hextra path="/documentation/operations/config-resources/" >}}).

## Configure the gateway

Enable API-key authentication before creating keys. The database persists budget counts and records LLM requests for analytics. File mode, used here, stores the keys in your configuration file; hybrid mode stores API-managed keys in the database overlay.

1. Set the provider credential in the terminal where you run agentgateway.

   ```sh
   export OPENAI_API_KEY='<your-provider-api-key>'
   ```

2. Create the gateway configuration. The empty `keys` list lets you create keys through the CLI after startup.

   ```sh
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     database:
       url: sqlite://virtual-keys.db
   llm:
     policies:
       apiKey:
         mode: strict
         keys: []
     models:
     - name: gpt-5
       provider: openAI
       params:
         model: gpt-5
         apiKey: "$OPENAI_API_KEY"
   EOF
   ```

   | Field | Description |
   | --- | --- |
   | `config.database.url` | Stores budget usage and request logs. Budgets require this primary database; a logging-only database does not satisfy that requirement. |
   | `llm.policies.apiKey.mode` | `strict` rejects requests without a valid virtual key. |
   | `llm.policies.apiKey.keys` | Initial keys. The CLI adds keys to this policy. |
   | `llm.models[].name` | The client-facing model name used by key restrictions and requests. |
   | `llm.models[].params.apiKey` | The provider credential, which is separate from the virtual keys you issue. |

3. Validate and start the gateway. Keep it running while you use the CLI in another terminal.

   ```sh
   agentgateway --validate-only -f config.yaml
   agentgateway -f config.yaml
   ```

## Create and list keys {#create}

Generate a key for a user or application. The CLI prints the plaintext key once and stores only its SHA-256 hash. Capture the value when you create it; neither `get` nor `keys` can recover it afterward.

1. Create a key named `team-a` with a daily token budget and a model restriction.

   ```sh
   VIRTUAL_KEY="$(agctl standalone keys create team-a \
     --model 'gpt-5*' \
     --budget 1000000tokens/24h \
     --budget-action block)"
   ```

   | Flag | Description |
   | --- | --- |
   | `--model` | An allowed client-facing model name or wildcard pattern. Repeat the flag for several patterns. Omit it to allow all models. |
   | `--budget` | Amount and window, such as `1000000tokens/24h` or `10usd/24h`. Repeat the flag for independent budgets. An omitted window defaults to `30d`. |
   | `--budget-action` | `block` rejects requests after a budget is exhausted. The default, `audit`, records overages without rejecting requests. |

   The CLI names this budget `tokens-24h` and sets the key's `metadata.name` to `team-a`. Budget windows are aligned to the Unix epoch, rather than starting when the key is created. For charging and overshoot behavior, see [Budget and spend limits]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/" >}}).

2. List the keys and their configured restrictions. The table shows a key hint, allowed models, budget limits, and resource ID.

   ```sh
   agctl standalone keys
   ```

3. Inspect the key's complete configuration, including its hash.

   ```sh
   agctl standalone get llm.apiKey team-a -o yaml
   ```

To create a dollar budget, use an amount such as `--budget 10usd/24h`. The [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) must price the models that the key uses. The built-in catalog prices common public models; add overrides for custom models or contracted rates. A request with no price cannot be charged to a dollar budget.

## Test the key

Send requests with the virtual key to confirm both authentication and model restrictions. Resource writes propagate asynchronously; if the first request returns `401` immediately after key creation, retry after the configuration reloads.

1. Send a request for the allowed model. Run this command in the terminal where you set `VIRTUAL_KEY`.

   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer $VIRTUAL_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"model":"gpt-5","messages":[{"role":"user","content":"Hello!"}]}'
   ```

   The provider returns a chat completion. Agentgateway charges its reported token usage to the key's budget.

2. Request a model outside the allowed pattern. Agentgateway rejects it before calling a provider.

   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer $VIRTUAL_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"model":"other-model","messages":[{"role":"user","content":"Hello!"}]}'
   ```

   Example response with HTTP status `403`:

   ```json
   {"error":{"message":"Model is not allowed for this API key","type":"invalid_request_error","code":"model_not_allowed"}}
   ```

## Check usage and spending {#usage}

Inspect enforced budget counts separately from historical request analytics. Budget counts are attached to keys; analytics aggregates the requests stored in the log database.

```sh
agctl standalone budgets --key team-a
agctl standalone analytics --by agentgateway.user --since 24h
agctl standalone logs --since 1h --attributes -o json
```

Omit `--key` to show all per-key budgets. The budget table includes usage, limit, remaining amount, reset time, status, and action. It does not report `localRateLimit` token buckets.

By default, the recorded `agentgateway.user` attribute can use API-key metadata, including `user` or `name`. For this local example it resolves to `team-a`. Authenticated key ownership or a custom `config.standardAttributes` mapping can change the attribution. For more breakdowns, see [Cost dashboard and CLI analytics]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/#cli" >}}).

## Update a key {#update}

Export the existing resource to change metadata, model restrictions, or budgets while keeping the credential. The update replaces the resource value, so preserve every field you want to retain.

1. Export the key. The CLI preserves its resource ID even with `--no-metadata`.

   ```sh
   agctl standalone get llm.apiKey team-a -o yaml --no-metadata > team-a.yaml
   ```

2. Edit `team-a.yaml`. For example, add `group: engineering` under `value.metadata`. Keep the top-level `id`, `value.keyHash`, and existing metadata. Do not change server-managed fields whose names start with `agentgateway.dev/`.

   To adjust the budget, edit `value.budgets[].limit.amount`. Keep the budget name and window when you want to retain its accounting identity. For budget options, see [Per-key budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/" >}}).

3. Apply the update and verify it.

   ```sh
   agctl standalone apply -f team-a.yaml
   agctl standalone get llm.apiKey team-a -o yaml
   ```

The original `VIRTUAL_KEY` still authenticates because the hash is unchanged. The `keys create` command has no arbitrary metadata flags; use this update workflow when policies need `apiKey.user`, `apiKey.group`, or other metadata.

## Revoke a key {#revoke}

Delete the key when its user or application no longer needs access. Requests already in flight can complete; new requests are rejected after the deletion propagates.

1. Delete the key by name, or use its resource ID if names are ambiguous.

   ```sh
   agctl standalone delete llm.apiKey team-a
   agctl standalone keys
   ```

2. Repeat the allowed-model request from [Test the key](#test-the-key). Confirm that it returns `401` after the configuration reloads.

For credential rotation, create a replacement under a new name, update the client, and then revoke the old key.

## Clean up

1. Stop the gateway with `Ctrl+C`.
2. Remove the local walkthrough files and clear the virtual key from your shell.

   ```sh
   rm -f config.yaml team-a.yaml virtual-keys.db virtual-keys.db-shm virtual-keys.db-wal
   unset VIRTUAL_KEY
   ```

## Next steps

- [Per-key dollar or token budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/" >}}) for a walkthrough that exhausts a small budget.
- [Rate limit token budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/rate-limit/" >}}) for refillable token buckets.
- [API key authentication]({{< link-hextra path="/documentation/configuration/security/apikey-authn/" >}}) for declarative configuration and policy attachment.
- [The UI]({{< link-hextra path="/documentation/setup/ui/" >}}) to manage keys interactively on **LLM > Virtual API Keys**.
