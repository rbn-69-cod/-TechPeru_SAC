<?php
function textField(array $data, string $key, string $default = '', int $max = 300): string {
    $value = array_key_exists($key, $data) ? $data[$key] : $default;
    if (!is_string($value) || strlen($value) > $max) jsonError("Campo inválido: $key.", 422);
    return trim($value);
}
function requiredText(array $data, string $key, int $max = 300): string {
    $value = textField($data, $key, '', $max);
    if ($value === '') jsonError("Campo obligatorio: $key.", 422);
    return $value;
}
function identifier(array $data, string $key = 'id'): string {
    $value = requiredText($data, $key, 64);
    if (!preg_match('/^[a-zA-Z0-9_-]+$/D', $value)) jsonError("Código inválido: $key.", 422);
    return $value;
}
function numberField(array $data, string $key, float $default = 0, float $min = -1000000000, float $max = 1000000000): float {
    $value = array_key_exists($key, $data) ? $data[$key] : $default;
    if (is_bool($value) || !is_numeric($value) || !is_finite((float)$value) || $value < $min || $value > $max) jsonError("Número fuera de rango: $key.", 422);
    return (float)$value;
}
function enumField(array $data, string $key, array $values, string $default): string {
    $value = textField($data, $key, $default);
    if (!in_array($value, $values, true)) jsonError("Valor no permitido: $key.", 422);
    return $value;
}
function dateField(array $data, string $key, string $default): string {
    $value = textField($data, $key, $default);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) jsonError("Fecha inválida: $key.", 422);
    return $value;
}

function integerField(array $data, string $key, int $default, int $min, int $max): int
{
    $value = numberField($data, $key, $default, $min, $max);
    if (floor($value) !== $value) jsonError("Debe ser un número entero: $key.", 422);
    return (int)$value;
}
