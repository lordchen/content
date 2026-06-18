"""
Douyin video parser - extracts video info, subtitles, and watermark-free URLs.
"""
import re
import json

import httpx

from .video_info import VideoInfo

# EdgiOS UA is required for iesdouyin.com to return server-rendered _ROUTER_DATA
SHARE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1"
)

# For following short link redirects, a standard mobile UA works fine
REDIRECT_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/16.0 Mobile/15E148 Safari/604.1"
)

DOUYIN_URL_PATTERN = re.compile(
    r"https?://(?:v\.douyin\.com|www\.douyin\.com|douyin\.com|www\.iesdouyin\.com|iesdouyin\.com)"
    r"/[^\s]+"
)
VIDEO_ID_IN_URL = re.compile(r"/video/(\d+)")
VIDEO_ID_IN_SHARE = re.compile(r"/share/video/(\d+)")
VIDEO_ID_IN_MODAL = re.compile(r"[?&]modal_id=(\d{15,20})")
VIDEO_ID_FALLBACK = re.compile(r"(\d{15,20})")


class DouyinParser:
    def __init__(self):
        self.share_client = httpx.Client(
            headers={
                "User-Agent": SHARE_UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9",
            },
            follow_redirects=True,
            timeout=30.0,
        )
        self.redirect_client = httpx.Client(
            headers={
                "User-Agent": REDIRECT_UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9",
            },
            follow_redirects=False,  # We want to capture the redirect Location
            timeout=30.0,
        )

    def parse(self, share_text: str) -> VideoInfo:
        """Parse Douyin share text and return video information.

        Accepts:
        - Full share text: "5.69 复制打开抖音，看看【xxx】 https://v.douyin.com/xxx/ ..."
        - Share URL only: "https://v.douyin.com/xxx/"
        - Direct video URL: "https://www.douyin.com/video/7123456789012345678"
        - Jingxuan modal URL: "https://www.douyin.com/jingxuan?modal_id=7123456789012345678"
        """
        share_text = share_text.strip()

        # Step 1: Extract the Douyin URL from share text
        short_url = self._extract_url(share_text)

        # Step 2: Follow redirect to get the real share page URL with all params
        share_page_url = self._resolve_share_url(short_url)

        # Step 3: Fetch video data from the resolved share page
        return self._fetch_share_page(share_page_url)

    def _extract_url(self, text: str) -> str:
        """Extract Douyin URL from share text which may contain Chinese characters."""
        match = DOUYIN_URL_PATTERN.search(text)
        if match:
            return match.group(0)
        if "douyin.com" in text or "iesdouyin.com" in text:
            for word in text.split():
                if "douyin.com" in word or "iesdouyin.com" in word:
                    if not word.startswith("http"):
                        word = "https://" + word
                    return word
        raise ValueError(
            "未找到抖音分享链接，请确保复制了完整的分享信息（包含 v.douyin.com 链接）"
        )

    def _resolve_share_url(self, url: str) -> str:
        """Follow short link redirects to get the real share page URL.

        A douyin short link like https://v.douyin.com/xxx/ redirects to:
        https://www.iesdouyin.com/share/video/{video_id}/?region=CN&mid=...&share_sign=...&did=...

        We preserve the full URL with all query parameters.
        """
        # Douyin desktop pages such as /jingxuan?modal_id=... and /video/{id}
        # are JS-rendered and may not expose _ROUTER_DATA. The mobile share
        # endpoint still returns the server-rendered payload we need.
        modal_match = VIDEO_ID_IN_MODAL.search(url)
        if modal_match:
            return f"https://www.iesdouyin.com/share/video/{modal_match.group(1)}/"

        video_match = VIDEO_ID_IN_URL.search(url)
        if video_match and "iesdouyin.com/share/video/" not in url:
            return f"https://www.iesdouyin.com/share/video/{video_match.group(1)}/"

        # If it's already a direct share/video URL, return as-is.
        if "/share/video/" in url:
            return url

        try:
            # Follow redirect manually to capture the full intermediate URL
            resp = self.redirect_client.get(url)
            # Location header contains the real URL
            location = resp.headers.get("Location", "")
            if location:
                if location.rstrip("/") in {
                    "https://www.douyin.com",
                    "https://www.iesdouyin.com",
                }:
                    raise ValueError(
                        "This share link no longer points to a public video. "
                        "Please copy a fresh public video share link and try again."
                    )
                return location

            # If no redirect but the request succeeded, try following
            resp2 = self.redirect_client.get(
                url, follow_redirects=True
            )
            return str(resp2.url)
        except ValueError:
            raise
        except Exception:
            pass

        return url

    def _fetch_share_page(self, share_url: str) -> VideoInfo:
        """Fetch video data from the resolved share page URL.

        The share page URL (from redirect) has all needed params:
        share_sign, did, iid, mid, region, etc.
        """
        info = VideoInfo()

        try:
            resp = self.share_client.get(share_url)
            html = resp.text

            # Extract video_id from the resolved URL
            for pattern in [VIDEO_ID_IN_URL, VIDEO_ID_IN_SHARE, VIDEO_ID_IN_MODAL]:
                match = pattern.search(share_url)
                if match:
                    info.video_id = match.group(1)
                    break

            # Extract window._ROUTER_DATA JSON
            match = re.search(
                r"window\._ROUTER_DATA\s*=\s*(.*?)</script>", html, re.DOTALL
            )
            if not match:
                return info

            data = json.loads(match.group(1).strip())
            loader = data.get("loaderData", {})

            # The page has either "video_(id)/page" or "note_(id)/page" for images
            page_key = None
            for key in loader:
                if "/page" in key and key != "video_layout":
                    page_key = key
                    break

            if not page_key:
                return info

            page_data = loader[page_key]
            if not page_data:
                return info

            video_info_res = page_data.get("videoInfoRes")
            if isinstance(video_info_res, str):
                video_info_res = json.loads(video_info_res)

            if not video_info_res:
                return info

            items = video_info_res.get("item_list", [])
            if not items:
                return info

            item = items[0]

            # video_id from item data if not yet extracted
            if not info.video_id:
                info.video_id = str(item.get("aweme_id", ""))

            self._parse_item(item, info)

        except Exception:
            pass

        return info

    def _parse_item(self, item: dict, info: VideoInfo):
        """Parse all fields from the video item."""
        info.title = item.get("desc", "") or ""
        info.raw_desc = info.title
        info.create_time = item.get("create_time", 0)

        author = item.get("author", {})
        info.author = author.get("nickname", "")
        info.author_id = author.get("short_id", "") or author.get("unique_id", "")
        info.author_uid = author.get("uid", "") or author.get("sec_uid", "")

        video = item.get("video", {})
        raw_duration = video.get("duration", 0) or 0
        info.duration = raw_duration // 1000 if raw_duration > 1000 else raw_duration

        cover = video.get("cover", {})
        cover_urls = cover.get("url_list", [])
        if cover_urls:
            info.cover_url = cover_urls[-1]

        play_addr = video.get("play_addr", {})
        play_urls = play_addr.get("url_list", [])
        if play_urls:
            info.video_url = play_urls[0].replace("playwm", "play")

        music = item.get("music", {})
        info.music_title = music.get("title", "")
        info.music_url = music.get("play_url", {}).get("uri", "")

        info.subtitle = self._extract_subtitles(item)

        if not info.subtitle:
            text_extra = item.get("text_extra") or []
            extra_texts = []
            for te in text_extra:
                t = te.get("text", "") or te.get("content", "")
                if t:
                    extra_texts.append(t)
            if extra_texts:
                info.subtitle = "\n".join(extra_texts)

        stats = item.get("statistics", {})
        info.like_count = stats.get("digg_count", 0) or 0
        info.comment_count = stats.get("comment_count", 0) or 0
        info.share_count = stats.get("share_count", 0) or 0

        if item.get("aweme_type") == 2 or item.get("image_infos"):
            info.is_image = True
            image_infos = item.get("image_infos", {})
            for key in sorted(image_infos.keys()):
                img_urls = image_infos[key].get("url_list", [])
                if img_urls:
                    info.images.append(img_urls[-1])

        if not info.subtitle:
            video_text = item.get("video_text") or []
            vt_parts = []
            for vt in video_text:
                content = vt.get("text", "") or vt.get("content", "")
                if content:
                    vt_parts.append(content)
            if vt_parts:
                info.subtitle = "\n".join(vt_parts)

        # === Try to fetch Douyin's raw subtitle (CC) data ===
        # subtitle_info -> subtitle[].url_list -> WebVTT/SRT file
        self._populate_raw_subtitles(item, info)

    def _populate_raw_subtitles(self, item: dict, info: VideoInfo):
        """Fetch Douyin-provided subtitle file (VTT/SRT) if any."""
        si = item.get("subtitle_info")
        if not isinstance(si, dict):
            return
        sub_list = si.get("subtitle") or []
        if not sub_list:
            return

        # Prefer Chinese, then any. Prefer "cla" (auto-cc) tag if labeled.
        def lang_score(s):
            lang = (s.get("lang") or "").lower()
            return (0 if "cn" in lang or "zh" in lang else 1)
        sub_list = sorted(sub_list, key=lang_score)

        for entry in sub_list:
            urls = entry.get("url_list") or []
            if not urls:
                continue
            fmt = (entry.get("format") or "").lower()
            url = urls[0]
            try:
                resp = self.share_client.get(url, timeout=10)
                if resp.status_code != 200 or not resp.text:
                    continue
                segments = self._parse_subtitle_file(resp.text, fmt)
                if segments:
                    info.raw_subtitles = segments
                    info.raw_subtitle_source = (
                        "cc" if entry.get("source") else "auto"
                    )
                    return
            except Exception:
                continue

    @staticmethod
    def _parse_subtitle_file(content: str, fmt_hint: str = "") -> list:
        """Parse a WebVTT or SRT subtitle file into [{start, end, text}]."""
        import re as _re

        # Strip BOM and normalize line endings
        content = content.lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n")

        # WebVTT timing line: 00:00:01.000 --> 00:00:02.000
        # SRT timing line:    00:00:01,000 --> 00:00:02,000
        timing = _re.compile(
            r"(\d{1,2}:)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})\s*-->\s*"
            r"(\d{1,2}:)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})"
        )

        segments = []
        cur_start = None
        cur_end = None
        cur_text_lines: list[str] = []

        def to_seconds(h, m, s, ms):
            h = int(h.rstrip(":")) if h else 0
            return h * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

        def flush():
            if cur_start is not None and cur_text_lines:
                text = " ".join(t.strip() for t in cur_text_lines if t.strip())
                if text:
                    segments.append({
                        "start": round(cur_start, 3),
                        "end": round(cur_end, 3),
                        "text": text,
                    })

        for line in content.split("\n"):
            stripped = line.strip()
            if not stripped:
                flush()
                cur_start = cur_end = None
                cur_text_lines = []
                continue
            m = timing.match(stripped)
            if m:
                # Save previous block if any
                flush()
                cur_text_lines = []
                cur_start = to_seconds(m.group(1), m.group(2), m.group(3), m.group(4))
                cur_end   = to_seconds(m.group(5), m.group(6), m.group(7), m.group(8))
                continue
            # Skip cue identifier lines and WEBVTT header
            if stripped.upper().startswith("WEBVTT") or stripped.isdigit():
                continue
            if cur_start is not None:
                cur_text_lines.append(stripped)

        flush()
        return segments

    def _extract_subtitles(self, item: dict) -> str:
        """Extract subtitle/caption text from video data."""
        parts = []

        subtitle_info = item.get("subtitle_info") or {}
        if isinstance(subtitle_info, dict):
            subtitles = subtitle_info.get("subtitle") or []
            for sub in subtitles:
                content = sub.get("content", "")
                if content:
                    parts.append(content)

        stickers = item.get("interaction_stickers") or []
        if isinstance(stickers, list):
            for sticker in stickers:
                if not isinstance(sticker, dict):
                    continue
                text_list = sticker.get("text") or sticker.get("text_list") or []
                if isinstance(text_list, list):
                    for t in text_list:
                        content = (
                            t.get("text", "") or t.get("content", "")
                            if isinstance(t, dict)
                            else str(t)
                        )
                        if content:
                            parts.append(content)
                elif isinstance(text_list, str) and text_list:
                    parts.append(text_list)

        return "\n".join(parts)
