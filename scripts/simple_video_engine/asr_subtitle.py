"""
ASR-based subtitle extraction for Douyin videos.
Downloads video, extracts audio via ffmpeg, sends to ASR API.

Compatible with SiliconFlow's OpenAI-style /v1/audio/transcriptions endpoint
(model=FunAudioLLM/SenseVoiceSmall). Also works with OpenAI Whisper API.
"""
import os
import ssl
import subprocess
import tempfile
import time
from pathlib import Path
import shutil

import httpx
import requests


DEFAULT_VIDEO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/16.0 Mobile/15E148 Safari/604.1"
    )
}


def _resolve_binary(env_key: str, fallback: str) -> str:
    configured = (os.environ.get(env_key, "") or "").strip()
    if configured:
        return configured
    resolved = shutil.which(fallback)
    if resolved:
        return resolved
    local_bin = Path.home() / ".local" / "bin" / fallback
    if local_bin.exists():
        return str(local_bin)
    return fallback


def _ffmpeg_bin() -> str:
    return _resolve_binary("FFMPEG_BIN", "ffmpeg")


def _ffprobe_bin() -> str:
    return _resolve_binary("FFPROBE_BIN", "ffprobe")


def _normalize_headers(request_headers: dict | None = None) -> dict:
    headers = dict(DEFAULT_VIDEO_HEADERS)
    if isinstance(request_headers, dict):
        headers.update({
            str(key): str(value)
            for key, value in request_headers.items()
            if value
        })
    return headers


def _format_ffmpeg_headers(request_headers: dict | None = None) -> str:
    headers = _normalize_headers(request_headers)
    return "".join(f"{key}: {value}\r\n" for key, value in headers.items())


class ASRSubtitleExtractor:
    def __init__(
        self,
        api_url: str,
        api_key: str,
        model: str = "FunAudioLLM/SenseVoiceSmall",
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    def extract(
        self,
        video_url: str,
        video_duration: float = 0,
        request_headers: dict | None = None,
    ) -> dict:
        """Extract subtitles via ASR.

        Strategy:
          1) Try ffmpeg piping directly from URL → mp3 (~570KB on disk only).
          2) If piping fails (CDN unfriendly to ffmpeg UA / 403 / etc.),
             fall back to: full video download → ffmpeg → mp3.

        Returns:
            dict with keys:
              text, segments [{start, end, text}], srt, audio_size,
              method ('stream' | 'download'), has_real_timestamps
        """
        audio_path = None
        video_path = None
        method = None

        try:
            # === Try 1: ffmpeg-pipe directly from the URL ===
            try:
                audio_path = self._extract_audio_from_url(video_url, request_headers)
                method = "stream"
            except Exception as stream_err:
                # === Fallback: download then extract ===
                video_path = self._download_video(video_url, request_headers)
                audio_path = self._extract_audio(video_path)
                method = "download"
                # log retained as comment; FastAPI will log via response field
                _ = stream_err

            audio_size = os.path.getsize(audio_path)
            if not video_duration:
                video_duration = self._probe_duration(audio_path)

            result = self._transcribe(audio_path)
            text = result.get("text", "")
            segments = result.get("segments") or []

            if not segments and text:
                segments = self._synthesize_segments(text, video_duration)

            return {
                "text": text,
                "segments": segments,
                "srt": self._to_srt(segments) if segments else "",
                "audio_size": audio_size,
                "method": method,
                "has_real_timestamps": bool(result.get("segments")),
            }

        finally:
            if video_path and os.path.exists(video_path):
                try: os.unlink(video_path)
                except OSError: pass
            if audio_path and os.path.exists(audio_path):
                try: os.unlink(audio_path)
                except OSError: pass

    def _extract_audio_from_url(
        self,
        video_url: str,
        request_headers: dict | None = None,
    ) -> str:
        """Stream from URL via ffmpeg and write only the audio (mp3) to disk.

        ffmpeg will follow the 302 to Douyin's CDN automatically. We pass
        a mobile UA via `-headers` so the CDN doesn't 403 ffmpeg.
        """
        fd, path = tempfile.mkstemp(suffix=".mp3", prefix="douyin_audio_")
        os.close(fd)

        ua_header = _format_ffmpeg_headers(request_headers)

        result = subprocess.run(
            [
                _ffmpeg_bin(), "-y",
                "-headers", ua_header,
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "5",
                "-i", video_url,
                "-vn",
                "-ac", "1",
                "-ar", "16000",
                "-b:a", "64k",
                path,
            ],
            capture_output=True, text=True, timeout=180,
        )
        if result.returncode != 0 or os.path.getsize(path) == 0:
            try: os.unlink(path)
            except OSError: pass
            raise RuntimeError(
                f"ffmpeg pipe failed (rc={result.returncode}): "
                f"{result.stderr[-300:]}"
            )

        return path

    @staticmethod
    def _probe_duration(audio_path: str) -> float:
        """Get duration in seconds via ffprobe."""
        try:
            r = subprocess.run(
                [
                    _ffprobe_bin(), "-v", "quiet",
                    "-show_entries", "format=duration",
                    "-of", "csv=p=0",
                    audio_path,
                ],
                capture_output=True, text=True, timeout=15,
            )
            return float(r.stdout.strip()) if r.stdout.strip() else 0
        except Exception:
            return 0

    @staticmethod
    def _synthesize_segments(text: str, duration: float) -> list:
        """Split text by Chinese/Latin punctuation, distribute time evenly.

        Each segment's duration is proportional to its character count.
        Not perfectly accurate but matches roughly with speech.
        """
        import re

        # Split on sentence-ending punctuation, keep punctuation with prior chunk
        parts = re.split(r"(?<=[。！？\.!?；;\n])\s*", text.strip())
        parts = [p.strip() for p in parts if p.strip()]
        if not parts:
            return []

        # Fall back to 1s per segment if duration unknown
        if duration <= 0:
            duration = len(parts) * 2.5

        total_chars = sum(len(p) for p in parts) or 1
        segments = []
        t = 0.0
        for p in parts:
            seg_dur = duration * (len(p) / total_chars)
            segments.append({
                "start": round(t, 3),
                "end": round(t + seg_dur, 3),
                "text": p,
            })
            t += seg_dur
        return segments

    @staticmethod
    def _to_srt(segments: list) -> str:
        """Convert ASR segments to SRT subtitle format."""
        def fmt_time(seconds: float) -> str:
            ms = int(round(seconds * 1000))
            h, ms = divmod(ms, 3600 * 1000)
            m, ms = divmod(ms, 60 * 1000)
            s, ms = divmod(ms, 1000)
            return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

        lines = []
        for i, seg in enumerate(segments, 1):
            start = seg.get("start", 0)
            end = seg.get("end", start + 1)
            text = (seg.get("text") or "").strip()
            if not text:
                continue
            lines.append(str(i))
            lines.append(f"{fmt_time(start)} --> {fmt_time(end)}")
            lines.append(text)
            lines.append("")
        return "\n".join(lines)

    def _download_video(
        self,
        url: str,
        request_headers: dict | None = None,
        max_retries: int = 3,
    ) -> str:
        fd, path = tempfile.mkstemp(suffix=".mp4", prefix="douyin_video_")
        os.close(fd)

        last_error = None
        for attempt in range(max_retries):
            try:
                with requests.get(
                    url,
                    stream=True,
                    timeout=120,
                    allow_redirects=True,
                    headers=_normalize_headers(request_headers),
                ) as resp:
                    resp.raise_for_status()
                    with open(path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                return path
            except (
                requests.exceptions.RequestException,
                ssl.SSLError,
                OSError,
            ) as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(1.5 ** attempt)
                    continue
                raise RuntimeError(
                    f"视频下载失败（已重试 {max_retries} 次）: "
                    f"{type(e).__name__}: {e}"
                )

        raise RuntimeError(f"视频下载失败: {last_error}")

    def _extract_audio(self, video_path: str) -> str:
        """Extract audio as 16kHz mono mp3 for compact upload."""
        fd, path = tempfile.mkstemp(suffix=".mp3", prefix="douyin_audio_")
        os.close(fd)

        result = subprocess.run(
            [
                _ffmpeg_bin(), "-y",
                "-i", video_path,
                "-vn",            # no video
                "-ac", "1",       # mono
                "-ar", "16000",   # 16kHz sample rate
                "-b:a", "64k",    # 64kbps bitrate
                path,
            ],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg 提取音频失败: {result.stderr[-500:]}")

        return path

    def _transcribe(self, audio_path: str, max_retries: int = 3) -> dict:
        """Upload audio file to ASR API. Returns full response dict.

        Uses verbose_json to get per-segment timestamps for SRT generation.
        Falls back to plain text if API doesn't support verbose_json.

        Uses `requests` lib (sync, blocking) instead of httpx, because httpx
        in FastAPI's event loop occasionally triggers SSL EOF errors with
        SiliconFlow's TLS stack.
        """
        last_error = None
        for attempt in range(max_retries):
            try:
                with open(audio_path, "rb") as f:
                    files = {
                        "file": (os.path.basename(audio_path), f, "audio/mpeg")
                    }
                    # Ask for verbose_json (Whisper-compatible APIs return
                    # per-segment timestamps); SenseVoice ignores this and
                    # just returns {"text": ...}
                    data = {
                        "model": self.model,
                        "response_format": "verbose_json",
                        "timestamp_granularities[]": "segment",
                    }
                    resp = requests.post(
                        self.api_url,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        files=files,
                        data=data,
                        timeout=300,
                    )

                if resp.status_code != 200:
                    raise RuntimeError(
                        f"ASR API 返回错误 {resp.status_code}: {resp.text[:300]}"
                    )

                return resp.json()

            except (
                requests.exceptions.RequestException,
                httpx.HTTPError,
                ssl.SSLError,
                OSError,
            ) as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(1.5 ** attempt)
                    continue
                raise RuntimeError(
                    f"ASR API 网络异常（已重试 {max_retries} 次）: "
                    f"{type(e).__name__}: {e}"
                )

        raise RuntimeError(f"ASR 失败: {last_error}")
