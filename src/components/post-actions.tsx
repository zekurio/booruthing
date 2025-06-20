"use client";

import { ExternalLink, Link } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Post } from "~/lib/types";
import { getRule34PostUrl } from "~/lib/media-utils";

interface PostActionsProps {
	post: Post;
	size?: "sm" | "icon";
}

export function PostActions({ post, size = "icon" }: PostActionsProps) {
	const buttonSize = size === "sm" ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8";

	return (
		<div className="flex gap-2">
			{post.source && post.source.trim() !== "" && (
				<Button
					variant="ghost"
					size="icon"
					onClick={() => window.open(post.source, "_blank")}
					className={buttonSize}
					title="View source"
				>
					<Link className="size-4" />
				</Button>
			)}
			<Button
				variant="ghost"
				size="icon"
				onClick={() => window.open(getRule34PostUrl(post.id), "_blank")}
				className={buttonSize}
				title="View on Rule34"
			>
				<ExternalLink className="size-4" />
			</Button>
		</div>
	);
} 