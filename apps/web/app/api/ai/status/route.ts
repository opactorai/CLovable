import { NextRequest, NextResponse } from 'next/server';
import APIService from '@/lib/api-service';

const apiService = APIService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const status = await apiService.getAIConnectivityStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching AI status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI status' },
      { status: 500 }
    );
  }
}