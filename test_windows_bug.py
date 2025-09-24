#!/usr/bin/env python3
"""
Test script to reproduce and verify Windows 11 bug fix
Simulates the race condition where repo_path is None when preview starts
"""

import os
import sys
import time
import asyncio
import requests
import json
from datetime import datetime

# Add the project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "apps", "api"))

def log(message):
    """Log with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] {message}")

def test_api_endpoint(url, method="GET", data=None, expected_status=200):
    """Test API endpoint and return response"""
    try:
        if method == "POST":
            response = requests.post(url, json=data, timeout=10)
        else:
            response = requests.get(url, timeout=10)

        log(f"{method} {url} -> {response.status_code}")

        if response.status_code != expected_status:
            log(f"❌ Expected {expected_status}, got {response.status_code}")
            if response.text:
                log(f"Response: {response.text[:200]}...")

        return response
    except requests.exceptions.RequestException as e:
        log(f"❌ Request failed: {e}")
        return None

def simulate_race_condition():
    """Simulate the race condition by creating project and immediately starting preview"""
    project_id = f"test-windows-bug-{int(time.time())}"
    base_url = "http://localhost:3001/api/projects"

    log("🧪 Starting Windows bug reproduction test...")
    log(f"Project ID: {project_id}")

    # 1. Create project
    log("1. Creating project...")
    create_data = {
        "project_id": project_id,
        "name": "Windows Bug Test",
        "initial_prompt": "Create a simple hello world Next.js app"
    }

    response = test_api_endpoint(f"{base_url}/create", "POST", create_data, 201)
    if not response:
        log("❌ Failed to create project")
        return False

    # 2. Immediately try to start preview (this should fail gracefully now)
    log("2. Immediately attempting to start preview (simulating race condition)...")
    time.sleep(0.1)  # Very short delay to simulate the race condition

    preview_response = test_api_endpoint(f"{base_url}/{project_id}/preview/start", "POST", {}, expected_status=400)

    if preview_response and preview_response.status_code == 400:
        error_msg = preview_response.json().get("detail", "")
        if "not fully initialized" in error_msg or "repo_path is null" in error_msg:
            log("✅ Race condition handled gracefully - got expected 400 error")
            log(f"   Error message: {error_msg}")
        else:
            log(f"❌ Got 400 but unexpected error message: {error_msg}")
            return False
    else:
        log("❌ Expected 400 status for uninitialized project")
        return False

    # 3. Wait for project initialization to complete
    log("3. Waiting for project initialization...")
    max_wait = 60  # 60 seconds max
    wait_time = 0

    while wait_time < max_wait:
        # Check project status
        status_response = test_api_endpoint(f"{base_url}/{project_id}")
        if status_response and status_response.status_code == 200:
            project_data = status_response.json()
            status = project_data.get("status", "unknown")
            log(f"   Project status: {status}")

            if status == "active":
                log("✅ Project initialization completed")
                break
            elif status == "failed":
                log("❌ Project initialization failed")
                return False

        time.sleep(2)
        wait_time += 2

    if wait_time >= max_wait:
        log("❌ Project initialization timed out")
        return False

    # 4. Now try to start preview - should work
    log("4. Starting preview after initialization...")
    preview_response = test_api_endpoint(f"{base_url}/{project_id}/preview/start", "POST", {}, expected_status=200)

    if preview_response and preview_response.status_code == 200:
        preview_data = preview_response.json()
        log("✅ Preview started successfully")
        log(f"   Preview URL: {preview_data.get('url', 'N/A')}")
        log(f"   Port: {preview_data.get('port', 'N/A')}")

        # 5. Stop preview
        log("5. Stopping preview...")
        stop_response = test_api_endpoint(f"{base_url}/{project_id}/preview/stop", "POST", {})
        if stop_response and stop_response.status_code == 200:
            log("✅ Preview stopped successfully")

        return True
    else:
        log("❌ Failed to start preview after initialization")
        return False

def test_direct_function_call():
    """Test the fixed function directly"""
    log("🧪 Testing start_preview_process function directly...")

    try:
        # Import the fixed function
        from app.services.local_runtime import start_preview_process

        # Test with None repo_path (should raise RuntimeError)
        log("Testing with None repo_path...")
        try:
            start_preview_process("test-project", None)
            log("❌ Should have raised RuntimeError for None repo_path")
            return False
        except RuntimeError as e:
            if "Invalid repo_path" in str(e):
                log("✅ Correctly rejected None repo_path")
            else:
                log(f"❌ Wrong error message: {e}")
                return False

        # Test with "None" string repo_path
        log("Testing with 'None' string repo_path...")
        try:
            start_preview_process("test-project", "None")
            log("❌ Should have raised RuntimeError for 'None' repo_path")
            return False
        except RuntimeError as e:
            if "Invalid repo_path" in str(e):
                log("✅ Correctly rejected 'None' string repo_path")
            else:
                log(f"❌ Wrong error message: {e}")
                return False

        # Test with non-existent path
        log("Testing with non-existent path...")
        try:
            start_preview_process("test-project", "/nonexistent/path")
            log("❌ Should have raised RuntimeError for non-existent path")
            return False
        except RuntimeError as e:
            if "does not exist" in str(e):
                log("✅ Correctly rejected non-existent path")
            else:
                log(f"❌ Wrong error message: {e}")
                return False

        log("✅ All direct function tests passed")
        return True

    except ImportError as e:
        log(f"❌ Failed to import function: {e}")
        return False

def main():
    """Main test runner"""
    log("🚀 Windows 11 Bug Fix Test Suite")
    log("=" * 50)

    # Check if server is running
    try:
        response = requests.get("http://localhost:3001/api/projects", timeout=5)
        if response.status_code != 200:
            log("❌ API server not responding correctly")
            return
    except:
        log("❌ API server not running. Please start with 'npm run dev' first")
        return

    log("✅ API server is running")

    # Run tests
    results = []

    # Test 1: Direct function validation
    log("\n" + "=" * 30)
    log("TEST 1: Direct Function Validation")
    log("=" * 30)
    results.append(("Direct Function Test", test_direct_function_call()))

    # Test 2: Race condition simulation
    log("\n" + "=" * 30)
    log("TEST 2: Race Condition Simulation")
    log("=" * 30)
    results.append(("Race Condition Test", simulate_race_condition()))

    # Summary
    log("\n" + "=" * 50)
    log("📊 TEST RESULTS SUMMARY")
    log("=" * 50)

    passed = 0
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{test_name}: {status}")
        if result:
            passed += 1

    log(f"\nOverall: {passed}/{len(results)} tests passed")

    if passed == len(results):
        log("🎉 All tests passed! Windows bug appears to be fixed.")
    else:
        log("⚠️  Some tests failed. Bug may not be fully fixed.")

if __name__ == "__main__":
    main()