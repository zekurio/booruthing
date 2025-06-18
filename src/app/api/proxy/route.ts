import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Decode the URL
    const decodedUrl = decodeURIComponent(url);
    
    // Validate it's a rule34 URL
    const urlObj = new URL(decodedUrl);
    if (!urlObj.hostname.includes('rule34.xxx')) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 403 });
    }

    // Fetch the media with appropriate headers
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://rule34.xxx/',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Range': request.headers.get('range') || '',
      },
    });

    // Get content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const acceptRanges = response.headers.get('accept-ranges');
    const contentRange = response.headers.get('content-range');

    // Create response headers
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });

    if (contentLength) headers.set('Content-Length', contentLength);
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);
    if (contentRange) headers.set('Content-Range', contentRange);

    // Handle range requests for video streaming
    const status = response.status === 206 ? 206 : 200;

    // Stream the response
    return new NextResponse(response.body, {
      status,
      headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy media' },
      { status: 502 }
    );
  }
} 