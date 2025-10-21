---
title: TCP listeners
weight: 20
description: Configure TCP listeners for agentgateway.
--- 

You can use the built-in agentgateway UI or a configuration file to create, update, and delete TCP listeners. TCP listeners enable raw TCP connection proxying for non-HTTP protocols.

## About {#about}

TCP listeners provide raw TCP connection proxying, which is useful for:

- **Database connections**: Proxy PostgreSQL, MySQL, Redis, and other database protocols
- **Custom protocols**: Handle any TCP-based protocol that isn't HTTP
- **Legacy applications**: Connect older applications that use custom TCP protocols
- **TLS termination**: Terminate TLS connections and forward to backend services
- **TLS passthrough**: Route TLS connections based on their [SNI](https://en.wikipedia.org/wiki/Server_Name_Indication), without terminating the TLS connection, and forward to backend services

## Before you begin

{{< reuse "docs/snippets/prereq-agentgateway.md" >}}

## Create listeners

Set up a TCP listener on your agentgateway. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

1. Create a configuration file with your TCP listener configuration. 
   
   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/local.json
   binds:
   - port: 5432
     listeners:
     - name: postgres-proxy
       protocol: TCP
       tcpRoutes:
       - name: postgres-backend
         backends:
         - host: postgres.example.com:5432
           weight: 1
   EOF
   ```

2. Review the configuration file. The example sets up a TCP listener that proxies raw TCP connections on port 5432 to a PostgreSQL server. 
   ```
   cat config.yaml
   ```

   ```yaml
   # yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/local.json
   binds:
   - port: 5432
     listeners:
     - name: postgres-proxy
       protocol: TCP
       tcpRoutes:
       - name: postgres-backend
         backends:
         - host: postgres.example.com:5432
           weight: 1
   ```

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

4. [Open the agentgateway listener UI](http://localhost:15000/ui/listeners/). 
   {{< reuse-image src="img/agentgateway-ui-listener-tcp.png" >}}

5. Click **Add Bind**. 
6. Enter a **Port** number such as `5432` and then click **Add Bind**.
   {{< reuse-image src="img/ui-listener-add-bind-tcp.png" >}}
7. Expand the port that you just created and click **Add Listener**.
8. For your listener, configure the details.
   * Name: If you omit this, a name is generated for you.
   * Gateway Name: An optional field to group together listeners for ease of management, such as listeners for the same app or team.
   * Target Bind: The port bind that you set up in the previous step.
   * Protocol: Select `TCP` as the protocol.
   * Hostname: The hostname that the listener binds to, which can include a wildcard `*`. To use an address that is compatible with IPv4 and IPv6, enter `[::]`.
   * Click **Add Listener** to save your configuration.
   
   {{< reuse-image src="img/ui-listener-tcp.png" >}}

{{% /tab %}}
{{% tab %}}

1. Create a configuration file with your TCP listener configuration. 
   
   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/local.json
   binds:
   - port: 5432
     listeners:
     - name: postgres-proxy
       protocol: TCP
       tcpRoutes:
       - name: postgres-backend
         backends:
         - host: postgres.example.com:5432
           weight: 1
   EOF
   ```

2. Review the configuration file. The example sets up a TCP listener that proxies raw TCP connections on port 5432 to a PostgreSQL server. 
   ```
   cat config.yaml
   ```

   ```yaml
   # yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/local.json
   binds:
   - port: 5432
     listeners:
     - name: postgres-proxy
       protocol: TCP
       tcpRoutes:
       - name: postgres-backend
         backends:
         - host: postgres.example.com:5432
           weight: 1
   ```

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

4. [Open the agentgateway listener UI](http://localhost:15000/ui/listeners/) and verify that your TCP listener is added successfully. 
   
{{% /tab %}}
{{< /tabs >}}

## Delete listeners

Remove agentgateway TCP listeners by using the UI or deleting the configuration file. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

Remove agentgateway TCP listeners with the UI. 

1. Run the agentgateway from which you want to remove a listener. 
   ```sh
   agentgateway -f config.yaml
   ```

2. [Open the agentgateway listener UI](http://localhost:15000/ui/listeners/) and find the TCP listener that you want to remove.

3. Click the trash icon and then **Delete** to remove the listener. 
   {{< reuse-image src="img/ui-listener-delete-tcp.png" >}}

{{% /tab %}}
{{% tab %}}

Update the configuration file to remove the TCP listener.

1. Remove the TCP listener from your configuration file.
2. Apply the updated configuration file to your agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

{{% /tab %}}
{{< /tabs >}}

## Next steps

Create a [TCP route](../../traffic-management/matching#tcp-routes) on the listener.