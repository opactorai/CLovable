import { NextRequest, NextResponse } from 'next/server';
import APIService from '@/lib/api-service';
import DatabaseService from '@/lib/database';

const apiService = APIService.getInstance();
const db = DatabaseService.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, provider = 'openai', api_key, model } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get API key from request or environment
    let key = api_key;
    if (!key) {
      // Try to get from saved API keys
      const apiKeys = await db.getAPIKeys();
      const activeKey = apiKeys.find(k => 
        k.provider === provider && 
        k.is_active && 
        k.encrypted_key
      );
      
      if (activeKey) {
        key = activeKey.encrypted_key;
        // Increment usage count
        await db.incrementUsageCount(activeKey.id);
      } else {
        // Fall back to environment variable
        key = process.env[`${provider.toUpperCase()}_API_KEY`];
      }
    }

    if (!key) {
      return NextResponse.json(
        { error: `No API key found for ${provider}. Please add one in API Keys management.` },
        { status: 400 }
      );
    }

    // Send message to AI provider
    const result = await apiService.sendAIMessage(provider, message, key);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: `AI request failed: ${result.error}`,
          details: result
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response: result.response,
      provider,
      model: model || 'default',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in AI chat:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}