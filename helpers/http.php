<?php
final class HttpException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message);
    }
}

function jsonResponse(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function jsonError(string $message, int $status = 400): never {
    throw new HttpException($message, $status);
}
function getJsonInput(): array {
    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($contentType !== 'application/json') jsonError('Usa Content-Type: application/json.', 415);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536) jsonError('Solicitud demasiado grande.', 413);
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if (strlen($raw) > 65536) jsonError('Solicitud demasiado grande.', 413);
    try { $input = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { jsonError('Se requiere un objeto JSON válido.', 400); }
    if (!$input instanceof stdClass) jsonError('Se requiere un objeto JSON.', 400);
    return (array)$input;
}
function allowMethods(array $methods): void {
    if (!in_array($_SERVER['REQUEST_METHOD'], $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        jsonError('Método no permitido.', 405);
    }
}
