#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sequence-frame ZIP -> SVGA/VAP converter (asset pipeline).

This script targets the capability defined in:
openspec/changes/convert-seq-zip-to-svga-or-vap/specs/animation-asset-conversion/spec.md
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    import imageio_ffmpeg  # type: ignore
except ImportError:
    print("缺少依赖: pip install imageio-ffmpeg", file=sys.stderr)
    sys.exit(2)

try:
    from PIL import Image
except ImportError:
    print("缺少依赖: pip install Pillow", file=sys.stderr)
    sys.exit(2)


SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def setup_logging(verbose: bool) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    logging.basicConfig(
        level=logging.INFO if verbose else logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
    )


def natural_key(s: str) -> list[object]:
    # e.g. "frame_10.png" > "frame_2.png"
    parts = re.split(r"(\d+)", s)
    key: list[object] = []
    for p in parts:
        if p.isdigit():
            key.append(int(p))
        else:
            key.append(p.lower())
    return key


def iter_image_files(root: Path) -> list[Path]:
    items: list[Path] = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in SUPPORTED_IMAGE_EXTS:
            items.append(p)
    items.sort(key=lambda x: natural_key(str(x.name)))
    return items


def safe_name_from_path(p: Path) -> str:
    base = p.stem.strip() or "asset"
    base = re.sub(r"\s+", "-", base)
    base = re.sub(r"[^a-zA-Z0-9_\-\u4e00-\u9fff]+", "", base)
    return base or "asset"


@dataclass(frozen=True)
class ConvertArgs:
    input_zip: Path
    out_dir: Path
    out_format: str
    width: int
    height: int
    fps: int
    fit: str
    overwrite: bool
    dry_run: bool


def resize_frame(img: Image.Image, width: int, height: int, fit: str) -> Image.Image:
    # Always work in RGBA for alpha preservation.
    src = img.convert("RGBA")
    tw, th = width, height
    if fit == "stretch":
        return src.resize((tw, th), Image.Resampling.LANCZOS)

    sw, sh = src.size
    if sw == 0 or sh == 0:
        return Image.new("RGBA", (tw, th), (0, 0, 0, 0))

    scale_contain = min(tw / sw, th / sh)
    scale_cover = max(tw / sw, th / sh)
    scale = scale_cover if fit == "cover" else scale_contain

    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)

    if fit == "cover":
        # Center crop to target size
        left = max(0, (nw - tw) // 2)
        top = max(0, (nh - th) // 2)
        return resized.crop((left, top, left + tw, top + th))

    # contain: letterbox into target size (transparent background)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    left = max(0, (tw - nw) // 2)
    top = max(0, (th - nh) // 2)
    canvas.paste(resized, (left, top), resized)
    return canvas


def ensure_out_paths(args: ConvertArgs) -> tuple[Path, Path]:
    args.out_dir.mkdir(parents=True, exist_ok=True)
    name = safe_name_from_path(args.input_zip)
    ext = "vap" if args.out_format == "vap" else "svga"
    stem = f"{name}_{args.width}x{args.height}_{args.fps}"
    out_file = args.out_dir / f"{stem}.{ext}"
    meta_file = args.out_dir / f"{stem}.json"
    # dry-run 只校验与预估产物，不应因为已有文件而失败。
    if (not args.overwrite) and (not args.dry_run):
        for p in (out_file, meta_file):
            if p.exists():
                raise FileExistsError(f"输出已存在: {p}")
    return out_file, meta_file


def run_ffmpeg(cmd: list[str]) -> None:
    logging.info("运行 ffmpeg: %s", " ".join(cmd))
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if p.returncode != 0:
        raw = p.stdout or b""
        # ffmpeg 在 Windows 下可能输出本地编码，做容错解码避免因中文路径导致异常
        try:
            out = raw.decode("utf-8", errors="replace")
        except Exception:
            out = raw.decode("gbk", errors="replace")
        raise RuntimeError(f"ffmpeg 失败（code={p.returncode}）:\n{out[-2000:]}")


def encode_vap(frames_dir: Path, fps: int, out_file: Path) -> None:
    """Create a VAP-like alpha video: RGB stacked on top of alpha plane (vstack)."""
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    # Input is %03d.png
    inp = str(frames_dir / "%03d.png")

    # Build: RGBA -> split -> alphaextract -> vstack -> H.264
    # Note: output is .vap (mp4 container). Player-side must understand VAP packing.
    filter_complex = (
        "[0:v]format=rgba,split=2[c0][c1];"
        "[c1]alphaextract,format=gray[a];"
        "[c0]format=rgb24[c];"
        "[c][a]vstack=inputs=2[v]"
    )

    cmd = [
        ffmpeg_exe,
        "-y",
        "-framerate",
        str(fps),
        "-i",
        inp,
        "-filter_complex",
        filter_complex,
        "-map",
        "[v]",
        # ffmpeg uses mp4 muxer; keep the container compatible with common VAP pipelines.
        "-f",
        "mp4",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(out_file),
    ]
    run_ffmpeg(cmd)


def convert_one(args: ConvertArgs) -> tuple[Path, Path]:
    out_file, meta_file = ensure_out_paths(args)

    if args.dry_run:
        logging.warning("dry-run: 将输出 %s 和 %s", out_file, meta_file)
        return out_file, meta_file

    with tempfile.TemporaryDirectory(prefix="anim_zip_") as tmp:
        tmp_dir = Path(tmp)
        unzip_dir = tmp_dir / "unzipped"
        frames_dir = tmp_dir / "frames"
        unzip_dir.mkdir(parents=True, exist_ok=True)
        frames_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(args.input_zip) as zf:
            zf.extractall(unzip_dir)

        images = iter_image_files(unzip_dir)
        if not images:
            raise ValueError("输入 ZIP 中未找到支持的图片序列帧")

        # Preprocess frames into numbered PNGs
        for i, src in enumerate(images):
            dst = frames_dir / f"{i:03d}.png"
            with Image.open(src) as im:
                out = resize_frame(im, args.width, args.height, args.fit)
                out.save(dst, format="PNG", optimize=True)

        frame_count = len(images)

        if args.out_format == "vap":
            encode_vap(frames_dir, args.fps, out_file)
        elif args.out_format == "svga":
            encoder_cmd = os.getenv("SVGA_ENCODER_CMD", "").strip()
            if not encoder_cmd:
                raise RuntimeError(
                    "SVGA 编码器未配置。\n"
                    "请设置环境变量 SVGA_ENCODER_CMD（命令模板），并支持如下占位符替换：\n"
                    "- {framesDir}：帧目录（内含 000.png/001.png ...）\n"
                    "- {outFile}：目标 .svga 文件路径\n"
                    "- {fps}：帧率\n"
                    "- {width}/{height}：目标尺寸\n\n"
                    "示例（假设存在 svga-encoder-cli）：\n"
                    'SVGA_ENCODER_CMD="svga-encoder-cli --input {framesDir} --out {outFile} --fps {fps}"'
                )

            cmd = (
                encoder_cmd.replace("{framesDir}", str(frames_dir))
                .replace("{outFile}", str(out_file))
                .replace("{fps}", str(args.fps))
                .replace("{width}", str(args.width))
                .replace("{height}", str(args.height))
            )
            logging.info("执行 SVGA encoder：%s", cmd)
            # windows 下命令模板可能包含引号/重定向等，使用 shell 让用户模板语义自由
            p = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            if p.returncode != 0:
                out = (p.stdout or b"").decode("utf-8", errors="replace")
                raise RuntimeError(f"SVGA encoder 失败（code={p.returncode}）:\n{out[-2000:]}")
        else:
            raise ValueError(f"不支持的格式: {args.out_format}")

        meta = {
            "sourceZip": str(args.input_zip),
            "outputFormat": args.out_format,
            "width": args.width,
            "height": args.height,
            "fps": args.fps,
            "frameCount": frame_count,
            "fit": args.fit,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }
        meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    return out_file, meta_file


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="序列帧 ZIP 转 SVGA/VAP（素材工具）")
    p.add_argument("--input", required=False, type=Path, help="输入 zip 文件路径（与 --input-dir 二选一）")
    p.add_argument(
        "--input-dir",
        dest="input_dir",
        required=False,
        type=Path,
        help="输入 zip 所在目录（批量模式：目录下所有 *.zip）",
    )
    p.add_argument("--format", dest="out_format", choices=["vap", "svga"], default="vap", help="输出格式")
    p.add_argument("--width", type=int, required=True, help="输出宽度")
    p.add_argument("--height", type=int, required=True, help="输出高度")
    p.add_argument("--fps", type=int, default=30, help="帧率，默认 30")
    p.add_argument("--fit", choices=["contain", "cover", "stretch"], default="contain", help="尺寸策略，默认 contain(等比)")
    p.add_argument("--out-dir", type=Path, default=Path("docs/exports"), help="输出目录，默认 docs/exports")
    p.add_argument("--overwrite", action="store_true", help="覆盖已存在的输出")
    p.add_argument("--dry-run", action="store_true", help="仅打印将生成的产物，不实际生成")
    p.add_argument("-v", "--verbose", action="store_true", help="输出更多日志")
    return p


def main() -> None:
    args_ns = build_parser().parse_args()
    setup_logging(args_ns.verbose)
    width = int(args_ns.width)
    height = int(args_ns.height)
    fps = int(args_ns.fps)
    fit = args_ns.fit

    def build_common() -> dict[str, object]:
        return {
            "out_dir": args_ns.out_dir,
            "out_format": args_ns.out_format,
            "width": width,
            "height": height,
            "fps": fps,
            "fit": fit,
            "overwrite": bool(args_ns.overwrite),
            "dry_run": bool(args_ns.dry_run),
        }

    input_dir: Path | None = getattr(args_ns, "input_dir", None)
    input_zip: Path | None = getattr(args_ns, "input", None)

    if (not input_dir) and (not input_zip):
        print("必须提供 --input 或 --input-dir（二选一）", file=sys.stderr)
        sys.exit(2)

    if input_dir and input_zip:
        print("--input 与 --input-dir 只能二选一", file=sys.stderr)
        sys.exit(2)

    zips: list[Path] = []
    if input_dir:
        if not input_dir.exists():
            print(f"输入目录不存在: {input_dir}", file=sys.stderr)
            sys.exit(2)
        zips = sorted(input_dir.glob("*.zip"))
        if not zips:
            print(f"目录下未找到 *.zip: {input_dir}", file=sys.stderr)
            sys.exit(2)
    else:
        assert input_zip is not None
        if not input_zip.exists():
            print(f"输入不存在: {input_zip}", file=sys.stderr)
            sys.exit(2)
        zips = [input_zip]

    failures: list[str] = []
    ok_count = 0

    for z in zips:
        args = ConvertArgs(input_zip=z, **build_common())  # type: ignore[arg-type]
        try:
            out_file, meta_file = convert_one(args)
            ok_count += 1
            if args.dry_run:
                print(f"dry-run OK: {out_file} / {meta_file}")
            else:
                print(f"OK: {out_file}")
                print(f"META: {meta_file}")
        except Exception as e:
            msg = f"{z.name}: {e}"
            failures.append(msg)
            print(msg, file=sys.stderr)

    if failures:
        print(f"批量完成：成功 {ok_count}/{len(zips)}，失败 {len(failures)}：", file=sys.stderr)
        for f in failures:
            print(f" - {f}", file=sys.stderr)
        sys.exit(1 if ok_count == 0 else 2)


if __name__ == "__main__":
    main()

