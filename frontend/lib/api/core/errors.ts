export interface ApiErrorOptions {
  status?: number
  code?: number
}

export class ApiError extends Error {
  status?: number
  code?: number

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
  }
}
