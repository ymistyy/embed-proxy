export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get("User-Agent") || "";
    const path = url.pathname.split("/").filter(Boolean);

    if (path.length < 2) {
      return new Response("Invalid request", { status: 400 });
    }

    const route = path[0];
    const value = decodeURIComponent(path.slice(1).join("/"));

    let target = "";
    let platform = "generic";

    if (route === "reel") {
      target = `https://www.instagram.com/reel/${value}/`;
      platform = "instagram";
    } 
    else if (route === "p") {
      target = `https://www.instagram.com/p/${value}/`;
      platform = "instagram";
    } 
    else if (route === "tiktok") {
      target = value;
      platform = "tiktok";
    } 
    else if (route === "x") {
      target = value;
      platform = "x";
    } 
    else {
      return new Response("Invalid route", { status: 400 });
    }

    const cacheKey = `meta:${route}:${value}`;
    let data = await env.META_CACHE.get(cacheKey, "json");

    if (!data) {
      data = await fetchMeta(platform, target);

      await env.META_CACHE.put(
        cacheKey,
        JSON.stringify(data),
        { expirationTtl: 60 * 60 }
      );
    }

    const theme = getTheme(platform);

    if (ua.includes("Discordbot")) {
      return new Response(renderHTML(data, theme), {
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "public, max-age=300"
        }
      });
    }

    return Response.redirect(target, 302);
  }
};

// ----------------------------
// META ENGINE
// ----------------------------
async function fetchMeta(platform, target) {
  try {
    if (platform === "tiktok") {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`);
      const json = await res.json();

      return {
        title: cleanTitle(json.title) || "▶ Watch this TikTok",
        image: json.thumbnail_url,
        url: target
      };
    }

    if (platform === "x") {
      const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(target)}`);
      const json = await res.json();

      return {
        title: cleanTitle(json.title || json.author_name) || "▶ View this post",
        image: json.thumbnail_url || fallbackImage(),
        url: target
      };
    }

    return await fetchInstagram(target);

  } catch {
    return fallbackData(target);
  }
}

// ----------------------------
// INSTAGRAM
// ----------------------------
async function fetchInstagram(url) {
  let html = await fetchHTML(url);

  let title = extractOG(html, "og:title");
  let image = extractOG(html, "og:image");

  if (!image) {
    html = await fetchHTML(url + "embed/");
    image = extractOG(html, "og:image");
  }

  return {
    title: cleanTitle(title) || "▶ Watch this Instagram video",
    image: image || fallbackImage(),
    url
  };
}

// ----------------------------
// CLEAN TITLE
// ----------------------------
function cleanTitle(str = "") {
  return String(str)
    .replace(/#\w+/g, "")        // remove hashtags
    .replace(/\n/g, " ")         // remove line breaks
    .replace(/\s+/g, " ")        // normalize spaces
    .trim()
    .slice(0, 100);              // limit length
}

// ----------------------------
// FETCH HTML
// ----------------------------
async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  return await res.text();
}

// ----------------------------
// OG PARSER
// ----------------------------
function extractOG(html, prop) {
  const match = html.match(
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["'](.*?)["']`, "i")
  );
  return match ? match[1] : null;
}

// ----------------------------
// FALLBACKS
// ----------------------------
function fallbackImage() {
  return "https://dummyimage.com/800x600/111/fff&text=Video";
}

function fallbackData(url) {
  return {
    title: "▶ Watch this content",
    image: fallbackImage(),
    url
  };
}

// ----------------------------
// THEME
// ----------------------------
function getTheme(platform) {
  if (platform === "instagram") {
    return {
      color: "#E1306C",
      icon: "https://cdn-icons-png.flaticon.com/512/2111/2111463.png"
    };
  }

  if (platform === "tiktok") {
    return {
      color: "#000000",
      icon: "https://cdn-icons-png.flaticon.com/512/3046/3046121.png"
    };
  }

  if (platform === "x") {
    return {
      color: "#000000",
      icon: "https://cdn-icons-png.flaticon.com/512/5968/5968958.png"
    };
  }

  return {
    color: "#5865F2",
    icon: ""
  };
}

// ----------------------------
// RENDER HTML
// ----------------------------
function renderHTML(data, theme) {
  const title = escapeAttr(data.title || "▶ Watch this video");
  const image = escapeAttr(data.image || fallbackImage());
  const url = escapeAttr(data.url || "");
  const color = escapeAttr(theme.color || "#5865F2");
  const icon = escapeAttr(theme.icon || "");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<meta property="og:title" content="${title}">
<meta property="og:description" content="▶ Click to watch">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="video.other">

<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:title" content="${title}">
<meta property="twitter:image" content="${image}">

<meta name="theme-color" content="${color}">
<link rel="icon" href="${icon}">

</head>
<body></body>
</html>
`.trim();
}

// ----------------------------
// SAFE ESCAPE
// ----------------------------
function escapeAttr(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}