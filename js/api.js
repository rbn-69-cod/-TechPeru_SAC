/** Same-origin JSON transport. Tokens are kept in memory, never browser storage. */
export function createApiClient({ onUnauthorized, onError }) {
  let csrfToken = '';
  return async function apiFetch(endpoint, options = {}) {
    const { body, headers: extraHeaders, ...requestOptions } = options;
    const headers = new Headers(extraHeaders);
    let payload = body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }
    if (options.method && options.method !== 'GET') headers.set('X-CSRF-Token', csrfToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        credentials: 'same-origin', ...requestOptions, body: payload, headers, signal: controller.signal
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('El servidor no devolvió una respuesta válida. Inténtalo nuevamente.');
      }
      const data = await response.json();
      if (data.csrf_token) csrfToken = data.csrf_token;
      if (response.status === 401 && !endpoint.includes('action=login')) onUnauthorized();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `No se pudo completar la solicitud (${response.status}).`);
      }
      return data;
    } catch (cause) {
      const error = cause.name === 'AbortError'
        ? new Error('El servidor tardó demasiado. Comprueba la conexión antes de volver a guardar.')
        : cause instanceof TypeError ? new Error('No se pudo conectar con el servidor. Revisa tu conexión.') : cause;
      onError(error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}
