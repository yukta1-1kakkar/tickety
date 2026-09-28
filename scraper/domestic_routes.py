"""Load and validate the directional Indian city-pair basket."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path


# Values may contain multiple IATA codes for a city served by multiple airports.
# SerpAPI accepts comma-separated airport IDs.
INDIAN_CITY_AIRPORTS: dict[str, str] = {
    "ADAMPUR": "AIP", "AGARTALA": "IXA", "AGATTI ISLAND": "AGX",
    "AGRA": "AGR", "AHMEDABAD": "AMD", "AIZAWL": "AJL",
    "ALLAHABAD": "IXD", "AMBIKAPUR": "AHA", "AMRAVATI": "AVR",
    "AMRITSAR": "ATQ", "AURANGABAD": "IXU", "AYODHYA": "AYJ",
    "BAGDOGRA": "IXB", "BAREILLY": "BEK", "BATHINDA": "BUP",
    "BELGAUM": "IXG", "BENGALURU": "BLR", "BHAVNAGAR": "BHU",
    "BHOPAL": "BHO", "BHUBANESWAR": "BBI", "BHUJ": "BHJ",
    "BIDAR": "IXX", "BIKANER": "BKB", "BILASPUR": "PAB",
    "CHANDIGARH": "IXC", "CHENNAI": "MAA", "COIMBATORE": "CJB",
    "COOCH BEHAR": "COH", "CUDDAPAH": "CDP", "DAMAN": "NMB",
    "DARBHANGA": "DBR", "DEHRADUN": "DED", "DELHI": "DEL",
    "DEOGHAR": "DGH", "DHARAMSALA": "DHM", "DIBRUGARH": "DIB",
    "DIMAPUR": "DMU", "DIU": "DIU", "DURGAPUR": "RDP",
    "GAUTAM BUDDHA NAGAR": "DXN", "GAYA": "GAY", "GHAZIABAD": "HDO",
    "GOA": "GOI,GOX", "GONDIA": "GDB", "GORAKHPUR": "GOP",
    "GULBARGA": "GBI", "GUWAHATI": "GAU", "GWALIOR": "GWL",
    "HIRASAR": "HSR", "HISAR": "HSS", "HUBLI": "HBX",
    "HYDERABAD": "HYD", "IMPHAL": "IMF", "INDORE": "IDR",
    "ITANAGAR": "HGI", "JABALPUR": "JLR", "JAGDALPUR": "JGB",
    "JAIPUR": "JAI", "JAISALMER": "JSA", "JALGAON": "JLG",
    "JAMMU": "IXJ", "JAMNAGAR": "JGA", "JAMSHEDPUR": "IXW",
    "JEYPORE": "PYB", "JHARSUGUDA": "JRG", "JODHPUR": "JDH",
    "JORHAT": "JRH", "KANDLA": "IXY", "KANNUR": "CNN",
    "KANPUR": "KNU", "KESHOD": "IXK", "KHAJURAHO": "HJR",
    "KISHANGARH": "KQH", "KOCHI": "COK", "KOLHAPUR": "KLH",
    "KOLKATA": "CCU", "KOZHIKODE": "CCJ", "KULLU": "KUU",
    "KURNOOL": "KJB", "LEH": "IXL", "LILABARI": "IXI",
    "LUCKNOW": "LKO", "LUDHIANA": "LUH", "MADURAI": "IXM",
    "MALVAN": "SDW", "MANGALORE": "IXE", "MUMBAI": "BOM",
    "MUNDRA": "MDA", "MYSORE": "MYQ", "NAGPUR": "NAG",
    "NANDED": "NDC", "NASHIK": "ISK", "PANTNAGAR": "PGH",
    "PASIGHAT": "IXT", "PATNA": "PAT", "PITHORAGARH": "NNS",
    "PONDICHERRY": "PNY", "PORBANDAR": "PBD", "PORT BLAIR": "IXZ",
    "PUNE": "PNQ", "PURNEA": "PXN", "RAIPUR": "RPR",
    "RAJAHMUNDRY": "RJA", "RANCHI": "IXR", "REWA": "REW",
    "ROURKELA": "RRK", "RUPSI": "RUP", "SALEM": "SXV",
    "SHILLONG": "SHL", "SHIMLA": "SLV", "SHIRDI": "SAG",
    "SHIVAMOGGA": "RQY", "SILCHAR": "IXS", "SOLAPUR": "SSE",
    "SRINAGAR": "SXR", "SURAT": "STV", "TEZU": "TEI",
    "THIRUVANANTHAPURAM": "TRV", "TIRUCHIRAPPALLI": "TRZ",
    "TIRUPATI": "TIR", "TUTICORIN": "TCR", "UDAIPUR": "UDR",
    "UTKELA": "UKE", "VADODARA": "BDQ", "VARANASI": "VNS",
    "VIDYANAGAR": "VDY", "VIJAYWADA": "VGA", "VISHAKHAPATNAM": "VTZ",
}


DEFAULT_ROUTE_CSV = Path(__file__).resolve().parent.parent / "config" / "routes.json"


@dataclass(frozen=True)
class DomesticRoute:
    route_id: str
    origin_city: str
    destination_city: str
    origin_airport: str
    destination_airport: str
    total_passengers: float
    weight: float


def _city(value: str | None) -> str:
    return " ".join((value or "").strip().upper().split())


def load_domestic_routes(csv_path: str | Path = DEFAULT_ROUTE_CSV) -> tuple[list[DomesticRoute], list[dict]]:
    """Return valid domestic routes and explicit rejection records.

    Membership in ``INDIAN_CITY_AIRPORTS`` is the domestic-country check. Unknown
    cities are rejected instead of being guessed or silently sent to SerpAPI.
    """
    routes: list[DomesticRoute] = []
    rejected: list[dict] = []
    seen: set[str] = set()
    path = Path(csv_path)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        if path.suffix.lower() == ".json":
            payload = json.load(handle)
            reader = ({
                "route_id": row["routeId"], "origin": row["origin"],
                "destination": row["destination"],
                "total_passengers": row["totalPassengers"], "weight": row["weight"],
            } for row in payload.get("routes", []))
            fieldnames = {"route_id", "origin", "destination", "total_passengers", "weight"}
        else:
            reader = csv.DictReader(handle)
            fieldnames = set(reader.fieldnames or [])
        required = {"route_id", "origin", "destination", "total_passengers", "weight"}
        missing = required - fieldnames
        if missing:
            raise ValueError(f"Route CSV is missing columns: {', '.join(sorted(missing))}")
        for line_number, row in enumerate(reader, start=2):
            origin = _city(row.get("origin"))
            destination = _city(row.get("destination"))
            route_id = _city(row.get("route_id")).replace(" ", "")
            unknown = [city for city in (origin, destination) if city not in INDIAN_CITY_AIRPORTS]
            if unknown:
                rejected.append({
                    "line": line_number, "route_id": route_id,
                    "reason": f"non-domestic or unmapped city: {', '.join(unknown)}",
                })
                continue
            canonical_id = f"{origin}-{destination}".replace(" ", "")
            if route_id != canonical_id or route_id in seen:
                rejected.append({
                    "line": line_number, "route_id": route_id,
                    "reason": "invalid directional route_id" if route_id != canonical_id else "duplicate route_id",
                })
                continue
            seen.add(route_id)
            routes.append(DomesticRoute(
                route_id=route_id,
                origin_city=origin,
                destination_city=destination,
                origin_airport=INDIAN_CITY_AIRPORTS[origin],
                destination_airport=INDIAN_CITY_AIRPORTS[destination],
                total_passengers=float(row["total_passengers"]),
                weight=float(row["weight"]),
            ))
    return routes, rejected
