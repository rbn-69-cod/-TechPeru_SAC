<?php
// Development router. Only public assets and known API entry points can be served.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if ($path === '/') $path = '/index.html';
$allowed = preg_match('~^/(index\.html|css/[a-zA-Z0-9_.-]+\.css|js/app\.js|html/[a-z-]+\.html|api/(auth|dashboard|objectives|kpis|measurements|initiatives|reports|admin|activity)\.php)$~D', $path);
if (!$allowed || !is_file(__DIR__ . $path)) { http_response_code(404); exit('Not found'); }
return false;
