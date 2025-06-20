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
		const response = await fetch(post.file_url);
		if (!response.ok) throw new Error("Download failed");

		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const extension = getFileExtension(post.file_url);

		const link = document.createElement("a");
		link.href = url;
		link.download = `post_${post.id}.${extension}`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		setTimeout(() => URL.revokeObjectURL(url), 100);
	} catch (error) {
		console.error("Download failed:", error);
		throw error;
	}
}