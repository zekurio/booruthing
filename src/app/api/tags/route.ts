import { type NextRequest, NextResponse } from "next/server";

// Simple heuristics for tag categorization based on common patterns
function guessTagType(tag: string): string {
	// Remove any existing prefixes
	const cleanTag = tag.replace(
		/^(character:|artist:|copyright:|char:|copy:|art:|meta:)/,
		"",
	);

	// Common patterns for different tag types
	if (tag.includes("_(") && tag.includes(")")) {
		// Tags like "character_name_(series)" are usually characters
		return "character";
	}

	// Common character patterns - check for known character-like names
	const characterPatterns = [
		// Common name suffixes/patterns
		/_strife$/i,
		/_lockhart$/i,
		/_valentine$/i,
		/_fair$/i,
		/_gainsborough$/i,
		// Common character indicators
		/^[a-z]+_[a-z]+$/i, // first_last name pattern
	];
	
	if (characterPatterns.some(pattern => cleanTag.match(pattern))) {
		// Additional check - if it has exactly one underscore, it might be a character name
		const underscoreCount = (cleanTag.match(/_/g) || []).length;
		if (underscoreCount === 1 && !cleanTag.includes("fantasy") && !cleanTag.includes("game")) {
			return "character";
		}
	}

	// Common meta tags
	const metaTags = [
		"highres",
		"absurdres",
		"translated",
		"commentary",
		"english_commentary",
		"source_request",
		"md5_mismatch",
		"duplicate",
		"animated",
		"video",
		"sound",
		"webm",
		"mp4",
		"3d",
		"2d",
		"has_audio",
		"loop",
		"pixel_art",
		"tagme",
	];
	if (metaTags.includes(cleanTag)) {
		return "meta";
	}

	// Artist patterns - common artist tag patterns
	const artistPatterns = [
		/^[a-z0-9]+chan$/i, // ends with "chan"
		/_(artist|style)$/,
		/^[a-z0-9]+[0-9]+$/i, // artist names often have numbers
	];
	
	// Check if it's a single word that could be an artist name
	if (!cleanTag.includes("_") && cleanTag.length > 4 && cleanTag.length < 20) {
		// Single word, reasonable length - could be artist
		if (artistPatterns.some(pattern => cleanTag.match(pattern))) {
			return "artist";
		}
		// Common artist name patterns
		if (/^[a-z]+[0-9]*$/i.test(cleanTag) && !metaTags.includes(cleanTag)) {
			return "artist";
		}
	}

	// Common copyright/series patterns
	const copyrightPatterns = [
		/^final_fantasy/i,
		/pokemon/i,
		/nintendo/i,
		/disney/i,
		/marvel/i,
		/dc_comics/i,
		/_game$/i,
		/_series$/i,
		/_movie$/i,
		/_anime$/i,
		/_(company|copyright)$/i,
	];
	
	if (copyrightPatterns.some((pattern) => cleanTag.match(pattern))) {
		return "copyright";
	}
	
	// Check for series/game titles (often have multiple underscores or specific patterns)
	if (cleanTag.includes("_") && (cleanTag.includes("fantasy") || cleanTag.includes("game") || cleanTag.includes("series"))) {
		return "copyright";
	}

	// Default to general
	return "general";
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const names = searchParams.get("names");

	if (!names) {
		return NextResponse.json(
			{ error: "Names parameter is required" },
			{ status: 400 },
		);
	}

	try {
		const tagNames = names.split(" ").filter(Boolean);
		const tagMap: {
			[key: string]: { name: string; types: string[]; posts: string };
		} = {};

		// First try the r34-json API
		let _useHeuristics = false;
		try {
			const response = await fetch(
				`https://r34-json.herokuapp.com/tags?name=${encodeURIComponent(tagNames.join(" "))}`,
				{
					signal: AbortSignal.timeout(5000), // 5 second timeout
					headers: {
						"User-Agent": "Mozilla/5.0 (compatible; TagFetcher/1.0)",
					},
				},
			);

			if (response.ok) {
				const data = await response.json();
				if (Array.isArray(data)) {
					data.forEach((tag: any) => {
						if (tagNames.includes(tag.name)) {
							tagMap[tag.name] = {
								name: tag.name,
								types: tag.types || ["general"],
								posts: tag.posts || "0",
							};
						}
					});
				}
			} else {
				_useHeuristics = true;
			}
		} catch (error) {
			console.log("r34-json API failed, using heuristics:", error);
			_useHeuristics = true;
		}

		// For any tags not found, use heuristics
		tagNames.forEach((tagName) => {
			if (!tagMap[tagName]) {
				tagMap[tagName] = {
					name: tagName,
					types: [guessTagType(tagName)],
					posts: "0",
				};
			}
		});

		return NextResponse.json(tagMap);
	} catch (error) {
		console.error("Error fetching tags:", error);
		return NextResponse.json(
			{ error: "Failed to fetch tag information" },
			{ status: 502 },
		);
	}
}
