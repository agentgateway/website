---
title: Observe traffic
weight: 50
description:
---

Review LLM-specific metrics, logs, and traces. 

## Before you begin

Complete an LLM guide, such as the [control spend](../spending) guide. This guide sends a request to the LLM and receives a response. You can use this request and response example to verify metrics, logs, and traces.  

## View LLM metrics

You can access the agentgateway metrics endpoint to view LLM-specific metrics, such as the number of tokens that you used during a request or response. 

1. Open the agentgateway [metrics endpoint](http://localhost:15020/metrics). 
2. Look for the `agentgateway_gen_ai_client_token_usage` metric. This metric is a [histogram](https://prometheus.io/docs/concepts/metric_types/#histogram) and includes important information about the request and the response from the LLM, such as:
   * `gen_ai_token_type`: Whether this metric is about a request (`input`) or response (`output`). 
   * `gen_ai_operation_name`: The name of the operation that was performed. 
   * `gen_ai_system`: The LLM provider that was used for the request/response. 
   * `gen_ai_request_model`: The model that was used for the request. 
   * `gen_ai_response_model`: The model that was used for the response. 
   

For more information, see the [Semantic conventions for generative AI metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/) in the OpenTelemetry docs.

## View traces

1. {{< reuse "docs/snippets/jaeger.md" >}}

2. Configure your agentgateway proxy to emit traces and send them to the built-in OpenTelemetry collector agent. 
   ```yaml
   cat <<EOF > config.yaml
   config:  
     tracing:
       otlpEndpoint: http://localhost:4317
       randomSampling: true
   binds:
   - port: 3000
     listeners:
     - routes:
       - backends:
          - ai:
             name: openai
             provider:
               openAI:
                 # Optional; overrides the model in requests
                 model: gpt-3.5-turbo
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
   EOF
   ```

3. Run your agentgateway proxy. 
   ```sh
   agentgateway -f config.yaml
   ```

4. Send a request to the OpenAI provider. 
   ```sh
   curl 'http://0.0.0.0:3000/' \
   --header 'Content-Type: application/json' \
   --data ' {
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }'
   ```

5. Open the [Jaeger UI](http://localhost:16686/search) and verify that you can see traces for your LLM request. 
   

## View logs

Agentgateway automatically logs information to stdout. When you run agentgateway on your local machine, you can view a log entry for each request that is sent to agentgateway in your CLI output. 

Example for a successful request to the OpenAI LLM: 
```
2025-09-03T20:30:08.686967Z	info	request gateway=bind/3000 listener=listener0 route_rule=route0/default
route=route0 endpoint=api.openai.com:443 src.addr=127.0.0.1:54140 http.method=POST http.host=0.0.0.0 http.
path=/ http.version=HTTP/1.1 http.status=200 llm.provider=openai llm.request.model=gpt-3.5-turbo llm.
request.tokens=11 llm.response.model=gpt-3.5-turbo-0125 llm.response.tokens=331 duration=4305ms
```

Example for a rate limited request: 
```
2025-09-03T19:40:18.687849Z	info	request gateway=bind/3000 listener=listener0 route_rule=route0/default
route=route0 endpoint=api.openai.com:443 src.addr=127.0.0.1:51794 http.method=POST http.host=0.0.0.0 http.
path=/ http.version=HTTP/1.1 http.status=429 error=rate limit exceeded duration=206ms
```