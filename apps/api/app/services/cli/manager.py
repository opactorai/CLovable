"""Unified CLI Manager implementation.

Moved from unified_manager.py to a dedicated module.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.terminal_ui import ui
from app.core.websocket.manager import manager as ws_manager
from app.models.messages import Message

from .base import CLIType
from .adapters import ClaudeCodeCLI, CursorAgentCLI, CodexCLI, QwenCLI, GeminiCLI


class UnifiedCLIManager:
    """Unified manager for all CLI implementations"""

    def __init__(
        self,
        project_id: str,
        project_path: str,
        session_id: str,
        conversation_id: str,
        db: Any,  # SQLAlchemy Session
    ):
        self.project_id = project_id
        self.project_path = project_path
        self.session_id = session_id
        self.conversation_id = conversation_id
        self.db = db

        # Initialize CLI adapters with database session
        self.cli_adapters = {
            CLIType.CLAUDE: ClaudeCodeCLI(),  # Use SDK implementation if available
            CLIType.CURSOR: CursorAgentCLI(db_session=db),
            CLIType.CODEX: CodexCLI(db_session=db),
            CLIType.QWEN: QwenCLI(db_session=db),
            CLIType.GEMINI: GeminiCLI(db_session=db),
        }

    async def execute_instruction(
        self,
        instruction: str,
        cli_type: CLIType,
        fallback_enabled: bool = True,  # Kept for backward compatibility but not used
        images: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        is_initial_prompt: bool = False,
    ) -> Dict[str, Any]:
        """Execute instruction with specified CLI"""

        # Try the specified CLI
        if cli_type in self.cli_adapters:
            cli = self.cli_adapters[cli_type]

            # Check if CLI is available
            status = await cli.check_availability()
            if status.get("available") and status.get("configured"):
                try:
                    return await self._execute_with_cli(
                        cli, instruction, images, model, is_initial_prompt
                    )
                except Exception as e:
                    ui.error(f"CLI {cli_type.value} failed: {e}", "CLI")
                    return {
                        "success": False,
                        "error": str(e),
                        "cli_attempted": cli_type.value,
                    }
            else:
                return {
                    "success": False,
                    "error": status.get("error", "CLI not available"),
                    "cli_attempted": cli_type.value,
                }

        return {
            "success": False,
            "error": f"CLI type {cli_type.value} not implemented",
            "cli_attempted": cli_type.value,
        }

    async def _execute_with_cli(
        self,
        cli,
        instruction: str,
        images: Optional[List[Dict[str, Any]]],
        model: Optional[str] = None,
        is_initial_prompt: bool = False,
    ) -> Dict[str, Any]:
        """Execute instruction with a specific CLI"""

        ui.info(f"Starting {cli.cli_type.value} execution", "CLI")
        if model:
            ui.debug(f"Using model: {model}", "CLI")

        messages_collected: List[Message] = []
        has_changes = False
        has_error = False  # Track if any error occurred
        result_success: Optional[bool] = None  # Track result event success status

        # Log callback
        async def log_callback(message: str):
            # CLI output logs are now only printed to console, not sent to UI
            pass

        async for message in cli.execute_with_streaming(
            instruction=instruction,
            project_path=self.project_path,
            session_id=self.session_id,
            log_callback=log_callback,
            images=images,
            model=model,
            is_initial_prompt=is_initial_prompt,
        ):
            # Check for error messages or result status
            if message.message_type == "error":
                has_error = True
                ui.error(f"CLI error detected: {message.content[:100]}", "CLI")

            # Check for Cursor result event (stored in metadata)
            if message.metadata_json:
                event_type = message.metadata_json.get("event_type")
                original_event = message.metadata_json.get("original_event", {})

                if event_type == "result" or original_event.get("type") == "result":
                    # Cursor sends result event with success/error status
                    is_error = original_event.get("is_error", False)
                    subtype = original_event.get("subtype", "")

                    # DEBUG: Log the complete result event structure
                    ui.info(f"🔍 [Cursor] Result event received:", "DEBUG")
                    ui.info(f"   Full event: {original_event}", "DEBUG")
                    ui.info(f"   is_error: {is_error}", "DEBUG")
                    ui.info(f"   subtype: '{subtype}'", "DEBUG")
                    ui.info(f"   has event.result: {'result' in original_event}", "DEBUG")
                    ui.info(f"   has event.status: {'status' in original_event}", "DEBUG")
                    ui.info(f"   has event.success: {'success' in original_event}", "DEBUG")

                    if is_error or subtype == "error":
                        has_error = True
                        result_success = False
                        ui.error(
                            f"Cursor result: error (is_error={is_error}, subtype='{subtype}')",
                            "CLI",
                        )
                    elif subtype == "success":
                        result_success = True
                        ui.success(
                            f"Cursor result: success (subtype='{subtype}')", "CLI"
                        )
                    else:
                        # Handle case where subtype is not "success" but execution was successful
                        ui.warning(
                            f"Cursor result: no explicit success subtype (subtype='{subtype}', is_error={is_error})",
                            "CLI",
                        )
                        # If there's no error indication, assume success
                        if not is_error:
                            result_success = True
                            ui.success(
                                f"Cursor result: assuming success (no error detected)", "CLI"
                            )

            # Save message to database
            message.project_id = self.project_id
            message.conversation_id = self.conversation_id
            self.db.add(message)
            self.db.commit()

            messages_collected.append(message)

            # Check if message should be hidden from UI
            should_hide = (
                message.metadata_json and message.metadata_json.get("hidden_from_ui", False)
            )

            # Send message via WebSocket only if not hidden
            if not should_hide:
                ws_message = {
                    "type": "message",
                    "data": {
                        "id": message.id,
                        "role": message.role,
                        "message_type": message.message_type,
                        "content": message.content,
                        "metadata": message.metadata_json,
                        "parent_message_id": getattr(message, "parent_message_id", None),
                        "session_id": message.session_id,
                        "conversation_id": self.conversation_id,
                        "created_at": message.created_at.isoformat(),
                    },
                    "timestamp": message.created_at.isoformat(),
                }
                try:
                    await ws_manager.send_message(self.project_id, ws_message)
                except Exception as e:
                    ui.error(f"WebSocket send failed: {e}", "Message")

            # Check if changes were made
            if message.metadata_json and "changes_made" in message.metadata_json:
                has_changes = True

        # Determine final success status
        # For Cursor: check result_success if available, otherwise check has_error
        # For others: check has_error
        ui.info(
            f"🔍 Final success determination: cli_type={cli.cli_type}, result_success={result_success}, has_error={has_error}",
            "CLI",
        )

        if cli.cli_type == CLIType.CURSOR and result_success is not None:
            success = result_success
            ui.info(f"Using Cursor result_success: {result_success}", "CLI")
        else:
            success = not has_error
            ui.info(f"Using has_error logic: not {has_error} = {success}", "CLI")

        if success:
            ui.success(
                f"Streaming completed successfully. Total messages: {len(messages_collected)}",
                "CLI",
            )
        else:
            ui.error(
                f"Streaming completed with errors. Total messages: {len(messages_collected)}",
                "CLI",
            )

        return {
            "success": success,
            "cli_used": cli.cli_type.value,
            "has_changes": has_changes,
            "message": f"{'Successfully' if success else 'Failed to'} execute with {cli.cli_type.value}",
            "error": "Execution failed" if not success else None,
            "messages_count": len(messages_collected),
        }

        # End _execute_with_cli

    async def check_cli_status(
        self, cli_type: CLIType, selected_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Check status of a specific CLI"""
        if cli_type in self.cli_adapters:
            status = await self.cli_adapters[cli_type].check_availability()

            # Add model validation if model is specified
            if selected_model and status.get("available"):
                cli = self.cli_adapters[cli_type]
                if not cli.is_model_supported(selected_model):
                    status[
                        "model_warning"
                    ] = f"Model '{selected_model}' may not be supported by {cli_type.value}"
                    status["suggested_models"] = status.get("default_models", [])
                else:
                    status["selected_model"] = selected_model
                    status["model_valid"] = True

            return status
        return {
            "available": False,
            "configured": False,
            "error": f"CLI type {cli_type.value} not implemented",
        }


__all__ = ["UnifiedCLIManager"]
