from dataclasses import dataclass, field


@dataclass
class VideoInfo:
    video_id: str = ""
    title: str = ""
    author: str = ""
    author_id: str = ""
    author_uid: str = ""
    duration: int = 0
    cover_url: str = ""
    video_url: str = ""
    subtitle: str = ""
    raw_desc: str = ""
    music_title: str = ""
    music_url: str = ""
    create_time: int = 0
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    is_image: bool = False
    images: list = field(default_factory=list)
    raw_subtitles: list | None = None
    raw_subtitle_source: str = ""
    platform: str = "douyin"
    request_headers: dict = field(default_factory=dict)
