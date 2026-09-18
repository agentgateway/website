#!/usr/bin/env python3
"""
Rewrite stale agentgateway.dev doc URLs in generated reference docs.

WHY THIS EXISTS. The reference docs for a released version are generated from that
version's git TAG, so their links are frozen at whatever the chart comments said on
release day. A link fix that lands in agentgateway main after the tag was cut cannot
reach the generated docs until the NEXT release, and the nightly regeneration undoes
any hand-edit made to the generated file in the meantime.

Concretely: v1.5.0's values.yaml points discoveryNamespaceSelectors at
/docs/kubernetes/latest/install/advanced/. The docs moved that page under
documentation/ afterwards, and agentgateway#3427 repointed the comment, but v1.5.0 is
frozen, so every nightly run reintroduced the old URL.

WHAT IT DOES. Applies this repo's own static/_redirects rules to the generated
markdown, so a link that only resolved via a runtime 301 is written out already
pointing at its current home.

WHY _redirects AND NOT A LOOKUP TABLE. static/_redirects is already the thing that has
to be updated whenever a page moves, and it is already correct. A second map in this
script would be a second place to forget.

Matching follows Cloudflare Pages: rules are tried in file order, first match wins, a
:placeholder matches exactly one path segment, and a trailing * matches the rest
(possibly empty). Rules whose target is not a site-relative path are skipped, so the
off-site rules (/install, /examples/*, and friends) can never pull a docs link out to
raw.githubusercontent.com.

VERSION RETARGETING (--version). Separately from the path fix above, these URLs hardcode
"latest" because the chart comments they come from do. That sends a reader of the frozen
1.5.x Helm reference to the CURRENT release's docs. retarget_version rewrites the version
segment to the version being generated, but only when that content tree exists: a numbered
snapshot is frozen at release and its tree is not created until the version is archived, so
rewriting unconditionally would 404 for the whole window in between.

Usage:
  # as a library, from generate-ref-docs.py
  from normalize_doc_links import load_rules, normalize_text, retarget_version

  # standalone, to repair already-frozen files in place
  python3 scripts/normalize_doc_links.py assets/agw-docs/pages/reference/helm/1.5.x/*.md

  # same, and point the links at that version's own docs (run this when a version
  # is archived and content/docs/<section>/<version>/ comes into existence)
  python3 scripts/normalize_doc_links.py --version 1.5.x \
      assets/agw-docs/pages/reference/helm/1.5.x/*.md
"""

import os
import re
import sys

SITE = "https://agentgateway.dev"

# Generated markdown puts these URLs inside table cells and mid-sentence, so the match
# has to stop before the surrounding punctuation: the cell delimiter, the literal <br/>
# the generator injects, a closing paren from markdown link syntax, and a quote. The
# sentence-ending period is stripped separately, since a period is legal inside a URL.
_URL_RE = re.compile(r"https://agentgateway\.dev(/[^\s<>|\"')\]]*)")

# A trailing * makes the rule a splat rule; :name matches exactly one path segment.
_PLACEHOLDER_RE = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")

# A rewritten URL can match a later rule, so re-apply until it settles. The cap turns a
# cycle in _redirects into a loud failure instead of a hang.
_MAX_HOPS = 10


def load_rules(redirects_path):
    """Parse _redirects into [(from, to), ...] in file order, site-relative targets only."""
    rules = []
    with open(redirects_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            source, target = parts[0], parts[1]
            # Off-site targets (raw.githubusercontent.com and friends) are downloads, not
            # doc pages. Rewriting a doc link into one would be worse than leaving it stale.
            if not target.startswith("/"):
                continue
            rules.append((source, target))
    return rules


def _rule_regex(source):
    """Build a match pattern for one rule source, mirroring Cloudflare's semantics."""
    splat = source.endswith("*")
    body = source[:-1] if splat else source

    pattern = ""
    pos = 0
    for match in _PLACEHOLDER_RE.finditer(body):
        pattern += re.escape(body[pos:match.start()])
        # A placeholder is one segment, so it cannot span a slash.
        pattern += f"(?P<{match.group(1)}>[^/]+)"
        pos = match.end()
    pattern += re.escape(body[pos:])
    # An empty splat is a match: /install* covers /install itself.
    pattern += "(?P<splat>.*)" if splat else ""
    return re.compile("^" + pattern + "$")


def _apply(path, rules):
    """Return path rewritten by the first matching rule, or None if nothing matches."""
    for source, target in rules:
        match = _rule_regex(source).match(path)
        if not match:
            continue
        groups = match.groupdict()
        result = target
        # Longest name first, so :section never eats the leading characters of a longer
        # placeholder name that happens to share its prefix.
        for name in sorted(groups, key=len, reverse=True):
            if name == "splat":
                continue
            result = result.replace(f":{name}", groups[name])
        result = result.replace(":splat", groups.get("splat", "") or "")
        return result
    return None


def resolve(path, rules):
    """Follow the redirect chain for one path until it stops moving."""
    seen = {path}
    current = path
    for _ in range(_MAX_HOPS):
        nxt = _apply(current, rules)
        if nxt is None or nxt == current:
            return current
        if nxt in seen:
            raise ValueError(f"redirect cycle in _redirects reached from {path}")
        seen.add(nxt)
        current = nxt
    raise ValueError(f"redirect chain from {path} exceeded {_MAX_HOPS} hops")


def normalize_text(text, rules, on_rewrite=None):
    """Rewrite every agentgateway.dev URL in text through the redirect rules.

    on_rewrite, when given, is called with (before, after) for each change, so the caller
    can surface it. A rewrite means the generated source shipped a URL that only worked
    via a 301, which is usually a stale link upstream and worth seeing in the log.
    """
    def replace(match):
        url = match.group(0)
        # A period or comma at the end is the sentence, not the URL. Peel it off, rewrite
        # the rest, and put it back.
        trailing = ""
        while url and url[-1] in ".,;:":
            trailing = url[-1] + trailing
            url = url[:-1]

        path = url[len(SITE):]
        # The fragment and query never reach the redirect engine, so they ride along.
        anchor = ""
        for sep in ("#", "?"):
            idx = path.find(sep)
            if idx != -1:
                anchor = path[idx:] + anchor
                path = path[:idx]

        resolved = resolve(path, rules)
        if resolved == path:
            return url + trailing

        after = SITE + resolved + anchor
        if on_rewrite:
            # url still carries the anchor, so report it as-is rather than re-appending.
            on_rewrite(url, after)
        return after + trailing

    return _URL_RE.sub(replace, text)


# Doc URLs carry the version they point at: /docs/<section>/<version>/<rest>.
_DOC_URL_RE = re.compile(
    re.escape(SITE) + r"/docs/(?P<section>kubernetes|standalone)/(?P<version>[^/\s]+)(?P<rest>/[^\s<>|\"')\]]*)?"
)


def version_tree_exists(section, version, website_dir):
    """True when content/docs/<section>/<version>/ is a real tree on the site."""
    return os.path.isdir(os.path.join(website_dir, "content", "docs", section, version))


def retarget_version(text, version, website_dir, on_rewrite=None, on_skip=None):
    """Point doc URLs at the version being generated instead of whatever they hardcode.

    WHY. The chart comments these URLs come from hardcode "latest", so every generated
    artifact links to latest no matter which version it documents. A reader on the frozen
    1.5.x Helm reference gets sent to the current release's docs, which may describe
    different behaviour than the values they are reading.

    SAFETY. A version is only substituted when content/docs/<section>/<version>/ exists.
    A numbered snapshot is frozen at release but its content tree is not created until the
    version is archived, so rewriting unconditionally would turn a working link into a 404
    for the whole window in between. Skips are reported rather than silently dropped.
    """
    def replace(match):
        section = match.group("section")
        current = match.group("version")
        rest = match.group("rest") or ""
        if current == version:
            return match.group(0)
        if not version_tree_exists(section, version, website_dir):
            if on_skip:
                on_skip(section, version, match.group(0))
            return match.group(0)
        after = f"{SITE}/docs/{section}/{version}{rest}"
        if on_rewrite:
            # rest runs to the end of the URL-ish run, which in prose swallows the
            # sentence's full stop. Both sides keep it, so only the log needs trimming.
            trim = len(rest) - len(rest.rstrip(".,;:"))
            before_log = match.group(0)[:-trim] if trim else match.group(0)
            after_log = after[:-trim] if trim else after
            on_rewrite(before_log, after_log)
        return after

    return _DOC_URL_RE.sub(replace, text)


def normalize_file(file_path, rules, on_rewrite=None):
    """Rewrite one file in place. Returns True if the file changed."""
    with open(file_path, encoding="utf-8") as f:
        original = f.read()
    updated = normalize_text(original, rules, on_rewrite)
    if updated == original:
        return False
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(updated)
    return True


def main():
    args = sys.argv[1:]
    version = ""
    files = []
    i = 0
    while i < len(args):
        if args[i] == "--version":
            i += 1
            if i >= len(args):
                print("Error: --version needs a value (e.g. main, latest, 1.5.x)")
                sys.exit(1)
            version = args[i]
        elif args[i].startswith("--version="):
            version = args[i].split("=", 1)[1]
        else:
            files.append(args[i])
        i += 1

    if not files:
        print(__doc__)
        print("Error: pass at least one file to normalize")
        sys.exit(1)

    website_dir = os.environ.get("WEBSITE_DIR", ".")
    redirects_path = os.path.join(website_dir, "static", "_redirects")
    if not os.path.isfile(redirects_path):
        print(f"Error: {redirects_path} not found")
        sys.exit(1)

    rules = load_rules(redirects_path)
    print(f"Loaded {len(rules)} site-relative redirect rules from {redirects_path}")
    if version:
        print(f"Retargeting doc links to version {version}")

    changed = 0
    skipped = set()
    for file_path in files:
        rel = os.path.relpath(file_path, website_dir)
        with open(file_path, encoding="utf-8") as f:
            original = f.read()

        updated = normalize_text(
            original, rules, lambda b, a, r=rel: print(f"  {r}: {b} -> {a}")
        )
        if version:
            updated = retarget_version(
                updated,
                version,
                website_dir,
                on_rewrite=lambda b, a, r=rel: print(f"  {r}: {b} -> {a}"),
                on_skip=lambda sec, ver, url: skipped.add((sec, ver)),
            )

        if updated != original:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(updated)
            changed += 1

    for section, ver in sorted(skipped):
        print(
            f"  Note: left {section} links at their original version; "
            f"content/docs/{section}/{ver}/ does not exist yet"
        )

    print(f"Done: rewrote {changed}/{len(files)} files")


if __name__ == "__main__":
    main()
