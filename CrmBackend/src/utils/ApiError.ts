export class ApiError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string>;

  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }

  static badRequest(message: string, errors?: Record<string, string>) {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
  static conflict(message: string, errors?: Record<string, string>) {
    return new ApiError(409, message, errors);
  }
  static unprocessable(message: string, errors?: Record<string, string>) {
    return new ApiError(422, message, errors);
  }
}
