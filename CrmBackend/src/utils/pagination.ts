import { Request } from 'express';
import { ListQuery } from '../types/api';

const MAX_PAGE_SIZE = 100;

/**
 * Parses the standard list contract: ?page&page_size&search&sort_by&sort_order
 * `sortable` whitelists sort fields to prevent sorting on unindexed/private paths.
 */
export function parseListQuery(
  req: Request,
  sortable: string[],
  defaultSort = 'createdAt'
): ListQuery {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.page_size) || 25));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

  const requestedSort = typeof req.query.sort_by === 'string' ? req.query.sort_by : defaultSort;
  const sortBy = sortable.includes(requestedSort) ? requestedSort : defaultSort;
  const sortOrder = req.query.sort_order === 'asc' ? 1 : -1;

  return { page, pageSize, search: search || undefined, sortBy, sortOrder };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
