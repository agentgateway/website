## About

By default, agentgateway serves the admin UI on the admin address, and a generated configuration also attaches the UI to the same `default` gateway that serves your proxy traffic. Giving the UI a gateway of its own keeps UI traffic and proxy traffic on separate ports. Separate ports let you publish the proxy port while the UI port stays internal, and they let you apply different authentication policies to each.

A gateway of its own is also the prerequisite for the next two guides, because an authentication policy in `ui.policies` applies to the gateway that serves the UI, and a TLS certificate is configured on that gateway.

## Before you begin

1. [Install standalone agentgateway]({{< link-hextra path="/setup/install/" >}}).
2. [Launch the admin UI]({{< link-hextra path="/setup/ui/launch-ui/" >}}) so that you know where agentgateway serves it today.

{{< doc-test paths="ui-standalone-custom-port" >}}
# Install agentgateway binary for tests
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Serve the UI on its own gateway

Add a second gateway to your configuration and point the `ui` section at it. The configuration is the same in every installation method, because all three read the same file. What differs is how you deliver the file to the proxy.

{{< tabs >}}
{{% tab name="Binary" %}}
1. Add a gateway for the UI to your configuration file, and point the `ui` section at it. The following example serves proxy traffic on port `4000` of the `default` gateway and the UI on port `4001` of the `admin` gateway.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
     admin:
       port: 4001
   ui:
     gateways: [admin]
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

1. Add a gateway for the UI to the configuration file that you mount, and point the `ui` section at it. The following example serves proxy traffic on port `4000` of the `default` gateway and the UI on port `4001` of the `admin` gateway.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
     admin:
       port: 4001
   ui:
     gateways: [admin]
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
     cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}} \
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
1. Add an `admin` gateway to your Helm values file, and point the `ui` section at it. The following example serves proxy traffic such as httpbin routes on port `4000` of the default gateway and the UI on port `4001` of the admin gateway.

   ```yaml
   cat <<'EOF' > values.yaml
   config:
     gateways:
       default:
         port: 4000
       admin:
         port: 4001
     ui:
       gateways: [admin]
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

> [!NOTE]
> The UI gateway is an addition, not a replacement. Agentgateway continues to serve the UI and the admin API on the admin address, which is loopback-only by default. To turn the admin address off, see [Change the admin address](#customize-port).

## Change the admin address {#customize-port}

The admin address is `localhost:15000` in every installation method, whether or not the UI is also attached to a gateway. A gateway that serves the UI does not change the admin address, and changing the admin address does not change the gateway port. Set `adminAddr` in the `config` section of your configuration file to move the admin address, or to turn it off.

The value must use `ip:port` format, and also accepts `unix:/path/to/socket` or `off`. Setting `off` disables the admin address altogether, including the admin API on it, which leaves a gateway in the `ui` section as the only way to reach the UI.

1. Add or update the `adminAddr` field in your configuration file.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: localhost:9090
   ```

2. Start agentgateway with the updated config. Because `adminAddr` is in the `config` section, a running instance keeps the previous address until you restart it.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```
   INFO app  serving UI at http://localhost:9090/ui
   ```

{{< doc-test paths="ui-standalone-custom-port" >}}
pkill -f "agentgateway -f" 2>/dev/null || true
sleep 1
cat > /tmp/agw-ui-custom.yaml <<'EOF'
config:
  adminAddr: localhost:9090
EOF
agentgateway -f /tmp/agw-ui-custom.yaml &
AGW_CUSTOM_PID=$!
sleep 3
{{< /doc-test >}}

3. Open the UI at the new address. In this example, navigate to [http://localhost:9090/ui/](http://localhost:9090/ui/).

{{< doc-test paths="ui-standalone-custom-port" >}}
YAMLTest -f - <<'EOF'
- name: Admin UI returns HTTP 200 on custom port
  http:
    url: "http://localhost:9090/ui/"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
EOF
kill $AGW_CUSTOM_PID 2>/dev/null || true
{{< /doc-test >}}

> [!NOTE]
> If you change <code>adminAddr</code>, update any agentgateway admin API commands to use the new address. For example, change <code>curl http://localhost:15000/logging</code> to use the new port.

### Reach the admin UI in a container {#docker-admin-addr}

The default admin address binds to the container's own loopback interface, so publishing port 15000 with `-p 15000:15000` does not make it reachable from your host. You have two options.

* **Serve the UI on a gateway instead**, which is what the generated configuration does. This is the better option, because you can attach authentication policies to the gateway.
* **Bind the admin address to all interfaces** by setting `config.adminAddr` to `0.0.0.0:15000`, then publish that port. The admin address has no authentication. Do this only on a host where nothing untrusted can reach the published port, such as your personal workstation.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: 0.0.0.0:15000
   gateways:
     default:
       port: 4000
   ```

   ```sh
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -p 4000:4000 -p 15000:15000 \
     cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}} \
     -f /config.yaml
   ```

## Next steps

* [Secure the UI]({{< link-hextra path="/setup/ui/secure-ui/" >}}) with an OIDC login on the gateway that you created.
* [Expose the UI]({{< link-hextra path="/setup/ui/expose-ui/" >}}) on your own HTTPS hostname.
