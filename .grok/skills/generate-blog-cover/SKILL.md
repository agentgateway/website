---
name: generate-blog-cover
description: >
  Generate consistent ultra-simple hand-drawn line art cover images for new agentgateway blog posts, using the exact same basic clean sketch style (one single large symbolic element, simple black ink outlines, almost no shading, flat or no colors, very basic icons, generous whitespace, 16:9). 
  Trigger when user says "generate blog cover", "new blog image", "create cover for [title]", "blog cover in same style", "hand drawn blog image", or when adding a new post to content/blog/. 
  Also use for /generate-blog-cover or when editing a new .md in content/blog/.
---
# Generate Blog Cover Image

This skill ensures every new blog post gets a cover image in the **exact same ultra-simple hand-drawn line art style** (basic black ink outlines, one main symbolic element, very minimal, clean and sparse like a quick sketch) as the other covers in `static/img/blog/covers/`.

## When to use this skill
- User is creating a new blog post (new .md in content/blog/)
- User asks to generate / create / make a cover image for a blog
- User says "same style as the others", "hand drawn blog cover", "more simple", "ultra simple", "basic line art cover", "make the images more simple"
- After writing the frontmatter/title/description of a new post

## Step-by-step process

1. **Identify the blog post**
   - If the user mentions a specific file or title, read the Markdown file from `content/blog/`.
   - Extract:
     - `title`
     - `description` (or first paragraph of content for summary)
     - `category`
     - The filename slug (e.g. `2026-06-04-my-new-post` from `2026-06-04-my-new-post.md`)
   - If no file exists yet, ask the user for the title + short description + desired category (Release, Tutorial, Announcement, etc.) and proposed filename slug (use `date-slug` format).

2. **Craft the Central Element**
   - Analyze the title and description.
   - Come up with **one or two very simple symbolic elements** that represent the post (keep it extremely minimal — no people, no busy scenes, no small text/icons).
   - Examples of good simple elements (study existing covers for consistency):
     - Release / version: "a simple gateway arch"
     - Tutorial / how-to: "a simple path or arrow icon"
     - Security / auth: "a simple lock icon"
     - Migration: "a simple arrow"
     - Integration / observability: "a simple line or wave"
     - Multi / federation: "a simple gateway with small icons"
     - Architecture / kill switch: "a simple arch with a power symbol"
     - Anniversary / milestone: "a simple '1' badge"
   - Make the description short and iconic.

3. **Build the full image_gen prompt**
   Use this **exact base prompt** every time (do not deviate from the style):

   ```
   Ultra simple hand-drawn line art illustration for a professional developer blog cover. Very clean black ink outlines, almost no shading or hatching, extremely basic iconic symbols only (no people or characters). Light off-white background. Extremely minimalist composition with one single bold symbolic element. Warm orange, deep purple, blue accents if needed. Lots of negative space, calm, clean and professional. Deliberately basic and hand-drawn like a simple sketch, not detailed or cartoonish. 16:9 wide. Central element: [YOUR TAILORED SIMPLE ELEMENT HERE]
   ```

4. **Generate the image**
   - Call the `image_gen` tool with:
     - `prompt`: the full prompt from step 3
     - `aspect_ratio`: "16:9"
   - Note the output path (it will be something like `.../images/XX.jpg` in the current session).

5. **Place the image correctly**
   - Copy the generated image to:
     ```
     static/img/blog/covers/<slug>.jpg
     ```
     (Replace `<slug>` with the exact base name of the .md file, e.g. `2026-06-04-my-post`).
   - Use `cp` or equivalent via terminal. Overwrite if needed.
   - Confirm the file now exists at that location.

6. **Verify and suggest next steps**
   - Tell the user the image was created.
   - Optionally run a quick Hugo build check or just remind them to refresh localhost:1313/blog/
   - If the post doesn't have `coverImage` in frontmatter, suggest they don't need it (the lp-list shortcode auto-falls back to `/img/blog/covers/<slug>.jpg`).
   - Offer to generate a new one with tweaks if the central element wasn't perfect.

## Style rules (never break these)
- Always exactly 1 main element (or 2 at absolute most) — keep it extremely basic and iconic.
- Very clean black ink outlines, almost zero shading or hatching.
- Extremely basic symbolic icons only — no people, no characters, no details.
- Light off-white background.
- Brand palette: warm orange, deep purple, blue accents (used sparingly).
- Lots of negative space — calm, clean, professional and very sparse.
- No text in the image.
- No photorealism, no cartoonish features, no AI polish, no heavy details — deliberately ultra-simple hand-drawn line sketch style.
- 16:9 (aspect-video) for the 3-column grid.

## Existing examples for reference (read these if needed for inspiration on composition and central elements — they are now in the ultra-simple line art style)
- `static/img/blog/covers/2026-06-04-agentgateway-joins-aaif.jpg`
- `static/img/blog/covers/2026-05-11-agentgateway-v1.2.0.jpg`
- `static/img/blog/covers/2026-02-21-kill-switch.jpg`
- Any other in `static/img/blog/covers/`

Note: All covers have been (or will be) regenerated in the new ultra-simple hand-drawn line art style while keeping the same central symbolic ideas for consistency.

## Helper commands (use via run_terminal_command when needed)
- List existing covers: `ls static/img/blog/covers/*.jpg | sort`
- Get slug from a new file: `basename content/blog/NEW-FILE.md .md`
- Copy after generation: `cp /path/to/generated/XX.jpg static/img/blog/covers/<slug>.jpg`

This skill guarantees visual consistency across all blog covers.
