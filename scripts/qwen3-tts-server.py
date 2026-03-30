import argparse
import io
import gc
import subprocess
import tempfile
import soundfile as sf
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

MODEL_NAME = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-4bit"

# Global model reference (loaded on startup, can be unloaded)
generator = None


def get_generator():
    global generator
    if generator is None:
        from mlx_audio.tts import load
        generator = load(MODEL_NAME)
    return generator


def apply_speed(audio_bytes: bytes, speed: float) -> bytes:
    """Apply speed change using ffmpeg atempo filter."""
    if speed == 1.0:
        return audio_bytes

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as inp, \
         tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out:
        inp.write(audio_bytes)
        inp.flush()

        # atempo range is 0.5-2.0, chain for values outside
        filters = []
        remaining = speed
        while remaining > 2.0:
            filters.append("atempo=2.0")
            remaining /= 2.0
        while remaining < 0.5:
            filters.append("atempo=0.5")
            remaining *= 2.0
        filters.append(f"atempo={remaining:.4f}")

        subprocess.run(
            ["ffmpeg", "-y", "-i", inp.name, "-af", ",".join(filters), out.name],
            capture_output=True,
        )

        with open(out.name, "rb") as f:
            return f.read()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": generator is not None})


@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "text is required"}), 400

    text = data["text"]
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "text must be a non-empty string"}), 400
    if len(text) > 2000:
        return jsonify({"error": "text exceeds 2000 characters"}), 400

    language = data.get("language", "ko")
    speed = data.get("speed", 1.0)
    voice = data.get("voice", "eric")
    instruct = data.get("instruct", "")
    valid_languages = {"ko", "en", "ja"}
    if language not in valid_languages:
        return jsonify({"error": f"language must be one of {valid_languages}"}), 400

    try:
        model = get_generator()

        import mlx.core as mx
        audio_segments = []
        sample_rate = 24000

        gen_kwargs = {"text": text, "lang_code": language, "voice": voice}
        if instruct:
            gen_kwargs["instruct"] = instruct

        for result in model.generate(**gen_kwargs):
            audio_segments.append(result.audio)
            sample_rate = result.sample_rate

        if not audio_segments:
            return jsonify({"error": "No audio generated"}), 500

        full_audio = mx.concatenate(audio_segments, axis=0)

        buf = io.BytesIO()
        sf.write(buf, full_audio.tolist(), sample_rate, format="WAV")

        # Apply speed via ffmpeg
        output_bytes = apply_speed(buf.getvalue(), speed)

        return send_file(
            io.BytesIO(output_bytes),
            mimetype="audio/wav",
            download_name="output.wav",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/synthesize_scenes", methods=["POST"])
def synthesize_scenes():
    """Generate TTS for multiple scenes in one call (consistent voice).
    Body: {"scenes": ["text1", "text2", ...], "language": "ko", "speed": 1.4}
    Returns: {"segments": [{"audio": base64, "duration": float}, ...]}
    """
    data = request.get_json()
    if not data or "scenes" not in data:
        return jsonify({"error": "scenes array is required"}), 400

    scene_texts = data["scenes"]
    if not isinstance(scene_texts, list) or len(scene_texts) == 0:
        return jsonify({"error": "scenes must be a non-empty array"}), 400

    language = data.get("language", "ko")
    speed = data.get("speed", 1.0)
    voice = data.get("voice", "eric")
    instruct = data.get("instruct", "")
    valid_languages = {"ko", "en", "ja"}
    if language not in valid_languages:
        return jsonify({"error": f"language must be one of {valid_languages}"}), 400

    try:
        model = get_generator()
        import mlx.core as mx
        import base64

        segments = []
        sample_rate = 24000

        # Generate each scene independently — guarantees 1 segment per scene
        for text in scene_texts:
            text = text.strip()
            if not text:
                segments.append({"audio": "", "duration": 0.0})
                continue

            gen_kwargs = {"text": text, "lang_code": language, "voice": voice}
            if instruct:
                gen_kwargs["instruct"] = instruct

            audio_parts = []
            for result in model.generate(**gen_kwargs):
                audio_parts.append(result.audio)
                sample_rate = result.sample_rate

            if not audio_parts:
                segments.append({"audio": "", "duration": 0.0})
                continue

            audio = mx.concatenate(audio_parts, axis=0)
            buf = io.BytesIO()
            sf.write(buf, audio.tolist(), sample_rate, format="WAV")

            audio_bytes = apply_speed(buf.getvalue(), speed)
            audio_b64 = base64.b64encode(audio_bytes).decode()

            speed_buf = io.BytesIO(audio_bytes)
            info = sf.info(speed_buf)

            segments.append({
                "audio": audio_b64,
                "duration": info.duration,
            })

        return jsonify({"segments": segments, "sample_rate": sample_rate})
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
