#!/usr/bin/env python3

from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import subprocess
import tempfile
import time
import uuid
import shutil
import base64
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


DB_PATH = Path("data/contentwork.db")
BRAND_CONFIG_PATH = Path("configs/brands/adidas_tuan_gou_douyin.json")
HOST = "127.0.0.1"
PORT = 8771
USE_CODEX_CLI = True
IMAGE_OUTPUT_DIR = Path("prototype/generated")
DEFAULT_CODEX_BIN = os.environ.get("CODEX_BIN", "codex")
SIMPLE_AGENT_RUNTIME_ENV = (
    os.environ.get("SIMPLE_AGENT_RUNTIME_ENV")
    or os.environ.get("APP_ENV")
    or os.environ.get("ENVIRONMENT")
    or "development"
).strip().lower()
SIMPLE_AGENT_IS_PRODUCTION = SIMPLE_AGENT_RUNTIME_ENV in {"prod", "production", "server", "release"}
DEFAULT_SIMPLE_AGENT_GENERATOR = "image2svc_chat" if SIMPLE_AGENT_IS_PRODUCTION else "codex_cli"
SIMPLE_AGENT_GENERATOR = os.environ.get("SIMPLE_AGENT_GENERATOR", DEFAULT_SIMPLE_AGENT_GENERATOR).strip().lower() or DEFAULT_SIMPLE_AGENT_GENERATOR
SIMPLE_AGENT_PROMPT_VERSION = os.environ.get("SIMPLE_AGENT_PROMPT_VERSION", "simple-script-prompt-v2").strip() or "simple-script-prompt-v2"
SIMPLE_AGENT_CODEX_SERVICE_URL = os.environ.get("SIMPLE_AGENT_CODEX_SERVICE_URL", "").strip()
SIMPLE_AGENT_CODEX_SERVICE_PROVIDER = os.environ.get("SIMPLE_AGENT_CODEX_SERVICE_PROVIDER", "codex_cli").strip() or "codex_cli"
IMAGE2SVC_CHAT_URL = os.environ.get("IMAGE2SVC_CHAT_URL", os.environ.get("SIMPLE_AGENT_CHAT_SERVICE_URL", "http://127.0.0.1:9528")).strip()
IMAGE2SVC_CHAT_PROVIDER = os.environ.get("IMAGE2SVC_CHAT_PROVIDER", "openai").strip() or "openai"
IMAGE2SVC_IMAGE_URL = os.environ.get("IMAGE2SVC_IMAGE_URL", "http://127.0.0.1:9527").strip()
DEFAULT_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2")
IMAGE2SVC_IMAGE_PROVIDER = os.environ.get("IMAGE2SVC_IMAGE_PROVIDER", "zz_api").strip() or "zz_api"
DEFAULT_SIMPLE_AGENT_IMAGE_BACKEND = "image2svc" if SIMPLE_AGENT_IS_PRODUCTION else "openai"
SIMPLE_AGENT_IMAGE_BACKEND = os.environ.get("SIMPLE_AGENT_IMAGE_BACKEND", DEFAULT_SIMPLE_AGENT_IMAGE_BACKEND).strip().lower() or DEFAULT_SIMPLE_AGENT_IMAGE_BACKEND
VIDEO_TOOLS_API_BASE = os.environ.get("VIDEO_TOOLS_API_BASE", "http://127.0.0.1:8000")
USE_EMBEDDED_VIDEO_ENGINE = os.environ.get("USE_EMBEDDED_VIDEO_ENGINE", "1").lower() not in {"0", "false", "no"}
DEFAULT_SUBTITLE_ENGINE = os.environ.get("SUBTITLE_ENGINE", "auto")
SIMPLE_AGENT_VIDEO_DIR = Path("data/simple_agent_videos")
OPENAI_IMAGES_GENERATIONS_URL = "https://api.openai.com/v1/images/generations"
OPENAI_IMAGES_EDITS_URL = "https://api.openai.com/v1/images/edits"
CONTENT_SOURCE_PLATFORMS = {"douyin", "xhs", "manual", "third_party"}
CONTENT_SOURCE_TYPES = {"benchmark_video", "hot_video", "manual_note", "third_party_row"}
CONTENT_SOURCE_FIELD_ALIASES = {
    "title": {
        "title",
        "标题",
        "视频标题",
        "笔记标题",
        "内容标题",
        "话题",
        "选题",
        "名称",
    },
    "url": {
        "url",
        "link",
        "链接",
        "视频链接",
        "笔记链接",
        "作品链接",
        "内容链接",
        "地址",
    },
    "accountName": {
        "account",
        "account_name",
        "accountname",
        "账号",
        "账号名",
        "达人",
        "作者",
        "博主",
        "来源账号",
        "来源",
    },
    "platform": {
        "platform",
        "平台",
        "渠道",
        "来源平台",
    },
    "rawText": {
        "rawtext",
        "raw_text",
        "content",
        "subtitle",
        "subtitles",
        "transcript",
        "transcript_text",
        "asr_text",
        "ocr_text",
        "字幕",
        "字幕文本",
        "字幕结果",
        "字幕提取结果",
        "转写文本",
        "转录文本",
        "识别文本",
        "asr结果",
        "ocr结果",
        "正文",
        "内容",
        "笔记正文",
        "视频文案",
        "口播",
    },
    "note": {
        "note",
        "备注",
        "说明",
        "理由",
        "推荐理由",
        "数据",
        "热度",
        "互动",
    },
    "sourceType": {
        "sourcetype",
        "source_type",
        "类型",
        "素材类型",
        "内容类型",
    },
}
CONTENT_IMPORT_RISK_TERMS = ["全网最低", "保证", "必火", "稳赚", "医疗", "处方", "高考", "彩票", "政治", "灾害"]
UA_MOBILE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/16.0 Mobile/15E148 Safari/604.1"
)

try:
    from simple_video_engine.asr_subtitle import ASRSubtitleExtractor
    from simple_video_engine.platform_router import PlatformRouter

    EMBEDDED_VIDEO_PARSER = PlatformRouter()
    EMBEDDED_VIDEO_ENGINE_ERROR = ""
except Exception as exc:
    ASRSubtitleExtractor = None
    EMBEDDED_VIDEO_PARSER = None
    EMBEDDED_VIDEO_ENGINE_ERROR = str(exc)


class ApiError(Exception):
    def __init__(self, status: int, message: str, details: object | None = None):
        self.status = status
        self.message = message
        self.details = details
        super().__init__(message)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_workday_date() -> str:
    return utc_now()[:10]


def created_on_workday_clause(column: str = "created_at") -> str:
    return f"substr({column}, 1, 10) = ?"


def load_brand_name() -> str:
    if not BRAND_CONFIG_PATH.exists():
        return ""
    data = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
    return data.get("brand_name", "")


def load_brand_config() -> dict:
    if not BRAND_CONFIG_PATH.exists():
        return {}
    return json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS workdays (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          work_date TEXT NOT NULL,
          status TEXT NOT NULL,
          note TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(brand_name, work_date)
        )
        """
    )
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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS content_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workday_date TEXT NOT NULL,
          brand_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          source_type TEXT NOT NULL,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          account_name TEXT NOT NULL,
          raw_text TEXT NOT NULL,
          note TEXT NOT NULL,
          import_method TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS content_structures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id INTEGER NOT NULL,
          brand_name TEXT NOT NULL,
          structure_json TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (source_id) REFERENCES content_sources(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS benchmark_update_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workday_date TEXT NOT NULL,
          brand_name TEXT NOT NULL,
          account_id INTEGER NOT NULL,
          platform TEXT NOT NULL,
          account_name TEXT NOT NULL,
          account_handle TEXT NOT NULL,
          target_count INTEGER NOT NULL,
          status TEXT NOT NULL,
          note TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(workday_date, brand_name, account_id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS subtitle_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id INTEGER NOT NULL,
          brand_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          video_url TEXT NOT NULL,
          engine TEXT NOT NULL,
          status TEXT NOT NULL,
          request_json TEXT NOT NULL,
          response_json TEXT NOT NULL,
          text TEXT NOT NULL,
          segments_json TEXT NOT NULL,
          error TEXT NOT NULL,
          fallback_action TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS brand_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          product_name TEXT NOT NULL,
          product_group TEXT NOT NULL,
          selling_points_json TEXT NOT NULL,
          activity_rules TEXT NOT NULL,
          price_note TEXT NOT NULL,
          store_scope TEXT NOT NULL,
          valid_from TEXT NOT NULL,
          valid_to TEXT NOT NULL,
          status TEXT NOT NULL,
          selected INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS collection_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          task_type TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          strategy TEXT NOT NULL,
          status TEXT NOT NULL,
          command TEXT NOT NULL,
          output_json TEXT NOT NULL,
          error TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS collection_schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          task_type TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          strategy TEXT NOT NULL,
          schedule_time TEXT NOT NULL,
          queries TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          owner TEXT NOT NULL,
          fallback_action TEXT NOT NULL,
          note TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(brand_name, task_type, strategy)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS operation_handoffs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          workday_date TEXT NOT NULL,
          source TEXT NOT NULL,
          status TEXT NOT NULL,
          summary TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          note TEXT NOT NULL,
          owner TEXT NOT NULL DEFAULT '运营',
          process_status TEXT NOT NULL DEFAULT 'pending',
          process_note TEXT NOT NULL DEFAULT '',
          processed_at TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS trend_marks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          keyword TEXT NOT NULL,
          usage_status TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          note TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(brand_name, platform, keyword)
        )
        """
    )
    ensure_content_sources_selected(conn)
    ensure_content_sources_benchmark_task(conn)
    ensure_daily_script_candidates_run_id(conn)
    ensure_daily_script_candidates_v2_quality(conn)
    ensure_operation_handoffs_process_fields(conn)
    ensure_simple_agent_schema(conn)
    conn.commit()


def ensure_content_sources_selected(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        """
        SELECT 1
        FROM pragma_table_info('content_sources')
        WHERE name = 'selected'
        """
    ).fetchone()
    if not row:
        conn.execute("ALTER TABLE content_sources ADD COLUMN selected INTEGER NOT NULL DEFAULT 0")


def ensure_content_sources_benchmark_task(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        """
        SELECT 1
        FROM pragma_table_info('content_sources')
        WHERE name = 'benchmark_update_task_id'
        """
    ).fetchone()
    if not row:
        conn.execute("ALTER TABLE content_sources ADD COLUMN benchmark_update_task_id INTEGER")


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


def ensure_operation_handoffs_process_fields(conn: sqlite3.Connection) -> None:
    existing = {
        row["name"]
        for row in conn.execute("SELECT name FROM pragma_table_info('operation_handoffs')").fetchall()
    }
    if "owner" not in existing:
        conn.execute("ALTER TABLE operation_handoffs ADD COLUMN owner TEXT NOT NULL DEFAULT '运营'")
    if "process_status" not in existing:
        conn.execute("ALTER TABLE operation_handoffs ADD COLUMN process_status TEXT NOT NULL DEFAULT 'pending'")
    if "process_note" not in existing:
        conn.execute("ALTER TABLE operation_handoffs ADD COLUMN process_note TEXT NOT NULL DEFAULT ''")
    if "processed_at" not in existing:
        conn.execute("ALTER TABLE operation_handoffs ADD COLUMN processed_at TEXT NOT NULL DEFAULT ''")


def ensure_simple_agent_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_agent_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_agent_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES simple_agent_users(id)
        )
        """
    )
    admin_username = os.environ.get("SIMPLE_AGENT_ADMIN_USER", "admin")
    admin_password = os.environ.get("SIMPLE_AGENT_ADMIN_PASSWORD", "admin2026")
    ensure_simple_agent_user(conn, admin_username, admin_password, "V1 内测管理员", "admin")
    for index in range(1, 6):
        ensure_simple_agent_user(conn, f"test{index}", f"test{index}", f"内测账号 test{index}", "user")
    admin_row = conn.execute("SELECT id FROM simple_agent_users WHERE username = ?", (admin_username,)).fetchone()
    admin_user_id = int(admin_row["id"]) if admin_row else 1
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_video_materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          platform TEXT NOT NULL,
          url TEXT NOT NULL,
          account_name TEXT NOT NULL,
          material_type TEXT NOT NULL,
          category TEXT NOT NULL,
          tags_json TEXT NOT NULL,
          raw_text TEXT NOT NULL,
          note TEXT NOT NULL,
          source_method TEXT NOT NULL,
          learning_summary_json TEXT NOT NULL,
          processing_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL,
          selected INTEGER NOT NULL DEFAULT 0,
          use_count INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    existing_material_columns = {
        row["name"]
        for row in conn.execute("SELECT name FROM pragma_table_info('simple_video_materials')").fetchall()
    }
    if "processing_json" not in existing_material_columns:
        conn.execute("ALTER TABLE simple_video_materials ADD COLUMN processing_json TEXT NOT NULL DEFAULT '{}'")
    if "owner_user_id" not in existing_material_columns:
        conn.execute("ALTER TABLE simple_video_materials ADD COLUMN owner_user_id INTEGER")
        conn.execute("UPDATE simple_video_materials SET owner_user_id = ? WHERE owner_user_id IS NULL", (admin_user_id,))
    rows_needing_original_url = conn.execute(
        """
        SELECT id, url, processing_json
        FROM simple_video_materials
        WHERE url != ''
        """
    ).fetchall()
    for material_row in rows_needing_original_url:
        processing = json_loads_fallback(material_row["processing_json"], {})
        if not isinstance(processing, dict):
            processing = {}
        if not processing.get("sourceOriginalUrl"):
            processing["sourceOriginalUrl"] = material_row["url"]
            processing.setdefault("normalizedUrl", material_row["url"])
            conn.execute(
                "UPDATE simple_video_materials SET processing_json = ? WHERE id = ?",
                (json.dumps(processing, ensure_ascii=False, separators=(",", ":")), material_row["id"]),
            )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_reference_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          account_name TEXT NOT NULL,
          account_url TEXT NOT NULL,
          category TEXT NOT NULL,
          why_track TEXT NOT NULL,
          patterns_json TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    existing_account_columns = {
        row["name"]
        for row in conn.execute("SELECT name FROM pragma_table_info('simple_reference_accounts')").fetchall()
    }
    if "owner_user_id" not in existing_account_columns:
        conn.execute("ALTER TABLE simple_reference_accounts ADD COLUMN owner_user_id INTEGER")
        conn.execute("UPDATE simple_reference_accounts SET owner_user_id = ? WHERE owner_user_id IS NULL", (admin_user_id,))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_brand_campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_name TEXT NOT NULL,
          campaign_name TEXT NOT NULL,
          product_name TEXT NOT NULL,
          selling_points_json TEXT NOT NULL,
          activity_rules TEXT NOT NULL,
          price_note TEXT NOT NULL,
          channel_scope TEXT NOT NULL,
          valid_from TEXT NOT NULL,
          valid_to TEXT NOT NULL,
          status TEXT NOT NULL,
          selected INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    existing_campaign_columns = {
        row["name"]
        for row in conn.execute("SELECT name FROM pragma_table_info('simple_brand_campaigns')").fetchall()
    }
    if "owner_user_id" not in existing_campaign_columns:
        conn.execute("ALTER TABLE simple_brand_campaigns ADD COLUMN owner_user_id INTEGER")
        conn.execute("UPDATE simple_brand_campaigns SET owner_user_id = ? WHERE owner_user_id IS NULL", (admin_user_id,))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_script_format_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          platform TEXT NOT NULL,
          structure_json TEXT NOT NULL,
          output_style TEXT NOT NULL,
          status TEXT NOT NULL,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_generation_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic TEXT NOT NULL,
          target_count INTEGER NOT NULL,
          quality_level TEXT NOT NULL,
          output_mode TEXT NOT NULL,
          campaign_ids_json TEXT NOT NULL,
          material_ids_json TEXT NOT NULL,
          template_id INTEGER,
          quality_rules_json TEXT NOT NULL,
          input_snapshot_json TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )
    existing_generation_job_columns = {
        row["name"]
        for row in conn.execute("SELECT name FROM pragma_table_info('simple_generation_jobs')").fetchall()
    }
    if "owner_user_id" not in existing_generation_job_columns:
        conn.execute("ALTER TABLE simple_generation_jobs ADD COLUMN owner_user_id INTEGER")
        conn.execute("UPDATE simple_generation_jobs SET owner_user_id = ? WHERE owner_user_id IS NULL", (admin_user_id,))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_generation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          owner_user_id INTEGER,
          prompt_version TEXT NOT NULL,
          generator TEXT NOT NULL,
          provider TEXT NOT NULL,
          status TEXT NOT NULL,
          request_snapshot_json TEXT NOT NULL,
          rendered_prompt TEXT NOT NULL,
          raw_response_text TEXT NOT NULL,
          latency_ms INTEGER NOT NULL DEFAULT 0,
          error TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (job_id) REFERENCES simple_generation_jobs(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS simple_script_outputs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          hook TEXT NOT NULL,
          script_body TEXT NOT NULL,
          output_json TEXT NOT NULL,
          quality_score INTEGER NOT NULL,
          quality_notes TEXT NOT NULL,
          review_status TEXT NOT NULL,
          review_note TEXT NOT NULL,
          is_quality_sample INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (job_id) REFERENCES simple_generation_jobs(id)
        )
        """
    )
    existing_script_output_columns = {
        row["name"]
        for row in conn.execute("SELECT name FROM pragma_table_info('simple_script_outputs')").fetchall()
    }
    if "feishu_record_id" not in existing_script_output_columns:
        conn.execute("ALTER TABLE simple_script_outputs ADD COLUMN feishu_record_id TEXT NOT NULL DEFAULT ''")
    if "feishu_sync_status" not in existing_script_output_columns:
        conn.execute("ALTER TABLE simple_script_outputs ADD COLUMN feishu_sync_status TEXT NOT NULL DEFAULT ''")
    if "feishu_sync_error" not in existing_script_output_columns:
        conn.execute("ALTER TABLE simple_script_outputs ADD COLUMN feishu_sync_error TEXT NOT NULL DEFAULT ''")
    if "feishu_synced_at" not in existing_script_output_columns:
        conn.execute("ALTER TABLE simple_script_outputs ADD COLUMN feishu_synced_at TEXT NOT NULL DEFAULT ''")
    existing_template = conn.execute("SELECT id FROM simple_script_format_templates LIMIT 1").fetchone()
    if not existing_template:
        now = utc_now()
        conn.execute(
            """
            INSERT INTO simple_script_format_templates (
              name, platform, structure_json, output_style, status, is_default,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "15秒四段式短视频脚本",
                "douyin",
                json.dumps(
                    [
                        {"time": "0-3s", "label": "开头钩子", "requirement": "用主题或痛点抓注意力"},
                        {"time": "3-8s", "label": "场景展开", "requirement": "接入素材结构或真实使用场景"},
                        {"time": "8-12s", "label": "商品利益点", "requirement": "读取商品卖点和活动规则"},
                        {"time": "12-15s", "label": "行动引导", "requirement": "给出合规 CTA"},
                    ],
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                "分镜 + 口播 + 字幕 + CTA",
                "active",
                1,
                now,
                now,
            ),
        )


def serialize_selection(row: sqlite3.Row) -> dict:
    try:
        payload = json.loads(row["payload_json"] or "{}")
    except json.JSONDecodeError:
        payload = {}
    return {
        "brandName": row["brand_name"],
        "sourceType": row["source_type"],
        "sourceId": row["source_id"],
        "title": row["title"],
        "payload": payload,
        "selected": bool(row["selected"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "owner": simple_agent_user_brief(row),
    }


def list_selections() -> list[dict]:
    brand_name = load_brand_name()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT brand_name, source_type, source_id, title, payload_json,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM operator_video_selections
            WHERE brand_name = ?
            ORDER BY updated_at DESC
            """,
            (brand_name,),
        ).fetchall()
    return [serialize_selection(row) for row in rows]


def scalar_count(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    row = conn.execute(sql, params).fetchone()
    return int(row[0] or 0) if row else 0


def parse_simple_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[,，、\n]", value) if item.strip()]
    return []


SIMPLE_SHARE_URL_RE = re.compile(r"https?://[^\s<>'\"，。！？；、]+", re.IGNORECASE)
DOUYIN_MODAL_ID_RE = re.compile(r"[?&]modal_id=(\d{15,20})")
DOUYIN_VIDEO_ID_RE = re.compile(r"/video/(\d{15,20})")


def normalize_simple_video_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    lower = raw.lower()
    if "douyin.com" in lower or "iesdouyin.com" in lower:
        modal_match = DOUYIN_MODAL_ID_RE.search(raw)
        if modal_match:
            return f"https://www.iesdouyin.com/share/video/{modal_match.group(1)}/"
        video_match = DOUYIN_VIDEO_ID_RE.search(raw)
        if video_match and "/share/video/" not in lower:
            return f"https://www.iesdouyin.com/share/video/{video_match.group(1)}/"
    return raw


def extract_first_url(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    match = SIMPLE_SHARE_URL_RE.search(raw)
    if not match:
        return normalize_simple_video_url(raw)
    return normalize_simple_video_url(match.group(0).rstrip(".,;:!?)]}，。！？；：、）】》"))


def extract_share_title(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    match = re.search(r"《([^》]{1,120})》", raw)
    return match.group(1).strip() if match else ""


def extract_share_tags(value: object) -> list[str]:
    raw = str(value or "")
    return [tag.strip() for tag in re.findall(r"#\s*([^#\s，。！？；、]+)", raw) if tag.strip()]


def detect_platform_from_url(url: str, fallback: str = "douyin") -> str:
    lower = (url or "").lower()
    if "douyin.com" in lower:
        return "douyin"
    if "xiaohongshu.com" in lower or "xhslink.com" in lower:
        return "xhs"
    return normalize_content_platform(fallback or "douyin")


def normalize_simple_material_input(data: dict) -> dict:
    normalized = dict(data or {})
    original_url_input = (normalized.get("url") or "").strip()
    extracted_url = extract_first_url(original_url_input)
    if extracted_url:
        normalized["url"] = extracted_url
        normalized["platform"] = detect_platform_from_url(extracted_url, normalized.get("platform") or "douyin")
    if original_url_input and extracted_url and original_url_input != extracted_url:
        normalized["originalUrlInput"] = original_url_input
        if not (normalized.get("title") or "").strip():
            title_from_share = extract_share_title(original_url_input)
            if title_from_share:
                normalized["title"] = title_from_share
        if not parse_simple_list(normalized.get("tags") or []):
            share_tags = extract_share_tags(original_url_input)
            if share_tags:
                normalized["tags"] = share_tags
        if not (normalized.get("note") or "").strip():
            normalized["note"] = original_url_input
    if original_url_input and not (normalized.get("sourceOriginalUrl") or "").strip():
        normalized["sourceOriginalUrl"] = original_url_input
    return normalized


def json_loads_fallback(value: str, fallback: object) -> object:
    try:
        return json.loads(value or "")
    except (json.JSONDecodeError, TypeError):
        return fallback


def hash_simple_agent_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()


def hash_simple_agent_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def simple_agent_is_admin(user: dict | None) -> bool:
    return bool(user and user.get("role") == "admin")


def simple_agent_scope_clause(user: dict | None, column: str = "owner_user_id") -> tuple[str, tuple]:
    if simple_agent_is_admin(user):
        return "", ()
    if not user:
        return "1 = 0", ()
    return f"{column} = ?", (int(user["id"]),)


def simple_agent_scoped_where(base_where: str, user: dict | None, column: str = "owner_user_id") -> tuple[str, tuple]:
    scope, params = simple_agent_scope_clause(user, column)
    if base_where and scope:
        return f"({base_where}) AND {scope}", params
    return base_where or scope or "1 = 1", params


def simple_agent_owner_join(table_alias: str = "m") -> str:
    return f"LEFT JOIN simple_agent_users owner ON owner.id = {table_alias}.owner_user_id"


def simple_agent_owner_columns(table_alias: str = "m") -> str:
    return (
        f"{table_alias}.owner_user_id, "
        "owner.username AS owner_username, "
        "owner.display_name AS owner_display_name"
    )


def simple_agent_user_brief(row: sqlite3.Row) -> dict:
    keys = row.keys() if row else []
    return {
        "id": row["owner_user_id"] if row and "owner_user_id" in keys else "",
        "username": row["owner_username"] if row and "owner_username" in keys else "",
        "displayName": row["owner_display_name"] if row and "owner_display_name" in keys else "",
    }


def serialize_simple_agent_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "role": row["role"],
        "status": row["status"],
    }


def ensure_simple_agent_user(conn: sqlite3.Connection, username: str, password: str, display_name: str, role: str = "user") -> None:
    row = conn.execute("SELECT id FROM simple_agent_users WHERE username = ?", (username,)).fetchone()
    if row:
        return
    now = utc_now()
    salt = secrets.token_hex(16)
    conn.execute(
        """
        INSERT INTO simple_agent_users (
          username, display_name, role, password_salt, password_hash,
          status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            username,
            display_name,
            role,
            salt,
            hash_simple_agent_password(password, salt),
            "active",
            now,
            now,
        ),
    )


def list_simple_agent_users() -> dict:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, username, display_name, role, status, created_at, updated_at
            FROM simple_agent_users
            ORDER BY role = 'admin' DESC, id ASC
            """
        ).fetchall()
    return {"ok": True, "items": [serialize_simple_agent_user(row) for row in rows]}


def authenticate_simple_agent_user(username: str, password: str) -> dict:
    username = username.strip()
    if not username or not password:
        raise ValueError("请输入账号和密码")
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, username, display_name, role, password_salt, password_hash, status
            FROM simple_agent_users
            WHERE username = ?
            """,
            (username,),
        ).fetchone()
        if not row or row["status"] != "active":
            raise ValueError("账号或密码不正确")
        candidate = hash_simple_agent_password(password, row["password_salt"])
        if not hmac.compare_digest(candidate, row["password_hash"]):
            raise ValueError("账号或密码不正确")
        token = secrets.token_urlsafe(32)
        now = utc_now()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        conn.execute(
            """
            INSERT INTO simple_agent_sessions (
              user_id, token_hash, expires_at, created_at, last_seen_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (row["id"], hash_simple_agent_token(token), expires_at, now, now),
        )
        conn.commit()
        return {"token": token, "expiresAt": expires_at, "user": serialize_simple_agent_user(row)}


def parse_cookie_header(value: str) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for part in (value or "").split(";"):
        if "=" not in part:
            continue
        key, raw_value = part.split("=", 1)
        cookies[key.strip()] = urllib.parse.unquote(raw_value.strip())
    return cookies


def get_simple_agent_user_by_token(token: str | None) -> dict | None:
    if not token:
        return None
    token_hash = hash_simple_agent_token(token)
    now = utc_now()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, u.display_name, u.role, u.status, s.id AS session_id
            FROM simple_agent_sessions s
            JOIN simple_agent_users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
            """,
            (token_hash, now),
        ).fetchone()
        if not row:
            return None
        conn.execute("UPDATE simple_agent_sessions SET last_seen_at = ? WHERE id = ?", (now, row["session_id"]))
        conn.commit()
        return serialize_simple_agent_user(row)


def delete_simple_agent_session(token: str | None) -> None:
    if not token:
        return
    with connect() as conn:
        conn.execute("DELETE FROM simple_agent_sessions WHERE token_hash = ?", (hash_simple_agent_token(token),))
        conn.commit()


def simple_material_learning_summary(data: dict) -> dict:
    raw_text = (data.get("rawText") or "").strip()
    note = (data.get("note") or "").strip()
    tags = parse_simple_list(data.get("tags") or [])
    usable_parts = []
    if data.get("title"):
        usable_parts.append(f"选题/标题：{data['title']}")
    if tags:
        usable_parts.append(f"标签：{'、'.join(tags[:4])}")
    if raw_text:
        usable_parts.append(f"可参考正文：{raw_text[:80]}")
    if note:
        usable_parts.append(f"运营备注：{note[:80]}")
    return {
        "hookAngle": tags[0] if tags else ((data.get("category") or "素材结构").strip() or "素材结构"),
        "usableParts": usable_parts[:5],
        "riskNotes": ["仅学习结构和表达方式，不直接复制原视频素材", "发布前复核价格、活动权益和版权"],
        "qualityActions": ["补充字幕/正文可提升脚本质量", "标记优质样例后可进入质量干预"],
    }


def simple_agent_video_duration_seconds(processing: dict) -> int:
    if not isinstance(processing, dict):
        return 0
    candidates = [
        processing.get("duration"),
        processing.get("durationSeconds"),
        processing.get("videoDuration"),
    ]
    for section_name in ("parse", "download", "subtitle"):
        section = processing.get(section_name) or {}
        if isinstance(section, dict):
            candidates.extend([
                section.get("duration"),
                section.get("durationSeconds"),
                section.get("videoDuration"),
                section.get("duration_seconds"),
            ])
    for value in candidates:
        try:
            numeric = float(value or 0)
        except (TypeError, ValueError):
            continue
        if numeric > 0:
            return int(round(numeric / 1000 if numeric > 1000 else numeric))
    local_path = ((processing.get("download") or {}) if isinstance(processing.get("download"), dict) else {}).get("localPath") or ""
    if not local_path:
        return 0
    try:
        path = Path(local_path)
        if not path.is_absolute():
            path = Path.cwd() / path
        video_root = SIMPLE_AGENT_VIDEO_DIR.resolve()
        resolved = path.resolve()
        if video_root not in resolved.parents or not resolved.exists() or not resolved.is_file():
            return 0
        result = subprocess.run(
            [
                os.environ.get("FFPROBE_BIN", "ffprobe").strip() or "ffprobe",
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(resolved),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=4,
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(round(float(result.stdout.strip())))
    except Exception:
        return 0
    return 0


def serialize_simple_video_material(row: sqlite3.Row) -> dict:
    processing = json_loads_fallback(row["processing_json"], {})
    local_video_path = ((processing or {}).get("download") or {}).get("localPath") or ""
    source_original_url = (
        (processing or {}).get("sourceOriginalUrl")
        or (processing or {}).get("originalUrlInput")
        or (processing or {}).get("normalizedUrl")
        or row["url"]
    )
    return {
        "id": row["id"],
        "title": row["title"],
        "platform": row["platform"],
        "url": row["url"],
        "sourceOriginalUrl": source_original_url,
        "accountName": row["account_name"],
        "materialType": row["material_type"],
        "category": row["category"],
        "tags": json_loads_fallback(row["tags_json"], []),
        "rawText": row["raw_text"],
        "note": row["note"],
        "sourceMethod": row["source_method"],
        "learningSummary": json_loads_fallback(row["learning_summary_json"], {}),
        "processing": processing,
        "durationSeconds": simple_agent_video_duration_seconds(processing),
        "videoPreviewUrl": f"/api/simple-agent/materials/{row['id']}/video" if local_video_path else "",
        "status": row["status"],
        "selected": bool(row["selected"]),
        "useCount": row["use_count"],
        "lastUsedAt": row["last_used_at"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "owner": simple_agent_user_brief(row),
    }


def serialize_simple_reference_account(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "platform": row["platform"],
        "accountName": row["account_name"],
        "accountUrl": row["account_url"],
        "category": row["category"],
        "whyTrack": row["why_track"],
        "patterns": json_loads_fallback(row["patterns_json"], []),
        "status": row["status"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "owner": simple_agent_user_brief(row),
    }


def simple_material_existing_by_urls(urls: list[str], user: dict | None) -> dict[str, dict]:
    normalized_urls = [normalize_simple_video_url(url) for url in urls if normalize_simple_video_url(url)]
    if not normalized_urls:
        return {}
    placeholders = ",".join("?" for _ in normalized_urls)
    scope, scope_params = simple_agent_scope_clause(user, "owner_user_id")
    scope_sql = f" AND {scope}" if scope else ""
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT id, title, url, processing_json, created_at
            FROM simple_video_materials
            WHERE url IN ({placeholders}){scope_sql}
            """,
            tuple(normalized_urls) + scope_params,
        ).fetchall()
    existing = {}
    for row in rows:
        processing = json_loads_fallback(row["processing_json"], {})
        download = (processing or {}).get("download") or {}
        existing[row["url"]] = {
            "id": row["id"],
            "title": row["title"],
            "url": row["url"],
            "createdAt": row["created_at"],
            "downloaded": bool(download.get("localPath") or download.get("status") == "success"),
        }
    return existing


def serialize_simple_campaign(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "brandName": row["brand_name"],
        "campaignName": row["campaign_name"],
        "productName": row["product_name"],
        "sellingPoints": json_loads_fallback(row["selling_points_json"], []),
        "activityRules": row["activity_rules"],
        "priceNote": row["price_note"],
        "channelScope": row["channel_scope"],
        "validFrom": row["valid_from"],
        "validTo": row["valid_to"],
        "status": row["status"],
        "selected": bool(row["selected"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "owner": simple_agent_user_brief(row),
    }


def serialize_simple_template(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "platform": row["platform"],
        "structure": json_loads_fallback(row["structure_json"], []),
        "outputStyle": row["output_style"],
        "status": row["status"],
        "isDefault": bool(row["is_default"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def serialize_simple_script_output(row: sqlite3.Row) -> dict:
    item = {
        "id": row["id"],
        "jobId": row["job_id"],
        "title": row["title"],
        "hook": row["hook"],
        "scriptBody": row["script_body"],
        "output": json_loads_fallback(row["output_json"], {}),
        "qualityScore": row["quality_score"],
        "qualityNotes": row["quality_notes"],
        "reviewStatus": row["review_status"],
        "reviewNote": row["review_note"],
        "isQualitySample": bool(row["is_quality_sample"]),
        "feishuRecordId": row["feishu_record_id"] if "feishu_record_id" in row.keys() else "",
        "feishuSyncStatus": row["feishu_sync_status"] if "feishu_sync_status" in row.keys() else "",
        "feishuSyncError": row["feishu_sync_error"] if "feishu_sync_error" in row.keys() else "",
        "feishuSyncedAt": row["feishu_synced_at"] if "feishu_synced_at" in row.keys() else "",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "owner": simple_agent_user_brief(row),
    }
    if "generation_log_json" in row.keys():
        item["generationLog"] = json_loads_fallback(row["generation_log_json"], {})
    return item


def serialize_simple_generation_log(row: sqlite3.Row | None) -> dict:
    if not row:
        return {}
    return {
        "id": row["id"],
        "jobId": row["job_id"],
        "promptVersion": row["prompt_version"],
        "generator": row["generator"],
        "provider": row["provider"],
        "status": row["status"],
        "requestSnapshot": json_loads_fallback(row["request_snapshot_json"], {}),
        "renderedPrompt": row["rendered_prompt"],
        "rawResponseText": row["raw_response_text"],
        "latencyMs": row["latency_ms"],
        "error": row["error"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def latest_simple_generation_log(conn: sqlite3.Connection, job_id: int) -> dict:
    row = conn.execute(
        """
        SELECT id, job_id, owner_user_id, prompt_version, generator, provider, status,
               request_snapshot_json, rendered_prompt, raw_response_text, latency_ms,
               error, created_at, updated_at
        FROM simple_generation_logs
        WHERE job_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (job_id,),
    ).fetchone()
    return serialize_simple_generation_log(row)


def simple_generation_log_sql(alias: str = "o") -> str:
    return f"""
        COALESCE((
          SELECT json_object(
            'id', gl.id,
            'jobId', gl.job_id,
            'promptVersion', gl.prompt_version,
            'generator', gl.generator,
            'provider', gl.provider,
            'status', gl.status,
            'latencyMs', gl.latency_ms,
            'error', gl.error,
            'createdAt', gl.created_at,
            'updatedAt', gl.updated_at,
            'requestSnapshot', json(gl.request_snapshot_json),
            'renderedPrompt', gl.rendered_prompt,
            'rawResponseText', gl.raw_response_text
          )
          FROM simple_generation_logs gl
          WHERE gl.job_id = {alias}.job_id
          ORDER BY gl.id DESC
          LIMIT 1
        ), '{{}}') AS generation_log_json
    """


def create_simple_generation_log(
    conn: sqlite3.Connection,
    job_id: int,
    owner_user_id: int,
    input_snapshot: dict,
    target_count: int,
    quality_level: str,
    output_mode: str,
    rendered_prompt: str,
) -> int:
    now = utc_now()
    request_snapshot = {
        "topic": input_snapshot.get("topic") or "",
        "targetCount": target_count,
        "qualityLevel": quality_level,
        "outputMode": output_mode,
        "generationStrategy": (input_snapshot.get("qualityRules") or {}).get("generationStrategy") or "balanced",
        "campaignIds": [item.get("id") for item in input_snapshot.get("campaigns") or []],
        "materialIds": [item.get("id") for item in input_snapshot.get("materials") or []],
        "templateId": (input_snapshot.get("template") or {}).get("id"),
        "qualityRules": input_snapshot.get("qualityRules") or {},
    }
    cursor = conn.execute(
        """
        INSERT INTO simple_generation_logs (
          job_id, owner_user_id, prompt_version, generator, provider, status,
          request_snapshot_json, rendered_prompt, raw_response_text, latency_ms,
          error, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 0, '', ?, ?)
        """,
        (
            job_id,
            owner_user_id,
            SIMPLE_AGENT_PROMPT_VERSION,
            SIMPLE_AGENT_GENERATOR,
            simple_generation_provider_name(),
            "running",
            json.dumps(request_snapshot, ensure_ascii=False, separators=(",", ":")),
            rendered_prompt,
            now,
            now,
        ),
    )
    return int(cursor.lastrowid)


def update_simple_generation_log(
    conn: sqlite3.Connection,
    log_id: int,
    status: str,
    latency_ms: int,
    raw_response_text: str = "",
    error: str = "",
) -> None:
    conn.execute(
        """
        UPDATE simple_generation_logs
        SET status = ?, latency_ms = ?, raw_response_text = ?, error = ?, updated_at = ?
        WHERE id = ?
        """,
        (status, max(0, int(latency_ms)), raw_response_text or "", error or "", utc_now(), log_id),
    )


def list_simple_video_materials(user: dict, limit: int = 80) -> dict:
    where_sql, where_params = simple_agent_scoped_where("", user, "m.owner_user_id")
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE {where_sql}
            ORDER BY m.selected DESC, m.id DESC
            LIMIT ?
            """,
            where_params + (max(1, min(limit, 200)),),
        ).fetchall()
        account_where_sql, account_where_params = simple_agent_scoped_where("", user, "a.owner_user_id")
        accounts = conn.execute(
            f"""
            SELECT a.id, a.platform, a.account_name, a.account_url, a.category, a.why_track,
                   a.patterns_json, a.status, a.created_at, a.updated_at,
                   {simple_agent_owner_columns("a")}
            FROM simple_reference_accounts a
            {simple_agent_owner_join("a")}
            WHERE {account_where_sql}
            ORDER BY a.id DESC
            LIMIT 80
            """,
            account_where_params,
        ).fetchall()
        stats = {
            "total": scalar_count(conn, f"SELECT COUNT(*) FROM simple_video_materials m WHERE {where_sql}", where_params),
            "selected": scalar_count(conn, f"SELECT COUNT(*) FROM simple_video_materials m WHERE {where_sql} AND selected = 1", where_params),
            "learned": scalar_count(conn, f"SELECT COUNT(*) FROM simple_video_materials m WHERE {where_sql} AND status IN ('learned', 'reusable')", where_params),
            "accounts": scalar_count(conn, f"SELECT COUNT(*) FROM simple_reference_accounts a WHERE {account_where_sql}", account_where_params),
            "adminScope": simple_agent_is_admin(user),
        }
    return {
        "ok": True,
        "items": [serialize_simple_video_material(row) for row in rows],
        "accounts": [serialize_simple_reference_account(row) for row in accounts],
        "stats": stats,
    }


def create_simple_video_material(data: dict, user: dict) -> dict:
    data = normalize_simple_material_input(data)
    title = (data.get("title") or "").strip()
    platform = normalize_content_platform(data.get("platform") or "douyin")
    url = (data.get("url") or "").strip()
    account_name = (data.get("accountName") or "").strip()
    material_type = (data.get("materialType") or "video").strip()
    category = (data.get("category") or "").strip()
    raw_text = (data.get("rawText") or "").strip()
    note = (data.get("note") or "").strip()
    tags = parse_simple_list(data.get("tags") or [])
    selected = 1 if data.get("selected", True) else 0
    if not title:
        raise ValueError("title 必须填写")
    if not url and not raw_text:
        raise ValueError("url 和 rawText 至少填写一个")
    if platform not in CONTENT_SOURCE_PLATFORMS:
        raise ValueError("platform 不合法")
    now = utc_now()
    summary = simple_material_learning_summary(
        {"title": title, "category": category, "tags": tags, "rawText": raw_text, "note": note}
    )
    processing = dict(data.get("processing") or {})
    if url:
        processing.setdefault("normalizedUrl", url)
    if (data.get("sourceOriginalUrl") or "").strip():
        processing.setdefault("sourceOriginalUrl", (data.get("sourceOriginalUrl") or "").strip())
    if (data.get("originalUrlInput") or "").strip():
        processing.setdefault("originalUrlInput", (data.get("originalUrlInput") or "").strip())
    status = "learned" if raw_text else "pending_text"
    owner_user_id = int(user["id"])
    with connect() as conn:
        if url:
            existing = conn.execute(
                "SELECT id FROM simple_video_materials WHERE url = ? AND owner_user_id = ?",
                (url, owner_user_id),
            ).fetchone()
            if existing:
                raise ValueError("素材库已存在该链接")
        cursor = conn.execute(
            """
            INSERT INTO simple_video_materials (
              title, platform, url, account_name, material_type, category, tags_json,
              raw_text, note, source_method, learning_summary_json, processing_json, status, selected,
              use_count, last_used_at, created_at, updated_at, owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?)
            """,
            (
                title,
                platform,
                url,
                account_name,
                material_type,
                category,
                json.dumps(tags, ensure_ascii=False, separators=(",", ":")),
                raw_text,
                note,
                data.get("sourceMethod") or ("manual_text" if raw_text and not url else "manual_url"),
                json.dumps(summary, ensure_ascii=False, separators=(",", ":")),
                json.dumps(processing, ensure_ascii=False, separators=(",", ":")),
                status,
                selected,
                now,
                now,
                owner_user_id,
            ),
        )
        row = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE m.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return serialize_simple_video_material(row)


def call_video_tools_json(path: str, payload: dict, timeout: int = 45) -> dict:
    endpoint = f"{VIDEO_TOOLS_API_BASE.rstrip('/')}{path}"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_video_tools_error(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        try:
            raw = exc.read().decode("utf-8", errors="replace")
            payload = json.loads(raw or "{}")
            detail = payload.get("detail") or payload.get("error") or payload.get("msg")
            if detail:
                return str(detail)
            return raw[:240] or f"HTTP {exc.code}"
        except Exception:
            return f"HTTP {exc.code}: {exc.reason}"
    if isinstance(exc, urllib.error.URLError):
        return str(exc.reason)
    return str(exc)


def embedded_video_engine_ready() -> bool:
    return USE_EMBEDDED_VIDEO_ENGINE and EMBEDDED_VIDEO_PARSER is not None


def embedded_parse_video(url: str):
    if not USE_EMBEDDED_VIDEO_ENGINE:
        return None
    if EMBEDDED_VIDEO_PARSER is None:
        raise RuntimeError(f"内嵌视频解析模块不可用：{EMBEDDED_VIDEO_ENGINE_ERROR}")
    return EMBEDDED_VIDEO_PARSER.parse(url)


def resolve_simple_video_info(url: str) -> tuple[dict, dict]:
    result = {
        "status": "skipped",
        "ok": False,
        "videoId": "",
        "directVideoUrl": "",
        "title": "",
        "author": "",
        "coverUrl": "",
        "error": "",
    }
    if not url:
        result["error"] = "缺少视频链接"
        return result, {}
    if USE_EMBEDDED_VIDEO_ENGINE:
        try:
            info = embedded_parse_video(url)
            if not info or not info.video_id:
                raise ValueError("无法解析该链接，请检查链接是否正确")
            result.update(
                {
                    "status": "success",
                    "ok": True,
                    "videoId": str(info.video_id or ""),
                    "directVideoUrl": info.video_url or "",
                    "title": info.title or info.raw_desc or "",
                    "author": info.author or "",
                    "coverUrl": info.cover_url or "",
                }
            )
            return result, {
                "video_id": info.video_id,
                "video_url": info.video_url,
                "title": info.title,
                "raw_desc": info.raw_desc,
                "author": info.author,
                "duration": info.duration,
                "platform": info.platform,
                "request_headers": info.request_headers or {},
                "raw_subtitles": info.raw_subtitles or [],
                "raw_subtitle_source": info.raw_subtitle_source or "",
            }
        except Exception as exc:
            result.update({"status": "failed", "error": parse_video_tools_error(exc)})
            return result, {}
    try:
        payload = call_video_tools_json("/api/parse", {"url": url}, timeout=45)
        data = payload.get("data") or {}
        result.update(
            {
                "status": "success",
                "ok": True,
                "videoId": str(data.get("video_id") or ""),
                "directVideoUrl": data.get("video_url") or "",
                "title": data.get("title") or data.get("raw_desc") or "",
                "author": data.get("author") or "",
                "coverUrl": data.get("cover_url") or "",
            }
        )
        return result, data
    except Exception as exc:
        result.update({"status": "failed", "error": parse_video_tools_error(exc)})
        return result, {}


def download_simple_video_file(url: str, video_id: str = "") -> dict:
    result = {"status": "skipped", "ok": False, "localPath": "", "bytes": 0, "error": ""}
    if not url:
        result["error"] = "缺少视频链接"
        return result
    SIMPLE_AGENT_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^a-zA-Z0-9_-]+", "_", video_id or uuid.uuid4().hex[:12])[:80]
    output_path = SIMPLE_AGENT_VIDEO_DIR / f"{safe_id}.mp4"
    if USE_EMBEDDED_VIDEO_ENGINE:
        try:
            info = embedded_parse_video(url)
            if not info or not info.video_url:
                raise ValueError("未获取到视频下载地址")
            import requests

            headers = {"User-Agent": UA_MOBILE}
            headers.update(info.request_headers or {})
            with requests.get(
                info.video_url,
                stream=True,
                allow_redirects=True,
                timeout=120,
                headers=headers,
            ) as response:
                response.raise_for_status()
                with output_path.open("wb") as file:
                    for chunk in response.iter_content(chunk_size=1024 * 128):
                        if chunk:
                            file.write(chunk)
            result.update(
                {
                    "status": "success",
                    "ok": True,
                    "localPath": str(output_path),
                    "bytes": output_path.stat().st_size if output_path.exists() else 0,
                }
            )
        except Exception as exc:
            if output_path.exists():
                try:
                    output_path.unlink()
                except OSError:
                    pass
            result.update({"status": "failed", "error": parse_video_tools_error(exc)})
        return result
    request = urllib.request.Request(
        f"{VIDEO_TOOLS_API_BASE.rstrip('/')}/api/download",
        data=json.dumps({"url": url}, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            with output_path.open("wb") as file:
                while True:
                    chunk = response.read(1024 * 128)
                    if not chunk:
                        break
                    file.write(chunk)
        result.update(
            {
                "status": "success",
                "ok": True,
                "localPath": str(output_path),
                "bytes": output_path.stat().st_size if output_path.exists() else 0,
            }
        )
    except Exception as exc:
        if output_path.exists():
            try:
                output_path.unlink()
            except OSError:
                pass
        result.update({"status": "failed", "error": parse_video_tools_error(exc)})
    return result


def extract_simple_video_subtitle(url: str) -> tuple[dict, str]:
    result = {"status": "skipped", "ok": False, "source": "", "engine": DEFAULT_SUBTITLE_ENGINE, "segments": 0, "error": ""}
    if not url:
        result["error"] = "缺少视频链接"
        return result, ""
    if USE_EMBEDDED_VIDEO_ENGINE:
        try:
            info = embedded_parse_video(url)
            if not info or not info.video_id:
                raise ValueError("无法解析该链接")
            if DEFAULT_SUBTITLE_ENGINE == "auto" and info.raw_subtitles:
                segments = info.raw_subtitles
                text = "\n".join(item.get("text", "") for item in segments if item.get("text"))
                result.update(
                    {
                        "status": "success",
                        "ok": True,
                        "source": info.raw_subtitle_source or info.platform or "platform",
                        "engine": "raw",
                        "segments": len(segments),
                    }
                )
                return result, text
            if DEFAULT_SUBTITLE_ENGINE in {"auto", "asr"}:
                if ASRSubtitleExtractor is None:
                    raise RuntimeError("ASR 字幕模块不可用")
                asr_key = os.environ.get("ASR_API_KEY", "").strip()
                if not asr_key:
                    raise RuntimeError("未配置 ASR_API_KEY 环境变量")
                extractor = ASRSubtitleExtractor(
                    api_url=os.environ.get("ASR_API_URL", "https://api.siliconflow.cn/v1/audio/transcriptions"),
                    api_key=asr_key,
                    model=os.environ.get("ASR_MODEL", "FunAudioLLM/SenseVoiceSmall"),
                )
                data = extractor.extract(
                    video_url=info.video_url,
                    video_duration=info.duration,
                    request_headers=info.request_headers,
                )
                text, segments = extract_subtitle_text(data)
                if not text:
                    raise ValueError("字幕服务未返回字幕文本")
                result.update(
                    {
                        "status": "success",
                        "ok": True,
                        "source": "asr",
                        "engine": "asr",
                        "segments": len(segments),
                    }
                )
                return result, text
            raise RuntimeError(f"当前内嵌模式暂不支持字幕引擎：{DEFAULT_SUBTITLE_ENGINE}")
        except Exception as exc:
            result.update({"status": "failed", "error": parse_video_tools_error(exc)})
            return result, ""
    try:
        payload = call_video_tools_json(
            f"/api/subtitle?engine={urllib.parse.quote(DEFAULT_SUBTITLE_ENGINE)}",
            {"url": url},
            timeout=180,
        )
        data = payload.get("data") or {}
        text, segments = extract_subtitle_text(data)
        if not text:
            raise ValueError("字幕服务未返回字幕文本")
        result.update(
            {
                "status": "success",
                "ok": True,
                "source": data.get("source") or data.get("engine") or "",
                "engine": data.get("engine") or DEFAULT_SUBTITLE_ENGINE,
                "segments": len(segments),
            }
        )
        return result, text
    except Exception as exc:
        result.update({"status": "failed", "error": parse_video_tools_error(exc)})
        return result, ""


def process_simple_video_material(data: dict, user: dict) -> dict:
    data = normalize_simple_material_input(data)
    original_url = (data.get("url") or "").strip()
    if not original_url:
        raise ValueError("url 必须填写")
    processing = {
        "mode": "download_and_subtitle",
        "sourceOriginalUrl": (data.get("sourceOriginalUrl") or data.get("originalUrlInput") or original_url).strip(),
        "normalizedUrl": original_url,
        "engine": "embedded" if USE_EMBEDDED_VIDEO_ENGINE else "external_service",
        "apiBase": "" if USE_EMBEDDED_VIDEO_ENGINE else VIDEO_TOOLS_API_BASE,
        "startedAt": utc_now(),
        "parse": {},
        "download": {},
        "subtitle": {},
        "warnings": [],
        "finishedAt": "",
    }
    if data.get("originalUrlInput"):
        processing["originalUrlInput"] = data["originalUrlInput"]
        processing["normalizedUrl"] = original_url
    parse_result, parsed_info = resolve_simple_video_info(original_url)
    processing["parse"] = parse_result
    resolved_title = parse_result.get("title") or (data.get("title") or "").strip() or "视频素材"
    resolved_account = (data.get("accountName") or "").strip() or parse_result.get("author") or ""
    raw_text = (data.get("rawText") or "").strip()
    if parse_result.get("ok"):
        download_result = download_simple_video_file(original_url, parse_result.get("videoId") or "")
        processing["download"] = download_result
        subtitle_result, subtitle_text = extract_simple_video_subtitle(original_url)
        processing["subtitle"] = subtitle_result
        if subtitle_text:
            raw_text = subtitle_text
    else:
        processing["download"] = {"status": "skipped", "ok": False, "error": "解析失败，未尝试下载"}
        processing["subtitle"] = {"status": "skipped", "ok": False, "error": "解析失败，未尝试提取字幕"}
    for key in ["parse", "download", "subtitle"]:
        item = processing[key]
        if item.get("status") == "failed" and item.get("error"):
            processing["warnings"].append(f"{key}: {item['error']}")
    processing["finishedAt"] = utc_now()
    item = create_simple_video_material(
        {
            **data,
            "title": resolved_title,
            "accountName": resolved_account,
            "rawText": raw_text,
            "note": (data.get("note") or "").strip(),
            "sourceMethod": "processed_video",
            "processing": processing,
            "selected": data.get("selected", True),
        },
        user,
    )
    return {"ok": True, "item": item, "processing": processing}


SIMPLE_MATERIAL_BATCH_ALIASES = {
    "title": {"title", "标题", "视频标题", "素材标题", "内容标题"},
    "url": {"url", "link", "链接", "视频链接", "笔记链接", "作品链接", "素材链接"},
    "accountName": {"account", "account_name", "accountname", "账号", "账号名", "达人", "作者", "博主", "来源账号", "来源"},
    "platform": {"platform", "平台", "渠道", "来源平台"},
    "category": {"category", "分类", "类目", "素材分类", "内容分类"},
    "tags": {"tags", "tag", "标签", "关键词", "结构标签"},
    "note": {"note", "备注", "说明", "观察", "参考理由", "为什么参考"},
}


def canonical_simple_material_field(header: str) -> str | None:
    normalized = normalize_header_name(header)
    for field, aliases in SIMPLE_MATERIAL_BATCH_ALIASES.items():
        if normalized in {normalize_header_name(alias) for alias in aliases}:
            return field
    return None


def parse_simple_material_batch_text(raw_text: str, default_platform: str = "douyin") -> list[dict]:
    delimiter, _detected_format = detect_table_dialect(raw_text)
    rows = split_table_rows(raw_text, delimiter) if delimiter else []
    if rows and any(canonical_simple_material_field(cell) for cell in rows[0]):
        header_map = {
            index: field
            for index, cell in enumerate(rows[0])
            for field in [canonical_simple_material_field(cell)]
            if field
        }
        parsed = []
        for line_number, row in enumerate(rows[1:], start=2):
            mapped = {field: row[index].strip() for index, field in header_map.items() if index < len(row)}
            parsed.append({
                "line": line_number,
                "raw": delimiter.join(row),
                "payload": {
                    "title": mapped.get("title") or "",
                    "url": extract_first_url(mapped.get("url") or ""),
                    "sourceOriginalUrl": (mapped.get("url") or "").strip(),
                    "accountName": mapped.get("accountName") or "",
                    "platform": normalize_content_platform(mapped.get("platform") or default_platform) or default_platform,
                    "category": mapped.get("category") or "",
                    "tags": mapped.get("tags") or "",
                    "note": mapped.get("note") or "",
                },
            })
        return parsed
    parsed = []
    for line_number, line in enumerate([item.strip() for item in raw_text.splitlines() if item.strip()], start=1):
        parts = [part.strip() for part in re.split(r"[\t,]", line) if part.strip()]
        url = extract_first_url(line)
        title = extract_share_title(line) or next((part for part in parts if part != url and not part.startswith(("http://", "https://"))), "") or (f"批量导入素材 {line_number}" if url else line[:40])
        parsed.append({
            "line": line_number,
            "raw": line,
            "payload": {
                "title": title,
                "url": url,
                "sourceOriginalUrl": line,
                "accountName": "",
                "platform": default_platform,
                "category": "",
                "tags": "",
                "note": "" if url else line,
            },
        })
    return parsed


def create_simple_video_materials_batch(data: dict, user: dict) -> dict:
    raw_text = (data.get("batchText") or data.get("text") or "").strip()
    if not raw_text:
        raise ValueError("batchText 必须填写")
    parsed_rows = parse_simple_material_batch_text(raw_text, normalize_content_platform(data.get("platform") or "douyin"))
    if len(parsed_rows) > 80:
        raise ValueError("一次最多导入 80 行")
    return import_simple_material_rows(parsed_rows, user, data, source_method="batch_import")


def public_simple_material_rows(parsed_rows: list[dict]) -> list[dict]:
    items = []
    for row in parsed_rows:
        payload = row.get("payload") or {}
        items.append(
            {
                "line": row.get("line"),
                "title": payload.get("title") or "",
                "url": payload.get("url") or "",
                "sourceOriginalUrl": payload.get("sourceOriginalUrl") or payload.get("url") or "",
                "accountName": payload.get("accountName") or "",
                "platform": payload.get("platform") or "",
                "category": payload.get("category") or "",
                "tags": payload.get("tags") or "",
                "note": payload.get("note") or "",
            }
        )
    return items


def annotate_simple_material_duplicates(rows: list[dict], user: dict) -> list[dict]:
    existing_by_url = simple_material_existing_by_urls([row.get("url") or "" for row in rows], user)
    annotated = []
    seen_urls = set()
    for row in rows:
        item = dict(row)
        url = normalize_simple_video_url(item.get("url") or "")
        existing = existing_by_url.get(url)
        duplicate_in_batch = bool(url and url in seen_urls)
        if url:
            seen_urls.add(url)
        if existing or duplicate_in_batch:
            item["duplicate"] = True
            item["duplicateReason"] = "素材库已存在" if existing else "本次导入重复"
            if existing:
                item["existingMaterial"] = existing
            note = item.get("note") or ""
            duplicate_note = "已下载过，将跳过重复下载" if existing and existing.get("downloaded") else "已存在，将跳过重复入库"
            item["note"] = f"{note}；{duplicate_note}" if note else duplicate_note
        else:
            item["duplicate"] = False
        annotated.append(item)
    return annotated


def decode_data_url_bytes(data_url: str) -> bytes:
    raw = (data_url or "").strip()
    if not raw:
        raise ValueError("没有读取到上传文件")
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        return base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise ValueError("上传文件内容解析失败") from exc


def xlsx_cell_ref_to_column(cell_ref: str) -> int:
    letters = re.sub(r"[^A-Z]", "", (cell_ref or "").upper())
    column = 0
    for char in letters:
        column = column * 26 + (ord(char) - ord("A") + 1)
    return max(column - 1, 0)


def read_xlsx_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        xml = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(xml)
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    strings = []
    for item in root.findall(".//x:si", namespace):
        parts = [node.text or "" for node in item.findall(".//x:t", namespace)]
        strings.append("".join(parts).strip())
    return strings


def extract_text_from_xlsx_cell(cell: ET.Element, shared_strings: list[str], namespace: dict[str, str]) -> str:
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//x:t", namespace)).strip()
    value_node = cell.find("x:v", namespace)
    value = (value_node.text or "").strip() if value_node is not None else ""
    if cell_type == "s":
        try:
            return shared_strings[int(value)].strip()
        except (ValueError, IndexError):
            return ""
    return value


def xlsx_bytes_to_tsv(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            shared_strings = read_xlsx_shared_strings(zf)
            sheet_name = next((name for name in zf.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")), "")
            if not sheet_name:
                raise ValueError("Excel 文件里没有可读取的工作表")
            root = ET.fromstring(zf.read(sheet_name))
    except zipfile.BadZipFile as exc:
        raise ValueError("上传的文件不是有效的 Excel 文件") from exc
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    lines = []
    for row in root.findall(".//x:sheetData/x:row", namespace):
        values_by_column = {}
        max_column = -1
        for cell in row.findall("x:c", namespace):
            column_index = xlsx_cell_ref_to_column(cell.attrib.get("r", ""))
            values_by_column[column_index] = extract_text_from_xlsx_cell(cell, shared_strings, namespace)
            max_column = max(max_column, column_index)
        if max_column < 0:
            continue
        values = [values_by_column.get(index, "").strip() for index in range(max_column + 1)]
        if any(values):
            lines.append("\t".join(values))
    return "\n".join(lines)


def uploaded_material_table_to_text(filename: str, data: bytes) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".xlsx":
        return xlsx_bytes_to_tsv(data)
    if suffix in {".csv", ".tsv", ".txt"}:
        for encoding in ("utf-8-sig", "utf-8", "gb18030"):
            try:
                return data.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError("表格文本编码无法识别，请另存为 UTF-8 后重试")
    raise ValueError("请上传 .xlsx、.csv 或 .tsv 文件")


def apply_simple_material_preview_defaults(rows: list[dict], default_category: str, default_tags: object) -> list[dict]:
    tags = ",".join(parse_simple_list(default_tags)) if isinstance(default_tags, list) else (default_tags or "")
    normalized = []
    for row in rows:
        item = dict(row)
        if default_category and not item.get("category"):
            item["category"] = default_category
        if tags and not item.get("tags"):
            item["tags"] = tags
        normalized.append(item)
    return normalized


def preview_simple_video_materials_batch(data: dict, user: dict) -> dict:
    raw_text = (data.get("batchText") or data.get("text") or "").strip()
    if not raw_text:
        raise ValueError("batchText 必须填写")
    parsed_rows = parse_simple_material_batch_text(raw_text, normalize_content_platform(data.get("platform") or "douyin"))
    if len(parsed_rows) > 80:
        raise ValueError("一次最多预览 80 行")
    rows = annotate_simple_material_duplicates(public_simple_material_rows(parsed_rows), user)
    return {"ok": True, "total": len(rows), "rows": rows}


def preview_simple_materials_from_excel_upload(data: dict, user: dict) -> dict:
    filename = (data.get("filename") or "").strip()
    file_bytes = decode_data_url_bytes(data.get("dataUrl") or data.get("file") or "")
    raw_text = uploaded_material_table_to_text(filename, file_bytes).strip()
    if not raw_text:
        raise ValueError("表格中没有读取到素材链接")
    parsed_rows = parse_simple_material_batch_text(raw_text, normalize_content_platform(data.get("platform") or "douyin"))
    parsed_rows = [row for row in parsed_rows if (row.get("payload") or {}).get("url")]
    if len(parsed_rows) > 80:
        raise ValueError("一次最多预览 80 行")
    rows = apply_simple_material_preview_defaults(
        public_simple_material_rows(parsed_rows),
        (data.get("category") or "").strip(),
        data.get("tags") or [],
    )
    rows = annotate_simple_material_duplicates(rows, user)
    return {"ok": True, "total": len(rows), "rows": rows, "source": {"filename": filename}}


def process_simple_material_rows_batch(data: dict, user: dict) -> dict:
    rows = data.get("rows") or []
    if not isinstance(rows, list) or not rows:
        raise ValueError("请先预览并确认要导入的链接")
    if len(rows) > 80:
        raise ValueError("一次最多处理 80 行")
    results = []
    success = 0
    skipped = 0
    seen_urls = set()
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            results.append({"line": index, "ok": False, "error": "行数据格式不正确"})
            continue
        try:
            normalized_url = normalize_simple_video_url(row.get("url") or "")
            existing = simple_material_existing_by_urls([normalized_url], user).get(normalized_url) if normalized_url else None
            if existing or (normalized_url and normalized_url in seen_urls):
                skipped += 1
                results.append({
                    "line": row.get("line") or index,
                    "ok": True,
                    "skipped": True,
                    "reason": "素材库已存在，已跳过重复下载" if existing else "本次导入重复，已跳过",
                    "existingMaterial": existing,
                    "input": row,
                })
                if normalized_url:
                    seen_urls.add(normalized_url)
                continue
            if normalized_url:
                seen_urls.add(normalized_url)
            item = process_simple_video_material(
                {
                    "title": row.get("title") or f"批量导入素材 {index}",
                    "platform": row.get("platform") or data.get("platform") or "douyin",
                    "url": row.get("url") or "",
                    "sourceOriginalUrl": row.get("sourceOriginalUrl") or row.get("url") or "",
                    "accountName": row.get("accountName") or row.get("account") or "",
                    "category": row.get("category") or data.get("category") or "",
                    "tags": row.get("tags") or data.get("tags") or [],
                    "note": row.get("note") or "",
                    "selected": data.get("selected", True),
                },
                user,
            )["item"]
            results.append({"line": row.get("line") or index, "ok": True, "item": item})
            success += 1
        except Exception as exc:
            results.append({"line": row.get("line") or index, "ok": False, "error": str(exc), "input": row})
    failed = len([result for result in results if not result.get("ok")])
    return {"ok": True, "total": len(rows), "success": success, "skipped": skipped, "failed": failed, "results": results}


def import_simple_material_rows(parsed_rows: list[dict], user: dict, defaults: dict | None = None, source_method: str = "batch_import") -> dict:
    defaults = defaults or {}
    if len(parsed_rows) > 80:
        raise ValueError("一次最多导入 80 行")
    results = []
    success = 0
    for row in parsed_rows:
        payload = row.get("payload") or {}
        try:
            item = create_simple_video_material(
                {
                    "title": payload.get("title"),
                    "platform": payload.get("platform"),
                    "url": payload.get("url"),
                    "sourceOriginalUrl": payload.get("sourceOriginalUrl") or payload.get("url"),
                    "accountName": payload.get("accountName") or "",
                    "rawText": "",
                    "note": payload.get("note"),
                    "category": payload.get("category") or defaults.get("category") or "",
                    "tags": payload.get("tags") or defaults.get("tags") or [],
                    "sourceMethod": source_method,
                    "selected": defaults.get("selected", True),
                },
                user,
            )
            results.append({"line": row["line"], "ok": True, "item": item})
            success += 1
        except Exception as exc:
            results.append({"line": row["line"], "ok": False, "error": str(exc), "input": row["raw"]})
    return {"total": len(parsed_rows), "success": success, "failed": len(parsed_rows) - success, "results": results}


def parse_feishu_base_link(link: str) -> dict:
    raw = (link or "").strip()
    if not raw:
        raise ValueError("请填写飞书多维表格链接")
    parsed = urllib.parse.urlparse(raw)
    query = urllib.parse.parse_qs(parsed.query)
    fragment_query = urllib.parse.parse_qs(parsed.fragment.replace("?", "&"))
    token_match = re.search(r"/(?:base|bitable)/([a-zA-Z0-9]+)", parsed.path)
    base_token = token_match.group(1) if token_match else ""
    table_id = (
        (query.get("table") or query.get("table_id") or query.get("tableId") or [""])[0]
        or (fragment_query.get("table") or fragment_query.get("table_id") or fragment_query.get("tableId") or [""])[0]
    )
    if not table_id:
        table_match = re.search(r"(tbl[a-zA-Z0-9]+)", raw)
        table_id = table_match.group(1) if table_match else ""
    if not base_token:
        raise ValueError("没有从链接中识别到 base token，请确认是飞书多维表格链接")
    return {"baseToken": base_token, "tableId": table_id}


def run_lark_cli(args: list[str], timeout: int = 45) -> dict:
    cli = os.environ.get("LARK_CLI_BIN", "").strip() or shutil.which("lark-cli") or "/opt/homebrew/bin/lark-cli"
    completed = subprocess.run(
        [cli, *args],
        cwd=Path.cwd(),
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )
    if completed.returncode != 0:
        error = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(error or f"lark-cli exited {completed.returncode}")
    raw = (completed.stdout or "").strip()
    try:
        return json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"飞书 CLI 返回的不是 JSON：{raw[:240]}") from exc


def readable_lark_error(error: Exception) -> str:
    raw = str(error).strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            payload = json.loads(match.group(0))
            detail = payload.get("error") if isinstance(payload, dict) else {}
            missing = detail.get("message") if isinstance(detail, dict) else ""
            hint = detail.get("hint") if isinstance(detail, dict) else ""
            if "missing required scope" in missing:
                return f"飞书 CLI 缺少多维表格权限：{missing}。{hint}".strip()
            if detail.get("code") == 99991679 or "Permission denied" in (detail.get("message") or ""):
                violations = detail.get("detail", {}).get("permission_violations") or []
                subjects = [str(item.get("subject") or "") for item in violations if isinstance(item, dict)]
                if any("base:record:create" in subject for subject in subjects):
                    return "飞书 CLI 缺少记录写入权限：请重新授权 base:record:create 后再同步。"
                return "飞书 CLI 权限不足：请重新授权多维表格读写权限后再同步。"
        except Exception:
            pass
    if "missing required scope" in raw:
        return f"飞书 CLI 缺少多维表格权限：{raw}"
    return raw


def first_feishu_table_id(base_token: str) -> str:
    payload = run_lark_cli(["base", "+table-list", "--base-token", base_token, "--as", "user", "--limit", "20"])
    candidates = []
    if isinstance(payload.get("data"), dict):
        candidates = payload["data"].get("items") or payload["data"].get("tables") or []
    elif isinstance(payload.get("items"), list):
        candidates = payload["items"]
    if not candidates:
        raise ValueError("没有读取到这个多维表格里的数据表，请检查链接权限")
    first = candidates[0]
    return first.get("table_id") or first.get("tableId") or first.get("id") or first.get("name") or ""


def feishu_field_to_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        parts = [feishu_field_to_text(item) for item in value]
        return ",".join(part for part in parts if part)
    if isinstance(value, dict):
        for key in ["text", "link", "url", "name", "value"]:
            if value.get(key):
                return feishu_field_to_text(value.get(key))
        if value.get("text_arr"):
            return feishu_field_to_text(value.get("text_arr"))
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value).strip()


def extract_feishu_records(payload: dict) -> list[dict]:
    data = payload.get("data") if isinstance(payload, dict) else {}
    if isinstance(data, dict):
        records = data.get("items") or data.get("records") or []
    else:
        records = []
    if not records and isinstance(payload.get("items"), list):
        records = payload["items"]
    normalized = []
    for record in records:
        if not isinstance(record, dict):
            continue
        fields = record.get("fields") if isinstance(record.get("fields"), dict) else record
        normalized.append({str(key): feishu_field_to_text(value) for key, value in fields.items()})
    return normalized


def parsed_rows_from_feishu_records(records: list[dict], default_platform: str, default_category: str, default_tags: object) -> list[dict]:
    rows = []
    for index, record in enumerate(records, start=1):
        mapped = {}
        for header, value in record.items():
            field = canonical_simple_material_field(header)
            if field:
                mapped[field] = value
        raw = "\t".join(f"{key}:{value}" for key, value in record.items() if value)
        payload = {
            "title": mapped.get("title") or f"飞书表格素材 {index}",
            "url": mapped.get("url") or "",
            "accountName": mapped.get("accountName") or "",
            "platform": normalize_content_platform(mapped.get("platform") or default_platform) or default_platform,
            "category": mapped.get("category") or default_category or "",
            "tags": mapped.get("tags") or default_tags or "",
            "note": mapped.get("note") or "",
        }
        rows.append({"line": index, "raw": raw, "payload": payload})
    return rows


def import_simple_materials_from_feishu_base(data: dict, user: dict) -> dict:
    preview = preview_simple_materials_from_feishu_base(data, user)
    return process_simple_material_rows_batch({**data, "rows": preview["rows"]}, user)


def preview_simple_materials_from_feishu_base(data: dict, user: dict) -> dict:
    link = (data.get("feishuUrl") or data.get("url") or "").strip()
    parsed_link = parse_feishu_base_link(link)
    base_token = parsed_link["baseToken"]
    table_id = parsed_link["tableId"] or first_feishu_table_id(base_token)
    if not table_id:
        raise ValueError("没有识别到 table id，请使用包含 table=tbl... 的多维表格链接")
    payload = run_lark_cli(
        [
            "base",
            "+record-list",
            "--base-token",
            base_token,
            "--table-id",
            table_id,
            "--as",
            "user",
            "--limit",
            str(max(1, min(int(data.get("limit") or 80), 80))),
            "--format",
            "json",
        ],
        timeout=60,
    )
    records = extract_feishu_records(payload)
    if not records:
        return {"ok": True, "total": 0, "rows": [], "source": {"baseToken": base_token, "tableId": table_id}}
    parsed_rows = parsed_rows_from_feishu_records(
        records,
        normalize_content_platform(data.get("platform") or "douyin"),
        (data.get("category") or "").strip(),
        data.get("tags") or [],
    )
    rows = annotate_simple_material_duplicates(public_simple_material_rows(parsed_rows), user)
    return {"ok": True, "total": len(parsed_rows), "rows": rows, "source": {"baseToken": base_token, "tableId": table_id, "records": len(records)}}


def resolve_simple_script_library_target() -> dict:
    link = os.environ.get("SIMPLE_AGENT_SCRIPT_LIBRARY_URL", "").strip()
    base_token = os.environ.get("SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN", "").strip()
    table_id = os.environ.get("SIMPLE_AGENT_SCRIPT_LIBRARY_TABLE_ID", "").strip()
    if link:
        parsed = parse_feishu_base_link(link)
        base_token = parsed["baseToken"]
        table_id = parsed["tableId"] or table_id
    if not base_token:
        raise ValueError("未配置飞书脚本库：请设置 SIMPLE_AGENT_SCRIPT_LIBRARY_URL 或 SIMPLE_AGENT_SCRIPT_LIBRARY_BASE_TOKEN")
    if not table_id:
        table_id = first_feishu_table_id(base_token)
    if not table_id:
        raise ValueError("未配置飞书脚本库 table：请使用包含 table=tbl... 的多维表格链接，或设置 SIMPLE_AGENT_SCRIPT_LIBRARY_TABLE_ID")
    return {"baseToken": base_token, "tableId": table_id}


def simple_script_library_public_info() -> dict:
    try:
        target = resolve_simple_script_library_target()
    except Exception as exc:
        return {"configured": False, "url": "", "tableId": "", "error": readable_lark_error(exc)}
    return {
        "configured": True,
        "url": f"https://vcnhkiozlu7s.feishu.cn/base/{target['baseToken']}?table={target['tableId']}",
        "tableId": target["tableId"],
        "error": "",
    }


def simple_script_library_record(output_id: int) -> dict:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT o.id, o.job_id, o.title, o.hook, o.script_body, o.output_json,
                   o.quality_score, o.quality_notes, o.review_status, o.review_note,
                   o.is_quality_sample, o.created_at, o.updated_at,
                   j.topic, j.quality_level, j.output_mode, j.input_snapshot_json
            FROM simple_script_outputs o
            JOIN simple_generation_jobs j ON j.id = o.job_id
            WHERE o.id = ?
            """,
            (output_id,),
        ).fetchone()
    if not row:
        raise ValueError("脚本不存在")
    output = json_loads_fallback(row["output_json"], {})
    snapshot = json_loads_fallback(row["input_snapshot_json"], {})
    campaigns = snapshot.get("campaigns") if isinstance(snapshot.get("campaigns"), list) else []
    materials = snapshot.get("materials") if isinstance(snapshot.get("materials"), list) else []
    input_campaign_id = str(output.get("inputCampaignId") or "")
    input_material_id = str(output.get("inputMaterialId") or "")
    campaign = next((item for item in campaigns if str(item.get("id")) == input_campaign_id), campaigns[0] if campaigns else {})
    material = next((item for item in materials if str(item.get("id")) == input_material_id), materials[0] if materials else {})
    date_value = (row["created_at"] or utc_now())[:10]
    brand_name = campaign.get("brandName") or load_brand_name() or ""
    category = material.get("category") or campaign.get("campaignName") or row["output_mode"] or "未分类"
    return {
        "本地脚本ID": str(row["id"]),
        "日期": date_value,
        "品牌": brand_name,
        "分类": category,
        "主题": row["topic"] or "",
        "标题": row["title"],
        "开头钩子": row["hook"],
        "脚本正文": row["script_body"],
        "CTA": output.get("cta") or "",
        "质量分": row["quality_score"],
        "审核状态": row["review_status"],
        "是否优质样例": "是" if row["is_quality_sample"] else "否",
        "质量说明": row["quality_notes"],
        "审核备注": row["review_note"] or "",
        "商品活动": " / ".join(str(item) for item in [campaign.get("campaignName"), campaign.get("productName")] if item),
        "活动规则": campaign.get("activityRules") or "",
        "价格说明": campaign.get("priceNote") or "",
        "渠道范围": campaign.get("channelScope") or "",
        "参考素材": material.get("title") or "",
        "参考账号": material.get("accountName") or "",
        "素材平台": material.get("platform") or "",
        "素材链接": material.get("url") or "",
        "生成方式": output.get("generator") or "codex_cli",
        "创建时间": row["created_at"],
        "更新时间": row["updated_at"],
    }


def sync_simple_script_to_feishu_base(output_id: int) -> dict:
    target = resolve_simple_script_library_target()
    fields = {key: "" if value is None else str(value) for key, value in simple_script_library_record(output_id).items()}
    sync_method = "api"
    try:
        result = run_lark_cli(
            [
                "api",
                "POST",
                f"/open-apis/bitable/v1/apps/{target['baseToken']}/tables/{target['tableId']}/records/batch_create",
                "--as",
                "user",
                "--data",
                json.dumps({"records": [{"fields": fields}]}, ensure_ascii=False, separators=(",", ":")),
                "--format",
                "json",
            ],
            timeout=60,
        )
    except Exception:
        sync_method = "record-batch-create"
        result = run_lark_cli(
            [
                "base",
                "+record-batch-create",
                "--base-token",
                target["baseToken"],
                "--table-id",
                target["tableId"],
                "--as",
                "user",
                "--json",
                json.dumps({"fields": list(fields.keys()), "rows": [list(fields.values())]}, ensure_ascii=False, separators=(",", ":")),
            ],
            timeout=60,
        )
    record_id = ""
    data = result.get("data") if isinstance(result, dict) else {}
    records = []
    if isinstance(data, dict):
        records = data.get("records") or data.get("items") or []
    if not records and isinstance(result.get("records"), list):
        records = result["records"]
    if records and isinstance(records[0], dict):
        record_id = records[0].get("record_id") or records[0].get("recordId") or records[0].get("id") or ""
    now = utc_now()
    with connect() as conn:
        conn.execute(
            """
            UPDATE simple_script_outputs
            SET feishu_record_id = ?, feishu_sync_status = 'synced',
                feishu_sync_error = '', feishu_synced_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (record_id, now, now, output_id),
        )
        conn.commit()
    return {"ok": True, "target": target, "recordId": record_id, "fields": fields, "method": sync_method}


def mark_simple_script_feishu_sync_failed(output_id: int, error: str) -> None:
    now = utc_now()
    with connect() as conn:
        conn.execute(
            """
            UPDATE simple_script_outputs
            SET feishu_sync_status = 'failed', feishu_sync_error = ?,
                feishu_synced_at = '', updated_at = ?
            WHERE id = ?
            """,
            (error[:500], now, output_id),
        )
        conn.commit()


def create_simple_reference_account(data: dict, user: dict) -> dict:
    platform = normalize_content_platform(data.get("platform") or "douyin")
    account_name = (data.get("accountName") or "").strip()
    account_url = (data.get("accountUrl") or "").strip()
    category = (data.get("category") or "").strip()
    why_track = (data.get("whyTrack") or "").strip()
    patterns = parse_simple_list(data.get("patterns") or [])
    if not account_name:
        raise ValueError("accountName 必须填写")
    now = utc_now()
    owner_user_id = int(user["id"])
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO simple_reference_accounts (
              platform, account_name, account_url, category, why_track,
              patterns_json, status, created_at, updated_at, owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                platform,
                account_name,
                account_url,
                category,
                why_track,
                json.dumps(patterns, ensure_ascii=False, separators=(",", ":")),
                "active",
                now,
                now,
                owner_user_id,
            ),
        )
        row = conn.execute(
            f"""
            SELECT a.id, a.platform, a.account_name, a.account_url, a.category, a.why_track,
                   a.patterns_json, a.status, a.created_at, a.updated_at,
                   {simple_agent_owner_columns("a")}
            FROM simple_reference_accounts a
            {simple_agent_owner_join("a")}
            WHERE a.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return serialize_simple_reference_account(row)


def set_simple_material_selected(material_id: int, selected: bool, user: dict) -> dict:
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("m.id = ?", user, "m.owner_user_id")
    with connect() as conn:
        existing = conn.execute(f"SELECT m.id FROM simple_video_materials m WHERE {where_sql}", (material_id,) + where_params).fetchone()
        if not existing:
            raise ValueError("素材不存在")
        conn.execute(
            "UPDATE simple_video_materials SET selected = ?, updated_at = ? WHERE id = ?",
            (1 if selected else 0, now, material_id),
        )
        row = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE m.id = ?
            """,
            (material_id,),
        ).fetchone()
        conn.commit()
    return serialize_simple_video_material(row)


def download_simple_material_by_id(material_id: int, user: dict) -> dict:
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("m.id = ?", user, "m.owner_user_id")
    with connect() as conn:
        existing = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE {where_sql}
            """,
            (material_id,) + where_params,
        ).fetchone()
        if not existing:
            raise ValueError("素材不存在")
        processing = json_loads_fallback(existing["processing_json"], {})
        source_url = (
            (processing or {}).get("sourceOriginalUrl")
            or (processing or {}).get("normalizedUrl")
            or (processing or {}).get("originalUrlInput")
            or existing["url"]
            or ""
        ).strip()
        normalized_url = normalize_simple_video_url(extract_first_url(source_url) or source_url)
        if not normalized_url:
            raise ValueError("该素材没有可下载的视频原始链接")
        parse_result, _parsed_info = resolve_simple_video_info(normalized_url)
        video_id = parse_result.get("videoId") or str(material_id)
        download_result = download_simple_video_file(normalized_url, video_id)
        processing["sourceOriginalUrl"] = source_url
        processing["normalizedUrl"] = normalized_url
        processing["parse"] = parse_result
        processing["download"] = download_result
        next_status = existing["status"]
        if download_result.get("ok"):
            next_status = "learned" if (existing["raw_text"] or "").strip() else "pending_text"
        conn.execute(
            """
            UPDATE simple_video_materials
            SET url = ?, processing_json = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                normalized_url,
                json.dumps(processing, ensure_ascii=False, separators=(",", ":")),
                next_status,
                now,
                material_id,
            ),
        )
        row = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE m.id = ?
            """,
            (material_id,),
        ).fetchone()
        conn.commit()
    return {
        "ok": bool(download_result.get("ok")),
        "item": serialize_simple_video_material(row),
        "download": download_result,
    }


def supplement_simple_material_subtitle(material_id: int, user: dict) -> dict:
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("m.id = ?", user, "m.owner_user_id")
    with connect() as conn:
        existing = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE {where_sql}
            """,
            (material_id,) + where_params,
        ).fetchone()
        if not existing:
            raise ValueError("素材不存在")
        processing = json_loads_fallback(existing["processing_json"], {})
        if not isinstance(processing, dict):
            processing = {}
        source_url = (
            (processing or {}).get("sourceOriginalUrl")
            or (processing or {}).get("normalizedUrl")
            or (processing or {}).get("originalUrlInput")
            or existing["url"]
            or ""
        ).strip()
        normalized_url = normalize_simple_video_url(extract_first_url(source_url) or source_url)
        if not normalized_url:
            raise ValueError("该素材没有可补字幕的视频链接")
        processing.setdefault("mode", "download_and_subtitle")
        processing["sourceOriginalUrl"] = source_url or normalized_url
        processing["normalizedUrl"] = normalized_url
        processing["subtitleStartedAt"] = now
        subtitle_result, subtitle_text = extract_simple_video_subtitle(normalized_url)
        processing["subtitle"] = subtitle_result
        existing_warnings = parse_simple_list(processing.get("warnings") or [])
        processing["warnings"] = [
            warning for warning in existing_warnings
            if not re.search(r"ASR_API_KEY|asr|字幕|subtitle", str(warning), re.I)
        ]
        if subtitle_result.get("status") == "failed" and subtitle_result.get("error"):
            processing["warnings"].append(f"subtitle: {subtitle_result['error']}")
        processing["subtitleFinishedAt"] = utc_now()
        processing["finishedAt"] = processing["subtitleFinishedAt"]
        raw_text = subtitle_text.strip() if subtitle_text else (existing["raw_text"] or "")
        next_status = "learned" if raw_text.strip() else "pending_text"
        summary = simple_material_learning_summary(
            {
                "title": existing["title"],
                "category": existing["category"],
                "tags": json_loads_fallback(existing["tags_json"], []),
                "rawText": raw_text,
                "note": existing["note"],
            }
        )
        conn.execute(
            """
            UPDATE simple_video_materials
            SET url = ?, raw_text = ?, learning_summary_json = ?, processing_json = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                normalized_url,
                raw_text,
                json.dumps(summary, ensure_ascii=False, separators=(",", ":")),
                json.dumps(processing, ensure_ascii=False, separators=(",", ":")),
                next_status,
                processing["subtitleFinishedAt"],
                material_id,
            ),
        )
        row = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE m.id = ?
            """,
            (material_id,),
        ).fetchone()
        conn.commit()
    ok = bool(subtitle_result.get("ok") and raw_text.strip())
    return {
        "ok": ok,
        "item": serialize_simple_video_material(row),
        "subtitle": subtitle_result,
        "error": "" if ok else material_subtitle_error_message(subtitle_result.get("error") or "字幕服务暂未返回文本"),
    }


def material_subtitle_error_message(error: str) -> str:
    text = str(error or "")
    if re.search(r"ASR_API_KEY|environment|环境变量|未配置|api[_-]?key", text, re.I):
        return "字幕服务未配置完成，请检查 ASR 服务配置后重试。"
    if re.search(r"timeout|timed out|超时", text, re.I):
        return "字幕提取超时，请稍后重试。"
    if re.search(r"无法解析|解析失败|缺少视频链接", text):
        return "视频链接暂时无法解析，无法补充字幕。"
    if re.search(r"未返回字幕|字幕服务", text):
        return "字幕服务暂未返回文本，请稍后重试。"
    return text[:160] or "字幕提取失败，请稍后重试。"


def update_simple_material_tags(material_id: int, data: dict, user: dict) -> dict:
    tags = parse_simple_list(data.get("tags") or [])
    category = (data.get("category") or "").strip()
    note = (data.get("note") or "").strip()
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("m.id = ?", user, "m.owner_user_id")
    with connect() as conn:
        existing = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at
            FROM simple_video_materials m
            WHERE {where_sql}
            """,
            (material_id,) + where_params,
        ).fetchone()
        if not existing:
            raise ValueError("素材不存在")
        next_category = category if category else existing["category"]
        next_note = note if note else existing["note"]
        summary = simple_material_learning_summary(
            {
                "title": existing["title"],
                "category": next_category,
                "tags": tags,
                "rawText": existing["raw_text"],
                "note": next_note,
            }
        )
        conn.execute(
            """
            UPDATE simple_video_materials
            SET category = ?, tags_json = ?, note = ?, learning_summary_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                next_category,
                json.dumps(tags, ensure_ascii=False, separators=(",", ":")),
                next_note,
                json.dumps(summary, ensure_ascii=False, separators=(",", ":")),
                now,
                material_id,
            ),
        )
        row = conn.execute(
            f"""
            SELECT m.id, m.title, m.platform, m.url, m.account_name, m.material_type, m.category,
                   m.tags_json, m.raw_text, m.note, m.source_method, m.learning_summary_json, m.processing_json,
                   m.status, m.selected, m.use_count, m.last_used_at, m.created_at, m.updated_at,
                   {simple_agent_owner_columns("m")}
            FROM simple_video_materials m
            {simple_agent_owner_join("m")}
            WHERE m.id = ?
            """,
            (material_id,),
        ).fetchone()
        conn.commit()
    return serialize_simple_video_material(row)


def list_simple_campaigns(user: dict, limit: int = 80) -> dict:
    where_sql, where_params = simple_agent_scoped_where("", user, "c.owner_user_id")
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT c.id, c.brand_name, c.campaign_name, c.product_name, c.selling_points_json,
                   c.activity_rules, c.price_note, c.channel_scope, c.valid_from, c.valid_to,
                   c.status, c.selected, c.created_at, c.updated_at,
                   {simple_agent_owner_columns("c")}
            FROM simple_brand_campaigns c
            {simple_agent_owner_join("c")}
            WHERE {where_sql}
            ORDER BY c.selected DESC, c.id DESC
            LIMIT ?
            """,
            where_params + (max(1, min(limit, 200)),),
        ).fetchall()
        stats = {
            "total": scalar_count(conn, f"SELECT COUNT(*) FROM simple_brand_campaigns c WHERE {where_sql}", where_params),
            "selected": scalar_count(conn, f"SELECT COUNT(*) FROM simple_brand_campaigns c WHERE {where_sql} AND selected = 1", where_params),
            "active": scalar_count(conn, f"SELECT COUNT(*) FROM simple_brand_campaigns c WHERE {where_sql} AND status = 'active'", where_params),
            "adminScope": simple_agent_is_admin(user),
        }
    return {"ok": True, "items": [serialize_simple_campaign(row) for row in rows], "stats": stats}


def list_simple_matrix_accounts(user: dict, limit: int = 80) -> dict:
    matrix_filter = """
        (a.category LIKE '品牌矩阵号%'
         OR a.category LIKE '矩阵号%'
         OR a.why_track LIKE '%品牌矩阵号%')
    """
    where_sql, where_params = simple_agent_scoped_where(matrix_filter, user, "a.owner_user_id")
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT a.id, a.platform, a.account_name, a.account_url, a.category, a.why_track,
                   a.patterns_json, a.status, a.created_at, a.updated_at,
                   {simple_agent_owner_columns("a")}
            FROM simple_reference_accounts a
            {simple_agent_owner_join("a")}
            WHERE {where_sql}
            ORDER BY a.id DESC
            LIMIT ?
            """,
            where_params + (max(1, min(limit, 200)),),
        ).fetchall()
        stats = {
            "total": scalar_count(
                conn,
                f"SELECT COUNT(*) FROM simple_reference_accounts a WHERE {where_sql}",
                where_params,
            ),
            "active": scalar_count(
                conn,
                f"SELECT COUNT(*) FROM simple_reference_accounts a WHERE {where_sql} AND a.status = 'active'",
                where_params,
            ),
            "adminScope": simple_agent_is_admin(user),
        }
    return {"ok": True, "items": [serialize_simple_reference_account(row) for row in rows], "stats": stats}


def create_simple_campaign(data: dict, user: dict) -> dict:
    brand_name = (data.get("brandName") or load_brand_name() or "").strip()
    campaign_name = (data.get("campaignName") or "").strip()
    product_name = (data.get("productName") or "").strip()
    selling_points = parse_simple_list(data.get("sellingPoints") or [])
    activity_rules = (data.get("activityRules") or "").strip()
    price_note = (data.get("priceNote") or "").strip()
    channel_scope = (data.get("channelScope") or "").strip()
    valid_from = (data.get("validFrom") or "").strip()
    valid_to = (data.get("validTo") or "").strip()
    selected = 1 if data.get("selected", True) else 0
    if not brand_name:
        raise ValueError("brandName 必须填写")
    if not product_name and not campaign_name:
        raise ValueError("campaignName 和 productName 至少填写一个")
    if not selling_points and not activity_rules:
        raise ValueError("至少填写卖点或活动规则")
    now = utc_now()
    owner_user_id = int(user["id"])
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO simple_brand_campaigns (
              brand_name, campaign_name, product_name, selling_points_json,
              activity_rules, price_note, channel_scope, valid_from, valid_to,
              status, selected, created_at, updated_at, owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                campaign_name or product_name,
                product_name,
                json.dumps(selling_points, ensure_ascii=False, separators=(",", ":")),
                activity_rules,
                price_note,
                channel_scope,
                valid_from,
                valid_to,
                "active",
                selected,
                now,
                now,
                owner_user_id,
            ),
        )
        row = conn.execute(
            f"""
            SELECT c.id, c.brand_name, c.campaign_name, c.product_name, c.selling_points_json,
                   c.activity_rules, c.price_note, c.channel_scope, c.valid_from, c.valid_to,
                   c.status, c.selected, c.created_at, c.updated_at,
                   {simple_agent_owner_columns("c")}
            FROM simple_brand_campaigns c
            {simple_agent_owner_join("c")}
            WHERE c.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return serialize_simple_campaign(row)


def update_simple_campaign(campaign_id: int, data: dict, user: dict) -> dict:
    brand_name = (data.get("brandName") or load_brand_name() or "").strip()
    campaign_name = (data.get("campaignName") or "").strip()
    product_name = (data.get("productName") or "").strip()
    selling_points = parse_simple_list(data.get("sellingPoints") or [])
    activity_rules = (data.get("activityRules") or "").strip()
    price_note = (data.get("priceNote") or "").strip()
    channel_scope = (data.get("channelScope") or "").strip()
    valid_from = (data.get("validFrom") or "").strip()
    valid_to = (data.get("validTo") or "").strip()
    selected = 1 if data.get("selected", True) else 0
    if not brand_name:
        raise ValueError("brandName 必须填写")
    if not product_name and not campaign_name:
        raise ValueError("campaignName 和 productName 至少填写一个")
    if not selling_points and not activity_rules:
        raise ValueError("至少填写卖点或活动规则")
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("c.id = ?", user, "c.owner_user_id")
    with connect() as conn:
        existing = conn.execute(f"SELECT c.id FROM simple_brand_campaigns c WHERE {where_sql}", (campaign_id,) + where_params).fetchone()
        if not existing:
            raise ValueError("品牌活动不存在")
        conn.execute(
            """
            UPDATE simple_brand_campaigns
            SET brand_name = ?, campaign_name = ?, product_name = ?, selling_points_json = ?,
                activity_rules = ?, price_note = ?, channel_scope = ?, valid_from = ?, valid_to = ?,
                selected = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                brand_name,
                campaign_name or product_name,
                product_name,
                json.dumps(selling_points, ensure_ascii=False, separators=(",", ":")),
                activity_rules,
                price_note,
                channel_scope,
                valid_from,
                valid_to,
                selected,
                now,
                campaign_id,
            ),
        )
        row = conn.execute(
            f"""
            SELECT c.id, c.brand_name, c.campaign_name, c.product_name, c.selling_points_json,
                   c.activity_rules, c.price_note, c.channel_scope, c.valid_from, c.valid_to,
                   c.status, c.selected, c.created_at, c.updated_at,
                   {simple_agent_owner_columns("c")}
            FROM simple_brand_campaigns c
            {simple_agent_owner_join("c")}
            WHERE c.id = ?
            """,
            (campaign_id,),
        ).fetchone()
        conn.commit()
    return serialize_simple_campaign(row)


def delete_simple_campaign(campaign_id: int, user: dict) -> dict:
    where_sql, where_params = simple_agent_scoped_where("c.id = ?", user, "c.owner_user_id")
    with connect() as conn:
        existing = conn.execute(f"SELECT c.id FROM simple_brand_campaigns c WHERE {where_sql}", (campaign_id,) + where_params).fetchone()
        if not existing:
            raise ValueError("品牌活动不存在")
        conn.execute("DELETE FROM simple_brand_campaigns WHERE id = ?", (campaign_id,))
        conn.commit()
    return {"id": campaign_id}


def set_simple_campaign_selected(campaign_id: int, selected: bool, user: dict) -> dict:
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("c.id = ?", user, "c.owner_user_id")
    with connect() as conn:
        existing = conn.execute(f"SELECT c.id FROM simple_brand_campaigns c WHERE {where_sql}", (campaign_id,) + where_params).fetchone()
        if not existing:
            raise ValueError("品牌活动不存在")
        conn.execute(
            "UPDATE simple_brand_campaigns SET selected = ?, updated_at = ? WHERE id = ?",
            (1 if selected else 0, now, campaign_id),
        )
        row = conn.execute(
            f"""
            SELECT c.id, c.brand_name, c.campaign_name, c.product_name, c.selling_points_json,
                   c.activity_rules, c.price_note, c.channel_scope, c.valid_from, c.valid_to,
                   c.status, c.selected, c.created_at, c.updated_at,
                   {simple_agent_owner_columns("c")}
            FROM simple_brand_campaigns c
            {simple_agent_owner_join("c")}
            WHERE c.id = ?
            """,
            (campaign_id,),
        ).fetchone()
        conn.commit()
    return serialize_simple_campaign(row)


def list_simple_templates() -> dict:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, platform, structure_json, output_style, status,
                   is_default, created_at, updated_at
            FROM simple_script_format_templates
            ORDER BY is_default DESC, id DESC
            """
        ).fetchall()
    return {"ok": True, "items": [serialize_simple_template(row) for row in rows]}


def simple_script_lines(topic: str, campaign: dict, material: dict, template: dict, index: int, quality_level: str) -> tuple[str, str, list[dict], str]:
    product_name = campaign.get("productName") or "主打商品"
    selling_points = campaign.get("sellingPoints") or []
    activity_rules = campaign.get("activityRules") or "活动规则以门店/页面为准"
    price_note = campaign.get("priceNote") or "价格、库存和权益以实际为准"
    channel_scope = campaign.get("channelScope") or "指定门店/渠道"
    summary = material.get("learningSummary") or {}
    usable = summary.get("usableParts") or []
    material_angle = summary.get("hookAngle") or material.get("category") or "参考素材结构"
    quality_hint = {
        "stable": "表达稳妥、信息完整",
        "high": "更具体、更可拍、转化更强",
        "strict": "合规优先、避免任何夸张承诺",
    }.get(quality_level, "表达稳妥、信息完整")
    title = f"{topic or product_name}｜{product_name}脚本 {index + 1}"
    hook = f"今天这条围绕「{topic or product_name}」，用「{material_angle}」切入，把重点落到{product_name}。"
    shots = [
        {
            "time": "0-3s",
            "shot": "主题字幕或门店/商品第一镜",
            "voiceover": f"今天如果你在看「{topic or product_name}」，先把这件事记住。",
            "subtitle": topic or product_name,
            "purpose": "开头抓住当天主题",
        },
        {
            "time": "3-8s",
            "shot": "参考素材的节奏转成真实场景",
            "voiceover": usable[0] if usable else f"这个角度适合用{material.get('accountName') or '参考素材'}的结构来说清楚。",
            "subtitle": material_angle,
            "purpose": "借鉴素材结构，不复制原内容",
        },
        {
            "time": "8-12s",
            "shot": "商品细节、上手/上身/使用场景",
            "voiceover": f"重点看{product_name}，{selling_points[0] if selling_points else '卖点以实际商品信息为准'}，{activity_rules}。",
            "subtitle": price_note,
            "purpose": "把商品和活动说具体",
        },
        {
            "time": "12-15s",
            "shot": "门店/渠道/购买动作收尾",
            "voiceover": f"想看同款，先到{channel_scope}确认，具体价格和库存以现场或页面为准。",
            "subtitle": "先确认，再下单",
            "purpose": "合规转化",
        },
    ]
    body = "\n".join(
        f"{shot['time']}｜镜头：{shot['shot']}｜口播：{shot['voiceover']}｜字幕：{shot['subtitle']}"
        for shot in shots
    )
    quality_notes = f"{quality_hint}；读取了商品活动、参考素材和格式模板「{template.get('name') or '默认模板'}」。"
    return title, hook, shots, quality_notes


def simple_generation_strategy_detail(strategy: str) -> dict:
    strategies = {
        "conversion": {
            "label": "转化型",
            "goal": "优先把活动规则、价格边界和购买动作说清楚，让用户知道为什么现在去看。",
            "hook": "前三秒直接抛出利益点或选择理由，不绕铺垫。",
            "style": "克制、具体、可下单，但不能硬广和夸张承诺。",
        },
        "seeding": {
            "label": "种草型",
            "goal": "优先制造真实使用/试穿/体验欲望，再自然带出活动。",
            "hook": "前三秒给场景反差、真实感受或审美判断。",
            "style": "像真实用户分享，不像促销播报。",
        },
        "store_visit": {
            "label": "到店型",
            "goal": "把到店理由、现场可看点、咨询动作和确认路径讲清楚。",
            "hook": "前三秒说明为什么值得到店看，而不是只看线上图片。",
            "style": "门店实拍、导购咨询、试穿试用动作要具体。",
        },
        "spoken": {
            "label": "口播型",
            "goal": "优先生成自然口语，适合真人对镜或边走边讲。",
            "hook": "前三秒用一句人话切入，避免书面句。",
            "style": "短句、口语、少形容词，多具体动作。",
        },
        "viral_hook": {
            "label": "爆款 Hook 型",
            "goal": "优先优化前三秒停留，用反差、疑问或场景冲突抓注意力。",
            "hook": "必须短、直接、有反差，但不能标题党和编造信息。",
            "style": "节奏快，第一句不超过 18 个中文字符。",
        },
        "compliance": {
            "label": "合规保守型",
            "goal": "优先避免价格、库存、最低价、效果承诺等风险。",
            "hook": "开头可以有吸引力，但必须保守表达。",
            "style": "所有权益以页面/门店实际为准，少用绝对语气。",
        },
        "balanced": {
            "label": "均衡型",
            "goal": "兼顾真实场景、商品卖点、活动规则和合规转化。",
            "hook": "前三秒给一个清楚的场景或利益点。",
            "style": "自然、具体、可拍、不过度营销。",
        },
    }
    return strategies.get(strategy or "balanced", strategies["balanced"])


def build_simple_codex_prompt(input_snapshot: dict, target_count: int, quality_level: str, output_mode: str) -> str:
    quality_rules = input_snapshot.get("qualityRules") if isinstance(input_snapshot.get("qualityRules"), dict) else {}
    strategy_key = quality_rules.get("generationStrategy") or quality_rules.get("strategy") or "balanced"
    strategy = simple_generation_strategy_detail(strategy_key)
    payload = {
        **input_snapshot,
        "targetCount": target_count,
        "qualityLevel": quality_level,
        "outputMode": output_mode,
        "promptVersion": SIMPLE_AGENT_PROMPT_VERSION,
        "generationStrategyDetail": strategy,
    }
    return (
        "你是一个本地生活/品牌团购短视频脚本生成器。请只基于输入生成可直接拍摄、可审核、可执行的短视频脚本。\n"
        "必须只输出 JSON，不要 Markdown，不要解释，不要在 JSON 外输出任何文字。\n"
        "JSON 格式：{\"scripts\":[{\"title\":\"\",\"hook\":\"\",\"shots\":[{\"time\":\"0-3s\",\"shot\":\"\",\"voiceover\":\"\",\"subtitle\":\"\",\"purpose\":\"\"}],\"cta\":\"\",\"quality_notes\":\"\",\"risk_notes\":\"\"}]}\n\n"
        "一、任务目标\n"
        f"- 生成 {target_count} 条脚本，输出方式为「{output_mode}」，质量要求为「{quality_level}」。\n"
        f"- 本次生成策略：{strategy['label']}。目标：{strategy['goal']} 开头策略：{strategy['hook']} 写法：{strategy['style']}\n\n"
        "二、输入优先级\n"
        "1. qualityRules.manualFeedback 优先级最高，必须响应用户本次反馈。\n"
        "2. campaigns 是硬事实来源：品牌、商品、卖点、活动规则、价格说明、渠道范围只能来自 campaigns。\n"
        "3. materials 是结构参考来源：只能学习节奏、镜头、开头、转场和表达结构，不得复制原句。\n"
        "4. template 是格式约束来源：必须遵守时间段和脚本结构。\n\n"
        "三、硬约束\n"
        "- scripts 数量必须等于 targetCount。\n"
        "- 每条脚本必须有 4 个 shots：0-3s、3-8s、8-12s、12-15s。\n"
        "- 不得编造未提供的价格、折扣、库存、赠品、核销承诺、最低价、效果承诺。\n"
        "- 如果价格边界、渠道范围或活动规则缺失，必须在口播和 risk_notes 中保守表达“以页面/门店实际为准”。\n"
        "- 输出口播必须像真实门店团购短视频：具体动作、具体画面、具体人话，不写抽象建议。\n\n"
        "四、素材学习规则\n"
        "- 优先抽取素材的 hook 类型、镜头推进、利益点顺序、CTA 方式。\n"
        "- 不得复刻素材原句、原标题、账号人设或未经授权表达。\n"
        "- 如果素材字幕不完整，只能参考标题、标签和学习摘要，不能补写不存在的内容。\n\n"
        "五、每条脚本的自检要求\n"
        "- quality_notes 必须说明：采用了什么结构、如何使用素材、如何避开风险。\n"
        "- risk_notes 必须说明：价格/渠道/库存/授权/夸张表达中需要人工复核的点。\n"
        "- hook 必须是可直接作为前三秒口播的一句话。\n\n"
        "输入 JSON：\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )


def require_simple_codex_text(value: object, field: str, script_index: int, shot_index: int | None = None) -> str:
    if not isinstance(value, str) or not value.strip():
        prefix = f"第 {script_index + 1} 条脚本"
        if shot_index is not None:
            prefix += f"第 {shot_index + 1} 个镜头"
        raise RuntimeError(f"脚本生成服务返回格式错误：{prefix}缺少 {field}")
    return value.strip()


def normalize_simple_codex_script(
    script: dict,
    script_index: int,
    output_mode: str,
    input_material_id: int,
    input_campaign_id: int,
    generator: str = "codex_cli",
) -> dict:
    raw_shots = script.get("shots") if isinstance(script.get("shots"), list) else []
    if len(raw_shots) != 4:
        raise RuntimeError(f"脚本生成服务返回格式错误：第 {script_index + 1} 条脚本必须包含 4 个 shots")
    normalized_shots = []
    for index, shot in enumerate(raw_shots):
        if not isinstance(shot, dict):
            raise RuntimeError(f"脚本生成服务返回格式错误：第 {script_index + 1} 条脚本第 {index + 1} 个 shot 必须是对象")
        normalized_shots.append(
            {
                "time": require_simple_codex_text(shot.get("time"), "time", script_index, index),
                "shot": require_simple_codex_text(shot.get("shot"), "shot", script_index, index),
                "voiceover": require_simple_codex_text(shot.get("voiceover"), "voiceover", script_index, index),
                "subtitle": require_simple_codex_text(shot.get("subtitle"), "subtitle", script_index, index),
                "purpose": require_simple_codex_text(shot.get("purpose"), "purpose", script_index, index),
            }
        )
    script_body = "\n".join(
        f"{shot['time']}｜镜头：{shot['shot']}｜口播：{shot['voiceover']}｜字幕：{shot['subtitle']}"
        for shot in normalized_shots
    )
    output_json = {
        "shots": normalized_shots,
        "cta": require_simple_codex_text(script.get("cta"), "cta", script_index),
        "riskNotes": require_simple_codex_text(script.get("risk_notes"), "risk_notes", script_index),
        "inputMaterialId": input_material_id,
        "inputCampaignId": input_campaign_id,
        "outputMode": output_mode,
        "generator": generator,
    }
    return {
        "title": require_simple_codex_text(script.get("title"), "title", script_index),
        "hook": require_simple_codex_text(script.get("hook"), "hook", script_index),
        "scriptBody": script_body,
        "outputJson": output_json,
        "qualityNotes": require_simple_codex_text(script.get("quality_notes"), "quality_notes", script_index),
    }


ABSOLUTE_CLAIM_PATTERN = re.compile(r"(全网最低|最低价|保证|保准|一定|100%|百分百|绝对|必买|闭眼入|无脑入|永久|不限量)")
UNCONFIRMED_PRICE_PATTERN = re.compile(r"(?:[¥￥]\s*\d{2,5}(?:\.\d+)?|\d{2,5}(?:\.\d+)?\s*(?:元|块|rmb|RMB)|(?:到手|只要|仅需|低至|优惠价|现价|原价|立减|直降)\s*[¥￥]?\s*\d{2,5}(?:\.\d+)?)")


def normalize_check_text(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "")).lower()


def script_contains_material_copy(script_body: str, materials: list[dict]) -> bool:
    script_norm = normalize_check_text(script_body)
    if not script_norm:
        return False
    for material in materials:
        source = material.get("rawText") or material.get("title") or ""
        source_norm = normalize_check_text(source)
        if len(source_norm) < 18:
            continue
        for start in range(0, max(1, len(source_norm) - 17), 12):
            snippet = source_norm[start:start + 22]
            if len(snippet) >= 18 and snippet in script_norm:
                return True
    return False


def script_mentions_unknown_terms(script_body: str, campaigns: list[dict]) -> list[str]:
    known_text = normalize_check_text(json.dumps(campaigns, ensure_ascii=False))
    risky_terms = ["赠品", "库存", "包邮", "免费", "买一送一", "第二件", "核销", "全国门店", "线上线下通用"]
    return [term for term in risky_terms if term in script_body and term not in known_text]


def script_has_complete_four_part_structure(shots: list[object]) -> bool:
    if len(shots) != 4:
        return False
    expected_time_markers = (("0", "3"), ("3", "8"), ("8", "12"), ("12", "15"))
    for shot, markers in zip(shots, expected_time_markers):
        if not isinstance(shot, dict):
            return False
        if not all(str(shot.get(key) or "").strip() for key in ("shot", "voiceover", "subtitle")):
            return False
        time_text = str(shot.get("time") or "")
        if not all(marker in time_text for marker in markers):
            return False
    return True


def build_simple_quality_checks(script: dict, input_snapshot: dict) -> dict:
    output = script.get("outputJson") or {}
    campaigns = input_snapshot.get("campaigns") or []
    materials = input_snapshot.get("materials") or []
    campaign = campaigns[0] if campaigns else {}
    script_body = script.get("scriptBody") or ""
    cta = output.get("cta") or ""
    risk_notes = output.get("riskNotes") or ""
    shots = output.get("shots") if isinstance(output.get("shots"), list) else []
    risk_items: list[dict] = []

    def add(level: str, code: str, label: str, suggestion: str) -> None:
        risk_items.append({"level": level, "code": code, "label": label, "suggestion": suggestion})

    if not str(campaign.get("priceNote") or "").strip():
        add("warning", "missing_price_boundary", "缺价格边界", "补充价格说明；生成时用“以页面/门店实际为准”保守表达。")
    if not str(campaign.get("channelScope") or "").strip():
        add("warning", "missing_channel_scope", "缺渠道范围", "补充适用门店、渠道或团购页范围。")
    if not str(campaign.get("activityRules") or "").strip():
        add("warning", "missing_activity_rules", "缺活动规则", "补充满减、有效期、适用款式或核销规则。")
    if not script_has_complete_four_part_structure(shots):
        add("fail", "invalid_shot_count", "4 段结构不完整", "脚本必须包含 0-3s、3-8s、8-12s、12-15s 四段，并补齐镜头、口播和字幕。")
    if not str(cta).strip():
        add("fail", "missing_cta", "缺少 CTA", "补充自然行动引导，例如到店确认、查看团购页、咨询门店。")
    if not str(risk_notes).strip():
        add("warning", "missing_risk_notes", "缺少风险提示", "补充价格、渠道、库存、授权或活动有效性复核点。")
    if ABSOLUTE_CLAIM_PATTERN.search(script_body):
        add("fail", "absolute_claim", "出现绝对化表达", "删除最低价、保证、一定、100% 等高风险表达。")
    price_note = normalize_check_text(campaign.get("priceNote") or "")
    if UNCONFIRMED_PRICE_PATTERN.search(script_body) and not price_note:
        add("warning", "unconfirmed_price", "疑似引用未确认价格", "没有价格边界时不要写具体到手价、原价、现价。")
    unknown_terms = script_mentions_unknown_terms(script_body, campaigns)
    if unknown_terms:
        add("warning", "unknown_campaign_terms", "提到输入包未确认权益", f"复核或删除：{'、'.join(unknown_terms)}。")
    if script_contains_material_copy(script_body, materials):
        add("warning", "possible_material_copy", "疑似复制素材原文", "只学习素材结构，不要复刻原句。")

    status = "pass"
    if any(item["level"] == "fail" for item in risk_items):
        status = "fail"
    elif risk_items:
        status = "warning"
    return {
        "version": "rules-v1",
        "status": status,
        "riskItems": risk_items,
        "suggestions": [item["suggestion"] for item in risk_items],
        "summary": "规则自检通过" if status == "pass" else f"发现 {len(risk_items)} 个需复核项",
    }


def attach_simple_quality_checks(script: dict, input_snapshot: dict) -> dict:
    output_json = dict(script.get("outputJson") or {})
    output_json["qualityChecks"] = build_simple_quality_checks(script, input_snapshot)
    return {**script, "outputJson": output_json}


def generate_simple_scripts_with_codex_cli(input_snapshot: dict, target_count: int, quality_level: str, output_mode: str) -> list[dict]:
    return generate_simple_scripts_with_provider(input_snapshot, target_count, quality_level, output_mode)["scripts"]


def simple_generation_provider_name() -> str:
    if SIMPLE_AGENT_GENERATOR == "image2svc_chat":
        return IMAGE2SVC_CHAT_PROVIDER
    if SIMPLE_AGENT_CODEX_SERVICE_URL:
        return SIMPLE_AGENT_CODEX_SERVICE_PROVIDER
    return "codex_cli"


def generate_simple_scripts_with_provider(input_snapshot: dict, target_count: int, quality_level: str, output_mode: str) -> dict:
    prompt = build_simple_codex_prompt(input_snapshot, target_count, quality_level, output_mode)
    if SIMPLE_AGENT_GENERATOR == "image2svc_chat":
        scripts, raw_text = generate_simple_scripts_with_image2svc_chat(prompt, input_snapshot, target_count, output_mode)
        return {"scripts": scripts, "prompt": prompt, "rawResponseText": raw_text, "generator": "image2svc_chat", "provider": IMAGE2SVC_CHAT_PROVIDER}
    if SIMPLE_AGENT_GENERATOR != "codex_cli":
        raise RuntimeError(f"当前脚本生成器未启用：SIMPLE_AGENT_GENERATOR={SIMPLE_AGENT_GENERATOR}")
    if SIMPLE_AGENT_CODEX_SERVICE_URL:
        scripts, raw_text = generate_simple_scripts_with_codex_service(prompt, input_snapshot, target_count, output_mode)
        return {"scripts": scripts, "prompt": prompt, "rawResponseText": raw_text, "generator": "codex_service", "provider": SIMPLE_AGENT_CODEX_SERVICE_PROVIDER}
    campaigns = input_snapshot.get("campaigns") or []
    materials = input_snapshot.get("materials") or []
    with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False) as output_file:
        output_path = Path(output_file.name)
    try:
        try:
            result = subprocess.run(
                [
                    DEFAULT_CODEX_BIN,
                    "--ask-for-approval",
                    "never",
                    "exec",
                    "--skip-git-repo-check",
                    "--sandbox",
                    "read-only",
                    "--output-last-message",
                    str(output_path),
                    "-",
                ],
                input=prompt,
                cwd=Path.cwd(),
                text=True,
                capture_output=True,
                check=False,
                timeout=180,
            )
        except FileNotFoundError as exc:
            raise RuntimeError(f"未找到 Codex CLI：{DEFAULT_CODEX_BIN}，请安装或设置 CODEX_BIN") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("Codex CLI 生成超时") from exc
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Codex CLI 调用失败")
        if not output_path.exists() or not output_path.read_text(encoding="utf-8").strip():
            raise RuntimeError("Codex CLI 没有写入输出结果")
        raw_text = output_path.read_text(encoding="utf-8")
        data = extract_json_object(raw_text)
        raw_scripts = data.get("scripts")
        if not isinstance(raw_scripts, list) or not raw_scripts:
            raise RuntimeError("Codex CLI 没有返回 scripts 数组")
        if len(raw_scripts) != target_count:
            raise RuntimeError(f"Codex CLI 返回脚本数量不正确：需要 {target_count} 条，实际 {len(raw_scripts)} 条")
        outputs = []
        for index in range(target_count):
            raw_script = raw_scripts[index]
            if not isinstance(raw_script, dict):
                raise RuntimeError("Codex CLI 返回的脚本格式不正确")
            campaign = campaigns[index % len(campaigns)] if campaigns else {}
            material = materials[index % len(materials)] if materials else {}
            outputs.append(
                normalize_simple_codex_script(
                    raw_script,
                    index,
                    output_mode,
                    int(material.get("id") or 0),
                    int(campaign.get("id") or 0),
                    "codex_cli",
                )
            )
        return {"scripts": outputs, "prompt": prompt, "rawResponseText": raw_text, "generator": "codex_cli", "provider": "codex_cli"}
    finally:
        try:
            output_path.unlink()
        except FileNotFoundError:
            pass


def generate_simple_scripts_with_codex_service(prompt: str, input_snapshot: dict, target_count: int, output_mode: str) -> tuple[list[dict], str]:
    endpoint = SIMPLE_AGENT_CODEX_SERVICE_URL.rstrip("/") + "/v1/chat/completions"
    payload = {
        "provider": SIMPLE_AGENT_CODEX_SERVICE_PROVIDER,
        "prompt": prompt,
        "workdir": str(Path.cwd()),
        "timeoutMs": 180000,
        "sandbox": "read-only",
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=190) as response:
            service_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Codex CLI 内部服务调用失败：HTTP {exc.code} {body[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Codex CLI 内部服务不可用：{exc.reason}") from exc
    if service_payload.get("errcode") != 0:
        raise RuntimeError(service_payload.get("errmsg") or "Codex CLI 内部服务调用失败")
    text = ((service_payload.get("data") or {}).get("text") or "").strip()
    if not text:
        raise RuntimeError("Codex CLI 内部服务没有返回文本")
    data = extract_json_object(text)
    raw_scripts = data.get("scripts")
    if not isinstance(raw_scripts, list) or not raw_scripts:
        raise RuntimeError("Codex CLI 内部服务没有返回 scripts 数组")
    if len(raw_scripts) != target_count:
        raise RuntimeError(f"Codex CLI 内部服务返回脚本数量不正确：需要 {target_count} 条，实际 {len(raw_scripts)} 条")
    campaigns = input_snapshot.get("campaigns") or []
    materials = input_snapshot.get("materials") or []
    outputs = []
    for index in range(target_count):
        raw_script = raw_scripts[index]
        if not isinstance(raw_script, dict):
            raise RuntimeError("Codex CLI 内部服务返回的脚本格式不正确")
        campaign = campaigns[index % len(campaigns)] if campaigns else {}
        material = materials[index % len(materials)] if materials else {}
        outputs.append(
            normalize_simple_codex_script(
                raw_script,
                index,
                output_mode,
                int(material.get("id") or 0),
                int(campaign.get("id") or 0),
                SIMPLE_AGENT_CODEX_SERVICE_PROVIDER,
            )
        )
    return outputs, text


def generate_simple_scripts_with_image2svc_chat(prompt: str, input_snapshot: dict, target_count: int, output_mode: str) -> tuple[list[dict], str]:
    if not IMAGE2SVC_CHAT_URL:
        raise RuntimeError("未配置 image2svc chat 服务：请设置 IMAGE2SVC_CHAT_URL")
    endpoint = IMAGE2SVC_CHAT_URL.rstrip("/") + "/v1/chat/completions"
    payload = {
        "provider": IMAGE2SVC_CHAT_PROVIDER,
        "prompt": prompt,
        "max_output_tokens": 6000,
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=190) as response:
            service_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"image2svc chat 服务调用失败：HTTP {exc.code} {body[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"image2svc chat 服务不可用：{exc.reason}") from exc
    if service_payload.get("errcode") != 0:
        raise RuntimeError(service_payload.get("errmsg") or "image2svc chat 服务调用失败")
    text = ((service_payload.get("data") or {}).get("text") or "").strip()
    if not text:
        raise RuntimeError("image2svc chat 服务没有返回文本")
    data = extract_json_object(text)
    raw_scripts = data.get("scripts")
    if not isinstance(raw_scripts, list) or not raw_scripts:
        raise RuntimeError("image2svc chat 服务没有返回 scripts 数组")
    if len(raw_scripts) != target_count:
        raise RuntimeError(f"image2svc chat 服务返回脚本数量不正确：需要 {target_count} 条，实际 {len(raw_scripts)} 条")
    campaigns = input_snapshot.get("campaigns") or []
    materials = input_snapshot.get("materials") or []
    outputs = []
    for index in range(target_count):
        raw_script = raw_scripts[index]
        if not isinstance(raw_script, dict):
            raise RuntimeError("image2svc chat 服务返回的脚本格式不正确")
        campaign = campaigns[index % len(campaigns)] if campaigns else {}
        material = materials[index % len(materials)] if materials else {}
        outputs.append(
            normalize_simple_codex_script(
                raw_script,
                index,
                output_mode,
                int(material.get("id") or 0),
                int(campaign.get("id") or 0),
                "image2svc_chat",
            )
        )
    return outputs, text


def create_simple_generation_job(data: dict, user: dict) -> dict:
    topic = (data.get("topic") or "").strip()
    target_count = max(1, min(int(data.get("targetCount") or 3), 10))
    quality_level = (data.get("qualityLevel") or "high").strip()
    output_mode = (data.get("outputMode") or "分镜脚本").strip()
    generation_strategy = (data.get("generationStrategy") or "balanced").strip() or "balanced"
    material_ids = [int(item) for item in (data.get("materialIds") or []) if str(item).strip()]
    campaign_ids = [int(item) for item in (data.get("campaignIds") or []) if str(item).strip()]
    template_id = data.get("templateId")
    quality_rules = {
        "systemPrompt": (data.get("systemPrompt") or "").strip(),
        "generationPrompt": (data.get("generationPrompt") or "").strip(),
        "formatTemplate": (data.get("formatTemplateNote") or "").strip(),
        "qualitySamples": (data.get("qualitySamples") or "").strip(),
        "avoidRules": (data.get("avoidRules") or "").strip(),
        "manualFeedback": (data.get("manualFeedback") or "").strip(),
        "generationStrategy": generation_strategy,
    }
    quality_rules["promptControl"] = {
        "systemRole": quality_rules["systemPrompt"],
        "generationStrategy": quality_rules["generationPrompt"],
        "formatRequirement": quality_rules["formatTemplate"],
        "sampleUsage": quality_rules["qualitySamples"],
        "blockedRules": quality_rules["avoidRules"],
        "humanFeedback": quality_rules["manualFeedback"],
        "strategy": simple_generation_strategy_detail(generation_strategy),
    }
    now = utc_now()
    owner_user_id = int(user["id"])
    with connect() as conn:
        if material_ids:
            placeholders = ",".join("?" for _ in material_ids)
            scope, scope_params = simple_agent_scope_clause(user, "owner_user_id")
            scope_sql = f" AND {scope}" if scope else ""
            material_rows = conn.execute(
                f"""
                SELECT id, title, platform, url, account_name, material_type, category,
                       tags_json, raw_text, note, source_method, learning_summary_json, processing_json,
                       status, selected, use_count, last_used_at, created_at, updated_at
                FROM simple_video_materials
                WHERE id IN ({placeholders}){scope_sql}
                ORDER BY id DESC
                """,
                tuple(material_ids) + scope_params,
            ).fetchall()
        else:
            where_sql, where_params = simple_agent_scoped_where("selected = 1", user, "owner_user_id")
            material_rows = conn.execute(
                f"""
                SELECT id, title, platform, url, account_name, material_type, category,
                       tags_json, raw_text, note, source_method, learning_summary_json, processing_json,
                       status, selected, use_count, last_used_at, created_at, updated_at
                FROM simple_video_materials
                WHERE {where_sql}
                ORDER BY id DESC
                LIMIT 6
                """,
                where_params,
            ).fetchall()
        if campaign_ids:
            placeholders = ",".join("?" for _ in campaign_ids)
            scope, scope_params = simple_agent_scope_clause(user, "owner_user_id")
            scope_sql = f" AND {scope}" if scope else ""
            campaign_rows = conn.execute(
                f"""
                SELECT id, brand_name, campaign_name, product_name, selling_points_json,
                       activity_rules, price_note, channel_scope, valid_from, valid_to,
                       status, selected, created_at, updated_at
                FROM simple_brand_campaigns
                WHERE id IN ({placeholders}){scope_sql}
                ORDER BY id DESC
                """,
                tuple(campaign_ids) + scope_params,
            ).fetchall()
        else:
            where_sql, where_params = simple_agent_scoped_where("selected = 1", user, "owner_user_id")
            campaign_rows = conn.execute(
                f"""
                SELECT id, brand_name, campaign_name, product_name, selling_points_json,
                       activity_rules, price_note, channel_scope, valid_from, valid_to,
                       status, selected, created_at, updated_at
                FROM simple_brand_campaigns
                WHERE {where_sql}
                ORDER BY id DESC
                LIMIT 4
                """,
                where_params,
            ).fetchall()
        if template_id:
            template_row = conn.execute(
                """
                SELECT id, name, platform, structure_json, output_style, status,
                       is_default, created_at, updated_at
                FROM simple_script_format_templates
                WHERE id = ?
                """,
                (int(template_id),),
            ).fetchone()
        else:
            template_row = conn.execute(
                """
                SELECT id, name, platform, structure_json, output_style, status,
                       is_default, created_at, updated_at
                FROM simple_script_format_templates
                ORDER BY is_default DESC, id DESC
                LIMIT 1
                """
            ).fetchone()
        if not material_rows:
            raise ValueError("请先在素材库选择至少 1 条参考素材")
        if not campaign_rows:
            raise ValueError("请先在品牌活动页选择至少 1 条商品/活动")
        if not template_row:
            raise ValueError("缺少脚本格式模板")
        materials = [serialize_simple_video_material(row) for row in material_rows]
        campaigns = [serialize_simple_campaign(row) for row in campaign_rows]
        template = serialize_simple_template(template_row)
        input_snapshot = {
            "topic": topic,
            "materials": materials,
            "campaigns": campaigns,
            "template": template,
            "qualityRules": quality_rules,
        }
        cursor = conn.execute(
            """
            INSERT INTO simple_generation_jobs (
              topic, target_count, quality_level, output_mode, campaign_ids_json,
              material_ids_json, template_id, quality_rules_json, input_snapshot_json,
              status, created_at, updated_at, owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                topic,
                target_count,
                quality_level,
                output_mode,
                json.dumps([item["id"] for item in campaigns], separators=(",", ":")),
                json.dumps([item["id"] for item in materials], separators=(",", ":")),
                template["id"],
                json.dumps(quality_rules, ensure_ascii=False, separators=(",", ":")),
                json.dumps(input_snapshot, ensure_ascii=False, separators=(",", ":")),
                "done",
                now,
                now,
                owner_user_id,
            ),
        )
        job_id = cursor.lastrowid
        rendered_prompt = build_simple_codex_prompt(input_snapshot, target_count, quality_level, output_mode)
        log_id = create_simple_generation_log(conn, job_id, owner_user_id, input_snapshot, target_count, quality_level, output_mode, rendered_prompt)
        started_at = time.monotonic()
        try:
            generation_result = generate_simple_scripts_with_provider(input_snapshot, target_count, quality_level, output_mode)
            generated_scripts = generation_result["scripts"]
            update_simple_generation_log(
                conn,
                log_id,
                "success",
                int((time.monotonic() - started_at) * 1000),
                generation_result.get("rawResponseText") or "",
                "",
            )
        except Exception as exc:
            update_simple_generation_log(conn, log_id, "failed", int((time.monotonic() - started_at) * 1000), "", str(exc))
            conn.execute("UPDATE simple_generation_jobs SET status = ?, updated_at = ? WHERE id = ?", ("failed", utc_now(), job_id))
            conn.commit()
            raise
        outputs = []
        for script in generated_scripts:
            script = attach_simple_quality_checks(script, input_snapshot)
            score = 90 if quality_level == "strict" else (88 if quality_level == "high" else 84)
            out_cursor = conn.execute(
                """
                INSERT INTO simple_script_outputs (
                  job_id, title, hook, script_body, output_json, quality_score,
                  quality_notes, review_status, review_note, is_quality_sample,
                  created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 0, ?, ?)
                """,
                (
                    job_id,
                    script["title"],
                    script["hook"],
                    script["scriptBody"],
                    json.dumps(script["outputJson"], ensure_ascii=False, separators=(",", ":")),
                    score,
                    script["qualityNotes"],
                    "new",
                    now,
                    now,
                ),
            )
            output_row = conn.execute(
                """
                SELECT id, job_id, title, hook, script_body, output_json, quality_score,
                       quality_notes, review_status, review_note, is_quality_sample,
                       feishu_record_id, feishu_sync_status, feishu_sync_error, feishu_synced_at,
                   created_at, updated_at,
                   ? AS generation_log_json
                FROM simple_script_outputs
                WHERE id = ?
                """,
                (json.dumps(latest_simple_generation_log(conn, job_id), ensure_ascii=False, separators=(",", ":")), out_cursor.lastrowid),
            ).fetchone()
            outputs.append(serialize_simple_script_output(output_row))
        for material in materials:
            conn.execute(
                """
                UPDATE simple_video_materials
                SET use_count = use_count + 1, last_used_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (now, now, material["id"]),
            )
        conn.commit()
    return {"ok": True, "jobId": job_id, "inputSnapshot": input_snapshot, "outputs": outputs}


def list_simple_generation_outputs(user: dict, limit: int = 30) -> dict:
    where_sql, where_params = simple_agent_scoped_where("", user, "j.owner_user_id")
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT o.id, o.job_id, o.title, o.hook, o.script_body, o.output_json, o.quality_score,
                   o.quality_notes, o.review_status, o.review_note, o.is_quality_sample,
                   o.feishu_record_id, o.feishu_sync_status, o.feishu_sync_error, o.feishu_synced_at,
                   o.created_at, o.updated_at,
                   {simple_generation_log_sql("o")},
                   {simple_agent_owner_columns("j")}
            FROM simple_script_outputs o
            JOIN simple_generation_jobs j ON j.id = o.job_id
            {simple_agent_owner_join("j")}
            WHERE {where_sql}
            ORDER BY o.id DESC
            LIMIT ?
            """,
            where_params + (max(1, min(limit, 100)),),
        ).fetchall()
        jobs = conn.execute(
            f"""
            SELECT j.id, j.topic, j.target_count, j.quality_level, j.output_mode,
                   j.campaign_ids_json, j.material_ids_json, j.template_id,
                   j.quality_rules_json, j.input_snapshot_json, j.status, j.created_at, j.updated_at,
                   {simple_agent_owner_columns("j")}
            FROM simple_generation_jobs j
            {simple_agent_owner_join("j")}
            WHERE {where_sql}
            ORDER BY j.id DESC
            LIMIT 10
            """,
            where_params,
        ).fetchall()
    return {
        "ok": True,
        "items": [serialize_simple_script_output(row) for row in rows],
        "library": simple_script_library_public_info(),
        "jobs": [
            {
                "id": row["id"],
                "topic": row["topic"],
                "targetCount": row["target_count"],
                "qualityLevel": row["quality_level"],
                "outputMode": row["output_mode"],
                "qualityRules": json_loads_fallback(row["quality_rules_json"], {}),
                "inputSnapshot": json_loads_fallback(row["input_snapshot_json"], {}),
                "status": row["status"],
                "createdAt": row["created_at"],
                "owner": simple_agent_user_brief(row),
            }
            for row in jobs
        ],
    }


def review_simple_script_output(output_id: int, data: dict, user: dict) -> dict:
    status = (data.get("reviewStatus") or data.get("status") or "new").strip()
    if status not in {"new", "adopted", "needs_edit", "rejected"}:
        raise ValueError("reviewStatus 必须是 new/adopted/needs_edit/rejected")
    note = (data.get("reviewNote") or data.get("note") or "").strip()
    is_quality_sample = 1 if data.get("isQualitySample") else 0
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("o.id = ?", user, "j.owner_user_id")
    with connect() as conn:
        existing = conn.execute(
            f"""
            SELECT o.id, o.feishu_record_id, o.feishu_sync_status
            FROM simple_script_outputs o
            JOIN simple_generation_jobs j ON j.id = o.job_id
            WHERE {where_sql}
            """,
            (output_id,) + where_params,
        ).fetchone()
        if not existing:
            raise ValueError("脚本不存在")
        conn.execute(
            """
            UPDATE simple_script_outputs
            SET review_status = ?, review_note = ?, is_quality_sample = CASE WHEN ? = 1 THEN 1 ELSE is_quality_sample END,
                updated_at = ?
            WHERE id = ?
            """,
            (status, note, is_quality_sample, now, output_id),
        )
        row = conn.execute(
            f"""
            SELECT o.id, o.job_id, o.title, o.hook, o.script_body, o.output_json, o.quality_score,
                   o.quality_notes, o.review_status, o.review_note, o.is_quality_sample,
                   o.feishu_record_id, o.feishu_sync_status, o.feishu_sync_error, o.feishu_synced_at,
                   o.created_at, o.updated_at,
                   {simple_agent_owner_columns("j")}
            FROM simple_script_outputs o
            JOIN simple_generation_jobs j ON j.id = o.job_id
            {simple_agent_owner_join("j")}
            WHERE o.id = ?
            """,
            (output_id,),
        ).fetchone()
        conn.commit()
    item = serialize_simple_script_output(row)
    if status == "adopted":
        if existing["feishu_sync_status"] == "synced" and existing["feishu_record_id"]:
            item["feishuSync"] = {
                "ok": True,
                "recordId": existing["feishu_record_id"],
                "skipped": True,
            }
            return item
        try:
            item["feishuSync"] = sync_simple_script_to_feishu_base(output_id)
            with connect() as conn:
                refreshed = conn.execute(
                    f"""
                    SELECT o.id, o.job_id, o.title, o.hook, o.script_body, o.output_json, o.quality_score,
                           o.quality_notes, o.review_status, o.review_note, o.is_quality_sample,
                           o.feishu_record_id, o.feishu_sync_status, o.feishu_sync_error, o.feishu_synced_at,
                           o.created_at, o.updated_at,
                           {simple_agent_owner_columns("j")}
                    FROM simple_script_outputs o
                    JOIN simple_generation_jobs j ON j.id = o.job_id
                    {simple_agent_owner_join("j")}
                    WHERE o.id = ?
                    """,
                    (output_id,),
                ).fetchone()
            item = serialize_simple_script_output(refreshed)
            item["feishuSync"] = {"ok": True, "recordId": item.get("feishuRecordId", "")}
        except Exception as exc:
            error = str(exc)
            mark_simple_script_feishu_sync_failed(output_id, error)
            raise RuntimeError(f"脚本已标记为采用，但同步飞书脚本库失败：{error}") from exc
    return item


def regenerate_simple_script_output(output_id: int, data: dict, user: dict) -> dict:
    feedback = (data.get("manualFeedback") or data.get("reviewNote") or data.get("note") or "").strip()
    now = utc_now()
    where_sql, where_params = simple_agent_scoped_where("o.id = ?", user, "j.owner_user_id")
    with connect() as conn:
        source = conn.execute(
            f"""
            SELECT o.id, o.job_id, o.title, o.hook, o.script_body, o.output_json,
                   o.quality_score, o.quality_notes, o.review_status, o.review_note,
                   o.is_quality_sample, o.created_at, o.updated_at,
                   j.topic, j.quality_level, j.output_mode, j.campaign_ids_json,
                   j.material_ids_json, j.template_id, j.quality_rules_json,
                   j.input_snapshot_json, j.owner_user_id
            FROM simple_script_outputs o
            JOIN simple_generation_jobs j ON j.id = o.job_id
            WHERE {where_sql}
            """,
            (output_id,) + where_params,
        ).fetchone()
    if not source:
        raise ValueError("脚本不存在")

    input_snapshot = json_loads_fallback(source["input_snapshot_json"], {})
    if not isinstance(input_snapshot, dict):
        input_snapshot = {}
    quality_rules = json_loads_fallback(source["quality_rules_json"], {})
    if not isinstance(quality_rules, dict):
        quality_rules = {}
    snapshot_rules = input_snapshot.get("qualityRules")
    if isinstance(snapshot_rules, dict):
        quality_rules.update(snapshot_rules)

    review_note = feedback or source["review_note"] or "用户标记为待改，请基于原脚本重新生成一版。"
    source_brief = "\n".join(
        [
            f"原脚本ID：{source['id']}",
            f"原标题：{source['title']}",
            f"原开头：{source['hook']}",
            f"待改反馈：{review_note}",
            "要求：保留已确认的品牌、商品、活动、价格和渠道边界，不要新增未经确认的信息；重写结构、开头和表达。",
        ]
    )
    previous_feedback = (quality_rules.get("manualFeedback") or "").strip()
    quality_rules["manualFeedback"] = "\n\n".join(item for item in [previous_feedback, source_brief] if item)
    quality_rules["rewriteSource"] = {
        "sourceOutputId": source["id"],
        "title": source["title"],
        "hook": source["hook"],
        "reviewNote": review_note,
    }
    prompt_control = quality_rules.get("promptControl") if isinstance(quality_rules.get("promptControl"), dict) else {}
    prompt_control["humanFeedback"] = quality_rules["manualFeedback"]
    quality_rules["promptControl"] = prompt_control

    input_snapshot = {**input_snapshot, "qualityRules": quality_rules}
    input_snapshot["rewriteTarget"] = {
        "sourceOutputId": source["id"],
        "title": source["title"],
        "hook": source["hook"],
        "scriptBody": source["script_body"],
        "reviewNote": review_note,
    }

    with connect() as conn:
        job_cursor = conn.execute(
            """
            INSERT INTO simple_generation_jobs (
              topic, target_count, quality_level, output_mode, campaign_ids_json,
              material_ids_json, template_id, quality_rules_json, input_snapshot_json,
              status, created_at, updated_at, owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source["topic"],
                1,
                source["quality_level"],
                source["output_mode"],
                source["campaign_ids_json"],
                source["material_ids_json"],
                source["template_id"],
                json.dumps(quality_rules, ensure_ascii=False, separators=(",", ":")),
                json.dumps(input_snapshot, ensure_ascii=False, separators=(",", ":")),
                "done",
                now,
                now,
                source["owner_user_id"],
            ),
        )
        job_id = job_cursor.lastrowid
        rendered_prompt = build_simple_codex_prompt(input_snapshot, 1, source["quality_level"], source["output_mode"])
        log_id = create_simple_generation_log(
            conn,
            job_id,
            int(source["owner_user_id"]),
            input_snapshot,
            1,
            source["quality_level"],
            source["output_mode"],
            rendered_prompt,
        )
        started_at = time.monotonic()
        try:
            generation_result = generate_simple_scripts_with_provider(input_snapshot, 1, source["quality_level"], source["output_mode"])
            script = generation_result["scripts"][0]
            update_simple_generation_log(
                conn,
                log_id,
                "success",
                int((time.monotonic() - started_at) * 1000),
                generation_result.get("rawResponseText") or "",
                "",
            )
        except Exception as exc:
            update_simple_generation_log(conn, log_id, "failed", int((time.monotonic() - started_at) * 1000), "", str(exc))
            conn.execute("UPDATE simple_generation_jobs SET status = ?, updated_at = ? WHERE id = ?", ("failed", utc_now(), job_id))
            conn.commit()
            raise
        score = 90 if source["quality_level"] == "strict" else (88 if source["quality_level"] == "high" else 84)
        script = attach_simple_quality_checks(script, input_snapshot)
        output_cursor = conn.execute(
            """
            INSERT INTO simple_script_outputs (
              job_id, title, hook, script_body, output_json, quality_score,
              quality_notes, review_status, review_note, is_quality_sample,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'new', '', 0, ?, ?)
            """,
            (
                job_id,
                script["title"],
                script["hook"],
                script["scriptBody"],
                json.dumps(script["outputJson"], ensure_ascii=False, separators=(",", ":")),
                score,
                script["qualityNotes"],
                now,
                now,
            ),
        )
        row = conn.execute(
            f"""
            SELECT o.id, o.job_id, o.title, o.hook, o.script_body, o.output_json, o.quality_score,
                   o.quality_notes, o.review_status, o.review_note, o.is_quality_sample,
                   o.feishu_record_id, o.feishu_sync_status, o.feishu_sync_error, o.feishu_synced_at,
                   o.created_at, o.updated_at,
                   {simple_generation_log_sql("o")},
                   {simple_agent_owner_columns("j")}
            FROM simple_script_outputs o
            JOIN simple_generation_jobs j ON j.id = o.job_id
            {simple_agent_owner_join("j")}
            WHERE o.id = ?
            """,
            (output_cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return {"ok": True, "sourceId": output_id, "jobId": job_id, "item": serialize_simple_script_output(row)}


def serialize_workday(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "brandName": row["brand_name"],
        "date": row["work_date"],
        "status": row["status"],
        "note": row["note"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def get_or_create_today_workday(conn: sqlite3.Connection, brand_name: str, note: str = "") -> dict:
    work_date = current_workday_date()
    now = utc_now()
    row = conn.execute(
        """
        SELECT id, brand_name, work_date, status, note, created_at, updated_at
        FROM workdays
        WHERE brand_name = ? AND work_date = ?
        """,
        (brand_name, work_date),
    ).fetchone()
    if not row:
        conn.execute(
            """
            INSERT INTO workdays (brand_name, work_date, status, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (brand_name, work_date, "open", note, now, now),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, brand_name, work_date, status, note, created_at, updated_at
            FROM workdays
            WHERE brand_name = ? AND work_date = ?
            """,
            (brand_name, work_date),
        ).fetchone()
    return serialize_workday(row)


def today_workday() -> dict:
    brand_name = load_brand_name()
    with connect() as conn:
        workday = get_or_create_today_workday(conn, brand_name)
    return {"ok": True, "workday": workday}


def serialize_operation_handoff(row: sqlite3.Row) -> dict:
    try:
        payload = json.loads(row["payload_json"] or "{}")
    except json.JSONDecodeError:
        payload = {}
    item = {
        "id": row["id"],
        "brandName": row["brand_name"],
        "workdayDate": row["workday_date"],
        "source": row["source"],
        "status": row["status"],
        "summary": row["summary"],
        "payload": payload,
        "note": row["note"],
        "owner": row["owner"] if "owner" in row.keys() else "运营",
        "processStatus": row["process_status"] if "process_status" in row.keys() else "pending",
        "processStatusLabel": handoff_process_status_text(row["process_status"] if "process_status" in row.keys() else "pending"),
        "processNote": row["process_note"] if "process_note" in row.keys() else "",
        "processedAt": row["processed_at"] if "processed_at" in row.keys() else "",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }
    item["archiveText"] = operation_handoff_archive_text(item)
    return item


def operation_handoff_archive_text(item: dict) -> str:
    payload = item.get("payload") or {}
    reminder = payload.get("workdayOpeningReminder") or {}
    daily_review = payload.get("collectionDailyReview") or {}
    priorities = payload.get("nextDayPriorities") or []
    checkpoints = daily_review.get("checkpoints") or []
    rules = daily_review.get("rules") or payload.get("rules") or []
    lines = [
        f"# 运营交接记录｜{item.get('workdayDate') or ''}",
        "",
        f"品牌：{item.get('brandName') or ''}",
        f"状态：{item.get('status') or 'unknown'}",
        f"负责人：{item.get('owner') or '运营'}",
        f"处理状态：{item.get('processStatusLabel') or handoff_process_status_text(item.get('processStatus'))}",
        f"处理备注：{item.get('processNote') or '无'}",
        f"生成时间：{item.get('createdAt') or ''}",
        f"备注：{item.get('note') or '无'}",
        "",
        "## 开工提醒",
        reminder.get("headline") or "开工提醒",
        reminder.get("summary") or item.get("summary") or "",
        "",
        "## 优先处理",
    ]
    if priorities:
        for index, priority in enumerate(priorities, start=1):
            lines.extend([
                f"{index}. {priority.get('title') or '待处理事项'}",
                f"   - 状态：{priority.get('statusLabel') or priority.get('status') or '待判断'}",
                f"   - 证据：{priority.get('evidence') or '暂无'}",
                f"   - 动作：{priority.get('action') or '去处理'}",
                f"   - 入口：{priority.get('href') or '#'}",
            ])
    else:
        lines.append("暂无高优先级遗留项。")
    lines.extend(["", "## 日终检查项"])
    if checkpoints:
        for checkpoint in checkpoints:
            lines.append(f"- {checkpoint.get('title') or '检查项'}：{checkpoint.get('statusLabel') or checkpoint.get('status') or '待判断'}｜{checkpoint.get('evidence') or ''}")
    else:
        lines.append("- 暂无检查项。")
    lines.extend(["", "## 规则"])
    if rules:
        lines.extend([f"- {rule}" for rule in rules])
    else:
        lines.append("- 交接记录是快照，不会自动修改业务状态。")
    return "\n".join(lines).strip()


def handoff_process_status_text(value: str) -> str:
    return {
        "pending": "待处理",
        "processing": "处理中",
        "done": "已处理",
        "archived": "已归档",
    }.get(value or "", value or "待处理")


def list_operation_handoffs(limit: int = 5) -> dict:
    brand_name = load_brand_name()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, brand_name, workday_date, source, status, summary,
                   payload_json, note, owner, process_status, process_note,
                   processed_at, created_at, updated_at
            FROM operation_handoffs
            WHERE brand_name = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (brand_name, limit),
        ).fetchall()
    return {"ok": True, "items": [serialize_operation_handoff(row) for row in rows]}


def get_operation_handoff(handoff_id: int) -> dict:
    brand_name = load_brand_name()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, brand_name, workday_date, source, status, summary,
                   payload_json, note, owner, process_status, process_note,
                   processed_at, created_at, updated_at
            FROM operation_handoffs
            WHERE id = ? AND brand_name = ?
            """,
            (handoff_id, brand_name),
        ).fetchone()
    if not row:
        raise ValueError("交接记录不存在")
    return {"ok": True, "item": serialize_operation_handoff(row)}


def create_operation_handoff(data: dict) -> dict:
    dashboard = v2_dashboard()
    brand_name = data.get("brandName") or load_brand_name()
    workday = dashboard.get("workday") or {}
    reminder = dashboard.get("workdayOpeningReminder") or {}
    daily_review = dashboard.get("collectionDailyReview") or {}
    note = (data.get("note") or "").strip()
    source = (data.get("source") or "opening_reminder").strip()
    now = utc_now()
    payload = {
        "workday": workday,
        "workdayOpeningReminder": reminder,
        "collectionDailyReview": daily_review,
        "nextDayPriorities": reminder.get("priorities") or daily_review.get("nextDayPriorities") or [],
        "generatedAt": now,
        "rule": "交接记录是当前提醒和复盘的快照，不会自动修改业务状态。",
    }
    summary = reminder.get("summary") or daily_review.get("summary") or "运营交接记录"
    status = reminder.get("level") or daily_review.get("level") or "unknown"
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO operation_handoffs (
              brand_name, workday_date, source, status, summary,
              payload_json, note, owner, process_status, process_note, processed_at,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                workday.get("date") or current_workday_date(),
                source,
                status,
                summary,
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                note,
                (data.get("owner") or "运营").strip(),
                data.get("processStatus") or "pending",
                (data.get("processNote") or "").strip(),
                "",
                now,
                now,
            ),
        )
        row = conn.execute(
            """
            SELECT id, brand_name, workday_date, source, status, summary,
                   payload_json, note, owner, process_status, process_note,
                   processed_at, created_at, updated_at
            FROM operation_handoffs
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return {"ok": True, "item": serialize_operation_handoff(row)}


def update_operation_handoff_process(handoff_id: int, data: dict) -> dict:
    brand_name = load_brand_name()
    process_status = (data.get("processStatus") or "").strip()
    if process_status not in {"pending", "processing", "done", "archived"}:
        raise ValueError("交接处理状态无效")
    owner = (data.get("owner") or "运营").strip() or "运营"
    process_note = (data.get("processNote") or "").strip()
    now = utc_now()
    processed_at = now if process_status in {"done", "archived"} else ""
    with connect() as conn:
        exists = conn.execute(
            """
            SELECT id
            FROM operation_handoffs
            WHERE id = ? AND brand_name = ?
            """,
            (handoff_id, brand_name),
        ).fetchone()
        if not exists:
            raise ValueError("交接记录不存在")
        conn.execute(
            """
            UPDATE operation_handoffs
            SET owner = ?, process_status = ?, process_note = ?,
                processed_at = ?, updated_at = ?
            WHERE id = ? AND brand_name = ?
            """,
            (owner, process_status, process_note, processed_at, now, handoff_id, brand_name),
        )
        row = conn.execute(
            """
            SELECT id, brand_name, workday_date, source, status, summary,
                   payload_json, note, owner, process_status, process_note,
                   processed_at, created_at, updated_at
            FROM operation_handoffs
            WHERE id = ? AND brand_name = ?
            """,
            (handoff_id, brand_name),
        ).fetchone()
        conn.commit()
    return {"ok": True, "item": serialize_operation_handoff(row)}


def reset_today_workday(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    note = (data.get("note") or "运营手动开启新一轮今日工作流").strip()
    work_date = current_workday_date()
    now = utc_now()
    with connect() as conn:
        workday = get_or_create_today_workday(conn, brand_name, note)
        conn.execute(
            """
            UPDATE workdays
            SET status = 'open', note = ?, updated_at = ?
            WHERE id = ?
            """,
            (note, now, workday["id"]),
        )
        conn.execute(
            """
            UPDATE operator_video_selections
            SET selected = 0, updated_at = ?
            WHERE brand_name = ?
            """,
            (now, brand_name),
        )
        conn.execute(
            """
            UPDATE content_sources
            SET selected = 0, updated_at = ?
            WHERE brand_name = ? AND workday_date = ?
            """,
            (now, brand_name, work_date),
        )
        conn.execute(
            """
            UPDATE brand_products
            SET selected = 0, updated_at = ?
            WHERE brand_name = ?
            """,
            (now, brand_name),
        )
        row = conn.execute(
            """
            SELECT id, brand_name, work_date, status, note, created_at, updated_at
            FROM workdays
            WHERE id = ?
            """,
            (workday["id"],),
        ).fetchone()
        conn.commit()
    return {
        "ok": True,
        "workday": serialize_workday(row),
        "reset": {
            "clearedSelections": True,
            "clearedTodayContentSourceSelection": True,
            "clearedSelectedProducts": True,
            "keptHistoryScripts": True,
        },
    }


def close_today_workday(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    note = (data.get("note") or "今日工作日已结束").strip()
    with connect() as conn:
        workday = get_or_create_today_workday(conn, brand_name, note)
        now = utc_now()
        conn.execute(
            """
            UPDATE workdays
            SET status = 'closed', note = ?, updated_at = ?
            WHERE id = ?
            """,
            (note, now, workday["id"]),
        )
        row = conn.execute(
            """
            SELECT id, brand_name, work_date, status, note, created_at, updated_at
            FROM workdays
            WHERE id = ?
            """,
            (workday["id"],),
        ).fetchone()
        conn.commit()
    dashboard = v2_dashboard()
    return {"ok": True, "workday": serialize_workday(row), "dailyReview": dashboard.get("collectionDailyReview")}


def serialize_structure(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    try:
        structure = json.loads(row["structure_json"] or "{}")
    except json.JSONDecodeError:
        structure = {}
    return {
        "id": row["id"],
        "sourceId": row["source_id"],
        "status": row["status"],
        "error": row["error"],
        "structure": structure,
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def latest_content_structure(conn: sqlite3.Connection, source_id: int) -> dict | None:
    row = conn.execute(
        """
        SELECT id, source_id, brand_name, structure_json, status, error,
               created_at, updated_at
        FROM content_structures
        WHERE source_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (source_id,),
    ).fetchone()
    return serialize_structure(row)


def serialize_subtitle_job(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    try:
        response = json.loads(row["response_json"] or "{}")
    except json.JSONDecodeError:
        response = {}
    try:
        segments = json.loads(row["segments_json"] or "[]")
    except json.JSONDecodeError:
        segments = []
    return {
        "id": row["id"],
        "sourceId": row["source_id"],
        "platform": row["platform"],
        "videoUrl": row["video_url"],
        "engine": row["engine"],
        "status": row["status"],
        "response": response,
        "text": row["text"],
        "textLength": len(row["text"] or ""),
        "segmentCount": len(segments),
        "error": row["error"],
        "fallbackAction": row["fallback_action"],
        "startedAt": row["started_at"],
        "finishedAt": row["finished_at"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def latest_subtitle_job(conn: sqlite3.Connection, source_id: int) -> dict | None:
    row = conn.execute(
        """
        SELECT id, source_id, brand_name, platform, video_url, engine, status,
               request_json, response_json, text, segments_json, error,
               fallback_action, started_at, finished_at, created_at, updated_at
        FROM subtitle_jobs
        WHERE source_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (source_id,),
    ).fetchone()
    return serialize_subtitle_job(row)


def subtitle_job_status_label(status: str | None) -> str:
    return {
        "not_started": "未提取",
        "running": "提取中",
        "success": "已提取",
        "failed": "提取失败",
        "no_url": "无链接",
    }.get(status or "", status or "未知")


def serialize_content_source(row: sqlite3.Row, structure: dict | None = None, subtitle_job: dict | None = None) -> dict:
    real_material_reason = content_source_exclusion_reason(row)
    item = {
        "id": row["id"],
        "workdayDate": row["workday_date"],
        "brandName": row["brand_name"],
        "platform": row["platform"],
        "sourceType": row["source_type"],
        "title": row["title"],
        "url": row["url"],
        "accountName": row["account_name"],
        "rawText": row["raw_text"],
        "note": row["note"],
        "importMethod": row["import_method"],
        "status": row["status"],
        "selected": bool(row["selected"]) if "selected" in row.keys() else False,
        "benchmarkUpdateTaskId": row["benchmark_update_task_id"] if "benchmark_update_task_id" in row.keys() else None,
        "isOperationalReal": not bool(real_material_reason),
        "realMaterialStatus": "excluded" if real_material_reason else "operational_real",
        "realMaterialStatusLabel": "不计入真实闭环" if real_material_reason else "真实运营素材",
        "realMaterialReason": real_material_reason,
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }
    item["structure"] = structure
    item["subtitleJob"] = subtitle_job
    return item


def benchmark_task_summary(conn: sqlite3.Connection, task_id: int | None, account_name: str | None = None) -> dict | None:
    if not task_id and not account_name:
        return None
    if task_id:
        row = conn.execute(
            """
            SELECT id, workday_date, brand_name, account_id, platform, account_name,
                   account_handle, target_count, status, note, created_at, updated_at
            FROM benchmark_update_tasks
            WHERE id = ?
            """,
            (task_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT id, workday_date, brand_name, account_id, platform, account_name,
                   account_handle, target_count, status, note, created_at, updated_at
            FROM benchmark_update_tasks
            WHERE account_name = ?
            ORDER BY workday_date DESC, id DESC
            LIMIT 1
            """,
            (account_name,),
        ).fetchone()
    if not row:
        return None
    task = serialize_benchmark_update_task(conn, row)
    return {
        "id": task["id"],
        "accountName": task["accountName"],
        "platform": task["platform"],
        "status": task["status"],
        "statusLabel": task["statusLabel"],
        "targetCount": task["targetCount"],
        "importedCount": task["importedCount"],
        "structuredCount": task["structuredCount"],
        "category": task["category"],
        "whyTrack": task["whyTrack"],
        "nextAction": task["nextAction"],
    }


def attach_benchmark_task(conn: sqlite3.Connection, item: dict) -> dict:
    item["benchmarkTask"] = benchmark_task_summary(
        conn,
        item.get("benchmarkUpdateTaskId"),
        item.get("accountName"),
    )
    return item


def serialize_brand_product(row: sqlite3.Row) -> dict:
    try:
        selling_points = json.loads(row["selling_points_json"] or "[]")
    except json.JSONDecodeError:
        selling_points = []
    return {
        "id": row["id"],
        "brandName": row["brand_name"],
        "productName": row["product_name"],
        "productGroup": row["product_group"],
        "sellingPoints": selling_points,
        "activityRules": row["activity_rules"],
        "priceNote": row["price_note"],
        "storeScope": row["store_scope"],
        "validFrom": row["valid_from"],
        "validTo": row["valid_to"],
        "status": row["status"],
        "selected": bool(row["selected"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_brand_products(limit: int = 20) -> list[dict]:
    brand_name = load_brand_name()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, brand_name, product_name, product_group, selling_points_json,
                   activity_rules, price_note, store_scope, valid_from, valid_to,
                   status, selected, created_at, updated_at
            FROM brand_products
            WHERE brand_name = ?
            ORDER BY selected DESC, id DESC
            LIMIT ?
            """,
            (brand_name, limit),
        ).fetchall()
    return [serialize_brand_product(row) for row in rows]


def create_brand_product(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    product_name = (data.get("productName") or "").strip()
    product_group = (data.get("productGroup") or "").strip()
    activity_rules = (data.get("activityRules") or "").strip()
    price_note = (data.get("priceNote") or "").strip()
    store_scope = (data.get("storeScope") or "").strip()
    valid_from = (data.get("validFrom") or "").strip()
    valid_to = (data.get("validTo") or "").strip()
    selected = 1 if data.get("selected", True) else 0
    selling_points_raw = data.get("sellingPoints") or []
    if isinstance(selling_points_raw, str):
        selling_points = [item.strip() for item in selling_points_raw.replace("，", ",").split(",") if item.strip()]
    elif isinstance(selling_points_raw, list):
        selling_points = [str(item).strip() for item in selling_points_raw if str(item).strip()]
    else:
        raise ValueError("sellingPoints 必须是数组或逗号分隔文本")
    if not product_name:
        raise ValueError("productName 必须填写")
    if not activity_rules and not selling_points:
        raise ValueError("至少填写活动规则或卖点")
    now = utc_now()
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO brand_products (
              brand_name, product_name, product_group, selling_points_json,
              activity_rules, price_note, store_scope, valid_from, valid_to,
              status, selected, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                product_name,
                product_group,
                json.dumps(selling_points, ensure_ascii=False, separators=(",", ":")),
                activity_rules,
                price_note,
                store_scope,
                valid_from,
                valid_to,
                "active",
                selected,
                now,
                now,
            ),
        )
        row = conn.execute(
            """
            SELECT id, brand_name, product_name, product_group, selling_points_json,
                   activity_rules, price_note, store_scope, valid_from, valid_to,
                   status, selected, created_at, updated_at
            FROM brand_products
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return serialize_brand_product(row)


def set_brand_product_selected(product_id: int, selected: bool) -> dict:
    brand_name = load_brand_name()
    now = utc_now()
    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM brand_products WHERE id = ? AND brand_name = ?",
            (product_id, brand_name),
        ).fetchone()
        if not row:
            raise ValueError("商品活动不存在")
        conn.execute(
            """
            UPDATE brand_products
            SET selected = ?, updated_at = ?
            WHERE id = ? AND brand_name = ?
            """,
            (1 if selected else 0, now, product_id, brand_name),
        )
        updated = conn.execute(
            """
            SELECT id, brand_name, product_name, product_group, selling_points_json,
                   activity_rules, price_note, store_scope, valid_from, valid_to,
                   status, selected, created_at, updated_at
            FROM brand_products
            WHERE id = ?
            """,
            (product_id,),
        ).fetchone()
        conn.commit()
    return serialize_brand_product(updated)


def list_content_sources(limit: int = 20) -> list[dict]:
    brand_name = load_brand_name()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE brand_name = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (brand_name, limit),
        ).fetchall()
    with connect() as conn:
        enriched = []
        for row in rows:
            enriched.append(serialize_content_source(row, latest_content_structure(conn, row["id"]), latest_subtitle_job(conn, row["id"])))
    return enriched


def build_subtitle_readiness(items: list[dict], service: dict | None = None) -> dict:
    service = service or {}
    service_status = service.get("status") or "unknown"
    service_healthy = service_status == "healthy"
    counts = {
        "totalSources": len(items),
        "withUrl": 0,
        "withText": 0,
        "autoReady": 0,
        "manualNeeded": 0,
        "failedJobs": 0,
        "successfulJobs": 0,
        "readyForStructure": 0,
        "structured": 0,
    }
    queue = []
    tracked_jobs = []
    for item in items:
        has_url = bool(item.get("url"))
        has_text = bool((item.get("rawText") or "").strip())
        structure_status = (item.get("structure") or {}).get("status") or ""
        is_structured = structure_status == "structure_done"
        job = item.get("subtitleJob") or {}
        job_status = job.get("status") or ""
        if job:
            tracked_jobs.append(
                {
                    "sourceId": item.get("id"),
                    "title": item.get("title") or "未命名素材",
                    "platform": item.get("platform") or "",
                    "accountName": item.get("accountName") or "",
                    "status": job_status or "unknown",
                    "statusLabel": subtitle_job_status_label(job_status),
                    "error": job.get("error") or "",
                    "fallbackAction": job.get("fallbackAction") or "",
                    "textLength": job.get("textLength") or 0,
                    "segmentCount": job.get("segmentCount") or 0,
                    "createdAt": job.get("createdAt") or "",
                    "updatedAt": job.get("updatedAt") or "",
                }
            )
        if has_url:
            counts["withUrl"] += 1
        if has_text:
            counts["withText"] += 1
        if is_structured:
            counts["structured"] += 1
        if has_text and not is_structured:
            counts["readyForStructure"] += 1
        if job_status == "success":
            counts["successfulJobs"] += 1
        if job_status == "failed":
            counts["failedJobs"] += 1
        if not has_text and has_url and service_healthy and job_status != "failed":
            counts["autoReady"] += 1
        if not has_text and (not has_url or job_status == "failed" or not service_healthy):
            counts["manualNeeded"] += 1

        if is_structured:
            status = "structured"
            status_label = "已结构化"
            action = "加入生成工作流或进入脚本流程"
            action_type = "select"
            reason = "这条素材已经有结构摘要，可以作为脚本生成输入。"
            completion = "选中素材后，在脚本流程里确认输入并生成候选脚本。"
            priority = 4
        elif has_text:
            status = "ready_for_structure"
            status_label = "可结构化"
            action = "生成结构摘要"
            action_type = "structure"
            reason = "已经有字幕或正文，下一步要把内容拆成开头、节奏、CTA 和风险。"
            completion = "结构摘要生成成功后，可加入脚本生成输入包。"
            priority = 1
        elif has_url and job_status == "failed":
            status = "manual_needed"
            status_label = "自动失败，需手工字幕"
            action = "粘贴字幕"
            action_type = "manual_subtitle"
            reason = job.get("error") or "自动字幕任务失败。"
            completion = "粘贴旧字幕项目结果或手工字幕后，再生成结构摘要。"
            priority = 0
        elif has_url and service_healthy:
            status = "auto_ready"
            status_label = "可自动提字幕"
            action = "提取字幕"
            action_type = "subtitle_job"
            reason = "素材有链接，且本地字幕服务当前可用。"
            completion = "字幕任务成功后自动写回内容池；失败则改走手工字幕。"
            priority = 2
        elif has_url:
            status = "manual_or_retry"
            status_label = "服务不可用，先手工兜底"
            action = "粘贴字幕或修复服务后重试"
            action_type = "manual_subtitle"
            reason = service.get("summary") or "本地字幕服务当前不可用。"
            completion = "先补字幕可继续生产；服务恢复后也可以重新提取字幕。"
            priority = 2
        else:
            status = "manual_needed"
            status_label = "缺字幕"
            action = "粘贴字幕或正文"
            action_type = "manual_subtitle"
            reason = "这条素材没有视频链接，不能自动提取字幕。"
            completion = "补齐字幕或正文后，再生成结构摘要。"
            priority = 0

        queue.append(
            {
                "sourceId": item.get("id"),
                "title": item.get("title") or "未命名素材",
                "platform": item.get("platform") or "",
                "accountName": item.get("accountName") or "",
                "status": status,
                "statusLabel": status_label,
                "action": action,
                "actionType": action_type,
                "reason": reason,
                "completion": completion,
                "href": f"#content-source-{item.get('id')}",
                "priority": priority,
            }
        )
    queue = sorted(queue, key=lambda item: (item["priority"], item["sourceId"] or 0))
    if counts["readyForStructure"]:
        level = "ready"
        next_action = f"先处理 {counts['readyForStructure']} 条已带字幕素材，批量生成结构摘要。"
    elif counts["autoReady"]:
        level = "auto_ready"
        next_action = f"字幕服务可用，先为 {min(counts['autoReady'], 3)} 条有链接素材提取字幕。"
    elif counts["manualNeeded"]:
        level = "manual_needed"
        next_action = f"当前 {counts['manualNeeded']} 条素材需要人工字幕兜底，补齐后再结构化。"
    elif counts["structured"]:
        level = "structured"
        next_action = "已有结构摘要，进入脚本流程选择素材并生成候选脚本。"
    else:
        level = "empty"
        next_action = "先导入对标视频链接、字幕文本或第三方表格。"
    failed_traces = [job for job in tracked_jobs if job.get("status") == "failed"]
    successful_traces = [job for job in tracked_jobs if job.get("status") == "success"]
    running_traces = [job for job in tracked_jobs if job.get("status") == "running"]
    latest_failure = None
    if failed_traces:
        latest_failure = sorted(
            failed_traces,
            key=lambda job: job.get("updatedAt") or job.get("createdAt") or "",
            reverse=True,
        )[0]
    if failed_traces:
        trace_level = "failed"
        trace_summary = f"最近展示素材里有 {len(failed_traces)} 条自动字幕失败；当天生产先走手工字幕兜底，不等待服务修复。"
        trace_next_action = "优先打开失败素材，粘贴旧字幕项目结果或手工字幕，再生成结构摘要。"
    elif running_traces:
        trace_level = "running"
        trace_summary = f"有 {len(running_traces)} 条字幕任务运行中；完成后会写回字幕文本。"
        trace_next_action = "等待任务完成，超时或失败后改走手工字幕。"
    elif successful_traces:
        trace_level = "success"
        trace_summary = f"最近展示素材里已有 {len(successful_traces)} 条自动字幕成功。"
        trace_next_action = "继续把已带字幕素材生成结构摘要。"
    elif counts["withUrl"]:
        trace_level = "not_started"
        trace_summary = "有视频链接但还没有自动字幕任务记录。"
        trace_next_action = "服务可用时提取字幕；服务不可用时直接粘贴手工字幕。"
    else:
        trace_level = "empty"
        trace_summary = "当前素材没有可追踪的自动字幕任务。"
        trace_next_action = "先导入真实链接或字幕文本。"
    return {
        "version": "subtitle_readiness_v1",
        "level": level,
        "summary": f"内容池 {counts['totalSources']} 条；有链接 {counts['withUrl']} 条；有字幕/正文 {counts['withText']} 条；已结构化 {counts['structured']} 条。",
        "nextAction": next_action,
        "nextHref": "./index.html?v=subtitle-readiness-v1#stepGenerate" if counts["structured"] else "#contentPoolList",
        "counts": counts,
        "service": {
            "status": service_status,
            "statusLabel": service.get("statusLabel") or "待检测",
            "summary": service.get("summary") or "",
            "nextAction": service.get("nextAction") or "",
            "fallbackAction": service.get("fallbackAction") or "",
        },
        "jobTrace": {
            "level": trace_level,
            "summary": trace_summary,
            "nextAction": trace_next_action,
            "counts": {
                "trackedJobs": len(tracked_jobs),
                "successfulJobs": len(successful_traces),
                "failedJobs": len(failed_traces),
                "runningJobs": len(running_traces),
                "manualFallbackNeeded": counts["manualNeeded"],
            },
            "latestFailure": latest_failure,
            "failedSources": failed_traces[:5],
            "recentJobs": tracked_jobs[:6],
        },
        "queue": queue[:8],
    }


def build_third_party_readiness(items: list[dict]) -> dict:
    third_party_items = [
        item for item in items
        if item.get("platform") == "third_party"
        or item.get("sourceType") == "third_party_row"
        or item.get("importMethod") in {"csv_table", "tsv_table"}
    ]
    with_url = [item for item in third_party_items if item.get("url")]
    with_text = [item for item in third_party_items if (item.get("rawText") or "").strip()]
    structured = [item for item in third_party_items if (item.get("structure") or {}).get("status") == "structure_done"]
    selected = [item for item in third_party_items if item.get("selected")]
    need_structure = [
        item for item in third_party_items
        if (item.get("rawText") or "").strip()
        and (item.get("structure") or {}).get("status") != "structure_done"
    ]
    counts = {
        "totalRows": len(third_party_items),
        "withUrl": len(with_url),
        "withText": len(with_text),
        "structured": len(structured),
        "selected": len(selected),
        "needStructure": len(need_structure),
        "supportedFields": len(CONTENT_SOURCE_FIELD_ALIASES),
        "riskRules": len(CONTENT_IMPORT_RISK_TERMS),
    }
    if counts["needStructure"]:
        level = "needs_structure"
        next_action = f"{counts['needStructure']} 条第三方素材已有文本，先批量生成结构摘要。"
        next_href = "#contentPoolList"
    elif counts["totalRows"]:
        level = "usable"
        next_action = "第三方表格兜底已可用；下一步继续沉淀字段映射和导入后复盘。"
        next_href = "#batch-import"
    else:
        level = "empty"
        next_action = "还没有第三方表格素材；自动采集失败时先粘贴灰豚/蝉妈妈/飞瓜/新榜表格预检。"
        next_href = "#batch-import"
    queue = []
    for item in need_structure[:4]:
        queue.append(
            {
                "sourceId": item.get("id"),
                "title": item.get("title") or "未命名第三方素材",
                "accountName": item.get("accountName") or "",
                "status": "need_structure",
                "statusLabel": "待结构化",
                "action": "生成结构摘要",
                "href": f"#content-source-{item.get('id')}",
                "reason": "已有字幕/正文，但还没有变成可供脚本生成读取的结构摘要。",
            }
        )
    if not queue:
        for item in third_party_items[:4]:
            queue.append(
                {
                    "sourceId": item.get("id"),
                    "title": item.get("title") or "未命名第三方素材",
                    "accountName": item.get("accountName") or "",
                    "status": "ready" if (item.get("structure") or {}).get("status") == "structure_done" else "imported",
                    "statusLabel": "已结构化" if (item.get("structure") or {}).get("status") == "structure_done" else "已导入",
                    "action": "查看素材",
                    "href": f"#content-source-{item.get('id')}",
                    "reason": "这条第三方来源素材已经入库，可作为兜底链路证据。",
                }
            )
    field_groups = [
        {
            "label": "必需字段",
            "fields": ["标题/title", "链接/url", "账号/account", "平台/platform"],
            "rule": "有表头时优先按字段别名映射；无表头时按逐行链接或文本导入。",
        },
        {
            "label": "质量字段",
            "fields": ["字幕/rawText", "正文/content", "备注/note", "热度/互动"],
            "rule": "有字幕或正文的行可以直接进入结构摘要；只有链接的行需要字幕服务或人工补文本。",
        },
        {
            "label": "风险检查",
            "fields": CONTENT_IMPORT_RISK_TERMS[:8],
            "rule": "命中风险词、重复链接、链接不完整或缺少正文时，在导入前预检里提示运营复核。",
        },
    ]
    supported_vendors = ["灰豚", "蝉妈妈", "飞瓜", "新榜", "飞书表格"]
    return {
        "version": "third_party_readiness_v1",
        "level": level,
        "summary": f"第三方/表格素材 {counts['totalRows']} 条；已结构化 {counts['structured']} 条；待结构化 {counts['needStructure']} 条。",
        "nextAction": next_action,
        "nextHref": next_href,
        "counts": counts,
        "supportedVendors": supported_vendors,
        "fieldGroups": field_groups,
        "queue": queue,
        "rules": [
            "预检不写库，只判断格式、字段、重复、风险和可导入行。",
            "正式导入后必须批量加入生成工作流，再批量生成结构摘要。",
            "第三方数据只做结构借鉴；发布前复核授权、价格、库存和活动口径。",
        ],
    }


def selected_content_sources_for_workflow(conn: sqlite3.Connection, brand_name: str, workday_date: str, limit: int = 20) -> list[dict]:
    rows = conn.execute(
        f"""
        SELECT id, workday_date, brand_name, platform, source_type, title,
               url, account_name, raw_text, note, import_method, status,
               selected, benchmark_update_task_id, created_at, updated_at
        FROM content_sources
        WHERE brand_name = ? AND workday_date = ? AND selected = 1
          AND {CONTENT_SOURCE_OPERATIONAL_SQL}
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
        """,
        (brand_name, workday_date, limit),
    ).fetchall()
    return [
        attach_benchmark_task(conn, serialize_content_source(row, latest_content_structure(conn, row["id"]), latest_subtitle_job(conn, row["id"])))
        for row in rows
    ]


def benchmark_account_patterns(row: sqlite3.Row) -> list[str]:
    try:
        patterns = json.loads(row["content_patterns_json"] or "[]")
    except Exception:
        patterns = []
    return [str(item).strip() for item in patterns if str(item).strip()]


def serialize_benchmark_account(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "brandName": row["brand_name"],
        "platform": row["platform"],
        "accountName": row["account_name"],
        "accountHandle": row["account_handle"],
        "accountUrl": row["account_url"] if "account_url" in row.keys() else "",
        "category": row["category"],
        "whyTrack": row["why_track"],
        "patterns": benchmark_account_patterns(row),
        "createdAt": row["created_at"],
    }


def list_benchmark_accounts() -> dict:
    brand_name = load_brand_name()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, brand_name, platform, account_name, account_handle,
                   account_url, category, why_track, content_patterns_json, created_at
            FROM benchmark_accounts
            WHERE brand_name = ?
            ORDER BY id ASC
            """,
            (brand_name,),
        ).fetchall()
    items = [serialize_benchmark_account(row) for row in rows]
    return {
        "ok": True,
        "summary": f"固定对标账号池 {len(items)} 个；用于生成每日账号更新任务。",
        "items": items,
        "nextAction": "新增账号后点击生成今日任务，再按账号补 1-3 条近期内容。",
    }


def normalize_patterns(value) -> list[str]:
    if isinstance(value, list):
        candidates = value
    else:
        candidates = re.split(r"[,，、\n]+", str(value or ""))
    patterns: list[str] = []
    for item in candidates:
        text = str(item).strip()
        if text and text not in patterns:
            patterns.append(text)
    return patterns[:8]


def save_benchmark_account(data: dict) -> dict:
    brand_name = load_brand_name()
    platform = normalize_content_platform(data.get("platform") or "douyin")
    if platform not in CONTENT_SOURCE_PLATFORMS:
        raise ValueError("platform 不合法")
    account_name = (data.get("accountName") or data.get("account_name") or "").strip()
    if not account_name:
        raise ValueError("accountName 必须填写")
    account_handle = (data.get("accountHandle") or data.get("account_handle") or "").strip()
    account_url = (data.get("accountUrl") or data.get("account_url") or "").strip()
    category = (data.get("category") or "未分类").strip()
    why_track = (data.get("whyTrack") or data.get("why_track") or "").strip()
    if not why_track:
        raise ValueError("whyTrack 必须填写，说明为什么这个账号值得对标")
    patterns = normalize_patterns(data.get("patterns") or data.get("contentPatterns") or data.get("content_patterns"))
    now = utc_now()
    with connect() as conn:
        existing = conn.execute(
            """
            SELECT id
            FROM benchmark_accounts
            WHERE brand_name = ? AND platform = ? AND account_name = ?
            """,
            (brand_name, platform, account_name),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE benchmark_accounts
                SET account_handle = ?, account_url = ?, category = ?, why_track = ?,
                    content_patterns_json = ?
                WHERE id = ?
                """,
                (account_handle, account_url, category, why_track, json.dumps(patterns, ensure_ascii=False), existing["id"]),
            )
            account_id = existing["id"]
            action = "updated"
        else:
            cur = conn.execute(
                """
                INSERT INTO benchmark_accounts (
                  brand_name, platform, account_name, account_handle, account_url,
                  category, why_track, content_patterns_json, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    brand_name,
                    platform,
                    account_name,
                    account_handle,
                    account_url,
                    category,
                    why_track,
                    json.dumps(patterns, ensure_ascii=False),
                    now,
                ),
            )
            account_id = cur.lastrowid
            action = "created"
        ensure_benchmark_update_tasks(conn, brand_name, current_workday_date())
        row = conn.execute(
            """
            SELECT id, brand_name, platform, account_name, account_handle,
                   account_url, category, why_track, content_patterns_json, created_at
            FROM benchmark_accounts
            WHERE id = ?
            """,
            (account_id,),
        ).fetchone()
        conn.commit()
    return {"action": action, "item": serialize_benchmark_account(row)}


def ensure_benchmark_update_tasks(conn: sqlite3.Connection, brand_name: str, workday_date: str) -> None:
    now = utc_now()
    accounts = conn.execute(
        """
        SELECT id, platform, account_name, account_handle
        FROM benchmark_accounts
        WHERE brand_name = ?
        ORDER BY id ASC
        """,
        (brand_name,),
    ).fetchall()
    for account in accounts:
        conn.execute(
            """
            INSERT INTO benchmark_update_tasks (
              workday_date, brand_name, account_id, platform, account_name,
              account_handle, target_count, status, note, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workday_date, brand_name, account_id) DO NOTHING
            """,
            (
                workday_date,
                brand_name,
                account["id"],
                account["platform"],
                account["account_name"],
                account["account_handle"],
                3,
                "pending",
                "每个固定对标账号今天至少补 1-3 条近期视频/笔记；自动采集不稳定时走手工链接或第三方表格。",
                now,
                now,
            ),
        )


def benchmark_update_task_href(task: dict | sqlite3.Row, version: str = "benchmark-task-deeplink-v1", import_mode: bool = False) -> str:
    task_id = task["id"] if isinstance(task, sqlite3.Row) else task.get("id")
    platform = task["platform"] if isinstance(task, sqlite3.Row) else task.get("platform")
    account_name = task["account_name"] if isinstance(task, sqlite3.Row) else task.get("accountName") or task.get("account_name")
    note = task["note"] if isinstance(task, sqlite3.Row) else task.get("note")
    params = {
        "v": version,
        "benchmarkTaskId": task_id,
    }
    if import_mode:
        params.update({
            "importPlatform": platform or "douyin",
            "importMode": "single",
            "importAccount": account_name or "",
            "importTitle": f"{account_name or '对标账号'} 近期内容",
            "importNote": note or "从固定对标账号任务进入，请补近期视频/笔记链接、正文或字幕。",
        })
        return f"./content-pool.html?{urllib.parse.urlencode(params)}#manual-import"
    return f"./content-pool.html?{urllib.parse.urlencode(params)}#benchmark-task-{task_id}"


def serialize_benchmark_update_task(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    account = conn.execute(
        """
        SELECT category, why_track, content_patterns_json, account_url
        FROM benchmark_accounts
        WHERE id = ?
        """,
        (row["account_id"],),
    ).fetchone()
    imported = conn.execute(
        """
        SELECT COUNT(*)
        FROM content_sources
        WHERE brand_name = ? AND workday_date = ?
          AND (benchmark_update_task_id = ? OR (benchmark_update_task_id IS NULL AND account_name = ?))
        """,
        (row["brand_name"], row["workday_date"], row["id"], row["account_name"]),
    ).fetchone()[0]
    structured = conn.execute(
        """
        SELECT COUNT(DISTINCT cs.id)
        FROM content_sources cs
        JOIN content_structures cst ON cst.source_id = cs.id
        WHERE cs.brand_name = ? AND cs.workday_date = ?
          AND (cs.benchmark_update_task_id = ? OR (cs.benchmark_update_task_id IS NULL AND cs.account_name = ?))
        """,
        (row["brand_name"], row["workday_date"], row["id"], row["account_name"]),
    ).fetchone()[0]
    stored_status = row["status"]
    if structured:
        status = "done"
        status_label = "今日已完成"
        next_action = "进入脚本流程使用这批结构"
        status_reason = f"已结构化 {structured} 条，脚本生成可以读取这个账号的真实内容结构。"
    elif imported:
        status = "in_progress"
        status_label = "已导入待结构化"
        next_action = "批量生成结构摘要"
        status_reason = f"已导入 {imported} 条，但还没有结构摘要；不能只把链接送去生成。"
    elif stored_status == "done":
        status = "done"
        status_label = "手动标记完成"
        next_action = "如需提高质量，继续补链接或结构化"
        status_reason = "运营已手动确认今天不再补这个账号；建议只在有外部凭证或已线下处理时使用。"
    elif stored_status == "skipped":
        status = "skipped"
        status_label = "今日跳过"
        next_action = "需要时重新标记为待更新"
        status_reason = "今天暂不处理该账号；跳过不会生成素材，也不会进入脚本输入。"
    else:
        status = "pending"
        status_label = "待补近期内容"
        next_action = "导入这个账号最近 1-3 条视频/笔记"
        status_reason = "只有账号名单，还没有今天可用的近期视频/笔记。"
    patterns = benchmark_account_patterns(account) if account else []
    completion_standard = [
        f"至少导入 {min(row['target_count'], 3)} 条近期视频/笔记链接或字幕。",
        "每条素材绑定当前对标账号任务。",
        "生成结构摘要后再进入脚本生成；不能只用账号名替代真实内容。",
    ]
    source_queue = benchmark_update_source_queue(conn, row)
    quality_counts = benchmark_update_quality_counts(source_queue)
    generation_readiness = benchmark_generation_readiness(source_queue, row["target_count"])
    return {
        "id": row["id"],
        "workdayDate": row["workday_date"],
        "accountId": row["account_id"],
        "platform": row["platform"],
        "accountName": row["account_name"],
        "accountHandle": row["account_handle"],
        "accountUrl": account["account_url"] if account else "",
        "category": account["category"] if account else "",
        "whyTrack": account["why_track"] if account else "",
        "patterns": patterns,
        "targetCount": row["target_count"],
        "importedCount": imported,
        "structuredCount": structured,
        "status": status,
        "statusLabel": status_label,
        "statusReason": status_reason,
        "note": row["note"],
        "nextAction": next_action,
        "completionStandard": completion_standard,
        "recoveryAction": "恢复为待更新" if status == "skipped" else "",
        "sourceQueue": source_queue,
        "qualityCounts": quality_counts,
        "generationReadiness": generation_readiness,
        "href": benchmark_update_task_href(row),
        "importHref": benchmark_update_task_href(row, import_mode=True),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def benchmark_update_source_queue(conn: sqlite3.Connection, row: sqlite3.Row) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, workday_date, brand_name, platform, source_type, title,
               url, account_name, raw_text, note, import_method, status,
               selected, benchmark_update_task_id, created_at, updated_at
        FROM content_sources
        WHERE brand_name = ? AND workday_date = ?
          AND (benchmark_update_task_id = ? OR (benchmark_update_task_id IS NULL AND account_name = ?))
        ORDER BY updated_at DESC, id DESC
        LIMIT 6
        """,
        (row["brand_name"], row["workday_date"], row["id"], row["account_name"]),
    ).fetchall()
    items = []
    for source_row in rows:
        source = serialize_content_source(
            source_row,
            latest_content_structure(conn, source_row["id"]),
            latest_subtitle_job(conn, source_row["id"]),
        )
        structure = source.get("structure") or {}
        subtitle_job = source.get("subtitleJob") or {}
        has_text = bool(source.get("rawText"))
        is_structured = structure.get("status") == "structure_done"
        is_selected = bool(source.get("selected"))
        if is_structured:
            status = "structured"
            status_label = "已结构化"
            next_action = "可进入生成"
        elif has_text:
            status = "ready_for_structure"
            status_label = "待结构化"
            next_action = "生成结构摘要"
        elif subtitle_job.get("status") == "failed":
            status = "subtitle_failed"
            status_label = "字幕失败"
            next_action = "手工补字幕"
        elif source.get("url"):
            status = "need_subtitle"
            status_label = "待补字幕"
            next_action = "提取或粘贴字幕"
        else:
            status = "need_text"
            status_label = "待补正文"
            next_action = "补字幕/正文"
        items.append(
            {
                "id": source["id"],
                "title": source["title"],
                "platform": source["platform"],
                "accountName": source["accountName"],
                "hasUrl": bool(source.get("url")),
                "hasText": has_text,
                "selected": is_selected,
                "structured": is_structured,
                "subtitleStatus": subtitle_job.get("status") or ("manual_text" if has_text else "not_started"),
                "structureStatus": structure.get("status") or "not_started",
                "status": status,
                "statusLabel": status_label,
                "nextAction": next_action,
                "href": f"#content-source-{source['id']}",
                "updatedAt": source["updatedAt"],
            }
        )
    return items


def benchmark_update_quality_counts(source_queue: list[dict]) -> dict:
    return {
        "total": len(source_queue),
        "withText": len([item for item in source_queue if item.get("hasText")]),
        "selected": len([item for item in source_queue if item.get("selected")]),
        "structured": len([item for item in source_queue if item.get("structured")]),
        "needSubtitle": len([item for item in source_queue if item.get("status") in {"need_subtitle", "subtitle_failed", "need_text"}]),
    }


def benchmark_generation_readiness(source_queue: list[dict], target_count: int = 3) -> dict:
    total = len(source_queue)
    with_text = len([item for item in source_queue if item.get("hasText")])
    selected = len([item for item in source_queue if item.get("selected")])
    structured = len([item for item in source_queue if item.get("structured")])
    ready_items = [
        item for item in source_queue
        if item.get("hasText") and item.get("selected") and item.get("structured")
    ]
    target = max(1, min(int(target_count or 3), 3))
    blockers: list[str] = []
    if total == 0:
        blockers.append("还没有导入这个账号的近期内容")
    if total and with_text == 0:
        blockers.append("已导入素材缺少字幕/正文")
    if total and selected == 0:
        blockers.append("素材还没有加入生成工作流")
    if total and structured == 0:
        blockers.append("素材还没有结构摘要")
    if ready_items:
        level = "ready"
        status_label = "可进入生成"
        next_action = "去生成脚本"
        primary_action = "generate"
        summary = f"已有 {len(ready_items)} 条素材同时具备字幕/正文、已加入生成和结构摘要。"
    elif total == 0:
        level = "missing_sources"
        status_label = "缺近期内容"
        next_action = "导入这个账号近期内容"
        primary_action = "import"
        summary = "账号池只是名单，今天还没有可用于生成的近期内容。"
    elif with_text == 0:
        level = "needs_subtitle"
        status_label = "缺字幕/正文"
        next_action = "补字幕或正文"
        primary_action = "subtitle"
        summary = "已有链接或表格行，但没有可结构化文本。"
    elif selected == 0:
        level = "needs_selection"
        status_label = "未加入生成"
        next_action = "加入生成工作流"
        primary_action = "select"
        summary = "素材已有文本，但还没有进入脚本生成输入池。"
    elif structured == 0:
        level = "needs_structure"
        status_label = "缺结构摘要"
        next_action = "生成结构摘要"
        primary_action = "structure"
        summary = "素材已进入输入池，但还没有可供脚本生成读取的结构摘要。"
    else:
        level = "partial"
        status_label = "部分就绪"
        next_action = "补齐缺口"
        primary_action = "structure"
        summary = "已有部分素材进展，但还没有形成完整生成输入。"
    return {
        "level": level,
        "ready": bool(ready_items),
        "statusLabel": status_label,
        "summary": summary,
        "nextAction": next_action,
        "primaryAction": primary_action,
        "targetCount": target,
        "readyCount": len(ready_items),
        "counts": {
            "total": total,
            "withText": with_text,
            "selected": selected,
            "structured": structured,
        },
        "blockers": blockers,
    }


def benchmark_update_tasks_snapshot(conn: sqlite3.Connection, brand_name: str, workday_date: str) -> dict:
    ensure_benchmark_update_tasks(conn, brand_name, workday_date)
    rows = conn.execute(
        """
        SELECT id, workday_date, brand_name, account_id, platform, account_name,
               account_handle, target_count, status, note, created_at, updated_at
        FROM benchmark_update_tasks
        WHERE brand_name = ? AND workday_date = ?
        ORDER BY
          CASE status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
          id ASC
        """,
        (brand_name, workday_date),
    ).fetchall()
    items = [serialize_benchmark_update_task(conn, row) for row in rows]
    pending = len([item for item in items if item["importedCount"] == 0 and item["status"] != "skipped"])
    done = len([item for item in items if item["importedCount"] >= item["targetCount"] or item["structuredCount"] > 0])
    return {
        "ok": True,
        "summary": f"固定对标账号 {len(items)} 个；{pending} 个今天还没补近期内容。",
        "targetPerAccount": 3,
        "doneCount": done,
        "pendingCount": pending,
        "items": items,
    }


def list_benchmark_update_tasks() -> dict:
    brand_name = load_brand_name()
    workday_date = current_workday_date()
    with connect() as conn:
        snapshot = benchmark_update_tasks_snapshot(conn, brand_name, workday_date)
        conn.commit()
    return snapshot


def update_benchmark_update_task(task_id: int, data: dict) -> dict:
    brand_name = load_brand_name()
    status = (data.get("status") or "").strip()
    if status not in {"pending", "in_progress", "done", "skipped"}:
        raise ValueError("status 必须是 pending/in_progress/done/skipped")
    note = (data.get("note") or "").strip()
    now = utc_now()
    with connect() as conn:
        existing = conn.execute(
            """
            SELECT id
            FROM benchmark_update_tasks
            WHERE id = ? AND brand_name = ?
            """,
            (task_id, brand_name),
        ).fetchone()
        if not existing:
            raise ValueError("对标账号更新任务不存在")
        conn.execute(
            """
            UPDATE benchmark_update_tasks
            SET status = ?, note = CASE WHEN ? = '' THEN note ELSE ? END, updated_at = ?
            WHERE id = ? AND brand_name = ?
            """,
            (status, note, note, now, task_id, brand_name),
        )
        row = conn.execute(
            """
            SELECT id, workday_date, brand_name, account_id, platform, account_name,
                   account_handle, target_count, status, note, created_at, updated_at
            FROM benchmark_update_tasks
            WHERE id = ?
            """,
            (task_id,),
        ).fetchone()
        item = serialize_benchmark_update_task(conn, row)
        conn.commit()
    return item


def create_content_source(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    platform = normalize_content_platform(data.get("platform") or "douyin")
    source_type = (data.get("sourceType") or "benchmark_video").strip()
    title = (data.get("title") or "").strip()
    url = (data.get("url") or "").strip()
    account_name = (data.get("accountName") or "").strip()
    raw_text = (data.get("rawText") or "").strip()
    note = (data.get("note") or "").strip()
    import_method = (data.get("importMethod") or ("subtitle_text" if raw_text else "manual_url")).strip()
    raw_benchmark_task_id = data.get("benchmarkUpdateTaskId") or data.get("benchmark_update_task_id")
    benchmark_task_id = int(raw_benchmark_task_id) if raw_benchmark_task_id else None
    if not title:
        raise ValueError("title 必须填写")
    if not url and not raw_text:
        raise ValueError("url 和 rawText 至少填写一个")
    if source_type not in CONTENT_SOURCE_TYPES:
        raise ValueError("sourceType 不合法")
    if platform not in CONTENT_SOURCE_PLATFORMS:
        raise ValueError("platform 不合法")
    validation_payload = {
        "platform": platform,
        "sourceType": source_type,
        "title": title,
        "url": url,
        "accountName": account_name,
        "rawText": raw_text,
        "note": note,
        "importMethod": import_method,
    }
    existing_urls = find_existing_content_source_urls([url], brand_name)
    blocking_warnings = [
        warning for warning in content_source_row_warnings(validation_payload, set(), existing_urls)
        if is_blocking_content_warning(warning)
    ]
    if blocking_warnings:
        raise ValueError(f"这条素材暂不能导入内容池：{'；'.join(blocking_warnings)}")
    exclusion_reason = content_source_payload_exclusion_reason(validation_payload)
    if exclusion_reason:
        raise ValueError(f"这条素材不计入真实闭环，不能导入内容池：{exclusion_reason}")
    now = utc_now()
    status = "subtitle_done" if raw_text else "imported"
    with connect() as conn:
        if benchmark_task_id:
            task = conn.execute(
                """
                SELECT id, workday_date, account_name, platform
                FROM benchmark_update_tasks
                WHERE id = ? AND brand_name = ?
                """,
                (benchmark_task_id, brand_name),
            ).fetchone()
            if not task:
                raise ValueError("对标账号更新任务不存在")
            if task["workday_date"] != now[:10]:
                raise ValueError("只能关联今天的对标账号更新任务")
            if not account_name:
                account_name = task["account_name"]
            if not platform:
                platform = task["platform"]
        cursor = conn.execute(
            """
            INSERT INTO content_sources (
              workday_date, brand_name, platform, source_type, title, url,
              account_name, raw_text, note, import_method, status,
              benchmark_update_task_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now[:10],
                brand_name,
                platform,
                source_type,
                title,
                url,
                account_name,
                raw_text,
                note,
                import_method,
                status,
                benchmark_task_id,
                now,
                now,
            ),
        )
        if benchmark_task_id:
            conn.execute(
                """
                UPDATE benchmark_update_tasks
                SET status = CASE WHEN status = 'done' THEN status ELSE 'in_progress' END,
                    updated_at = ?
                WHERE id = ? AND brand_name = ?
                """,
                (now, benchmark_task_id, brand_name),
            )
        row = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return serialize_content_source(row)


def normalize_header_name(value: str) -> str:
    return "".join((value or "").strip().lower().replace("\ufeff", "").split()).replace("-", "_")


def canonical_content_source_field(header: str) -> str | None:
    normalized = normalize_header_name(header)
    for field, aliases in CONTENT_SOURCE_FIELD_ALIASES.items():
        if normalized in {normalize_header_name(alias) for alias in aliases}:
            return field
    return None


def normalize_content_platform(value: str) -> str:
    normalized = normalize_header_name(value)
    if not normalized:
        return ""
    if normalized in {"douyin", "dy", "抖音"}:
        return "douyin"
    if normalized in {"xhs", "red", "xiaohongshu", "小红书", "小紅書"}:
        return "xhs"
    if normalized in {"manual", "手工", "手工素材", "人工", "人工导入"}:
        return "manual"
    if normalized in {"third_party", "thirdparty", "第三方", "第三方数据", "灰豚", "蝉妈妈", "飞瓜", "新榜"}:
        return "third_party"
    return value.strip()


def normalize_content_source_type(value: str, platform: str, import_method: str) -> str:
    normalized = normalize_header_name(value)
    if normalized in CONTENT_SOURCE_TYPES:
        return normalized
    if normalized in {"hot", "hot_video", "热点", "热点视频", "热榜"}:
        return "hot_video"
    if normalized in {"note", "manual_note", "笔记", "文本", "字幕", "手工素材"}:
        return "manual_note"
    if normalized in {"third_party_row", "thirdpartyrow", "第三方", "第三方数据", "榜单行", "表格行"}:
        return "third_party_row"
    if platform == "third_party" or import_method in {"csv_table", "tsv_table"}:
        return "third_party_row"
    return "benchmark_video"


def detect_table_dialect(text: str) -> tuple[str, str]:
    first_line = next((line for line in text.splitlines() if line.strip()), "")
    if "\t" in first_line:
        return "\t", "tsv"
    if "," in first_line:
        return ",", "csv"
    return "", "line"


def content_source_format_label(value: str) -> str:
    return {
        "tsv": "TSV/飞书表格",
        "csv": "CSV 表格",
        "line": "逐行链接/文本",
    }.get(value, value or "未知格式")


def content_source_field_label(value: str) -> str:
    return {
        "title": "标题",
        "url": "链接",
        "accountName": "账号",
        "platform": "平台",
        "rawText": "字幕/正文",
        "note": "备注",
        "sourceType": "素材类型",
    }.get(value, value)


def content_source_batch_template() -> dict:
    recommended_header = ["标题", "链接", "账号", "平台", "字幕", "备注"]
    transcript_header = ["标题", "链接", "账号", "平台", "字幕文本", "备注"]
    sample_rows = [
        ["模板示例-抖音运动穿搭", "https://v.douyin.com/example01/", "示例对标账号", "抖音", "开头三秒展示进店试穿，强调场景和动作。", "示例行，仅用于复制字段格式"],
        ["模板示例-小红书门店种草", "https://www.xiaohongshu.com/explore/example02", "示例博主", "小红书", "正文里提到门店、试穿体验和适合人群。", "示例行，正式导入前请替换"],
        ["模板示例-第三方榜单文本", "", "灰豚/蝉妈妈/飞瓜/新榜", "第三方", "粘贴榜单摘要、字幕或视频文案，缺链接也可先结构化。", "适合验证码/采集失败时兜底"],
    ]
    transcript_sample_rows = [
        ["待替换-旧字幕项目结果", "", "待填写对标账号", "手工素材", "粘贴旧字幕项目导出的真实字幕、ASR 转写或 OCR 文本；不少于 30 字。", "可写视频链接来源、提取时间或结构观察"],
    ]
    template_lines = ["\t".join(recommended_header), *["\t".join(row) for row in sample_rows]]
    transcript_template_lines = ["\t".join(transcript_header), *["\t".join(row) for row in transcript_sample_rows]]
    field_groups = [
        {
            "key": "required",
            "label": "最低可入库",
            "description": "每行至少要有链接，或有可结构化的字幕/正文/备注。",
            "fields": [
                {
                    "key": "title",
                    "label": content_source_field_label("title"),
                    "aliases": sorted(CONTENT_SOURCE_FIELD_ALIASES["title"]),
                    "required": False,
                    "rule": "缺标题时会从正文或链接自动截取，但建议保留原始标题。",
                },
                {
                    "key": "url",
                    "label": content_source_field_label("url"),
                    "aliases": sorted(CONTENT_SOURCE_FIELD_ALIASES["url"]),
                    "required": False,
                    "rule": "有链接会用于去重和后续字幕提取；缺链接时必须提供正文/字幕。",
                },
                {
                    "key": "rawText",
                    "label": content_source_field_label("rawText"),
                    "aliases": sorted(CONTENT_SOURCE_FIELD_ALIASES["rawText"]),
                    "required": False,
                    "rule": "字幕、正文、视频文案会进入结构摘要，是脚本质量的关键输入。",
                },
            ],
        },
        {
            "key": "quality",
            "label": "提高质量",
            "description": "这些字段用于判断来源、对标结构和品牌嫁接角度。",
            "fields": [
                {
                    "key": "accountName",
                    "label": content_source_field_label("accountName"),
                    "aliases": sorted(CONTENT_SOURCE_FIELD_ALIASES["accountName"]),
                    "required": False,
                    "rule": "建议写达人/账号/来源工具，方便后续追溯。",
                },
                {
                    "key": "platform",
                    "label": content_source_field_label("platform"),
                    "aliases": sorted(CONTENT_SOURCE_FIELD_ALIASES["platform"]),
                    "required": False,
                    "rule": "可写抖音、小红书、第三方、手工素材；系统会归一化。",
                },
                {
                    "key": "note",
                    "label": content_source_field_label("note"),
                    "aliases": sorted(CONTENT_SOURCE_FIELD_ALIASES["note"]),
                    "required": False,
                    "rule": "写热度、互动、推荐理由或运营备注，帮助筛选素材。",
                },
            ],
        },
        {
            "key": "optional",
            "label": "可选字段",
            "description": "用于更精确地区分热点、对标视频、手工文本或第三方榜单行。",
            "fields": [
                {
                    "key": "sourceType",
                    "label": content_source_field_label("sourceType"),
                    "aliases": sorted(CONTENT_SOURCE_FIELD_ALIASES["sourceType"]),
                    "required": False,
                    "rule": "可写热点视频、对标视频、手工素材、第三方数据；不写时系统按平台推断。",
                }
            ],
        },
    ]
    return {
        "ok": True,
        "version": "content_source_batch_template_v1",
        "recommendedHeader": "\t".join(recommended_header),
        "sampleRows": sample_rows,
        "templateText": "\n".join(template_lines),
        "transcriptHeader": "\t".join(transcript_header),
        "transcriptTemplateText": "\n".join(transcript_template_lines),
        "acceptedPlatforms": ["抖音", "小红书", "第三方", "手工素材"],
        "vendors": ["灰豚", "蝉妈妈", "飞瓜", "新榜", "飞书表格", "旧字幕项目"],
        "fieldGroups": field_groups,
        "rules": [
            "模板行只是示例，不代表真实采集数据；正式导入前请替换为运营自己的表格内容。",
            "导入前预检不会写入数据库，只用于检查字段映射、重复链接、缺字段和风险词。",
            "正式导入最多 50 行；失败行会保留行号、原始输入和失败原因。",
            "旧字幕项目结果可直接填入字幕文本字段；有真实视频链接就保留链接，没有链接也必须保留账号/来源和真实字幕正文。",
            "自动采集失败时，人工导入和第三方表格是正式兜底入口，不是模拟数据。",
        ],
        "riskTerms": CONTENT_IMPORT_RISK_TERMS,
    }


def split_table_rows(raw_text: str, delimiter: str) -> list[list[str]]:
    reader = csv.reader(io.StringIO(raw_text), delimiter=delimiter)
    return [[cell.strip() for cell in row] for row in reader if any(cell.strip() for cell in row)]


def row_has_known_headers(row: list[str]) -> bool:
    return sum(1 for cell in row if canonical_content_source_field(cell)) >= 2


def mapped_content_source_payload(
    row: list[str],
    header_map: dict[int, str],
    default_platform: str,
    default_account: str,
    import_method: str,
) -> dict:
    mapped: dict[str, str] = {}
    for index, field in header_map.items():
        if index < len(row):
            mapped[field] = row[index].strip()
    platform = normalize_content_platform(mapped.get("platform") or default_platform)
    if not platform:
        platform = default_platform
    source_type = (mapped.get("sourceType") or ("third_party_row" if platform == "third_party" or import_method in {"csv_table", "tsv_table"} else "benchmark_video")).strip()
    title = (mapped.get("title") or "").strip()
    url = (mapped.get("url") or "").strip()
    raw_text_value = (mapped.get("rawText") or "").strip()
    note = (mapped.get("note") or "").strip()
    account_name = (mapped.get("accountName") or default_account).strip()
    if not raw_text_value and note and not url:
        raw_text_value = note
    if not title:
        if raw_text_value:
            title = raw_text_value[:40]
        elif url:
            title = f"第三方导入素材 {url.rstrip('/').split('/')[-1][:18] or '未命名'}"
    source_type = normalize_content_source_type(source_type, platform, import_method)
    return {
        "platform": platform,
        "sourceType": source_type,
        "title": title,
        "url": url,
        "accountName": account_name,
        "rawText": raw_text_value,
        "note": note,
        "importMethod": import_method,
    }


def parse_content_source_line(line: str, default_platform: str, default_account: str) -> dict:
    stripped = line.strip()
    if not stripped:
        raise ValueError("空行")
    parts = [part.strip() for part in stripped.replace("\t", " ").split(" ") if part.strip()]
    url = next((part for part in parts if part.startswith(("http://", "https://"))), "")
    title_parts = [part for part in parts if part != url]
    title = " ".join(title_parts).strip(" -|，,")
    if not title and url:
        title = f"人工导入素材 {url.rstrip('/').split('/')[-1][:18] or '未命名'}"
    if not title:
        title = stripped[:40]
    return {
        "platform": default_platform,
        "sourceType": "benchmark_video",
        "title": title,
        "url": url,
        "accountName": default_account,
        "rawText": "" if url else stripped,
        "note": "",
        "importMethod": "batch_text",
    }


def detect_third_party_vendor(headers: list[str], raw_text: str) -> str:
    joined = " ".join(headers) + " " + raw_text[:500]
    normalized = normalize_header_name(joined)
    vendors = [
        ("灰豚", {"灰豚", "huitun"}),
        ("蝉妈妈", {"蝉妈妈", "chanmama"}),
        ("飞瓜", {"飞瓜", "feigua"}),
        ("新榜", {"新榜", "newrank"}),
        ("飞书表格", {"多维表格", "飞书"}),
    ]
    for label, aliases in vendors:
        if any(normalize_header_name(alias) in normalized for alias in aliases):
            return label
    return ""


def find_existing_content_source_urls(urls: list[str], brand_name: str) -> set[str]:
    clean_urls = sorted({url.strip() for url in urls if url.strip()})
    if not clean_urls:
        return set()
    existing: set[str] = set()
    with connect() as conn:
        for offset in range(0, len(clean_urls), 80):
            chunk = clean_urls[offset : offset + 80]
            placeholders = ",".join("?" for _ in chunk)
            rows = conn.execute(
                f"""
                SELECT url
                FROM content_sources
                WHERE brand_name = ? AND url IN ({placeholders})
                """,
                (brand_name, *chunk),
            ).fetchall()
            existing.update(row["url"] for row in rows)
    return existing


def content_source_row_warnings(payload: dict, seen_urls: set[str], existing_urls: set[str]) -> list[str]:
    warnings: list[str] = []
    url = (payload.get("url") or "").strip()
    raw_text = (payload.get("rawText") or "").strip()
    note = (payload.get("note") or "").strip()
    title = (payload.get("title") or "").strip()
    text_blob = " ".join([title, raw_text, note])
    if not url and not raw_text:
        warnings.append("缺少链接或字幕/正文")
    if url and url in seen_urls:
        warnings.append("表内重复链接")
    if url and url in existing_urls:
        warnings.append("内容池已存在该链接")
    if url and not url.startswith(("http://", "https://")):
        warnings.append("链接格式不完整")
    if not raw_text and len(note) < 8:
        warnings.append("缺少可结构化文本")
    if looks_like_import_instruction(raw_text) or looks_like_import_instruction(note):
        warnings.append("路径说明不是素材正文")
    risk_hits = [term for term in CONTENT_IMPORT_RISK_TERMS if term in text_blob]
    if risk_hits:
        warnings.append(f"命中风险词：{'、'.join(risk_hits[:3])}")
    exclusion_reason = content_source_payload_exclusion_reason(payload)
    if exclusion_reason:
        warnings.append(f"非运营素材：{exclusion_reason}")
    return warnings


def looks_like_import_instruction(value: str) -> bool:
    text = (value or "").strip()
    if not text:
        return False
    markers = [
        "路径：真实链接优先",
        "路径：手工字幕兜底",
        "路径：第三方表格兜底",
        "请填写真实作品链接",
        "先预检再导入",
        "不要粘贴路径说明",
        "粘贴旧字幕项目导出的真实字幕",
        "不少于 30 字",
        "待填写对标账号",
        "可写视频链接来源",
        "待替换",
    ]
    return any(marker in text for marker in markers)


def is_blocking_content_warning(warning: str) -> bool:
    return (
        warning in {"缺少链接或字幕/正文", "链接格式不完整", "路径说明不是素材正文", "内容池已存在该链接", "表内重复链接"}
        or warning.startswith("非运营素材：")
    )


def parse_content_source_batch_text(
    raw_text: str,
    default_platform: str,
    default_account: str,
) -> tuple[list[dict], str, dict]:
    delimiter, detected_format = detect_table_dialect(raw_text)
    meta = {
        "delimiter": delimiter,
        "hasHeader": False,
        "fields": [],
        "fieldMap": {},
        "vendor": "",
    }
    if delimiter:
        rows = split_table_rows(raw_text, delimiter)
        if rows and row_has_known_headers(rows[0]):
            header_map = {
                index: field
                for index, cell in enumerate(rows[0])
                for field in [canonical_content_source_field(cell)]
                if field
            }
            meta.update(
                {
                    "hasHeader": True,
                    "fields": [field for _, field in sorted(header_map.items())],
                    "fieldMap": {str(index): field for index, field in sorted(header_map.items())},
                    "vendor": detect_third_party_vendor(rows[0], raw_text),
                }
            )
            payloads = [
                {
                    "line": line_number,
                    "raw": delimiter.join(row),
                    "payload": mapped_content_source_payload(
                        row,
                        header_map,
                        default_platform,
                        default_account,
                        f"{detected_format}_table",
                    ),
                }
                for line_number, row in enumerate(rows[1:], start=2)
            ]
            return payloads, detected_format, meta
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    return [
        {
            "line": index,
            "raw": line,
            "payload": parse_content_source_line(line, default_platform, default_account),
        }
        for index, line in enumerate(lines, start=1)
    ], "line", meta


def preview_content_sources_batch(data: dict) -> dict:
    raw_text = (data.get("batchText") or data.get("text") or "").strip()
    if not raw_text:
        raise ValueError("batchText 必须填写")
    platform = normalize_content_platform(data.get("platform") or "douyin")
    account_name = (data.get("accountName") or "").strip()
    if platform not in CONTENT_SOURCE_PLATFORMS:
        raise ValueError("platform 不合法")
    brand_name = data.get("brandName") or load_brand_name()
    parsed_rows, detected_format, meta = parse_content_source_batch_text(raw_text, platform, account_name)
    if len(parsed_rows) > 50:
        raise ValueError("一次最多导入 50 行")
    existing_urls = find_existing_content_source_urls(
        [row["payload"].get("url", "") for row in parsed_rows],
        brand_name,
    )
    seen_urls: set[str] = set()
    row_previews = []
    row_importable_count = 0
    warning_count = 0
    duplicate_count = 0
    risk_count = 0
    blocked_row_count = 0
    has_blocking = False
    for row in parsed_rows:
        payload = row["payload"]
        url = (payload.get("url") or "").strip()
        warnings = content_source_row_warnings(payload, seen_urls, existing_urls)
        blocking_warnings = [warning for warning in warnings if is_blocking_content_warning(warning)]
        if url:
            if url in seen_urls or url in existing_urls:
                duplicate_count += 1
            seen_urls.add(url)
        if any("风险词" in warning for warning in warnings):
            risk_count += 1
        if warnings:
            warning_count += 1
        importable = not blocking_warnings
        if importable:
            row_importable_count += 1
        else:
            blocked_row_count += 1
            has_blocking = True
        row_previews.append(
            {
                "line": row["line"],
                "ok": importable,
                "title": payload.get("title") or "",
                "platform": payload.get("platform") or platform,
                "sourceType": payload.get("sourceType") or "",
                "url": url,
                "accountName": payload.get("accountName") or "",
                "hasText": bool(payload.get("rawText")),
                "warnings": warnings,
                "blockingWarnings": blocking_warnings,
                "input": row["raw"],
            }
        )
    field_labels = [content_source_field_label(field) for field in meta.get("fields") or []]
    return {
        "total": len(parsed_rows),
        "importableCount": 0 if has_blocking else row_importable_count,
        "rowImportableCount": row_importable_count,
        "preflightBlocked": has_blocking,
        "batchImportable": not has_blocking,
        "blockedRowCount": blocked_row_count,
        "warningCount": warning_count,
        "duplicateCount": duplicate_count,
        "riskCount": risk_count,
        "format": detected_format,
        "formatLabel": content_source_format_label(detected_format),
        "vendor": meta.get("vendor") or "",
        "hasHeader": bool(meta.get("hasHeader")),
        "fields": field_labels,
        "fieldMap": meta.get("fieldMap") or {},
        "rows": row_previews[:20],
        "nextSteps": ["修正阻塞行", "重新预检", "解析并导入"] if has_blocking else ["解析并导入", "批量加入生成工作流", "批量生成结构摘要"],
        "batchAction": "本批存在阻塞行，正式导入会整批暂停；请修正后再导入。" if has_blocking else "本批可进入正式导入。",
        "rule": "预检不写库；如果任一行存在阻塞问题，正式导入会整批暂停并写入 0 条。",
    }


def preview_content_source(data: dict) -> dict:
    platform = normalize_content_platform(data.get("platform") or "douyin")
    if platform not in CONTENT_SOURCE_PLATFORMS:
        raise ValueError("platform 不合法")
    payload = {
        "platform": platform,
        "sourceType": (data.get("sourceType") or "manual_note" if data.get("rawText") and not data.get("url") else data.get("sourceType") or "benchmark_video"),
        "title": (data.get("title") or "").strip(),
        "url": (data.get("url") or "").strip(),
        "accountName": (data.get("accountName") or "").strip(),
        "rawText": (data.get("rawText") or "").strip(),
        "note": (data.get("note") or "").strip(),
        "importMethod": data.get("importMethod") or ("subtitle_text" if data.get("rawText") else "manual_url"),
    }
    brand_name = data.get("brandName") or load_brand_name()
    existing_urls = find_existing_content_source_urls([payload["url"]], brand_name)
    warnings = content_source_row_warnings(payload, set(), existing_urls)
    blocking = [
        warning for warning in warnings
        if is_blocking_content_warning(warning)
    ]
    has_text = bool(payload["rawText"] or payload["note"])
    title_ready = bool(payload["title"])
    has_url = bool(payload["url"])
    importable = not blocking and title_ready
    exclusion_reason = content_source_payload_exclusion_reason(payload)
    if exclusion_reason:
        next_action = "换成真实对标视频/笔记，删除测试、验证、示例、占位或 example.com 内容"
        after_import_step = "不会入库"
    elif not title_ready:
        next_action = "先填写能识别素材主题的真实标题"
        after_import_step = "等待标题"
    elif not has_url and not has_text:
        next_action = "补真实作品链接，或粘贴字幕/正文"
        after_import_step = "等待素材内容"
    elif has_url and not has_text:
        next_action = "可先导入，导入后优先提取或粘贴字幕"
        after_import_step = "导入后补字幕"
    elif has_text:
        next_action = "可导入内容池；导入后加入生成工作流并生成结构摘要"
        after_import_step = "导入后加入生成并结构化"
    else:
        next_action = "补齐真实链接或可结构化正文"
        after_import_step = "等待补充"
    gate_items = [
        {
            "key": "title",
            "label": "真实标题",
            "passed": title_ready,
            "detail": "已填写" if title_ready else "必须填写",
        },
        {
            "key": "real_material",
            "label": "非测试/示例",
            "passed": not bool(exclusion_reason),
            "detail": exclusion_reason or "未命中排除词",
        },
        {
            "key": "source_body",
            "label": "链接或正文",
            "passed": has_url or has_text,
            "detail": "有链接" if has_url and not has_text else ("有字幕/正文" if has_text else "缺少链接或正文"),
        },
        {
            "key": "r2_path",
            "label": "R2 下一步",
            "passed": importable,
            "detail": after_import_step,
        },
    ]
    return {
        "ok": True,
        "importable": importable,
        "realLoopEligible": importable,
        "status": "ready" if importable else "blocked",
        "statusLabel": "可导入并计入真实闭环候选" if importable else "暂不能作为真实素材导入",
        "titleReady": title_ready,
        "hasUrl": has_url,
        "hasText": has_text,
        "warnings": warnings + ([] if payload["title"] else ["缺少标题"]),
        "blockingWarnings": blocking + ([] if payload["title"] else ["缺少标题"]),
        "nextAction": next_action,
        "r2AfterImportStep": after_import_step,
        "gateItems": gate_items,
        "rule": "单条导入预检不写库；正式导入仍会用同一套真实素材规则拦截占位数据。",
    }


def create_content_sources_batch(data: dict) -> dict:
    raw_text = (data.get("batchText") or data.get("text") or "").strip()
    if not raw_text:
        raise ValueError("batchText 必须填写")
    platform = normalize_content_platform(data.get("platform") or "douyin")
    account_name = (data.get("accountName") or "").strip()
    brand_name = data.get("brandName") or load_brand_name()
    raw_benchmark_task_id = data.get("benchmarkUpdateTaskId") or data.get("benchmark_update_task_id")
    benchmark_task_id = int(raw_benchmark_task_id) if raw_benchmark_task_id else None
    if platform not in CONTENT_SOURCE_PLATFORMS:
        raise ValueError("platform 不合法")
    parsed_rows, detected_format, _meta = parse_content_source_batch_text(raw_text, platform, account_name)
    if len(parsed_rows) > 50:
        raise ValueError("一次最多导入 50 行")
    existing_urls = find_existing_content_source_urls(
        [row["payload"].get("url", "") for row in parsed_rows],
        brand_name,
    )
    seen_urls: set[str] = set()
    preflight_results: list[dict] = []
    has_blocking = False
    for row in parsed_rows:
        payload = row["payload"]
        url = (payload.get("url") or "").strip()
        warnings = content_source_row_warnings(payload, seen_urls, existing_urls)
        blocking = [warning for warning in warnings if is_blocking_content_warning(warning)]
        if url:
            seen_urls.add(url)
        if blocking:
            has_blocking = True
            preflight_results.append({
                "line": row["line"],
                "ok": False,
                "skipped": any(warning.startswith("非运营素材：") for warning in blocking),
                "input": row["raw"],
                "error": "；".join(blocking),
            })
        else:
            preflight_results.append({"line": row["line"], "ok": True, "input": row["raw"]})
    if has_blocking:
        normalized_results = []
        for item in preflight_results:
            if item.get("ok"):
                normalized_results.append({
                    **item,
                    "ok": False,
                    "notWritten": True,
                    "error": "本批存在阻塞行，已暂停整批导入；请修正后重新提交。",
                })
            else:
                normalized_results.append({**item, "notWritten": True})
        preflight_results = normalized_results
        skipped_count = len([item for item in preflight_results if item.get("skipped")])
        failed_count = len([item for item in preflight_results if not item.get("ok") and not item.get("skipped")])
        return {
            "total": len(parsed_rows),
            "success": 0,
            "failed": failed_count,
            "skipped": skipped_count,
            "format": detected_format,
            "results": preflight_results,
            "preflightBlocked": True,
            "error": "本批存在阻塞行，已暂停整批导入；请修正后重新提交。",
        }

    results: list[dict] = []
    success_count = 0
    for row in parsed_rows:
        try:
            payload = {**row["payload"]}
            if benchmark_task_id:
                payload["benchmarkUpdateTaskId"] = benchmark_task_id
            item = create_content_source(payload)
            results.append({"line": row["line"], "ok": True, "input": row["raw"], "item": item})
            success_count += 1
        except Exception as exc:
            error = str(exc)
            results.append({
                "line": row["line"],
                "ok": False,
                "skipped": "不计入真实闭环" in error,
                "input": row["raw"],
                "error": error,
            })
    skipped_count = len([item for item in results if item.get("skipped")])
    failed_count = len([item for item in results if not item.get("ok") and not item.get("skipped")])
    return {
        "total": len(parsed_rows),
        "success": success_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "format": detected_format,
        "results": results,
    }


def set_content_source_selected(source_id: int, selected: bool) -> dict:
    brand_name = load_brand_name()
    now = utc_now()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ? AND brand_name = ?
            """,
            (source_id, brand_name),
        ).fetchone()
        if not row:
            raise ValueError("素材不存在")
        exclusion_reason = content_source_exclusion_reason(row)
        if selected and exclusion_reason:
            raise ValueError(f"这条素材不计入真实闭环，不能加入生成工作流：{exclusion_reason}")
        conn.execute(
            """
            UPDATE content_sources
            SET selected = ?, updated_at = ?
            WHERE id = ? AND brand_name = ?
            """,
            (1 if selected else 0, now, source_id, brand_name),
        )
        updated = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ?
            """,
            (source_id,),
        ).fetchone()
        conn.commit()
    return serialize_content_source(updated)


def update_content_source_subtitle(source_id: int, data: dict) -> dict:
    brand_name = load_brand_name()
    raw_text = (data.get("rawText") or data.get("subtitleText") or "").strip()
    note = (data.get("note") or "").strip()
    if not raw_text:
        raise ValueError("字幕文本不能为空")
    now = utc_now()
    with connect() as conn:
        source = conn.execute(
            """
            SELECT id
            FROM content_sources
            WHERE id = ? AND brand_name = ?
            """,
            (source_id, brand_name),
        ).fetchone()
        if not source:
            raise ValueError("素材不存在")
        conn.execute(
            """
            UPDATE content_sources
            SET raw_text = ?,
                note = CASE WHEN ? != '' THEN ? ELSE note END,
                import_method = 'manual_subtitle_patch',
                status = 'subtitle_done',
                updated_at = ?
            WHERE id = ? AND brand_name = ?
            """,
            (raw_text, note, note, now, source_id, brand_name),
        )
        updated = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ?
            """,
            (source_id,),
        ).fetchone()
        structure = latest_content_structure(conn, source_id)
        conn.commit()
    return serialize_content_source(updated, structure)


def call_video_tools_subtitle(video_url: str, engine: str, api_base: str = VIDEO_TOOLS_API_BASE, timeout: int = 45) -> dict:
    endpoint = f"{api_base.rstrip('/')}/api/subtitle?engine={urllib.parse.quote(engine)}"
    payload = json.dumps({"url": video_url}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def diagnose_video_tools(api_base: str = VIDEO_TOOLS_API_BASE, timeout: int = 5) -> dict:
    health_url = f"{api_base.rstrip('/')}/api/health"
    result = {
        "ok": True,
        "apiBase": api_base,
        "engine": DEFAULT_SUBTITLE_ENGINE,
        "status": "unknown",
        "statusLabel": "待检测",
        "summary": "字幕服务尚未检测。",
        "evidence": "",
        "nextAction": "先检测本地 video-tools 服务状态。",
        "fallbackAction": "服务不可用时，继续粘贴手工字幕或第三方字幕文本。",
    }
    try:
        with urllib.request.urlopen(health_url, timeout=timeout) as response:
            content_type = response.headers.get("content-type", "")
            raw = response.read(4096).decode("utf-8", errors="replace").strip()
            result["evidence"] = raw[:500]
            if "application/json" not in content_type.lower():
                result.update(
                    {
                        "status": "wrong_service",
                        "statusLabel": "端口不是字幕服务",
                        "summary": f"{api_base} 返回的不是 JSON 健康检查，可能被其他本地服务占用。",
                        "nextAction": "把 video-tools 启动到空闲端口，并用 VIDEO_TOOLS_API_BASE 指向新端口后重启 ContentWork API。",
                    }
                )
                return result
            payload = json.loads(raw or "{}")
            service_status = str(payload.get("status") or payload.get("service") or "").lower()
            if service_status in {"ok", "healthy", "ready"}:
                result.update(
                    {
                        "status": "healthy",
                        "statusLabel": "字幕服务可用",
                        "summary": f"已连接本地 video-tools：{api_base}，自动字幕可尝试运行。",
                        "nextAction": "选择 1 条有链接的对标视频，先跑单条字幕任务验证成功率。",
                    }
                )
            else:
                result.update(
                    {
                        "status": "unexpected_response",
                        "statusLabel": "健康返回异常",
                        "summary": "健康接口有响应，但返回内容不符合预期。",
                        "nextAction": "确认当前端口运行的是 video-tools，并检查 /api/health 返回值。",
                    }
                )
            return result
    except urllib.error.HTTPError as exc:
        result.update(
            {
                "status": "http_error",
                "statusLabel": f"HTTP {exc.code}",
                "summary": f"字幕服务健康检查返回 HTTP {exc.code}。",
                "evidence": str(exc),
                "nextAction": "检查 video-tools 是否启动成功，或改用手工字幕兜底。",
            }
        )
    except urllib.error.URLError as exc:
        result.update(
            {
                "status": "offline",
                "statusLabel": "服务未连接",
                "summary": f"无法连接 {api_base}，本地 video-tools 可能未启动或端口不对。",
                "evidence": str(exc.reason),
                "nextAction": "启动 video-tools，或将 VIDEO_TOOLS_API_BASE 指向实际端口后重启 ContentWork API。",
            }
        )
    except json.JSONDecodeError:
        result.update(
            {
                "status": "wrong_service",
                "statusLabel": "返回不是 JSON",
                "summary": f"{api_base} 有响应，但不是 video-tools 的 JSON 健康检查。",
                "nextAction": "检查端口是否被其他本地服务占用，必要时换端口启动 video-tools。",
            }
        )
    except Exception as exc:
        result.update(
            {
                "status": "error",
                "statusLabel": "检测失败",
                "summary": f"字幕服务检测失败：{exc}",
                "evidence": str(exc),
                "nextAction": "先用手工字幕兜底，再排查本地字幕服务。",
            }
        )
    return result


def extract_subtitle_text(response: dict) -> tuple[str, list[dict]]:
    text = (response.get("text") or response.get("subtitle") or response.get("transcript") or "").strip()
    segments = response.get("segments") or response.get("items") or []
    if not isinstance(segments, list):
        segments = []
    if not text and segments:
        text = "\n".join(str(item.get("text") or "").strip() for item in segments if isinstance(item, dict) and str(item.get("text") or "").strip())
    return text, segments


def create_subtitle_job(source_id: int, data: dict | None = None) -> dict:
    data = data or {}
    brand_name = load_brand_name()
    engine = (data.get("engine") or DEFAULT_SUBTITLE_ENGINE).strip() or DEFAULT_SUBTITLE_ENGINE
    now = utc_now()
    with connect() as conn:
        source = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ? AND brand_name = ?
            """,
            (source_id, brand_name),
        ).fetchone()
        if not source:
            raise ValueError("素材不存在")
        if not source["url"]:
            raise ValueError("这条素材没有视频/笔记链接，无法创建自动字幕任务；可以直接粘贴手工字幕。")
        request_payload = {
            "apiBase": VIDEO_TOOLS_API_BASE,
            "engine": engine,
            "url": source["url"],
        }
        status = "running"
        response_payload: dict = {}
        text = ""
        segments: list[dict] = []
        error = ""
        fallback_action = "自动字幕失败时，粘贴旧字幕项目结果或手工字幕后继续结构化。"
        started_at = now
        finished_at = ""
        try:
            response_payload = call_video_tools_subtitle(source["url"], engine)
            text, segments = extract_subtitle_text(response_payload)
            if not text:
                raise ValueError("video-tools 未返回字幕文本")
            status = "success"
            fallback_action = ""
            finished_at = utc_now()
        except Exception as exc:
            status = "failed"
            error = str(exc)
            finished_at = utc_now()
        cursor = conn.execute(
            """
            INSERT INTO subtitle_jobs (
              source_id, brand_name, platform, video_url, engine, status,
              request_json, response_json, text, segments_json, error,
              fallback_action, started_at, finished_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_id,
                brand_name,
                source["platform"],
                source["url"],
                engine,
                status,
                json.dumps(request_payload, ensure_ascii=False, separators=(",", ":")),
                json.dumps(response_payload, ensure_ascii=False, separators=(",", ":")),
                text,
                json.dumps(segments, ensure_ascii=False, separators=(",", ":")),
                error,
                fallback_action,
                started_at,
                finished_at,
                now,
                finished_at or now,
            ),
        )
        if status == "success":
            conn.execute(
                """
                UPDATE content_sources
                SET raw_text = ?,
                    import_method = 'auto_subtitle',
                    status = 'subtitle_done',
                    updated_at = ?
                WHERE id = ? AND brand_name = ?
                """,
                (text, finished_at, source_id, brand_name),
            )
        elif source["status"] == "imported":
            conn.execute(
                """
                UPDATE content_sources
                SET status = 'subtitle_pending', updated_at = ?
                WHERE id = ? AND brand_name = ?
                """,
                (finished_at, source_id, brand_name),
            )
        job_row = conn.execute(
            """
            SELECT id, source_id, brand_name, platform, video_url, engine, status,
                   request_json, response_json, text, segments_json, error,
                   fallback_action, started_at, finished_at, created_at, updated_at
            FROM subtitle_jobs
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        updated = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ?
            """,
            (source_id,),
        ).fetchone()
        structure = latest_content_structure(conn, source_id)
        conn.commit()
    return {
        "job": serialize_subtitle_job(job_row),
        "item": serialize_content_source(updated, structure, serialize_subtitle_job(job_row)),
    }


def bulk_create_subtitle_jobs(data: dict) -> dict:
    brand_name = load_brand_name()
    limit = max(1, min(int(data.get("limit") or 3), 10))
    mode = (data.get("mode") or "recent_with_url_without_success").strip()
    if mode not in {"recent_with_url_without_success", "selected_with_url_without_success", "ids", "benchmark_task"}:
        raise ValueError("mode 不合法")
    ids = data.get("ids") or []
    if ids and not isinstance(ids, list):
        raise ValueError("ids 必须是数组")
    raw_task_id = data.get("benchmarkUpdateTaskId") or data.get("benchmark_update_task_id")
    benchmark_task_id = int(raw_task_id) if raw_task_id else None
    with connect() as conn:
        if mode == "ids":
            clean_ids = [int(value) for value in ids][:limit]
            if not clean_ids:
                raise ValueError("ids 不能为空")
            placeholders = ",".join("?" for _ in clean_ids)
            rows = conn.execute(
                f"""
                SELECT id, title
                FROM content_sources
                WHERE brand_name = ? AND id IN ({placeholders})
                ORDER BY id DESC
                """,
                (brand_name, *clean_ids),
            ).fetchall()
        elif mode == "benchmark_task":
            if not benchmark_task_id:
                raise ValueError("benchmarkUpdateTaskId 必须填写")
            rows = conn.execute(
                """
                SELECT cs.id, cs.title
                FROM content_sources cs
                WHERE cs.brand_name = ?
                  AND cs.benchmark_update_task_id = ?
                  AND cs.url != ''
                  AND NOT EXISTS (
                    SELECT 1
                    FROM subtitle_jobs sj
                    WHERE sj.source_id = cs.id AND sj.status = 'success'
                  )
                ORDER BY cs.id DESC
                LIMIT ?
                """,
                (brand_name, benchmark_task_id, limit),
            ).fetchall()
        else:
            selected_filter = "AND cs.selected = 1" if mode == "selected_with_url_without_success" else ""
            rows = conn.execute(
                f"""
                SELECT cs.id, cs.title
                FROM content_sources cs
                WHERE cs.brand_name = ?
                  AND cs.url != ''
                  {selected_filter}
                  AND NOT EXISTS (
                    SELECT 1
                    FROM subtitle_jobs sj
                    WHERE sj.source_id = cs.id AND sj.status = 'success'
                  )
                ORDER BY cs.id DESC
                LIMIT ?
                """,
                (brand_name, limit),
            ).fetchall()
    results = []
    for row in rows:
        try:
            result = create_subtitle_job(row["id"], data)
            job = result.get("job") or {}
            results.append({
                "id": row["id"],
                "title": row["title"],
                "ok": job.get("status") == "success",
                "job": job,
                "item": result.get("item"),
                "error": job.get("error") or "",
            })
        except Exception as exc:
            results.append({
                "id": row["id"],
                "title": row["title"],
                "ok": False,
                "error": str(exc),
            })
    success = len([item for item in results if item.get("ok")])
    failed = len(results) - success
    return {
        "total": len(results),
        "success": success,
        "failed": failed,
        "results": results,
    }


def bulk_select_content_sources(data: dict) -> dict:
    brand_name = load_brand_name()
    now = utc_now()
    limit = max(1, min(int(data.get("limit") or 10), 50))
    mode = (data.get("mode") or "unselected_recent").strip()
    if mode not in {"unselected_recent", "recent", "ids", "benchmark_task"}:
        raise ValueError("mode 不合法")
    ids = data.get("ids") or []
    if ids and not isinstance(ids, list):
        raise ValueError("ids 必须是数组")
    raw_task_id = data.get("benchmarkUpdateTaskId") or data.get("benchmark_update_task_id")
    benchmark_task_id = int(raw_task_id) if raw_task_id else None
    with connect() as conn:
        if mode == "ids":
            clean_ids = [int(value) for value in ids][:limit]
            if not clean_ids:
                raise ValueError("ids 不能为空")
            placeholders = ",".join("?" for _ in clean_ids)
            rows = conn.execute(
                f"""
                SELECT id, workday_date, brand_name, platform, source_type, title,
                       url, account_name, raw_text, note, import_method, status,
                       selected, benchmark_update_task_id, created_at, updated_at
                FROM content_sources
                WHERE brand_name = ? AND id IN ({placeholders})
                ORDER BY id DESC
                """,
                (brand_name, *clean_ids),
            ).fetchall()
        elif mode == "benchmark_task":
            if not benchmark_task_id:
                raise ValueError("benchmarkUpdateTaskId 必须填写")
            rows = conn.execute(
                """
                SELECT id, workday_date, brand_name, platform, source_type, title,
                       url, account_name, raw_text, note, import_method, status,
                       selected, benchmark_update_task_id, created_at, updated_at
                FROM content_sources
                WHERE brand_name = ? AND benchmark_update_task_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (brand_name, benchmark_task_id, limit),
            ).fetchall()
        else:
            selected_filter = "AND selected = 0" if mode == "unselected_recent" else ""
            rows = conn.execute(
                f"""
                SELECT id, workday_date, brand_name, platform, source_type, title,
                       url, account_name, raw_text, note, import_method, status,
                       selected, benchmark_update_task_id, created_at, updated_at
                FROM content_sources
                WHERE brand_name = ? {selected_filter}
                ORDER BY id DESC
                LIMIT ?
                """,
                (brand_name, limit),
            ).fetchall()
        results = []
        for row in rows:
            source_id = row["id"]
            exclusion_reason = content_source_exclusion_reason(row)
            if exclusion_reason:
                results.append({
                    "id": source_id,
                    "ok": False,
                    "skipped": True,
                    "title": row["title"],
                    "reason": exclusion_reason,
                    "item": serialize_content_source(row),
                })
                continue
            conn.execute(
                """
                UPDATE content_sources
                SET selected = 1, updated_at = ?
                WHERE id = ? AND brand_name = ?
                """,
                (now, source_id, brand_name),
            )
            updated = conn.execute(
                """
                SELECT id, workday_date, brand_name, platform, source_type, title,
                       url, account_name, raw_text, note, import_method, status,
                       selected, benchmark_update_task_id, created_at, updated_at
                FROM content_sources
                WHERE id = ?
                """,
                (source_id,),
            ).fetchone()
            results.append({"id": source_id, "ok": True, "item": serialize_content_source(updated)})
        conn.commit()
    success = len([item for item in results if item.get("ok")])
    skipped = len([item for item in results if item.get("skipped")])
    return {
        "total": len(results),
        "success": success,
        "failed": 0,
        "skipped": skipped,
        "results": results,
    }


def content_source_to_structure_item(source: sqlite3.Row) -> dict:
    return {
        "id": source["id"],
        "sourceId": f"content-source-{source['id']}",
        "title": source["title"],
        "platform": source["platform"],
        "sourceType": source["source_type"],
        "url": source["url"],
        "accountName": source["account_name"],
        "rawText": source["raw_text"],
        "note": source["note"],
        "importMethod": source["import_method"],
        "status": source["status"],
    }


def structure_content_source(source_id: int) -> dict:
    brand_name = load_brand_name()
    brand = load_brand_config()
    now = utc_now()
    with connect() as conn:
        source = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ? AND brand_name = ?
            """,
            (source_id, brand_name),
        ).fetchone()
        if not source:
            raise ValueError("素材不存在")
        exclusion_reason = content_source_exclusion_reason(source)
        if exclusion_reason:
            raise ValueError(f"这条素材不计入真实闭环，不能生成结构摘要：{exclusion_reason}")
        if not (source["raw_text"] or source["note"] or source["url"]):
            raise ValueError("素材缺少链接、字幕或备注，无法结构化")
        item = content_source_to_structure_item(source)
        summary, summary_status = generate_structure_summary(brand, "content_source", item)
        error = str(summary.get("codex_error") or "")
        cursor = conn.execute(
            """
            INSERT INTO content_structures (
              source_id, brand_name, structure_json, status, error,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_id,
                brand_name,
                json.dumps(summary, ensure_ascii=False, separators=(",", ":")),
                "structure_done" if summary_status != "codex_failed" else "structure_fallback",
                error,
                now,
                now,
            ),
        )
        conn.execute(
            """
            UPDATE content_sources
            SET status = ?, updated_at = ?
            WHERE id = ? AND brand_name = ?
            """,
            ("structure_done" if not error else source["status"], now, source_id, brand_name),
        )
        if source["benchmark_update_task_id"] and not error:
            conn.execute(
                """
                UPDATE benchmark_update_tasks
                SET status = 'done', updated_at = ?
                WHERE id = ? AND brand_name = ?
                """,
                (now, source["benchmark_update_task_id"], brand_name),
            )
        structure_row = conn.execute(
            """
            SELECT id, source_id, brand_name, structure_json, status, error,
                   created_at, updated_at
            FROM content_structures
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        updated_source = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE id = ?
            """,
            (source_id,),
        ).fetchone()
        conn.commit()
    structure = serialize_structure(structure_row)
    return {
        "source": serialize_content_source(updated_source, structure),
        "structure": structure,
    }


def bulk_structure_content_sources(data: dict) -> dict:
    brand_name = load_brand_name()
    limit = max(1, min(int(data.get("limit") or 3), 5))
    mode = (data.get("mode") or "selected_without_structure").strip()
    if mode not in {"selected_without_structure", "recent_without_structure", "ids", "benchmark_task"}:
        raise ValueError("mode 不合法")
    ids = data.get("ids") or []
    if ids and not isinstance(ids, list):
        raise ValueError("ids 必须是数组")
    raw_task_id = data.get("benchmarkUpdateTaskId") or data.get("benchmark_update_task_id")
    benchmark_task_id = int(raw_task_id) if raw_task_id else None
    with connect() as conn:
        if mode == "ids":
            clean_ids = [int(value) for value in ids][:limit]
            if not clean_ids:
                raise ValueError("ids 不能为空")
            placeholders = ",".join("?" for _ in clean_ids)
            rows = conn.execute(
                f"""
                SELECT cs.id, cs.title
                FROM content_sources cs
                WHERE cs.brand_name = ? AND cs.id IN ({placeholders})
                ORDER BY cs.id DESC
                """,
                (brand_name, *clean_ids),
            ).fetchall()
        elif mode == "benchmark_task":
            if not benchmark_task_id:
                raise ValueError("benchmarkUpdateTaskId 必须填写")
            rows = conn.execute(
                """
                SELECT cs.id, cs.title
                FROM content_sources cs
                LEFT JOIN content_structures cst ON cst.source_id = cs.id
                WHERE cs.brand_name = ?
                  AND cs.benchmark_update_task_id = ?
                  AND cst.id IS NULL
                  AND (cs.raw_text != '' OR cs.note != '' OR cs.url != '')
                ORDER BY cs.id DESC
                LIMIT ?
                """,
                (brand_name, benchmark_task_id, limit),
            ).fetchall()
        else:
            selected_filter = "AND cs.selected = 1" if mode == "selected_without_structure" else ""
            rows = conn.execute(
                f"""
                SELECT cs.id, cs.title
                FROM content_sources cs
                LEFT JOIN content_structures cst ON cst.source_id = cs.id
                WHERE cs.brand_name = ?
                  {selected_filter}
                  AND cst.id IS NULL
                  AND (cs.raw_text != '' OR cs.note != '' OR cs.url != '')
                ORDER BY cs.id DESC
                LIMIT ?
                """,
                (brand_name, limit),
            ).fetchall()
    results = []
    success_count = 0
    for row in rows:
        try:
            structured = structure_content_source(int(row["id"]))
            results.append({"id": row["id"], "ok": True, "source": structured["source"], "structure": structured["structure"]})
            success_count += 1
        except Exception as exc:
            error = str(exc)
            results.append({
                "id": row["id"],
                "ok": False,
                "skipped": "不计入真实闭环" in error,
                "title": row["title"],
                "error": error,
            })
    skipped_count = len([item for item in results if item.get("skipped")])
    failed_count = len([item for item in results if not item.get("ok") and not item.get("skipped")])
    return {
        "total": len(rows),
        "success": success_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "limit": limit,
        "results": results,
    }


def latest_hot_run(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute(
        """
        SELECT id, platform, fetched_at, item_count, created_at
        FROM hot_search_runs
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "platform": row["platform"],
        "fetchedAt": row["fetched_at"],
        "itemCount": row["item_count"],
        "createdAt": row["created_at"],
    }


def normalize_trend_usage_status(value: str) -> str:
    status = (value or "").strip()
    if status not in {"candidate", "selected", "watch", "irrelevant", "blocked"}:
        raise ValueError("usageStatus 必须是 candidate/selected/watch/irrelevant/blocked")
    return status


def default_trend_usage_status(candidate_level: str, selected: bool) -> str:
    if selected:
        return "selected"
    return {
        "selected": "candidate",
        "watch": "watch",
        "discarded": "irrelevant",
    }.get(candidate_level or "", "candidate")


def trend_risk_level(keyword: str, usage_status: str) -> str:
    high_risk_terms = ["地震", "冲突", "战争", "灾害", "彩票", "政治", "高考"]
    if usage_status == "blocked":
        return "high"
    if any(term in keyword for term in high_risk_terms):
        return "medium"
    return "low"


def trend_source_id(item_id: int) -> str:
    return f"hot-{item_id}"


def trend_payload(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "sourceId": trend_source_id(row["id"]),
        "platform": row["platform"],
        "keyword": row["keyword"],
        "rank": row["rank_value"],
        "hotValue": row["hot_value"],
        "sentenceTag": row["sentence_tag"],
        "sourceUrl": row["source_url"],
        "fetchedAt": row["fetched_at"],
        "relevanceScore": row["relevance_score"] if row["relevance_score"] is not None else 0,
        "candidateLevel": row["candidate_level"] or "candidate",
        "reason": row["reason"] or "等待运营判断",
    }


def list_trends(status: str = "", limit: int = 50) -> dict:
    brand_name = load_brand_name()
    if status and status not in {"candidate", "selected", "watch", "irrelevant", "blocked", "all"}:
        raise ValueError("status 不合法")
    with connect() as conn:
        hot_run = latest_hot_run(conn)
        if not hot_run:
            return {"ok": True, "run": None, "items": [], "stats": {}}
        rows = conn.execute(
            """
            SELECT h.id, h.run_id, h.platform, h.rank_value, h.keyword, h.hot_value,
                   h.sentence_tag, h.source_url, h.fetched_at,
                   bc.relevance_score, bc.candidate_level, bc.reason,
                   tm.usage_status AS marked_status, tm.risk_level AS marked_risk,
                   tm.note AS marked_note,
                   ovs.selected AS selected
            FROM hot_search_items h
            LEFT JOIN brand_hot_candidates bc
              ON bc.run_id = h.run_id
             AND bc.brand_name = ?
             AND bc.keyword = h.keyword
            LEFT JOIN trend_marks tm
              ON tm.brand_name = ?
             AND tm.platform = h.platform
             AND tm.keyword = h.keyword
            LEFT JOIN operator_video_selections ovs
              ON ovs.brand_name = ?
             AND ovs.source_type = 'hot'
             AND ovs.source_id = 'hot-' || h.id
            WHERE h.run_id = ?
            ORDER BY h.rank_value ASC, h.id ASC
            LIMIT ?
            """,
            (brand_name, brand_name, brand_name, hot_run["id"], max(1, min(limit, 100))),
        ).fetchall()
        items = []
        for row in rows:
            selected = bool(row["selected"])
            usage_status = row["marked_status"] or default_trend_usage_status(row["candidate_level"], selected)
            risk_level = row["marked_risk"] or trend_risk_level(row["keyword"], usage_status)
            if status and status != "all" and usage_status != status:
                continue
            item = trend_payload(row)
            item.update({
                "usageStatus": usage_status,
                "riskLevel": risk_level,
                "operatorNote": row["marked_note"] or "",
                "selected": selected,
            })
            items.append(item)
        stats = {
            "total": len(items),
            "selected": sum(1 for item in items if item["usageStatus"] == "selected"),
            "candidate": sum(1 for item in items if item["usageStatus"] == "candidate"),
            "watch": sum(1 for item in items if item["usageStatus"] == "watch"),
            "blocked": sum(1 for item in items if item["usageStatus"] == "blocked"),
            "irrelevant": sum(1 for item in items if item["usageStatus"] == "irrelevant"),
        }
    return {"ok": True, "run": hot_run, "items": items, "stats": stats}


def get_hot_item(conn: sqlite3.Connection, item_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT id, run_id, platform, rank_value, keyword, hot_value,
               sentence_tag, source_url, fetched_at
        FROM hot_search_items
        WHERE id = ?
        """,
        (item_id,),
    ).fetchone()
    if not row:
        raise ValueError("热点不存在")
    return row


def mark_trend(item_id: int, data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    usage_status = normalize_trend_usage_status(data.get("usageStatus") or data.get("status") or "candidate")
    note = (data.get("note") or "").strip()
    now = utc_now()
    with connect() as conn:
        row = get_hot_item(conn, item_id)
        risk_level = (data.get("riskLevel") or trend_risk_level(row["keyword"], usage_status)).strip()
        if risk_level not in {"low", "medium", "high"}:
            raise ValueError("riskLevel 必须是 low/medium/high")
        conn.execute(
            """
            INSERT INTO trend_marks (
              brand_name, platform, keyword, usage_status, risk_level, note,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(brand_name, platform, keyword) DO UPDATE SET
              usage_status = excluded.usage_status,
              risk_level = excluded.risk_level,
              note = excluded.note,
              updated_at = excluded.updated_at
            """,
            (brand_name, row["platform"], row["keyword"], usage_status, risk_level, note, now, now),
        )
        if usage_status == "selected":
            payload = {
                "keyword": row["keyword"],
                "score": row["hot_value"],
                "platform": row["platform"],
                "rank": row["rank_value"],
                "sourceUrl": row["source_url"],
            }
            conn.execute(
                """
                INSERT INTO operator_video_selections (
                  brand_name, source_type, source_id, title, payload_json,
                  selected, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(brand_name, source_type, source_id) DO UPDATE SET
                  title = excluded.title,
                  payload_json = excluded.payload_json,
                  selected = excluded.selected,
                  updated_at = excluded.updated_at
                """,
                (
                    brand_name,
                    "hot",
                    trend_source_id(row["id"]),
                    row["keyword"],
                    json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                    1,
                    now,
                    now,
                ),
            )
        else:
            payload = {
                "keyword": row["keyword"],
                "score": row["hot_value"],
                "platform": row["platform"],
                "rank": row["rank_value"],
                "sourceUrl": row["source_url"],
            }
            conn.execute(
                """
                INSERT INTO operator_video_selections (
                  brand_name, source_type, source_id, title, payload_json,
                  selected, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(brand_name, source_type, source_id) DO UPDATE SET
                  title = excluded.title,
                  payload_json = excluded.payload_json,
                  selected = excluded.selected,
                  updated_at = excluded.updated_at
                """,
                (
                    brand_name,
                    "hot",
                    trend_source_id(row["id"]),
                    row["keyword"],
                    json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                    0,
                    now,
                    now,
                ),
            )
        conn.commit()
    trends = list_trends(status="all", limit=100)
    item = next((entry for entry in trends["items"] if entry["id"] == item_id), None)
    return {"ok": True, "item": item}


def selected_content_structures(conn: sqlite3.Connection, brand_name: str, limit: int = 5, source_ids: list[int] | None = None) -> list[dict]:
    clean_ids = [int(value) for value in (source_ids or []) if str(value).strip()]
    if clean_ids:
        placeholders = ",".join("?" for _ in clean_ids[:limit])
        rows = conn.execute(
            f"""
            SELECT cs.id, cs.title, cs.platform, cs.account_name, cs.raw_text,
                   cs.benchmark_update_task_id,
                   cst.structure_json, cst.status, cst.error, cst.created_at
            FROM content_sources cs
            JOIN content_structures cst ON cst.source_id = cs.id
            WHERE cs.brand_name = ? AND cs.selected = 1 AND cs.id IN ({placeholders})
              AND {CONTENT_SOURCE_OPERATIONAL_SQL}
            ORDER BY cst.id DESC
            """,
            (brand_name, *clean_ids[:limit]),
        ).fetchall()
    else:
        rows = conn.execute(
            f"""
            SELECT cs.id, cs.title, cs.platform, cs.account_name, cs.raw_text,
                   cs.benchmark_update_task_id,
                   cst.structure_json, cst.status, cst.error, cst.created_at
            FROM content_sources cs
            JOIN content_structures cst ON cst.source_id = cs.id
            WHERE cs.brand_name = ? AND cs.selected = 1
              AND {CONTENT_SOURCE_OPERATIONAL_SQL}
            ORDER BY cst.id DESC
            LIMIT ?
            """,
            (brand_name, limit),
        ).fetchall()
    items: list[dict] = []
    for row in rows:
        try:
            structure = json.loads(row["structure_json"] or "{}")
        except json.JSONDecodeError:
            structure = {}
        items.append(
            {
                "sourceId": row["id"],
                "title": row["title"],
                "platform": row["platform"],
                "accountName": row["account_name"],
                "benchmarkUpdateTaskId": row["benchmark_update_task_id"],
                "benchmarkTask": benchmark_task_summary(conn, row["benchmark_update_task_id"], row["account_name"]),
                "status": row["status"],
                "error": row["error"],
                "structure": structure,
                "createdAt": row["created_at"],
            }
        )
    return items


def latest_script_for_content_source(conn: sqlite3.Connection, brand_name: str, source_id: int) -> dict | None:
    rows = conn.execute(
        """
        SELECT id, title, review_status, quality_status, input_structure_json, created_at
        FROM daily_script_candidates
        WHERE brand_name = ?
        ORDER BY id DESC
        LIMIT 80
        """,
        (brand_name,),
    ).fetchall()
    for row in rows:
        try:
            structures = json.loads(row["input_structure_json"] or "[]")
        except json.JSONDecodeError:
            structures = []
        if any(int(item.get("sourceId") or 0) == int(source_id) for item in structures if isinstance(item, dict)):
            return {
                "id": row["id"],
                "title": row["title"],
                "reviewStatus": row["review_status"],
                "qualityStatus": row["quality_status"],
                "createdAt": row["created_at"],
            }
    return None


def selected_brand_products(conn: sqlite3.Connection, brand_name: str, limit: int = 3) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, brand_name, product_name, product_group, selling_points_json,
               activity_rules, price_note, store_scope, valid_from, valid_to,
               status, selected, created_at, updated_at
        FROM brand_products
        WHERE brand_name = ? AND selected = 1 AND status = 'active'
        ORDER BY updated_at DESC
        LIMIT ?
        """,
        (brand_name, limit),
    ).fetchall()
    return [serialize_brand_product(row) for row in rows]


def serialize_collection_task(row: sqlite3.Row) -> dict:
    try:
        output = json.loads(row["output_json"] or "{}")
    except json.JSONDecodeError:
        output = {}
    return {
        "id": row["id"],
        "brandName": row["brand_name"],
        "taskType": row["task_type"],
        "sourcePlatform": row["source_platform"],
        "strategy": row["strategy"],
        "status": row["status"],
        "command": row["command"],
        "output": output,
        "error": row["error"],
        "startedAt": row["started_at"],
        "finishedAt": row["finished_at"],
        "createdAt": row["created_at"],
    }


DEFAULT_COLLECTION_SCHEDULES = [
    {
        "task_type": "douyin_hot",
        "source_platform": "douyin",
        "strategy": "stable_hot_api",
        "schedule_time": "09:30",
        "queries": "",
        "enabled": 1,
        "owner": "运营",
        "fallback_action": "失败后先看最近成功热榜；当天生产不阻塞。",
        "note": "每日基础热点源，优先保证稳定。",
    },
    {
        "task_type": "douyin_category",
        "source_platform": "douyin",
        "strategy": "login_state_browser",
        "schedule_time": "10:30",
        "queries": "阿迪达斯,团购,穿搭",
        "enabled": 1,
        "owner": "运营",
        "fallback_action": "验证码或登录失效时暂停，改去对标内容池人工导入链接或字幕。",
        "note": "每次最多 3 个词，只做小批量补充。",
    },
    {
        "task_type": "xhs_placeholder",
        "source_platform": "xhs",
        "strategy": "manual_import",
        "schedule_time": "11:00",
        "queries": "运动鞋,团购,门店试穿",
        "enabled": 1,
        "owner": "运营",
        "fallback_action": "小红书暂不做不稳定自动采集，直接导入笔记链接、正文或第三方表格。",
        "note": "把小红书需求显式纳入每日工作流。",
    },
    {
        "task_type": "third_party_import",
        "source_platform": "third_party",
        "strategy": "third_party_import",
        "schedule_time": "14:00",
        "queries": "",
        "enabled": 1,
        "owner": "运营",
        "fallback_action": "从灰豚、蝉妈妈、飞瓜、新榜或飞书表格复制到对标内容池批量导入。",
        "note": "自动采集失败时的正式兜底输入。",
    },
]


def ensure_default_collection_schedules(conn: sqlite3.Connection, brand_name: str) -> None:
    now = utc_now()
    for item in DEFAULT_COLLECTION_SCHEDULES:
        conn.execute(
            """
            INSERT OR IGNORE INTO collection_schedules (
              brand_name, task_type, source_platform, strategy, schedule_time,
              queries, enabled, owner, fallback_action, note, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                item["task_type"],
                item["source_platform"],
                item["strategy"],
                item["schedule_time"],
                item["queries"],
                item["enabled"],
                item["owner"],
                item["fallback_action"],
                item["note"],
                now,
                now,
            ),
        )


def serialize_collection_schedule(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "brandName": row["brand_name"],
        "taskType": row["task_type"],
        "sourcePlatform": row["source_platform"],
        "strategy": row["strategy"],
        "scheduleTime": row["schedule_time"],
        "queries": row["queries"],
        "enabled": bool(row["enabled"]),
        "owner": row["owner"],
        "fallbackAction": row["fallback_action"],
        "note": row["note"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_collection_schedules() -> dict:
    brand_name = load_brand_name()
    with connect() as conn:
        ensure_default_collection_schedules(conn, brand_name)
        rows = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, schedule_time,
                   queries, enabled, owner, fallback_action, note, created_at, updated_at
            FROM collection_schedules
            WHERE brand_name = ?
            ORDER BY schedule_time, id
            """,
            (brand_name,),
        ).fetchall()
        conn.commit()
    return {"ok": True, "items": [serialize_collection_schedule(row) for row in rows]}


def update_collection_schedule(schedule_id: int, data: dict) -> dict:
    brand_name = load_brand_name()
    schedule_time = (data.get("scheduleTime") or "").strip()
    queries = (data.get("queries") or "").strip()
    owner = (data.get("owner") or "运营").strip()
    fallback_action = (data.get("fallbackAction") or "").strip()
    note = (data.get("note") or "").strip()
    enabled = 1 if bool(data.get("enabled", True)) else 0
    if schedule_time and not re.match(r"^\d{2}:\d{2}$", schedule_time):
        raise ValueError("scheduleTime 必须是 HH:MM 格式")
    now = utc_now()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, schedule_time,
                   queries, enabled, owner, fallback_action, note, created_at, updated_at
            FROM collection_schedules
            WHERE id = ? AND brand_name = ?
            """,
            (schedule_id, brand_name),
        ).fetchone()
        if not row:
            raise ValueError("采集计划不存在")
        conn.execute(
            """
            UPDATE collection_schedules
            SET schedule_time = ?, queries = ?, enabled = ?, owner = ?,
                fallback_action = ?, note = ?, updated_at = ?
            WHERE id = ? AND brand_name = ?
            """,
            (
                schedule_time or row["schedule_time"],
                queries,
                enabled,
                owner,
                fallback_action or row["fallback_action"],
                note or row["note"],
                now,
                schedule_id,
                brand_name,
            ),
        )
        updated = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, schedule_time,
                   queries, enabled, owner, fallback_action, note, created_at, updated_at
            FROM collection_schedules
            WHERE id = ?
            """,
            (schedule_id,),
        ).fetchone()
        conn.commit()
    return serialize_collection_schedule(updated)


def list_collection_tasks(limit: int = 20) -> list[dict]:
    brand_name = load_brand_name()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, status,
                   command, output_json, error, started_at, finished_at, created_at
            FROM collection_tasks
            WHERE brand_name = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (brand_name, max(1, min(limit, 100))),
        ).fetchall()
    return [serialize_collection_task(row) for row in rows]


def collection_task_manual_import_params(task: dict) -> dict:
    platform = task.get("sourcePlatform") or ("xhs" if task.get("taskType") == "xhs_placeholder" else "manual")
    title = "小红书人工导入素材" if task.get("taskType") == "xhs_placeholder" else f"{collection_task_type_label(task.get('taskType'))}失败补录"
    note = task.get("error") or "采集任务失败，改用人工导入补充素材。"
    return {
        "platform": platform,
        "title": title,
        "account": collection_strategy_label(task.get("strategy")),
        "note": note,
    }


def collection_task_type_label(value: str | None) -> str:
    return {
        "douyin_hot": "抖音总热榜采集",
        "douyin_category": "抖音类目小批量采集",
        "xhs_placeholder": "小红书占位任务",
        "third_party_import": "第三方表格兜底",
    }.get(value or "", value or "未知任务")


def collection_strategy_label(value: str | None) -> str:
    return {
        "stable_hot_api": "稳定热榜接口",
        "login_state_browser": "登录态浏览器",
        "manual_import": "人工/第三方导入",
        "third_party_import": "第三方表格导入",
    }.get(value or "", value or "未知策略")


def collection_trace_manual_import_url(params: dict, task_id: int | None = None) -> str:
    query = {
        "importPlatform": params.get("platform") or "manual",
        "importTitle": params.get("title") or "采集失败补录",
        "importAccount": params.get("account") or "采集兜底",
        "importNote": params.get("note") or "采集任务失败，改用人工导入补充素材。",
    }
    if task_id:
        query["collectionTaskId"] = str(task_id)
    return f"./content-pool.html?v=collection-trace-v1&{urllib.parse.urlencode(query)}#manual-import"


def matched_content_sources_for_collection_task(conn: sqlite3.Connection, task: dict, limit: int = 5) -> list[dict]:
    params = collection_task_manual_import_params(task)
    platform = params.get("platform") or task.get("sourcePlatform") or ""
    note = (params.get("note") or task.get("error") or "").strip()
    account = params.get("account") or collection_strategy_label(task.get("strategy"))
    title = params.get("title") or ""
    where = ["brand_name = ?"]
    values: list[object] = [task.get("brandName") or load_brand_name()]
    candidates: list[str] = []
    if platform:
        where.append("platform = ?")
        values.append(platform)
    if note:
        candidates.append(note[:80])
    if account:
        candidates.append(account)
    if title:
        candidates.append(title)
    if candidates:
        where.append("(" + " OR ".join(["note LIKE ? OR account_name LIKE ? OR title LIKE ?" for _ in candidates]) + ")")
        for item in candidates:
            like = f"%{item}%"
            values.extend([like, like, like])
    rows = conn.execute(
        f"""
        SELECT id, workday_date, brand_name, platform, source_type, title,
               url, account_name, raw_text, note, import_method, status,
               selected, benchmark_update_task_id, created_at, updated_at
        FROM content_sources
        WHERE {' AND '.join(where)}
        ORDER BY id DESC
        LIMIT ?
        """,
        (*values, limit),
    ).fetchall()
    return [
        serialize_content_source(row, latest_content_structure(conn, row["id"]), latest_subtitle_job(conn, row["id"]))
        for row in rows
    ]


def collection_task_trace(conn: sqlite3.Connection, task: dict) -> dict:
    output = task.get("output") or {}
    artifacts = output.get("artifacts") if isinstance(output.get("artifacts"), list) else []
    fallback_actions = output.get("fallbackActions") if isinstance(output.get("fallbackActions"), list) else []
    params = collection_task_manual_import_params(task)
    matched_sources = matched_content_sources_for_collection_task(conn, task)
    structured_count = len([item for item in matched_sources if (item.get("structure") or {}).get("status") == "structure_done"])
    selected_count = len([item for item in matched_sources if item.get("selected")])
    if structured_count:
        status = "structured"
        status_label = "兜底已结构化"
        next_action = "进入脚本生成"
        next_href = "./index.html?v=collection-trace-v1#stepGenerate"
    elif selected_count:
        status = "selected"
        status_label = "已加入工作流"
        next_action = "批量生成结构摘要"
        next_href = "./content-pool.html?v=collection-trace-v1#contentPoolList"
    elif matched_sources:
        status = "imported"
        status_label = "已导入待处理"
        next_action = "加入生成工作流"
        next_href = "./content-pool.html?v=collection-trace-v1#contentPoolList"
    else:
        status = "waiting_import"
        status_label = "等待人工导入"
        next_action = "带入对标内容池"
        next_href = collection_trace_manual_import_url(params, task.get("id"))
    steps = [
        {
            "key": "task",
            "label": "采集任务",
            "status": "done" if task.get("status") in {"success", "failed"} else "running",
            "detail": task.get("error") or task.get("status") or "任务已记录",
        },
        {
            "key": "artifacts",
            "label": "失败证据/产物",
            "status": "done" if artifacts else ("skipped" if task.get("status") == "success" else "missing"),
            "detail": f"{len(artifacts)} 个产物" if artifacts else "暂无截图或 JSON 产物",
        },
        {
            "key": "import",
            "label": "人工/第三方导入",
            "status": "done" if matched_sources else "waiting",
            "detail": f"匹配到 {len(matched_sources)} 条内容池素材" if matched_sources else "等待运营导入链接、字幕或表格",
        },
        {
            "key": "structure",
            "label": "结构摘要",
            "status": "done" if structured_count else ("waiting" if matched_sources else "blocked"),
            "detail": f"{structured_count} 条已结构化" if structured_count else "导入后必须结构化再生成",
        },
    ]
    return {
        "taskId": task.get("id"),
        "taskType": task.get("taskType"),
        "sourcePlatform": task.get("sourcePlatform"),
        "strategy": task.get("strategy"),
        "status": status,
        "statusLabel": status_label,
        "title": collection_task_type_label(task.get("taskType")),
        "error": task.get("error") or "",
        "artifacts": artifacts,
        "fallbackActions": fallback_actions,
        "manualImport": {
            **params,
            "href": collection_trace_manual_import_url(params, task.get("id")),
        },
        "matchedSources": matched_sources,
        "counts": {
            "artifacts": len(artifacts),
            "matchedSources": len(matched_sources),
            "selectedSources": selected_count,
            "structuredSources": structured_count,
        },
        "steps": steps,
        "nextAction": next_action,
        "nextHref": next_href,
        "rule": "追溯链路使用现有任务产物、跳转导入参数和内容池匹配结果生成；没有匹配时显示待导入，不伪造已完成。",
    }


def collection_fallback_trace_snapshot(conn: sqlite3.Connection, brand_name: str, limit: int = 6) -> dict:
    rows = conn.execute(
        """
        SELECT id, brand_name, task_type, source_platform, strategy, status,
               command, output_json, error, started_at, finished_at, created_at
        FROM collection_tasks
        WHERE brand_name = ? AND (status = 'failed' OR strategy IN ('manual_import', 'third_party_import'))
        ORDER BY id DESC
        LIMIT ?
        """,
        (brand_name, max(1, min(limit, 12))),
    ).fetchall()
    traces = [collection_task_trace(conn, serialize_collection_task(row)) for row in rows]
    waiting = len([item for item in traces if item.get("status") == "waiting_import"])
    imported = len([item for item in traces if item.get("status") in {"imported", "selected", "structured"}])
    structured = len([item for item in traces if item.get("status") == "structured"])
    if waiting:
        level = "needs_import"
        summary = f"{waiting} 条采集失败/兜底任务还没匹配到人工导入结果。"
    elif traces and structured:
        level = "trace_ready"
        summary = f"已串起 {len(traces)} 条兜底链路，其中 {structured} 条已结构化。"
    elif traces:
        level = "imported"
        summary = f"已匹配 {imported} 条兜底导入结果，下一步补结构摘要。"
    else:
        level = "empty"
        summary = "暂无采集失败或兜底任务需要追溯。"
    return {
        "version": "collection_fallback_trace_v1",
        "level": level,
        "summary": summary,
        "counts": {
            "traces": len(traces),
            "waitingImport": waiting,
            "matchedImport": imported,
            "structured": structured,
        },
        "items": traces,
        "rules": [
            "失败截图和 JSON 产物来自 collection_tasks.output.artifacts。",
            "人工导入结果用平台、标题、来源账号和失败备注匹配 content_sources。",
            "匹配不到时只显示待导入，不把计划任务当作真实导入。",
            "导入后必须进入生成工作流并生成结构摘要，才算兜底闭环完成。",
        ],
    }


def insert_manual_collection_task(
    brand_name: str,
    task_type: str,
    source_platform: str,
    strategy: str,
    command: str,
    output: dict,
    error: str,
) -> dict:
    now = utc_now()
    status = "failed"
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO collection_tasks (
              brand_name, task_type, source_platform, strategy, status,
              command, output_json, error, started_at, finished_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                task_type,
                source_platform,
                strategy,
                status,
                command,
                json.dumps(output, ensure_ascii=False, separators=(",", ":")),
                error,
                now,
                now,
                now,
            ),
        )
        row = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, status,
                   command, output_json, error, started_at, finished_at, created_at
            FROM collection_tasks
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
        conn.commit()
    return serialize_collection_task(row)


def run_collection_schedule(schedule_id: int) -> dict:
    brand_name = load_brand_name()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, schedule_time,
                   queries, enabled, owner, fallback_action, note, created_at, updated_at
            FROM collection_schedules
            WHERE id = ? AND brand_name = ?
            """,
            (schedule_id, brand_name),
        ).fetchone()
    if not row:
        raise ValueError("采集计划不存在")
    schedule = serialize_collection_schedule(row)
    if not schedule["enabled"]:
        raise ValueError("采集计划已暂停，不能运行")
    if schedule["taskType"] == "third_party_import":
        output = {
            "returncode": "manual_required",
            "stdout": "第三方表格兜底计划需要运营从灰豚、蝉妈妈、飞瓜、新榜或飞书表格复制数据到对标内容池。",
            "stderr": "",
            "artifacts": [],
            "fallbackActions": [
                "打开对标内容池批量导入",
                "粘贴第三方表格并查看导入前预检",
                "导入后批量加入生成工作流并结构化",
            ],
            "schedule": schedule,
        }
        task = insert_manual_collection_task(
            brand_name,
            "third_party_import",
            "third_party",
            "third_party_import",
            "manual third_party_table_import",
            output,
            "第三方表格兜底需要人工导入，不执行自动采集。",
        )
        return {"schedule": schedule, "task": task}
    payload = {
        "brandName": brand_name,
        "taskType": schedule["taskType"],
        "queries": schedule["queries"],
    }
    task = run_collection_task(payload)
    return {"schedule": schedule, "task": task}


def latest_collection_tasks_by_strategy(conn: sqlite3.Connection, brand_name: str) -> dict[str, dict]:
    rows = conn.execute(
        """
        SELECT id, brand_name, task_type, source_platform, strategy, status,
               command, output_json, error, started_at, finished_at, created_at
        FROM collection_tasks
        WHERE brand_name = ?
        ORDER BY id DESC
        """,
        (brand_name,),
    ).fetchall()
    latest: dict[str, dict] = {}
    for row in rows:
        item = serialize_collection_task(row)
        latest.setdefault(item["strategy"], item)
    return latest


def collection_strategy_snapshot(
    schedules: list[dict],
    latest_tasks: dict[str, dict],
    hot_run: dict | None,
) -> dict:
    schedule_by_task = {item["taskType"]: item for item in schedules}
    strategy_specs = [
        {
            "key": "douyin_hot",
            "title": "抖音公开热榜",
            "role": "基础热点源",
            "taskType": "douyin_hot",
            "strategy": "stable_hot_api",
            "stable": True,
            "fallback": "热榜失败时先使用最近成功热榜，不阻塞当天生产。",
        },
        {
            "key": "douyin_category",
            "title": "抖音登录态小批量",
            "role": "类目/对标补充",
            "taskType": "douyin_category",
            "strategy": "login_state_browser",
            "stable": False,
            "fallback": "验证码或登录失效时暂停，改用人工导入链接、字幕或第三方表格。",
        },
        {
            "key": "xhs_manual",
            "title": "小红书人工导入",
            "role": "小红书替代方案",
            "taskType": "xhs_placeholder",
            "strategy": "manual_import",
            "stable": True,
            "fallback": "暂不做不稳定自动采集，导入笔记链接、正文、截图字幕或第三方榜单。",
        },
        {
            "key": "third_party_import",
            "title": "第三方表格兜底",
            "role": "采集失败兜底",
            "taskType": "third_party_import",
            "strategy": "third_party_import",
            "stable": True,
            "fallback": "从灰豚、蝉妈妈、飞瓜、新榜或飞书表格复制到对标内容池批量导入。",
        },
    ]
    lanes: list[dict] = []
    for spec in strategy_specs:
        schedule = schedule_by_task.get(spec["taskType"])
        task = latest_tasks.get(spec["strategy"])
        fallback_actions = []
        if task:
            output = task.get("output") or {}
            fallback_actions = output.get("fallbackActions") if isinstance(output.get("fallbackActions"), list) else []
        if spec["taskType"] == "douyin_hot" and hot_run:
            status = "ready"
            status_label = "可用"
            evidence = f"最近成功热榜 {hot_run.get('itemCount') or 0} 条"
            action = "可直接用于今日选题"
        elif task and task["status"] == "success":
            status = "ready"
            status_label = "可用"
            evidence = f"最近任务成功：{task['finishedAt'] or task['createdAt']}"
            action = "把成功数据加入今日工作流"
        elif task and task["status"] == "failed":
            status = "fallback"
            status_label = "走兜底"
            evidence = task.get("error") or "最近任务失败"
            action = (fallback_actions or [spec["fallback"]])[0]
        elif schedule and not schedule["enabled"]:
            status = "paused"
            status_label = "已暂停"
            evidence = "采集计划已暂停"
            action = "如今天需要该来源，先启用计划或改走人工导入"
        else:
            status = "waiting"
            status_label = "待运行"
            evidence = "今天还没有任务记录"
            action = "按计划运行一次或直接人工导入"
        lanes.append({
            **spec,
            "status": status,
            "statusLabel": status_label,
            "enabled": bool(schedule["enabled"]) if schedule else False,
            "scheduleTime": schedule["scheduleTime"] if schedule else "",
            "owner": schedule["owner"] if schedule else "运营",
            "queries": schedule["queries"] if schedule else "",
            "fallbackAction": schedule["fallbackAction"] if schedule else spec["fallback"],
            "latestTask": task,
            "evidence": evidence,
            "recommendedAction": action,
        })

    ready_count = sum(1 for lane in lanes if lane["status"] == "ready")
    fallback_count = sum(1 for lane in lanes if lane["status"] == "fallback")
    if ready_count >= 2 and fallback_count == 0:
        level = "healthy"
        summary = "今日采集保障正常：已有可用热点源和补充来源。"
        next_action = "继续按脚本流程生成候选脚本。"
    elif ready_count >= 1:
        level = "usable_with_fallback"
        summary = "今日可以继续生产，但部分采集需要走人工或第三方兜底。"
        next_action = "优先处理失败来源，或直接去对标内容池补人工数据。"
    else:
        level = "needs_input"
        summary = "今日采集保障不足：先运行公开热榜，或导入人工/第三方数据。"
        next_action = "先运行抖音热榜采集；失败时立即导入第三方表格。"

    return {
        "level": level,
        "summary": summary,
        "nextAction": next_action,
        "readyCount": ready_count,
        "fallbackCount": fallback_count,
        "lanes": lanes,
        "rule": "采集自动化不是唯一入口；公开热榜、登录态小批量、人工导入、第三方表格必须形成可切换保障链路。",
    }


def data_source_matrix_snapshot(
    stats: dict,
    history_stats: dict,
    collection_strategy: dict,
    hot_run: dict | None,
    content_sources: list[dict],
    scripts: list[dict],
    benchmark_update_snapshot: dict | None = None,
) -> dict:
    lanes = collection_strategy.get("lanes") or []
    lane_by_task = {lane.get("taskType"): lane for lane in lanes}
    fallback_lanes = [lane for lane in lanes if lane.get("status") == "fallback"]
    selected_sources = stats.get("selectedContentSources") or 0
    structured_sources = stats.get("contentStructures") or 0
    source_count = stats.get("contentSources") or 0
    subtitle_jobs = stats.get("subtitleJobs") or 0
    successful_subtitles = stats.get("successfulSubtitleJobs") or 0
    script_count = stats.get("scripts") or 0
    benchmark_updates = benchmark_update_snapshot or {}
    benchmark_update_items = benchmark_updates.get("items") or []
    benchmark_total = len(benchmark_update_items)
    benchmark_pending = benchmark_updates.get("pendingCount") or 0
    benchmark_done = benchmark_updates.get("doneCount") or 0
    benchmark_imported = sum(item.get("importedCount") or 0 for item in benchmark_update_items)
    benchmark_structured = sum(item.get("structuredCount") or 0 for item in benchmark_update_items)
    pending_benchmark = next((item for item in benchmark_update_items if item.get("status") == "pending"), None)
    in_progress_benchmark = next((item for item in benchmark_update_items if item.get("status") == "in_progress"), None)
    benchmark_action_item = in_progress_benchmark or pending_benchmark or (benchmark_update_items[0] if benchmark_update_items else {})
    if not benchmark_total:
        benchmark_status = "waiting"
        benchmark_status_label = "待配置"
        benchmark_evidence = "还没有固定对标账号池，无法形成每日更新任务。"
        benchmark_next_action = "先维护固定对标账号池"
        benchmark_href = "./content-pool.html?v=benchmark-source-v1"
    elif benchmark_pending:
        benchmark_status = "waiting"
        benchmark_status_label = "待更新"
        benchmark_evidence = f"固定对标账号 {benchmark_total} 个；今日待补 {benchmark_pending} 个，已完成 {benchmark_done} 个。"
        benchmark_next_action = f"补「{benchmark_action_item.get('accountName') or '对标账号'}」近期 1-3 条"
        benchmark_href = benchmark_action_item.get("importHref") or benchmark_action_item.get("href") or "./content-pool.html?v=benchmark-source-v1#benchmark-update"
    elif benchmark_imported and not benchmark_structured:
        benchmark_status = "usable"
        benchmark_status_label = "待结构化"
        benchmark_evidence = f"今日对标账号已导入 {benchmark_imported} 条素材，但结构摘要不足。"
        benchmark_next_action = "批量生成对标素材结构摘要"
        benchmark_href = benchmark_action_item.get("href") or "./content-pool.html?v=benchmark-source-v1#benchmark-update"
    else:
        benchmark_status = "ready"
        benchmark_status_label = "已更新"
        benchmark_evidence = f"今日对标账号已完成 {benchmark_done}/{benchmark_total} 个；导入 {benchmark_imported} 条，结构化 {benchmark_structured} 条。"
        benchmark_next_action = "查看对标素材并进入生成"
        benchmark_href = benchmark_action_item.get("href") or "./content-pool.html?v=benchmark-source-v1#benchmark-update"

    def source_item(
        layer: str,
        title: str,
        role: str,
        status: str,
        status_label: str,
        evidence: str,
        risk: str,
        output: str,
        next_action: str,
        href: str,
        owner: str = "运营",
        source_platform: str = "",
        automation: str = "",
    ) -> dict:
        return {
            "layer": layer,
            "title": title,
            "role": role,
            "status": status,
            "statusLabel": status_label,
            "evidence": evidence,
            "risk": risk,
            "output": output,
            "nextAction": next_action,
            "href": href,
            "owner": owner,
            "sourcePlatform": source_platform,
            "automation": automation,
        }

    hot_lane = lane_by_task.get("douyin_hot") or {}
    category_lane = lane_by_task.get("douyin_category") or {}
    xhs_lane = lane_by_task.get("xhs_placeholder") or {}
    third_party_lane = lane_by_task.get("third_party_import") or {}

    sources = [
        source_item(
            "A",
            "公开热榜",
            "稳定主干",
            "ready" if hot_run else "waiting",
            "可用" if hot_run else "待采集",
            f"最近抖音热榜 {hot_run.get('itemCount') or 0} 条，时间 {hot_run.get('fetchedAt') or ''}" if hot_run else "今天还没有可用公开热榜。",
            "只提供热点词和热度排序，不能当作视频字幕或具体画面。",
            "热点池、今日推荐选题、脚本热词来源",
            "可直接用于选题" if hot_run else "先运行抖音总热榜采集",
            "./trend-pool.html?v=data-source-matrix-v1",
            hot_lane.get("owner") or "运营",
            "douyin",
            "auto_stable",
        ),
        source_item(
            "B",
            "登录态小批量采集",
            "增强补充",
            "fallback" if category_lane.get("status") == "fallback" else ("ready" if category_lane.get("status") == "ready" else "waiting"),
            category_lane.get("statusLabel") or "待运行",
            category_lane.get("evidence") or "每次最多 3 个词，用于类目词和对标页面补充。",
            "依赖本地登录态，遇验证码或登录失效必须暂停，不能强行自动化。",
            "类目搜索结果、失败截图、对标补充线索",
            "去对标内容池人工补录链接或字幕" if category_lane.get("status") == "fallback" else (category_lane.get("recommendedAction") or "按计划小批量运行；失败时改走人工导入。"),
            "./content-pool.html?v=data-source-matrix-v1&importPlatform=douyin&importMode=single&importTitle=%E6%8A%96%E9%9F%B3%E7%99%BB%E5%BD%95%E6%80%81%E9%87%87%E9%9B%86%E5%A4%B1%E8%B4%A5%E8%A1%A5%E5%BD%95&importAccount=%E7%99%BB%E5%BD%95%E6%80%81%E5%B0%8F%E6%89%B9%E9%87%8F%E9%87%87%E9%9B%86&importNote=%E4%BB%8E%E9%A6%96%E9%A1%B5%E6%95%B0%E6%8D%AE%E6%BA%90%E5%BE%85%E5%8A%9E%E8%B7%B3%E8%BD%AC%EF%BC%9A%E7%99%BB%E5%BD%95%E6%80%81%E9%87%87%E9%9B%86%E9%81%87%E5%88%B0%E9%AA%8C%E8%AF%81%E7%A0%81%E6%88%96%E7%99%BB%E5%BD%95%E5%A4%B1%E6%95%88%EF%BC%8C%E8%AF%B7%E6%94%B9%E7%94%A8%E4%BA%BA%E5%B7%A5%E5%AF%BC%E5%85%A5%E5%AF%B9%E6%A0%87%E9%93%BE%E6%8E%A5%E3%80%81%E8%A7%86%E9%A2%91%E5%AD%97%E5%B9%95%E6%88%96%E7%AC%AC%E4%B8%89%E6%96%B9%E8%A1%A8%E6%A0%BC%E3%80%82#manual-import" if category_lane.get("status") == "fallback" else "./collection-center.html?v=data-source-matrix-v1",
            category_lane.get("owner") or "运营",
            "douyin",
            "login_state_limited",
        ),
        source_item(
            "C",
            "人工导入内容池",
            "正式兜底",
            "ready" if selected_sources and structured_sources else ("usable" if source_count else "waiting"),
            "可生成" if selected_sources and structured_sources else ("可补结构" if source_count else "待导入"),
            f"今日素材 {source_count} 条 / 已加入 {selected_sources} 条 / 已结构化 {structured_sources} 条。",
            "人工数据质量取决于链接、字幕和备注完整度；导入后必须结构化。",
            "视频链接、笔记正文、手工字幕、结构摘要",
            "批量导入并生成结构摘要" if source_count else "导入 3-10 条对标视频/笔记链接或字幕",
            "./content-pool.html?v=data-source-matrix-v1#manual-import",
            "运营",
            "manual",
            "human_in_loop",
        ),
        source_item(
            "C2",
            "固定对标账号池",
            "每日更新",
            benchmark_status,
            benchmark_status_label,
            benchmark_evidence,
            "对标账号池如果只停留在账号名单，不能支撑脚本生成；每天必须补近期内容并结构化。",
            "固定账号近期视频/笔记、对标结构、账号更新进度",
            benchmark_next_action,
            benchmark_href,
            "运营",
            "benchmark",
            "human_or_third_party",
        ),
        source_item(
            "D",
            "第三方表格",
            "批量兜底",
            "fallback" if third_party_lane.get("status") == "fallback" else ("ready" if source_count else "waiting"),
            "可导入" if source_count else "待导入",
            third_party_lane.get("evidence") or "支持灰豚、蝉妈妈、飞瓜、新榜或飞书表格粘贴预检。",
            "第三方字段不统一，需要先预检、去重、标注平台和风险词。",
            "批量链接、账号、标题、互动指标、来源工具",
            "去对标内容池粘贴表格并预检",
            "./content-pool.html?v=data-source-matrix-v1&importPlatform=third_party&importMode=batch&importTitle=%E7%AC%AC%E4%B8%89%E6%96%B9%E8%A1%A8%E6%A0%BC%E5%85%9C%E5%BA%95&importAccount=%E7%81%B0%E8%B1%9A%2F%E8%9D%89%E5%A6%88%E5%A6%88%2F%E9%A3%9E%E7%93%9C%2F%E6%96%B0%E6%A6%9C&importNote=%E4%BB%8E%E9%A6%96%E9%A1%B5%E6%95%B0%E6%8D%AE%E6%BA%90%E5%BE%85%E5%8A%9E%E8%B7%B3%E8%BD%AC%EF%BC%9A%E8%AF%B7%E7%B2%98%E8%B4%B4%E7%AC%AC%E4%B8%89%E6%96%B9%E8%A1%A8%E6%A0%BC%E5%B9%B6%E5%85%88%E7%9C%8B%E5%AF%BC%E5%85%A5%E5%89%8D%E9%A2%84%E6%A3%80%E3%80%82#batch-import",
            third_party_lane.get("owner") or "运营",
            "third_party",
            "table_import",
        ),
        source_item(
            "B/C",
            "小红书内容",
            "平台补充",
            "fallback" if xhs_lane.get("status") == "fallback" else ("waiting" if not source_count else "usable"),
            xhs_lane.get("statusLabel") or "人工接入",
            xhs_lane.get("evidence") or "小红书不做不稳定自动采集，先通过人工链接、正文或第三方榜单导入。",
            "自动采集风险高；当前不能把占位任务当成真实采集成功。",
            "小红书笔记链接、正文、标题和互动数据",
            "人工导入小红书笔记链接或正文",
            "./content-pool.html?v=data-source-matrix-v1&importPlatform=xhs&importMode=single&importTitle=%E5%B0%8F%E7%BA%A2%E4%B9%A6%E4%BA%BA%E5%B7%A5%E5%AF%BC%E5%85%A5%E7%B4%A0%E6%9D%90&importAccount=%E5%B0%8F%E7%BA%A2%E4%B9%A6%E4%BA%BA%E5%B7%A5%E5%AF%BC%E5%85%A5&importNote=%E4%BB%8E%E9%A6%96%E9%A1%B5%E6%95%B0%E6%8D%AE%E6%BA%90%E5%BE%85%E5%8A%9E%E8%B7%B3%E8%BD%AC%EF%BC%9A%E5%B0%8F%E7%BA%A2%E4%B9%A6%E8%87%AA%E5%8A%A8%E9%87%87%E9%9B%86%E6%9A%82%E4%B8%8D%E6%8E%A5%E5%85%A5%EF%BC%8C%E8%AF%B7%E7%B2%98%E8%B4%B4%E7%AC%94%E8%AE%B0%E9%93%BE%E6%8E%A5%E3%80%81%E6%AD%A3%E6%96%87%E3%80%81%E5%AD%97%E5%B9%95%E6%88%96%E7%AC%AC%E4%B8%89%E6%96%B9%E6%A6%9C%E5%8D%95%E6%95%B0%E6%8D%AE%E3%80%82#manual-import",
            xhs_lane.get("owner") or "运营",
            "xhs",
            "manual_first",
        ),
        source_item(
            "E",
            "字幕和结构摘要",
            "质量输入",
            "ready" if structured_sources else ("usable" if successful_subtitles else "waiting"),
            "已结构化" if structured_sources else ("有字幕" if successful_subtitles else "待结构化"),
            f"字幕任务 {subtitle_jobs} 个 / 成功 {successful_subtitles} 个；今日结构摘要 {structured_sources} 条。",
            "没有字幕或结构摘要时，脚本会退化成标题级生成。",
            "开头钩子、节奏、CTA、风险和可借鉴结构",
            "补字幕并批量生成结构摘要",
            "./content-pool.html?v=data-source-matrix-v1",
            "运营",
            "subtitle",
            "mixed",
        ),
        source_item(
            "F",
            "脚本库复盘",
            "学习反馈",
            "ready" if script_count else ("usable" if history_stats.get("scripts") else "waiting"),
            "今日有脚本" if script_count else ("有历史资产" if history_stats.get("scripts") else "待生成"),
            f"今日脚本 {script_count} 条 / 历史脚本 {history_stats.get('scripts') or 0} 条。",
            "复盘数据只有在审核、发布和模板标记后才会反哺生成。",
            "模板、采用/待改/弃用、发布表现、复盘反馈",
            "审核脚本并回填发布表现",
            "./script-library.html?v=data-source-matrix-v1",
            "内容负责人",
            "internal",
            "feedback_loop",
        ),
    ]
    ready_count = sum(1 for item in sources if item["status"] == "ready")
    usable_count = sum(1 for item in sources if item["status"] in {"ready", "usable"})
    blocked_count = sum(1 for item in sources if item["status"] in {"fallback", "waiting"})
    if ready_count >= 3 and not fallback_lanes:
        level = "healthy"
        summary = "数据源状态健康：自动源、人工源和复盘源都可支撑今日生产。"
    elif usable_count >= 3:
        level = "usable_with_fallback"
        summary = "数据源可支撑生产，但部分平台采集需要人工或第三方兜底。"
    else:
        level = "needs_input"
        summary = "数据源不足：先补公开热榜、人工素材或结构摘要。"
    return {
        "level": level,
        "summary": summary,
        "readyCount": ready_count,
        "usableCount": usable_count,
        "blockedCount": blocked_count,
        "sources": sources,
        "rules": [
            "A 层公开热榜是主干，但只代表热点词，不代表可复制视频内容。",
            "B 层登录态采集只做小批量增强，验证码或登录失效时必须暂停。",
            "C/D 层人工和第三方导入是正式生产入口，不是临时补救。",
            "字幕结构和脚本复盘决定生成质量，不能只看热榜是否成功。",
        ],
    }


def collection_action_flow_snapshot(data_source_matrix: dict, collection_strategy: dict, readiness: dict) -> dict:
    sources = data_source_matrix.get("sources") or []
    source_by_title = {source.get("title"): source for source in sources}
    lanes = collection_strategy.get("lanes") or []
    fallback_lanes = [lane for lane in lanes if lane.get("status") == "fallback"]
    waiting_lanes = [lane for lane in lanes if lane.get("status") in {"waiting", "paused"}]

    steps: list[dict] = []

    def add_step(key: str, title: str, source: dict | None, action: str, href: str, status: str, reason: str, owner: str = "运营") -> None:
        steps.append({
            "key": key,
            "title": title,
            "status": status,
            "statusLabel": collection_action_status_text(status),
            "sourceLayer": (source or {}).get("layer") or "",
            "sourceTitle": (source or {}).get("title") or "",
            "reason": reason,
            "action": action,
            "href": href,
            "owner": owner,
        })

    hot_source = source_by_title.get("公开热榜")
    if hot_source and hot_source.get("status") == "ready":
        add_step("hot", "锁定公开热榜作为今日主干", hot_source, "去热点池筛选候选", hot_source.get("href") or "./trend-pool.html", "done", hot_source.get("evidence") or "公开热榜可用")
    else:
        add_step("hot", "先运行抖音公开热榜", hot_source, "运行抖音总热榜采集", "./collection-center.html?v=collection-action-flow-v1#run-douyin-hot", "run", (hot_source or {}).get("evidence") or "缺少今日公开热榜")

    if fallback_lanes:
        lane = fallback_lanes[0]
        source = next((item for item in sources if lane.get("sourcePlatform") == item.get("sourcePlatform") and item.get("status") == "fallback"), None)
        add_step(
            "fallback",
            f"切换兜底：{lane.get('title') or '失败来源'}",
            source,
            (source or {}).get("nextAction") or lane.get("recommendedAction") or "去人工导入",
            (source or {}).get("href") or "./content-pool.html?v=collection-action-flow-v1#manual-import",
            "fallback",
            lane.get("evidence") or "自动采集失败，不能阻塞今日生产。",
            lane.get("owner") or "运营",
        )
    elif waiting_lanes:
        lane = waiting_lanes[0]
        add_step(
            "supplement",
            f"补充增强来源：{lane.get('title') or '待运行来源'}",
            None,
            lane.get("recommendedAction") or "按计划运行一次",
            "./collection-center.html?v=collection-action-flow-v1#collection-plan",
            "waiting",
            lane.get("evidence") or "该来源今天还未运行。",
            lane.get("owner") or "运营",
        )

    manual_source = source_by_title.get("人工导入内容池")
    if manual_source and manual_source.get("status") in {"ready", "usable"}:
        add_step("manual", "把人工素材推进生成工作流", manual_source, manual_source.get("nextAction") or "批量加入并结构化", manual_source.get("href") or "./content-pool.html", "ready", manual_source.get("evidence") or "已有人工素材")
    else:
        add_step("manual", "补 3-10 条对标视频/笔记", manual_source, "去对标内容池导入", "./content-pool.html?v=collection-action-flow-v1#manual-import", "waiting", (manual_source or {}).get("evidence") or "人工素材不足")

    benchmark_source = source_by_title.get("固定对标账号池")
    if benchmark_source and benchmark_source.get("status") == "ready":
        add_step("benchmark_update", "固定对标账号已完成今日更新", benchmark_source, benchmark_source.get("nextAction") or "查看对标素材", benchmark_source.get("href") or "./content-pool.html?v=collection-action-flow-v1#benchmark-update", "done", benchmark_source.get("evidence") or "固定对标账号今日已更新")
    elif benchmark_source:
        add_step(
            "benchmark_update",
            "补固定对标账号近期内容",
            benchmark_source,
            benchmark_source.get("nextAction") or "去对标内容池更新账号",
            benchmark_source.get("href") or "./content-pool.html?v=collection-action-flow-v1#benchmark-update",
            "waiting" if benchmark_source.get("status") == "waiting" else "run",
            benchmark_source.get("evidence") or "固定对标号池今天还没补近期内容。",
            benchmark_source.get("owner") or "运营",
        )

    structure_source = source_by_title.get("字幕和结构摘要")
    if structure_source and structure_source.get("status") == "ready":
        add_step("structure", "结构摘要已可供生成读取", structure_source, "进入脚本流程", "./index.html?v=collection-action-flow-v1#stepGenerate", "done", structure_source.get("evidence") or "已有结构摘要")
    else:
        add_step("structure", "把素材转成结构摘要", structure_source, "批量生成结构摘要", "./content-pool.html?v=collection-action-flow-v1", "run", (structure_source or {}).get("evidence") or "缺少结构摘要会降低生成质量")

    if readiness.get("ready"):
        add_step("generate", "进入脚本生成", None, "去生成候选脚本", readiness.get("generateUrl") or "./index.html?v=collection-action-flow-v1#stepGenerate", "ready", "关键输入已满足，可以生成候选脚本。")
    else:
        add_step("generate", "生成前仍有缺项", None, readiness.get("nextAction") or "补齐素材、结构或商品活动", readiness.get("generateUrl") or "./index.html?v=collection-action-flow-v1#stepGenerate", "blocked", "采集保障完成后还要补齐生成输入。")

    active = next((step for step in steps if step["status"] in {"fallback", "run", "blocked", "waiting"}), steps[-1] if steps else None)
    return {
        "summary": "今天的数据采集不是单一路径：公开热榜打底，登录态只做增强，失败立即切人工/第三方，最后必须结构化再生成。",
        "nextAction": active.get("action") if active else "继续生产",
        "nextHref": active.get("href") if active else "./index.html#stepGenerate",
        "activeKey": active.get("key") if active else "",
        "steps": steps,
        "rule": "任务流必须从数据源真实状态生成；不能把小红书占位或验证码失败当成采集成功。",
    }


def collection_fallback_desk_snapshot(data_source_matrix: dict, collection_action_flow: dict, readiness: dict) -> dict:
    sources = data_source_matrix.get("sources") or []
    steps = collection_action_flow.get("steps") or []
    actionable_sources = [
        source for source in sources
        if source.get("status") in {"fallback", "waiting", "usable"}
        and source.get("title") in {"登录态小批量采集", "人工导入内容池", "固定对标账号池", "第三方表格", "小红书内容", "字幕和结构摘要"}
    ]
    fallback_sources = [source for source in actionable_sources if source.get("status") in {"fallback", "waiting"}]
    active_step = next(
        (step for step in steps if step.get("status") in {"fallback", "run", "blocked", "waiting"}),
        steps[-1] if steps else {},
    )

    def action_card(source: dict) -> dict:
        status = source.get("status") or "waiting"
        if source.get("title") == "人工导入内容池":
            action_type = "manual_import"
            action_label = "补链接/字幕"
            completion = "至少导入 3 条素材，并加入生成工作流。"
        elif source.get("title") == "固定对标账号池":
            action_type = "benchmark_update"
            action_label = source.get("nextAction") or "更新对标账号"
            completion = "每个关键对标账号至少补 1-3 条近期内容，并完成结构摘要。"
        elif source.get("title") == "第三方表格":
            action_type = "third_party_import"
            action_label = "粘贴表格预检"
            completion = "预检通过后批量导入，再批量加入生成工作流。"
        elif source.get("title") == "字幕和结构摘要":
            action_type = "structure"
            action_label = "生成结构摘要"
            completion = "已选素材至少有 1 条结构摘要可被脚本生成读取。"
        elif source.get("title") == "小红书内容":
            action_type = "xhs_manual"
            action_label = "导入小红书素材"
            completion = "导入链接、正文或第三方榜单，不把占位任务当真实采集。"
        else:
            action_type = "retry_or_manual"
            action_label = "失败转人工"
            completion = "停止强行自动化，改用人工链接/字幕或第三方表格补齐素材。"
        return {
            "type": action_type,
            "title": source.get("title") or "待处理来源",
            "sourceLayer": source.get("layer") or "",
            "status": status,
            "statusLabel": source.get("statusLabel") or "",
            "evidence": source.get("evidence") or "",
            "risk": source.get("risk") or "",
            "action": action_label,
            "href": source.get("href") or "./content-pool.html?v=fallback-desk-v1#manual-import",
            "completion": completion,
            "owner": source.get("owner") or "运营",
        }

    cards = [action_card(source) for source in actionable_sources]
    primary = cards[0] if cards else {
        "type": "generate",
        "title": "进入脚本生成",
        "sourceLayer": "",
        "status": "ready" if readiness.get("ready") else "blocked",
        "statusLabel": "可生成" if readiness.get("ready") else "有缺项",
        "evidence": readiness.get("summary") or "",
        "risk": "生成前仍需确认素材、结构和商品活动。",
        "action": "去生成候选脚本" if readiness.get("ready") else readiness.get("nextAction") or "补齐输入",
        "href": readiness.get("generateUrl") or "./index.html?v=fallback-desk-v1#stepGenerate",
        "completion": "生成脚本后进入审核、改写和复盘。",
        "owner": "运营",
    }
    if active_step and active_step.get("href"):
        primary = {
            **primary,
            "title": active_step.get("title") or primary["title"],
            "status": active_step.get("status") or primary["status"],
            "statusLabel": active_step.get("statusLabel") or primary["statusLabel"],
            "evidence": active_step.get("reason") or primary["evidence"],
            "action": active_step.get("action") or primary["action"],
            "href": active_step.get("href") or primary["href"],
            "owner": active_step.get("owner") or primary["owner"],
        }

    rules = [
        "自动采集失败不继续硬跑，先保留失败原因和截图，再切人工或第三方。",
        "人工/第三方导入不是临时补救，而是当天生产的正式兜底入口。",
        "兜底素材必须进入结构摘要，否则脚本质量仍会停留在标题级生成。",
    ]
    if readiness.get("ready"):
        rules.append("生成前关键输入已满足，可以进入脚本流程；继续补素材会提升质量但不是阻塞项。")
    else:
        rules.append(f"生成前仍缺项：{readiness.get('nextAction') or '补齐素材、结构或商品活动'}。")

    return {
        "summary": "采集失败后的执行台：把失败来源直接收束成可点击动作、完成标准和下一步入口。",
        "level": "fallback" if fallback_sources else ("ready" if readiness.get("ready") else "waiting"),
        "primary": primary,
        "cards": cards,
        "rules": rules,
    }


def collection_guarantee_hub_snapshot(
    collection_strategy: dict,
    data_source_matrix: dict,
    collection_action_flow: dict,
    collection_fallback_desk: dict,
) -> dict:
    sources = data_source_matrix.get("sources") or []
    steps = collection_action_flow.get("steps") or []
    lanes = collection_strategy.get("lanes") or []
    ready_sources = [source for source in sources if source.get("status") == "ready"]
    usable_sources = [source for source in sources if source.get("status") in {"ready", "usable"}]
    fallback_sources = [source for source in sources if source.get("status") == "fallback"]
    waiting_sources = [source for source in sources if source.get("status") == "waiting"]
    primary_step = next(
        (step for step in steps if step.get("status") in {"fallback", "run", "blocked", "waiting"}),
        steps[-1] if steps else {},
    )
    if fallback_sources:
        mode = "fallback_now"
        mode_label = "立即切兜底"
        summary = f"{len(fallback_sources)} 条数据源需要兜底；不要继续硬跑自动采集，先用人工/第三方保证今天能生产。"
    elif ready_sources:
        mode = "production_ready"
        mode_label = "可继续生产"
        summary = f"{len(ready_sources)} 条数据源已就绪；可以进入结构化、选题和脚本生成。"
    elif usable_sources:
        mode = "usable_with_manual"
        mode_label = "可生产但要补强"
        summary = f"{len(usable_sources)} 条数据源可用但不完整；建议补人工素材或第三方表格提升脚本质量。"
    else:
        mode = "needs_input"
        mode_label = "先补数据"
        summary = "今天还没有足够数据源支撑生产；先运行公开热榜或导入人工/第三方素材。"

    lanes_by_layer: dict[str, dict] = {}
    for source in sources:
        layer = source.get("layer") or ""
        if not layer or layer in lanes_by_layer:
            continue
        lanes_by_layer[layer] = {
            "layer": layer,
            "title": source.get("title") or "",
            "status": source.get("status") or "waiting",
            "statusLabel": source.get("statusLabel") or "",
            "evidence": source.get("evidence") or "",
            "action": source.get("nextAction") or "",
            "href": source.get("href") or "./collection-center.html?v=guarantee-hub-v1",
        }
    for lane in lanes:
        layer = {"stable_hot_api": "A", "login_state_browser": "B", "manual_import": "C", "third_party_import": "D"}.get(lane.get("strategy") or "")
        if layer and layer not in lanes_by_layer:
            lanes_by_layer[layer] = {
                "layer": layer,
                "title": lane.get("title") or "",
                "status": lane.get("status") or "waiting",
                "statusLabel": lane.get("statusLabel") or "",
                "evidence": lane.get("evidence") or "",
                "action": lane.get("recommendedAction") or lane.get("fallbackAction") or "",
                "href": "./collection-center.html?v=guarantee-hub-v1",
            }
    lane_order = ["A", "B", "C", "C2", "D"]
    lane_cards = [lanes_by_layer[layer] for layer in lane_order if layer in lanes_by_layer]
    active_fallback = collection_fallback_desk.get("primary") or {}
    switch_rules = [
        {
            "from": "A 公开热榜",
            "when": "热榜采集失败、缺今日数据或相关性不足",
            "to": "C 人工热点/第三方热点表格",
            "owner": "采集维护",
            "sla": "15 分钟内切换",
            "handoff": "保留失败任务和 raw/normalized 路径；把人工热点或第三方热点导入内容池。",
            "evidence": "以 collection_tasks 最近失败原因、hot_search_runs 今日记录和 dataSourceMatrix 状态为准。",
        },
        {
            "from": "B 登录态小批量",
            "when": "出现验证码、登录失效、连续失败或超过 3 个词",
            "to": "C 手工链接/字幕 或 D 第三方榜单",
            "owner": "采集维护",
            "sla": "立即暂停；30 分钟内转人工",
            "handoff": "不继续高频尝试；保留验证码截图或错误原因，运营改补 3-10 条链接/字幕。",
            "evidence": "以登录态采集任务错误、验证码截图和本轮关键词数量为准。",
        },
        {
            "from": "C/D 兜底素材",
            "when": "只有链接没有字幕、或只有标题没有结构",
            "to": "字幕/结构摘要队列",
            "owner": "运营",
            "sla": "导入后 1 小时内结构化",
            "handoff": "先补字幕/正文，再批量生成结构摘要，不能把标题直接送去生成。",
            "evidence": "以 content_sources.raw_text、subtitle_jobs 和 content_structures 状态为准。",
        },
        {
            "from": "C2 固定对标账号池",
            "when": "今日固定账号没有近期内容、只剩账号名单，或导入后未结构化",
            "to": "C 人工链接/字幕 或 D 第三方表格",
            "owner": "运营",
            "sla": "当天生成前完成",
            "handoff": "按账号补 1-3 条近期视频/笔记；可以从第三方表格导入，但必须绑定账号并结构化。",
            "evidence": "以 benchmark_update_tasks、content_sources.benchmark_update_task_id 和 content_structures 状态为准。",
        },
        {
            "from": "结构摘要",
            "when": "至少 1 条结构 + 1 个品牌商品已确认",
            "to": "脚本生成和脚本库复盘",
            "owner": "运营",
            "sla": "当天生成前确认",
            "handoff": "确认素材包、品牌商品和生成数量；生成后进入审核和复盘。",
            "evidence": "以 generationReadiness、已选素材和已选商品活动为准。",
        },
    ]
    if fallback_sources:
        recommended_lane = active_fallback or primary_step or fallback_sources[0]
        decision_status = "fallback_now"
        decision_label = "当前推荐：切兜底"
        decision_summary = "不要继续反复跑不稳定自动采集；先用人工链接、字幕或第三方表格补足今天可生产素材。"
        trigger = recommended_lane.get("evidence") or primary_step.get("reason") or summary
        switch_to = recommended_lane.get("title") or recommended_lane.get("sourceTitle") or "人工/第三方兜底入口"
        action = recommended_lane.get("action") or recommended_lane.get("nextAction") or primary_step.get("action") or "打开兜底执行台"
        href = recommended_lane.get("href") or primary_step.get("href") or "./collection-center.html?v=decision-engine-v1#fallback-desk"
        completion = recommended_lane.get("completion") or "导入真实链接/字幕/表格后，至少生成 1 条结构摘要，再回到脚本生成。"
    elif primary_step:
        decision_status = primary_step.get("status") or mode
        decision_label = "当前推荐：按任务流推进"
        decision_summary = "自动源没有立即阻塞，按今日任务流补齐结构摘要和生成前检查。"
        trigger = primary_step.get("reason") or summary
        switch_to = primary_step.get("title") or "每日采集任务流"
        action = primary_step.get("action") or "执行下一步"
        href = primary_step.get("href") or "./collection-center.html?v=decision-engine-v1#action-flow"
        completion = "任务流中的阻塞项清零，并满足生成前素材、结构和品牌商品检查。"
    else:
        decision_status = mode
        decision_label = "当前推荐：先补数据"
        decision_summary = "系统没有可直接生产的输入，先补公开热榜、人工素材或第三方表格。"
        trigger = summary
        switch_to = "A 公开热榜 / C 人工导入 / D 第三方表格"
        action = collection_strategy.get("nextAction") or "处理采集数据源"
        href = "./collection-center.html?v=decision-engine-v1"
        completion = "至少有一条真实素材进入结构摘要，才允许进入脚本生成。"
    decision_cards = []
    if primary_step:
        decision_cards.append({
            "title": "今天先做什么",
            "label": primary_step.get("statusLabel") or collection_action_status_text(primary_step.get("status") or ""),
            "body": primary_step.get("reason") or "按任务流处理当前卡点。",
            "action": primary_step.get("action") or "执行下一步",
            "href": primary_step.get("href") or "./collection-center.html?v=decision-engine-v1#action-flow",
        })
    if active_fallback:
        decision_cards.append({
            "title": "自动失败后切到哪里",
            "label": active_fallback.get("statusLabel") or "兜底入口",
            "body": active_fallback.get("evidence") or "使用兜底执行台补真实素材。",
            "action": active_fallback.get("action") or "打开兜底入口",
            "href": active_fallback.get("href") or "./collection-center.html?v=decision-engine-v1#fallback-desk",
        })
    if lane_cards:
        next_lane = next((lane for lane in lane_cards if lane.get("status") in {"fallback", "waiting"}), lane_cards[0])
        decision_cards.append({
            "title": "数据链路状态",
            "label": next_lane.get("statusLabel") or next_lane.get("layer") or "来源层级",
            "body": next_lane.get("evidence") or "按来源层级判断是否继续生产。",
            "action": next_lane.get("action") or "查看来源状态",
            "href": next_lane.get("href") or "./collection-center.html?v=decision-engine-v1#source-matrix",
        })
    return {
        "version": "collection_guarantee_hub_v2",
        "mode": mode,
        "modeLabel": mode_label,
        "summary": summary,
        "nextAction": primary_step.get("action") or active_fallback.get("action") or collection_strategy.get("nextAction") or "处理采集数据源",
        "nextHref": primary_step.get("href") or active_fallback.get("href") or "./collection-center.html?v=guarantee-hub-v1",
        "counts": {
            "readySources": len(ready_sources),
            "usableSources": len(usable_sources),
            "fallbackSources": len(fallback_sources),
            "waitingSources": len(waiting_sources),
            "flowSteps": len(steps),
        },
        "activeStep": primary_step,
        "activeFallback": active_fallback,
        "decisionEngine": {
            "version": "collection_decision_engine_v1",
            "status": decision_status,
            "label": decision_label,
            "summary": decision_summary,
            "trigger": trigger,
            "switchTo": switch_to,
            "action": action,
            "href": href,
            "completion": completion,
            "cards": decision_cards,
        },
        "laneCards": lane_cards,
        "switchRules": switch_rules,
        "principles": [
            "自动采集是主干，但不能成为当天生产的单点故障。",
            "登录态采集只做低频增强；遇验证码直接暂停并保留失败证据。",
            "人工导入和第三方表格是正式数据层，不是临时补丁。",
            "所有兜底素材最终必须结构化，否则脚本生成仍然只是标题改写。",
        ],
    }


def collection_action_status_text(status: str) -> str:
    return {
        "done": "已完成",
        "ready": "可执行",
        "run": "需运行",
        "fallback": "切兜底",
        "waiting": "待处理",
        "blocked": "有缺项",
    }.get(status, "待处理")


def collection_fallback_switcher_snapshot(
    data_source_matrix: dict,
    collection_fallback_desk: dict,
    first_benchmark_material: dict,
) -> dict:
    sources = data_source_matrix.get("sources") or []
    fallback_sources = [source for source in sources if source.get("status") == "fallback"]
    waiting_sources = [source for source in sources if source.get("status") == "waiting"]
    primary = collection_fallback_desk.get("primary") or {}
    manual_href = primary.get("href") or "./content-pool.html?v=fallback-switcher-v1&importPath=manual_subtitle&importPlatform=manual&importMode=single#manual-import"
    benchmark_href = first_benchmark_material.get("nextHref") or "./content-pool.html?v=fallback-switcher-v1#benchmark-update"
    paths = [
        {
            "key": "manual_link",
            "label": "人工链接/正文",
            "status": "recommended" if fallback_sources else "available",
            "title": "自动采集失败后，先补真实链接或正文",
            "when": "有抖音/小红书作品链接，或运营能整理出视频正文。",
            "input": "标题、平台、账号、真实链接；自动字幕不可用时补正文或备注。",
            "output": "content_sources 真实素材；下一步补字幕/结构摘要。",
            "href": manual_href,
            "action": "导入链接或正文",
        },
        {
            "key": "transcript_project",
            "label": "旧字幕项目",
            "status": "recommended" if any(source.get("layer") == "E" or source.get("title") == "字幕和结构摘要" for source in waiting_sources) else "available",
            "title": "把旧字幕提取结果直接变成结构输入",
            "when": "已有 ASR/OCR/字幕提取项目输出，或自动字幕服务今天不可用。",
            "input": "标题、账号、平台、字幕文本；有原视频链接就一并保留。",
            "output": "rawText 可直接结构化，减少标题级生成。",
            "href": "./content-pool.html?v=fallback-switcher-v1&importPath=manual_subtitle&importPlatform=manual&importMode=single#manual-import",
            "action": "粘贴旧字幕结果",
        },
        {
            "key": "third_party_table",
            "label": "第三方表格",
            "status": "recommended" if any(source.get("layer") == "D" and source.get("status") == "fallback" for source in sources) else "available",
            "title": "用灰豚/蝉妈妈/飞瓜/新榜表格兜底",
            "when": "需要一次补多条账号内容、互动数据或小红书/抖音候选链接。",
            "input": "标题、链接、账号、平台、字幕/备注；先预检字段、重复和风险词。",
            "output": "批量素材进入内容池，再批量加入生成和结构化。",
            "href": "./content-pool.html?v=fallback-switcher-v1&importPath=third_party_table&importPlatform=third_party&importMode=batch#batch-import",
            "action": "粘贴第三方表格",
        },
        {
            "key": "benchmark_account",
            "label": "固定对标号",
            "status": "recommended" if first_benchmark_material.get("level") == "blocked" else "available",
            "title": "按固定账号补近期内容",
            "when": "账号池已有名单，但今天没有近期视频/笔记进入生成输入。",
            "input": "目标账号近期 1-3 条内容；可用链接、字幕或第三方表格。",
            "output": "绑定 benchmark_update_task 的真实素材和结构摘要。",
            "href": benchmark_href,
            "action": first_benchmark_material.get("nextAction") or "补固定账号近期内容",
        },
    ]
    recommended = [path for path in paths if path["status"] == "recommended"]
    return {
        "version": "collection_fallback_switcher_v1",
        "level": "fallback" if fallback_sources else ("waiting" if waiting_sources else "ready"),
        "summary": (
            f"{len(fallback_sources)} 条自动/平台来源需要切兜底；优先选择能最快补齐真实素材的路径。"
            if fallback_sources
            else "当前没有必须立即切换的失败来源；仍可用兜底路径增厚输入。"
        ),
        "primaryAction": recommended[0]["action"] if recommended else paths[0]["action"],
        "primaryHref": recommended[0]["href"] if recommended else paths[0]["href"],
        "paths": paths,
        "rules": [
            "先选一条兜底路径，不要同时反复重跑登录态采集。",
            "所有路径都必须通过内容池预检；模板、示例、测试文本不计入真实闭环。",
            "导入后下一步不是生成脚本，而是加入生成工作流并结构化。",
        ],
    }


def daily_review_status_text(status: str) -> str:
    return {
        "done": "已闭环",
        "warning": "需复核",
        "open": "未闭环",
    }.get(status, "待判断")


def daily_review_level_text(level: str) -> str:
    return {
        "ready": "可收工",
        "warning": "带缺口收工",
        "blocked": "建议先处理",
    }.get(level, "待判断")


def collection_daily_review_snapshot(
    stats: dict,
    data_source_matrix: dict,
    collection_action_flow: dict,
    collection_fallback_desk: dict,
    benchmark_update_snapshot: dict,
    readiness: dict,
    review_insights: dict,
) -> dict:
    sources = data_source_matrix.get("sources") or []
    steps = collection_action_flow.get("steps") or []
    benchmark_items = benchmark_update_snapshot.get("items") or []
    fallback_sources = [source for source in sources if source.get("status") == "fallback"]
    waiting_sources = [source for source in sources if source.get("status") == "waiting"]
    ready_sources = [source for source in sources if source.get("status") == "ready"]
    usable_sources = [source for source in sources if source.get("status") in {"ready", "usable"}]
    unfinished_steps = [step for step in steps if step.get("status") in {"fallback", "run", "blocked", "waiting"}]
    pending_benchmarks = [item for item in benchmark_items if item.get("status") == "pending"]
    imported_unstructured_benchmarks = [
        item for item in benchmark_items
        if (item.get("importedCount") or 0) and not (item.get("structuredCount") or 0)
    ]
    benchmark_review_target = pending_benchmarks[0] if pending_benchmarks else (imported_unstructured_benchmarks[0] if imported_unstructured_benchmarks else None)
    benchmark_review_href = (
        (benchmark_review_target.get("importHref") if pending_benchmarks else benchmark_review_target.get("href"))
        if benchmark_review_target else "./content-pool.html?v=daily-review-v1#benchmark-update"
    )
    selected_sources = stats.get("selectedContentSources") or 0
    structured_sources = stats.get("contentStructures") or 0
    unreviewed_scripts = stats.get("newScripts") or 0
    adopted_scripts = stats.get("adoptedScripts") or 0
    failed_collection_tasks = stats.get("failedCollectionTasks") or 0
    published_count = review_insights.get("publishedCount") or 0

    def checkpoint(
        key: str,
        title: str,
        status: str,
        evidence: str,
        action: str,
        href: str,
        owner: str = "运营",
        priority: str = "medium",
    ) -> dict:
        return {
            "key": key,
            "title": title,
            "status": status,
            "statusLabel": daily_review_status_text(status),
            "evidence": evidence,
            "action": action,
            "href": href,
            "owner": owner,
            "priority": priority,
        }

    hot_evidence = next((source.get("evidence") for source in sources if source.get("title") == "公开热榜"), "缺少今日公开热榜。")
    checkpoints = [
        checkpoint(
            "hot_source",
            "公开热榜主干",
            "done" if any(source.get("title") == "公开热榜" and source.get("status") == "ready" for source in sources) else "open",
            hot_evidence,
            "去热点池检查候选",
            "./trend-pool.html?v=daily-review-v1",
            "运营",
            "medium",
        ),
        checkpoint(
            "fallback_sources",
            "失败来源兜底",
            "open" if fallback_sources else "done",
            f"{len(fallback_sources)} 条来源仍需兜底；{failed_collection_tasks} 个采集任务失败。" if fallback_sources else "没有必须立即切换的失败来源。",
            "打开兜底执行台",
            "./collection-center.html?v=daily-review-v1#fallback-desk",
            "采集维护",
            "high" if fallback_sources else "low",
        ),
        checkpoint(
            "benchmark_update",
            "固定对标账号更新",
            "open" if pending_benchmarks else ("warning" if imported_unstructured_benchmarks else "done"),
            f"待补 {len(pending_benchmarks)} 个账号；已导入未结构化 {len(imported_unstructured_benchmarks)} 个账号。",
            f"处理「{benchmark_review_target.get('accountName')}」" if benchmark_review_target else "去对标内容池更新账号",
            benchmark_review_href,
            "运营",
            "high" if pending_benchmarks else "medium",
        ),
        checkpoint(
            "structure",
            "素材结构摘要",
            "done" if structured_sources else ("warning" if selected_sources else "open"),
            f"今日已选素材 {selected_sources} 条，结构摘要 {structured_sources} 条。",
            "批量生成结构摘要",
            "./content-pool.html?v=daily-review-v1",
            "运营",
            "high" if selected_sources and not structured_sources else "medium",
        ),
        checkpoint(
            "script_review",
            "脚本审核采用",
            "warning" if unreviewed_scripts else "done",
            f"新脚本 {unreviewed_scripts} 条；已采用 {adopted_scripts} 条。",
            "去脚本库审核",
            "./script-library.html?v=daily-review-v1",
            "内容负责人",
            "medium",
        ),
        checkpoint(
            "publish_learning",
            "发布表现回填",
            "warning" if adopted_scripts and not published_count else "done",
            f"已发布回填 {published_count} 条；已采用脚本 {adopted_scripts} 条。",
            "回填发布表现",
            "./script-library.html?v=daily-review-v1",
            "内容负责人",
            "medium",
        ),
    ]
    open_items = [item for item in checkpoints if item["status"] == "open"]
    warning_items = [item for item in checkpoints if item["status"] == "warning"]
    done_items = [item for item in checkpoints if item["status"] == "done"]
    blockers = [item for item in open_items if item["priority"] == "high"]
    if blockers:
        level = "blocked"
        summary = f"今天还有 {len(blockers)} 个高优先级采集/输入缺口，建议先补完再收工。"
    elif open_items or warning_items:
        level = "warning"
        summary = f"可以收工但要带着 {len(open_items) + len(warning_items)} 个未闭环项进入明天。"
    else:
        level = "ready"
        summary = "今日采集、结构、审核和复盘关键项已闭环，可以结束工作日。"
    next_day_priorities: list[dict] = []
    seen_keys: set[str] = set()
    for item in [*blockers, *open_items, *warning_items]:
        if item["key"] in seen_keys:
            continue
        next_day_priorities.append(item)
        seen_keys.add(item["key"])
        if len(next_day_priorities) >= 5:
            break
    if not next_day_priorities and not readiness.get("ready"):
        next_day_priorities.append(checkpoint(
            "generation_readiness",
            "生成准备检查",
            "warning",
            readiness.get("summary") or "生成前还有缺项。",
            readiness.get("nextAction") or "补齐生成输入",
            readiness.get("generateUrl") or "./index.html?v=daily-review-v1#stepGenerate",
            "运营",
            "medium",
        ))
    return {
        "version": "collection_daily_review_v1",
        "level": level,
        "levelLabel": daily_review_level_text(level),
        "summary": summary,
        "closeAdvice": "建议先处理高优先级缺口再结束今日工作日。" if blockers else "可以结束今日工作日；未闭环项会进入明日优先处理。",
        "counts": {
            "done": len(done_items),
            "open": len(open_items),
            "warning": len(warning_items),
            "blockers": len(blockers),
            "readySources": len(ready_sources),
            "usableSources": len(usable_sources),
            "fallbackSources": len(fallback_sources),
            "waitingSources": len(waiting_sources),
            "unfinishedFlowSteps": len(unfinished_steps),
            "fallbackCards": len(collection_fallback_desk.get("cards") or []),
        },
        "checkpoints": checkpoints,
        "nextDayPriorities": next_day_priorities,
        "rules": [
            "日终复盘只读取真实状态，不自动把缺口改成完成。",
            "自动采集失败可以收工，但必须留下兜底动作和明日优先级。",
            "对标账号池必须看今日内容和结构摘要，不能只看账号名单是否存在。",
            "发布表现未回填时，复盘学习只能部分反哺下一轮生成。",
        ],
    }


def workday_opening_reminder_snapshot(workday: dict, daily_review: dict) -> dict:
    priorities = daily_review.get("nextDayPriorities") or []
    blockers = [item for item in priorities if item.get("priority") == "high" or item.get("status") == "open"]
    if priorities:
        level = "blocked" if blockers else "warning"
        headline = "开工先处理昨日未闭环项" if blockers else "开工先复核昨日遗留项"
        summary = f"上一轮复盘留下 {len(priorities)} 个优先事项；先处理采集、对标账号或审核缺口，再继续生成新脚本。"
        next_item = priorities[0]
        next_action = next_item.get("action") or "去处理"
        next_href = next_item.get("href") or "./collection-center.html?v=opening-reminder-v1#daily-review"
    else:
        level = "ready"
        headline = "今日可以从选题和生成开始"
        summary = "上一轮没有高优先级遗留项；可以继续采集、选题和脚本生成。"
        next_action = "查看今日工作流"
        next_href = "./v2.html?v=opening-reminder-v1"
    return {
        "version": "workday_opening_reminder_v1",
        "level": level,
        "headline": headline,
        "summary": summary,
        "nextAction": next_action,
        "nextHref": next_href,
        "workdayStatus": workday.get("status") or "",
        "priorityCount": len(priorities),
        "blockerCount": len(blockers),
        "priorities": priorities[:5],
        "rule": "开工提醒只读取上一轮/当前日终复盘的未闭环项，不自动创建模拟任务或修改状态。",
    }


def run_collection_task(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    task_type = (data.get("taskType") or "douyin_hot").strip()
    now = utc_now()
    if task_type == "douyin_hot":
        command = ["python3", "scripts/fetch_douyin_hot_search.py"]
        strategy = "stable_hot_api"
        source_platform = "douyin"
        timeout = 90
    elif task_type == "douyin_category":
        queries = data.get("queries") or ""
        command = ["node", "scripts/douyin_category_capture.js"]
        if isinstance(queries, str) and queries.strip():
            command.extend(["--queries", ",".join([item.strip() for item in queries.split(",") if item.strip()][:3])])
        strategy = "login_state_browser"
        source_platform = "douyin"
        timeout = 120
    elif task_type == "xhs_placeholder":
        command = ["manual", "xhs_import_required"]
        strategy = "manual_import"
        source_platform = "xhs"
        timeout = 0
    else:
        raise ValueError("taskType 必须是 douyin_hot、douyin_category 或 xhs_placeholder")

    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO collection_tasks (
              brand_name, task_type, source_platform, strategy, status,
              command, output_json, error, started_at, finished_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                task_type,
                source_platform,
                strategy,
                "running",
                " ".join(command),
                "{}",
                "",
                now,
                "",
                now,
            ),
        )
        task_id = cursor.lastrowid
        conn.commit()

    if task_type == "xhs_placeholder":
        finished_at = utc_now()
        status = "failed"
        output = {
            "returncode": "not_automated",
            "stdout": "小红书自动采集暂未接入。请通过对标内容池人工导入小红书链接、字幕或第三方表格。",
            "stderr": "",
            "artifacts": [],
            "fallbackActions": ["人工导入小红书链接", "粘贴小红书笔记文本或字幕", "导入第三方数据表"],
        }
        error = "小红书自动采集暂未接入，请使用人工导入或第三方数据。"
    else:
        try:
            result = subprocess.run(
                command,
                cwd=Path.cwd(),
                text=True,
                capture_output=True,
                check=False,
                timeout=timeout,
            )
            finished_at = utc_now()
            status = "success" if result.returncode == 0 else "failed"
            output = {
                "returncode": result.returncode,
                "stdout": (result.stdout or "").strip()[-8000:],
                "stderr": (result.stderr or "").strip()[-8000:],
            }
            output["artifacts"] = collection_artifacts(task_type, output["stdout"])
            if task_type == "douyin_category" and status == "success":
                merged_output = f"{output['stdout']}\n{output['stderr']}"
                if "captcha_blocked" in merged_output:
                    status = "failed"
                    error = "登录态采集遇到验证码，需稍后重试或改用人工导入。"
                    output["fallbackActions"] = ["暂停登录态采集", "每次最多 3 个词稍后重试", "去对标内容池人工导入链接或字幕"]
                elif "login_required" in merged_output:
                    status = "failed"
                    error = "登录态已失效，请先重新登录抖音。"
                    output["fallbackActions"] = ["重新登录抖音", "减少关键词后重试", "去对标内容池人工导入链接或字幕"]
                else:
                    error = ""
            else:
                error = "" if status == "success" else output["stderr"] or output["stdout"] or "采集任务失败"
                if status != "success":
                    output["fallbackActions"] = ["查看失败输出", "稍后手动重跑", "去对标内容池人工导入链接或字幕"]
        except subprocess.TimeoutExpired as exc:
            finished_at = utc_now()
            status = "failed"
            output = {
                "returncode": "timeout",
                "stdout": (exc.stdout or "").strip()[-4000:] if isinstance(exc.stdout, str) else "",
                "stderr": (exc.stderr or "").strip()[-4000:] if isinstance(exc.stderr, str) else "",
                "artifacts": [],
                "fallbackActions": ["采集超时，稍后重跑", "减少关键词数量", "去对标内容池人工导入链接或字幕"],
            }
            error = f"采集任务超时：{timeout}s"

    with connect() as conn:
        conn.execute(
            """
            UPDATE collection_tasks
            SET status = ?, output_json = ?, error = ?, finished_at = ?
            WHERE id = ?
            """,
            (
                status,
                json.dumps(output, ensure_ascii=False, separators=(",", ":")),
                error,
                finished_at,
                task_id,
            ),
        )
        row = conn.execute(
            """
            SELECT id, brand_name, task_type, source_platform, strategy, status,
                   command, output_json, error, started_at, finished_at, created_at
            FROM collection_tasks
            WHERE id = ?
            """,
            (task_id,),
        ).fetchone()
        conn.commit()
    return serialize_collection_task(row)


def collection_artifacts(task_type: str, stdout: str) -> list[dict]:
    artifacts: list[dict] = []
    if task_type == "douyin_category":
        marker = "类目采集结果已输出:"
        output_path = ""
        for line in stdout.splitlines():
            if marker in line:
                output_path = line.split(marker, 1)[1].strip()
                break
        if output_path:
            artifacts.append({"type": "json", "path": output_path})
            try:
                data = json.loads(Path(output_path).read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                data = {}
            for result in data.get("results", []):
                screenshot_path = result.get("screenshot_path")
                if screenshot_path:
                    artifacts.append({
                        "type": "screenshot",
                        "path": screenshot_path,
                        "query": result.get("query", ""),
                        "status": result.get("status", ""),
                    })
    return artifacts


def selected_script_templates(conn: sqlite3.Connection, brand_name: str, limit: int = 3) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, title, hook, outline, source_trend_keyword, source_benchmark_account,
               source_pattern, quality_json, performance_json, created_at
        FROM daily_script_candidates
        WHERE brand_name = ?
          AND is_template = 1
        ORDER BY
          CAST(json_extract(performance_json, '$.leads') AS INTEGER) DESC,
          CAST(json_extract(performance_json, '$.likes') AS INTEGER) DESC,
          CAST(json_extract(performance_json, '$.views') AS INTEGER) DESC,
          id DESC
        LIMIT ?
        """,
        (brand_name, limit),
    ).fetchall()
    items: list[dict] = []
    for row in rows:
        try:
            quality = json.loads(row["quality_json"] or "{}")
        except json.JSONDecodeError:
            quality = {}
        try:
            performance = json.loads(row["performance_json"] or "{}")
        except json.JSONDecodeError:
            performance = {}
        items.append(
            {
                "id": row["id"],
                "title": row["title"],
                "hook": row["hook"],
                "outline": row["outline"],
                "sourceTrendKeyword": row["source_trend_keyword"],
                "sourceBenchmarkAccount": row["source_benchmark_account"],
                "sourcePattern": row["source_pattern"],
                "quality": quality,
                "performance": performance,
                "createdAt": row["created_at"],
            }
        )
    return items


def score_script_quality(
    script: dict,
    input_structures: list[dict],
    input_products: list[dict] | None = None,
    input_templates: list[dict] | None = None,
) -> dict:
    input_products = input_products or []
    input_templates = input_templates or []
    shots = script.get("shots") or []
    text = " ".join(
        [
            script.get("title", ""),
            script.get("hook", ""),
            script.get("cta", ""),
            " ".join(str(shot.get("voiceover", "")) for shot in shots if isinstance(shot, dict)),
            " ".join(str(shot.get("subtitle", "")) for shot in shots if isinstance(shot, dict)),
        ]
    )
    shootable = 55
    if len(shots) >= 4:
        shootable += 15
    if all((shot.get("shot") and shot.get("voiceover") and shot.get("subtitle")) for shot in shots if isinstance(shot, dict)):
        shootable += 10
    if script.get("cta"):
        shootable += 8
    if any(word in text for word in ["门店", "进店", "试", "导购", "团购"]):
        shootable += 7

    hook_score = 55
    if script.get("hook") and len(script["hook"]) >= 12:
        hook_score += 15
    if any(mark in script.get("hook", "") for mark in ["？", "?", "别", "先", "今天", "如果"]):
        hook_score += 10
    if script.get("source_trend_keyword") and script.get("source_trend_keyword") in text:
        hook_score += 8

    brand_fit = 58
    if any(word in text.lower() for word in ["adidas", "阿迪", "运动鞋", "球鞋", "上脚", "穿搭"]):
        brand_fit += 14
    if any(word in text for word in ["本地", "团购", "门店", "进店"]):
        brand_fit += 12
    if input_structures:
        brand_fit += 6
    if input_templates:
        brand_fit += 4

    conversion = 55
    if script.get("cta"):
        conversion += 14
    if any(word in text for word in ["领券", "点团购", "进店", "试穿", "私信", "核销"]):
        conversion += 14
    if any(word in text for word in ["价格", "优惠", "库存", "码", "活动"]):
        conversion += 6
    if input_products and any(word in text for word in ["活动", "权益", "门店", "领券", "试穿"]):
        conversion += 6
    if input_templates:
        conversion += 4

    risk = 82
    risky_words = ["最便宜", "一定", "保证", "全网最低", "肯定有货", "必须买"]
    hit_risks = [word for word in risky_words if word in text]
    risk -= len(hit_risks) * 8
    if "需合规" in script.get("risk_notes", "") or script.get("risk_notes"):
        risk += 4
    if input_products:
        risk += 4

    scores = {
        "shootable": max(0, min(100, shootable)),
        "hook": max(0, min(100, hook_score)),
        "brandFit": max(0, min(100, brand_fit)),
        "conversion": max(0, min(100, conversion)),
        "compliance": max(0, min(100, risk)),
    }
    overall = round(
        scores["shootable"] * 0.28
        + scores["hook"] * 0.2
        + scores["brandFit"] * 0.22
        + scores["conversion"] * 0.2
        + scores["compliance"] * 0.1
    )
    reasons = []
    if input_structures:
        reasons.append(f"读取了 {len(input_structures)} 条人工结构摘要")
    if input_products:
        reasons.append(f"读取了 {len(input_products)} 条商品活动")
    if input_templates:
        reasons.append(f"参考了 {len(input_templates)} 条高表现模板")
    if scores["shootable"] >= 85:
        reasons.append("分镜字段完整，可直接按段拍摄")
    if scores["conversion"] < 75:
        reasons.append("转化动作还可以更具体")
    if hit_risks:
        reasons.append(f"命中风险词：{'、'.join(hit_risks)}")
    if not reasons:
        reasons.append("基础结构完整，发布前复核商品和活动信息")
    diagnosis = build_quality_diagnosis(scores, reasons, hit_risks, input_structures, input_products, input_templates)
    return {
        "overall": overall,
        "scores": scores,
        "reasons": reasons[:4],
        "riskHits": hit_risks,
        "diagnosis": diagnosis,
        "source": "rule_based_v1",
    }


def build_quality_diagnosis(scores: dict, reasons: list[str], risk_hits: list[str], input_structures: list[dict], input_products: list[dict], input_templates: list[dict]) -> dict:
    weak_dimensions = []
    if scores.get("shootable", 0) < 80:
        weak_dimensions.append({"dimension": "可拍性", "reason": "分镜、镜头动作或口播字幕还不够完整", "action": "补齐每段镜头、口播、字幕，并减少抽象形容词。"})
    if scores.get("hook", 0) < 78:
        weak_dimensions.append({"dimension": "开头", "reason": "前 3 秒钩子不够明确", "action": "改成用户问题、反差判断或热点关键词开场。"})
    if scores.get("brandFit", 0) < 78:
        weak_dimensions.append({"dimension": "品牌贴合", "reason": "adidas、运动鞋、团购或门店场景露出不足", "action": "补商品/门店/试穿/团购权益，不要只讲泛热点。"})
    if scores.get("conversion", 0) < 78:
        weak_dimensions.append({"dimension": "转化", "reason": "CTA、到店动作或团购权益不够具体", "action": "明确评论、私信、领券、核销或到店试穿动作。"})
    if scores.get("compliance", 0) < 78 or risk_hits:
        weak_dimensions.append({"dimension": "合规", "reason": f"存在风险词：{'、'.join(risk_hits)}" if risk_hits else "价格、库存或权益口径需要更保守", "action": "把绝对承诺改成以门店当天、券面和库存为准。"})

    strong_dimensions = []
    for key, label in [
        ("shootable", "分镜可拍"),
        ("hook", "开头可用"),
        ("brandFit", "品牌贴合"),
        ("conversion", "转化明确"),
        ("compliance", "合规较稳"),
    ]:
        if scores.get(key, 0) >= 85:
            strong_dimensions.append(label)

    input_impact = []
    if input_structures:
        input_impact.append(f"结构素材贡献：读取 {len(input_structures)} 条对标结构，脚本节奏更稳定。")
    else:
        input_impact.append("结构素材缺口：没有读取结构摘要，脚本容易变成泛口播。")
    if input_products:
        input_impact.append(f"商品活动贡献：读取 {len(input_products)} 条商品活动，转化和合规口径更清楚。")
    else:
        input_impact.append("商品活动缺口：缺少真实权益，CTA 容易空泛。")
    if input_templates:
        input_impact.append(f"模板贡献：参考 {len(input_templates)} 条高表现模板，可复用历史有效结构。")

    rewrite_focus = weak_dimensions[0]["dimension"] if weak_dimensions else "保持结构，增强细节"
    rewrite_prompt = weak_dimensions[0]["action"] if weak_dimensions else "保留当前脚本结构，补充真实镜头动作、商品权益和发布前复核口径。"
    return {
        "summary": "；".join(reasons[:2]) or "基础结构完整，发布前复核商品和活动信息",
        "strongDimensions": strong_dimensions[:3],
        "weakDimensions": weak_dimensions[:3],
        "inputImpact": input_impact[:4],
        "rewriteFocus": rewrite_focus,
        "rewritePrompt": rewrite_prompt,
    }


def quality_status_from_score(quality: dict) -> str:
    overall = int(quality.get("overall") or 0)
    compliance = int((quality.get("scores") or {}).get("compliance") or 0)
    if compliance < 70:
        return "blocked"
    if overall < 78:
        return "needs_rewrite"
    return "passed"


def rewrite_plan_from_quality(quality: dict) -> dict:
    diagnosis = quality.get("diagnosis") or {}
    weak_dimensions = diagnosis.get("weakDimensions") if isinstance(diagnosis.get("weakDimensions"), list) else []
    primary = weak_dimensions[0] if weak_dimensions and isinstance(weak_dimensions[0], dict) else {}
    focus = diagnosis.get("rewriteFocus") or primary.get("dimension") or "增强可拍性和合规口径"
    prompt = diagnosis.get("rewritePrompt") or primary.get("action") or "补真实镜头、商品权益和门店复核口径。"
    fixes = []
    for item in weak_dimensions[:3]:
        if not isinstance(item, dict):
            continue
        label = item.get("dimension") or "待改"
        action = item.get("action") or item.get("reason") or ""
        fixes.append(f"{label}：{action}" if action else label)
    if not fixes:
        fixes = [prompt]
    return {
        "focus": focus,
        "prompt": prompt,
        "fixes": fixes,
        "source": "quality_diagnosis_v1",
    }


def script_row_to_dict(row: sqlite3.Row) -> dict:
    try:
        quality = json.loads(row["quality_json"] or "{}")
    except json.JSONDecodeError:
        quality = {}
    try:
        input_structures = json.loads(row["input_structure_json"] or "[]")
    except json.JSONDecodeError:
        input_structures = []
    try:
        input_products = json.loads(row["input_product_json"] or "[]")
    except json.JSONDecodeError:
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
    try:
        performance = json.loads(row["performance_json"] or "{}")
    except (KeyError, json.JSONDecodeError):
        performance = {}
    return {
        "id": row["id"],
        "runId": row["run_id"],
        "brandName": row["brand_name"],
        "platform": row["platform"],
        "title": row["title"],
        "hook": row["hook"],
        "outline": row["outline"],
        "sourceTrendKeyword": row["source_trend_keyword"],
        "sourceBenchmarkAccount": row["source_benchmark_account"],
        "sourcePattern": row["source_pattern"],
        "fitReason": row["fit_reason"],
        "riskNotes": row["risk_notes"],
        "candidateLevel": row["candidate_level"],
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
        "publishUrl": row["publish_url"],
        "publishedAt": row["published_at"],
        "performance": performance,
        "isTemplate": bool(row["is_template"]),
        "createdAt": row["created_at"],
    }


def get_script_candidate(conn: sqlite3.Connection, script_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT id, run_id, brand_name, platform, title, hook, outline,
               source_trend_keyword, source_benchmark_account, source_pattern,
               fit_reason, risk_notes, candidate_level, quality_json,
               input_structure_json, input_product_json, input_template_json, input_feedback_json, input_topic_json, quality_status,
               review_status, review_note, rewrite_count, parent_script_id,
               publish_url, published_at, performance_json, is_template,
               created_at
        FROM daily_script_candidates
        WHERE id = ?
        """,
        (script_id,),
    ).fetchone()
    if not row:
        raise ValueError("脚本不存在")
    return row


def default_review_note(status: str) -> str:
    return {
        "adopted": "运营采用：结构清晰，可进入发布或模板复盘。",
        "needs_edit": "运营待改：需要优化开头、镜头执行或转化 CTA。",
        "rejected": "运营弃用：不适合当前品牌/活动，后续降低相似结构权重。",
        "new": "",
    }.get(status, "")


def review_script_candidate(script_id: int, data: dict) -> dict:
    status = (data.get("reviewStatus") or data.get("status") or "").strip()
    note = (data.get("reviewNote") or data.get("note") or "").strip() or default_review_note(status)
    if status not in {"new", "adopted", "rejected", "needs_edit"}:
        raise ValueError("reviewStatus 必须是 new/adopted/rejected/needs_edit")
    with connect() as conn:
        get_script_candidate(conn, script_id)
        conn.execute(
            """
            UPDATE daily_script_candidates
            SET review_status = ?, review_note = ?
            WHERE id = ?
            """,
            (status, note, script_id),
        )
        row = get_script_candidate(conn, script_id)
        conn.commit()
    return script_row_to_dict(row)


def rewrite_outline_for_quality(outline: str) -> str:
    shots = []
    for line in outline.splitlines():
        if not line.strip():
            continue
        parts = line.split("｜")
        time_part = parts[0] if parts else ""
        shot = next((part for part in parts if part.startswith("镜头：")), "镜头：门店真实画面")
        voiceover = next((part for part in parts if part.startswith("口播：")), "口播：进店先试再决定，具体以门店当天为准。")
        subtitle = next((part for part in parts if part.startswith("字幕：")), "字幕：进店试穿")
        voiceover = voiceover.replace("一定", "建议").replace("最便宜", "以页面为准").replace("肯定有货", "库存以门店为准")
        if "以门店" not in voiceover and time_part in {"8-12s", "12-15s"}:
            voiceover += " 具体以门店当天为准。"
        shots.append("｜".join([time_part, shot, voiceover, subtitle]))
    return "\n".join(shots)


def outline_to_shots(outline: str) -> list[dict]:
    return [
        {
            "time": parts[0] if parts else "",
            "shot": (next((part for part in parts if part.startswith("镜头：")), "镜头：")).replace("镜头：", ""),
            "voiceover": (next((part for part in parts if part.startswith("口播：")), "口播：")).replace("口播：", ""),
            "subtitle": (next((part for part in parts if part.startswith("字幕：")), "字幕：")).replace("字幕：", ""),
        }
        for parts in (line.split("｜") for line in outline.splitlines() if line.strip())
    ]


def build_rewrite_prompt(brand: dict, original: dict, rewrite_plan: dict) -> str:
    payload = {
        "brand": {
            "brand_name": brand.get("brand_name"),
            "target_audience": brand.get("target_audience"),
            "primary_platform": brand.get("primary_platform"),
            "duration_seconds": brand.get("single_video_duration_seconds", 15),
            "content_tone": brand.get("content_tone", []),
            "taboo_rules": brand.get("taboo_rules", []),
        },
        "rewrite_plan": rewrite_plan,
        "quality": original.get("quality") or {},
        "original_script": {
            "title": original.get("title"),
            "hook": original.get("hook"),
            "outline": original.get("outline"),
            "source_trend_keyword": original.get("sourceTrendKeyword"),
            "source_benchmark_account": original.get("sourceBenchmarkAccount"),
            "source_pattern": original.get("sourcePattern"),
            "fit_reason": original.get("fitReason"),
            "risk_notes": original.get("riskNotes"),
        },
        "input_structures": original.get("inputStructures") or [],
        "input_products": original.get("inputProducts") or [],
        "input_templates": original.get("inputTemplates") or [],
        "input_feedback": original.get("inputFeedback") or [],
        "input_topics": original.get("inputTopics") or [],
    }
    return (
        "你是短视频脚本质量改写器。请只基于输入做一条更可拍、更合规、更具体的改写版。\n"
        "必须只输出 JSON，不要 Markdown，不要解释。\n"
        "JSON 格式：{\"title\":\"\",\"hook\":\"\",\"shots\":[{\"time\":\"0-3s\",\"shot\":\"\",\"voiceover\":\"\",\"subtitle\":\"\",\"purpose\":\"\"}],\"cta\":\"\",\"shooting_notes\":[\"\"],\"source_trend_keyword\":\"\",\"source_benchmark_account\":\"\",\"source_pattern\":\"\",\"fit_reason\":\"\",\"risk_notes\":\"\",\"rewrite_summary\":\"\"}\n"
        "要求：\n"
        "1. 必须保留 4 个 shots：0-3s、3-8s、8-12s、12-15s。\n"
        "2. 必须优先解决 rewrite_plan.fixes 中的问题，不要泛泛优化。\n"
        "3. 必须读取 input_structures、input_products、input_templates、input_feedback 和 input_topics；不得编造未提供的价格、库存、折扣、门店范围。\n"
        "4. 口播要像门店真实团购短视频，能直接拍，避免抽象文案。\n"
        "5. 删除或改弱绝对承诺，例如一定、最便宜、全网最低、肯定有货。\n"
        "6. fit_reason 必须说明改写读取了哪些输入；rewrite_summary 必须说明和原稿相比改了什么。\n"
        "输入 JSON：\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )


def normalize_rewrite_script(raw_script: dict, original: dict, fallback_script: dict) -> dict:
    hot = {
        "title": original.get("sourceTrendKeyword") or fallback_script.get("source_trend_keyword") or "品牌日常选题",
        "payload": {"title": original.get("sourceTrendKeyword") or fallback_script.get("source_trend_keyword") or "品牌日常选题"},
    }
    benchmark = {
        "title": original.get("sourceBenchmarkAccount") or fallback_script.get("source_benchmark_account") or "品牌自有结构",
        "payload": {
            "account": original.get("sourceBenchmarkAccount") or fallback_script.get("source_benchmark_account") or "品牌自有结构",
            "pattern": original.get("sourcePattern") or fallback_script.get("source_pattern") or "门店转化结构",
        },
    }
    normalized = normalize_codex_script(raw_script, load_brand_config(), hot, benchmark)
    normalized["title"] = raw_script.get("title") or fallback_script["title"]
    normalized["fit_reason"] = raw_script.get("fit_reason") or fallback_script["fit_reason"]
    normalized["risk_notes"] = raw_script.get("risk_notes") or fallback_script["risk_notes"]
    normalized["candidate_level"] = "codex_rewrite_v1"
    if raw_script.get("rewrite_summary"):
        normalized["rewrite_summary"] = str(raw_script["rewrite_summary"])
    return normalized


def generate_rewrite_with_codex_cli(brand: dict, original: dict, rewrite_plan: dict, fallback_script: dict) -> dict:
    prompt = build_rewrite_prompt(brand, original, rewrite_plan)
    with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False) as output_file:
        output_path = Path(output_file.name)
    try:
        result = subprocess.run(
            [
                DEFAULT_CODEX_BIN,
                "--ask-for-approval",
                "never",
                "exec",
                "--skip-git-repo-check",
                "--output-last-message",
                str(output_path),
                prompt,
            ],
            cwd=Path.cwd(),
            text=True,
            capture_output=True,
            check=False,
            timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "codex cli failed")
        raw = output_path.read_text(encoding="utf-8")
        data = extract_json_object(raw)
        return normalize_rewrite_script(data, original, fallback_script)
    finally:
        try:
            output_path.unlink()
        except FileNotFoundError:
            pass


def script_diff_summary(original: dict, rewritten: dict, rewrite_plan: dict) -> dict:
    old_shots = outline_to_shots(original.get("outline") or "")
    new_shots = rewritten.get("shots") or []
    changed_segments = []
    for index, new_shot in enumerate(new_shots[:4]):
        old_shot = old_shots[index] if index < len(old_shots) else {}
        changes = []
        for key, label in [("shot", "镜头"), ("voiceover", "口播"), ("subtitle", "字幕")]:
            if (old_shot.get(key) or "").strip() != (new_shot.get(key) or "").strip():
                changes.append(label)
        if changes:
            changed_segments.append(f"{new_shot.get('time') or old_shot.get('time') or f'第{index + 1}段'}：{'+'.join(changes)}")
    removed_risks = [
        word
        for word in ["一定", "最便宜", "全网最低", "肯定有货", "保证"]
        if word in (original.get("outline") or original.get("hook") or "") and word not in (rewritten.get("outline") or rewritten.get("hook") or "")
    ]
    return {
        "focus": rewrite_plan.get("focus"),
        "changedSegments": changed_segments[:4],
        "removedRiskWords": removed_risks,
        "oldHook": original.get("hook") or "",
        "newHook": rewritten.get("hook") or "",
        "summary": rewritten.get("rewrite_summary") or f"按「{rewrite_plan.get('focus')}」改写，调整：{'；'.join(changed_segments[:3]) or '结构和表达'}。",
    }


def rewrite_script_candidate(script_id: int) -> dict:
    now = utc_now()
    with connect() as conn:
        row = get_script_candidate(conn, script_id)
        original = script_row_to_dict(row)
        brand = load_brand_config()
        rewrite_plan = rewrite_plan_from_quality(original.get("quality") or {})
        fallback_script = {
            "title": f"{original['title']}（改写版）",
            "hook": original["hook"].replace("一定", "先确认").replace("最便宜", "更清楚"),
            "outline": rewrite_outline_for_quality(original["outline"]),
            "source_trend_keyword": original["sourceTrendKeyword"],
            "source_benchmark_account": original["sourceBenchmarkAccount"],
            "source_pattern": original["sourcePattern"],
            "risk_notes": f"{original['riskNotes']} 已改写为更保守表达，价格、库存、核销范围以门店当天和券面信息为准。",
        }
        fallback_script["shots"] = outline_to_shots(fallback_script["outline"])
        fallback_script["cta"] = "点团购券，进店试穿，具体以门店为准"
        fallback_script["fit_reason"] = f"{original['fitReason']} 系统根据质量评分进行了保守改写。"
        fallback_script["candidate_level"] = "rewrite_rule_v1"
        rewrite_generator = {"name": "local_rewrite_fallback", "usedFallback": True, "error": ""}
        try:
            script = generate_rewrite_with_codex_cli(brand, original, rewrite_plan, fallback_script) if USE_CODEX_CLI else fallback_script
            rewrite_generator = {"name": script.get("candidate_level") or "codex_rewrite_v1", "usedFallback": False, "error": ""}
        except Exception as exc:
            script = fallback_script
            rewrite_generator = {"name": "local_rewrite_fallback", "usedFallback": True, "error": str(exc)}
        script["cta"] = "点团购券，进店试穿，具体以门店为准"
        quality = score_script_quality(script, original["inputStructures"], original["inputProducts"], original["inputTemplates"])
        quality["reasons"] = ["由低分/待改脚本自动改写"] + quality.get("reasons", [])
        rewrite_diff = script_diff_summary(original, script, rewrite_plan)
        quality["diagnosis"] = {
            **(quality.get("diagnosis") or {}),
            "summary": rewrite_diff["summary"],
            "rewriteFocus": "自动改写后复核",
            "rewritePrompt": f"本次按「{rewrite_plan['focus']}」改写；检查改写版是否已解决：{'；'.join(rewrite_plan['fixes'])}",
        }
        quality["rewritePlan"] = rewrite_plan
        quality["rewriteDiff"] = rewrite_diff
        quality["rewriteGenerator"] = rewrite_generator
        quality_status = quality_status_from_score(quality)
        cursor = conn.execute(
            """
            INSERT INTO daily_script_candidates (
              run_id, brand_name, platform, title, hook, outline,
              source_trend_keyword, source_benchmark_account, source_pattern,
              fit_reason, risk_notes, candidate_level, quality_json,
              input_structure_json, input_product_json, input_template_json, input_feedback_json, input_topic_json, quality_status,
               review_status, review_note, rewrite_count, parent_script_id,
               publish_url, published_at, performance_json, is_template,
               created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                original["runId"],
                original["brandName"],
                original["platform"],
                script["title"],
                script["hook"],
                script["outline"],
                script["source_trend_keyword"],
                script["source_benchmark_account"],
                script["source_pattern"],
                script.get("fit_reason") or fallback_script["fit_reason"],
                script["risk_notes"],
                script.get("candidate_level") or "rewrite_rule_v1",
                json.dumps(quality, ensure_ascii=False, separators=(",", ":")),
                json.dumps(original["inputStructures"], ensure_ascii=False, separators=(",", ":")),
                json.dumps(original["inputProducts"], ensure_ascii=False, separators=(",", ":")),
                json.dumps(original["inputTemplates"], ensure_ascii=False, separators=(",", ":")),
                json.dumps(original.get("inputFeedback") or [], ensure_ascii=False, separators=(",", ":")),
                json.dumps(original.get("inputTopics") or [], ensure_ascii=False, separators=(",", ":")),
                quality_status,
                "new",
                "",
                original["rewriteCount"] + 1,
                original["id"],
                "",
                "",
                "{}",
                0,
                now,
            ),
        )
        conn.execute(
            """
            UPDATE daily_script_candidates
            SET review_status = 'needs_edit', review_note = '已生成自动改写版本'
            WHERE id = ?
            """,
            (script_id,),
        )
        rewritten = get_script_candidate(conn, cursor.lastrowid)
        conn.commit()
    result = script_row_to_dict(rewritten)
    result["rewritePlan"] = rewrite_plan
    result["rewriteReason"] = f"按质量诊断改写：{rewrite_plan['focus']}"
    result["diagnosisUsed"] = rewrite_plan
    result["rewriteDiff"] = rewrite_diff
    result["rewriteGenerator"] = rewrite_generator
    return result


def list_script_library(status: str = "", limit: int = 50) -> dict:
    brand_name = load_brand_name()
    where = ["brand_name = ?"]
    params: list[object] = [brand_name]
    if status:
        if status not in {"new", "adopted", "rejected", "needs_edit", "published", "template"}:
            raise ValueError("status 不合法")
        if status == "template":
            where.append("is_template = 1")
        elif status == "published":
            where.append("publish_url != ''")
        else:
            where.append("review_status = ?")
            params.append(status)
    params.append(max(1, min(limit, 100)))
    sql = f"""
        SELECT id, run_id, brand_name, platform, title, hook, outline,
               source_trend_keyword, source_benchmark_account, source_pattern,
               fit_reason, risk_notes, candidate_level, quality_json,
        input_structure_json, input_product_json, input_template_json, input_feedback_json, input_topic_json, quality_status,
               review_status, review_note, rewrite_count, parent_script_id,
               publish_url, published_at, performance_json, is_template,
               created_at
        FROM daily_script_candidates
        WHERE {' AND '.join(where)}
        ORDER BY id DESC
        LIMIT ?
    """
    with connect() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
        stats = {
            "total": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ?", (brand_name,)),
            "adopted": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'adopted'", (brand_name,)),
            "needsEdit": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'needs_edit'", (brand_name,)),
            "rejected": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'rejected'", (brand_name,)),
            "published": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND publish_url != ''", (brand_name,)),
            "templates": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND is_template = 1", (brand_name,)),
        }
    return {"ok": True, "items": [script_row_to_dict(row) for row in rows], "stats": stats}


def update_script_publish_result(script_id: int, data: dict) -> dict:
    publish_url = (data.get("publishUrl") or data.get("url") or "").strip()
    published_at = (data.get("publishedAt") or "").strip()
    is_template = 1 if data.get("isTemplate") else 0
    performance = data.get("performance") or {}
    if not isinstance(performance, dict):
        raise ValueError("performance 必须是对象")
    if not publish_url and not performance and not is_template:
        raise ValueError("至少填写发布链接、表现数据或模板标记")
    normalized_performance = {
        "views": int(performance.get("views") or 0),
        "likes": int(performance.get("likes") or 0),
        "comments": int(performance.get("comments") or 0),
        "shares": int(performance.get("shares") or 0),
        "leads": int(performance.get("leads") or 0),
    }
    with connect() as conn:
        get_script_candidate(conn, script_id)
        conn.execute(
            """
            UPDATE daily_script_candidates
            SET publish_url = COALESCE(NULLIF(?, ''), publish_url),
                published_at = COALESCE(NULLIF(?, ''), published_at),
                performance_json = ?,
                is_template = CASE WHEN ? = 1 THEN 1 ELSE is_template END,
                review_status = CASE WHEN ? != '' THEN 'adopted' ELSE review_status END
            WHERE id = ?
            """,
            (
                publish_url,
                published_at,
                json.dumps(normalized_performance, ensure_ascii=False, separators=(",", ":")),
                is_template,
                publish_url,
                script_id,
            ),
        )
        row = get_script_candidate(conn, script_id)
        conn.commit()
    return script_row_to_dict(row)


def latest_scripts(conn: sqlite3.Connection, limit: int = 5, workday_date: str | None = None) -> list[dict]:
    ensure_daily_script_candidates_run_id(conn)
    if workday_date:
        latest_run = conn.execute(
            """
            SELECT MAX(id) AS id
            FROM prototype_generation_runs
            WHERE substr(created_at, 1, 10) = ?
            """,
            (workday_date,),
        ).fetchone()
    else:
        latest_run = conn.execute("SELECT MAX(id) AS id FROM prototype_generation_runs").fetchone()
    latest_run_id = latest_run["id"] if latest_run else None
    if latest_run_id:
        rows = conn.execute(
            """
            SELECT id, run_id, title, hook, source_trend_keyword,
                   source_benchmark_account, source_pattern, candidate_level,
                   quality_json, input_structure_json, input_product_json,
                   input_template_json, input_feedback_json, input_topic_json, quality_status, review_status, review_note, rewrite_count,
                   parent_script_id, publish_url, published_at, performance_json,
                   is_template, created_at
            FROM daily_script_candidates
            WHERE run_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (latest_run_id, limit),
        ).fetchall()
    elif workday_date:
        rows = []
    else:
        rows = conn.execute(
            """
            SELECT id, run_id, title, hook, source_trend_keyword,
                   source_benchmark_account, source_pattern, candidate_level,
                   quality_json, input_structure_json, input_product_json,
                   input_template_json, input_feedback_json, input_topic_json, quality_status, review_status, review_note, rewrite_count,
                   parent_script_id, publish_url, published_at, performance_json,
                   is_template, created_at
            FROM daily_script_candidates
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    items = []
    for row in rows:
        try:
            quality = json.loads(row["quality_json"] or "{}")
        except json.JSONDecodeError:
            quality = {}
        try:
            input_structures = json.loads(row["input_structure_json"] or "[]")
        except json.JSONDecodeError:
            input_structures = []
        try:
            input_products = json.loads(row["input_product_json"] or "[]")
        except json.JSONDecodeError:
            input_products = []
        try:
            input_templates = json.loads(row["input_template_json"] or "[]")
        except json.JSONDecodeError:
            input_templates = []
        try:
            input_feedback = json.loads(row["input_feedback_json"] or "[]")
        except json.JSONDecodeError:
            input_feedback = []
        try:
            input_topics = json.loads(row["input_topic_json"] or "[]")
        except json.JSONDecodeError:
            input_topics = []
        try:
            performance = json.loads(row["performance_json"] or "{}")
        except json.JSONDecodeError:
            performance = {}
        items.append({
            "id": row["id"],
            "runId": row["run_id"],
            "title": row["title"],
            "hook": row["hook"],
            "hot": row["source_trend_keyword"],
            "account": row["source_benchmark_account"],
            "pattern": row["source_pattern"],
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
            "publishUrl": row["publish_url"],
            "publishedAt": row["published_at"],
            "performance": performance,
            "isTemplate": bool(row["is_template"]),
            "createdAt": row["created_at"],
        })
    return items


def review_queue_scripts(conn: sqlite3.Connection, brand_name: str, workday_date: str, limit: int = 8) -> list[dict]:
    ensure_daily_script_candidates_run_id(conn)
    rows = conn.execute(
        """
        SELECT id, run_id, title, hook, source_trend_keyword,
               source_benchmark_account, source_pattern, candidate_level,
               quality_json, input_structure_json, input_product_json,
               input_template_json, input_feedback_json, input_topic_json, quality_status, review_status, review_note, rewrite_count,
               parent_script_id, publish_url, published_at, performance_json,
               is_template, created_at
        FROM daily_script_candidates
        WHERE brand_name = ?
          AND review_status = 'new'
          AND substr(created_at, 1, 10) = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (brand_name, workday_date, limit),
    ).fetchall()
    items = []
    for row in rows:
        try:
            quality = json.loads(row["quality_json"] or "{}")
        except json.JSONDecodeError:
            quality = {}
        try:
            input_structures = json.loads(row["input_structure_json"] or "[]")
        except json.JSONDecodeError:
            input_structures = []
        try:
            input_products = json.loads(row["input_product_json"] or "[]")
        except json.JSONDecodeError:
            input_products = []
        try:
            input_templates = json.loads(row["input_template_json"] or "[]")
        except json.JSONDecodeError:
            input_templates = []
        try:
            input_feedback = json.loads(row["input_feedback_json"] or "[]")
        except json.JSONDecodeError:
            input_feedback = []
        try:
            input_topics = json.loads(row["input_topic_json"] or "[]")
        except json.JSONDecodeError:
            input_topics = []
        try:
            performance = json.loads(row["performance_json"] or "{}")
        except json.JSONDecodeError:
            performance = {}
        items.append({
            "id": row["id"],
            "runId": row["run_id"],
            "title": row["title"],
            "hook": row["hook"],
            "hot": row["source_trend_keyword"],
            "account": row["source_benchmark_account"],
            "pattern": row["source_pattern"],
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
            "publishUrl": row["publish_url"],
            "publishedAt": row["published_at"],
            "performance": performance,
            "isTemplate": bool(row["is_template"]),
            "createdAt": row["created_at"],
        })
    return items


def build_generation_readiness(
    selected_hot_count: int,
    selected_benchmark_count: int,
    selected_structure_count: int,
    selected_product_count: int,
    template_count: int,
    adopted_topic_count: int = 0,
) -> dict:
    checks = [
        {
            "key": "adopted_topics",
            "label": "已采用推荐选题",
            "ready": adopted_topic_count > 0,
            "value": f"{adopted_topic_count} 条",
            "action": "在今日推荐选题中采用 1 条",
            "optional": True,
        },
        {
            "key": "confirmed_materials",
            "label": "已确认热点/对标",
            "ready": selected_hot_count > 0 or selected_benchmark_count > 0,
            "value": f"{selected_hot_count} 热点 + {selected_benchmark_count} 对标",
            "action": "去脚本流程第 1-3 步确认素材",
        },
        {
            "key": "structured_sources",
            "label": "可读取人工结构",
            "ready": selected_structure_count > 0,
            "value": f"{selected_structure_count} 条",
            "action": "在最近导入中批量生成结构摘要",
        },
        {
            "key": "brand_products",
            "label": "商品活动输入",
            "ready": selected_product_count > 0,
            "value": f"{selected_product_count} 条",
            "action": "添加并加入商品活动",
        },
        {
            "key": "templates",
            "label": "高表现模板",
            "ready": template_count > 0,
            "value": f"{template_count} 条",
            "action": "在脚本库标记优质模板",
            "optional": True,
        },
    ]
    blocking = [item for item in checks if not item.get("ready") and not item.get("optional")]
    return {
        "ready": not blocking,
        "level": "ready" if not blocking else ("partial" if selected_hot_count or selected_benchmark_count or selected_structure_count else "blocked"),
        "summary": "可以进入脚本流程生成候选脚本" if not blocking else f"还缺 {len(blocking)} 项关键输入",
        "checks": checks,
        "nextAction": "打开脚本流程生成脚本" if not blocking else blocking[0]["action"],
        "generateUrl": "./index.html?v=readiness-v1#stepGenerate",
    }


def build_r2_input_verifier(
    stats: dict,
    current_workflow: dict,
    readiness: dict,
    selected_content_sources: list[dict],
    brand_products: list[dict],
    review_insights: dict,
    candidate_sources: list[dict] | None = None,
) -> dict:
    selected_sources = [item for item in selected_content_sources if item.get("selected")]
    structured_sources = [item for item in selected_sources if (item.get("structure") or {}).get("status") == "structure_done"]
    selected_products = [item for item in brand_products if item.get("selected")]
    learning_signals = review_insights.get("learningSignals") or {}
    placeholder_labels = {"暂无稳定正向信号", "暂无明确避坑信号"}
    reuse_signals = [
        item for item in (learning_signals.get("reuseSignals") or [])
        if item.get("label") not in placeholder_labels
    ]
    avoid_signals = [
        item for item in (learning_signals.get("avoidSignals") or [])
        if item.get("label") not in placeholder_labels
    ]
    feedback_count = len(reuse_signals) + len(avoid_signals)
    hot_or_topic_count = (current_workflow.get("hotCount") or 0) + (current_workflow.get("adoptedTopicCount") or 0)

    def item(
        key: str,
        label: str,
        actual: int,
        target: int,
        evidence: str,
        action: str,
        href: str,
        required: bool = True,
    ) -> dict:
        passed = actual >= target
        status = "passed" if passed else ("blocked" if required else "waiting")
        return {
            "key": key,
            "label": label,
            "status": status,
            "statusLabel": {"passed": "达标", "blocked": "不足", "waiting": "可增强"}[status],
            "actual": actual,
            "target": target,
            "required": required,
            "evidence": evidence,
            "action": action,
            "href": href,
        }

    checks = [
        item(
            "real_structures",
            "真实结构素材",
            len(structured_sources),
            3,
            f"已选真实素材 {len(selected_sources)} 条；structure_done {len(structured_sources)} 条；非运营素材排除 {stats.get('excludedContentSources') or 0} 条。",
            "去对标内容池补 3 条真实素材并结构化",
            "./content-pool.html?v=r2-input-verifier-v1#manual-import",
        ),
        item(
            "hot_topic",
            "热点/选题输入",
            hot_or_topic_count,
            2,
            f"已确认热点 {current_workflow.get('hotCount') or 0} 条；已采用推荐选题 {current_workflow.get('adoptedTopicCount') or 0} 条。",
            "去热点池或 V2 首页采用选题",
            "./v2.html?v=r2-input-verifier-v1#v2Dashboard",
        ),
        item(
            "brand_products",
            "品牌商品活动",
            len(selected_products),
            1,
            f"已加入生成商品活动 {len(selected_products)} 条；历史商品 {stats.get('brandProducts') or 0} 条。",
            "维护今天可说的商品活动",
            "./brand-center.html?v=r2-input-verifier-v1",
        ),
        item(
            "templates",
            "高表现模板",
            review_insights.get("templateCount") or 0,
            1,
            f"已标记高表现模板 {review_insights.get('templateCount') or 0} 条。",
            "去脚本库标记 1 条优质模板",
            "./script-library.html?v=r2-input-verifier-v1&status=template",
            required=False,
        ),
        item(
            "feedback_signals",
            "复盘反馈信号",
            feedback_count,
            1,
            f"复用信号 {len(reuse_signals)} 条；避坑信号 {len(avoid_signals)} 条。",
            "审核脚本时补原因或回填发布表现",
            "./script-library.html?v=r2-input-verifier-v1&status=new",
            required=False,
        ),
    ]
    required_checks = [check for check in checks if check["required"]]
    blocked = [check for check in required_checks if check["status"] != "passed"]
    optional_missing = [check for check in checks if not check["required"] and check["status"] != "passed"]
    passed = [check for check in checks if check["status"] == "passed"]
    if blocked:
        level = "blocked"
        next_item = blocked[0]
    elif optional_missing:
        level = "thin"
        next_item = optional_missing[0]
    else:
        level = "strong"
        next_item = checks[-1]
    candidate_sources = candidate_sources or []
    replenishment_slots = build_r2_replenishment_slots(candidate_sources, target=3)
    return {
        "version": "r2_input_verifier_v1",
        "level": level,
        "levelLabel": {
            "strong": "R2 输入厚度达标",
            "thin": "R2 可生成但偏薄",
            "blocked": "R2 输入厚度不足",
        }.get(level, "待判断"),
        "summary": (
            "R2 输入厚度达标：生成器能读取真实结构、热点/选题、商品活动、模板和复盘信号。"
            if level == "strong" else
            f"R2 输入还不够厚：下一步补「{next_item['label']}」。"
        ),
        "checks": checks,
        "counts": {
            "passed": len(passed),
            "requiredPassed": len([check for check in required_checks if check["status"] == "passed"]),
            "requiredTotal": len(required_checks),
            "optionalMissing": len(optional_missing),
            "total": len(checks),
        },
        "nextAction": next_item["action"],
        "nextHref": next_item["href"],
        "canGenerate": bool(readiness.get("ready")),
        "candidateSources": candidate_sources,
        "replenishmentSlots": replenishment_slots,
        "qualityGate": "生成按钮只看关键输入；R2 验收器判断输入厚度和脚本质量风险。",
        "rule": "R2 不把示例/测试素材、账号名、空模板或占位复盘信号算作输入厚度。",
    }


def build_r2_replenishment_slots(candidate_sources: list[dict], target: int = 3) -> list[dict]:
    path_templates = [
        {
            "path": "real_link",
            "label": "真实链接",
            "title": "补 1 条真实对标视频/笔记链接",
            "hint": "适合手里有抖音/小红书作品链接；导入后继续提字幕或粘贴字幕。",
            "href": "./content-pool.html?v=r2-slot-v1&r2Slot={slot}&importPath=real_link&importPlatform=douyin&importMode=single#manual-import",
        },
        {
            "path": "manual_subtitle",
            "label": "旧字幕",
            "title": "补 1 条旧字幕项目结果",
            "hint": "适合已经有字幕提取结果；直接粘贴标题、账号和真实字幕。",
            "href": "./content-pool.html?v=r2-slot-v1&r2Slot={slot}&importPath=manual_subtitle&importPlatform=manual&importMode=single#manual-import",
        },
        {
            "path": "third_party_table",
            "label": "表格导入",
            "title": "从第三方表格补 1 条可结构化内容",
            "hint": "适合灰豚、蝉妈妈、飞瓜、新榜或飞书表格；先预检再导入。",
            "href": "./content-pool.html?v=r2-slot-v1&r2Slot={slot}&importPath=third_party_table&importPlatform=third_party&importMode=batch#batch-import",
        },
    ]
    usable = [
        item for item in candidate_sources
        if item.get("status") in {"ready", "needs_structure", "needs_select", "needs_text"}
    ]
    slots = []
    for index in range(target):
        source = usable[index] if index < len(usable) else None
        if source:
            status = "ready" if source.get("status") == "ready" else "in_progress"
            slots.append({
                "slot": index + 1,
                "status": status,
                "statusLabel": "已占位" if status == "ready" else "处理中",
                "title": source.get("title") or f"第 {index + 1} 条素材",
                "sourceId": source.get("id"),
                "sourceStatus": source.get("status"),
                "sourceStatusLabel": source.get("statusLabel"),
                "nextAction": source.get("nextAction") or "查看素材",
                "href": source.get("href") or "#contentPoolList",
                "hint": "继续把这条素材推进到已选 + structure_done。",
            })
            continue
        template = path_templates[index % len(path_templates)]
        slots.append({
            "slot": index + 1,
            "status": "empty",
            "statusLabel": "待补",
            "title": template["title"],
            "sourceId": None,
            "sourceStatus": "empty",
            "sourceStatusLabel": template["label"],
            "nextAction": f"走{template['label']}路径",
            "href": template["href"].format(slot=index + 1),
            "hint": template["hint"],
        })
    return slots


def build_r2_daily_execution_plan(r2_verifier: dict) -> dict:
    slots = r2_verifier.get("replenishmentSlots") or []
    candidates = r2_verifier.get("candidateSources") or []
    real_structure = next((item for item in r2_verifier.get("checks") or [] if item.get("key") == "real_structures"), {})
    actual = int(real_structure.get("actual") or 0)
    target = int(real_structure.get("target") or 3)
    missing = max(0, target - actual)
    actions = [
        {
            "step": 1,
            "label": "补真实素材",
            "status": "done" if candidates else "current",
            "detail": f"当前真实候选 {len(candidates)} 条；还缺 {missing} 条 structure_done。",
            "href": slots[0].get("href") if slots else "./content-pool.html?v=r2-daily-plan-v1#manual-import",
        },
        {
            "step": 2,
            "label": "补字幕/正文",
            "status": "blocked" if not candidates else ("current" if any(item.get("status") == "needs_text" for item in candidates) else "waiting"),
            "detail": "没有真实候选时先导入素材；有链接无字幕时先提取或粘贴字幕。",
            "href": "./content-pool.html?v=r2-daily-plan-v1#contentPoolList",
        },
        {
            "step": 3,
            "label": "加入生成并结构化",
            "status": "blocked" if not candidates else ("current" if any(item.get("status") in {"needs_select", "needs_structure"} for item in candidates) else "waiting"),
            "detail": "只有已选 + structure_done 才计入 R2 输入厚度。",
            "href": "./content-pool.html?v=r2-daily-plan-v1#manual-import",
        },
        {
            "step": 4,
            "label": "回脚本流程",
            "status": "current" if actual >= target else "blocked",
            "detail": "3 条真实结构素材达标后，再进入脚本流程生成候选脚本。",
            "href": "./index.html?v=r2-daily-plan-v1#stepGenerate",
        },
    ]
    return {
        "version": "r2_daily_execution_plan_v1",
        "level": "ready" if actual >= target else "blocked",
        "title": "R2 今日执行计划",
        "summary": (
            "R2 已达到 3 条真实结构素材，可以进入脚本流程。"
            if actual >= target else
            f"今天先补 {missing} 条真实结构素材；不要直接点生成。"
        ),
        "actual": actual,
        "target": target,
        "missing": missing,
        "slots": slots,
        "actions": actions,
        "nextAction": (slots[0].get("nextAction") if slots else "补真实素材") if actual < target else "进入脚本流程",
        "nextHref": (slots[0].get("href") if slots else "./content-pool.html?v=r2-daily-plan-v1#manual-import") if actual < target else "./index.html?v=r2-daily-plan-v1#stepGenerate",
        "rule": "负责人只看这张卡决定今天先补哪几条素材；空槽不代表已有素材。",
    }


def build_r2_candidate_sources(conn: sqlite3.Connection, brand_name: str, workday_date: str, limit: int = 8) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, workday_date, brand_name, platform, source_type, title,
               url, account_name, raw_text, note, import_method, status,
               selected, benchmark_update_task_id, created_at, updated_at
        FROM content_sources
        WHERE brand_name = ? AND workday_date = ?
        ORDER BY selected DESC, updated_at DESC, id DESC
        LIMIT ?
        """,
        (brand_name, workday_date, limit),
    ).fetchall()
    items = []
    for row in rows:
        structure = latest_content_structure(conn, row["id"])
        subtitle_job = latest_subtitle_job(conn, row["id"])
        source = attach_benchmark_task(conn, serialize_content_source(row, structure, subtitle_job))
        exclusion_reason = source.get("realMaterialReason") or ""
        has_url = bool(source.get("url"))
        has_text = bool((source.get("rawText") or "").strip() or (source.get("note") or "").strip())
        selected = bool(source.get("selected"))
        structure_status = (structure or {}).get("status") or "none"
        structure_done = structure_status == "structure_done"
        subtitle_status = (subtitle_job or {}).get("status") or "none"
        blockers = []
        if exclusion_reason:
            status = "excluded"
            status_label = "不计入"
            next_action = "换成真实运营素材"
            blockers.append(exclusion_reason)
        elif structure_done and selected:
            status = "ready"
            status_label = "可进入生成"
            next_action = "进入脚本流程"
        elif not selected:
            status = "needs_select"
            status_label = "未加入生成"
            next_action = "批量加入生成"
            blockers.append("未加入生成工作流")
        elif not (has_text or has_url):
            status = "needs_text"
            status_label = "缺字幕/正文"
            next_action = "补字幕或正文"
            blockers.append("缺少链接、字幕和正文")
        elif not structure_done:
            status = "needs_structure"
            status_label = "待结构化"
            next_action = "批量生成结构摘要"
            blockers.append("没有 structure_done 结构摘要")
        else:
            status = "waiting"
            status_label = "待处理"
            next_action = "查看素材状态"
        items.append({
            "id": source["id"],
            "title": source.get("title") or "未命名素材",
            "platform": source.get("platform") or "",
            "accountName": source.get("accountName") or "",
            "selected": selected,
            "hasUrl": has_url,
            "hasText": has_text,
            "textLength": len(source.get("rawText") or ""),
            "structureStatus": structure_status,
            "subtitleStatus": subtitle_status,
            "status": status,
            "statusLabel": status_label,
            "nextAction": next_action,
            "blockers": blockers,
            "href": f"./content-pool.html?v=r2-source-diagnosis-v1#content-source-{source['id']}",
        })
    return items


def performance_score(performance: dict) -> int:
    return (
        int(performance.get("views") or 0)
        + int(performance.get("likes") or 0) * 10
        + int(performance.get("comments") or 0) * 15
        + int(performance.get("shares") or 0) * 20
        + int(performance.get("leads") or 0) * 80
    )


def source_pattern_key(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return "未标注结构"
    for sep in ["：", ":", "；", ";", "+", "，", ","]:
        if sep in text:
            text = text.split(sep, 1)[0]
            break
    return text[:28] or "未标注结构"


def classify_review_note(note: str) -> tuple[str, str]:
    text = note or ""
    if any(word in text for word in ["开头", "前 3 秒", "前3秒", "冲突", "钩子", "吸引力"]):
        return "hook", "开头/钩子"
    if any(word in text for word in ["CTA", "转化", "进店", "团购", "私信", "核销", "权益"]):
        return "conversion", "转化/CTA"
    if any(word in text for word in ["分镜", "可拍", "镜头", "口播", "字幕", "执行"]):
        return "shootable", "可拍执行"
    if any(word in text for word in ["品牌", "门店", "活动", "商品", "不贴合"]):
        return "brand_fit", "品牌贴合"
    if any(word in text for word in ["合规", "风险", "价格", "库存", "最低", "承诺"]):
        return "compliance", "合规风险"
    return "other", "其他原因"


def review_note_instruction(category: str, status: str) -> str:
    if status == "adopted":
        return {
            "hook": "下一轮优先复用这种开头钩子。",
            "conversion": "下一轮保留这种明确 CTA 和到店动作。",
            "shootable": "下一轮保留这种可直接拍摄的分镜表达。",
            "brand_fit": "下一轮优先复用这种品牌和门店贴合表达。",
            "compliance": "下一轮保留这种合规谨慎口径。",
        }.get(category, "下一轮可复用该正向原因对应的表达。")
    return {
        "hook": "下一轮必须重写前 3 秒开头，补冲突、问题或热点钩子。",
        "conversion": "下一轮必须补清楚进店、私信、团购或核销动作。",
        "shootable": "下一轮必须补清楚镜头、口播和字幕，避免只有文案概念。",
        "brand_fit": "下一轮必须先检查品牌、商品和门店活动是否贴合。",
        "compliance": "下一轮必须避开未核实价格、库存、最低价和绝对承诺。",
    }.get(category, "下一轮生成时降低相似表达权重，并要求明显改写。")


def build_review_note_learning(rows: list[sqlite3.Row]) -> dict:
    reviewable = [row for row in rows if row["review_status"] in {"adopted", "rejected", "needs_edit"}]
    with_note = [row for row in reviewable if (row["review_note"] or "").strip()]
    missing_by_status = {"adopted": 0, "needs_edit": 0, "rejected": 0}
    category_stats: dict[str, dict] = {}
    note_signals: list[dict] = []
    for row in reviewable:
        status = row["review_status"]
        note = (row["review_note"] or "").strip()
        if not note:
            missing_by_status[status] = missing_by_status.get(status, 0) + 1
            continue
        category, label = classify_review_note(note)
        stats = category_stats.setdefault(
            category,
            {"category": category, "label": label, "total": 0, "adopted": 0, "needsEdit": 0, "rejected": 0, "examples": []},
        )
        stats["total"] += 1
        if status == "adopted":
            stats["adopted"] += 1
        elif status == "needs_edit":
            stats["needsEdit"] += 1
        elif status == "rejected":
            stats["rejected"] += 1
        if len(stats["examples"]) < 3:
            stats["examples"].append(note)
        note_signals.append(
            {
                "type": "reuse" if status == "adopted" else "avoid",
                "label": label,
                "status": status,
                "note": note,
                "instruction": review_note_instruction(category, status),
                "scriptId": row["id"],
                "title": row["title"],
            }
        )
    coverage = round(len(with_note) / len(reviewable) * 100) if reviewable else 0
    categories = sorted(category_stats.values(), key=lambda item: item["total"], reverse=True)
    missing_total = sum(missing_by_status.values())
    return {
        "reviewableCount": len(reviewable),
        "withNoteCount": len(with_note),
        "missingNoteCount": missing_total,
        "coverage": coverage,
        "coverageLabel": f"{len(with_note)}/{len(reviewable)} 条已写原因" if reviewable else "暂无已审核脚本",
        "missingByStatus": missing_by_status,
        "categories": categories[:6],
        "noteSignals": note_signals[:12],
        "summary": f"审核原因覆盖率 {coverage}%：{len(with_note)}/{len(reviewable)} 条已写原因。" if reviewable else "还没有已审核脚本，无法提炼原因信号。",
        "nextAction": "补齐已采用/待改/弃用脚本的具体原因。" if missing_total else "原因覆盖已完成，可继续回填发布表现或生成下一轮。",
    }


def build_review_learning_signals(conn: sqlite3.Connection, brand_name: str) -> dict:
    rows = conn.execute(
        """
        SELECT id, title, hook, source_pattern, review_status, review_note,
               quality_json, performance_json, is_template, publish_url
        FROM daily_script_candidates
        WHERE brand_name = ?
        ORDER BY id DESC
        LIMIT 120
        """,
        (brand_name,),
    ).fetchall()
    pattern_stats: dict[str, dict] = {}
    accepted_notes: list[str] = []
    rejected_notes: list[str] = []
    rewrite_notes: list[str] = []
    for row in rows:
        try:
            quality = json.loads(row["quality_json"] or "{}")
        except json.JSONDecodeError:
            quality = {}
        try:
            performance = json.loads(row["performance_json"] or "{}")
        except json.JSONDecodeError:
            performance = {}
        pattern = source_pattern_key(row["source_pattern"])
        stats = pattern_stats.setdefault(
            pattern,
            {"pattern": pattern, "scripts": 0, "adopted": 0, "rejected": 0, "needsEdit": 0, "templates": 0, "published": 0, "score": 0},
        )
        stats["scripts"] += 1
        status = row["review_status"]
        if status == "adopted":
            stats["adopted"] += 1
        elif status == "rejected":
            stats["rejected"] += 1
        elif status == "needs_edit":
            stats["needsEdit"] += 1
        if row["is_template"]:
            stats["templates"] += 1
        if row["publish_url"]:
            stats["published"] += 1
        stats["score"] += performance_score(performance) + int(quality.get("overall") or 0)
        note = (row["review_note"] or "").strip()
        if status == "adopted" and note:
            accepted_notes.append(note)
        elif status == "rejected" and note:
            rejected_notes.append(note)
        elif status == "needs_edit" and note:
            rewrite_notes.append(note)
    ranked = sorted(pattern_stats.values(), key=lambda item: (item["templates"], item["adopted"], item["score"]), reverse=True)
    avoid = sorted(pattern_stats.values(), key=lambda item: (item["rejected"] + item["needsEdit"], -item["adopted"]), reverse=True)
    reuse_signals = [
        {
            "label": item["pattern"],
            "evidence": f"采用 {item['adopted']} 条 / 模板 {item['templates']} 条 / 发布 {item['published']} 条",
            "action": "下一轮生成优先复用这个结构的开头、节奏和 CTA。",
        }
        for item in ranked
        if item["adopted"] or item["templates"] or item["published"]
    ][:4]
    avoid_signals = [
        {
            "label": item["pattern"],
            "evidence": f"待改 {item['needsEdit']} 条 / 弃用 {item['rejected']} 条",
            "action": "生成时降低权重，或要求先改写开头、转化动作和合规表达。",
        }
        for item in avoid
        if item["needsEdit"] or item["rejected"]
    ][:4]
    note_learning = build_review_note_learning(rows)
    note_reuse = [item for item in note_learning.get("noteSignals", []) if item.get("type") == "reuse"]
    note_avoid = [item for item in note_learning.get("noteSignals", []) if item.get("type") == "avoid"]
    for item in note_reuse[:2]:
        reuse_signals.append(
            {
                "label": item["label"],
                "evidence": item["note"],
                "action": item["instruction"],
            }
        )
    for item in note_avoid[:3]:
        avoid_signals.append(
            {
                "label": item["label"],
                "evidence": item["note"],
                "action": item["instruction"],
            }
        )
    if not reuse_signals:
        reuse_signals.append({"label": "暂无稳定正向信号", "evidence": "还需要采用、发布或标记模板。", "action": "先把高质量脚本标为采用或模板。"})
    if not avoid_signals:
        avoid_signals.append({"label": "暂无明确避坑信号", "evidence": "待改/弃用原因仍不足。", "action": "审核时补充原因，系统才能形成避坑规则。"})
    return {
        "reuseSignals": reuse_signals,
        "avoidSignals": avoid_signals,
        "acceptedNotes": accepted_notes[:5],
        "rewriteNotes": rewrite_notes[:5],
        "rejectedNotes": rejected_notes[:5],
        "noteLearning": note_learning,
        "summary": f"已从 {len(rows)} 条脚本中提炼 {len(reuse_signals)} 条复用信号、{len(avoid_signals)} 条避坑信号。",
        "rule": "反馈信号来自审核状态、质量评分、发布表现和模板标记；下一轮生成会读取模板，同时在页面明确提示结构取舍。",
    }


def feedback_signals_for_generation(review_insights: dict) -> list[dict]:
    signals = review_insights.get("learningSignals") or {}
    items: list[dict] = []
    for signal in (signals.get("reuseSignals") or [])[:3]:
        items.append(
            {
                "type": "reuse",
                "label": signal.get("label") or "",
                "evidence": signal.get("evidence") or "",
                "instruction": signal.get("action") or "优先复用这个结构。",
            }
        )
    for signal in (signals.get("avoidSignals") or [])[:3]:
        items.append(
            {
                "type": "avoid",
                "label": signal.get("label") or "",
                "evidence": signal.get("evidence") or "",
                "instruction": signal.get("action") or "避开或改写这个结构。",
            }
        )
    return [item for item in items if item["label"]]


def build_review_insights(conn: sqlite3.Connection, brand_name: str, limit: int = 5) -> dict:
    rows = conn.execute(
        """
        SELECT id, run_id, brand_name, platform, title, hook, outline,
               source_trend_keyword, source_benchmark_account, source_pattern,
               fit_reason, risk_notes, candidate_level, quality_json,
               input_structure_json, input_product_json, input_template_json, input_feedback_json, input_topic_json, quality_status,
               review_status, review_note, rewrite_count, parent_script_id,
               publish_url, published_at, performance_json, is_template,
               created_at
        FROM daily_script_candidates
        WHERE brand_name = ? AND (publish_url != '' OR is_template = 1)
        ORDER BY id DESC
        LIMIT ?
        """,
        (brand_name, max(1, min(limit, 20))),
    ).fetchall()
    items = [script_row_to_dict(row) for row in rows]
    published = [item for item in items if item.get("publishUrl")]
    templates = [item for item in items if item.get("isTemplate")]
    ranked = sorted(published, key=lambda item: performance_score(item.get("performance") or {}), reverse=True)
    total_performance = {
        "views": sum(int((item.get("performance") or {}).get("views") or 0) for item in published),
        "likes": sum(int((item.get("performance") or {}).get("likes") or 0) for item in published),
        "comments": sum(int((item.get("performance") or {}).get("comments") or 0) for item in published),
        "leads": sum(int((item.get("performance") or {}).get("leads") or 0) for item in published),
    }
    best = ranked[0] if ranked else None
    template_names = [item["title"] for item in templates[:3]]
    next_actions = []
    if best:
        next_actions.append(f"下一轮优先复用《{best['title']}》的开头和转化结构")
    if template_names:
        next_actions.append(f"生成时继续引用 {len(template_names)} 条高表现模板")
    if total_performance["leads"]:
        next_actions.append("保留能带来线索的 CTA，并在新脚本中强化私信/到店动作")
    if not next_actions:
        next_actions.append("先回填至少 1 条发布表现，系统才能形成可复用洞察")
    learning_signals = build_review_learning_signals(conn, brand_name)
    for signal in learning_signals.get("reuseSignals", [])[:2]:
        next_actions.append(f"优先复用「{signal['label']}」：{signal['evidence']}")
    for signal in learning_signals.get("avoidSignals", [])[:1]:
        next_actions.append(f"避开或改写「{signal['label']}」：{signal['evidence']}")
    return {
        "publishedCount": len(published),
        "templateCount": len(templates),
        "totals": total_performance,
        "bestScripts": ranked[:3],
        "templates": templates[:3],
        "nextActions": next_actions[:4],
        "learningSignals": learning_signals,
    }


def build_quality_learning_plan(conn: sqlite3.Connection, brand_name: str, review_insights: dict) -> dict:
    stats = {
        "total": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ?", (brand_name,)),
        "new": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'new'", (brand_name,)),
        "adopted": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'adopted'", (brand_name,)),
        "needsEdit": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'needs_edit'", (brand_name,)),
        "rejected": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'rejected'", (brand_name,)),
        "published": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND publish_url != ''", (brand_name,)),
        "templates": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND is_template = 1", (brand_name,)),
    }
    signals = review_insights.get("learningSignals") or {}
    reuse_signals = [
        item for item in (signals.get("reuseSignals") or [])
        if not str(item.get("label") or "").startswith("暂无")
    ]
    avoid_signals = [
        item for item in (signals.get("avoidSignals") or [])
        if not str(item.get("label") or "").startswith("暂无")
    ]
    rewrite_notes = signals.get("rewriteNotes") or []
    accepted_notes = signals.get("acceptedNotes") or []
    rejected_notes = signals.get("rejectedNotes") or []
    note_learning = signals.get("noteLearning") or {}
    missing_note_count = int(note_learning.get("missingNoteCount") or 0)
    stats.update({
        "reuseSignals": len(reuse_signals),
        "avoidSignals": len(avoid_signals),
        "acceptedNotes": len(accepted_notes),
        "rewriteNotes": len(rewrite_notes),
        "rejectedNotes": len(rejected_notes),
        "reviewNoteCoverage": int(note_learning.get("coverage") or 0),
        "reviewNotesWithText": int(note_learning.get("withNoteCount") or 0),
        "reviewNotesMissing": missing_note_count,
    })
    if stats["total"] == 0:
        level = "empty"
        summary = "脚本库还没有历史样本，下一轮生成只能依赖当前素材和品牌配置。"
    elif stats["new"] or stats["needsEdit"]:
        level = "needs_review"
        summary = f"已有学习输入可用，但仍有 {stats['new']} 条新脚本、{stats['needsEdit']} 条待改脚本需要运营判断；审核原因覆盖率 {stats['reviewNoteCoverage']}%。"
    elif stats["published"] and stats["templates"] and stats["reuseSignals"]:
        level = "ready"
        summary = f"已可反哺生成：{stats['templates']} 条模板、{stats['reuseSignals']} 条复用信号、{stats['avoidSignals']} 条避坑信号。"
    elif not stats["published"]:
        level = "needs_publish"
        summary = "还缺发布表现回填，系统只能知道脚本被采用，无法判断真实转化。"
    elif not stats["templates"]:
        level = "needs_templates"
        summary = "还缺优质模板标记，下一轮生成无法稳定复用高表现结构。"
    else:
        level = "partial"
        summary = "已有部分复盘数据，但还需要更多审核原因和表现回填来稳定学习。"

    action_queue: list[dict] = []
    if stats["new"]:
        action_queue.append({
            "title": "先审核新脚本",
            "count": stats["new"],
            "description": "把可用脚本标为采用，把不可用脚本标为待改或弃用，系统才知道哪些结构有效。",
            "action": "查看新脚本",
            "filter": "new",
            "priority": "high",
        })
    if stats["needsEdit"]:
        action_queue.append({
            "title": "处理待改脚本",
            "count": stats["needsEdit"],
            "description": "待改脚本会形成避坑信号，也可以用自动改写继续产出可拍版本。",
            "action": "查看待改",
            "filter": "needs_edit",
            "priority": "high",
        })
    if missing_note_count:
        action_queue.append({
            "title": "补审核原因",
            "count": missing_note_count,
            "description": "已审核但没有原因的脚本无法形成稳定学习信号；先补采用/待改/弃用原因。",
            "action": "补原因",
            "filter": "",
            "priority": "high" if stats["reviewNoteCoverage"] < 70 else "medium",
        })
    if not stats["published"] and stats["adopted"]:
        action_queue.append({
            "title": "回填发布表现",
            "count": stats["adopted"],
            "description": "至少补发布链接、播放、点赞或线索，后续才能按真实表现排序。",
            "action": "查看已采用",
            "filter": "adopted",
            "priority": "medium",
        })
    if not stats["templates"] and (stats["adopted"] or stats["published"]):
        action_queue.append({
            "title": "沉淀优质模板",
            "count": stats["published"] or stats["adopted"],
            "description": "把表现好、结构清楚的脚本标记为模板，生成提示词会读取这些模板快照。",
            "action": "查看可沉淀脚本",
            "filter": "published" if stats["published"] else "adopted",
            "priority": "medium",
        })
    if not stats["acceptedNotes"] and not stats["rewriteNotes"] and not stats["rejectedNotes"] and stats["total"]:
        action_queue.append({
            "title": "补审核原因",
            "count": stats["total"],
            "description": "只有状态没有原因时，系统知道结果但不知道为什么，学习信号会偏弱。",
            "action": "查看全部脚本",
            "filter": "",
            "priority": "low",
        })
    if not action_queue:
        action_queue.append({
            "title": "带复盘信号生成下一轮",
            "count": stats["templates"] + stats["reuseSignals"] + stats["avoidSignals"],
            "description": "当前模板和反馈信号已经可用，生成时会写入 input_template_json 与 input_feedback_json。",
            "action": "去生成脚本",
            "href": "./index.html?v=quality-learning-v1#stepGenerate",
            "priority": "ready",
        })

    next_action = action_queue[0]
    generation_inputs = []
    if stats["templates"]:
        generation_inputs.append(f"{stats['templates']} 条优质模板")
    if stats["reuseSignals"]:
        generation_inputs.append(f"{stats['reuseSignals']} 条复用信号")
    if stats["avoidSignals"]:
        generation_inputs.append(f"{stats['avoidSignals']} 条避坑信号")
    if stats["reviewNotesWithText"]:
        generation_inputs.append(f"{stats['reviewNotesWithText']} 条审核原因")
    return {
        "version": "quality_learning_plan_v1",
        "level": level,
        "summary": summary,
        "nextAction": next_action.get("title"),
        "nextHref": next_action.get("href") or "./script-library.html?v=quality-learning-v1",
        "counts": stats,
        "reviewNoteLearning": note_learning,
        "generationImpact": {
            "ready": bool(stats["templates"] or stats["reuseSignals"] or stats["avoidSignals"]),
            "summary": f"下一轮生成会读取：{'、'.join(generation_inputs)}。" if generation_inputs else "下一轮生成暂时没有可复用的历史学习输入。",
            "inputFields": ["input_template_json", "input_feedback_json"],
            "rule": "模板来自 is_template=1 的历史脚本；反馈信号来自审核状态、审核原因、发布表现和结构来源；原因覆盖率越高，生成避坑越稳定。",
        },
        "actionQueue": action_queue[:5],
        "reuseSignals": reuse_signals[:4],
        "avoidSignals": avoid_signals[:4],
        "rules": [
            "采用、发布、模板标记会提高对应结构在下一轮生成中的权重。",
            "待改、弃用和低质量诊断会进入避坑/改写信号。",
            "发布表现用于判断模板优先级；没有回填表现时只作为弱证据。",
            "每条新脚本都会保存生成时读取到的模板和反馈快照，便于追溯。",
        ],
    }


def build_topic_recommendations(
    selected_hot: list[dict],
    selected_benchmark: list[dict],
    content_sources: list[dict],
    brand_products: list[dict],
    review_insights: dict,
    adopted_topic_ids: set[str] | None = None,
    limit: int = 5,
) -> list[dict]:
    adopted_topic_ids = adopted_topic_ids or set()
    products = [item for item in brand_products if item.get("selected")]
    structures = [item for item in content_sources if item.get("selected") and item.get("structure")]
    templates = review_insights.get("templates") or []
    best_scripts = review_insights.get("bestScripts") or []
    selected_benchmark = [item for item in (selected_benchmark or []) if isinstance(item, dict)]
    hot_items = selected_hot or []
    if not hot_items:
        hot_items = [
            {"title": "品牌日常选题", "payload": {"title": "品牌日常选题", "topic": "门店转化"}},
        ]
    recommendations: list[dict] = []
    max_count = max(1, min(limit, 8))
    for index, hot in enumerate(hot_items[:max_count]):
        payload = hot.get("payload") or {}
        hot_title = payload.get("title") or hot.get("title") or "品牌日常选题"
        structure = structures[index % len(structures)] if structures else None
        benchmark = selected_benchmark[index % len(selected_benchmark)] if selected_benchmark else None
        benchmark_payload = benchmark.get("payload") if isinstance(benchmark, dict) else {}
        if not isinstance(benchmark_payload, dict):
            benchmark_payload = {}
        product = products[index % len(products)] if products else None
        template = templates[index % len(templates)] if templates else (best_scripts[0] if best_scripts else None)
        structure_body = (structure.get("structure") or {}).get("structure") if structure else {}
        if not isinstance(structure_body, dict):
            structure_body = {}
        pattern = (
            structure_body.get("script_pattern")
            or structure_body.get("hook_angle")
            or benchmark_payload.get("pattern")
            or "门店种草转化"
        )
        product_name = product.get("productName") if product else "当前商品活动"
        score = 52
        reasons = []
        inputs = {
            "hot": hot_title,
            "structure": structure.get("title") if structure else (benchmark_payload.get("summary") if benchmark else ""),
            "product": product_name if product else "",
            "template": template.get("title") if template else "",
        }
        if hot_title and hot_title != "品牌日常选题":
            score += 14
            reasons.append("已锁定今日热点")
        if structure:
            score += 18
            reasons.append("已有可读取结构摘要")
        elif benchmark:
            score += 8
            reasons.append("有对标结构可参考")
        if product:
            score += 14
            reasons.append("已绑定商品活动")
        if template:
            score += 8
            reasons.append("可复用高表现模板")
        if not reasons:
            reasons.append("用于保底的品牌日常选题")
        recommendations.append({
            "id": f"topic-{index + 1}",
            "title": f"{hot_title} × {product_name}",
            "angle": f"用「{pattern}」把热点转成到店/团购行动",
            "score": min(score, 100),
            "sourceHot": hot_title,
            "sourceStructure": inputs["structure"] or "待补结构摘要",
            "sourceProduct": inputs["product"] or "待加入商品活动",
            "sourceTemplate": inputs["template"] or "暂无模板",
            "reasons": reasons,
            "adopted": f"topic-{index + 1}" in adopted_topic_ids,
            "nextAction": "生成脚本" if structure and product else ("补商品活动" if not product else "补结构摘要"),
            "href": "./index.html?v=topic-recommendations-v1#stepGenerate" if structure and product else (
                "./brand-center.html?v=topic-recommendations-v1" if not product else "./content-pool.html?v=topic-recommendations-v1"
            ),
        })
    if len(recommendations) < max_count and structures:
        for structure in structures[: max_count - len(recommendations)]:
            product = products[0] if products else None
            structure_body = (structure.get("structure") or {}).get("structure") or {}
            if not isinstance(structure_body, dict):
                structure_body = {}
            recommendations.append({
                "id": f"topic-structure-{structure.get('id')}",
                "title": f"{structure.get('title')} × {product.get('productName') if product else '当前商品活动'}",
                "angle": structure_body.get("hook_angle") or structure_body.get("script_pattern") or "复用对标内容结构做门店转化",
                "score": 72 if product else 58,
                "sourceHot": "无热点，按对标结构做日常选题",
                "sourceStructure": structure.get("title") or "结构摘要",
                "sourceProduct": product.get("productName") if product else "待加入商品活动",
                "sourceTemplate": templates[0].get("title") if templates else "暂无模板",
                "reasons": ["已有结构摘要", "适合做品牌日常内容"],
                "adopted": f"topic-structure-{structure.get('id')}" in adopted_topic_ids,
                "nextAction": "生成脚本" if product else "补商品活动",
                "href": "./index.html?v=topic-recommendations-v1#stepGenerate" if product else "./brand-center.html?v=topic-recommendations-v1",
            })
    while len(recommendations) < max_count:
        index = len(recommendations)
        product = products[index % len(products)] if products else None
        template = templates[index % len(templates)] if templates else (best_scripts[0] if best_scripts else None)
        product_name = product.get("productName") if product else "当前商品活动"
        template_title = template.get("title") if template else "暂无模板"
        fallback_id = f"topic-daily-{index + 1}"
        recommendations.append({
            "id": fallback_id,
            "title": f"品牌日常转化 × {product_name}",
            "angle": "不用强蹭热点，直接用门店试穿、团购权益和导购问答做稳定转化内容",
            "score": 68 if product else 52,
            "sourceHot": "无热点，品牌日常选题",
            "sourceStructure": "品牌自有门店种草结构",
            "sourceProduct": product_name if product else "待加入商品活动",
            "sourceTemplate": template_title,
            "reasons": ["补足今日候选池", "适合无热点时稳定产出"] + (["已绑定商品活动"] if product else []),
            "adopted": fallback_id in adopted_topic_ids,
            "nextAction": "生成脚本" if product else "补商品活动",
            "href": "./index.html?v=topic-recommendations-v1#stepGenerate" if product else "./brand-center.html?v=topic-recommendations-v1",
        })
    return sorted(recommendations, key=lambda item: item["score"], reverse=True)[:max_count]


def build_dashboard_tasks(
    conn: sqlite3.Connection,
    brand_name: str,
    workday_date: str,
    data_source_matrix: dict | None = None,
    collection_action_flow: dict | None = None,
) -> list[dict]:
    failed_tasks = scalar_count(
        conn,
        "SELECT COUNT(*) FROM collection_tasks WHERE brand_name = ? AND status = 'failed' AND substr(created_at, 1, 10) = ?",
        (brand_name, workday_date),
    )
    unstructured_selected = scalar_count(
        conn,
        """
        SELECT COUNT(*)
        FROM content_sources cs
        LEFT JOIN content_structures cst ON cst.source_id = cs.id
        WHERE cs.brand_name = ? AND cs.selected = 1 AND cst.id IS NULL AND cs.workday_date = ?
        """,
        (brand_name, workday_date),
    )
    new_scripts = scalar_count(
        conn,
        "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'new' AND substr(created_at, 1, 10) = ?",
        (brand_name, workday_date),
    )
    needs_edit = scalar_count(
        conn,
        "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'needs_edit' AND substr(created_at, 1, 10) = ?",
        (brand_name, workday_date),
    )
    adopted_unpublished = scalar_count(
        conn,
        """
        SELECT COUNT(*)
        FROM daily_script_candidates
        WHERE brand_name = ? AND review_status = 'adopted' AND publish_url = '' AND substr(created_at, 1, 10) = ?
        """,
        (brand_name, workday_date),
    )
    templates = scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND is_template = 1", (brand_name,))
    tasks: list[dict] = []
    benchmark_snapshot = benchmark_update_tasks_snapshot(conn, brand_name, workday_date)
    benchmark_items = benchmark_snapshot.get("items") or []
    pending_benchmark = next((item for item in benchmark_items if item.get("status") == "pending"), None)
    in_progress_benchmark = next((item for item in benchmark_items if item.get("status") == "in_progress"), None)
    action_steps = [
        step for step in (collection_action_flow or {}).get("steps", [])
        if step.get("status") in {"fallback", "run", "blocked", "waiting"}
    ]
    for step in action_steps[:2]:
        tasks.append({
            "priority": "high" if step.get("status") in {"fallback", "blocked"} else "medium",
            "title": f"采集任务流：{step.get('title') or '处理数据源'}",
            "description": f"{step.get('reason') or '按任务流处理数据源'} 下一步：{step.get('action') or '去处理'}",
            "count": 1,
            "status": "collection_flow",
            "actionLabel": step.get("action") or "去处理",
            "href": step.get("href") or "./collection-center.html?v=collection-action-flow-v1",
        })
    source_blockers = [
        item for item in (data_source_matrix or {}).get("sources", [])
        if item.get("status") in {"fallback", "waiting"}
        and item.get("layer") in {"B", "B/C", "C", "D", "E"}
    ]
    for source in source_blockers[: max(0, 2 - len(tasks))]:
        source_status = source.get("status")
        tasks.append({
            "priority": "high" if source_status == "fallback" else "medium",
            "title": f"处理数据源：{source.get('title') or '未命名来源'}",
            "description": f"{source.get('evidence') or '暂无证据'} 下一步：{source.get('nextAction') or '去处理数据源'}",
            "count": 1,
            "status": "data_source",
            "actionLabel": source.get("nextAction") or "去处理",
            "href": source.get("href") or "./collection-center.html?v=data-source-tasks-v1",
        })
    if pending_benchmark:
        tasks.append({
            "priority": "high",
            "title": f"补固定对标账号：{pending_benchmark.get('accountName')}",
            "description": f"{pending_benchmark.get('statusReason') or '这个账号今天还没有近期素材。'} 点击后会直接定位到这张账号任务卡，并带入导入表单。",
            "count": 1,
            "status": "benchmark_update",
            "actionLabel": "导入这个账号",
            "href": pending_benchmark.get("importHref") or pending_benchmark.get("href") or "./content-pool.html?v=dynamic-tasks-v1#benchmark-update",
        })
    elif in_progress_benchmark:
        tasks.append({
            "priority": "high",
            "title": f"结构化对标账号：{in_progress_benchmark.get('accountName')}",
            "description": f"{in_progress_benchmark.get('statusReason') or '这个账号已有素材但缺结构摘要。'} 点击后会直接定位到这张账号任务卡。",
            "count": in_progress_benchmark.get("importedCount") or 1,
            "status": "benchmark_update",
            "actionLabel": "处理这个账号",
            "href": in_progress_benchmark.get("href") or "./content-pool.html?v=dynamic-tasks-v1#benchmark-update",
        })
    if failed_tasks:
        tasks.append({
            "priority": "high",
            "title": "处理采集失败任务",
            "description": f"{failed_tasks} 个采集任务失败，优先改用人工/第三方导入，避免内容生产卡住。",
            "count": failed_tasks,
            "status": "action_required",
            "actionLabel": "去采集任务",
            "href": "./collection-center.html?v=dynamic-tasks-v1",
        })
    if unstructured_selected:
        tasks.append({
            "priority": "high",
            "title": "结构化已选素材",
            "description": f"{unstructured_selected} 条已加入工作流的素材还没有结构摘要，会降低脚本质量。",
            "count": unstructured_selected,
            "status": "action_required",
            "actionLabel": "批量生成结构摘要",
            "href": "#manual-import",
        })
    if new_scripts:
        tasks.append({
            "priority": "high" if new_scripts > 10 else "medium",
            "title": "审核新脚本",
            "description": f"{new_scripts} 条脚本仍是新脚本状态，需要采用、待改或弃用。",
            "count": new_scripts,
            "status": "review",
            "actionLabel": "去脚本库审核",
            "href": "./script-library.html?v=dynamic-tasks-v1",
        })
    if needs_edit:
        tasks.append({
            "priority": "medium",
            "title": "处理待改脚本",
            "description": f"{needs_edit} 条脚本被标为待改，可以自动改写或人工复核。",
            "count": needs_edit,
            "status": "rewrite",
            "actionLabel": "去脚本库处理",
            "href": "./script-library.html?v=dynamic-tasks-v1",
        })
    if adopted_unpublished:
        tasks.append({
            "priority": "medium",
            "title": "回填已采用脚本的发布表现",
            "description": f"{adopted_unpublished} 条已采用脚本还没有发布链接或表现数据。",
            "count": adopted_unpublished,
            "status": "publish",
            "actionLabel": "回填表现",
            "href": "./script-library.html?v=dynamic-tasks-v1",
        })
    if templates < 3:
        tasks.append({
            "priority": "low",
            "title": "沉淀更多高表现模板",
            "description": f"当前只有 {templates} 条模板，建议至少沉淀 3 条用于稳定生成质量。",
            "count": templates,
            "status": "learning",
            "actionLabel": "查看复盘",
            "href": "./script-library.html?v=dynamic-tasks-v1",
        })
    if not tasks:
        tasks.append({
            "priority": "low",
            "title": "今日工作流健康",
            "description": "采集、结构化、审核和复盘暂无阻塞，可以继续生成新脚本。",
            "count": 0,
            "status": "ok",
            "actionLabel": "直接生成",
            "href": "#generationReadinessSection",
        })
    return tasks[:6]


def build_v2_module_board(
    stats: dict,
    history_stats: dict,
    current_workflow: dict,
    readiness: dict,
    review_insights: dict,
    collection_guarantee_hub: dict,
    release_readiness: dict,
    first_benchmark_material: dict | None = None,
    v2_execution_queue: dict | None = None,
) -> dict:
    release_by_id = {item.get("id"): item for item in release_readiness.get("releases") or []}
    first_benchmark_material = first_benchmark_material or {}
    queue_items = (v2_execution_queue or {}).get("items") or []
    modules = [
        {
            "id": "M1",
            "title": "今日工作台",
            "target": "每天先回答今天卡在哪、下一步点哪里、今日产出和历史资产如何区分。",
            "current": f"今日脚本 {stats.get('scripts') or 0} 条；待审核 {stats.get('newScripts') or 0} 条；今日素材 {stats.get('contentSources') or 0} 条。",
            "status": "ready" if (stats.get("scripts") or 0) > 0 else "in_progress",
            "maturity": release_by_id.get("R1", {}).get("percent", 0),
            "gap": "继续补齐运营端生成准备度和审核入口解释。" if not readiness.get("ready") else "扩大真实样本并保持今日/历史口径清晰。",
            "nextAction": "查看今日生产闭环",
            "href": "./v2.html?v=module-board-v1#v2WorkflowOverview",
            "metrics": [
                {"label": "今日脚本", "value": stats.get("scripts") or 0},
                {"label": "待审核", "value": stats.get("newScripts") or 0},
                {"label": "今日素材", "value": stats.get("contentSources") or 0},
            ],
        },
        {
            "id": "M2",
            "title": "热点池",
            "target": "从热榜词升级成品牌可用选题：热度、相关性、风险、可嫁接角度都可判断。",
            "current": f"历史热榜 {history_stats.get('hotItems') or 0} 条；今日确认热点 {current_workflow.get('hotCount') or 0} 条。",
            "status": "ready" if (history_stats.get("hotItems") or 0) > 0 else "blocked",
            "maturity": 65 if (history_stats.get("hotItems") or 0) > 0 else 20,
            "gap": "还需要小红书/第三方热点源和品牌相关性更细评分。",
            "nextAction": "查看热点池",
            "href": "./trend-pool.html?v=module-board-v1",
            "metrics": [
                {"label": "历史热榜", "value": history_stats.get("hotItems") or 0},
                {"label": "今日热点", "value": current_workflow.get("hotCount") or 0},
                {"label": "采用选题", "value": current_workflow.get("adoptedTopicCount") or 0},
            ],
        },
        {
            "id": "M3",
            "title": "对标内容池",
            "target": "固定账号和人工/第三方素材能入库、补字幕、结构化，并进入生成输入。",
            "current": f"今日运营素材 {stats.get('operationalContentSources') or 0} 条；已选 {stats.get('selectedContentSources') or 0} 条；结构 {stats.get('contentStructures') or 0} 条。",
            "status": "ready" if (stats.get("contentStructures") or 0) > 0 else "blocked",
            "maturity": release_by_id.get("R2", {}).get("percent", 0),
            "gap": "P0-1 仍需首条真实固定对标账号素材完整进入脚本输入。",
            "nextAction": release_by_id.get("R2", {}).get("nextAction") or "补真实对标素材",
            "href": release_by_id.get("R2", {}).get("nextHref") or "./content-pool.html?v=module-board-v1",
            "metrics": [
                {"label": "真实素材", "value": stats.get("operationalContentSources") or 0},
                {"label": "已选", "value": stats.get("selectedContentSources") or 0},
                {"label": "结构", "value": stats.get("contentStructures") or 0},
            ],
        },
        {
            "id": "M4",
            "title": "品牌商品",
            "target": "让生成器知道今天推什么、什么能说、什么不能说，避免空泛和违规表达。",
            "current": f"品牌商品 {history_stats.get('brandProducts') or 0} 条；已选商品活动 {stats.get('selectedBrandProducts') or 0} 条。",
            "status": "ready" if (stats.get("selectedBrandProducts") or 0) > 0 else "blocked",
            "maturity": 60 if (stats.get("selectedBrandProducts") or 0) > 0 else 25,
            "gap": "需要继续补活动权益、禁用表达、门店范围和发布前复核规则。",
            "nextAction": "维护品牌商品",
            "href": "./brand-center.html?v=module-board-v1",
            "metrics": [
                {"label": "商品", "value": history_stats.get("brandProducts") or 0},
                {"label": "已选", "value": stats.get("selectedBrandProducts") or 0},
                {"label": "R2", "value": release_by_id.get("R2", {}).get("percent", 0)},
            ],
        },
        {
            "id": "M5",
            "title": "脚本生成工作流",
            "target": "明确输入包、生成数量、质量评分、改写建议和可拍分镜。",
            "current": readiness.get("summary") or "等待生成准备度判断。",
            "status": "ready" if readiness.get("ready") else "blocked",
            "maturity": release_by_id.get("R1", {}).get("percent", 0),
            "gap": readiness.get("nextAction") or "补齐已选素材、结构摘要和商品活动。",
            "nextAction": "进入脚本生成",
            "href": readiness.get("generateUrl") or "./index.html?v=module-board-v1#stepGenerate",
            "metrics": [
                {"label": "准备度", "value": "OK" if readiness.get("ready") else "缺口"},
                {"label": "脚本", "value": stats.get("scripts") or 0},
                {"label": "结构", "value": stats.get("contentStructures") or 0},
            ],
        },
        {
            "id": "M6",
            "title": "脚本库复盘",
            "target": "区分生成、采用、待改、发布表现和高表现模板，让复盘反哺下一轮生成。",
            "current": f"历史脚本 {history_stats.get('scripts') or 0} 条；发布回填 {review_insights.get('publishedCount') or 0} 条；模板 {review_insights.get('templateCount') or 0} 条。",
            "status": "ready" if (review_insights.get("templateCount") or 0) > 0 else "in_progress",
            "maturity": release_by_id.get("R3", {}).get("percent", 0),
            "gap": release_by_id.get("R3", {}).get("nextAction") or "继续回填发布表现并标记模板。",
            "nextAction": "查看脚本库复盘",
            "href": "./script-library.html?v=module-board-v1",
            "metrics": [
                {"label": "历史脚本", "value": history_stats.get("scripts") or 0},
                {"label": "发布", "value": review_insights.get("publishedCount") or 0},
                {"label": "模板", "value": review_insights.get("templateCount") or 0},
            ],
        },
        {
            "id": "M7",
            "title": "采集任务中心",
            "target": "自动采集失败时能看到原因、切换路径、负责人和兜底闭环。",
            "current": collection_guarantee_hub.get("summary") or "等待采集保障判断。",
            "status": "ready" if collection_guarantee_hub.get("version") else "blocked",
            "maturity": release_by_id.get("R4", {}).get("percent", 0),
            "gap": release_by_id.get("R4", {}).get("nextAction") or "完善采集保障缺口。",
            "nextAction": "打开采集任务中心",
            "href": "./collection-center.html?v=module-board-v1",
            "metrics": [
                {"label": "就绪源", "value": (collection_guarantee_hub.get("counts") or {}).get("readySources") or 0},
                {"label": "兜底源", "value": (collection_guarantee_hub.get("counts") or {}).get("fallbackSources") or 0},
                {"label": "R4", "value": release_by_id.get("R4", {}).get("percent", 0)},
            ],
        },
    ]
    ready_count = len([item for item in modules if item["status"] == "ready"])
    primary = next((item for item in modules if item["status"] == "blocked"), modules[0])
    benchmark_steps = first_benchmark_material.get("steps") or []
    operator_guide = first_benchmark_material.get("operatorGuide") or {}
    primary_tasks = []
    if primary.get("title") == "对标内容池" and benchmark_steps:
        primary_tasks = [
            {
                "label": step.get("label") or "处理对标素材",
                "status": step.get("status") or "waiting",
                "statusLabel": step.get("statusLabel") or "",
                "evidence": step.get("evidence") or "",
                "action": step.get("action") or "去处理",
                "href": step.get("href") or primary.get("href") or "#",
            }
            for step in benchmark_steps
        ]
    elif primary.get("title") == "脚本生成工作流":
        for item in queue_items[:4]:
            primary_tasks.append({
                "label": item.get("title") or item.get("id") or "处理生成缺口",
                "status": item.get("status") or "waiting",
                "statusLabel": item.get("priority") or "",
                "evidence": item.get("evidence") or item.get("why") or "",
                "action": item.get("action") or "去处理",
                "href": item.get("href") or primary.get("href") or "#",
            })
    elif queue_items:
        for item in queue_items[:4]:
            primary_tasks.append({
                "label": item.get("title") or item.get("id") or "处理模块缺口",
                "status": item.get("status") or "waiting",
                "statusLabel": item.get("priority") or "",
                "evidence": item.get("evidence") or item.get("why") or "",
                "action": item.get("action") or "去处理",
                "href": item.get("href") or primary.get("href") or "#",
            })
    primary_package = {
        "version": "module_primary_package_v1",
        "moduleId": primary.get("id"),
        "moduleTitle": primary.get("title"),
        "headline": f"{primary.get('title') or '当前模块'}实施任务包",
        "summary": "把当前优先模块的缺口拆成可验收步骤；完成这些步骤后再回到发布计划和执行队列复核。",
        "acceptance": primary.get("gap") or "完成该模块的真实数据证据、入口和下一步闭环。",
        "nextAction": primary.get("nextAction") or "处理模块缺口",
        "href": primary.get("href") or "#",
        "tasks": primary_tasks,
        "requiredFields": operator_guide.get("requiredFields") or [],
        "doneDefinition": operator_guide.get("doneDefinition") or [],
        "blockedRules": first_benchmark_material.get("blockedRules") or [],
    }
    return {
        "version": "v2_module_board_v1",
        "headline": "V2 核心模块建设看板",
        "summary": f"{ready_count}/{len(modules)} 个模块已达到当前可用状态；每个模块都要有真实数据证据、入口和下一步。",
        "readyCount": ready_count,
        "totalCount": len(modules),
        "primary": primary,
        "primaryPackage": primary_package,
        "modules": modules,
        "rule": "模块成熟度按真实数据和 R1-R4 验收计算，不用静态路线图冒充完成。",
    }


def build_workflow_overview(
    stats: dict,
    workflow: dict,
    readiness: dict,
    collection_strategy: dict,
    topic_recommendations: list[dict],
    review_insights: dict,
) -> dict:
    adopted_topics = workflow.get("adoptedTopics") or []
    new_scripts = stats.get("scripts") or 0
    pending_review_count = stats.get("newScripts") or 0
    adopted_script_count = stats.get("adoptedScripts") or 0
    published_count = review_insights.get("publishedCount") or 0
    template_count = review_insights.get("templateCount") or 0
    collection_level = collection_strategy.get("level") or "needs_input"
    collection_ready = collection_level in {"healthy", "usable_with_fallback"}
    steps = [
        {
            "key": "collect",
            "label": "采集保障",
            "status": "ready" if collection_ready else "blocked",
            "statusLabel": "可生产" if collection_ready else "先补数据",
            "evidence": collection_strategy.get("summary") or "等待采集保障判断",
            "action": collection_strategy.get("nextAction") or "去采集任务中心处理数据源",
            "href": "./collection-center.html?v=workflow-overview-v1",
        },
        {
            "key": "topic",
            "label": "选择选题",
            "status": "ready" if adopted_topics else ("waiting" if topic_recommendations else "blocked"),
            "statusLabel": "已采用" if adopted_topics else ("可选择" if topic_recommendations else "缺候选"),
            "evidence": adopted_topics[0]["title"] if adopted_topics else f"{len(topic_recommendations)} 条推荐选题",
            "action": "去生成脚本" if adopted_topics else "从今日推荐选题中采用 1 条",
            "href": "./v2.html?v=workflow-overview-v1#v2Dashboard",
        },
        {
            "key": "input",
            "label": "确认输入",
            "status": "ready" if readiness.get("ready") else "blocked",
            "statusLabel": "已就绪" if readiness.get("ready") else "需补齐",
            "evidence": (
                f"{workflow.get('hotCount') or 0} 热点 + {workflow.get('benchmarkCount') or 0} 对标 + "
                f"{workflow.get('structuredManualSourceCount') or 0} 结构 + {workflow.get('selectedProductCount') or 0} 商品"
            ),
            "action": readiness.get("nextAction") or "补齐素材、结构或商品活动",
            "href": readiness.get("generateUrl") or "./index.html?v=workflow-overview-v1#stepGenerate",
        },
        {
            "key": "generate",
            "label": "生成脚本",
            "status": "ready" if new_scripts else ("waiting" if readiness.get("ready") else "blocked"),
            "statusLabel": "已有脚本" if new_scripts else ("可生成" if readiness.get("ready") else "未就绪"),
            "evidence": f"今日候选脚本 {new_scripts} 条",
            "action": "查看今日产出" if new_scripts else "生成 1-5 条候选脚本",
            "href": "./index.html?v=workflow-overview-v1#stepGenerate",
        },
        {
            "key": "review",
            "label": "审核采用",
            "status": "waiting" if pending_review_count else ("ready" if adopted_script_count else ("waiting" if new_scripts else "blocked")),
            "statusLabel": "待审核" if pending_review_count else ("已采用" if adopted_script_count else ("待筛选" if new_scripts else "待生成")),
            "evidence": f"待审核 {pending_review_count} 条 / 已采用 {adopted_script_count} 条 / 今日脚本 {new_scripts} 条",
            "action": "采用、待改或弃用候选脚本" if pending_review_count else "回填已采用脚本的发布表现",
            "href": "./script-library.html?v=workflow-overview-v1&status=new",
        },
        {
            "key": "review_loop",
            "label": "发布复盘",
            "status": "ready" if published_count or template_count else ("waiting" if new_scripts else "blocked"),
            "statusLabel": "已有复盘" if published_count or template_count else ("待回填" if new_scripts else "待脚本"),
            "evidence": f"已发布 {published_count} 条 / 优质模板 {template_count} 条",
            "action": "回填发布链接和表现，沉淀模板",
            "href": "./script-library.html?v=workflow-overview-v1",
        },
    ]
    blocked = [item for item in steps if item["status"] == "blocked"]
    waiting = [item for item in steps if item["status"] == "waiting"]
    if blocked:
        level = "blocked"
        summary = f"今日流程卡在「{blocked[0]['label']}」。"
        next_action = blocked[0]["action"]
        next_href = blocked[0]["href"]
    elif waiting:
        level = "in_progress"
        summary = f"今日流程进行到「{waiting[0]['label']}」。"
        next_action = waiting[0]["action"]
        next_href = waiting[0]["href"]
    else:
        level = "complete"
        summary = "今日内容生产闭环已跑通，可以继续复盘和扩量。"
        next_action = "查看脚本库复盘"
        next_href = "./script-library.html?v=workflow-overview-v1"
    return {
        "level": level,
        "summary": summary,
        "nextAction": next_action,
        "nextHref": next_href,
        "steps": steps,
        "rule": "首页先告诉运营今天卡在哪一步；每一步都必须能跳到可执行页面。",
    }


def build_real_data_loop_audit(
    stats: dict,
    workflow: dict,
    readiness: dict,
    data_source_matrix: dict,
    benchmark_update_snapshot: dict,
    review_insights: dict,
) -> dict:
    benchmark_tasks = benchmark_update_snapshot.get("items") or []
    benchmark_pending = benchmark_update_snapshot.get("pendingCount") or 0
    benchmark_imported = sum(item.get("importedCount") or 0 for item in benchmark_tasks)
    benchmark_structured = sum(item.get("structuredCount") or 0 for item in benchmark_tasks)
    selected_sources = stats.get("selectedContentSources") or 0
    structured_sources = stats.get("contentStructures") or 0
    selected_products = stats.get("selectedBrandProducts") or 0
    scripts = stats.get("scripts") or 0
    new_scripts = stats.get("newScripts") or 0
    adopted_scripts = stats.get("adoptedScripts") or 0
    published_count = review_insights.get("publishedCount") or 0
    template_count = review_insights.get("templateCount") or 0
    matrix_sources = data_source_matrix.get("sources") or []
    usable_sources = len([source for source in matrix_sources if source.get("status") in {"ready", "usable"}])

    def lane(
        key: str,
        title: str,
        status: str,
        evidence: str,
        target: str,
        action: str,
        href: str,
        owner: str = "运营",
    ) -> dict:
        return {
            "key": key,
            "title": title,
            "status": status,
            "statusLabel": real_data_loop_status_text(status),
            "evidence": evidence,
            "target": target,
            "action": action,
            "href": href,
            "owner": owner,
        }

    input_status = "ready" if usable_sources else "blocked"
    benchmark_status = "ready" if benchmark_structured else ("partial" if benchmark_imported or selected_sources else "blocked")
    generation_status = "ready" if readiness.get("ready") and scripts else ("partial" if readiness.get("ready") else "blocked")
    review_status = "ready" if adopted_scripts or published_count or template_count else ("partial" if scripts else "blocked")
    lanes = [
        lane(
            "data_sources",
            "真实数据来源",
            input_status,
            f"可用来源 {usable_sources} 个；数据源矩阵状态：{data_source_matrix.get('summary') or '待判断'}",
            "至少有公开热榜、人工/第三方素材或固定对标账号任一链路可生产。",
            data_source_matrix.get("nextAction") or "打开采集任务中心",
            "./collection-center.html?v=real-loop-audit-v1",
            "采集维护",
        ),
        lane(
            "benchmark_material",
            "对标素材增厚",
            benchmark_status,
            f"固定账号 {len(benchmark_tasks)} 个；待补 {benchmark_pending} 个；今日导入 {benchmark_imported} 条；结构化 {benchmark_structured} 条。",
            "每日至少有 1 个对标账号导入近期内容，并形成结构摘要。",
            "补固定对标账号近期内容" if benchmark_pending else "结构化已导入对标素材",
            (next((item.get("importHref") for item in benchmark_tasks if item.get("status") == "pending"), "") or
             next((item.get("href") for item in benchmark_tasks if item.get("importedCount") and not item.get("structuredCount")), "") or
             "./content-pool.html?v=real-loop-audit-v1#benchmark-update"),
        ),
        lane(
            "generation_inputs",
            "生成输入证据",
            "ready" if readiness.get("ready") else ("partial" if selected_sources or selected_products else "blocked"),
            (
                f"已确认热点 {workflow.get('hotCount') or 0} 条；对标 {workflow.get('benchmarkCount') or 0} 条；"
                f"结构 {structured_sources} 条；商品活动 {selected_products} 条。"
            ),
            "生成前必须能看到素材、结构、商品活动和模板证据，不能只用热词生成。",
            readiness.get("nextAction") or "补齐生成输入",
            readiness.get("generateUrl") or "./index.html?v=real-loop-audit-v1#stepGenerate",
        ),
        lane(
            "script_output",
            "脚本产出与审核",
            generation_status,
            f"今日脚本 {scripts} 条；待审核 {new_scripts} 条；已采用 {adopted_scripts} 条。",
            "生成后必须进入脚本列表，完成采用、待改或弃用筛选。",
            "审核新脚本" if new_scripts else ("生成候选脚本" if readiness.get("ready") else "先补生成输入"),
            "./script-library.html?v=real-loop-audit-v1&status=new" if new_scripts else "./index.html?v=real-loop-audit-v1#stepGenerate",
        ),
        lane(
            "learning_loop",
            "复盘学习回流",
            review_status,
            f"已发布 {published_count} 条；优质模板 {template_count} 条；复盘建议 {len(review_insights.get('nextSuggestions') or [])} 条。",
            "采用和发布表现要回流为模板、避坑信号和下一轮生成建议。",
            "回填发布表现或沉淀模板",
            "./script-library.html?v=real-loop-audit-v1",
            "内容负责人",
        ),
    ]
    blocked = [item for item in lanes if item["status"] == "blocked"]
    partial = [item for item in lanes if item["status"] == "partial"]
    if blocked:
        level = "blocked"
        summary = f"真实数据闭环未跑通，当前卡在「{blocked[0]['title']}」。"
        next_item = blocked[0]
    elif partial:
        level = "partial"
        summary = f"真实数据闭环部分可用，下一步补「{partial[0]['title']}」。"
        next_item = partial[0]
    else:
        level = "ready"
        summary = "真实数据闭环已跑通：有真实输入、结构证据、脚本产出和复盘回流。"
        next_item = lanes[-1]
    return {
        "version": "real_data_loop_audit_v1",
        "level": level,
        "levelLabel": real_data_loop_level_text(level),
        "summary": summary,
        "nextAction": next_item["action"],
        "nextHref": next_item["href"],
        "counts": {
            "ready": len([item for item in lanes if item["status"] == "ready"]),
            "partial": len(partial),
            "blocked": len(blocked),
            "total": len(lanes),
        },
        "lanes": lanes,
        "rule": "这不是功能清单，而是验证今天是否真正从真实数据走到脚本和复盘。",
    }


def build_single_material_loop(
    conn: sqlite3.Connection,
    brand_name: str,
    workday_date: str,
    benchmark_update_snapshot: dict,
) -> dict:
    rows = conn.execute(
        """
        SELECT cs.id, cs.workday_date, cs.brand_name, cs.platform, cs.source_type,
               cs.title, cs.url, cs.account_name, cs.raw_text, cs.note,
               cs.import_method, cs.status, cs.selected, cs.benchmark_update_task_id,
               cs.created_at, cs.updated_at,
               CASE WHEN cst.id IS NOT NULL THEN 1 ELSE 0 END AS has_structure
        FROM content_sources cs
        LEFT JOIN content_structures cst ON cst.source_id = cs.id
        WHERE cs.brand_name = ? AND cs.workday_date = ?
        ORDER BY has_structure DESC, cs.selected DESC, LENGTH(COALESCE(cs.raw_text, '')) DESC, cs.updated_at DESC, cs.id DESC
        LIMIT 30
        """,
        (brand_name, workday_date),
    ).fetchall()
    excluded_rows = []
    row = None
    for candidate in rows:
        exclusion_reason = content_source_exclusion_reason(candidate)
        if exclusion_reason:
            excluded_rows.append({"id": candidate["id"], "title": candidate["title"], "reason": exclusion_reason})
            continue
        row = candidate
        break
    pending_task = next((item for item in (benchmark_update_snapshot.get("items") or []) if item.get("status") == "pending"), None)
    fallback_href = (pending_task or {}).get("importHref") or "./content-pool.html?v=single-material-loop-v1#manual-import"
    acceptance = single_material_acceptance_plan(fallback_href)
    if not row:
        return {
            "version": "single_material_loop_v1",
            "level": "empty",
            "levelLabel": "缺少真实素材",
            "summary": "今天还没有可追踪的真实对标素材。先从固定对标账号导入 1 条真实视频/笔记，再跑字幕、结构和生成。",
            "nextAction": "导入 1 条真实对标素材",
            "nextHref": fallback_href,
            "source": None,
            "excludedCount": len(excluded_rows),
            "excludedSamples": excluded_rows[:5],
            "steps": single_material_empty_steps(fallback_href),
            "acceptance": acceptance,
            "rule": "只追踪真实运营素材；测试、验证、示例和 example.com 链接不会被算作跑通证据。",
        }
    source = attach_benchmark_task(
        conn,
        serialize_content_source(row, latest_content_structure(conn, row["id"]), latest_subtitle_job(conn, row["id"])),
    )
    has_url = bool(source.get("url"))
    has_text = bool(source.get("rawText"))
    selected = bool(source.get("selected"))
    structure = source.get("structure") or {}
    structured = structure.get("status") == "structure_done"
    subtitle_job = source.get("subtitleJob") or {}
    linked_script = latest_script_for_content_source(conn, brand_name, source["id"])
    content_href = f"./content-pool.html?v=single-material-loop-v1#content-source-{source['id']}"
    script_href = "./index.html?v=single-material-loop-v1#stepGenerate"
    script_library_href = (
        f"./script-library.html?v=single-material-loop-v1&scriptId={linked_script['id']}"
        if linked_script else script_href
    )
    steps = [
        {
            "key": "imported",
            "label": "已入库",
            "status": "done",
            "statusLabel": "已完成",
            "evidence": f"{source.get('title')} / {source.get('accountName') or '未知账号'}",
            "action": "查看素材",
            "href": content_href,
        },
        {
            "key": "text",
            "label": "字幕/正文",
            "status": "done" if has_text else ("waiting" if has_url else "blocked"),
            "statusLabel": "已具备" if has_text else ("可提取/补录" if has_url else "需补正文"),
            "evidence": f"文本 {len(source.get('rawText') or '')} 字；字幕任务：{subtitle_job.get('status') or '无'}",
            "action": "补字幕或正文" if not has_text else "查看文本",
            "href": content_href,
        },
        {
            "key": "selected",
            "label": "加入生成",
            "status": "done" if selected else "blocked",
            "statusLabel": "已加入" if selected else "未加入",
            "evidence": "这条素材会进入生成输入包。" if selected else "未加入时脚本生成不会读取这条素材。",
            "action": "加入生成工作流",
            "href": content_href,
        },
        {
            "key": "structured",
            "label": "结构摘要",
            "status": "done" if structured else ("waiting" if has_text else "blocked"),
            "statusLabel": "已结构化" if structured else ("可结构化" if has_text else "等字幕/正文"),
            "evidence": structure.get("statusNote") or structure.get("status") or "暂无结构摘要",
            "action": "生成结构摘要" if not structured else "查看结构摘要",
            "href": content_href,
        },
        {
            "key": "generation",
            "label": "候选脚本",
            "status": "done" if linked_script else ("waiting" if selected and structured else "blocked"),
            "statusLabel": "已生成" if linked_script else ("可生成" if selected and structured else "未就绪"),
            "evidence": (
                f"脚本 #{linked_script['id']}：{linked_script['title']}。"
                if linked_script
                else ("已具备结构摘要并加入生成输入，但还没有候选脚本读取这条素材。" if selected and structured else "必须先加入生成并完成结构摘要。")
            ),
            "action": "查看候选脚本" if linked_script else ("去生成候选脚本" if selected and structured else "先补齐素材处理"),
            "href": script_library_href if linked_script or (selected and structured) else content_href,
        },
    ]
    blocked = [item for item in steps if item["status"] == "blocked"]
    waiting = [item for item in steps if item["status"] == "waiting"]
    if blocked:
        level = "blocked"
        next_item = blocked[0]
    elif waiting:
        level = "partial"
        next_item = waiting[0]
    else:
        level = "ready"
        next_item = steps[-1]
    return {
        "version": "single_material_loop_v1",
        "level": level,
        "levelLabel": single_material_loop_level_text(level),
        "summary": f"正在追踪真实素材「{source.get('title')}」；下一步：{next_item['action']}。",
        "nextAction": next_item["action"],
        "nextHref": next_item["href"],
        "source": {
            "id": source["id"],
            "title": source["title"],
            "platform": source["platform"],
            "accountName": source.get("accountName") or "",
            "url": source.get("url") or "",
            "selected": selected,
            "hasText": has_text,
            "structured": structured,
            "benchmarkTask": source.get("benchmarkTask"),
            "linkedScript": linked_script,
            "updatedAt": source.get("updatedAt"),
        },
        "excludedCount": len(excluded_rows),
        "excludedSamples": excluded_rows[:5],
        "counts": {
            "done": len([item for item in steps if item["status"] == "done"]),
            "waiting": len(waiting),
            "blocked": len(blocked),
            "total": len(steps),
        },
        "steps": steps,
        "acceptance": acceptance,
        "rule": "这条链路只看一条真实运营素材是否能完整进入脚本生成输入；测试/验证素材不计入跑通证据。",
    }


def content_source_exclusion_reason(row: sqlite3.Row) -> str:
    text = " ".join(
        str(row[key] or "")
        for key in ["title", "url", "account_name", "note", "import_method", "source_type"]
        if key in row.keys()
    ).lower()
    if "example.com" in text or "/example" in text:
        return "示例链接"
    for keyword in ["测试", "验证", "示例", "待替换", "待填写", "模板行", "test", "demo", "placeholder", "replace-video", "fallback-test"]:
        if keyword.lower() in text:
            return f"命中非运营素材关键词：{keyword}"
    return ""


def content_source_payload_exclusion_reason(payload: dict) -> str:
    text = " ".join(
        str(payload.get(key) or "")
        for key in ["title", "url", "accountName", "account_name", "note", "importMethod", "import_method", "sourceType", "source_type"]
    ).lower()
    if "example.com" in text or "/example" in text:
        return "示例链接"
    for keyword in ["测试", "验证", "示例", "待替换", "待填写", "模板行", "test", "demo", "placeholder", "replace-video", "fallback-test"]:
        if keyword.lower() in text:
            return f"命中非运营素材关键词：{keyword}"
    return ""


CONTENT_SOURCE_OPERATIONAL_SQL = """
    lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
          coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%example.com%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%/example%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%测试%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%验证%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%示例%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%待替换%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%待填写%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%模板行%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%test%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%demo%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%placeholder%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%replace-video%'
    AND lower(coalesce(title, '') || ' ' || coalesce(url, '') || ' ' || coalesce(account_name, '') || ' ' ||
              coalesce(note, '') || ' ' || coalesce(import_method, '') || ' ' || coalesce(source_type, '')) NOT LIKE '%fallback-test%'
"""


def single_material_empty_steps(fallback_href: str) -> list[dict]:
    labels = ["导入素材", "字幕/正文", "加入生成", "结构摘要", "候选脚本"]
    return [
        {
            "key": f"empty_{index}",
            "label": label,
            "status": "blocked" if index == 0 else "waiting",
            "statusLabel": "先做这步" if index == 0 else "等待素材",
            "evidence": "暂无真实素材记录" if index == 0 else "导入真实素材后继续",
            "action": "导入 1 条真实对标素材" if index == 0 else "等待上一步",
            "href": fallback_href,
        }
        for index, label in enumerate(labels)
    ]


def single_material_acceptance_plan(fallback_href: str) -> dict:
    real_link_href = single_material_path_href(
        fallback_href,
        path="real_link",
        title="真实对标视频/笔记",
        platform="douyin",
        mode="single",
        account="固定对标账号",
        note="路径：真实链接优先。请填写真实作品链接；如果自动字幕失败，继续粘贴手工字幕。",
        anchor="manual-import",
    )
    manual_subtitle_href = single_material_path_href(
        fallback_href,
        path="manual_subtitle",
        title="手工字幕兜底素材",
        platform="manual",
        mode="single",
        account="运营手工补录",
        note="路径：手工字幕兜底。请粘贴旧字幕项目结果、视频口播文本或运营整理正文。",
        anchor="manual-import",
    )
    third_party_href = single_material_path_href(
        fallback_href,
        path="third_party_table",
        title="第三方表格兜底",
        platform="third_party",
        mode="batch",
        account="灰豚/蝉妈妈/飞瓜/新榜",
        note="路径：第三方表格兜底。请粘贴标题、链接、账号、平台、字幕/备注，先预检再导入。",
        anchor="batch-import",
    )
    return {
        "version": "single_material_acceptance_v1",
        "title": "首条真实素材跑通标准",
        "summary": "先用 1 条真实对标视频或笔记跑完整链路；数量可以少，但必须能证明系统读到了真实素材。",
        "minimumEvidence": [
            "真实作品链接，或可追溯的第三方/人工来源说明。",
            "字幕、正文或结构观察不少于 30 字，能拆出开头、节奏和 CTA。",
            "素材被加入生成工作流，并生成结构摘要。",
            "候选脚本的输入证据里能看到这条素材的 sourceId。",
        ],
        "fallbackPaths": [
            {
                "key": "real_link",
                "label": "真实链接优先",
                "description": "有抖音/小红书/公开视频链接时，先导入链接；自动字幕失败就粘贴手工字幕。",
                "action": "导入真实链接",
                "href": real_link_href,
            },
            {
                "key": "manual_subtitle",
                "label": "手工字幕兜底",
                "description": "没有稳定自动字幕时，直接粘贴旧字幕项目结果、视频口播文本或运营整理正文。",
                "action": "粘贴字幕/正文",
                "href": manual_subtitle_href,
            },
            {
                "key": "third_party_table",
                "label": "第三方表格兜底",
                "description": "从灰豚、蝉妈妈、飞瓜、新榜或飞书表格粘贴标题、链接、账号、字幕/备注，先预检再导入。",
                "action": "用表格导入",
                "href": third_party_href,
            },
        ],
        "blockedRules": [
            "example.com、测试、验证、示例、replace-video 等占位数据不计入验收。",
            "只有热点词、账号名或空链接，不算真实素材。",
            "只有脚本生成页面可打开，不算跑通；必须有候选脚本读取素材证据。",
        ],
    }


def single_material_path_href(
    fallback_href: str,
    path: str,
    title: str,
    platform: str,
    mode: str,
    account: str,
    note: str,
    anchor: str,
) -> str:
    parsed = urllib.parse.urlparse(fallback_href)
    query = dict(urllib.parse.parse_qsl(parsed.query))
    query.update({
        "v": "single-material-path-v1",
        "importPlatform": platform,
        "importMode": mode,
        "importPath": path,
        "importTitle": title,
        "importAccount": account,
        "importNote": note,
    })
    path_value = parsed.path or "./content-pool.html"
    return f"{path_value}?{urllib.parse.urlencode(query)}#{anchor}"


def add_query_params_to_href(href: str, params: dict, anchor: str | None = None) -> str:
    parsed = urllib.parse.urlparse(href or "")
    query = dict(urllib.parse.parse_qsl(parsed.query))
    for key, value in params.items():
        if value is not None and value != "":
            query[key] = str(value)
    path_value = parsed.path or "./content-pool.html"
    fragment = anchor if anchor is not None else parsed.fragment
    return f"{path_value}?{urllib.parse.urlencode(query)}{f'#{fragment}' if fragment else ''}"


def single_material_loop_level_text(level: str) -> str:
    return {
        "ready": "单条素材已生成脚本",
        "partial": "单条素材部分就绪",
        "blocked": "单条素材未就绪",
        "empty": "缺少真实素材",
    }.get(level, "待判断")


def first_benchmark_material_plan(benchmark_update_snapshot: dict, single_material_loop: dict) -> dict:
    tasks = benchmark_update_snapshot.get("items") or []
    target_task = next(
        (
            item for item in tasks
            if not (item.get("generationReadiness") or {}).get("ready")
               and item.get("status") != "skipped"
        ),
        tasks[0] if tasks else None,
    )
    acceptance = single_material_loop.get("acceptance") or single_material_acceptance_plan(
        "./content-pool.html?v=first-benchmark-material-plan-v1#manual-import"
    )
    if not target_task:
        return {
            "version": "first_benchmark_material_plan_v1",
            "level": "empty",
            "levelLabel": "缺固定对标账号",
            "headline": "先维护固定对标账号池",
            "summary": "当前没有固定对标账号任务，无法从账号维度跑通真实素材。",
            "targetAccount": None,
            "nextAction": "去维护对标账号池",
            "nextHref": "./content-pool.html?v=first-benchmark-material-plan-v1#benchmark-account-pool",
            "steps": [],
            "evidenceRequired": acceptance.get("minimumEvidence") or [],
            "fallbackPaths": acceptance.get("fallbackPaths") or [],
            "blockedRules": acceptance.get("blockedRules") or [],
            "rule": "这张卡只规划真实账号素材跑通，不创建模拟素材。",
        }
    readiness = target_task.get("generationReadiness") or {}
    counts = readiness.get("counts") or {}
    imported = int(counts.get("total") or target_task.get("importedCount") or 0)
    with_text = int(counts.get("withText") or 0)
    selected = int(counts.get("selected") or 0)
    structured = int(counts.get("structured") or target_task.get("structuredCount") or 0)
    ready = bool(readiness.get("ready"))
    import_href = target_task.get("importHref") or target_task.get("href") or "./content-pool.html?v=first-benchmark-material-plan-v1#manual-import"
    task_href = target_task.get("href") or import_href
    steps = [
        {
            "key": "import",
            "label": "补 1 条近期内容",
            "status": "done" if imported else "blocked",
            "statusLabel": "已导入" if imported else "先做这步",
            "evidence": f"今日已导入 {imported} 条；目标 {target_task.get('targetCount') or 3} 条。",
            "action": "导入这个账号近期内容" if not imported else "查看今日素材",
            "href": import_href if not imported else task_href,
        },
        {
            "key": "text",
            "label": "补字幕/正文",
            "status": "done" if with_text else ("blocked" if imported else "waiting"),
            "statusLabel": "有文本" if with_text else ("缺文本" if imported else "等待导入"),
            "evidence": f"有字幕/正文 {with_text} 条；可用手工字幕或旧字幕项目结果兜底。",
            "action": "补字幕或正文" if imported and not with_text else ("查看素材文本" if with_text else "等待上一步"),
            "href": task_href if imported else import_href,
        },
        {
            "key": "select",
            "label": "加入生成工作流",
            "status": "done" if selected else ("blocked" if with_text else "waiting"),
            "statusLabel": "已加入" if selected else ("未加入" if with_text else "等待文本"),
            "evidence": f"已加入生成 {selected} 条；未加入时脚本不会读取该账号素材。",
            "action": "加入生成工作流" if with_text and not selected else ("查看输入包" if selected else "等待上一步"),
            "href": task_href,
        },
        {
            "key": "structure",
            "label": "生成结构摘要",
            "status": "done" if structured else ("blocked" if selected else "waiting"),
            "statusLabel": "已结构化" if structured else ("缺结构" if selected else "等待加入"),
            "evidence": f"已结构化 {structured} 条；生成器只读取结构摘要，不直接读取账号名。",
            "action": "生成结构摘要" if selected and not structured else ("查看结构摘要" if structured else "等待上一步"),
            "href": task_href,
        },
        {
            "key": "generate",
            "label": "生成候选脚本",
            "status": "done" if ready else ("waiting" if structured else "blocked"),
            "statusLabel": "可生成" if ready else ("待生成" if structured else "未就绪"),
            "evidence": readiness.get("summary") or "先让至少 1 条素材同时具备文本、已加入和结构摘要。",
            "action": "去生成脚本" if ready else ("去生成候选脚本" if structured else "先补齐输入"),
            "href": "./index.html?v=first-benchmark-material-plan-v1#stepGenerate" if ready or structured else task_href,
        },
    ]
    blocked = [item for item in steps if item["status"] == "blocked"]
    waiting = [item for item in steps if item["status"] == "waiting"]
    if ready:
        level = "ready"
        next_item = steps[-1]
        summary = f"对标账号「{target_task.get('accountName')}」已有可生成输入，可以进入脚本流程。"
    elif blocked:
        level = "blocked"
        next_item = blocked[0]
        summary = f"对标账号「{target_task.get('accountName')}」还没跑通真实素材，当前卡在：{next_item['label']}。"
    else:
        level = "partial"
        next_item = waiting[0] if waiting else steps[-1]
        summary = f"对标账号「{target_task.get('accountName')}」已有部分进展，下一步：{next_item['action']}。"
    account_name = target_task.get("accountName") or "固定对标账号"
    fallback_paths = acceptance.get("fallbackPaths") or []
    primary_path = fallback_paths[0] if fallback_paths else {"label": "真实链接优先", "href": import_href, "action": "导入真实链接"}
    operator_guide = {
        "version": "p0_1_operator_guide_v1",
        "title": f"今天先补「{account_name}」1 条真实近期内容",
        "summary": "目标不是把账号池填满，而是让 1 条真实对标内容完成入库、文本、加入生成、结构摘要和脚本读取。",
        "currentBlocker": next_item["label"],
        "primaryAction": primary_path.get("action") or next_item["action"],
        "primaryHref": primary_path.get("href") or next_item["href"],
        "requiredFields": [
            {"label": "标题", "requirement": "真实作品标题或运营自己概括的内容主题，不能写示例。"},
            {"label": "链接", "requirement": "优先填真实作品链接；没有链接时必须补字幕/正文或第三方来源说明。"},
            {"label": "账号", "requirement": f"必须绑定到 {account_name}，避免导入后无法归因到固定对标账号任务。"},
            {"label": "字幕/正文", "requirement": "至少 30 字，能看出开头、镜头节奏、卖点和 CTA。"},
            {"label": "备注", "requirement": "说明为什么参考它：开头、商品露出、转场、评论区问题或成交动作。"},
        ],
        "runOrder": [
            {"label": "导入真实素材", "action": "在内容池粘贴链接、字幕或第三方表格行。", "href": import_href},
            {"label": "补字幕/正文", "action": "自动字幕不可用时，直接粘贴旧字幕项目或手工整理正文。", "href": task_href},
            {"label": "加入生成工作流", "action": "让脚本生成明确读取这条对标素材。", "href": task_href},
            {"label": "生成结构摘要", "action": "拆出开头、节奏、镜头、卖点和 CTA。", "href": task_href},
            {"label": "生成候选脚本", "action": "回到脚本流程，确认输入包后生成候选脚本。", "href": "./index.html?v=first-benchmark-material-plan-v1#stepGenerate"},
        ],
        "doneDefinition": [
            "content_sources 中有 1 条绑定该任务的真实素材。",
            "raw_text 或结构观察不少于 30 字。",
            "素材 selected = 1，并且 content_structures 有 structure_done。",
            "新候选脚本的输入证据能看到该素材 sourceId。",
        ],
    }
    return {
        "version": "first_benchmark_material_plan_v1",
        "level": level,
        "levelLabel": {
            "ready": "账号素材可生成",
            "partial": "账号素材部分就绪",
            "blocked": "账号素材未跑通",
        }.get(level, "待判断"),
        "headline": "首条真实账号素材跑通计划",
        "summary": summary,
        "targetAccount": {
            "taskId": target_task.get("id"),
            "accountName": target_task.get("accountName") or "",
            "platform": target_task.get("platform") or "",
            "accountHandle": target_task.get("accountHandle") or "",
            "category": target_task.get("category") or "",
            "whyTrack": target_task.get("whyTrack") or target_task.get("note") or "",
            "statusLabel": target_task.get("statusLabel") or "",
        },
        "readiness": readiness,
        "counts": {
            "imported": imported,
            "withText": with_text,
            "selected": selected,
            "structured": structured,
            "ready": int(readiness.get("readyCount") or 0),
            "target": int(readiness.get("targetCount") or 1),
        },
        "nextAction": next_item["action"],
        "nextHref": next_item["href"],
        "steps": steps,
        "evidenceRequired": acceptance.get("minimumEvidence") or [],
        "fallbackPaths": fallback_paths,
        "blockedRules": acceptance.get("blockedRules") or [],
        "operatorGuide": operator_guide,
        "rule": "只用固定对标账号的真实近期内容作为证据；账号名、热榜词或示例链接都不能算跑通。",
    }


def p01_acceptance_verifier(
    conn: sqlite3.Connection,
    brand_name: str,
    first_benchmark_material: dict,
) -> dict:
    target = first_benchmark_material.get("targetAccount") or {}
    task_id = target.get("taskId")
    account_name = target.get("accountName") or "固定对标账号"
    fallback_href = first_benchmark_material.get("nextHref") or "./content-pool.html?v=p01-verifier-v1#manual-import"
    verifier_return_params = {"returnTo": "p01_verifier", "benchmarkTaskId": task_id}
    fallback_href = add_query_params_to_href(fallback_href, verifier_return_params)
    if not task_id:
        checks = [
            {
                "key": "target_task",
                "label": "固定对标账号任务",
                "status": "blocked",
                "evidence": "当前没有可验收的固定对标账号任务。",
                "action": "先维护固定对标账号池",
                "href": "./content-pool.html?v=p01-verifier-v1#benchmark-account-pool",
            }
        ]
        return {
            "version": "p01_acceptance_verifier_v1",
            "level": "blocked",
            "levelLabel": "P0-1 未通过",
            "summary": "P0-1 还不能验收：缺少固定对标账号任务。",
            "targetAccount": target,
            "checks": checks,
            "nextAction": checks[0]["action"],
            "nextHref": checks[0]["href"],
            "rule": "验收器只读真实库表证据，不创建素材、不使用示例数据。",
        }

    rows = conn.execute(
        """
        SELECT cs.id, cs.workday_date, cs.brand_name, cs.platform, cs.source_type,
               cs.title, cs.url, cs.account_name, cs.raw_text, cs.note,
               cs.import_method, cs.status, cs.selected, cs.benchmark_update_task_id,
               cs.created_at, cs.updated_at,
               cst.id AS structure_id, cst.status AS structure_status,
               cst.structure_json, cst.error AS structure_error
        FROM content_sources cs
        LEFT JOIN content_structures cst ON cst.source_id = cs.id
        WHERE cs.brand_name = ? AND cs.benchmark_update_task_id = ?
        ORDER BY cs.selected DESC, cst.id DESC, LENGTH(COALESCE(cs.raw_text, '')) DESC, cs.updated_at DESC, cs.id DESC
        """,
        (brand_name, task_id),
    ).fetchall()
    excluded = []
    candidates = []
    for row in rows:
        reason = content_source_exclusion_reason(row)
        if reason:
            excluded.append({"sourceId": row["id"], "title": row["title"], "reason": reason})
            continue
        raw_text = row["raw_text"] or ""
        note = row["note"] or ""
        text_len = max(len(raw_text), len(note))
        structured = row["structure_status"] == "structure_done"
        linked_script = latest_script_for_content_source(conn, brand_name, row["id"])
        candidates.append({
            "row": row,
            "sourceId": row["id"],
            "title": row["title"],
            "accountName": row["account_name"] or "",
            "url": row["url"] or "",
            "rawTextLength": len(raw_text),
            "noteLength": len(note),
            "textLength": text_len,
            "selected": bool(row["selected"]),
            "structured": structured,
            "structureStatus": row["structure_status"] or "",
            "linkedScript": linked_script,
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        })

    imported_source = candidates[0] if candidates else None
    text_source = next((item for item in candidates if item["textLength"] >= 30), None)
    selected_source = next((item for item in candidates if item["selected"]), None)
    structured_source = next((item for item in candidates if item["structured"]), None)
    script_source = next((item for item in candidates if item["linkedScript"]), None)

    def source_href(source_id: int | None) -> str:
        if source_id:
            return add_query_params_to_href(
                "./content-pool.html?v=p01-verifier-v1",
                verifier_return_params,
                f"content-source-{source_id}",
            )
        return fallback_href

    def candidate_step(item: dict) -> dict:
        source_id = item.get("sourceId")
        if item.get("linkedScript"):
            linked = item.get("linkedScript") or {}
            return {
                "status": "passed",
                "label": "已被候选脚本读取",
                "action": "查看候选脚本",
                "href": f"./script-library.html?v=p01-candidate-detail-v1&scriptId={linked.get('id')}",
                "evidence": f"脚本 #{linked.get('id')} 已引用 sourceId #{source_id}。",
            }
        if item.get("structured"):
            return {
                "status": "ready",
                "label": "可生成脚本",
                "action": "去生成候选脚本",
                "href": "./index.html?v=p01-candidate-detail-v1#stepGenerate",
                "evidence": "已有 structure_done，但候选脚本还没有读取这条素材。",
            }
        if item.get("selected"):
            return {
                "status": "needs_structure",
                "label": "待结构化",
                "action": "生成结构摘要",
                "href": source_href(source_id),
                "evidence": "已加入生成工作流，但缺 structure_done。",
            }
        if item.get("textLength", 0) >= 30:
            return {
                "status": "needs_select",
                "label": "待加入生成",
                "action": "加入生成工作流",
                "href": source_href(source_id),
                "evidence": f"文本/备注最长 {item.get('textLength', 0)} 字，尚未 selected。",
            }
        return {
            "status": "needs_text",
            "label": "待补字幕/正文",
            "action": "补字幕/正文",
            "href": source_href(source_id),
            "evidence": f"文本/备注最长 {item.get('textLength', 0)} 字，未达到 30 字。",
        }

    candidate_details = []
    for item in candidates[:8]:
        step = candidate_step(item)
        candidate_details.append({
            "sourceId": item.get("sourceId"),
            "title": item.get("title") or "",
            "accountName": item.get("accountName") or account_name,
            "url": item.get("url") or "",
            "textLength": item.get("textLength") or 0,
            "selected": bool(item.get("selected")),
            "structured": bool(item.get("structured")),
            "structureStatus": item.get("structureStatus") or "",
            "linkedScript": item.get("linkedScript"),
            "createdAt": item.get("createdAt"),
            "updatedAt": item.get("updatedAt"),
            "nextStatus": step["status"],
            "nextLabel": step["label"],
            "nextAction": step["action"],
            "nextHref": step["href"],
            "nextEvidence": step["evidence"],
        })

    def check(
        key: str,
        label: str,
        passed: bool,
        waiting: bool,
        evidence: str,
        action: str,
        href: str,
        source: dict | None = None,
    ) -> dict:
        status = "passed" if passed else ("waiting" if waiting else "blocked")
        return {
            "key": key,
            "label": label,
            "status": status,
            "statusLabel": {"passed": "通过", "waiting": "等待", "blocked": "阻塞"}[status],
            "evidence": evidence,
            "action": action,
            "href": href,
            "sourceId": source.get("sourceId") if source else None,
            "sourceTitle": source.get("title") if source else "",
        }

    checks = [
        check(
            "real_source",
            "真实素材已入库",
            bool(imported_source),
            False,
            (
                f"已找到真实素材 #{imported_source['sourceId']}：{imported_source['title']}。"
                if imported_source else f"任务 #{task_id}（{account_name}）下还没有真实运营素材。"
            ),
            "查看素材" if imported_source else "导入这个账号近期内容",
            source_href(imported_source["sourceId"] if imported_source else None),
            imported_source,
        ),
        check(
            "text_evidence",
            "字幕/正文 >= 30 字",
            bool(text_source),
            bool(imported_source),
            (
                f"素材 #{text_source['sourceId']} 文本/备注最长 {text_source['textLength']} 字。"
                if text_source else (
                    f"已有真实素材，但字幕/正文/结构观察不足 30 字。"
                    if imported_source else "等待先导入真实素材。"
                )
            ),
            "查看文本" if text_source else ("补字幕/正文" if imported_source else "等待导入"),
            source_href((text_source or imported_source or {}).get("sourceId")),
            text_source or imported_source,
        ),
        check(
            "selected",
            "已加入生成工作流",
            bool(selected_source),
            bool(text_source),
            (
                f"素材 #{selected_source['sourceId']} selected = 1。"
                if selected_source else (
                    "已有文本素材，但还没加入生成工作流。"
                    if text_source else "等待字幕/正文达到 30 字。"
                )
            ),
            "查看输入包" if selected_source else ("加入生成工作流" if text_source else "等待文本"),
            source_href((selected_source or text_source or imported_source or {}).get("sourceId")),
            selected_source or text_source or imported_source,
        ),
        check(
            "structure_done",
            "结构摘要已完成",
            bool(structured_source),
            bool(selected_source),
            (
                f"素材 #{structured_source['sourceId']} content_structures.status = structure_done。"
                if structured_source else (
                    "素材已加入生成，但还没有 structure_done 结构摘要。"
                    if selected_source else "等待先加入生成工作流。"
                )
            ),
            "查看结构摘要" if structured_source else ("生成结构摘要" if selected_source else "等待加入生成"),
            source_href((structured_source or selected_source or text_source or imported_source or {}).get("sourceId")),
            structured_source or selected_source or text_source or imported_source,
        ),
        check(
            "candidate_script_reads_source",
            "候选脚本读取该素材",
            bool(script_source),
            bool(structured_source),
            (
                f"脚本 #{script_source['linkedScript']['id']} 已在 input_structure_json 引用素材 #{script_source['sourceId']}。"
                if script_source else (
                    "已有结构摘要，但还没有候选脚本的输入证据引用该素材 sourceId。"
                    if structured_source else "等待结构摘要完成。"
                )
            ),
            "查看候选脚本" if script_source else ("去生成候选脚本" if structured_source else "等待结构摘要"),
            (
                f"./script-library.html?v=p01-verifier-v1&scriptId={script_source['linkedScript']['id']}"
                if script_source else "./index.html?v=p01-verifier-v1#stepGenerate"
                if structured_source else source_href((structured_source or selected_source or text_source or imported_source or {}).get("sourceId"))
            ),
            script_source or structured_source or selected_source or text_source or imported_source,
        ),
    ]
    blocked = [item for item in checks if item["status"] == "blocked"]
    waiting = [item for item in checks if item["status"] == "waiting"]
    passed = [item for item in checks if item["status"] == "passed"]
    if blocked:
        level = "blocked"
        next_item = blocked[0]
    elif waiting:
        level = "waiting"
        next_item = waiting[0]
    else:
        level = "passed"
        next_item = checks[-1]
    return {
        "version": "p01_acceptance_verifier_v1",
        "level": level,
        "levelLabel": {
            "passed": "P0-1 已通过",
            "waiting": "P0-1 待最后动作",
            "blocked": "P0-1 未通过",
        }.get(level, "待判断"),
        "summary": (
            f"P0-1 已验收通过：固定账号「{account_name}」有真实素材、文本、结构摘要，并被候选脚本读取。"
            if level == "passed" else
            f"P0-1 尚未通过：固定账号「{account_name}」当前卡在「{next_item['label']}」。"
        ),
        "targetAccount": target,
        "counts": {
            "passed": len(passed),
            "waiting": len(waiting),
            "blocked": len(blocked),
            "total": len(checks),
            "candidateSources": len(candidates),
            "excluded": len(excluded),
        },
        "checks": checks,
        "candidateSourcesDetail": candidate_details,
        "nextAction": next_item["action"],
        "nextHref": next_item["href"],
        "excludedSamples": excluded[:5],
        "blockedRules": first_benchmark_material.get("blockedRules") or [],
        "rule": "P0-1 验收必须逐项看到库表证据；示例、测试、验证、占位素材不会计入。",
    }


def real_data_loop_status_text(status: str) -> str:
    return {
        "ready": "已跑通",
        "partial": "部分可用",
        "blocked": "未跑通",
    }.get(status, "待判断")


def real_data_loop_level_text(level: str) -> str:
    return {
        "ready": "真实闭环可用",
        "partial": "真实闭环部分可用",
        "blocked": "真实闭环未跑通",
    }.get(level, "待判断")


def release_item(label: str, ready: bool, evidence: str, action: str, href: str = "#") -> dict:
    return {
        "label": label,
        "ready": ready,
        "evidence": evidence,
        "action": action,
        "href": href,
    }


def build_release_readiness(
    stats: dict,
    history_stats: dict,
    workflow_overview: dict,
    readiness: dict,
    collection_strategy: dict,
    review_insights: dict,
    review_queue: list[dict],
) -> dict:
    collection_lanes = collection_strategy.get("lanes") or []
    fallback_lanes = [lane for lane in collection_lanes if lane.get("status") == "fallback"]
    ready_lanes = [lane for lane in collection_lanes if lane.get("status") == "ready"]
    workflow_steps = workflow_overview.get("steps") or []
    workflow_ready_steps = [step for step in workflow_steps if step.get("status") == "ready"]
    subtitle_service = diagnose_video_tools(timeout=2)
    subtitle_service_text = subtitle_service.get("statusLabel") or subtitle_service.get("status") or "待检测"
    benchmark_updates = stats.get("benchmarkUpdateTasks") or {}
    learning_signals = review_insights.get("learningSignals") or {}
    reuse_signal_count = len(learning_signals.get("reuseSignals") or [])
    avoid_signal_count = len(learning_signals.get("avoidSignals") or [])
    releases = [
        {
            "id": "R1",
            "title": "生产闭环版",
            "goal": "运营每天能从首页完成选题、生成、审核、入库和复盘。",
            "href": "./v2.html?v=release-readiness-v1#v2Dashboard",
            "checks": [
                release_item(
                    "今日生产闭环",
                    bool(workflow_steps),
                    f"{len(workflow_ready_steps)}/{len(workflow_steps)} 个步骤已就绪" if workflow_steps else "未返回闭环步骤",
                    "先让 dashboard 返回 workflowOverview",
                    "./v2.html?v=release-readiness-v1#v2WorkflowOverview",
                ),
                release_item(
                    "候选脚本生成",
                    (stats.get("scripts") or 0) > 0,
                    f"今日候选脚本 {stats.get('scripts') or 0} 条",
                    "生成 1-5 条候选脚本",
                    "./index.html?v=release-readiness-v1#stepGenerate",
                ),
                release_item(
                    "首页审核队列",
                    bool(review_queue) or (stats.get("newScripts") or 0) == 0 and (stats.get("scripts") or 0) > 0,
                    f"待审核 {stats.get('newScripts') or 0} 条 / 首页队列 {len(review_queue)} 条",
                    "在首页或脚本库处理待审核脚本",
                    "./script-library.html?v=release-readiness-v1&status=new",
                ),
                release_item(
                    "复盘入库",
                    (review_insights.get("publishedCount") or 0) > 0 or (review_insights.get("templateCount") or 0) > 0,
                    f"已发布 {review_insights.get('publishedCount') or 0} 条 / 模板 {review_insights.get('templateCount') or 0} 条",
                    "回填发布表现并沉淀模板",
                    "./script-library.html?v=release-readiness-v1",
                ),
            ],
        },
        {
            "id": "R2",
            "title": "输入增厚版",
            "goal": "让脚本生成读取真实素材、字幕结构和商品活动，减少空泛脚本。",
            "href": "./content-pool.html?v=release-readiness-v1",
            "checks": [
                release_item(
                    "对标内容池",
                    (stats.get("contentSources") or 0) > 0,
                    f"今日素材 {stats.get('contentSources') or 0} 条 / 已加入 {stats.get('selectedContentSources') or 0} 条",
                    "导入对标链接、字幕或第三方表格",
                    "./content-pool.html?v=release-readiness-v1",
                ),
                release_item(
                    "结构摘要",
                    (stats.get("contentStructures") or 0) > 0,
                    f"今日结构摘要 {stats.get('contentStructures') or 0} 条",
                    "对已导入素材生成结构摘要",
                    "./content-pool.html?v=release-readiness-v1",
                ),
                release_item(
                    "商品活动",
                    (stats.get("selectedBrandProducts") or 0) > 0,
                    f"已加入生成商品 {stats.get('selectedBrandProducts') or 0} 条",
                    "维护今天可说的商品活动",
                    "./brand-center.html?v=release-readiness-v1",
                ),
                release_item(
                    "生成准备度",
                    bool(readiness.get("ready")),
                    readiness.get("summary") or "等待生成准备度",
                    readiness.get("nextAction") or "补齐输入",
                    readiness.get("generateUrl") or "./index.html?v=release-readiness-v1#stepGenerate",
                ),
            ],
        },
        {
            "id": "R3",
            "title": "质量引擎版",
            "goal": "把脚本从能生成提升到稳定可拍、可复用、可改写。",
            "href": "./script-library.html?v=release-readiness-v1",
            "checks": [
                release_item(
                    "质量评分",
                    (stats.get("scripts") or 0) > 0,
                    f"今日脚本 {stats.get('scripts') or 0} 条，生成后写入质量分",
                    "继续生成带质量评分的候选脚本",
                    "./index.html?v=release-readiness-v1#stepGenerate",
                ),
                release_item(
                    "待改改写",
                    (history_stats.get("scripts") or 0) > 0,
                    f"历史脚本库 {history_stats.get('scripts') or 0} 条，可标记待改并改写",
                    "在脚本库标记待改或触发自动改写",
                    "./script-library.html?v=release-readiness-v1&status=needs_edit",
                ),
                release_item(
                    "模板复用",
                    (review_insights.get("templateCount") or 0) > 0,
                    f"高表现模板 {review_insights.get('templateCount') or 0} 条",
                    "把表现好的脚本标记为模板",
                    "./script-library.html?v=release-readiness-v1&status=template",
                ),
                release_item(
                    "分镜可读性",
                    (stats.get("scripts") or 0) > 0,
                    "脚本展开区已按时间、镜头、口播、字幕卡片展示",
                    "继续抽查长口播脚本的可读性",
                    "./index.html?v=shot-readable-v1#stepScripts",
                ),
            ],
        },
        {
            "id": "R4",
            "title": "采集保障版",
            "goal": "自动采集失败时，当天生产仍能通过兜底数据继续。",
            "href": "./collection-center.html?v=release-readiness-v1",
            "checks": [
                release_item(
                    "公开热榜",
                    bool(ready_lanes),
                    f"可用采集链路 {len(ready_lanes)} 条",
                    "运行或检查抖音公开热榜",
                    "./collection-center.html?v=release-readiness-v1",
                ),
                release_item(
                    "失败可见",
                    (stats.get("failedCollectionTasks") or 0) > 0,
                    f"今日失败任务 {stats.get('failedCollectionTasks') or 0} 条，需展示原因和产物",
                    "查看失败原因、截图和兜底动作",
                    "./collection-center.html?v=release-readiness-v1",
                ),
                release_item(
                    "兜底链路",
                    bool(fallback_lanes),
                    f"兜底链路 {len(fallback_lanes)} 条",
                    "用人工导入或第三方表格补数据",
                    "./content-pool.html?v=release-readiness-v1",
                ),
                release_item(
                    "每日采集计划",
                    bool(collection_lanes),
                    f"采集保障链路 {len(collection_lanes)} 条",
                    "维护每日计划、负责人和失败兜底",
                    "./collection-center.html?v=release-readiness-v1",
                ),
            ],
        },
    ]
    for release in releases:
        checks = release["checks"]
        ready_count = len([item for item in checks if item["ready"]])
        total = len(checks)
        percent = round((ready_count / total) * 100) if total else 0
        release["readyCount"] = ready_count
        release["totalCount"] = total
        release["percent"] = percent
        release["status"] = "ready" if percent == 100 else ("in_progress" if percent >= 50 else "needs_work")
        release["statusLabel"] = "可验收" if percent == 100 else ("推进中" if percent >= 50 else "缺口较多")
        release["gaps"] = [item for item in checks if not item["ready"]]
        release["nextAction"] = release["gaps"][0]["action"] if release["gaps"] else "进入下一版本或扩大真实数据量"
        release["nextHref"] = release["gaps"][0]["href"] if release["gaps"] else release["href"]
    return {
        "summary": "R1-R4 按真实数据计算验收状态；不是规划文字，也不是静态完成标签。",
        "maturitySummary": "当前全绿代表原型版可验收；距离目标系统还差自动字幕、对标内容持续更新、质量学习和第三方数据清洗。",
        "maturityGaps": [
            {
                "area": "真实字幕服务",
                "current": f"服务状态：{subtitle_service_text}；自动字幕任务 {stats.get('subtitleJobs') or 0} 个 / 成功 {stats.get('successfulSubtitleJobs') or 0} 个；当前仍需要手工字幕兜底。",
                "target": "视频链接可自动创建字幕任务，成功/失败都可追踪，字幕能稳定进入结构摘要。",
                "nextAction": subtitle_service.get("nextAction") or "启动 video-tools 后批量验证字幕任务成功率，并继续保留手工兜底。",
                "href": "./content-pool.html?v=maturity-gap-v1",
            },
            {
                "area": "对标账号内容更新",
                "current": f"固定对标账号 {history_stats.get('benchmarkAccounts') or 0} 个；今日待补 {benchmark_updates.get('pendingCount', 0)} 个账号，已完成 {benchmark_updates.get('doneCount', 0)} 个。",
                "target": "固定对标号池能定期导入近期内容、字幕、表现和结构，不只保存账号元数据。",
                "nextAction": "按对标账号更新任务补 1-3 条近期视频/笔记，再结构化入库。",
                "href": "./content-pool.html?v=maturity-gap-v1",
            },
            {
                "area": "质量反馈学习",
                "current": f"模板 {review_insights.get('templateCount') or 0} 条；复用信号 {reuse_signal_count} 条 / 避坑信号 {avoid_signal_count} 条。",
                "target": "采用、待改、弃用和发布表现能反向影响选题推荐、结构选择和脚本改写。",
                "nextAction": "审核时沉淀原因，下一轮生成优先复用正向结构、避开待改/弃用结构。",
                "href": "./script-library.html?v=maturity-gap-v1",
            },
            {
                "area": "第三方数据清洗",
                "current": f"兜底链路 {len(fallback_lanes)} 条；第三方表格已有导入入口但清洗规则仍粗。",
                "target": "灰豚、蝉妈妈、飞瓜、新榜表格能稳定识别字段、去重、标注平台和风险。",
                "nextAction": "沉淀第三方表格字段映射、预检规则和导入后批量处理标准。",
                "href": "./content-pool.html?v=maturity-gap-v1",
            },
        ],
        "releases": releases,
    }


def build_v2_acceptance_board(release_readiness: dict, v2_master_plan: dict) -> dict:
    releases = release_readiness.get("releases") or []
    total_checks = sum(int(release.get("totalCount") or 0) for release in releases)
    ready_checks = sum(int(release.get("readyCount") or 0) for release in releases)
    blocked_releases = [release for release in releases if release.get("status") != "ready"]
    percent = round((ready_checks / total_checks) * 100) if total_checks else 0
    if not releases:
        level = "empty"
        summary = "还没有 R1-R4 验收数据。"
    elif blocked_releases:
        level = "blocked"
        summary = f"大版本仍未可验收：{len(blocked_releases)} 个版本存在缺口，整体满足 {ready_checks}/{total_checks} 项。"
    else:
        level = "ready"
        summary = f"R1-R4 原型验收项已满足 {ready_checks}/{total_checks} 项，但仍需继续处理下一档成熟度缺口。"
    next_release = blocked_releases[0] if blocked_releases else (releases[0] if releases else {})
    rows = []
    for release in releases:
        gaps = release.get("gaps") or []
        checks = release.get("checks") or []
        rows.append({
            "id": release.get("id") or "",
            "title": release.get("title") or "",
            "status": release.get("status") or "needs_work",
            "statusLabel": release.get("statusLabel") or "",
            "percent": release.get("percent") or 0,
            "readyCount": release.get("readyCount") or 0,
            "totalCount": release.get("totalCount") or 0,
            "nextAction": release.get("nextAction") or "查看下一步",
            "nextHref": release.get("nextHref") or release.get("href") or "#",
            "readyLabels": [item.get("label") or "" for item in checks if item.get("ready")],
            "gapLabels": [item.get("label") or "" for item in gaps],
            "primaryGap": gaps[0] if gaps else {},
        })
    return {
        "version": "v2_acceptance_board_v1",
        "level": level,
        "headline": "V2 大版本验收总表",
        "summary": summary,
        "overallPercent": percent,
        "readyChecks": ready_checks,
        "totalChecks": total_checks,
        "blockedReleaseCount": len(blocked_releases),
        "nextAction": next_release.get("nextAction") or v2_master_plan.get("nextAction") or "处理下一项验收缺口",
        "nextHref": next_release.get("nextHref") or v2_master_plan.get("nextHref") or "#",
        "rows": rows,
        "gates": v2_master_plan.get("versionGates") or [],
        "maturityGaps": release_readiness.get("maturityGaps") or [],
    }


def build_v2_release_roadmap(
    release_readiness: dict,
    v2_acceptance_board: dict,
    v2_execution_queue: dict | None = None,
) -> dict:
    releases = release_readiness.get("releases") or []
    queue_items = (v2_execution_queue or {}).get("items") or []
    blocked_releases = [release for release in releases if release.get("status") != "ready"]
    ready_releases = [release for release in releases if release.get("status") == "ready"]
    dependency_map = {
        "R1": ["R2"],
        "R2": [],
        "R3": ["R1", "R2"],
        "R4": [],
    }
    release_targets = {
        "R1": "运营每天能完成选题、生成、审核、入库、复盘的生产闭环。",
        "R2": "生成器读取真实对标素材、结构摘要、商品活动和模板，不再只靠热词。",
        "R3": "候选脚本有质量评分、可改写、可复用，并能从发布表现中学习。",
        "R4": "自动采集失败时，系统能切人工/第三方/旧字幕项目，保证当天生产不中断。",
    }
    stage_order = ["R2", "R1", "R4", "R3"]
    release_by_id = {release.get("id"): release for release in releases}
    milestones = []
    for release_id in stage_order:
        release = release_by_id.get(release_id)
        if not release:
            continue
        gaps = release.get("gaps") or []
        dependencies = dependency_map.get(release_id, [])
        dependency_status = [
            {
                "id": dep_id,
                "title": (release_by_id.get(dep_id) or {}).get("title") or dep_id,
                "ready": (release_by_id.get(dep_id) or {}).get("status") == "ready",
                "percent": (release_by_id.get(dep_id) or {}).get("percent") or 0,
            }
            for dep_id in dependencies
        ]
        blockers = [
            {
                "label": gap.get("label") or "验收缺口",
                "evidence": gap.get("evidence") or "",
                "action": gap.get("action") or release.get("nextAction") or "处理缺口",
                "href": gap.get("href") or release.get("nextHref") or release.get("href") or "#",
            }
            for gap in gaps[:3]
        ]
        for dep in dependency_status:
            if dep["ready"]:
                continue
            blockers.append({
                "label": f"依赖 {dep['id']} 未完成",
                "evidence": f"{dep['title']} 当前 {dep['percent']}%",
                "action": f"先补 {dep['id']} 依赖",
                "href": (release_by_id.get(dep["id"]) or {}).get("nextHref") or "#",
            })
        milestones.append({
            "id": release_id,
            "title": release.get("title") or release_id,
            "target": release_targets.get(release_id) or release.get("goal") or "",
            "status": release.get("status") or "needs_work",
            "statusLabel": release.get("statusLabel") or "",
            "percent": release.get("percent") or 0,
            "readyCount": release.get("readyCount") or 0,
            "totalCount": release.get("totalCount") or 0,
            "dependencies": dependency_status,
            "blockers": blockers,
            "shipCriteria": [item.get("label") or "" for item in release.get("checks") or []],
            "nextAction": release.get("nextAction") or "查看下一步",
            "href": release.get("nextHref") or release.get("href") or "#",
        })
    primary = next((item for item in milestones if item["status"] != "ready"), milestones[0] if milestones else {})
    release_policy = [
        "R2 真实输入未跑通前，R1 不能宣称生产闭环完成。",
        "R1/R2 有真实证据后，再扩大 R3 质量学习样本。",
        "R4 不是最后再做，采集兜底必须和 R2 同步建设。",
        "所有版本发布都必须有可点击入口、真实数据证据和防示例数据污染规则。",
    ]
    return {
        "version": "v2_release_roadmap_v1",
        "headline": "V2 大版本发布计划",
        "summary": "把 R1-R4 从功能清单升级为可发布版本：每个版本都有依赖、发布门槛、阻塞证据和下一步入口。",
        "level": "blocked" if blocked_releases else "ready",
        "overallPercent": v2_acceptance_board.get("overallPercent") or 0,
        "readyReleaseCount": len(ready_releases),
        "totalReleaseCount": len(releases),
        "blockedReleaseCount": len(blocked_releases),
        "primary": primary,
        "milestones": milestones,
        "releasePolicy": release_policy,
        "executionLinks": queue_items[:4],
        "nextAction": primary.get("nextAction") or v2_acceptance_board.get("nextAction") or "处理下一版本缺口",
        "nextHref": primary.get("href") or v2_acceptance_board.get("nextHref") or "#",
    }


def build_v2_execution_queue(
    acceptance_board: dict,
    first_benchmark_material: dict,
    readiness: dict,
    real_data_loop_audit: dict,
    collection_guarantee_hub: dict,
    tasks: list[dict],
) -> dict:
    queue: list[dict] = []
    first_benchmark_material = first_benchmark_material or {}
    readiness = readiness or {}
    real_data_loop_audit = real_data_loop_audit or {}
    collection_guarantee_hub = collection_guarantee_hub or {}

    if first_benchmark_material.get("level") != "ready":
        queue.append({
            "id": "P0-1",
            "priority": "P0",
            "title": "先补首条真实账号素材",
            "why": first_benchmark_material.get("summary") or "固定对标账号还没有真实内容进入生成。",
            "action": first_benchmark_material.get("nextAction") or "导入真实账号素材",
            "href": first_benchmark_material.get("nextHref") or "./content-pool.html?v=execution-queue-v1",
            "unlocks": ["R2 对标内容池", "R2 结构摘要", "R1 候选脚本生成"],
            "owner": "运营",
            "status": first_benchmark_material.get("level") or "blocked",
            "evidence": f"目标账号：{(first_benchmark_material.get('targetAccount') or {}).get('accountName') or '固定对标账号'}；已导入 {(first_benchmark_material.get('counts') or {}).get('imported', 0)} 条，已结构化 {(first_benchmark_material.get('counts') or {}).get('structured', 0)} 条。",
        })

    missing_checks = [check for check in readiness.get("checks") or [] if not check.get("ready") and not check.get("optional")]
    if missing_checks:
        first_missing = missing_checks[0]
        queue.append({
            "id": "P0-2",
            "priority": "P0",
            "title": "补齐生成准备度",
            "why": readiness.get("summary") or "生成按钮前仍缺关键输入。",
            "action": readiness.get("nextAction") or first_missing.get("action") or "补齐生成输入",
            "href": readiness.get("generateUrl") or "./index.html?v=execution-queue-v1#stepGenerate",
            "unlocks": ["R2 生成准备度", "R1 候选脚本生成", "R3 质量评分"],
            "owner": "运营",
            "status": readiness.get("level") or "blocked",
            "evidence": " / ".join([f"{check.get('label')}：{check.get('value')}" for check in missing_checks[:3]]),
        })

    acceptance_rows = acceptance_board.get("rows") or []
    r1 = next((row for row in acceptance_rows if row.get("id") == "R1"), {})
    if r1.get("status") != "ready":
        queue.append({
            "id": "R1",
            "priority": "P1",
            "title": "生成并进入审核队列",
            "why": (r1.get("primaryGap") or {}).get("evidence") or "今日还没有候选脚本进入首页审核。",
            "action": r1.get("nextAction") or "生成候选脚本",
            "href": r1.get("nextHref") or "./index.html?v=execution-queue-v1#stepGenerate",
            "unlocks": ["R1 候选脚本生成", "R1 首页审核队列", "R3 质量评分"],
            "owner": "运营",
            "status": r1.get("status") or "in_progress",
            "evidence": f"{r1.get('readyCount', 0)}/{r1.get('totalCount', 0)} 项满足；缺口：{', '.join(r1.get('gapLabels') or [])}",
        })

    audit_lanes = real_data_loop_audit.get("lanes") or []
    blocked_audit = next((lane for lane in audit_lanes if lane.get("status") == "blocked"), {})
    if blocked_audit and blocked_audit.get("key") != "benchmark_material":
        queue.append({
            "id": "LOOP",
            "priority": "P1",
            "title": f"修复真实闭环：{blocked_audit.get('title')}",
            "why": blocked_audit.get("evidence") or real_data_loop_audit.get("summary") or "",
            "action": blocked_audit.get("action") or real_data_loop_audit.get("nextAction") or "处理闭环缺口",
            "href": blocked_audit.get("href") or real_data_loop_audit.get("nextHref") or "./v2.html?v=execution-queue-v1",
            "unlocks": ["真实数据闭环", "大版本验收证据"],
            "owner": blocked_audit.get("owner") or "运营",
            "status": blocked_audit.get("status") or "blocked",
            "evidence": blocked_audit.get("target") or "",
        })

    if collection_guarantee_hub.get("mode") == "fallback_now":
        queue.append({
            "id": "R4",
            "priority": "P1",
            "title": "采集失败时切兜底，不继续硬跑",
            "why": collection_guarantee_hub.get("summary") or "自动采集不是当天生产的单点依赖。",
            "action": collection_guarantee_hub.get("nextAction") or "切换人工或第三方导入",
            "href": collection_guarantee_hub.get("nextHref") or "./content-pool.html?v=execution-queue-v1#manual-import",
            "unlocks": ["R4 兜底链路", "R2 对标内容池"],
            "owner": "采集维护",
            "status": collection_guarantee_hub.get("mode") or "fallback",
            "evidence": (collection_guarantee_hub.get("activeFallback") or {}).get("evidence") or "",
        })

    seen: set[str] = set()
    deduped = []
    for item in queue:
        key = item["id"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    if not deduped:
        for task in tasks[:4]:
            deduped.append({
                "id": task.get("status") or "TASK",
                "priority": task.get("priority") or "P2",
                "title": task.get("title") or "处理今日任务",
                "why": task.get("description") or "",
                "action": task.get("actionLabel") or "去处理",
                "href": task.get("href") or "#",
                "unlocks": ["今日工作流"],
                "owner": "运营",
                "status": task.get("status") or "waiting",
                "evidence": f"数量：{task.get('count', 0)}",
            })

    return {
        "version": "v2_execution_queue_v1",
        "headline": "下一步执行队列",
        "summary": "按真实依赖排序：先补真实输入，再生成脚本，再审核复盘；避免直接点生成但被准备度阻塞。",
        "level": "blocked" if any(item.get("priority") == "P0" for item in deduped) else "actionable",
        "primary": deduped[0] if deduped else {},
        "items": deduped[:5],
        "rule": "执行队列优先看真实输入依赖，不按页面顺序或表层验收缺口机械排序。",
    }


def product_vision_stage(id: str, title: str, status: str, evidence: str, target: str, action: str, href: str) -> dict:
    status_labels = {
        "current": "当前阶段",
        "building": "正在建设",
        "next": "下一阶段",
        "future": "目标阶段",
    }
    return {
        "id": id,
        "title": title,
        "status": status,
        "statusLabel": status_labels.get(status, "待规划"),
        "evidence": evidence,
        "target": target,
        "action": action,
        "href": href,
    }


def build_product_vision_map(
    stats: dict,
    history_stats: dict,
    workflow_overview: dict,
    readiness: dict,
    collection_strategy: dict,
    review_insights: dict,
    release_readiness: dict,
) -> dict:
    releases = release_readiness.get("releases") or []
    release_percent = {item.get("id"): item.get("percent", 0) for item in releases}
    release_status = {item.get("id"): item.get("statusLabel", "待判断") for item in releases}
    maturity_gaps = release_readiness.get("maturityGaps") or []
    blocked_steps = [step for step in (workflow_overview.get("steps") or []) if step.get("status") == "blocked"]
    waiting_steps = [step for step in (workflow_overview.get("steps") or []) if step.get("status") == "waiting"]
    collection_level = collection_strategy.get("level") or "needs_input"
    input_thickness = (
        (stats.get("selectedContentSources") or 0)
        + (stats.get("contentStructures") or 0)
        + (stats.get("selectedBrandProducts") or 0)
        + (stats.get("scripts") or 0)
    )
    if (stats.get("scripts") or 0) and (stats.get("contentStructures") or 0) and readiness.get("ready"):
        current_level = "MVP+"
        current_summary = "当前已从静态原型进入真实数据驱动的小闭环，但还没有达到目标系统。"
    elif input_thickness:
        current_level = "MVP"
        current_summary = "当前能用真实数据跑局部流程，但输入厚度、质量学习和采集保障还不稳定。"
    else:
        current_level = "Prototype"
        current_summary = "当前主要是原型展示，需要先把真实数据输入和生成闭环补起来。"
    next_gap = maturity_gaps[0] if maturity_gaps else {}
    next_action = (
        next_gap.get("nextAction")
        or (blocked_steps[0]["action"] if blocked_steps else "")
        or (waiting_steps[0]["action"] if waiting_steps else "")
        or "继续按 R1-R4 扩大真实数据量和运营复盘量。"
    )
    stages = [
        product_vision_stage(
            "M0",
            "当前 MVP 小版本",
            "current",
            f"今日脚本 {stats.get('scripts') or 0} 条；今日结构 {stats.get('contentStructures') or 0} 条；采集状态 {collection_level}。",
            "证明真实数据能进入选题、生成、审核和复盘，但不追求规模化。",
            "不要继续堆单页功能，先把首页目标地图和闭环边界说清楚。",
            "./v2.html?v=product-vision-map-v1#v2ProductBlueprint",
        ),
        product_vision_stage(
            "R1-R2",
            "真实输入闭环版",
            "building",
            f"R1 {release_percent.get('R1', 0)}% / R2 {release_percent.get('R2', 0)}%；生成准备：{readiness.get('summary') or '待判断'}。",
            "运营每天能从真实热点、对标结构、品牌商品中选题并生成可拍脚本。",
            readiness.get("nextAction") or "补齐已选素材、结构摘要和商品活动。",
            readiness.get("generateUrl") or "./index.html?v=product-vision-map-v1#stepGenerate",
        ),
        product_vision_stage(
            "R3",
            "质量学习版",
            "next",
            f"模板 {review_insights.get('templateCount') or 0} 条；已发布 {review_insights.get('publishedCount') or 0} 条；R3 {release_status.get('R3', '待判断')}。",
            "系统能识别低质量脚本、自动改写，并从采用/弃用/发布表现中学习。",
            "把审核原因和发布表现回填到脚本库，扩大模板与避坑信号。",
            "./script-library.html?v=product-vision-map-v1",
        ),
        product_vision_stage(
            "R4+",
            "采集保障和数据运营版",
            "future",
            f"公开/登录态/人工/第三方链路：{collection_strategy.get('summary') or '待判断'}。",
            "自动采集失败时，仍能通过登录态小批量、人工导入和第三方表格完成当天生产。",
            collection_strategy.get("nextAction") or "完善采集计划、失败截图和第三方表格清洗规则。",
            "./collection-center.html?v=product-vision-map-v1",
        ),
    ]
    target_metrics = [
        {
            "label": "每日候选脚本库",
            "current": f"今日 {stats.get('scripts') or 0} 条 / 历史 {history_stats.get('scripts') or 0} 条",
            "target": "每天稳定输出 N 条可拍脚本，全部有来源证据、分镜、质量分和审核状态。",
        },
        {
            "label": "真实输入厚度",
            "current": f"今日素材 {stats.get('contentSources') or 0} 条 / 结构 {stats.get('contentStructures') or 0} 条 / 商品 {stats.get('selectedBrandProducts') or 0} 条",
            "target": "热点、对标内容、字幕结构、商品活动、复盘模板都能被生成器读取。",
        },
        {
            "label": "采集不中断",
            "current": collection_strategy.get("summary") or "等待采集策略判断",
            "target": "公开热榜、登录态小批量、人工导入、第三方表格四层可切换。",
        },
        {
            "label": "质量学习闭环",
            "current": f"模板 {review_insights.get('templateCount') or 0} 条 / 发布回填 {review_insights.get('publishedCount') or 0} 条",
            "target": "采用、待改、弃用和发布表现能反向影响推荐、结构选择和改写。",
        },
    ]
    roles = [
        {
            "role": "运营",
            "today": "选择热点或对标素材，确认品牌商品，生成并审核脚本。",
            "targetExperience": "每天只需要处理少量明确按钮：采用选题、生成脚本、审核脚本、回填发布。",
            "entry": "./v2.html?v=product-vision-map-v1#v2Dashboard",
        },
        {
            "role": "内容负责人",
            "today": "看今日流程卡点、脚本质量和可复用模板。",
            "targetExperience": "不用翻单条记录，直接看产出质量、风险和下一轮优化方向。",
            "entry": "./script-library.html?v=product-vision-map-v1",
        },
        {
            "role": "采集维护",
            "today": "处理登录态、失败任务、人工和第三方兜底。",
            "targetExperience": "采集失败有原因、截图、兜底动作和负责人，不再靠临时排查。",
            "entry": "./collection-center.html?v=product-vision-map-v1",
        },
        {
            "role": "品牌负责人",
            "today": "维护商品活动、权益限制和禁用表达。",
            "targetExperience": "脚本默认读取今天可说内容，降低夸大优惠和违规表达风险。",
            "entry": "./brand-center.html?v=product-vision-map-v1",
        },
    ]
    data_strategy = [
        {
            "lane": "A",
            "name": "公开热榜主干",
            "current": f"历史热榜 {history_stats.get('hotItems') or 0} 条",
            "role": "每天给系统一个稳定选题底盘。",
            "fallback": "失败时切人工热点或第三方热点 CSV。",
        },
        {
            "lane": "B",
            "name": "登录态小批量",
            "current": "每次 3 个词以内，遇验证码暂停。",
            "role": "补类目词搜索和对标账号近期内容。",
            "fallback": "保留失败截图，转人工导入链接或字幕。",
        },
        {
            "lane": "C",
            "name": "人工导入",
            "current": f"历史素材 {history_stats.get('contentSources') or 0} 条",
            "role": "保证当天生产不中断。",
            "fallback": "支持链接、字幕、正文和批量文本。",
        },
        {
            "lane": "D",
            "name": "第三方表格",
            "current": "已有导入入口，字段清洗仍需增强。",
            "role": "把灰豚、蝉妈妈、飞瓜、新榜等表格变成结构输入。",
            "fallback": "先做字段映射和预检，不急着深接 API。",
        },
    ]
    return {
        "version": "product_vision_map_v1",
        "headline": "目标不是一个脚本生成页，而是每日内容生产系统。",
        "currentLevel": current_level,
        "currentSummary": current_summary,
        "finalTarget": "每天从真实热点、对标内容、品牌商品和历史复盘中，自动组织输入，输出 N 条可拍候选脚本，并把采用、发布和表现回流到下一轮生成。",
        "notDoneYet": "当前最多算 MVP 小版本；R1-R4 可验收也只代表原型大版本跑通，不代表目标系统完成。",
        "nextAction": next_action,
        "stages": stages,
        "targetMetrics": target_metrics,
        "roles": roles,
        "dataStrategy": data_strategy,
        "maturityGaps": maturity_gaps,
    }


def build_development_board(
    release_readiness: dict,
    product_vision_map: dict,
    workflow_overview: dict,
    collection_fallback_desk: dict,
    first_benchmark_material: dict | None = None,
) -> dict:
    releases = release_readiness.get("releases") or []
    maturity_gaps = release_readiness.get("maturityGaps") or []
    stages = product_vision_map.get("stages") or []
    current_stage = next((stage for stage in stages if stage.get("status") == "current"), stages[0] if stages else {})
    next_release = next((release for release in releases if release.get("status") != "ready"), {})
    active_workflow_step = next(
        (step for step in (workflow_overview.get("steps") or []) if step.get("status") in {"blocked", "waiting"}),
        {},
    )
    primary_fallback = collection_fallback_desk.get("primary") or {}

    release_cards = []
    for release in releases:
        gaps = release.get("gaps") or []
        release_cards.append({
            "id": release.get("id") or "",
            "title": release.get("title") or "",
            "status": release.get("status") or "needs_work",
            "statusLabel": release.get("statusLabel") or "",
            "percent": release.get("percent") or 0,
            "readyCount": release.get("readyCount") or 0,
            "totalCount": release.get("totalCount") or 0,
            "nextAction": release.get("nextAction") or "查看下一步",
            "nextHref": release.get("nextHref") or release.get("href") or "#",
            "blockingGap": gaps[0]["label"] if gaps else "暂无阻塞缺口",
            "evidence": gaps[0]["evidence"] if gaps else "该版本当前验收项已满足",
        })

    focus_items = []
    if active_workflow_step:
        focus_items.append({
            "area": "今日生产闭环",
            "priority": "P0",
            "current": active_workflow_step.get("evidence") or workflow_overview.get("summary") or "",
            "target": "运营能从首页直接完成下一步，不需要猜流程关系。",
            "nextAction": active_workflow_step.get("action") or workflow_overview.get("nextAction") or "处理今日流程卡点",
            "href": active_workflow_step.get("href") or workflow_overview.get("nextHref") or "./v2.html?v=development-board-v1",
        })
    if primary_fallback:
        focus_items.append({
            "area": "采集失败兜底",
            "priority": "P0",
            "current": primary_fallback.get("evidence") or collection_fallback_desk.get("summary") or "",
            "target": "自动采集失败时，运营有集中入口切人工、第三方或结构化。",
            "nextAction": primary_fallback.get("action") or "执行兜底动作",
            "href": primary_fallback.get("href") or "./collection-center.html?v=development-board-v1",
        })
    for gap in maturity_gaps[:4]:
        focus_items.append({
            "area": gap.get("area") or "成熟度缺口",
            "priority": "P1",
            "current": gap.get("current") or "",
            "target": gap.get("target") or "",
            "nextAction": gap.get("nextAction") or "处理缺口",
            "href": gap.get("href") or "./v2.html?v=development-board-v1",
        })

    release_by_id = {item.get("id"): item for item in release_cards}
    first_benchmark_material = first_benchmark_material or {}
    benchmark_steps = first_benchmark_material.get("steps") or []
    benchmark_ready = first_benchmark_material.get("level") == "ready"
    benchmark_blocked = first_benchmark_material.get("level") in {"blocked", "empty"}
    benchmark_target = (first_benchmark_material.get("targetAccount") or {}).get("accountName") or "固定对标账号"
    implementation_packages = [
        {
            "id": "P0-1",
            "title": "首条真实账号素材闭环",
            "status": "ready" if benchmark_ready else ("blocked" if benchmark_blocked else "in_progress"),
            "statusLabel": "可进入生成" if benchmark_ready else ("先补真实素材" if benchmark_blocked else "处理中"),
            "owner": "运营 + 采集维护",
            "scope": f"用「{benchmark_target}」跑通 1 条真实近期内容，不追求数量，先证明账号内容能进入生成。",
            "acceptance": "至少 1 条素材具备真实来源、字幕/正文、已加入生成、结构摘要，并能被候选脚本输入证据引用。",
            "nextAction": first_benchmark_material.get("nextAction") or "导入这个账号近期内容",
            "href": first_benchmark_material.get("nextHref") or "./content-pool.html?v=implementation-plan-v1",
            "evidence": first_benchmark_material.get("summary") or "等待首条账号素材计划。",
            "tasks": [
                {
                    "label": step.get("label") or "未命名步骤",
                    "status": step.get("status") or "blocked",
                    "statusLabel": step.get("statusLabel") or "",
                    "href": step.get("href") or first_benchmark_material.get("nextHref") or "#",
                }
                for step in benchmark_steps
            ],
        },
        {
            "id": "P0-2",
            "title": "输入增厚与生成准备度",
            "status": release_by_id.get("R2", {}).get("status") or "needs_work",
            "statusLabel": release_by_id.get("R2", {}).get("statusLabel") or "待判断",
            "owner": "运营 + 品牌负责人",
            "scope": "把热点、结构素材、商品活动和模板变成生成器真正读取的输入包。",
            "acceptance": "脚本生成前能清楚看到读取哪些结构素材、商品活动、采用选题和复盘模板。",
            "nextAction": release_by_id.get("R2", {}).get("nextAction") or "补齐结构素材和商品活动",
            "href": release_by_id.get("R2", {}).get("nextHref") or "./index.html?v=implementation-plan-v1#stepGenerate",
            "evidence": release_by_id.get("R2", {}).get("evidence") or "等待 R2 输入增厚验收。",
            "tasks": [
                {"label": "导入真实素材", "status": "done" if benchmark_ready else "blocked", "statusLabel": "由 P0-1 驱动", "href": first_benchmark_material.get("nextHref") or "#"},
                {"label": "维护商品活动", "status": "waiting", "statusLabel": "看品牌商品中心", "href": "./brand-center.html?v=implementation-plan-v1"},
                {"label": "确认输入包", "status": "waiting", "statusLabel": "看脚本流程", "href": "./index.html?v=implementation-plan-v1#stepGenerate"},
            ],
        },
        {
            "id": "P1-1",
            "title": "脚本质量与复盘学习",
            "status": release_by_id.get("R3", {}).get("status") or "needs_work",
            "statusLabel": release_by_id.get("R3", {}).get("statusLabel") or "待判断",
            "owner": "内容负责人",
            "scope": "把候选脚本从“能生成”提升到“可拍、可审、可改写、可复用”。",
            "acceptance": "脚本有分镜、口播、字幕、质量诊断、审核原因、发布表现和模板沉淀。",
            "nextAction": release_by_id.get("R3", {}).get("nextAction") or "回填审核原因和发布表现",
            "href": release_by_id.get("R3", {}).get("nextHref") or "./script-library.html?v=implementation-plan-v1",
            "evidence": release_by_id.get("R3", {}).get("evidence") or "等待 R3 质量引擎验收。",
            "tasks": [
                {"label": "审核原因覆盖", "status": "waiting", "statusLabel": "脚本库处理", "href": "./script-library.html?v=implementation-plan-v1"},
                {"label": "低分改写入口", "status": "waiting", "statusLabel": "质量诊断后触发", "href": "./script-library.html?v=implementation-plan-v1&status=needs_edit"},
                {"label": "模板沉淀", "status": "waiting", "statusLabel": "发布表现回填", "href": "./script-library.html?v=implementation-plan-v1&status=template"},
            ],
        },
        {
            "id": "P1-2",
            "title": "采集保障和替代数据链路",
            "status": release_by_id.get("R4", {}).get("status") or "needs_work",
            "statusLabel": release_by_id.get("R4", {}).get("statusLabel") or "待判断",
            "owner": "采集维护",
            "scope": "把公开热榜、登录态小批量、人工导入、第三方表格做成可切换的生产保障。",
            "acceptance": "自动采集失败时，页面显示原因、产物、下一条兜底路径和对应导入入口。",
            "nextAction": release_by_id.get("R4", {}).get("nextAction") or "处理采集保障缺口",
            "href": release_by_id.get("R4", {}).get("nextHref") or "./collection-center.html?v=implementation-plan-v1",
            "evidence": release_by_id.get("R4", {}).get("evidence") or "等待 R4 采集保障验收。",
            "tasks": [
                {"label": "公开热榜状态", "status": "waiting", "statusLabel": "采集中心", "href": "./collection-center.html?v=implementation-plan-v1"},
                {"label": "登录态失败可见", "status": "waiting", "statusLabel": "截图/原因", "href": "./collection-center.html?v=implementation-plan-v1"},
                {"label": "第三方表格预检", "status": "waiting", "statusLabel": "内容池", "href": "./content-pool.html?v=implementation-plan-v1#batch-import"},
            ],
        },
    ]
    current_package = next(
        (item for item in implementation_packages if item.get("status") != "ready"),
        implementation_packages[0] if implementation_packages else {},
    )

    return {
        "version": "development_board_v1",
        "headline": "下一大版本开发看板",
        "summary": "把目标系统、当前 MVP 状态、R1-R4 验收和下一档成熟度缺口合成可执行开发顺序。",
        "currentStage": {
            "id": current_stage.get("id") or product_vision_map.get("currentLevel") or "MVP",
            "title": current_stage.get("title") or "当前 MVP 小版本",
            "evidence": current_stage.get("evidence") or product_vision_map.get("currentSummary") or "",
        },
        "nextRelease": {
            "id": next_release.get("id") or "NEXT",
            "title": next_release.get("title") or (maturity_gaps[0].get("area") if maturity_gaps else "扩大真实数据量"),
            "percent": next_release.get("percent") if next_release else 0,
            "nextAction": next_release.get("nextAction") or (maturity_gaps[0].get("nextAction") if maturity_gaps else "") or product_vision_map.get("nextAction") or "继续补齐大版本缺口",
            "href": next_release.get("nextHref") or next_release.get("href") or (maturity_gaps[0].get("href") if maturity_gaps else "") or "./v2.html?v=development-board-v1",
        },
        "releaseCards": release_cards,
        "focusItems": focus_items[:6],
        "implementationPlan": {
            "version": "implementation_plan_v1",
            "headline": "大版本实施计划：先跑通真实账号素材，再扩大自动化",
            "summary": "这不是静态 roadmap，而是按当前真实数据生成的研发任务包。当前优先把 1 个固定对标账号的真实内容跑进脚本生成。",
            "cadence": "建议按 4 个两周包推进：P0-1 真实账号素材闭环，P0-2 输入增厚，P1-1 质量学习，P1-2 采集保障。",
            "currentPackage": current_package,
            "packages": implementation_packages,
            "gates": [
                "没有真实素材证据，不允许把 R2 输入增厚标成完成。",
                "自动采集失败必须有人工或第三方兜底入口。",
                "生成脚本必须能回看输入依据、质量诊断和审核状态。",
                "原型验收通过不等于目标系统完成，仍需看 maturityGaps。",
            ],
        },
        "rules": [
            "不把静态原型验收当成目标系统完成。",
            "每个版本都必须有真实数据证据、入口和验收标准。",
            "优先补会让运营闭环更清楚的能力，再补自动化深度。",
        ],
    }


def build_target_system_plan(
    stats: dict,
    history_stats: dict,
    workflow_overview: dict,
    release_readiness: dict,
    collection_strategy: dict,
    collection_fallback_desk: dict,
    review_insights: dict,
) -> dict:
    releases = release_readiness.get("releases") or []
    maturity_gaps = release_readiness.get("maturityGaps") or []
    workflow_steps = workflow_overview.get("steps") or []
    blocked_or_waiting = [
        step for step in workflow_steps
        if step.get("status") in {"blocked", "waiting"}
    ]
    primary_fallback = collection_fallback_desk.get("primary") or {}
    completed_releases = len([item for item in releases if item.get("status") == "ready"])
    headline = "把当前 MVP 升级成每日内容生产操作系统"
    target = (
        "运营每天只需要完成选题、确认品牌、审核脚本和回填表现；系统负责采集保障、"
        "字幕结构化、脚本生成、质量评分、改写和复盘学习。"
    )
    current_state = (
        f"当前真实状态：今日脚本 {stats.get('scripts') or 0} 条，今日结构 {stats.get('contentStructures') or 0} 条，"
        f"已选商品 {stats.get('selectedBrandProducts') or 0} 条，历史脚本 {history_stats.get('scripts') or 0} 条。"
    )
    if blocked_or_waiting:
        next_action = blocked_or_waiting[0].get("action") or workflow_overview.get("nextAction") or "处理今日流程卡点"
        next_href = blocked_or_waiting[0].get("href") or workflow_overview.get("nextHref") or "./v2.html?v=target-system-v1"
    elif maturity_gaps:
        next_action = maturity_gaps[0].get("nextAction") or "补齐下一档成熟度缺口"
        next_href = maturity_gaps[0].get("href") or "./v2.html?v=target-system-v1"
    else:
        next_action = "扩大真实数据量并持续复盘"
        next_href = "./script-library.html?v=target-system-v1"
    capabilities = [
        {
            "id": "P1",
            "title": "每日生产闭环",
            "target": "从首页看到今天卡在哪一步，并能跳到可执行入口。",
            "current": workflow_overview.get("summary") or "等待今日流程判断。",
            "acceptance": "采集、选题、输入、生成、审核、复盘 6 步都有状态、证据和动作。",
            "href": "./v2.html?v=target-system-v1#v2Dashboard",
        },
        {
            "id": "P2",
            "title": "真实输入池",
            "target": "热点、对标视频、字幕结构、商品活动和历史模板都能进入生成输入。",
            "current": f"今日素材 {stats.get('contentSources') or 0} 条；结构 {stats.get('contentStructures') or 0} 条；商品 {stats.get('selectedBrandProducts') or 0} 条。",
            "acceptance": "每次生成都能追溯读取了哪些热点、结构素材、商品和复盘信号。",
            "href": "./content-pool.html?v=target-system-v1",
        },
        {
            "id": "P3",
            "title": "脚本质量引擎",
            "target": "脚本必须可拍、可复核、可改写，不再只是热点文案。",
            "current": f"模板 {review_insights.get('templateCount') or 0} 条；复用信号 {len((review_insights.get('learningSignals') or {}).get('reuseSignals') or [])} 条。",
            "acceptance": "脚本有分镜、口播、字幕、质量诊断、风险提示和改写入口。",
            "href": "./script-library.html?v=target-system-v1",
        },
        {
            "id": "P4",
            "title": "采集保障体系",
            "target": "自动采集失败时不阻塞当天生产。",
            "current": collection_strategy.get("summary") or "等待采集策略判断。",
            "acceptance": "公开热榜、登录态小批量、人工导入、第三方表格四层方案都能看到状态和兜底动作。",
            "href": "./collection-center.html?v=target-system-v1",
        },
    ]
    experience_flow = [
        {
            "step": "早上",
            "title": "看今日工作台",
            "operatorAction": "确认采集是否可生产，采用 1-3 个推荐选题。",
            "systemAction": "汇总真实热榜、对标结构、商品活动和模板信号。",
            "href": "./v2.html?v=target-system-v1#v2Dashboard",
        },
        {
            "step": "上午",
            "title": "补厚输入",
            "operatorAction": "对缺失素材补链接、字幕或第三方表格。",
            "systemAction": "做字幕接入、结构摘要和输入证据链。",
            "href": "./content-pool.html?v=target-system-v1",
        },
        {
            "step": "中午",
            "title": "生成候选脚本",
            "operatorAction": "选择生成数量，审核候选脚本是否可拍。",
            "systemAction": "调用 Codex CLI 生成分镜、口播、字幕、CTA 和风险提示。",
            "href": "./index.html?v=target-system-v1#stepGenerate",
        },
        {
            "step": "下午",
            "title": "审核和复盘",
            "operatorAction": "采用、待改、弃用，并回填发布表现。",
            "systemAction": "沉淀复用结构、避坑信号和下一轮生成建议。",
            "href": "./script-library.html?v=target-system-v1",
        },
    ]
    data_alternatives = [
        {
            "layer": "A",
            "name": "公开热榜自动采集",
            "useWhen": "每天需要稳定候选底盘。",
            "current": f"历史热榜 {history_stats.get('hotItems') or 0} 条。",
            "fallback": "失败时人工导入热点或第三方热点表格。",
            "risk": "只能拿到热点词和热度，通常没有视频字幕。",
        },
        {
            "layer": "B",
            "name": "登录态小批量采集",
            "useWhen": "需要类目词搜索或对标账号近期内容。",
            "current": primary_fallback.get("evidence") or "遇验证码时暂停，不做高频尝试。",
            "fallback": "每次 3 个词以内；失败转人工导入链接和字幕。",
            "risk": "验证码、登录态过期、平台风控会影响稳定性。",
        },
        {
            "layer": "C",
            "name": "人工导入",
            "useWhen": "当天必须继续生产，自动采集不可用。",
            "current": f"历史人工/内容池素材 {history_stats.get('contentSources') or 0} 条。",
            "fallback": "支持链接、字幕、正文、批量文本和旧字幕项目结果。",
            "risk": "需要运营判断素材质量和授权边界。",
        },
        {
            "layer": "D",
            "name": "第三方表格",
            "useWhen": "需要规模化补充热点、账号视频、互动数据。",
            "current": "已有表格导入和预检，字段清洗仍需增强。",
            "fallback": "先表格导入，API 深接后置。",
            "risk": "字段命名、去重、授权和数据真实性需要预检。",
        },
    ]
    release_plan = [
        {
            "id": item.get("id") or "",
            "title": item.get("title") or "",
            "percent": item.get("percent") or 0,
            "statusLabel": item.get("statusLabel") or "",
            "nextAction": item.get("nextAction") or "查看下一步",
            "href": item.get("nextHref") or item.get("href") or "#",
        }
        for item in releases
    ]
    principles = [
        "真实数据优先：没有真实输入就显示缺口，不用模拟数据填充。",
        "自动化可降级：采集、字幕、结构化都必须有人工或第三方兜底。",
        "体验先闭环：先让运营知道下一步点哪里，再追求更深自动化。",
        "质量可追溯：每条脚本必须能回看来源、结构、商品和复盘信号。",
        "当前不做公网、多租户、自动发布和大规模爬取。",
    ]
    return {
        "version": "target_system_plan_v1",
        "headline": headline,
        "target": target,
        "currentState": current_state,
        "nextAction": next_action,
        "nextHref": next_href,
        "completedReleaseCount": completed_releases,
        "totalReleaseCount": len(releases),
        "capabilities": capabilities,
        "experienceFlow": experience_flow,
        "dataAlternatives": data_alternatives,
        "releasePlan": release_plan,
        "principles": principles,
    }


def build_v2_experience_gap_board(
    target_system_plan: dict,
    workflow_overview: dict,
    readiness: dict,
    collection_guarantee_hub: dict,
    collection_fallback_switcher: dict,
    review_insights: dict,
    release_readiness: dict,
    stats: dict,
) -> dict:
    workflow_steps = workflow_overview.get("steps") or []
    workflow_ready = len([step for step in workflow_steps if step.get("status") == "ready"])
    workflow_total = len(workflow_steps)
    collection_counts = collection_guarantee_hub.get("counts") or {}
    release_by_id = {item.get("id"): item for item in release_readiness.get("releases") or []}
    template_count = review_insights.get("templateCount") or 0
    published_count = review_insights.get("publishedCount") or 0
    fallback_paths = collection_fallback_switcher.get("paths") or []
    ready_source_count = collection_counts.get("readySources") or 0
    fallback_source_count = collection_counts.get("fallbackSources") or 0
    selected_products = stats.get("selectedBrandProducts") or 0

    def experience_item(
        role: str,
        target: str,
        current: str,
        ready: bool,
        blocker: str,
        next_action: str,
        href: str,
        evidence: list[str],
        owner: str,
    ) -> dict:
        return {
            "role": role,
            "target": target,
            "current": current,
            "status": "ready" if ready else "blocked",
            "statusLabel": "体验可用" if ready else "体验缺口",
            "blocker": "" if ready else blocker,
            "nextAction": next_action,
            "href": href,
            "evidence": evidence,
            "owner": owner,
        }

    operator_ready = bool(workflow_steps) and workflow_ready == workflow_total and bool(readiness.get("ready"))
    content_lead_ready = template_count > 0 and published_count > 0
    collector_ready = bool(collection_guarantee_hub.get("version")) and bool(fallback_paths)
    brand_ready = selected_products > 0
    items = [
        experience_item(
            "运营",
            "每天只处理少量清晰动作：看卡点、采用选题、确认输入、生成脚本、审核脚本。",
            f"今日闭环 {workflow_ready}/{workflow_total or 0} 步就绪；生成准备：{readiness.get('summary') or '待判断'}。",
            operator_ready,
            "今日闭环或生成准备度未完全就绪，运营仍需要在多个模块之间判断下一步。",
            workflow_overview.get("nextAction") or readiness.get("nextAction") or "处理今日生产卡点",
            workflow_overview.get("nextHref") or readiness.get("generateUrl") or "./v2.html?v=experience-gap-v1#v2WorkflowOverview",
            [
                f"闭环步骤：{workflow_ready}/{workflow_total or 0}",
                f"生成准备：{'已就绪' if readiness.get('ready') else '未就绪'}",
                f"今日脚本：{stats.get('scripts') or 0} 条",
            ],
            "运营",
        ),
        experience_item(
            "内容负责人",
            "不用逐条翻脚本，能看质量、审核状态、发布表现、可复用模板和下一轮建议。",
            f"已发布 {published_count} 条；高表现模板 {template_count} 条；R3 {release_by_id.get('R3', {}).get('percent', 0)}%。",
            content_lead_ready,
            "发布表现和模板样本不足，质量学习还不能稳定反哺下一轮生成。",
            release_by_id.get("R3", {}).get("nextAction") or "回填发布表现并标记模板",
            release_by_id.get("R3", {}).get("nextHref") or "./script-library.html?v=experience-gap-v1",
            [
                f"发布回填：{published_count} 条",
                f"模板：{template_count} 条",
                f"R3：{release_by_id.get('R3', {}).get('percent', 0)}%",
            ],
            "内容负责人",
        ),
        experience_item(
            "采集维护",
            "自动源、登录态、人工导入、旧字幕、第三方表格都有状态、失败原因和切换入口。",
            f"可用来源 {ready_source_count} 个；需兜底 {fallback_source_count} 个；替代路径 {len(fallback_paths)} 条。",
            collector_ready,
            "采集状态或替代路径还没有形成统一决策入口。",
            collection_guarantee_hub.get("nextAction") or collection_fallback_switcher.get("primaryAction") or "打开采集保障中枢",
            collection_guarantee_hub.get("nextHref") or collection_fallback_switcher.get("primaryHref") or "./collection-center.html?v=experience-gap-v1",
            [
                f"可用来源：{ready_source_count}",
                f"兜底来源：{fallback_source_count}",
                f"替代路径：{len(fallback_paths)}",
            ],
            "采集维护",
        ),
        experience_item(
            "品牌负责人",
            "脚本默认读取今天可说的商品活动、权益限制和禁用表达，降低夸大承诺风险。",
            f"已选商品活动 {selected_products} 条；R2 {release_by_id.get('R2', {}).get('percent', 0)}%。",
            brand_ready,
            "今天还没有明确可说商品活动，生成器容易只围绕热点和品牌名写空泛脚本。",
            "维护今天可说的商品活动",
            "./brand-center.html?v=experience-gap-v1",
            [
                f"已选商品：{selected_products} 条",
                f"R2：{release_by_id.get('R2', {}).get('percent', 0)}%",
                "规则：未选商品不应宣称具体权益",
            ],
            "品牌负责人",
        ),
    ]
    ready_count = len([item for item in items if item["status"] == "ready"])
    blocked_items = [item for item in items if item["status"] != "ready"]
    primary = blocked_items[0] if blocked_items else items[0]
    return {
        "version": "v2_experience_gap_board_v1",
        "headline": "目标体验缺口检查",
        "summary": (
            f"按角色检查目标系统体验：{ready_count}/{len(items)} 个角色体验可用。"
            " 这里不是功能列表，而是判断每个角色今天能不能少猜一步。"
        ),
        "level": "ready" if ready_count == len(items) else "blocked",
        "readyCount": ready_count,
        "totalCount": len(items),
        "primary": primary,
        "items": items,
        "principles": target_system_plan.get("principles") or [],
    }


def build_v2_master_plan(
    target_system_plan: dict,
    development_board: dict,
    product_vision_map: dict,
    collection_strategy: dict,
    first_benchmark_material: dict | None,
) -> dict:
    implementation_plan = development_board.get("implementationPlan") or {}
    current_package = implementation_plan.get("currentPackage") or {}
    packages = implementation_plan.get("packages") or []
    data_alternatives = target_system_plan.get("dataAlternatives") or []
    experience_flow = target_system_plan.get("experienceFlow") or []
    first_benchmark_material = first_benchmark_material or {}
    next_action = (
        current_package.get("nextAction")
        or first_benchmark_material.get("nextAction")
        or target_system_plan.get("nextAction")
        or product_vision_map.get("nextAction")
        or "处理下一大版本卡点"
    )
    next_href = (
        current_package.get("href")
        or first_benchmark_material.get("nextHref")
        or target_system_plan.get("nextHref")
        or "./v2.html?v=master-plan-v1"
    )
    current_gap = {
        "level": current_package.get("status") or first_benchmark_material.get("level") or "blocked",
        "label": current_package.get("id") or "当前优先包",
        "title": current_package.get("title") or first_benchmark_material.get("nextStep") or "首条真实账号素材闭环",
        "evidence": current_package.get("evidence") or first_benchmark_material.get("summary") or target_system_plan.get("currentState") or "",
        "action": next_action,
        "href": next_href,
    }
    workstreams = []
    for item in packages:
        workstreams.append({
            "id": item.get("id") or "",
            "title": item.get("title") or "",
            "status": item.get("status") or "needs_work",
            "statusLabel": item.get("statusLabel") or "",
            "scope": item.get("scope") or "",
            "acceptance": item.get("acceptance") or "",
            "evidence": item.get("evidence") or "",
            "nextAction": item.get("nextAction") or "查看入口",
            "href": item.get("href") or "#",
        })
    if not workstreams:
        for item in development_board.get("releaseCards") or []:
            workstreams.append({
                "id": item.get("id") or "",
                "title": item.get("title") or "",
                "status": item.get("status") or "needs_work",
                "statusLabel": item.get("statusLabel") or "",
                "scope": item.get("blockingGap") or "",
                "acceptance": "按该版本验收项补齐真实数据证据和可执行入口。",
                "evidence": item.get("evidence") or "",
                "nextAction": item.get("nextAction") or "查看入口",
                "href": item.get("nextHref") or "#",
            })
    data_fallbacks = [
        {
            "layer": item.get("layer") or "",
            "name": item.get("name") or "",
            "current": item.get("current") or "",
            "fallback": item.get("fallback") or item.get("risk") or "",
        }
        for item in data_alternatives
    ]
    if not data_fallbacks:
        for item in product_vision_map.get("dataStrategy") or []:
            data_fallbacks.append({
                "layer": item.get("lane") or "",
                "name": item.get("name") or "",
                "current": item.get("current") or "",
                "fallback": item.get("fallback") or item.get("role") or "",
            })
    return {
        "version": "v2_master_plan_v1",
        "headline": "下一大版本不是继续补页面，而是把每日内容生产闭环做成可运营系统。",
        "finalTarget": target_system_plan.get("target") or product_vision_map.get("finalTarget") or "",
        "currentReality": product_vision_map.get("notDoneYet") or target_system_plan.get("currentState") or "",
        "currentGap": current_gap,
        "nextAction": next_action,
        "nextHref": next_href,
        "workstreams": workstreams,
        "operatorExperience": experience_flow,
        "dataFallbacks": data_fallbacks,
        "versionGates": implementation_plan.get("gates") or [
            "没有真实素材证据，不允许把输入增厚标成完成。",
            "自动采集失败必须能切换人工或第三方兜底。",
            "每条脚本必须能回看来源、结构、商品、质量诊断和审核状态。",
        ],
        "collectionSummary": collection_strategy.get("summary") or "",
    }


def build_v2_product_charter(
    stats: dict,
    history_stats: dict,
    target_system_plan: dict,
    development_board: dict,
    product_vision_map: dict,
    collection_strategy: dict,
    collection_fallback_switcher: dict,
    v2_execution_queue: dict,
    r2_input_verifier: dict,
) -> dict:
    implementation_plan = development_board.get("implementationPlan") or {}
    current_package = implementation_plan.get("currentPackage") or {}
    packages = implementation_plan.get("packages") or []
    queue_primary = v2_execution_queue.get("primary") or {}
    focus = {
        "id": current_package.get("id") or queue_primary.get("id") or "P0",
        "title": current_package.get("title") or queue_primary.get("title") or "补齐真实输入闭环",
        "status": current_package.get("status") or queue_primary.get("status") or "blocked",
        "statusLabel": current_package.get("statusLabel") or "",
        "why": current_package.get("evidence") or queue_primary.get("why") or target_system_plan.get("currentState") or "",
        "action": current_package.get("nextAction") or queue_primary.get("action") or target_system_plan.get("nextAction") or "处理下一步",
        "href": current_package.get("href") or queue_primary.get("href") or target_system_plan.get("nextHref") or "./v2.html?v=product-charter-v1",
    }
    fallback_paths = collection_fallback_switcher.get("paths") or []
    data_fallbacks = []
    for item in target_system_plan.get("dataAlternatives") or []:
        data_fallbacks.append({
            "layer": item.get("layer") or "",
            "name": item.get("name") or "",
            "when": item.get("useWhen") or item.get("current") or "",
            "current": item.get("current") or "",
            "fallback": item.get("fallback") or "",
            "risk": item.get("risk") or "",
        })
    if not data_fallbacks:
        for item in product_vision_map.get("dataStrategy") or []:
            data_fallbacks.append({
                "layer": item.get("lane") or "",
                "name": item.get("name") or "",
                "when": item.get("role") or "",
                "current": item.get("current") or "",
                "fallback": item.get("fallback") or "",
                "risk": "",
            })
    release_packages = [
        {
            "id": item.get("id") or "",
            "title": item.get("title") or "",
            "status": item.get("status") or "needs_work",
            "statusLabel": item.get("statusLabel") or "",
            "scope": item.get("scope") or "",
            "acceptance": item.get("acceptance") or "",
            "evidence": item.get("evidence") or "",
            "href": item.get("href") or "#",
        }
        for item in packages[:4]
    ]
    if not release_packages:
        release_packages = [
            {
                "id": item.get("id") or "",
                "title": item.get("title") or "",
                "status": item.get("status") or "needs_work",
                "statusLabel": item.get("statusLabel") or "",
                "scope": item.get("blockingGap") or "",
                "acceptance": "按该版本验收项补齐真实证据和运营入口。",
                "evidence": item.get("evidence") or "",
                "href": item.get("nextHref") or "#",
            }
            for item in (development_board.get("releaseCards") or [])[:4]
        ]
    current_facts = [
        {
            "label": "当前阶段",
            "value": product_vision_map.get("currentLevel") or "MVP",
            "meaning": product_vision_map.get("currentSummary") or "仍处于原型到大版本之间。",
            "status": "blocked",
        },
        {
            "label": "今日脚本",
            "value": f"{stats.get('scripts') or 0} 条",
            "meaning": f"历史脚本 {history_stats.get('scripts') or 0} 条；今日产出不能用历史脚本冒充。",
            "status": "neutral",
        },
        {
            "label": "真实输入厚度",
            "value": f"{r2_input_verifier.get('actual') or 0}/{r2_input_verifier.get('target') or 3}",
            "meaning": r2_input_verifier.get("summary") or "先补真实结构素材，再谈稳定生成质量。",
            "status": r2_input_verifier.get("level") or "blocked",
        },
        {
            "label": "采集保障",
            "value": collection_strategy.get("level") or "待判断",
            "meaning": collection_strategy.get("summary") or "自动采集不可作为唯一生产入口。",
            "status": collection_strategy.get("level") or "needs_work",
        },
        {
            "label": "兜底路径",
            "value": f"{len(fallback_paths)} 条",
            "meaning": "公开热榜、登录态小批量、人工导入、第三方表格要能按状态切换。",
            "status": "actionable" if fallback_paths else "blocked",
        },
    ]
    guardrails = [
        "没有真实素材证据，不允许把输入增厚标成完成。",
        "测试、验证、示例、example.com 和占位文本不计入真实闭环。",
        "自动采集失败必须显示原因，并能切人工导入或第三方表格。",
        "每条候选脚本必须能回看来源、结构、商品、质量诊断和审核状态。",
        "R1-R4 原型验收不等于目标系统完成，还要继续补成熟度缺口。",
    ]
    non_goals = [
        "不做高频爬虫和绕过验证码。",
        "不把旧模拟数据当真实生产数据。",
        "不做自动发布闭环，先保留人工审核。",
        "不做公网多租户和权限系统，先做本地真实生产工作流。",
    ]
    return {
        "version": "v2_product_charter_v1",
        "headline": "V2 的目标是每日内容生产系统，不是更复杂的脚本生成页。",
        "level": focus.get("status") or "blocked",
        "finalTarget": target_system_plan.get("target") or product_vision_map.get("finalTarget") or "",
        "currentReality": product_vision_map.get("notDoneYet") or target_system_plan.get("currentState") or "",
        "focus": focus,
        "currentFacts": current_facts,
        "releasePackages": release_packages,
        "dataFallbacks": data_fallbacks,
        "guardrails": guardrails,
        "nonGoals": non_goals,
        "nextAction": focus.get("action"),
        "nextHref": focus.get("href"),
    }


def build_v2_build_manifest(
    stats: dict,
    history_stats: dict,
    v2_product_charter: dict,
    development_board: dict,
    v2_module_board: dict,
    release_readiness: dict,
    collection_fallback_switcher: dict,
    p01_verifier: dict,
    r2_input_verifier: dict,
) -> dict:
    current_package = (development_board.get("implementationPlan") or {}).get("currentPackage") or {}
    module_items = v2_module_board.get("modules") or []
    release_packages = v2_product_charter.get("releasePackages") or []
    fallback_items = v2_product_charter.get("dataFallbacks") or []
    p01_checks = p01_verifier.get("checks") or []
    r2_checks = r2_input_verifier.get("checks") or []
    modules = [
        {
            "id": item.get("id") or f"M{index + 1}",
            "name": item.get("title") or "未命名模块",
            "status": item.get("status") or "needs_work",
            "statusLabel": item.get("statusLabel") or "",
            "owner": item.get("owner") or ("采集维护" if item.get("id") == "M7" else "运营"),
            "contract": item.get("target") or item.get("gap") or "",
            "evidence": item.get("evidence") or item.get("metric") or "",
            "entry": item.get("href") or "#",
        }
        for index, item in enumerate(module_items)
    ]
    if not modules:
        modules = [
            {"id": "M1", "name": "今日工作台", "status": "needs_work", "owner": "运营", "contract": "汇总今日卡点、任务和产出。", "evidence": "", "entry": "./v2.html"},
            {"id": "M2", "name": "热点池", "status": "needs_work", "owner": "运营", "contract": "管理真实热榜和候选选题。", "evidence": "", "entry": "./trend-pool.html"},
            {"id": "M3", "name": "对标内容池", "status": "needs_work", "owner": "运营 + 采集维护", "contract": "承接链接、字幕、正文和结构摘要。", "evidence": "", "entry": "./content-pool.html"},
        ]
    module_contracts = [
        {"name": "workdays", "purpose": "今日工作日、开始/结束状态和当天口径。", "owner": "今日工作台"},
        {"name": "hot_search_items / trend_marks", "purpose": "公开热榜、品牌候选、观察和风险标记。", "owner": "热点池"},
        {"name": "benchmark_accounts / benchmark_update_tasks", "purpose": "固定对标号池、每日补录任务和账号级进度。", "owner": "对标内容池"},
        {"name": "content_sources / content_structures", "purpose": "真实素材、字幕/正文、加入生成和结构摘要。", "owner": "对标内容池"},
        {"name": "brand_products", "purpose": "商品活动、权益限制、门店范围和禁用表达。", "owner": "品牌商品"},
        {"name": "daily_script_candidates", "purpose": "候选脚本、质量分、输入证据、审核和发布复盘。", "owner": "脚本库"},
        {"name": "collection_tasks / collection_schedules", "purpose": "采集计划、任务结果、失败原因和兜底动作。", "owner": "采集任务"},
        {"name": "operation_handoffs", "purpose": "开工提醒、日终复盘和运营交接归档。", "owner": "运营交接"},
    ]
    api_contracts = [
        {"method": "GET", "path": "/api/v2/dashboard", "purpose": "V2 首页总状态、章程、验收、执行队列和真实闭环证据。"},
        {"method": "GET/POST", "path": "/api/v2/content-sources", "purpose": "导入真实素材、读取素材池、加入生成和结构化。"},
        {"method": "POST", "path": "/api/v2/content-sources/preview", "purpose": "导入前预检，拒绝测试/验证/示例/重复链接和占位文本。"},
        {"method": "GET/POST", "path": "/api/v2/benchmark-accounts", "purpose": "维护固定对标号池并生成每日更新任务。"},
        {"method": "POST", "path": "/api/v2/generate-scripts", "purpose": "读取已确认真实输入，调用生成能力写入候选脚本库。"},
        {"method": "POST", "path": "/api/v2/script-candidates/{id}/review", "purpose": "审核采用、待改、弃用、原因和复盘状态。"},
        {"method": "GET/POST", "path": "/api/v2/operation-handoffs", "purpose": "保存和读取运营交接快照。"},
    ]
    sprint_checks = []
    for check in p01_checks:
        sprint_checks.append({
            "id": check.get("key") or "p01",
            "label": check.get("label") or "P0-1 验收项",
            "status": check.get("status") or ("done" if check.get("ready") else "blocked"),
            "evidence": check.get("evidence") or check.get("reason") or "",
            "action": check.get("action") or p01_verifier.get("nextAction") or "处理 P0-1",
            "href": check.get("href") or p01_verifier.get("href") or p01_verifier.get("nextHref") or "#",
        })
    if not sprint_checks:
        for check in r2_checks:
            sprint_checks.append({
                "id": check.get("key") or "r2",
                "label": check.get("label") or "R2 输入验收项",
                "status": check.get("status") or "blocked",
                "evidence": check.get("evidence") or "",
                "action": check.get("action") or r2_input_verifier.get("nextAction") or "处理 R2 输入",
                "href": check.get("href") or r2_input_verifier.get("nextHref") or "#",
            })
    fallback_contracts = [
        {
            "layer": item.get("layer") or "",
            "name": item.get("name") or "",
            "trigger": item.get("when") or item.get("current") or "",
            "fallback": item.get("fallback") or "",
            "risk": item.get("risk") or "",
        }
        for item in fallback_items
    ]
    return {
        "version": "v2_build_manifest_v1",
        "headline": "V2 大版本 Build Manifest",
        "summary": "把产品章程落到模块边界、数据表、接口、验收测试和当前 Sprint，避免规划停留在愿景层。",
        "currentSprint": {
            "id": current_package.get("id") or "P0-1",
            "title": current_package.get("title") or "首条真实账号素材闭环",
            "status": current_package.get("status") or "blocked",
            "owner": current_package.get("owner") or "运营 + 采集维护",
            "acceptance": current_package.get("acceptance") or "至少 1 条真实素材进入生成输入证据。",
            "nextAction": current_package.get("nextAction") or v2_product_charter.get("nextAction") or "处理当前 Sprint",
            "href": current_package.get("href") or v2_product_charter.get("nextHref") or "#",
            "evidence": current_package.get("evidence") or "",
        },
        "modules": modules,
        "releasePackages": release_packages,
        "dataContracts": module_contracts,
        "apiContracts": api_contracts,
        "fallbackContracts": fallback_contracts,
        "sprintChecks": sprint_checks[:6],
        "qualityGates": [
            "dashboard 任何完成态必须来自真实库表或接口证据。",
            "导入、批量导入、加入生成、结构化都必须复用真实素材保护。",
            "生成脚本必须写入 input_* 证据，能追溯热点、结构、商品和复盘信号。",
            "移动端 390px 不允许横向滚动，运营入口必须可点击。",
        ],
        "releaseEvidence": {
            "overallPercent": release_readiness.get("overallPercent") or 0,
            "summary": release_readiness.get("summary") or "",
            "maturitySummary": release_readiness.get("maturitySummary") or "",
        },
        "fallbackPathCount": len(collection_fallback_switcher.get("paths") or []),
        "todayFacts": {
            "scripts": stats.get("scripts") or 0,
            "contentSources": stats.get("contentSources") or 0,
            "contentStructures": stats.get("contentStructures") or 0,
            "historyScripts": history_stats.get("scripts") or 0,
        },
    }


def build_v2_objective_audit(
    v2_product_charter: dict,
    v2_build_manifest: dict,
    v2_acceptance_board: dict,
    v2_experience_gap_board: dict,
    v2_release_roadmap: dict,
    v2_execution_queue: dict,
    collection_fallback_switcher: dict,
    p01_verifier: dict,
    r2_input_verifier: dict,
) -> dict:
    acceptance_rows = v2_acceptance_board.get("rows") or []
    release_packages = v2_product_charter.get("releasePackages") or []
    fallback_paths = collection_fallback_switcher.get("paths") or []
    experience_items = v2_experience_gap_board.get("items") or []
    sprint = v2_build_manifest.get("currentSprint") or {}
    primary_execution = v2_execution_queue.get("primary") or {}
    blocked_rows = [row for row in acceptance_rows if row.get("status") != "ready"]
    planned_count = sum(1 for item in release_packages if item.get("title"))
    ready_experience_count = sum(1 for item in experience_items if item.get("status") == "ready")
    p01_checks = p01_verifier.get("checks") or []
    p01_ready_count = sum(1 for check in p01_checks if check.get("ready"))
    r2_checks = r2_input_verifier.get("checks") or []
    r2_ready_count = sum(1 for check in r2_checks if check.get("ready") or check.get("status") == "ready")
    items = [
        {
            "id": "OBJ-1",
            "requirement": "重新规划产品功能",
            "status": "planned" if planned_count else "not_complete",
            "statusLabel": "已形成开发包，未完成落地" if planned_count else "缺规划证据",
            "evidence": f"产品章程已拆出 {planned_count} 个大版本开发包；Build Manifest 已定义 {len(v2_build_manifest.get('modules') or [])} 个模块边界。",
            "gap": "开发包还需要逐项由真实数据和页面操作验收，不能只看规划卡片。",
            "nextAction": sprint.get("nextAction") or v2_product_charter.get("nextAction") or "推进当前 Sprint",
            "href": sprint.get("href") or v2_product_charter.get("nextHref") or "./v2.html?v=objective-audit-v1#v2SpecGrid",
        },
        {
            "id": "OBJ-2",
            "requirement": "重新规划运营体验",
            "status": "partially_implemented" if experience_items else "not_complete",
            "statusLabel": f"{ready_experience_count}/{len(experience_items)} 个角色体验可用" if experience_items else "缺体验审计",
            "evidence": v2_experience_gap_board.get("summary") or "目标体验缺口看板尚未返回数据。",
            "gap": "运营端仍要能从首页无猜测地完成选题、补素材、生成、审核和复盘。",
            "nextAction": (v2_experience_gap_board.get("primary") or {}).get("nextAction") or "处理目标体验缺口",
            "href": (v2_experience_gap_board.get("primary") or {}).get("href") or "./v2.html?v=objective-audit-v1#v2ExperienceGapBoard",
        },
        {
            "id": "OBJ-3",
            "requirement": "明确最终目标",
            "status": "planned" if v2_product_charter.get("finalTarget") else "not_complete",
            "statusLabel": "目标已写入章程，但系统未达成",
            "evidence": v2_product_charter.get("finalTarget") or "最终目标缺失。",
            "gap": v2_product_charter.get("currentReality") or "当前仍是 MVP 小版本，不能宣称目标系统完成。",
            "nextAction": v2_product_charter.get("nextAction") or "继续推进大版本",
            "href": v2_product_charter.get("nextHref") or "./v2.html?v=objective-audit-v1#v2ProductCharter",
        },
        {
            "id": "OBJ-4",
            "requirement": "规划数据采集替代方案",
            "status": "planned" if fallback_paths else "not_complete",
            "statusLabel": f"{len(fallback_paths)} 条兜底路径已纳入" if fallback_paths else "缺兜底路径",
            "evidence": collection_fallback_switcher.get("summary") or "采集替代方案尚未返回。",
            "gap": "兜底路径需要在当天真实素材补录中跑通，而不是只作为说明存在。",
            "nextAction": collection_fallback_switcher.get("nextAction") or "执行采集兜底",
            "href": collection_fallback_switcher.get("nextHref") or "./collection-center.html?v=objective-audit-v1",
        },
        {
            "id": "OBJ-5",
            "requirement": "规划并实现大的开发版本",
            "status": "partially_implemented" if acceptance_rows else "not_complete",
            "statusLabel": v2_acceptance_board.get("summary") or "等待 R1-R4 验收数据",
            "evidence": f"发布计划已生成；当前阻塞版本 {len(blocked_rows)} 个，主执行项为「{primary_execution.get('title') or sprint.get('title') or '未确定'}」。",
            "gap": "R1-R4 仍未全部通过真实验收；当前不能把大版本标记为完成。",
            "nextAction": v2_execution_queue.get("nextAction") or primary_execution.get("action") or "处理执行队列第一项",
            "href": v2_execution_queue.get("nextHref") or primary_execution.get("href") or "./v2.html?v=objective-audit-v1#v2ExecutionQueue",
        },
        {
            "id": "OBJ-6",
            "requirement": "真实数据驱动而非模拟数据",
            "status": "blocked" if p01_verifier.get("level") == "blocked" or r2_input_verifier.get("level") == "blocked" else "partially_implemented",
            "statusLabel": f"P0-1 {p01_ready_count}/{len(p01_checks)} 项；R2 {r2_ready_count}/{len(r2_checks)} 项",
            "evidence": f"{p01_verifier.get('summary') or ''} {r2_input_verifier.get('summary') or ''}".strip(),
            "gap": "首条真实账号素材和 R2 输入厚度未通过前，脚本生产闭环不能宣称跑通。",
            "nextAction": p01_verifier.get("nextAction") or r2_input_verifier.get("nextAction") or "补齐真实输入",
            "href": p01_verifier.get("nextHref") or p01_verifier.get("href") or r2_input_verifier.get("nextHref") or "./content-pool.html?v=objective-audit-v1",
        },
    ]
    done_count = sum(1 for item in items if item["status"] == "ready")
    blocked_count = sum(1 for item in items if item["status"] == "blocked")
    partial_count = sum(1 for item in items if item["status"] in {"planned", "partially_implemented"})
    return {
        "version": "v2_objective_audit_v1",
        "headline": "目标完成审计",
        "summary": "把用户提出的原始目标逐项对照当前真实证据：哪些只是规划完成，哪些已有部分功能，哪些仍被真实数据阻塞。",
        "level": "blocked" if blocked_count else "in_progress",
        "doneCount": done_count,
        "partialCount": partial_count,
        "blockedCount": blocked_count,
        "totalCount": len(items),
        "items": items,
        "rule": "这个审计不能用页面存在来证明完成；必须看真实数据、接口返回、验收项和可操作入口。",
        "completionStatement": "当前不能标记为目标完成：产品大版本规划已形成，但真实账号素材闭环和 R2 输入厚度仍未通过。",
    }


def build_v2_objective_implementation_plan(
    v2_objective_audit: dict,
    development_board: dict,
    v2_build_manifest: dict,
    v2_release_roadmap: dict,
    v2_execution_queue: dict,
) -> dict:
    audit_items = v2_objective_audit.get("items") or []
    implementation_plan = development_board.get("implementationPlan") or {}
    packages = implementation_plan.get("packages") or []
    package_by_id = {item.get("id"): item for item in packages}
    current_package = implementation_plan.get("currentPackage") or {}
    sprint = v2_build_manifest.get("currentSprint") or {}
    roadmap_milestones = v2_release_roadmap.get("milestones") or []
    release_by_id = {item.get("id"): item for item in roadmap_milestones}
    primary_execution = v2_execution_queue.get("primary") or {}

    mapping = {
        "OBJ-1": {
            "packageId": "P0-2",
            "releaseId": "R2",
            "stage": "01 功能包落地",
            "owner": "产品 + 运营",
            "dependencies": ["OBJ-3", "OBJ-6"],
            "deliverable": "把产品功能规划落成模块入口、数据契约和生成输入包。",
            "acceptance": "每个核心模块都有入口、真实数据指标、当前缺口和下一步动作。",
        },
        "OBJ-2": {
            "packageId": "P0-2",
            "releaseId": "R1",
            "stage": "02 运营体验闭环",
            "owner": "产品 + 运营",
            "dependencies": ["OBJ-1", "OBJ-6"],
            "deliverable": "运营从首页能按顺序完成选题、补素材、确认输入、生成、审核、复盘。",
            "acceptance": "运营不需要猜按钮关系；每一步都显示上一步输入证据和下一步入口。",
        },
        "OBJ-3": {
            "packageId": "P0-0",
            "releaseId": "",
            "stage": "00 目标和边界锁定",
            "owner": "产品负责人",
            "dependencies": [],
            "deliverable": "固定最终目标、当前 MVP 事实、验收红线和不做事项。",
            "acceptance": "首页第一屏能清楚说明目标系统不是脚本生成页，也不能把 MVP 当完成。",
        },
        "OBJ-4": {
            "packageId": "P1-2",
            "releaseId": "R4",
            "stage": "04 采集保障",
            "owner": "采集维护",
            "dependencies": ["OBJ-6"],
            "deliverable": "公开热榜、登录态小批量、人工导入、第三方表格四层可切换。",
            "acceptance": "自动采集失败时，页面能显示原因、产物、兜底路径和导入入口。",
        },
        "OBJ-5": {
            "packageId": "P0-1",
            "releaseId": "R2",
            "stage": "03 大版本验收推进",
            "owner": "研发 + 运营",
            "dependencies": ["OBJ-1", "OBJ-2", "OBJ-4", "OBJ-6"],
            "deliverable": "按 R2 -> R1 -> R4 -> R3 推进大版本，不跳过真实输入依赖。",
            "acceptance": "R1-R4 每个发布包都有依赖、发布门槛、阻塞证据和可点击执行入口。",
        },
        "OBJ-6": {
            "packageId": "P0-1",
            "releaseId": "R2",
            "stage": "00 当前 Sprint",
            "owner": "运营 + 采集维护",
            "dependencies": [],
            "deliverable": "先跑通 1 条固定对标账号真实近期素材进入生成输入证据。",
            "acceptance": sprint.get("acceptance") or "至少 1 条真实素材具备来源、文本、加入生成、结构摘要和候选脚本引用。",
        },
    }

    rows = []
    for item in audit_items:
        spec = mapping.get(item.get("id"), {})
        package = package_by_id.get(spec.get("packageId")) or {}
        release = release_by_id.get(spec.get("releaseId")) or {}
        package_status = package.get("status") or release.get("status") or item.get("status") or "not_complete"
        next_action = (
            item.get("nextAction")
            or package.get("nextAction")
            or release.get("nextAction")
            or primary_execution.get("action")
            or "处理下一步"
        )
        href = (
            item.get("href")
            or package.get("href")
            or release.get("href")
            or primary_execution.get("href")
            or "#"
        )
        rows.append({
            "id": item.get("id") or "",
            "objective": item.get("requirement") or "",
            "auditStatus": item.get("status") or "not_complete",
            "auditStatusLabel": item.get("statusLabel") or "",
            "stage": spec.get("stage") or "待排期",
            "packageId": spec.get("packageId") or "",
            "releaseId": spec.get("releaseId") or "",
            "packageStatus": package_status,
            "owner": spec.get("owner") or package.get("owner") or "待定",
            "deliverable": spec.get("deliverable") or package.get("scope") or "",
            "acceptance": spec.get("acceptance") or package.get("acceptance") or item.get("gap") or "",
            "dependencies": spec.get("dependencies") or [],
            "evidence": item.get("evidence") or package.get("evidence") or release.get("target") or "",
            "gap": item.get("gap") or "",
            "nextAction": next_action,
            "href": href,
        })

    stage_order = ["00 当前 Sprint", "00 目标和边界锁定", "01 功能包落地", "02 运营体验闭环", "03 大版本验收推进", "04 采集保障"]
    rows.sort(key=lambda row: (stage_order.index(row["stage"]) if row["stage"] in stage_order else 99, row["id"]))
    critical = next((row for row in rows if row.get("auditStatus") == "blocked"), rows[0] if rows else {})
    return {
        "version": "v2_objective_implementation_plan_v1",
        "headline": "从目标审计到开发排期",
        "summary": "把 6 项目标审计转换成可执行开发排期：每项都有交付包、依赖、验收证据和下一动作。",
        "level": v2_objective_audit.get("level") or "blocked",
        "currentSprint": {
            "id": sprint.get("id") or current_package.get("id") or critical.get("packageId") or "P0-1",
            "title": sprint.get("title") or current_package.get("title") or "首条真实账号素材闭环",
            "status": sprint.get("status") or current_package.get("status") or critical.get("packageStatus") or "blocked",
            "owner": sprint.get("owner") or current_package.get("owner") or critical.get("owner") or "运营 + 采集维护",
            "acceptance": sprint.get("acceptance") or current_package.get("acceptance") or critical.get("acceptance") or "",
            "evidence": sprint.get("evidence") or current_package.get("evidence") or critical.get("evidence") or "",
            "nextAction": sprint.get("nextAction") or current_package.get("nextAction") or critical.get("nextAction") or "处理当前 Sprint",
            "href": sprint.get("href") or current_package.get("href") or critical.get("href") or "#",
        },
        "rows": rows,
        "sequence": [
            "先锁定目标和边界，避免继续把 MVP 当目标系统。",
            "先跑通 P0-1 真实账号素材，再推进 R2 输入增厚。",
            "R2 真实输入没过之前，不宣称 R1 生产闭环完成。",
            "采集自动化失败时，必须保留人工和第三方兜底路径。",
        ],
        "rule": "排期按依赖推进，不按页面顺序推进；真实输入闭环是所有生成质量和体验优化的前置条件。",
    }


def build_v2_current_sprint_workspace(
    v2_objective_implementation_plan: dict,
    first_benchmark_material: dict,
    p01_verifier: dict,
    collection_fallback_switcher: dict,
    r2_input_verifier: dict,
) -> dict:
    sprint = v2_objective_implementation_plan.get("currentSprint") or {}
    target = first_benchmark_material.get("targetAccount") or p01_verifier.get("targetAccount") or {}
    p01_counts = p01_verifier.get("counts") or {}
    material_counts = first_benchmark_material.get("counts") or {}
    r2_checks = r2_input_verifier.get("checks") or []
    real_structure_check = next((item for item in r2_checks if item.get("key") == "real_structures"), {})
    operator_guide = first_benchmark_material.get("operatorGuide") or {}
    required_fields = operator_guide.get("requiredFields") or [
        {"label": "标题", "requirement": "真实作品标题或运营自己概括的内容主题，不能写示例。"},
        {"label": "链接/来源", "requirement": "优先填真实作品链接；没有链接时必须补字幕/正文或第三方来源说明。"},
        {"label": "账号", "requirement": "必须绑定到固定对标账号任务，避免导入后无法归因。"},
        {"label": "字幕/正文", "requirement": "至少 30 字，能看出开头、节奏、卖点和 CTA。"},
    ]
    account_name = target.get("accountName") or target.get("account_name") or "固定对标账号"
    platform = target.get("platform") or "douyin"
    task_id = target.get("taskId") or target.get("id") or first_benchmark_material.get("taskId")
    task_sheet_query = {
        "v": "current-sprint-task-sheet-v1",
        "importPath": "third_party_table",
        "importPlatform": platform,
        "importMode": "batch",
        "importAccount": account_name,
        "importTitle": f"{account_name} P0-1真实素材任务单",
        "importNote": "从 V2 当前 Sprint 执行台进入：请粘贴真实作品链接、字幕正文或第三方表格行；空白行不会入库。",
    }
    if task_id:
        task_sheet_query["benchmarkTaskId"] = task_id
    task_sheet_href = f"./content-pool.html?{urllib.parse.urlencode(task_sheet_query)}#batch-import"
    task_sheet_template = [
        "标题\t链接\t账号\t平台\t字幕\t备注",
        f"\t\t{account_name}\t{platform}\t\t",
        f"\t\t{account_name}\t{platform}\t\t",
        f"\t\t{account_name}\t{platform}\t\t",
    ]
    task_sheet_package = {
        "version": "p01_real_material_task_sheet_v1",
        "title": "P0-1 真实素材补录任务单",
        "summary": "复制到飞书或表格里填写真实链接、字幕或结构观察，再回内容池批量导入；空白任务单不会写库。",
        "header": task_sheet_template[0],
        "blankRows": task_sheet_template[1:],
        "templateText": "\n".join(task_sheet_template),
        "targetAccount": account_name,
        "platform": platform,
        "href": task_sheet_href,
        "actions": [
            {"label": "去内容池填写", "href": task_sheet_href},
            {"label": "查看固定账号任务", "href": first_benchmark_material.get("nextHref") or task_sheet_href},
        ],
        "rules": [
            "空白行只用于分派任务，不会被当成真实素材。",
            "至少补真实链接、字幕/正文或备注里的结构观察之一。",
            "禁止用 example.com、replace-video、测试、示例、占位内容通过验收。",
        ],
        "fields": [
            {"label": "标题", "meaning": "真实作品标题或运营概括的内容主题。"},
            {"label": "链接", "meaning": "真实抖音/小红书/公开视频链接；没有链接时留空但必须补文本。"},
            {"label": "账号", "meaning": "默认锁定当前固定对标账号，保证素材可归因。"},
            {"label": "平台", "meaning": "保留 douyin/xhs/manual/third_party 等可导入平台值。"},
            {"label": "字幕", "meaning": "至少 30 字，能看出开头、节奏、卖点和 CTA。"},
            {"label": "备注", "meaning": "说明可借鉴结构，例如开头、转场、商品露出或成交动作。"},
        ],
    }
    checks = p01_verifier.get("checks") or []
    steps = []
    for index, check in enumerate(checks):
        steps.append({
            "index": index + 1,
            "key": check.get("key") or "",
            "label": check.get("label") or "验收项",
            "status": check.get("status") or "blocked",
            "statusLabel": check.get("statusLabel") or "",
            "evidence": check.get("evidence") or "",
            "action": check.get("action") or p01_verifier.get("nextAction") or "处理下一步",
            "href": check.get("href") or p01_verifier.get("nextHref") or "#",
            "sourceId": check.get("sourceId"),
            "sourceTitle": check.get("sourceTitle") or "",
        })
    fallback_paths = []
    for item in collection_fallback_switcher.get("paths") or []:
        fallback_paths.append({
            "key": item.get("key") or "",
            "label": item.get("label") or "",
            "title": item.get("title") or "",
            "when": item.get("when") or "",
            "input": item.get("input") or "",
            "output": item.get("output") or "",
            "href": item.get("href") or first_benchmark_material.get("nextHref") or "#",
            "action": item.get("action") or "去处理",
            "recommended": item.get("key") in {"benchmark_account", "manual_link", "transcript_project", "third_party_table"},
        })
    fallback_paths.sort(key=lambda item: 0 if item["key"] == "benchmark_account" else 1)
    blocker = next((step for step in steps if step.get("status") == "blocked"), steps[0] if steps else {})
    return {
        "version": "v2_current_sprint_workspace_v1",
        "headline": "当前 Sprint 执行台",
        "summary": "把 P0-1 首条真实账号素材闭环集中成一张执行台：先补真实素材，再补文本、加入生成、结构化，最后生成候选脚本。",
        "level": p01_verifier.get("level") or first_benchmark_material.get("level") or "blocked",
        "currentSprint": {
            "id": sprint.get("id") or "P0-1",
            "title": sprint.get("title") or "首条真实账号素材闭环",
            "owner": sprint.get("owner") or "运营 + 采集维护",
            "acceptance": sprint.get("acceptance") or "至少 1 条真实素材具备来源、文本、加入生成、结构摘要和候选脚本引用。",
            "evidence": sprint.get("evidence") or p01_verifier.get("summary") or "",
            "nextAction": p01_verifier.get("nextAction") or sprint.get("nextAction") or "处理当前 Sprint",
            "href": p01_verifier.get("nextHref") or sprint.get("href") or "#",
        },
        "targetAccount": target,
        "blocker": {
            "label": blocker.get("label") or first_benchmark_material.get("nextAction") or "补真实素材",
            "evidence": blocker.get("evidence") or first_benchmark_material.get("summary") or "",
            "action": blocker.get("action") or p01_verifier.get("nextAction") or "处理下一步",
            "href": blocker.get("href") or p01_verifier.get("nextHref") or first_benchmark_material.get("nextHref") or "#",
        },
        "metrics": [
            {"label": "P0-1 验收", "value": f"{p01_counts.get('passed') or 0}/{p01_counts.get('total') or 5}", "status": p01_verifier.get("level") or "blocked"},
            {"label": "今日导入", "value": str(material_counts.get("imported") or 0), "status": "ready" if material_counts.get("imported") else "blocked"},
            {"label": "有文本", "value": str(material_counts.get("withText") or 0), "status": "ready" if material_counts.get("withText") else "blocked"},
            {"label": "已结构化", "value": str(material_counts.get("structured") or 0), "status": "ready" if material_counts.get("structured") else "blocked"},
            {"label": "R2 结构素材", "value": f"{real_structure_check.get('actual') or 0}/{real_structure_check.get('target') or 3}", "status": real_structure_check.get("status") or "blocked"},
        ],
        "requiredFields": required_fields,
        "taskSheetPackage": task_sheet_package,
        "steps": steps,
        "fallbackPaths": fallback_paths[:4],
        "handoff": [
            "导入后先确认素材不是示例、测试、占位或空链接。",
            "有文本后必须加入生成工作流，否则候选脚本不会读取它。",
            "加入后生成结构摘要；结构摘要完成后再进入脚本流程生成候选脚本。",
            "候选脚本必须能在输入证据里看到该素材 sourceId，P0-1 才算通过。",
        ],
        "blockedRules": p01_verifier.get("blockedRules") or first_benchmark_material.get("blockedRules") or [],
        "rule": "执行台只展示真实状态和真实入口，不自动写入或补造素材。",
    }


def v2_dashboard() -> dict:
    brand_name = load_brand_name()
    now = utc_now()
    workday_date = now[:10]
    with connect() as conn:
        workday_record = get_or_create_today_workday(conn, brand_name)
        confirmation = latest_confirmation(conn, brand_name, workday_date)
        hot_run = latest_hot_run(conn)
        selected_hot = latest_confirmed_items(conn, brand_name, "hot", workday_date)
        selected_benchmark = latest_confirmed_items(conn, brand_name, "benchmark", workday_date)
        history_stats = {
            "hotItems": scalar_count(conn, "SELECT COUNT(*) FROM hot_search_items"),
            "benchmarkAccounts": scalar_count(conn, "SELECT COUNT(*) FROM benchmark_accounts WHERE brand_name = ?", (brand_name,)),
            "structureSummaries": scalar_count(conn, "SELECT COUNT(*) FROM prototype_structure_summaries"),
            "scripts": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ?", (brand_name,)),
            "subtitleRows": scalar_count(conn, "SELECT COUNT(*) FROM benchmark_video_subtitles"),
            "subtitleJobs": scalar_count(conn, "SELECT COUNT(*) FROM subtitle_jobs WHERE brand_name = ?", (brand_name,)),
            "successfulSubtitleJobs": scalar_count(conn, "SELECT COUNT(*) FROM subtitle_jobs WHERE brand_name = ? AND status = 'success'", (brand_name,)),
            "contentSources": scalar_count(conn, "SELECT COUNT(*) FROM content_sources WHERE brand_name = ?", (brand_name,)),
            "contentStructures": scalar_count(conn, "SELECT COUNT(*) FROM content_structures WHERE brand_name = ?", (brand_name,)),
            "brandProducts": scalar_count(conn, "SELECT COUNT(*) FROM brand_products WHERE brand_name = ?", (brand_name,)),
            "collectionTasks": scalar_count(conn, "SELECT COUNT(*) FROM collection_tasks WHERE brand_name = ?", (brand_name,)),
            "failedCollectionTasks": scalar_count(conn, "SELECT COUNT(*) FROM collection_tasks WHERE brand_name = ? AND status = 'failed'", (brand_name,)),
        }
        stats = {
            "hotItems": history_stats["hotItems"],
            "benchmarkAccounts": history_stats["benchmarkAccounts"],
            "structureSummaries": scalar_count(conn, "SELECT COUNT(*) FROM prototype_structure_summaries WHERE brand_name = ? AND substr(created_at, 1, 10) = ?", (brand_name, workday_date)),
            "scripts": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND substr(created_at, 1, 10) = ?", (brand_name, workday_date)),
            "subtitleRows": history_stats["subtitleRows"],
            "subtitleJobs": history_stats["subtitleJobs"],
            "successfulSubtitleJobs": history_stats["successfulSubtitleJobs"],
            "contentSources": scalar_count(conn, "SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND workday_date = ?", (brand_name, workday_date)),
            "operationalContentSources": scalar_count(
                conn,
                f"SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND workday_date = ? AND {CONTENT_SOURCE_OPERATIONAL_SQL}",
                (brand_name, workday_date),
            ),
            "excludedContentSources": scalar_count(
                conn,
                f"SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND workday_date = ? AND NOT ({CONTENT_SOURCE_OPERATIONAL_SQL})",
                (brand_name, workday_date),
            ),
            "selectedContentSources": scalar_count(
                conn,
                f"SELECT COUNT(*) FROM content_sources WHERE brand_name = ? AND selected = 1 AND workday_date = ? AND {CONTENT_SOURCE_OPERATIONAL_SQL}",
                (brand_name, workday_date),
            ),
            "contentStructures": scalar_count(
                conn,
                f"""
                SELECT COUNT(*)
                FROM content_structures cst
                JOIN content_sources cs ON cs.id = cst.source_id
                WHERE cst.brand_name = ? AND cs.workday_date = ?
                  AND {CONTENT_SOURCE_OPERATIONAL_SQL}
                """,
                (brand_name, workday_date),
            ),
            "brandProducts": history_stats["brandProducts"],
            "selectedBrandProducts": scalar_count(conn, "SELECT COUNT(*) FROM brand_products WHERE brand_name = ? AND selected = 1", (brand_name,)),
            "collectionTasks": scalar_count(conn, "SELECT COUNT(*) FROM collection_tasks WHERE brand_name = ? AND substr(created_at, 1, 10) = ?", (brand_name, workday_date)),
            "failedCollectionTasks": scalar_count(conn, "SELECT COUNT(*) FROM collection_tasks WHERE brand_name = ? AND status = 'failed' AND substr(created_at, 1, 10) = ?", (brand_name, workday_date)),
            "newScripts": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'new' AND substr(created_at, 1, 10) = ?", (brand_name, workday_date)),
            "adoptedScripts": scalar_count(conn, "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND review_status = 'adopted' AND substr(created_at, 1, 10) = ?", (brand_name, workday_date)),
        }
        scripts = latest_scripts(conn, workday_date=workday_date)
        review_queue = review_queue_scripts(conn, brand_name, workday_date)
        ensure_default_collection_schedules(conn, brand_name)
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
        collection_schedules = [serialize_collection_schedule(row) for row in schedule_rows]
        latest_collection_task_map = latest_collection_tasks_by_strategy(conn, brand_name)
        collection_tasks = list(latest_collection_task_map.values())
        collection_strategy = collection_strategy_snapshot(collection_schedules, latest_collection_task_map, hot_run)
        benchmark_update_snapshot = benchmark_update_tasks_snapshot(conn, brand_name, workday_date)
        stats["benchmarkUpdateTasks"] = {
            "total": len(benchmark_update_snapshot.get("items") or []),
            "pendingCount": benchmark_update_snapshot.get("pendingCount") or 0,
            "doneCount": benchmark_update_snapshot.get("doneCount") or 0,
        }
        selected_structure_count = scalar_count(
            conn,
            f"""
            SELECT COUNT(DISTINCT cs.id)
            FROM content_sources cs
            JOIN content_structures cst ON cst.source_id = cs.id
            WHERE cs.brand_name = ? AND cs.selected = 1 AND cs.workday_date = ?
              AND {CONTENT_SOURCE_OPERATIONAL_SQL}
            """,
            (brand_name, workday_date),
        )
        template_count = scalar_count(
            conn,
            "SELECT COUNT(*) FROM daily_script_candidates WHERE brand_name = ? AND is_template = 1",
            (brand_name,),
        )
        content_source_rows = conn.execute(
            """
            SELECT id, workday_date, brand_name, platform, source_type, title,
                   url, account_name, raw_text, note, import_method, status,
                   selected, benchmark_update_task_id, created_at, updated_at
            FROM content_sources
            WHERE brand_name = ? AND workday_date = ?
            ORDER BY id DESC
            LIMIT 5
            """,
            (brand_name, workday_date),
        ).fetchall()
        content_sources = [
            attach_benchmark_task(conn, serialize_content_source(row, latest_content_structure(conn, row["id"]), latest_subtitle_job(conn, row["id"])))
            for row in content_source_rows
        ]
        selected_content_sources = selected_content_sources_for_workflow(conn, brand_name, workday_date)
        brand_products = list_brand_products()
        adopted_topic_items = adopted_topics(conn, brand_name, workday_date)
        readiness = build_generation_readiness(
            len(selected_hot),
            len(selected_benchmark),
            selected_structure_count,
            stats["selectedBrandProducts"],
            template_count,
            len(adopted_topic_items),
        )
        review_insights = build_review_insights(conn, brand_name)
        quality_learning_plan = build_quality_learning_plan(conn, brand_name, review_insights)
        adopted_topic_id_set = {item["id"] for item in adopted_topic_items}
        topic_recommendations = build_topic_recommendations(
            selected_hot,
            selected_benchmark,
            content_sources,
            brand_products,
            review_insights,
            adopted_topic_id_set,
        )
        current_workflow = {
            "confirmationId": confirmation["id"] if confirmation else None,
            "hotCount": len(selected_hot),
            "benchmarkCount": len(selected_benchmark),
            "manualSourceCount": stats["selectedContentSources"],
            "structuredManualSourceCount": selected_structure_count,
            "selectedProductCount": stats["selectedBrandProducts"],
            "templateCount": template_count,
            "adoptedTopicCount": len(adopted_topic_items),
            "adoptedTopics": adopted_topic_items,
            "rule": "今日工作流刷新默认清空；这里仅暴露最近确认包作为状态证据。",
        }
        r2_candidate_sources = build_r2_candidate_sources(conn, brand_name, workday_date)
        r2_input_verifier = build_r2_input_verifier(
            stats,
            current_workflow,
            readiness,
            selected_content_sources,
            brand_products,
            review_insights,
            r2_candidate_sources,
        )
        r2_daily_execution_plan = build_r2_daily_execution_plan(r2_input_verifier)
        workflow_overview = build_workflow_overview(
            stats,
            current_workflow,
            readiness,
            collection_strategy,
            topic_recommendations,
            review_insights,
        )
        data_source_matrix = data_source_matrix_snapshot(
            stats,
            history_stats,
            collection_strategy,
            hot_run,
            content_sources,
            scripts,
            benchmark_update_snapshot,
        )
        collection_action_flow = collection_action_flow_snapshot(data_source_matrix, collection_strategy, readiness)
        collection_fallback_desk = collection_fallback_desk_snapshot(data_source_matrix, collection_action_flow, readiness)
        collection_guarantee_hub = collection_guarantee_hub_snapshot(
            collection_strategy,
            data_source_matrix,
            collection_action_flow,
            collection_fallback_desk,
        )
        collection_daily_review = collection_daily_review_snapshot(
            stats,
            data_source_matrix,
            collection_action_flow,
            collection_fallback_desk,
            benchmark_update_snapshot,
            readiness,
            review_insights,
        )
        real_data_loop_audit = build_real_data_loop_audit(
            stats,
            current_workflow,
            readiness,
            data_source_matrix,
            benchmark_update_snapshot,
            review_insights,
        )
        single_material_loop = build_single_material_loop(conn, brand_name, workday_date, benchmark_update_snapshot)
        first_benchmark_material = first_benchmark_material_plan(benchmark_update_snapshot, single_material_loop)
        p01_verifier = p01_acceptance_verifier(conn, brand_name, first_benchmark_material)
        collection_fallback_switcher = collection_fallback_switcher_snapshot(
            data_source_matrix,
            collection_fallback_desk,
            first_benchmark_material,
        )
        collection_fallback_trace = collection_fallback_trace_snapshot(conn, brand_name)
        release_readiness = build_release_readiness(
            stats,
            history_stats,
            workflow_overview,
            readiness,
            collection_strategy,
            review_insights,
            review_queue,
        )
        product_vision_map = build_product_vision_map(
            stats,
            history_stats,
            workflow_overview,
            readiness,
            collection_strategy,
            review_insights,
            release_readiness,
        )
        development_board = build_development_board(
            release_readiness,
            product_vision_map,
            workflow_overview,
            collection_fallback_desk,
            first_benchmark_material,
        )
        target_system_plan = build_target_system_plan(
            stats,
            history_stats,
            workflow_overview,
            release_readiness,
            collection_strategy,
            collection_fallback_desk,
            review_insights,
        )
        v2_experience_gap_board = build_v2_experience_gap_board(
            target_system_plan,
            workflow_overview,
            readiness,
            collection_guarantee_hub,
            collection_fallback_switcher,
            review_insights,
            release_readiness,
            stats,
        )
        v2_master_plan = build_v2_master_plan(
            target_system_plan,
            development_board,
            product_vision_map,
            collection_strategy,
            first_benchmark_material,
        )
        v2_acceptance_board = build_v2_acceptance_board(release_readiness, v2_master_plan)
        tasks = build_dashboard_tasks(conn, brand_name, workday_date, data_source_matrix, collection_action_flow)
    workday = {
        **workday_record,
        "mode": "daily_workday",
        "scope": "today",
        "rule": "今日工作台只统计当天素材、任务和脚本；历史资产进入脚本库复盘。",
    }
    workday_opening_reminder = workday_opening_reminder_snapshot(workday, collection_daily_review)
    if workday_opening_reminder.get("priorityCount"):
        tasks = [
            {
                "priority": "high" if workday_opening_reminder.get("blockerCount") else "medium",
                "title": workday_opening_reminder.get("headline") or "开工提醒",
                "description": workday_opening_reminder.get("summary") or "",
                "count": workday_opening_reminder.get("priorityCount") or 0,
                "status": "opening_reminder",
                "actionLabel": workday_opening_reminder.get("nextAction") or "去处理",
                "href": workday_opening_reminder.get("nextHref") or "./collection-center.html?v=opening-reminder-v1#daily-review",
            },
            *tasks,
        ]
    v2_execution_queue = build_v2_execution_queue(
        v2_acceptance_board,
        first_benchmark_material,
        readiness,
        real_data_loop_audit,
        collection_guarantee_hub,
        tasks,
    )
    v2_product_charter = build_v2_product_charter(
        stats,
        history_stats,
        target_system_plan,
        development_board,
        product_vision_map,
        collection_strategy,
        collection_fallback_switcher,
        v2_execution_queue,
        r2_input_verifier,
    )
    v2_release_roadmap = build_v2_release_roadmap(
        release_readiness,
        v2_acceptance_board,
        v2_execution_queue,
    )
    v2_module_board = build_v2_module_board(
        stats,
        history_stats,
        current_workflow,
        readiness,
        review_insights,
        collection_guarantee_hub,
        release_readiness,
        first_benchmark_material,
        v2_execution_queue,
    )
    v2_build_manifest = build_v2_build_manifest(
        stats,
        history_stats,
        v2_product_charter,
        development_board,
        v2_module_board,
        release_readiness,
        collection_fallback_switcher,
        p01_verifier,
        r2_input_verifier,
    )
    v2_objective_audit = build_v2_objective_audit(
        v2_product_charter,
        v2_build_manifest,
        v2_acceptance_board,
        v2_experience_gap_board,
        v2_release_roadmap,
        v2_execution_queue,
        collection_fallback_switcher,
        p01_verifier,
        r2_input_verifier,
    )
    v2_objective_implementation_plan = build_v2_objective_implementation_plan(
        v2_objective_audit,
        development_board,
        v2_build_manifest,
        v2_release_roadmap,
        v2_execution_queue,
    )
    v2_current_sprint_workspace = build_v2_current_sprint_workspace(
        v2_objective_implementation_plan,
        first_benchmark_material,
        p01_verifier,
        collection_fallback_switcher,
        r2_input_verifier,
    )
    data_sources = [
        {
            "name": "抖音总热榜",
            "status": "ok" if hot_run else "missing",
            "lastSuccessAt": hot_run["fetchedAt"] if hot_run else "",
            "count": hot_run["itemCount"] if hot_run else 0,
            "fallback": "人工导入热点或第三方热点 CSV",
        },
        {
            "name": "对标账号池",
            "status": "metadata_only" if stats["benchmarkAccounts"] else "missing",
            "lastSuccessAt": "",
            "count": stats["benchmarkAccounts"],
            "fallback": "手工维护账号池和视频链接",
        },
        {
            "name": "字幕结构化",
            "status": "partial" if stats["subtitleRows"] else "pending",
            "lastSuccessAt": "",
            "count": stats["subtitleRows"],
            "fallback": "手工粘贴字幕进入结构摘要",
        },
        {
            "name": "历史脚本库",
            "status": "ok" if stats["scripts"] else "empty",
            "lastSuccessAt": scripts[0]["createdAt"] if scripts else "",
            "count": stats["scripts"],
            "fallback": "当前工作流重新生成",
        },
        {
            "name": "人工导入",
            "status": "ok" if stats["contentSources"] else "empty",
            "lastSuccessAt": content_sources[0]["createdAt"] if content_sources else "",
            "count": stats["contentSources"],
            "fallback": "通过链接、批量文本或手工字幕补充素材",
        },
    ]
    return {
        "ok": True,
        "version": "v2_dashboard_v1",
        "workday": workday,
        "brand": {"name": brand_name},
        "stats": stats,
        "historyStats": history_stats,
        "currentWorkflow": current_workflow,
        "workflowOverview": workflow_overview,
        "v2ModuleBoard": v2_module_board,
        "v2ProductCharter": v2_product_charter,
        "v2ObjectiveAudit": v2_objective_audit,
        "v2ObjectiveImplementationPlan": v2_objective_implementation_plan,
        "v2CurrentSprintWorkspace": v2_current_sprint_workspace,
        "v2BuildManifest": v2_build_manifest,
        "v2MasterPlan": v2_master_plan,
        "v2AcceptanceBoard": v2_acceptance_board,
        "v2ReleaseRoadmap": v2_release_roadmap,
        "v2ExecutionQueue": v2_execution_queue,
        "productVisionMap": product_vision_map,
        "targetSystemPlan": target_system_plan,
        "developmentBoard": development_board,
        "v2ExperienceGapBoard": v2_experience_gap_board,
        "releaseReadiness": release_readiness,
        "realDataLoopAudit": real_data_loop_audit,
        "singleMaterialLoop": single_material_loop,
        "firstBenchmarkMaterialPlan": first_benchmark_material,
        "p01AcceptanceVerifier": p01_verifier,
        "r2InputVerifier": r2_input_verifier,
        "r2DailyExecutionPlan": r2_daily_execution_plan,
        "generationReadiness": readiness,
        "reviewInsights": review_insights,
        "qualityLearningPlan": quality_learning_plan,
        "topicRecommendations": topic_recommendations,
        "dataSources": data_sources,
        "dataSourceMatrix": data_source_matrix,
        "collectionGuaranteeHub": collection_guarantee_hub,
        "collectionActionFlow": collection_action_flow,
        "collectionFallbackDesk": collection_fallback_desk,
        "collectionFallbackSwitcher": collection_fallback_switcher,
        "collectionFallbackTrace": collection_fallback_trace,
        "collectionDailyReview": collection_daily_review,
        "workdayOpeningReminder": workday_opening_reminder,
        "collectionStrategy": collection_strategy,
        "tasks": tasks,
        "latestScripts": scripts,
        "reviewQueue": review_queue,
        "contentSources": content_sources,
        "selectedContentSources": selected_content_sources,
        "brandProducts": brand_products,
        "collectionTasks": collection_tasks,
        "benchmarkUpdateTasks": benchmark_update_snapshot,
        "operationHandoffs": list_operation_handoffs(limit=3).get("items", []),
    }


def upsert_selection(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    source_type = data.get("sourceType")
    source_id = data.get("sourceId")
    title = data.get("title") or ""
    selected = 1 if data.get("selected") else 0
    payload = data.get("payload") or {}
    if source_type not in {"hot", "benchmark"}:
        raise ValueError("sourceType must be hot or benchmark")
    if not source_id:
        raise ValueError("sourceId is required")

    now = utc_now()
    with connect() as conn:
        existing = conn.execute(
            """
            SELECT created_at
            FROM operator_video_selections
            WHERE brand_name = ? AND source_type = ? AND source_id = ?
            """,
            (brand_name, source_type, source_id),
        ).fetchone()
        conn.execute(
            """
            INSERT INTO operator_video_selections (
              brand_name, source_type, source_id, title, payload_json,
              selected, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(brand_name, source_type, source_id) DO UPDATE SET
              title = excluded.title,
              payload_json = excluded.payload_json,
              selected = excluded.selected,
              updated_at = excluded.updated_at
            """,
            (
                brand_name,
                source_type,
                source_id,
                title,
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                selected,
                existing["created_at"] if existing else now,
                now,
            ),
        )
        conn.commit()
    return {
        "brandName": brand_name,
        "sourceType": source_type,
        "sourceId": source_id,
        "title": title,
        "selected": bool(selected),
        "updatedAt": now,
    }


def latest_selected_items(conn: sqlite3.Connection, brand_name: str, source_type: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT source_id, title, payload_json
        FROM operator_video_selections
        WHERE brand_name = ? AND source_type = ? AND selected = 1
        ORDER BY updated_at DESC
        LIMIT 3
        """,
        (brand_name, source_type),
    ).fetchall()
    items: list[dict] = []
    for row in rows:
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        items.append({"sourceId": row["source_id"], "title": row["title"], "payload": payload})
    return items


def latest_confirmation(conn: sqlite3.Connection, brand_name: str, workday_date: str | None = None) -> sqlite3.Row | None:
    date_clause = "AND substr(created_at, 1, 10) = ?" if workday_date else ""
    params: tuple[object, ...] = (brand_name, workday_date) if workday_date else (brand_name,)
    return conn.execute(
        f"""
        SELECT id, selected_hot_json, selected_benchmark_json, created_at
        FROM operator_selection_confirmations
        WHERE brand_name = ? AND status = 'confirmed' {date_clause}
        ORDER BY id DESC
        LIMIT 1
        """,
        params,
    ).fetchone()


def latest_confirmed_items(conn: sqlite3.Connection, brand_name: str, source_type: str, workday_date: str | None = None) -> list[dict]:
    row = latest_confirmation(conn, brand_name, workday_date)
    if not row:
        return []
    field = "selected_hot_json" if source_type == "hot" else "selected_benchmark_json"
    try:
        return json.loads(row[field] or "[]")
    except json.JSONDecodeError:
        return []


def confirm_selection(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    now = utc_now()
    with connect() as conn:
        hot_items = latest_selected_items(conn, brand_name, "hot")
        benchmark_items = latest_selected_items(conn, brand_name, "benchmark")
        if not hot_items and not benchmark_items:
            raise ValueError("至少选择 1 条热点或对标视频后再确认")
        cursor = conn.execute(
            """
            INSERT INTO operator_selection_confirmations (
              brand_name, selected_hot_json, selected_benchmark_json, status, created_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                json.dumps(hot_items, ensure_ascii=False, separators=(",", ":")),
                json.dumps(benchmark_items, ensure_ascii=False, separators=(",", ":")),
                "confirmed",
                now,
            ),
        )
        conn.commit()
    return {
        "confirmationId": cursor.lastrowid,
        "hotCount": len(hot_items),
        "benchmarkCount": len(benchmark_items),
        "createdAt": now,
    }


def adopted_topic_ids(conn: sqlite3.Connection, brand_name: str, workday_date: str) -> set[str]:
    rows = conn.execute(
        """
        SELECT source_id
        FROM operator_video_selections
        WHERE brand_name = ?
          AND source_type = 'topic'
          AND selected = 1
          AND substr(updated_at, 1, 10) = ?
        """,
        (brand_name, workday_date),
    ).fetchall()
    return {row["source_id"] for row in rows}


def adopted_topics(conn: sqlite3.Connection, brand_name: str, workday_date: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT source_id, title, payload_json, updated_at
        FROM operator_video_selections
        WHERE brand_name = ?
          AND source_type = 'topic'
          AND selected = 1
          AND substr(updated_at, 1, 10) = ?
        ORDER BY updated_at DESC
        LIMIT 3
        """,
        (brand_name, workday_date),
    ).fetchall()
    items: list[dict] = []
    for row in rows:
        try:
            payload = json.loads(row["payload_json"] or "{}")
        except json.JSONDecodeError:
            payload = {}
        items.append({
            "id": row["source_id"],
            "title": row["title"],
            "angle": payload.get("angle") or "",
            "score": payload.get("score") or 0,
            "sourceHot": payload.get("sourceHot") or "",
            "sourceStructure": payload.get("sourceStructure") or "",
            "sourceProduct": payload.get("sourceProduct") or "",
            "sourceTemplate": payload.get("sourceTemplate") or "",
            "adoptedAt": payload.get("adoptedAt") or row["updated_at"],
        })
    return items


def adopt_topic_recommendation(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    topic = data.get("topic") or {}
    if not isinstance(topic, dict):
        raise ValueError("topic 必须是对象")
    topic_id = (topic.get("id") or "").strip()
    if not topic_id:
        raise ValueError("topic.id 必须填写")
    topic_title = (topic.get("title") or "今日推荐选题").strip()
    source_hot = (topic.get("sourceHot") or "品牌日常选题").strip()
    source_structure = (topic.get("sourceStructure") or "推荐结构").strip()
    now = utc_now()
    hot_payload = {
        "title": source_hot,
        "topic": topic.get("angle") or topic_title,
        "recommendationId": topic_id,
        "recommendationTitle": topic_title,
        "score": topic.get("score") or 0,
        "sourceProduct": topic.get("sourceProduct") or "",
        "sourceTemplate": topic.get("sourceTemplate") or "",
    }
    benchmark_payload = {
        "account": "今日推荐选题",
        "pattern": source_structure,
        "summary": topic.get("angle") or source_structure,
        "recommendationId": topic_id,
        "recommendationTitle": topic_title,
    }
    topic_payload = {
        **topic,
        "adoptedAt": now,
        "rule": "运营采用推荐选题后，系统写入热点/结构选择并自动确认本次输入包。",
    }
    with connect() as conn:
        for source_type, source_id, title, payload in [
            ("topic", topic_id, topic_title, topic_payload),
            ("hot", f"{topic_id}:hot", source_hot, hot_payload),
            ("benchmark", f"{topic_id}:structure", source_structure, benchmark_payload),
        ]:
            conn.execute(
                """
                INSERT INTO operator_video_selections (
                  brand_name, source_type, source_id, title, payload_json,
                  selected, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(brand_name, source_type, source_id) DO UPDATE SET
                  title = excluded.title,
                  payload_json = excluded.payload_json,
                  selected = excluded.selected,
                  updated_at = excluded.updated_at
                """,
                (
                    brand_name,
                    source_type,
                    source_id,
                    title,
                    json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                    1,
                    now,
                    now,
                ),
            )
        hot_items = latest_selected_items(conn, brand_name, "hot")
        benchmark_items = latest_selected_items(conn, brand_name, "benchmark")
        cursor = conn.execute(
            """
            INSERT INTO operator_selection_confirmations (
              brand_name, selected_hot_json, selected_benchmark_json, status, created_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                json.dumps(hot_items, ensure_ascii=False, separators=(",", ":")),
                json.dumps(benchmark_items, ensure_ascii=False, separators=(",", ":")),
                "confirmed",
                now,
            ),
        )
        conn.commit()
    return {
        "topic": topic_payload,
        "confirmation": {
            "confirmationId": cursor.lastrowid,
            "hotCount": len(hot_items),
            "benchmarkCount": len(benchmark_items),
            "createdAt": now,
        },
    }


def build_structure_summary(source_type: str, item: dict) -> dict:
    payload = item.get("payload") or {}
    if source_type == "hot":
        return {
            "source": "douyin_hot_search",
            "source_title": payload.get("title") or item.get("title"),
            "status_note": "真实热榜已入库；无视频链接，字幕待接入",
            "hook_angle": payload.get("topic") or "热点观察",
            "usable_parts": ["热点词", "热度排序", "品牌嫁接角度"],
            "risk_notes": ["未做具体视频字幕复核", "不得直接使用未经授权的视频素材"],
        }
    if source_type == "content_source":
        has_text = bool((item.get("rawText") or "").strip())
        return {
            "source": "manual_content_source",
            "source_title": item.get("title"),
            "status_note": "已导入人工素材；可基于字幕/备注先做结构拆解" if has_text else "已导入人工素材链接；待提取字幕后完善结构",
            "hook_angle": "从导入素材提炼可复用开头",
            "script_pattern": "人工导入素材结构",
            "account": item.get("accountName") or "人工导入",
            "usable_parts": ["标题", "链接或字幕文本", "账号来源", "运营备注"],
            "operator_actions": ["确认素材是否可借鉴", "有链接时补字幕提取", "把可用结构加入生成工作流"],
            "risk_notes": ["仅学习结构，不复制原视频表达", "发布前复核版权、价格和活动权益"],
        }
    return {
        "source": "benchmark_account_pool",
        "source_title": item.get("title"),
        "status_note": "真实对标账号池已入库；固定视频链接待运营补充",
        "script_pattern": payload.get("pattern") or "对标结构",
        "account": payload.get("account") or item.get("title"),
        "usable_parts": ["账号类型", "内容结构", "转化方式"],
        "risk_notes": ["仅学习结构，不复制原视频表达", "待接真实字幕后更新摘要"],
    }


def build_structure_prompt(brand: dict, source_type: str, item: dict) -> str:
    payload = {
        "brand": {
            "brand_name": brand.get("brand_name"),
            "target_audience": brand.get("target_audience"),
            "primary_platform": brand.get("primary_platform"),
            "duration_seconds": brand.get("single_video_duration_seconds", 15),
            "content_tone": brand.get("content_tone", []),
            "taboo_rules": brand.get("taboo_rules", []),
        },
        "source_type": source_type,
        "item": item,
    }
    return (
        "你是短视频运营选题分析器。请基于品牌信息和素材，判断这条素材如何进入每日脚本库。\n"
        "必须只输出 JSON，不要 Markdown，不要解释。\n"
        "JSON 格式：{\"status_note\":\"\",\"hook_angle\":\"\",\"script_pattern\":\"\",\"usable_parts\":[\"\"],\"operator_actions\":[\"\"],\"risk_notes\":[\"\"],\"codex_note\":\"\"}\n"
        "要求：\n"
        "1. 如果 source_type=hot，重点判断热点词如何嫁接到品牌，不要假装已有视频字幕。\n"
        "2. 如果 source_type=benchmark，重点判断可借鉴的结构，不要复制原账号表达。\n"
        "3. usable_parts 必须是运营可以拿去生成脚本的具体输入。\n"
        "4. operator_actions 写下一步运营动作，例如补视频链接、提取字幕、确认可用角度。\n"
        "5. risk_notes 写发布前需要复核的风险。\n"
        "6. 如果 source_type=content_source，优先从 rawText/备注中拆开头、节奏、CTA，不要编造视频画面。\n"
        "输入 JSON：\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )


def normalize_structure_summary(source_type: str, item: dict, summary: dict, generator: str) -> dict:
    fallback = build_structure_summary(source_type, item)
    usable_parts = summary.get("usable_parts") if isinstance(summary.get("usable_parts"), list) else fallback["usable_parts"]
    risk_notes = summary.get("risk_notes") if isinstance(summary.get("risk_notes"), list) else fallback["risk_notes"]
    operator_actions = summary.get("operator_actions") if isinstance(summary.get("operator_actions"), list) else []
    return {
        **fallback,
        "status_note": summary.get("status_note") or fallback["status_note"],
        "hook_angle": summary.get("hook_angle") or fallback.get("hook_angle") or summary.get("script_pattern") or "",
        "script_pattern": summary.get("script_pattern") or fallback.get("script_pattern") or "",
        "usable_parts": [str(part) for part in usable_parts if str(part).strip()][:5],
        "operator_actions": [str(action) for action in operator_actions if str(action).strip()][:5],
        "risk_notes": [str(note) for note in risk_notes if str(note).strip()][:5],
        "codex_note": summary.get("codex_note") or ("由 Codex CLI 分析素材结构。" if generator == "codex_cli" else "由本地规则生成结构摘要。"),
        "generator": generator,
    }


def generate_structure_summary_with_codex_cli(brand: dict, source_type: str, item: dict) -> dict:
    prompt = build_structure_prompt(brand, source_type, item)
    with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False) as output_file:
        output_path = Path(output_file.name)
    try:
        result = subprocess.run(
            [
                DEFAULT_CODEX_BIN,
                "--ask-for-approval",
                "never",
                "exec",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "--output-last-message",
                str(output_path),
                "-",
            ],
            input=prompt,
            cwd=Path.cwd(),
            text=True,
            capture_output=True,
            check=False,
            timeout=90,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "codex cli failed")
        raw = output_path.read_text(encoding="utf-8")
        data = extract_json_object(raw)
        return normalize_structure_summary(source_type, item, data, "codex_cli")
    finally:
        try:
            output_path.unlink()
        except FileNotFoundError:
            pass


def generate_structure_summary(brand: dict, source_type: str, item: dict) -> tuple[dict, str]:
    if USE_CODEX_CLI:
        try:
            return generate_structure_summary_with_codex_cli(brand, source_type, item), "metadata_ready"
        except Exception as exc:
            summary = normalize_structure_summary(source_type, item, {}, "local_fallback")
            summary["codex_error"] = str(exc)
            return summary, "codex_failed"
    return normalize_structure_summary(source_type, item, {}, "local_fallback"), "metadata_ready"


def generate_candidate_script(
    brand: dict,
    hot: dict,
    benchmark: dict,
    index: int,
    input_structures: list[dict] | None = None,
    input_products: list[dict] | None = None,
    input_templates: list[dict] | None = None,
    input_feedback: list[dict] | None = None,
) -> dict:
    input_structures = input_structures or []
    input_products = input_products or []
    input_templates = input_templates or []
    input_feedback = input_feedback or []
    hot_payload = hot.get("payload") or {}
    benchmark_payload = benchmark.get("payload") or {}
    structure = input_structures[index % len(input_structures)] if input_structures else {}
    structure_body = structure.get("structure") or {}
    hot_title = hot_payload.get("title") or hot.get("title") or "今日热点"
    topic = hot_payload.get("topic") or "热点观察"
    account = benchmark_payload.get("account") or benchmark.get("title") or "品牌自有结构"
    pattern = structure_body.get("script_pattern") or benchmark_payload.get("pattern") or "短视频结构"
    audience = brand.get("target_audience") or "目标用户"
    duration = brand.get("single_video_duration_seconds") or 15
    product = input_products[index % len(input_products)] if input_products else {}
    product_name = product.get("productName") or "门店商品"
    product_points = product.get("sellingPoints") or []
    activity_rules = product.get("activityRules") or "以门店当天活动为准"
    price_note = product.get("priceNote") or "不承诺具体价格"
    template = input_templates[index % len(input_templates)] if input_templates else {}
    template_hook = template.get("hook") or ""
    template_pattern = template.get("sourcePattern") or ""
    reuse_feedback = [item for item in input_feedback if item.get("type") == "reuse"]
    avoid_feedback = [item for item in input_feedback if item.get("type") == "avoid"]
    feedback_pattern = reuse_feedback[index % len(reuse_feedback)]["label"] if reuse_feedback else ""
    avoid_pattern = avoid_feedback[0]["label"] if avoid_feedback else ""

    angles = [
        ("到店理由", "今天路过商场别急着走，阿迪这波活动可以进店看一眼。", "门店门头 + 鞋墙快速扫过"),
        ("穿搭场景", "高关注日子里，穿得舒服比穿得复杂更重要。", "脚步特写 + 上脚走动 + 全身穿搭"),
        ("限时动作", "今天想买运动鞋，先别直接原价下单。", "价格牌/团购券/导购拿鞋动作"),
        ("轻剧情", "别人今天忙着看热点，我今天只想找一双好走的鞋。", "用户刷手机转场到试鞋镜头"),
        ("导购问答", "导购一句话：想省时间，就先试这双百搭款。", "导购拿鞋递给顾客 + 上脚反馈"),
    ]
    angle_name, spoken_line, visual_direction = angles[index % len(angles)]

    title = f"{hot_title} x {pattern}：{angle_name}版15秒脚本"
    hook = template_hook or f"把“{hot_title}”作为开头注意力，用{feedback_pattern or pattern}结构转到门店团购。"
    structure_hint = ""
    usable_parts = structure_body.get("usable_parts") if isinstance(structure_body.get("usable_parts"), list) else []
    if usable_parts:
        structure_hint = f"参考结构摘要：{usable_parts[0]}"
    shots = [
        {
            "time": "0-3s",
            "shot": "手机热榜/门店外景快速切入",
            "voiceover": f"今天大家都在刷“{hot_title}”，但我更关心一件事。",
            "subtitle": f"{hot_title}，普通人可以这样接",
            "purpose": "借真实热点拿到前3秒注意力",
        },
        {
            "time": "3-8s",
            "shot": visual_direction,
            "voiceover": structure_hint or template_hook or spoken_line,
            "subtitle": angle_name,
            "purpose": f"套用{account}的{feedback_pattern or pattern}表达结构",
        },
        {
            "time": "8-12s",
            "shot": "鞋款细节 + 上脚走两步 + 活动信息露出",
            "voiceover": f"重点看{product_name}，{product_points[0] if product_points else '上脚舒服、好搭'}，{activity_rules}。",
            "subtitle": price_note,
            "purpose": "把品牌和商品利益点落到可感知场景",
        },
        {
            "time": "12-15s",
            "shot": "导购指向团购入口/门店定位/收银台",
            "voiceover": f"想看同款活动，点团购券，进店先试再决定，具体以{product.get('storeScope') or '门店'}为准。",
            "subtitle": "点团购券，进店试穿",
            "purpose": "明确转化动作",
        },
    ]
    outline = "\n".join(
        f"{item['time']}｜镜头：{item['shot']}｜口播：{item['voiceover']}｜字幕：{item['subtitle']}"
        for item in shots
    )
    return {
        "title": title,
        "hook": hook,
        "outline": outline,
        "shots": shots,
        "cta": "点团购券，进店试穿",
        "shooting_notes": ["竖屏拍摄", "前3秒必须出现热点词", "商品露出不要超过真实活动承诺", "发布前复核价格和门店权益"],
        "source_trend_keyword": hot_title,
        "source_benchmark_account": account,
        "source_pattern": pattern,
        "fit_reason": f"热榜来自真实抖音采集；对标结构来自固定账号池；读取了{len(input_structures)}条人工结构摘要、{len(input_products)}条商品活动、{len(input_templates)}条高表现模板和{len(input_feedback)}条复盘反馈。模板结构：{template_pattern or '无'}；优先复用：{feedback_pattern or '无'}；谨慎避开：{avoid_pattern or '无'}",
        "risk_notes": "当前未接真实视频字幕，发布前需要补字幕拆解和品牌合规复核。",
        "candidate_level": "prototype_real_data",
    }


def build_codex_prompt(
    brand: dict,
    hot_items: list[dict],
    benchmark_items: list[dict],
    input_structures: list[dict],
    input_products: list[dict],
    input_templates: list[dict],
    input_feedback: list[dict],
    target: int,
) -> str:
    payload = {
        "brand": {
            "brand_name": brand.get("brand_name"),
            "target_audience": brand.get("target_audience"),
            "primary_platform": brand.get("primary_platform"),
            "duration_seconds": brand.get("single_video_duration_seconds", 15),
            "content_tone": brand.get("content_tone", []),
            "taboo_rules": brand.get("taboo_rules", []),
        },
        "hot_items": hot_items,
        "benchmark_items": benchmark_items,
        "input_structures": input_structures,
        "input_products": input_products,
        "input_templates": input_templates,
        "input_feedback": input_feedback,
        "target": target,
    }
    return (
        "你是一个短视频运营脚本生成器。请基于输入生成可直接拍摄的抖音15秒短视频脚本。\n"
        "必须只输出 JSON，不要 Markdown，不要解释。\n"
        "JSON 格式：{\"scripts\":[{\"title\":\"\",\"hook\":\"\",\"shots\":[{\"time\":\"0-3s\",\"shot\":\"\",\"voiceover\":\"\",\"subtitle\":\"\",\"purpose\":\"\"}],\"cta\":\"\",\"shooting_notes\":[\"\"],\"source_trend_keyword\":\"\",\"source_benchmark_account\":\"\",\"source_pattern\":\"\",\"fit_reason\":\"\",\"risk_notes\":\"\"}]}\n"
        "要求：\n"
        "1. scripts 数量等于 target。\n"
        "2. 每条脚本必须有 4 个 shots：0-3s、3-8s、8-12s、12-15s。\n"
        "3. 口播要像门店团购短视频，能直接拍，不要空泛方向。\n"
        "4. 不能夸大优惠，不能承诺未提供的信息。\n"
        "5. 如果只有热点没有对标，使用品牌自有门店种草结构；如果只有对标没有热点，使用品牌日常选题。\n"
        "6. 如果 input_structures 不为空，必须优先读取其中的 script_pattern、usable_parts、risk_notes，把它们转成具体镜头、口播、CTA。\n"
        "7. 如果 input_products 不为空，必须读取商品名、卖点、活动规则、价格说明和门店范围；不得编造未提供的折扣、价格、库存和核销承诺。\n"
        "8. 如果 input_templates 不为空，必须参考高表现模板的 hook、sourcePattern、outline 和 performance，但不得直接复制旧脚本；要提炼结构后改写到本次热点和商品。\n"
        "9. 如果 input_feedback 不为空，type=reuse 的结构要优先复用，type=avoid 的结构必须避开或明显改写，不要照搬待改/弃用结构。\n"
        "10. fit_reason 必须说明脚本读取了哪些热点、对标结构、人工结构摘要、商品活动、高表现模板和复盘反馈信号。\n"
        "输入 JSON：\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )


def extract_json_object(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def normalize_codex_script(script: dict, brand: dict, hot: dict, benchmark: dict) -> dict:
    fallback = generate_candidate_script(brand, hot, benchmark, 0)
    shots = script.get("shots") if isinstance(script.get("shots"), list) else fallback["shots"]
    normalized_shots = []
    for index, shot in enumerate(shots[:4]):
        default = fallback["shots"][min(index, len(fallback["shots"]) - 1)]
        normalized_shots.append(
            {
                "time": shot.get("time") or default["time"],
                "shot": shot.get("shot") or default["shot"],
                "voiceover": shot.get("voiceover") or default["voiceover"],
                "subtitle": shot.get("subtitle") or default["subtitle"],
                "purpose": shot.get("purpose") or default["purpose"],
            }
        )
    while len(normalized_shots) < 4:
        normalized_shots.append(fallback["shots"][len(normalized_shots)])

    outline = "\n".join(
        f"{item['time']}｜镜头：{item['shot']}｜口播：{item['voiceover']}｜字幕：{item['subtitle']}"
        for item in normalized_shots
    )
    return {
        "title": script.get("title") or fallback["title"],
        "hook": script.get("hook") or fallback["hook"],
        "outline": outline,
        "shots": normalized_shots,
        "cta": script.get("cta") or fallback["cta"],
        "shooting_notes": script.get("shooting_notes") or fallback["shooting_notes"],
        "source_trend_keyword": script.get("source_trend_keyword") or fallback["source_trend_keyword"],
        "source_benchmark_account": script.get("source_benchmark_account") or fallback["source_benchmark_account"],
        "source_pattern": script.get("source_pattern") or fallback["source_pattern"],
        "fit_reason": script.get("fit_reason") or "由 Codex CLI 基于确认素材包和品牌信息生成。",
        "risk_notes": script.get("risk_notes") or fallback["risk_notes"],
        "candidate_level": "codex_cli",
    }


def generate_scripts_with_codex_cli(
    brand: dict,
    hot_items: list[dict],
    benchmark_items: list[dict],
    input_structures: list[dict],
    input_products: list[dict],
    input_templates: list[dict],
    input_feedback: list[dict],
    target: int,
) -> list[dict]:
    prompt = build_codex_prompt(brand, hot_items, benchmark_items, input_structures, input_products, input_templates, input_feedback, target)
    with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False) as output_file:
        output_path = Path(output_file.name)
    try:
        result = subprocess.run(
            [
                "codex",
                "--ask-for-approval",
                "never",
                "exec",
                "--skip-git-repo-check",
                "--output-last-message",
                str(output_path),
                prompt,
            ],
            cwd=Path.cwd(),
            text=True,
            capture_output=True,
            check=False,
            timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "codex cli failed")
        raw = output_path.read_text(encoding="utf-8")
        data = extract_json_object(raw)
        raw_scripts = data.get("scripts", [])
        if not isinstance(raw_scripts, list) or not raw_scripts:
            raise RuntimeError("codex cli returned no scripts")
        scripts = []
        for index in range(target):
            raw_script = raw_scripts[index % len(raw_scripts)]
            hot = hot_items[index % len(hot_items)]
            benchmark = benchmark_items[index % len(benchmark_items)]
            scripts.append(normalize_codex_script(raw_script, brand, hot, benchmark))
        return scripts
    finally:
        try:
            output_path.unlink()
        except FileNotFoundError:
            pass


def require_text(data: dict, key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{key} 必须是非空文本")
    return value.strip()


def optional_text(data: dict, key: str, default: str | None = None) -> str | None:
    value = data.get(key, default)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{key} 必须是文本")
    return value.strip()


def optional_int(data: dict, key: str, default: int, minimum: int, maximum: int) -> int:
    value = data.get(key, default)
    if not isinstance(value, int):
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{key} 必须是整数")
    if value < minimum or value > maximum:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{key} 必须在 {minimum}-{maximum} 之间")
    return value


def resolve_input_file(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    if not path.exists():
        raise ApiError(HTTPStatus.BAD_REQUEST, f"文件不存在: {path}")
    if not path.is_file():
        raise ApiError(HTTPStatus.BAD_REQUEST, f"不是文件: {path}")
    return path


def image2svc_json_post(url: str, payload: dict, timeout: int = 300) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise ApiError(exc.code, "image2svc 服务调用失败", details) from exc
    except urllib.error.URLError as exc:
        raise ApiError(HTTPStatus.BAD_GATEWAY, "无法连接 image2svc 服务", str(exc)) from exc


def image2svc_multipart_post(url: str, fields: list[tuple[str, str]], files: list[tuple[str, Path]], timeout: int = 300) -> dict:
    body, boundary = multipart_body(fields, files)
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise ApiError(exc.code, "image2svc 服务调用失败", details) from exc
    except urllib.error.URLError as exc:
        raise ApiError(HTTPStatus.BAD_GATEWAY, "无法连接 image2svc 服务", str(exc)) from exc


def ensure_image2svc_ok(response: dict, service_name: str) -> dict:
    if not isinstance(response, dict):
        raise ApiError(HTTPStatus.BAD_GATEWAY, f"{service_name} 返回格式错误", response)
    if response.get("errcode") != 0:
        raise ApiError(HTTPStatus.BAD_GATEWAY, response.get("errmsg") or f"{service_name} 调用失败", response)
    data = response.get("data")
    if not isinstance(data, dict):
        raise ApiError(HTTPStatus.BAD_GATEWAY, f"{service_name} 没有返回 data", response)
    return data


def run_image2svc_chat(data: dict) -> dict:
    prompt = require_text(data, "prompt")
    payload = {
        "provider": optional_text(data, "provider", IMAGE2SVC_CHAT_PROVIDER) or IMAGE2SVC_CHAT_PROVIDER,
        "prompt": prompt,
    }
    model = optional_text(data, "model")
    instructions = optional_text(data, "instructions")
    temperature = data.get("temperature")
    max_output_tokens = data.get("max_output_tokens", data.get("maxOutputTokens"))
    if model:
        payload["model"] = model
    if instructions:
        payload["instructions"] = instructions
    if isinstance(temperature, (int, float)):
        payload["temperature"] = temperature
    if isinstance(max_output_tokens, int):
        payload["max_output_tokens"] = max_output_tokens
    endpoint = IMAGE2SVC_CHAT_URL.rstrip("/") + "/v1/chat/completions"
    response = image2svc_json_post(endpoint, payload, timeout=300)
    service_data = ensure_image2svc_ok(response, "image2svc chat 服务")
    return {
        "provider": service_data.get("provider") or payload["provider"],
        "model": service_data.get("model") or payload.get("model") or "",
        "answer": service_data.get("text") or "",
        "usage": service_data.get("usage") or {},
        "image2svc": service_data,
    }


def run_codex_chat(data: dict) -> dict:
    if SIMPLE_AGENT_GENERATOR == "image2svc_chat":
        return run_image2svc_chat(data)
    prompt = require_text(data, "prompt")
    timeout = optional_int(data, "timeoutSeconds", 180, 10, 1800)
    sandbox = optional_text(data, "sandbox", "read-only") or "read-only"
    model = optional_text(data, "model")
    cwd_raw = optional_text(data, "cwd", str(Path.cwd())) or str(Path.cwd())
    cwd = Path(cwd_raw).expanduser().resolve()
    if not cwd.exists() or not cwd.is_dir():
        raise ApiError(HTTPStatus.BAD_REQUEST, f"cwd 目录不存在: {cwd}")

    images = data.get("images") or []
    if not isinstance(images, list):
        raise ApiError(HTTPStatus.BAD_REQUEST, "images 必须是图片路径数组")

    with tempfile.NamedTemporaryFile("w+", suffix=".txt", delete=False) as output_file:
        output_path = Path(output_file.name)

    cmd = [
        DEFAULT_CODEX_BIN,
        "--ask-for-approval",
        "never",
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        sandbox,
        "--output-last-message",
        str(output_path),
    ]
    if model:
        cmd.extend(["--model", model])
    for image in images:
        if not isinstance(image, str):
            raise ApiError(HTTPStatus.BAD_REQUEST, "images 中每一项必须是图片路径")
        cmd.extend(["--image", str(resolve_input_file(image))])
    cmd.append("-")

    try:
        result = subprocess.run(
            cmd,
            input=prompt,
            cwd=str(cwd),
            text=True,
            capture_output=True,
            check=False,
            timeout=timeout,
        )
        answer = output_path.read_text(encoding="utf-8").strip() if output_path.exists() else ""
    except subprocess.TimeoutExpired as exc:
        raise ApiError(HTTPStatus.GATEWAY_TIMEOUT, "Codex CLI 调用超时", {"timeoutSeconds": timeout}) from exc
    finally:
        try:
            output_path.unlink()
        except FileNotFoundError:
            pass

    if result.returncode != 0:
        raise ApiError(
            HTTPStatus.BAD_GATEWAY,
            "Codex CLI 调用失败",
            {"returncode": result.returncode, "stderr": result.stderr[-4000:]},
        )
    return {
        "provider": "codex_cli",
        "answer": answer,
        "usage": "codex --ask-for-approval never exec --skip-git-repo-check --sandbox read-only --output-last-message <file> [--image <path>] <prompt>",
    }


def openai_api_key() -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "缺少 OPENAI_API_KEY，无法调用 OpenAI 图片接口")
    return api_key


def openai_json_post(url: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {openai_api_key()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise ApiError(exc.code, "OpenAI 图片接口调用失败", details) from exc
    except urllib.error.URLError as exc:
        raise ApiError(HTTPStatus.BAD_GATEWAY, "无法连接 OpenAI 图片接口", str(exc)) from exc


def multipart_body(fields: list[tuple[str, str]], files: list[tuple[str, Path]]) -> tuple[bytes, str]:
    boundary = f"----contentwork-image-{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields:
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )
    for name, path in files:
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'.encode(),
                f"Content-Type: {content_type}\r\n\r\n".encode(),
                path.read_bytes(),
                b"\r\n",
            ]
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), boundary


def openai_multipart_post(url: str, fields: list[tuple[str, str]], files: list[tuple[str, Path]]) -> dict:
    body, boundary = multipart_body(fields, files)
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {openai_api_key()}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise ApiError(exc.code, "OpenAI 图片接口调用失败", details) from exc
    except urllib.error.URLError as exc:
        raise ApiError(HTTPStatus.BAD_GATEWAY, "无法连接 OpenAI 图片接口", str(exc)) from exc


def image_options(data: dict) -> dict:
    return {
        "model": optional_text(data, "model", DEFAULT_IMAGE_MODEL) or DEFAULT_IMAGE_MODEL,
        "n": optional_int(data, "n", 1, 1, 4),
        "size": optional_text(data, "size", "auto") or "auto",
        "quality": optional_text(data, "quality", "auto") or "auto",
        "output_format": optional_text(data, "outputFormat", "png") or "png",
        "background": optional_text(data, "background", "auto") or "auto",
    }


def save_b64_image(b64_json: str, output_format: str, prefix: str) -> dict:
    import base64

    IMAGE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "jpg" if output_format == "jpeg" else output_format
    filename = f"{prefix}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}.{suffix}"
    path = IMAGE_OUTPUT_DIR / filename
    path.write_bytes(base64.b64decode(b64_json))
    return {
        "path": str(path.resolve()),
        "url": f"/api/generated/{urllib.parse.quote(filename)}",
        "mimeType": mimetypes.types_map.get(f".{suffix}", "image/png"),
    }


def image_response_from_openai(response: dict, options: dict, prefix: str) -> dict:
    output_format = response.get("output_format") or options["output_format"]
    images = [
        save_b64_image(item["b64_json"], output_format, prefix)
        for item in response.get("data", [])
        if isinstance(item, dict) and item.get("b64_json")
    ]
    if not images:
        raise ApiError(HTTPStatus.BAD_GATEWAY, "OpenAI 图片接口没有返回图片", response)
    return {
        "provider": "openai_images",
        "model": options["model"],
        "images": images,
        "openai": {key: response.get(key) for key in ["created", "usage", "size", "quality", "output_format"]},
    }


def image2svc_image_payload(data: dict, options: dict) -> dict:
    payload = {
        "prompt": require_text(data, "prompt"),
        "provider": optional_text(data, "provider", IMAGE2SVC_IMAGE_PROVIDER) or IMAGE2SVC_IMAGE_PROVIDER,
        "size": options["size"],
        "quality": options["quality"],
        "n": options["n"],
        "background": options["background"],
        "output_format": options["output_format"],
    }
    compression = data.get("outputCompression", data.get("output_compression"))
    if isinstance(compression, int):
        payload["output_compression"] = compression
    user = optional_text(data, "user")
    if user:
        payload["user"] = user
    return payload


def image_response_from_image2svc(response: dict, options: dict) -> dict:
    service_data = ensure_image2svc_ok(response, "image2svc image 服务")
    url = service_data.get("url")
    if not isinstance(url, str) or not url.strip():
        raise ApiError(HTTPStatus.BAD_GATEWAY, "image2svc image 服务没有返回图片 URL", response)
    output_format = service_data.get("output_format") or options["output_format"]
    suffix = "jpg" if output_format == "jpeg" else output_format
    return {
        "provider": service_data.get("provider") or "image2svc",
        "model": service_data.get("model") or options["model"],
        "images": [
            {
                "path": "",
                "url": url.strip(),
                "mimeType": mimetypes.types_map.get(f".{suffix}", "image/jpeg"),
            }
        ],
        "image2svc": service_data,
    }


def generate_image(data: dict) -> dict:
    options = image_options(data)
    if SIMPLE_AGENT_IMAGE_BACKEND != "image2svc":
        prompt = require_text(data, "prompt")
        response = openai_json_post(OPENAI_IMAGES_GENERATIONS_URL, {"prompt": prompt, **options})
        return image_response_from_openai(response, options, "text")
    payload = image2svc_image_payload(data, options)
    endpoint = IMAGE2SVC_IMAGE_URL.rstrip("/") + "/v1/images/generations"
    response = image2svc_json_post(endpoint, payload, timeout=900)
    return image_response_from_image2svc(response, options)


def edit_image(data: dict) -> dict:
    prompt = require_text(data, "prompt")
    image_paths = data.get("images")
    if not isinstance(image_paths, list) or not image_paths:
        raise ApiError(HTTPStatus.BAD_REQUEST, "images 必须是至少 1 张参考图路径")
    if len(image_paths) > 16:
        raise ApiError(HTTPStatus.BAD_REQUEST, "images 最多支持 16 张")
    options = image_options(data)
    if SIMPLE_AGENT_IMAGE_BACKEND != "image2svc":
        fields = [("prompt", prompt)] + [(key, str(value)) for key, value in options.items()]
        files = []
        for image_path in image_paths:
            if not isinstance(image_path, str):
                raise ApiError(HTTPStatus.BAD_REQUEST, "images 中每一项必须是图片路径")
            files.append(("image[]", resolve_input_file(image_path)))
        response = openai_multipart_post(OPENAI_IMAGES_EDITS_URL, fields, files)
        return image_response_from_openai(response, options, "ref")
    payload = image2svc_image_payload(data, options)
    fields = [(key, str(value)) for key, value in payload.items() if key != "model"]
    files = []
    for image_path in image_paths:
        if not isinstance(image_path, str):
            raise ApiError(HTTPStatus.BAD_REQUEST, "images 中每一项必须是图片路径")
        files.append(("image", resolve_input_file(image_path)))
    endpoint = IMAGE2SVC_IMAGE_URL.rstrip("/") + "/v1/images/edits"
    response = image2svc_multipart_post(endpoint, fields, files, timeout=900)
    return image_response_from_image2svc(response, options)


def run_generation(data: dict) -> dict:
    brand_name = data.get("brandName") or load_brand_name()
    brand = load_brand_config()
    now = utc_now()
    with connect() as conn:
        workday_date = current_workday_date()
        confirmation = latest_confirmation(conn, brand_name)
        hot_items = latest_confirmed_items(conn, brand_name, "hot")
        benchmark_items = latest_confirmed_items(conn, brand_name, "benchmark")
        requested_structure_ids = data.get("structureSourceIds") or []
        if requested_structure_ids and not isinstance(requested_structure_ids, list):
            raise ValueError("structureSourceIds 必须是数组")
        input_structures = selected_content_structures(conn, brand_name, source_ids=requested_structure_ids)
        input_products = selected_brand_products(conn, brand_name)
        input_templates = selected_script_templates(conn, brand_name)
        review_insights = build_review_insights(conn, brand_name)
        input_feedback = feedback_signals_for_generation(review_insights)
        input_topics = adopted_topics(conn, brand_name, workday_date)
        if not hot_items and not benchmark_items:
            raise ValueError("请先确认选择，再生成候选脚本")
        if not hot_items:
            hot_items = [
                {
                    "sourceId": "hot-fallback",
                    "title": "品牌日常选题",
                    "payload": {"title": "品牌日常选题", "topic": "品牌转化"},
                }
            ]
        if not benchmark_items:
            benchmark_items = [
                {
                    "sourceId": "benchmark-fallback",
                    "title": "品牌自有短视频结构",
                    "payload": {
                        "account": brand.get("brand_name", "品牌账号"),
                        "pattern": "门店种草",
                        "summary": "品牌自有口播 + 商品展示 + 到店转化",
                    },
                }
            ]

        cursor = conn.execute(
            """
            INSERT INTO prototype_generation_runs (
              brand_name, platform, selected_hot_json, selected_benchmark_json,
              status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                brand_name,
                brand.get("primary_platform", "douyin"),
                json.dumps(hot_items, ensure_ascii=False, separators=(",", ":")),
                json.dumps(benchmark_items, ensure_ascii=False, separators=(",", ":")),
                "ok",
                now,
            ),
        )
        run_id = cursor.lastrowid

        for source_type, items in (("hot", hot_items), ("benchmark", benchmark_items)):
            for item in items:
                structure_summary, summary_status = generate_structure_summary(brand, source_type, item)
                conn.execute(
                    """
                    INSERT INTO prototype_structure_summaries (
                      run_id, brand_name, source_type, source_id, title,
                      summary_json, status, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        brand_name,
                        source_type,
                        item["sourceId"],
                        item["title"],
                        json.dumps(structure_summary, ensure_ascii=False, separators=(",", ":")),
                        summary_status,
                        now,
                    ),
                )

        target = max(1, min(int(data.get("target") or 3), 5))
        try:
            scripts = generate_scripts_with_codex_cli(brand, hot_items, benchmark_items, input_structures, input_products, input_templates, input_feedback, target) if USE_CODEX_CLI else []
        except Exception as exc:
            scripts = []
            codex_error = str(exc)
        else:
            codex_error = ""

        if not scripts:
            scripts = [
                generate_candidate_script(
                    brand,
                    hot_items[index % len(hot_items)],
                    benchmark_items[index % len(benchmark_items)],
                    index,
                    input_structures,
                    input_products,
                    input_templates,
                    input_feedback,
                )
                for index in range(target)
            ]
            for script in scripts:
                script["fit_reason"] = f"{script['fit_reason']} Codex CLI 未成功调用，已使用本地规则兜底：{codex_error}"
            generator = {"name": "local_fallback", "usedFallback": True, "error": codex_error}
        else:
            generator = {"name": "codex_cli", "usedFallback": False, "error": ""}

        for script in scripts:
            script_quality = score_script_quality(script, input_structures, input_products, input_templates)
            quality_status = quality_status_from_score(script_quality)
            script["quality"] = script_quality
            script["input_structures"] = input_structures
            script["input_products"] = input_products
            script["input_templates"] = input_templates
            script["input_feedback"] = input_feedback
            script["input_topics"] = input_topics
            script["quality_status"] = quality_status
            script["review_status"] = "new"
            cursor_script = conn.execute(
                """
                INSERT INTO daily_script_candidates (
                  run_id, brand_name, platform, title, hook, outline,
                  source_trend_keyword, source_benchmark_account, source_pattern,
                  fit_reason, risk_notes, candidate_level, quality_json,
                  input_structure_json, input_product_json, input_template_json, input_feedback_json, input_topic_json, quality_status,
                  review_status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    brand_name,
                    brand.get("primary_platform", "douyin"),
                    script["title"],
                    script["hook"],
                    script["outline"],
                    script["source_trend_keyword"],
                    script["source_benchmark_account"],
                    script["source_pattern"],
                    script["fit_reason"],
                    script["risk_notes"],
                    script["candidate_level"],
                    json.dumps(script_quality, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(input_structures, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(input_products, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(input_templates, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(input_feedback, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(input_topics, ensure_ascii=False, separators=(",", ":")),
                    quality_status,
                    "new",
                    now,
                ),
            )
            script["id"] = cursor_script.lastrowid
        conn.commit()

    return {
        "runId": run_id,
        "confirmationId": confirmation["id"] if confirmation else None,
        "hotCount": len(hot_items),
        "benchmarkCount": len(benchmark_items),
        "inputStructureCount": len(input_structures),
        "requestedStructureSourceIds": requested_structure_ids,
        "inputProductCount": len(input_products),
        "inputTemplateCount": len(input_templates),
        "inputFeedbackCount": len(input_feedback),
        "inputTopicCount": len(input_topics),
        "scriptCount": len(scripts),
        "generator": generator,
        "scripts": scripts,
    }


def export_prototype_data() -> dict:
    result = subprocess.run(
        ["python3", "scripts/export_prototype_data.py"],
        cwd=Path.cwd(),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "export failed")
    return {"stdout": result.stdout.strip()}


class PrototypeHandler(BaseHTTPRequestHandler):
    def current_simple_agent_token(self) -> str | None:
        cookies = parse_cookie_header(self.headers.get("Cookie", ""))
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header.removeprefix("Bearer ").strip()
        return cookies.get("simple_agent_session")

    def current_simple_agent_user(self) -> dict | None:
        return get_simple_agent_user_by_token(self.current_simple_agent_token())

    def require_simple_agent_user(self) -> dict | None:
        user = self.current_simple_agent_user()
        if not user:
            self.send_json({"ok": False, "error": "请先登录"}, status=401)
            return None
        return user

    def simple_agent_cookie(self, token: str, max_age: int) -> str:
        return (
            f"simple_agent_session={urllib.parse.quote(token)}; "
            f"Max-Age={max_age}; Path=/; HttpOnly; SameSite=Lax"
        )

    def do_OPTIONS(self) -> None:
        self.send_empty(204)

    def do_PUT(self) -> None:
        path = urlparse(self.path).path
        if path.startswith("/api/simple-agent/campaigns/"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/campaigns/").strip("/")
            try:
                result = update_simple_campaign(int(raw_id), self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        self.send_json({"ok": False, "error": "not found"}, status=404)

    def do_DELETE(self) -> None:
        path = urlparse(self.path).path
        if path.startswith("/api/simple-agent/campaigns/"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/campaigns/").strip("/")
            try:
                result = delete_simple_campaign(int(raw_id), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        self.send_json({"ok": False, "error": "not found"}, status=404)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json({"ok": True, "service": "contentwork-prototype-api"})
            return
        if path == "/api/simple-agent/session":
            user = self.current_simple_agent_user()
            self.send_json({"ok": True, "authenticated": bool(user), "user": user})
            return
        if path.startswith("/api/simple-agent/") and not self.require_simple_agent_user():
            return
        if path == "/api/v2/dashboard":
            try:
                self.send_json(v2_dashboard())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/workday/today":
            try:
                self.send_json(today_workday())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/operation-handoffs":
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                limit = int((query.get("limit") or ["5"])[0])
                self.send_json(list_operation_handoffs(limit=limit))
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path.startswith("/api/v2/operation-handoffs/"):
            raw_id = path.removeprefix("/api/v2/operation-handoffs/").strip("/")
            try:
                self.send_json(get_operation_handoff(int(raw_id)))
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=404)
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/trends":
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                status = (query.get("status") or [""])[0]
                limit = int((query.get("limit") or ["50"])[0])
                self.send_json(list_trends(status=status, limit=limit))
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/content-sources":
            try:
                items = list_content_sources()
                service = diagnose_video_tools(timeout=2)
                self.send_json(
                    {
                        "ok": True,
                        "items": items,
                        "subtitleReadiness": build_subtitle_readiness(items, service),
                        "thirdPartyReadiness": build_third_party_readiness(items),
                    }
                )
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/content-sources/batch-template":
            try:
                self.send_json(content_source_batch_template())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/benchmark-update-tasks":
            try:
                self.send_json(list_benchmark_update_tasks())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/benchmark-accounts":
            try:
                self.send_json(list_benchmark_accounts())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/subtitle-service/health":
            self.send_json(diagnose_video_tools())
            return
        if path == "/api/v2/collection-tasks":
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                limit = int((query.get("limit") or ["20"])[0])
                self.send_json({"ok": True, "items": list_collection_tasks(limit=limit)})
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/collection-schedules":
            try:
                self.send_json(list_collection_schedules())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/brand-products":
            try:
                self.send_json({"ok": True, "items": list_brand_products()})
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/v2/script-library":
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                status = (query.get("status") or [""])[0]
                limit = int((query.get("limit") or ["50"])[0])
                self.send_json(list_script_library(status=status, limit=limit))
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/simple-agent/materials":
            user = self.require_simple_agent_user()
            if not user:
                return
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                limit = int((query.get("limit") or ["80"])[0])
                self.send_json(list_simple_video_materials(user, limit=limit))
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path.startswith("/api/simple-agent/materials/") and path.endswith("/video"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/materials/").removesuffix("/video").strip("/")
            try:
                self.send_simple_material_video(int(raw_id), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=404)
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/simple-agent/campaigns":
            user = self.require_simple_agent_user()
            if not user:
                return
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                limit = int((query.get("limit") or ["80"])[0])
                self.send_json(list_simple_campaigns(user, limit=limit))
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/simple-agent/matrix-accounts":
            user = self.require_simple_agent_user()
            if not user:
                return
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                limit = int((query.get("limit") or ["80"])[0])
                self.send_json(list_simple_matrix_accounts(user, limit=limit))
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/simple-agent/templates":
            try:
                self.send_json(list_simple_templates())
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/simple-agent/scripts":
            user = self.require_simple_agent_user()
            if not user:
                return
            query = urllib.parse.parse_qs(urlparse(self.path).query)
            try:
                limit = int((query.get("limit") or ["30"])[0])
                self.send_json(list_simple_generation_outputs(user, limit=limit))
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        if path == "/api/selections":
            self.send_json({"items": list_selections()})
            return
        if path.startswith("/api/generated/"):
            self.send_generated_file(path.removeprefix("/api/generated/"))
            return
        self.send_json({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/simple-agent/login":
            try:
                data = self.read_json()
                result = authenticate_simple_agent_user(data.get("username") or "", data.get("password") or "")
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=401)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(
                {
                    "ok": True,
                    "authenticated": True,
                    "user": result["user"],
                    "expiresAt": result["expiresAt"],
                },
                headers={"Set-Cookie": self.simple_agent_cookie(result["token"], 7 * 24 * 60 * 60)},
            )
            return
        if path == "/api/simple-agent/logout":
            delete_simple_agent_session(self.current_simple_agent_token())
            self.send_json(
                {"ok": True},
                headers={"Set-Cookie": self.simple_agent_cookie("", 0)},
            )
            return
        if path.startswith("/api/simple-agent/") and not self.require_simple_agent_user():
            return
        if path == "/api/confirm-selection":
            try:
                result = confirm_selection(self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "result": result, "export": export_result})
            return
        if path == "/api/generate":
            try:
                result = run_generation(self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "result": result, "export": export_result})
            return
        if path == "/api/ai/chat":
            self.handle_ai_call(run_codex_chat)
            return
        if path == "/api/ai/images/generate":
            self.handle_ai_call(generate_image)
            return
        if path == "/api/ai/images/edit":
            self.handle_ai_call(edit_image)
            return
        if path == "/api/v2/content-sources":
            try:
                result = create_content_source(self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path == "/api/simple-agent/materials":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = create_simple_video_material(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path == "/api/simple-agent/materials/process":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = process_simple_video_material(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/simple-agent/materials/batch":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = create_simple_video_materials_batch(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result})
            return
        if path == "/api/simple-agent/materials/batch-preview":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = preview_simple_video_materials_batch(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/simple-agent/materials/excel-preview":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = preview_simple_materials_from_excel_upload(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/simple-agent/materials/process-batch":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = process_simple_material_rows_batch(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/simple-agent/materials/feishu-base":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = import_simple_materials_from_feishu_base(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/simple-agent/materials/feishu-base-preview":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = preview_simple_materials_from_feishu_base(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/simple-agent/accounts":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = create_simple_reference_account(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path == "/api/simple-agent/campaigns":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = create_simple_campaign(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path == "/api/simple-agent/generate":
            user = self.require_simple_agent_user()
            if not user:
                return
            try:
                result = create_simple_generation_job(self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/v2/content-sources/preview":
            try:
                result = preview_content_source(self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/v2/workday/reset":
            try:
                result = reset_today_workday(self.read_json())
                export_result = export_prototype_data()
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "result": result, "export": export_result})
            return
        if path == "/api/v2/workday/close":
            try:
                result = close_today_workday(self.read_json())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "result": result})
            return
        if path.startswith("/api/v2/operation-handoffs/") and path.endswith("/process"):
            raw_id = path.removeprefix("/api/v2/operation-handoffs/").removesuffix("/process").strip("/")
            try:
                result = update_operation_handoff_process(int(raw_id), self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/v2/operation-handoffs":
            try:
                result = create_operation_handoff(self.read_json())
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path == "/api/v2/brand-products":
            try:
                result = create_brand_product(self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path == "/api/v2/collection-tasks/run":
            try:
                result = run_collection_task(self.read_json())
                export_result = export_prototype_data() if result["taskType"] == "douyin_hot" and result["status"] == "success" else None
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result, "export": export_result})
            return
        if path == "/api/v2/topic-recommendations/adopt":
            try:
                result = adopt_topic_recommendation(self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result, "export": export_result})
            return
        if path.startswith("/api/v2/collection-schedules/") and path.endswith("/run"):
            raw_id = path.removeprefix("/api/v2/collection-schedules/").removesuffix("/run").strip("/")
            try:
                result = run_collection_schedule(int(raw_id))
                export_result = export_prototype_data() if result["task"]["taskType"] == "douyin_hot" and result["task"]["status"] == "success" else None
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result, "export": export_result})
            return
        if path.startswith("/api/v2/collection-schedules/"):
            raw_id = path.removeprefix("/api/v2/collection-schedules/").strip("/")
            try:
                result = update_collection_schedule(int(raw_id), self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path.startswith("/api/v2/trends/") and path.endswith("/mark"):
            raw_id = path.removeprefix("/api/v2/trends/").removesuffix("/mark").strip("/")
            try:
                result = mark_trend(int(raw_id), self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path.startswith("/api/v2/brand-products/") and path.endswith("/select"):
            raw_id = path.removeprefix("/api/v2/brand-products/").removesuffix("/select").strip("/")
            try:
                data = self.read_json()
                result = set_brand_product_selected(int(raw_id), bool(data.get("selected", True)))
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path.startswith("/api/simple-agent/materials/") and path.endswith("/select"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/materials/").removesuffix("/select").strip("/")
            try:
                data = self.read_json()
                result = set_simple_material_selected(int(raw_id), bool(data.get("selected", True)), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path.startswith("/api/simple-agent/materials/") and path.endswith("/download"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/materials/").removesuffix("/download").strip("/")
            try:
                result = download_simple_material_by_id(int(raw_id), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            status = 200 if result.get("ok") else 502
            self.send_json(result, status=status)
            return
        if path.startswith("/api/simple-agent/materials/") and path.endswith("/subtitle"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/materials/").removesuffix("/subtitle").strip("/")
            try:
                result = supplement_simple_material_subtitle(int(raw_id), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            status = 200 if result.get("ok") else 502
            self.send_json(result, status=status)
            return
        if path.startswith("/api/simple-agent/materials/") and path.endswith("/tags"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/materials/").removesuffix("/tags").strip("/")
            try:
                result = update_simple_material_tags(int(raw_id), self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path.startswith("/api/simple-agent/campaigns/") and path.endswith("/select"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/campaigns/").removesuffix("/select").strip("/")
            try:
                data = self.read_json()
                result = set_simple_campaign_selected(int(raw_id), bool(data.get("selected", True)), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path.startswith("/api/simple-agent/scripts/") and path.endswith("/review"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/scripts/").removesuffix("/review").strip("/")
            try:
                result = review_simple_script_output(int(raw_id), self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path.startswith("/api/simple-agent/scripts/") and path.endswith("/regenerate"):
            user = self.require_simple_agent_user()
            if not user:
                return
            raw_id = path.removeprefix("/api/simple-agent/scripts/").removesuffix("/regenerate").strip("/")
            try:
                result = regenerate_simple_script_output(int(raw_id), self.read_json(), user)
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json(result)
            return
        if path.startswith("/api/v2/script-candidates/") and path.endswith("/review"):
            raw_id = path.removeprefix("/api/v2/script-candidates/").removesuffix("/review").strip("/")
            try:
                result = review_script_candidate(int(raw_id), self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result, "export": export_result})
            return
        if path.startswith("/api/v2/script-candidates/") and path.endswith("/rewrite"):
            raw_id = path.removeprefix("/api/v2/script-candidates/").removesuffix("/rewrite").strip("/")
            try:
                result = rewrite_script_candidate(int(raw_id))
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result, "export": export_result})
            return
        if path.startswith("/api/v2/script-candidates/") and path.endswith("/publish-result"):
            raw_id = path.removeprefix("/api/v2/script-candidates/").removesuffix("/publish-result").strip("/")
            try:
                result = update_script_publish_result(int(raw_id), self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result, "export": export_result})
            return
        if path == "/api/v2/content-sources/batch":
            try:
                result = create_content_sources_batch(self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result})
            return
        if path == "/api/v2/content-sources/batch-preview":
            try:
                result = preview_content_sources_batch(self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result})
            return
        if path == "/api/v2/benchmark-accounts":
            try:
                result = save_benchmark_account(self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result, "export": export_result})
            return
        if path.startswith("/api/v2/benchmark-update-tasks/"):
            raw_id = path.removeprefix("/api/v2/benchmark-update-tasks/").strip("/")
            try:
                result = update_benchmark_update_task(int(raw_id), self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path == "/api/v2/content-sources/bulk-select":
            try:
                result = bulk_select_content_sources(self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result})
            return
        if path == "/api/v2/content-sources/bulk-structure":
            try:
                result = bulk_structure_content_sources(self.read_json())
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result})
            return
        if path == "/api/v2/content-sources/bulk-subtitle-jobs":
            try:
                result = bulk_create_subtitle_jobs(self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result, "export": export_result})
            return
        if path.startswith("/api/v2/content-sources/") and path.endswith("/select"):
            raw_id = path.removeprefix("/api/v2/content-sources/").removesuffix("/select").strip("/")
            try:
                data = self.read_json()
                result = set_content_source_selected(int(raw_id), bool(data.get("selected", True)))
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result})
            return
        if path.startswith("/api/v2/content-sources/") and path.endswith("/subtitle-text"):
            raw_id = path.removeprefix("/api/v2/content-sources/").removesuffix("/subtitle-text").strip("/")
            try:
                result = update_content_source_subtitle(int(raw_id), self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, "item": result, "export": export_result})
            return
        if path.startswith("/api/v2/content-sources/") and path.endswith("/subtitle-job"):
            raw_id = path.removeprefix("/api/v2/content-sources/").removesuffix("/subtitle-job").strip("/")
            try:
                result = create_subtitle_job(int(raw_id), self.read_json())
                export_result = export_prototype_data()
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result, "export": export_result})
            return
        if path.startswith("/api/v2/content-sources/") and path.endswith("/structure"):
            raw_id = path.removeprefix("/api/v2/content-sources/").removesuffix("/structure").strip("/")
            try:
                result = structure_content_source(int(raw_id))
            except ValueError as exc:
                self.send_json({"ok": False, "error": str(exc)}, status=400)
                return
            except Exception as exc:  # pragma: no cover - surfaced in local prototype response
                self.send_json({"ok": False, "error": str(exc)}, status=500)
                return
            self.send_json({"ok": True, **result})
            return
        if path != "/api/selections":
            self.send_json({"error": "not found"}, status=404)
            return
        try:
            data = self.read_json()
            result = upsert_selection(data)
        except ValueError as exc:
            self.send_json({"error": str(exc)}, status=400)
            return
        except Exception as exc:  # pragma: no cover - surfaced in local prototype response
            self.send_json({"error": str(exc)}, status=500)
            return
        self.send_json({"ok": True, "item": result})

    def handle_ai_call(self, handler) -> None:
        try:
            result = handler(self.read_json())
        except ApiError as exc:
            self.send_json({"ok": False, "error": exc.message, "details": exc.details}, status=exc.status)
            return
        except Exception as exc:  # pragma: no cover - surfaced in local prototype response
            self.send_json({"ok": False, "error": str(exc)}, status=500)
            return
        self.send_json({"ok": True, "result": result})

    def send_generated_file(self, raw_name: str) -> None:
        filename = urllib.parse.unquote(raw_name)
        path = (IMAGE_OUTPUT_DIR / filename).resolve()
        output_root = IMAGE_OUTPUT_DIR.resolve()
        if output_root not in path.parents or not path.exists() or not path.is_file():
            self.send_json({"error": "not found"}, status=404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_simple_material_video(self, material_id: int, user: dict) -> None:
        where_sql, where_params = simple_agent_scoped_where("id = ?", user, "owner_user_id")
        with connect() as conn:
            row = conn.execute(
                f"SELECT processing_json FROM simple_video_materials WHERE {where_sql}",
                (material_id,) + where_params,
            ).fetchone()
        if not row:
            raise ValueError("素材不存在")
        processing = json_loads_fallback(row["processing_json"], {})
        local_path = ((processing or {}).get("download") or {}).get("localPath") or ""
        if not local_path:
            raise ValueError("该素材还没有可预览的视频")
        path = Path(local_path).resolve()
        video_root = SIMPLE_AGENT_VIDEO_DIR.resolve()
        if video_root not in path.parents or not path.exists() or not path.is_file():
            raise ValueError("视频文件不存在")
        body = path.read_bytes()
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "video/mp4")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def send_empty(self, status: int) -> None:
        self.send_response(status)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, payload: dict, status: int = 200, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_cors_headers(self) -> None:
        origin = self.headers.get("Origin")
        if origin in {"http://127.0.0.1:8782", "http://localhost:8782"}:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        else:
            self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8782")
            self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> int:
    if not DB_PATH.exists():
        raise SystemExit(f"找不到数据库: {DB_PATH}")
    with connect():
        pass
    server = ThreadingHTTPServer((HOST, PORT), PrototypeHandler)
    print(f"原型 API 已启动: http://{HOST}:{PORT}")
    print("接口: GET /api/health, GET/POST /api/selections, POST /api/confirm-selection, POST /api/generate")
    print("AI: POST /api/ai/chat, POST /api/ai/images/generate, POST /api/ai/images/edit")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
