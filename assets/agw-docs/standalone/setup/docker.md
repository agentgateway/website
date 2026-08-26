To run agentgateway as a container, follow the steps to start the container, verify that it runs, and open the admin UI. Agentgateway publishes the official images at `{{< reuse "agw-docs/standalone/image-ref.md" >}}`.

## Run the container {#docker}

{{% steps %}}

### Start the container

You can either mount a directory and let agentgateway create a configuration file in it, or mount a configuration file that you wrote yourself.

{{< tabs >}}
{{% tab name="Mount a directory" %}}

Mount a writable directory at the `/config` path. Agentgateway generates a default configuration in the `config.yaml` file in that directory on the first start, and creates a SQLite database alongside it for local runtime features.

```sh
mkdir agentgateway-config
docker run -d \
  --name agentgateway \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/agentgateway-config:/config" \
  -p 4000:4000 \
  {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}}
```

The `--user` flag runs the container as your own user so that the container can read and write the mounted directory. The generated configuration points agentgateway at a SQLite database, defines a `default` gateway, serves the admin UI on that default gateway, and looks similar to the following example.

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

Mount your own configuration file and pass it with `-f`. For a runnable starting point, try [this example configuration file](https://agentgateway.dev/examples/mcp-basic/config.yaml).

```sh
docker run -d \
  --name agentgateway \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/config.yaml:/config.yaml" \
  -p 4000:4000 \
  {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}} \
  -f /config.yaml
```

Agentgateway does not add anything to a file that you supply, so the UI is served on the admin address unless your file includes a `ui` section that attaches it to a gateway.

Keep the mount writable if you want to save configuration changes that you make in the UI. For more information, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

> [!IMPORTANT]
> The admin address defaults to `localhost:15000`, which is the container's own loopback interface, so publishing port 15000 does not make the admin UI reachable from your host. Reach the UI on a gateway port instead, as the generated configuration does. To publish the admin address itself, see [Reach the admin UI in a container]({{< link-hextra path="/setup/ui/gateway-ui/#docker-admin-addr" >}}).

{{% /tab %}}
{{< /tabs >}}

### Verify that the container runs

Check the status of the container.

```sh
docker ps --filter name=agentgateway
```

Example output:

```
CONTAINER ID   IMAGE                                         COMMAND               CREATED         STATUS         PORTS                                         NAMES
8bac1aad45ba   {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}}   "/app/agentgateway"   5 seconds ago   Up 4 seconds   0.0.0.0:4000->4000/tcp, [::]:4000->4000/tcp   agentgateway
```

### Find the admin UI address

Check the logs. Agentgateway logs which configuration file it loaded and where it serves the admin UI.

```sh
docker logs agentgateway
```

Example output:

```
info	state_manager	loaded config from File("/config/config.yaml")
info	state_manager	Watching config file: /config/config.yaml
info	app	serving UI at http://localhost:4000/ui
info	proxy::gateway	started bind	bind="bind/4000"
```

### Open the admin UI

Open the address from the log output, such as <http://localhost:4000/ui>, to get started.

{{% /steps %}}

## Run with Docker Compose {#compose}

Docker Compose follows the same approach as the `docker run` command.

{{% steps %}}

### Create the Compose file

Create a `compose.yaml` file. The `user` value must be your own user and group IDs so that the container can write to the mounted directory.

```yaml
services:
  agentgateway:
    container_name: agentgateway
    restart: unless-stopped
    image: {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}}
    # Replace with your user and group IDs, such as the output of: id -u && id -g
    user: "1000:1000"
    ports:
      - "4000:4000"
    volumes:
      - ./agentgateway-config:/config
```

### Start the service

Create the configuration directory and start the service. Agentgateway generates a configuration file in the directory on the first start.

```sh
mkdir agentgateway-config
docker compose up -d
```

### Verify that the service runs

Check the status of the service.

```sh
docker compose ps
```

Example output:

```
NAME           IMAGE                                         COMMAND               SERVICE        CREATED         STATUS         PORTS
agentgateway   {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}}   "/app/agentgateway"   agentgateway   9 seconds ago   Up 8 seconds   0.0.0.0:4000->4000/tcp, [::]:4000->4000/tcp
```

### Open the admin UI

Open <http://localhost:4000/ui> to get started.

{{% /steps %}}

## Cleanup

{{< tabs >}}
{{% tab name="Docker" %}}
Stop and remove the container.

```sh
docker rm -f agentgateway
```
{{% /tab %}}
{{% tab name="Docker Compose" %}}
Stop and remove the service.

```sh
docker compose down
```
{{% /tab %}}
{{< /tabs >}}

Agentgateway leaves the configuration file and the SQLite database in the mounted directory. If you do not want to keep them, remove the directory too.

## Next steps

* [Set up the admin UI]({{< link-hextra path="/setup/ui/" >}}) to open, expose, and secure the web interface.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}).
* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) after the container is running.
* [Upgrade agentgateway]({{< link-hextra path="/operations/upgrade/" >}}) to a new image tag.
