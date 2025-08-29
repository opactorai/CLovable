"""
Act Execution API Endpoints
Handles CLI execution and AI actions
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from datetime import datetime
import uuid
import asyncio
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_db
from app.models.projects import Project
from app.models.messages import Message
from app.models.sessions import Session as ChatSession
from app.models.commits import Commit
from app.models.user_requests import UserRequest
from app.services.cli.unified_manager import UnifiedCLIManager
from app.services.cli.base import CLIType
from app.services.git_ops import commit_all
from app.core.websocket.manager import manager
from app.core.terminal_ui import ui


router = APIRouter()


class ImageAttachment(BaseModel):
    name: str
    # Either base64_data or path must be provided
    base64_data: Optional[str] = None
    path: Optional[str] = None  # Absolute path to image file
    mime_type: str = "image/jpeg"


class ActRequest(BaseModel):
    instruction: str
    conversation_id: str | None = None
    cli_preference: str | None = None
    fallback_enabled: bool = True
    images: List[ImageAttachment] = []
    is_initial_prompt: bool = False


class ActResponse(BaseModel):
    session_id: str
    conversation_id: str
    status: str
    message: str


async def execute_act_instruction(
    project_id: str,
    instruction: str,
    session_id: str,
    conversation_id: str,
    images: List[ImageAttachment],
    db: Session,
    is_initial_prompt: bool = False
):
    """Execute an ACT instruction - can be called from other modules"""
    try:
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get or create session
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            # Use project's preferred CLI
            cli_type = project.preferred_cli or "claude"
            session = ChatSession(
                id=session_id,
                project_id=project_id,
                status="active",
                cli_type=cli_type,
                instruction=instruction,
                started_at=datetime.utcnow()
            )
            db.add(session)
            db.commit()
        
        # Extract project info to avoid DetachedInstanceError in background task
        project_info = {
            'id': project.id,
            'repo_path': project.repo_path,
            'preferred_cli': project.preferred_cli or "claude",
            'fallback_enabled': project.fallback_enabled if project.fallback_enabled is not None else True,
            'selected_model': project.selected_model
        }
        
        # Execute the task
        return await execute_act_task(
            project_info=project_info,
            session=session,
            instruction=instruction,
            conversation_id=conversation_id,
            images=images,
            db=db,
            cli_preference=None,  # Will use project's preferred CLI
            fallback_enabled=project_info['fallback_enabled'],
            is_initial_prompt=is_initial_prompt
        )
    except Exception as e:
        ui.error(f"Error in execute_act_instruction: {e}", "ACT")
        raise

async def execute_chat_task(
    project_info: dict,
    session: ChatSession,
    instruction: str,
    conversation_id: str,
    images: List[ImageAttachment],
    db: Session,
    cli_preference: CLIType = None,
    fallback_enabled: bool = True,
    is_initial_prompt: bool = False
):
    """Background task for executing Chat instructions"""
    try:
        # Extract project info from dict (to avoid DetachedInstanceError)
        project_id = project_info['id']
        project_repo_path = project_info['repo_path']
        project_preferred_cli = project_info['preferred_cli']
        project_fallback_enabled = project_info['fallback_enabled']
        project_selected_model = project_info['selected_model']
        
        # Use project's CLI preference if not explicitly provided
        if cli_preference is None:
            try:
                cli_preference = CLIType(project_preferred_cli)
            except ValueError:
                ui.warning(f"Unknown CLI type '{project_preferred_cli}', falling back to Claude", "CHAT")
                cli_preference = CLIType.CLAUDE
        
        ui.info(f"Using {cli_preference.value} with {project_selected_model or 'default model'}", "CHAT")
        
        # Update session status to running
        session.status = "running"
        db.commit()
        
        # Send chat_start event to trigger loading indicator
        await manager.broadcast_to_project(project_id, {
            "type": "chat_start",
            "data": {
                "session_id": session.id,
                "instruction": instruction
            }
        })
        
        # Initialize CLI manager
        cli_manager = UnifiedCLIManager(
            project_id=project_id,
            project_path=project_repo_path,
            session_id=session.id,
            conversation_id=conversation_id,
            db=db
        )
        
        # Qwen Coder does not support images yet; drop them to prevent errors
        safe_images = [] if cli_preference == CLIType.QWEN else images

        result = await cli_manager.execute_instruction(
            instruction=instruction,
            cli_type=cli_preference,
            fallback_enabled=project_fallback_enabled,
            images=safe_images,
            model=project_selected_model,
            is_initial_prompt=is_initial_prompt
        )
        
        
        # Handle result
        if result and result.get("success"):
            # For chat mode, we don't commit changes - just update session status
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            
        else:
            # Error message
            error_msg = Message(
                id=str(uuid.uuid4()),
                project_id=project_id,
                role="assistant",
                message_type="error",
                content=result.get("error", "Failed to execute chat instruction") if result else "No CLI available",
                metadata_json={
                    "type": "chat_error",
                    "cli_attempted": cli_preference.value
                },
                conversation_id=conversation_id,
                session_id=session.id,
                created_at=datetime.utcnow()
            )
            db.add(error_msg)
            
            session.status = "failed"
            session.error = result.get("error") if result else "No CLI available"
            session.completed_at = datetime.utcnow()
            
            # Send error message via WebSocket
            error_data = {
                "id": error_msg.id,
                "role": "assistant",
                "message_type": "error",
                "content": error_msg.content,
                "metadata": error_msg.metadata_json,
                "parent_message_id": None,
                "session_id": session.id,
                "conversation_id": conversation_id
            }
            await manager.broadcast_to_project(project_id, {
                "type": "message",
                "data": error_data,
                "timestamp": error_msg.created_at.isoformat()
            })
        
        db.commit()
        
        # Send chat_complete event to clear loading indicator and notify completion
        await manager.broadcast_to_project(project_id, {
            "type": "chat_complete",
            "data": {
                "status": session.status,
                "session_id": session.id
            }
        })
        
    except Exception as e:
        ui.error(f"Chat execution error: {e}", "CHAT")
        
        # Save error
        session.status = "failed"
        session.error = str(e)
        session.completed_at = datetime.utcnow()
        
        error_msg = Message(
            id=str(uuid.uuid4()),
            project_id=project_id,
            role="assistant",
            message_type="error",
            content=f"Chat execution failed: {str(e)}",
            metadata_json={"type": "chat_error"},
            conversation_id=conversation_id,
            session_id=session.id,
            created_at=datetime.utcnow()
        )
        db.add(error_msg)
        db.commit()
        
        # Send chat_complete event even on failure to clear loading indicator
        await manager.broadcast_to_project(project_id, {
            "type": "chat_complete",
            "data": {
                "status": "failed",
                "session_id": session.id,
                "error": str(e)
            }
        })


async def execute_act_task(
    project_info: dict,
    session: ChatSession,
    instruction: str,
    conversation_id: str,
    images: List[ImageAttachment],
    db: Session,
    cli_preference: CLIType = None,
    fallback_enabled: bool = True,
    is_initial_prompt: bool = False,
    request_id: str = None
):
    """Background task for executing Act instructions"""
    try:
        # Extract project info from dict (to avoid DetachedInstanceError)
        project_id = project_info['id']
        project_repo_path = project_info['repo_path']
        project_preferred_cli = project_info['preferred_cli']
        project_fallback_enabled = project_info['fallback_enabled']
        project_selected_model = project_info['selected_model']
        
        # Use project's CLI preference if not explicitly provided
        if cli_preference is None:
            try:
                cli_preference = CLIType(project_preferred_cli)
            except ValueError:
                ui.warning(f"Unknown CLI type '{project_preferred_cli}', falling back to Claude", "ACT")
                cli_preference = CLIType.CLAUDE
        
        ui.info(f"Using {cli_preference.value} with {project_selected_model or 'default model'}", "ACT")
        
        # Update session status to running
        session.status = "running"
        
        # ★ NEW: Update UserRequest status to started
        if request_id:
            user_request = db.query(UserRequest).filter(UserRequest.id == request_id).first()
            if user_request:
                user_request.started_at = datetime.utcnow()
                user_request.cli_type_used = cli_preference.value
                user_request.model_used = project_selected_model
        
        db.commit()
        
        # Send act_start event to trigger loading indicator
        await manager.broadcast_to_project(project_id, {
            "type": "act_start",
            "data": {
                "session_id": session.id,
                "instruction": instruction,
                "request_id": request_id
            }
        })
        
        # Initialize CLI manager
        cli_manager = UnifiedCLIManager(
            project_id=project_id,
            project_path=project_repo_path,
            session_id=session.id,
            conversation_id=conversation_id,
            db=db
        )
        
        # Qwen Coder does not support images yet; drop them to prevent errors
        safe_images = [] if cli_preference == CLIType.QWEN else images

        result = await cli_manager.execute_instruction(
            instruction=instruction,
            cli_type=cli_preference,
            fallback_enabled=project_fallback_enabled,
            images=safe_images,
            model=project_selected_model,
            is_initial_prompt=is_initial_prompt
        )
        
        
        # Handle result
        ui.info(f"Result received: success={result.get('success') if result else None}, cli={result.get('cli_used') if result else None}", "ACT")
        
        if result and result.get("success"):
            # Commit changes if any
            if result.get("has_changes"):
                try:
                    commit_message = f"🤖 {result.get('cli_used', 'AI')}: {instruction[:100]}"
                    commit_result = commit_all(project_repo_path, commit_message)
                    
                    if commit_result["success"]:
                        commit = Commit(
                            id=str(uuid.uuid4()),
                            project_id=project_id,
                            commit_hash=commit_result["commit_hash"],
                            message=commit_message,
                            author="AI Assistant",
                            created_at=datetime.utcnow()
                        )
                        db.add(commit)
                        db.commit()
                        
                        await manager.send_message(project_id, {
                            "type": "commit",
                            "data": {
                                "commit_hash": commit_result["commit_hash"],
                                "message": commit_message,
                                "files_changed": commit_result.get("files_changed", 0)
                            }
                        })
                except Exception as e:
                    ui.warning(f"Commit failed: {e}", "ACT")
            
            # Update session status only (no success message to user)
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            
            # ★ NEW: Mark UserRequest as completed successfully
            if request_id:
                user_request = db.query(UserRequest).filter(UserRequest.id == request_id).first()
                if user_request:
                    user_request.is_completed = True
                    user_request.is_successful = True
                    user_request.completed_at = datetime.utcnow()
                    user_request.result_metadata = {
                        "cli_used": result.get("cli_used"),
                        "has_changes": result.get("has_changes", False),
                        "files_modified": result.get("files_modified", [])
                    }
                    ui.success(f"UserRequest {request_id[:8]}... marked as completed", "ACT")
                else:
                    ui.warning(f"UserRequest {request_id[:8]}... not found for completion", "ACT")
            
        else:
            # Error message
            error_msg = Message(
                id=str(uuid.uuid4()),
                project_id=project_id,
                role="assistant",
                message_type="error",
                content=result.get("error", "Failed to execute instruction") if result else "No CLI available",
                metadata_json={
                    "type": "act_error",
                    "cli_attempted": cli_preference.value
                },
                conversation_id=conversation_id,
                session_id=session.id,
                created_at=datetime.utcnow()
            )
            db.add(error_msg)
            
            session.status = "failed"
            session.error = result.get("error") if result else "No CLI available"
            session.completed_at = datetime.utcnow()
            
            # ★ NEW: Mark UserRequest as completed with failure
            if request_id:
                user_request = db.query(UserRequest).filter(UserRequest.id == request_id).first()
                if user_request:
                    user_request.is_completed = True
                    user_request.is_successful = False
                    user_request.completed_at = datetime.utcnow()
                    user_request.error_message = result.get("error") if result else "No CLI available"
                    ui.warning(f"UserRequest {request_id[:8]}... marked as failed", "ACT")
                else:
                    ui.warning(f"UserRequest {request_id[:8]}... not found for failure marking", "ACT")
            
            # Send error message via WebSocket
            error_data = {
                "id": error_msg.id,
                "role": "assistant",
                "message_type": "error",
                "content": error_msg.content,
                "metadata": error_msg.metadata_json,
                "parent_message_id": None,
                "session_id": session.id,
                "conversation_id": conversation_id
            }
            await manager.broadcast_to_project(project_id, {
                "type": "message",
                "data": error_data,
                "timestamp": error_msg.created_at.isoformat()
            })
        
        try:
            db.commit()
            ui.success(f"Database commit successful for request {request_id[:8] if request_id else 'unknown'}...", "ACT")
        except Exception as commit_error:
            ui.error(f"Database commit failed: {commit_error}", "ACT")
            db.rollback()
            raise
        
        # Send act_complete event to clear loading indicator and notify completion
        await manager.broadcast_to_project(project_id, {
            "type": "act_complete",
            "data": {
                "status": session.status,
                "session_id": session.id,
                "request_id": request_id
            }
        })
        
    except Exception as e:
        ui.error(f"Execution error: {e}", "ACT")
        import traceback
        ui.error(f"Traceback: {traceback.format_exc()}", "ACT")
        
        # Save error
        session.status = "failed"
        session.error = str(e)
        session.completed_at = datetime.utcnow()
        
        # ★ NEW: Mark UserRequest as failed due to exception
        if request_id:
            user_request = db.query(UserRequest).filter(UserRequest.id == request_id).first()
            if user_request:
                user_request.is_completed = True
                user_request.is_successful = False
                user_request.completed_at = datetime.utcnow()
                user_request.error_message = str(e)
        
        error_msg = Message(
            id=str(uuid.uuid4()),
            project_id=project_id,
            role="assistant",
            message_type="error",
            content=f"Execution failed: {str(e)}",
            metadata_json={"type": "act_error"},
            conversation_id=conversation_id,
            session_id=session.id,
            created_at=datetime.utcnow()
        )
        db.add(error_msg)
        db.commit()
        
        # Send act_complete event even on failure to clear loading indicator
        await manager.broadcast_to_project(project_id, {
            "type": "act_complete",
            "data": {
                "status": "failed",
                "session_id": session.id,
                "request_id": request_id,
                "error": str(e)
            }
        })


@router.post("/{project_id}/act", response_model=ActResponse)
async def run_act(
    project_id: str,
    body: ActRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Execute instruction using unified CLI system"""
    ui.info(f"Starting execution: {body.instruction[:50]}...", "ACT")
    ui.info(f"Initial prompt flag: {body.is_initial_prompt}", "ACT")
    
    project = db.get(Project, project_id)
    if not project:
        ui.error(f"Project {project_id} not found", "ACT API")
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Determine CLI preference
    cli_preference = CLIType(body.cli_preference or project.preferred_cli)
    fallback_enabled = body.fallback_enabled if body.fallback_enabled is not None else project.fallback_enabled
    conversation_id = body.conversation_id or str(uuid.uuid4())
    
    # 🔍 DEBUG: Log incoming request data
    print(f"📥 ACT Request - Project: {project_id}")
    print(f"📥 Instruction: {body.instruction[:100]}...")
    print(f"📥 Images count: {len(body.images)}")
    print(f"📥 Images data: {body.images}")
    for i, img in enumerate(body.images):
        print(f"📥 Image {i+1}: {img}")
        if hasattr(img, '__dict__'):
            print(f"📥 Image {i+1} dict: {img.__dict__}")
    
    # Extract image paths and build attachments for metadata/WS
    image_paths = []
    attachments = []
    import os as _os
    
    print(f"🔍 Processing {len(body.images)} images...")
    for i, img in enumerate(body.images):
        print(f"🔍 Processing image {i+1}: {img}")
        
        img_dict = img if isinstance(img, dict) else img.__dict__ if hasattr(img, '__dict__') else {}
        print(f"🔍 Image {i+1} converted to dict: {img_dict}")
        
        p = img_dict.get('path')
        n = img_dict.get('name')
        print(f"🔍 Image {i+1} - path: {p}, name: {n}")
        
        if p:
            print(f"🔍 Adding path to image_paths: {p}")
            image_paths.append(p)
            try:
                fname = _os.path.basename(p)
                print(f"🔍 Processing path: {p}")
                print(f"🔍 Extracted filename: {fname}")
                if fname and fname.strip():
                    attachment = {
                        "name": n or fname,
                        "url": f"/api/assets/{project_id}/{fname}"
                    }
                    print(f"🔍 Created attachment: {attachment}")
                    attachments.append(attachment)
                else:
                    print(f"❌ Failed to extract filename from: {p}")
            except Exception as e:
                print(f"❌ Exception processing path {p}: {e}")
                pass
        elif n:
            print(f"🔍 Adding name to image_paths: {n}")
            image_paths.append(n)
        else:
            print(f"❌ Image {i+1} has neither path nor name!")
    
    print(f"🔍 Final image_paths: {image_paths}")
    print(f"🔍 Final attachments: {attachments}")
    
    # Save user instruction as message (with image paths in content for display)
    message_content = body.instruction
    if image_paths:
        image_refs = [f"Image #{i+1} path: {path}" for i, path in enumerate(image_paths)]
        message_content = f"{body.instruction}\n\n{chr(10).join(image_refs)}"
    
    user_message = Message(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="user",
        message_type="chat",
        content=message_content,
        metadata_json={
            "type": "act_instruction",
            "cli_preference": cli_preference.value,
            "fallback_enabled": fallback_enabled,
            "has_images": len(body.images) > 0,
            "image_paths": image_paths,
            "attachments": attachments
        },
        conversation_id=conversation_id,
        created_at=datetime.utcnow()
    )
    db.add(user_message)
    
    # Create session
    session = ChatSession(
        id=str(uuid.uuid4()),
        project_id=project_id,
        status="active",
        instruction=body.instruction,
        cli_type=cli_preference.value,
        started_at=datetime.utcnow()
    )
    db.add(session)
    
    # ★ NEW: Create UserRequest for tracking
    request_id = str(uuid.uuid4())
    user_request = UserRequest(
        id=request_id,
        project_id=project_id,
        user_message_id=user_message.id,
        session_id=session.id,
        instruction=body.instruction,
        request_type="act",
        created_at=datetime.utcnow()
    )
    db.add(user_request)
    
    try:
        db.commit()
    except Exception as e:
        ui.error(f"Database commit failed: {e}", "ACT API")
        raise
    
    # Send initial messages
    try:
        await manager.send_message(project_id, {
            "type": "message",
            "data": {
                "id": user_message.id,
                "role": "user",
                "message_type": "chat",
                "content": message_content,
                "metadata_json": user_message.metadata_json,
                "parent_message_id": None,
                "session_id": session.id,
                "conversation_id": conversation_id,
                "request_id": request_id,
                "created_at": user_message.created_at.isoformat()
            },
            "timestamp": user_message.created_at.isoformat()
        })
    except Exception as e:
        ui.error(f"WebSocket failed: {e}", "ACT API")
    
    # Extract project info to avoid DetachedInstanceError in background task
    project_info = {
        'id': project.id,
        'repo_path': project.repo_path,
        'preferred_cli': project.preferred_cli or "claude",
        'fallback_enabled': project.fallback_enabled if project.fallback_enabled is not None else True,
        'selected_model': project.selected_model
    }
    
    # Add background task
    background_tasks.add_task(
        execute_act_task,
        project_info,
        session,
        body.instruction,
        conversation_id,
        body.images,
        db,
        cli_preference,
        fallback_enabled,
        body.is_initial_prompt,
        request_id
    )
    return ActResponse(
        session_id=session.id,
        conversation_id=conversation_id,
        status="running",
        message="Act execution started"
    )


@router.post("/{project_id}/chat", response_model=ActResponse)
async def run_chat(
    project_id: str,
    body: ActRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Execute chat instruction using unified CLI system (same as act but different event type)"""
    ui.info(f"Starting chat: {body.instruction[:50]}...", "CHAT")
    
    project = db.get(Project, project_id)
    if not project:
        ui.error(f"Project {project_id} not found", "CHAT API")
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Determine CLI preference
    cli_preference = CLIType(body.cli_preference or project.preferred_cli)
    fallback_enabled = body.fallback_enabled if body.fallback_enabled is not None else project.fallback_enabled
    conversation_id = body.conversation_id or str(uuid.uuid4())
    
    # Extract image paths and build attachments for metadata/WS
    image_paths = []
    attachments = []
    import os as _os2
    for img in body.images:
        img_dict = img if isinstance(img, dict) else img.__dict__ if hasattr(img, '__dict__') else {}
        p = img_dict.get('path')
        n = img_dict.get('name')
        if p:
            image_paths.append(p)
            try:
                fname = _os2.path.basename(p)
                print(f"🔍 [CHAT] Processing path: {p}")
                print(f"🔍 [CHAT] Extracted filename: {fname}")
                if fname and fname.strip():
                    attachment = {
                        "name": n or fname,
                        "url": f"/api/assets/{project_id}/{fname}"
                    }
                    print(f"🔍 [CHAT] Created attachment: {attachment}")
                    attachments.append(attachment)
                else:
                    print(f"❌ [CHAT] Failed to extract filename from: {p}")
            except Exception as e:
                print(f"❌ [CHAT] Exception processing path {p}: {e}")
                pass
        elif n:
            image_paths.append(n)
    
    # Save user instruction as message (with image paths in content for display)
    message_content = body.instruction
    if image_paths:
        image_refs = [f"Image #{i+1} path: {path}" for i, path in enumerate(image_paths)]
        message_content = f"{body.instruction}\n\n{chr(10).join(image_refs)}"
    
    user_message = Message(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="user",
        message_type="chat",
        content=message_content,
        metadata_json={
            "type": "chat_instruction",
            "cli_preference": cli_preference.value,
            "fallback_enabled": fallback_enabled,
            "has_images": len(body.images) > 0,
            "image_paths": image_paths,
            "attachments": attachments
        },
        conversation_id=conversation_id,
        created_at=datetime.utcnow()
    )
    db.add(user_message)
    
    # Create session
    session = ChatSession(
        id=str(uuid.uuid4()),
        project_id=project_id,
        status="active",
        instruction=body.instruction,
        cli_type=cli_preference.value,
        started_at=datetime.utcnow()
    )
    db.add(session)
    
    try:
        db.commit()
    except Exception as e:
        ui.error(f"Database commit failed: {e}", "CHAT API")
        raise
    
    # Send initial messages
    try:
        await manager.send_message(project_id, {
            "type": "message",
            "data": {
                "id": user_message.id,
                "role": "user",
                "message_type": "chat",
                "content": message_content,
                "metadata_json": user_message.metadata_json,
                "parent_message_id": None,
                "session_id": session.id,
                "conversation_id": conversation_id,
                "created_at": user_message.created_at.isoformat()
            },
            "timestamp": user_message.created_at.isoformat()
        })
    except Exception as e:
        ui.error(f"WebSocket failed: {e}", "CHAT API")
    
    # Extract project info to avoid DetachedInstanceError in background task
    project_info = {
        'id': project.id,
        'repo_path': project.repo_path,
        'preferred_cli': project.preferred_cli or "claude",
        'fallback_enabled': project.fallback_enabled if project.fallback_enabled is not None else True,
        'selected_model': project.selected_model
    }
    
    # Add background task for chat (same as act but with different event type)
    background_tasks.add_task(
        execute_chat_task,
        project_info,
        session,
        body.instruction,
        conversation_id,
        body.images,
        db,
        cli_preference,
        fallback_enabled,
        body.is_initial_prompt
    )
    
    return ActResponse(
        session_id=session.id,
        conversation_id=conversation_id,
        status="running",
        message="Chat execution started"
    )
