/**
 * Markdown Configuration - Setup for marked.js and highlight.js
 * Expects marked and hljs to be loaded globally via CDN
 */

let markedConfigured = false;

/**
 * Configure marked for code highlighting
 */
export function configureMarked() {
  if (typeof window.marked === 'undefined') {
    console.warn('marked.js not loaded, falling back to plain text');
    return null;
  }

  if (!markedConfigured) {
    window.marked.setOptions({
      highlight: function(code, lang) {
        // hljs is loaded globally from CDN in the HTML
        if (typeof window.hljs !== 'undefined') {
          if (lang && window.hljs.getLanguage(lang)) {
            try {
              return window.hljs.highlight(code, { language: lang }).value;
            } catch (err) {
              console.error('Highlight error:', err);
            }
          }
          return window.hljs.highlightAuto(code).value;
        }
        return code;
      },
      breaks: true,
      gfm: true,
    });
    markedConfigured = true;
  }

  return window.marked;
}

/**
 * Parse markdown to HTML
 * @param {string} content - Markdown content
 * @returns {string} HTML string
 */
export function parseMarkdown(content) {
  const marked = configureMarked();

  if (marked && typeof marked.parse === 'function') {
    return marked.parse(content);
  }

  // Fallback to plain text with basic escaping
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}
