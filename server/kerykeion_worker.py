"""One bounded, offline chart job on stdin; one JSON envelope on stdout."""

import contextlib
import importlib.metadata
import json
import logging
import math
import os
import sys
import tempfile
import xml.etree.ElementTree as ET

VERSION = "6.0.2"
PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
ANGLES = ["Ascendant", "Medium_Coeli", "Descendant", "Imum_Coeli"]
HOUSES = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"]
ASPECTS = [(0, "conjunction"), (60, "sextile"), (90, "square"), (120, "trine"), (180, "opposition")]


def no_network(event, args):
    if event in {"socket.connect", "socket.getaddrinfo", "socket.bind"}:
        raise RuntimeError("Chart worker networking is disabled")


sys.addaudithook(no_network)
logging.disable(logging.CRITICAL)


def self_test_job():
    location = {"city": "London", "nation": "GB", "latitude": 51.5074, "longitude": -0.1278, "timezone": "Europe/London"}
    return {
        "confidence": "known",
        "subject": {"name": "Offline check", "at": "1990-05-01T09:15:00Z", **location},
        "targets": [{"name": "Transit", "at": "2026-10-09T11:00:00Z", **location}],
    }


def calculate(job, data_dir):
    os.environ["KERYKEION_BACKEND"] = "swisseph"
    os.environ["KERYKEION_EPHE_PATH"] = data_dir
    # Swiss Ephemeris also reads SE_EPHE_PATH, independently of Kerykeion.
    os.environ["SE_EPHE_PATH"] = data_dir
    from kerykeion import AstrologicalSubjectFactory, BACKEND_NAME, ChartDataFactory, ChartDrawer, to_context
    import swisseph as swe

    if importlib.metadata.version("kerykeion") != VERSION or BACKEND_NAME != "swisseph":
        raise ValueError("Unexpected chart runtime")
    if importlib.metadata.version("pyswisseph") != "2.10.3.2":
        raise ValueError("Unexpected ephemeris runtime")
    confidence = job["confidence"]
    if confidence not in {"known", "estimated"} or not 1 <= len(job["targets"]) <= 4:
        raise ValueError("Invalid chart job")
    known = confidence == "known"

    def subject(request, natal=False):
        for key, bound in [("latitude", 66), ("longitude", 180)]:
            value = request[key]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or abs(value) > bound:
                raise ValueError("Invalid coordinates")
        points = PLANETS + (ANGLES if natal and known else [])
        # Node has already validated local wall time and selected any clock fold.
        # The UTC factory preserves that exact occurrence, including historical DST.
        result = AstrologicalSubjectFactory.from_iso_utc_time(
            name=request["name"], iso_utc_time=request["at"],
            city=request["city"], nation=request["nation"],
            lng=request["longitude"], lat=request["latitude"], tz_str=request["timezone"],
            online=False, zodiac_type="Tropical", perspective_type="Apparent Geocentric",
            houses_system_identifier="P", active_points=points,
        )
        if result.polar_house_fallbacks or result.ephemeris_warnings:
            raise ValueError("Incomplete or substituted chart")
        swe.set_ephe_path(data_dir)
        for index, name in enumerate(PLANETS):
            position, flags = swe.calc_ut(result.julian_day, index, swe.FLG_MOSEPH | swe.FLG_SPEED)
            if not flags & swe.FLG_MOSEPH or abs(position[0] - getattr(result, name.lower()).abs_pos) > 1e-7:
                raise ValueError("Unverified ephemeris source")
        return result

    natal = subject(job["subject"], natal=True)
    transits = [subject(target) for target in job["targets"]]

    def export_subject(value, include_houses=False):
        raw = value.model_dump(mode="json", exclude_none=True)
        if not include_houses:
            for name in ANGLES:
                raw.pop(name.lower(), None)
            for name in HOUSES:
                raw.pop(f"{name}_house", None)
            for name in PLANETS:
                raw[name.lower()].pop("house", None)
            raw.pop("houses_names_list", None)
            raw.pop("coincident_house_cusps", None)
        return raw

    root = ET.Element("astrology_context", engine="Kerykeion", version=VERSION, backend="swisseph-moshier", confidence=confidence, frame="Apparent Geocentric", zodiac="Tropical")

    def points_xml(parent, value, include_houses=False):
        points = PLANETS + (ANGLES if include_houses else [])
        for name in points:
            point = getattr(value, name.lower())
            element = ET.fromstring(to_context(point))
            element.set("abs_pos", f"{point.abs_pos:.9f}")
            if not include_houses:
                element.attrib.pop("house", None)
            parent.append(element)
        if include_houses:
            houses = ET.SubElement(parent, "houses", system="Placidus")
            for name in HOUSES:
                houses.append(ET.fromstring(to_context(getattr(value, f"{name}_house"))))

    def aspects_xml(parent, first, second=None):
        dual = second is not None
        second = second if dual else first
        matches = []
        for i, (first_name, first_point) in enumerate(first):
            for second_name, second_point in (second if dual else second[i + 1:]):
                separation = abs((first_point.abs_pos - second_point.abs_pos + 540) % 360 - 180)
                for angle, aspect in ASPECTS:
                    orb = abs(separation - angle)
                    if orb <= 6:
                        matches.append((orb, first_name, second_name, aspect))
        group = ET.SubElement(parent, "aspects", count=str(len(matches)), included=str(min(len(matches), 24)), max_orb="6")
        for orb, first_name, second_name, aspect in sorted(matches)[:24]:
            ET.SubElement(group, "aspect", **{"natal" if dual else "first": first_name, "transit" if dual else "second": second_name, "type": aspect, "orb": f"{orb:.3f}"})

    natal_points = [(name, getattr(natal, name.lower())) for name in PLANETS + (ANGLES if known else [])]
    natal_xml = ET.SubElement(root, "natal", at=natal.iso_formatted_utc_datetime, confidence=confidence)
    points_xml(natal_xml, natal, known)
    aspects_xml(natal_xml, natal_points)
    for transit in transits:
        transit_xml = ET.SubElement(root, "transit", at=transit.iso_formatted_utc_datetime)
        points_xml(transit_xml, transit)
        aspects_xml(transit_xml, natal_points, [(name, getattr(transit, name.lower())) for name in PLANETS])
    context = ET.tostring(root, encoding="unicode")
    if len(context) > 32_000:
        raise ValueError("Semantic context exceeds bound")

    output = {
        "engine": {"name": "Kerykeion", "version": VERSION, "backend": "swisseph-moshier"},
        "natal": export_subject(natal, known),
        "snapshots": [export_subject(transit) for transit in transits],
        "chartContext": context,
    }
    if known:
        active_aspects = [{"name": name, "orb": 6} for _, name in ASPECTS]
        settings = {"active_aspects": active_aspects, "point_orb_adjustments": {}}
        natal_data = ChartDataFactory.create_natal_chart_data(natal, **settings)
        transit_data = ChartDataFactory.create_transit_chart_data(natal, transits[0], include_house_comparison=False, **settings)

        def wheels(data):
            return {label: ChartDrawer(data, theme=theme, style="modern", transparent_background=True).generate_wheel_only_svg_string(remove_css_variables=True) for label, theme in [("dark", "dark"), ("light", "classic")]}

        output["charts"] = {"natal": wheels(natal_data), "transit": wheels(transit_data)}
        for chart in output["charts"].values():
            for svg in chart.values():
                if len(svg) > 512_000:
                    raise ValueError("Chart exceeds SVG bound")
                ET.fromstring(svg)
    return output


def main():
    try:
        raw = sys.stdin.buffer.read(16_385) if "--self-test" not in sys.argv else None
        if raw is not None and len(raw) > 16_384:
            raise ValueError("Input exceeds bound")
        job = json.loads(raw) if raw is not None else self_test_job()
        with tempfile.TemporaryDirectory(prefix="aeon-ephe-") as data_dir, contextlib.redirect_stdout(sys.stderr):
            result = calculate(job, data_dir)
        envelope = {"status": "OK", "data": result}
        code = 0
    except Exception:
        # Never expose stack traces containing private birth/location data.
        envelope = {"status": "ERROR", "error": {"code": "engine_failed", "message": "The offline chart could not be calculated."}}
        code = 1
    sys.stdout.write(json.dumps(envelope, allow_nan=False, separators=(",", ":")))
    sys.stdout.write("\n")
    return code


if __name__ == "__main__":
    sys.exit(main())
