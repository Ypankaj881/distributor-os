// AppError is an "expected" error: something the user can be told about
// (bad input, not found, not allowed). Anything else that is thrown is treated
// as a bug and hidden behind a generic 500 message.
export class AppError extends Error {
  constructor(message, { status = 400, code = "BAD_REQUEST", fields } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const Errors = {
  badRequest: (message = "Invalid request.", fields) =>
    new AppError(message, { status: 400, code: "BAD_REQUEST", fields }),
  validation: (fields, message = "Please correct the highlighted fields.") =>
    new AppError(message, { status: 400, code: "VALIDATION_ERROR", fields }),
  unauthorized: (message = "Please log in to continue.") =>
    new AppError(message, { status: 401, code: "UNAUTHORIZED" }),
  forbidden: (message = "You don't have access to this.") =>
    new AppError(message, { status: 403, code: "FORBIDDEN" }),
  notFound: (what = "Record") =>
    new AppError(`${what} not found.`, { status: 404, code: "NOT_FOUND" }),
  conflict: (message = "This conflicts with an existing record.", fields) =>
    new AppError(message, { status: 409, code: "CONFLICT", fields }),
  unprocessable: (message, code = "UNPROCESSABLE", fields) =>
    new AppError(message, { status: 422, code, fields }),
  tooManyRequests: (message = "Too many attempts. Please wait and try again.") =>
    new AppError(message, { status: 429, code: "RATE_LIMITED" }),
};
