export interface PaginateResponse<T = any> {
  objects: T[];
  count?: number;
  isLast?: boolean;
}
export interface IPagination {
  length: number;
  size: number;
  page: number;
  lastPage?: number;
  startIndex?: number;
  endIndex?: number;
}
