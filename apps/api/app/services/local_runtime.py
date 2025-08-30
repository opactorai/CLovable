import subprocess
import socket
import signal
import os
import time
import hashlib
import threading
import re
from contextlib import closing
from typing import Optional, Dict
from app.core.config import settings


# Global process registry to track running Next.js processes
_running_processes: Dict[str, subprocess.Popen] = {}
_process_logs: Dict[str, list] = {}  # Store process logs for each project

def _monitor_preview_errors(project_id: str, process: subprocess.Popen):
    """간단한 Preview 서버 에러 모니터링"""
    from app.core.websocket.manager import manager
    import asyncio
    
    error_patterns = [
        "Build Error",
        "Failed to compile", 
        "Syntax Error",
        "TypeError:",
        "ReferenceError:",
        "Module not found",
        "Expected",
        "⨯",  # Next.js error symbol
        "Error:",  # Generic error
        "runtime error",
        "Runtime Error",
        "Uncaught",
        "Cannot read",
        "Cannot access",
        "is not defined",
        "is not a function",
        "Cannot resolve module",
        "Error occurred prerendering",
        "Unhandled Runtime Error",
        "GET / 500",  # HTTP 500 errors
        "POST / 500",
        "Internal server error",
        "Application error"
    ]
    
    success_patterns = [
        "✓ Ready in",
        "○ Compiling",
        "✓ Compiled",
        "✓ Starting"
    ]
    
    recent_errors = {}     # 에러 ID별 마지막 전송 시간
    error_contexts = {}    # 에러별 컨텍스트 수집
    current_error = None   # 현재 처리 중인 에러
    error_lines = []       # 에러 관련 라인들
    
    def generate_error_id(error_line):
        """에러 라인에서 고유 ID 생성"""
        import hashlib
        # 에러의 핵심 부분만 추출하여 ID 생성
        core_error = error_line.strip()
        # 시간이나 파일 경로 등 변동사항 제거
        core_error = re.sub(r'\d{2}:\d{2}:\d{2}', '', core_error)  # 시간 제거
        core_error = re.sub(r'at .*?:\d+:\d+', '', core_error)     # 위치 정보 제거
        return hashlib.md5(core_error.encode()).hexdigest()[:8]
    
    def should_send_error(error_id):
        """에러를 전송할지 판단 (5초 내 중복 방지)"""
        now = time.time()
        if error_id in recent_errors:
            if now - recent_errors[error_id] < 5:  # 5초 내 중복 방지
                return False
        recent_errors[error_id] = now
        return True
    
    def collect_error_context(line_text):
        """에러 관련 컨텍스트 수집"""
        nonlocal current_error, error_lines
        
        # 프로젝트별 로그 저장 (전체 로그 수집용)
        if project_id not in _process_logs:
            _process_logs[project_id] = []
        
        # 중복 로그 제거 (같은 라인이 연속으로 오는 경우)
        stripped_line = line_text.strip()
        if not stripped_line:  # 빈 라인 무시
            return
            
        # 마지막 로그와 같은 경우 무시 (중복 제거)
        if _process_logs[project_id] and _process_logs[project_id][-1] == stripped_line:
            return
            
        _process_logs[project_id].append(stripped_line)
        # 최대 1000라인까지만 저장
        if len(_process_logs[project_id]) > 1000:
            _process_logs[project_id] = _process_logs[project_id][-1000:]
        
        # 성공 패턴 감지 - 에러 상태 클리어
        for pattern in success_patterns:
            if pattern in line_text:
                # 성공 상태 전송
                success_message = {
                    "type": "preview_success",
                    "success": {
                        "message": line_text.strip(),
                        "timestamp": int(time.time() * 1000)
                    }
                }
                
                print(f"[PreviewSuccess] 성공 메시지: {line_text.strip()}")
                
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(
                        manager.send_message(project_id, success_message)
                    )
                    print(f"[PreviewSuccess] WebSocket 전송 성공!")
                except Exception as e:
                    print(f"[PreviewSuccess] WebSocket 전송 실패: {e}")
                
                # 현재 에러 상태 클리어
                current_error = None
                error_lines = []
                return

        # 새로운 에러 시작 감지
        for pattern in error_patterns:
            if pattern in line_text:
                # 이전 에러가 있다면 전송
                if current_error and error_lines:
                    send_error_with_context(current_error, error_lines)
                
                # 새로운 에러 시작
                current_error = generate_error_id(line_text)
                error_lines = [line_text.strip()]
                return
        
        # 현재 에러에 관련된 라인 수집
        if current_error and (line_text.strip() and 
                              any(x in line_text.lower() for x in ['error', 'failed', 'expected', 'at ', 'module', 'cannot', 'uncaught', 'undefined', 'null'])):
            error_lines.append(line_text.strip())
            if len(error_lines) > 15:  # 런타임 에러는 스택트레이스가 길 수 있으므로 15라인까지
                error_lines = error_lines[-15:]
    
    def send_error_with_context(error_id, lines):
        """컨텍스트와 함께 에러 전송"""
        if not should_send_error(error_id):
            return
        
        # 에러 메시지와 컨텍스트 구성
        main_message = lines[0] if lines else "Unknown error"
        full_context = '\n'.join(lines[:5])  # 최대 5라인 컨텍스트
        
        message_data = {
            "type": "preview_error",
            "error": {
                "id": error_id,
                "message": main_message[:200],
                "context": full_context,
                "timestamp": int(time.time() * 1000)
            }
        }
        
        print(f"[PreviewError] 전송할 에러 (ID: {error_id}): {main_message[:100]}")
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                manager.send_message(project_id, message_data)
            )
            print(f"[PreviewError] WebSocket 전송 성공! (ID: {error_id})")
        except Exception as e:
            print(f"[PreviewError] WebSocket 전송 실패: {e}")
    
    while process.poll() is None:
        try:
            if process.stdout:
                line = process.stdout.readline()
                if line:
                    line_text = line if isinstance(line, str) else line.decode('utf-8', errors='ignore')
                    collect_error_context(line_text)
            
            time.sleep(0.1)
        except Exception as e:
            print(f"[PreviewError] 모니터링 에러: {e}")
            break
    
    # 프로세스 종료 시 마지막 에러 전송
    if current_error and error_lines:
        send_error_with_context(current_error, error_lines)
    
    print(f"[PreviewError] {project_id} 모니터링 종료")


def _is_port_free(port: int) -> bool:
    """Check if a port is available"""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def find_free_preview_port() -> int:
    """Find a free port in the preview range"""
    for port in range(settings.preview_port_start, settings.preview_port_end + 1):
        if _is_port_free(port):
            return port
    raise RuntimeError("No free preview port available")


def _should_install_dependencies(repo_path: str) -> bool:
    """
    Check if dependencies need to be installed.
    Returns True if:
    - node_modules doesn't exist
    - package.json or package-lock.json has changed since last install
    """
    node_modules_path = os.path.join(repo_path, "node_modules")
    package_json_path = os.path.join(repo_path, "package.json")
    package_lock_path = os.path.join(repo_path, "package-lock.json")
    install_hash_path = os.path.join(repo_path, ".lovable_install_hash")
    
    # If node_modules doesn't exist, definitely need to install
    if not os.path.exists(node_modules_path):
        print(f"node_modules not found, will install dependencies")
        return True
    
    # Calculate current hash of package files
    current_hash = ""
    
    # Hash package.json
    if os.path.exists(package_json_path):
        with open(package_json_path, 'rb') as f:
            current_hash += hashlib.md5(f.read()).hexdigest()
    
    # Hash npm's package-lock.json if it exists
    if os.path.exists(package_lock_path):
        with open(package_lock_path, 'rb') as f:
            current_hash += hashlib.md5(f.read()).hexdigest()
    
    # Create final hash
    final_hash = hashlib.md5(current_hash.encode()).hexdigest()
    
    # Check if hash file exists and matches
    if os.path.exists(install_hash_path):
        with open(install_hash_path, 'r') as f:
            stored_hash = f.read().strip()
            if stored_hash == final_hash:
                print(f"Dependencies are up to date (hash: {final_hash[:8]}...)")
                return False
    
    print(f"Package files changed, will install dependencies (new hash: {final_hash[:8]}...)")
    return True


def _save_install_hash(repo_path: str) -> None:
    """Save the current hash of package files after successful install"""
    package_json_path = os.path.join(repo_path, "package.json")
    package_lock_path = os.path.join(repo_path, "package-lock.json")
    install_hash_path = os.path.join(repo_path, ".lovable_install_hash")
    
    # Calculate current hash
    current_hash = ""
    
    # Hash package.json
    if os.path.exists(package_json_path):
        with open(package_json_path, 'rb') as f:
            current_hash += hashlib.md5(f.read()).hexdigest()
    
    # Hash package-lock.json if it exists
    if os.path.exists(package_lock_path):
        with open(package_lock_path, 'rb') as f:
            current_hash += hashlib.md5(f.read()).hexdigest()
    
    # Create final hash and save
    final_hash = hashlib.md5(current_hash.encode()).hexdigest()
    
    with open(install_hash_path, 'w') as f:
        f.write(final_hash)


def start_preview_process(project_id: str, repo_path: str, port: Optional[int] = None) -> tuple[str, int]:
    """
    Start a Next.js development server using subprocess
    
    Args:
        project_id: Unique project identifier
        repo_path: Path to the project repository
        port: Optional port number, will auto-assign if not provided
    
    Returns:
        Tuple of (process_name, port)
    """
    # Stop existing process if any
    stop_preview_process(project_id)
    
    # Clear previous logs for this project
    if project_id in _process_logs:
        _process_logs[project_id] = []
        print(f"[PreviewError] Cleared previous logs for {project_id}")
    
    # Assign port
    port = port or find_free_preview_port()
    process_name = f"next-dev-{project_id}"
    
    # Check if project has package.json
    package_json_path = os.path.join(repo_path, "package.json")
    if not os.path.exists(package_json_path):
        raise RuntimeError(f"No package.json found in {repo_path}")
    
    # Install dependencies and start dev server
    env = os.environ.copy()
    env.update({
        "NODE_ENV": "development",
        "NEXT_TELEMETRY_DISABLED": "1",
        "NPM_CONFIG_UPDATE_NOTIFIER": "false",
        "PORT": str(port)
    })
    
    try:
        # Normalize repository to npm to avoid mixed package managers
        try:
            pnpm_lock = os.path.join(repo_path, "pnpm-lock.yaml")
            yarn_lock = os.path.join(repo_path, "yarn.lock")
            pnpm_dir = os.path.join(repo_path, "node_modules", ".pnpm")
            if os.path.exists(pnpm_lock) or os.path.exists(yarn_lock) or os.path.isdir(pnpm_dir):
                print("Detected non-npm artifacts (pnpm/yarn). Cleaning to use npm...")
                # Remove node_modules to avoid arborist crashes
                try:
                    import shutil
                    shutil.rmtree(os.path.join(repo_path, "node_modules"), ignore_errors=True)
                except Exception as _e:
                    print(f"Warning: failed to remove node_modules: {_e}")
                # Remove other lockfiles
                try:
                    if os.path.exists(pnpm_lock):
                        os.remove(pnpm_lock)
                except Exception:
                    pass
                try:
                    if os.path.exists(yarn_lock):
                        os.remove(yarn_lock)
                except Exception:
                    pass
        except Exception as _e:
            print(f"Warning during npm normalization: {_e}")

        # Only install dependencies if needed
        if _should_install_dependencies(repo_path):
            print(f"Installing dependencies for project {project_id} with npm...")
            install_result = subprocess.run(
                ["npm", "install"],
                cwd=repo_path,
                env=env,
                capture_output=True,
                text=True,
                timeout=120  # 2 minutes timeout for npm install
            )
            
            if install_result.returncode != 0:
                raise RuntimeError(f"npm install failed: {install_result.stderr}")
            
            # Save hash after successful install
            _save_install_hash(repo_path)
            print(f"Dependencies installed successfully for project {project_id} using npm")
        else:
            print(f"Dependencies already up to date for project {project_id}, skipping npm install")
        
        # Start development server
        print(f"Starting Next.js dev server for project {project_id} on port {port}...")
        process = subprocess.Popen(
            ["npm", "run", "dev", "--", "-p", str(port)],
            cwd=repo_path,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            preexec_fn=os.setsid  # Create new process group for easier cleanup
        )
        
        # Wait a moment for the server to start
        time.sleep(2)
        
        # Check if process is still running
        if process.poll() is not None:
            stdout, _ = process.communicate()
            raise RuntimeError(f"Next.js server failed to start: {stdout}")
        
        # Start error monitoring thread
        error_thread = threading.Thread(
            target=_monitor_preview_errors,
            args=(project_id, process),
            daemon=True
        )
        error_thread.start()
        print(f"[PreviewError] {project_id} 에러 모니터링 시작")
        
        # Store process reference
        _running_processes[project_id] = process
        
        print(f"Next.js dev server started for {project_id} on port {port} (PID: {process.pid})")
        return process_name, port
        
    except subprocess.TimeoutExpired:
        raise RuntimeError("npm install timed out after 2 minutes")
    except Exception as e:
        raise RuntimeError(f"Failed to start preview process: {str(e)}")


def stop_preview_process(project_id: str, cleanup_cache: bool = False) -> None:
    """
    Stop the Next.js development server for a project
    
    Args:
        project_id: Project identifier
        cleanup_cache: Whether to cleanup npm cache (optional)
    """
    process = _running_processes.get(project_id)
    
    if process:
        try:
            # Terminate the entire process group
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            
            # Wait for process to terminate gracefully
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # Force kill if it doesn't terminate gracefully
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                process.wait()
                
            print(f"Stopped Next.js dev server for project {project_id} (PID: {process.pid})")
            
        except (OSError, ProcessLookupError):
            # Process already terminated
            pass
        finally:
            # Remove from registry
            del _running_processes[project_id]
            # Clear logs when process stops
            if project_id in _process_logs:
                del _process_logs[project_id]
                print(f"[PreviewStop] Cleared logs for {project_id}")
    
    # Optionally cleanup npm cache
    if cleanup_cache:
        try:
            repo_path = os.path.join(settings.projects_root, project_id, "repo")
            if os.path.exists(repo_path):
                subprocess.run(
                    ["npm", "cache", "clean", "--force"],
                    cwd=repo_path,
                    capture_output=True,
                    timeout=30
                )
                print(f"Cleaned npm cache for project {project_id}")
        except Exception as e:
            print(f"Failed to clean npm cache for {project_id}: {e}")


def cleanup_project_resources(project_id: str) -> None:
    """Cleanup all resources for a project"""
    stop_preview_process(project_id, cleanup_cache=True)


def preview_status(project_id: str) -> str:
    """
    Get the status of a preview process
    
    Returns:
        "running", "stopped", or "not_found"
    """
    process = _running_processes.get(project_id)
    
    if not process:
        return "not_found"
    
    # Check if process is still alive
    if process.poll() is None:
        return "running"
    else:
        # Process has terminated, remove from registry
        del _running_processes[project_id]
        return "stopped"


def get_running_processes() -> Dict[str, int]:
    """Get all currently running processes with their PIDs"""
    active_processes = {}
    for project_id, process in list(_running_processes.items()):
        if process.poll() is None:
            active_processes[project_id] = process.pid
        else:
            # Clean up terminated processes
            del _running_processes[project_id]
    
    return active_processes


def get_all_preview_logs(project_id: str) -> str:
    """
    Get all stored logs from the preview process
    
    Args:
        project_id: Project identifier
    
    Returns:
        String containing all stored logs
    """
    if project_id not in _process_logs:
        return "No logs available for this project"
    
    # 추가 중복 제거: 같은 에러 블록이 반복되는 경우
    logs = _process_logs[project_id]
    if not logs:
        return "No logs available for this project"
    
    # 큰 중복 블록 제거 (같은 에러가 여러 번 반복되는 경우)
    unique_logs = []
    seen_blocks = set()
    current_block = []
    
    for line in logs:
        current_block.append(line)
        
        # 에러 블록이 끝나는 시점 감지 (GET 요청이나 새로운 시작)
        if line.startswith('GET /') or line.startswith('> ') or len(current_block) > 50:
            block_str = '\n'.join(current_block)
            block_hash = hash(block_str)
            
            if block_hash not in seen_blocks:
                seen_blocks.add(block_hash)
                unique_logs.extend(current_block)
            
            current_block = []
    
    # 마지막 블록 처리
    if current_block:
        block_str = '\n'.join(current_block)
        block_hash = hash(block_str)
        if block_hash not in seen_blocks:
            unique_logs.extend(current_block)
    
    return '\n'.join(unique_logs) if unique_logs else "No unique logs available"

def get_preview_error_logs(project_id: str) -> str:
    """
    Get error logs from the preview process
    
    Args:
        project_id: Project identifier
    
    Returns:
        String containing all error logs
    """
    process = _running_processes.get(project_id)
    
    if not process:
        return "No preview process running"
    
    # Get all available output
    logs = []
    try:
        if process.stdout and hasattr(process.stdout, 'read'):
            # Read all available data
            import fcntl
            import os
            fd = process.stdout.fileno()
            flags = fcntl.fcntl(fd, fcntl.F_GETFL)
            fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            
            try:
                while True:
                    line = process.stdout.readline()
                    if not line:
                        break
                    logs.append(line)
            except (IOError, OSError):
                pass  # No more data available
    except Exception as e:
        return f"Error reading logs: {str(e)}"
    
    if not logs:
        return "No error logs available"
    
    # Join all logs and return
    return ''.join(logs)

def get_preview_logs(project_id: str, lines: int = 100) -> str:
    """
    Get logs from the preview process
    
    Args:
        project_id: Project identifier
        lines: Number of lines to return
    
    Returns:
        String containing the logs
    """
    process = _running_processes.get(project_id)
    
    if not process or not process.stdout:
        return "No logs available - process not running or no output"
    
    # Read available output without blocking
    logs = []
    try:
        # Set stdout to non-blocking mode
        import fcntl
        import os
        fd = process.stdout.fileno()
        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
        
        # Read available lines
        while len(logs) < lines:
            line = process.stdout.readline()
            if not line:
                break
            logs.append(line)
        
    except (IOError, OSError):
        # No more data available
        pass
    
    return ''.join(logs[-lines:]) if logs else "No recent logs available"
