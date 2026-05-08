"""
SpeakIt — Bangla TTS Local Server
Uses gTTS (Google Text-to-Speech) for Bangla speech synthesis.
Runs on http://localhost:5588
"""

import io
import base64
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from gtts import gTTS

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "BanglaTTS-gTTS"})


@app.route('/speak', methods=['POST'])
def speak():
    """
    Convert Bangla text to speech audio using Google TTS.
    
    Request JSON:
        text (str): Bangla text to speak
        voice (str): "male" or "female" (gTTS uses a single voice, but we accept this for API compat)
        format (str): "mp3" or "base64" (default: "base64")
    
    Response:
        If format=base64: JSON { audio: "data:audio/mp3;base64,..." }
        If format=mp3: MP3 audio file
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({"error": "Empty text"}), 400

    # Limit text length
    if len(text) > 5000:
        text = text[:5000]

    voice = data.get('voice', 'female')
    output_format = data.get('format', 'base64')
    
    # gTTS supports slow mode as a speed toggle
    slow = data.get('slow', False)

    try:
        tts = gTTS(text=text, lang='bn', slow=slow)
        
        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_buffer.seek(0)

        if output_format == 'mp3':
            return send_file(mp3_buffer, mimetype='audio/mpeg', as_attachment=False)
        else:
            # Return as base64 data URI
            b64 = base64.b64encode(mp3_buffer.read()).decode('utf-8')
            return jsonify({
                "audio": f"data:audio/mpeg;base64,{b64}",
                "text": text,
                "voice": voice
            })

    except Exception as e:
        print(f"[BanglaTTS] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/voices', methods=['GET'])
def voices():
    """List available Bangla voices."""
    return jsonify({
        "voices": [
            {"id": "female", "name": "\u09AC\u09BE\u0982\u09B2\u09BE \u09A8\u09BE\u09B0\u09C0 (Bangla Female)", "lang": "bn-BD"},
            {"id": "male", "name": "\u09AC\u09BE\u0982\u09B2\u09BE \u09AA\u09C1\u09B0\u09C1\u09B7 (Bangla Male)", "lang": "bn-BD"}
        ]
    })


if __name__ == '__main__':
    print("=" * 50)
    print("  SpeakIt \u2014 Bangla TTS Server (gTTS)")
    print("  http://localhost:5588")
    print("=" * 50)
    print()
    print("No model download needed! Uses Google Translate TTS.")
    print("Press Ctrl+C to stop.\n")
    app.run(host='127.0.0.1', port=5588, debug=False)
