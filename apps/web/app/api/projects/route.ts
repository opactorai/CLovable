import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/database';

const db = DatabaseService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const projects = await db.getProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, status = 'active', api_keys = [] } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const projectId = await db.saveProject({
      name,
      description: description || '',
      status,
      api_keys,
    });

    return NextResponse.json({
      success: true,
      message: 'Project created successfully',
      project_id: projectId
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}