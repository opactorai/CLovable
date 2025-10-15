"""
Claude conversation folder reader
Reads conversation logs from ~/.claude folders
"""
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def parse_project_path(folder_name: str) -> str:
    """Convert folder name like '-Users-jkneen-Documents-GitHub-flows-Claudable' to readable path"""
    # Remove leading dash and replace dashes with slashes
    if folder_name.startswith('-'):
        folder_name = folder_name[1:]
    return '/' + folder_name.replace('-', '/')


def read_jsonl_summary(file_path: Path) -> Optional[Dict[str, Any]]:
    """Read first few lines of JSONL to get conversation summary"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = []
            for i, line in enumerate(f):
                if i >= 3:  # Read first 3 lines max
                    break
                try:
                    lines.append(json.loads(line.strip()))
                except json.JSONDecodeError:
                    continue

            if not lines:
                return None

            # Extract summary and first message
            summary = None
            first_message = None
            timestamp = None

            for entry in lines:
                if entry.get('type') == 'summary':
                    summary = entry.get('summary', 'No summary')
                elif entry.get('type') == 'user' and not first_message:
                    msg = entry.get('message', {})
                    if isinstance(msg, dict):
                        first_message = msg.get('content', '')
                    timestamp = entry.get('timestamp')

            return {
                'summary': summary or 'No summary',
                'first_message': first_message or '',
                'timestamp': timestamp,
                'file_name': file_path.stem
            }
    except Exception as e:
        logger.error(f"Error reading {file_path}: {e}")
        return None


@router.get("/claude-conversations")
async def get_claude_conversations():
    """Get all Claude conversations from ~/.claude folders"""
    conversations = {
        'user': [],  # Global conversations from ~/.claude
        'project': []  # Project-specific conversations (if any)
    }

    home_dir = Path.home()

    # Read global conversations from ~/.claude/projects
    global_projects_dir = home_dir / '.claude' / 'projects'
    if global_projects_dir.exists():
        for project_folder in global_projects_dir.iterdir():
            if project_folder.is_dir():
                project_path = parse_project_path(project_folder.name)
                project_conversations = []

                # Read all JSONL files in this project folder
                for jsonl_file in project_folder.glob('*.jsonl'):
                    conv_data = read_jsonl_summary(jsonl_file)
                    if conv_data:
                        conv_data['id'] = jsonl_file.stem
                        conv_data['project_path'] = project_path
                        project_conversations.append(conv_data)

                if project_conversations:
                    # Sort by timestamp (newest first)
                    project_conversations.sort(
                        key=lambda x: x.get('timestamp') or '',
                        reverse=True
                    )

                    conversations['user'].append({
                        'project_path': project_path,
                        'project_name': Path(project_path).name,
                        'conversations': project_conversations[:10]  # Limit to 10 most recent per project
                    })

    # Sort projects by most recent conversation
    conversations['user'].sort(
        key=lambda x: x['conversations'][0]['timestamp'] if x['conversations'] and x['conversations'][0].get('timestamp') else '',
        reverse=True
    )

    # Check current working directory for .claude folder (project-specific)
    cwd = Path.cwd()
    local_claude = cwd / '.claude'
    if local_claude.exists():
        # For now, just note that it exists
        # Project-specific conversations might be stored differently
        conversations['project'] = [{
            'project_path': str(cwd),
            'project_name': cwd.name,
            'conversations': []
        }]

    return conversations


@router.get("/claude-conversations/{conversation_id}")
async def get_conversation_details(conversation_id: str):
    """Get full conversation details by ID"""
    home_dir = Path.home()
    global_projects_dir = home_dir / '.claude' / 'projects'

    # Search for the conversation file
    for project_folder in global_projects_dir.iterdir():
        if project_folder.is_dir():
            jsonl_file = project_folder / f"{conversation_id}.jsonl"
            if jsonl_file.exists():
                messages = []
                try:
                    with open(jsonl_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            try:
                                entry = json.loads(line.strip())
                                if entry.get('type') in ['user', 'assistant']:
                                    messages.append(entry)
                            except json.JSONDecodeError:
                                continue

                    return {
                        'id': conversation_id,
                        'project_path': parse_project_path(project_folder.name),
                        'messages': messages
                    }
                except Exception as e:
                    raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=404, detail="Conversation not found")