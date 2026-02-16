# Buli

GitHub Pages de licitaciones con filtros y actualización automática.

## Estructura

- `docs/`: frontend estático para GitHub Pages.
- `docs/data/tenders.json`: dataset de licitaciones normalizadas.
- `docs/data/meta.json`: metadatos (`timestamp`, `total`).
- `scripts/update_tenders.py`: descarga y normaliza licitaciones.
- `.github/workflows/daily.yml`: ejecución frecuente/manual y commit condicional de datos.

## Frecuencia de actualización

- El workflow consulta Mercado Público cada **15 minutos** y actualiza `docs/data/*.json` si detecta cambios.
- El frontend recarga `tenders.json` y `meta.json` automáticamente cada **5 minutos** y permite recarga manual con el botón **Actualizar datos ahora**.

## Secrets/vars requeridos en GitHub

- `CHILECOMPRA_TICKET` (Secret): token API.
- `CHILECOMPRA_START_DATE` (Variable opcional): `YYYY-MM-DD`.
- `CHILECOMPRA_END_DATE` (Variable opcional): `YYYY-MM-DD`.

Si no se define rango, el script toma **hoy y ayer en zona `America/Santiago`**.
