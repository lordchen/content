#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass
class VideoSample:
    platform: str
    benchmark_account: str
    video_url: str
    note: str
    priority: str


@dataclass
class SubtitleRecord:
    platform: str
    benchmark_account: str
    video_url: str
    video_id: str
    author: str
    duration: int
    engine: str
    source: str
    text: str
    segments: list[dict[str, Any]]
    structure: dict[str, Any]
    status: str
    error: str
    extracted_at: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="提取对标视频字幕并生成结构摘要")
    parser.add_argument(
        "--config",
        default="configs/benchmark_video_samples.json",
        help="对标视频样本配置",
    )
    parser.add_argument(
        "--db-path",
        default="data/contentwork.db",
        help="SQLite 数据库路径",
    )
    parser.add_argument(
        "--output-dir",
        default="data/extracted/benchmark_subtitles",
        help="字幕与结构摘要输出目录",
    )
    parser.add_argument(
        "--engine",
        default="auto",
        choices=["auto", "asr", "ocr"],
        help="video-tools 字幕引擎",
    )
    return parser.parse_args()


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS benchmark_video_samples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          benchmark_account TEXT NOT NULL,
          video_url TEXT NOT NULL,
          note TEXT NOT NULL,
          priority TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS benchmark_video_subtitles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          benchmark_account TEXT NOT NULL,
          video_url TEXT NOT NULL,
          video_id TEXT,
          author TEXT,
          duration INTEGER,
          engine TEXT,
          source TEXT,
          text TEXT,
          segments_json TEXT NOT NULL,
          structure_json TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT NOT NULL,
          extracted_at TEXT NOT NULL
        );
        """
    )
    conn.commit()


def load_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_samples(config: dict[str, Any]) -> list[VideoSample]:
    samples = []
    for row in config.get("samples", []):
        video_url = (row.get("video_url") or "").strip()
        if not video_url:
            continue
        samples.append(
            VideoSample(
                platform=row.get("platform", "douyin"),
                benchmark_account=row.get("benchmark_account", ""),
                video_url=video_url,
                note=row.get("note", ""),
                priority=row.get("priority", "P1"),
            )
        )
    return samples


def call_subtitle_api(api_base: str, video_url: str, engine: str) -> dict[str, Any]:
    endpoint = f"{api_base.rstrip('/')}/api/subtitle?engine={engine}"
    payload = json.dumps({"url": video_url}, ensure_ascii=False).encode("utf-8")
    request = Request(
        endpoint,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def analyze_structure(text: str, segments: list[dict[str, Any]]) -> dict[str, Any]:
    lines = [line.strip() for line in text.replace("\r", "\n").split("\n") if line.strip()]
    if not lines and segments:
        lines = [str(seg.get("text", "")).strip() for seg in segments if str(seg.get("text", "")).strip()]

    opening = lines[:3]
    cta_lines = [
        line for line in lines
        if any(term in line for term in ["点击", "下单", "团购", "到店", "私信", "领取", "优惠", "活动", "来店", "进店"])
    ]
    product_lines = [
        line for line in lines
        if any(term in line for term in ["鞋", "衣服", "门店", "阿迪", "adidas", "穿搭", "上脚", "试穿", "款"])
    ]

    return {
        "line_count": len(lines),
        "opening_lines": opening,
        "cta_lines": cta_lines[:5],
        "product_or_scene_lines": product_lines[:8],
        "suggested_script_pattern": infer_pattern(lines),
    }


def infer_pattern(lines: list[str]) -> str:
    merged = "\n".join(lines)
    if any(term in merged for term in ["优惠", "团购", "下单", "领取", "活动"]):
        return "优惠/活动转化型"
    if any(term in merged for term in ["穿搭", "上脚", "搭配", "试穿"]):
        return "穿搭种草型"
    if any(term in merged for term in ["门店", "到店", "探店", "来店"]):
        return "门店导流型"
    return "口播信息型"


def insert_sample(conn: sqlite3.Connection, sample: VideoSample) -> None:
    conn.execute(
        """
        INSERT INTO benchmark_video_samples (
          platform, benchmark_account, video_url, note, priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            sample.platform,
            sample.benchmark_account,
            sample.video_url,
            sample.note,
            sample.priority,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()


def insert_record(conn: sqlite3.Connection, record: SubtitleRecord) -> None:
    conn.execute(
        """
        INSERT INTO benchmark_video_subtitles (
          platform, benchmark_account, video_url, video_id, author, duration,
          engine, source, text, segments_json, structure_json, status, error,
          extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.platform,
            record.benchmark_account,
            record.video_url,
            record.video_id,
            record.author,
            record.duration,
            record.engine,
            record.source,
            record.text,
            json.dumps(record.segments, ensure_ascii=False),
            json.dumps(record.structure, ensure_ascii=False),
            record.status,
            record.error,
            record.extracted_at,
        ),
    )
    conn.commit()


def extract_one(api_base: str, sample: VideoSample, engine: str) -> SubtitleRecord:
    extracted_at = datetime.now(timezone.utc).isoformat()
    try:
        response = call_subtitle_api(api_base, sample.video_url, engine)
        data = response.get("data") or {}
        text = data.get("text") or ""
        segments = data.get("segments") or []
        structure = analyze_structure(text, segments)
        return SubtitleRecord(
            platform=sample.platform,
            benchmark_account=sample.benchmark_account,
            video_url=sample.video_url,
            video_id=str(data.get("video_id") or ""),
            author=str(data.get("author") or ""),
            duration=int(data.get("duration") or 0),
            engine=str(data.get("engine") or engine),
            source=str(data.get("source") or ""),
            text=text,
            segments=segments,
            structure=structure,
            status="ok",
            error="",
            extracted_at=extracted_at,
        )
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:1000]
        return failed_record(sample, f"HTTP {exc.code}: {detail}", extracted_at)
    except URLError as exc:
        return failed_record(sample, f"URL error: {exc}", extracted_at)
    except Exception as exc:
        return failed_record(sample, str(exc), extracted_at)


def failed_record(sample: VideoSample, error: str, extracted_at: str) -> SubtitleRecord:
    return SubtitleRecord(
        platform=sample.platform,
        benchmark_account=sample.benchmark_account,
        video_url=sample.video_url,
        video_id="",
        author="",
        duration=0,
        engine="",
        source="",
        text="",
        segments=[],
        structure={},
        status="failed",
        error=error,
        extracted_at=extracted_at,
    )


def write_output(records: list[SubtitleRecord], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = output_dir / f"{stamp}.json"
    output_path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "count": len(records),
                "ok_count": sum(1 for record in records if record.status == "ok"),
                "items": [asdict(record) for record in records],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return output_path


def main() -> int:
    args = parse_args()
    config = load_config(Path(args.config))
    samples = load_samples(config)

    db_path = Path(args.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)

    try:
        ensure_schema(conn)
        for sample in samples:
            insert_sample(conn, sample)

        records = [
            extract_one(config.get("video_tools_api_base", "http://127.0.0.1:8000"), sample, args.engine)
            for sample in samples
        ]
        for record in records:
            insert_record(conn, record)
    finally:
        conn.close()

    output_path = write_output(records, Path(args.output_dir))
    print(f"样本数: {len(samples)}")
    print(f"成功字幕: {sum(1 for record in records if record.status == 'ok')}")
    print(f"输出文件: {output_path}")
    if not samples:
        print("当前没有 video_url，先填 configs/benchmark_video_samples.json 再运行。")
    for record in records:
        print(f"- {record.benchmark_account}: {record.status} {record.error[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
