---
title: "Credential Injection Patterns for AI Agents: Part 3, Protecting the Token Vault with OpenBao"
category: "Deep Dive"
publishDate: 2026-11-02
author: "Christian Posta"
description: "Parts 2 and 2.5 built broker-gated envelope encryption for agentgateway's token store on AWS KMS. Lots of orgs can't or won't put that key in a hyperscaler, so here are two ways to run Mode 3 on Vault/OpenBao, side by side, what each one costs you, and how I'd pick between them."
toc: false
---

{{< reuse-image src="img/blog/cb4a/cb4a-part2.gif" alt="CB4A Flow" >}}

In [part 1](/blog/2026-07-27-credential-injection-ai-agent-egress-cb4a/) I looked at the [Credential Broker 4 Agents (CB4A)](https://datatracker.ietf.org/doc/html/draft-hartman-credential-broker-4-agents-00) draft and argued that the agent should never hold a credential at all, and that a proxy (in our case [agentgateway](https://agentgateway.dev)) should exchange the user's identity for the upstream token on the live request. That means the proxy's token vault holds every user's GitHub token, Slack token, etc. In [part 2](/blog/2026-08-03-protecting-token-vault-kms-credential-injection/) I asked how much of the store an attacker can read **when the process holding the token store is fully compromised**.

But part 2 and [part 2.5](/blog/2026-10-20-credential-brokering-mode-3-at-scale/) was built around AWS KMS, and a lot of the organizations that care most about credential concentration can't, or won't, put the key that guards every user's credentials in a hyperscaler's hands.

So why Vault/[OpenBao](https://openbao.org/)? Some of it is "sovereignty" and "hold your own key" buzzwords, but based on the questions that keep coming up, these also:

- **Where you run.** On-prem, air-gapped, or a sovereign/regional cloud where AWS KMS isn't an option.
- **Multi-cloud and portability.** One key service, one policy model, and one audit trail across AWS/Azure/GCP/on-prem, and if you move a workload to another datacenter, region, or cloud, the keys move with it instead of staying locked in one provider's KMS.
- **What you already run.** A Vault/OpenBao cluster with a team, a policy review process, and an audit pipeline, which a new token store should plug into.
- **Custody.** You hold the KEK, you can read the source, and the authorization config lives in git.

I'll use OpenBao (the community fork after HashiCorp [moved Vault to the BSL](https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license) in 2023) but it applies to Vault too.

There are two reasonable ways to do "Mode 3" on OpenBao with agentgateway. Either let the gateway log in to OpenBao as the user, or keep the broker from part 2 and point it at OpenBao (I'm calling that Mode 3b). I don't think either one wins outright. The vault login is simpler, but the decrypt token it hands out is scoped to the user, so a live request for one of alice's credentials can open whichever of them the controller picks. Alternatively, the broker scopes each decrypt to the one row the request is for, and you pay for that with another component on the request path.

## Who holds what?

Every mode in this series comes down to who holds the key and what has to say yes before a decrypt happens. Envelope encryption is the foundation. A per-row DEK encrypts the token payload and the KEK only wraps and unwraps DEKs, so the KEK can live somewhere the controller can't reach. Mode 3 then takes the "yes" away from the controller, so reading one credential needs the ciphertext from the controller and a yes from the broker for that one row (a KMS grant in part 2).

| Role                                    | Holds                                                                              | Never holds                         |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| **ciphertext holder** (controller)      | the encrypted rows                                                                 | any decrypt it can run on its own   |
| **user verifier + authorizer** (broker) | the yes on each decrypt (a grant on KMS, an approval on OpenBao), IdP JWKS, policy, the owner-HMAC key | ciphertext, DB, DEKs |
| **key custodian** (KMS / OpenBao)       | the KEK                                                                            | application data                    |

The key custodian (ie, whatever holds the KEK and does the unwrap) is KMS in part 2 and [OpenBao Transit](https://openbao.org/docs/secrets/transit/) here. The two designs in this post differ on who plays the "user verifier + authorizer" role, ie, who checks the user's subject token and then says "yes" to a decrypt. In Design 1 that "yes" is a short-lived OpenBao token (which I'll call the decrypt token), and in Design 2 it's an approval of one specific decrypt request.

In **Design 1 (vault login)** there's no broker, and OpenBao plays both the user verifier + authorizer role and the key custodian role. On each live request the gateway calls OpenBao's `auth/jwt/login` with the user's subject token, OpenBao verifies it against the IdP and returns the decrypt token, and the gateway passes it to the controller. Since the gateway is the only thing allowed to call that login, a decrypt token only exists while a real request is in flight.

In **Design 2 (Mode 3b, broker)** the broker from part 2 keeps the user verifier + authorizer role, but it doesn't mint anything. The controller asks OpenBao for the decrypt, OpenBao holds the request instead of running it, and the broker checks the subject token and approves that one request, so OpenBao only plays key custodian.


## Design 1: let the gateway log in as the user

This design starts from the fact that the broker only exists because KMS can't authenticate the end user (it only ever sees the controller's IAM role), but OpenBao's JWT auth method *can*. So let OpenBao verify the user directly, and the broker's authorize step becomes a built-in, audited, fail-closed auth mount with no custom code. [Mesut Özdil](https://github.com/moezdil) sent me this design as a [working demo](https://github.com/moezdil/openbao-credential-broker-demo) shortly after part 2, and a lot of it holds up (in a few places, e.g. token TTL and fail-closed audit, it's better than what we built on KMS).

On a live request, the gateway logs in to OpenBao with the user's subject token, and OpenBao verifies it against the IdP JWKS and returns a short-lived OpenBao token whose policy is templated to that user's Transit key. That token carries no key material, just permission to call Transit. Each user has their own Transit key (created with `derived=true`), and each row's `context` derives a different subkey from it, so a wrapped DEK only unwraps with its own row's context. The gateway hands it to the controller, which sends the row's wrapped DEK and `context` to `transit/decrypt`, gets back the plaintext DEK, and decrypts the upstream token locally, so OpenBao never sees the credential itself.

{{< reuse-image src="img/blog/cb4a/part3-design1.png" alt="Design 1: the gateway logs in to OpenBao as the user" >}}

So who gets to call `auth/jwt/login`? That's the first thing to get right. A JWT login proves who the user is, not that they're making a request right now, and in agent egress the user may well be asleep while a machine replays their token. The controller has to hold the subject token (it's the [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693) token-exchange input), so if it can reach the login path, a compromised controller can do this.

```
t=0      alice makes a real MCP call. The compromised controller keeps her subject JWT.
t=+40m   no traffic anywhere. Controller calls auth/jwt/login with the stored JWT.
         OpenBao: signature ok, exp ok, aud ok. Here is your token.
         Controller decrypts using ciphertext and context from its own database.
         Repeat for every JWT it harvested this hour.
```

Every check passed exactly the way it's supposed to, and liveness went from a short-lived token minted during a live request to about an hour of replay. `token_bound_cidrs` doesn't help, since OpenBao checks the same list at login and on every use, so it can't let the gateway log in while the controller uses the token. What does help is letting only the gateway call `auth/jwt/login` (over mTLS, every other caller denied), so the only OpenBao tokens the controller ever sees are the ones the gateway hands it during a live request.

With the login path locked down, this is a good design. There's no broker to run or compromise, nothing writes OpenBao policy at runtime, and every authorization rule is OpenBao config your Vault team can review in git.

So what does the login actually return? A token scoped to the user, since the subject token says who and nothing in it says which of that user's credentials the request is for. The per-row subkeys don't help here, because the `context` isn't a secret (it sits in the controller's database next to the wrapped DEK). The controller can send any of alice's rows with that row's own matching context, and the policy, which only names her key, lets it through. You can cap how much one token opens, though. Set `token_num_uses=1` on the JWT role and leave `batch_input` out of the decrypt path's `allowed_parameters` (Mesut's demo does both), and one live request gets at most one row, but the controller still picks which one, so an attacker spends each of alice's live requests on her most valuable credential.

Part 2 promised to protect "this user's other credentials," and this design weakens that on a live request. Can you push the row into the login? Not really, since the gateway doesn't know the `elicitation_id` and `bound_claims` only matches static values in the JWT. 

Design 1 also loses the per-request checks the broker did in part 2, ie, CEL rules over which resource, audience, and action a request is for (or how fast a user is pulling credentials), honeytoken rows that alert when someone asks for a decoy, and a log of *why* a decrypt was denied. `auth/jwt/login` only evaluates the claims in the JWT (even with OpenBao's [CEL roles](https://openbao.org/community/rfcs/cel-jwt/)), so it never sees any of that request context ([Sentinel](https://developer.hashicorp.com/vault/docs/enterprise/sentinel) could, but OpenBao doesn't have it yet, and [EGPs/RGPs in CEL](https://github.com/openbao/openbao/pull/4172) are still an open RFC). If you want those checks, you build them into the gateway before it calls the login, and the gateway is the most exposed component we have, so a compromised gateway takes the checks down with it.

**A vault login gets you liveness if only the gateway can reach it, but even capped at one use, the token it gets back opens whichever of that user's credentials the controller picks.** How much that matters depends on how many upstreams your users connect and how valuable the ones a request *wasn't* for are.

## Design 2: keep the broker and point it at OpenBao (Mode 3b)

Mode 3b keeps the broker from part 2 and leaves OpenBao as only the key custodian, but on OpenBao the broker doesn't mint anything. The controller asks OpenBao for the decrypt itself, OpenBao holds that request instead of running it, and the broker either approves it or lets it expire. Before it approves, the broker verifies the user's subject token (signed by the IdP) and the gateway's freshness proof (SVID-signed, single-use `jti`, about a 30-second `exp`, bound to the resource and a hash of the subject), computes `owner` from the subject, runs CEL, and then checks that the request OpenBao is holding is for exactly the row this live request is about.

{{< reuse-image src="img/blog/cb4a/part3-mode3b.png" alt="Design 2 (Mode 3b): the broker approves one row's decrypt" >}}

Compared to Design 1, that's two changes, and they're independent of each other even though they're easy to conflate.

1. **OpenBao trusts nothing external.** There's no JWT auth mount at all, so harvested subject tokens are worthless at OpenBao, and the only way a decrypt runs is a broker approval of that specific request.
2. **Approval is per-row.** The broker approves OpenBao's own copy of one request, which names one user's key and one row's `context`, and since only the controller knows the `elicitation_id`, that request has to start at the controller.

The broker is also the natural place to add the agent's identity (e.g. its [SPIFFE](https://spiffe.io/) SVID) to CEL. Have the broker verify the agent's JWT-SVID itself though, since an agent ID the gateway copies into its own proof is just the gateway's word.

### How do you scope a decrypt to one row?

In part 2, we used a KMS grant to scope decrypt access to a "per-row" action. In OpenBao, ACL is static `(path, parameters, capabilities)` config, and the only dynamic part is which policy *names* get attached to a token. A great feature added in OpenBao [2.7.0](https://openbao.org/docs/release-notes/2-7-0/), is [control groups](https://openbao.org/docs/concepts/control-groups/). A `control_group` on a policy path means a request to that path doesn't run _until some other identity approves it_, and you name who can approve in the policy (an OpenBao identity group, which in our case has exactly one member, the broker). So what happens to the request while it waits? OpenBao doesn't run it, it stores a copy and hands the caller a [wrapping token](https://openbao.org/docs/concepts/response-wrapping/) instead of a result. Normally a wrapping token is how OpenBao hands you a response sealed inside a short-lived token that you "unwrap" to read, but here there's no response yet, so think of it as a claim ticket for a request that hasn't run. Like every OpenBao token it also has an accessor, which is an ID other components can use to refer to the token without being able to use it.

In our design, the controller sends the broker the accessor (plus the subject token and the gateway's proof), the broker looks up the stored request by that accessor with `sys/control-group/request`, which returns the path and the exact parameters the controller sent, and if it checks out the broker approves it with `sys/control-group/authorize`. Then the controller calls `sys/wrapping/unwrap` with its wrapping token, and that's when OpenBao actually runs the decrypt and returns the result. Unwrap before the approval and you get an error, and if nobody approves before the control group's `ttl`, the request just expires. That gets you per-request scoping without anything writing OpenBao config at runtime, so the controller gets a static policy on Transit with its decrypt path gated on the broker.

{{< reuse-image src="img/blog/cb4a/part3-control-groups.png" alt="Control groups: the decrypt waits for the broker" >}}

```hcl
# controller policy (static, in git)
path "transit/decrypt/user-*" {                  # Transit key: one per user, derived=true
  capabilities       = ["update"]
  allowed_parameters = { "ciphertext" = [], "context" = [] }   # no batch_input
  control_group = {
    ttl               = "30s"
    self_auth_allowed = false
    factor "broker" {
      controlled_capabilities = ["update"]
      identity {
        group_names = ["cb4a-broker"]
        approvals   = 1
      }
    }
  }
}
```

The broker logs in with its SVID (e.g. cert auth) as an entity in the `cb4a-broker` group, and its whole policy is `update` on `sys/control-group/request` and `sys/control-group/authorize`. It has no Transit path, it can't mint tokens, and it can't write policy. When it reviews a held request, OpenBao returns its stored copy of exactly what the controller sent (the [`request_data`](https://github.com/openbao/openbao/pull/3601) field carries the original parameters):

```json
{
  "approved": false,
  "request_operation": "update",
  "request_path": "transit/decrypt/user-9f2c8a...",
  "request_data": {
    "ciphertext": "vault:v1:QhMy...",
    "context": "<b64 of owner, resource, elicitation_id>"
  },
  "authorizations": []
}
```

The broker computes the `context` it expects from things it verified itself (`owner` from the subject token, `resource` from the gateway's proof, plus the `elicitation_id` the controller named) and approves only if `request_path` is that user's key and `request_data.context` matches. So Mode 3's two independent checks still hold. The ciphertext is bound to the row at wrap time (`derived=true` plus a per-row `context` HKDF-derives a different subkey, where KMS uses `EncryptionContext` as AAD), and the caller is bound to the row at approval time (the broker's `context` check, where KMS uses `EncryptionContextSubset`). Send some other ciphertext with this row's context and the broker approves, but derivation fails when the decrypt runs, and send another row's ciphertext with its own context and the broker never approves it.

Nobody in this design holds a standing decrypt. The controller can only propose one, and the broker can only approve what the controller already asked for (it only ever sees the accessor, never the wrapping token), so a compromised broker on its own decrypts nothing, and a compromised controller on its own gets nothing approved without a live proof from the gateway. That's a better spot than either KMS variant, where part 2's broker holds `CreateGrant` and part 2.5's holds `kms:Decrypt`. There's also no per-row state in OpenBao, since the only state is the held request, and it expires with the `ttl`.

## The two side by side

Both designs stop a compromised controller from mass-decrypting the store, and in both a decrypt only happens during a live request through the gateway. The difference is scope and cost. In Design 1 a decrypt token opens one of the user's credentials of the controller's choosing (or all of them without `token_num_uses=1`), request-context policy (CEL, honeytokens, a decision log) lives in the gateway or nowhere, and the whole thing is OpenBao config with no broker to run. In Mode 3b the broker approves one row's decrypt at a time, that policy lives in a broker the gateway doesn't control, and nothing (not the controller, not the broker) holds a decrypt it can run on its own. You pay for it with another component on the request path, four OpenBao calls per decrypt instead of two, and a dependency on control groups, which are a couple months old.

## Is there a Part 4?

"Which design" comes down to how far you want one live request to reach. If per-row scoping matters for your users, run the broker as an approver on OpenBao 2.7 control groups, keep its policy to `sys/control-group/*`, and install no JWT auth mount (and don't give the broker policy-write anywhere in OpenBao, since that turns it into an effective admin). If you're on Vault or can't run OpenBao 2.7 yet, port the broker-unwrap variant from [part 2.5](/blog/2026-10-20-credential-brokering-mode-3-at-scale/) instead (the broker gets a static `transit/decrypt/user-*` policy, computes the `context` itself, and hands back the DEK), and accept that the broker holds a standing decrypt like it does on KMS. If per-row scoping doesn't matter, start with the vault login and lock the login path down. Either way, ship the audit log somewhere none of your components can reach.

The last question that I'll be investigating is: can we still do better? We are still trying to solve for "if the component that holds the token vault gets compromised, what is the blast radius"? Separating out the components that encrypt/decrypt and attaching to liveness/user/identity/policy checks follows the CB4A paper. But the fact is, if the gateway gets compromised, we still have a dwell/trickle blast radius. If we can just piggy back on that, and make THAT the blast radius for everything, maybe we can improve the design. 

Thanks to [Mesut Özdil](https://github.com/moezdil) for the [OpenBao demo](https://github.com/moezdil/openbao-credential-broker-demo) and review feedback. Thanks also to [Michael Hofer](https://www.linkedin.com/in/secretz/) from the OpenBao project and [Stephane Nangue](https://www.linkedin.com/in/stephane-nangue-480a2557/) for their review and equally amazing feedback. If you're working through credential isolation for agent egress on Vault/OpenBao in your own stack, or you think I've weighed the two designs wrong, [connect on LinkedIn](https://linkedin.com/in/ceposta) and tell me!!
