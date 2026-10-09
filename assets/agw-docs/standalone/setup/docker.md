To run agentgateway as a container, follow the steps to start the container, verify that it runs, and open the UI. Agentgateway publishes the official images at `{{< reuse "agw-docs/standalone/image-ref.md" >}}`.

## Run the container {#docker}

{{% steps %}}

### Start the container

You can either mount a directory and let agentgateway create a configuration file in it, or mount a configuration file that you wrote yourself.

{{< tabs >}}
{{% tab name="Mount a directory" %}}

Mount a writable directory at the `/config` path. Agentgateway generates a default configuration in the `config.yaml` file in that directory on the first start, and creates a SQLite database alongside it.

```sh
mkdir agentgateway-config
docker run -d \
  --name agentgateway \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/agentgateway-config:/config" \
  -p 4000:4000 \
  {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}}
```

The `--user` flag lets the container read and write the mounted directory as your user. The generated configuration includes a SQLite database and serves the UI on the `default` gateway. The database stores LLM analytics, logs, and other runtime data. For details, see [Database]({{< link-hextra path="/documentation/setup/database/" >}}).

The generated configuration looks like this:

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

{{% /tab %}}
{{% tab name="Mount a configuration file" %}}

Mount your configuration file and pass the file with `-f`. Include the database and UI settings, because supplied files receive no generated defaults.

1. Create a configuration file with the database and UI settings shown in this example.

   The `config.database.url` field sets the SQLite file path. The `ui.gateways` field serves the UI on the `default` gateway. For a fuller starting point, add these settings to the [example configuration file](https://agentgateway.dev/examples/mcp-basic/config.yaml).

   ```sh
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     database:
       url: sqlite:///data/data.db
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   EOF
   ```

2. Start the container with the configuration file and a writable `/data` directory for SQLite.

   Keep the configuration mount writable to save UI changes. For database details, see [Database]({{< link-hextra path="/documentation/setup/database/#own-file" >}}).

   ```sh
   mkdir -p data
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -v "$PWD/data:/data" \
     -p 4000:4000 \
     {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}} \
     -f /config.yaml
   ```

For details about saving UI changes, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

> [!IMPORTANT]
> The admin interface defaults to `localhost:15000`, which is the container's own loopback interface, so publishing port 15000 does not make it reachable from your host. Reach the UI on a gateway port instead, as the generated configuration does. That is the supported path, and it is the only one that you can authenticate. For more information, see [Reach the UI in a container]({{< link-hextra path="/documentation/operations/debug/#docker-admin-addr" >}}).

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

### Find the UI address

Check the logs. Agentgateway logs which configuration file it loaded and where it serves the UI.

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

### Open the UI

Open the address from the log output, such as <http://localhost:4000/ui>, to get started.

{{< reuse-image src="img/agentgateway-ui-landing.png" srcDark="img/agentgateway-ui-landing-dark.png" >}}

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

### Open the UI

Open <http://localhost:4000/ui> to get started.

{{< reuse-image src="img/agentgateway-ui-landing.png" srcDark="img/agentgateway-ui-landing-dark.png" >}}

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

* [Set up the UI]({{< link-hextra path="/documentation/setup/ui/" >}}) to open, expose, and secure the web interface.
* [Set up a database]({{< link-hextra path="/documentation/setup/database/" >}}) for the **Analytics** and **Logs** pages, and for API key budgets.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}).
* [Update your configuration]({{< link-hextra path="/documentation/setup/update/" >}}) after the container is running.
* [Upgrade agentgateway]({{< link-hextra path="/documentation/operations/upgrade/" >}}) to a new image tag.
