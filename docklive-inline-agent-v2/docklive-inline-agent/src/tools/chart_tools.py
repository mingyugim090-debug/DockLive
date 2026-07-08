"""차트 PNG 렌더링 (한글 문서 삽입용). Excel 네이티브 차트는 excel_tools.create_chart."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # 창 없음 — 창은 Excel/한글이 담당
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402

CHART_DIR = Path(__file__).resolve().parents[2] / "workspace" / "charts"
_KOREAN_FONTS = ["Malgun Gothic", "NanumGothic", "AppleGothic"]


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


def _ok(data) -> dict:
    return {"ok": True, "data": data}


def _korean_font() -> font_manager.FontProperties | None:
    available = {f.name for f in font_manager.fontManager.ttflist}
    for name in _KOREAN_FONTS:
        if name in available:
            return font_manager.FontProperties(family=name)
    return None  # 폰트 없으면 라벨이 깨질 수 있음 — 에러 대신 경고 데이터로 알림


def render_chart_image(chart_type: str, title: str,
                       labels: list[str], series: list[dict]) -> dict:
    if not series or not series[0].get("values"):
        return _err("series가 비어 있음. [{'name': ..., 'values': [...]}] 형태 필요.")
    for sr in series:
        if chart_type != "pie" and len(sr["values"]) != len(labels):
            return _err(f"시리즈 '{sr['name']}' 길이({len(sr['values'])})가 "
                        f"labels 길이({len(labels)})와 불일치.")
    font = _korean_font()
    try:
        fig, ax = plt.subplots(figsize=(7, 4.2), dpi=150)
        if chart_type == "line":
            for sr in series:
                ax.plot(labels, sr["values"], marker="o", label=sr["name"])
        elif chart_type == "bar":
            n = len(series)
            width = 0.8 / n
            xs = range(len(labels))
            for k, sr in enumerate(series):
                ax.bar([x + k * width for x in xs], sr["values"], width, label=sr["name"])
            ax.set_xticks([x + 0.4 - width / 2 for x in xs])
            ax.set_xticklabels(labels, fontproperties=font)
        elif chart_type == "pie":
            ax.pie(series[0]["values"], labels=labels, autopct="%1.1f%%",
                   textprops={"fontproperties": font} if font else None)
        elif chart_type == "scatter":
            for sr in series:
                ax.scatter(range(len(sr["values"])), sr["values"], label=sr["name"])
        else:
            plt.close(fig)
            return _err(f"지원하지 않는 chart_type: {chart_type}")

        if font:
            ax.set_title(title, fontproperties=font, fontsize=13)
            if chart_type != "pie":
                ax.legend(prop=font)
                for lbl in ax.get_xticklabels():
                    lbl.set_fontproperties(font)
        else:
            ax.set_title(title, fontsize=13)
            if chart_type != "pie" and len(series) > 1:
                ax.legend()
        if chart_type in ("line", "bar", "scatter"):
            ax.grid(axis="y", alpha=0.3)
        fig.tight_layout()

        CHART_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out = CHART_DIR / f"chart_{chart_type}_{stamp}.png"
        fig.savefig(out)
        plt.close(fig)
        warn = "" if font else " (경고: 한글 폰트 미탐지 — 라벨 깨짐 가능)"
        return _ok({"image_path": str(out), "note": f"렌더 완료{warn}"})
    except Exception as ex:
        plt.close("all")
        return _err(f"차트 렌더 실패: {ex}")
