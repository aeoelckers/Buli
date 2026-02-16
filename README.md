# Buli

GitHub Pages de licitaciones con filtros y actualización automática.

## Estructura

- `docs/`: frontend estático para GitHub Pages.
- `docs/data/tenders.json`: dataset de licitaciones normalizadas.
- `docs/data/meta.json`: metadatos (`timestamp`, `total`).
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
