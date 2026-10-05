import { Response } from 'express';
import { Pagination } from '../types/api';

export function ok<T>(res: Response, message: string, data: T, pagination?: Pagination) {
  return res.status(200).json({
    success: true,
    message,
    status: 200,
    data,
    ...(pagination ? { pagination } : {}),
  });
}

export function created<T>(res: Response, message: string, data: T) {
  return res.status(201).json({ success: true, message, status: 201, data });
}

export function buildPagination(total: number, page: number, pageSize: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    total_results: total,
    total_pages: totalPages,
    current_page: page,
    page_size: pageSize,
    next_page: page < totalPages ? page + 1 : null,
    previous_page: page > 1 ? page - 1 : null,
  };
}
