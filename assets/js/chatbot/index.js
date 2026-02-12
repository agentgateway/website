/**
 * Chatbot - Alpine.js component for the agentgateway assistant
 * Expects Alpine.js to be loaded globally via CDN
 *
 * State is persisted to sessionStorage so conversations survive
 * full-page navigations in this Hugo static site.
 */

import { ChatStreamer, ErrorType } from './stream.js';
import { ThinkingAnimator, MarkdownRenderer } from './ui.js';
import { parseMarkdown } from './markdown.js';

const AGENT_ENDPOINT = 'https://docs-search-agent.is.solo.io';
const STORAGE_KEY = 'chatbot-state';

/**
 * Register chatbot component with Alpine.js before it initializes
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('chatbot', () => ({
    // State
    isOpen: false,
    isExpanded: false,
    isProcessing: false,
    userInput: '',
    messages: [],
    selectedModel: 'local',
    pageContextEnabled: false,

    // Internal state
    showThinking: false,
    sessionId: '',
    inputHeight: 68,
    showContextMenu: false,
    showModelMenu: false,

    // Utilities
    streamer: null,
    thinkingAnimator: null,
    markdownRenderer: null,
    currentEventSource: null,

    init() {
      this.streamer = new ChatStreamer(AGENT_ENDPOINT);
      this.thinkingAnimator = new ThinkingAnimator();
      this.markdownRenderer = new MarkdownRenderer(parseMarkdown);

      // Restore persisted state from previous page (must happen before detectModelFromPath)
      this.restoreState();

      // Detect model based on current URL path (only if no restored model)
      if (!this.sessionId) {
        this.selectedModel = this.detectModelFromPath();
      }

      // Focus input when dialog opens
      this.$watch('isOpen', (value) => {
        if (value) {
          // Generate session ID if we don't have one yet
          if (!this.sessionId) {
            this.sessionId = this.generateSessionId();
          }
          this.$nextTick(() => {
            this.$refs.input?.focus();
          });
        } else {
          // Stop any active stream on close, but preserve messages
          this.stopActiveStream();
          this.showContextMenu = false;
          this.showModelMenu = false;
        }
        this.saveState();
      });

      // Auto-resize textarea as user types
      this.$watch('userInput', () => {
        this.autoResizeInput();
      });

      // Save state before navigating away (safety net for in-flight streams)
      window.addEventListener('beforeunload', () => {
        this.finalizeAndSave();
      });
    },

    // ─── Persistence ────────────────────────────────────────────

    /**
     * Save conversation state to sessionStorage.
     * Only finalized messages are saved (no streaming/loading flags).
     */
    saveState() {
      try {
        const state = {
          isOpen: this.isOpen,
          sessionId: this.sessionId,
          selectedModel: this.selectedModel,
          pageContextEnabled: this.pageContextEnabled,
          messages: this.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            markdown: msg.markdown || '',
            isError: msg.isError || false,
            isRateLimited: msg.isRateLimited || false,
            pageContext: msg.pageContext || false,
            pageContextLabel: msg.pageContextLabel || '',
            pageContextUrl: msg.pageContextUrl || ''
          }))
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // sessionStorage may be unavailable (private browsing, quota, etc.)
        console.warn('Chatbot: could not save state', e);
      }
    },

    /**
     * Restore conversation state from sessionStorage.
     * Called once during init() to survive page navigations.
     */
    restoreState() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const state = JSON.parse(raw);

        if (state.sessionId) {
          this.sessionId = state.sessionId;
        }
        if (state.selectedModel) {
          this.selectedModel = state.selectedModel;
        }
        if (state.pageContextEnabled !== undefined) {
          this.pageContextEnabled = state.pageContextEnabled;
        }
        if (Array.isArray(state.messages) && state.messages.length > 0) {
          this.messages = state.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            markdown: msg.markdown || '',
            isError: msg.isError || false,
            isRateLimited: msg.isRateLimited || false,
            isStreaming: false,
            isLoading: false,
            showAvatar: msg.role === 'assistant',
            pageContext: msg.pageContext || false,
            pageContextLabel: msg.pageContextLabel || '',
            pageContextUrl: msg.pageContextUrl || ''
          }));
          this.isExpanded = true;
        }
        if (state.isOpen) {
          this.isOpen = true;
        }
      } catch (e) {
        console.warn('Chatbot: could not restore state', e);
      }
    },

    /**
     * Finalize any in-flight streaming message and save.
     * Called on beforeunload to capture partial responses.
     */
    finalizeAndSave() {
      if (this.currentEventSource) {
        this.currentEventSource.close();
        this.currentEventSource = null;
      }
      // Finalize any streaming message
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg && lastMsg.isStreaming) {
        // Flush whatever markdown content we have so far
        try {
          const html = this.markdownRenderer.flush();
          if (html) {
            lastMsg.content = html;
          }
          lastMsg.markdown = this.markdownRenderer.getContent();
        } catch (_) { /* ignore flush errors during unload */ }
        lastMsg.isStreaming = false;
        lastMsg.isLoading = false;
      }
      this.isProcessing = false;
      this.saveState();
    },

    // ─── Open / Close / Reset ───────────────────────────────────

    toggle() {
      this.isOpen = !this.isOpen;
    },

    open() {
      this.isOpen = true;
    },

    close() {
      this.isOpen = false;
    },

    /**
     * Start a new conversation. Clears all messages and
     * generates a fresh session ID.
     */
    newChat() {
      this.stopActiveStream();
      this.messages = [];
      this.userInput = '';
      this.isExpanded = false;
      this.isProcessing = false;
      this.showThinking = false;
      this.pageContextEnabled = false;
      this.showContextMenu = false;
      this.showModelMenu = false;
      this.sessionId = this.generateSessionId();
      this.thinkingAnimator.stop();
      this.markdownRenderer.reset();
      this.inputHeight = 68;
      this.saveState();
      this.$nextTick(() => {
        this.$refs.input?.focus();
      });
    },

    /**
     * Export the current conversation as a Markdown file download.
     */
    exportChat() {
      if (this.messages.length === 0) return;

      const lines = [];
      lines.push('# Agentgateway Assistant Conversation');
      lines.push('');
      lines.push(`**Date:** ${new Date().toLocaleString()}`);
      lines.push(`**Model:** ${this.getModelLabel()}`);
      lines.push('');
      lines.push('---');
      lines.push('');

      for (const msg of this.messages) {
        if (msg.role === 'user') {
          lines.push(`## User`);
          lines.push('');
          lines.push(msg.content);
          lines.push('');
        } else if (msg.role === 'assistant') {
          lines.push(`## Assistant`);
          lines.push('');
          if (msg.isError) {
            lines.push(`> **Error:** ${msg.content}`);
          } else if (msg.markdown) {
            // Use the stored raw markdown for full-fidelity export
            lines.push(msg.markdown);
          } else {
            // Fallback: extract text from HTML
            const tmp = document.createElement('div');
            tmp.innerHTML = msg.content;
            lines.push(tmp.innerText);
          }
          lines.push('');
        }
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /**
     * Stop any active streaming connection without clearing messages.
     */
    stopActiveStream() {
      if (this.currentEventSource) {
        this.currentEventSource.close();
        this.currentEventSource = null;
      }
      // Finalize any streaming message in place
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.isStreaming = false;
        lastMsg.isLoading = false;
      }
      this.isProcessing = false;
      this.showThinking = false;
      this.thinkingAnimator.stop();
    },

    // ─── Page Context ───────────────────────────────────────────

    togglePageContext() {
      this.pageContextEnabled = !this.pageContextEnabled;
      this.saveState();
    },

    /**
     * Returns a short label for the page context pill.
     * Uses the last meaningful segment of the URL path.
     */
    getPageContextLabel() {
      const path = window.location.pathname.replace(/\/$/, '');
      const segments = path.split('/').filter(Boolean);
      if (segments.length === 0) return 'Home page';
      // Use last 2 segments for context, e.g. "local / quickstart"
      const tail = segments.slice(-2);
      return tail.join(' / ');
    },

    /**
     * Returns the full page URL for sending as context.
     */
    getPageUrl() {
      return this.pageContextEnabled ? window.location.href : '';
    },

    // ─── Model ──────────────────────────────────────────────────

    getModelLabel() {
      const labels = { local: 'Local', kubernetes: 'Kubernetes' };
      return labels[this.selectedModel] || this.selectedModel;
    },

    // ─── Input ──────────────────────────────────────────────────

    autoResizeInput() {
      if (!this.$refs.input) return;
      // Temporarily shrink to measure scroll height accurately
      this.$refs.input.style.height = '0px';
      const scrollH = this.$refs.input.scrollHeight;
      const minHeight = 68;
      const maxHeight = 150;
      this.inputHeight = Math.max(minHeight, Math.min(scrollH, maxHeight));
      this.$refs.input.style.height = this.inputHeight + 'px';
    },

    handleKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey && !this.isProcessing) {
        event.preventDefault();
        this.sendQuery();
      }
    },

    // ─── Query ──────────────────────────────────────────────────

    async sendQuery() {
      const query = this.userInput.trim();
      if (!query || this.isProcessing) return;

      if (!this.sessionId) {
        this.sessionId = this.generateSessionId();
      }

      this.isProcessing = true;

      // Capture page context state before clearing
      const hasPageContext = this.pageContextEnabled;
      const pageContextLabel = hasPageContext ? this.getPageContextLabel() : '';
      const pageContextUrl = hasPageContext ? window.location.href : '';

      // Add user message with page context info
      this.messages.push({
        role: 'user',
        content: query,
        pageContext: hasPageContext,
        pageContextLabel: pageContextLabel,
        pageContextUrl: pageContextUrl
      });

      // Expand dialog on first message
      if (this.messages.length === 1) {
        this.isExpanded = true;
      }

      // Clear input and page context
      this.userInput = '';
      this.inputHeight = 68;
      this.pageContextEnabled = false;

      // Save after adding user message
      this.saveState();

      // Create assistant message placeholder
      const assistantMessage = {
        role: 'assistant',
        content: '',
        isStreaming: true,
        showAvatar: true,
        isLoading: true,
        isError: false
      };
      this.messages.push(assistantMessage);

      // Reset markdown renderer
      this.markdownRenderer.reset();

      // Show thinking state
      this.showThinking = true;

      // Wait for DOM to render thinking element
      await this.$nextTick();

      // Start thinking animation on the dots
      if (this.$refs.thinkingDots) {
        this.thinkingAnimator.start(this.$refs.thinkingDots);
      }

      // Stream the response
      try {
        this.currentEventSource = await this.streamer.stream(query, {
          sessionId: this.sessionId,
          model: this.selectedModel,
          pageUrl: pageContextUrl,
          onToken: (token) => {
            this.markdownRenderer.addToken(token);
            const html = this.markdownRenderer.render();

            // Update using Alpine's reactivity system
            const msgIndex = this.messages.length - 1;
            this.messages[msgIndex].content = html;

            // Hide thinking on first content
            if (this.markdownRenderer.getContent().length > 0 && this.showThinking) {
              this.showThinking = false;
              this.thinkingAnimator.stop();
              this.messages[msgIndex].isLoading = false;
            }
          },

          onDone: () => {
            // Flush remaining content
            const html = this.markdownRenderer.flush();
            const msgIndex = this.messages.length - 1;
            this.messages[msgIndex].content = html;
            this.messages[msgIndex].markdown = this.markdownRenderer.getContent();
            this.messages[msgIndex].isStreaming = false;
            this.messages[msgIndex].isLoading = false;
            this.showThinking = false;
            this.thinkingAnimator.stop();
            this.isProcessing = false;
            this.currentEventSource = null;

            // Persist completed response
            this.saveState();

            this.$nextTick(() => {
              this.$refs.input?.focus();
            });
          },

          onError: (errorMessage, errorType) => {
            console.error('Stream error:', errorMessage, errorType);
            this.showThinking = false;
            this.thinkingAnimator.stop();
            const msgIndex = this.messages.length - 1;
            this.messages[msgIndex].content = errorMessage;
            this.messages[msgIndex].isError = true;
            this.messages[msgIndex].isRateLimited = errorType === ErrorType.RATE_LIMITED;
            this.messages[msgIndex].isStreaming = false;
            this.messages[msgIndex].isLoading = false;
            this.isProcessing = false;
            this.currentEventSource = null;

            // Persist error state
            this.saveState();
          }
        });
      } catch (error) {
        console.error('Chat error:', error);
        this.showThinking = false;
        this.thinkingAnimator.stop();
        const msgIndex = this.messages.length - 1;
        this.messages[msgIndex].content = `Error: ${error.message}`;
        this.messages[msgIndex].isError = true;
        this.messages[msgIndex].isStreaming = false;
        this.messages[msgIndex].isLoading = false;
        this.isProcessing = false;
        this.currentEventSource = null;

        // Persist error state
        this.saveState();
      }
    },

    // ─── Utilities ──────────────────────────────────────────────

    generateSessionId() {
      if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
      }
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    },

    scrollToBottom() {
      const container = this.$refs.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    // Helper to check if this is the last message (for animation refs)
    isLastMessage(index) {
      return index === this.messages.length - 1;
    },

    detectModelFromPath() {
      const path = window.location.pathname;
      if (path.includes('/docs/kubernetes/')) {
        return 'kubernetes';
      } else if (path.includes('/docs/local')) {
        return 'local';
      }
      return 'local'; // default
    }
  }));
});
