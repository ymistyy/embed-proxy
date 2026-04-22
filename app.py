from flask import Flask, request, redirect, Response
import requests
import re
import redis
import json
import tldextract
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# ----------------------------
# Redis cache
# ----------------------------
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

CACHE_TTL = 60 * 30  # 30 min

# ----------------------------
# Rate limiting
# ----------------------------
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["60 per minute"]
)

# ----------------------------
# safety
# ----------------------------
ID_REGEX = re.compile(r"^[A-Za-z0-9._-]+$")


# ----------------------------
# Platform detection from URL
# ----------------------------
def detect_platform(url):
    domain = tldextract.extract(url).domain.lower()

    if "instagram" in domain:
        return "instagram"
    if "tiktok" in domain:
        return "tiktok"
    if "twitter" in domain or "x" in domain:
        return "x"
    return "generic"


# ----------------------------
# icon mapping
# ----------------------------
def get_icon(platform):
    return {
        "instagram": "https://cdn-icons-png.flaticon.com/512/2111/2111463.png",
        "tiktok": "https://cdn-icons-png.flaticon.com/512/3046/3046121.png",
        "x": "https://cdn-icons-png.flaticon.com/512/5968/5968958.png",
        "generic": "https://cdn-icons-png.flaticon.com/512/1006/1006771.png"
    }.get(platform, "")


# ----------------------------
# metadata (cached)
# ----------------------------
def get_meta(url):
    key = f"meta:{url}"

    cached = r.get(key)
    if cached:
        return json.loads(cached)

    try:
        html = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=5
        ).text

        def extract(prop):
            import re
            m = re.search(f'property="{prop}" content="(.*?)"', html)
            return m.group(1) if m else None

        data = {
            "title": extract("og:title") or "Shared content",
            "image": extract("og:image"),
            "url": url
        }

        r.setex(key, CACHE_TTL, json.dumps(data))
        return data

    except:
        return {
            "title": "Shared content",
            "image": None,
            "url": url
        }


# ----------------------------
# URL builders (NEW CORE LOGIC)
# ----------------------------
def build_url(route, value):
    if not ID_REGEX.match(value):
        return None

    if route == "reel":
        return f"https://www.instagram.com/reel/{value}/"

    if route == "p":
        return f"https://www.instagram.com/p/{value}/"

    if route == "tiktok":
        return f"https://www.tiktok.com/@user/video/{value}"

    if route == "x":
        return f"https://x.com/i/status/{value}"

    return None


# ----------------------------
# MAIN ROUTE (CLEAN VERSION)
# ----------------------------
@app.route("/<route>/<value>/")
@limiter.limit("30 per minute")
def proxy(route, value):
    ua = request.headers.get("User-Agent", "")

    url = build_url(route, value)

    if not url:
        return "Invalid request", 400

    platform = detect_platform(url)
    meta = get_meta(url)
    icon = get_icon(platform)

    # ----------------------------
    # Discord embed mode
    # ----------------------------
    if "Discordbot" in ua:
        html = f"""
        <html>
        <head>
            <meta property="og:title" content="{meta['title']}">
            <meta property="og:image" content="{meta['image']}">
            <meta property="og:url" content="{meta['url']}">
            <meta property="og:type" content="website">
            <meta name="theme-color" content="#5865F2">

            <link rel="icon" href="{icon}">
        </head>
        <body></body>
        </html>
        """
        return Response(html, mimetype="text/html")

    # normal users → redirect
    return redirect(url, code=302)


# ----------------------------
@app.route("/")
def home():
    return "PRO Embed Proxy running (clean routes enabled)"


@app.errorhandler(429)
def ratelimit_handler(e):
    return "Too many requests", 429


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
