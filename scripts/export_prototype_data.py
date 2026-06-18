#!/usr/bin/env python3

from __future__ import annotations

import json
import sqlite3
from pathlib import Path


DB_PATH = Path("data/contentwork.db")
BRAND_CONFIG_PATH = Path("configs/brands/adidas_tuan_gou_douyin.json")
OUTPUT_PATH = Path("prototype/data.js")


def main() -> int:
    brand = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        payload = {
            "brand": build_brand(brand),
            "hotVideos": load_hot_videos(conn),
            "benchmarkVideos": load_benchmark_videos(conn, brand),
            "selections": load_selections(conn, brand),
            "confirmation": load_confirmation(conn, brand),
            "processingRows": load_processing_rows(conn),
            "scripts": load_scripts(conn),
            "collectionStrategy": load_collection_strategy(conn),
            "workflowOverview": load_workflow_overview(conn, payload_hint=None),
            "releaseReadiness": load_release_readiness(conn),
            "productVisionMap": load_product_vision_map(conn),
            "developmentBoard": load_development_board(conn),
            "meta": load_meta(conn),
        }
    finally:
        conn.close()

    OUTPUT_PATH.write_text(
        "window.CONTENTWORK_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"已导出原型真实数据: {OUTPUT_PATH}")
    print(
        f"hot={len(payload['hotVideos'])}, "
        f"benchmark={len(payload['benchmarkVideos'])}, "
        f"processing={len(payload['processingRows'])}, "
        f"scripts={len(payload['scripts'])}"
    )
    return 0


def build_brand(config: dict) -> dict:
    return {
        "name": config.get("brand_name", ""),
        "audience": config.get("target_audience", ""),
        "platform": config.get("primary_platform", ""),
        "duration": config.get("single_video_duration_seconds", 15),
        "tones": config.get("content_tone", []),
        "taboo": config.get("taboo_rules", []),
    }


def load_hot_videos(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT keyword, hot_value, rank_value, platform, fetched_at
        FROM hot_search_items
        WHERE run_id = (SELECT MAX(id) FROM hot_search_runs)
        ORDER BY rank_value ASC
        LIMIT 20
        """
    ).fetchall()
    return [
        {
            "id": f"hot-{index:02d}",
            "title": row["keyword"],
            "topic": infer_hot_topic(row["keyword"]),
            "score": score_hot(row["hot_value"], row["rank_value"]),
            "source": f"{row['platform']}热榜",
            "rank": row["rank_value"],
            "hotValue": row["hot_value"],
            "fetchedAt": row["fetched_at"],
            "real": True,
        }
        for index, row in enumerate(rows, start=1)
    ]


def load_benchmark_videos(conn: sqlite3.Connection, brand: dict) -> list[dict]:
    rows = conn.execute(
        """
        SELECT account_name, category, why_track, content_patterns_json
        FROM benchmark_accounts
        WHERE brand_name = ?
        ORDER BY id ASC
        """,
        (brand.get("brand_name", ""),),
    ).fetchall()

    items: list[dict] = []
    for row in rows:
        patterns = json.loads(row["content_patterns_json"] or "[]")
        for pattern in patterns:
            items.append(
                {
                    "id": f"bench-{len(items) + 1:02d}",
                    "account": row["account_name"],
                    "pattern": pattern,
                    "summary": row["why_track"],
                    "source": "固定对标账号池",
                    "real": True,
                }
            )
            if len(items) >= 10:
                return items
    return items


def load_processing_rows(conn: sqlite3.Connection) -> list[dict]:
    ensure_generation_tables(conn)
    rows = conn.execute(
        """
        SELECT source_type, title, summary_json, status
        FROM prototype_structure_summaries
        WHERE run_id = (SELECT MAX(id) FROM prototype_generation_runs)
        ORDER BY id ASC
        LIMIT 10
        """
    ).fetchall()
    if rows:
        return [
            {
                "label": "热点结构" if row["source_type"] == "hot" else "对标结构",
                "title": row["title"],
                "status": "waiting" if row["status"] == "metadata_ready" else "done",
                "summary": summarize_prototype_summary(row["summary_json"]),
                "generator": summarize_prototype_generator(row["summary_json"]),
                "real": True,
            }
            for row in rows
        ]

    rows = conn.execute(
        """
        SELECT benchmark_account, video_url, status, engine, source, structure_json, error
        FROM benchmark_video_subtitles
        ORDER BY id DESC
        LIMIT 10
        """
    ).fetchall()
    return [
        {
            "label": "对标视频",
            "title": row["benchmark_account"] or row["video_url"] or "未命名视频",
            "status": "done" if row["status"] == "ok" else "waiting",
            "summary": summarize_structure(row["structure_json"], row["error"]),
            "real": True,
        }
        for row in rows
    ]


def summarize_prototype_summary(raw: str) -> str:
    if not raw:
        return "待结构摘要"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return "结构摘要已入库"
    status_note = data.get("status_note") or "结构摘要已入库"
    angle = data.get("hook_angle") or data.get("script_pattern") or ""
    parts = data.get("usable_parts") or []
    suffix = f" / 可用: {'、'.join(parts[:3])}" if parts else ""
    return f"{status_note} / {angle}{suffix}"


def summarize_prototype_generator(raw: str) -> str:
    if not raw:
        return "unknown"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return "unknown"
    return data.get("generator") or "unknown"


def load_selections(conn: sqlite3.Connection, brand: dict) -> dict:
    ensure_selection_table(conn)
    rows = conn.execute(
        """
        SELECT source_type, source_id, selected, title, payload_json, updated_at
        FROM operator_video_selections
        WHERE brand_name = ?
        ORDER BY updated_at DESC
        """,
        (brand.get("brand_name", ""),),
    ).fetchall()

    selected_hot: list[str] = []
    selected_benchmark: list[str] = []
    items: list[dict] = []
    for row in rows:
        if row["selected"]:
            if row["source_type"] == "hot":
                selected_hot.append(row["source_id"])
            if row["source_type"] == "benchmark":
                selected_benchmark.append(row["source_id"])
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        items.append(
            {
                "sourceType": row["source_type"],
                "sourceId": row["source_id"],
                "title": row["title"],
                "payload": payload,
                "selected": bool(row["selected"]),
                "updatedAt": row["updated_at"],
            }
        )
    return {
        "selectedHot": selected_hot,
        "selectedBenchmark": selected_benchmark,
        "items": items,
    }


def load_confirmation(conn: sqlite3.Connection, brand: dict) -> dict | None:
    ensure_confirmation_table(conn)
    row = conn.execute(
        """
        SELECT id, selected_hot_json, selected_benchmark_json, created_at
        FROM operator_selection_confirmations
        WHERE brand_name = ? AND status = 'confirmed'
        ORDER BY id DESC
        LIMIT 1
        """,
        (brand.get("brand_name", ""),),
    ).fetchone()
    if not row:
        return None
    try:
        hot_items = json.loads(row["selected_hot_json"] or "[]")
        benchmark_items = json.loads(row["selected_benchmark_json"] or "[]")
    except json.JSONDecodeError:
        hot_items = []
        benchmark_items = []
    return {
        "id": row["id"],
        "hotCount": len(hot_items),
        "benchmarkCount": len(benchmark_items),
        "createdAt": row["created_at"],
        "hotTitles": [item.get("title", "") for item in hot_items],
        "benchmarkTitles": [item.get("title", "") for item in benchmark_items],
    }


def ensure_selection_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS operator_video_selections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          title TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          selected INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(brand_name, source_type, source_id)
        )
        """
    )
    conn.commit()


def ensure_generation_tables(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prototype_generation_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          selected_hot_json TEXT NOT NULL,
          selected_benchmark_json TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prototype_structure_summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          brand_name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          title TEXT NOT NULL,
          summary_json TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES prototype_generation_runs(id)
        )
        """
    )
    ensure_daily_script_candidates_run_id(conn)
    ensure_daily_script_candidates_v2_quality(conn)
    conn.commit()


def ensure_daily_script_candidates_run_id(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        """
        SELECT 1
        FROM pragma_table_info('daily_script_candidates')
        WHERE name = 'run_id'
        """
    ).fetchone()
    if not row:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN run_id INTEGER")


def ensure_daily_script_candidates_v2_quality(conn: sqlite3.Connection) -> None:
    existing = {
        row["name"]
        for row in conn.execute("SELECT name FROM pragma_table_info('daily_script_candidates')").fetchall()
    }
    if "quality_json" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN quality_json TEXT NOT NULL DEFAULT '{}'")
    if "input_structure_json" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN input_structure_json TEXT NOT NULL DEFAULT '[]'")
    if "input_product_json" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN input_product_json TEXT NOT NULL DEFAULT '[]'")
    if "input_template_json" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN input_template_json TEXT NOT NULL DEFAULT '[]'")
    if "input_feedback_json" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN input_feedback_json TEXT NOT NULL DEFAULT '[]'")
    if "input_topic_json" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN input_topic_json TEXT NOT NULL DEFAULT '[]'")
    if "quality_status" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN quality_status TEXT NOT NULL DEFAULT 'unscored'")
    if "review_status" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN review_status TEXT NOT NULL DEFAULT 'new'")
    if "review_note" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN review_note TEXT NOT NULL DEFAULT ''")
    if "rewrite_count" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN rewrite_count INTEGER NOT NULL DEFAULT 0")
    if "parent_script_id" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN parent_script_id INTEGER")
    if "publish_url" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN publish_url TEXT NOT NULL DEFAULT ''")
    if "published_at" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN published_at TEXT NOT NULL DEFAULT ''")
    if "performance_json" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN performance_json TEXT NOT NULL DEFAULT '{}'")
    if "is_template" not in existing:
        conn.execute("ALTER TABLE daily_script_candidates ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0")


def ensure_confirmation_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS operator_selection_confirmations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          selected_hot_json TEXT NOT NULL,
          selected_benchmark_json TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()


def load_scripts(conn: sqlite3.Connection) -> list[dict]:
    ensure_generation_tables(conn)
    latest_run = conn.execute("SELECT MAX(id) AS id FROM prototype_generation_runs").fetchone()
    latest_run_id = latest_run["id"] if latest_run else None
    if latest_run_id:
        rows = conn.execute(
            """
            SELECT id, title, hook, outline, source_trend_keyword, source_benchmark_account,
                   source_pattern, fit_reason, risk_notes, candidate_level,
                   quality_json, input_structure_json, input_product_json,
                   input_template_json, input_feedback_json, input_topic_json, quality_status, review_status, review_note, rewrite_count,
                   parent_script_id
            FROM daily_script_candidates
            WHERE run_id = ?
              AND candidate_level IN ('codex_cli', 'prototype_real_data', 'rewrite_rule_v1', 'codex_rewrite_v1')
            ORDER BY
              CASE WHEN quality_json LIKE '%"diagnosis"%' THEN 0 ELSE 1 END,
              id DESC
            LIMIT 30
            """,
            (latest_run_id,),
        ).fetchall()
        return [serialize_script_row(row) for row in rows]

    rows = conn.execute(
        """
        SELECT id, title, hook, outline, source_trend_keyword, source_benchmark_account,
               source_pattern, fit_reason, risk_notes, candidate_level,
               quality_json, input_structure_json, input_product_json,
               input_template_json, input_feedback_json, input_topic_json, quality_status, review_status, review_note, rewrite_count,
               parent_script_id
        FROM daily_script_candidates
        WHERE candidate_level IN ('codex_cli', 'prototype_real_data', 'rewrite_rule_v1', 'codex_rewrite_v1')
        ORDER BY
          CASE WHEN quality_json LIKE '%"diagnosis"%' THEN 0 ELSE 1 END,
          id DESC
        LIMIT 30
        """
    ).fetchall()
    if rows:
        return [serialize_script_row(row) for row in rows]

    manual_files = sorted(Path("data/generated/manual_script_library").glob("*.json"))
    if not manual_files:
        return []
    data = json.loads(manual_files[-1].read_text(encoding="utf-8"))
    return [
        {
            "title": item["title"],
            "hook": item["hook"],
            "hot": item["source_basis"]["trend"],
            "account": "手动综合",
            "pattern": item["source_basis"]["benchmark_pattern"],
            "fit": item["fit_reason"],
            "risk": item["risk_notes"],
            "real": True,
        }
        for item in data.get("items", [])
    ]


def serialize_script_row(row: sqlite3.Row) -> dict:
    try:
        quality = json.loads(row["quality_json"] or "{}")
    except (KeyError, json.JSONDecodeError):
        quality = {}
    try:
        input_structures = json.loads(row["input_structure_json"] or "[]")
    except (KeyError, json.JSONDecodeError):
        input_structures = []
    try:
        input_products = json.loads(row["input_product_json"] or "[]")
    except (KeyError, json.JSONDecodeError):
        input_products = []
    try:
        input_templates = json.loads(row["input_template_json"] or "[]")
    except (KeyError, json.JSONDecodeError):
        input_templates = []
    try:
        input_feedback = json.loads(row["input_feedback_json"] or "[]")
    except (KeyError, json.JSONDecodeError):
        input_feedback = []
    try:
        input_topics = json.loads(row["input_topic_json"] or "[]")
    except (KeyError, json.JSONDecodeError):
        input_topics = []
    return {
        "title": row["title"],
        "id": row["id"],
        "hook": row["hook"],
        "outline": row["outline"],
        "hot": row["source_trend_keyword"],
        "account": row["source_benchmark_account"],
        "pattern": row["source_pattern"],
        "fit": row["fit_reason"],
        "risk": row["risk_notes"],
        "shooting_notes": ["竖屏拍摄", "前3秒必须出现热点词", "商品露出不要超过真实活动承诺", "发布前复核价格和门店权益"],
        "generator": row["candidate_level"],
        "quality": quality,
        "inputStructures": input_structures,
        "inputProducts": input_products,
        "inputTemplates": input_templates,
        "inputFeedback": input_feedback,
        "inputTopics": input_topics,
        "qualityStatus": row["quality_status"],
        "reviewStatus": row["review_status"],
        "reviewNote": row["review_note"],
        "rewriteCount": row["rewrite_count"],
        "parentScriptId": row["parent_script_id"],
        "real": True,
    }


def load_collection_strategy(conn: sqlite3.Connection) -> dict:
    try:
        import scripts.prototype_api_server as api_server
    except Exception:
        try:
            import prototype_api_server as api_server
        except Exception:
            return {}
    brand = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
    brand_name = brand.get("brand_name", "")
    try:
        api_server.ensure_default_collection_schedules(conn, brand_name)
        schedule_rows = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, schedule_time,
                   queries, enabled, owner, fallback_action, note, created_at, updated_at
            FROM collection_schedules
            WHERE brand_name = ?
            ORDER BY schedule_time, id
            """,
            (brand_name,),
        ).fetchall()
        schedules = [api_server.serialize_collection_schedule(row) for row in schedule_rows]
        latest_tasks = api_server.latest_collection_tasks_by_strategy(conn, brand_name)
        hot_run = latest_hot_run_for_export(conn)
        return api_server.collection_strategy_snapshot(schedules, latest_tasks, hot_run)
    except Exception:
        return {}


def load_workflow_overview(conn: sqlite3.Connection, payload_hint: dict | None = None) -> dict:
    try:
        import scripts.prototype_api_server as api_server
    except Exception:
        try:
            import prototype_api_server as api_server
        except Exception:
            return {}
    try:
        brand = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
        brand_name = brand.get("brand_name", "")
        scripts = load_scripts(conn)
        collection_strategy = load_collection_strategy(conn)
        stats = {
            "scripts": len(scripts),
            "selectedBrandProducts": conn.execute(
                "SELECT COUNT(*) FROM brand_products WHERE brand_name = ? AND selected = 1",
                (brand_name,),
            ).fetchone()[0],
        }
        workflow = {
            "hotCount": 0,
            "benchmarkCount": 0,
            "structuredManualSourceCount": 0,
            "selectedProductCount": stats["selectedBrandProducts"],
            "adoptedTopics": [],
            "adoptedTopicCount": 0,
        }
        readiness = {
            "ready": bool(stats["scripts"] or stats["selectedBrandProducts"]),
            "nextAction": "打开脚本流程确认素材",
            "generateUrl": "./index.html?v=workflow-overview-v1#stepGenerate",
        }
        review_insights = {
            "publishedCount": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND publish_url != ''",
                (brand_name,),
            ).fetchone()[0],
            "templateCount": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND is_template = 1",
                (brand_name,),
            ).fetchone()[0],
        }
        return api_server.build_workflow_overview(stats, workflow, readiness, collection_strategy, [], review_insights)
    except Exception:
        return {}


def load_release_readiness(conn: sqlite3.Connection) -> dict:
    try:
        import scripts.prototype_api_server as api_server
    except Exception:
        try:
            import prototype_api_server as api_server
        except Exception:
            return {}
    try:
        brand = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
        brand_name = brand.get("brand_name", "")
        workday_date = api_server.utc_now()[:10]
        scripts = load_scripts(conn)
        collection_strategy = load_collection_strategy(conn)
        stats = {
            "subtitleRows": conn.execute(
                "SELECT COUNT(*) FROM benchmark_video_subtitles",
            ).fetchone()[0],
            "subtitleJobs": conn.execute(
                "SELECT COUNT(*) FROM subtitle_jobs WHERE brand_name = ?",
                (brand_name,),
            ).fetchone()[0],
            "successfulSubtitleJobs": conn.execute(
                "SELECT COUNT(*) FROM subtitle_jobs WHERE brand_name = ? AND status = 'success'",
                (brand_name,),
            ).fetchone()[0],
            "scripts": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND substr(created_at, 1, 10) = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "newScripts": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'new' AND substr(created_at, 1, 10) = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "contentSources": conn.execute(
                "SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND workday_date = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "selectedContentSources": conn.execute(
                "SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND selected = 1 AND workday_date = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "contentStructures": conn.execute(
                """
                SELECT COUNT(*)
                FROM content_structures cst
                JOIN content_sources cs ON cs.id = cst.source_id
                WHERE cst.brand_name = ? AND cs.workday_date = ?
                """,
                (brand_name, workday_date),
            ).fetchone()[0],
            "selectedBrandProducts": conn.execute(
                "SELECT COUNT(*) FROM brand_products WHERE brand_name = ? AND selected = 1",
                (brand_name,),
            ).fetchone()[0],
            "failedCollectionTasks": conn.execute(
                "SELECT COUNT(*) FROM collection_tasks WHERE brand_name = ? AND status = 'failed' AND substr(created_at, 1, 10) = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "benchmarkUpdateTasks": api_server.benchmark_update_tasks_snapshot(conn, brand_name, workday_date),
        }
        history_stats = {
            "benchmarkAccounts": conn.execute(
                "SELECT COUNT(*) FROM benchmark_accounts WHERE brand_name = ?",
                (brand_name,),
            ).fetchone()[0],
            "scripts": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ?",
                (brand_name,),
            ).fetchone()[0],
        }
        workflow_overview = load_workflow_overview(conn)
        readiness = {
            "ready": bool(stats["scripts"] or stats["selectedBrandProducts"]),
            "summary": "静态导出快照：可查看生成准备状态",
            "nextAction": "打开脚本流程确认素材",
            "generateUrl": "./index.html?v=release-readiness-v1#stepGenerate",
        }
        review_insights = {
            "publishedCount": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND publish_url != ''",
                (brand_name,),
            ).fetchone()[0],
            "templateCount": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND is_template = 1",
                (brand_name,),
            ).fetchone()[0],
        }
        review_queue = scripts[:8]
        return api_server.build_release_readiness(
            stats,
            history_stats,
            workflow_overview,
            readiness,
            collection_strategy,
            review_insights,
            review_queue,
        )
    except Exception:
        return {}


def load_product_vision_map(conn: sqlite3.Connection) -> dict:
    try:
        import scripts.prototype_api_server as api_server
    except Exception:
        try:
            import prototype_api_server as api_server
        except Exception:
            return {}
    try:
        brand = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
        brand_name = brand.get("brand_name", "")
        workday_date = api_server.utc_now()[:10]
        stats = {
            "hotItems": conn.execute("SELECT COUNT(*) FROM hot_search_items").fetchone()[0],
            "scripts": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND substr(created_at, 1, 10) = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "contentSources": conn.execute(
                "SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND workday_date = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "selectedContentSources": conn.execute(
                "SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND selected = 1 AND workday_date = ?",
                (brand_name, workday_date),
            ).fetchone()[0],
            "contentStructures": conn.execute(
                """
                SELECT COUNT(*)
                FROM content_structures cst
                JOIN content_sources cs ON cs.id = cst.source_id
                WHERE cst.brand_name = ? AND cs.workday_date = ?
                """,
                (brand_name, workday_date),
            ).fetchone()[0],
            "selectedBrandProducts": conn.execute(
                "SELECT COUNT(*) FROM brand_products WHERE brand_name = ? AND selected = 1",
                (brand_name,),
            ).fetchone()[0],
        }
        history_stats = {
            "hotItems": stats["hotItems"],
            "scripts": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ?",
                (brand_name,),
            ).fetchone()[0],
            "contentSources": conn.execute(
                "SELECT COUNT(*) FROM content_sources WHERE brand_name = ?",
                (brand_name,),
            ).fetchone()[0],
        }
        collection_strategy = load_collection_strategy(conn)
        workflow_overview = load_workflow_overview(conn)
        release_readiness = load_release_readiness(conn)
        readiness = {
            "ready": bool(stats["scripts"] or stats["selectedBrandProducts"]),
            "summary": "静态导出快照：可查看生成准备状态",
            "nextAction": "打开脚本流程确认素材",
            "generateUrl": "./index.html?v=product-vision-map-v1#stepGenerate",
        }
        review_insights = {
            "publishedCount": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND publish_url != ''",
                (brand_name,),
            ).fetchone()[0],
            "templateCount": conn.execute(
                "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND is_template = 1",
                (brand_name,),
            ).fetchone()[0],
        }
        return api_server.build_product_vision_map(
            stats,
            history_stats,
            workflow_overview,
            readiness,
            collection_strategy,
            review_insights,
            release_readiness,
        )
    except Exception:
        return {}


def load_development_board(conn: sqlite3.Connection) -> dict:
    try:
        import scripts.prototype_api_server as api_server
    except Exception:
        try:
            import prototype_api_server as api_server
        except Exception:
            return {}
    try:
        release_readiness = load_release_readiness(conn)
        product_vision_map = load_product_vision_map(conn)
        workflow_overview = load_workflow_overview(conn)
        collection_fallback_desk = {}
        return api_server.build_development_board(
            release_readiness,
            product_vision_map,
            workflow_overview,
            collection_fallback_desk,
        )
    except Exception:
        return {}


def latest_hot_run_for_export(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute(
        """
        SELECT fetched_at, item_count
        FROM hot_search_runs
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        return None
    return {"fetchedAt": row["fetched_at"], "itemCount": row["item_count"]}


def load_meta(conn: sqlite3.Connection) -> dict:
    run = conn.execute(
        """
        SELECT fetched_at, item_count
        FROM hot_search_runs
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()
    return {
        "hotRunFetchedAt": run["fetched_at"] if run else "",
        "hotRunItemCount": run["item_count"] if run else 0,
        "dataMode": "real_export",
    }


def infer_hot_topic(keyword: str) -> str:
    if any(term in keyword for term in ["夏天", "Seawalk", "演唱会"]):
        return "场景穿搭";
    if any(term in keyword for term in ["哈兰德", "足球", "运动"]):
        return "运动热点";
    if any(term in keyword for term in ["打卡", "本地", "商场"]):
        return "本地转化";
    if "高考" in keyword:
        return "节点热点";
    return "热点观察";


def score_hot(hot_value: int | None, rank: int | None) -> int:
    base = 100 - min((rank or 50), 50)
    if hot_value and hot_value > 10_000_000:
        base += 5
    return max(50, min(98, base))


def summarize_structure(raw: str, error: str) -> str:
    if error:
        return error[:120]
    if not raw:
        return "待提取字幕和结构摘要"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return "结构摘要已入库"
    pattern = data.get("suggested_script_pattern") or "结构摘要已入库"
    opening = data.get("opening_lines") or []
    return f"{pattern} / 开头{len(opening)}句"


if __name__ == "__main__":
    raise SystemExit(main())
