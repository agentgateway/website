- [agentgateway.dev/v1alpha1](#agentgatewaydevv1alpha1)


## agentgateway.dev/v1alpha1


### Resource Types
- [AgentgatewayBackend](#agentgatewaybackend)
- [AgentgatewayParameters](#agentgatewayparameters)
- [AgentgatewayPolicy](#agentgatewaypolicy)



#### A2ABackend



A2A backend endpoint.



_Appears in:_
- [AgentgatewayBackendSpec](#agentgatewaybackendspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `host` _[ShortString](#shortstring)_ | Hostname or IP address of the A2A backend. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `port` _integer_ | Port number of the A2A backend. |  | Maximum: 65535 <br />Minimum: 1 <br />Required: \{\} <br /> |


#### AIBackend



AI backend configuration.

_Validation:_
- ExactlyOneOf: [provider groups]

_Appears in:_
- [AgentgatewayBackendSpec](#agentgatewaybackendspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `provider` _[LLMProvider](#llmprovider)_ | Configuration for how to reach the configured LLM<br />provider. |  | ExactlyOneOf: [openai azureopenai azure anthropic gemini vertexai bedrock custom] <br />Optional: \{\} <br /> |
| `groups` _[PriorityGroup](#prioritygroup) array_ | Groups in priority order, where each group<br />defines a set of LLM providers. The priority determines the priority of<br />the backend endpoints chosen.<br />Note: provider names must be unique across all providers in all priority<br />groups. Backend policies may target a specific provider by name using<br />`targetRefs[].sectionName`.<br />Example configuration with two priority groups:<br />	groups:<br />	- providers:<br />	  - azureopenai:<br />	      deploymentName: gpt-4o-mini<br />	      apiVersion: 2024-02-15-preview<br />	      endpoint: ai-gateway.openai.azure.com<br />	- providers:<br />	  - azureopenai:<br />	      deploymentName: gpt-4o-mini-2<br />	      apiVersion: 2024-02-15-preview<br />	      endpoint: ai-gateway-2.openai.azure.com<br />	     policies:<br />	       auth:<br />	         secretRef:<br />	           name: azure-secret |  | MaxItems: 8 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### AIPromptEnrichment



Enriches requests sent to the LLM provider by appending and prepending system prompts.

Prompt enrichment allows you to add additional context to the prompt before sending it to the model.
Unlike RAG or other dynamic context methods, prompt enrichment is static and is applied to every request.

**Note**: Some providers, including Anthropic, do not support `SYSTEM`
role messages, and instead have a dedicated `system` field in the input
JSON. In this case, use the [`defaults` setting](#fielddefault) to set the
`system` field.

The following example prepends a system prompt of
`Answer all questions in French.` and appends
`Describe the painting as if you were a famous art critic from the 17th century.`
to each request that is sent to the `openai` `HTTPRoute`.

	name: openai-opt
	namespace: agentgateway-system

spec:

	targetRefs:
	- group: gateway.networking.k8s.io
	  kind: HTTPRoute
	  name: openai
	ai:
	    promptEnrichment:
	      prepend:
	      - role: SYSTEM
	        content: "Answer all questions in French."
	      append:
	      - role: USER
	        content: "Describe the painting as if you were a famous art critic from the 17th century."



_Appears in:_
- [BackendAI](#backendai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `prepend` _[Message](#message) array_ | Messages to prepend to the prompt sent by the client. |  | Optional: \{\} <br /> |
| `append` _[Message](#message) array_ | Messages to append to the prompt sent by the client. |  | Optional: \{\} <br /> |


#### AIPromptGuard



Prompt guards that block unwanted requests to the LLM provider and mask sensitive data.
Prompt guards can be used to reject requests based on the content of the prompt, as well as
mask responses based on the content of the response.

This example rejects any request prompts that contain
the string "credit card", and masks any credit card numbers in the response.

	promptGuard:
		request:
		- response:
		    message: "Rejected due to inappropriate content"
		  regex:
		    action: REJECT
		    matches:
		    - pattern: "credit card"
		      name: "CC"
		response:
		- regex:
		    builtins:
		    - CREDIT_CARD
		    action: MASK



_Appears in:_
- [BackendAI](#backendai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `streaming` _[PromptGuardStreamingMode](#promptguardstreamingmode)_ | Apply prompt guards to streaming responses and realtime websocket messages.<br />Defaults to disabled to preserve streaming throughput unless explicitly enabled. |  | Optional: \{\} <br /> |
| `request` _[PromptguardRequest](#promptguardrequest) array_ | Prompt guards to apply to requests sent by the client. |  | ExactlyOneOf: [regex webhook openAIModeration bedrockGuardrails googleModelArmor] <br />MaxItems: 8 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `response` _[PromptguardResponse](#promptguardresponse) array_ | Prompt guards to apply to responses returned by the LLM provider. |  | ExactlyOneOf: [regex webhook bedrockGuardrails googleModelArmor] <br />MaxItems: 8 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### APIKeyAuthentication





_Validation:_
- ExactlyOneOf: [secretRef secretSelector]

_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `mode` _[APIKeyAuthenticationMode](#apikeyauthenticationmode)_ | Validation mode for API key authentication. | Strict | Optional: \{\} <br /> |
| `secretRef` _[LocalSecretObjectRef](#localsecretobjectref)_ | Credential source, defaulting to a Kubernetes<br />`Secret`, storing a set of API keys. If there are many Secret-backed<br />keys, `secretSelector` can be used instead.<br />Each entry in the credential data represents one API key. The key is an<br />arbitrary identifier. The value can either be:<br />* A string representing the API key.<br />* A JSON object with `key` or `keyHash`, plus optional `metadata`.<br />  `key` contains the API key. `keyHash` contains a hashed API key in<br />  `sha256:<hex>` format. `metadata` contains arbitrary JSON metadata<br />  associated with the key, which may be used by other policies. For<br />  example, you may write an authorization policy allowing<br />  `apiKey.group == 'sales'`.<br />Example:<br />	apiVersion: v1<br />	kind: Secret<br />	metadata:<br />	  name: api-key<br />	stringData:<br />	  client1: \|<br />	    \{<br />	      "key": "k-123",<br />	      "metadata": \{<br />	        "group": "sales",<br />	        "created_at": "2024-10-01T12:00:00Z"<br />	      \}<br />	    \}<br />	  client2: "k-456"<br />	  client3: \|<br />	    \{<br />	      "keyHash": "sha256:efa299afb8c12a36e47a790cbbf929caa06d13285950410463fb759af17d0dad",<br />	      "metadata": \{<br />	        "group": "engineering"<br />	      \}<br />	    \} |  | Optional: \{\} <br /> |
| `secretSelector` _[SecretSelector](#secretselector)_ | Selects multiple Kubernetes `Secret` resources<br />containing API keys. It is Secret-only; use `secretRef` for other<br />credential kinds. If the same key is defined in multiple secrets, the<br />behavior is undefined.<br />Each entry in the `Secret` data represents one API key. The key is an<br />arbitrary identifier. The value can either be:<br />* A string representing the API key.<br />* A JSON object with `key` or `keyHash`, plus optional `metadata`.<br />  `key` contains the API key. `keyHash` contains a hashed API key in<br />  `sha256:<hex>` format. `metadata` contains arbitrary JSON metadata<br />  associated with the key, which may be used by other policies. For<br />  example, you may write an authorization policy allowing<br />  `apiKey.group == 'sales'`.<br />Example:<br />	apiVersion: v1<br />	kind: Secret<br />	metadata:<br />	  name: api-key<br />	stringData:<br />	  client1: \|<br />	    \{<br />	      "key": "k-123",<br />	      "metadata": \{<br />	        "group": "sales",<br />	        "created_at": "2024-10-01T12:00:00Z"<br />	      \}<br />	    \}<br />	  client2: "k-456" |  | Optional: \{\} <br /> |
| `location` _[AuthorizationExtractionLocation](#authorizationextractionlocation)_ | Where API keys are read from.<br />If omitted, credentials are read from the `Authorization` header with the `Bearer ` prefix. |  | ExactlyOneOf: [header queryParameter cookie expression] <br />Optional: \{\} <br /> |


#### APIKeyAuthenticationMode

_Underlying type:_ _string_





_Appears in:_
- [APIKeyAuthentication](#apikeyauthentication)

| Field | Description |
| --- | --- |
| `Strict` | A valid API Key must be present.<br />This is the default option.<br /> |
| `Optional` | If an API Key exists, validate it.<br />Warning: this allows requests without an API Key!<br /> |
| `Permissive` | Requests are never rejected for missing or invalid API keys.<br />Warning: this allows requests without a valid API key!<br /> |


#### AWSGuardrailConfig







_Appears in:_
- [BedrockConfig](#bedrockconfig)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `identifier` _[ShortString](#shortstring)_ | Identifier of the Guardrail policy to use for the backend. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `version` _[ShortString](#shortstring)_ | Version of the Guardrail policy to use for the backend. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### AccessLog



Per-request access log settings.



_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `filter` _[CELExpression](#celexpression)_ | CEL expression used to filter logs. A log<br />will only be emitted if the expression evaluates to `true`. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `attributes` _[LogTracingAttributes](#logtracingattributes)_ | Customizations to the key-value pairs that are<br />logged. |  | Optional: \{\} <br /> |
| `otlp` _[OtlpAccessLog](#otlpaccesslog)_ | OTLP access log export to an<br />OpenTelemetry-compatible backend. |  | Optional: \{\} <br /> |


#### Action

_Underlying type:_ _string_

Action to take if a regex pattern is matched in a request or response.
This setting applies only to request matches. `PromptguardResponse`
matches are always masked by default.



_Appears in:_
- [Regex](#regex)

| Field | Description |
| --- | --- |
| `Mask` | Mask the matched data in the request.<br /> |
| `Reject` | Reject the request if the regex matches content in the request.<br /> |


#### AgentExtAuthGRPC







_Appears in:_
- [ExtAuth](#extauth)
- [ExtAuthOrConditional](#extauthorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `contextExtensions` _object (keys:string, values:string)_ | Additional arbitrary key-value pairs to<br />send to the authorization server in the `context_extensions` field. |  | MaxProperties: 64 <br />Optional: \{\} <br /> |
| `requestMetadata` _object (keys:string, values:[CELExpression](#celexpression))_ | Metadata to send to the authorization<br />server. This maps to the `metadata_context.filter_metadata` field of the<br />request, and allows dynamic CEL expressions. If unset, by default the<br />`envoy.filters.http.jwt_authn` key is set if the JWT policy is used as<br />well, for compatibility. |  | MaxProperties: 64 <br />Optional: \{\} <br /> |


#### AgentExtAuthHTTP







_Appears in:_
- [ExtAuth](#extauth)
- [ExtAuthOrConditional](#extauthorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `path` _[CELExpression](#celexpression)_ | Path to send to the authorization server. If<br />unset, this defaults to the original request path.<br />This is a CEL expression, which allows customizing the path based on the<br />incoming request. For example, to add a prefix, use<br />`"/prefix/" + request.path`. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `redirect` _[CELExpression](#celexpression)_ | Optional expression that determines a path to<br />redirect to on authorization failure. This is useful to redirect to a<br />sign-in page. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `body` _[CELExpression](#celexpression)_ | Body is a CEL expression that produces the HTTP authorization request body.<br />Strings and bytes are used directly; other values are JSON-encoded. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `allowedRequestHeaders` _[ShortString](#shortstring) array_ | Additional headers from the client request that<br />will be sent to the authorization server.<br />If unset, the following headers are sent by default: `Authorization`. |  | MaxItems: 64 <br />MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `addRequestHeaders` _object (keys:string, values:[CELExpression](#celexpression))_ | Additional headers to add to the<br />request to the authorization server. While `allowedRequestHeaders` just<br />passes the original headers through, `addRequestHeaders` allows defining<br />custom headers based on CEL expressions. |  | MaxProperties: 64 <br />Optional: \{\} <br /> |
| `allowedResponseHeaders` _[ShortString](#shortstring) array_ | Headers from the authorization response that<br />will be copied into the request to the backend. |  | MaxItems: 64 <br />MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `responseMetadata` _object (keys:string, values:[CELExpression](#celexpression))_ | Metadata fields to construct<br />from the authorization response. These will be included under the<br />`extauthz` variable in future CEL expressions. Setting this is useful<br />for things like logging usernames, without needing to include them as<br />headers to the backend, as `allowedResponseHeaders` would. |  | MaxProperties: 64 <br />Optional: \{\} <br /> |


#### AgentgatewayBackend









| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `apiVersion` _string_ | `agentgateway.dev/v1alpha1` | | |
| `kind` _string_ | `AgentgatewayBackend` | | |
| `kind` _string_ | Kind is a string value representing the REST resource this object represents.<br />Servers may infer this from the endpoint the client submits requests to.<br />Cannot be updated.<br />In CamelCase.<br />More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  | Optional: \{\} <br /> |
| `apiVersion` _string_ | APIVersion defines the versioned schema of this representation of an object.<br />Servers should convert recognized schemas to the latest internal value, and<br />may reject unrecognized values.<br />More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  | Optional: \{\} <br /> |
| `metadata` _[ObjectMeta](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#objectmeta-v1-meta)_ | Refer to Kubernetes API documentation for fields of `metadata`. |  | Optional: \{\} <br /> |
| `spec` _[AgentgatewayBackendSpec](#agentgatewaybackendspec)_ | Desired backend configuration. |  | ExactlyOneOf: [ai static dynamicForwardProxy mcp aws a2a] <br />Required: \{\} <br /> |
| `status` _[AgentgatewayBackendStatus](#agentgatewaybackendstatus)_ | Current backend status. |  | Optional: \{\} <br /> |


#### AgentgatewayBackendSpec





_Validation:_
- ExactlyOneOf: [ai static dynamicForwardProxy mcp aws a2a]

_Appears in:_
- [AgentgatewayBackend](#agentgatewaybackend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `static` _[StaticBackend](#staticbackend)_ | Static hostname, IP address, or Unix Domain Socket backend. |  | Optional: \{\} <br /> |
| `a2a` _[A2ABackend](#a2abackend)_ | A2A backend. |  | Optional: \{\} <br /> |
| `ai` _[AIBackend](#aibackend)_ | LLM backend. |  | ExactlyOneOf: [provider groups] <br />Optional: \{\} <br /> |
| `mcp` _[MCPBackend](#mcpbackend)_ | MCP backend. |  | Optional: \{\} <br /> |
| `dynamicForwardProxy` _[DynamicForwardProxyBackend](#dynamicforwardproxybackend)_ | Dynamically sends requests to the destination based on the incoming<br />request HTTP host header, or TLS SNI for TLS traffic.<br />Warning: this backend type can send requests to arbitrary destinations. Proper<br />access controls must be put in place when using this backend type. |  | Optional: \{\} <br /> |
| `aws` _[AwsBackend](#awsbackend)_ | AWS service backend, such as AgentCore. |  | ExactlyOneOf: [agentCore] <br />Optional: \{\} <br /> |
| `policies` _[BackendFull](#backendfull)_ | Policies for communicating with this backend. Policies may also be set<br />with AgentgatewayPolicy. Backend policies take precedence over policy<br />resources when they set the same field. |  | Optional: \{\} <br /> |


#### AgentgatewayBackendStatus



Current backend status.



_Appears in:_
- [AgentgatewayBackend](#agentgatewaybackend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `conditions` _[Condition](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#condition-v1-meta) array_ | Current condition state for the backend. |  | MaxItems: 8 <br />Optional: \{\} <br /> |


#### AgentgatewayParameters



Configures dynamic provisioning for the agentgateway data plane.
Labels and annotations that apply to
all resources may be specified at a higher level; see
https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#gatewayinfrastructure





| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `apiVersion` _string_ | `agentgateway.dev/v1alpha1` | | |
| `kind` _string_ | `AgentgatewayParameters` | | |
| `kind` _string_ | Kind is a string value representing the REST resource this object represents.<br />Servers may infer this from the endpoint the client submits requests to.<br />Cannot be updated.<br />In CamelCase.<br />More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  | Optional: \{\} <br /> |
| `apiVersion` _string_ | APIVersion defines the versioned schema of this representation of an object.<br />Servers should convert recognized schemas to the latest internal value, and<br />may reject unrecognized values.<br />More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  | Optional: \{\} <br /> |
| `metadata` _[ObjectMeta](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#objectmeta-v1-meta)_ | Refer to Kubernetes API documentation for fields of `metadata`. |  | Optional: \{\} <br /> |
| `spec` _[AgentgatewayParametersSpec](#agentgatewayparametersspec)_ | Desired data plane provisioning settings. |  | Required: \{\} <br /> |
| `status` _[AgentgatewayParametersStatus](#agentgatewayparametersstatus)_ | Current status for these provisioning settings. |  | Optional: \{\} <br /> |


#### AgentgatewayParametersConfigs







_Appears in:_
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `logging` _[AgentgatewayParametersLogging](#agentgatewayparameterslogging)_ | Logging configuration. By default, all logs are set to<br />`info` level. |  | Optional: \{\} <br /> |
| `rawConfig` _[JSON](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#json-v1-apiextensions-k8s-io)_ | Raw agentgateway configuration to merge into the generated config file.<br />This is merged with<br />configuration derived from typed fields like `logging.format`, and those<br />typed fields will take precedence.<br />Example:<br />	rawConfig:<br />	  binds:<br />	  - port: 3000<br />	    listeners:<br />	    - routes:<br />	      - policies:<br />	          cors:<br />	            allowOrigins:<br />	            - "*"<br />	            allowHeaders:<br />	            - mcp-protocol-version<br />	            - content-type<br />	            - cache-control<br />	        backends:<br />	        - mcp:<br />	            targets:<br />	            - name: everything<br />	              stdio:<br />	                cmd: npx<br />	                args: ["@modelcontextprotocol/server-everything"] |  | Type: object <br />Optional: \{\} <br /> |
| `image` _[Image](#image)_ | The agentgateway container image. See<br />https://kubernetes.io/docs/concepts/containers/images<br />for details.<br />Default values, which may be overridden individually:<br />	registry: cr.agentgateway.dev<br />	repository: agentgateway<br />	tag: <agentgateway version><br />	pullPolicy: <omitted, relying on Kubernetes defaults which depend on the tag> |  | Optional: \{\} <br /> |
| `env` _[EnvVar](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#envvar-v1-core) array_ | Container environment variables. These override any existing<br />values. If you want to delete an environment variable entirely, use<br />`$patch: delete` with an overlay instead. Note that<br />[variable<br />expansion](https://kubernetes.io/docs/tasks/inject-data-application/define-interdependent-environment-variables/)<br />does apply, but is highly discouraged -- to set dependent environment<br />variables, you can use `$(VAR_NAME)`, but it's highly discouraged.<br />`$$(VAR_NAME)` avoids expansion and results in a literal<br />`$(VAR_NAME)`.<br />If `SESSION_KEY` is specified, it takes precedence over the<br />controller-managed per-`Gateway` session key `Secret`. |  | Optional: \{\} <br /> |
| `resources` _[ResourceRequirements](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#resourcerequirements-v1-core)_ | Compute resources required by this container. See<br />https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/<br />for details. |  | Optional: \{\} <br /> |
| `shutdown` _[ShutdownSpec](#shutdownspec)_ | Shutdown delay configuration. How graceful planned or unplanned data<br />plane changes happen is in tension with how quickly rollouts of the data<br />plane complete. How long a data plane pod must wait for shutdown to be<br />perfectly graceful depends on how you have configured your `Gateway`<br />resources. |  | Optional: \{\} <br /> |
| `istio` _[IstioSpec](#istiospec)_ | Istio integration settings. If enabled, agentgateway can natively connect to Istio-enabled pods with mTLS. |  | Optional: \{\} <br /> |
| `modelCatalog` _[ModelCatalogSpec](#modelcatalogspec)_ | Model cost catalog sources. Only effective when set on a Gateway-level<br />AgentgatewayParameters (via Gateway.spec.infrastructure.parametersRef);<br />ignored on GatewayClass-level parameters because ConfigMap references<br />are resolved from the Gateway's deployment namespace. |  | Optional: \{\} <br /> |


#### AgentgatewayParametersLogging







_Appears in:_
- [AgentgatewayParametersConfigs](#agentgatewayparametersconfigs)
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `level` _string_ | Logging level in standard `RUST_LOG` syntax, for example `info` (the<br />default), or a comma-separated per-module setting such as<br />`rmcp=warn,hickory_server::server::server_future=off,typespec_client_core::http::policies::logging=warn`. |  | Optional: \{\} <br /> |
| `format` _[AgentgatewayParametersLoggingFormat](#agentgatewayparametersloggingformat)_ | Logging output format. |  | Optional: \{\} <br /> |


#### AgentgatewayParametersLoggingFormat

_Underlying type:_ _string_

The default logging format is text.



_Appears in:_
- [AgentgatewayParametersLogging](#agentgatewayparameterslogging)

| Field | Description |
| --- | --- |
| `json` |  |
| `text` |  |


#### AgentgatewayParametersOverlays







_Appears in:_
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `deployment` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Overrides for the generated<br />`Deployment` resource. |  | Optional: \{\} <br /> |
| `service` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Overrides for the generated `Service`<br />resource. |  | Optional: \{\} <br /> |
| `serviceAccount` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Overrides for the generated<br />`ServiceAccount` resource. |  | Optional: \{\} <br /> |
| `podDisruptionBudget` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Creates a `PodDisruptionBudget` for the<br />agentgateway proxy. If absent, no PDB is created. If present, a PDB is<br />created with its selector automatically configured to target the<br />agentgateway proxy `Deployment`. The `metadata` and `spec` fields from<br />this overlay are applied to the generated PDB. |  | Optional: \{\} <br /> |
| `horizontalPodAutoscaler` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Creates a `HorizontalPodAutoscaler`<br />for the agentgateway proxy. If absent, no HPA is created. If present, an<br />HPA is created with its `scaleTargetRef` automatically configured to<br />target the agentgateway proxy `Deployment`. The `metadata` and `spec`<br />fields from this overlay are applied to the generated HPA. |  | Optional: \{\} <br /> |


#### AgentgatewayParametersSpec







_Appears in:_
- [AgentgatewayParameters](#agentgatewayparameters)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `logging` _[AgentgatewayParametersLogging](#agentgatewayparameterslogging)_ | Logging configuration. By default, all logs are set to<br />`info` level. |  | Optional: \{\} <br /> |
| `rawConfig` _[JSON](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#json-v1-apiextensions-k8s-io)_ | Raw agentgateway configuration to merge into the generated config file.<br />This is merged with<br />configuration derived from typed fields like `logging.format`, and those<br />typed fields will take precedence.<br />Example:<br />	rawConfig:<br />	  binds:<br />	  - port: 3000<br />	    listeners:<br />	    - routes:<br />	      - policies:<br />	          cors:<br />	            allowOrigins:<br />	            - "*"<br />	            allowHeaders:<br />	            - mcp-protocol-version<br />	            - content-type<br />	            - cache-control<br />	        backends:<br />	        - mcp:<br />	            targets:<br />	            - name: everything<br />	              stdio:<br />	                cmd: npx<br />	                args: ["@modelcontextprotocol/server-everything"] |  | Type: object <br />Optional: \{\} <br /> |
| `image` _[Image](#image)_ | The agentgateway container image. See<br />https://kubernetes.io/docs/concepts/containers/images<br />for details.<br />Default values, which may be overridden individually:<br />	registry: cr.agentgateway.dev<br />	repository: agentgateway<br />	tag: <agentgateway version><br />	pullPolicy: <omitted, relying on Kubernetes defaults which depend on the tag> |  | Optional: \{\} <br /> |
| `env` _[EnvVar](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#envvar-v1-core) array_ | Container environment variables. These override any existing<br />values. If you want to delete an environment variable entirely, use<br />`$patch: delete` with an overlay instead. Note that<br />[variable<br />expansion](https://kubernetes.io/docs/tasks/inject-data-application/define-interdependent-environment-variables/)<br />does apply, but is highly discouraged -- to set dependent environment<br />variables, you can use `$(VAR_NAME)`, but it's highly discouraged.<br />`$$(VAR_NAME)` avoids expansion and results in a literal<br />`$(VAR_NAME)`.<br />If `SESSION_KEY` is specified, it takes precedence over the<br />controller-managed per-`Gateway` session key `Secret`. |  | Optional: \{\} <br /> |
| `resources` _[ResourceRequirements](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#resourcerequirements-v1-core)_ | Compute resources required by this container. See<br />https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/<br />for details. |  | Optional: \{\} <br /> |
| `shutdown` _[ShutdownSpec](#shutdownspec)_ | Shutdown delay configuration. How graceful planned or unplanned data<br />plane changes happen is in tension with how quickly rollouts of the data<br />plane complete. How long a data plane pod must wait for shutdown to be<br />perfectly graceful depends on how you have configured your `Gateway`<br />resources. |  | Optional: \{\} <br /> |
| `istio` _[IstioSpec](#istiospec)_ | Istio integration settings. If enabled, agentgateway can natively connect to Istio-enabled pods with mTLS. |  | Optional: \{\} <br /> |
| `modelCatalog` _[ModelCatalogSpec](#modelcatalogspec)_ | Model cost catalog sources. Only effective when set on a Gateway-level<br />AgentgatewayParameters (via Gateway.spec.infrastructure.parametersRef);<br />ignored on GatewayClass-level parameters because ConfigMap references<br />are resolved from the Gateway's deployment namespace. |  | Optional: \{\} <br /> |
| `deployment` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Overrides for the generated<br />`Deployment` resource. |  | Optional: \{\} <br /> |
| `service` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Overrides for the generated `Service`<br />resource. |  | Optional: \{\} <br /> |
| `serviceAccount` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Overrides for the generated<br />`ServiceAccount` resource. |  | Optional: \{\} <br /> |
| `podDisruptionBudget` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Creates a `PodDisruptionBudget` for the<br />agentgateway proxy. If absent, no PDB is created. If present, a PDB is<br />created with its selector automatically configured to target the<br />agentgateway proxy `Deployment`. The `metadata` and `spec` fields from<br />this overlay are applied to the generated PDB. |  | Optional: \{\} <br /> |
| `horizontalPodAutoscaler` _[KubernetesResourceOverlay](#kubernetesresourceoverlay)_ | Creates a `HorizontalPodAutoscaler`<br />for the agentgateway proxy. If absent, no HPA is created. If present, an<br />HPA is created with its `scaleTargetRef` automatically configured to<br />target the agentgateway proxy `Deployment`. The `metadata` and `spec`<br />fields from this overlay are applied to the generated HPA. |  | Optional: \{\} <br /> |


#### AgentgatewayParametersStatus



Current status for these provisioning settings.



_Appears in:_
- [AgentgatewayParameters](#agentgatewayparameters)



#### AgentgatewayPolicy









| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `apiVersion` _string_ | `agentgateway.dev/v1alpha1` | | |
| `kind` _string_ | `AgentgatewayPolicy` | | |
| `kind` _string_ | Kind is a string value representing the REST resource this object represents.<br />Servers may infer this from the endpoint the client submits requests to.<br />Cannot be updated.<br />In CamelCase.<br />More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  | Optional: \{\} <br /> |
| `apiVersion` _string_ | APIVersion defines the versioned schema of this representation of an object.<br />Servers should convert recognized schemas to the latest internal value, and<br />may reject unrecognized values.<br />More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  | Optional: \{\} <br /> |
| `metadata` _[ObjectMeta](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#objectmeta-v1-meta)_ | Refer to Kubernetes API documentation for fields of `metadata`. |  | Optional: \{\} <br /> |
| `spec` _[AgentgatewayPolicySpec](#agentgatewaypolicyspec)_ | Desired policy configuration. |  | ExactlyOneOf: [targetRefs targetSelectors] <br />Required: \{\} <br /> |
| `status` _[PolicyStatus](#policystatus)_ | Current policy status. |  | Optional: \{\} <br /> |


#### AgentgatewayPolicySpec





_Validation:_
- ExactlyOneOf: [targetRefs targetSelectors]

_Appears in:_
- [AgentgatewayPolicy](#agentgatewaypolicy)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `targetRefs` _[LocalPolicyTargetReferenceWithSectionName](#localpolicytargetreferencewithsectionname) array_ | Target resources to attach the<br />policy to. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `targetSelectors` _[LocalPolicyTargetSelectorWithSectionName](#localpolicytargetselectorwithsectionname) array_ | Target selectors used to select resources to attach the policy to. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `strategy` _[PolicyStrategy](#policystrategy)_ | Policy merge and conflict resolution strategy.<br />Strategy settings apply to the policy object as a whole. Individual strategy fields may<br />only be valid for specific policy kinds; for example, inheritance is only valid when this<br />policy contains traffic settings. |  | Optional: \{\} <br /> |
| `frontend` _[Frontend](#frontend)_ | Settings for how to handle incoming traffic.<br />A frontend policy can only target a `Gateway`. `Listener` and<br />`ListenerSet` are not valid targets.<br />When multiple policies are selected for a given request, they are merged on a field-level basis, but not a deep<br />merge. For example, policy A sets `tcp` and `tls`, and policy B sets<br />`tls`; the effective policy would be `tcp` from policy A, and `tls` from<br />policy B. |  | Optional: \{\} <br /> |
| `traffic` _[Traffic](#traffic)_ | Settings for how to process traffic.<br />A traffic policy can target a `Gateway` (optionally, with a<br />`sectionName` indicating the listener), `ListenerSet`, or `Route`<br />(optionally, with a `sectionName` indicating the route rule).<br />When multiple policies are selected for a given request, they are merged on a field-level basis, but not a deep<br />merge. Precedence is given to more precise policies: `Gateway` <<br />`Listener` < `Route` < `Route Rule`. For example, policy A sets<br />`timeouts` and `retries`, and policy B sets `retries`; the effective<br />policy would be `timeouts` from policy A, and `retries` from policy B. |  | Optional: \{\} <br /> |
| `backend` _[BackendFull](#backendfull)_ | Settings for how to connect to destination backends.<br />A backend policy can target a `Gateway` (optionally, with a<br />`sectionName` indicating the listener), `ListenerSet`, `Route`<br />(optionally, with a `sectionName` indicating the route rule), or a<br />`Service` or `Backend` (optionally, with a `sectionName` indicating the<br />port for `Service`, or sub-backend for `Backend`).<br />Note that a backend policy applies when connecting to a specific destination backend. Targeting a higher level<br />resource, like `Gateway`, is just a way to easily apply a policy to a<br />group of backends.<br />When multiple policies are selected for a given request, they are merged on a field-level basis, but not a deep<br />merge. Precedence is given to more precise policies: `Gateway` <<br />`Listener` < `Route` < `Route Rule` < `Backend` or `Service`. For<br />example, if a `Gateway` policy sets `tcp` and `tls`, and a `Backend`<br />policy sets `tls`, the effective policy would be `tcp` from the<br />`Gateway`, and `tls` from the `Backend`. |  | Optional: \{\} <br /> |


#### AnthropicConfig



Settings for the [Anthropic](https://platform.claude.com/docs/en/release-notes/overview) LLM provider.



_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `model` _[ShortString](#shortstring)_ | Model name override, such as `gpt-4o-mini`.<br />If unset, the model name is taken from the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### AttributeAdd







_Appears in:_
- [LogTracingAttributes](#logtracingattributes)
- [MetricAttributes](#metricattributes)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[ShortString](#shortstring)_ |  |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `expression` _[CELExpression](#celexpression)_ |  |  | MaxLength: 16384 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### Authorization



Configures CEL-based authorization.



_Appears in:_
- [BackendMCP](#backendmcp)
- [Frontend](#frontend)
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `policy` _[AuthorizationPolicy](#authorizationpolicy)_ | The authorization rule to evaluate.<br />* `Allow`: any matching allow rule allows the request.<br />* `Require`: every require rule must match for the request to be allowed.<br />* `Deny`: any matching deny rule denies the request.<br />A CEL expression that fails to evaluate does not match. Prefer `Require`<br />for deny-by-default behavior.<br />If at least one `Allow` rule is configured, requests are denied unless at<br />least one allow rule matches. |  | Required: \{\} <br /> |
| `action` _[AuthorizationPolicyAction](#authorizationpolicyaction)_ | The effect of this rule when it matches.<br />If unspecified, defaults to `Allow`.<br />`Require` rules are cumulative: all require rules must match. | Allow | Optional: \{\} <br /> |


#### AuthorizationCookieLocation







_Appears in:_
- [AuthorizationExtractionLocation](#authorizationextractionlocation)
- [AuthorizationLocation](#authorizationlocation)
- [AuthorizationLocationFields](#authorizationlocationfields)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _string_ |  |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### AuthorizationExtractionLocation





_Validation:_
- ExactlyOneOf: [header queryParameter cookie expression]

_Appears in:_
- [APIKeyAuthentication](#apikeyauthentication)
- [BasicAuthentication](#basicauthentication)
- [JWTAuthentication](#jwtauthentication)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `header` _[AuthorizationHeaderLocation](#authorizationheaderlocation)_ |  |  | Optional: \{\} <br /> |
| `queryParameter` _[AuthorizationQueryParameterLocation](#authorizationqueryparameterlocation)_ |  |  | Optional: \{\} <br /> |
| `cookie` _[AuthorizationCookieLocation](#authorizationcookielocation)_ |  |  | Optional: \{\} <br /> |
| `expression` _[CELExpression](#celexpression)_ | CEL expression that extracts the credential from the request. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### AuthorizationHeaderLocation







_Appears in:_
- [AuthorizationExtractionLocation](#authorizationextractionlocation)
- [AuthorizationLocation](#authorizationlocation)
- [AuthorizationLocationFields](#authorizationlocationfields)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[HTTPHeaderName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#httpheadername)_ |  |  | MaxLength: 256 <br />MinLength: 1 <br />Pattern: `^[A-Za-z0-9!#$%&'*+\-.^_\x60\|~]+$` <br />Required: \{\} <br /> |
| `prefix` _string_ |  |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### AuthorizationLocation





_Validation:_
- ExactlyOneOf: [header queryParameter cookie]

_Appears in:_
- [BackendAuth](#backendauth)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `header` _[AuthorizationHeaderLocation](#authorizationheaderlocation)_ |  |  | Optional: \{\} <br /> |
| `queryParameter` _[AuthorizationQueryParameterLocation](#authorizationqueryparameterlocation)_ |  |  | Optional: \{\} <br /> |
| `cookie` _[AuthorizationCookieLocation](#authorizationcookielocation)_ |  |  | Optional: \{\} <br /> |


#### AuthorizationLocationFields







_Appears in:_
- [AuthorizationExtractionLocation](#authorizationextractionlocation)
- [AuthorizationLocation](#authorizationlocation)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `header` _[AuthorizationHeaderLocation](#authorizationheaderlocation)_ |  |  | Optional: \{\} <br /> |
| `queryParameter` _[AuthorizationQueryParameterLocation](#authorizationqueryparameterlocation)_ |  |  | Optional: \{\} <br /> |
| `cookie` _[AuthorizationCookieLocation](#authorizationcookielocation)_ |  |  | Optional: \{\} <br /> |


#### AuthorizationPolicy



Defines CEL expressions for a single authorization rule.



_Appears in:_
- [Authorization](#authorization)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `matchExpressions` _[CELExpression](#celexpression) array_ | CEL expressions that must all evaluate to true for the rule to match. |  | MaxItems: 256 <br />MaxLength: 16384 <br />MinItems: 1 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### AuthorizationPolicyAction

_Underlying type:_ _string_

AuthorizationPolicyAction defines the action to take when the
`RBACPolicies` matches.



_Appears in:_
- [Authorization](#authorization)

| Field | Description |
| --- | --- |
| `Allow` | AuthorizationPolicyActionAllow defines the action to take when the<br />`RBACPolicies` matches.<br /> |
| `Deny` | AuthorizationPolicyActionDeny denies the action to take when the<br />`RBACPolicies` matches.<br /> |
| `Require` | AuthorizationPolicyActionRequire requires the action to take when the RBACPolicies matches.<br /> |


#### AuthorizationQueryParameterLocation







_Appears in:_
- [AuthorizationExtractionLocation](#authorizationextractionlocation)
- [AuthorizationLocation](#authorizationlocation)
- [AuthorizationLocationFields](#authorizationlocationfields)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _string_ |  |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### AwsAgentCoreBackend



Configures Amazon Bedrock AgentCore.



_Appears in:_
- [AwsBackend](#awsbackend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `agentRuntimeArn` _string_ | ARN of the AgentCore runtime. |  | Required: \{\} <br /> |
| `qualifier` _string_ | Alias or version qualifier. |  | Optional: \{\} <br /> |


#### AwsAssumeRole



AWS STS AssumeRole settings for backend authentication.



_Appears in:_
- [AwsAuth](#awsauth)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `roleArn` _string_ | AWS IAM role ARN to assume. |  | MinLength: 1 <br />Pattern: `^arn:aws[a-z-]*:iam::[0-9]\{12\}:role/.+$` <br />Required: \{\} <br /> |


#### AwsAuth



AWS authentication settings for the backend.



_Appears in:_
- [BackendAuth](#backendauth)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `secretRef` _[LocalSecretObjectRef](#localsecretobjectref)_ | Credential source, defaulting to a Kubernetes<br />`Secret`, containing the AWS credentials. When using the default Secret<br />resolver, the `Secret` must have keys `accessKey`, `secretKey`, and<br />optionally `sessionToken`. |  | Optional: \{\} <br /> |
| `assumeRole` _[AwsAssumeRole](#awsassumerole)_ | AWS STS AssumeRole settings to use before signing backend requests.<br />Ambient AWS credentials are used as the source credentials for STS. |  | Optional: \{\} <br /> |
| `serviceName` _[ShortString](#shortstring)_ | AWS SigV4 signing service name, for example<br />`bedrock`, `bedrock-agentcore`, or `execute-api`). If unset, typed AWS<br />backends may provide this automatically. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### AwsBackend



Configures an AWS service backend.

_Validation:_
- ExactlyOneOf: [agentCore]

_Appears in:_
- [AgentgatewayBackendSpec](#agentgatewaybackendspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `agentCore` _[AwsAgentCoreBackend](#awsagentcorebackend)_ | Amazon Bedrock AgentCore backend settings. |  | Optional: \{\} <br /> |


#### AzureAuth







_Appears in:_
- [BackendAuth](#backendauth)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `secretRef` _[LocalSecretObjectRef](#localsecretobjectref)_ | Credential source, defaulting to a Kubernetes<br />`Secret`, containing the Azure credentials. When using the default Secret<br />resolver, the `Secret` must have keys `clientID`, `tenantID`, and<br />`clientSecret`. |  | Optional: \{\} <br /> |
| `managedIdentity` _[AzureManagedIdentity](#azuremanagedidentity)_ | Managed identity authentication settings. |  | Optional: \{\} <br /> |


#### AzureConfig



Settings for Azure AI backends, supporting both Azure OpenAI and Azure AI Foundry.



_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `resourceName` _[ShortString](#shortstring)_ | The Azure resource name used to construct the endpoint host.<br />For OpenAI: \{resourceName\}.openai.azure.com<br />For Foundry: \{resourceName\}.services.ai.azure.com<br />Note: when the Azure portal "Foundry legacy" template was used, the<br />generated resource name may end in "-resource" (e.g. "myproject-resource");<br />that suffix is part of the resource name as the user configured it, not<br />part of the hostname suffix agentgateway should append. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `resourceType` _[AzureResourceType](#azureresourcetype)_ | The type of Azure endpoint. Determines the host suffix. |  | Required: \{\} <br /> |
| `model` _[ShortString](#shortstring)_ | Model name override, such as `gpt-4o-mini`.<br />If unset, the model name is taken from the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `apiVersion` _[TinyString](#tinystring)_ | The version of the Azure OpenAI API to use.<br />If unset, defaults to `v1`. |  | MaxLength: 64 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `projectName` _[ShortString](#shortstring)_ | The Foundry project name, required when `resourceType` is `Foundry`.<br />Used to construct paths: /api/projects/\{projectName\}/openai/v1/... |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### AzureManagedIdentity







_Appears in:_
- [AzureAuth](#azureauth)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `clientId` _string_ |  |  | Required: \{\} <br /> |
| `objectId` _string_ |  |  | Required: \{\} <br /> |
| `resourceId` _string_ |  |  | Required: \{\} <br /> |


#### AzureOpenAIConfig



Settings for the [Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/?view=foundry-classic) LLM provider.



_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `endpoint` _[ShortString](#shortstring)_ | The endpoint for the Azure OpenAI API to use, such as `my-endpoint.openai.azure.com`.<br />If the scheme is included, it is stripped. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `deploymentName` _[ShortString](#shortstring)_ | The name of the Azure OpenAI model deployment to use.<br />For more information, see the [Azure OpenAI model docs](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure?view=foundry-classic).<br />This is required if `apiVersion` is not `v1`. For `v1`, the model can be<br />set in the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `apiVersion` _[TinyString](#tinystring)_ | The version of the Azure OpenAI API to use.<br />For more information, see the [Azure OpenAI API version reference](https://learn.microsoft.com/en-us/azure/foundry/openai/reference).<br />If unset, defaults to `v1`. |  | MaxLength: 64 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### AzureResourceType

_Underlying type:_ _string_

Type of Azure endpoint.



_Appears in:_
- [AzureConfig](#azureconfig)

| Field | Description |
| --- | --- |
| `OpenAI` | AzureResourceTypeOpenAI uses the Azure OpenAI endpoint: \{resourceName\}.openai.azure.com<br /> |
| `Foundry` | AzureResourceTypeFoundry uses the Azure AI Foundry endpoint: \{resourceName\}.services.ai.azure.com<br /> |


#### BackendAI







_Appears in:_
- [BackendFull](#backendfull)
- [BackendWithAI](#backendwithai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `prompt` _[AIPromptEnrichment](#aipromptenrichment)_ | Enriches requests sent to the LLM provider by appending and prepending system prompts. This can be configured only for<br />LLM providers that use the `CHAT` or `CHAT_STREAMING` API route type. |  | Optional: \{\} <br /> |
| `promptGuard` _[AIPromptGuard](#aipromptguard)_ | Guardrails for LLM requests and responses. |  | Optional: \{\} <br /> |
| `defaults` _[FieldDefault](#fielddefault) array_ | Defaults to merge with user input fields. If the field is already set, the field in the request is used. |  | MaxItems: 64 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `overrides` _[FieldDefault](#fielddefault) array_ | Overrides to merge with user input fields. If the field is already set, the field is overwritten. |  | MaxItems: 64 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `transformations` _[FieldTransformation](#fieldtransformation) array_ | CEL transformations to compute and set fields in the request body.<br />The expression result overwrites any existing value for that field.<br />This has a higher priority than `overrides` if both are set for the same<br />key. |  | MaxItems: 64 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `modelAliases` _object (keys:string, values:string)_ | Maps friendly model names to actual provider model names.<br />Example: `\{"fast": "gpt-3.5-turbo", "smart": "gpt-4-turbo"\}`.<br />Note: This field is only applicable when using the agentgateway data plane. |  | MaxProperties: 64 <br />Optional: \{\} <br /> |
| `promptCaching` _[PromptCachingConfig](#promptcachingconfig)_ | Automatic prompt caching for supported<br />providers, currently AWS Bedrock.<br />Reduces API costs by caching static content like system prompts and tool definitions.<br />Only applicable for Bedrock Claude 3+ and Nova models. |  | Optional: \{\} <br /> |
| `routes` _object (keys:string, values:[RouteType](#routetype))_ | Rules for identifying the type of traffic to handle.<br />The keys are URL path suffixes matched using ends-with comparison, for<br />example `"/v1/chat/completions"`.<br />The special `*` wildcard matches any path.<br />If not specified, all traffic defaults to `completions` type. |  | Optional: \{\} <br /> |


#### BackendAuth





_Validation:_
- ExactlyOneOf: [key secretRef passthrough aws azure gcp]

_Appears in:_
- [BackendFull](#backendfull)
- [BackendSimple](#backendsimple)
- [BackendWithAI](#backendwithai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `key` _string_ | Inline key to use as the value of the<br />`Authorization` header. This option is the least secure; usage of a<br />`Secret` is preferred. |  | MaxLength: 2048 <br />Optional: \{\} <br /> |
| `secretRef` _[LocalSecretObjectRef](#localsecretobjectref)_ | Credential source, defaulting to a Kubernetes<br />`Secret`, storing the key to use as the authorization value. When using<br />the default Secret resolver, this must be stored in the `Authorization`<br />key. |  | Optional: \{\} <br /> |
| `passthrough` _[BackendAuthPassthrough](#backendauthpassthrough)_ | Passes through an existing token that has been sent by the<br />client and validated. Other policies, like JWT and API key<br />authentication, will strip the original client credentials. Passthrough backend authentication<br />causes the original token to be added back into the request. If there are no client authentication policies on the<br />request, the original token would be unchanged, so this would have no effect. |  | Optional: \{\} <br /> |
| `aws` _[AwsAuth](#awsauth)_ | Explicit AWS authentication method for the backend.<br />When omitted, default AWS SDK credential discovery is used. |  | Optional: \{\} <br /> |
| `azure` _[AzureAuth](#azureauth)_ | Azure authentication method for the backend. |  | Optional: \{\} <br /> |
| `gcp` _[GcpAuth](#gcpauth)_ | Google authentication method for the backend.<br />When omitted, default Google credential discovery is used. |  | Optional: \{\} <br /> |
| `location` _[AuthorizationLocation](#authorizationlocation)_ | Where backend credentials are inserted.<br />If omitted, credentials are written to the `Authorization` header with the `Bearer ` prefix.<br />This applies to `key`, `secretRef`, and `passthrough`. |  | ExactlyOneOf: [header queryParameter cookie] <br />Optional: \{\} <br /> |


#### BackendAuthPassthrough







_Appears in:_
- [BackendAuth](#backendauth)



#### BackendEviction



Settings for evicting unhealthy backends.



_Appears in:_
- [Health](#health)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `duration` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Base time a backend should be evicted after being marked unhealthy.<br />Subsequent evictions use multiplicative backoff (duration * times_evicted).<br />If all endpoints are evicted, the load balancer falls back to returning evicted endpoints<br />rather than failing entirely.<br />If unset, defaults to `3s`. | 3s | Optional: \{\} <br /> |
| `restoreHealth` _integer_ | Health score from 0 to 100 assigned to a backend when it returns from eviction.<br />For gradual recovery, set below 100; for full recovery immediately, set 100.<br />If unset, the backend resumes with the health it had when evicted. |  | Maximum: 100 <br />Minimum: 0 <br />Optional: \{\} <br /> |
| `consecutiveFailures` _integer_ | Number of consecutive unhealthy responses required before the backend is evicted.<br />For example, a value of 5 means the backend must receive 5 unhealthy responses in a row before being evicted.<br />When both consecutiveFailures and healthThreshold are set, the backend is evicted when either condition is met.<br />When neither is set, a single unhealthy response can trigger eviction. |  | Minimum: 0 <br />Optional: \{\} <br /> |
| `healthThreshold` _integer_ | EWMA health score threshold, expressed as 0 to 100.<br />When set, a backend is only evicted if its computed health drops below this value after an unhealthy response.<br />For example, 50 means the backend is evicted when its EWMA health falls below 50% following failures.<br />Unlike consecutiveFailures (which counts consecutive failures), this uses a sliding-window average<br />so a single success in a stream of failures can delay eviction.<br />When both consecutiveFailures and healthThreshold are set, the backend is evicted when either condition is met.<br />When neither is set, a single unhealthy response triggers eviction. |  | Maximum: 100 <br />Minimum: 0 <br />Optional: \{\} <br /> |


#### BackendFull







_Appears in:_
- [AgentgatewayBackendSpec](#agentgatewaybackendspec)
- [AgentgatewayPolicySpec](#agentgatewaypolicyspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `tcp` _[BackendTCP](#backendtcp)_ | Settings for managing TCP connections to the backend. |  | Optional: \{\} <br /> |
| `tls` _[BackendTLS](#backendtls)_ | Settings for managing TLS connections to the backend.<br />If this field is set, TLS will be initiated to the backend; the system trusted CA certificates will be used to<br />validate the server, and the SNI will automatically be set based on the destination. |  | AtMostOneOf: [verifySubjectAltNames insecureSkipVerify] <br />Optional: \{\} <br /> |
| `http` _[BackendHTTP](#backendhttp)_ | Settings for managing HTTP requests to the backend. |  | Optional: \{\} <br /> |
| `tunnel` _[BackendTunnel](#backendtunnel)_ | Settings for managing tunnel connections, with behavior like `HTTPS_PROXY`, to the backend. |  | Optional: \{\} <br /> |
| `auth` _[BackendAuth](#backendauth)_ | Settings for managing authentication to the backend. |  | ExactlyOneOf: [key secretRef passthrough aws azure gcp] <br />Optional: \{\} <br /> |
| `ai` _[BackendAI](#backendai)_ | Settings for AI workloads. This is only applicable when<br />connecting to a `Backend` of type `ai`. |  | Optional: \{\} <br /> |
| `mcp` _[BackendMCP](#backendmcp)_ | Settings for MCP workloads. This is only applicable when<br />connecting to a `Backend` of type `mcp`. |  | Optional: \{\} <br /> |
| `transformation` _[Transformation](#transformation)_ | Mutates and transforms requests and responses sent to and from the backend. |  | Optional: \{\} <br /> |
| `health` _[Health](#health)_ | Settings for passive and active health checking. |  | Optional: \{\} <br /> |
| `extAuth` _[ExtAuth](#extauth)_ | External authentication configuration for requests<br />sent to this backend. |  | Optional: \{\} <br /> |


#### BackendHTTP







_Appears in:_
- [BackendFull](#backendfull)
- [BackendSimple](#backendsimple)
- [BackendWithAI](#backendwithai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `version` _[HTTPVersion](#httpversion)_ | HTTP protocol version to use when connecting to<br />the backend.<br />If not specified, the version is automatically determined:<br />* `Service` types can specify it with `appProtocol` on the `Service`<br />  port.<br />* If traffic is identified as gRPC, `HTTP2` is used.<br />* If the incoming traffic was plaintext HTTP, the original protocol will<br />  be used.<br />* If the incoming traffic was HTTPS, `HTTP1` will be used. This is<br />  because most clients will transparently upgrade HTTPS traffic to<br />  `HTTP2`, even if the backend doesn't support it. |  | Optional: \{\} <br /> |
| `requestTimeout` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Deadline for receiving a response from the backend. |  | Optional: \{\} <br /> |


#### BackendMCP







_Appears in:_
- [BackendFull](#backendfull)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `authorization` _[Authorization](#authorization)_ | MCP backend authorization. Unlike authorization at the HTTP level, which rejects<br />unauthorized requests with a `403` error, this policy works at the<br />`MCPBackend` level.<br />List operations, such as `list_tools`, will have each item evaluated.<br />Items that do not meet the rule will be filtered.<br />Get or call operations, such as `call_tool`, will evaluate the specific<br />item and reject requests that do not meet the rule. |  | Optional: \{\} <br /> |
| `authentication` _[MCPAuthentication](#mcpauthentication)_ | MCP backend-specific authentication rules.<br />This field is deprecated; prefer to use traffic policy `jwtAuthentication.mcp`, which ensures authentication runs before<br />other policies such as transformation and rate limiting. |  | Optional: \{\} <br /> |
| `guardrails` _[MCPGuardrails](#mcpguardrails)_ | `guardrails` routes selected JSON-RPC methods through a remote policy server. |  | Optional: \{\} <br /> |


#### BackendSimple







_Appears in:_
- [BackendFull](#backendfull)
- [BackendWithAI](#backendwithai)
- [BedrockGuardrails](#bedrockguardrails)
- [GoogleModelArmor](#googlemodelarmor)
- [McpTarget](#mcptarget)
- [OpenAIModeration](#openaimoderation)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `tcp` _[BackendTCP](#backendtcp)_ | Settings for managing TCP connections to the backend. |  | Optional: \{\} <br /> |
| `tls` _[BackendTLS](#backendtls)_ | Settings for managing TLS connections to the backend.<br />If this field is set, TLS will be initiated to the backend; the system trusted CA certificates will be used to<br />validate the server, and the SNI will automatically be set based on the destination. |  | AtMostOneOf: [verifySubjectAltNames insecureSkipVerify] <br />Optional: \{\} <br /> |
| `http` _[BackendHTTP](#backendhttp)_ | Settings for managing HTTP requests to the backend. |  | Optional: \{\} <br /> |
| `tunnel` _[BackendTunnel](#backendtunnel)_ | Settings for managing tunnel connections, with behavior like `HTTPS_PROXY`, to the backend. |  | Optional: \{\} <br /> |
| `auth` _[BackendAuth](#backendauth)_ | Settings for managing authentication to the backend. |  | ExactlyOneOf: [key secretRef passthrough aws azure gcp] <br />Optional: \{\} <br /> |


#### BackendTCP







_Appears in:_
- [BackendFull](#backendfull)
- [BackendSimple](#backendsimple)
- [BackendWithAI](#backendwithai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `keepalive` _[Keepalive](#keepalive)_ | Settings for enabling TCP keepalives on the<br />connection. |  | Optional: \{\} <br /> |
| `connectTimeout` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Deadline for establishing a connection to<br />the destination. |  | Optional: \{\} <br /> |


#### BackendTLS





_Validation:_
- AtMostOneOf: [verifySubjectAltNames insecureSkipVerify]

_Appears in:_
- [BackendFull](#backendfull)
- [BackendSimple](#backendsimple)
- [BackendWithAI](#backendwithai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `mtlsCertificateRef` _[LocalSecretObjectRef](#localsecretobjectref) array_ | Enables mutual TLS to the backend, using the<br />specified key (`tls.key`) and cert (`tls.crt`) from the referenced<br />credential source, defaulting to a Kubernetes `Secret`.<br />An optional `ca.cert` field, if present, will be used to verify the<br />server certificate. If `caCertificateRefs` is also specified, the<br />`caCertificateRefs` field takes priority.<br />If unspecified, no client certificate will be used. |  | MaxItems: 1 <br />Optional: \{\} <br /> |
| `caCertificateRefs` _[LocalObjectReference](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#localobjectreference-v1-core) array_ | CA certificate `ConfigMap` to use to<br />verify the server certificate.<br />If unset, the system's trusted certificates are used. |  | MaxItems: 1 <br />Optional: \{\} <br /> |
| `insecureSkipVerify` _[InsecureTLSMode](#insecuretlsmode)_ | Originates TLS but skips verification of the backend's certificate.<br />WARNING: This is an insecure option that should only be used if the risks are understood.<br />There are two modes:<br />* `All` disables all TLS verification.<br />* `Hostname` verifies the CA certificate is trusted, but ignores any<br />  mismatch of hostname or SANs. Note that this method is still insecure;<br />  prefer setting `verifySubjectAltNames` to customize the valid hostnames<br />  if possible. |  | Optional: \{\} <br /> |
| `sni` _[SNI](#sni)_ | Server Name Indicator (`SNI`) to use in the TLS<br />handshake. If unset, the `SNI` is automatically set based on the<br />destination hostname. |  | MaxLength: 253 <br />MinLength: 1 <br />Pattern: `^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` <br />Optional: \{\} <br /> |
| `verifySubjectAltNames` _[ShortString](#shortstring) array_ | Subject Alternative Names (`SAN`)<br />to verify in the server certificate.<br />If not present, the destination hostname is automatically used. |  | MaxItems: 16 <br />MaxLength: 256 <br />MinItems: 1 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `alpnProtocols` _[TinyString](#tinystring)_ | Application-Layer Protocol Negotiation (`ALPN`)<br />value to use in the TLS handshake.<br />If not present, defaults to `["h2", "http/1.1"]`. |  | MaxItems: 16 <br />MaxLength: 64 <br />MinItems: 1 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `keyExchangeGroups` _[KeyExchangeGroup](#keyexchangegroup) array_ | Ordered list of key exchange groups for a TLS connection.<br />For example: `X25519_MLKEM768,X25519`. |  | Optional: \{\} <br /> |


#### BackendTunnel







_Appears in:_
- [BackendFull](#backendfull)
- [BackendSimple](#backendsimple)
- [BackendWithAI](#backendwithai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | Proxy server to reach.<br />Supported types: `Service` and `Backend`. |  | Required: \{\} <br /> |


#### BackendWithAI







_Appears in:_
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `tcp` _[BackendTCP](#backendtcp)_ | Settings for managing TCP connections to the backend. |  | Optional: \{\} <br /> |
| `tls` _[BackendTLS](#backendtls)_ | Settings for managing TLS connections to the backend.<br />If this field is set, TLS will be initiated to the backend; the system trusted CA certificates will be used to<br />validate the server, and the SNI will automatically be set based on the destination. |  | AtMostOneOf: [verifySubjectAltNames insecureSkipVerify] <br />Optional: \{\} <br /> |
| `http` _[BackendHTTP](#backendhttp)_ | Settings for managing HTTP requests to the backend. |  | Optional: \{\} <br /> |
| `tunnel` _[BackendTunnel](#backendtunnel)_ | Settings for managing tunnel connections, with behavior like `HTTPS_PROXY`, to the backend. |  | Optional: \{\} <br /> |
| `auth` _[BackendAuth](#backendauth)_ | Settings for managing authentication to the backend. |  | ExactlyOneOf: [key secretRef passthrough aws azure gcp] <br />Optional: \{\} <br /> |
| `ai` _[BackendAI](#backendai)_ | Settings for AI workloads. This is only applicable when<br />connecting to a `Backend` of type `ai`. |  | Optional: \{\} <br /> |
| `transformation` _[Transformation](#transformation)_ | Mutates and transforms requests and responses sent to and from the backend. |  | Optional: \{\} <br /> |
| `health` _[Health](#health)_ | Settings for passive and active health checking. |  | Optional: \{\} <br /> |


#### BasicAuthentication





_Validation:_
- ExactlyOneOf: [users secretRef]

_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `mode` _[BasicAuthenticationMode](#basicauthenticationmode)_ | Validation mode for basic authentication. | Strict | Optional: \{\} <br /> |
| `realm` _string_ | `realm` value to return in the `WWW-Authenticate`<br />header for failed authentication requests. If unset, `Restricted` will<br />be used. |  | Optional: \{\} <br /> |
| `users` _string array_ | Inline list of username and password pairs that will<br />be accepted. Each entry represents one line of the `htpasswd` format:<br />https://httpd.apache.org/docs/2.4/programs/htpasswd.html.<br />Note: passwords should be the hash of the password, not the raw password. Use the `htpasswd` or similar commands<br />to generate a hash. MD5, bcrypt, crypt, and SHA-1 are supported.<br />Example:<br />	users:<br />	- "user1:$apr1$ivPt0D4C$DmRhnewfHRSrb3DQC.WHC."<br />	- "user2:$2y$05$r3J4d3VepzFkedkd/q1vI.pBYIpSqjfN0qOARV3ScUHysatnS0cL2" |  | MaxItems: 256 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `secretRef` _[LocalSecretObjectRef](#localsecretobjectref)_ | Credential source, defaulting to a Kubernetes<br />`Secret`, storing the `.htaccess` file. When using the default Secret<br />resolver, the `Secret` must have a key named `.htaccess`, and should<br />contain the complete `.htaccess` file.<br />Note: passwords should be the hash of the password, not the raw password. Use the `htpasswd` or similar commands<br />to generate a hash. MD5, bcrypt, crypt, and SHA-1 are supported.<br />Example:<br />	apiVersion: v1<br />	kind: Secret<br />	metadata:<br />	  name: basic-auth<br />	stringData:<br />	  .htaccess: \|<br />	    alice:$apr1$3zSE0Abt$IuETi4l5yO87MuOrbSE4V.<br />	    bob:$apr1$Ukb5LgRD$EPY2lIfY.A54jzLELNIId/ |  | Optional: \{\} <br /> |
| `location` _[AuthorizationExtractionLocation](#authorizationextractionlocation)_ | Where Basic credentials are read from.<br />If omitted, credentials are read from the `Authorization` header with the `Basic ` prefix. |  | ExactlyOneOf: [header queryParameter cookie expression] <br />Optional: \{\} <br /> |


#### BasicAuthenticationMode

_Underlying type:_ _string_





_Appears in:_
- [BasicAuthentication](#basicauthentication)

| Field | Description |
| --- | --- |
| `Strict` | A valid username and password must be present.<br />This is the default option.<br /> |
| `Optional` | If a username and password exists, validate it.<br />Warning: this allows requests without a username!<br /> |


#### BedrockConfig







_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `region` _string_ | AWS region to use for the backend.<br />Defaults to `us-east-1` if not specified. | us-east-1 | MaxLength: 63 <br />MinLength: 1 <br />Pattern: `^[a-z0-9-]+$` <br />Optional: \{\} <br /> |
| `model` _[ShortString](#shortstring)_ | Model name override, such as `gpt-4o-mini`.<br />If unset, the model name is taken from the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `guardrail` _[AWSGuardrailConfig](#awsguardrailconfig)_ | Guardrail policy to use for the backend. See<br /><https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html>.<br />If not specified, the AWS Guardrail policy will not be used. |  | Optional: \{\} <br /> |


#### BedrockGuardrails







_Appears in:_
- [PromptguardRequest](#promptguardrequest)
- [PromptguardResponse](#promptguardresponse)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `identifier` _[ShortString](#shortstring)_ | Identifier of the Guardrail policy to use for the backend. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `version` _[ShortString](#shortstring)_ | Version of the Guardrail policy to use for the backend. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `region` _[ShortString](#shortstring)_ | AWS region where the guardrail is deployed, for example<br />`us-west-2`). |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `policies` _[BackendSimple](#backendsimple)_ | Policies for communicating with AWS Bedrock Guardrails. |  | Optional: \{\} <br /> |


#### BodySendMode

_Underlying type:_ _string_

How HTTP bodies are delivered to the external processor.

_Validation:_
- Enum: [None Buffered BufferedPartial FullDuplexStreamed]

_Appears in:_
- [ProcessingOptions](#processingoptions)

| Field | Description |
| --- | --- |
| `None` | BodySendModeNone does not send the body to the external processor.<br /> |
| `Buffered` | BodySendModeBuffered buffers the full body before sending it to the<br />external processor. It returns an error if the body exceeds 8KB.<br /> |
| `BufferedPartial` | BodySendModeBufferedPartial buffers up to 8KB. If the body exceeds that<br />limit, it sends the buffered prefix instead of returning an error.<br /> |
| `FullDuplexStreamed` | BodySendModeFullDuplexStreamed streams the body to the external processor.<br /> |


#### Buffer







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `request` _[BufferBody](#bufferbody)_ | Request body buffering settings. |  | Optional: \{\} <br /> |
| `response` _[BufferBody](#bufferbody)_ | Response body buffering settings. |  | Optional: \{\} <br /> |


#### BufferBody







_Appears in:_
- [Buffer](#buffer)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `maxBytes` _[ByteSize](#bytesize)_ | Maximum number of bytes to buffer from the request or response body.<br />If unset, defaults to the global proxy setting, which defaults to 2Mi. |  | MaxLength: 32 <br />MinLength: 1 <br />Pattern: `^[+-]?([0-9]+(\.[0-9]*)?\|\.[0-9]+)(([KMGTPE]i)\|[numkMGTPE]\|[eE](\+?0*([0-9]\|1[0-8])\|-0*[0-9]))?$` <br />XIntOrString: \{\} <br />Optional: \{\} <br /> |


#### BuiltIn

_Underlying type:_ _string_

Built-in regex patterns for specific types of strings in prompts.
For example, if you specify `CreditCard`, any credit card numbers
in the request or response are matched.



_Appears in:_
- [Regex](#regex)

| Field | Description |
| --- | --- |
| `Ssn` | Default regex matching for Social Security numbers.<br /> |
| `CreditCard` | Default regex matching for credit card numbers.<br /> |
| `PhoneNumber` | Default regex matching for phone numbers.<br /> |
| `Email` | Default regex matching for email addresses.<br /> |
| `CaSin` | Default regex matching for Canadian Social Insurance Numbers.<br /> |


#### ByteSize



Byte quantity that must fit in the data plane size limit.

_Validation:_
- MaxLength: 32
- MinLength: 1
- Pattern: `^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)(([KMGTPE]i)|[numkMGTPE]|[eE](\+?0*([0-9]|1[0-8])|-0*[0-9]))?$`
- XIntOrString: {}

_Appears in:_
- [BufferBody](#bufferbody)
- [ExtAuthBody](#extauthbody)
- [FrontendHTTP](#frontendhttp)



#### CELExpression

_Underlying type:_ _string_

A Common Expression Language (CEL) expression.

_Validation:_
- MaxLength: 16384
- MinLength: 1

_Appears in:_
- [AccessLog](#accesslog)
- [AgentExtAuthGRPC](#agentextauthgrpc)
- [AgentExtAuthHTTP](#agentextauthhttp)
- [AttributeAdd](#attributeadd)
- [AuthorizationExtractionLocation](#authorizationextractionlocation)
- [AuthorizationPolicy](#authorizationpolicy)
- [DirectResponse](#directresponse)
- [DirectResponseConditional](#directresponseconditional)
- [DirectResponseHeader](#directresponseheader)
- [DirectResponseOrConditional](#directresponseorconditional)
- [ExtAuthCache](#extauthcache)
- [ExtAuthConditional](#extauthconditional)
- [ExtProcConditional](#extprocconditional)
- [FieldTransformation](#fieldtransformation)
- [HeaderTransformation](#headertransformation)
- [Health](#health)
- [MCPGuardrailsRemote](#mcpguardrailsremote)
- [RateLimitDescriptor](#ratelimitdescriptor)
- [RateLimitDescriptorEntry](#ratelimitdescriptorentry)
- [RateLimitsConditional](#ratelimitsconditional)
- [ResourceAdd](#resourceadd)
- [Retry](#retry)
- [Tracing](#tracing)
- [Transform](#transform)
- [TransformationConditional](#transformationconditional)



#### CORS







_Appears in:_
- [Traffic](#traffic)



#### CSRF







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `additionalOrigins` _[ShortString](#shortstring) array_ | Additional source origins that will be<br />allowed in addition to the destination origin. The `Origin` consists of<br />a scheme and a host, with an optional port, and takes the form<br />`<scheme>://<host>(:<port>)`. |  | MaxItems: 16 <br />MaxLength: 256 <br />MinItems: 1 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### CipherSuite

_Underlying type:_ _string_





_Appears in:_
- [FrontendTLS](#frontendtls)

| Field | Description |
| --- | --- |
| `TLS13_AES_256_GCM_SHA384` | TLS 1.3 cipher suites<br /> |
| `TLS13_AES_128_GCM_SHA256` |  |
| `TLS13_CHACHA20_POLY1305_SHA256` |  |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | TLS 1.2 cipher suites<br /> |
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` |  |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256` |  |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` |  |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` |  |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256` |  |






#### CustomProvider



Provider with explicit API format support and an explicit target.
Use this for local, self-hosted, or OpenAI-compatible providers whose
supported request/response formats are not fully described by the managed
provider types.



_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[LocalBackendObjectReference](#localbackendobjectreference)_ | Kubernetes backend that serves this provider.<br />`backendRef` may target only a namespace-local Service or InferencePool.<br />If unset, host and port must be set on the parent provider. |  | Optional: \{\} <br /> |
| `model` _[ShortString](#shortstring)_ | Model name override, such as `gpt-oss`.<br />If unset, the model name is taken from the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `formats` _[ProviderFormatConfig](#providerformatconfig) array_ | Provider-native API formats this provider supports. |  | MaxItems: 6 <br />MinItems: 1 <br />Required: \{\} <br /> |


#### CustomResponse



Response to return to the client if request content
is matched against a regex pattern and the action is `REJECT`.



_Appears in:_
- [PromptguardRequest](#promptguardrequest)
- [PromptguardResponse](#promptguardresponse)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `message` _string_ | Custom response message to return to the client. If not specified, defaults to<br />`The request was rejected due to inappropriate content`. | The request was rejected due to inappropriate content | Optional: \{\} <br /> |
| `statusCode` _integer_ | Status code to return to the client. Defaults to 403. | 403 | Maximum: 599 <br />Minimum: 200 <br />Optional: \{\} <br /> |


#### DirectResponse



Direct response policy.



_Appears in:_
- [DirectResponseConditional](#directresponseconditional)
- [DirectResponseOrConditional](#directresponseorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `status` _integer_ | HTTP status code to return. |  | Maximum: 599 <br />Minimum: 200 <br />Optional: \{\} <br /> |
| `body` _string_ | Content to return in the HTTP response body.<br />The maximum length of the body is restricted to prevent excessively large responses.<br />If this field is omitted, no body is included in the response. |  | MaxLength: 4096 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `bodyExpression` _[CELExpression](#celexpression)_ | CEL expression that produces the HTTP response body.<br />Strings and bytes are written directly; other values are serialized as JSON.<br />If this field is omitted, no expression body is included in the response. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `headers` _[DirectResponseHeader](#directresponseheader) array_ | Response headers to set on the direct response. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### DirectResponseConditional







_Appears in:_
- [DirectResponseOrConditional](#directresponseorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `condition` _[CELExpression](#celexpression)_ | CEL expression that must evaluate to true for this policy to execute. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `policy` _[DirectResponse](#directresponse)_ | Policy to apply when the condition matches. |  | Required: \{\} <br /> |


#### DirectResponseHeader







_Appears in:_
- [DirectResponse](#directresponse)
- [DirectResponseOrConditional](#directresponseorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[HTTPHeaderName](#httpheadername)_ | The name of the header to set. |  | MaxLength: 256 <br />MinLength: 1 <br />Pattern: `^[A-Za-z0-9!#$%&'*+\-.^_\x60\|~]+$` <br />Required: \{\} <br /> |
| `value` _[CELExpression](#celexpression)_ | CEL expression that generates the output value for<br />the header. |  | MaxLength: 16384 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### DirectResponseOrConditional







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `status` _integer_ | HTTP status code to return. |  | Maximum: 599 <br />Minimum: 200 <br />Optional: \{\} <br /> |
| `body` _string_ | Content to return in the HTTP response body.<br />The maximum length of the body is restricted to prevent excessively large responses.<br />If this field is omitted, no body is included in the response. |  | MaxLength: 4096 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `bodyExpression` _[CELExpression](#celexpression)_ | CEL expression that produces the HTTP response body.<br />Strings and bytes are written directly; other values are serialized as JSON.<br />If this field is omitted, no expression body is included in the response. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `headers` _[DirectResponseHeader](#directresponseheader) array_ | Response headers to set on the direct response. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `conditional` _[DirectResponseConditional](#directresponseconditional) array_ | Conditional policy execution. Set this or the top-level directResponse fields.<br />The first matching policy will be executed.<br />A single policy may be provided without a condition set; if so, it must be the last policy and will be the fallback<br />in case no conditions are met. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### DynamicForwardProxyBackend







_Appears in:_
- [AgentgatewayBackendSpec](#agentgatewaybackendspec)



#### ExtAuth







_Appears in:_
- [BackendFull](#backendfull)
- [ExtAuthConditional](#extauthconditional)
- [ExtAuthOrConditional](#extauthorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | External Authorization server to reach.<br />Supported types: `Service` and `Backend`. |  | Optional: \{\} <br /> |
| `failureMode` _[FailureMode](#failuremode)_ | Behavior when the external authorization service is<br />unavailable or returns an error. "FailOpen" allows the request to continue.<br />"FailClosed" (default) denies the request. |  | Optional: \{\} <br /> |
| `grpc` _[AgentExtAuthGRPC](#agentextauthgrpc)_ | Uses the gRPC External Authorization<br />[protocol](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto) should be used. |  | Optional: \{\} <br /> |
| `http` _[AgentExtAuthHTTP](#agentextauthhttp)_ | Uses HTTP to connect to<br />the authorization server. The authorization server must return a `200`<br />status code, otherwise the request is considered an authorization<br />failure. |  | Optional: \{\} <br /> |
| `forwardBody` _[ExtAuthBody](#extauthbody)_ | Whether to include the HTTP body in the authorization request.<br />If enabled, the request body will be buffered. |  | Optional: \{\} <br /> |
| `cache` _[ExtAuthCache](#extauthcache)_ | Caches authorization results.<br />WARNING: the safety of this feature depends on the cache key accurately<br />capturing every request property that the authorization service uses to<br />make a decision. For example, if the service returns different results<br />based on both path and authorization header, both must be included in<br />`key`; otherwise, one request may incorrectly reuse another request's<br />authorization result.<br />If any key expression fails to evaluate or produces an unsupported value,<br />the request is still sent to the authorization service, but its result is<br />not read from or written to the cache. |  | Optional: \{\} <br /> |


#### ExtAuthBody







_Appears in:_
- [ExtAuth](#extauth)
- [ExtAuthOrConditional](#extauthorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `maxSize` _[ByteSize](#bytesize)_ | Largest body, in bytes, that will be buffered<br />and sent to the authorization server. If the body size is larger than<br />`maxSize`, then the request will be rejected with a response. |  | MaxLength: 32 <br />MinLength: 1 <br />Pattern: `^[+-]?([0-9]+(\.[0-9]*)?\|\.[0-9]+)(([KMGTPE]i)\|[numkMGTPE]\|[eE](\+?0*([0-9]\|1[0-8])\|-0*[0-9]))?$` <br />XIntOrString: \{\} <br />Required: \{\} <br /> |


#### ExtAuthCache







_Appears in:_
- [ExtAuth](#extauth)
- [ExtAuthOrConditional](#extauthorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `key` _[CELExpression](#celexpression) array_ | Ordered list of CEL expressions evaluated against the request<br />to construct the cache key. |  | MaxItems: 16 <br />MaxLength: 16384 <br />MinItems: 1 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `ttl` _[CELExpression](#celexpression)_ | Duration string, such as `5m`, or a CEL expression that<br />returns the duration that cached authorization results may be reused, or a<br />timestamp when the cached authorization result expires. The expression is<br />evaluated after the authorization response has been applied to the request. |  | MaxLength: 16384 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `maxEntries` _integer_ | Maximum number of authorization results to keep in<br />the cache. If unset, this defaults to 10000. |  | Minimum: 1 <br />Optional: \{\} <br /> |


#### ExtAuthConditional







_Appears in:_
- [ExtAuthOrConditional](#extauthorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `condition` _[CELExpression](#celexpression)_ | CEL expression that must evaluate to true for this policy to execute. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `policy` _[ExtAuth](#extauth)_ | Policy to apply when the condition matches. |  | Required: \{\} <br /> |


#### ExtAuthOrConditional







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | External Authorization server to reach.<br />Supported types: `Service` and `Backend`. |  | Optional: \{\} <br /> |
| `failureMode` _[FailureMode](#failuremode)_ | Behavior when the external authorization service is<br />unavailable or returns an error. "FailOpen" allows the request to continue.<br />"FailClosed" (default) denies the request. |  | Optional: \{\} <br /> |
| `grpc` _[AgentExtAuthGRPC](#agentextauthgrpc)_ | Uses the gRPC External Authorization<br />[protocol](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto) should be used. |  | Optional: \{\} <br /> |
| `http` _[AgentExtAuthHTTP](#agentextauthhttp)_ | Uses HTTP to connect to<br />the authorization server. The authorization server must return a `200`<br />status code, otherwise the request is considered an authorization<br />failure. |  | Optional: \{\} <br /> |
| `forwardBody` _[ExtAuthBody](#extauthbody)_ | Whether to include the HTTP body in the authorization request.<br />If enabled, the request body will be buffered. |  | Optional: \{\} <br /> |
| `cache` _[ExtAuthCache](#extauthcache)_ | Caches authorization results.<br />WARNING: the safety of this feature depends on the cache key accurately<br />capturing every request property that the authorization service uses to<br />make a decision. For example, if the service returns different results<br />based on both path and authorization header, both must be included in<br />`key`; otherwise, one request may incorrectly reuse another request's<br />authorization result.<br />If any key expression fails to evaluate or produces an unsupported value,<br />the request is still sent to the authorization service, but its result is<br />not read from or written to the cache. |  | Optional: \{\} <br /> |
| `conditional` _[ExtAuthConditional](#extauthconditional) array_ | Conditional policy execution. Set this or the top-level extAuth fields.<br />The first matching policy will be executed.<br />A single policy may be provided without a condition set; if so, it must be the last policy and will be the fallback<br />in case no conditions are met. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### ExtProc







_Appears in:_
- [ExtProcConditional](#extprocconditional)
- [ExtProcOrConditional](#extprocorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | External Processor server to reach.<br />Supported types: `Service` and `Backend`. |  | Optional: \{\} <br /> |
| `processingOptions` _[ProcessingOptions](#processingoptions)_ | How request and response phases are sent to ext_proc. |  | Optional: \{\} <br /> |


#### ExtProcConditional







_Appears in:_
- [ExtProcOrConditional](#extprocorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `condition` _[CELExpression](#celexpression)_ | CEL expression that must evaluate to true for this policy to execute. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `policy` _[ExtProc](#extproc)_ | Policy to apply when the condition matches. |  | Required: \{\} <br /> |


#### ExtProcOrConditional







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | External Processor server to reach.<br />Supported types: `Service` and `Backend`. |  | Optional: \{\} <br /> |
| `processingOptions` _[ProcessingOptions](#processingoptions)_ | How request and response phases are sent to ext_proc. |  | Optional: \{\} <br /> |
| `conditional` _[ExtProcConditional](#extprocconditional) array_ | Conditional policy execution. Set this or the top-level extProc fields.<br />The first matching policy will be executed.<br />A single policy may be provided without a condition set; if so, it must be the last policy and will be the fallback<br />in case no conditions are met. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### FailureMode

_Underlying type:_ _string_





_Appears in:_
- [ExtAuth](#extauth)
- [ExtAuthOrConditional](#extauthorconditional)
- [GlobalRateLimit](#globalratelimit)
- [MCPBackend](#mcpbackend)
- [MCPGuardrailsRemote](#mcpguardrailsremote)
- [Webhook](#webhook)

| Field | Description |
| --- | --- |
| `FailClosed` | FailClosed fails the entire MCP session if any target fails.<br /> |
| `FailOpen` | FailOpen skips failed targets and continues serving from healthy ones.<br /> |


#### FieldDefault



Default value for a field in the JSON request body sent to the LLM provider.
These defaults are merged with the user-provided request to ensure missing fields are populated.

User input fields here refer to the fields in the JSON request body that a client sends when making a request to the LLM provider.
Defaults set here do _not_ override those user-provided values unless you explicitly set `override` to `true`.

Example: Setting a default system field for Anthropic, which does not support system role messages:

	defaults:
	  - field: "system"
	    value: "answer all questions in French"

Example: Setting a default temperature and overriding `max_tokens`:

	defaults:
	  - field: "temperature"
	    value: "0.5"
	  - field: "max_tokens"
	    value: "100"
	    override: true

Example: Setting custom lists fields:

	defaults:
	  - field: "custom_integer_list"
	    value: [1,2,3]

	overrides:
	  - field: "custom_string_list"
	    value: ["one","two","three"]

Note: The `field` values correspond to keys in the JSON request body, not fields in this CRD.



_Appears in:_
- [BackendAI](#backendai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `field` _[ShortString](#shortstring)_ | Name of the field. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `value` _[JSON](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#json-v1-apiextensions-k8s-io)_ | Default value for the field. This can be any JSON data type. |  | Required: \{\} <br /> |


#### FieldTransformation



Maps a request JSON field to a CEL expression.
The expression is evaluated against the current request body and its result
is assigned to the configured field.



_Appears in:_
- [BackendAI](#backendai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `field` _[ShortString](#shortstring)_ | Name of the field to set. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `expression` _[CELExpression](#celexpression)_ | CEL expression used to compute the field value. |  | MaxLength: 16384 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### Frontend







_Appears in:_
- [AgentgatewayPolicySpec](#agentgatewaypolicyspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `tcp` _[FrontendTCP](#frontendtcp)_ | Settings for managing incoming TCP connections. |  | Optional: \{\} <br /> |
| `networkAuthorization` _[Authorization](#authorization)_ | CEL authorization on downstream network connections.<br />This runs before protocol handling and is intended for L4 access control,<br />for example using `source.address` with `cidr(...).containsIP(...)`. |  | Optional: \{\} <br /> |
| `tls` _[FrontendTLS](#frontendtls)_ | Settings for managing incoming TLS connections. |  | Optional: \{\} <br /> |
| `http` _[FrontendHTTP](#frontendhttp)_ | Settings for managing incoming HTTP requests. |  | Optional: \{\} <br /> |
| `proxyProtocol` _[FrontendProxyProtocol](#frontendproxyprotocol)_ | Settings for downstream PROXY protocol handling.<br />If configured, incoming connections may require a PROXY header before<br />normal protocol handling. This can also be configured to allow both<br />PROXY and non-PROXY traffic on the same listener. |  | Optional: \{\} <br /> |
| `connect` _[FrontendConnect](#frontendconnect)_ | Settings for downstream HTTP CONNECT handling.<br />If unset, CONNECT requests are rejected with Method Not Allowed. |  | Optional: \{\} <br /> |
| `accessLog` _[AccessLog](#accesslog)_ | Access logging configuration. |  | Optional: \{\} <br /> |
| `tracing` _[Tracing](#tracing)_ | OpenTelemetry tracing settings. |  | Optional: \{\} <br /> |
| `metrics` _[MetricLabels](#metriclabels)_ | Custom Prometheus metric label configuration.<br />CEL expressions are evaluated per-request and added as labels to all<br />Prometheus metrics exposed by agentgateway. |  | Optional: \{\} <br /> |


#### FrontendConnect







_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `mode` _[FrontendConnectMode](#frontendconnectmode)_ | Whether downstream CONNECT requests are accepted. |  | Enum: [Deny Route Tunnel] <br />Required: \{\} <br /> |


#### FrontendConnectMode

_Underlying type:_ _string_



_Validation:_
- Enum: [Deny Route Tunnel]

_Appears in:_
- [FrontendConnect](#frontendconnect)

| Field | Description |
| --- | --- |
| `Deny` | Deny rejects downstream CONNECT requests.<br /> |
| `Route` | Route treats CONNECT as an HTTP request and routes it through the HTTP<br />matching chain before establishing a raw tunnel to the selected backend.<br /> |
| `Tunnel` | Tunnel terminates CONNECT and sends the upgraded stream through the<br />addressed gateway bind as a new downstream connection.<br /> |


#### FrontendHTTP







_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `maxBufferSize` _[ByteSize](#bytesize)_ | Maximum HTTP body size that will be buffered<br />into memory.<br />Bodies will only be buffered for policies which require buffering.<br />If unset, this defaults to `2mb`. |  | MaxLength: 32 <br />MinLength: 1 <br />Pattern: `^[+-]?([0-9]+(\.[0-9]*)?\|\.[0-9]+)(([KMGTPE]i)\|[numkMGTPE]\|[eE](\+?0*([0-9]\|1[0-8])\|-0*[0-9]))?$` <br />XIntOrString: \{\} <br />Optional: \{\} <br /> |
| `http1MaxHeaders` _integer_ | Maximum number of headers allowed<br />in `HTTP/1.1` requests.<br />If unset, this defaults to 100. |  | Maximum: 4096 <br />Minimum: 1 <br />Optional: \{\} <br /> |
| `http1IdleTimeout` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Timeout before an unused connection is<br />closed.<br />If unset, this defaults to 10 minutes. |  | Optional: \{\} <br /> |
| `http1HeaderCase` _[HTTPHeaderCase](#httpheadercase)_ | Controls HTTP/1 request header name casing when encoding responses on the same connection.<br />This only applies to `HTTP/1`. If a request is HTTP/2 in either the incoming or outgoing request, this will be ignored.<br />HTTP/2 requests are always lower case.<br />Modifying the headers from other policies may result in the original case being lost. |  | Optional: \{\} <br /> |
| `http2WindowSize` _[ByteSize](#bytesize)_ | Initial window size for stream-level flow<br />control for received data. |  | MaxLength: 32 <br />MinLength: 1 <br />Pattern: `^[+-]?([0-9]+(\.[0-9]*)?\|\.[0-9]+)(([KMGTPE]i)\|[numkMGTPE]\|[eE](\+?0*([0-9]\|1[0-8])\|-0*[0-9]))?$` <br />XIntOrString: \{\} <br />Optional: \{\} <br /> |
| `http2ConnectionWindowSize` _[ByteSize](#bytesize)_ | Initial window size for<br />connection-level flow control for received data. |  | MaxLength: 32 <br />MinLength: 1 <br />Pattern: `^[+-]?([0-9]+(\.[0-9]*)?\|\.[0-9]+)(([KMGTPE]i)\|[numkMGTPE]\|[eE](\+?0*([0-9]\|1[0-8])\|-0*[0-9]))?$` <br />XIntOrString: \{\} <br />Optional: \{\} <br /> |
| `http2FrameSize` _[ByteSize](#bytesize)_ | Maximum frame size to use.<br />If unset, this defaults to `16kb`. |  | MaxLength: 32 <br />MinLength: 1 <br />Pattern: `^[+-]?([0-9]+(\.[0-9]*)?\|\.[0-9]+)(([KMGTPE]i)\|[numkMGTPE]\|[eE](\+?0*([0-9]\|1[0-8])\|-0*[0-9]))?$` <br />XIntOrString: \{\} <br />Optional: \{\} <br /> |
| `http2MaxHeaderSize` _[ByteSize](#bytesize)_ | Maximum aggregate size of decoded HTTP/2<br />request headers.<br />If unset, this defaults to `16Ki`. |  | MaxLength: 32 <br />MinLength: 1 <br />Pattern: `^[+-]?([0-9]+(\.[0-9]*)?\|\.[0-9]+)(([KMGTPE]i)\|[numkMGTPE]\|[eE](\+?0*([0-9]\|1[0-8])\|-0*[0-9]))?$` <br />XIntOrString: \{\} <br />Optional: \{\} <br /> |
| `http2KeepaliveInterval` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ |  |  | Optional: \{\} <br /> |
| `http2KeepaliveTimeout` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ |  |  | Optional: \{\} <br /> |
| `maxConnectionDuration` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Maximum time a connection is allowed to remain open.<br />After this duration, the connection is gracefully closed after the current in-flight request completes.<br />Useful for ensuring even traffic distribution behind load balancers during scaling events. |  | Optional: \{\} <br /> |


#### FrontendProxyProtocol







_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `version` _[ProxyProtocolVersion](#proxyprotocolversion)_ | PROXY protocol version to accept.<br />If unset, this defaults to `V2`. | V2 | Optional: \{\} <br /> |
| `mode` _[ProxyProtocolMode](#proxyprotocolmode)_ | Whether PROXY headers are required or optional.<br />If unset, this defaults to `Strict`. | Strict | Optional: \{\} <br /> |


#### FrontendTCP







_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `keepalive` _[Keepalive](#keepalive)_ | Settings for enabling TCP keepalives on the connection. |  | Optional: \{\} <br /> |


#### FrontendTLS







_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `handshakeTimeout` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Deadline for a TLS handshake to<br />complete. If unset, this defaults to `15s`. |  | Optional: \{\} <br /> |
| `alpnProtocols` _[TinyString](#tinystring)_ | Application-Layer Protocol Negotiation (`ALPN`)<br />value to use in the TLS handshake.<br />If not present, defaults to `["h2", "http/1.1"]`. |  | MaxItems: 16 <br />MaxLength: 64 <br />MinItems: 1 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `minProtocolVersion` _[TLSVersion](#tlsversion)_ | Minimum TLS version to support. |  | Optional: \{\} <br /> |
| `maxProtocolVersion` _[TLSVersion](#tlsversion)_ | Maximum TLS version to support. |  | Optional: \{\} <br /> |
| `cipherSuites` _[CipherSuite](#ciphersuite) array_ | Cipher suites for a TLS listener.<br />The value is a comma-separated list of cipher suites, for example<br />`TLS13_AES_256_GCM_SHA384,TLS13_AES_128_GCM_SHA256`.<br />Use this in the TLS options field of a TLS listener. |  | Optional: \{\} <br /> |
| `keyExchangeGroups` _[KeyExchangeGroup](#keyexchangegroup) array_ | Ordered list of key exchange groups for a TLS listener.<br />For example: `X25519_MLKEM768,X25519`. |  | Optional: \{\} <br /> |


#### GcpAuth



Google Cloud authentication settings.



_Appears in:_
- [BackendAuth](#backendauth)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `type` _[GcpAuthType](#gcpauthtype)_ | The type of token to generate. To authenticate to GCP services,<br />generally an `AccessToken` is used. To authenticate to Cloud Run, an<br />`IdToken` is used. |  | Optional: \{\} <br /> |
| `secretRef` _[LocalSecretObjectRef](#localsecretobjectref)_ | Credential source, defaulting to a Kubernetes<br />`Secret`, containing ADC-compatible Google credential JSON. When using<br />the default Secret resolver, this must be stored in the `credentials.json`<br />key. When omitted, ambient credentials are used. |  | Optional: \{\} <br /> |
| `audience` _[ShortString](#shortstring)_ | Explicit `aud` value for the ID token. Only<br />valid with `IdToken` type. If not set, the `aud` is automatically<br />derived from the backend hostname. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### GcpAuthType

_Underlying type:_ _string_





_Appears in:_
- [GcpAuth](#gcpauth)

| Field | Description |
| --- | --- |
| `AccessToken` |  |
| `IdToken` |  |


#### GeminiConfig



Settings for the [Gemini](https://ai.google.dev/gemini-api/docs) LLM provider.



_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `model` _[ShortString](#shortstring)_ | Model name override, such as `gemini-2.5-pro`.<br />If unset, the model name is taken from the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### GlobalRateLimit







_Appears in:_
- [RateLimits](#ratelimits)
- [RateLimitsOrConditional](#ratelimitsorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | Rate limit server to reach.<br />Supported types: `Service` and `Backend`. |  | Required: \{\} <br /> |
| `failureMode` _[FailureMode](#failuremode)_ | Behavior when the remote rate limit service is<br />unavailable or returns an error. `FailOpen` allows the request to continue.<br />`FailClosed` (default) denies the request. |  | Optional: \{\} <br /> |
| `domain` _[ShortString](#shortstring)_ | Domain under which this limit should apply.<br />This is an arbitrary string that enables a rate limit server to distinguish between different applications. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `descriptors` _[RateLimitDescriptor](#ratelimitdescriptor) array_ | Dimensions for rate limiting. These values are<br />passed to the rate limit service which applies configured limits based<br />on them. Each descriptor represents a single rate limit rule with one or<br />more entries. |  | MaxItems: 16 <br />MinItems: 1 <br />Required: \{\} <br /> |


#### GoogleModelArmor







_Appears in:_
- [PromptguardRequest](#promptguardrequest)
- [PromptguardResponse](#promptguardresponse)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `templateId` _[ShortString](#shortstring)_ | Template ID for Google Model Armor. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `projectId` _[ShortString](#shortstring)_ | Google Cloud project ID. |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `location` _[ShortString](#shortstring)_ | Google Cloud location, for example `us-central1`.<br />Defaults to `us-central1` if not specified. | us-central1 | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `policies` _[BackendSimple](#backendsimple)_ | Policies for communicating with Google Model Armor. |  | Optional: \{\} <br /> |


#### HTTPHeaderCase

_Underlying type:_ _string_





_Appears in:_
- [FrontendHTTP](#frontendhttp)

| Field | Description |
| --- | --- |
| `Lowercase` |  |
| `Preserve` |  |


#### HTTPHeaderName

_Underlying type:_ _string_

HTTP header name that does not allow pseudo-headers.

_Validation:_
- MaxLength: 256
- MinLength: 1
- Pattern: `^[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$`

_Appears in:_
- [DirectResponseHeader](#directresponseheader)



#### HTTPVersion

_Underlying type:_ _string_





_Appears in:_
- [BackendHTTP](#backendhttp)

| Field | Description |
| --- | --- |
| `HTTP1` |  |
| `HTTP2` |  |


#### HeaderModifiers



Modifies request and response headers.



_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `request` _[HTTPHeaderFilter](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#httpheaderfilter)_ | Header changes to apply before forwarding a request. |  | Optional: \{\} <br /> |
| `response` _[HTTPHeaderFilter](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#httpheaderfilter)_ | Header changes to apply before returning a response. |  | Optional: \{\} <br /> |


#### HeaderName

_Underlying type:_ _string_

HTTP header name.

_Validation:_
- MaxLength: 256
- MinLength: 1
- Pattern: `^:?[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$`

_Appears in:_
- [HeaderTransformation](#headertransformation)
- [MCPGuardrailsRemote](#mcpguardrailsremote)
- [Transform](#transform)



#### HeaderSendMode

_Underlying type:_ _string_

Whether HTTP headers are delivered to the external processor.

_Validation:_
- Enum: [Send Skip]

_Appears in:_
- [ProcessingOptions](#processingoptions)

| Field | Description |
| --- | --- |
| `Send` | HeaderSendModeSend sends headers to the external processor.<br /> |
| `Skip` | HeaderSendModeSkip does not send headers to the external processor.<br /> |


#### HeaderTransformation







_Appears in:_
- [Transform](#transform)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[HeaderName](#headername)_ | The name of the header to add. |  | MaxLength: 256 <br />MinLength: 1 <br />Pattern: `^:?[A-Za-z0-9!#$%&'*+\-.^_\x60\|~]+$` <br />Required: \{\} <br /> |
| `value` _[CELExpression](#celexpression)_ | CEL expression that generates the output value for<br />the header. |  | MaxLength: 16384 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### Health







_Appears in:_
- [BackendFull](#backendfull)
- [BackendWithAI](#backendwithai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `unhealthyCondition` _[CELExpression](#celexpression)_ | CEL expression that determines whether a response indicates an unhealthy backend.<br />When the expression evaluates to true, the backend is considered unhealthy and may be evicted.<br />For example, to evict on 5xx responses: `response.code >= 500`.<br />When unset, any 5xx response, or a connection failure, is treated as unhealthy.<br />This default lowers the backend's health score but does not trigger eviction on its own. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `eviction` _[BackendEviction](#backendeviction)_ | Settings for evicting unhealthy backends. |  | Optional: \{\} <br /> |


#### HostnameRewrite







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `mode` _[HostnameRewriteMode](#hostnamerewritemode)_ | Hostname rewrite mode.<br />The following may be specified:<br />* `Auto`: automatically set the `Host` header based on the destination.<br />* `None`: do not rewrite the `Host` header. The original `Host` header<br />  will be passed through.<br />This setting defaults to `Auto` when connecting to hostname-based<br />`Backend` types, and `None` otherwise, for `Service` or IP-based<br />backends. |  | Required: \{\} <br /> |


#### HostnameRewriteMode

_Underlying type:_ _string_





_Appears in:_
- [HostnameRewrite](#hostnamerewrite)

| Field | Description |
| --- | --- |
| `Auto` |  |
| `None` |  |


#### Image



Container image settings. See https://kubernetes.io/docs/concepts/containers/images
for details.



_Appears in:_
- [AgentgatewayParametersConfigs](#agentgatewayparametersconfigs)
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `registry` _string_ | Image registry. |  | Optional: \{\} <br /> |
| `repository` _string_ | Image repository. |  | Optional: \{\} <br /> |
| `tag` _string_ | Image tag. |  | Optional: \{\} <br /> |
| `digest` _string_ | Image digest, such as `sha256:12345...`. |  | Optional: \{\} <br /> |
| `pullPolicy` _[PullPolicy](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#pullpolicy-v1-core)_ | Image pull policy for the container. See<br />https://kubernetes.io/docs/concepts/containers/images/#image-pull-policy<br />for details. |  | Optional: \{\} <br /> |


#### InsecureTLSMode

_Underlying type:_ _string_





_Appears in:_
- [BackendTLS](#backendtls)

| Field | Description |
| --- | --- |
| `All` | InsecureTLSModeInsecure disables all TLS verification<br /> |
| `Hostname` | InsecureTLSModeHostname enables verifying the CA certificate, but disables verification of the hostname/SAN.<br />Note this is still, generally, very "insecure" as the name suggests.<br /> |


#### IstioSpec







_Appears in:_
- [AgentgatewayParametersConfigs](#agentgatewayparametersconfigs)
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `enabled` _boolean_ | Explicitly turns Istio integration on or off for this gateway. |  | Optional: \{\} <br /> |
| `caAddress` _string_ | Address of the Istio CA. If unset, defaults to `https://istiod.istio-system.svc:15012`. |  | Optional: \{\} <br /> |
| `trustDomain` _string_ | Istio trust domain. If not set, defaults to `cluster.local`, or the default<br />trust domain for the control plane's istio revision. |  | Optional: \{\} <br /> |
| `additionalTrustDomains` _string array_ | Additional SPIFFE trust domains accepted on inbound HBONE connections.<br />The local trust domain is always implicitly included. |  | Optional: \{\} <br /> |
| `clusterId` _string_ | ID of the cluster this gateway runs in. If unset, defaults to `Kubernetes`. |  | Optional: \{\} <br /> |
| `network` _string_ | Istio network this gateway runs in. If unset, defaults to the empty network. |  | Optional: \{\} <br /> |


#### JWKS





_Validation:_
- ExactlyOneOf: [remote inline]

_Appears in:_
- [JWTProvider](#jwtprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `remote` _[RemoteJWKS](#remotejwks)_ | How to reach the JSON Web Key Set from a remote<br />address. |  | Optional: \{\} <br /> |
| `inline` _string_ | Inline JSON Web Key Set used to validate the<br />signature of the JWT. |  | MaxLength: 65536 <br />MinLength: 2 <br />Optional: \{\} <br /> |


#### JWTAuthentication







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `mode` _[JWTAuthenticationMode](#jwtauthenticationmode)_ | Validation mode for JWT authentication. | Strict | Optional: \{\} <br /> |
| `providers` _[JWTProvider](#jwtprovider) array_ |  |  | MaxItems: 64 <br />MinItems: 1 <br />Required: \{\} <br /> |
| `location` _[AuthorizationExtractionLocation](#authorizationextractionlocation)_ | Where JWT credentials are read from.<br />If omitted, credentials are read from the `Authorization` header with the `Bearer ` prefix. |  | ExactlyOneOf: [header queryParameter cookie expression] <br />Optional: \{\} <br /> |
| `mcp` _[JWTMCPConfig](#jwtmcpconfig)_ | Enables MCP OAuth metadata endpoint handling<br />and MCP-specific authentication behavior on top of standard JWT validation.<br />When set, the gateway will serve the MCP OAuth metadata discovery endpoints. |  | Optional: \{\} <br /> |


#### JWTAuthenticationMode

_Underlying type:_ _string_





_Appears in:_
- [JWTAuthentication](#jwtauthentication)
- [MCPAuthentication](#mcpauthentication)

| Field | Description |
| --- | --- |
| `Strict` | A valid token, issued by a configured issuer, must be present.<br />This is the default option.<br /> |
| `Optional` | If a token exists, validate it.<br />Warning: this allows requests without a JWT token!<br /> |
| `Permissive` | Requests are never rejected. This is useful for usage of claims in later steps (authorization, logging, etc).<br />Warning: this allows requests without a JWT token!<br /> |


#### JWTMCPConfig



MCP-specific extensions for JWT authentication.



_Appears in:_
- [JWTAuthentication](#jwtauthentication)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `resourceMetadata` _object (keys:string, values:[JSON](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#json-v1-apiextensions-k8s-io))_ | Metadata to use for MCP resources,<br />served at the MCP OAuth metadata endpoints. |  | Optional: \{\} <br /> |
| `provider` _[McpIDP](#mcpidp)_ | Identity provider to use for MCP authentication flows. |  | Enum: [Auth0 Keycloak Okta] <br />Optional: \{\} <br /> |
| `clientId` _string_ | Client ID to use for short-circuiting Dynamic Client Registration.<br />If set, the gateway will not proxy registration requests to the IDP and instead return this client ID. |  | Optional: \{\} <br /> |


#### JWTProvider







_Appears in:_
- [JWTAuthentication](#jwtauthentication)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `issuer` _[ShortString](#shortstring)_ | IdP that issued the JWT. This corresponds to the<br />`iss` claim ([RFC 7519 §4.1.1](https://tools.ietf.org/html/rfc7519#section-4.1.1)). |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `audiences` _string array_ | Allowed audiences that are allowed<br />access. This corresponds to the `aud` claim<br />([RFC 7519 §4.1.3](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3)).<br />If unset, any audience is allowed. |  | MaxItems: 64 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `jwks` _[JWKS](#jwks)_ | JSON Web Key Set used to validate the signature of the<br />JWT. |  | ExactlyOneOf: [remote inline] <br />Required: \{\} <br /> |


#### Keepalive



TCP keepalive settings.



_Appears in:_
- [BackendTCP](#backendtcp)
- [FrontendTCP](#frontendtcp)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `retries` _integer_ | Maximum number of keepalive probes to send before dropping the connection.<br />If unset, this defaults to 9. |  | Maximum: 64 <br />Minimum: 1 <br />Optional: \{\} <br /> |
| `time` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Time a connection needs to be idle before keepalive probes start being sent.<br />If unset, this defaults to 180s. |  | Optional: \{\} <br /> |
| `interval` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Time between keepalive probes.<br />If unset, this defaults to 180s. |  | Optional: \{\} <br /> |


#### KeyExchangeGroup

_Underlying type:_ _string_





_Appears in:_
- [BackendTLS](#backendtls)
- [FrontendTLS](#frontendtls)

| Field | Description |
| --- | --- |
| `X25519` |  |
| `P-256` |  |
| `P-384` |  |
| `X25519_MLKEM768` |  |


#### KubernetesResourceOverlay



KubernetesResourceOverlay provides a mechanism to customize generated
Kubernetes resources using [Strategic Merge
Patch](https://github.com/kubernetes/community/blob/main/contributors/devel/sig-api-machinery/strategic-merge-patch.md)
semantics.

# Overlay Application Order

Overlays are applied **after** all typed configuration fields have been processed.
The full merge order is:

 1. `GatewayClass` typed configuration fields, for example replicas or image settings from `parametersRef`
 2. `Gateway` typed configuration fields from `infrastructure.parametersRef`
 3. `GatewayClass` overlays are applied
 4. `Gateway` overlays are applied

This ordering means `Gateway`-level configuration overrides
`GatewayClass`-level configuration
at each stage. For example, if both levels set the same label, the Gateway value wins.



_Appears in:_
- [AgentgatewayParametersOverlays](#agentgatewayparametersoverlays)
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `metadata` _[ObjectMetadata](#objectmetadata)_ | Refer to Kubernetes API documentation for fields of `metadata`. |  | Optional: \{\} <br /> |
| `spec` _[JSON](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#json-v1-apiextensions-k8s-io)_ | `spec` provides an opaque mechanism to configure the resource spec.<br />This field accepts a complete or partial Kubernetes resource spec, such<br />as `PodSpec` or `ServiceSpec`, and will be merged with the generated<br />configuration using **Strategic Merge Patch** semantics.<br /># Application Order<br />Overlays are applied after all typed configuration fields from both levels.<br />The full merge order is:<br /> 1. `GatewayClass` typed configuration fields<br /> 2. `Gateway` typed configuration fields<br /> 3. `GatewayClass` overlays<br /> 4. `Gateway` overlays (can override all previous values)<br /># Strategic Merge Patch & Deletion Guide<br />This merge strategy allows you to override individual fields, merge lists, or delete items<br />without needing to provide the entire resource definition.<br />**1. Replacing Values (Scalars):**<br />Simple fields (strings, integers, booleans) in your config will overwrite the generated defaults.<br />**2. Merging Lists (Append/Merge):**<br />Lists with "merge keys", like `containers` which merges on `name`, or<br />`tolerations` which merges on `key`,<br />will append your items to the generated list, or update existing items if keys match.<br />**3. Deleting Fields or List Items ($patch: delete):**<br />To remove a field or list item from the generated resource, use the<br />`$patch: delete` directive. This works for both map fields and list items,<br />and is the recommended approach because it works with both client-side<br />and server-side apply.<br />	spec:<br />	  template:<br />	    spec:<br />	      # Delete pod-level securityContext<br />	      securityContext:<br />	        $patch: delete<br />	      # Delete nodeSelector<br />	      nodeSelector:<br />	        $patch: delete<br />	      containers:<br />	      # Be sure to use the correct proxy name here or you will add a<br />	      # container instead of modifying a container.<br />	      - name: proxy-name<br />	        # Delete container-level securityContext<br />	        securityContext:<br />	          $patch: delete<br />**4. Null Values (server-side apply only):**<br />Setting a field to `null` can also remove it, but this ONLY works with<br />`kubectl apply --server-side` or equivalent. With regular client-side<br />`kubectl apply`, null values are stripped by kubectl before reaching<br />the API server, so the deletion won't occur. Prefer `$patch: delete`<br />for consistent behavior across both apply modes.<br />	spec:<br />	  template:<br />	    spec:<br />	      nodeSelector: null  # Removes nodeSelector (server-side apply only!)<br />**5. Replacing Maps Entirely ($patch: replace):**<br />To replace an entire map with your values (instead of merging), use `$patch: replace`.<br />This removes all existing keys and replaces them with only your specified keys.<br />	spec:<br />	  template:<br />	    spec:<br />	      nodeSelector:<br />	        $patch: replace<br />	        custom-key: custom-value<br />**6. Replacing Lists Entirely ($patch: replace):**<br />If you want to strictly define a list and ignore all generated defaults, use `$patch: replace`.<br />	service:<br />	  spec:<br />	    ports:<br />	    - $patch: replace<br />	    - name: http<br />	      port: 80<br />	      targetPort: 8080<br />	      protocol: TCP<br />	    - name: https<br />	      port: 443<br />	      targetPort: 8443<br />	      protocol: TCP |  | Type: object <br />Optional: \{\} <br /> |


#### LLMProvider



Large language model provider that the backend routes requests to.

_Validation:_
- ExactlyOneOf: [openai azureopenai azure anthropic gemini vertexai bedrock custom]

_Appears in:_
- [AIBackend](#aibackend)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `openai` _[OpenAIConfig](#openaiconfig)_ | OpenAI provider settings. |  | Optional: \{\} <br /> |
| `azureopenai` _[AzureOpenAIConfig](#azureopenaiconfig)_ | Azure OpenAI provider settings. |  | Optional: \{\} <br /> |
| `azure` _[AzureConfig](#azureconfig)_ | Azure provider with resource-based configuration.<br />Supports both Azure OpenAI and Azure AI Foundry resource types. |  | Optional: \{\} <br /> |
| `anthropic` _[AnthropicConfig](#anthropicconfig)_ | Anthropic provider settings. |  | Optional: \{\} <br /> |
| `gemini` _[GeminiConfig](#geminiconfig)_ | Gemini provider settings. |  | Optional: \{\} <br /> |
| `vertexai` _[VertexAIConfig](#vertexaiconfig)_ | Vertex AI provider settings. |  | Optional: \{\} <br /> |
| `bedrock` _[BedrockConfig](#bedrockconfig)_ | Bedrock provider settings. |  | Optional: \{\} <br /> |
| `custom` _[CustomProvider](#customprovider)_ | Custom provider configures a non-managed or self-hosted LLM provider.<br />Use this when the provider target and API formats should be declared<br />explicitly instead of inferred from a managed provider such as OpenAI or<br />Anthropic. |  | Optional: \{\} <br /> |
| `host` _[ShortString](#shortstring)_ | Hostname to send requests to.<br />For custom providers without backendRef, host and port specify the target.<br />For managed providers, host and port override the provider default. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `port` _integer_ | Port to send requests to. |  | Maximum: 65535 <br />Minimum: 1 <br />Optional: \{\} <br /> |
| `path` _[LongString](#longstring)_ | URL path to use for LLM provider API requests.<br />This is useful when you need to route requests to a different API endpoint while maintaining<br />compatibility with the original provider's API structure.<br />If not specified, the default path for the provider is used. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `pathPrefix` _[LongString](#longstring)_ | Overrides the default base path prefix, such as `/v1`, for upstream requests.<br />Path translation for cross-format requests still applies using this prefix.<br />Only supported for OpenAI and Anthropic providers. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### LocalBackendObjectReference



References a namespace-local backend resource.



_Appears in:_
- [CustomProvider](#customprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `group` _string_ | API group of the referenced resource. For example, `gateway.networking.k8s.io`.<br />When unspecified or empty string, core API group is inferred. |  | MaxLength: 253 <br />Pattern: `^$\|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` <br />Optional: \{\} <br /> |
| `kind` _string_ | Kind of the referenced resource. For example, `Service`.<br />Defaults to "Service" when not specified. | Service | MaxLength: 63 <br />MinLength: 1 <br />Pattern: `^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$` <br />Optional: \{\} <br /> |
| `name` _string_ | Name of the referenced resource. |  | MaxLength: 253 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `port` _integer_ | Destination port number to use for this resource.<br />Required when the referenced resource is a Kubernetes Service. |  | Maximum: 65535 <br />Minimum: 1 <br />Optional: \{\} <br /> |


#### LocalPolicyTargetReference



Selects one same-namespace object by `group`, `kind`, and `name`.
The object must be in the same namespace as the policy.



_Appears in:_
- [LocalPolicyTargetReferenceWithSectionName](#localpolicytargetreferencewithsectionname)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `group` _[Group](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#group)_ | The API group of the target resource.<br />For Kubernetes Gateway API resources, the group is `gateway.networking.k8s.io`. |  | MaxLength: 253 <br />Pattern: `^$\|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` <br />Required: \{\} <br /> |
| `kind` _[Kind](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#kind)_ | The API kind of the target resource, such as `Gateway` or `HTTPRoute`. |  | MaxLength: 63 <br />MinLength: 1 <br />Pattern: `^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$` <br />Required: \{\} <br /> |
| `name` _[ObjectName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#objectname)_ | The name of the target resource. |  | Required: \{\} <br /> |


#### LocalPolicyTargetReferenceWithSectionName



Selects one same-namespace object by `group`, `kind`, `name`, and,
optionally, `sectionName`.
The object must be in the same namespace as the policy.



_Appears in:_
- [AgentgatewayPolicySpec](#agentgatewaypolicyspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `group` _[Group](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#group)_ | The API group of the target resource.<br />For Kubernetes Gateway API resources, the group is `gateway.networking.k8s.io`. |  | MaxLength: 253 <br />Pattern: `^$\|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` <br />Required: \{\} <br /> |
| `kind` _[Kind](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#kind)_ | The API kind of the target resource, such as `Gateway` or `HTTPRoute`. |  | MaxLength: 63 <br />MinLength: 1 <br />Pattern: `^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$` <br />Required: \{\} <br /> |
| `name` _[ObjectName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#objectname)_ | The name of the target resource. |  | Required: \{\} <br /> |
| `sectionName` _[SectionName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#sectionname)_ | The named section of the target resource. |  | Optional: \{\} <br /> |


#### LocalPolicyTargetSelector



Selects same-namespace objects by `group`, `kind`, and `matchLabels`.
The object must be in the same namespace as the policy and match the
specified labels.



_Appears in:_
- [LocalPolicyTargetSelectorWithSectionName](#localpolicytargetselectorwithsectionname)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `group` _[Group](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#group)_ | The API group of the target resource.<br />For Kubernetes Gateway API resources, the group is `gateway.networking.k8s.io`. |  | MaxLength: 253 <br />Pattern: `^$\|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` <br />Required: \{\} <br /> |
| `kind` _[Kind](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#kind)_ | The API kind of the target resource, such as `Gateway` or `HTTPRoute`. |  | MaxLength: 63 <br />MinLength: 1 <br />Pattern: `^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$` <br />Required: \{\} <br /> |
| `matchLabels` _object (keys:string, values:string)_ | Labels that must be present on each selected target resource. |  | Required: \{\} <br /> |


#### LocalPolicyTargetSelectorWithSectionName



Selects same-namespace objects by `group`, `kind`, `matchLabels`, and,
optionally, `sectionName`.
Each selected object must be in the same namespace as the policy and match
the specified labels.
Prefer `targetRefs` when reconciliation latency is important, especially
when many policies target the same resource.



_Appears in:_
- [AgentgatewayPolicySpec](#agentgatewaypolicyspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `group` _[Group](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#group)_ | The API group of the target resource.<br />For Kubernetes Gateway API resources, the group is `gateway.networking.k8s.io`. |  | MaxLength: 253 <br />Pattern: `^$\|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` <br />Required: \{\} <br /> |
| `kind` _[Kind](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#kind)_ | The API kind of the target resource, such as `Gateway` or `HTTPRoute`. |  | MaxLength: 63 <br />MinLength: 1 <br />Pattern: `^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$` <br />Required: \{\} <br /> |
| `matchLabels` _object (keys:string, values:string)_ | Labels that must be present on each selected target resource. |  | Required: \{\} <br /> |
| `sectionName` _[SectionName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#sectionname)_ | The named section of each selected target resource. |  | Optional: \{\} <br /> |


#### LocalRateLimit



Local rate limiting policy. Local rate limits are handled on a per-proxy basis, without coordination
between instances of the proxy.

_Validation:_
- ExactlyOneOf: [requests tokens]

_Appears in:_
- [RateLimits](#ratelimits)
- [RateLimitsOrConditional](#ratelimitsorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `requests` _integer_ | Number of HTTP requests per unit of time that<br />are allowed. Requests exceeding this limit will fail with a `429`<br />error. |  | Minimum: 1 <br />Optional: \{\} <br /> |
| `tokens` _integer_ | Number of LLM tokens per unit of time that are<br />allowed. Requests exceeding this limit will fail with a `429` error.<br />Both input and output tokens are counted. However, token counts are not known until the request completes. As a<br />result, token-based rate limits will apply to future requests only. |  | Minimum: 1 <br />Optional: \{\} <br /> |
| `unit` _[LocalRateLimitUnit](#localratelimitunit)_ | Unit of time for the limit. |  | Required: \{\} <br /> |
| `burst` _integer_ | Allowance of requests above the request-per-unit<br />that should be allowed within a short period of time. |  | Optional: \{\} <br /> |


#### LocalRateLimitUnit

_Underlying type:_ _string_





_Appears in:_
- [LocalRateLimit](#localratelimit)

| Field | Description |
| --- | --- |
| `Seconds` |  |
| `Minutes` |  |
| `Hours` |  |


#### LocalSecretObjectRef



References a same-namespace credential.
Set only `name` to reference a Kubernetes Secret.



_Appears in:_
- [APIKeyAuthentication](#apikeyauthentication)
- [AwsAuth](#awsauth)
- [AzureAuth](#azureauth)
- [BackendAuth](#backendauth)
- [BackendTLS](#backendtls)
- [BasicAuthentication](#basicauthentication)
- [GcpAuth](#gcpauth)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[ObjectName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#objectname)_ | The name of the referenced credential. |  | Required: \{\} <br /> |
| `group` _string_ | The API group of the referenced credential.<br />Empty selects the core API group. |  | Optional: \{\} <br /> |
| `kind` _string_ | The kind of the referenced credential.<br />Empty defaults to `Secret`. |  | Optional: \{\} <br /> |


#### LogTracingAttributes







_Appears in:_
- [AccessLog](#accesslog)
- [Tracing](#tracing)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `remove` _[TinyString](#tinystring) array_ | Default fields to remove. For example,<br />`http.method`. |  | MaxItems: 32 <br />MaxLength: 64 <br />MinItems: 1 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `add` _[AttributeAdd](#attributeadd) array_ | Additional key-value pairs to add to each entry.<br />The value is a CEL expression. If the CEL expression fails to evaluate,<br />the pair will be excluded. |  | MinItems: 1 <br />Optional: \{\} <br /> |




#### MCPAuthentication







_Appears in:_
- [BackendMCP](#backendmcp)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `resourceMetadata` _object (keys:string, values:[JSON](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#json-v1-apiextensions-k8s-io))_ | Metadata to use for MCP resources. |  | Optional: \{\} <br /> |
| `provider` _[McpIDP](#mcpidp)_ | Identity provider to use for authentication. |  | Enum: [Auth0 Keycloak Okta] <br />Optional: \{\} <br /> |
| `issuer` _[ShortString](#shortstring)_ | IdP that issued the JWT. This corresponds to the<br />`iss` claim ([RFC 7519 §4.1.1](https://tools.ietf.org/html/rfc7519#section-4.1.1)). |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `audiences` _string array_ | Allowed audiences that are allowed<br />access. This corresponds to the `aud` claim<br />([RFC 7519 §4.1.3](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3)).<br />If unset, any audience is allowed. |  | MaxItems: 64 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `jwks` _[RemoteJWKS](#remotejwks)_ | Remote JSON Web Key used to validate the signature of<br />the JWT. |  | Required: \{\} <br /> |
| `mode` _[JWTAuthenticationMode](#jwtauthenticationmode)_ | Validation mode for JWT authentication. | Strict | Optional: \{\} <br /> |
| `clientId` _string_ | Client ID to use for short-circuiting Dynamic Client Registration.<br />If set, the gateway will not proxy registration requests to the IDP and instead return this client ID. |  | Optional: \{\} <br /> |


#### MCPBackend



MCP backend settings.



_Appears in:_
- [AgentgatewayBackendSpec](#agentgatewaybackendspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `targets` _[McpTargetSelector](#mcptargetselector) array_ | MCP targets to use for this backend. Policies<br />targeting MCP targets must use `targetRefs[].sectionName` to select<br />the target by name. |  | ExactlyOneOf: [selector static] <br />MaxItems: 32 <br />MinItems: 1 <br />Required: \{\} <br /> |
| `sessionRouting` _[SessionRouting](#sessionrouting)_ | MCP session routing behavior.<br />Defaults to `Stateful` if not set. |  | Optional: \{\} <br /> |
| `failureMode` _[FailureMode](#failuremode)_ | Behavior when MCP targets fail to initialize or<br />become unavailable at runtime. `FailOpen` skips failed targets and<br />continues serving from healthy ones. `FailClosed` (default) fails the<br />entire session if any target fails. |  | Optional: \{\} <br /> |


#### MCPGuardrails



MCPGuardrails is the MCP-layer analog of Envoy ext_authz: an ordered chain of
policy processors invoked per JSON-RPC method.



_Appears in:_
- [BackendMCP](#backendmcp)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `processors` _[MCPGuardrailsProcessor](#mcpguardrailsprocessor) array_ | `processors` is the ordered list of policy processors applied to matched<br />methods. Processors run in the order listed; the first to reject a request<br />short-circuits the chain. |  | ExactlyOneOf: [remote] <br />MaxItems: 16 <br />MinItems: 1 <br />Required: \{\} <br /> |


#### MCPGuardrailsProcessor



MCPGuardrailsProcessor selects a single policy processor. Exactly one variant must be set.

_Validation:_
- ExactlyOneOf: [remote]

_Appears in:_
- [MCPGuardrails](#mcpguardrails)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `remote` _[MCPGuardrailsRemote](#mcpguardrailsremote)_ | `remote` configures a gRPC policy server. |  | Optional: \{\} <br /> |
| `methods` _object (keys:string, values:[MCPMethodPhase](#mcpmethodphase))_ | `methods` is the allowlist of JSON-RPC methods (e.g. `tools/call`,<br />`tools/list`) routed through this processor, keyed by method name with the<br />phase it runs in. Keys may be exact, a prefix wildcard (`tools/*`), a suffix<br />wildcard (`*/list`), or `*` for all methods; the most specific match wins.<br />Methods matching no key, including unknown ones, bypass this processor. |  | MaxProperties: 64 <br />MinProperties: 1 <br />Required: \{\} <br /> |


#### MCPGuardrailsRemote







_Appears in:_
- [MCPGuardrailsProcessor](#mcpguardrailsprocessor)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | `backendRef` references the remote guardrails policy server.<br />Supported types: `Service` and `Backend`. |  | Required: \{\} <br /> |
| `failureMode` _[FailureMode](#failuremode)_ | `failureMode` controls behavior when the policy server is unreachable<br />or returns an error. `FailOpen` allows the request; `FailClosed`<br />(default) denies it. |  | Optional: \{\} <br /> |
| `metadata` _object (keys:string, values:[CELExpression](#celexpression))_ | Refer to Kubernetes API documentation for fields of `metadata`. |  | MaxProperties: 64 <br />Optional: \{\} <br /> |
| `allowedRequestHeaders` _[HeaderName](#headername) array_ | `allowedRequestHeaders` lists the incoming request headers forwarded to<br />the policy server in `McpRequest.headers`. If empty, all headers and<br />pseudo-headers (`:authority`, `:method`, ...) are forwarded. Matching is<br />case-insensitive. |  | MaxItems: 64 <br />MaxLength: 256 <br />MinLength: 1 <br />Pattern: `^:?[A-Za-z0-9!#$%&'*+\-.^_\x60\|~]+$` <br />Optional: \{\} <br /> |
| `disallowedRequestHeaders` _[HeaderName](#headername) array_ | `disallowedRequestHeaders` lists header names never forwarded to the<br />policy server, even if listed in `allowedRequestHeaders`. Matching is<br />case-insensitive. |  | MaxItems: 64 <br />MaxLength: 256 <br />MinLength: 1 <br />Pattern: `^:?[A-Za-z0-9!#$%&'*+\-.^_\x60\|~]+$` <br />Optional: \{\} <br /> |


#### MCPMethodPhase

_Underlying type:_ _string_

MCPMethodPhase controls when an MCP method is run through the guardrails pipeline.



_Appears in:_
- [MCPGuardrailsProcessor](#mcpguardrailsprocessor)

| Field | Description |
| --- | --- |
| `Off` |  |
| `Request` |  |
| `Response` |  |
| `Full` |  |


#### MCPProtocol

_Underlying type:_ _string_

Protocol to use for an MCP target.



_Appears in:_
- [McpTarget](#mcptarget)

| Field | Description |
| --- | --- |
| `StreamableHTTP` | MCPProtocolStreamableHTTP specifies that `StreamableHTTP` must be used as<br />the protocol.<br /> |
| `SSE` | MCPProtocolSSE specifies that Server-Sent Events (`SSE`) must be used as<br />the protocol.<br /> |


#### McpIDP

_Underlying type:_ _string_





_Appears in:_
- [JWTMCPConfig](#jwtmcpconfig)
- [MCPAuthentication](#mcpauthentication)

| Field | Description |
| --- | --- |
| `Auth0` |  |
| `Keycloak` |  |
| `Okta` |  |


#### McpSelector







_Appears in:_
- [McpTargetSelector](#mcptargetselector)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `namespaces` _[LabelSelector](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#labelselector-v1-meta)_ | `namespace` is the label selector for namespaces that `Service`<br />resources should be selected from. If unset, only the namespace of the<br />`AgentgatewayBackend` is searched. |  | Optional: \{\} <br /> |
| `services` _[LabelSelector](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#labelselector-v1-meta)_ | `services` is the label selector for which `Service` resources should be<br />selected. |  | Optional: \{\} <br /> |


#### McpTarget



MCP target configuration.

_Validation:_
- ExactlyOneOf: [host backendRef]

_Appears in:_
- [McpTargetSelector](#mcptargetselector)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `host` _[ShortString](#shortstring)_ | Hostname or IP address of the MCP target. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `backendRef` _[LocalObjectReference](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#localobjectreference-v1-core)_ | Namespace-local `Service` resource by name.<br />When set, this replaces `host` only; `port`, `path`, and `protocol`<br />remain configured on this target. |  | Optional: \{\} <br /> |
| `port` _integer_ | Port number of the MCP target. |  | Maximum: 65535 <br />Minimum: 1 <br />Required: \{\} <br /> |
| `path` _[LongString](#longstring)_ | URL path of the MCP target endpoint.<br />Defaults to `"/sse"` for the `SSE` protocol or `"/mcp"` for the<br />`StreamableHTTP` protocol if not specified. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `protocol` _[MCPProtocol](#mcpprotocol)_ | Protocol to use for the connection to the MCP<br />target. |  | Optional: \{\} <br /> |
| `policies` _[BackendSimple](#backendsimple)_ | Policies for communicating with this backend.<br />Policies may also be set in `AgentgatewayPolicy`, or in the top-level<br />`AgentgatewayBackend`. Policies are merged on a field-level basis, with<br />order: `AgentgatewayPolicy` < `AgentgatewayBackend` < `AgentgatewayBackend` MCP (this field).<br />This field may only be used with host-based static targets, not<br />`backendRef`. |  | Optional: \{\} <br /> |


#### McpTargetSelector



MCP target selection for this backend.

_Validation:_
- ExactlyOneOf: [selector static]

_Appears in:_
- [MCPBackend](#mcpbackend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[SectionName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#sectionname)_ | Name of the MCP target. |  | Required: \{\} <br /> |
| `selector` _[McpSelector](#mcpselector)_ | Label selector used to select `Service` resources.<br />If policies are needed on a per-service basis, `AgentgatewayPolicy` can<br />target the desired `Service`. |  | Optional: \{\} <br /> |
| `static` _[McpTarget](#mcptarget)_ | Static MCP destination. When connecting to<br />in-cluster `Service` resources, it is recommended to use `selector`<br />instead. |  | ExactlyOneOf: [host backendRef] <br />Optional: \{\} <br /> |


#### Message



An entry for a message to prepend or append to each prompt.



_Appears in:_
- [AIPromptEnrichment](#aipromptenrichment)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `role` _string_ | Role of the message. The available roles depend on the backend<br />LLM provider model, such as `SYSTEM` or `USER` in the OpenAI API. |  | Required: \{\} <br /> |
| `content` _string_ | String content of the message. |  | Required: \{\} <br /> |


#### MetricAttributes







_Appears in:_
- [MetricLabels](#metriclabels)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `add` _[AttributeAdd](#attributeadd) array_ | Additional key-value pairs to add as custom labels<br />to all Prometheus metrics. The value is a CEL expression evaluated<br />per-request. If the CEL expression fails to evaluate, the label value<br />is set to "unknown".<br />WARNING: High-cardinality labels (e.g., per-user IDs) can significantly<br />increase Prometheus storage and memory usage. Prefer low-cardinality<br />dimensions like team or environment. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### MetricLabels



Custom labels to add to Prometheus metrics.



_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `attributes` _[MetricAttributes](#metricattributes)_ | Customizations to the labels that are<br />added to Prometheus metrics. |  | Required: \{\} <br /> |


#### ModelCatalogConfigMapRef



ModelCatalogConfigMapRef identifies a ConfigMap holding model cost catalog JSON.
The ConfigMap must be in the same namespace as the Gateway that references it.



_Appears in:_
- [ModelCatalogSource](#modelcatalogsource)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _string_ |  |  | MinLength: 1 <br />Required: \{\} <br /> |
| `key` _string_ | Data key whose value is the catalog JSON. Defaults to "catalog.json". |  | Optional: \{\} <br /> |


#### ModelCatalogSource



ModelCatalogSource is a single source of model cost catalog data.



_Appears in:_
- [ModelCatalogSpec](#modelcatalogspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `configMap` _[ModelCatalogConfigMapRef](#modelcatalogconfigmapref)_ |  |  | Optional: \{\} <br /> |


#### ModelCatalogSpec



ModelCatalogSpec configures model cost catalog sources for the agentgateway proxy.



_Appears in:_
- [AgentgatewayParametersConfigs](#agentgatewayparametersconfigs)
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `sources` _[ModelCatalogSource](#modelcatalogsource) array_ |  |  | Optional: \{\} <br /> |


#### NamedLLMProvider







_Appears in:_
- [PriorityGroup](#prioritygroup)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[SectionName](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#sectionname)_ | Name of the provider. Policies can target this provider by name. |  | Required: \{\} <br /> |
| `policies` _[BackendWithAI](#backendwithai)_ | Policies for communicating with this backend.<br />Policies may also be set in `AgentgatewayPolicy`, or in the top-level<br />`AgentgatewayBackend`. Policies are merged on a field-level basis, with<br />order: `AgentgatewayPolicy` < `AgentgatewayBackend` < `AgentgatewayBackend`<br />LLM provider (this field). |  | Optional: \{\} <br /> |
| `openai` _[OpenAIConfig](#openaiconfig)_ | OpenAI provider settings. |  | Optional: \{\} <br /> |
| `azureopenai` _[AzureOpenAIConfig](#azureopenaiconfig)_ | Azure OpenAI provider settings. |  | Optional: \{\} <br /> |
| `azure` _[AzureConfig](#azureconfig)_ | Azure provider with resource-based configuration.<br />Supports both Azure OpenAI and Azure AI Foundry resource types. |  | Optional: \{\} <br /> |
| `anthropic` _[AnthropicConfig](#anthropicconfig)_ | Anthropic provider settings. |  | Optional: \{\} <br /> |
| `gemini` _[GeminiConfig](#geminiconfig)_ | Gemini provider settings. |  | Optional: \{\} <br /> |
| `vertexai` _[VertexAIConfig](#vertexaiconfig)_ | Vertex AI provider settings. |  | Optional: \{\} <br /> |
| `bedrock` _[BedrockConfig](#bedrockconfig)_ | Bedrock provider settings. |  | Optional: \{\} <br /> |
| `custom` _[CustomProvider](#customprovider)_ | Custom provider configures a non-managed or self-hosted LLM provider.<br />Use this when the provider target and API formats should be declared<br />explicitly instead of inferred from a managed provider such as OpenAI or<br />Anthropic. |  | Optional: \{\} <br /> |
| `host` _[ShortString](#shortstring)_ | Hostname to send requests to.<br />For custom providers without backendRef, host and port specify the target.<br />For managed providers, host and port override the provider default. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `port` _integer_ | Port to send requests to. |  | Maximum: 65535 <br />Minimum: 1 <br />Optional: \{\} <br /> |
| `path` _[LongString](#longstring)_ | URL path to use for LLM provider API requests.<br />This is useful when you need to route requests to a different API endpoint while maintaining<br />compatibility with the original provider's API structure.<br />If not specified, the default path for the provider is used. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `pathPrefix` _[LongString](#longstring)_ | Overrides the default base path prefix, such as `/v1`, for upstream requests.<br />Path translation for cross-format requests still applies using this prefix.<br />Only supported for OpenAI and Anthropic providers. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |




#### OTLPProtocol

_Underlying type:_ _string_





_Appears in:_
- [OtlpAccessLog](#otlpaccesslog)
- [Tracing](#tracing)

| Field | Description |
| --- | --- |
| `HTTP` |  |
| `GRPC` |  |


#### ObjectMetadata



ObjectMetadata contains labels and annotations for metadata overlays.



_Appears in:_
- [KubernetesResourceOverlay](#kubernetesresourceoverlay)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `labels` _object (keys:string, values:string)_ | Map of string keys and values that can be used to organize and categorize<br />(scope and select) objects. May match selectors of replication controllers<br />and services.<br />More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels |  | Optional: \{\} <br /> |
| `annotations` _object (keys:string, values:string)_ | Annotations is an unstructured key value map stored with a resource that may be<br />set by external tools to store and retrieve arbitrary metadata. They are not<br />queryable and should be preserved when modifying objects.<br />More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations |  | Optional: \{\} <br /> |


#### OpenAIConfig



Settings for the [OpenAI](https://developers.openai.com/api/docs/guides/streaming-responses) LLM provider.



_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `model` _[ShortString](#shortstring)_ | Model name override, such as `gpt-4o-mini`.<br />If unset, the model name is taken from the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### OpenAIModeration







_Appears in:_
- [PromptguardRequest](#promptguardrequest)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `model` _string_ | Moderation model to use. For example,<br />`omni-moderation`. |  | Optional: \{\} <br /> |
| `policies` _[BackendSimple](#backendsimple)_ | Policies for communicating with OpenAI. |  | Optional: \{\} <br /> |


#### OtlpAccessLog



Ships access logs to an
OpenTelemetry-compatible backend via OTLP.



_Appears in:_
- [AccessLog](#accesslog)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | OTLP server to send access logs to.<br />Supported types: `Service` and `AgentgatewayBackend`. |  | Required: \{\} <br /> |
| `protocol` _[OTLPProtocol](#otlpprotocol)_ | OTLP protocol variant to use. | GRPC | Optional: \{\} <br /> |
| `path` _[LongString](#longstring)_ | OTLP/HTTP path to use. This is only applicable<br />when `protocol` is `HTTP`. If unset, this defaults to `/v1/logs`. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### PolicyAncestorStatus







_Appears in:_
- [PolicyStatus](#policystatus)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `ancestorRef` _[ParentReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#parentreference)_ | The ancestor resource that this status entry describes. |  | Required: \{\} <br /> |
| `controllerName` _string_ | The controller that wrote this status entry.<br />Example: `example.net/gateway-controller`. |  | Required: \{\} <br /> |
| `conditions` _[Condition](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#condition-v1-meta) array_ | Conditions for this policy's effect on the specified ancestor. |  | MaxItems: 8 <br />MinItems: 1 <br />Optional: \{\} <br /> |








#### PolicyInheritance

_Underlying type:_ _string_

How a traffic policy affects policy inheritance across attachment
specificity levels.



_Appears in:_
- [PolicyStrategy](#policystrategy)

| Field | Description |
| --- | --- |
| `Default` | PolicyInheritanceDefault allows the normal traffic policy merge order, where more-specific<br />policies may override fields from less-specific policies.<br /> |
| `Override` | PolicyInheritanceOverride makes the policy authoritative for lower levels, excluding<br />more-specific traffic policies from the effective policy.<br /> |


#### PolicyPhase

_Underlying type:_ _string_





_Appears in:_
- [Traffic](#traffic)

| Field | Description |
| --- | --- |
| `PreRouting` |  |
| `PostRouting` |  |




#### PolicyStrategy







_Appears in:_
- [AgentgatewayPolicySpec](#agentgatewaypolicyspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `inheritance` _[PolicyInheritance](#policyinheritance)_ | Controls whether less-specific traffic policies prevent more-specific traffic policies<br />from contributing to the effective policy.<br />This field is only valid on traffic policies. Frontend and backend policy merging does not use<br />inheritance.<br />When unset or set to `Default`, traffic policy fields are merged by specificity, with more-specific<br />attachment points such as routes and route rules able to override fields from less-specific<br />attachment points such as gateways and listeners.<br />In other words, this policy provides `Default`s that can be overridden. For example, you may provide a `Default`<br />timeout policy for the entire Gateway that is overridden by specific routes.<br />When set to `Override`, this policy blocks traffic policies at more-specific attachment points from<br />being included in the effective policy. This is useful when a gateway-level policy must remain<br />authoritative for all routes below it. |  | Optional: \{\} <br /> |


#### PriorityGroup







_Appears in:_
- [AIBackend](#aibackend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `providers` _[NamedLLMProvider](#namedllmprovider) array_ | LLM providers within this group. Each provider is treated equally in terms of priority,<br />with automatic weighting based on health. |  | MaxItems: 16 <br />MinItems: 1 <br />Required: \{\} <br /> |


#### ProcessingOptions



External processor request and response phase settings.



_Appears in:_
- [ExtProc](#extproc)
- [ExtProcOrConditional](#extprocorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `requestBodyMode` _[BodySendMode](#bodysendmode)_ | How request bodies are sent to the external processor.<br />`Buffered` buffers the full body and returns an error if it exceeds 8KB.<br />`BufferedPartial` buffers up to 8KB and sends the buffered prefix if the<br />body exceeds that limit. Defaults to `FullDuplexStreamed`. | FullDuplexStreamed | Enum: [None Buffered BufferedPartial FullDuplexStreamed] <br />Optional: \{\} <br /> |
| `responseBodyMode` _[BodySendMode](#bodysendmode)_ | How response bodies are sent to the external processor.<br />`Buffered` buffers the full body and returns an error if it exceeds 8KB.<br />`BufferedPartial` buffers up to 8KB and sends the buffered prefix if the<br />body exceeds that limit. Defaults to `FullDuplexStreamed`. | FullDuplexStreamed | Enum: [None Buffered BufferedPartial FullDuplexStreamed] <br />Optional: \{\} <br /> |
| `requestHeaderMode` _[HeaderSendMode](#headersendmode)_ | Whether request headers are sent to the external processor.<br />Defaults to `Send`. | Send | Enum: [Send Skip] <br />Optional: \{\} <br /> |
| `responseHeaderMode` _[HeaderSendMode](#headersendmode)_ | Whether response headers are sent to the external processor.<br />Defaults to `Send`. | Send | Enum: [Send Skip] <br />Optional: \{\} <br /> |
| `requestTrailerMode` _[TrailerSendMode](#trailersendmode)_ | Whether request trailers are sent to the external processor.<br />Defaults to `Send`. | Send | Enum: [Skip Send] <br />Optional: \{\} <br /> |
| `responseTrailerMode` _[TrailerSendMode](#trailersendmode)_ | Whether response trailers are sent to the external processor.<br />Defaults to `Send`. | Send | Enum: [Skip Send] <br />Optional: \{\} <br /> |
| `allowModeOverride` _boolean_ | Allows ext_proc `mode_override` values from matching header responses to update<br />subsequent request/response processing phases for this exchange. Defaults to `false`. | false | Optional: \{\} <br /> |


#### PromptCachingConfig



Automatic prompt caching for supported LLM providers.
Currently only AWS Bedrock supports this feature (Claude 3+ and Nova models).

When enabled, the gateway automatically inserts cache points at strategic locations
to reduce API costs. Bedrock charges lower rates for cached tokens (90% discount).

Example:

	promptCaching:
	  cacheSystem: true
	  cacheMessages: true
	  cacheTools: false

Cost savings example:
- Without caching: 10,000 tokens × $3/MTok = $0.03
- With caching (90% cached): 1,000 × $3/MTok + 9,000 × $0.30/MTok = $0.0057 (81% savings)



_Appears in:_
- [BackendAI](#backendai)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `cacheSystem` _boolean_ | Enables caching for system prompts.<br />Inserts a cache point after all system messages. | true | Optional: \{\} <br /> |
| `cacheMessages` _boolean_ | Enables caching for conversation messages.<br />Caches all messages in the conversation for cost savings. | true | Optional: \{\} <br /> |
| `cacheTools` _boolean_ | Enables caching for tool definitions.<br />Inserts a cache point after all tool specifications. | false | Optional: \{\} <br /> |
| `minTokens` _integer_ | Minimum estimated token count<br />before caching is enabled. Uses rough heuristic (word count × 1.3) to estimate tokens.<br />Bedrock requires at least 1,024 tokens for caching to be effective. | 1024 | Minimum: 0 <br />Optional: \{\} <br /> |
| `cacheMessageOffset` _integer_ | Shifts the message cache point further back in the<br />conversation. 0 (default) places it at the second-to-last message.<br />Higher values move it N additional messages towards the start, clamped<br />to bounds. | 0 | Minimum: 0 <br />Optional: \{\} <br /> |


#### PromptGuardStreamingMode

_Underlying type:_ _string_

Streaming prompt guard mode.



_Appears in:_
- [AIPromptGuard](#aipromptguard)

| Field | Description |
| --- | --- |
| `Enabled` | Enable prompt guards for streaming responses and realtime websocket messages.<br /> |


#### PromptguardRequest



Prompt guards to apply to requests sent by the client.

_Validation:_
- ExactlyOneOf: [regex webhook openAIModeration bedrockGuardrails googleModelArmor]

_Appears in:_
- [AIPromptGuard](#aipromptguard)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `response` _[CustomResponse](#customresponse)_ | Custom response message to return to the client. If not specified, defaults to<br />`The request was rejected due to inappropriate content`. |  | Optional: \{\} <br /> |
| `regex` _[Regex](#regex)_ | Regular expression (regex) matching for prompt guards and data masking. |  | Optional: \{\} <br /> |
| `webhook` _[Webhook](#webhook)_ | Webhook that receives requests for prompt guarding. |  | Optional: \{\} <br /> |
| `openAIModeration` _[OpenAIModeration](#openaimoderation)_ | Passes prompt data through the OpenAI Moderations<br />endpoint.<br />See https://developers.openai.com/api/reference/resources/moderations for more information. |  | Optional: \{\} <br /> |
| `bedrockGuardrails` _[BedrockGuardrails](#bedrockguardrails)_ | AWS Bedrock Guardrails settings for prompt<br />guarding. |  | Optional: \{\} <br /> |
| `googleModelArmor` _[GoogleModelArmor](#googlemodelarmor)_ | Google Model Armor settings for prompt guarding. |  | Optional: \{\} <br /> |


#### PromptguardResponse



Prompt guards to apply to responses returned by the LLM provider.

_Validation:_
- ExactlyOneOf: [regex webhook bedrockGuardrails googleModelArmor]

_Appears in:_
- [AIPromptGuard](#aipromptguard)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `response` _[CustomResponse](#customresponse)_ | Custom response message to return to the client. If not specified, defaults to<br />`The response was rejected due to inappropriate content`. |  | Optional: \{\} <br /> |
| `regex` _[Regex](#regex)_ | Regular expression (regex) matching for prompt guards and data masking. |  | Optional: \{\} <br /> |
| `webhook` _[Webhook](#webhook)_ | Webhook that receives responses for prompt guarding. |  | Optional: \{\} <br /> |
| `bedrockGuardrails` _[BedrockGuardrails](#bedrockguardrails)_ | AWS Bedrock Guardrails settings for prompt<br />guarding. |  | Optional: \{\} <br /> |
| `googleModelArmor` _[GoogleModelArmor](#googlemodelarmor)_ | Google Model Armor settings for prompt guarding. |  | Optional: \{\} <br /> |


#### ProviderFormat

_Underlying type:_ _string_

Provider-native LLM API format.



_Appears in:_
- [ProviderFormatConfig](#providerformatconfig)

| Field | Description |
| --- | --- |
| `Completions` | ProviderFormatCompletions is the OpenAI-compatible chat completions API.<br /> |
| `Messages` | ProviderFormatMessages is the Anthropic-compatible messages API.<br /> |
| `Responses` | ProviderFormatResponses is the OpenAI responses API.<br /> |
| `Embeddings` | ProviderFormatEmbeddings is the OpenAI-compatible embeddings API.<br /> |
| `AnthropicTokenCount` | ProviderFormatAnthropicTokenCount is the Anthropic token-count API.<br /> |
| `Realtime` | ProviderFormatRealtime is the OpenAI-compatible realtime API.<br /> |
| `Rerank` | ProviderFormatRerank is the Cohere-compatible rerank API.<br /> |


#### ProviderFormatConfig



Provider-native LLM API format settings.



_Appears in:_
- [CustomProvider](#customprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `type` _[ProviderFormat](#providerformat)_ | Provider-native API format. |  | Required: \{\} <br /> |
| `path` _[LongString](#longstring)_ | Default upstream path override for this format.<br />If unset, agentgateway uses the default path for the format. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### ProxyProtocolMode

_Underlying type:_ _string_





_Appears in:_
- [FrontendProxyProtocol](#frontendproxyprotocol)

| Field | Description |
| --- | --- |
| `Strict` | A valid PROXY header must be present. This is the default option.<br /> |
| `Optional` | Accept either a PROXY header or plain downstream traffic.<br /> |


#### ProxyProtocolVersion

_Underlying type:_ _string_





_Appears in:_
- [FrontendProxyProtocol](#frontendproxyprotocol)

| Field | Description |
| --- | --- |
| `V1` |  |
| `V2` |  |
| `All` |  |


#### RateLimitDescriptor







_Appears in:_
- [GlobalRateLimit](#globalratelimit)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `entries` _[RateLimitDescriptorEntry](#ratelimitdescriptorentry) array_ | Individual components that make up this descriptor. |  | MaxItems: 16 <br />MinItems: 1 <br />Required: \{\} <br /> |
| `unit` _[RateLimitUnit](#ratelimitunit)_ | Cost unit. If unspecified,<br />`Requests` is used. |  | Optional: \{\} <br /> |
| `cost` _[CELExpression](#celexpression)_ | Common Expression Language (`CEL`) expression that determines<br />the cost of the request for this descriptor. If unset, `Requests` costs<br />default to 1, and `Tokens` costs default to the total token count.<br />`Tokens` cost are evaluated after the request has completed. For non-streaming requests, `request`, `llm`, and<br />`response` fields are all available; for streaming requests, `response` is not available (however, all LLM<br />attributes are in `llm`). For `Requests`, cost is computed during the request phase.<br />See https://agentgateway.dev/docs/standalone/latest/reference/cel/ for more info. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### RateLimitDescriptorEntry



Entry in a rate limit descriptor.



_Appears in:_
- [RateLimitDescriptor](#ratelimitdescriptor)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[TinyString](#tinystring)_ | Name of the descriptor. |  | MaxLength: 64 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `expression` _[CELExpression](#celexpression)_ | Common Expression Language (`CEL`) expression that<br />defines the value for the descriptor.<br />For example, to rate limit based on the Client IP: `source.address`.<br />See https://agentgateway.dev/docs/standalone/latest/reference/cel/ for more info. |  | MaxLength: 16384 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### RateLimitUnit

_Underlying type:_ _string_





_Appears in:_
- [RateLimitDescriptor](#ratelimitdescriptor)

| Field | Description |
| --- | --- |
| `Tokens` |  |
| `Requests` |  |


#### RateLimits







_Appears in:_
- [RateLimitsConditional](#ratelimitsconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `local` _[LocalRateLimit](#localratelimit) array_ | Local rate limiting policy. |  | ExactlyOneOf: [requests tokens] <br />MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `global` _[GlobalRateLimit](#globalratelimit)_ | Global rate limiting policy using an external service. |  | Optional: \{\} <br /> |


#### RateLimitsConditional







_Appears in:_
- [RateLimitsOrConditional](#ratelimitsorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `condition` _[CELExpression](#celexpression)_ | CEL expression that must evaluate to true for this policy to execute. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `policy` _[RateLimits](#ratelimits)_ | Policy to apply when the condition matches. |  | Required: \{\} <br /> |


#### RateLimitsOrConditional







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `local` _[LocalRateLimit](#localratelimit) array_ | Local rate limiting policy. |  | ExactlyOneOf: [requests tokens] <br />MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `global` _[GlobalRateLimit](#globalratelimit)_ | Global rate limiting policy using an external service. |  | Optional: \{\} <br /> |
| `conditional` _[RateLimitsConditional](#ratelimitsconditional) array_ | Conditional policy execution. Set this or the top-level rateLimit fields.<br />The first matching policy will be executed.<br />A single policy may be provided without a condition set; if so, it must be the last policy and will be the fallback<br />in case no conditions are met. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### Regex



Regular expression matching for prompt guards and data masking.



_Appears in:_
- [PromptguardRequest](#promptguardrequest)
- [PromptguardResponse](#promptguardresponse)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `matches` _[LongString](#longstring) array_ | Regex patterns to match against the request or response.<br />Matches and built-ins are additive. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `builtins` _[BuiltIn](#builtin) array_ | Built-in regex patterns to match against the request or response.<br />Matches and built-ins are additive. |  | Optional: \{\} <br /> |
| `action` _[Action](#action)_ | The action to take if a regex pattern is matched in a request or response.<br />This setting applies only to request matches. `PromptguardResponse`<br />matches are always masked by default.<br />Defaults to `Mask`. | Mask | Optional: \{\} <br /> |


#### RemoteJWKS







_Appears in:_
- [JWKS](#jwks)
- [MCPAuthentication](#mcpauthentication)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `jwksPath` _string_ | Path to the IdP `jwks` endpoint, relative to the root, commonly<br />`".well-known/jwks.json"`. |  | MaxLength: 2000 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `cacheDuration` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ |  | 5m | Optional: \{\} <br /> |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | Remote JWKS server to reach.<br />Supported types are `Service` and static `Backend`. An<br />`AgentgatewayPolicy` containing backend TLS config can then be attached<br />to the `Service` or `Backend` in order to set TLS options for a<br />connection to the remote `jwks` source. |  | Required: \{\} <br /> |


#### ResourceAdd







_Appears in:_
- [Tracing](#tracing)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `name` _[ShortString](#shortstring)_ |  |  | MaxLength: 256 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `expression` _[CELExpression](#celexpression)_ |  |  | MaxLength: 16384 <br />MinLength: 1 <br />Required: \{\} <br /> |


#### Retry



Retry policy.



_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `precondition` _[CELExpression](#celexpression)_ | `precondition` is a CEL expression evaluated against the request before any<br />attempt is made. When it evaluates to `false`, retries are disabled and only<br />the initial attempt is made, for example `request.method == "GET"`.<br />Retrying requires buffering the request body in memory for replay, so this lets<br />us skip that cost when the request is known to be non-retriable (for example<br />streaming uploads or long-lived connections like websockets). |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `condition` _[CELExpression](#celexpression)_ | `condition` is a CEL expression evaluated against each response to decide<br />whether to retry. A response is retried when its status code is in `codes` or<br />this expression evaluates to `true`. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### RouteType

_Underlying type:_ _string_

How the AI gateway should process incoming requests
based on the URL path and the API format expected.



_Appears in:_
- [BackendAI](#backendai)

| Field | Description |
| --- | --- |
| `Completions` | RouteTypeCompletions processes OpenAI `/v1/chat/completions` format requests.<br /> |
| `Messages` | RouteTypeMessages processes Anthropic `/v1/messages` format requests.<br /> |
| `Models` | RouteTypeModels handles the `/v1/models` endpoint.<br /> |
| `Passthrough` | RouteTypePassthrough sends requests upstream as-is without LLM processing.<br /> |
| `Detect` | RouteTypeDetect sends requests as-is but attempts to extract<br />request/response metadata for telemetry and rate limiting.<br /> |
| `Responses` | RouteTypeResponses processes OpenAI `/v1/responses` format requests.<br /> |
| `AnthropicTokenCount` | RouteTypeAnthropicTokenCount processes Anthropic<br />`/v1/messages/count_tokens` format requests.<br /> |
| `Embeddings` | RouteTypeEmbeddings processes OpenAI `/v1/embeddings` format requests.<br /> |
| `Realtime` | RouteTypeRealtime processes OpenAI `/v1/realtime` requests.<br /> |
| `Rerank` | RouteTypeRerank processes Cohere `/v2/rerank` format requests.<br /> |




#### SecretSelector







_Appears in:_
- [APIKeyAuthentication](#apikeyauthentication)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `matchLabels` _object (keys:string, values:string)_ | Labels that must be present on each selected Secret. |  | Required: \{\} <br /> |


#### SessionRouting

_Underlying type:_ _string_





_Appears in:_
- [MCPBackend](#mcpbackend)

| Field | Description |
| --- | --- |
| `Stateful` | `Stateful` mode creates an MCP session (via `mcp-session-id`) and<br />internally<br />ensures requests for that session are routed to a consistent backend replica.<br /> |
| `Stateless` |  |




#### ShutdownSpec







_Appears in:_
- [AgentgatewayParametersConfigs](#agentgatewayparametersconfigs)
- [AgentgatewayParametersSpec](#agentgatewayparametersspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `min` _integer_ | Minimum time (in seconds) to wait before allowing Agentgateway to<br />terminate. Refer to the `CONNECTION_MIN_TERMINATION_DEADLINE`<br />environment variable for details. |  | Maximum: 3.1536e+07 <br />Minimum: 0 <br />Required: \{\} <br /> |
| `max` _integer_ | Maximum time (in seconds) to wait before allowing Agentgateway to<br />terminate. Refer to the `TERMINATION_GRACE_PERIOD_SECONDS`<br />environment variable for details. |  | Maximum: 3.1536e+07 <br />Minimum: 0 <br />Required: \{\} <br /> |


#### StaticBackend



Static backend endpoint, either TCP (`host` and `port`) or Unix Domain Socket.



_Appears in:_
- [AgentgatewayBackendSpec](#agentgatewaybackendspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `host` _[ShortString](#shortstring)_ | Host to connect to for TCP backends. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `port` _integer_ | Port to connect to for TCP backends. |  | Maximum: 65535 <br />Minimum: 1 <br />Optional: \{\} <br /> |
| `unixPath` _string_ | Filesystem path to a Unix Domain Socket. The gateway pod<br />must share a volume with the target (e.g., via emptyDir sidecar pattern).<br />Mutually exclusive with host/port. |  | MinLength: 1 <br />Optional: \{\} <br /> |


#### TLSVersion

_Underlying type:_ _string_





_Appears in:_
- [FrontendTLS](#frontendtls)

| Field | Description |
| --- | --- |
| `1.2` | agentgateway currently only supports `TLS 1.2` and `TLS 1.3`.<br /> |
| `1.3` |  |


#### Timeouts







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `request` _[Duration](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.31/#duration-v1-meta)_ | Timeout for an individual request from the gateway to a backend. This covers the time from when<br />the request first starts being sent from the gateway to when the full response has been received from the backend. |  | Optional: \{\} <br /> |




#### Tracing







_Appears in:_
- [Frontend](#frontend)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | OTLP server to reach.<br />Supported types: `Service` and `AgentgatewayBackend`. |  | Required: \{\} <br /> |
| `protocol` _[OTLPProtocol](#otlpprotocol)_ | OTLP protocol variant to use. | GRPC | Optional: \{\} <br /> |
| `path` _[LongString](#longstring)_ | OTLP path to use. This is only applicable when<br />`protocol` is `HTTP`. If unset, this defaults to `/v1/traces`. |  | MaxLength: 1024 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `attributes` _[LogTracingAttributes](#logtracingattributes)_ | Customizations to the key-value pairs that are<br />included in the trace. |  | Optional: \{\} <br /> |
| `resources` _[ResourceAdd](#resourceadd) array_ | Entity producing telemetry and resources<br />resources to be included in the trace. |  | Optional: \{\} <br /> |
| `randomSampling` _[CELExpression](#celexpression)_ | Expression that determines the amount of random<br />sampling. Random sampling will initiate a new trace span if the incoming<br />request does not have a trace initiated already. This should evaluate to<br />a float between `0.0` and `1.0`, or a boolean (`true` or `false`). If<br />unspecified, random sampling is disabled. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `clientSampling` _[CELExpression](#celexpression)_ | Expression that determines the amount of client<br />sampling. Client sampling determines whether to initiate a new trace<br />span if the incoming request does have a trace already. This should<br />evaluate to a float between `0.0` and `1.0`, or a boolean (`true` or<br />`false`). If unspecified, client sampling is `100%` enabled. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `filter` _[CELExpression](#celexpression)_ | Expression that determines whether a sampled span is exported.<br />This uses keep semantics: spans are exported only when the expression<br />evaluates to `true`. If unspecified, all sampled spans are exported. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### Traffic







_Appears in:_
- [AgentgatewayPolicySpec](#agentgatewaypolicyspec)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `phase` _[PolicyPhase](#policyphase)_ | The phase to apply the traffic policy to. If the phase is `PreRouting`,<br />the `targetRef` must be a `Gateway` or a `Listener`. `PreRouting` is<br />typically used only when a policy needs to influence the routing<br />decision.<br />Even when using `PostRouting` mode, the policy can target the<br />`Gateway` or `Listener`. This is a helper for applying the policy to all<br />routes under that `Gateway` or `Listener`, and follows the merging logic<br />described above.<br />Note: `PreRouting` and `PostRouting` rules do not merge together. These<br />are independent execution phases. That is, all `PreRouting` rules will<br />merge and execute, then all `PostRouting` rules will merge and execute.<br />If unset, this defaults to `PostRouting`. |  | Optional: \{\} <br /> |
| `transformation` _[TransformationOrConditional](#transformationorconditional)_ | Mutates and transforms requests and responses<br />before forwarding them to the destination. |  | Optional: \{\} <br /> |
| `extProc` _[ExtProcOrConditional](#extprocorconditional)_ | External processing configuration for the policy. |  | Optional: \{\} <br /> |
| `extAuth` _[ExtAuthOrConditional](#extauthorconditional)_ | External authentication configuration for the policy.<br />This selects the external server to send requests to for authentication.<br />An extAuth policy can be conditionally set by nesting configuration under the `conditional` field. |  | Optional: \{\} <br /> |
| `rateLimit` _[RateLimitsOrConditional](#ratelimitsorconditional)_ | Rate limiting configuration for the policy.<br />This limits the rate at which requests are processed. |  | Optional: \{\} <br /> |
| `cors` _[CORS](#cors)_ | CORS configuration for the policy. |  | Optional: \{\} <br /> |
| `csrf` _[CSRF](#csrf)_ | Cross-Site Request Forgery (CSRF) policy for this traffic policy.<br />The CSRF policy has the following behavior:<br />* Safe methods (`GET`, `HEAD`, `OPTIONS`) are automatically allowed.<br />* Requests without `Sec-Fetch-Site` or `Origin` headers are assumed to<br />  be same-origin or non-browser requests and are allowed.<br />* Otherwise, the `Sec-Fetch-Site` header is checked, with a fallback to<br />  comparing the `Origin` header to the `Host` header. |  | Optional: \{\} <br /> |
| `headerModifiers` _[HeaderModifiers](#headermodifiers)_ | Request and response header modification policy. |  | Optional: \{\} <br /> |
| `hostRewrite` _[HostnameRewrite](#hostnamerewrite)_ | How to rewrite the `Host` header for requests.<br />If the `HTTPRoute` `urlRewrite` filter already specifies a host rewrite,<br />this setting is ignored. |  | Optional: \{\} <br /> |
| `timeouts` _[Timeouts](#timeouts)_ | Request timeouts.<br />It is applicable to `HTTPRoute` resources and ignored for other targeted<br />kinds. |  | Optional: \{\} <br /> |
| `retry` _[Retry](#retry)_ | Retry policy. |  | Optional: \{\} <br /> |
| `authorization` _[Authorization](#authorization)_ | Access rules based on roles and<br />permissions.<br />If multiple authorization rules are applied across different policies, at the same or different attachment points,<br />all rules are merged. |  | Optional: \{\} <br /> |
| `jwtAuthentication` _[JWTAuthentication](#jwtauthentication)_ | Authenticates users based on JWT tokens. |  | Optional: \{\} <br /> |
| `basicAuthentication` _[BasicAuthentication](#basicauthentication)_ | Authenticates users based on the `Basic`<br />authentication scheme (RFC 7617), where a username and password are<br />encoded in the request. |  | ExactlyOneOf: [users secretRef] <br />Optional: \{\} <br /> |
| `apiKeyAuthentication` _[APIKeyAuthentication](#apikeyauthentication)_ | Authenticates users based on a configured API<br />key. |  | ExactlyOneOf: [secretRef secretSelector] <br />Optional: \{\} <br /> |
| `directResponse` _[DirectResponseOrConditional](#directresponseorconditional)_ | Sends a direct response to the<br />client. |  | Optional: \{\} <br /> |
| `buffer` _[Buffer](#buffer)_ | Buffers request and response bodies. Buffered bodies are accumulated in memory<br />by the proxy until completion before being forwarded. This changes the proxies default behavior, which streams bodies.<br />Warning: large bodies can lead to excessive memory usage in the proxy. Utilize with care, or with strict limits. |  | Optional: \{\} <br /> |


#### TrailerSendMode

_Underlying type:_ _string_

Whether HTTP trailers are delivered to the external processor.

_Validation:_
- Enum: [Skip Send]

_Appears in:_
- [ProcessingOptions](#processingoptions)

| Field | Description |
| --- | --- |
| `Skip` | TrailerSendModeSkip does not send trailers to the external processor.<br /> |
| `Send` | TrailerSendModeSend sends trailers to the external processor.<br /> |


#### Transform







_Appears in:_
- [Transformation](#transformation)
- [TransformationOrConditional](#transformationorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `set` _[HeaderTransformation](#headertransformation) array_ | Headers to set and the values to use. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `add` _[HeaderTransformation](#headertransformation) array_ | Headers to add to the request and what each value<br />should be set to. If there is already a header with these values then<br />append the value as an extra entry. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |
| `remove` _[HeaderName](#headername) array_ | Header names to remove from the request or<br />response. |  | MaxItems: 16 <br />MaxLength: 256 <br />MinItems: 1 <br />MinLength: 1 <br />Pattern: `^:?[A-Za-z0-9!#$%&'*+\-.^_\x60\|~]+$` <br />Optional: \{\} <br /> |
| `body` _[CELExpression](#celexpression)_ | HTTP body transformation. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `metadata` _object (keys:string, values:[CELExpression](#celexpression))_ | Refer to Kubernetes API documentation for fields of `metadata`. |  | MaxProperties: 16 <br />MinProperties: 1 <br />Optional: \{\} <br /> |


#### Transformation







_Appears in:_
- [BackendFull](#backendfull)
- [BackendWithAI](#backendwithai)
- [TransformationConditional](#transformationconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `request` _[Transform](#transform)_ | Request transformation settings. |  | Optional: \{\} <br /> |
| `response` _[Transform](#transform)_ | Response transformation settings. |  | Optional: \{\} <br /> |


#### TransformationConditional







_Appears in:_
- [TransformationOrConditional](#transformationorconditional)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `condition` _[CELExpression](#celexpression)_ | CEL expression that must evaluate to true for this policy to execute. |  | MaxLength: 16384 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `policy` _[Transformation](#transformation)_ | Policy to apply when the condition matches. |  | Required: \{\} <br /> |


#### TransformationOrConditional







_Appears in:_
- [Traffic](#traffic)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `request` _[Transform](#transform)_ | Request transformation settings. |  | Optional: \{\} <br /> |
| `response` _[Transform](#transform)_ | Response transformation settings. |  | Optional: \{\} <br /> |
| `conditional` _[TransformationConditional](#transformationconditional) array_ | Conditional policy execution. Set this or the top-level transformation fields.<br />The first matching policy will be executed.<br />A single policy may be provided without a condition set; if so, it must be the last policy and will be the fallback<br />in case no conditions are met. |  | MaxItems: 16 <br />MinItems: 1 <br />Optional: \{\} <br /> |


#### VertexAIConfig



Settings for the [Vertex AI](https://docs.cloud.google.com/gemini-enterprise-agent-platform) LLM provider.



_Appears in:_
- [LLMProvider](#llmprovider)
- [NamedLLMProvider](#namedllmprovider)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `model` _[ShortString](#shortstring)_ | Model name override, such as `gpt-4o-mini`.<br />If unset, the model name is taken from the request. |  | MaxLength: 256 <br />MinLength: 1 <br />Optional: \{\} <br /> |
| `projectId` _[TinyString](#tinystring)_ | The ID of the Google Cloud Project that you use for the Vertex AI. |  | MaxLength: 64 <br />MinLength: 1 <br />Required: \{\} <br /> |
| `region` _[TinyString](#tinystring)_ | The location of the Google Cloud Project that you use for the Vertex AI.<br />Special values: `global` uses the global endpoint, while `us` and `eu` use restricted<br />multi-region endpoints. Other values are treated as regional locations.<br />Defaults to `global` if not specified. | global | MaxLength: 64 <br />MinLength: 1 <br />Optional: \{\} <br /> |


#### Webhook



Webhook for prompt guard request or response checks.



_Appears in:_
- [PromptguardRequest](#promptguardrequest)
- [PromptguardResponse](#promptguardresponse)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `backendRef` _[BackendObjectReference](https://gateway-api.sigs.k8s.io/reference/api-spec/main/spec/#backendobjectreference)_ | Webhook server to reach.<br />Supported types: Service and Backend. |  | Required: \{\} <br /> |
| `forwardHeaderMatches` _HTTPHeaderMatch array_ | HTTP header matches used to select the headers to forward to the webhook.<br />Request headers are used when forwarding requests and response headers<br />are used when forwarding responses.<br />By default, no headers are forwarded. |  | Optional: \{\} <br /> |
| `failureMode` _[FailureMode](#failuremode)_ | Behavior when the webhook guardrail is unavailable<br />or returns an error. `FailOpen` allows the request to continue.<br />`FailClosed` (default) rejects the request. |  | Optional: \{\} <br /> |



## Shared Types

The following types are defined in the shared package and used across multiple APIs.

#### LongString

_Underlying type:_ _string_

**Validation:**
- MinLength=1
- MaxLength=1024

#### PolicyAncestorStatus

| Field | Type | Description |
|-------|------|-------------|
| `ancestorRef` | gwv1.ParentReference | The ancestor resource that this status entry describes. **Required.** |
| `controllerName` | string | The controller that wrote this status entry.  Example: `example.net/gateway-controller`. **Required.** |
| `conditions` | []metav1.Condition | Conditions for this policy's effect on the specified ancestor.  |

#### PolicyStatus

| Field | Type | Description |
|-------|------|-------------|
| `conditions` | []metav1.Condition | The current condition state for the policy. |
| `ancestors` | [][PolicyAncestorStatus](#policyancestorstatus) | Status for each ancestor that is affected by this policy. **Required.** |

#### SNI

_Underlying type:_ _string_

**Validation:**
- MinLength=1
- MaxLength=253
- Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`

#### ShortString

_Underlying type:_ _string_

**Validation:**
- MinLength=1
- MaxLength=256

#### TinyString

_Underlying type:_ _string_

**Validation:**
- MinLength=1
- MaxLength=64
