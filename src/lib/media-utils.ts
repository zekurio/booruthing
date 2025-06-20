import type { Post } from "./types";

export function isVideoFile(url: string): boolean {
	return !!url.match(/\.(webm|mp4|mov|avi|mkv|m4v)$/i);
}

export function isGifFile(url: string): boolean {
	return !!url.match(/\.gif$/i);
}

// Note: getMediaUrl function removed - we now use direct URLs only

export function getRule34PostUrl(postId: number): string {
	return `https://rule34.xxx/index.php?page=post&s=view&id=${postId}`;
}

export function getFileExtension(url: string): string {
	return url.split(".").pop() || "mp4";
}

export async function downloadPost(post: Post): Promise<void> {
	try {
		const extension = getFileExtension(post.file_url);
		const filename = `post_${post.id}.${extension}`;
		const isVideo = isVideoFile(post.file_url);
		
		// For videos, use direct download for better performance with large files
		if (isVideo) {
			// Try direct download using an anchor tag with download attribute
			const link = document.createElement("a");
			link.href = post.file_url;
			link.download = filename;
			link.target = "_blank"; // Open in new tab as fallback
			
			// Style to ensure it's invisible
			link.style.display = "none";
			document.body.appendChild(link);
			
			// Trigger the download
			link.click();
			
			// Clean up
			setTimeout(() => {
				document.body.removeChild(link);
			}, 100);
			
			return;
		}
		
		// For images and gifs, use the proxy approach for better compatibility and caching
		const downloadUrl = `/api/download?${new URLSearchParams({
			url: post.file_url,
			filename: filename,
		})}`;

		const response = await fetch(downloadUrl);
		if (!response.ok) throw new Error("Download failed");

		const blob = await response.blob();
		const url = URL.createObjectURL(blob);

		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		setTimeout(() => URL.revokeObjectURL(url), 100);
	} catch (error) {
		console.error("Download failed:", error);
		throw error;
	}
}