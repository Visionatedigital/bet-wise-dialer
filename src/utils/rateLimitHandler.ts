/**
 * Utility functions for handling rate limit errors
 */

export interface RateLimitError {
  isRateLimit: boolean;
  retryAfter?: number; // seconds
  message: string;
  service?: 'supabase' | 'openai' | 'github' | 'africas-talking' | 'unknown';
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: any): RateLimitError {
  // Supabase errors have a specific structure: { error: { message, code, details, hint }, data: null }
  const supabaseError = error?.error || error;
  const errorMessage = supabaseError?.message || error?.message || String(error || '');
  const errorCode = supabaseError?.code || error?.code || error?.status || error?.statusCode;
  const errorDetails = supabaseError?.details || error?.details || '';
  const errorHint = supabaseError?.hint || error?.hint || '';
  const errorContext = error?.context || {};

  // Check for HTTP 429 status code
  if (errorCode === 429 || errorCode === '429') {
    const retryAfter = error?.retryAfter || 
                      error?.headers?.['retry-after'] || 
                      error?.headers?.['Retry-After'] ||
                      errorContext?.retryAfter ||
                      extractRetryAfter(errorMessage);

    return {
      isRateLimit: true,
      retryAfter: retryAfter ? parseInt(String(retryAfter)) : undefined,
      message: errorMessage || 'Rate limit exceeded. Please try again later.',
      service: detectService(error)
    };
  }

  // Check for Supabase-specific rate limit error codes
  // PGRST116: Too many requests
  // PGRST301: Rate limit exceeded
  const supabaseRateLimitCodes = ['PGRST116', 'PGRST301', '429'];
  if (errorCode && supabaseRateLimitCodes.includes(String(errorCode))) {
    return {
      isRateLimit: true,
      retryAfter: extractRetryAfter(errorMessage + ' ' + errorDetails + ' ' + errorHint),
      message: errorMessage || 'Database rate limit exceeded. Please try again later.',
      service: 'supabase'
    };
  }

  // Check for rate limit in error message, details, or hint
  const rateLimitKeywords = [
    'rate limit',
    'rate_limit',
    'too many requests',
    'quota exceeded',
    'request limit',
    '429',
    'throttle',
    'throttled'
  ];

  const combinedMessage = (errorMessage + ' ' + errorDetails + ' ' + errorHint).toLowerCase();
  const isRateLimit = rateLimitKeywords.some(keyword => combinedMessage.includes(keyword));

  if (isRateLimit) {
    return {
      isRateLimit: true,
      retryAfter: extractRetryAfter(errorMessage + ' ' + errorDetails + ' ' + errorHint),
      message: errorMessage || 'Rate limit exceeded. Please try again later.',
      service: detectService(error)
    };
  }

  return {
    isRateLimit: false,
    message: errorMessage
  };
}

/**
 * Detect which service the rate limit is from
 */
function detectService(error: any): RateLimitError['service'] {
  const supabaseError = error?.error || error;
  const errorMessage = String(supabaseError?.message || error?.message || error || '').toLowerCase();
  const errorCode = String(supabaseError?.code || error?.code || '').toLowerCase();
  const url = String(error?.url || error?.config?.url || '').toLowerCase();

  // Check for Supabase-specific error codes first
  if (errorCode.startsWith('pgrst') || errorCode === '429') {
    return 'supabase';
  }

  // Check URLs
  if (url.includes('supabase.co') || url.includes('supabase.io')) {
    return 'supabase';
  }

  if (errorMessage.includes('openai') || url.includes('openai.com') || url.includes('api.openai.com')) {
    return 'openai';
  }
  if (errorMessage.includes('github') || url.includes('github.com') || url.includes('api.github.com')) {
    return 'github';
  }
  if (errorMessage.includes('africastalking') || url.includes('africastalking.com')) {
    return 'africas-talking';
  }
  if (errorMessage.includes('supabase') || errorMessage.includes('postgres') || errorMessage.includes('database')) {
    return 'supabase';
  }

  return 'unknown';
}

/**
 * Extract retry-after time from error message
 */
function extractRetryAfter(message: string): number | undefined {
  // Try to find "retry after X seconds" or similar patterns
  const retryAfterMatch = message.match(/retry[_\s-]?after[_\s:]+(\d+)/i);
  if (retryAfterMatch) {
    return parseInt(retryAfterMatch[1]);
  }

  // Try to find time patterns like "in 60 seconds" or "after 5 minutes"
  const timeMatch = message.match(/(\d+)\s*(second|minute|hour|day)/i);
  if (timeMatch) {
    const value = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    const multipliers: Record<string, number> = {
      second: 1,
      minute: 60,
      hour: 3600,
      day: 86400
    };
    return value * (multipliers[unit] || 1);
  }

  return undefined;
}

/**
 * Get user-friendly error message for rate limit
 */
export function getRateLimitMessage(rateLimitError: RateLimitError): string {
  const { service, retryAfter } = rateLimitError;

  let baseMessage = 'Rate limit reached. ';

  if (service === 'openai') {
    baseMessage += 'OpenAI API rate limit exceeded. ';
  } else if (service === 'github') {
    baseMessage += 'GitHub API rate limit exceeded. ';
  } else if (service === 'supabase') {
    baseMessage += 'Database rate limit exceeded. ';
  } else if (service === 'africas-talking') {
    baseMessage += 'Africa\'s Talking API rate limit exceeded. ';
  } else {
    baseMessage += 'API rate limit exceeded. ';
  }

  if (retryAfter) {
    if (retryAfter < 60) {
      baseMessage += `Please try again in ${retryAfter} seconds.`;
    } else if (retryAfter < 3600) {
      const minutes = Math.ceil(retryAfter / 60);
      baseMessage += `Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    } else {
      const hours = Math.ceil(retryAfter / 3600);
      baseMessage += `Please try again in ${hours} hour${hours > 1 ? 's' : ''}.`;
    }
  } else {
    baseMessage += 'Please try again in a few minutes.';
  }

  return baseMessage;
}

/**
 * Format retry after time for display
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
}

/**
 * Handle Supabase errors with rate limit detection
 * Use this to wrap Supabase queries and automatically show appropriate error messages
 */
export function handleSupabaseError(error: any, defaultMessage: string = 'An error occurred'): void {
  const rateLimit = isRateLimitError(error);
  
  if (rateLimit.isRateLimit) {
    // Import toast dynamically to avoid circular dependencies
    import('sonner').then(({ toast }) => {
      toast.error(getRateLimitMessage(rateLimit), {
        duration: 10000
      });
    });
  } else {
    const errorMessage = error?.error?.message || error?.message || defaultMessage;
    import('sonner').then(({ toast }) => {
      toast.error(errorMessage);
    });
  }
}

