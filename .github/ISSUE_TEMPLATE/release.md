---
name: New release
about: Update the docs for a minor version release
title: 'Doc release for version <x.x.x>'
labels: 'documentation'
assignees: ''

---

> [!CAUTION]  
> Don't open a doc release PR too early! The release PR makes changes to the doc directories that content is published in. Therefore, in-progress doc PRs can be impacted. If those PRs update mostly only reuse files in the assets/docs directory, the impact is probably not as large, but they might need to update version tags or the content/docs skeleton pages that call the reuse files. 

## Pre-release

- [ ] Confirm that the upgrade and release note pages are updated. Typically, this is a separate issue.
- [ ] Rotate the version directories in `content/docs/kubernetes` and `content/docs/standalone`. agentgateway publishes only `n` as `latest` and `n+1` as `main` in development.
  - Move the old `latest` to a frozen `<version>` directory, such as `1.5.x`. Keep it unzipped: the archived directories still build, and the enterprise docs consume upstream archived versions. Older standalone versions are kept as `<version>.zip`.
  - Copy `main` to `latest`, and keep `main` for the next version. Copy only tracked files, such as with `git archive`, so that `.DS_Store` and other ignored files stay out.
  - In the new `latest` trees, rewrite `/docs/<section>/main/` to `/docs/<section>/latest/`, and doc-test `content/docs/<section>/main/` file refs to `latest`. This covers `aliases`, `url` overrides, links, and front-matter comments that name the prefix without a trailing slash.
  - In the frozen `<version>` trees, rewrite `/docs/<section>/latest/` and `content/docs/<section>/latest/` to `<version>`, including links between the two frozen trees. Otherwise, their aliases collide with the new `latest` trees. Leave absolute `agentgateway.dev` URLs as they are.
- [ ] For the _index.md pages of each version, update the version in the title. Move the PDF `outputs: [... "book"]` opt-in to the new `latest` pages, and remove it from the frozen `<version>` pages.
- [ ] In the `hugo.yaml` file, update the `versions` to include the new minor version as main and the previous main as latest. The previous latest leaves the list.
- [ ] Update the version conrefs in the `assets/agw-docs/versions` directory. Often, there is not a release for the next version, so you might have to use the same for latest and main.
- [ ] Add the release date and compatibility versions to the version table in `assets/agw-docs/pages/reference/versions.md`. Keep the rows of earlier versions.
- [ ] Update the version shortcodes to include the newest version. For example, if 2.2.x is the latest release, search for `version include-if="2.1.x"` to add `version include-if="2.2.x,2.1.x"`. Keep in mind that the include-if might start with different versions, like `include-if="2.0.x,2.1.x,2.2.x"` so do a few searches.
  - Example find and replacements for a hypothetical 2.8 release
    1. `"2.8.x,` > `"2.9.x,2.8.x,`
    2. `,2.8.x"` > `,2.8.x,2.9.x"`
    3. `"2.8.x"` > `"2.9.x,2.8.x"`
  - Keep retired version tokens in the lists, and keep content that is gated to retired versions. The archived directories and the enterprise docs, which remap upstream tokens to enterprise versions, still use them. Gate with upstream version tokens only.
  - A gate around a generated snippet must reuse each version's own copy. For example, `include-if="<main version>"` reuses `metrics-control-plane-main.md`, and each released version reuses its numbered snapshot, such as `metrics-control-plane-1.6.x.md`.
- [ ] Search content for any hard-coded instances of the version, like `2.1`, as well as any retired versions, and update if needed. Example pages are upgrade, version skew, and reference pages.
- [ ] Pin the generated reference assets in `assets/agw-docs/pages/reference` to each version.
  - Refresh the moving `latest` assets from `main`: the `agctl`, `api`, `cel`, `configuration`, and `helm` directories, `api/api-latest.md`, and `snippets/metrics-control-plane-latest.md`.
  - Point the new `latest` trees at the `latest` assets instead of `main`.
  - Point the frozen `<version>` trees at frozen copies. The reference docs workflow already writes numbered `helm/<version>` and `metrics-control-plane-<version>.md` snapshots. Copy `agctl/latest` to `agctl/<version>` and `api/api-latest.md` to `api/api-<NN>x.md` yourself, before you refresh `latest`.
  - Run `python3 scripts/check_generated_asset_pins.py`.
  - Run `python3 scripts/normalize_doc_links.py --version <version> assets/agw-docs/pages/reference/helm/<version>/*.md` so that the frozen Helm reference links to its own docs.
- [ ] Promote the `main` UI screenshots: move `assets/img/main/*` over the shared `assets/img/` images, and remove `assets/img/main`. Check that no content references `img/main/` explicitly, because `reuse-image` renders nothing for a missing image.
- [ ] Restore retired URLs. Compare the `aliases` of the old `latest` trees with the new ones, and list the old `latest` pages that no longer exist. Add each missing URL as an alias, in both `latest` and `main` with that tree's own version segment.
- [ ] Build the site, and compare the old `latest` and `main` URLs and the broken internal links with a build of the commit before the release.
- [ ] Open, review, and merge this release PR.

## Post-release

- [ ] Trigger the [reference docs workflow](https://github.com/agentgateway/website/actions/workflows/reference-docs.yaml).
- [ ] Merge in the autogenerated PR that the workflow created
- [ ] Verify that the docs are published
- [ ] Cut a GitHub release of the docs repo for the new release, and include any retired version (such as `Release for 2.6.x and last state for retired 2.2.x`)
