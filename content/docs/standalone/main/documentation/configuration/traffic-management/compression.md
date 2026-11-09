---
title: Compression
weight: 18
description: Compress responses to clients and decompress encoded request bodies.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/" >}}

Use the `policies.compression` policy to reduce the size of responses that are sent to clients, and to decode compressed request bodies before other policies and the backend read them. You can configure response compression, request decompression, or both on the same route.

## About compression

The compression policy works in two directions.

* **Response compression** (`response.compress`): The proxy compresses an eligible response with an algorithm that the client accepts in its `Accept-Encoding` request header. If the client does not send `Accept-Encoding`, or accepts none of the configured algorithms, the response is sent uncompressed.
* **Request decompression** (`request.decompress`): The proxy decodes a request body that the client sent with a `Content-Encoding` header, such as `Content-Encoding: gzip`. Later policies and the backend receive the plain body.

You can choose from the following algorithms: `gzip`, `brotli`, `deflate`, and `zstd`. If you configure an empty `compress` or `decompress` block, the policy uses `gzip`.

### Response compression

The proxy compresses a response only when all of the following conditions are true:

* The response has a body. Responses with a `1xx`, `204`, or `304` status code are not compressed.
* The response does not already have a `Content-Encoding` header.
* The response is not a partial response with a `Content-Range` header.
* The response does not have a `Cache-Control: no-transform` header.
* The response has a known length of at least 32 bytes. Streamed responses without a known length, such as server-sent events, are sent as-is.
* The response has a text-based content type. The following types are compressed: `application/javascript`, `application/json`, `application/xml`, `application/xhtml+xml`, `image/svg+xml`, `text/css`, `text/html`, `text/javascript`, `text/plain`, and `text/xml`. Types with a `+json` or `+xml` suffix, such as `application/problem+json`, are also compressed. Images, video, audio, fonts, and archives are already compressed, so they are sent as-is.

To choose the algorithm, the proxy compares the configured `algorithms` list with the client's `Accept-Encoding` header. The algorithm with the highest quality value (`q`) wins. If the client accepts several algorithms equally, the first algorithm in your `algorithms` list wins. A `*` entry in `Accept-Encoding` applies to every configured algorithm that the client does not list by name. If the client gives `identity` a higher quality value than every configured algorithm, the response is sent uncompressed.

When the proxy compresses a response, it makes the following header changes:

* Sets `Content-Encoding` to the chosen algorithm, such as `gzip` or `br`.
* Removes the `Content-Length` and `Accept-Ranges` headers.
* Changes a strong `ETag` to a weak `ETag`, such as `W/"abc"`, because the bytes that are sent no longer match the original.

For every eligible response, the proxy also adds a `Vary: accept-encoding` header, even when the client receives the uncompressed response. This header tells caches that the response depends on the `Accept-Encoding` request header.

Response compression runs after every other response policy, so policies such as transformations see the uncompressed body. Access logs also record the uncompressed body. The proxy reads the client's `Accept-Encoding` header before request header modifiers run, so removing that header for the backend does not turn off compression for the client.

### Request decompression

The proxy decodes a request body only when the `Content-Encoding` header names a single algorithm that is in your `algorithms` list. Request bodies with any other encoding, or with more than one layer of encoding, such as `Content-Encoding: gzip, br`, are forwarded unchanged. After the proxy decodes the body, it removes the `Content-Encoding` and `Content-Length` headers from the request.

Decompression runs after authentication and authorization, so a denied request is never decoded. Authentication, authorization, and policies with `phase: gateway` see the encoded body. Route-level policies that read the body, such as rate limiting, external processing, and transformations, see the decoded body.

## Compression settings

| Field | Description | Default |
| -- | -- | -- |
| `policies.compression.response.compress.algorithms` | The algorithms that the proxy can choose from, based on the client's `Accept-Encoding` header. Possible values are `gzip`, `brotli`, `deflate`, and `zstd`. If the client accepts several algorithms equally, the first algorithm in the list wins. | `[gzip]` |
| `policies.compression.request.decompress.algorithms` | The algorithms that the proxy decodes from request bodies. Possible values are `gzip`, `brotli`, `deflate`, and `zstd`. Request bodies with any other encoding are forwarded unchanged. | `[gzip]` |

If you set `algorithms`, the list must contain at least one value. An empty list, such as `algorithms: []`, is rejected. To use the default, omit the `algorithms` field. For the full list of fields, see the [configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. {{< reuse "agw-docs/snippets/prereq-docker.md" >}}

## Compress responses and decompress requests

The following steps start a sample httpbin app as the backend, configure a route with a compression policy, and send requests to verify each direction.

1. Start the httpbin sample app in Docker. The app listens on port 8000 on your machine.

   ```sh
   docker run -d --name httpbin -p 8000:8080 mccutchen/go-httpbin
   ```

2. Create a configuration file with a compression policy. The policy compresses responses with `gzip`, `brotli`, or `zstd`, and decodes request bodies that are encoded with `gzip`.

   ```yaml
   cat > config.yaml <<EOF
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - host: localhost:8000
     policies:
       compression:
         response:
           compress:
             algorithms: [gzip, brotli, zstd]
         request:
           decompress:
             algorithms: [gzip]
   EOF
   ```

3. Run agentgateway with the configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

4. In another terminal, request a JSON response and advertise support for `br` and `gzip` in the `Accept-Encoding` header. The client accepts both algorithms equally, so the first matching algorithm in the policy wins. The policy lists `gzip` before `brotli`, so the response is compressed with `gzip`.

   ```sh
   curl -s -o /dev/null -D - http://localhost:3000/json \
     -H "Accept-Encoding: br, gzip"
   ```

   Example output:

   ```console {hl_lines=[5,6]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; charset=utf-8
   content-encoding: gzip
   vary: accept-encoding
   transfer-encoding: chunked
   ```

5. Send the request again and accept only `br`, which is the HTTP token for brotli. The response is compressed with brotli.

   ```sh
   curl -s -o /dev/null -D - http://localhost:3000/json \
     -H "Accept-Encoding: br"
   ```

   Example output:

   ```console {hl_lines=[5]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; charset=utf-8
   content-encoding: br
   vary: accept-encoding
   transfer-encoding: chunked
   ```

6. Send the request without an `Accept-Encoding` header. The response is not compressed, so it has a `Content-Length` header and no `content-encoding` header. The response still includes the `vary: accept-encoding` header.

   ```sh
   curl -s -o /dev/null -D - http://localhost:3000/json
   ```

   Example output:

   ```console {hl_lines=[5,6]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; charset=utf-8
   Content-Length: 421
   vary: accept-encoding
   ```

7. Send a request body that is compressed with `gzip` to the httpbin `/anything` endpoint, which echoes the request back. The proxy decodes the body, so httpbin receives the plain JSON body. The `headers` that httpbin received do not include `Content-Encoding`.

   ```sh
   echo '{"hello":"world"}' | gzip | curl -s http://localhost:3000/anything \
     -H "Content-Type: application/json" \
     -H "Content-Encoding: gzip" \
     --data-binary @-
   ```

   Example output:

   ```console {hl_lines=[3,5,6,7]}
   {
     ...
     "data": "{\"hello\":\"world\"}\n",
     ...
     "json": {
       "hello": "world"
     }
   }
   ```

## Cleanup

1. Stop agentgateway by pressing `Ctrl+C` in the terminal where it runs.

2. Remove the httpbin container and the configuration file.

   ```sh
   docker rm -f httpbin
   rm config.yaml
   ```
