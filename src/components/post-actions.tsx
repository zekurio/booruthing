"use client";

import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import type { Post } from "~/lib/types";
import { downloadPost, getRule34PostUrl } from "~/lib/media-utils";

interface PostActionsProps {
	post: Post;
	size?: "sm" | "icon";
}

export function PostActions({ post, size = "icon" }: PostActionsProps) {
	const [isDownloading, setIsDownloading] = useState(false);

	const handleDownload = async () => {
		try {
			setIsDownloading(true);
			await downloadPost(post);
		} finally {
			setIsDownloading(false);
		}
	};

	const buttonSize = size === "sm" ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8";

	return (
		<div className="flex gap-2">
			<Button
				variant="ghost"
				size="icon"
				onClick={() => window.open(getRule34PostUrl(post.id), "_blank")}
				className={buttonSize}
				title="View on Rule34"
			>
				<ExternalLink className="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={isDownloading}
				onClick={handleDownload}
				className={buttonSize}
				title="Download"
			>
				{isDownloading ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Download className="size-4" />
				)}
			</Button>
		</div>
	);
} 