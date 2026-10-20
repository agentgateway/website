## About

A generated configuration attaches the UI to the same `default` gateway that serves your proxy traffic. Giving the UI a gateway of its own keeps UI traffic and proxy traffic on separate ports. Separate ports let you publish the proxy port while the UI port stays internal, and they let you apply different authentication policies to each.

A gateway of its own is also the prerequisite for the next two guides, because an authentication policy in `ui.policies` applies to the gateway that serves the UI, and a TLS certificate is configured on that gateway.

## Before you begin

1. [Install standalone agentgateway]({{< link-hextra path="/documentation/setup/install/" >}}).
2. [Launch the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}) so that you know where agentgateway serves it today.

{{< doc-test paths="ui-standalone-gateway" >}}
# Install agentgateway binary for tests
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Serve the UI on its own gateway

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
<span id="change-in-ui"></span>

You can make this change in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The UI must be able to save changes, which depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

1. Add a gateway for the UI.
   1. Open **Traffic** > **Gateways**, and click **Add gateway**.
   2. Enter `ui-gateway` for the **Name** and `4001` for the **Port**, and click **Save gateway**.
2. Open the **Settings** > **UI** page, such as [http://localhost:15000/ui/settings/ui](http://localhost:15000/ui/settings/ui).
3. From the **Public gateway** dropdown, select `ui-gateway`. To serve the UI only on the admin interface, select **None** instead.
4. Click **Save UI gateway**. If the UI is already served on a gateway, confirm the change in the **Change UI gateway?** dialog.

   If you opened the UI through the gateway that you changed or removed, the page stops loading. Open the UI on the new gateway or on the admin interface. If you chose **None**, the UI also removes the `ui` section from your configuration, including any `ui.policies`.

5. Confirm that the UI answers on its own port.

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/ui
   ```

   Example output:

   ```txt
   200
   ```

In Docker or Helm, you must also publish the new port, and the UI cannot do that for you. To publish port `4001`, see the **Docker** or **Helm** tab in the **Config file** tab.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/setup/ui/gateway-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/setup/ui/gateway-config.md" >}}
{{% /version %}}

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
> The UI gateway is an addition, not a replacement. Agentgateway still serves a copy of the UI on the admin interface, which is loopback-only and which you do not need to change. Adding this gateway does not put the admin interface's debugging endpoints on it. For more information, see [The UI and the admin interface are not the same thing]({{< link-hextra path="/documentation/setup/ui/#admin-interface" >}}).

## Next steps

* [Secure the UI]({{< link-hextra path="/documentation/setup/ui/secure-ui/" >}}) with an OIDC login on the gateway that you created.
* [Expose the UI]({{< link-hextra path="/documentation/setup/ui/expose-ui/" >}}) on your own HTTPS hostname.
