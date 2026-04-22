# Universal Embed Proxy

A simple self-hosted link proxy that converts social media URLs into Discord-friendly embeds while redirecting normal users to the original content.

## Features

- Supports any URL with OpenGraph metadata
- Discord embed support
- Automatic platform detection (Instagram, TikTok, X, etc.)
- Redis caching for improved performance
- Rate limiting for basic abuse protection
- Redirects normal users to original links

---

## Requirements

- Python 3.8+
- Redis server
- Hostingplatform

---

## Installation

### 1. Clone or copy the project
git clone <your-repo>
cd embed-proxy

2. Install dependencies
pip install -r requirements.txt

4. Start Redis
sudo systemctl start redis
sudo systemctl enable redis

6. Run the server
python app.py

The server will start on:

http://0.0.0.0:3000

---

Usage

Replace any social media URL with your domain:

https://yourdomain.com/https://www.instagram.com/p/ABC123

Works with:

Instagram
TikTok
X (Twitter)
Any website with OpenGraph metadata

---

##Deployment

For public use;

Use a hostingplatform
Put it behind Cloudflare
Enable HTTPS
Add basic rate limiting (already included in code)
Notes
Some platforms may limit or block metadata scraping
Embeds depend on OpenGraph tags being available
Performance improves significantly with Redis caching enabled

##Notes
Some platforms may limit or block metadata scraping
Embeds depend on OpenGraph tags being available
Performance improves significantly with Redis caching enabled
