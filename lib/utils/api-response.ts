import { NextResponse } from 'next/server';

/**
 * Standard API response utilities for consistent error handling and responses
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data
  }, { status });
}

/**
 * Create an error response with consistent format
 */
export function createErrorResponse(
  error: string,
  message?: string,
  status: number = 500
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error,
    message: message || (status >= 500 ? 'Internal server error' : undefined)
  }, { status });
}

/**
 * Handle API errors consistently with logging
 */
export function handleApiError(
  error: unknown,
  context: string,
  defaultMessage: string = 'Operation failed'
): NextResponse<ApiResponse> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[${context}] ${defaultMessage}:`, error);

  // Determine appropriate status code based on error type
  let status = 500;
  if (error instanceof Error) {
    if (message.includes('not found') || message.includes('Not found')) {
      status = 404;
    } else if (
      message.includes('Invalid') ||
      message.includes('missing') ||
      message.includes('required') ||
      message.includes('Unauthorized')
    ) {
      status = 400;
    }
  }

  return createErrorResponse(defaultMessage, message, status);
}

/**
 * Wrapper for async API handlers with consistent error handling
 */
export function withApiHandler<T = any>(
  handler: () => Promise<NextResponse<ApiResponse<T>>>,
  context: string,
  errorMessage?: string
): Promise<NextResponse<ApiResponse<T>>> {
  return handler().catch((error) => handleApiError(error, context, errorMessage));
}