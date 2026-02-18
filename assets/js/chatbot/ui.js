/**
 * UI Utilities - Animation helpers and DOM manipulation utilities
 */

/**
 * ThinkingAnimator - Manages the bouncing character animation in thinking states
 */
export class ThinkingAnimator {
  constructor() {
    this.animationInterval = null;
  }

  start(element) {
    const chars = element.querySelectorAll('span');
    if (chars.length === 0) return;

    // Stop any existing animation
    this.stop();

    const bounceRandomChar = () => {
      const randomIndex = Math.floor(Math.random() * chars.length);
      const char = chars[randomIndex];
      char.classList.add('bouncing');
      setTimeout(() => char.classList.remove('bouncing'), 600);
    };

    // Bounce immediately, then every 700ms
    bounceRandomChar();
    this.animationInterval = setInterval(bounceRandomChar, 700);
  }

  stop() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }
}

/**
 * MarkdownRenderer - Handles buffered markdown rendering with code block streaming
 */
export class MarkdownRenderer {
  constructor(renderFn) {
    this.renderFn = renderFn; // marked.parse or fallback
    this.tokenBuffer = '';
    this.renderTimeout = null;
    this.content = '';
    this.lastRenderedHTML = '';
    this.lastRenderedCodeBlockCount = 0;
    this.lastCodeBlockLineCount = 0;
  }

  /**
   * Add tokens to the buffer
   */
  addToken(token) {
    this.tokenBuffer += token;

    // Render if buffer contains newline or is too large
    const hasNewline = this.tokenBuffer.includes('\n');
    const bufferTooLarge = this.tokenBuffer.length > 50;

    if (hasNewline || bufferTooLarge) {
      if (this.renderTimeout) {
        clearTimeout(this.renderTimeout);
        this.renderTimeout = null;
      }
      this.render();
    } else {
      // Set timeout to render if no newline comes soon
      if (this.renderTimeout) {
        clearTimeout(this.renderTimeout);
      }
      this.renderTimeout = setTimeout(() => {
        this.render();
        this.renderTimeout = null;
      }, 100);
    }
  }

  /**
   * Render buffered content with line-by-line code block reveal
   */
  render() {
    if (this.tokenBuffer.length === 0) {
      // Return cached HTML if buffer is empty
      return this.lastRenderedHTML;
    }

    this.content += this.tokenBuffer;
    this.tokenBuffer = '';

    // Check for incomplete code blocks
    const codeBlockMatches = this.content.match(/```/g);
    const codeBlockCount = codeBlockMatches ? codeBlockMatches.length : 0;
    const hasIncompleteCodeBlock = codeBlockCount % 2 === 1;

    let contentToRender = this.content;
    let incompleteCodeBlockHTML = '';

    if (hasIncompleteCodeBlock) {
      const lastCodeBlockStart = this.content.lastIndexOf('```');
      const beforeCodeBlock = this.content.substring(0, lastCodeBlockStart);
      const codeBlockContent = this.content.substring(lastCodeBlockStart + 3);

      // Extract language
      const firstLineBreak = codeBlockContent.indexOf('\n');
      const codeText = firstLineBreak >= 0
        ? codeBlockContent.substring(firstLineBreak + 1)
        : codeBlockContent;

      const lines = codeText.split('\n');
      const completeLines = lines.slice(0, -1);
      const incompleteLine = lines[lines.length - 1];
      const newLineCount = completeLines.length;

      incompleteCodeBlockHTML = '<pre><code>';
      completeLines.forEach((line, index) => {
        const escapedLine = this._escapeHtml(line);
        if (index >= this.lastCodeBlockLineCount) {
          incompleteCodeBlockHTML += `<span class="chatbot-code-line">${escapedLine}\n</span>`;
        } else {
          incompleteCodeBlockHTML += escapedLine + '\n';
        }
      });

      this.lastCodeBlockLineCount = newLineCount;

      if (incompleteLine) {
        incompleteCodeBlockHTML += this._escapeHtml(incompleteLine);
      }
      incompleteCodeBlockHTML += '<span class="chatbot-code-cursor"></span></code></pre>';

      contentToRender = beforeCodeBlock;
    }

    // Render markdown for complete parts
    let html = this.renderFn(contentToRender) || '';

    // Append incomplete code block
    if (hasIncompleteCodeBlock) {
      html += incompleteCodeBlockHTML;
    }

    // Track completed code blocks
    if (!hasIncompleteCodeBlock && codeBlockCount > this.lastRenderedCodeBlockCount) {
      this.lastRenderedCodeBlockCount = codeBlockCount;
      this.lastCodeBlockLineCount = 0;
    }

    // Cache the rendered HTML
    this.lastRenderedHTML = html;

    return html;
  }

  /**
   * Flush any remaining buffered content
   */
  flush() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
    if (this.tokenBuffer.length > 0) {
      return this.render();
    }
    return this.render();
  }

  /**
   * Reset the renderer state
   */
  reset() {
    this.tokenBuffer = '';
    this.content = '';
    this.lastRenderedHTML = '';
    this.lastRenderedCodeBlockCount = 0;
    this.lastCodeBlockLineCount = 0;
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
  }

  /**
   * Get the current rendered content
   */
  getContent() {
    return this.content;
  }

  _escapeHtml(text) {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

/**
 * Resize button SVG icons
 */
export const RESIZE_ICONS = {
  expand: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 3 21 3 21 9"></polyline>
      <polyline points="9 21 3 21 3 15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
  `,
  collapse: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 14 10 14 10 20"></polyline>
      <polyline points="20 10 14 10 14 4"></polyline>
      <line x1="14" y1="10" x2="21" y2="3"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
  `
};
