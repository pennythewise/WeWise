"""Read-only smoke check for the built SPA and same-origin local backend."""
from html.parser import HTMLParser
import json
import sys

import httpx


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {"src", "href"} and value and value.startswith("/assets/"):
                self.urls.add(value)


base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8017"
with httpx.Client(base_url=base, timeout=8, follow_redirects=False) as client:
    page = client.get("/")
    assert page.status_code == 200 and '<div id="root">' in page.text
    assets = Assets()
    assets.feed(page.text)
    assert assets.urls, "Build the frontend before checking the combined application."
    asset_checks = {url: client.get(url).status_code for url in sorted(assets.urls)}
    assert all(status == 200 for status in asset_checks.values())
    health = client.get("/api/health").json()
    assert health["status"] == "ok"
    assert client.get("/api/policies").status_code == 401
    assert client.get("/api/emergency?country=Japan").status_code == 200
    assert client.get("/api/does-not-exist").status_code == 404
    print(json.dumps({"built_spa": "pass", "assets": asset_checks,
                      "private_guest_access": "blocked", "guest_urgent_help": "pass",
                      "model_configured": health["ai"]["configured"],
                      "tencent_verified": health["memory"].get("tencent_verified", False),
                      "insurer_connected": health["integrations"]["insurer"]}, indent=2))
