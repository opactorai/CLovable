import subprocess
import asyncio
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.cli.unified_manager import CursorAgentCLI
from app.services.cli.base import CLIType

router = APIRouter(prefix="/api/settings", tags=["settings"])

# CLI 옵션과 체크 명령어 정의
CLI_OPTIONS = [
    {
        "id": "claude",
        "name": "Claude Code", 
        "check_command": ["claude", "--version"]
    },
    {
        "id": "cursor",
        "name": "Cursor Agent",
        "check_command": ["cursor-agent", "--version"]
    },
]

class CLIStatusResponse(BaseModel):
    cli_id: str
    installed: bool
    version: str | None = None
    error: str | None = None


async def check_cli_installation(cli_id: str, command: list) -> CLIStatusResponse:
    """단일 CLI의 설치 상태를 확인합니다."""
    try:
        # subprocess를 비동기로 실행
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            # 성공적으로 실행된 경우
            version_output = stdout.decode().strip()
            # 버전 정보에서 실제 버전 번호 추출 (첫 번째 라인만 사용)
            version = version_output.split('\n')[0] if version_output else "installed"
            
            return CLIStatusResponse(
                cli_id=cli_id,
                installed=True,
                version=version
            )
        else:
            # 명령어 실행은 되었지만 에러 리턴 코드
            error_msg = stderr.decode().strip() if stderr else f"Command failed with code {process.returncode}"
            return CLIStatusResponse(
                cli_id=cli_id,
                installed=False,
                error=error_msg
            )
            
    except FileNotFoundError:
        # 명령어를 찾을 수 없는 경우 (설치되지 않음)
        return CLIStatusResponse(
            cli_id=cli_id,
            installed=False,
            error="Command not found"
        )
    except Exception as e:
        # 기타 예외
        return CLIStatusResponse(
            cli_id=cli_id,
            installed=False,
            error=str(e)
        )


@router.get("/cli-status")
async def get_cli_status() -> Dict[str, Any]:
    """모든 CLI의 설치 상태를 확인하고 반환합니다."""
    results = {}
    
    # 새로운 UnifiedCLIManager의 CLI 인스턴스 사용
    from app.services.cli.unified_manager import ClaudeCodeCLI, CursorAgentCLI, CodexCLI, QwenCLI, GeminiCLI
    cli_instances = {
        "claude": ClaudeCodeCLI(),
        "cursor": CursorAgentCLI(),
        "codex": CodexCLI(),
        "qwen": QwenCLI(),
        "gemini": GeminiCLI()
    }
    
    # 모든 CLI를 병렬로 확인
    tasks = []
    for cli_id, cli_instance in cli_instances.items():
        print(f"[DEBUG] Setting up check for CLI: {cli_id}")
        async def check_cli(cli_id, cli_instance):
            print(f"[DEBUG] Checking CLI: {cli_id}")
            status = await cli_instance.check_availability()
            print(f"[DEBUG] CLI {cli_id} status: {status}")
            return cli_id, status
        
        tasks.append(check_cli(cli_id, cli_instance))
    
    # 모든 태스크 실행
    cli_results = await asyncio.gather(*tasks)
    
    # 결과를 딕셔너리로 변환
    for cli_id, status in cli_results:
        results[cli_id] = {
            "installed": status.get("available", False) and status.get("configured", False),
            "version": status.get("models", ["Unknown"])[0] if status.get("models") else None,
            "error": status.get("error"),
            "checking": False
        }
    
    return results


# 글로벌 설정 관리를 위한 임시 메모리 저장소 (실제로는 데이터베이스에 저장해야 함)
GLOBAL_SETTINGS = {
    "default_cli": "claude",
    "cli_settings": {
        "claude": {"model": "claude-sonnet-4"},
        "cursor": {"model": "gpt-5"}
    }
}

class GlobalSettingsModel(BaseModel):
    default_cli: str
    cli_settings: Dict[str, Any]


@router.get("/global")
async def get_global_settings() -> Dict[str, Any]:
    """글로벌 설정을 반환합니다."""
    return GLOBAL_SETTINGS


@router.put("/global")
async def update_global_settings(settings: GlobalSettingsModel) -> Dict[str, Any]:
    """글로벌 설정을 업데이트합니다."""
    global GLOBAL_SETTINGS
    
    GLOBAL_SETTINGS.update({
        "default_cli": settings.default_cli,
        "cli_settings": settings.cli_settings
    })
    
    return {"success": True, "settings": GLOBAL_SETTINGS}
