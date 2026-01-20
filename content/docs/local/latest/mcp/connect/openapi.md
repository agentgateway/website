---
title: OpenAPI
weight: 30
description: 
---

Expose an {{< gloss "OpenAPI" >}}OpenAPI{{< /gloss >}} server on the agentgateway. Then, your OpenAPI endpoints become available as tools in the agentgateway UI playground.

## Before you begin

1. {{< reuse "docs/snippets/prereq-agentgateway.md" >}}
2. {{< reuse "docs/snippets/prereq-uv.md" >}}
3. {{< reuse "docs/snippets/prereq-docker.md" >}}
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

{{< tabs items="AMD64 machines, ARM64 or other machines" >}}
{{% tab %}}

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
{{% tab %}}

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
   curl -L https://agentgateway.dev/examples/openapi/config.yaml -o config.yaml -o config.yaml
   ```

3. Update the agentgateway configuration file as follows:
   
   * **Listener**: An HTTP listener is configured and exposed on port 3000. 
   * **Backend**: Use an MCP backend to set up an OpenAPI server based on the Petstore sample app.   
   * **OpenAPI schema**: In the `openapi` target of the configuration file, update the `file` field to point to the OpenAPI schema that you downloaded earlier.
   * **CORS policy**: To use the agentgateway UI playground later, add the following CORS policy to your `config.yaml` file. The config automatically reloads when you save the file.

   ```
   open config.yaml
   ```

   ```yaml
   binds:
   - port: 3000
     listeners:
     - routes:
       - backends:
         - mcp:
             targets:
             - name: openapi
               openapi:
                 schema:
                   file: openapi.json
                 host: localhost:8080
         policies:
           cors:
             allowOrigins:
               - "*"
             allowHeaders:
               - "*"
   ```

1. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

## Verify access to the Petstore APIs

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and backend configuration.

2. Connect to the OpenAPI server with the agentgateway UI playground. 

   1. From the navigation menu, click [**Playground**](http://localhost:15000/ui/playground/).
      
      {{< reuse-image src="img/agentgateway-ui-playground.png" >}}

   2. In the **Testing** card, review your **Connection** details and click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the APIs that are exposed on the target.
   
   3. Verify that you see the Petstore APIs from the OpenAPI spec as a list of **Available Tools** 
   
      {{< reuse-image src="img/agentgateway-ui-tools-openapi.png" >}}

3. Verify access to the Petstore APIs. 
   1. Select the **addPet** API. 
   2. In the **body** field, enter the details for your pet, such as the ID and name for the pet category and your pet, a URL to a photo of your pet, the pet's status in the store, and optionally any tags. You can use the following example JSON file. 
      ```json
      {
        "id": 10,
        "category": {
          "id": 1,
          "name": "Dogs"
        },
        "name": "doggie",
        "photoUrls": [
          "https://example.com/photo1.jpg",
          "https://example.com/photo2.jpg"
        ],
        "tags": [
          {
            "id": 101,
            "name": "fluffy"
          },
          {
            "id": 102,
            "name": "friendly"
          }
        ],
        "status": "available"
      }
      ```
   3. Click **Run Tool**. Verify that the pet is added to the petstore. 
      
      {{< reuse-image src="img/agentgateway-ui-tools-openapi-success.png" >}}
