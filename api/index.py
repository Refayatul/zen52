from flask import Flask, request, jsonify, send_from_directory
import os

# Setup Flask with static folder pointing to public directory
app = Flask(__name__, static_folder='../public', static_url_path='')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/save-session', methods=['POST'])
def save_session():
    # Placeholder for future sync functionality
    return jsonify({"message": "Local-only mode active. Session not synced to cloud."}), 200

@app.route('/api/history', methods=['GET'])
def get_history():
    # Placeholder for future sync functionality
    return jsonify([]), 200

# Vercel requires the app to be exposed as `app`
if __name__ == '__main__':
    app.run(debug=True, port=5000)
