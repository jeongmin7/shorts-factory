# Qwen3-TTS MLX Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local Korean/English TTS via Qwen3-TTS (MLX) to the video generation pipeline, replacing the disabled ElevenLabs integration.

**Architecture:** A Python Flask server wraps mlx-audio's Qwen3-TTS model on localhost:5050, mirroring the existing VOICEVOX pattern. A new Node.js client module calls this server. The pipeline routes ja→VOICEVOX, ko/en→Qwen3-TTS.

**Tech Stack:** Python 3.10+, Flask, mlx-audio, Node.js fetch API

**Spec:** `docs/superpowers/specs/2026-03-21-qwen3-tts-mlx-integration-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `scripts/qwen3-tts-server.py` | Python Flask server — loads Qwen3-TTS model, serves `/synthesize`, `/health`, `/unload` |
| Create | `scripts/requirements.txt` | Python dependencies (mlx-audio, flask) |
| Create | `src/lib/pipeline/tts-qwen3.ts` | Node.js client — HTTP calls to Python server, saves WAV files |
| Modify | `src/lib/pipeline/index.ts` | Pipeline routing — add ko to languages, route ko/en to Qwen3-TTS |
| Modify | `.env.example` | Add `QWEN3_TTS_URL` |
| Modify | `src/app/api/generate/route.ts` | Accept optional `languages` param for selective English |

---

### Task 1: Python TTS Server

**Files:**
- Create: `scripts/qwen3-tts-server.py`
- Create: `scripts/requirements.txt`

- [ ] **Step 1: Create `scripts/requirements.txt`**

```
mlx-audio
flask
soundfile
```

- [ ] **Step 2: Create `scripts/qwen3-tts-server.py`**

```python
import argparse
import io
import gc
import soundfile as sf
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

# Global model reference (loaded on startup, can be unloaded)
generator = None


def get_generator():
    global generator
    if generator is None:
        from mlx_audio.tts import TTS
        generator = TTS("mlx-community/Qwen3-TTS-0.6B-4bit")
    return generator


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": generator is not None})


@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "text is required"}), 400

    text = data["text"]
    language = data.get("language", "ko")

    # Select voice based on language
    voice_map = {
        "ko": "Chelsie",
        "en": "Chelsie",
    }
    voice = voice_map.get(language, "Chelsie")

    try:
        tts = get_generator()
        audio = tts.generate(text=text, speaker=voice)

        # Write to in-memory WAV buffer
        buf = io.BytesIO()
        sf.write(buf, audio["audio"], audio["sample_rate"], format="WAV")
        buf.seek(0)

        return send_file(buf, mimetype="audio/wav", download_name="output.wav")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/unload", methods=["POST"])
def unload():
    global generator
    generator = None
    gc.collect()
    return jsonify({"status": "unloaded"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5050)
    parser.add_argument("--lazy", action="store_true", help="Don't load model on startup")
    args = parser.parse_args()

    if not args.lazy:
        print("Loading Qwen3-TTS model...")
        get_generator()
        print("Model loaded.")

    app.run(host="127.0.0.1", port=args.port)
```

Note: The model name `mlx-community/Qwen3-TTS-0.6B-4bit` and API (`TTS`, `tts.generate()`) must be verified against the actual mlx-audio docs at runtime. The `--lazy` flag allows starting the server without immediately loading the model (useful for memory-constrained setups).

- [ ] **Step 3: Setup venv and verify server starts**

```bash
cd /Users/jeongmin/youtube-shorts-automation/scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python qwen3-tts-server.py --lazy
# Expected: server starts on port 5050
# Test: curl http://localhost:5050/health
# Expected: {"model_loaded": false, "status": "ok"}
```

- [ ] **Step 4: Test synthesis with model loaded**

```bash
# Restart without --lazy (loads model)
python qwen3-tts-server.py
# Wait for "Model loaded." message

# Test Korean TTS
curl -X POST http://localhost:5050/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "안녕하세요 테스트입니다", "language": "ko"}' \
  --output test_ko.wav

# Test English TTS
curl -X POST http://localhost:5050/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello this is a test", "language": "en"}' \
  --output test_en.wav

# Verify files are valid WAV
file test_ko.wav test_en.wav
# Expected: RIFF (little-endian) data, WAVE audio

# Test unload
curl -X POST http://localhost:5050/unload
# Expected: {"status": "unloaded"}
```

- [ ] **Step 5: Add `scripts/.venv/` to `.gitignore`**

Append to `.gitignore`:
```
scripts/.venv/
scripts/test_*.wav
```

- [ ] **Step 6: Commit**

```bash
git add scripts/qwen3-tts-server.py scripts/requirements.txt .gitignore
git commit -m "feat: add Qwen3-TTS MLX Python server for local Korean/English TTS"
```

---

### Task 2: Node.js TTS Client Module

**Files:**
- Create: `src/lib/pipeline/tts-qwen3.ts`

- [ ] **Step 1: Create `src/lib/pipeline/tts-qwen3.ts`**

```typescript
import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const QWEN3_TTS_URL = process.env.QWEN3_TTS_URL || 'http://localhost:5050'

export async function isQwen3Available(): Promise<boolean> {
  try {
    const res = await fetch(`${QWEN3_TTS_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function generateTTSQwen3(
  text: string,
  language: string,
  videoId: string,
): Promise<string> {
  const response = await fetch(`${QWEN3_TTS_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Qwen3-TTS synthesis error for ${language}: ${response.status} - ${error.error}`)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())

  const dir = path.join(UPLOAD_DIR, videoId, 'tts')
  await fs.mkdir(dir, { recursive: true })

  const filePath = path.join(dir, `${language}.wav`)
  await fs.writeFile(filePath, audioBuffer)

  return filePath
}

export async function unloadQwen3Model(): Promise<void> {
  await fetch(`${QWEN3_TTS_URL}/unload`, {
    method: 'POST',
    signal: AbortSignal.timeout(5_000),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/pipeline/tts-qwen3.ts
git commit -m "feat: add Qwen3-TTS Node.js client module"
```

---

### Task 3: Pipeline Routing Update

**Files:**
- Modify: `src/lib/pipeline/index.ts`

- [ ] **Step 1: Add imports**

At the top of `index.ts`:
- Add Qwen3 import:
```typescript
import { generateTTSQwen3, isQwen3Available, unloadQwen3Model } from './tts-qwen3'
```
- Remove unused ElevenLabs import (line 5):
```typescript
// DELETE: import { generateTTS } from './tts-elevenlabs'
```

- [ ] **Step 2: Update languages array and pipeline signature**

Replace line 23-24:
```typescript
// TODO: 'ko' 추가 (ElevenLabs 크레딧 충전 후)
const languages = ['ja'] as const
```

With:
```typescript
type Language = 'ja' | 'ko' | 'en'
const BASE_LANGUAGES: Language[] = ['ja', 'ko']
```

Update `runPipeline` signature (line 28) to accept languages:
```typescript
export async function runPipeline(
  videoId: string,
  imageModel: ImageModel = 'fal',
  extraLanguages: Language[] = [],
): Promise<void> {
```

Add at the start of the try block (after line 29):
```typescript
    const languages: Language[] = [...BASE_LANGUAGES, ...extraLanguages]
```

- [ ] **Step 3: Update TTS stage routing**

Replace the TTS stage (lines 119-144) with:
```typescript
    // Stage 3: TTS
    if (shouldRun('tts', lastFailedStage)) {
      await updateStage(videoId, 'tts')
      const existingVariants = await prisma.variant.findMany({ where: { videoId } })

      // Check Qwen3-TTS availability for ko/en
      const qwen3Available = await isQwen3Available()
      if (!qwen3Available) {
        console.warn('[TTS] Qwen3-TTS server not available, skipping ko/en TTS')
      }

      for (const lang of languages) {
        const variant = existingVariants.find((v) => v.language === lang)
        if (variant?.ttsUrl) continue // 이미 생성된 TTS 스킵

        let ttsPath: string
        if (lang === 'ja') {
          ttsPath = await withRetry(() =>
            generateTTSVoicevox(scenes.map((s) => s.text_ja).join(' '), videoId),
          )
        } else if (qwen3Available) {
          ttsPath = await withRetry(() =>
            generateTTSQwen3(scenes.map((s) => s[`text_${lang}`]).join(' '), lang, videoId),
          )
        } else {
          continue // Skip this language if Qwen3 unavailable
        }

        await prisma.variant.update({
          where: { videoId_language: { videoId, language: lang } },
          data: { ttsUrl: ttsPath },
        })
      }

      // Free Qwen3 model memory after TTS stage
      if (qwen3Available) {
        await unloadQwen3Model().catch((e) => console.warn('[TTS] Failed to unload Qwen3 model:', e))
      }
    }
```

- [ ] **Step 4: Update variant creation in scene_split stage**

The variant upsert loop (lines 71-78) already uses `languages`. Since `languages` is now a local variable that includes `ko`, variants will be created for Korean too. Verify `text_ko` is populated — it is, since `SceneData.text_ko` comes from the original script (line 92-93 in resume path).

No code change needed here, just verify the existing loop works with the new languages array.

- [ ] **Step 5: Add null guards in SRT and Render stages**

The SRT stage (line ~155) and Render stage (line ~187) access `variant!.ttsUrl!` which will crash if TTS was skipped (Qwen3 offline). Add guards:

In SRT stage (around line 153), change:
```typescript
        if (variant?.srtUrl) continue // 이미 생성된 SRT 스킵
```
to:
```typescript
        if (variant?.srtUrl) continue // 이미 생성된 SRT 스킵
        if (!variant?.ttsUrl) continue // TTS 없으면 SRT 스킵
```

In Render stage (around line 180), change:
```typescript
        if (variant?.videoUrl) continue // 이미 렌더된 영상 스킵
```
to:
```typescript
        if (variant?.videoUrl) continue // 이미 렌더된 영상 스킵
        if (!variant?.ttsUrl) continue // TTS 없으면 렌더 스킵
```

- [ ] **Step 6: Update resume path to include ko text**

The resume path (lines 92-97) currently sets `text_en: ''`. Update to populate `text_en` from variants:
```typescript
      scenes = dbScenes.map((s, i) => ({
        text_ko: s.text,
        text_en: variants.find((v) => v.language === 'en')?.translatedScript.split('\n')[i] || '',
        text_ja: variants.find((v) => v.language === 'ja')?.translatedScript.split('\n')[i] || '',
        imagePrompt: s.imagePrompt.replace(/\[STYLE\].*?\[\/STYLE\]/, ''),
      }))
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/pipeline/index.ts
git commit -m "feat: route ko/en TTS to Qwen3-TTS, ja to VOICEVOX"
```

---

### Task 4: API and Environment Config

**Files:**
- Modify: `.env.example`
- Modify: `src/app/api/generate/route.ts`

- [ ] **Step 1: Update `.env.example`**

Add after the VOICEVOX section:
```
# Qwen3-TTS (MLX)
QWEN3_TTS_URL=http://localhost:5050
```

- [ ] **Step 2: Update generate API route to accept languages**

In `src/app/api/generate/route.ts`, update to accept optional `includeEnglish`:

```typescript
const { title, script, imageModel = 'fal', includeEnglish = false } = await request.json()
```

Update the pipeline call:
```typescript
const extraLanguages = includeEnglish ? ['en' as const] : []
runPipeline(video.id, imageModel as ImageModel, extraLanguages)
```

- [ ] **Step 3: Commit**

```bash
git add .env.example src/app/api/generate/route.ts
git commit -m "feat: add QWEN3_TTS_URL env var and optional English language support"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Start all servers**

Terminal 1 (Qwen3-TTS):
```bash
cd /Users/jeongmin/youtube-shorts-automation/scripts
source .venv/bin/activate
python qwen3-tts-server.py
```

Terminal 2 (VOICEVOX): start as usual

Terminal 3 (Next.js):
```bash
cd /Users/jeongmin/youtube-shorts-automation
npm run dev
```

- [ ] **Step 2: Test via the web UI**

1. Go to http://localhost:3000/create
2. Enter a test script (100+ chars Korean text)
3. Submit and watch pipeline progress
4. Verify `uploads/{videoId}/tts/` contains both `ja.wav` and `ko.wav`
5. Play both WAV files to confirm audio quality

- [ ] **Step 3: Test English (selective)**

Send a direct API request with `includeEnglish: true`:
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"title": "Test", "script": "<100+ char Korean script>", "includeEnglish": true}'
```

Verify `uploads/{videoId}/tts/en.wav` is created.

- [ ] **Step 4: Test graceful degradation (Qwen3 offline)**

1. Stop the Python TTS server
2. Run a new pipeline
3. Verify: Japanese TTS succeeds, Korean/English are skipped with warning log
4. Pipeline completes without error (only ja variant has video)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing"
```
