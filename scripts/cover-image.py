"""Generate a 16:9 cover image with Gemini and save it to static/images/<name>.jpg.

usage (from the repo root):
  ( . ~/.config/content-engine.env; GK="$GEMINI_TOOLS_API_KEY" python3 -I scripts/cover-image.py <name> "<prompt>" )
  ( . ~/.config/content-engine.env; GK="$GEMINI_TOOLS_API_KEY" python3 -I scripts/cover-image.py --pending )

The key is the Elderella content engine's Gemini key (GEMINI_TOOLS_API_KEY).
"""
import base64, json, os, subprocess, sys, urllib.request

STYLE = (" Clean flat vector editorial illustration, generous negative space."
         " Absolutely no words, letters, numbers, or logos.")
PENDING = {
    "2026-11-dont-trade-salary-for-stock-options":
        "A single stack of paper cash at the bottom centre splits into two paths. The left path leads to a "
        "solid share certificate resting on firm ground. The right path leads to a thin paper ticket "
        "half-submerged in water, with a second unpaid bill clipped to it. Muted navy, cream and soft green palette." + STYLE,
    "2026-11-what-if-house-of-friendship-didnt-exist":
        "A warm neighbourhood community centre at dusk in a mid-sized Canadian city, windows glowing. Outside, "
        "a volunteer hands a food hamper to a parent with a child; a few neighbours chat on the steps. Quiet, "
        "hopeful, dignified, late-autumn trees. Warm amber, cream and deep blue palette." + STYLE,
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def generate(name, prompt):
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9"}}}
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GK"]})
    r = json.load(urllib.request.urlopen(req, timeout=240))
    parts = [p for p in r["candidates"][0]["content"]["parts"] if "inlineData" in p]
    if not parts:
        print(name, "FAILED", json.dumps(r)[:300])
        return
    raw = os.path.join(ROOT, "static/images", name + ".png")
    out = os.path.join(ROOT, "static/images", name + ".jpg")
    with open(raw, "wb") as f:
        f.write(base64.b64decode(parts[0]["inlineData"]["data"]))
    # Resize to 1200px wide JPEG with macOS sips, then drop the PNG.
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "85", "--resampleWidth", "1200",
                    raw, "--out", out], check=True, capture_output=True)
    os.remove(raw)
    print("saved", out)


if __name__ == "__main__":
    if sys.argv[1:] == ["--pending"]:
        for n, p in PENDING.items():
            generate(n, p)
    else:
        generate(sys.argv[1], sys.argv[2])
