import rateLimit from 'express-rate-limit';

const authMessage = {
  success: false,
  message: 'Too many attempts. Please try again in a few minutes.',
  status: 429,
  errors: {},
};

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: authMessage,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit exceeded. Slow down and retry shortly.',
    status: 429,
    errors: {},
  },
});
