import type { TagMode, TagWithMode } from "./types";

export const TAG_CATEGORIES = {
	artist: { color: "purple", label: "Artists" },
	character: { color: "green", label: "Characters" },
	copyright: { color: "pink", label: "Series" },
	meta: { color: "yellow", label: "Meta" },
	general: { color: "blue", label: "General" },
} as const;

export type TagCategory = keyof typeof TAG_CATEGORIES;

export interface GroupedTags {
	artist: string[];
	character: string[];
	copyright: string[];
	general: string[];
	meta: string[];
}

export function groupTagsByCategory(
	tags: string | undefined,
	tagInfo: Record<string, { types?: string[] }> | undefined
): GroupedTags {
	if (!tags || !tagInfo) {
		return {
			artist: [],
			character: [],
			copyright: [],
			general: [],
			meta: [],
		};
	}

	// Tags are already space-separated from the API
	const tagList = tags.split(" ").filter(Boolean);
	
	const grouped: GroupedTags = {
		artist: [],
		character: [],
		copyright: [],
		general: [],
		meta: [],
	};

	tagList.forEach((tag) => {
		const info = tagInfo[tag];
		
		if (info?.types && info.types.length > 0) {
			const type = info.types[0] as TagCategory;
			if (grouped[type]) {
				grouped[type].push(tag);
			} else {
				grouped.general.push(tag);
			}
		} else {
			grouped.general.push(tag);
		}
	});

	return grouped;
}

export function getTagModeColor(mode: TagMode): string {
	switch (mode) {
		case "include":
			return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
		case "exclude":
			return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
		default:
			return "";
	}
}

export function formatTagsForApi(tags: TagWithMode[]): string {
	return tags
		.map((tag) => {
			const formattedTag = tag.tag.replace(/ /g, "_");
			switch (tag.mode) {
				case "exclude":
					return `-${formattedTag}`;
				default:
					return formattedTag;
			}
		})
		.join(" ");
}

export function getTagColorClasses(category: TagCategory): string {
	const { color } = TAG_CATEGORIES[category];
	return `bg-${color}-100 text-${color}-800 dark:bg-${color}-900/20 dark:text-${color}-400`;
}

export function formatTagDisplay(tag: string): string {
	return tag.replace(/_/g, " ");
} 