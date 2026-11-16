# Vercel Python entrypoint: exposes the FastAPI app from apps/api/main.py.
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from apps.api.main import app  # noqa: E402,F401
