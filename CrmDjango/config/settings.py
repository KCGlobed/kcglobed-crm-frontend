"""
Django settings for the GCC School / KC GlobEd CRM API.

Every secret and environment-specific value comes from the environment
(.env in development — see .env.example). The API contract mirrors the
original Node backend so the React frontend works unchanged.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env(name: str, default: str | None = None) -> str:
    return os.environ.get(name, default if default is not None else '')


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f'Missing required environment variable: {name}')
    return value


DEBUG = env_bool('DEBUG', False)
SECRET_KEY = required('SECRET_KEY')
ALLOWED_HOSTS = [h.strip() for h in env('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
FRONTEND_URL = env('FRONTEND_URL', 'http://localhost:5173')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'corsheaders',
    'rest_framework',
    'apps.users',
    'apps.authentication',
    'apps.teams',
    'apps.masters',
    'apps.leads',
    'apps.tasks',
    'apps.integrations',
    'apps.messaging',
    'apps.notifications',
    'apps.audit',
    'apps.dashboard',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'common.middleware.JsonServerErrorMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / env('SQLITE_PATH', 'db.sqlite3'),
        # Wait instead of failing when another request holds the write lock.
        'OPTIONS': {'timeout': 20},
    }
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LANGUAGE_CODE = 'en-us'
# India business day: 'today', working hours and reminders use IST; timestamps are stored in UTC.
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = False
USE_TZ = True

# URLs are matched exactly as the Node API defined them (no trailing slash).
APPEND_SLASH = False

# Same-origin through the Vite proxy in dev; CORS kept for direct calls.
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['X-Unread-Count', 'Content-Disposition']
CORS_ALLOW_HEADERS = ['accept', 'authorization', 'content-type', 'x-api-key', 'idempotency-key', 'x-background']

# In-memory cache backs the rate limiters (per process, like express-rate-limit).
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['common.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['common.permissions.IsAuthenticated'],
    'DEFAULT_THROTTLE_CLASSES': ['common.throttling.ApiRateThrottle'],
    'DEFAULT_RENDERER_CLASSES': ['common.renderers.ApiJSONRenderer'],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'EXCEPTION_HANDLER': 'common.exceptions.api_exception_handler',
    # ?format= is the lead export's csv|xlsx switch, not DRF's renderer override.
    'URL_FORMAT_OVERRIDE': None,
    'UNAUTHENTICATED_USER': None,
}

DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024  # 1 MB JSON bodies, as in Express
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # bulk upload files stay in memory

# Uploaded documents and prepared exports — private, served only through authorised endpoints.
MEDIA_ROOT = BASE_DIR / env('MEDIA_DIR', 'media')

# --- Auth -------------------------------------------------------------------
JWT_ACCESS_SECRET = required('JWT_ACCESS_SECRET')
JWT_REFRESH_SECRET = required('JWT_REFRESH_SECRET')
ACCESS_TOKEN_TTL_MINUTES = int(env('ACCESS_TOKEN_TTL_MINUTES', '15'))
REFRESH_TOKEN_TTL_DAYS = int(env('REFRESH_TOKEN_TTL_DAYS', '7'))
SESSION_IDLE_MINUTES = int(env('SESSION_IDLE_MINUTES', '30'))  # GL-05 idle logout
TEMP_PASSWORD_HOURS = int(env('TEMP_PASSWORD_HOURS', '48'))  # GL-02
REFRESH_COOKIE = 'crm_rt'
REFRESH_COOKIE_PATH = '/api/v1/auth'

CAPTURE_API_KEY = env('CAPTURE_API_KEY')
PUBLIC_API_URL = env('PUBLIC_API_URL', 'http://localhost:4000')  # unsubscribe links in emails

# --- Meta Lead Ads (GL-09) — without an access token the webhook runs in sandbox mode
META_VERIFY_TOKEN = env('META_VERIFY_TOKEN', 'gcc-crm-meta-verify')
META_APP_SECRET = env('META_APP_SECRET')
META_ACCESS_TOKEN = env('META_ACCESS_TOKEN')
META_GRAPH_VERSION = env('META_GRAPH_VERSION', 'v19.0')

# --- SMS (GL-21/25): console | http; email uses the mail settings below
SMS_PROVIDER = env('SMS_PROVIDER', 'console')
SMS_AUTO_DELIVER = env_bool('SMS_AUTO_DELIVER', True)  # console provider reports "delivered" at once
SMS_HTTP_URL = env('SMS_HTTP_URL')
SMS_HTTP_KEY = env('SMS_HTTP_KEY')
MESSAGING_WEBHOOK_SECRET = env('MESSAGING_WEBHOOK_SECRET')

# --- Untouched timers run in working hours only (GL-30/31) -------------------
WORKING_HOURS = (env('WORKING_DAY_START', '09:30'), env('WORKING_DAY_END', '19:00'))
WORKING_DAYS = [int(d) for d in env('WORKING_DAYS', '0,1,2,3,4,5').split(',')]  # Mon–Sat
RUN_JOBS_INLINE = env_bool('RUN_JOBS_INLINE', False)
BULK_SEND_WINDOW = env('BULK_SEND_WINDOW', '09:00-21:00')  # tests: run bulk sends / exports in the request

# --- Mail (reset links are logged when SMTP is not configured) --------------
EMAIL_HOST = env('SMTP_HOST')
EMAIL_PORT = int(env('SMTP_PORT', '587') or 587)
EMAIL_HOST_USER = env('SMTP_USER')
EMAIL_HOST_PASSWORD = env('SMTP_PASS')
EMAIL_USE_SSL = EMAIL_PORT == 465
EMAIL_USE_TLS = bool(EMAIL_HOST) and EMAIL_PORT == 587
DEFAULT_FROM_EMAIL = env('MAIL_FROM', 'no-reply@gccschool.com')
EMAIL_BACKEND = (
    'django.core.mail.backends.smtp.EmailBackend' if EMAIL_HOST else 'django.core.mail.backends.console.EmailBackend'
)
# Development / QA: write every email to files instead of the console
MAIL_OUTBOX_DIR = env('MAIL_OUTBOX_DIR')
if MAIL_OUTBOX_DIR and not EMAIL_HOST:
    EMAIL_BACKEND = 'django.core.mail.backends.filebased.EmailBackend'
    EMAIL_FILE_PATH = MAIL_OUTBOX_DIR

# --- Logging ----------------------------------------------------------------
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'plain': {'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'plain'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {'django.request': {'handlers': ['console'], 'level': 'ERROR', 'propagate': False}},
}

# --- Security headers (helmet equivalent) -----------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'no-referrer'
X_FRAME_OPTIONS = 'DENY'
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
