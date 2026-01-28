/**
 * Chatbot - Alpine.js component for the agentgateway assistant
 * Expects Alpine.js to be loaded globally via CDN
 */

import { ChatStreamer } from './stream.js';
import { ThinkingAnimator, MarkdownRenderer, RESIZE_ICONS } from './ui.js';
import { parseMarkdown } from './markdown.js';

const AGENT_ENDPOINT = 'https://docs-search-agent.is.solo.io';

const STAGE_MESSAGES = {
  'contextualize': '...fathoming',
  'search': '...delving',
  'expand': '...marshalling',
  'generate': '...inditing'
};

/**
 * Register chatbot component with Alpine.js before it initializes
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('chatbot', () => ({
    // State
    isOpen: false,
    isExpanded: false,
    isInputExpanded: false,
    isProcessing: false,
    userInput: '',
    messages: [],

    // Internal state
    currentStage: '',
    showThinking: false,

    // Utilities
    streamer: null,
    thinkingAnimator: null,
    markdownRenderer: null,
    currentEventSource: null,

    init() {
      this.streamer = new ChatStreamer(AGENT_ENDPOINT);
      this.thinkingAnimator = new ThinkingAnimator();
      this.markdownRenderer = new MarkdownRenderer(parseMarkdown);

      // Focus input when dialog opens
      this.$watch('isOpen', (value) => {
        if (value) {
          this.$nextTick(() => {
            this.$refs.input?.focus();
          });
        } else {
          // Reset on close
          this.reset();
        }
      });

      // Auto-resize textarea
      this.$watch('userInput', () => {
        if (!this.isInputExpanded) {
          this.autoResizeInput();
        }
      });
    },

    toggle() {
      this.isOpen = !this.isOpen;
    },

    open() {
      this.isOpen = true;
    },

    close() {
      this.isOpen = false;
    },

    reset() {
      this.messages = [];
      this.userInput = '';
      this.isExpanded = false;
      this.isInputExpanded = false;
      this.isProcessing = false;
      this.showThinking = false;
      this.currentStage = '';
      this.thinkingAnimator.stop();
      this.markdownRenderer.reset();
      if (this.currentEventSource) {
        this.currentEventSource.close();
        this.currentEventSource = null;
      }
      this.resetInputSize();
    },

    toggleInputSize() {
      this.isInputExpanded = !this.isInputExpanded;
      if (this.isInputExpanded) {
        this.$refs.input.style.height = '250px';
      } else {
        this.resetInputSize();
      }
    },

    resetInputSize() {
      if (this.$refs.input) {
        this.$refs.input.style.height = '65px';
      }
    },

    autoResizeInput() {
      if (!this.$refs.input) return;
      this.$refs.input.style.height = '65px';
      const scrollH = this.$refs.input.scrollHeight;
      const maxAutoHeight = 95; // ~3 lines
      this.$refs.input.style.height = Math.min(scrollH, maxAutoHeight) + 'px';
    },

    handleKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey && !this.isProcessing) {
        event.preventDefault();
        this.sendQuery();
      }
    },

    async sendQuery() {
      const query = this.userInput.trim();
      if (!query || this.isProcessing) return;

      this.isProcessing = true;

      // Add user message
      this.messages.push({
        role: 'user',
        content: query
      });

      // Expand dialog on first message
      if (this.messages.length === 1) {
        this.isExpanded = true;
      }

      // Clear and reset input
      this.userInput = '';
      this.resetInputSize();
      this.isInputExpanded = false;

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
      this.currentStage = 'contextualize';

      // Wait for DOM to render thinking element
      await this.$nextTick();

      // Start thinking animation
      const thinkingEl = this.$refs[`thinking-${this.messages.length - 1}`];
      if (thinkingEl) {
        this.thinkingAnimator.start(thinkingEl);
      }

      // Stream the response
      try {
        this.currentEventSource = this.streamer.stream(query, {
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

          onStage: (stage) => {
            this.currentStage = stage;
            // Start animation on stage change
            this.$nextTick(() => {
              if (this.showThinking && this.$refs.thinkingText) {
                this.thinkingAnimator.start(this.$refs.thinkingText);
              }
            });
          },

          onDone: () => {
            // Flush remaining content
            const html = this.markdownRenderer.flush();
            const msgIndex = this.messages.length - 1;
            this.messages[msgIndex].content = html;
            this.messages[msgIndex].isStreaming = false;
            this.messages[msgIndex].isLoading = false;
            this.showThinking = false;
            this.thinkingAnimator.stop();
            this.isProcessing = false;
            this.currentEventSource = null;

            this.$nextTick(() => {
              this.$refs.input?.focus();
            });
          },

          onError: (errorMessage) => {
            console.error('Stream error:', errorMessage);
            this.showThinking = false;
            this.thinkingAnimator.stop();
            const msgIndex = this.messages.length - 1;
            this.messages[msgIndex].content = errorMessage;
            this.messages[msgIndex].isError = true;
            this.messages[msgIndex].isStreaming = false;
            this.messages[msgIndex].isLoading = false;
            this.isProcessing = false;
            this.currentEventSource = null;
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
      }
    },

    scrollToBottom() {
      const container = this.$refs.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    getResizeIcon() {
      return this.isInputExpanded ? RESIZE_ICONS.collapse : RESIZE_ICONS.expand;
    },

    getStageMessage(stage) {
      return STAGE_MESSAGES[stage] || '';
    },

    // Helper to check if this is the last message (for animation refs)
    isLastMessage(index) {
      return index === this.messages.length - 1;
    }
  }));
});
