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

## Configuración mínima (para que funcione sin errores)

1. Mergea los cambios a `main` (Pages publica desde `main/docs`).
2. Configura **uno** de estos:
   - Secret: `CHILECOMPRA_TICKET`
   - Variable: `CHILECOMPRA_TICKET`
3. (Opcional) Define rango por variables:
   - `CHILECOMPRA_START_DATE` (`YYYY-MM-DD`)
   - `CHILECOMPRA_END_DATE` (`YYYY-MM-DD`)
4. Corre manualmente el workflow una vez (`workflow_dispatch`) para validar.

> Si falta `CHILECOMPRA_TICKET`, el workflow **no falla en rojo**: deja un warning y omite la sincronización en esa corrida.

Si no se define rango, el script toma **hoy y ayer en zona `America/Santiago`**.
