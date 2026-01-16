#!/usr/bin/env python3
"""
3Dmol.js Viewer Server
Simple Flask server for serving viewer and reading PDB files
"""

from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from pathlib import Path
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    """Serve main HTML page"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """Serve static files"""
    return send_from_directory('.', path)

@app.route('/api/read_pdb', methods=['POST'])
def read_pdb():
    """Read PDB file and return content"""
    try:
        data = request.get_json()
        pdb_path = data.get('pdb_path')

        if not pdb_path:
            return jsonify({'success': False, 'error': 'pdb_path required'}), 400

        pdb_path = Path(pdb_path)
        if not pdb_path.exists():
            return jsonify({'success': False, 'error': f'File not found: {pdb_path}'}), 404

        with open(pdb_path, 'r') as f:
            content = f.read()

        return jsonify({
            'success': True,
            'content': content,
            'path': str(pdb_path)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': '3Dmol.js Viewer'
    })

if __name__ == '__main__':
    print("=" * 60)
    print("3Dmol.js Viewer Server")
    print("=" * 60)
    print("Server starting on http://localhost:8082")
    print("=" * 60)

    app.run(host='0.0.0.0', port=8082, debug=False)
