"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Minus, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "~/components/logo";
import { ModeToggle } from "~/components/mode-toggle";
import { PostGallery } from "~/components/post-gallery";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import type { AutocompleteResult, TagMode, TagWithMode } from "~/lib/types";

export default function SearchPage() {
	const [tagMode, setTagMode] = useState<TagMode>("include");
	const [search, setSearch] = useState<string>("");
	const [debouncedSearch, setDebouncedSearch] = useState<string>("");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [addedTags, setAddedTags] = useState<TagWithMode[]>([]);
	const [isSearched, setIsSearched] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
		}, 300); // 300ms delay

		return () => clearTimeout(timer);
	}, [search]);

	// Fetch autocomplete suggestions
	const {
		data: suggestions = [],
		isLoading,
		isFetching,
	} = useQuery({
		queryKey: ["autocomplete", debouncedSearch.trim()],
		queryFn: async (): Promise<AutocompleteResult[]> => {
			if (!debouncedSearch.trim() || debouncedSearch.trim().length < 2)
				return [];

			const response = await fetch(
				`https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(
					debouncedSearch.trim(),
				)}`,
			);
			if (!response.ok) throw new Error("Failed to fetch suggestions");

			const data = await response.json();
			return Array.isArray(data)
				? data.map((item: any) => ({
						label:
							typeof item === "string"
								? item
								: item.label || item.value || String(item),
						value:
							typeof item === "string"
								? item
								: item.value || item.label || String(item),
						type: typeof item === "object" ? item.type : undefined,
					}))
				: [];
		},
		enabled: debouncedSearch.trim().length >= 2,
		staleTime: 1000 * 60 * 5, // 5 minutes
		placeholderData: (previousData) => previousData, // Keep previous data while fetching
	});

	const getTagModeIcon = (mode: TagMode) => {
		switch (mode) {
			case "include":
				return <Plus className="size-4" />;
			case "exclude":
				return <Minus className="size-4" />;
		}
	};

	const cycleTagMode = () => {
		const modes: TagMode[] = ["include", "exclude"];
		const currentIndex = modes.indexOf(tagMode);
		const nextIndex = (currentIndex + 1) % modes.length;
		setTagMode(modes[nextIndex]);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(e.target.value);
		setShowSuggestions(true);
		setSelectedIndex(-1);
		if (isSearched) setIsSearched(false);
	};

	const handleSearch = () => {
		if (addedTags.length === 0 && !search.trim()) return;

		if (search.trim()) {
			addManualTag(search.trim(), true);
		} else {
			setIsSearched(true);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
				if (showSuggestions && suggestions.length > 0) {
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev < suggestions.length - 1 ? prev + 1 : 0,
					);
				}
				break;
			case "ArrowUp":
				if (showSuggestions && suggestions.length > 0) {
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev > 0 ? prev - 1 : suggestions.length - 1,
					);
				}
				break;
			case "Enter":
				e.preventDefault();
				if (
					showSuggestions &&
					selectedIndex >= 0 &&
					selectedIndex < suggestions.length
				) {
					selectSuggestion(suggestions[selectedIndex]);
				} else if (search.trim()) {
					addManualTag(search.trim());
				} else if (addedTags.length > 0) {
					handleSearch();
				}
				break;
			case "Backspace":
				if (!search.trim() && addedTags.length > 0) {
					e.preventDefault();
					const lastTag = addedTags[addedTags.length - 1];
					removeTag(lastTag.id);
				}
				break;
			case "Escape":
				setShowSuggestions(false);
				setSelectedIndex(-1);
				break;
		}
	};

	const addManualTag = (tagText: string, andSearch = false) => {
		if (addedTags.some((tag) => tag.tag === tagText)) {
			setSearch("");
			if (andSearch) {
				setIsSearched(true);
			}
			return;
		}
		const newTag: TagWithMode = {
			tag: tagText,
			mode: tagMode,
			id: `${tagText}-${Date.now()}`,
		};
		setAddedTags((prev) => [...prev, newTag]);

		setSearch("");
		setShowSuggestions(false);
		setSelectedIndex(-1);

		if (andSearch) {
			setIsSearched(true);
		}
	};

	const selectSuggestion = (suggestion: AutocompleteResult) => {
		if (addedTags.some((tag) => tag.tag === suggestion.value)) {
			setSearch("");
			setShowSuggestions(false);
			setSelectedIndex(-1);
			inputRef.current?.focus();
			return;
		}
		const newTag: TagWithMode = {
			tag: suggestion.value,
			mode: tagMode,
			id: `${suggestion.value}-${Date.now()}`,
		};
		setAddedTags((prev) => [...prev, newTag]);

		setSearch("");
		setShowSuggestions(false);
		setSelectedIndex(-1);
		inputRef.current?.focus();
	};

	const removeTag = (tagId: string) => {
		setAddedTags((prev) => prev.filter((tag) => tag.id !== tagId));
	};

	const toggleTagMode = (tagId: string) => {
		setAddedTags((prev) =>
			prev.map((tag) => {
				if (tag.id === tagId) {
					const modes: TagMode[] = ["include", "exclude"];
					const currentIndex = modes.indexOf(tag.mode);
					const nextIndex = (currentIndex + 1) % modes.length;
					return { ...tag, mode: modes[nextIndex] };
				}
				return tag;
			}),
		);
	};

	const getTagModeColor = (mode: TagMode) => {
		switch (mode) {
			case "include":
				return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
			case "exclude":
				return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
		}
	};

	return (
		<div className="flex flex-col items-center min-h-screen">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>
			<div className="flex flex-col items-center gap-4 sm:gap-8 w-full pt-16 sm:pt-24">
				<Logo />
				<div className="w-full max-w-2xl space-y-4 px-2 sm:px-4">
					<Popover
						open={showSuggestions && search.trim().length >= 2}
						onOpenChange={setShowSuggestions}
					>
						<PopoverTrigger asChild>
							<div className="relative w-full">
								<Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4 sm:size-5 pointer-events-none z-10" />

								<div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pl-10 sm:pl-12 pr-20 sm:pr-24 py-2 h-auto min-h-10 sm:min-h-12 text-base sm:text-lg bg-muted border-none rounded-full">
									{addedTags.map((tagWithMode) => (
										<div
											key={tagWithMode.id}
											className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getTagModeColor(
												tagWithMode.mode,
											)}`}
										>
											<button
												onClick={() => toggleTagMode(tagWithMode.id)}
												className="hover:opacity-70 transition-opacity"
											>
												<span className="font-medium">{tagWithMode.tag}</span>
											</button>
											<button
												onClick={() => removeTag(tagWithMode.id)}
												className="hover:opacity-70 transition-opacity"
											>
												<X className="size-2.5" />
											</button>
										</div>
									))}

									<input
										ref={inputRef}
										value={search}
										onChange={handleInputChange}
										onKeyDown={handleKeyDown}
										onFocus={() =>
											search.trim().length >= 2 && setShowSuggestions(true)
										}
										placeholder={addedTags.length === 0 ? "Search tags..." : ""}
										className="flex-1 min-w-20 sm:min-w-32 border-none outline-none text-base sm:text-lg placeholder:text-muted-foreground bg-transparent"
										style={{ boxShadow: "none" }}
									/>
								</div>

								<div className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2 z-10">
									<Button
										type="button"
										onClick={cycleTagMode}
										variant="ghost"
										size="sm"
										className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full text-muted-foreground hover:bg-muted/30 shrink-0"
										tabIndex={-1}
									>
										{getTagModeIcon(tagMode)}
									</Button>
									<Button
										type="button"
										onClick={handleSearch}
										variant="ghost"
										size="sm"
										className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full text-muted-foreground hover:bg-muted/30 shrink-0"
									>
										<ArrowRight className="size-3.5 sm:size-4" />
									</Button>
								</div>
							</div>
						</PopoverTrigger>
						<PopoverContent
							className="w-[var(--radix-popover-trigger-width)] p-0"
							align="start"
							onOpenAutoFocus={(e) => e.preventDefault()}
						>
							<Command shouldFilter={false}>
								<CommandList>
									{isLoading && suggestions.length === 0 ? (
										<div className="px-2 py-6 text-center">
											<Loader2 className="size-4 animate-spin mx-auto mb-2 text-muted-foreground" />
											<p className="text-sm text-muted-foreground">
												Searching...
											</p>
										</div>
									) : suggestions.length > 0 ? (
										<CommandGroup className="relative">
											{isFetching && suggestions.length > 0 && (
												<div className="absolute top-1 right-1 z-10">
													<Loader2 className="size-3 animate-spin text-muted-foreground" />
												</div>
											)}
											{suggestions.map((suggestion, index) => (
												<CommandItem
													key={`${suggestion.value}-${index}`}
													value={suggestion.value}
													onSelect={() => {
														selectSuggestion(suggestion);
													}}
													className={selectedIndex === index ? "bg-muted" : ""}
												>
													<div>
														<div className="font-medium">
															{suggestion.label}
														</div>
														{suggestion.type && (
															<div className="text-xs text-muted-foreground">
																{suggestion.type}
															</div>
														)}
													</div>
												</CommandItem>
											))}
										</CommandGroup>
									) : (
										<div className="px-2 py-6 text-center">
											<p className="text-sm text-muted-foreground">
												No suggestions found
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												Try a different search term
											</p>
										</div>
									)}
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{/* Gallery section */}
			{isSearched && (
				<div className="w-full mt-8">
					<PostGallery tags={addedTags} />
				</div>
			)}
		</div>
	);
}
