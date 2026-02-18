# Style Guide

Use this style guide when drafting, editing, or reviewing documentation for the agentgateway project.

## Table of contents

1. [Product naming conventions](#product-naming-conventions)
2. [Writing style](#writing-style)
3. [Formatting with shortcodes](#formatting-with-shortcodes)
4. [Content structure](#content-structure)
5. [Visuals](#visuals)
6. [Code examples](#code-examples)
7. [Files and organization](#files-and-organization)

---

## Product naming conventions

Use sentence-case for agentgateway, such as:
- ✅ Agentgateway is...
- ✅ The agentgateway project is...

Do not use other variations, such as:
- ❌ Agent Gateway is...
- ❌ AgentGateway is...
- ❌ The Agentgateway project is...

## Writing style

### Voice and tone

- **Active voice:** "The gateway routes traffic" (not "Traffic is routed by the gateway").
- **Present tense:** "Istio provides mTLS" (not "Istio will provide mTLS").
- **Second-person**: "In this guide, you configure" (not "let's configure" or "we will configure").
- **Conversational but technical:** Explain "why" and "how it works", not just "what".
- **No emojis** in body text.

### Sentence structure

- **Short sentences:** Aim for 15-25 words per sentence.
- **One idea per sentence:** Complex ideas get multiple sentences.
- **Paragraph length:** 2-5 sentences per paragraph.
- **Lists for enumeration:** Use bullet points or numbered lists for 3+ items. Unless bullets are short (one or two words), punctuate them with a period.
- **End sentences with the proper punctuation:** Generally, end sentences with a period. If it is a question, end with a question mark. Use exclamation marks sparingly. Do **not** end sentences with a colon, unless it is a short phrase that introduces an immediate example, such as `Example output:`. The first sentence after a heading that introduces steps should end with a period, **not** a colon.

### Technical terms

- **First mention:** Spell out acronyms with definition
  ```markdown
  **Mutual TLS (mTLS)** is a protocol where both client and server...
  ```

- **Subsequent mentions:** Use acronym only
  ```markdown
  Configure mTLS for the control-to-data plane connection.
  ```

- **Avoid jargon:** Explain technical concepts clearly
  ```markdown
  ✅ "ztunnel is a node-level L4 proxy that handles TCP traffic"
  ❌ "ztunnel does L4 stuff"
  ```

## Formatting with shortcodes

### Hextra Hugo theme shortcodes to style, format, and add content

The Hextra Hugo theme provides a set of shortcodes to style, format, and add content to your pages. For more information, see the [Hextra Hugo theme documentation](https://imfing.github.io/hextra/docs/guide/shortcodes/).

- `callout` for callouts (such as notes, warnings, tips, and other admonitions).
- `cards` to format a collection of related links, especially on index pages to present the subpages visually.
- `details` to format a collapsible section of content.
- `filetree` to format a directory file tree in a visually appealing way.
- `icon` used sparingly to add an icon inline.
- `steps` used in tutorial pages only to style headings in a more visual way.
- `tabs` to present alternative ways within a step, such as for different modes, languages, load balancer vs localhost access, and so on.

### Custom Hugo shortcodes

This project has a few custom Hugo shortcodes that are used for content management.

- `link-hextra` to link to a topic within the documentation in a way that is compatible with the versioning strategy.
- `conditional-text` to conditionally include text based on the current section of the docs (`standalone` for the agentgateway binary or `kubernetes` for agentgateway deployed on Kubernetes).
- `gloss` to add a glossary term to the page.
- `redirect` to redirect a page to a different location within the doc set that has the same content. Useful for "placeholder" pages where we want the page to appear in several different sections in the navigation, but do not want to duplicate or reuse the content.
- `reuse` to include a piece of content from the `assets/agw-docs/` directory.
- `version` to conditionally include text based on the current version. The versions for each section are defined in the `hugo.yaml` file.

## Content structure

### Content types

The docs have the following content types, although they are not strict.

- Concepts that explain key functionality and features of agentgateway. These are typically found in the `about/concepts/` directory. They are typically written in a way that is easy to understand and follow. Include diagrams where appropriate. Usually do not include steps.
- Reference pages that provide detailed information about certain agentgateway components such as Helm values or API docs. Most reference content is automatically generated from the code through the `reference-docs` workflow. These are typically found in the `reference/` directory.
- FAQ page in the `faqs.md` file that provides short answers to common questions about agentgateway.
- Guides that provide the steps or procedure to accomplish a certain task. These are typically found in the rest of the directories. Their layout is as follows in the next section.

### Standard page template

Content for guides typically follows a structure similar to the [STYLE_EXAMPLE_PAGE.md](STYLE_EXAMPLE_PAGE.md) file.

## Visuals

### Color palette

Agentgateway's primary color is `#7734be`.

### Screenshots

Screenshots are used to illustrate the steps of a guide. They are typically found in the `assets/agw-docs/img/` directory. Use sparingly, as these must be updated as the UI changes.

### Diagrams

Use Mermaid to create diagrams. The most common diagram types are flowcharts and sequences. For more information and syntax, see the [Mermaid documentation](https://mermaid.ai/open-source/intro/index.html).

For more complex diagrams, we sometimes use [Excalidraw](https://excalidraw.com/).

General diagram principles:
- **Include alt text context** in surrounding prose
- **Don't rely solely on color:** Use labels and shapes too
- **Describe flow in text:** "The diagram shows traffic flowing from client → gateway → service"
- **Use the primary color:** `#7734be` for the primary color.

## Code examples

### YAML standards

**Complete and valid:**
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
  namespace: default  # Always include namespace
spec:
  parentRefs:
  - name: my-gateway
  hostnames:
  - "example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: backend-service
      port: 8080
```

**Key requirements:**

1. **Valid YAML syntax:** No syntax errors
2. **Realistic scenarios:** Production-like configurations
3. **Complete examples:** Don't omit required fields
4. **Namespace explicit:** Always show `metadata.namespace`
5. **Comments inline:** Explain non-obvious settings

**Comment style:**
```yaml
spec:
  parentRefs:
  - name: my-gateway  # References the Gateway this route attaches to
  hostnames:
  - "api.example.com"  # Must match Gateway listener hostname
  rules:
  - matches:
    - path:
        type: PathPrefix  # Matches /api, /api/v1, /api/v2, etc.
        value: /api
```

### Bash examples

Break up long commands into multiple lines.
```bash
helm upgrade -i agentgateway-crds oci://ghcr.io/kgateway-dev/charts/agentgateway-crds \
  --create-namespace \
  --namespace agentgateway-system \
  --version v{{< reuse "agw-docs/versions/n-patch.md" >}}
```

**Show expected output when helpful:**
```bash
$ kubectl get gateways -A
NAMESPACE    NAME         CLASS                   ADDRESS         READY
default      my-gateway   agentgateway     10.0.0.5        True
```

## Files and organization

### File names

- **Lowercase with hyphens:** `api-gateway-concepts.md` (not `API_Gateway_Concepts.md`)
- **Descriptive:** Name should indicate content
- **Short but clear:** 2-5 words ideal
- **No special characters:** Only `a-z`, `0-9`, and `-`

### Directory structure

The main content is organized into sections for the different deployment types. Each section has versioned subdirectories for the different versions of the documentation.

Often, the content pages consist of just the front matter for the page and a `reuse` shortcode that calls content from the `assets/agw-docs/` directory. This is done for reuse across product sections and versions.

```
content/docs/
├── kubernetes/
│   ├── latest/
│   │   ├── index.md
│   │   ├── about/
│   │   ├── agent/
...
│   ├── main/
│   │   ├── index.md
│   │   ├── about/
│   │   ├── agent/
...
├── standalone/
│   ├── latest/
│   │   ├── index.md
│   │   ├── about/
│   │   ├── agent/
...
│   ├── main/
│   │   ├── index.md
│   │   ├── about/
│   │   ├── agent/
```

### Index pages

Every directory MUST have an `_index.md` file. The `_index.md` file might have a brief description of the collection and then the `cards` shortcode to list the subpages in the collection.
