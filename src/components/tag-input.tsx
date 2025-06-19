"use client";

import { X } from "lucide-react";
import type { TagMode, TagWithMode } from "~/lib/types";
import { getTagModeColor } from "~/lib/tag-utils";

interface TagInputProps {
	tags: TagWithMode[];
	onRemoveTag: (tagId: string) => void;
	onToggleTagMode: (tagId: string) => void;
}

export function TagInput({ tags, onRemoveTag, onToggleTagMode }: TagInputProps) {
	return (
		<>
			{tags.map((tagWithMode) => (
				<div
					key={tagWithMode.id}
					className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border ${getTagModeColor(
						tagWithMode.mode,
					)}`}
				>
					<button
						onClick={() => onToggleTagMode(tagWithMode.id)}
						className="hover:opacity-70 transition-opacity"
					>
						<span className="font-medium">{tagWithMode.tag}</span>
					</button>
					<button
						onClick={() => onRemoveTag(tagWithMode.id)}
						className="hover:opacity-70 transition-opacity"
					>
						<X className="size-2.5" />
					</button>
				</div>
			))}
		</>
	);
} 