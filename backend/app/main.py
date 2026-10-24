
import asyncio
import os
import threading
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config
from .ai_service import load_model, generate_answer
from .search_service import search_web, needs_web
from .document_service import extract_text

conversations = {}
conversations_lock = threading.Lock()
request_buckets = defaultdict(deque)
rate_limit_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if config.LOAD_MODEL:
        threading.Thread(
            target=load_model,
            daemon=True,
            name="smartassist-model-loader",
        ).start()
    yield


app = FastAPI(
    title="SmartAssist AI",
    version="2.0.0",
    lifespan=lifespan,
)

frontend_url = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173",
).strip().rstrip("/")

origins = list({
    frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS", "DELETE"],
    allow_headers=["Content-Type"],
)


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: str | None = Field(default=None, max_length=100)


class ClearChatBody(BaseModel):
    conversation_id: str | None = Field(default=None, max_length=100)


def model_status():
    from .ai_service import _model, _load_error

    return {
        "status": "ok",
        "model": config.BASE_MODEL,
        "model_loaded": _model is not None,
        "model_error": (_load_error or "")[:300],
    }


@app.middleware("http")
async def basic_rate_limit(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        ip = request.client.host if request.client else "unknown"
        now = time.time()

        with rate_limit_lock:
            bucket = request_buckets[ip]

            while bucket and now - bucket[0] > 60:
                bucket.popleft()

            if len(bucket) >= 20:
                from fastapi.responses import JSONResponse

                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please wait a minute."
                    },
                )

            bucket.append(now)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/")
async def home():
    return {
        "service": "SmartAssist AI",
        "message": "AI chat backend is running.",
        "health": "/health",
    }


@app.get("/health")
async def health():
    return model_status()


@app.post("/api/upload")
async def upload_files(
    conversation_id: str,
    files: list[UploadFile] = File(...),
):
    if not conversation_id.strip() or len(conversation_id) > 100:
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation ID.",
        )

    with conversations_lock:
        conversations.setdefault(
            conversation_id,
            {"history": [], "documents": {}},
        )

    uploaded = []
    errors = []

    for file in files:
        filename = file.filename or "uploaded_file"

        try:
            allowed_extensions = {
                ".pdf", ".docx", ".txt", ".md", ".csv",
                ".json", ".py", ".xml", ".html", ".htm",
                ".log", ".yaml", ".yml",
            }

            extension = os.path.splitext(filename)[1].lower()

            if extension not in allowed_extensions:
                raise ValueError("This file type is not supported.")

            raw = await file.read(config.MAX_FILE_SIZE_BYTES + 1)

            if len(raw) > config.MAX_FILE_SIZE_BYTES:
                raise ValueError("File exceeds the configured 8 MB limit.")

            text = extract_text(filename, raw)

            if not text or not text.strip():
                raise ValueError("No readable text was found in this file.")

            with conversations_lock:
                conversations[conversation_id]["documents"][filename] = text

            uploaded.append({
                "filename": filename,
                "characters": len(text),
            })

        except Exception as exc:
            errors.append(f"{filename}: {exc}")

        finally:
            await file.close()

    with conversations_lock:
        document_names = list(
            conversations[conversation_id]["documents"].keys()
        )

    return {
        "uploaded": uploaded,
        "errors": errors,
        "documents": document_names,
    }


@app.get("/api/documents")
async def list_documents(conversation_id: str):
    with conversations_lock:
        state = conversations.get(
            conversation_id,
            {"documents": {}},
        )

        return {
            "documents": [
                {
                    "filename": name,
                    "characters": len(text),
                }
                for name, text in state["documents"].items()
            ]
        }


@app.delete("/api/documents")
async def clear_documents(conversation_id: str):
    with conversations_lock:
        if conversation_id in conversations:
            conversations[conversation_id]["documents"] = {}

    return {"message": "Uploaded documents removed."}


@app.post("/api/chat")
async def chat(data: ChatBody):
    question = data.message.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a question.",
        )

    status = model_status()

    if not status["model_loaded"]:
        detail = "The AI model is not ready yet."

        if status["model_error"]:
            detail += " " + status["model_error"]
        else:
            detail += " Check backend logs and model configuration."

        raise HTTPException(status_code=503, detail=detail)

    conversation_id = data.conversation_id or str(uuid.uuid4())

    with conversations_lock:
        if conversation_id not in conversations:
            conversations[conversation_id] = {
                "history": [],
                "documents": {},
            }

        current_state = conversations[conversation_id]

        generation_state = {
            "history": list(current_state["history"]),
            "documents": dict(current_state["documents"]),
        }

    try:
        web_context = (
            await asyncio.to_thread(search_web, question)
            if needs_web(question)
            else ""
        )

        answer = await asyncio.to_thread(
            generate_answer,
            question,
            generation_state,
            web_context,
        )

    except Exception as exc:
        print(
            f"[SmartAssist] Chat generation failed: "
            f"{type(exc).__name__}: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail="AI generation failed. Check backend logs.",
        ) from exc

    with conversations_lock:
        conversations[conversation_id]["history"] = (
            generation_state["history"][-20:]
        )

    return {
        "answer": answer,
        "conversation_id": conversation_id,
        "web_search_used": bool(web_context),
    }


@app.post("/api/clear-chat")
async def clear_chat(data: ClearChatBody):
    if data.conversation_id:
        with conversations_lock:
            conversations.pop(data.conversation_id, None)

    return {"message": "Chat history cleared."}
