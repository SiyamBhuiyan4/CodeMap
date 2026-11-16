import os
import json
import httpx
from typing import AsyncGenerator

class OllamaProvider:
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = os.getenv("LLM_MODEL", "llama3")

    async def is_available(self) -> bool:
        """Checks if Ollama service is reachable."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def generate(self, prompt: str) -> str:
        """Generates a complete response from Ollama."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": self.model, "prompt": prompt, "stream": False}
                )
                response.raise_for_status()
                return response.json().get("response", "")
            except Exception as e:
                return f"AI Error: {str(e)}"

    async def stream_generate(self, prompt: str) -> AsyncGenerator[str, None]:
        """Streams tokens from Ollama as an async generator."""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json={"model": self.model, "prompt": prompt, "stream": True}
                ) as response:
                    if response.status_code != 200:
                        yield f"AI Error: HTTP {response.status_code}"
                        return
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                token = chunk.get("response", "")
                                if token:
                                    yield token
                                if chunk.get("done", False):
                                    break
                            except Exception:
                                continue
        except Exception as e:
            yield f"AI Error: {str(e)}"


class OpenAICompatibleProvider:
    """Chat-completions provider for any OpenAI-compatible API (Groq, OpenRouter, Together,
    OpenAI, a remote Ollama's /v1 endpoint, ...). Configured entirely through env vars:
    LLM_BASE_URL, LLM_API_KEY, LLM_MODEL."""

    def __init__(self):
        self.base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.model = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def _payload(self, prompt: str, stream: bool) -> dict:
        return {"model": self.model, "messages": [{"role": "user", "content": prompt}], "stream": stream}

    async def is_available(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/models", headers=self._headers())
                return res.status_code == 200
        except Exception:
            return False

    async def generate(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                res = await client.post(f"{self.base_url}/chat/completions",
                                        headers=self._headers(), json=self._payload(prompt, False))
                res.raise_for_status()
                return res.json()["choices"][0]["message"]["content"] or ""
            except Exception as e:
                return f"AI Error: {str(e)}"

    async def stream_generate(self, prompt: str) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", f"{self.base_url}/chat/completions",
                                         headers=self._headers(), json=self._payload(prompt, True)) as response:
                    if response.status_code != 200:
                        yield f"AI Error: HTTP {response.status_code}"
                        return
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            token = json.loads(data)["choices"][0]["delta"].get("content") or ""
                            if token:
                                yield token
                        except Exception:
                            continue
        except Exception as e:
            yield f"AI Error: {str(e)}"


def get_llm_provider():
    """LLM_PROVIDER=ollama (default, local docker) or openai (any OpenAI-compatible API)."""
    if os.getenv("LLM_PROVIDER", "ollama").lower() in ("openai", "groq", "openai-compatible"):
        return OpenAICompatibleProvider()
    return OllamaProvider()
