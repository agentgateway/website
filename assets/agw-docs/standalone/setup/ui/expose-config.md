1. Add a `tls` section to the gateway that the UI is attached to. Agentgateway reads the certificate and key from the file system, and setting `tls` also switches the gateway protocol to HTTPS. Use the certificate for the hostname that you created a DNS record for.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
     ui-gateway:
       port: 4001
       tls:
         cert: /etc/agentgateway/tls/tls.crt
         key: /etc/agentgateway/tls/tls.key
   ```

2. Start agentgateway with the updated configuration.

   {{< tabs >}}
   {{% tab name="Binary" %}}
   The `cert` and `key` paths are paths on the host that agentgateway runs on, so put the files at those paths, or change the paths in the configuration to where your files already are. No mount is involved.

   ```sh
   agentgateway -f config.yaml
   ```
   {{% /tab %}}
   {{% tab name="Docker" %}}
   The `cert` and `key` paths are paths inside the container, so mount the directory that holds the certificate and key at the parent path. The following example mounts a local `tls` directory that holds `tls.crt` and `tls.key` at `/etc/agentgateway/tls`.

   ```sh
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -v "$PWD/tls:/etc/agentgateway/tls:ro" \
     -p 4000:4000 -p 4001:4001 \
     -e OIDC_COOKIE_SECRET \
     -e ISSUER_URL -e UI_CLIENT_ID -e UI_CLIENT_SECRET -e REDIRECT_URI \
     {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}} \
     -f /config.yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Confirm that the gateway serves your certificate.

   ```sh
   echo | openssl s_client -connect agentgateway.example.com:4001 \
     -servername agentgateway.example.com 2>/dev/null | openssl x509 -noout -subject -dates
   ```

   Example output:

   ```txt
   subject=CN=agentgateway.example.com
   notBefore=Aug 24 17:20:56 2026 GMT
   notAfter=Sep 23 17:20:56 2026 GMT
   ```

For more certificate options, see [Gateways]({{< link-hextra path="/documentation/configuration/gateways/" >}}).
