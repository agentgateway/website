---
title: OpenAI Realtime
weight: 55
description: Proxy OpenAI Realtime API WebSocket traffic and track token usage.
prev: /llm/observability
test:
  realtime-standalone:
  - file: content/docs/standalone/main/llm/realtime.md
    path: realtime-standalone
---

Proxy OpenAI Realtime API traffic through agentgateway to get token usage tracking and observability for WebSocket-based interactions.

## About

The [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) uses WebSocket connections for low-latency, multimodal interactions. Agentgateway can proxy these WebSocket connections and parse the `response.done` events to extract token usage data, including input tokens, output tokens, and cached token counts.

To enable token usage tracking, you must prevent the client and server from negotiating WebSocket frame compression. When the `sec-websocket-extensions: permessage-deflate` header is present, the WebSocket frames are compressed and agentgateway cannot parse the token usage data. Remove this header from the request so that frames remain uncompressed and parseable.

{{< callout type="info" >}}
The `realtime` route type supports token usage tracking and observability. Other LLM policies such as prompt guards, prompt enrichment, and request-body rate limiting are not supported for WebSocket traffic.
{{< /callout >}}

## Before you begin

[Install the `agentgateway` binary]({{< link-hextra path="/deployment/binary">}}).

{{< doc-test paths="realtime-standalone" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
{{< /doc-test >}}

## Step 1: Configure the Realtime route

Set up your agentgateway configuration with the `realtime` route type and a transformation to remove the `sec-websocket-extensions` header.

1. Create or update your `config.yaml` file. Map the `/v1/realtime` path to the `realtime` route type and remove the `sec-websocket-extensions` header to prevent WebSocket frame compression.

   ```yaml {paths="realtime-standalone"}
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - routes:
       - matches:
         - path:
             pathPrefix: "/v1/realtime"
         backends:
         - ai:
             name: openai
             provider:
               openAI: {}
         policies:
           ai:
             routes:
               "/v1/realtime": "realtime"
           backendAuth:
             key: "$OPENAI_API_KEY"
           transformations:
             request:
               remove:
               - sec-websocket-extensions
       - backends:
         - ai:
             name: openai
             provider:
               openAI:
                 model: gpt-4
         policies:
           ai:
             routes:
               "/v1/chat/completions": "completions"
               "*": "passthrough"
           backendAuth:
             key: "$OPENAI_API_KEY"
   EOF
   ```

   {{< doc-test paths="realtime-standalone" >}}
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

2. Run the agentgateway proxy with your configuration.

   ```sh
   agentgateway -f config.yaml
   ```

## Step 2: Send a Realtime request

Send a request to the OpenAI Realtime API through agentgateway using a WebSocket client. The Realtime API uses WebSocket connections, so standard HTTP tools like `curl` do not work. Use a WebSocket client such as [`websocat`](https://github.com/vi/websocat), [`wscat`](https://github.com/websockets/wscat), or a custom application.

Connect to `ws://localhost:3000/v1/realtime?model=gpt-4o-realtime-preview` and send the following [client events](https://developers.openai.com/api/docs/guides/realtime) as JSON messages.

1. Create a conversation item with a text message.

   ```json
   {"type":"conversation.item.create","item":{"type":"message","role":"user","content":[{"type":"input_text","text":"Say hello in one word."}]}}
   ```

2. Trigger a text response.

   ```json
   {"type":"response.create","response":{"modalities":["text"]}}
   ```

3. Look for a `response.done` event in the server output. This event contains the token usage data that agentgateway extracts for metrics.

   ```json
   {"type":"response.done","response":{...,"usage":{"total_tokens":225,"input_tokens":150,"output_tokens":75}}}
   ```

## Step 3: Verify token tracking

After the Realtime request completes, verify that agentgateway recorded the token usage metrics.

1. Open the agentgateway [metrics endpoint](http://localhost:15020/metrics).
2. Look for the `agentgateway_gen_ai_client_token_usage` metric. The metric includes labels for the token type (`input` or `output`) and the model used.

For more information about LLM metrics and observability, see [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).
