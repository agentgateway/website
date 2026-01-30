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
   * @param {Function} callbacks.onStage - Called when processing stage changes
   * @param {Function} callbacks.onDone - Called when streaming completes
   * @param {Function} callbacks.onError - Called on error with (message, errorType)
   * @param {string} callbacks.model - The model/deployment type (local or kubernetes)
   * @returns {Promise<EventSource>} The event source instance (for external cleanup if needed)
   */
  async stream(query, { sessionId, model = 'local', onToken, onStage, onDone, onError }) {
    const queryParams = new URLSearchParams({
      q: query,
      model: model,
      sessionId: sessionId
    });
    const url = `${this.endpoint}/query?${queryParams.toString()}`;

    // Pre-flight check to detect rate limiting and other HTTP errors
    // EventSource doesn't expose HTTP status codes, so we use fetch first
    try {
      const checkResponse = await fetch(url, { method: 'HEAD' });
      if (checkResponse.status === 429) {
        if (onError) {
          onError(
            'You have reached the rate limit. Please try again in an hour.',
            ErrorType.RATE_LIMITED
          );
        }
        return null;
      }
    } catch (prefetchError) {
      // HEAD request failed - proceed with EventSource anyway
      // The server might not support HEAD, or there could be CORS issues
      console.warn('Pre-flight check failed, proceeding with EventSource:', prefetchError);
    }

    const eventSource = new EventSource(url);

    eventSource.addEventListener('stage', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status !== 'done' && onStage) {
          onStage(data.stage);
        }
      } catch (err) {
        console.error('Stage parsing error:', err);
      }
    });

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
