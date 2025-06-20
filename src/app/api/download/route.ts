import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const url = searchParams.get("url");
		const filename = searchParams.get("filename");

		if (!url) {
			return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
		}

		// Validate that the URL is from allowed domains
		const allowedDomains = ["api-cdn.rule34.xxx", "rule34.xxx", "us.rule34.xxx"];
		const urlObj = new URL(url);
		if (!allowedDomains.includes(urlObj.hostname)) {
			return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
		}

		// Fetch the file from the Rule34 CDN
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		});

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch file" },
				{ status: response.status }
			);
		}

		// Get the content type from the response
		const contentType = response.headers.get("content-type") || "application/octet-stream";
		
		// Create response with proper headers for download
		const fileData = await response.arrayBuffer();
		
		const headers = new Headers({
			"Content-Type": contentType,
			"Content-Length": fileData.byteLength.toString(),
			"Cache-Control": "public, max-age=31536000", // Cache for 1 year
		});

		// Add download filename if provided
		if (filename) {
			headers.set("Content-Disposition", `attachment; filename="${filename}"`);
		}

		return new NextResponse(fileData, { headers });
	} catch (error) {
		console.error("Download proxy error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
} 