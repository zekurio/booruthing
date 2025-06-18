import { NextRequest, NextResponse } from 'next/server';

// Simple heuristics for tag categorization based on common patterns
function guessTagType(tag: string): string {
  // Remove any existing prefixes
  const cleanTag = tag.replace(/^(character:|artist:|copyright:|char:|copy:|art:|meta:)/, '');
  
  // Common patterns for different tag types
  if (tag.includes('_(') && tag.includes(')')) {
    // Tags like "character_name_(series)" are usually characters
    return 'character';
  }
  
  // Common meta tags
  const metaTags = ['highres', 'absurdres', 'translated', 'commentary', 'english_commentary', 
                    'source_request', 'md5_mismatch', 'duplicate', 'animated', 'video', 'sound',
                    'webm', 'mp4', '3d', '2d', 'has_audio', 'loop', 'pixel_art'];
  if (metaTags.includes(cleanTag)) {
    return 'meta';
  }
  
  // Tags ending with common artist suffixes
  if (tag.match(/_(artist|style)$/)) {
    return 'artist';
  }
  
  // Common copyright/series patterns
  const copyrightPatterns = ['pokemon', 'nintendo', 'disney', 'marvel', 'dc_comics', 'anime', 
                             'game', 'series', 'movie', 'cartoon'];
  if (copyrightPatterns.some(pattern => cleanTag.includes(pattern))) {
    return 'copyright';
  }
  
  // Default to general
  return 'general';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const names = searchParams.get('names');
  
  if (!names) {
    return NextResponse.json({ error: 'Names parameter is required' }, { status: 400 });
  }

  try {
    const tagNames = names.split(' ').filter(Boolean);
    const tagMap: { [key: string]: { name: string; types: string[]; posts: string } } = {};
    
    // First try the r34-json API
    let useHeuristics = false;
    try {
      const response = await fetch(
        `https://r34-json.herokuapp.com/tags?name=${encodeURIComponent(tagNames.join(' '))}`,
        {
          signal: AbortSignal.timeout(5000), // 5 second timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TagFetcher/1.0)',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          data.forEach((tag: any) => {
            if (tagNames.includes(tag.name)) {
              tagMap[tag.name] = {
                name: tag.name,
                types: tag.types || ['general'],
                posts: tag.posts || '0'
              };
            }
          });
        }
      } else {
        useHeuristics = true;
      }
    } catch (error) {
      console.log('r34-json API failed, using heuristics:', error);
      useHeuristics = true;
    }
    
    // For any tags not found, use heuristics
    tagNames.forEach((tagName) => {
      if (!tagMap[tagName]) {
        tagMap[tagName] = {
          name: tagName,
          types: [guessTagType(tagName)],
          posts: '0'
        };
      }
    });

    return NextResponse.json(tagMap);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tag information' },
      { status: 502 }
    );
  }
} 