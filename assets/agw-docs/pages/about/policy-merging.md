{{< reuse "/agw-docs/snippets/agentgateway-capital.md" >}} lets you define how policies are merged when they are applied to a parent and child resource. 

## About

Parent-child hierarchies might be:

* Resources that target or serve other resources, such as Gateway > ListenerSet > HTTPRoute > Route rule.
* Routes that are delegated, such as Parent HTTPRoute A > Child HTTPRoute B > Grandchild HTTPRoute C.

Policy merging applies to the following policies:

* Native Kubernetes Gateway API policies, such as rewrites, timeouts, or retries.
* {{< reuse "agw-docs/snippets/policy.md" >}}.

Resources that are higher in the parent-child hierarchy can use a special annotation to define how child resources inherit policies. This way, parent resources such as a Gateway or HTTPRoute can decide whether child resources can override the parent policies or not.

## Merging annotation {#merging-annotation}

The annotation on the parent resource is: `kgateway.dev/inherited-policy-priority`.

You can use the following values for the annotation:

- `ShallowMergePreferChild` (default): Child policies take precedence over parent policies and the policies are shallow merged.
- `ShallowMergePreferParent`: Parent policies take precedence over child policies and the policies are shallow merged.

**Shallow merging** means that the policies are merged at the field level. Each field, including nested sub-fields, is treated as an atomic unit. If a field is present in both parent and child policies, the entire value from the higher priority policy is used for that field; nested fields are not recursively merged. Priority is typically determined by specificity and creation time. The more specific (such as HTTPRoute rule over all the routes in the HTTPRoute) and older (created-first) policy takes precedence. Consider the following shallow merge scenario:

* Parent policy adds a `x-season=summer` header.
* Child policy adds `x-season=winter` and `x-holiday=christmas` headers.
* Merging annotation is the default value, `ShallowMergePreferChild`.

Resulting merged policy: The parent's `x-season` header is not included in the merged policy because the strategy is `ShallowMergePreferChild`. Each header is treated as a separate field, and the child's values win for any overlapping fields.

| Header | Value | Source |
| -- | -- | -- |
| `x-season` | `winter` | Child |
| `x-holiday` | `christmas` | Child |

### Nested field merge example

The atomic field-level treatment applies to nested structures as well. For example, in policies with nested `backend.ai` configuration, each sub-field like `backend.ai.promptGuard`, `backend.ai.routes`, and `backend.ai.modelAliases` is treated as a separate atomic field. Different sub-fields can be provided by different policies and combine, but if multiple policies set the same sub-field, only the higher-precedence policy's value is used.

Consider this nested field merge scenario with three policies and `ShallowMergePreferChild` precedence:

* **Policy A** (higher precedence): Sets `backend.ai.promptGuard = {enabled: true}`
* **Policy B** (medium precedence): Sets `backend.ai.routes = {allowedOrigins: ["*"]}`
* **Policy C** (lower precedence): Sets both `backend.ai.promptGuard = {enabled: false}` and `backend.ai.routes = {timeout: 30s}`

Resulting merged policy: Policy A's `backend.ai.promptGuard` entirely replaces Policy C's value for that same sub-field. Policy B's `backend.ai.routes` is included in the merged result because there is no conflict with Policy A. The final merged result includes Policy A's promptGuard settings and Policy B's routes settings.

| Field | Value | Source |
| -- | -- | -- |
| `backend.ai.promptGuard` | `{enabled: true}` | Policy A |
| `backend.ai.routes` | `{allowedOrigins: ["*"]}` | Policy B |

Note: Policy C's `backend.ai.promptGuard` (`{enabled: false}`) and `backend.ai.routes` (`{timeout: 30s}`) do not appear in the merged result because Policy A's promptGuard and Policy B's routes take full precedence over those same sub-fields.

<!--TODO deep merge
The annotation takes four values:

- `ShallowMergePreferChild` (default): Child policies take precedence over parent policies and the policies are shallow merged.
- `ShallowMergePreferParent`: Parent policies take precedence over child policies and the policies are shallow merged.
- `DeepMergePreferChild`: Child policies take precedence over parent policies and the policies are deep merged.
- `DeepMergePreferParent`: Parent policies take precedence over child policies and the policies are deep merged.

## Shallow or deep merging {#shallow-deep-merging}

Merging ensures that policies from parent and child resources are combined without conflicts, using either _shallow_ or _deep_ strategies.

**Shallow merging** means that the policies are merged at the top level. Only the top-level fields of the policies are considered for merging. If a field is present in both parent and child policies, the value from the higher priority policy is used. Priority is typically determined by specificity and creation time. The more specific (such as HTTPRoute rule over all the routes in the HTTPRoute) and older (created-first) policy takes precedence. Consider the following shallow merge scenario:

* Parent policy adds a `x-season=summer` header.
* Child policy adds `x-season=winter` and `x-holiday=christmas` headers.
* Merging annotation is the default value, `ShallowMergePreferChild`.

Resulting merged policy: The parent's `x-season` header is not included in the merged policy because the strategy is `ShallowMergePreferChild`.

| Header | Value | Source |
| -- | -- | -- |
| `x-season` | `winter` | Child |
| `x-holiday` | `christmas` | Child |

**Deep merging** means that values from both parent and child policies can be combined. Currently, only [Transformation rules of an {{< reuse "agw-docs/snippets/policy.md" >}}]({{< link-hextra path="/traffic-management/transformations">}}) can be deep merged. Consider the following deep merge scenario:

* Parent policy adds an `x-season=summer` header.
* Child policy adds `x-season=winter` and `x-holiday=christmas` headers.
* Grandchild policy adds `x-season=spring`, `x-holiday=easter`, `x-discount=10%` headers.
* Merging annotation is `DeepMergePreferParent`.

Resulting merged policy's headers: The child and grandchild values merge with the parent's, with the parent's value ordered first because it takes precedence.

| Header | Value | Source |
| -- | -- | -- |
| `x-season` | `summer,winter,spring` | Parent, Child, Grandchild |
| `x-holiday` | `christmas,easter` | Child, Grandchild |
| `x-discount` | `10%` | Grandchild |

-->

## Merging examples {#merging-examples}

For more information, check out the following guides:

* {{< reuse "agw-docs/snippets/policy.md" >}}'s [Policy priority and merging rules]({{< link-hextra path="/trafficpolicy/#policy-priority-and-merging-rules">}})
* [Policy inheritance and overrides]({{< link-hextra path="/traffic-management/route-delegation/inheritance/">}}) for both Kubernetes Gateway API and {{< reuse "/agw-docs/snippets/kgateway.md" >}} policies.