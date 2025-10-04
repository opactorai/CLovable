import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/database';
import APIService from '@/lib/api-service';

const db = DatabaseService.getInstance();
const apiService = APIService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const apiKeys = await db.getAPIKeys();
    return NextResponse.json(apiKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service_type, key_name, api_key, is_active = true } = body;

    if (!service_type || !key_name || !api_key) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Test the API key before saving
    let testResult: { success: boolean; error?: string; details?: any } = { success: false, error: 'Unknown error' };
    
    if (service_type === 'openai') {
      testResult = await apiService.testOpenAI(api_key);
    } else if (service_type === 'anthropic') {
      testResult = await apiService.testAnthropic(api_key);
    } else if (service_type === 'github') {
      testResult = await apiService.testGitHub(api_key);
    }

    if (!testResult.success) {
      return NextResponse.json(
        { 
          error: `API key validation failed: ${testResult.error}`,
          details: testResult
        },
        { status: 400 }
      );
    }

    // Save the API key
    const tokenId = await db.saveAPIKey({
      provider: service_type,
      name: key_name,
      is_active,
      encrypted_key: api_key, // In production, encrypt this
    });

    return NextResponse.json({
      success: true,
      message: 'API key saved and validated successfully',
      token_id: tokenId,
      test_result: testResult
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    return NextResponse.json(
      { error: 'Failed to save API key' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, is_active, name } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const success = await db.updateAPIKey(id, { is_active, name });
    
    if (!success) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully'
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const success = await db.deleteAPIKey(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}