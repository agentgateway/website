---
title: Deploy with Docker
weight: 20
description: Overview of how to deploy agentgateway with Docker.
---

To run agentgateway as a Docker container, agentgateway publishes official Docker images at `cr.agentgateway.dev/agentgateway`.


## Docker

To run agentgateway with Docker, you may either mount your [configuration file]({{< link-hextra path="/configuration/" >}}) directly, or mount a directory
and create the configuration in the UI:

```sh
mkdir agentgateway-config
docker run \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/agentgateway-config:/config" \
  -p 3000:3000 -p 4000:4000 -p 127.0.0.1:15000:15000 \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}}
```

When run in this mode, a configuration file will automatically be created, setting up logging and exposing the admin UI.
The `user` is customized to run as the current user to ensure the container can read and write the configuration.

If you want to provide an explicit file, you can also do so. By default, the agentgateway admin UI listens on localhost, which is not exposed outside of the container;
the `ADMIN_ADDR` is set below to expose it and is optional.

```sh
docker run \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/config.yaml:/config.yaml" \
  -p 3000:3000 -p 4000:4000 -p 127.0.0.1:15000:15000 \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}} \
  -f /config.yaml
```

Open <http://localhost:15000/ui> to get started!

## Docker Compose

To run agentgateway in Docker Compose, follow the same approach as above. Create a directory for the configuration and start the service.

```sh
mkdir agentgateway-config
docker compose up
```

```yaml
services:
  agentgateway:
    container_name: agentgateway
    restart: unless-stopped
    image: cr.agentgateway.dev/agentgateway:v{{< reuse "agw-docs/versions/n-patch.md" >}}
    # Replace with your user and group IDs, such as the output of: id -u && id -g
    user: "1000:1000"
    ports:
      - "3000:3000"
      - "4000:4000"
      - "127.0.0.1:15000:15000"
    volumes:
      - ./agentgateway-config:/config
```

Open <http://localhost:15000/ui> to get started!
