## About

A generated configuration attaches the UI to the same `default` gateway that serves your proxy traffic. Giving the UI a gateway of its own keeps UI traffic and proxy traffic on separate ports. Separate ports let you publish the proxy port while the UI port stays internal, and they let you apply different authentication policies to each.

A gateway of its own is also the prerequisite for the next two guides, because an authentication policy in `ui.policies` applies to the gateway that serves the UI, and a TLS certificate is configured on that gateway.

## Before you begin

1. [Install standalone agentgateway]({{< link-hextra path="/setup/install/" >}}).
2. [Launch the UI]({{< link-hextra path="/setup/ui/launch-ui/" >}}) so that you know where agentgateway serves it today.

{{< doc-test paths="ui-standalone-gateway" >}}
# Install agentgateway binary for tests
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Serve the UI on its own gateway

Add a second gateway to your configuration and point the `ui` section at it. The configuration is the same in every installation method, because all three read the same file. What differs is how you deliver the file to the proxy.

{{< tabs >}}
{{% tab name="Binary" %}}
1. Add a gateway for the UI to your configuration file, and point the `ui` section at it. The following example serves proxy traffic on port `4000` of the `default` gateway and the UI on port `4001` of the `ui-gateway`.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
     ui-gateway:
       port: 4001
   ui:
     gateways: [ui-gateway]
   routes:
   - matches:
     - path:
         pathPrefix: /
     backends:
     - host: httpbin.org:80
   ```

2. Start agentgateway with the updated configuration.

   ```sh
   agentgateway -f config.yaml
   ```

   Agentgateway logs the UI gateway address.

   ```txt
   INFO app  serving UI at http://localhost:4001/ui
   ```

3. Confirm that the UI answers on its own port.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/ui
   ```

   Example output:

   ```txt
   200
   ```

4. Confirm that the UI no longer answers on the proxy port. The response code depends on what your route does with the `/ui` path. In this example, the request reaches httpbin, which returns a `404`.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/ui
   ```

   Example output:

   ```txt
   404
   ```
{{% /tab %}}
{{% tab name="Docker" %}}
The container must publish the new UI port, so this change needs a container restart even though agentgateway reloads the `gateways` and `ui` sections in place.

1. Add a gateway for the UI to the configuration file that you mount, and point the `ui` section at it. The following example serves proxy traffic on port `4000` of the `default` gateway and the UI on port `4001` of the `ui-gateway`.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
     ui-gateway:
       port: 4001
   ui:
     gateways: [ui-gateway]
   routes:
   - matches:
     - path:
         pathPrefix: /
     backends:
     - host: httpbin.org:80
   ```

2. Remove the running container.

   ```sh
   docker rm -f agentgateway
   ```

3. Start the container again, publishing both the proxy port and the new UI port.

   ```sh
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -p 4000:4000 -p 4001:4001 \
     {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}} \
     -f /config.yaml
   ```

   > [!NOTE]
   > If you followed the **Mount a directory** option in the [Docker installation]({{< link-hextra path="/setup/install/docker/" >}}), edit `config.yaml` inside the directory that you mounted, and keep your `-v "$PWD/agentgateway-config:/config"` mount and no `-f` option instead of the file mount in this example.

4. Confirm the UI gateway address in the container logs.

   ```sh
   docker logs agentgateway | grep "serving UI"
   ```

   Example output:

   ```txt
   INFO app  serving UI at http://localhost:4001/ui
   ```

5. Confirm that the UI answers on its own port.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/ui
   ```

   Example output:

   ```txt
   200
   ```

6. Confirm that the UI no longer answers on the proxy port, and that the proxy still serves your route. The response code for `/ui` depends on what your route does with that path. In this example, the request reaches httpbin, which returns a `404`.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/ui
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/get
   ```

   Example output:

   ```txt
   404
   200
   ```
{{% /tab %}}
{{% tab name="Helm" %}}
1. Add a `ui-gateway` gateway to your Helm values file, and point the `ui` section at it. The following example serves proxy traffic such as httpbin routes on port `4000` of the default gateway and the UI on port `4001` of the `ui-gateway`.

   ```yaml
   cat <<'EOF' > values.yaml
   config:
     gateways:
       default:
         port: 4000
       ui-gateway:
         port: 4001
     ui:
       gateways: [ui-gateway]
     routes:
     - matches:
       - path:
           pathPrefix: /
       backends:
       - host: httpbin.httpbin.svc.cluster.local:8000
   EOF
   ```

2. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

3. Confirm that the UI no longer answers on the proxy port.

   1. Port-forward the agentgateway Deployment on port 4000 for proxy traffic.

      ```sh
      kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
        deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4000:4000
      ```

   2. Send a request to the `/ui` path. Confirm that the request fails, because port `4000` now serves only your routes.

      ```sh
      curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/ui
      ```

      Example output:

      ```txt
      503
      ```

4. Confirm that the UI answers on its own port.

   1. Port-forward the agentgateway Deployment on port 4001 for UI traffic.

      ```sh
      kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
        deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4001:4001
      ```

   2. Send a request to the `/ui` path. Confirm that the request returns a `200` success code.

      ```sh
      curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/ui
      ```

      Example output:

      ```txt
      200
      ```

To reach the UI port from outside the cluster instead of through a port-forward, see [Expose the UI]({{< link-hextra path="/setup/ui/expose-ui/" >}}).
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="ui-standalone-gateway" >}}
pkill -f "agentgateway -f" 2>/dev/null || true
sleep 1
cat > /tmp/agw-ui-gateway.yaml <<'EOF'
config:
  adminAddr: localhost:15000
gateways:
  default:
    port: 4000
  ui-gateway:
    port: 4001
ui:
  gateways: [ui-gateway]
routes:
- matches:
  - path:
      pathPrefix: /
  backends:
  - host: httpbin.org:80
EOF
agentgateway -f /tmp/agw-ui-gateway.yaml &
AGW_UI_GW_PID=$!
sleep 3
YAMLTest -f - <<'EOF'
- name: UI is served on the UI gateway port
  http:
    url: "http://localhost:4001"
    path: "/ui/"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
- name: admin interface endpoints are not served on the UI gateway
  http:
    url: "http://localhost:4001"
    path: "/config_dump"
    method: GET
  source:
    type: local
  expect:
    statusCode: 404
  retries: 3
EOF
# The 404 above must mean "not routed here", not "endpoint does not exist".
# Assert with curl rather than YAMLTest, because /config_dump is trailing-slash
# sensitive and returns 404 as /config_dump/ even on the admin address.
ADMIN_DUMP_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:15000/config_dump)"
test "$ADMIN_DUMP_CODE" = "200"
kill $AGW_UI_GW_PID 2>/dev/null || true
{{< /doc-test >}}

> [!NOTE]
> The UI gateway is an addition, not a replacement. Agentgateway still serves a copy of the UI on the admin interface, which is loopback-only and which you do not need to change. Adding this gateway does not put the admin interface's debugging endpoints on it. For more information, see [The UI and the admin interface are not the same thing]({{< link-hextra path="/setup/ui/#admin-interface" >}}).

## Next steps

* [Secure the UI]({{< link-hextra path="/setup/ui/secure-ui/" >}}) with an OIDC login on the gateway that you created.
* [Expose the UI]({{< link-hextra path="/setup/ui/expose-ui/" >}}) on your own HTTPS hostname.
