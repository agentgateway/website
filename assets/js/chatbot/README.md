# Chatbot Module

A modular, Alpine.js-based chatbot widget for the agentgateway documentation site.

## Architecture

The chatbot has been refactored into a clean, modular structure following modern JavaScript practices:

```
assets/js/chatbot/
├── index.js      # Main entry point - Alpine.js component initialization
├── stream.js     # Server-Sent Events (SSE) streaming logic
├── ui.js         # UI utilities, animations, and markdown rendering
└── markdown.js   # Markdown configuration and parsing
```

### Module Responsibilities

**index.js** - Alpine.js Component
- Initializes the chatbot Alpine.js component
- Manages state (open/closed, messages, input, etc.)
- Orchestrates user interactions
- Coordinates between streaming, UI, and markdown modules

**stream.js** - ChatStreamer Class
- Handles EventSource connections to the agent endpoint
- Parses SSE events (token, stage, done, error)
- Provides clean callback interface for streaming events
- Isolated from UI concerns - purely data/network layer

**ui.js** - UI Utilities
- `ThinkingAnimator`: Manages bouncing character animations during "thinking" states
- `MarkdownRenderer`: Buffers and renders streaming markdown with code block support
- SVG icon constants for UI buttons
- Pure utility functions without Alpine.js dependencies

**markdown.js** - Markdown Configuration
- Configures marked.js for GFM and syntax highlighting
- Integrates with highlight.js for code block highlighting
- Provides parseMarkdown function used by the renderer
- Expects marked and hljs to be loaded globally

## Dependencies

The chatbot requires the following external libraries loaded via CDN:

1. **Alpine.js** (v3.x) - Reactive component framework
2. **marked.js** (v11.1.1) - Markdown parsing
3. **highlight.js** (v11.9.0) - Code syntax highlighting

These are loaded in `layouts/partials/chatbot.html` before the bundled chatbot script.

## Build Process

Hugo Pipes with esbuild compiles the modular JavaScript:

```go
{{- $opts := dict "targetPath" "js/chatbot.bundle.js" "minify" hugo.IsProduction "target" "es2015" -}}
{{- $js := resources.Get "js/chatbot/index.js" | js.Build $opts | fingerprint -}}
```

This bundles all modules (index, stream, ui, markdown) into a single `chatbot.bundle.js` file.

## Usage

The chatbot is included in documentation pages via the partial:

```go
{{ partial "chatbot.html" . }}
```

No additional configuration is needed. The chatbot automatically:
- Loads on documentation pages
- Connects to the agent endpoint
- Streams responses with markdown rendering
- Handles errors gracefully

## Styling

Styles are in `assets/css/chatbot.css` and use Tailwind utility classes in the HTML for most styling. The CSS file contains:
- Animation keyframes
- Component-specific state classes
- Scrollbar styling
- Markdown content styling for responses

## Customization

### Changing the Agent Endpoint

Edit the `AGENT_ENDPOINT` constant in `index.js`:

```javascript
const AGENT_ENDPOINT = 'https://your-agent-endpoint.com';
```

### Modifying Thinking Stages

Edit the `STAGE_MESSAGES` object in `index.js`:

```javascript
const STAGE_MESSAGES = {
  'contextualize': '...your message',
  'search': '...your message',
  'expand': '...your message',
  'generate': '...your message'
};
```

### Adjusting Animations

Animation timing and keyframes are in `chatbot.css`. Key animations:
- `dialogSlideIn` - Dialog appearance
- `messageSlideIn` - Message appearance
- `spin` - Avatar loading spinner
- `bounceSingle` - Thinking character bounce
- `blink` - Code cursor blink
- `codeLine` - Code line reveal

