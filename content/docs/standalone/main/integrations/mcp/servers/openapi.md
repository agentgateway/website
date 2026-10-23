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

From the directory where you plan to run agentgateway, download and review the OpenAPI schema for the Petstore server.

```sh
curl http://localhost:8080/api/v3/openapi.json > openapi.json
```

Then, connect agentgateway to the Petstore server. You can use the UI or a configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
1. From the directory with the `openapi.json` file, create a configuration with an empty `mcp` section, and start agentgateway. You add the OpenAPI server in the UI.
   ```sh
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   mcp:
     port: 3000
     targets: []
   EOF
   agentgateway -f config.yaml
   ```
2. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**), and click **Add server**.
3. Enter `openapi` for the **Server name**, and select the **OpenAPI** transport.
4. Replace the **URL** with `localhost:8080`, the address of the Petstore server.
5. For **Schema source**, select **File**. Then, enter `openapi.json` for the **Schema**. A relative path resolves from the directory where you run agentgateway.

   {{< reuse-image src="img/ui-mcp-servers-add-openapi-file.png" srcDark="img/ui-mcp-servers-add-openapi-file-dark.png" alt="Add MCP server drawer for the openapi target with the OpenAPI transport, the localhost:8080 URL, and the openapi.json schema file" >}}

6. Click **Save server**.

The UI writes the same `openapi` target as the **Config file** tab. The **Config file** tab also adds a CORS policy for the UI playground. In the UI, you add that policy with **Apply CORS** when you verify the setup in the next section.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
1. Download an OpenAPI configuration for your agentgateway.
   ```sh
   curl -L https://agentgateway.dev/examples/mcp-openapi/config.yaml -o config.yaml
   ```

2. Update the agentgateway configuration file as follows:

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

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```
{{% /tab %}}
{{< /tabs >}}

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

## Tool response content {#tool-response-content}

Agentgateway converts each OpenAPI response into an MCP tool result. The HTTP status code decides whether the client gets a tool result or an error. The `Content-Type` header and the body bytes decide the type of content in the result.

| Upstream response | MCP tool result |
| ----------------- | --------------- |
| JSON object or JSON `null` | Structured content in `structuredContent`. The `content` list also has a `text` block with the serialized JSON. |
| Other JSON value, such as an array or a string | Structured content that wraps the value in a `data` field, such as `{"data":["cat","dog"]}`. |
| Text that is not valid JSON | A `text` block with the body. |
| Binary body with an `image/*` type | An `image` block with the base64-encoded body and the response media type, such as `image/png`. |
| Binary body with an `audio/*` type | An `audio` block with the base64-encoded body and the response media type, such as `audio/wav`. |
| Any other binary body | A `resource` block with the base64-encoded body in `blob`, the response media type, and the URI `tool://<tool name>`. A response without a `Content-Type` header gets `application/octet-stream`. |
| Empty body | A result with an empty `content` list. |

Agentgateway treats a body as text in either of the following cases:

* The `Content-Type` is a text-like media type: any `text/*` type, any type with a `json`, `xml`, or `yaml` subtype or suffix, `application/javascript`, `application/x-www-form-urlencoded`, or `application/x-ndjson`. For example, an `image/svg+xml` response is text because of its `xml` suffix.
* The body is valid UTF-8 and contains no NUL bytes, whatever the `Content-Type`.

Agentgateway tries to parse every text body as JSON first, because some servers label JSON responses as `text/plain`.

### Error responses {#tool-response-errors}

The status code changes the result as follows:

* **`5xx` responses**: The client gets an HTTP `500` response with a JSON-RPC error instead of a tool result. The error code is `-32603` (internal error), and the message is `failed to send message`. The agentgateway log records the upstream status and body.
* **All other responses, including `4xx`**: The client gets a tool result with the same content types as a `2xx` response. The result sets `isError` to `false` and does not include the status code. For example, a `404` response with the plain text body `Pet not found` becomes a `text` block with `Pet not found`. To help a model recognize a failed call, return an error body that describes the failure.

### Example tool results {#tool-response-examples}

The following results come from an OpenAPI server that returns a different response type for each operation.

* A `200` response with `Content-Type: application/json` and a JSON object body:

  ```json
  {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\"available\":7,\"pending\":2,\"sold\":1}"}],"structuredContent":{"available":7,"pending":2,"sold":1},"isError":false}}
  ```

* A `200` response with `Content-Type: application/json` and a JSON array body:

  ```json
  {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"data\":[\"cat\",\"dog\"]}"}],"structuredContent":{"data":["cat","dog"]},"isError":false}}
  ```

* A `200` response with `Content-Type: text/plain` and the body `OK`:

  ```json
  {"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"OK"}],"isError":false}}
  ```

* A `200` response with `Content-Type: image/png`:

  ```json
  {"jsonrpc":"2.0","id":5,"result":{"content":[{"type":"image","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAA=","mimeType":"image/png"}],"isError":false}}
  ```

* A `200` response with `Content-Type: audio/wav`:

  ```json
  {"jsonrpc":"2.0","id":6,"result":{"content":[{"type":"audio","data":"UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=","mimeType":"audio/wav"}],"isError":false}}
  ```

* A `200` response with `Content-Type: application/pdf` from the `getReport` tool:

  ```json
  {"jsonrpc":"2.0","id":7,"result":{"content":[{"type":"resource","resource":{"uri":"tool://getReport","mimeType":"application/pdf","blob":"JVBERi0xLjQKJeLjz9MK"}}],"isError":false}}
  ```

* A `204` response with an empty body:

  ```json
  {"jsonrpc":"2.0","id":8,"result":{"content":[],"isError":false}}
  ```

* A `404` response with `Content-Type: text/plain` and the body `Pet not found`:

  ```json
  {"jsonrpc":"2.0","id":9,"result":{"content":[{"type":"text","text":"Pet not found"}],"isError":false}}
  ```

* A `500` response:

  ```json
  {"jsonrpc":"2.0","id":10,"error":{"code":-32603,"message":"failed to send message"}}
  ```

## Path parameters {#path-parameters}

OpenAPI path parameters are always required. In the MCP tool schema, each OpenAPI path parameter is required, even when the OpenAPI document omits `required` or sets it to `false`.

When a tool call fills a path parameter, the value must be a string or number. String values are percent-encoded before the request is forwarded to the upstream OpenAPI server.

Agentgateway rejects the tool call before it sends any request to the upstream server in the following cases:

- A required path parameter value is missing.
- A path parameter value is empty.
- A path parameter value is neither a string nor a number.
- A string value contains an empty, `.`, or `..` path segment when split on `/` or `\`.

The client receives an HTTP `500` response with a JSON-RPC error instead of a tool result. The error code is `-32603` (internal error), and the message is `failed to send message`.

```json
{"jsonrpc":"2.0","id":2,"error":{"code":-32603,"message":"failed to send message"}}
```

The agentgateway log names the parameter and the reason, such as in the following example for a missing parameter.

```
error="mcp: failed to send message: invalid request: path parameter 'petId' is missing"
```

## Other configurations

### Schema URL

Fetch the OpenAPI schema from a remote URL. Agentgateway retrieves the schema at startup.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**). For the `openapi` server that you added in [Configure the agentgateway](#agentgateway), click the **Edit server** icon.
2. For **Schema source**, select **URL**.
3. Replace the **Schema** value with the schema URL, such as `http://localhost:8080/api/v3/openapi.json`.

   {{< reuse-image src="img/ui-mcp-servers-edit-openapi-url.png" srcDark="img/ui-mcp-servers-edit-openapi-url-dark.png" alt="Edit MCP server drawer for the openapi target with the schema URL http://localhost:8080/api/v3/openapi.json" >}}

4. Click **Save server**.
{{% /tab %}}
{{% tab name="Config file" %}}
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
{{% /tab %}}
{{< /tabs >}}

### Inline schema

Embed the OpenAPI schema directly as an inline string.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**). For the `openapi` server that you added in [Configure the agentgateway](#agentgateway), click the **Edit server** icon.
2. For **Schema source**, select **Inline**.
3. In the **Schema** editor, replace any existing value with your OpenAPI document, such as the JSON in the **Config file** tab. The editor keeps the previous schema path or URL until you replace it.

   {{< reuse-image src="img/ui-mcp-servers-edit-openapi-inline.png" srcDark="img/ui-mcp-servers-edit-openapi-inline-dark.png" alt="Edit MCP server drawer for the openapi target with an inline Petstore OpenAPI schema" >}}

4. Click **Save server**.

The UI saves the document as a multi-line string in the `schema` field, as in the **Config file** tab.
{{% /tab %}}
{{% tab name="Config file" %}}
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
        {
          "openapi": "3.0.0",
          "info": { "title": "Petstore", "version": "1.0.0" },
          "servers": [{ "url": "/" }],
          "paths": {
            "/pet/{petId}": {
              "get": {
                "operationId": "getPetById",
                "summary": "Find pet by ID",
                "parameters": [
                  {
                    "name": "petId",
                    "in": "path",
                    "required": true,
                    "schema": { "type": "integer", "format": "int64" }
                  }
                ],
                "responses": { "200": { "description": "successful operation" } }
              }
            }
          }
        }
      host: localhost:8080
```
{{% /tab %}}
{{< /tabs >}}

### Override the schema server path {#override-schema-server-path}

By default, operation paths use the path from the OpenAPI schema's server URL. To replace that prefix without editing the schema, set a non-root path in the target's `host` URI. If the target uses `host`/`port`/`path` or `backend`, set `path` instead.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  targets:
  - name: openapi
    openapi:
      host: https://example.com/api
      schema:
        url: https://example.com/openapi.json
```

With this configuration, an operation at `/users` is forwarded to `https://example.com/api/users`. Config validation rejects paths that do not start with a single `/`. Validation also rejects paths that contain a query string, fragment, or backslash.

If the path is omitted, empty, or `/`, the target keeps using the schema's server path. To route to root when the schema has a server path, update the schema's server URL to `/`.

### Stateless sessions

OpenAPI backends are inherently stateless because they translate standard REST endpoints into MCP tools. You can set `statefulMode: stateless` on the MCP backend to skip session tracking. In stateless mode, the gateway automatically wraps each request with an initialization sequence so the upstream processes every request independently.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open [http://localhost:15000/ui/mcp/servers](http://localhost:15000/ui/mcp/servers) (**MCP** > **Servers**), and click **Settings**.
2. For **State mode**, select **Stateless**.

   {{< reuse-image src="img/ui-mcp-settings-stateless.png" srcDark="img/ui-mcp-settings-stateless-dark.png" alt="MCP servers settings drawer with the state mode set to Stateless" >}}

3. Click **Save settings**.

The UI sets `statefulMode` to `stateless`, as in the **Config file** tab. It also sets `failureMode` to `failClosed` and writes an empty `gateways` list.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
mcp:
  port: 3000
  statefulMode: stateless
  targets:
  - name: openapi
    openapi:
      schema:
        url: http://localhost:8080/api/v3/openapi.json
      host: localhost:8080
```
{{% /tab %}}
{{< /tabs >}}
