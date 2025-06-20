import { type NextRequest, NextResponse } from "next/server";

const LIMIT_PER_PAGE = 100;

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const tags = searchParams.get("tags");
	const sort = searchParams.get("sort") || "id:desc";

	if (!tags) {
		return NextResponse.json(
			{ error: "Tags parameter is required" },
			{ status: 400 },
		);
	}

	// Add sort to tags for Rule34 API
	const tagsWithSort = `${tags} sort:${sort}`;

	try {
		let totalPosts = 0;
		let currentPage = 0;
		let hasMore = true;

		// Linear search until we find a page with fewer posts than the limit
		while (hasMore) {
			const response = await fetch(
				`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsWithSort)}&pid=${currentPage}&limit=${LIMIT_PER_PAGE}`,
				{
					method: "GET",
					headers: {
						"User-Agent": "Mozilla/5.0 (compatible; PostCounter/1.0)",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`API returned ${response.status}`);
			}

			const data = await response.text();

			if (!data.trim()) {
				// Empty response, no more posts
				hasMore = false;
			} else {
				try {
					const jsonData = JSON.parse(data);
					if (Array.isArray(jsonData)) {
						const postsOnThisPage = jsonData.length;
						
						if (postsOnThisPage === 0) {
							// No posts on this page, we're done
							hasMore = false;
						} else if (postsOnThisPage < LIMIT_PER_PAGE) {
							// Fewer posts than limit, this is the last page
							totalPosts = currentPage * LIMIT_PER_PAGE + postsOnThisPage;
							hasMore = false;
						} else {
							// Full page, continue to next page
							currentPage++;
						}
					} else {
						// Invalid response format
						hasMore = false;
					}
				} catch {
					// Parse error, stop searching
					hasMore = false;
				}
			}
		}

		return NextResponse.json({
			totalPosts,
			isEstimate: false,
			pagesChecked: currentPage + 1,
		});
	} catch (error) {
		console.error("Error counting posts:", error);
		return NextResponse.json(
			{
				error: "Failed to count posts",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 502 },
		);
	}
}
