"""
Token usage tracking service
Tracks real token usage across conversations
"""
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.models.sessions import Session as ChatSession
from app.models.messages import Message
from app.core.terminal_ui import ui


class TokenTracker:
    """Tracks token usage for conversations"""

    @staticmethod
    def update_session_tokens(
        session_id: str,
        input_tokens: int,
        output_tokens: int,
        db: Session
    ):
        """Update token usage for a session"""
        try:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if session:
                # Add to existing totals (cumulative)
                current_input = getattr(session, 'input_tokens', 0) or 0
                current_output = getattr(session, 'output_tokens', 0) or 0

                session.input_tokens = current_input + input_tokens
                session.output_tokens = current_output + output_tokens

                # Calculate cost (rough estimate based on Sonnet 4 pricing)
                cost = (input_tokens * 0.000003) + (output_tokens * 0.000015)
                current_cost = getattr(session, 'total_cost', 0) or 0
                session.total_cost = current_cost + cost

                db.commit()

                ui.info(f"Updated session tokens: +{input_tokens}in/+{output_tokens}out (total: {session.input_tokens}in/{session.output_tokens}out)", "TokenTracker")

        except Exception as e:
            ui.error(f"Failed to update session tokens: {e}", "TokenTracker")

    @staticmethod
    def get_conversation_totals(conversation_id: str, db: Session) -> Dict[str, Any]:
        """Get total token usage for a conversation"""
        try:
            # Get all sessions for this conversation
            sessions = db.query(ChatSession).filter(
                ChatSession.conversation_id == conversation_id
            ).all()

            total_input = sum(getattr(s, 'input_tokens', 0) or 0 for s in sessions)
            total_output = sum(getattr(s, 'output_tokens', 0) or 0 for s in sessions)
            total_cost = sum(getattr(s, 'total_cost', 0) or 0 for s in sessions)

            return {
                "input_tokens": total_input,
                "output_tokens": total_output,
                "total_tokens": total_input + total_output,
                "total_cost": total_cost,
                "session_count": len(sessions)
            }

        except Exception as e:
            ui.error(f"Failed to get conversation totals: {e}", "TokenTracker")
            return {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "total_cost": 0,
                "session_count": 0
            }

    @staticmethod
    def get_real_context_size(conversation_id: str, db: Session) -> int:
        """Calculate the real context size being sent to the model"""
        try:
            # Get all messages in the conversation
            messages = db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at).all()

            total_chars = 0

            # Count system prompt (estimate based on typical size)
            total_chars += 25000  # Typical Claude Code system prompt size

            # Count all message content
            for message in messages:
                if message.content:
                    total_chars += len(message.content)

            # Convert characters to approximate tokens (rough: 1 token ≈ 4 characters)
            estimated_tokens = total_chars // 4

            return estimated_tokens

        except Exception as e:
            ui.error(f"Failed to calculate context size: {e}", "TokenTracker")
            return 0


# Global token tracker instance
token_tracker = TokenTracker()