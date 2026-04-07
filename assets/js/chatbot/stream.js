/**
 * Error types for specific error handling
 */
export const ErrorType = {
  RATE_LIMITED: 'rate_limited',
  CONNECTION: 'connection',
  UNKNOWN: 'unknown'
};

/**
 * ChatStreamer - Handles Server-Sent Events (SSE) streaming from the agent endpoint
 *
 * Uses fetch() + ReadableStream instead of EventSource so that HTTP status codes
 * (e.g. 429 Too Many Requests) are visible before the stream is opened.
 */
export class ChatStreamer {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  /**
   * Stream a query to the agent endpoint
   * @param {string} query - The user's question
   * @param {Object} callbacks - Event callbacks
   * @param {Function} callbacks.onToken - Called when a token is received
   * @param {Function} callbacks.onDone - Called when streaming completes
   * @param {Function} callbacks.onError - Called on error with (message, errorType)
   * @param {string} callbacks.model - The model/deployment type (standalone or kubernetes)
   * @param {string} [callbacks.pages] - Optional comma-separated page URLs sent as context
   * @returns {Promise<{close: Function}|null>} A handle with a close() method for cleanup
   */
  async stream(query, { sessionId, model = 'standalone', pages = '', onToken, onDone, onError }) {
    const queryParams = new URLSearchParams({
      q: query,
      model: model,
      sessionId: sessionId
    });
    if (pages) {
      queryParams.set('pages', pages);
    }
    const url = `${this.endpoint}/query?${queryParams.toString()}`;

    let reader = null;
    let cancelled = false;

    /** Returned to the caller so it can abort the stream (same interface as EventSource). */
    const handle = {
      close() {
        cancelled = true;
        if (reader) {
          reader.cancel().catch(() => {});
        }
      }
    };

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'text/event-stream' }
      });

      // ── Handle HTTP-level errors (429, 5xx, etc.) ──────────────
      if (response.status === 429) {
        if (onError) {
          onError(
            'You\u2019ve sent too many messages. Please wait a minute and try again.',
            ErrorType.RATE_LIMITED
          );
        }
        return handle;
      }

      if (!response.ok) {
        let errorMessage = 'Connection error. Please try again.';
        let errorType = ErrorType.CONNECTION;

        // Try to read a JSON body from the error response
        try {
          const body = await response.text();
          const data = JSON.parse(body);
          if (data.message) errorMessage = data.message;
        } catch (_) { /* use default */ }

        if (onError) onError(errorMessage, errorType);
        return handle;
      }

      // ── Stream SSE from the response body ──────────────────────
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || cancelled) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete last line in buffer

            for (const line of lines) {
              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trimStart();
                this._handleSSEMessage(currentEvent, data, { onToken, onDone, onError });

                // Stop reading after terminal events
                if (currentEvent === 'done' || currentEvent === 'error') return;
              } else if (line.trim() === '') {
                currentEvent = '';
              }
            }
          }
        } catch (err) {
          if (!cancelled && onError) {
            onError('Connection error. Please try again.', ErrorType.CONNECTION);
          }
        }
      };

      // Fire-and-forget: the async loop runs in the background
      processStream();

      return handle;
    } catch (err) {
      // Network failure (offline, DNS, CORS, etc.)
      if (onError) {
        onError('Connection error. Please try again.', ErrorType.CONNECTION);
      }
      return handle;
    }
  }

  /**
   * Dispatch a single SSE message to the appropriate callback.
   * @private
   */
  _handleSSEMessage(event, rawData, { onToken, onDone, onError }) {
    if (event === 'token') {
      try {
        const data = JSON.parse(rawData);
        if (onToken) onToken(data.token);
      } catch (err) {
        console.error('Token parsing error:', err);
      }
    } else if (event === 'done') {
      if (onDone) onDone();
    } else if (event === 'error') {
      let errorMessage = 'An error occurred. Please try again.';
      let errorType = ErrorType.UNKNOWN;

      try {
        const errorData = JSON.parse(rawData);
        errorMessage = errorData.message || errorMessage;

        if (
          errorData.status === 429 ||
          errorData.code === 'rate_limited' ||
          (errorData.message && errorData.message.toLowerCase().includes('rate limit'))
        ) {
          errorMessage = 'You\u2019ve sent too many messages. Please wait a minute and try again.';
          errorType = ErrorType.RATE_LIMITED;
        }
      } catch (_) { /* use default */ }

      if (onError) onError(errorMessage, errorType);
    }
  }
}
