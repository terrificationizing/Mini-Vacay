"""One-time script: derive the six geometry/color constants for each of the 9 preloaded
avatars from their already-cropped, background-removed, bottom-anchored 720x1100 PNGs in
public/avatars/. These PNGs are NOT reprocessed (no re-flood-fill, no re-scaling) -- only
detection runs against them. Writes data/avatarProfiles.ts directly.

Run from repo root: python3 scripts/derive_avatar_profiles.py
"""
from PIL import Image
from collections import Counter, deque
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AVATARS_DIR = os.path.join(REPO, "public", "avatars")
OUT_PATH = os.path.join(REPO, "data", "avatarProfiles.ts")

# Grid display order (left-to-right, top-to-bottom), per the approved plan.
NAMES_IN_ORDER = ["rebecca", "andy", "terri", "gus", "claudia", "abe", "matt", "nichole", "mj"]
DISPLAY_NAMES = {n: n.capitalize() if n != "mj" else "MJ" for n in NAMES_IN_ORDER}

# No auto-detector for iris color (rarely visible at this render size) -- shared default,
# matches the value already verified/shipped for terri.
DEFAULT_IRIS_COLOR = 0x3F2A17


def find_shoulder_row(path):
    """The shoulder is the single widest row of the avatar's own silhouette, full stop --
    verified against multiple avatars' hand-measured ground truth. No search window, no
    heuristics: just the global width maximum."""
    im = Image.open(path).convert("RGBA")
    ap = im.split()[3]
    w, h = im.size
    best = None
    for y in range(0, h, 2):
        xs = [x for x in range(w) if ap.getpixel((x, y)) > 20]
        if xs:
            width = max(xs) - min(xs)
            if best is None or width > best[1]:
                best = (y, width, min(xs), max(xs))
    return best


def sample_arm_color(final_img, anchor_bottom_y):
    """Samples at the LOWER corners of the torso (near avatar.y), not the shoulder --
    the shoulder can still be within a short sleeve while the lower torso is already
    bare skin."""
    px = final_img.load()
    ap = final_img.split()[3]
    w, h = final_img.size
    sample_y = min(h - 1, int(anchor_bottom_y) - 25)

    def sample_side(from_left):
        xs = [x for x in range(w) if ap.getpixel((x, sample_y)) > 200]
        if not xs:
            return None
        edge = min(xs) if from_left else max(xs)
        samples = []
        for dx in range(0, 14):
            xx = edge + dx if from_left else edge - dx
            for dy in range(-4, 5):
                yy = sample_y + dy
                if 0 <= xx < w and 0 <= yy < h and ap.getpixel((xx, yy)) > 200:
                    samples.append(px[xx, yy][:3])
        if not samples:
            return None
        return tuple(sum(c[i] for c in samples) // len(samples) for i in range(3))

    left = sample_side(True)
    right = sample_side(False)
    if left and right:
        return tuple((a + b) // 2 for a, b in zip(left, right))
    return left or right


def is_near_white(c):
    return min(c) > 205 and (max(c) - min(c)) < 20


def detect_eyes_and_skin(im):
    w, h = im.size
    px = im.load()
    ap = im.split()[3].load()
    bbox = im.split()[3].getbbox()
    left, top, right, bottom = bbox

    search_bottom = int(top + (bottom - top) * 0.6)
    is_white = [[False] * w for _ in range(h)]
    for y in range(top, search_bottom):
        for x in range(left, right):
            if ap[x, y] > 200:
                r, g, b = px[x, y][:3]
                if min(r, g, b) > 195 and (max(r, g, b) - min(r, g, b)) < 40:
                    is_white[y][x] = True

    visited = [[False] * w for _ in range(h)]
    blobs = []
    for y in range(top, search_bottom):
        for x in range(left, right):
            if is_white[y][x] and not visited[y][x]:
                q = deque([(x, y)])
                visited[y][x] = True
                pts = []
                while q:
                    cx2, cy2 = q.popleft()
                    pts.append((cx2, cy2))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx2 + dx, cy2 + dy
                        if 0 <= nx < w and 0 <= ny < h and is_white[ny][nx] and not visited[ny][nx]:
                            visited[ny][nx] = True
                            q.append((nx, ny))
                if len(pts) > 30:
                    xs = [p[0] for p in pts]
                    ys = [p[1] for p in pts]
                    blobs.append({"size": len(pts), "cx": sum(xs) / len(xs), "cy": sum(ys) / len(ys),
                                  "w": max(xs) - min(xs), "h": max(ys) - min(ys)})

    candidates = [b for b in blobs if b["w"] > b["h"]]
    best_pair, best_score = None, float("inf")
    for i in range(len(candidates)):
        for j in range(i + 1, len(candidates)):
            a, b = candidates[i], candidates[j]
            score = abs(a["size"] - b["size"]) + abs(a["cy"] - b["cy"]) * 5
            if score < best_score:
                best_score, best_pair = score, (a, b)
    eye_a, eye_b = best_pair
    left_eye, right_eye = sorted([eye_a, eye_b], key=lambda b: b["cx"])
    eye_spacing = right_eye["cx"] - left_eye["cx"]
    eye_cx = (left_eye["cx"] + right_eye["cx"]) / 2
    eye_cy = (left_eye["cy"] + right_eye["cy"]) / 2
    eye_sclera_h = (left_eye["h"] + right_eye["h"]) / 2

    BIN = 28

    def sample_dominant(x0, x1, y0, y1):
        bucket_counts, bucket_examples = Counter(), {}
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                if ap[xx, yy] > 200:
                    c = px[xx, yy][:3]
                    key = tuple(v // BIN for v in c)
                    bucket_counts[key] += 1
                    bucket_examples.setdefault(key, Counter())[c] += 1
        return bucket_examples[bucket_counts.most_common(1)[0][0]].most_common(1)[0][0]

    skin_cx = eye_cx
    skin_cy = eye_cy + eye_spacing * 0.45
    skin_half = max(6, int(eye_spacing * 0.06))
    skin_rgb = sample_dominant(
        int(skin_cx - skin_half), int(skin_cx + skin_half),
        int(skin_cy - skin_half), int(skin_cy + skin_half),
    )

    return {
        "left_eye": left_eye, "right_eye": right_eye,
        "eye_sclera_h": eye_sclera_h, "skin_rgb": skin_rgb,
    }


def to_hex(rgb):
    return "0x%02x%02x%02x" % rgb


def derive_profile(name):
    smile_path = os.path.join(AVATARS_DIR, f"{name}-smile.png")
    im = Image.open(smile_path).convert("RGBA")
    CANVAS_H = im.size[1]

    eyes = detect_eyes_and_skin(im)
    shoulder_y, _w, shoulder_left, shoulder_right = find_shoulder_row(smile_path)

    arm_sample = sample_arm_color(im, CANVAS_H)
    skin_rgb = eyes["skin_rgb"]
    arm_color = arm_sample if arm_sample else skin_rgb
    if is_near_white(arm_color):
        arm_color = skin_rgb

    profile = {
        "id": name,
        "displayName": DISPLAY_NAMES[name],
        "eyeLocal": {
            "left": {"x": round(eyes["left_eye"]["cx"] / 2, 1), "y": round(eyes["left_eye"]["cy"] / 2, 1)},
            "right": {"x": round(eyes["right_eye"]["cx"] / 2, 1), "y": round(eyes["right_eye"]["cy"] / 2, 1)},
        },
        "scleraHeightLocal": round(eyes["eye_sclera_h"] / 2, 2),
        "shoulderLocal": {
            "left": {"x": round(shoulder_left / 2, 1), "y": round(shoulder_y / 2, 1)},
            "right": {"x": round(shoulder_right / 2, 1), "y": round(shoulder_y / 2, 1)},
        },
        "armColor": to_hex(arm_color),
        "skinColor": to_hex(skin_rgb),
        "irisColor": "0x%06x" % DEFAULT_IRIS_COLOR,
    }
    print(f"{name}: shoulder=({shoulder_left},{shoulder_right},{shoulder_y}) "
          f"eyeSpacing={eyes['right_eye']['cx']-eyes['left_eye']['cx']:.1f} "
          f"armColor={to_hex(arm_color)} skinColor={to_hex(skin_rgb)}")
    return profile


def render_ts(profiles):
    lines = []
    lines.append("// AUTO-GENERATED by scripts/derive_avatar_profiles.py -- do not hand-edit.")
    lines.append("// Regenerate by rerunning the script against public/avatars/*.png.")
    lines.append('import type { AvatarGeometry } from "./avatarGeometry";')
    lines.append("")
    lines.append("export type AvatarProfile = AvatarGeometry & {")
    lines.append("  id: string;")
    lines.append("  displayName: string;")
    lines.append("  smileKey: string;")
    lines.append("  frownKey: string;")
    lines.append("  smileSrc: string;")
    lines.append("  frownSrc: string;")
    lines.append("};")
    lines.append("")
    lines.append("export const AVATAR_PROFILES: AvatarProfile[] = [")
    for p in profiles:
        lines.append("  {")
        lines.append(f'    id: "{p["id"]}", displayName: "{p["displayName"]}",')
        lines.append(f'    smileKey: "avatar-{p["id"]}-smile", frownKey: "avatar-{p["id"]}-frown",')
        lines.append(f'    smileSrc: "/avatars/{p["id"]}-smile.png", frownSrc: "/avatars/{p["id"]}-frown.png",')
        lines.append(
            f'    eyeLocal: {{ left: {{ x: {p["eyeLocal"]["left"]["x"]}, y: {p["eyeLocal"]["left"]["y"]} }}, '
            f'right: {{ x: {p["eyeLocal"]["right"]["x"]}, y: {p["eyeLocal"]["right"]["y"]} }} }},'
        )
        lines.append(f'    scleraHeightLocal: {p["scleraHeightLocal"]},')
        lines.append(
            f'    shoulderLocal: {{ left: {{ x: {p["shoulderLocal"]["left"]["x"]}, y: {p["shoulderLocal"]["left"]["y"]} }}, '
            f'right: {{ x: {p["shoulderLocal"]["right"]["x"]}, y: {p["shoulderLocal"]["right"]["y"]} }} }},'
        )
        lines.append(f'    armColor: {p["armColor"]}, skinColor: {p["skinColor"]}, irisColor: {p["irisColor"]},')
        lines.append("  },")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    profiles = [derive_profile(name) for name in NAMES_IN_ORDER]
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        f.write(render_ts(profiles))
    print(f"\nWrote {OUT_PATH}")
