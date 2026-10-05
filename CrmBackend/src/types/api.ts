export interface Pagination {
  total_results: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next_page: number | null;
  previous_page: number | null;
}

export interface ListQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: string;
  sortOrder: 1 | -1;
}
