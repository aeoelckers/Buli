# Buli

GitHub Pages de licitaciones con filtros y actualización automática.

## Estructura

- `docs/`: frontend estático para GitHub Pages.
- `docs/data/tenders.json`: dataset de licitaciones normalizadas.
- `docs/data/meta.json`: metadatos (`timestamp`, `total`, `source`, `synced_at`).
- `scripts/update_tenders.py`: descarga y normaliza licitaciones.
- `.github/workflows/daily.yml`: sincronización frecuente (cada 15 minutos + manual), validación de ticket y commit condicional de datos.

## Configuración mínima en GitHub

1. Hacer merge a `main` (GitHub Pages publica desde `main/docs`).
2. Definir `CHILECOMPRA_TICKET` como **Secret** o **Variable** de repositorio.
3. (Opcional) Definir `CHILECOMPRA_START_DATE` y `CHILECOMPRA_END_DATE` con formato `YYYY-MM-DD`.
4. Ejecutar `workflow_dispatch` una vez para validar la primera actualización.

Si no se define rango de fechas, el script toma **hoy y ayer en zona `America/Santiago`**.

## Comportamiento del workflow de sincronización

- Se ejecuta automáticamente cada 15 minutos.
- También soporta ejecución manual con `workflow_dispatch`.
- Si no encuentra `CHILECOMPRA_TICKET` (ni en Secret ni en Variable), emite warning y omite la sincronización de esa corrida.
- Si hay ticket válido, ejecuta sync y solo hace commit/push cuando cambian `docs/data/tenders.json` o `docs/data/meta.json`.

## Troubleshooting: "No está conectada con Mercado Público"

Si la web muestra datos de ejemplo o no cambia:

1. Verifica que el workflow esté en la rama `main`.
2. Revisa en **Settings → Secrets and variables → Actions** que exista `CHILECOMPRA_TICKET` (Secret o Variable) con un token vigente.
3. Ejecuta **Actions → Frequent tenders sync → Run workflow** manualmente.
4. Revisa logs:
   - `Missing CHILECOMPRA_TICKET` → falta configurar ticket.
   - `HTTP 401/403` → ticket inválido o sin permisos.
5. Confirma que el workflow haya generado commit actualizando `docs/data/tenders.json` y `docs/data/meta.json`.

> Importante: el frontend en GitHub Pages no consulta directo a la API de Mercado Público (para no exponer el ticket). La conexión se hace vía GitHub Actions, que actualiza los JSON publicados.
