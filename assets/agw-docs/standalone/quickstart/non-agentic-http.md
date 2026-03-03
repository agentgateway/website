Use the agentgateway binary to route HTTP traffic to a simple backend (httpbin) running locally.

```mermaid
flowchart LR
    A[client] -->|localhost:3000| B[agentgateway]
    B --> C[httpbin]
```

1. The client sends requests to agentgateway on port 3000.
2. Agentgateway forwards the requests to the httpbin backend based on the route and backend configuration.
3. Httpbin responds, and agentgateway returns the response back to the client.

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).

   ```sh,paths="httpbin"
   curl -sL https://agentgateway.dev/install | bash
   ```

2. Install [Docker](https://docs.docker.com/get-docker/) to run httpbin.

## Steps

{{% steps %}}

### Step 1: Start httpbin in Docker

Run the httpbin image so it listens on port 80 inside the container. Map it to a host port such as 8000 so that agentgateway can reach it.

{{< tabs items="Linux, macOS (Apple Silicon)" >}}
{{% tab %}}

```sh,paths="httpbin,httpbin-linux"
docker run --rm -d -p 8000:80 --name httpbin kennethreitz/httpbin
```
{{% /tab %}}
{{% tab %}}

```sh,paths="httpbin-macos"
docker run --rm -d -p 8000:80 --name httpbin kennethreitz/httpbin --platform linux/amd64
```
{{% /tab %}}
{{< /tabs >}}

Verify that httpbin responds.

```sh,paths="httpbin"
curl -s http://localhost:8000/headers | head -20 || true
```

Example output:

```json
{
  "headers": {
    "Accept": "*/*", 
    "Host": "localhost:8000", 
    "User-Agent": "curl/8.7.1"
  }
}
```

### Step 2: Create the agentgateway configuration

Create a `config.yaml` that listens on port 3000 and routes traffic to the httpbin host. Use a static `host` backend with the address and port where httpbin is reachable, such as `127.0.0.1:8000`.

```yaml,paths="httpbin"
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes:
    - backends:
      - host: 127.0.0.1:8000
EOF
```

### Step 3: Start agentgateway

In a separate terminal, run agentgateway with the config file.

```sh
agentgateway -f config.yaml
```

{{< doc-test paths="httpbin" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

Example output:

```
info  state_manager  loaded config from File("config.yaml")
info  app            serving UI at http://localhost:15000/ui
info  proxy::gateway started bind  bind="bind/3000"
```

### Step 4: Send a request through agentgateway

Send a request to agentgateway on port 3000. Agentgateway forwards it to httpbin; the response is returned to you.

```sh,paths="httpbin"
curl -i http://localhost:3000/headers
```

{{< doc-test paths="httpbin" >}}
YAMLTest -f - <<'EOF'
- name: request through agentgateway to httpbin returns 200
  http:
    url: "http://localhost:3000"
    path: /headers
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

Example response (status and headers):

```txt
HTTP/1.1 200 OK
content-type: application/json
...
```

Example JSON body:

```json
{
  "headers": {
    "Accept": "*/*", 
    "Host": "localhost:3000", 
    "User-Agent": "curl/8.7.1"
  }
}
```

You can try other httpbin endpoints through agentgateway, such as the following.

```sh,paths="httpbin"
curl -s http://localhost:3000/get
curl -s http://localhost:3000/post -X POST -H "Content-Type: application/json" -d '{"key":"value"}'
```

### Step 5 (Optional): Stop httpbin

When you are done, stop and remove the httpbin container.

```sh,paths="httpbin"
docker stop httpbin
```

{{% /steps %}}

## Next steps

{{< cards >}}
  {{< card link="../../configuration/traffic-management" title="Traffic management" subtitle="Control and route traffic through agentgateway." >}}
  {{< card link="../../configuration/resiliency" title="Resiliency" subtitle="Simulate failures, disruptions, and adverse conditions to ensure gateway and app resilience." >}}
  {{< card link="../../configuration/security" title="Security" subtitle="Secure backends and routes with authentication, authorization, and rate limiting policies." >}}
{{< /cards >}}
