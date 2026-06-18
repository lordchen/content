import re
from urllib.parse import urlparse

from .video_info import VideoInfo


SUPPORTED_HOSTS = {
    "x.com": "x",
    "twitter.com": "x",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
}


class UniversalVideoParser:
    """Parse supported public video links through yt-dlp.

    This is intentionally separate from the Douyin parser. Douyin keeps its
    purpose-built no-watermark path; other platforms use best-effort public
    extraction and may fail when login, region, or anti-bot checks are required.
    """

    def parse(self, share_text: str) -> VideoInfo:
        url = self._extract_url(share_text)
        platform = detect_universal_platform(url)
        if not platform:
            raise ValueError("暂不支持该平台链接")

        try:
            from yt_dlp import YoutubeDL
            from yt_dlp.utils import DownloadError, ExtractorError
        except Exception as exc:
            raise ValueError("通用视频解析能力未安装，请稍后重试") from exc

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
            "socket_timeout": 30,
            "retries": 2,
            "format": "best[ext=mp4][vcodec!=none]/best[vcodec!=none]/best",
        }

        try:
            with YoutubeDL(ydl_opts) as ydl:
                data = ydl.extract_info(url, download=False)
        except (DownloadError, ExtractorError) as exc:
            raise ValueError(_friendly_platform_error(platform, str(exc))) from exc
        except Exception as exc:
            raise ValueError(_friendly_platform_error(platform, str(exc))) from exc

        if data.get("_type") == "playlist":
            entries = [entry for entry in data.get("entries") or [] if entry]
            if not entries:
                raise ValueError("未找到公开视频内容")
            data = entries[0]

        info = VideoInfo(platform=platform)
        info.video_id = str(data.get("id") or "")
        info.title = data.get("title") or data.get("fulltitle") or "Video clip"
        info.raw_desc = data.get("description") or info.title
        info.author = data.get("uploader") or data.get("channel") or data.get("creator") or ""
        info.author_id = data.get("uploader_id") or data.get("channel_id") or ""
        info.author_uid = data.get("uploader_url") or data.get("channel_url") or ""
        info.duration = int(data.get("duration") or 0)
        info.cover_url = data.get("thumbnail") or ""
        info.create_time = _parse_timestamp(data)
        info.like_count = int(data.get("like_count") or 0)
        info.comment_count = int(data.get("comment_count") or 0)
        info.share_count = int(data.get("repost_count") or 0)
        info.video_url = self._select_video_url(data)
        info.request_headers = self._build_request_headers(data, url)
        info.raw_subtitles = self._extract_caption_segments(data)
        if info.raw_subtitles:
            info.subtitle = "\n".join(
                item["text"] for item in info.raw_subtitles if item.get("text")
            )
            info.raw_subtitle_source = "platform"

        if not info.video_id:
            info.video_id = _fallback_video_id(url)
        if not info.video_url:
            raise ValueError(
                f"{_platform_label(platform)} 没有返回可直接下载的视频文件，"
                "可能需要登录、受地区限制，或只提供分离音视频流。"
            )

        return info

    @staticmethod
    def _extract_url(text: str) -> str:
        clean = (text or "").strip()
        match = re.search(r"https?://[^\s]+", clean)
        if match:
            return match.group(0).rstrip("，。；;)")
        raise ValueError("请粘贴完整的视频链接")

    @staticmethod
    def _select_video_url(data: dict) -> str:
        direct_url = data.get("url") or ""
        ext = (data.get("ext") or "").lower()
        vcodec = data.get("vcodec")
        acodec = data.get("acodec")
        if direct_url and (not ext or ext == "mp4") and vcodec != "none":
            return direct_url
        if direct_url and vcodec != "none" and acodec != "none":
            return direct_url

        formats = data.get("formats") or []
        candidates = []
        for item in formats:
            url = item.get("url")
            if not url:
                continue
            if item.get("vcodec") == "none":
                continue
            if item.get("acodec") == "none":
                continue
            protocol = (item.get("protocol") or "").lower()
            if "m3u8" in protocol or "dash" in protocol:
                continue
            candidates.append(item)

        if not candidates:
            for item in formats:
                url = item.get("url")
                if url and item.get("vcodec") != "none" and item.get("acodec") != "none":
                    candidates.append(item)

        if not candidates:
            return ""

        candidates.sort(
            key=lambda item: (
                item.get("ext") == "mp4",
                int(item.get("height") or 0),
                int(item.get("tbr") or 0),
            ),
            reverse=True,
        )
        return candidates[0].get("url") or ""

    @staticmethod
    def _build_request_headers(data: dict, fallback_url: str) -> dict:
        headers = {}
        http_headers = data.get("http_headers") or {}
        if isinstance(http_headers, dict):
            headers.update({
                key: value
                for key, value in http_headers.items()
                if key.lower() in {"user-agent", "referer", "origin"}
            })
        if "User-Agent" not in headers:
            headers["User-Agent"] = (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                "Version/16.0 Mobile/15E148 Safari/604.1"
            )
        if "Referer" not in headers:
            headers["Referer"] = fallback_url
        return headers

    @staticmethod
    def _extract_caption_segments(data: dict) -> list | None:
        for collection_name in ("subtitles", "automatic_captions"):
            collection = data.get(collection_name) or {}
            if not isinstance(collection, dict):
                continue
            entry = _pick_caption_entry(collection)
            if not entry:
                continue
            text = entry.get("data") or ""
            if text:
                segments = _parse_simple_caption_text(text)
                if segments:
                    return segments
        return None


def detect_universal_platform(value: str) -> str:
    clean = (value or "").strip()
    match = re.search(r"https?://[^\s]+", clean)
    url = match.group(0) if match else clean
    try:
        host = urlparse(url).netloc.lower().split("@")[-1].split(":")[0]
    except Exception:
        return ""
    host = host.removeprefix("www.").removeprefix("m.")
    for suffix, platform in SUPPORTED_HOSTS.items():
        if host == suffix or host.endswith("." + suffix):
            return platform
    return ""


def _pick_caption_entry(collection: dict) -> dict | None:
    preferred_langs = ["zh-Hans", "zh-CN", "zh", "en", "en-US"]
    langs = preferred_langs + list(collection.keys())
    for lang in langs:
        entries = collection.get(lang)
        if not entries:
            continue
        for entry in entries:
            if (entry.get("ext") or "").lower() in {"vtt", "srt", "json3"}:
                return entry
        return entries[0]
    return None


def _parse_simple_caption_text(text: str) -> list:
    clean = (text or "").strip()
    if not clean:
        return []
    lines = []
    for raw in clean.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw.strip()
        if not line or line.upper().startswith("WEBVTT") or "-->" in line:
            continue
        if line.isdigit() or line.startswith(("NOTE", "Kind:", "Language:")):
            continue
        lines.append(re.sub(r"<[^>]+>", "", line).strip())
    lines = [line for line in lines if line]
    return [
        {"start": index * 2.5, "end": (index + 1) * 2.5, "text": line}
        for index, line in enumerate(lines)
    ]


def _parse_timestamp(data: dict) -> int:
    timestamp = data.get("timestamp") or 0
    if timestamp:
        return int(timestamp)
    upload_date = str(data.get("upload_date") or "")
    if re.fullmatch(r"\d{8}", upload_date):
        from datetime import datetime

        return int(datetime.strptime(upload_date, "%Y%m%d").timestamp())
    return 0


def _fallback_video_id(url: str) -> str:
    match = re.search(r"(\d{8,})", url)
    return match.group(1) if match else re.sub(r"\W+", "_", url)[-48:]


def _platform_label(platform: str) -> str:
    return {
        "x": "X/Twitter",
        "tiktok": "TikTok",
        "youtube": "YouTube",
    }.get(platform, "该平台")


def _friendly_platform_error(platform: str, message: str) -> str:
    lower = (message or "").lower()
    label = _platform_label(platform)
    if "login" in lower or "cookies" in lower or "authentication" in lower:
        return f"{label} 当前需要登录或授权后才能读取该视频，请换一个公开链接重试。"
    if "private" in lower or "unavailable" in lower or "not available" in lower:
        return f"{label} 视频不可公开访问，可能已删除、私密、地区受限或链接已失效。"
    if "unsupported url" in lower:
        return f"暂不支持这个 {label} 链接形式，请粘贴单条公开视频链接。"
    if "no video could be found" in lower or "no video" in lower:
        return f"{label} 这条链接里没有找到可下载的视频内容，请换一条公开视频链接重试。"
    return f"{label} 链接解析失败，可能受到平台限制，请换一个公开链接重试。"
