"use client";

import { Badge } from "~/components/ui/badge";
import { formatTagDisplay } from "~/lib/tag-utils";

type TagDisplayProps = { 
	tagList: string[]; 
	size?: "xs" | "sm" | "default" | "lg";
	className?: string;
	maxHeight?: string;
	scrollable?: boolean;
};

export function TagDisplay({ 
	tagList, 
	size = "sm", 
	className,
	maxHeight = "200px",
	scrollable = true
}: TagDisplayProps) {
	if (!tagList.length) return null;

	// Use tighter spacing for extra small tags
	const gapClass = size === "xs" ? "gap-0.5" : "gap-1 sm:gap-1.5";
	
	// Base container classes
	const containerClasses = `flex flex-wrap ${gapClass} max-w-full ${className || ""}`;
	
	// Add scrollable classes if enabled
	const scrollableClasses = scrollable 
		? "overflow-y-auto overscroll-contain" 
		: "";

	return (
		<div 
			className={`${containerClasses} ${scrollableClasses}`}
			style={scrollable ? { maxHeight } : undefined}
		>
			{tagList.map((tag) => (
				<Badge
					key={tag}
					variant="secondary"
					size={size}
					className="font-mono shrink-0 max-w-full truncate"
					title={formatTagDisplay(tag)}
				>
					{formatTagDisplay(tag)}
				</Badge>
			))}
		</div>
	);
}