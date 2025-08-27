from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
import base64
import uuid
from app.api.deps import get_db
from app.core.config import settings
from app.models.projects import Project as ProjectModel
from app.services.assets import write_bytes

router = APIRouter(prefix="/api/assets", tags=["assets"]) 


class LogoRequest(BaseModel):
    b64_png: str  # Accept base64-encoded PNG (fallback if no OpenAI key)


@router.post("/{project_id}/logo")
async def upload_logo(project_id: str, body: LogoRequest, db: Session = Depends(get_db)):
    row = db.get(ProjectModel, project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    project_assets = os.path.join(settings.projects_root, project_id, "assets")
    data = base64.b64decode(body.b64_png)
    logo_path = os.path.join(project_assets, "logo.png")
    write_bytes(logo_path, data)
    return {"path": f"assets/logo.png"}


@router.get("/{project_id}/{filename}")
async def get_image(project_id: str, filename: str, db: Session = Depends(get_db)):
    """Get an image file from project assets directory"""
    from fastapi.responses import FileResponse
    
    # Verify project exists
    row = db.get(ProjectModel, project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Build file path
    file_path = os.path.join(settings.projects_root, project_id, "assets", filename)
    
    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Return the image file
    return FileResponse(file_path)


@router.post("/{project_id}/upload")
async def upload_image(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload an image file to project assets directory"""
    print(f"📤 Image upload request: project_id={project_id}, filename={file.filename}")
    
    # Verify project exists
    row = db.get(ProjectModel, project_id)
    if not row:
        print(f"❌ Project not found: {project_id}")
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if file is an image
    print(f"📁 File info: content_type={file.content_type}, size={file.size}")
    if not file.content_type or not file.content_type.startswith('image/'):
        print(f"❌ Invalid file type: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Create assets directory if it doesn't exist
    project_assets = os.path.join(settings.projects_root, project_id, "assets")
    print(f"📁 Assets directory: {project_assets}")
    os.makedirs(project_assets, exist_ok=True)
    
    # Generate unique filename to avoid conflicts
    file_extension = os.path.splitext(file.filename or 'image.png')[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(project_assets, unique_filename)
    print(f"💾 Saving to: {file_path}")
    
    try:
        # Save file
        content = await file.read()
        write_bytes(file_path, content)
        print(f"✅ File saved successfully: {len(content)} bytes")
        
        return {
            "path": f"assets/{unique_filename}",
            "absolute_path": file_path,
            "filename": unique_filename,
            "original_filename": file.filename
        }
    except Exception as e:
        print(f"❌ Failed to save file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
