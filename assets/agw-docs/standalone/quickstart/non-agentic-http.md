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

{{< doc-test paths="httpbin" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).

   ```sh
   curl -sL https://agentgateway.dev/install | bash
   ```

2. Install [Docker](https://docs.docker.com/get-started/get-docker/) to run httpbin.

## Steps

{{% steps %}}

### Step 1: Start httpbin in Docker

Run the httpbin image so it listens on port 80 inside the container. Map it to a host port such as 8000 so that agentgateway can reach it.

{{< tabs >}}
{{% tab name="Linux" %}}

```sh {paths="httpbin,httpbin-linux"}
docker run --rm -d -p 8000:80 --name httpbin kennethreitz/httpbin
```
{{% /tab %}}
{{% tab name="macOS (Apple Silicon)" %}}

```sh {paths="httpbin-macos"}
docker run --rm -d -p 8000:80 --name httpbin kennethreitz/httpbin --platform linux/amd64
```
{{% /tab %}}
{{< /tabs >}}

Verify that httpbin responds.

```sh {paths="httpbin"}
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

### Step 2: Configure agentgateway to route to httpbin

{{< version include-if="1.2.x,1.1.x,1.0.x" >}}
Create a `config.yaml` that listens on port 3000 and routes traffic to the httpbin host. Use a static `host` backend with the address and port where httpbin is reachable, such as `127.0.0.1:8000`.

```yaml {paths="httpbin"}
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
{{< /version >}}
{{< version exclude-if="1.2.x,1.1.x,1.0.x" >}}
You add the listener and route from the UI, so you can start agentgateway without a config file. When you run `agentgateway` without specifying a config, it bootstraps a basic config at `~/.config/agentgateway/config.yaml` and uses it automatically.

1. In a separate terminal, start agentgateway.

   ```sh
   agentgateway
   ```

2. Open the [agentgateway UI](http://localhost:15000/ui/). On the **Gateway Overview**, find the **Traffic** row and click **Enable Traffic**.

3. Add a bind and listener.
   1. In the **Traffic** section of the navigation menu, click **Listeners**.
   2. Click **Add bind**, enter `3000` for the **Port**, and click **Save bind**.
   3. Click **Add listener**, keep the defaults (HTTP, hostname `*`), and save the listener.

4. Add a route to httpbin.
   1. Click **Routes**, and then click **Add route**.
   2. For the **Listener**, select the `:3000` listener you created.
   3. Under **Backends**, click **Add backend**, keep the **Host** target type, and enter `127.0.0.1:8000` for the host.
   4. Click **Save route**.

   {{< reuse-image-light src="img/ui-traffic-add-route.png" >}}
   {{< reuse-image-dark srcDark="img/ui-traffic-add-route-dark.png" >}}

{{< doc-test paths="httpbin" >}}
# Hidden test: the UI steps above (Enable Traffic -> Add bind/listener/route) are not
# scriptable, so this block reproduces the equivalent config they produce, to keep the
# resulting setup tested.
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
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}
{{< /version >}}

### Step 3: Send a request through agentgateway

Send a request to agentgateway on port 3000. Agentgateway forwards it to httpbin; the response is returned to you.

```sh {paths="httpbin"}
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

```sh {paths="httpbin"}
curl -s http://localhost:3000/get
curl -s http://localhost:3000/post -X POST -H "Content-Type: application/json" -d '{"key":"value"}'
```

### Step 4 (Optional): Stop httpbin

When you are done, stop and remove the httpbin container.

```sh {paths="httpbin"}
docker stop httpbin
```

{{% /steps %}}
