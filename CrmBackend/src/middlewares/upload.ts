import multer from 'multer';
import { ApiError } from '../utils/ApiError';

const SPREADSHEET_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/** Bulk lead upload: CSV/XLSX only, 10 MB cap, kept in memory for parsing. */
export const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extOk = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    if (SPREADSHEET_TYPES.includes(file.mimetype) || extOk) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest('Only CSV or Excel files are allowed'));
    }
  },
});
