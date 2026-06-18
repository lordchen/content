from urllib.parse import urlparse

from .douyin_parser import DouyinParser
from .universal_parser import UniversalVideoParser, detect_universal_platform


class PlatformRouter:
    def __init__(self):
        self.douyin = DouyinParser()
        self.universal = UniversalVideoParser()

    def parse(self, value: str):
        platform = detect_platform(value)
        if platform == "douyin":
            info = self.douyin.parse(value)
            info.platform = "douyin"
            return info
        if platform in {"x", "tiktok", "youtube"}:
            return self.universal.parse(value)
        raise ValueError(
            "暂不支持该链接。当前支持抖音、X/Twitter、TikTok 和 YouTube 的公开视频链接。"
        )


def detect_platform(value: str) -> str:
    clean = (value or "").strip()
    lower = clean.lower()
    if "douyin.com" in lower or "iesdouyin.com" in lower:
        return "douyin"

    universal = detect_universal_platform(clean)
    if universal:
        return universal

    try:
        host = urlparse(clean).netloc.lower()
    except Exception:
        host = ""
    if "douyin.com" in host or "iesdouyin.com" in host:
        return "douyin"
    return ""
