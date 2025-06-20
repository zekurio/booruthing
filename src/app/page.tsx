"use client";

import { useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Logo } from "~/components/logo";
import { ModeToggle } from "~/components/mode-toggle";
import { PostGallery } from "~/components/post-gallery";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";
import type { TagWithMode } from "~/lib/types";
import { SearchBar } from "~/components/searchbar";
import { usePostStore } from "~/lib/post-store";

export default function SearchPage() {
	const { searchState, setSearchState } = usePostStore();
	const [addedTags, setAddedTags] = useState<TagWithMode[]>(searchState.tags);
	const [isSearched, setIsSearched] = useState(searchState.tags.length > 0);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleAddTag = (tag: TagWithMode) => {
		const newTags = [...addedTags, tag];
		setAddedTags(newTags);
		setSearchState({ tags: newTags });
	};

	const handleSearch = () => {
		setIsSearched(true);
	};

	const handleAIFilterChange = (pressed: boolean) => {
		setSearchState({ filterAI: pressed });
	};

	const removeTag = (tagId: string) => {
		const newTags = addedTags.filter((tag) => tag.id !== tagId);
		setAddedTags(newTags);
		setSearchState({ tags: newTags });
	};

	const toggleTagMode = (tagId: string) => {
		const newTags = addedTags.map((tag) => {
			if (tag.id === tagId) {
				const modes = ["include", "exclude"] as const;
				const currentIndex = modes.indexOf(tag.mode);
				const nextIndex = (currentIndex + 1) % modes.length;
				return { ...tag, mode: modes[nextIndex] };
			}
			return tag;
		});
		setAddedTags(newTags);
		setSearchState({ tags: newTags });
	};

	return (
		<TooltipProvider>
			<div className="flex flex-col items-center min-h-screen">
				<div className="absolute top-4 right-4 flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
							>
								<HelpCircle className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="left" className="max-w-xs text-sm">
							<div className="space-y-2">
								<p><strong>Tag System:</strong> Use the +/- button to switch between include/exclude modes. Click on existing tags to toggle their mode.</p>
								<p><strong>AI Filter:</strong> Click the sparkles icon to filter out AI-generated content.</p>
								<p><strong>Sorting:</strong> When viewing search results, use the sorting options to organize posts by date, score, or other criteria.</p>
							</div>
						</TooltipContent>
					</Tooltip>
					<ModeToggle />
				</div>
				<div className="flex flex-col items-center gap-4 sm:gap-8 w-full pt-16 sm:pt-24">
					<Logo />
					<div className="w-full max-w-2xl space-y-4 px-2 sm:px-4">
						<SearchBar 
							ref={inputRef}
							tags={addedTags}
							onAddTag={handleAddTag}
							onRemoveTag={removeTag}
							onToggleTagMode={toggleTagMode}
							onSearch={handleSearch}
							filterAI={searchState.filterAI}
							onFilterAIChange={handleAIFilterChange}
						/>
					</div>
				</div>

				{/* Gallery section */}
				{isSearched && (
					<div className="w-full mt-8">
						<PostGallery tags={addedTags} />
					</div>
				)}
			</div>
		</TooltipProvider>
	);
}
