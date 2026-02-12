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
   * @returns {Promise<EventSource>} The event source instance (for external cleanup if needed)
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

    const eventSource = new EventSource(url);

    eventSource.addEventListener('token', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (onToken) {
          onToken(data.token);
        }
      } catch (err) {
        console.error('Token parsing error:', err);
      }
    });

    eventSource.addEventListener('done', () => {
      eventSource.close();
      if (onDone) {
        onDone();
      }
    });

    eventSource.addEventListener('error', (e) => {
      eventSource.close();
      let errorMessage = 'Connection error. Please try again.';
      let errorType = ErrorType.CONNECTION;

      if (e.data) {
        try {
          const errorData = JSON.parse(e.data);
          errorMessage = errorData.message || errorMessage;

          // Check for rate limiting indicators in the error response
          if (errorData.status === 429 ||
              errorData.code === 'rate_limited' ||
              (errorData.message && errorData.message.toLowerCase().includes('rate limit'))) {
            errorMessage = 'You have reached the rate limit. Please try again in an hour.';
            errorType = ErrorType.RATE_LIMITED;
          }
        } catch (err) {
          // Use default error message
        }
      }
      if (onError) {
        onError(errorMessage, errorType);
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      if (onError) {
        onError('Connection error. Please try again.', ErrorType.CONNECTION);
      }
    };

    return eventSource;
  }
}
