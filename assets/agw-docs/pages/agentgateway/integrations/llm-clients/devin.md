Route the network traffic of [Devin Desktop](https://devin.ai/desktop), the AI-powered code editor from Cognition (formerly Windsurf), through agentgateway as an egress proxy.

## About Devin Desktop and agentgateway

Devin Desktop sends its model requests to Cognition's service. You cannot point Devin Desktop at your own LLM or at an LLM route in agentgateway. Instead, Devin Desktop can send all of its traffic through an HTTP proxy, which you set in its **Http: Proxy** setting.

Use agentgateway as this proxy when you want to see and control where Devin Desktop connects. For example, your network might allow outbound traffic only through an approved proxy.

When agentgateway is that proxy, it receives an HTTP `CONNECT` request for every destination that Devin Desktop connects to. Agentgateway can then require proxy credentials, log each destination, and restrict which destinations Devin Desktop can reach. The traffic stays encrypted end to end. For more information about the proxy modes, see [Egress proxy]({{< link-hextra path="/documentation/configuration/egress-proxy/" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install [Devin Desktop](https://devin.ai/desktop).

## Configure agentgateway as a proxy

The following example sets up a proxy that Devin Desktop must log in to before it can reach any destination. To keep the example simple, basic auth is used with the example username `devin` and password `secretpw`. Basic auth sends the password base64-encoded, not encrypted, so use it only when Devin Desktop and agentgateway run on the same machine or a trusted network. For your own setup, replace the credentials or use the authentication method that your organization uses.

1. Create a user database in htpasswd format for the proxy credentials that Devin Desktop uses.
   ```sh
   printf 'devin:%s\n' "$(openssl passwd -apr1 'secretpw')" > htpasswd.txt
   ```

2. Create a configuration file that accepts `CONNECT` requests on port 3000 and requires proxy credentials.
   ```yaml
   cat <<EOF > devin-proxy.yaml
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     connect:
       mode: route
   binds:
   - port: 3000
     listeners:
     - name: connect
       protocol: HTTP
       policies:
         basicAuth:
           htpasswd:
             file: htpasswd.txt
           mode: strict
           realm: agentgateway-egress
           authorizationLocation:
             header:
               name: proxy-authorization
               prefix: "Basic "
       routes:
       - name: devin-egress
         backends:
         - dynamic: {}
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `frontendPolicies.connect.mode` | Set to `route` so that `CONNECT` requests go through route matching, and HTTP policies such as `basicAuth` apply to them. |
   | `basicAuth` | Requires the proxy credentials from `htpasswd.txt`. Reading them from the `proxy-authorization` header makes agentgateway answer with a `407` challenge, which Devin Desktop shows as a proxy login dialog. |
   | `routes[].backends[].dynamic` | Connects to the destination in the `CONNECT` request. The route has no `hostnames`, so every destination is allowed. To restrict destinations, see [Restrict destinations](#restrict-destinations). |

3. Start agentgateway.
   ```sh
   agentgateway -f devin-proxy.yaml
   ```

4. In another terminal, verify that a request without credentials is challenged. The `--verbose` flag is required, because the proxy response is not the response that `curl` reports.
   ```sh
   curl --verbose --proxy http://127.0.0.1:3000 --head https://example.com/
   ```

   Example output:
   ```console
   < HTTP/1.1 407 Proxy Authentication Required
   < proxy-authenticate: Basic realm="agentgateway-egress"
   * CONNECT tunnel failed, response 407
   ```

5. Verify that a request with credentials reaches its destination.
   ```sh
   curl --proxy http://127.0.0.1:3000 --proxy-user devin:secretpw --head https://example.com/
   ```

   Example output:
   ```console
   HTTP/1.1 200 OK
   ```

## Configure Devin Desktop

For more information, see the [Devin Desktop proxy documentation](https://docs.devin.ai/desktop/troubleshooting/windsurf-proxy-configuration).

1. Open Devin Desktop Settings.
   - **macOS**: `Cmd + ,` or **Devin Desktop** > **Settings**
   - **Windows/Linux**: `Ctrl + ,` or **File** > **Preferences** > **Settings**

2. Search for **Http: Proxy**, and enter the agentgateway proxy URL.

   ```
   http://127.0.0.1:3000
   ```

3. Save the settings and restart Devin Desktop.

4. When Devin Desktop shows the proxy login dialog, enter the proxy credentials, such as `devin` and `secretpw`.

## Verify the connection

1. Send a message in the Devin Desktop chat panel, such as "test". Devin Desktop responds as usual.

2. In the terminal where agentgateway is running, verify that the log shows `CONNECT` requests from Devin Desktop with `http.status=200`. The `http.host` field is the destination.

   ```console
   info	request gateway=default/default listener=connect route=default/devin-egress ... http.method=CONNECT http.host=<destination> http.path=/ http.version=HTTP/1.1 http.status=200 protocol=http
   ```

## Restrict destinations {#restrict-destinations}

To allow only the destinations that Devin Desktop needs, list them in the route's `hostnames` field. Use the `http.host` values from the agentgateway log in the previous section. A `CONNECT` request to any other destination is refused with a `404` response.

```yaml
      routes:
      - name: devin-egress
        hostnames:
        - <destination-1>
        - <destination-2>
        backends:
        - dynamic: {}
```

Devin Desktop can connect to new destinations after an update. If Devin Desktop stops working, check the agentgateway log for refused `CONNECT` requests and add their hosts to the list.
