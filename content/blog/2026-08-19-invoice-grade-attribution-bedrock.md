---
title: "Invoice-Grade Attribution on Amazon Bedrock with Agentgateway"
category: "Deep Dive"
publishDate: 2026-08-19
author: "Anton Braverman"
description: "How per-request team and app values ride STS session tags into the AWS Cost and Usage Report, so the numbers finance slices are the numbers AWS actually bills."
---


A gateway is both the best and the worst thing that happens to your AI bill. The best, because every model request flows through one place, so tagging and budgets become possible at all. The worst, because on AWS all of that traffic typically authenticates through one IAM role, so the provider sees exactly one caller. Finance opens the bill and Amazon Bedrock is a single line item. Your gateway dashboard knows who spent what, but it knows it as an estimate, computed from token counts and price sheets, and finance does not reconcile against estimates. Finance reconciles against the numbers AWS actually bills.

We call attribution **invoice-grade** when the "who-is-this-for" tag survives all the way to the cloud provider's billing data, so the numbers finance slices are the numbers AWS actually bills. Anything that stops in the gateway's internal records, however accurate, is an estimate of the bill rather than the bill.

## What AWS shipped

AWS now [attributes Bedrock inference costs to the IAM principal that made the call](https://aws.amazon.com/blogs/machine-learning/introducing-granular-cost-attribution-for-amazon-bedrock/), per request, in Cost and Usage Report (CUR) 2.0 and Cost Explorer. For traffic that arrives through a gateway, the documented pattern is per-caller sessions. The caller's identity rides as the AWS Security Token Service (STS) `RoleSessionName`, which lands in `line_item_iam_principal`. Business dimensions like team and cost center ride as STS session tags, which surface as cost allocation tags.

## Where the gateways stood

Gateway traffic did not benefit. Agentgateway called AssumeRole with a role ARN and an SDK-generated random session name, so every caller through a given role collapsed into one identity, in AWS CloudTrail and on the bill. It looked something like this:

{{< reuse-image src="img/blog/invoice-grade-attribution-bedrock/diagram-problem.png" width="624px" >}}

## Closing the gap: static tags first

So let's close that gap. As of pull requests [#2435](https://github.com/agentgateway/agentgateway/pull/2435) and [#2447](https://github.com/agentgateway/agentgateway/pull/2447), the AssumeRole backend auth accepts two optional fields: a session name and a list of session tags. The identity the gateway already established now rides the credential exchange into AWS, and the picture changes to this:

{{< reuse-image src="img/blog/invoice-grade-attribution-bedrock/diagram-fix.png" width="624px" >}}

In config, the simplest version is two static values on the backend:

```yaml
assumeRole:
  roleArn: arn:aws:iam::123456789012:role/bedrock-invoke
  sessionName: checkout-service
  tags:
    - key: team
      value: data-science
    - key: cost-center
      value: "12345"
```

This covers the topology where each team has its own route and role. The route's spend now arrives on the bill already labeled. When the fields are unset, behavior is unchanged.

## Per-request values, because shared routes are the real world

Static tags are the change. The important extension is that the values can also be derived dynamically, from identity the gateway has already validated. The common enterprise architecture is not one route per team. It is thousands of apps and users behind one shared route, where the dimensions that matter exist only per request, in a validated JSON Web Token (JWT) claim or in the metadata of the key the gateway issued. So a tag value can also be a Common Expression Language (CEL) expression, evaluated against each request.

```yaml
assumeRole:
  roleArn: arn:aws:iam::123456789012:role/bedrock-invoke
  tags:
    - key: Team
      expression: 'request.headers["x-team"]'
    - key: App
      expression: 'request.headers["x-app"]'
    - key: User
      expression: 'jwt.sub'
    - key: CostCenter
      value: "12345"
```

The header examples are the shortest and easiest to read, but the ones doing the real work are `jwt.sub` and its siblings. These are values proven by a token the gateway itself validated, or assigned by the operator on the key it issued, rather than trusted from whatever the caller chose to send. A tag someone can fat-finger is a tag someone will fat-finger, and a month of misattributed spend cannot be repaired afterwards.

It's important to remember that attribution is stamped at request time and cannot be backfilled. Which is why this implementation fails closed. If an expression errors or produces an empty or invalid value, the request is rejected before the STS call is even made. Nothing unattributed reaches Bedrock — that's the goal.

## What finance actually sees now

Activate the tag keys as cost allocation tags, wait around 24 hours, and the loop closes. Cost Explorer groups Bedrock spend by Team, App, User, CostCenter, or any other attribution key you've chosen. CUR rows carry the calling principal and the tags next to the dollar amounts AWS charges. Chargeback per team, per app, and where you need it per user[^cardinality], read straight off AWS's own billing data, with the gateway's own dashboard demoted to what it should be: a fast preview of numbers the bill later confirms.

{{< reuse-image src="img/blog/invoice-grade-attribution-bedrock/diagram-reconcile.png" width="480px" >}}

The key benefit is not merely better dashboards. It is that finance can finally reconcile AI usage to the numbers AWS actually bills.

And that property is rarer than it sounds. I went looking for it before contributing this, across every gateway I could get my hands on, and as of this writing agentgateway is the only shipping gateway where an operator-resolved tag reaches the AWS bill. Some stop at a static role or a configurable session name; most keep attribution in their own store. Attribution that survives into the provider's billing records, rather than stopping at a dashboard, is what makes agentgateway unique in this corner of the stack today.

{{< reuse-image src="img/blog/invoice-grade-attribution-bedrock/reconciliation.png" width="624px" >}}

*A month of Bedrock traffic, reconciled: the gateway's per-request meter on the left, the CUR lines AWS billed on the right, joined on the `cost_center` session tag. Figures are illustrative of a representative deployment; the columns, the join key, and the reconciliation are real CUR 2.0 and real gateway output.*

## The next step: GCP

This post is AWS-shaped on purpose. Each cloud carries attribution differently. In Google Vertex AI, the equivalent information rides as labels on the native `generateContent` request, and the native path is already supported. Today, those labels are pass-through: whatever your clients send is what reaches Google Cloud billing. The remaining step is to give the gateway the same control it now has on AWS, so attribution is determined by an identity the gateway has validated rather than a value the caller simply asserts.

Once that piece is in place, the model becomes the same across both clouds: establish identity at the gateway, carry it through the provider's authentication or request metadata, and let the provider's own billing system record it.

That is ultimately what invoice-grade attribution means. Not another usage dashboard or another number to reconcile. The identity that was established at the edge survives all the way to the invoice and into CloudTrail, so months later you can trace a request back to who made it and what happened along the way.[^forensics]

If you run agentgateway in front of Bedrock, your next billing period should be attributed instead of anonymous.

[^cardinality]: A note on cardinality: per-user attribution isn't free, on either side of the API. On the gateway side, every distinct tag set is its own STS session, which turns the assume-role credential cache into a high-cardinality map; the cache is bounded with single-flight fetches, so a burst of first requests for the same identity coalesces into one AssumeRole call. On the AWS side, every distinct principal and tag set expands into its own line items in the CUR, so billing files grow with the number of identities, and AWS's own guidance for [IAM principal cost allocation](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/iam-principal-cost-allocation.html) is to keep tag values low-cardinality: teams and cost centers, not session IDs or per-request GUIDs. Tag per user where the chargeback/logs question genuinely needs it, per team everywhere else. STS limits (50 tags, key and value length and charset) are validated at config load for static values and per request for dynamic ones, so a bad tag fails with a clear error rather than an STS 400 mid-flight.

[^forensics]: A note on the security benefits of working this way: the same session identity that reaches the bill also reaches AWS CloudTrail. That means cybersecurity teams can investigate incidents by tracing a request back to its verified identity behind the gateway, with a granularity you cannot have when every caller shares one anonymous session.

---

*My name is Anton Braverman. I run AI platform infrastructure at a regulated enterprise and contributed the session-tag support described in this post.*
