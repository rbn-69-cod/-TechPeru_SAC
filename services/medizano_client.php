<?php
/**
 * Cliente HTTP y Capa de Integración con el Gateway de Microservicios MediZano
 * Con fallback resiliente y degradación elegante a SQLite local
 */

class MediZanoClient
{
    private string $gatewayUrl;
    private float $timeoutSeconds;

    public function __construct(string $gatewayUrl = 'http://127.0.0.1:8090', float $timeout = 1.5)
    {
        $this->gatewayUrl = rtrim($gatewayUrl, '/');
        $this->timeoutSeconds = $timeout;
    }

    /**
     * Verifica la disponibilidad de MediZano Gateway
     */
    public function checkHealth(): array
    {
        $ch = curl_init($this->gatewayUrl . '/actuator/health');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT_MS, (int)($this->timeoutSeconds * 1000));
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, (int)($this->timeoutSeconds * 1000));
        curl_setopt($ch, CURLOPT_USERAGENT, 'TechPeru-Botica/1.0');

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        if (PHP_VERSION_ID < 80500) @curl_close($ch);

        if ($httpCode === 200 && $response) {
            $data = json_decode($response, true);
            return [
                'online' => true,
                'status' => $data['status'] ?? 'UP',
                'gateway_url' => $this->gatewayUrl,
                'mode' => 'ONLINE_INTEGRATED',
                'message' => 'Conexión activa con el Gateway de Microservicios MediZano.'
            ];
        }

        return [
            'online' => false,
            'status' => 'OFFLINE',
            'gateway_url' => $this->gatewayUrl,
            'mode' => 'LOCAL_STANDALONE',
            'error_detail' => $error ?: "HTTP $httpCode",
            'message' => 'MediZano Gateway no disponible. La botica opera con resiliencia total en base de datos local SQLite.'
        ];
    }

    /**
     * Consulta catálogo remoto en medizano-catalogo-ms si está online
     */
    public function fetchRemoteProducts(): array
    {
        $health = $this->checkHealth();
        if (!$health['online']) {
            return [
                'success' => false,
                'source' => 'LOCAL_FALLBACK',
                'message' => $health['message'],
                'items' => []
            ];
        }

        $ch = curl_init($this->gatewayUrl . '/api/v1/productos');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, (int)($this->timeoutSeconds * 1000));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);

        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if (PHP_VERSION_ID < 80500) @curl_close($ch);

        if ($code === 200 && $res) {
            $data = json_decode($res, true);
            return [
                'success' => true,
                'source' => 'MEDIZANO_MICROSERVICES',
                'items' => $data['data'] ?? $data ?? []
            ];
        }

        return [
            'success' => false,
            'source' => 'LOCAL_FALLBACK',
            'message' => "Error al consultar microservicio de catálogo (HTTP $code)",
            'items' => []
        ];
    }

    /**
     * Envía orden o venta a medizano-orden-ms si está en línea
     */
    public function syncOrderToMediZano(array $orderPayload): array
    {
        $health = $this->checkHealth();
        if (!$health['online']) {
            return [
                'synced' => false,
                'reason' => 'GATEWAY_OFFLINE',
                'message' => 'Operación completada localmente. Pendiente de sincronización remota.'
            ];
        }

        $ch = curl_init($this->gatewayUrl . '/api/v1/ordenes');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, (int)($this->timeoutSeconds * 1000));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Accept: application/json'
        ]);

        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if (PHP_VERSION_ID < 80500) @curl_close($ch);

        if (in_array($code, [200, 201], true)) {
            return [
                'synced' => true,
                'code' => $code,
                'response' => json_decode($res, true)
            ];
        }

        return [
            'synced' => false,
            'reason' => "HTTP_$code",
            'message' => 'Error al comunicar con microservicio de orden'
        ];
    }
}
