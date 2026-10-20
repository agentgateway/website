Manage models, MCP targets, gateways, routes, policies, and virtual keys with `agctl standalone`. The CLI uses the same config resource API as the UI, so you can script changes without restarting agentgateway.

## Before you begin

1. [Install agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) from the same version as your gateway. These commands require the main development builds.
2. Start a standalone gateway, such as the [LLM quickstart]({{< link-hextra path="/documentation/quickstart/llm/" >}}).
3. Check the [storage mode](#storage-behavior). The examples below use a writable configuration file or database-managed resources in hybrid mode.

## Connect to a gateway {#connect}

By default, `agctl standalone` connects to `http://localhost:15000`. Use `--address` to select another API address. For example, the generated Docker configuration serves the UI and its API on the published gateway port `4000`.

```sh
agctl standalone --address http://localhost:4000 get all
```

Use the server's base URL, without `/ui` or `/api`. The API is available on the admin address and on gateways that serve the UI. For Helm installations, [port-forward the admin address]({{< link-hextra path="/documentation/setup/storage/#helm" >}}) before running the CLI.

To reuse an address across commands, set `AGCTL_STANDALONE_ADDRESS`.

```sh
export AGCTL_STANDALONE_ADDRESS=http://localhost:15000
agctl standalone get all
```

### Save connection profiles

Use named profiles when you manage several standalone gateways. The CLI reads `$AGCTL_CONFIG`, or `agctl/config.yaml` in your operating system's user configuration directory. On Linux this is typically `~/.config/agctl/config.yaml`; on macOS it is `~/Library/Application Support/agctl/config.yaml`.

1. Create a CLI configuration file. This is separate from the configuration file that agentgateway reads.

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

2. Select a profile with `--gateway`. This name identifies a CLI connection profile, not a traffic gateway resource or a Kubernetes Gateway.

   ```sh
   agctl standalone --gateway local get all
   ```

Address selection follows this order: `--gateway`, `--address`, `AGCTL_STANDALONE_ADDRESS`, the current profile, then `http://localhost:15000`. You cannot combine `--gateway` and `--address`.

For an authenticated API, configure an `exec` credential plugin in the profile. The plugin uses the Kubernetes exec credential schema and supplies credentials for the HTTP request. The API's authentication policy must accept those credentials. A browser login session alone does not authenticate the CLI. See the [`standalone` reference]({{< link-hextra path="/reference/agctl/agctl-standalone/" >}}) for a profile example and [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}) for API authentication policies.

## Storage behavior {#storage-behavior}

The CLI follows the gateway's `config.storage.mode` setting.

| Mode | What `get` lists | Where `apply`, `delete`, and `keys create` write |
| --- | --- | --- |
| `file` | Supported resources from the local configuration file. | The configuration file, which must be writable. Agentgateway reloads the changes. |
| `hybrid` | Database-managed resources. The file baseline is not included. | The database overlay. File-owned resources remain in the baseline; conflicting writes can be rejected. |
| `readOnly` | Supported resources from the local configuration file. | Writes are rejected with `403`. |

The standalone Helm chart's default `readonly` mode mounts a ConfigMap that the proxy cannot write. Use the chart's `database` mode for CLI-managed resources. For setup and ownership rules, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

`get all` is a resource listing, not a full configuration backup. In file mode, it omits singleton settings and the model catalog. In hybrid mode, it omits the file baseline. Startup settings and legacy `binds` configuration are not independent CLI resources. Use `/api/config/effective` for the merged configuration, and [Inspect config]({{< link-hextra path="/documentation/operations/inspect-config/" >}}) for the runtime configuration that the proxy loaded.

## List resources

Use `get` to inspect the resources that the API manages. Add a resource name or ID to narrow the result, and `-o yaml` or `-o json` for structured output.

```sh
agctl standalone get all
agctl standalone get llm.model
agctl standalone get llm.model example-model -o yaml
```

The following resource kinds are supported. Singular and plural forms are accepted, such as `llm.model` and `llm.models`.

| Area | Resource kinds |
| --- | --- |
| Model catalog | `modelCatalog` |
| LLM | `llm.provider`, `llm.model`, `llm.virtualModel`, `llm.policy`, `llm.apiKey`, `llm.settings` |
| MCP | `mcp.target`, `mcp.policy`, `mcp.settings` |
| Traffic | `traffic.gateway`, `traffic.route`, `traffic.tcpRoute` |
| UI | `ui.policy` |
| Frontend | `frontend.policy` |

These kinds map to top-level configuration sections. For example, `mcp.target` manages `mcp.targets`; an MCP target nested in `routes[].backends` belongs to its `traffic.route` resource. Likewise, inline model or route policies belong to their containing resource.

## Apply resources {#apply}

Apply YAML or JSON resource documents to add or update configuration. Each document contains a `kind` and `value`, with an `id` for resources that require an existing identity. This format differs from a complete agentgateway configuration file.

1. Create a model resource. This example uses Ollama on the gateway host; [install Ollama and pull the model]({{< link-hextra path="/integrations/llm/providers/ollama/" >}}) before sending inference requests.

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
   | --- | --- |
   | `kind` | The configuration resource type. |
   | `value.name` | The model name that clients request through agentgateway. |
   | `value.provider` | The provider type or configured provider reference. |
   | `value.params.model` | The upstream model name. |

2. Apply the resource to the running gateway.

   ```sh
   agctl standalone apply -f model.yaml
   ```

   Example output in file mode:

   ```text
   llm.model/example-model applied
   ```

3. Verify the saved resource.

   ```sh
   agctl standalone get llm.model example-model -o yaml
   ```

Use `---` between YAML documents to apply several resources, or `-f -` to read from stdin. The CLI orders resource kinds to create providers before models and API-key policies before keys. Each write is separate, so an error can leave earlier writes applied. Correct the failed resource and apply it again.

`apply` updates the supplied resources; it does not delete resources omitted from the file. Within a resource, send the complete `value` that you want to retain. Use `delete` to remove a resource.

## Update an existing resource {#update}

Export a resource, edit its value, and apply it again. Keep the ID for API keys and policies so that the CLI updates the existing resource.

1. Export the model without server-managed revision and timestamp fields.

   ```sh
   agctl standalone get llm.model example-model -o yaml --no-metadata > model.yaml
   ```

2. Edit `model.yaml`. For example, change `value.params.model` to another model that your Ollama instance serves. Keep `value.name` unchanged to update the same model.
3. Apply the edited resource and verify it.

   ```sh
   agctl standalone apply -f model.yaml
   agctl standalone get llm.model example-model -o yaml
   ```

The `--no-metadata` flag preserves IDs for API keys and policies. For a hashed key, also keep `value.keyHash`. Unchanged server-managed key metadata, such as `agentgateway.dev/id`, can be sent back during an update. Do not change those values. For a complete key workflow, see [Virtual key management]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}).

API writes and traffic-path updates are asynchronous. Check the resource after a write, and allow time for the running proxy to load it. A resource listing confirms storage, not successful inference or routing; also send a request through the gateway.

## Delete resources {#delete}

Remove resources by name or ID. If a name matches several resources, use the ID from `get`. Remove dependent resources first, such as a virtual model before its target models or a route before its gateway.

```sh
agctl standalone delete llm.model example-model
agctl standalone get llm.model
```

Example delete output:

```text
llm.model/example-model deleted
```

Deleting an already absent resource returns an error. In hybrid mode, edit the baseline file to remove file-owned resources.

## Next steps

- [Create and revoke virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}).
- [Update startup settings]({{< link-hextra path="/documentation/setup/update/" >}}), such as database connections or the admin address.
- Review the [`agctl standalone` reference]({{< link-hextra path="/reference/agctl/agctl-standalone/" >}}) for all commands and flags.
