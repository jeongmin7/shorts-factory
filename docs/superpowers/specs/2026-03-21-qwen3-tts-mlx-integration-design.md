# Qwen3-TTS MLX Integration Design

## Summary

Integrate Qwen3-TTS via Apple MLX framework into the youtube-shorts-automation pipeline to provide free, local Korean and English TTS. Japanese TTS remains on VOICEVOX.

## Motivation

- Korean TTS is disabled (ElevenLabs credits exhausted)
- English TTS is also unavailable for the same reason
- Qwen3-TTS on MLX runs 100% offline on M1 Mac with ~2-3GB RAM
- Eliminates cloud API costs and dependency

## Architecture

```
[Next.js Pipeline - index.ts]
    ├── 'ja' → generateTTSVoicevox()   (localhost:50021) — unchanged
    ├── 'ko' → generateTTSQwen3()      (localhost:5050)  — new (always)
    └── 'en' → generateTTSQwen3()      (localhost:5050)  — new (selective)
```

The Qwen3-TTS server follows the same local HTTP API pattern as VOICEVOX: a long-running Python process that loads the MLX model once at startup and serves synthesis requests via REST.

## Memory Budget (8GB M1 Mac)

| Process | Estimated RAM |
|---------|---------------|
| macOS system | ~2.5GB |
| Next.js + Prisma | ~0.5-1GB |
| VOICEVOX | ~1GB |
| Qwen3-TTS (MLX) | ~2-3GB |
| **Total** | **~6-7.5GB** |

This is tight on 8GB. Mitigation: the Python server accepts a `POST /unload` endpoint to free the model from memory after TTS stage completes. The pipeline calls `/unload` after all TTS work is done, freeing RAM for the video rendering stage.

## Components

### 1. Python TTS Server (`scripts/qwen3-tts-server.py`)

- **Framework:** Flask (lightweight, sufficient for local use)
- **Port:** 5050 (configurable via `--port` flag)
- **Model:** Qwen3-TTS via `mlx-audio` library
- **Startup:** Loads model into memory once (~2-3GB, takes a few seconds)
- **Error responses:** Structured JSON `{ "error": "message" }` with appropriate HTTP status codes

**Endpoints:**

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/synthesize` | `{ "text": "...", "language": "ko" }` | WAV audio (`Content-Type: audio/wav`) |
| GET | `/health` | — | `{ "status": "ok" }` |
| POST | `/unload` | — | `{ "status": "unloaded" }` (frees model from memory) |

**Voice selection:** Uses Qwen3-TTS built-in preset voices. Language parameter selects an appropriate default voice. Voice cloning endpoints can be added later without changing the existing interface.

### 2. Python Dependencies (`scripts/requirements.txt`)

```
mlx-audio
flask
```

### 3. Node.js TTS Module (`src/lib/pipeline/tts-qwen3.ts`)

Mirrors the structure of `tts-voicevox.ts`:

```typescript
export async function generateTTSQwen3(
  text: string,
  language: string,
  videoId: string,
): Promise<string>
```

- Sends POST to `QWEN3_TTS_URL/synthesize` with text and language
- Request timeout: 120 seconds (`AbortSignal.timeout(120_000)`) — MLX inference on M1 can be slow for long texts
- Saves response as `uploads/{videoId}/tts/{language}.wav`
- Returns the file path

Additional utility:

```typescript
export async function unloadQwen3Model(): Promise<void>
// Calls POST /unload to free memory after TTS stage
```

### 4. Pipeline Routing (`src/lib/pipeline/index.ts`)

Change the languages array to be configurable and add Qwen3 routing:

```typescript
// Languages: 'ja' always, 'ko' always, 'en' only if requested
const languages = ['ja', 'ko', ...(includeEnglish ? ['en'] : [])] as const

// In TTS stage:
for (const lang of languages) {
  if (lang === 'ja') {
    ttsPath = await withRetry(() =>
      generateTTSVoicevox(scenes.map((s) => s.text_ja).join(' '), videoId),
    )
  } else {
    ttsPath = await withRetry(() =>
      generateTTSQwen3(scenes.map((s) => s[`text_${lang}`]).join(' '), lang, videoId),
    )
  }
}

// After all TTS is done, free model memory:
await unloadQwen3Model().catch(() => {}) // non-blocking
```

English is selective: controlled via a parameter passed to the pipeline (e.g., from the create form or API request body).

### 5. Environment Configuration

Add to `.env.example`:
```
QWEN3_TTS_URL=http://localhost:5050
```

## File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `scripts/qwen3-tts-server.py` | Python Flask server with mlx-audio |
| Create | `scripts/requirements.txt` | Python dependencies |
| Create | `src/lib/pipeline/tts-qwen3.ts` | Node.js client for Qwen3-TTS server |
| Modify | `src/lib/pipeline/index.ts` | Add ko/en routing to Qwen3-TTS, add unload call |
| Modify | `.env.example` | Add QWEN3_TTS_URL |

## Error Handling

- **Health check before TTS stage:** Pipeline calls `GET /health` on Qwen3-TTS server before entering TTS loop. If unreachable, skip ko/en variants and log warning (don't block ja pipeline).
- **Per-request timeout:** 120 seconds per synthesis request.
- **Retry:** Exponential backoff via existing `retry.ts`.
- **Structured errors:** Python server returns `{ "error": "..." }` with HTTP status codes. Node.js client logs descriptive messages (e.g., `Qwen3-TTS synthesis error for ko: 500 - model not loaded`).

## Usage

```bash
# 1. Setup Python environment (one-time)
cd scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Start Qwen3-TTS server (keep running)
python qwen3-tts-server.py

# 3. Start VOICEVOX (for Japanese, existing process)

# 4. Run Next.js pipeline as usual
npm run dev
```

## Future Extensions

- Voice cloning: Add `POST /synthesize-clone` endpoint with reference audio
- Voice design: Add `POST /synthesize-design` endpoint with voice description
- Speaker selection: Add `speaker_id` parameter to `/synthesize`
- Graceful model reload: `POST /load` to re-load model after `/unload`

## Constraints

- macOS with Apple Silicon (M1/M2/M3/M4) required for MLX
- macOS Sonoma (v14) or newer
- Python 3.10+ required for mlx-audio
- ~2-3GB RAM for model weights (mitigated by `/unload` after use)
