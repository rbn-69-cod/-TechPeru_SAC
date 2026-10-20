<?php
function compliance(float $target, float $value, string $direction): float {
    if ($direction === 'menor') return $value <= 0 ? 100.0 : round($target / $value * 100, 1);
    if ($target <= 0) throw new HttpException('La meta del indicador directo debe ser positiva. Corrige el catálogo antes de medir.', 422);
    return round($value / $target * 100, 1);
}
function complianceStatus(float $pct): string {
    return $pct >= 90 ? '✅ LOGRADO' : ($pct >= 75 ? '⚠️ EN RIESGO' : '❌ CRÍTICO');
}

function complianceKey(float $pct): string
{
    return $pct >= 90 ? 'good' : ($pct >= 75 ? 'warn' : 'bad');
}
