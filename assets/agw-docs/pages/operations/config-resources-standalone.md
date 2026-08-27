Manage agentgateway resources such as API keys at runtime through the config resource API, without restarting the proxy.

## About

Agentgateway serves a config resource API for reading and writing config resources at runtime, such as virtual API keys, models, routes, and policies. The UI calls this same API, so you can create, update, and revoke API keys from a script instead of the browser. For more information about where the UI and its API are served, see {{< version include-if="1.4.x" >}}[UI]({{< link-hextra path="/operations/ui/" >}}){{< /version >}}{{< version exclude-if="1.4.x" >}}[Launch the UI]({{< link-hextra path="/setup/ui/launch-ui/" >}}){{< /version >}}.

The config resource API is served wherever the UI is served, and the admin address always keeps a copy of it.

{{< version include-if="1.4.x" >}}
What `config.storage.mode` changes is where a write is stored, and whether the API lists the resource afterward.

| `config.storage.mode` | Where a write is stored | Listed by the API |
| -- | -- | -- |
| `file` (default) | Agentgateway rewrites your config file in place | No |
| `hybrid` | The database that `config.database.url` points to | Yes |

In `file` mode, a create request or a delete request edits the config file that agentgateway loaded at startup. Agentgateway rewrites the whole file, so comments and quoting style in that file can change. Keep this in mind if you track the file in Git. A list request returns an empty array in `file` mode, even after a successful write.

In `hybrid` mode, the config file becomes a read-only baseline. Agentgateway stores new resources in the database and merges them with the file at load time. Resources that the file owns cannot be changed through the API, and an attempt returns `409` with the message `file-owned config resource cannot be updated in hybrid mode`.
{{< /version >}}
{{< version exclude-if="1.4.x" >}}
What `config.storage.mode` changes is where a write is stored, and whether the API lists the resource afterward. In `file` mode, agentgateway writes the resource into your config file, and a list request returns an empty array. In `hybrid` mode, agentgateway stores the resource in the database and the API lists it. For each mode, what the database holds, and how the modes differ per installation method, see [Storage modes]({{< link-hextra path="/setup/storage/" >}}).
{{< /version >}}

The rest of this guide uses `hybrid` mode, which supports the full set of operations.

> [!WARNING]
> The admin address (`127.0.0.1:15000` by default) has **no authentication**. Anyone who can reach it can list, create, update, or delete keys. Keep the admin address bound to localhost, which is the default, and never expose it externally.

> [!NOTE]
> Serving the UI on a gateway and applying an `oidc` policy, as described in {{< version include-if="1.4.x" >}}[Secure the UI]({{< link-hextra path="/operations/ui/#secure-admin-ui" >}}){{< /version >}}{{< version exclude-if="1.4.x" >}}[Secure the UI]({{< link-hextra path="/setup/ui/secure-ui/" >}}){{< /version >}}, protects the UI on that gateway's port only. The admin address continues to serve this API with no authentication. Network isolation remains the control for the admin address.

## Before you begin

1. Set `config.storage.mode` to `hybrid` and give agentgateway a database in `config.database.url`. A `sqlite://` URL creates the file for you, and a `postgres://` URL is also supported.{{< version exclude-if="1.4.x" >}} For more information, see [Database]({{< link-hextra path="/setup/database/" >}}).{{< /version >}}
2. Add an `apiKey` policy to `llm.policies`. Agentgateway merges database-backed keys into this policy, so the policy must exist before you create a key. Set `keys` to an empty array to start with no keys in the file. Without the policy, a create returns `409` with the message `DB-backed API keys require llm.policies.apiKey`.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: "127.0.0.1:15000"
     storage:
       mode: hybrid
     database:
       url: "sqlite://./agentgateway.db"
   llm:
     policies:
       apiKey:
         mode: strict
         keys: []
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   ```

3. Verify the config and start agentgateway.

   ```sh
   agentgateway --validate-only -f config.yaml
   agentgateway -f config.yaml
   ```

For more information about API key authentication and the `apiKey` policy fields, see [Virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys" >}}).

## Resource kinds

A resource kind is written with dots, such as `llm.apiKey`. A bare name such as `apiKey` returns `unsupported config resource kind: apiKey`.

Agentgateway supports the following 13 resource kinds. No other kind is accepted.

| Config section | Resource kinds |
| -- | -- |
| Model catalog | `modelCatalog` |
| LLM | `llm.provider`, `llm.model`, `llm.virtualModel`, `llm.apiKey`, `llm.policy` |
| MCP | `mcp.target`, `mcp.policy`, `mcp.settings` |
| Traffic | `traffic.gateway`, `traffic.route`, `traffic.tcpRoute` |
| UI | `ui.policy` |

## Manage API keys

The following steps use the `llm.apiKey` kind. The same endpoints work for every kind in the previous table.

1. List the keys that the API manages.

   ```sh
   curl -s http://127.0.0.1:15000/api/config/resources/llm.apiKey
   ```

   Example response in `hybrid` mode. In `file` mode, the response contains only `kind`, `id`, and `value`, and a list request returns an empty array.

   ```json
   {"resources": [{
     "kind": "llm.apiKey",
     "id": "03eafb4e-4c5d-480a-a870-cdf376976430",
     "value": {
       "key": "sk-agw-8a0b7a6a…",
       "metadata": {
         "id": "03eafb4e-4c5d-480a-a870-cdf376976430",
         "name": "my-service",
         "user": "alice"
       }
     },
     "revision": 1,
     "createdAt": "2026-08-13T11:22:44.357740Z",
     "updatedAt": "2026-08-13T11:22:44.357740Z"
   }]}
   ```

2. Create a key with a collection PUT. The body wraps one or more records in a `resources` array. Agentgateway generates the `id` and copies it into `value.metadata.id`, so do not send an `id` yourself. The request is an upsert rather than a replace, so keys that already exist are kept.

   ```sh
   curl -X PUT http://127.0.0.1:15000/api/config/resources/llm.apiKey \
     -H 'Content-Type: application/json' \
     -d '{"resources":[{"value":{
           "key":"sk-agw-<hex>",
           "metadata":{"name":"my-service","user":"alice","group":"engineering"}
         }}]}'
   ```

3. Update a key with a single-resource PUT to `/api/config/resources/llm.apiKey/{id}`. Send the record's existing `key` value with every update, so that the user keeps their key when other fields change. The following example changes the group.

   ```sh
   curl -X PUT http://127.0.0.1:15000/api/config/resources/llm.apiKey/<id> \
     -H 'Content-Type: application/json' \
     -d '{"value":{"key":"<existing key>","metadata":{"name":"my-service","user":"alice","group":"engineering"}}}'
   ```

4. Delete a key. A successful delete returns `200`. Deleting the same `id` again returns `404`.

   ```sh
   curl -X DELETE http://127.0.0.1:15000/api/config/resources/llm.apiKey/<id>
   ```

## Update rules for API keys

The update endpoint replaces the record rather than patching it, which leads to the following behavior.

| Behavior | Result |
| -- | -- |
| `key` or `keyHash` is required | Returns `422` in `hybrid` mode, and `500` in `file` mode, with the message `data did not match any variant of untagged enum LocalAPIKey` |
| The record keeps its own format | Sending `keyHash` to a record that uses `key` replaces the value, and the original key no longer authenticates |
| `value.metadata.id` must be omitted | Returns `400` with the message `llm.apiKey resources must not include value.metadata.id`. Strip this field from a list response before you send it back |
| `metadata` is replaced, not merged | Send every field that you want to keep. A field that you leave out is dropped |
| An unknown `id` | Returns `404`. This endpoint updates only, and it does not create |
| A successful update | `revision` increments and `createdAt` is preserved, in `hybrid` mode |

## Propagation timing

Agentgateway applies a write asynchronously, so a change is not guaranteed to be visible on the traffic path the moment the API responds. In practice a new key is accepted on the next request, and a deleted key is rejected on the next request. A request that is already in flight when you delete a key can still complete.

Build a client that does not depend on the timing. If a script creates a key and uses it immediately, retry on `401`, which is the status that agentgateway returns for a key that it does not recognize.
