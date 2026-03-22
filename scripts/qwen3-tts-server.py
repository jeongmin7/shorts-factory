import argparse
import io
import gc
import soundfile as sf
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

MODEL_NAME = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-4bit"

# Global model reference (loaded on startup, can be unloaded)
generator = None


def get_generator():
    global generator
    if generator is None:
        from mlx_audio.tts import load
        generator = load(MODEL_NAME)
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
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "text must be a non-empty string"}), 400
    if len(text) > 2000:
        return jsonify({"error": "text exceeds 2000 characters"}), 400

    language = data.get("language", "ko")
    valid_languages = {"ko", "en"}
    if language not in valid_languages:
        return jsonify({"error": f"language must be one of {valid_languages}"}), 400

    try:
        model = get_generator()

        # model.generate() returns a Generator of GenerationResult
        # Collect all segments and concatenate audio
        import mlx.core as mx
        audio_segments = []
        sample_rate = 24000

        for result in model.generate(text=text, instruct="차분한 30대 여성", speed=1.4, lang_code=language):
            audio_segments.append(result.audio)
            sample_rate = result.sample_rate

        if not audio_segments:
            return jsonify({"error": "No audio generated"}), 500

        # Concatenate all segments
        full_audio = mx.concatenate(audio_segments, axis=0)
        audio_list = full_audio.tolist()

        # Write to in-memory WAV buffer
        buf = io.BytesIO()
        sf.write(buf, audio_list, sample_rate, format="WAV")
        buf.seek(0)

        return send_file(buf, mimetype="audio/wav", download_name="output.wav")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/synthesize_scenes", methods=["POST"])
def synthesize_scenes():
    """Generate TTS for multiple scenes in one call (consistent voice).
    Body: {"scenes": ["text1", "text2", ...], "language": "ko"}
    Returns: {"segments": [{"audio": base64, "duration": float}, ...]}
    """
    data = request.get_json()
    if not data or "scenes" not in data:
        return jsonify({"error": "scenes array is required"}), 400

    scene_texts = data["scenes"]
    if not isinstance(scene_texts, list) or len(scene_texts) == 0:
        return jsonify({"error": "scenes must be a non-empty array"}), 400

    language = data.get("language", "ko")
    valid_languages = {"ko", "en"}
    if language not in valid_languages:
        return jsonify({"error": f"language must be one of {valid_languages}"}), 400

    try:
        model = get_generator()
        import mlx.core as mx
        import base64

        # Join scenes with \n so model splits them internally (consistent voice)
        combined_text = "\n".join(scene_texts)

        segments = []
        sample_rate = 24000

        for result in model.generate(text=combined_text, instruct="차분한 30대 여성", speed=1.4, lang_code=language):
            sample_rate = result.sample_rate
            buf = io.BytesIO()
            sf.write(buf, result.audio.tolist(), sample_rate, format="WAV")
            audio_b64 = base64.b64encode(buf.getvalue()).decode()
            segments.append({
                "audio": audio_b64,
                "duration": result.samples / sample_rate,
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
