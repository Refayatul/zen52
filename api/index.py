from flask import Flask, request, jsonify, send_from_directory
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup Flask with static folder pointing to public directory
app = Flask(__name__, static_folder='../public', static_url_path='')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Supabase Setup
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

# Initialize Supabase client if credentials are present
supabase: Client = None
if url and key:
    supabase = create_client(url, key)

@app.route('/api/save-session', methods=['POST'])
def save_session():
    if not supabase:
        return jsonify({"error": "Supabase not configured"}), 500

    data = request.json
    duration = data.get('duration')
    session_type = data.get('type')

    if not duration or not session_type:
        return jsonify({"error": "Missing data"}), 400

    try:
        response = supabase.table('sessions').insert({
            "duration": duration,
            "type": session_type
        }).execute()
        return jsonify({"message": "Session saved", "data": response.data}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    if not supabase:
        return jsonify({"error": "Supabase not configured"}), 500

    try:
        # Fetch last 5 sessions, ordered by created_at descending
        response = supabase.table('sessions').select("*").order('created_at', desc=True).limit(100).execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Vercel requires the app to be exposed as `app`
if __name__ == '__main__':
    app.run(debug=True)
