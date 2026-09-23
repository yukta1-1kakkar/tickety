"""Run working collectors concurrently and report the measured time saving."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path


COLLECTORS = {
    "google_flights": "google_flights.py",
    "airindiaexpress": "airindiaexpress.py",
    "akasaair": "akasaair.py",
    "spicejet": "spicejet.py",
    "yatra": "yatra.py",
}

DEFAULT_COLLECTORS = ["google_flights"]


def run_collector(source: str, scraper_dir: Path, headed: bool) -> dict:
    command = [sys.executable, str(scraper_dir / COLLECTORS[source])]
    if headed and source == "yatra":
        command.append("--headed")
    started = time.perf_counter()
    result = subprocess.run(command, cwd=scraper_dir, check=False, text=True, capture_output=True)
    return {
        "source": source,
        "seconds": round(time.perf_counter() - started, 2),
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def build_timing_report(results: list[dict], parallel_seconds: float) -> dict:
    sequential_seconds = round(sum(item["seconds"] for item in results), 2)
    parallel_seconds = round(parallel_seconds, 2)
    saved_seconds = round(sequential_seconds - parallel_seconds, 2)
    saving_pct = round(saved_seconds / sequential_seconds * 100, 2) if sequential_seconds else 0
    speedup = round(sequential_seconds / parallel_seconds, 2) if parallel_seconds else 0
    return {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "collectors": [{key: value for key, value in item.items() if key not in {"stdout", "stderr"}} for item in results],
        "normal_sequential_seconds": sequential_seconds,
        "thread_pool_wall_seconds": parallel_seconds,
        "time_saved_seconds": saved_seconds,
        "time_saved_percent": saving_pct,
        "speedup": speedup,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run daily VAYUSETU collectors with a thread pool")
    parser.add_argument("--source", action="append", choices=COLLECTORS, help="run only selected source; repeatable")
    parser.add_argument("--headed", action="store_true", help="show Chromium for Yatra")
    parser.add_argument("--workers", type=int, default=len(COLLECTORS), help="maximum simultaneous collectors")
    args = parser.parse_args()
    selected = args.source or DEFAULT_COLLECTORS
    workers = max(1, min(args.workers, len(selected)))
    scraper_dir = Path(__file__).resolve().parent

    wall_started = time.perf_counter()
    results = []
    print(f"Starting {len(selected)} collectors with ThreadPoolExecutor(max_workers={workers})")
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="vayusetu-scraper") as executor:
        futures = {executor.submit(run_collector, source, scraper_dir, args.headed): source for source in selected}
        for future in as_completed(futures):
            item = future.result()
            results.append(item)
            print(f"\n=== {item['source']} ({item['seconds']:.2f}s) ===")
            if item["stdout"].strip():
                print(item["stdout"].strip())
            if item["stderr"].strip():
                print(item["stderr"].strip(), file=sys.stderr)

    parallel_seconds = round(time.perf_counter() - wall_started, 2)
    # For independent subprocesses, their measured duration sum is the time
    # the same completed work would take sequentially on this run.
    report = build_timing_report(results, parallel_seconds)
    report_path = scraper_dir / "last_tpe_benchmark.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("\n=== Timing comparison ===")
    print(f"Normal sequential equivalent : {report['normal_sequential_seconds']:.2f}s")
    print(f"ThreadPoolExecutor wall time  : {report['thread_pool_wall_seconds']:.2f}s")
    print(f"Time saved                    : {report['time_saved_seconds']:.2f}s ({report['time_saved_percent']:.2f}%)")
    print(f"Measured speedup              : {report['speedup']:.2f}x")
    print(f"Benchmark report              : {report_path}")

    failures = [item["source"] for item in results if item["returncode"] != 0]
    if failures:
        raise SystemExit(f"Collectors failed: {', '.join(failures)}")


if __name__ == "__main__":
    main()
