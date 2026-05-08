---
title: Transformations
weight: 10
test: skip
---

Mutate and transform requests and responses before forwarding them to the destination.

## Conditional execution

To run a transformation only when a CEL expression matches, use the `conditional` field on your `transformation` policy. For example, you can transform internal traffic only and leave external traffic untouched. For details, see [Conditional policies]({{< link-hextra path="/reference/conditional-policies" >}}).
