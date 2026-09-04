Route [CrewAI](https://www.crewai.com/) multi-agent LLM traffic through agentgateway running in Kubernetes to centralize credentials and capture audit logs for every agent call. Because agentgateway proxies the LLM traffic transparently, you can enforce rate limits, guardrails, and other policies without changing your CrewAI application.

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
2. Get an API key from the [OpenAI platform](https://platform.openai.com/api-keys).

## Install CrewAI

Install CrewAI in a Python 3.12 virtual environment. These steps use [uv](https://docs.astral.sh/uv/), which downloads Python 3.12 for you if your system does not already have it. For other installation methods, see the [CrewAI installation guide](https://docs.crewai.com/installation).

```bash
uv venv --python 3.12
uv pip install crewai
```

The commands create a `.venv` directory in the current folder, which later steps use to run the crew with `.venv/bin/python3`.

> [!NOTE]
> Use Python 3.12. CrewAI currently fails to import on newer versions, such as Python 3.14. The `uv venv --python 3.12` command pins the correct version even when your system Python is newer, so you do not have to install Python 3.12 separately.

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Set up the OpenAI backend

Create the Secret, backend, and route that proxy OpenAI traffic through agentgateway. This guide uses a dedicated `crewai` backend and route on the `/openai` path, so it never changes an OpenAI backend or route that you might already have from the [OpenAI provider setup]({{< link-hextra path="/integrations/llm/providers/openai/" >}}). 

{{< doc-test paths="crewai-k8s" >}}
# WHAT THIS TEST VALIDATES:
#   * The OpenAI Secret, backend, and HTTPRoute apply and reach Accepted=True.
#   * A chat completion request to the client path /openai/chat/completions is
#     routed to OpenAI (proven by a 401, since the Secret holds a placeholder key).
#     This is the exact path CrewAI sends: {base_url}/chat/completions.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The CrewAI install and crew run - External dependency: needs a Python 3.12
#     environment and a real OpenAI key, neither of which CI provides.
#   * A 200 chat completion end to end - External dependency: requires a real
#     OpenAI key; the test uses a placeholder, so OpenAI returns 401.
{{< /doc-test >}}

1. Export your OpenAI API key.

   ```bash {paths="crewai-k8s"}
   export OPENAI_API_KEY="sk-your-key-here"
   ```

2. Create a Kubernetes Secret for your API key.

   ```yaml {paths="crewai-k8s"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: openai-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: $OPENAI_API_KEY
   EOF
   ```

3. Create an {{< reuse "agw-docs/snippets/backend.md" >}} named `crewai` for OpenAI.

   ```yaml {paths="crewai-k8s"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: crewai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai: {}
     policies:
       auth:
         secretRef:
           name: openai-secret
   EOF
   ```

   {{< doc-test paths="crewai-k8s" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for crewai backend to be accepted
     wait:
       target:
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         metadata:
           namespace: agentgateway-system
           name: crewai
       jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 60
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

4. Create an HTTPRoute named `crewai` that matches the `/openai` path prefix and forwards traffic to the backend. The backend normalizes the path to the provider's `/v1/chat/completions` endpoint, so the `/openai/chat/completions` path that CrewAI sends is routed correctly and no URL rewrite is needed.

   ```yaml {paths="crewai-k8s"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: crewai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
         - path:
             type: PathPrefix
             value: /openai
         backendRefs:
         - name: crewai
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```

{{< doc-test paths="crewai-k8s" >}}
YAMLTest -f - <<'EOF'
- name: wait for crewai HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: agentgateway-system
        name: crewai
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="crewai-k8s" >}}
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null -w "%{http_code}" -X POST "http://${INGRESS_GW_ADDRESS}:80/openai/chat/completions" -H "Content-Type: application/json" -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}' && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="crewai-k8s" >}}
YAMLTest -f - <<'EOF'
- name: verify OpenAI chat completions is routed through the gateway
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /openai/chat/completions
    method: POST
    headers:
      Content-Type: application/json
    body: '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
  source:
    type: local
  expect:
    statusCode: 401
EOF
{{< /doc-test >}}

## Configure CrewAI

Point CrewAI at agentgateway, keep tracing local, and create the crew.

1. Set the base URL so that CrewAI sends LLM requests to the agentgateway `/openai` route instead of directly to OpenAI.

   {{< tabs >}}

   {{% tab name="LoadBalancer" %}}
   ```bash
   export AGENTGATEWAY_URL="http://$INGRESS_GW_ADDRESS/openai"
   ```
   {{% /tab %}}

   {{% tab name="Port-forward" %}}
   ```bash
   export AGENTGATEWAY_URL="http://localhost:8080/openai"
   ```
   {{% /tab %}}

   {{< /tabs >}}

2. Disable CrewAI tracing so that CrewAI does not prompt you to upload execution traces to its cloud service. This keeps all prompt and response data behind the gateway.

   ```bash
   export CREWAI_TRACING_ENABLED=false
   ```

3. Create a `crew.py` file. This crew writes a short blog post about AI gateway patterns. The Researcher agent gathers at least four findings on the topic, then the Writer agent turns those findings into a post of 100 to 200 words. The topic is only an example, so you can change the two `description` fields to research and write about something else.

   ```bash
   cat > crew.py <<'PY'
   from crewai import Agent, Task, Crew, Process, LLM
   import os

   # agentgateway exposes an OpenAI-compatible API, so use provider="openai".
   # agentgateway injects the real OpenAI key, so the api_key here is a placeholder.
   agentgateway_proxy = LLM(
       provider="openai",
       base_url=os.environ["AGENTGATEWAY_URL"],
       model="gpt-4o",
       api_key="agentgateway-handles-auth",
   )

   researcher = Agent(
       role="Researcher",
       goal="Gather interesting and accurate information on any topic",
       backstory="A curious and thorough researcher who surfaces compelling facts and insights.",
       llm=agentgateway_proxy,
   )

   writer = Agent(
       role="Blog Writer",
       goal="Turn research into an engaging blog post anyone can enjoy",
       backstory="A versatile writer who crafts clear, lively blog posts without jargon.",
       llm=agentgateway_proxy,
   )

   research_task = Task(
       description="Research the topic: 'AI gateway patterns'. Identify at least 4 interesting findings.",
       expected_output="A bullet-point list of 4 or more findings, each with a short explanation.",
       agent=researcher,
   )

   writing_task = Task(
       description="Using the research notes, write a 100-200 word blog post on the topic.",
       expected_output="A short blog post with a title, 2-3 paragraphs, and a closing takeaway.",
       agent=writer,
       context=[research_task],
   )

   crew = Crew(
       agents=[researcher, writer],
       tasks=[research_task, writing_task],
       process=Process.sequential,
       verbose=True,
       tracing=False,
   )

   print(crew.kickoff())
   PY
   ```

   The script uses four CrewAI building blocks:

   - **`LLM`** connects CrewAI to agentgateway. Both agents share this one `LLM`, so every model call goes through the gateway instead of directly to OpenAI.
   - **`Agent`** defines a worker with a `role`, a `goal`, and a `backstory`. This crew has two agents, a Researcher and a Writer.
   - **`Task`** defines one job for an agent, with a `description` and an `expected_output`. The writing task passes the research task as its `context`, so the Writer receives the Researcher's findings.
   - **`Crew`** groups the agents and tasks and runs them. `process=Process.sequential` runs the tasks in order, so the Researcher finishes before the Writer starts. `verbose=True` prints each agent's progress, and `crew.kickoff()` starts the run.

The following table describes the `LLM` arguments that connect CrewAI to agentgateway:

| Argument | Description |
|---|---|
| `provider` | The provider format CrewAI uses. Set to `openai` so CrewAI speaks the OpenAI-compatible API that agentgateway exposes. |
| `base_url` | The agentgateway `/openai` path. CrewAI sends chat completions to `/openai/chat/completions` here instead of to `api.openai.com`. |
| `model` | The model to use. agentgateway forwards the request to OpenAI with this model. |
| `api_key` | Must be non-empty for CrewAI to start, but it is not used to call OpenAI. Agentgateway injects the real key from the `openai-secret` Secret. |

## Verify the connection

1. Run the crew to send requests through agentgateway. Both agents run in sequence. The Researcher agent produces findings, then the Writer agent turns them into a blog post. Every LLM call flows through agentgateway.

   ```bash
   .venv/bin/python3 crew.py
   ```

   Example output: 
   ```console
   ╭────────────────────────────────────────────────────────────────────────────────────────────────────────────── ✅ Agent Final Answer ──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
   │                                                                                                                                                                                                                                                   │
   │  Agent: Researcher                                                                                                                                                                                                                                │
   │                                                                                                                                                                                                                                                   │
   │  Final Answer:                                                                                                                                                                                                                                    │
   │  - **Definition of AI Gateway Patterns**: AI gateway patterns are architectural designs or frameworks used to integrate AI capabilities into existing systems or software applications. These patterns ensure efficient communication between AI  │
   │  services and the systems they enhance, facilitating seamless interactions and data flows. They cover aspects like authentication, data preprocessing, response handling, and decision making.                                                    │
   │                                                                                                                                                                                                                                                   │
   │  - **Centralized AI Management**: One common AI gateway pattern involves using a centralized system to manage multiple AI models and services. This pattern helps in maintaining consistency, reducing redundancy, and simplifying updates        │
   │  across various AI tools used within an organization. By centralizing AI management, businesses can streamline operations and improve the scalability of their AI applications.                                                                   │
   │                                                                                                                                                                                                                                                   │
   │  - **Edge AI Deployment**: Another crucial pattern is deploying AI capabilities at the edge of a network, closer to where data is generated. This reduces latency and bandwidth usage by processing data locally rather than relying on           │
   │  cloud-based AI services. Edge AI deployment is particularly beneficial in applications requiring real-time decision-making, such as autonomous vehicles or industrial IoT.                                                                       │
   │                                                                                                                                                                                                                                                   │
   │  - **API Gateway for AI Services**: An API gateway acts as an intermediary between clients and back-end AI services. This pattern allows for the unification of different AI functionality under one access point, making it easier for           │
   │  developers to implement AI features without directly interacting with each AI model's complexity. It also provides features like load balancing, monitoring, and security, which are essential for maintaining robust AI systems.                │
   │                                                                                                                                                                                                                                                   │
   │  - **Composable AI Architecture**: This pattern involves building AI systems using a modular approach, where different AI components can be recombined or replaced as needed. Such an architecture allows businesses to experiment and innovate   │
   │  rapidly, as new AI models can be integrated without significant disruptions to the existing system. It supports the dynamic nature of AI research and application development, encouraging the use of the latest advancements with minimal       │
   │  friction.                                                                                                                                                                                                                                        │
   │                                                                                                                                                                                                                                                   │
   ╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

   ...

   # Unveiling AI Gateway Patterns: The Backbone of Modern AI Integration

   In the rapidly evolving world of artificial intelligence, ensuring that AI services seamlessly integrate with existing systems is more critical than ever. This is where AI gateway patterns come into play. These architectural designs serve as vital frameworks facilitating communication between AI services and the systems they enhance. They encompass various aspects such as authentication, data preprocessing, response handling, and decision making, thereby enabling smooth interactions and data flows.

   Among these essential patterns is the centralized AI management system. By consolidating multiple AI models and services into a singular management hub, organizations can achieve consistency and efficiency. This pattern not only minimizes redundancy but also simplifies the maintenance and update processes across various AI applications, thereby enhancing scalability and operational streamlining. On the other hand, the deployment of AI capabilities at the network's edge, known as Edge AI, brings AI closer to the data source. This strategy significantly reduces latency and bandwidth usage, making it ideal for applications requiring real-time decision-making, such as autonomous vehicles or industrial IoT.

   API gateways offer another innovative pattern by acting as intermediaries between clients and back-end AI services. This setup unifies different AI functionalities under one access point, simplifying the implementation process for developers. To further bolster adaptability, composable AI architecture has emerged, favoring a modular approach where various AI components can be seamlessly interchanged. This architecture supports rapid experimentation and integration of new AI models, keeping pace with the dynamic nature of AI advancements.

   In summary, AI gateway patterns serve as the cornerstone for effective AI implementation, supporting everything from centralized management to real-time data processing at the edge. By embracing these architectures, businesses can ensure robust, scalable, and innovative AI solutions that meet the demands of today’s technological landscape.
   ```
 

2. Check the agentgateway proxy logs to confirm the requests were routed through the gateway. Each agent generates at least one request. 

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=10
   ```

   Example output: 
   ```console
   info  request gateway=agentgateway-system/agentgateway-proxy listener=http route=agentgateway-system/crewai endpoint=api.openai.com:443 http.method=POST http.path=/openai/chat/completions http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-4o gen_ai.usage.input_tokens=192 gen_ai.usage.output_tokens=286 duration=2242ms
   ```

## Clean up

If you no longer need the CrewAI setup, remove the resources that you created.

1. Delete the dedicated `crewai` backend and route. Leave the `openai-secret` Secret in place, because the OpenAI provider setup and other guides share it.

   ```bash {paths="crewai-k8s"}
   kubectl delete httproute crewai -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} crewai -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
   ```

2. Remove the local CrewAI files.

   ```bash
   rm -rf .venv crew.py
   ```

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/cost-controls/budget-limits/" title="Control spending" subtitle="Apply rate limits to LLM and tool traffic." >}}
  {{< card path="/documentation/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every agent call." >}}
{{< /cards >}}
