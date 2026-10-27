Manage agentgateway resources such as API keys at runtime through the config resource API, without restarting the proxy.{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}} Use `agctl standalone` to manage the resources from the command line, or call the API directly.{{< /version >}}

## About

Agentgateway serves a config resource API for reading and writing config resources at runtime, such as virtual API keys, models, routes, and policies. The UI calls this same API, so you can create, update, and revoke API keys from a script instead of the browser. For more information about where the UI and its API are served, see [Launch the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}).

The config resource API is served wherever the UI is served, and the admin address always keeps a copy of it.

What `config.storage.mode` changes is where a write is stored, and whether the API lists the resource afterward. {{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}In `file` mode, agentgateway writes the resource into your config file, and a list request returns an empty array. In `hybrid` mode, agentgateway stores the resource in the database and the API lists it.{{< /version >}}{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}In `file` mode, agentgateway writes the resource into your config file, and a list request returns the resources from that file. In `hybrid` mode, agentgateway stores the resource in the database, and a list request returns the resources from the database only, not from the baseline file.{{< /version >}} For each mode, what the database holds, and how the modes differ per installation method, see [Storage modes]({{< link-hextra path="/documentation/setup/storage/" >}}).

The rest of this guide uses `hybrid` mode, which supports the full set of operations.

> [!WARNING]
> The admin address (`127.0.0.1:15000` by default) has **no authentication**. Anyone who can reach it can list, create, update, or delete keys. Keep the admin address bound to localhost, which is the default, and never expose it externally.

> [!NOTE]
> Serving the UI on a gateway and applying an `oidc` policy, as described in [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}), protects the UI on that gateway's port only. The admin address continues to serve this API with no authentication. Network isolation remains the control for the admin address.

## Before you begin

1. Set `config.storage.mode` to `hybrid` and give agentgateway a database in `config.database.url`. A `sqlite://` URL creates the file for you, and a `postgres://` URL is also supported. For more information, see [Database]({{< link-hextra path="/documentation/setup/database/" >}}).
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

For more information about API key authentication and the `apiKey` policy fields, see [Virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys" >}}).

## Resource kinds

A resource kind is written with dots, such as `llm.apiKey`. A bare name such as `apiKey` returns `unsupported config resource kind: apiKey`.

Agentgateway supports the following resource kinds. No other kind is accepted.

| Config section | Resource kinds |
| -- | -- |
| Model catalog | `modelCatalog` |
| LLM | `llm.provider`, `llm.model`, `llm.virtualModel`, `llm.apiKey`, `llm.policy`{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}, `llm.settings`{{< /version >}} |
| MCP | `mcp.target`, `mcp.policy`, `mcp.settings` |
| Traffic | `traffic.gateway`, `traffic.route`, `traffic.tcpRoute` |
| UI | `ui.policy` |{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
| Frontend | `frontend.policy` |{{< /version >}}

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
Each kind maps to a top-level config section. For example, the `mcp.target` kind manages the entries in `mcp.targets`. An MCP target that you define inline in `routes[].backends` belongs to its `traffic.route` resource instead. Likewise, inline model and route policies belong to the resource that contains them.

The `llm.settings` and `mcp.settings` kinds each hold one resource, with the ID `default`, that sets the top-level fields of its section. Accepted kinds by type of setting are as follows:

* LLM kinds: `gateways`, `port`, and `tls`.
* MCP kinds: `gateways`, `port`, `statefulMode`, `prefixMode`, `failureMode`, `sseKeepAlive`, `dnsRebindingProtection`, and `server`.
* Any other field returns `400` with the message `contains unsupported field`.

In `hybrid` mode, a settings field that the config file sets is file-owned. A write that changes a file-owned field returns `409`, for example `file-owned mcp.settings/default field cannot be updated in hybrid mode: statefulMode`. A write that repeats the value from the file succeeds, and agentgateway drops that field from the stored resource.

## Manage resources with agctl {#agctl}

Use `agctl standalone` to list, apply, and delete resources from the command line. The CLI calls the same config resource API as the `curl` examples in [Manage API keys](#manage-api-keys). Before you begin, [install agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) at the same version as your gateway.

### Connect to a gateway {#connect}

By default, `agctl standalone` connects to `http://localhost:15000`, which is the default admin address. To connect to another API address, use the `--address` flag. For example, the generated Docker configuration serves the UI and its API on the published gateway port `4000`.

```sh
agctl standalone --address http://localhost:4000 get all
```

Use the base URL of the server, without `/ui` or `/api`. For Helm installations, [port-forward the admin address]({{< link-hextra path="/documentation/setup/storage/#helm" >}}) before you run the CLI.

> [!TIP]
> To reuse an address across commands, set `AGCTL_STANDALONE_ADDRESS`.
>
> ```sh
> export AGCTL_STANDALONE_ADDRESS=http://localhost:15000
> agctl standalone get all
> ```

#### Save connection profiles

Use named profiles to manage several standalone gateways. The CLI reads the file in `$AGCTL_CONFIG`. If the variable is not set, the CLI reads `agctl/config.yaml` in the user configuration directory of your operating system. On Linux, this file is typically `~/.config/agctl/config.yaml`. On macOS, the file is `~/Library/Application Support/agctl/config.yaml`.

1. Create a CLI configuration file. This file is separate from the configuration file that agentgateway reads.

   ```sh
   cat <<'EOF' > agctl.yaml
   current: local
   gateways:
     local:
       url: http://localhost:15000
     container:
       url: http://localhost:4000
   EOF
   export AGCTL_CONFIG="$PWD/agctl.yaml"
   ```

2. Select a profile with the `--gateway` flag. The flag refers to a CLI connection profile, not to a traffic gateway resource or a Kubernetes Gateway.

   ```sh
   agctl standalone --gateway local get all
   ```

The CLI selects the address in the following order: `--gateway`, `--address`, `AGCTL_STANDALONE_ADDRESS`, the current profile, and then `http://localhost:15000`. You cannot combine the `--gateway` and `--address` flags.

For an authenticated API, configure an `exec` credential plugin in the profile. The plugin uses the Kubernetes exec credential schema and supplies the credentials for each HTTP request. The authentication policy of the API must accept those credentials. A browser login session does not authenticate the CLI. For a profile example, see the [`agctl standalone` reference]({{< link-hextra path="/reference/agctl/agctl-standalone/" >}}). For API authentication policies, see [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}).

### Storage behavior {#storage-behavior}

The CLI follows the `config.storage.mode` setting of the gateway.

| Mode | What `get` lists | Where `apply`, `delete`, and `keys create` write |
| -- | -- | -- |
| `file` | The resources in the local configuration file. | The configuration file, which must be writable. Agentgateway reloads the changes. |
| `hybrid` | The resources in the database. The baseline file is not included. | The database. File-owned resources stay in the baseline file, and agentgateway can reject a write that conflicts with them. |
| `readOnly` | The resources in the local configuration file. | Nowhere. Agentgateway rejects writes with a `403` status. |

The standalone Helm chart uses the `readonly` mode by default, which mounts a ConfigMap that the proxy cannot write. To manage resources with the CLI, use the `database` mode of the chart. For setup and ownership rules, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

The `get all` command lists resources. It is not a full configuration backup. In file mode, the list omits singleton settings and the model catalog. In hybrid mode, the list omits the baseline file. Startup settings and legacy `binds` configuration are not CLI resources. For the merged configuration, use the `/api/config/effective` endpoint. For the runtime configuration that the proxy loaded, see [Inspect config]({{< link-hextra path="/documentation/operations/inspect-config/" >}}).

### List resources

Use the `get` command to inspect the resources that the API manages. To narrow the result, add a resource kind, and then a resource name or ID. For structured output, add `-o yaml` or `-o json`. The CLI accepts both singular and plural kinds, such as `llm.model` and `llm.models`.

```sh
agctl standalone get all
agctl standalone get llm.apiKey
agctl standalone get llm.apiKey <name-or-id> -o yaml
```

### Apply resources {#apply}

Apply YAML or JSON resource documents to add or update configuration. Each document has a `kind` and a `value`. To update an existing API key or policy, also include its `id`. This format differs from a complete agentgateway configuration file.

1. Create a model resource. This example uses Ollama on the gateway host. Before you send requests to the model, [install Ollama and pull the model]({{< link-hextra path="/integrations/llm/providers/ollama/" >}}).

   ```sh
   cat <<'EOF' > model.yaml
   kind: llm.model
   value:
     name: example-model
     provider: ollama
     params:
       model: llama3.2
   EOF
   ```

   | Field | Description |
   | -- | -- |
   | `kind` | The resource kind. |
   | `value.name` | The model name that clients request through agentgateway. |
   | `value.provider` | The provider type, or a reference to a configured provider. |
   | `value.params.model` | The model name that agentgateway sends to the provider. |

2. Apply the resource to the running gateway.

   ```sh
   agctl standalone apply -f model.yaml
   ```

   Example output:

   ```text
   llm.model/example-model created
   ```

3. Verify the resource.

   ```sh
   agctl standalone get llm.model
   ```

   Example output:

   ```text
   NAME           PROVIDER  MODEL     ID
   example-model  ollama    llama3.2  example-model
   ```

To apply several resources at once, separate the YAML documents with `---`. To read the documents from stdin, use `-f -`. The CLI applies providers before models, and API key policies before keys. Each write is separate, so an error can leave the earlier writes applied. Fix the failed resource and apply the file again.

The `apply` command creates and updates the resources in the file. It does not delete the resources that the file omits. Within a resource, send the complete `value` that you want to keep. To remove a resource, use the `delete` command.

### Update a resource {#update}

Export a resource, edit its value, and apply it again.

1. Export the model without the server-managed revision and timestamp fields.

   ```sh
   agctl standalone get llm.model example-model -o yaml --no-metadata > model.yaml
   ```

2. Edit `model.yaml`. For example, change `value.params.model` to another model that your Ollama instance serves. Keep `value.name` unchanged so that the CLI updates the same model.
3. Apply the edited resource.

   ```sh
   agctl standalone apply -f model.yaml
   ```

   Example output:

   ```text
   llm.model/example-model updated
   ```

The `--no-metadata` flag keeps the IDs of API keys and policies. For a hashed API key, also keep `value.keyHash`. You can send unchanged server-managed key metadata, such as `agentgateway.dev/id`, back in an update, but do not change these values. For a complete key workflow, see [Set up virtual keys (agctl)]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/#agctl" >}}).

Writes reach the traffic path asynchronously, as described in [Propagation timing](#propagation-timing). A resource listing confirms that agentgateway stored the resource, not that routing or inference works. To confirm the change, send a request through the gateway.

### Delete resources {#delete}

Delete a resource by name or ID. If a name matches several resources, use the ID from the `get` command. Delete dependent resources first, such as a virtual model before its target models, or a route before its gateway.

```sh
agctl standalone delete llm.model example-model
```

Example output:

```text
llm.model/example-model deleted
```

Deleting a resource that does not exist returns an error. In hybrid mode, to remove a resource that the baseline file owns, edit the file.
{{< /version >}}

## Manage API keys

The following steps use the `llm.apiKey` kind. The same endpoints work for every kind in the previous table.

1. List the keys that the API manages.

   ```sh
   curl -s http://127.0.0.1:15000/api/config/resources/llm.apiKey
   ```

   {{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
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
   {{< /version >}}
   {{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
   Example response in `hybrid` mode. In `file` mode, the response contains only `kind`, `id`, and `value`. A key in the file that has no `agentgateway.dev/id` metadata field gets an `id` from its position in the list, such as `@index:0`.

   ```json
   {"resources": [{
     "kind": "llm.apiKey",
     "id": "30cb4228-dd1f-402e-acc4-eeab18fc81fc",
     "value": {
       "key": "sk-agw-8a0b7a6a…",
       "metadata": {
         "agentgateway.dev/createdAt": 1792525913,
         "agentgateway.dev/id": "30cb4228-dd1f-402e-acc4-eeab18fc81fc",
         "group": "engineering",
         "name": "my-service",
         "user": "alice"
       }
     },
     "revision": 1,
     "createdAt": "2026-10-20T19:51:53.830801Z",
     "updatedAt": "2026-10-20T19:51:53.830801Z"
   }]}
   ```
   {{< /version >}}

2. Create a key with a collection PUT. The body wraps one or more records in a `resources` array. Agentgateway generates the `id` and copies it into {{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}`value.metadata.id`{{< /version >}}{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}the `agentgateway.dev/id` metadata field{{< /version >}}, so do not send an `id` yourself. The request is an upsert rather than a replace, so keys that already exist are kept.

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
| The record keeps its own format | Sending `keyHash` to a record that uses `key` replaces the value, and the original key no longer authenticates |{{< version include-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
| `value.metadata.id` must be omitted | Returns `400` with the message `llm.apiKey resources must not include value.metadata.id`. Strip this field from a list response before you send it back |{{< /version >}}{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
| Server-managed metadata is kept | Agentgateway keeps the metadata fields that start with `agentgateway.dev/` when you omit them. Changing `agentgateway.dev/id` returns `400` with the message `llm.apiKey metadata field agentgateway.dev/id cannot be changed` |{{< /version >}}
| `metadata` is replaced, not merged | Send every field that you want to keep. A field that you leave out is dropped |
| An unknown `id` | Returns `404`. This endpoint updates only, and it does not create |
| A successful update | `revision` increments and `createdAt` is preserved, in `hybrid` mode |

## Propagation timing

Agentgateway applies a write asynchronously, so a change is not guaranteed to be visible on the traffic path the moment the API responds. In practice a new key is accepted on the next request, and a deleted key is rejected on the next request. A request that is already in flight when you delete a key can still complete.

Build a client that does not depend on the timing. If a script creates a key and uses it immediately, retry on `401`, which is the status that agentgateway returns for a key that it does not recognize.
