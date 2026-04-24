interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) {
    throw new ApiError(res.error ?? 'Request failed');
  }
  if (res.data === undefined) {
    throw new ApiError('Response missing data');
  }
  return res.data;
}
