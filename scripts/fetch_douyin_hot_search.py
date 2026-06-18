#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
import ssl
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DOUYIN_HOT_URL = (
    "https://www.douyin.com/aweme/v1/web/hot/search/list/"
    "?device_platform=webapp&aid=6383&channel=channel_pc_web"
)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
)
ROOT_DIR = Path(__file__).resolve().parents[1]
PROFILE_DIR = ROOT_DIR / "data" / "browser-profiles" / "douyin-auth"
STATE_PATH = ROOT_DIR / "data" / "auth" / "douyin-storage-state.json"


@dataclass
class HotItem:
    platform: str
    rank: int | None
    keyword: str
    hot_value: int | None
    sentence_tag: str | None
    video_count: int | None
    discuss_video_count: int | None
    event_time: int | None
    group_id: str | None
    word_type: int | None
    label: int | None
    raw_position: int | None
    source_url: str
    fetched_at: str


@dataclass
class BrandCandidate:
    brand_name: str
    keyword: str
    rank: int | None
    hot_value: int | None
    relevance_score: int
    candidate_level: str
    matched_rules: list[str]
    reason: str


def fetch_json(timeout: int) -> dict[str, Any]:
    request = Request(
        DOUYIN_HOT_URL,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": "https://www.douyin.com/hot/200000",
            "Accept": "application/json,text/plain,*/*",
        },
    )

    context = ssl.create_default_context()
    with urlopen(request, timeout=timeout, context=context) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_json_via_browser(timeout_ms: int) -> dict[str, Any]:
    if not STATE_PATH.exists():
        raise FileNotFoundError(
            f"未找到登录态文件: {STATE_PATH}，请先运行 npm run douyin:login 或 npm run douyin:relogin"
        )

    script = f"""
const {{ chromium }} = require("playwright");

(async () => {{
  const browser = await chromium.launch({{
    headless: true,
    channel: "chrome",
  }});
  const context = await browser.newContext({{
    storageState: {json.dumps(str(STATE_PATH))},
    viewport: {{ width: 1440, height: 960 }},
  }});

  try {{
    const page = await context.newPage();
    await page.goto("https://www.douyin.com/hot/200000", {{ waitUntil: "domcontentloaded", timeout: {timeout_ms} }});
    await page.waitForTimeout(3000);

    const payload = await page.evaluate(async () => {{
      const response = await fetch("https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web", {{
        method: "GET",
        credentials: "include",
        headers: {{
          "User-Agent": navigator.userAgent,
          "Referer": "https://www.douyin.com/hot/200000",
          "Accept": "application/json,text/plain,*/*",
        }},
      }});
      const text = await response.text();
      if (!response.ok) {{
        throw new Error(`HTTP_{{response.status}}: {{text.slice(0, 200)}}`);
      }}
      const parsed = JSON.parse(text);
      const payloadText = JSON.stringify(parsed);
      if (/login|登陆|登录|auth|verify|captcha/i.test(payloadText)) {{
        throw new Error(`LOGIN_REQUIRED: {{payloadText.slice(0, 200)}}`);
      }}
      return parsed;
    }});

    process.stdout.write(JSON.stringify(payload));
  }} finally {{
    await context.storageState({{ path: {json.dumps(str(STATE_PATH))} }}).catch(() => null);
    await context.close();
    await browser.close();
  }}
}})().catch((error) => {{
  console.error(String(error && error.stack ? error.stack : error));
  process.exit(1);
}});
"""
    result = subprocess.run(
        ["node", "--input-type=commonjs", "-e", script],
        capture_output=True,
        text=True,
        cwd=str(ROOT_DIR),
        timeout=max(60, timeout_ms // 1000 + 30),
        check=False,
    )
    if result.returncode != 0:
        stderr = (result.stderr or result.stdout or "").strip()
        if "LOGIN_REQUIRED:" in stderr:
            stderr = "登录态已失效，正在建议重新登录。"
        raise RuntimeError(stderr or "浏览器态抓取失败")
    return json.loads(result.stdout)


def relogin_if_needed() -> None:
    if STATE_PATH.exists():
        return
    print("未找到登录态文件，正在启动重登录流程…", file=sys.stderr)
    result = subprocess.run(
        ["npm", "run", "douyin:relogin"],
        cwd=str(ROOT_DIR),
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("重登录流程未成功完成")


def normalize_items(payload: dict[str, Any], fetched_at: str) -> list[HotItem]:
    data = payload.get("data") or {}
    word_list = data.get("word_list") or data.get("list") or []
    items: list[HotItem] = []

    for index, row in enumerate(word_list, start=1):
        keyword = (row.get("word") or "").strip()
        if not keyword:
            continue

        items.append(
            HotItem(
                platform="douyin",
                rank=row.get("position") or index,
                keyword=keyword,
                hot_value=coerce_int(row.get("hot_value")),
                sentence_tag=row.get("sentence_tag"),
                video_count=coerce_int(row.get("video_count")),
                discuss_video_count=coerce_int(row.get("discuss_video_count")),
                event_time=coerce_int(row.get("event_time")),
                group_id=str(row.get("group_id")) if row.get("group_id") is not None else None,
                word_type=coerce_int(row.get("word_type")),
                label=coerce_int(row.get("label")),
                raw_position=coerce_int(row.get("position")),
                source_url="https://www.douyin.com/hot/200000",
                fetched_at=fetched_at,
            )
        )

    return items


def coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def write_outputs(
    payload: dict[str, Any],
    items: list[HotItem],
    raw_dir: Path,
    normalized_dir: Path,
    stamp: str,
) -> tuple[Path, Path]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    normalized_dir.mkdir(parents=True, exist_ok=True)

    raw_path = raw_dir / f"{stamp}.json"
    normalized_path = normalized_dir / f"{stamp}.json"

    raw_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    normalized_path.write_text(
        json.dumps(
            {
                "platform": "douyin",
                "fetched_at": items[0].fetched_at if items else None,
                "count": len(items),
                "items": [asdict(item) for item in items],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return raw_path, normalized_path


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS hot_search_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          raw_path TEXT NOT NULL,
          normalized_path TEXT NOT NULL,
          item_count INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS hot_search_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          platform TEXT NOT NULL,
          rank_value INTEGER,
          keyword TEXT NOT NULL,
          hot_value INTEGER,
          sentence_tag TEXT,
          video_count INTEGER,
          discuss_video_count INTEGER,
          event_time INTEGER,
          group_id TEXT,
          word_type INTEGER,
          label INTEGER,
          raw_position INTEGER,
          source_url TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES hot_search_runs(id)
        );

        CREATE TABLE IF NOT EXISTS brand_hot_candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          brand_name TEXT NOT NULL,
          keyword TEXT NOT NULL,
          rank_value INTEGER,
          hot_value INTEGER,
          relevance_score INTEGER NOT NULL,
          candidate_level TEXT NOT NULL,
          matched_rules_json TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES hot_search_runs(id)
        );
        """
    )
    conn.commit()


def insert_run(
    conn: sqlite3.Connection,
    items: list[HotItem],
    raw_path: Path,
    normalized_path: Path,
) -> int:
    created_at = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        """
        INSERT INTO hot_search_runs (
          platform, fetched_at, raw_path, normalized_path, item_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "douyin",
            items[0].fetched_at,
            str(raw_path),
            str(normalized_path),
            len(items),
            created_at,
        ),
    )
    run_id = int(cursor.lastrowid)

    conn.executemany(
        """
        INSERT INTO hot_search_items (
          run_id, platform, rank_value, keyword, hot_value, sentence_tag,
          video_count, discuss_video_count, event_time, group_id, word_type,
          label, raw_position, source_url, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                item.platform,
                item.rank,
                item.keyword,
                item.hot_value,
                item.sentence_tag,
                item.video_count,
                item.discuss_video_count,
                item.event_time,
                item.group_id,
                item.word_type,
                item.label,
                item.raw_position,
                item.source_url,
                item.fetched_at,
            )
            for item in items
        ],
    )
    conn.commit()
    return run_id


def load_brand_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_filter_terms(config: dict[str, Any]) -> dict[str, list[str]]:
    filter_rules = config.get("filter_rules") or {}
    direct_terms = unique_terms(
        filter_rules.get("direct_include_keywords")
        or [config.get("brand_name", ""), *(config.get("topic_pages") or [])]
    )
    business_terms = unique_terms(
        filter_rules.get("business_context_keywords")
        or [
            config.get("target_audience", ""),
            config.get("primary_platform", ""),
            *(config.get("topic_pages") or []),
            *(config.get("business_goals") or []),
        ]
    )
    exclude_terms = unique_terms(
        filter_rules.get("exclude_keywords")
        or ["高考", "政治", "地震", "国际冲突", "灾害", "彩票"]
    )
    return {
        "direct": direct_terms,
        "business": business_terms,
        "exclude": exclude_terms,
    }


def unique_terms(values: list[str]) -> list[str]:
    seen: set[str] = set()
    terms: list[str] = []
    for value in values:
        value = (value or "").strip()
        if not value:
            continue
        for part in split_candidate_terms(value):
            if part not in seen and len(part) >= 2:
                seen.add(part)
                terms.append(part)
    return terms


def split_candidate_terms(text: str) -> list[str]:
    normalized = text.replace("、", " ").replace("，", " ").replace("/", " ").replace("|", " ")
    return [part.strip() for part in normalized.split() if part.strip()]


def filter_brand_candidates(
    items: list[HotItem],
    brand_config: dict[str, Any],
) -> list[BrandCandidate]:
    terms = build_filter_terms(brand_config)
    brand_name = brand_config.get("brand_name", "未命名品牌")
    candidates: list[BrandCandidate] = []

    for item in items:
        score = 0
        matched_rules: list[str] = []
        keyword = item.keyword

        direct_hits = [term for term in terms["direct"] if term in keyword]
        business_hits = [term for term in terms["business"] if term in keyword]
        exclude_hits = [term for term in terms["exclude"] if term in keyword]

        if direct_hits:
            score += 8 + len(direct_hits) * 2
            matched_rules.append(f"direct:{','.join(direct_hits)}")
        if business_hits:
            score += 4 + len(business_hits)
            matched_rules.append(f"business:{','.join(business_hits)}")
        if item.rank is not None and item.rank <= 10:
            score += 1
            matched_rules.append("top10_heat")
        if exclude_hits:
            score -= 8
            matched_rules.append(f"exclude:{','.join(exclude_hits)}")

        if score >= 8:
            level = "selected"
            reason = "直接命中品牌/业务关键词，适合进入今日候选池。"
        elif score >= 3:
            level = "watch"
            reason = "有一定业务相关性，但还不足以直接进脚本池，适合作为观察项。"
        else:
            level = "discarded"
            reason = "和当前品牌配置相关性弱，先不进入候选池。"

        candidates.append(
            BrandCandidate(
                brand_name=brand_name,
                keyword=keyword,
                rank=item.rank,
                hot_value=item.hot_value,
                relevance_score=score,
                candidate_level=level,
                matched_rules=matched_rules,
                reason=reason,
            )
        )

    return candidates


def insert_brand_candidates(
    conn: sqlite3.Connection,
    run_id: int,
    candidates: list[BrandCandidate],
) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    conn.executemany(
        """
        INSERT INTO brand_hot_candidates (
          run_id, brand_name, keyword, rank_value, hot_value, relevance_score,
          candidate_level, matched_rules_json, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                run_id,
                candidate.brand_name,
                candidate.keyword,
                candidate.rank,
                candidate.hot_value,
                candidate.relevance_score,
                candidate.candidate_level,
                json.dumps(candidate.matched_rules, ensure_ascii=False),
                candidate.reason,
                created_at,
            )
            for candidate in candidates
        ],
    )
    conn.commit()


def write_brand_candidates_output(
    brand_config: dict[str, Any],
    candidates: list[BrandCandidate],
    output_dir: Path,
    stamp: str,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    brand_slug = slugify(brand_config.get("brand_name", "brand"))
    output_path = output_dir / f"{stamp}-{brand_slug}.json"
    selected = [asdict(item) for item in candidates if item.candidate_level == "selected"]
    watch = [asdict(item) for item in candidates if item.candidate_level == "watch"]
    discarded = [asdict(item) for item in candidates if item.candidate_level == "discarded"]
    output_path.write_text(
        json.dumps(
            {
                "brand_name": brand_config.get("brand_name"),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "selected_count": len(selected),
                "watch_count": len(watch),
                "discarded_count": len(discarded),
                "selected": selected,
                "watch": watch,
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


def print_summary(
    items: list[HotItem],
    normalized_path: Path,
    db_path: Path,
    candidates: list[BrandCandidate],
    candidates_path: Path | None,
) -> None:
    selected_count = sum(1 for item in candidates if item.candidate_level == "selected")
    watch_count = sum(1 for item in candidates if item.candidate_level == "watch")
    print(f"已采集抖音热榜 {len(items)} 条")
    print(f"标准化输出: {normalized_path}")
    print(f"数据库: {db_path}")
    if candidates_path is not None:
        print(f"品牌候选输出: {candidates_path}")
    print(f"品牌筛选: selected={selected_count}, watch={watch_count}")
    print("")
    print("Top 10:")
    for item in items[:10]:
        tag = f" [{item.sentence_tag}]" if item.sentence_tag else ""
        hot = f" 热度={item.hot_value}" if item.hot_value is not None else ""
        print(f"{item.rank}. {item.keyword}{tag}{hot}")
    if candidates:
        print("")
        print("品牌候选预览:")
        for candidate in [item for item in candidates if item.candidate_level != "discarded"][:10]:
            print(
                f"- {candidate.keyword} | {candidate.candidate_level} | "
                f"score={candidate.relevance_score} | {';'.join(candidate.matched_rules)}"
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="采集抖音热榜并执行品牌筛选")
    parser.add_argument("--timeout", type=int, default=20, help="请求超时秒数")
    parser.add_argument(
        "--raw-dir",
        default="data/raw/douyin_hot_search",
        help="原始数据输出目录",
    )
    parser.add_argument(
        "--normalized-dir",
        default="data/normalized/douyin_hot_search",
        help="标准化数据输出目录",
    )
    parser.add_argument(
        "--brand-candidates-dir",
        default="data/filtered/douyin_hot_search",
        help="品牌候选输出目录",
    )
    parser.add_argument(
        "--db-path",
        default="data/contentwork.db",
        help="SQLite 数据库路径",
    )
    parser.add_argument(
        "--brand-config",
        default="configs/brands/adidas_tuan_gou_douyin.json",
        help="品牌配置文件路径",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    fetched_at = datetime.now(timezone.utc).isoformat()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    try:
        payload = fetch_json(timeout=args.timeout)
    except HTTPError as exc:
        print(f"HTTP 错误: {exc.code}，切换浏览器态重试", file=sys.stderr)
        try:
            relogin_if_needed()
            payload = fetch_json_via_browser(timeout_ms=args.timeout * 1000)
        except Exception as browser_exc:
            print(f"浏览器态抓取失败: {browser_exc}", file=sys.stderr)
            return 1
    except URLError as exc:
        print(f"网络错误: {exc}，切换浏览器态重试", file=sys.stderr)
        try:
            relogin_if_needed()
            payload = fetch_json_via_browser(timeout_ms=args.timeout * 1000)
        except Exception as browser_exc:
            print(f"浏览器态抓取失败: {browser_exc}", file=sys.stderr)
            return 1
    except Exception as exc:
        print(f"未知错误: {exc}，切换浏览器态重试", file=sys.stderr)
        try:
            relogin_if_needed()
            payload = fetch_json_via_browser(timeout_ms=args.timeout * 1000)
        except Exception as browser_exc:
            print(f"浏览器态抓取失败: {browser_exc}", file=sys.stderr)
            return 1

    items = normalize_items(payload, fetched_at=fetched_at)
    if not items:
        print("未采集到抖音热榜条目", file=sys.stderr)
        return 1

    raw_path, normalized_path = write_outputs(
        payload=payload,
        items=items,
        raw_dir=Path(args.raw_dir),
        normalized_dir=Path(args.normalized_dir),
        stamp=stamp,
    )

    db_path = Path(args.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        ensure_schema(conn)
        run_id = insert_run(conn, items=items, raw_path=raw_path, normalized_path=normalized_path)
        brand_config = load_brand_config(Path(args.brand_config))
        candidates = filter_brand_candidates(items, brand_config=brand_config)
        insert_brand_candidates(conn, run_id=run_id, candidates=candidates)
    finally:
        conn.close()

    candidates_path = write_brand_candidates_output(
        brand_config=brand_config,
        candidates=candidates,
        output_dir=Path(args.brand_candidates_dir),
        stamp=stamp,
    )
    print_summary(items, normalized_path, db_path, candidates, candidates_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
