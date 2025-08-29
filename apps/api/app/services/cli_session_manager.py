"""
CLI Session Manager for Multi-CLI Support
Handles session persistence and continuity across different CLI agents
"""
from typing import Dict, Optional, Any
from sqlalchemy.orm import Session
from app.models.projects import Project
from app.services.cli.base import CLIType


class CLISessionManager:
    """Manages CLI sessions across different AI agents"""
    
    def __init__(self, db: Session):
        self.db = db
        self._session_cache: Dict[str, Dict[CLIType, str]] = {}
    
    def get_session_id(self, project_id: str, cli_type: CLIType) -> Optional[str]:
        """Get existing session ID for a project and CLI type"""
        # Check cache first
        if project_id in self._session_cache:
            cached_session = self._session_cache[project_id].get(cli_type)
            if cached_session:
                return cached_session
        
        # Get from database
        project = self.db.get(Project, project_id)
        if not project:
            return None
        
        session_mapping = {
            CLIType.CLAUDE: project.active_claude_session_id,
            CLIType.CURSOR: project.active_cursor_session_id
        }
        
        session_id = session_mapping.get(cli_type)
        
        # Update cache
        if project_id not in self._session_cache:
            self._session_cache[project_id] = {}
        self._session_cache[project_id][cli_type] = session_id
        
        return session_id
    
    def set_session_id(self, project_id: str, cli_type: CLIType, session_id: str) -> bool:
        """Set session ID for a project and CLI type"""
        project = self.db.get(Project, project_id)
        if not project:
            return False
        
        # Update database
        update_mapping = {
            CLIType.CLAUDE: {"active_claude_session_id": session_id},
            CLIType.CURSOR: {"active_cursor_session_id": session_id}
        }
        
        update_data = update_mapping.get(cli_type)
        if not update_data:
            return False
        
        # Update project record
        for field, value in update_data.items():
            setattr(project, field, value)
        
        self.db.commit()
        
        # Update cache
        if project_id not in self._session_cache:
            self._session_cache[project_id] = {}
        self._session_cache[project_id][cli_type] = session_id
        
        from app.core.terminal_ui import ui
        ui.success(f"Set {cli_type.value} session ID for project {project_id}: {session_id}", "Session")
        return True
    
    def get_all_sessions(self, project_id: str) -> Dict[str, Optional[str]]:
        """Get all CLI session IDs for a project"""
        project = self.db.get(Project, project_id)
        if not project:
            return {}
        
        return {
            "claude": project.active_claude_session_id,
            "cursor": project.active_cursor_session_id
        }
    
    def clear_session_id(self, project_id: str, cli_type: CLIType) -> bool:
        """Clear session ID for a project and CLI type"""
        return self.set_session_id(project_id, cli_type, None)
    
    def clear_all_sessions(self, project_id: str) -> bool:
        """Clear all CLI session IDs for a project"""
        project = self.db.get(Project, project_id)
        if not project:
            return False
        
        project.active_claude_session_id = None
        project.active_cursor_session_id = None
        
        self.db.commit()
        
        # Clear cache
        if project_id in self._session_cache:
            del self._session_cache[project_id]
        
        from app.core.terminal_ui import ui
        ui.info(f"Cleared all CLI sessions for project {project_id}", "Session")
        return True
    
    def get_session_stats(self, project_id: str) -> Dict[str, Any]:
        """Get session statistics for a project"""
        from app.models.sessions import Session as ChatSession
        from sqlalchemy import func
        
        # Get session counts by CLI type
        session_stats = self.db.query(
            ChatSession.cli_type,
            func.count(ChatSession.id).label('count'),
            func.avg(ChatSession.duration_ms).label('avg_duration_ms'),
            func.sum(ChatSession.total_messages).label('total_messages'),
            func.max(ChatSession.started_at).label('last_used')
        ).filter(
            ChatSession.project_id == project_id
        ).group_by(ChatSession.cli_type).all()
        
        stats = {}
        for stat in session_stats:
            stats[stat.cli_type] = {
                "session_count": stat.count,
                "avg_duration_ms": int(stat.avg_duration_ms) if stat.avg_duration_ms else 0,
                "total_messages": stat.total_messages or 0,
                "last_used": stat.last_used.isoformat() if stat.last_used else None,
                "active_session_id": self.get_session_id(project_id, CLIType(stat.cli_type))
            }
        
        return stats
    
    def get_preferred_cli(self, project_id: str) -> Optional[CLIType]:
        """Get preferred CLI for a project"""
        project = self.db.get(Project, project_id)
        if not project:
            return None
        
        try:
            return CLIType(project.preferred_cli)
        except ValueError:
            return CLIType.CLAUDE  # Default fallback
    
    def set_preferred_cli(self, project_id: str, cli_type: CLIType, fallback_enabled: bool = True) -> bool:
        """Set preferred CLI for a project"""
        project = self.db.get(Project, project_id)
        if not project:
            return False
        
        project.preferred_cli = cli_type.value
        project.fallback_enabled = fallback_enabled
        self.db.commit()
        
        print(f"✅ [Session] Set preferred CLI for project {project_id}: {cli_type.value} (fallback: {fallback_enabled})")
        return True
    
    def is_fallback_enabled(self, project_id: str) -> bool:
        """Check if fallback is enabled for a project"""
        project = self.db.get(Project, project_id)
        if not project:
            return True  # Default to enabled
        
        return project.fallback_enabled
    
    def migrate_legacy_sessions(self, project_id: str) -> Dict[str, int]:
        """Migrate legacy Claude-only sessions to new CLI system"""
        from app.models.sessions import Session as ChatSession
        
        # Update sessions without cli_type
        updated_sessions = self.db.query(ChatSession).filter(
            ChatSession.project_id == project_id,
            ChatSession.cli_type == None
        ).update({"cli_type": CLIType.CLAUDE.value})
        
        # Update messages without cli_source where metadata suggests CLI type
        from app.models.messages import Message
        
        messages_updated = 0
        messages = self.db.query(Message).filter(
            Message.project_id == project_id,
            Message.cli_source == None,
            Message.metadata_json != None
        ).all()
        
        for message in messages:
            if message.metadata_json and "cli_type" in message.metadata_json:
                message.cli_source = message.metadata_json["cli_type"]
                messages_updated += 1
            else:
                message.cli_source = CLIType.CLAUDE.value  # Default to claude
                messages_updated += 1
        
        self.db.commit()
        
        migration_stats = {
            "sessions_updated": updated_sessions,
            "messages_updated": messages_updated
        }
        
        print(f"📊 [Migration] Project {project_id}: {migration_stats}")
        return migration_stats
    
    def cleanup_stale_sessions(self, project_id: str, days_threshold: int = 30) -> int:
        """Clean up old/stale CLI session IDs"""
        from datetime import datetime, timedelta
        from app.models.sessions import Session as ChatSession
        
        cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)
        
        # Find sessions that haven't been used recently
        stale_sessions = self.db.query(ChatSession).filter(
            ChatSession.project_id == project_id,
            ChatSession.started_at < cutoff_date,
            ChatSession.status.in_(["completed", "failed"])
        ).all()
        
        # Clear session IDs for stale sessions
        cleared_count = 0
        for session in stale_sessions:
            if session.cli_type:
                try:
                    cli_type = CLIType(session.cli_type)
                    current_session_id = self.get_session_id(project_id, cli_type)
                    
                    # Only clear if it matches the stale session's claude_session_id
                    if current_session_id == session.claude_session_id:
                        self.clear_session_id(project_id, cli_type)
                        cleared_count += 1
                        
                except ValueError:
                    continue
        
        from app.core.terminal_ui import ui
        ui.info(f"Project {project_id}: Cleared {cleared_count} stale session IDs", "Cleanup")
        return cleared_count
