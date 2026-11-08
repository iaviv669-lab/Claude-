#!/usr/bin/env python3
"""photo_tool - find and clean up unwanted photos from a phone's camera roll.

Works on a folder of photos copied from an iPhone or Android phone. On Android
it can also pull photos over USB (adb) and delete the cleaned-up ones from the
phone itself.

Nothing is ever deleted outright: `clean --apply` moves files into
<folder>/_to_delete/ and writes a manifest, so `restore` can undo it.

Examples
  python photo_tool.py scan ~/PhonePhotos
  python photo_tool.py find ~/PhonePhotos --duplicates --similar --blurry --report review.html
  python photo_tool.py clean ~/PhonePhotos --screenshots --before 2020-01-01 --apply
  python photo_tool.py restore ~/PhonePhotos
  python photo_tool.py android-pull ~/PhonePhotos
  python photo_tool.py android-delete ~/PhonePhotos --apply
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import fnmatch
import hashlib
import html
import io
import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: pip install -r requirements.txt")

try:  # optional: iPhone HEIC photos
    from pillow_heif import register_heif_opener

    register_heif_opener()
    HEIC_OK = True
except ImportError:
    HEIC_OK = False

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".3gp", ".avi", ".mkv"}
TRASH_DIR = "_to_delete"
INDEX_FILE = ".photo_index.json"
ANDROID_MAP = ".android_source.json"
MANIFEST = "manifest.json"
INDEX_VERSION = 1


# --------------------------------------------------------------------------- analysis

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dhash(img: Image.Image) -> int:
    small = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    px = list(small.get_flattened_data() if hasattr(small, "get_flattened_data") else small.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return bits


def blur_score(img: Image.Image) -> float | None:
    """Variance of the Laplacian; low values mean a blurry photo."""
    if np is None:
        return None
    g = img.convert("L")
    g.thumbnail((800, 800))
    a = np.asarray(g, dtype=np.float32)
    if a.shape[0] < 3 or a.shape[1] < 3:
        return None
    lap = -4 * a[1:-1, 1:-1] + a[:-2, 1:-1] + a[2:, 1:-1] + a[1:-1, :-2] + a[1:-1, 2:]
    return float(lap.var())


def exif_info(img: Image.Image) -> dict:
    out = {"taken": None, "camera": None, "gps": False}
    try:
        ex = img.getexif()
    except Exception:
        return out
    sub = ex.get_ifd(0x8769) if ex else {}
    raw = sub.get(36867) or ex.get(306)  # DateTimeOriginal, DateTime
    if isinstance(raw, str):
        try:
            out["taken"] = dt.datetime.strptime(raw.strip()[:19], "%Y:%m:%d %H:%M:%S").isoformat()
        except ValueError:
            pass
    make, model = ex.get(271), ex.get(272)
    cam = " ".join(str(x).strip() for x in (make, model) if x)
    out["camera"] = cam or None
    out["gps"] = 34853 in ex
    return out


def analyze(path: Path) -> dict:
    st = path.stat()
    info = {
        "size": st.st_size,
        "mtime": st.st_mtime,
        "kind": "video" if path.suffix.lower() in VIDEO_EXT else "image",
        "sha256": sha256(path),
        "width": None, "height": None, "dhash": None, "blur": None,
        "taken": None, "camera": None, "gps": False, "error": None,
    }
    if info["kind"] == "image":
        try:
            with Image.open(path) as img:
                info.update(exif_info(img))
                img = ImageOps.exif_transpose(img)
                info["width"], info["height"] = img.size
                info["dhash"] = f"{dhash(img):016x}"
                info["blur"] = blur_score(img)
        except Exception as e:  # unreadable / unsupported (e.g. HEIC without pillow-heif)
            info["error"] = f"{type(e).__name__}: {e}"
    if not info["taken"]:
        info["taken"] = dt.datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds")
    return info


def iter_media(folder: Path):
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if d != TRASH_DIR and not d.startswith(".")]
        for name in files:
            p = Path(root) / name
            if p.suffix.lower() in IMAGE_EXT | VIDEO_EXT and not name.startswith("."):
                yield p


def load_index(folder: Path) -> dict:
    p = folder / INDEX_FILE
    if p.exists():
        try:
            data = json.loads(p.read_text())
            if data.get("version") == INDEX_VERSION:
                return data["files"]
        except (ValueError, KeyError):
            pass
    return {}


def scan(folder: Path, quiet: bool = False) -> dict:
    """Return {relpath: info} for every photo/video, reusing cached results."""
    cache = load_index(folder)
    files = {}
    paths = sorted(iter_media(folder))
    for i, p in enumerate(paths, 1):
        rel = p.relative_to(folder).as_posix()
        st = p.stat()
        old = cache.get(rel)
        if old and old["size"] == st.st_size and old["mtime"] == st.st_mtime:
            files[rel] = old
        else:
            files[rel] = analyze(p)
        if not quiet and (i % 50 == 0 or i == len(paths)):
            print(f"  scanned {i}/{len(paths)}", file=sys.stderr)
    (folder / INDEX_FILE).write_text(json.dumps({"version": INDEX_VERSION, "files": files}))
    errors = [r for r, f in files.items() if f["error"]]
    if errors and not quiet:
        hint = " (install pillow-heif for iPhone HEIC files)" if not HEIC_OK else ""
        print(f"  {len(errors)} file(s) could not be read as images{hint}", file=sys.stderr)
    return files


# --------------------------------------------------------------------------- selection

def quality(rel: str, f: dict) -> tuple:
    """Higher is better: used to pick which copy of a group to keep."""
    return ((f["width"] or 0) * (f["height"] or 0), f["blur"] or 0, f["size"], -len(rel), rel)


def pick_losers(groups: list[list[str]], files: dict, reason: str) -> dict:
    out = {}
    for g in groups:
        if len(g) < 2:
            continue
        keep = max(g, key=lambda r: quality(r, files[r]))
        for r in g:
            if r != keep:
                out[r] = f"{reason} {keep}"
    return out


def exact_duplicates(files: dict, scope: set) -> dict:
    by_hash: dict[str, list[str]] = {}
    for r in scope:
        by_hash.setdefault(files[r]["sha256"], []).append(r)
    return pick_losers(list(by_hash.values()), files, "duplicate of")


def similar_groups(files: dict, scope: set, threshold: int) -> dict:
    items = [(r, int(files[r]["dhash"], 16)) for r in sorted(scope) if files[r]["dhash"]]
    parent = {r: r for r, _ in items}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i, (a, ha) in enumerate(items):
        for b, hb in items[i + 1:]:
            if bin(ha ^ hb).count("1") <= threshold:
                parent[find(a)] = find(b)
    groups: dict[str, list[str]] = {}
    for r, _ in items:
        groups.setdefault(find(r), []).append(r)
    return pick_losers(list(groups.values()), files, "similar to")


def is_screenshot(rel: str, f: dict) -> bool:
    name = Path(rel).name.lower()
    if "screenshot" in name or "screen shot" in name or "screen_shot" in name:
        return True
    return Path(rel).suffix.lower() == ".png" and not f["camera"] and f["kind"] == "image"


def parse_date(s: str) -> str:
    try:
        return dt.date.fromisoformat(s).isoformat()
    except ValueError:
        raise argparse.ArgumentTypeError(f"expected YYYY-MM-DD, got {s!r}")


def select(files: dict, a) -> dict:
    """Return {relpath: reason} for the files matching the filters in `a`.

    --name/--before/--after/--videos/--images narrow the scope (AND).
    The category flags (--duplicates, --similar, --blurry, ...) are combined
    with OR. With no category flag, everything in scope matches.
    """
    scope = set(files)
    if a.name:
        scope = {r for r in scope if any(fnmatch.fnmatch(Path(r).name.lower(), g.lower()) for g in a.name)}
    if a.folder_glob:
        scope = {r for r in scope if fnmatch.fnmatch(r.lower(), a.folder_glob.lower())}
    if a.before:
        scope = {r for r in scope if files[r]["taken"][:10] < a.before}
    if a.after:
        scope = {r for r in scope if files[r]["taken"][:10] >= a.after}
    if a.videos:
        scope = {r for r in scope if files[r]["kind"] == "video"}
    if a.images:
        scope = {r for r in scope if files[r]["kind"] == "image"}

    categories = [a.duplicates, a.similar is not None, a.blurry is not None, a.screenshots,
                  a.tiny is not None, a.larger_than is not None, a.no_camera]
    if not any(categories):
        return {r: "matched filters" for r in scope}

    hits: dict[str, str] = {}

    def add(r, why):
        hits.setdefault(r, why)

    if a.duplicates:
        for r, why in exact_duplicates(files, scope).items():
            add(r, why)
    if a.similar is not None:
        for r, why in similar_groups(files, scope, a.similar).items():
            add(r, why)
    for r in sorted(scope):
        f = files[r]
        if a.blurry is not None and f["blur"] is not None and f["blur"] < a.blurry:
            add(r, f"blurry (score {f['blur']:.0f} < {a.blurry:g})")
        if a.screenshots and is_screenshot(r, f):
            add(r, "screenshot")
        if a.tiny is not None and f["width"] and f["width"] * f["height"] < a.tiny * 1e6:
            add(r, f"tiny ({f['width']}x{f['height']})")
        if a.larger_than is not None and f["size"] > a.larger_than * 1e6:
            add(r, f"large ({f['size'] / 1e6:.1f} MB)")
        if a.no_camera and f["kind"] == "image" and not f["camera"]:
            add(r, "no camera info (saved/downloaded image)")
    return hits


# --------------------------------------------------------------------------- output

def human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return str(n)


def print_hits(hits: dict, files: dict) -> None:
    for r in sorted(hits):
        f = files[r]
        print(f"{r}\t{f['taken'][:10]}\t{human(f['size'])}\t{hits[r]}")
    total = sum(files[r]["size"] for r in hits)
    print(f"\n{len(hits)} of {len(files)} files matched, {human(total)}", file=sys.stderr)


def thumb_uri(path: Path) -> str:
    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((240, 240))
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=70)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return ""


def write_report(out: Path, folder: Path, hits: dict, files: dict) -> None:
    cards = []
    for r in sorted(hits):
        f = files[r]
        src = thumb_uri(folder / r) if f["kind"] == "image" else ""
        img = f'<img src="{src}" alt="">' if src else f'<div class="ph">{html.escape(f["kind"])}</div>'
        cards.append(
            f'<figure>{img}<figcaption><b>{html.escape(r)}</b><br>{f["taken"][:10]} · '
            f'{human(f["size"])}<br><i>{html.escape(hits[r])}</i></figcaption></figure>')
    out.write_text(f"""<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Photo cleanup review</title>
<style>
body{{font:14px system-ui,sans-serif;margin:16px;background:#fafafa;color:#222}}
@media (prefers-color-scheme:dark){{body{{background:#161616;color:#ddd}} figure{{background:#222!important}}}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}}
figure{{margin:0;background:#fff;border-radius:8px;padding:8px;overflow:hidden}}
img,.ph{{width:100%;height:180px;object-fit:cover;border-radius:4px;background:#ccc;display:grid;place-items:center}}
figcaption{{font-size:12px;word-break:break-all;margin-top:6px}}
</style>
<h1>{len(hits)} photos selected for cleanup</h1>
<p>Total {human(sum(files[r]['size'] for r in hits))}. Nothing has been moved yet.</p>
<div class="grid">{''.join(cards)}</div>""")
    print(f"review page written to {out}", file=sys.stderr)


# --------------------------------------------------------------------------- commands

def cmd_scan(a):
    files = scan(a.folder)
    imgs = [f for f in files.values() if f["kind"] == "image"]
    print(f"{len(files)} files ({len(imgs)} images, {len(files) - len(imgs)} videos), "
          f"{human(sum(f['size'] for f in files.values()))}")
    print(f"index saved to {a.folder / INDEX_FILE}")


def cmd_find(a):
    files = scan(a.folder, quiet=a.quiet)
    hits = select(files, a)
    print_hits(hits, files)
    if a.report:
        write_report(a.report, a.folder, hits, files)
    return hits


def cmd_clean(a):
    files = scan(a.folder, quiet=a.quiet)
    hits = select(files, a)
    print_hits(hits, files)
    if a.report:
        write_report(a.report, a.folder, hits, files)
    if not hits:
        return
    if not a.apply:
        print(f"\nDry run: nothing moved. Re-run with --apply to move these into {TRASH_DIR}/.",
              file=sys.stderr)
        return
    trash = a.folder / TRASH_DIR
    trash.mkdir(exist_ok=True)
    mpath = trash / MANIFEST
    manifest = json.loads(mpath.read_text()) if mpath.exists() else []
    stamp = dt.datetime.now().isoformat(timespec="seconds")
    for r in sorted(hits):
        dest = trash / r
        dest.parent.mkdir(parents=True, exist_ok=True)
        n = 1
        while dest.exists():
            dest = dest.with_name(f"{Path(r).stem}~{n}{Path(r).suffix}")
            n += 1
        shutil.move(str(a.folder / r), dest)
        manifest.append({"original": r, "moved_to": dest.relative_to(trash).as_posix(),
                         "reason": hits[r], "when": stamp})
    mpath.write_text(json.dumps(manifest, indent=1))
    print(f"\nMoved {len(hits)} files into {trash}. Undo with: restore {a.folder}", file=sys.stderr)


def cmd_restore(a):
    trash = a.folder / TRASH_DIR
    mpath = trash / MANIFEST
    if not mpath.exists():
        sys.exit("nothing to restore")
    manifest = json.loads(mpath.read_text())
    keep, restored = [], 0
    for e in manifest:
        if a.name and not any(fnmatch.fnmatch(Path(e["original"]).name.lower(), g.lower()) for g in a.name):
            keep.append(e)
            continue
        src, dst = trash / e["moved_to"], a.folder / e["original"]
        if not src.exists():
            continue
        if dst.exists():
            print(f"skip {e['original']}: a file is already there", file=sys.stderr)
            keep.append(e)
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), dst)
        restored += 1
    mpath.write_text(json.dumps(keep, indent=1))
    print(f"restored {restored} files")


def cmd_empty(a):
    trash = a.folder / TRASH_DIR
    if not trash.exists():
        sys.exit("nothing to empty")
    entries = json.loads((trash / MANIFEST).read_text()) if (trash / MANIFEST).exists() else []
    if not a.apply:
        print(f"{len(entries)} files in {trash} would be permanently deleted. Re-run with --apply.")
        return
    shutil.rmtree(trash)
    print(f"permanently deleted {len(entries)} files")


# ---------------------------------------------------------------------------- android

def adb(*args, check=True) -> str:
    if not shutil.which("adb"):
        sys.exit("adb not found. Install Android platform-tools and enable USB debugging on the phone.")
    r = subprocess.run(["adb", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"adb {' '.join(args)} failed:\n{r.stderr or r.stdout}")
    return r.stdout


def cmd_android_pull(a):
    a.folder.mkdir(parents=True, exist_ok=True)
    mpath = a.folder / ANDROID_MAP
    mapping = json.loads(mpath.read_text()) if mpath.exists() else {}
    for src in a.src:
        listing = adb("shell", f"find {shlex.quote(src)} -type f")
        phone_files = [ln.strip() for ln in listing.splitlines()
                       if Path(ln.strip()).suffix.lower() in IMAGE_EXT | VIDEO_EXT]
        sub = a.folder / Path(src).name
        sub.mkdir(exist_ok=True)
        print(f"{src}: {len(phone_files)} files", file=sys.stderr)
        for i, pf in enumerate(phone_files, 1):
            rel_on_phone = os.path.relpath(pf, src)
            local = sub / rel_on_phone
            rel = local.relative_to(a.folder).as_posix()
            if not local.exists():
                local.parent.mkdir(parents=True, exist_ok=True)
                adb("pull", "-a", pf, str(local))
            mapping[rel] = pf
            if i % 50 == 0:
                print(f"  {i}/{len(phone_files)}", file=sys.stderr)
    mpath.write_text(json.dumps(mapping, indent=1))
    print(f"pulled into {a.folder}; phone paths remembered in {mpath.name}")


def cmd_android_delete(a):
    mpath = a.folder / ANDROID_MAP
    tpath = a.folder / TRASH_DIR / MANIFEST
    if not mpath.exists() or not tpath.exists():
        sys.exit("needs a folder made with android-pull and cleaned with clean --apply")
    mapping = json.loads(mpath.read_text())
    targets = [mapping[e["original"]] for e in json.loads(tpath.read_text()) if e["original"] in mapping]
    if not targets:
        sys.exit("none of the cleaned files came from the phone")
    print(f"{len(targets)} files would be deleted from the phone:")
    for t in targets[:20]:
        print("  " + t)
    if len(targets) > 20:
        print(f"  ... and {len(targets) - 20} more")
    if not a.apply:
        print("Dry run. Re-run with --apply to delete them from the phone.")
        return
    for t in targets:
        q = shlex.quote(t)
        adb("shell", f"rm -f {q}", check=False)
        # remove the gallery's entry so the photo disappears from the Photos/Gallery app
        adb("shell", "content", "delete", "--uri", "content://media/external/file",
            "--where", shlex.quote(f"_data='{t.replace(chr(39), chr(39) * 2)}'"), check=False)
    gone = set(targets)
    mapping = {k: v for k, v in mapping.items() if v not in gone}
    mpath.write_text(json.dumps(mapping, indent=1))
    print(f"deleted {len(targets)} files from the phone (local copies stay in {TRASH_DIR}/)")


# --------------------------------------------------------------------------- CLI

def add_filters(p):
    g = p.add_argument_group("what to match (categories are combined with OR)")
    g.add_argument("--duplicates", action="store_true", help="exact duplicate files (keeps the best copy)")
    g.add_argument("--similar", type=int, nargs="?", const=6, metavar="N",
                   help="near-identical shots, e.g. bursts (keeps the sharpest); N = strictness, default 6")
    g.add_argument("--blurry", type=float, nargs="?", const=60.0, metavar="SCORE",
                   help="blurry photos, sharpness score below SCORE (default 60)")
    g.add_argument("--screenshots", action="store_true", help="screenshots")
    g.add_argument("--no-camera", action="store_true", help="images with no camera info (memes, downloads, saved images)")
    g.add_argument("--tiny", type=float, nargs="?", const=0.3, metavar="MP",
                   help="images under MP megapixels (default 0.3)")
    g.add_argument("--larger-than", type=float, metavar="MB", help="files bigger than MB megabytes")
    s = p.add_argument_group("limit to (combined with AND)")
    s.add_argument("--name", action="append", metavar="GLOB", help="file name pattern, e.g. 'IMG-*WA*' (repeatable)")
    s.add_argument("--path", dest="folder_glob", metavar="GLOB", help="relative path pattern, e.g. 'WhatsApp*/*'")
    s.add_argument("--before", type=parse_date, metavar="YYYY-MM-DD", help="taken before this date")
    s.add_argument("--after", type=parse_date, metavar="YYYY-MM-DD", help="taken on/after this date")
    s.add_argument("--videos", action="store_true", help="only videos")
    s.add_argument("--images", action="store_true", help="only images")
    p.add_argument("--report", type=Path, metavar="FILE.html", help="write a thumbnail review page")
    p.add_argument("-q", "--quiet", action="store_true")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)

    p = sp.add_parser("scan", help="index a folder of photos")
    p.add_argument("folder", type=Path)
    p.set_defaults(fn=cmd_scan)

    p = sp.add_parser("find", help="list photos matching filters (changes nothing)")
    p.add_argument("folder", type=Path)
    add_filters(p)
    p.set_defaults(fn=cmd_find)

    p = sp.add_parser("clean", help=f"move matching photos into {TRASH_DIR}/ (dry run unless --apply)")
    p.add_argument("folder", type=Path)
    add_filters(p)
    p.add_argument("--apply", action="store_true", help="actually move the files")
    p.set_defaults(fn=cmd_clean)

    p = sp.add_parser("restore", help=f"put files from {TRASH_DIR}/ back")
    p.add_argument("folder", type=Path)
    p.add_argument("--name", action="append", metavar="GLOB", help="only restore matching names")
    p.set_defaults(fn=cmd_restore)

    p = sp.add_parser("empty-trash", help=f"permanently delete {TRASH_DIR}/")
    p.add_argument("folder", type=Path)
    p.add_argument("--apply", action="store_true")
    p.set_defaults(fn=cmd_empty)

    p = sp.add_parser("android-pull", help="copy photos from an Android phone over USB (adb)")
    p.add_argument("folder", type=Path)
    p.add_argument("--src", action="append",
                   help="phone folder (repeatable; default /sdcard/DCIM/Camera and /sdcard/Pictures)")
    p.set_defaults(fn=cmd_android_pull)

    p = sp.add_parser("android-delete", help="delete cleaned-up photos from the Android phone itself")
    p.add_argument("folder", type=Path)
    p.add_argument("--apply", action="store_true")
    p.set_defaults(fn=cmd_android_delete)

    a = ap.parse_args(argv)
    a.folder = a.folder.expanduser().resolve()
    if a.cmd == "android-pull" and not a.src:
        a.src = ["/sdcard/DCIM/Camera", "/sdcard/Pictures"]
    if a.cmd not in ("android-pull",) and not a.folder.is_dir():
        sys.exit(f"not a folder: {a.folder}")
    a.fn(a)


if __name__ == "__main__":
    main()
