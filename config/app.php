<?php
/** Configuration comes from the process environment; .env files are never served or auto-loaded. */
return [
    'environment' => getenv('APP_ENV') ?: 'production',
    'database' => getenv('DB_PATH') ?: dirname(__DIR__) . '/database/bsc.sqlite',
    'demo' => getenv('APP_DEMO') === '1',
    'secure_cookie' => getenv('SESSION_SECURE') === '1',
    'session_ttl' => max(60, min(86400, (int)(getenv('SESSION_TTL') ?: 1800))),
];
