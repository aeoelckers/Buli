#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from urllib.request import urlopen

CHILE_TZ = ZoneInfo("America/Santiago")
DEFAULT_API_URL = "https://api.mercadopublico.cl/servicios/v1/Publico/Licitaciones.json"
OUTPUT_DATA = Path("docs/data/tenders.json")
OUTPUT_META = Path("docs/data/meta.json")


@dataclass
class Config:
    ticket: str
    start_date: datetime
    end_date: datetime
    api_url: str


def parse_cli_or_env_date(value: str) -> datetime:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=CHILE_TZ)
        except ValueError:
            continue
    raise ValueError(f"Formato de fecha inválido: {value}")


def chilean_today_and_yesterday() -> tuple[datetime, datetime]:
    now = datetime.now(CHILE_TZ)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    return yesterday, today


def load_config() -> Config:
    ticket = os.getenv("CHILECOMPRA_TICKET", "").strip()
    if not ticket:
        raise RuntimeError("Falta CHILECOMPRA_TICKET en variables de entorno.")

    api_url = os.getenv("CHILECOMPRA_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL

    start_raw = os.getenv("CHILECOMPRA_START_DATE")
    end_raw = os.getenv("CHILECOMPRA_END_DATE")

    if start_raw and end_raw:
        start_date = parse_cli_or_env_date(start_raw)
        end_date = parse_cli_or_env_date(end_raw)
    else:
        start_date, end_date = chilean_today_and_yesterday()

    if start_date > end_date:
        start_date, end_date = end_date, start_date

    return Config(ticket=ticket, start_date=start_date, end_date=end_date, api_url=api_url)


def iterate_days(start: datetime, end: datetime):
    cursor = start
    while cursor.date() <= end.date():
        yield cursor
        cursor = cursor + timedelta(days=1)


def fetch_json(url: str) -> dict[str, Any]:
    with urlopen(url) as response:  # nosec B310
        return json.loads(response.read().decode("utf-8"))


def parse_marketplace_date(raw: Any) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    # /Date(1707777000000)/ format
    match = re.match(r"/Date\((\d+)([+-]\d{4})?\)/", text)
    if match:
        millis = int(match.group(1))
        dt = datetime.fromtimestamp(millis / 1000, tz=CHILE_TZ)
        return dt.isoformat()

    # ISO-ish strings
    for candidate in (
        text,
        text.replace("Z", "+00:00"),
    ):
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=CHILE_TZ)
            return dt.astimezone(CHILE_TZ).isoformat()
        except ValueError:
            continue

    return None


def normalize_tender(item: dict[str, Any]) -> dict[str, Any]:
    tender_id = str(
        item.get("CodigoExterno")
        or item.get("Codigo")
        or item.get("id")
        or item.get("TenderId")
        or ""
    ).strip()

    name = str(
        item.get("Nombre")
        or item.get("name")
        or item.get("NombreLicitacion")
        or ""
    ).strip()

    buyer = str(
        item.get("NombreOrganismo")
        or item.get("buyer")
        or item.get("Comprador")
        or ""
    ).strip()

    status = str(
        item.get("Estado")
        or item.get("status")
        or item.get("CodigoEstado")
        or ""
    ).strip()

    published_at = parse_marketplace_date(
        item.get("FechaPublicacion") or item.get("published_at") or item.get("FechaCreacion")
    )
    close_at = parse_marketplace_date(
        item.get("FechaCierre") or item.get("close_at") or item.get("FechaFinal")
    )

    region = str(item.get("Region") or item.get("region") or "").strip() or None
    url = str(item.get("Url") or item.get("url") or "").strip() or None

    normalized = {
        "tender_id": tender_id,
        "name": name,
        "buyer": buyer,
        "status": status,
        "published_at": published_at,
        "close_at": close_at,
        "region": region,
        "url": url,
    }

    required = ["tender_id", "name", "buyer", "status", "published_at", "close_at"]
    missing = [field for field in required if not normalized.get(field)]
    if missing:
        raise ValueError(f"Licitación inválida, faltan campos requeridos: {', '.join(missing)}")

    return normalized


def build_daily_url(api_url: str, ticket: str, day: datetime) -> str:
    params = {
        "ticket": ticket,
        "fecha": day.strftime("%d%m%Y"),
    }
    return f"{api_url}?{urlencode(params)}"


def main() -> int:
    config = load_config()

    by_id: dict[str, dict[str, Any]] = {}
    for day in iterate_days(config.start_date, config.end_date):
        url = build_daily_url(config.api_url, config.ticket, day)
        payload = fetch_json(url)
        for raw in payload.get("Listado", []):
            try:
                tender = normalize_tender(raw)
            except ValueError:
                continue
            by_id[tender["tender_id"]] = tender

    tenders = sorted(by_id.values(), key=lambda item: item["close_at"])
    now_iso = datetime.now(CHILE_TZ).isoformat()

    OUTPUT_DATA.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_DATA.write_text(json.dumps(tenders, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUTPUT_META.write_text(
        json.dumps({"timestamp": now_iso, "total": len(tenders)}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Generadas {len(tenders)} licitaciones en {OUTPUT_DATA}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
