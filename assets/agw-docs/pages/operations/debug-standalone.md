Use built-in tools to troubleshoot issues in your standalone agentgateway setup.

## Enable debug logs {#debug-logs}

Enable debug logs in agentgateway. You can choose between two methods: using the logging endpoint or updating the config file.

- Curling the logging endpoint: Useful for quickly changing the log level without restarting agentgateway.
- Config file: Useful for setting the log level permanently, read at startup.

The logging level field uses the same style as `RUST_LOG`: 
- `debug`
- `info`
- `warn`
- `trace`
- `error`

Steps:

1. In your terminal, run agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

   By default, you can view `info` logs, such as the following example:

   ```
   2026-02-12T16:09:55.675307Z	info	request gateway=default/default listener=listener0 route=default/route0 src.addr=[::1]:56199 http.method=POST http.host=localhost http.path=/sse?sessionId=5b307a23-7676-413b-b8e6-8a3008c27866 http.version=HTTP/1.1 http.status=202 protocol=mcp mcp.method=tools/list mcp.resource.type=tool mcp.session.id=5b307a23-7676-413b-b8e6-8a3008c27866 duration=10ms
   ```

2. Enable debug logs.

   {{< tabs tabTotal="2" items="curl logging endpoint,config file" >}}
   {{% tab tabName="curl logging endpoint" %}}
   In another tab, enable debug logs. If you configured agentgateway to use a different admin `ip:port`, update the command accordingly.
   ```sh
   curl -X POST "http://localhost:15000/logging?level=debug"
   ```
   {{% /tab %}}
   {{% tab tabName="config file" %}}
   Update the config file to set the logging level to `debug`.
   ```yaml
   config:
     logging:
       level: debug
       # optional: default is text
       format: json   
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   current log level is typespec_client_core::http::policies::logging=warn,hickory_server::server::server_future=off,rmcp=warn,debug
   ```

3. In the tab that runs agentgateway, the logs now show `debug` information.

   Example output:

   ```
   2026-02-12T16:11:25.493503Z	debug	proxy::httpproxy	request before normalization: Request { method: OPTIONS, uri: /sse?sessionId=5b307a23-7676-413b-b8e6-8a3008c27866, version: HTTP/1.1, headers: {"host": "localhost:3000", "connection": "keep-alive", "accept": "*/*", "access-control-request-method": "POST", "access-control-request-headers": "cache-control,content-type,mcp-protocol-version", "origin": "http://localhost:15000", "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36", "sec-fetch-mode": "cors", "sec-fetch-site": "same-site", "sec-fetch-dest": "empty", "referer": "http://localhost:15000/", "accept-encoding": "gzip, deflate, br, zstd", "accept-language": "en-US,en;q=0.9"}, body: Body(UnsyncBoxBody) }
   ```