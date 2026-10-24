# SmartAssist AI — No-Login Chat + Vercel Frontend

This version removes email OTP, session-token authentication, and Cloudflare Quick Tunnel. The React frontend is designed for Vercel; the FastAPI/Qwen backend must run on a separate Python hosting service with enough RAM/VRAM for your model and LoRA adapter.

## Project layout
- `frontend/`: React + Vite interface, configured for Vercel.
- `backend/app/`: FastAPI API, Qwen model inference, and optional web search.
- `models/lora_adapter/`: place your trained adapter files here; model files are not included in this ZIP.

## Important model requirement
The ZIP does not contain your trained LoRA adapter or downloaded Hugging Face model weights. Set `ADAPTER_PATH` to the actual adapter folder on the backend host. `ai_service.py` currently expects an adapter containing `adapter_config.json`; without it, model loading fails. A regular CPU web host may not have enough memory or speed for Qwen3-1.7B. Choose a host that meets your model's runtime requirements.

## Deploy frontend to Vercel
1. Push this project to a Git repository.
2. Import the repository in Vercel. Set **Root Directory** to `SmartAssistAI/frontend` (or `frontend` if the repository root is the contents of this folder).
3. Set the environment variable `VITE_API_BASE_URL` to the public HTTPS URL of the deployed FastAPI backend, without a trailing slash.
4. Deploy. `vercel.json` is included for SPA routing.

## Deploy backend separately
1. Deploy the `backend` directory to a Python service that supports FastAPI and the needed compute.
2. Install `backend/requirements.txt`.
3. Configure `BASE_MODEL`, `ADAPTER_PATH`, `SMARTASSIST_LOAD_MODEL=1`, and `FRONTEND_URL` in the hosting provider. `FRONTEND_URL` must be your exact Vercel site origin, such as `https://your-app.vercel.app`.
4. Make sure the adapter folder is uploaded or mounted at the configured path.
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` from the backend directory. If the host requires a fixed port, follow its deployment instructions.
6. Test `https://YOUR-BACKEND/health`; `model_loaded` should become `true` before chatting.

## Local development
Backend terminal (from `backend/`):
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Frontend terminal (from `frontend/`):
```bash
npm install
npm run dev
```
Vite proxies `/api` and `/health` to `http://127.0.0.1:8000` locally. Leave `VITE_API_BASE_URL` blank for local development.

## Features and limitations
- No email OTP or login screen.
- Chat conversations are stored in backend memory and reset if the backend restarts.
- This public no-login API can be used by anyone who can reach the site. Basic per-IP rate limiting is included, but it is not a full production abuse-prevention system. Add provider limits/monitoring before sharing widely.
- Document upload controls were removed from this no-login interface. Existing document service code remains in the project but is not exposed by this API.
- Optional web search uses the existing `search_service.py`.
- The trained LoRA adapter and model weights are not included.
