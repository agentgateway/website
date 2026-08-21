To run agentgateway as a container, use the official images that agentgateway publishes at `cr.agentgateway.dev/agentgateway`.

## Run the container {#docker}

You can either mount a directory and let agentgateway create a configuration file in it, or mount a configuration file that you wrote yourself.

{{< tabs >}}
{{% tab name="Mount a directory" %}}
Mount a writable directory at `/config`. Agentgateway generates a `config.yaml` file in that directory on the first start, and creates a SQLite database alongside it for local runtime features.

```sh
mkdir agentgateway-config
docker run \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/agentgateway-config:/config" \
  -p 4000:4000 \
  cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}}
```

The `--user` flag runs the container as your own user so that the container can read and write the mounted directory. The generated configuration sets up logging, serves the admin UI on the gateway, and looks similar to the following example.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  database:
    url: sqlite:///config/data.db
gateways:
  default:
    port: 4000
ui:
  gateways: default
```

Because the generated configuration attaches the UI to the `default` gateway, the UI is served on the gateway port, not on the admin address.
{{% /tab %}}
{{% tab name="Mount a configuration file" %}}
Mount your own configuration file and pass it with `-f`.

```sh
docker run \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/config.yaml:/config.yaml" \
  -p 4000:4000 \
  cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}} \
  -f /config.yaml
```

Agentgateway does not add anything to a file that you supply, so the UI is served on the admin address unless your file includes a `ui` section that attaches it to a gateway. For a runnable starting point, try [this example configuration file](https://agentgateway.dev/examples/mcp-basic/config.yaml).

Keep the mount writable if you want to save configuration changes that you make in the UI. For more information, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).
{{% /tab %}}
{{< /tabs >}}

Open <http://localhost:4000/ui> to get started.

> [!IMPORTANT]
> The admin address defaults to `localhost:15000`, which is the container's own loopback interface, so publishing port 15000 does not make the admin UI reachable from your host. Reach the UI on a gateway port instead, as the generated configuration does. To publish the admin address itself, see [Reach the admin UI in a container]({{< link-hextra path="/setup/ui/#docker-admin-addr" >}}).

## Run with Docker Compose {#compose}

Docker Compose follows the same approach. Create a directory for the configuration and start the service.

```sh
mkdir agentgateway-config
docker compose up
```

```yaml
services:
  agentgateway:
    container_name: agentgateway
    restart: unless-stopped
    image: cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}}
    # Replace with your user and group IDs, such as the output of: id -u && id -g
    user: "1000:1000"
    ports:
      - "4000:4000"
    volumes:
      - ./agentgateway-config:/config
```

Open <http://localhost:4000/ui> to get started.

## Next steps

* [Set up the admin UI]({{< link-hextra path="/setup/ui/" >}}) to expose and secure the web interface.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}).
* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) after the container is running.
* [Upgrade agentgateway]({{< link-hextra path="/operations/upgrade/" >}}) to a new image tag.
