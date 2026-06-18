#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class BenchmarkAccount:
    platform: str
    account_name: str
    account_handle: str
    account_url: str
    category: str
    why_track: str
    content_patterns: list[str]


@dataclass
class ScriptCandidate:
    brand_name: str
    platform: str
    title: str
    hook: str
    outline: str
    source_trend_keyword: str
    source_benchmark_account: str
    source_pattern: str
    fit_reason: str
    risk_notes: str
    candidate_level: str
    created_at: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成每日脚本候选库")
    parser.add_argument(
        "--brand-config",
        default="configs/brands/adidas_tuan_gou_douyin.json",
        help="品牌配置路径",
    )
    parser.add_argument(
        "--db-path",
        default="data/contentwork.db",
        help="SQLite 数据库路径",
    )
    parser.add_argument(
        "--output-dir",
        default="data/generated/daily_script_candidates",
        help="脚本候选输出目录",
    )
    return parser.parse_args()


def load_brand_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS benchmark_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          account_name TEXT NOT NULL,
          account_handle TEXT NOT NULL,
          account_url TEXT,
          category TEXT NOT NULL,
          why_track TEXT NOT NULL,
          content_patterns_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_script_candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          title TEXT NOT NULL,
          hook TEXT NOT NULL,
          outline TEXT NOT NULL,
          source_trend_keyword TEXT NOT NULL,
          source_benchmark_account TEXT NOT NULL,
          source_pattern TEXT NOT NULL,
          fit_reason TEXT NOT NULL,
          risk_notes TEXT NOT NULL,
          candidate_level TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        """
    )
    conn.commit()


def sync_benchmark_accounts(conn: sqlite3.Connection, brand_config: dict[str, Any]) -> list[BenchmarkAccount]:
    brand_name = brand_config["brand_name"]
    created_at = datetime.now(timezone.utc).isoformat()
    benchmarks = [
        BenchmarkAccount(**item)
        for item in brand_config.get("benchmark_accounts", [])
    ]

    conn.execute("DELETE FROM benchmark_accounts WHERE brand_name = ?", (brand_name,))
    conn.executemany(
        """
        INSERT INTO benchmark_accounts (
          brand_name, platform, account_name, account_handle, account_url,
          category, why_track, content_patterns_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                brand_name,
                item.platform,
                item.account_name,
                item.account_handle,
                item.account_url,
                item.category,
                item.why_track,
                json.dumps(item.content_patterns, ensure_ascii=False),
                created_at,
            )
            for item in benchmarks
        ],
    )
    conn.commit()
    return benchmarks


def load_selected_trends(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    cursor = conn.execute(
        """
        SELECT keyword, hot_value, candidate_level, relevance_score
        FROM brand_hot_candidates
        WHERE candidate_level IN ('selected', 'watch')
        ORDER BY relevance_score DESC, hot_value DESC
        LIMIT 10
        """
    )
    rows = [
        {
            "keyword": row[0],
            "hot_value": row[1],
            "candidate_level": row[2],
            "relevance_score": row[3],
        }
        for row in cursor.fetchall()
    ]

    if rows:
        return rows

    fallback_cursor = conn.execute(
        """
        SELECT keyword, hot_value
        FROM hot_search_items
        ORDER BY fetched_at DESC, hot_value DESC
        LIMIT 5
        """
    )
    return [
        {
            "keyword": row[0],
            "hot_value": row[1],
            "candidate_level": "fallback",
            "relevance_score": 0,
        }
        for row in fallback_cursor.fetchall()
    ]


def generate_candidates(
    brand_config: dict[str, Any],
    trends: list[dict[str, Any]],
    benchmarks: list[BenchmarkAccount],
) -> list[ScriptCandidate]:
    created_at = datetime.now(timezone.utc).isoformat()
    brand_name = brand_config["brand_name"]
    platform = brand_config.get("primary_platform", "抖音")
    target_audience = brand_config.get("target_audience", "")
    content_tone = "、".join(brand_config.get("content_tone", []))
    taboo_text = "、".join(brand_config.get("taboo_rules", []))

    candidates: list[ScriptCandidate] = []

    if not benchmarks:
        return candidates

    for index, trend in enumerate(trends[:3]):
        benchmark = benchmarks[index % len(benchmarks)]
        pattern = benchmark.content_patterns[index % len(benchmark.content_patterns)]
        keyword = trend["keyword"]
        title = build_title(keyword, pattern)
        hook = (
            f"从“{keyword}”切入，但不要直接蹭热点本身，而是把它改写成"
            f"面向{target_audience}的{pattern}短视频开头。"
        )
        outline = (
            f"前 3 秒借“{keyword}”建立注意力，中段用 {benchmark.account_name} 常见的“{pattern}”结构，"
            f"再转到品牌活动、门店到店或商品利益点，最后给出明确行动引导。"
        )
        fit_reason = (
            f"该候选结合热点“{keyword}”和对标账号“{benchmark.account_name}”的{pattern}结构，"
            f"更适合当前品牌的{content_tone}表达。"
        )
        risk_notes = (
            f"避免直接搬运热点原话题；避免出现这些表达：{taboo_text}。"
        )

        candidates.append(
            ScriptCandidate(
                brand_name=brand_name,
                platform=platform,
                title=title,
                hook=hook,
                outline=outline,
                source_trend_keyword=keyword,
                source_benchmark_account=benchmark.account_name,
                source_pattern=pattern,
                fit_reason=fit_reason,
                risk_notes=risk_notes,
                candidate_level="draft",
                created_at=created_at,
            )
        )

    return candidates


def build_title(keyword: str, pattern: str) -> str:
    if "活动" in pattern or "优惠" in pattern:
        return f"{keyword} 能不能改成门店活动转化视频"
    if "穿搭" in pattern or "上脚" in pattern:
        return f"{keyword} 里的穿搭点，怎么改成球鞋种草脚本"
    if "探店" in pattern:
        return f"{keyword} 能不能嫁接到本地探店团购视频"
    return f"{keyword} 如何改写成品牌短视频脚本"


def save_candidates(
    conn: sqlite3.Connection,
    candidates: list[ScriptCandidate],
    output_dir: Path,
    brand_name: str,
) -> Path:
    created_at = datetime.now(timezone.utc).isoformat()
    conn.execute("DELETE FROM daily_script_candidates WHERE brand_name = ?", (brand_name,))
    conn.executemany(
        """
        INSERT INTO daily_script_candidates (
          brand_name, platform, title, hook, outline, source_trend_keyword,
          source_benchmark_account, source_pattern, fit_reason, risk_notes,
          candidate_level, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item.brand_name,
                item.platform,
                item.title,
                item.hook,
                item.outline,
                item.source_trend_keyword,
                item.source_benchmark_account,
                item.source_pattern,
                item.fit_reason,
                item.risk_notes,
                item.candidate_level,
                item.created_at,
            )
            for item in candidates
        ],
    )
    conn.commit()

    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = slugify(brand_name)
    output_path = output_dir / f"{stamp}-{slug}.json"
    output_path.write_text(
        json.dumps(
            {
                "brand_name": brand_name,
                "generated_at": created_at,
                "count": len(candidates),
                "items": [asdict(item) for item in candidates],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return output_path


def slugify(text: str) -> str:
    safe = []
    for char in text:
        if char.isalnum():
            safe.append(char.lower())
        elif ord(char) > 127:
            safe.append(char)
        else:
            safe.append("_")
    return "".join(safe).strip("_") or "brand"


def main() -> int:
    args = parse_args()
    brand_config = load_brand_config(Path(args.brand_config))
    db_path = Path(args.db_path)
    conn = sqlite3.connect(db_path)

    try:
      ensure_schema(conn)
      benchmarks = sync_benchmark_accounts(conn, brand_config)
      trends = load_selected_trends(conn)
      candidates = generate_candidates(brand_config, trends, benchmarks)
      out_path = save_candidates(
          conn=conn,
          candidates=candidates,
          output_dir=Path(args.output_dir),
          brand_name=brand_config["brand_name"],
      )
    finally:
        conn.close()

    print(f"已生成脚本候选 {len(candidates)} 条")
    print(f"输出文件: {out_path}")
    for item in candidates:
        print(f"- {item.title} | 热点={item.source_trend_keyword} | 对标={item.source_benchmark_account}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
