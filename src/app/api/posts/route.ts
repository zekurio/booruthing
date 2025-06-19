import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const tags = searchParams.get("tags");
	const page = searchParams.get("page") || "0";
	const sort = searchParams.get("sort") || "id:desc"; // Default to newest (highest ID first)

	if (!tags) {
		return NextResponse.json(
			{ error: "Tags parameter is required" },
			{ status: 400 },
		);
	}

	// Add sort to tags for Rule34 API
	const tagsWithSort = `${tags} sort:${sort}`;

	try {
		const response = await fetch(
			`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsWithSort)}&pid=${page}&limit=42`,
			{
				method: "GET",
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; PostFetcher/1.0)",
				},
			},
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: `API returned ${response.status}: ${response.statusText}` },
				{ status: response.status },
			);
		}

		const data = await response.text();

		// Handle empty response
		if (!data.trim()) {
			return NextResponse.json([]);
		}

		try {
			const jsonData = JSON.parse(data);
			return NextResponse.json(jsonData);
		} catch (parseError) {
			console.error("Failed to parse JSON from Rule34 API:", parseError);
			return NextResponse.json(
				{ error: "Invalid JSON response from upstream API" },
				{ status: 502 },
			);
		}
	} catch (error) {
		console.error("Error fetching from Rule34 API:", error);
		return NextResponse.json(
			{ error: "Failed to fetch data from upstream API" },
			{ status: 502 },
		);
	}
}
