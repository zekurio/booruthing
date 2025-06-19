import { type NextRequest, NextResponse } from "next/server";

const LIMIT_PER_PAGE = 42;
const MAX_PAGES_TO_CHECK = 1000; // Safety limit to prevent infinite crawling

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
		const _currentPage = 0;
		const _hasMore = true;

		// Binary search to find the last page with posts
		let low = 0;
		let high = MAX_PAGES_TO_CHECK;
		let lastPageWithPosts = 0;

		while (low <= high) {
			const mid = Math.floor((low + high) / 2);

			const response = await fetch(
				`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsWithSort)}&pid=${mid}&limit=${LIMIT_PER_PAGE}`,
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
				// Empty response, this page has no posts
				high = mid - 1;
			} else {
				try {
					const jsonData = JSON.parse(data);
					if (Array.isArray(jsonData) && jsonData.length > 0) {
						lastPageWithPosts = mid;
						low = mid + 1;
					} else {
						high = mid - 1;
					}
				} catch {
					high = mid - 1;
				}
			}
		}

		// Now count posts on the last page to get exact total
		const lastPageResponse = await fetch(
			`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsWithSort)}&pid=${lastPageWithPosts}&limit=${LIMIT_PER_PAGE}`,
			{
				method: "GET",
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; PostCounter/1.0)",
				},
			},
		);

		if (lastPageResponse.ok) {
			const lastPageData = await lastPageResponse.text();
			if (lastPageData.trim()) {
				try {
					const lastPageJson = JSON.parse(lastPageData);
					if (Array.isArray(lastPageJson)) {
						const postsOnLastPage = lastPageJson.length;
						totalPosts = lastPageWithPosts * LIMIT_PER_PAGE + postsOnLastPage;
					}
				} catch {
					// Fallback to estimate
					totalPosts = lastPageWithPosts * LIMIT_PER_PAGE;
				}
			}
		}

		return NextResponse.json({
			totalPosts,
			isEstimate: false,
			pagesChecked: lastPageWithPosts + 1,
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
