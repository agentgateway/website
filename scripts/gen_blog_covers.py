#!/usr/bin/env python3
"""
Generate comic-book style cover images for blog posts using OpenAI gpt-image-1.

For each post in content/blog/*.md it builds a prompt from the title +
description + a snippet of the body, then calls the OpenAI images "edits"
endpoint passing the agentgateway logo as a reference image so the real brand
mark is rendered into the scene. Output PNGs land in
static/img/blog/covers/<slug>.png.

Usage:
    OPENAI_API_KEY=... python3 scripts/gen_blog_covers.py            # all posts, skip existing
    python3 scripts/gen_blog_covers.py --force                       # regenerate everything
    python3 scripts/gen_blog_covers.py <slug> [<slug> ...]           # only these posts
    python3 scripts/gen_blog_covers.py --limit 1                     # validate on one post

No third-party deps beyond `requests` (stdlib + requests only).
"""
import argparse
import base64
import os
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
BLOG_DIR = ROOT / "content" / "blog"
OUT_DIR = ROOT / "static" / "img" / "blog" / "covers"
LOGO_PNG = ROOT / "assets" / "img" / "logo-agentgateway-transparent.png"

API_URL = "https://api.openai.com/v1/images/edits"
MODEL = "gpt-image-1"
SIZE = "1024x1024"
QUALITY = "medium"

# Normalize inconsistent author frontmatter -> canonical display name.
AUTHOR_CANON = {
    "sebastian": "Sebastian Maniak",
    "sebastian maniak": "Sebastian Maniak",
    "lin sun": "Lin Sun",
    "christian posta": "Christian Posta",
    "daneyon hansen": "Daneyon Hansen",
    "eitan suez": "Eitan Suez",
    "agentic ai foundation": "Agentic AI Foundation",
}


def canon_author(raw: str) -> str:
    """Return the primary, canonicalized author name."""
    primary = re.split(r"[,&]", raw)[0].strip()
    return AUTHOR_CANON.get(primary.lower(), primary)


def parse_frontmatter(text: str):
    """Return (frontmatter_dict, body) for a Hugo markdown file."""
    fm = {}
    body = text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            block = text[3:end]
            body = text[end + 4:]
            for line in block.splitlines():
                m = re.match(r'^(\w+):\s*(.*)$', line)
                if m:
                    key, val = m.group(1), m.group(2).strip()
                    val = val.strip('"').strip("'")
                    fm[key] = val
    return fm, body


def body_snippet(body: str, limit: int = 600) -> str:
    """First few sentences of prose, stripped of markdown noise."""
    lines = []
    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith(("#", ">", "-", "*", "|", "```", "{{", "<")):
            continue
        lines.append(s)
        if sum(len(x) for x in lines) > limit:
            break
    snippet = " ".join(lines)
    snippet = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", snippet)  # md links -> text
    snippet = re.sub(r"[*_`]", "", snippet)
    return snippet[:limit]


def build_prompt(title: str, desc: str, author: str, body: str) -> str:
    topic = desc or body_snippet(body)
    return f"""A modern flat editorial comic-book illustration for a tech blog cover, square format.

STYLE: clean bold vector line art, limited brand palette of vivid orange (#E9622E),
deep indigo/purple (#4F46E5) and slate gray on a light off-white background with
a subtle halftone-dot texture. Confident comic-book ink outlines, friendly and
energetic, professional tech-editorial look (similar to a developer-platform
illustration). Flat shading, no photorealism.

SCENE: visually represent this article in a metaphorical, conceptual way -
title: "{title}"
about: {topic}
Show a clean technical metaphor (gateways, routing arrows, connected services,
cloud/Kubernetes, AI agents and tools as friendly characters) that fits the topic.
Include a friendly professional engineer character as the focal figure.

BRANDING: integrate the agentgateway logo shown in the provided reference image
as a small, crisp brand mark in one corner. Keep the logo's real shape and colors.

TEXT: do NOT add paragraphs of text or captions; at most the single word
"agentgateway" near the logo. Avoid gibberish text. Keep it clean.
"""


def collect_posts(only_slugs):
    posts = []
    for path in sorted(BLOG_DIR.glob("*.md")):
        slug = path.stem
        if slug == "_index":
            continue
        if only_slugs and slug not in only_slugs:
            continue
        text = path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        title = fm.get("title", slug)
        if not title or title == "Blog":
            continue
        posts.append({
            "slug": slug,
            "path": path,
            "title": title,
            "desc": fm.get("description", ""),
            "author": canon_author(fm.get("author", "")),
            "body": body,
            "has_cover": "coverImage" in fm,
        })
    return posts


def generate(post, api_key) -> bool:
    prompt = build_prompt(post["title"], post["desc"], post["author"], post["body"])
    out_path = OUT_DIR / f"{post['slug']}.png"
    print(f"  -> generating {post['slug']} (author: {post['author']})")
    with open(LOGO_PNG, "rb") as logo_f:
        resp = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": MODEL, "size": SIZE, "quality": QUALITY, "prompt": prompt},
            files={"image[]": ("logo.png", logo_f, "image/png")},
            timeout=300,
        )
    if resp.status_code != 200:
        print(f"  !! API error {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
        return False
    data = resp.json()
    b64 = data["data"][0]["b64_json"]
    out_path.write_bytes(base64.b64decode(b64))
    print(f"  ok  {out_path.relative_to(ROOT)}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*", help="only generate these post slugs")
    ap.add_argument("--force", action="store_true", help="regenerate even if PNG exists")
    ap.add_argument("--limit", type=int, default=0, help="stop after N images")
    args = ap.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("OPENAI_API_KEY is not set")
    if not LOGO_PNG.exists():
        sys.exit(f"logo not found: {LOGO_PNG}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    posts = collect_posts(set(args.slugs))
    done = 0
    for post in posts:
        out_path = OUT_DIR / f"{post['slug']}.png"
        if out_path.exists() and not args.force:
            print(f"  skip {post['slug']} (cover exists)")
            continue
        if generate(post, api_key):
            done += 1
        if args.limit and done >= args.limit:
            break
    print(f"\nGenerated {done} cover(s) into {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
