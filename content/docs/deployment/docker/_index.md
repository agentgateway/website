---
title: Deploy with Docker
weight: 20
description: Overview of how to deploy agentgateway with Docker.
---

To run agentgateway as a Docker container, agentgateway publishes official Docker images on at cr.agentgateway.dev/agentgateway.

First, create a [configuration file](/docs/configuration/) for agentgateway. In this example, `config.yaml` is used.
You can also start with a [simple example configuration file](https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml).


## Docker

To run with Docker, you will want to mount your configuration file into the container and expose any necessary ports.

```sh
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  cr.agentgateway.dev/agentgateway:{{< reuse "docs/versions/n-patch.md" >}} \
  -f /config.yaml
```

The admin UI by default listens on localhost, which is not exposed outside of the container.
To access the UI, you can either change the bind address and expose the port:

```sh
docker run -v ./config.yaml:/config.yaml -p 3000:3000 \
  -p 127.0.0.1:15000:15000 -e ADMIN_ADDR=0.0.0.0:15000 \
  cr.agentgateway.dev/agentgateway:{{< reuse "docs/versions/n-patch.md" >}} \
  -f /config.yaml
```

## Docker Compose

A similar setup can be done with Docker Compose.

```yaml
services:
  agentgateway:
    container_name: agentgateway
    restart: unless-stopped
    image: cr.agentgateway.dev/agentgateway::{{< reuse "docs/versions/n-patch.md" >}}
    ports:
      - "3000:3000"
      - "127.0.0.1:15000:15000"
    volumes:
      - ./config.yaml:/config.yaml
    environment:
      - ADMIN_ADDR=0.0.0.0:15000
    command: ["-f", "/config.yaml"]
```
