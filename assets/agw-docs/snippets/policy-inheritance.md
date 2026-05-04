The following policy inheritance and override rules apply for `AgentgatewayPolicy` resources.

* Policies that are defined in an `AgentgatewayPolicy` and applied to a parent HTTPRoute are automatically inherited by all child and grandchild HTTPRoutes along the route delegation chain.
* If an `AgentgatewayPolicy` is applied to a child or grandchild HTTPRoute and defines a policy that is also set on the parent, the policy on the child takes precedence and overrides the parent's. For example, if the parent defines a transformation policy and the child defines a different transformation policy, the child's transformation is applied.
* If an `AgentgatewayPolicy` is applied to a child or grandchild HTTPRoute and defines a different policy type than the parent, both policies are merged and applied. For example, if the parent applies a rate limit and the child applies a transformation, both apply.
* Authorization policies are an exception. They merge across the entire delegation chain rather than overriding. `Allow` rules from any policy in the chain can grant access, and `Require` rules from every policy in the chain must all match for the request to be allowed.
