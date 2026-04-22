export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get("User-Agent") || "";

    const path = url.pathname.split("/").filter(Boolean);

    if (path.length < 2) {
      return new Response("Invalid request", { status: 400 });
    }

    const route = path[0];
    const value = path[1];

    // ----------------------------
    // Build target URL
    // ----------------------------
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
      target = `https://www.tiktok.com/@user/video/${value}`;
      platform = "tiktok";
    } 
    else if (route === "x") {
      target = `https://x.com/i/status/${value}`;
      platform = "x";
    } 
    else {
      return new Response("Invalid route", { status: 400 });
    }

    // ----------------------------
    // KV CACHE CHECK (NEW)
    // ----------------------------
    const cacheKey = `meta:${route}:${value}`;
    const cached = await env.META_CACHE.get(cacheKey);

    let data;

    if (cached) {
      data = JSON.parse(cached);
    } else {
      // fetch OG
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const html = await res.text();

      function extract(prop) {
        const match = html.match(
          new RegExp(`property="${prop}" content="(.*?)"`)
        );
        return match ? match[1] : null;
      }

      data = {
        title: extract("og:title") || "Shared content",
        image: extract("og:image"),
        url: target,
        platform
      };

      // store in KV (30 min cache)
      await env.META_CACHE.put(
        cacheKey,
        JSON.stringify(data),
        { expirationTtl: 60 * 30 }
      );
    }

    // ----------------------------
    // PLATFORM THEMES (NEW)
    // ----------------------------
    let theme = {
      color: "#5865F2",
      icon: ""
    };

    if (platform === "instagram") {
      theme.color = "#E1306C";
      theme.icon = "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
    }

    if (platform === "tiktok") {
      theme.color = "#000000";
      theme.icon = "https://cdn-icons-png.flaticon.com/512/3046/3046121.png";
    }

    if (platform === "x") {
      theme.color = "#000000";
      theme.icon = "https://cdn-icons-png.flaticon.com/512/5968/5968958.png";
    }

    // ----------------------------
    // DISCORD EMBED MODE
    // ----------------------------
    if (ua.includes("Discordbot")) {
      return new Response(`
        <html>
        <head>
          <meta property="og:title" content="${data.title}">
          <meta property="og:image" content="${data.image}">
          <meta property="og:url" content="${data.url}">
          <meta property="og:type" content="website">
          <meta name="theme-color" content="${theme.color}">
          <link rel="icon" href="${theme.icon}">
        </head>
        <body></body>
        </html>
      `, {
        headers: { "content-type": "text/html" }
      });
    }

    // ----------------------------
    // NORMAL USERS
    // ----------------------------
    return Response.redirect(target, 302);
  }
};
