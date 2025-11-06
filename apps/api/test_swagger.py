#!/usr/bin/env python
"""
Quick test script to verify Swagger is working
"""
import subprocess
import time
import sys
import os
import signal

def start_server():
    """Start the API server"""
    env = os.environ.copy()
    env['API_PORT'] = '8001'
    proc = subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'app.main:app', '--port', '8001'],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(3)  # Wait for server to start
    return proc

def test_endpoints():
    """Test the Swagger endpoints"""
    import requests

    endpoints = [
        ("http://localhost:8001/docs", "Swagger UI"),
        ("http://localhost:8001/redoc", "ReDoc"),
        ("http://localhost:8001/openapi.json", "OpenAPI JSON"),
    ]

    for url, name in endpoints:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                print(f"✅ {name} is working at {url}")
                if "openapi.json" in url:
                    data = response.json()
                    print(f"   API Version: {data.get('info', {}).get('version', 'Unknown')}")
                    print(f"   Title: {data.get('info', {}).get('title', 'Unknown')}")
            else:
                print(f"❌ {name} returned status {response.status_code}")
        except Exception as e:
            print(f"❌ Failed to access {name}: {e}")

if __name__ == "__main__":
    # Comment out server start since we'll run it manually
    # proc = start_server()

    print("\n🔍 Testing Swagger/OpenAPI endpoints...\n")
    test_endpoints()

    print("\n✨ Test complete!")
    print("\nTo view the documentation, open your browser and go to:")
    print("  - Swagger UI: http://localhost:8001/docs")
    print("  - ReDoc: http://localhost:8001/redoc")