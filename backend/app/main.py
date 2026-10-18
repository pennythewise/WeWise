"""Same-origin FastAPI service and production SPA hosting."""
from __future__ import annotations

from contextlib import asynccontextmanager
import importlib
import importlib.util
import os
from pathlib import Path
import sqlite3
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import core, documents, intelligence
from .semantic_retrieval import embedding_health
from .jev_adapter import jev_health
from .provider_limits import limits_health


def optional_module(name):
    full = f"{__package__}.{name}"
    return importlib.import_module(full) if importlib.util.find_spec(full) else None


def create_app():
    workflows = optional_module("workflows")
    memory = optional_module("memory")
    feature_modules = [module for name in ("document_analysis", "lifecycle", "agent_foundation") if (module := optional_module(name))]

    @asynccontextmanager
    async def lifespan(app):
        core.init_db()
        if workflows:
            workflows.init_workflow_db()
        if memory:
            memory.init_memory_db()
        for module in feature_modules:
            module.init_db()
        documents.seed_demo_documents()
        yield

    app = FastAPI(title="WeWise · 微晓", version="0.3.1", lifespan=lifespan,
                  description="Private local hackathon assistant. Synthetic customer data only. No insurer transactions.")

    @app.middleware("http")
    async def boundaries(request: Request, call_next):
        if request.url.path.startswith("/api"):
            try:
                if int(request.headers.get("content-length", "0")) > 16 * 1024 * 1024:
                    return JSONResponse({"detail": "Request exceeds the 16 MB transport limit."}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "Invalid content length."}, status_code=400)
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                origin = request.headers.get("origin")
                expected = f"{request.url.scheme}://{request.headers.get('host', '')}"
                configured = {o.strip() for o in os.getenv("WEWISE_ALLOWED_ORIGINS", "").split(",") if o.strip()}
                local_dev = {f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 5174, 5180, 8000, 8001)}
                allowed = {expected, *configured}
                if os.getenv("WEWISE_ENV", "development") != "production":
                    allowed |= local_dev
                if (origin and origin not in allowed) or request.headers.get("sec-fetch-site") == "cross-site":
                    return JSONResponse({"detail": "Cross-origin writes are blocked."}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(core.router)
    app.include_router(documents.router)
    app.include_router(intelligence.router)
    if workflows:
        app.include_router(workflows.router)
    if memory:
        app.include_router(memory.router)
    for module in feature_modules:
        app.include_router(module.router)

    @app.get("/api/health")
    def health():
        config = intelligence.ai_config()
        semantic = embedding_health()
        return {"status": "ok", "version": "0.3.1", "ai": config,
                "ocr": {"engine": "PyMuPDF text + RapidOCR CPU", "scan_page_quota": 12, "manual_fallback": True},
                "retrieval": {"engine": "Local multilingual E5 + SQLite BM25/RRF" if semantic["configured"] else "SQLite FTS5/BM25 + multilingual lexical", "vector_embeddings": semantic["configured"], "semantic": semantic},
                "jev": jev_health(),
                "paid_request_limits": limits_health(),
                "memory": memory.memory_health() if memory and hasattr(memory, "memory_health") else {"engine": "not_initialized"},
                "synthetic_data_only": True,
                "simulation_boundary": ["insurer receipts", "insurer processing timelines", "agent callback requests"],
                "integrations": {"insurer": False, "bank_sso": False, "phone_transfer": False}}

    @app.get("/api/capabilities")
    def capabilities():
        config = intelligence.ai_config()
        return {"real": ["private authenticated accounts", "document upload and per-page extraction", "CPU OCR with explicit fallback", "critical-fact and source-term review", "owner-scoped cited retrieval", "profile and clause coverage observations", "private portfolio and document vault", "24-hour temporary upload lifecycle", "claim-package export", "approved memory reuse and deletion", "user-sourced claim progress and notifications", "isolated insurer state-machine simulator", "deterministic advocate comparison and cost arithmetic", "renewal and premium history", "persisted conversations and validated tool plans", "streamed execution inspector", "guided multi-photo evidence capture", "in-app rule-based calming conversation", "medical and financial factual report review"],
                "conditional": {"live_model": config["configured"], "model_verified": config.get("live_verified", False), "local_embeddings": embedding_health()["configured"], "jev": jev_health()["configured"], "jev_verified": jev_health()["verified_live"], "voice": "Browser/device support and user permission required."},
                "simulated": ["insurer receipt", "insurer processing timeline", "licensed-agent callback request"],
                "not_connected": ["insurer submission API", "insurer status feed", "WeBank SSO", "live telephone transfer"] + ([] if jev_health()["configured"] else ["JEV cloud"]),
                "notice": "This capability report describes implementation, not independently verified deployment or production suitability."}

    dist = core.ROOT / "dist"
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/") or path == "api":
            raise HTTPException(404, "API route not found.")
        candidate = (dist / path).resolve()
        if candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        if (dist / "index.html").is_file():
            return FileResponse(dist / "index.html")
        return JSONResponse({"service": "WeWise backend", "frontend": "Run the Vite dev server, or build the frontend before production hosting.", "docs": "/docs"})

    return app


app = create_app()
