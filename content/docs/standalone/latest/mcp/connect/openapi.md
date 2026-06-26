---
title: OpenAPI
weight: 30
description: Expose OpenAPI endpoints as MCP tools in the agentgateway UI playground
---

Expose an {{< gloss "OpenAPI" >}}OpenAPI{{< /gloss >}} server on the agentgateway. Then, your OpenAPI endpoints become available as tools in the agentgateway UI playground.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. {{< reuse "agw-docs/snippets/prereq-uv.md" >}}
3. {{< reuse "agw-docs/snippets/prereq-docker.md" >}}
4. For ARM64 machines: [Install `maven`](https://maven.apache.org/install.html) to build the sample Petstore image from source.

## Set up your OpenAPI server {#openapi-server}

Start by setting up your OpenAPI server. You need an OpenAPI spec, such as a JSON or YAML file, as well as a running server instance that hosts the API. These steps use the [Swagger Petstore server](#petstore) as an example.

In your OpenAPI schema, make sure to set the URL of the server. If no URL is set, agentgateway defaults to `/`. Then, the paths in your OpenAPI schema get an extra slash concatenated, which can break requests. For example, `/api/v1/` becomes `//api/v1/`.

To avoid this issue, explicitly set the URL value to `/` in the OpenAPI schema, such as the following example.

```json
 "servers": [
    {
      "url": "/"
    }
  ]
```

### Sample Petstore server {#petstore}

Run the sample [Swagger Petstore server](https://github.com/swagger-api/swagger-petstore) locally. The following steps show use Docker and Maven as an example to pull, build, and run the Petstore server. You can also use your own OpenAPI server and update the steps accordingly.

{{< tabs >}}
{{% tab name="AMD64 machines" %}}

You can pull and run the sample Petstore server from Docker Hub.

1. Pull the Docker image for the Petstore server.

   ```sh
   docker pull swaggerapi/petstore3:unstable
   ```

2. Run the Petstore server on port 8080.

   ```sh
   docker run  --name swaggerapi-petstore3 -d -p 8080:8080 swaggerapi/petstore3:unstable
   ```

{{% /tab %}}
{{% tab name="ARM64 or other machines" %}}

Build the Docker image from the source code. The example builds the image for an ARM64 machine.

1. Clone the [Swagger Petstore repository](https://github.com/swagger-api/swagger-petstore).

   ```sh
   git clone https://github.com/swagger-api/swagger-petstore.git
   cd swagger-petstore
   ```

2. Package the project with Maven.

   ```sh
   mvn package
   ```

3. Build the Docker image for your platform.

   ```sh
   docker buildx build --platform=linux/arm64 -t swaggerapi/petstore3:arm64 .
   ```

4. Run the Petstore server on port 8080.

   ```sh
   docker run -d -p 8080:8080 swaggerapi/petstore3:arm64
   ```

{{% /tab %}}
{{< /tabs >}}

## Configure the agentgateway {#agentgateway}

1. From the directory where you plan to run agentgateway, download and review the OpenAPI schema for the Petstore server.

   ```sh
   curl http://localhost:8080/api/v3/openapi.json > openapi.json
   ```

2. Download an OpenAPI configuration for your agentgateway.
   ```sh
   curl -L https://agentgateway.dev/examples/openapi/config.yaml -o config.yaml
   ```

3. Update the agentgateway configuration file as follows:

   * **Listener**: An HTTP listener is configured and exposed on port 3000.
   * **Backend**: Use an MCP backend to set up an OpenAPI server based on the Petstore sample app.
   * **OpenAPI schema**: In the `openapi` target of the configuration file, set the schema source. You can provide the schema as a local file path, an inline string, or a remote URL. This example uses a local file path. 
   * **CORS policy**: To use the agentgateway UI playground later, add the following CORS policy to your `config.yaml` file. The config automatically reloads when you save the file.

   ```
   open config.yaml
   ```

   Reference a local OpenAPI schema file.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   mcp:
     port: 3000
     policies:
       cors:
         allowOrigins:
           - "*"
         allowHeaders:
           - "*"
     targets:
     - name: openapi
       openapi:
         schema:
           file: openapi.json
         host: localhost:8080
   ```

4. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

## Verify access to the Petstore APIs

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and backend configuration.

2. From the navigation menu under **MCP**, click **Tool Playground**.

3. If you see a banner prompting you to allow browser access, click **Apply CORS**. This adds the UI's origin to the MCP CORS policy so the playground can open a session, and the configuration reloads automatically.

4. Click **Initialize**. The agentgateway UI opens an MCP session and lists the Petstore operations from the OpenAPI spec as tools.

5. Verify that the **Result** panel reports the discovered tools, such as `getPetById`, `findPetsByStatus`, and `addPet`. Agentgateway generates one tool per operation in the spec, named after the operation's `operationId`.

   {{< reuse-image-light src="img/agentgateway-ui-tools-openapi.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-tools-openapi-dark.png" >}}

6. Verify access to a Petstore API.
   1. From the **Tool** dropdown, select the `getInventory` tool, which returns the store's pet inventory by status and takes no parameters.
   2. Click **Call tool**.
   3. Verify that the **Result** panel returns `HTTP 200` and the inventory counts in the **Tool output**.

      {{< reuse-image-light src="img/agentgateway-ui-tools-openapi-success.png" >}}
      {{< reuse-image-dark srcDark="img/agentgateway-ui-tools-openapi-success-dark.png" >}}


## Tool names {#tool-names}

Agentgateway generates one MCP tool for each operation in your OpenAPI spec. Each tool is named after the operation's `operationId` field. For example, an operation with `operationId: addPet` becomes an MCP tool named `addPet`. Make sure each operation in your spec defines a unique `operationId` so that the generated tool names are predictable and do not collide.

## Other configurations

### Schema URL

Fetch the OpenAPI schema from a remote URL. Agentgateway retrieves the schema at startup.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins:
        - "*"
      allowHeaders:
        - "*"
  targets:
  - name: openapi
    openapi:
      schema:
        url: http://localhost:8080/api/v3/openapi.json
      host: localhost:8080
```

### Inline schema

Embed the OpenAPI schema directly as an inline string.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins:
        - "*"
      allowHeaders:
        - "*"
  targets:
  - name: openapi
    openapi:
      schema: |
        {"openapi":"3.0.0",...}
      host: localhost:8080
```

### Stateless sessions

OpenAPI backends are inherently stateless because they translate standard REST endpoints into MCP tools. You can set `statefulMode: Stateless` on the MCP backend to skip session tracking. In stateless mode, the gateway automatically wraps each request with an initialization sequence so the upstream processes every request independently.

```yaml
backends:
- mcp:
    statefulMode: Stateless
    targets:
    - name: openapi
      openapi:
        schema:
          url: http://localhost:8080/api/v3/openapi.json
        host: localhost:8080
```