# Buli

GitHub Pages de licitaciones con filtros y actualización automática.

## Estructura

- `docs/`: frontend estático para GitHub Pages.
- `docs/data/tenders.json`: dataset de licitaciones normalizadas.
- `docs/data/meta.json`: metadatos (`timestamp`, `total`).
- `scripts/update_tenders.py`: descarga y normaliza licitaciones.
- `.github/workflows/daily.yml`: ejecución diaria/manual y commit condicional de datos.

## Secrets/vars requeridos en GitHub

- `CHILECOMPRA_TICKET` (Secret): token API.
- `CHILECOMPRA_START_DATE` (Variable opcional): `YYYY-MM-DD`.
- `CHILECOMPRA_END_DATE` (Variable opcional): `YYYY-MM-DD`.

Si no se define rango, el script toma **hoy y ayer en zona `America/Santiago`**.
