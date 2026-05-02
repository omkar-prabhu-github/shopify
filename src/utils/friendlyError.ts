/**
 * Converts any raw error message into a clean, user-friendly message.
 * Hides technical details like HTTP codes, model names, and stack traces.
 */
export function friendlyError(raw: string | undefined): string {
  if (!raw) return 'Something went wrong. Please try again.';

  const lower = raw.toLowerCase();

  // Network / connectivity
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('err_connection') || lower.includes('failed to fetch'))
    return 'Network error — please check your connection and try again.';

  // Timeouts
  if (lower.includes('timeout') || lower.includes('timed out'))
    return 'The request took too long. Please try again.';

  // Rate limits
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota'))
    return 'Too many requests — please wait a moment and try again.';

  // Server errors
  if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('internal server'))
    return 'Something went wrong on our end. Please try again in a moment.';

  // Auth errors
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden'))
    return 'Session expired — please reload the page.';

  // Store context
  if (lower.includes('store context not available') || lower.includes('run a geo audit first') || lower.includes('store context'))
    return 'Please run a full store audit first, then try again.';

  // Audit specific
  if (lower.includes('audit failed') || lower.includes('geo audit'))
    return 'Audit couldn\'t complete. Please re-run the audit.';

  // Analysis specific
  if (lower.includes('analysis failed') || lower.includes('product analysis') || lower.includes('unparseable'))
    return 'Analysis couldn\'t complete. Please try running it again.';

  // Blog
  if (lower.includes('blog generation failed'))
    return 'Blog generation couldn\'t complete. Please try again.';

  // Policy
  if (lower.includes('policy'))
    return 'Policy update failed. Please try again.';

  // Generic API errors
  if (lower.includes('http') || lower.includes('api error'))
    return 'Something went wrong. Please try again.';

  // If the message is already clean and short, use it
  if (raw.length < 80 && !raw.includes('Error:') && !raw.includes('::'))
    return raw;

  // Fallback
  return 'Something went wrong. Please try again.';
}
