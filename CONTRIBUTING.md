# Contributing

Thanks for your interest in contributing the agentgateway.dev website!

## Contributing to agentgateway

How to contribute as an individual is documented once for the whole project, in the
[agentgateway/community](https://github.com/agentgateway/community) repository:

* [**CONTRIBUTION.md**](https://github.com/agentgateway/community/blob/main/CONTRIBUTION.md) —
  fork and branch workflow, coding standards, [Conventional Commits](https://www.conventionalcommits.org/),
  and the pull request process.
* [**CONTRIBUTOR_LADDER.md**](https://github.com/agentgateway/community/blob/main/CONTRIBUTOR_LADDER.md) —
  the Contributor → Reviewer → Maintainer roles, what each one requires, and how to apply.
* [**CODE_OF_CONDUCT.md**](https://github.com/agentgateway/community/blob/main/CODE_OF_CONDUCT.md) —
  expected behavior across every agentgateway repository.

For working on this website repository with local previews, framework tests, and more, see the
[README](README.md).

## Adding your organization's logo

Organizations that contribute to agentgateway are shown in the **Contributing Companies**
marquee on the [homepage](https://agentgateway.dev/). Adding yours is one image, one YAML
entry, and a pull request.

### 1. Add the logo file

Drop a single file into [`static/logos/`](static/logos). SVG is preferred; a transparent PNG
at least 80px tall works if you have no vector.

Logos are rendered as a **one-color silhouette**: black in light mode, white in dark mode, and its colors are discarded. That has a few consequences worth
getting right before you export:

* The background must be transparent. A background rectangle becomes a solid black or white box.
* The shape must be defined by transparency, not by light-colored fills. Anything defined by a
  white knockout turns black and disappears.
* No gradients, and no raster images embedded inside an SVG. Convert any text to outlines so it
  doesn't depend on the viewer's fonts.
* Logos display at 38px tall, capped at 120px wide. Roughly 3:1 or squarer works best — wider
  lockups get width-capped and render noticeably shorter than their neighbors.

The company name appears as a text label beneath the logo, so the icon or symbol on its own
usually looks best.

Please only submit a logo you're authorized to use.

### 2. Add the listing

Add one entry to [`data/contributors.yaml`](data/contributors.yaml):

```yaml
- name: Your Company
  logo: /logos/yourcompany.svg
```

`name` is used for both the caption and the image alt text. `logo` is the path to your file
under `static/`. The marquee is generated from this file, so there is no HTML to edit.

### 3. Open the pull request

Use the [company logo template](https://github.com/agentgateway/website/compare?template=company-logo.md),
which carries the review checklist. Screenshots of the marquee in light and dark mode
(`hugo server`) make review much faster.
