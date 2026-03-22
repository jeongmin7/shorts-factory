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
