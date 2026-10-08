# Tools — Leonardo

El procesamiento real se realiza en Laravel mediante el worker `agent:leonardo:enhance-next` y Gemini API (referencia multimodal).

## API administrativa
- GET /api/v1/agents/leonardo/image-enhancement
- POST /api/v1/agents/leonardo/image-enhancement/play
- POST /api/v1/agents/leonardo/image-enhancement/pause
- POST /api/v1/agents/leonardo/image-enhancement/stop
- POST /api/v1/agents/leonardo/image-enhancement/products/{id}/regenerate

Estas son operaciones del dashboard autenticado, NO herramientas conectadas a este chat. Para ejecutarlas, usar el panel. No simular progresos.
