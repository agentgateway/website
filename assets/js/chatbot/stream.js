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
   * @param {Function} callbacks.onError - Called on error
   * @returns {EventSource} The event source instance (for external cleanup if needed)
   */
  stream(query, { sessionId, onToken, onStage, onDone, onError }) {
    const eventSource = new EventSource(
      `${this.endpoint}/query?q=${encodeURIComponent(query)}&sessionId=${encodeURIComponent(sessionId)}`
    );

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
      if (e.data) {
        try {
          const errorData = JSON.parse(e.data);
          errorMessage = errorData.message || errorMessage;
        } catch (err) {
          // Use default error message
        }
      }
      if (onError) {
        onError(errorMessage);
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      if (onError) {
        onError('Connection error. Please try again.');
      }
    };

    return eventSource;
  }
}
