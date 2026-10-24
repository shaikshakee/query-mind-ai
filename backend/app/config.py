import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = Path(os.getenv("SMARTASSIST_ENV_FILE", BACKEND_DIR / ".env"))
load_dotenv(ENV_FILE, override=False)

def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default

PORT = env_int("PORT", 8000)
APP_BASE_URL = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
BASE_MODEL = os.getenv("BASE_MODEL", "Qwen/Qwen3-1.7B")
ADAPTER_PATH = os.getenv("ADAPTER_PATH", str(BACKEND_DIR.parent / "models" / "lora_adapter"))
LOAD_MODEL = os.getenv("SMARTASSIST_LOAD_MODEL", "1").lower() not in {"0", "false", "no"}
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "").strip()
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "SmartAssist AI").strip()
OTP_EXPIRY_SECONDS = env_int("OTP_EXPIRY_SECONDS", 600)
SESSION_EXPIRY_SECONDS = env_int("SESSION_EXPIRY_SECONDS", 43200)
MAX_FILE_SIZE_BYTES = env_int("MAX_FILE_SIZE_MB", 8) * 1024 * 1024
MAX_NEW_TOKENS = env_int("MAX_NEW_TOKENS", 500)
