export interface FieldError {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: FieldError[];
}

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiFailure {
  data: null;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
