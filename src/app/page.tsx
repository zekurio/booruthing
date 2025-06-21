"use client";

import { useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Logo } from "~/components/logo";
import { ModeToggle } from "~/components/mode-toggle";
import { PostGallery } from "~/components/post-gallery";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import type { TagWithMode } from "~/lib/types";
import { SearchBar } from "~/components/searchbar";
import { usePostStore } from "~/lib/post-store";

export default function SearchPage() {
	const { searchState, setSearchState } = usePostStore();
	const [addedTags, setAddedTags] = useState<TagWithMode[]>(searchState.tags);
	const [isSearched, setIsSearched] = useState(searchState.tags.length > 0);
	const [showHelpModal, setShowHelpModal] = useState(false);
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
					<Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
							>
								<HelpCircle className="size-4" />
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-md">
							<DialogTitle>Help & Guide</DialogTitle>
							<DialogDescription>
								Learn how to use the search features and navigation
							</DialogDescription>
							<div className="space-y-4">
								<div>
									<h4 className="font-semibold text-sm mb-2">Tag System</h4>
									<p className="text-sm text-muted-foreground">
										Use the +/- button to switch between include/exclude modes. Click on existing tags to toggle their mode.
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-sm mb-2">AI Filter</h4>
									<p className="text-sm text-muted-foreground">
										Click the sparkles icon to filter out AI-generated content.
									</p>
								</div>
								<div>
									<h4 className="font-semibold text-sm mb-2">Sorting</h4>
									<p className="text-sm text-muted-foreground">
										When viewing search results, use the sorting options to organize posts by date, score, or other criteria.
									</p>
								</div>
							</div>
						</DialogContent>
					</Dialog>
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
