export interface PaginateResponse<T> {
  objects: T[];
  count?: number;
  isLast?: boolean;
}
