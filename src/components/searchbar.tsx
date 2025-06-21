"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Minus, Plus, Search, X, SparklesIcon } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import type { AutocompleteResult, TagMode, TagWithMode } from "~/lib/types";
import { getTagModeColor } from "~/lib/tag-utils";
import { cn } from "~/lib/utils";

interface SearchBarProps {
	tags: TagWithMode[];
	onAddTag: (tag: TagWithMode) => void;
	onRemoveTag: (tagId: string) => void;
	onToggleTagMode: (tagId: string) => void;
	onSearch: () => void;
	filterAI: boolean;
	onFilterAIChange: (pressed: boolean) => void;
	placeholder?: string;
	className?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
	({ 
		tags, 
		onAddTag,
		onRemoveTag, 
		onToggleTagMode,
		onSearch,
		filterAI,
		onFilterAIChange,
		placeholder,
		className
	}, ref) => {
		const [tagMode, setTagMode] = useState<TagMode>("include");
		const [search, setSearch] = useState<string>("");
		const [debouncedSearch, setDebouncedSearch] = useState<string>("");
		const [showSuggestions, setShowSuggestions] = useState(false);
		const [selectedIndex, setSelectedIndex] = useState(-1);

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

		const getTagModeTooltip = (mode: TagMode) => {
			switch (mode) {
				case "include":
					return "Include mode: Click to switch to exclude mode";
				case "exclude":
					return "Exclude mode: Click to switch to include mode";
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
		};

		const handleSearch = () => {
			if (tags.length === 0 && !search.trim()) return;

			if (search.trim()) {
				addManualTag(search.trim(), true);
			} else {
				onSearch();
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
					} else if (tags.length > 0) {
						handleSearch();
					}
					break;
				case "Backspace":
					if (!search.trim() && tags.length > 0) {
						e.preventDefault();
						const lastTag = tags[tags.length - 1];
						onRemoveTag(lastTag.id);
					}
					break;
				case "Escape":
					setShowSuggestions(false);
					setSelectedIndex(-1);
					break;
			}
		};

		const addManualTag = (tagText: string, andSearch = false) => {
			if (tags.some((tag) => tag.tag === tagText)) {
				setSearch("");
				// Keep focus even when tag already exists
				setTimeout(() => {
					if (ref && 'current' in ref && ref.current) {
						ref.current.focus();
					}
				}, 0);
				if (andSearch) {
					onSearch();
				}
				return;
			}
			const newTag: TagWithMode = {
				tag: tagText,
				mode: tagMode,
				id: `${tagText}-${Date.now()}`,
			};
			onAddTag(newTag);

			setSearch("");
			setShowSuggestions(false);
			setSelectedIndex(-1);

			// Keep focus on mobile after adding tag
			setTimeout(() => {
				if (ref && 'current' in ref && ref.current) {
					ref.current.focus();
				}
			}, 0);

			if (andSearch) {
				onSearch();
			}
		};

		const selectSuggestion = (suggestion: AutocompleteResult) => {
			if (tags.some((tag) => tag.tag === suggestion.value)) {
				setSearch("");
				setShowSuggestions(false);
				setSelectedIndex(-1);
				// Keep focus even when tag already exists
				setTimeout(() => {
					if (ref && 'current' in ref && ref.current) {
						ref.current.focus();
					}
				}, 0);
				return;
			}
			const newTag: TagWithMode = {
				tag: suggestion.value,
				mode: tagMode,
				id: `${suggestion.value}-${Date.now()}`,
			};
			onAddTag(newTag);

			setSearch("");
			setShowSuggestions(false);
			setSelectedIndex(-1);

			// Keep focus on mobile after selecting suggestion
			setTimeout(() => {
				if (ref && 'current' in ref && ref.current) {
					ref.current.focus();
				}
			}, 0);
		};

		return (
			<Popover
				open={showSuggestions && search.trim().length >= 2}
				onOpenChange={setShowSuggestions}
			>
				<PopoverTrigger asChild>
					<div className="relative w-full">
						<div className={cn(
							"flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 h-auto min-h-10 sm:min-h-12 bg-muted border-none rounded-md relative",
							className
						)}>
							<Search className="shrink-0 text-muted-foreground size-4 sm:size-5 mr-1" />
							
							{tags.map((tagWithMode) => (
								<div
									key={tagWithMode.id}
									className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border ${getTagModeColor(
										tagWithMode.mode,
									)}`}
								>
									<button
										type="button"
										onClick={() => onToggleTagMode(tagWithMode.id)}
										className="hover:opacity-70 transition-opacity"
									>
										<span className="font-medium">{tagWithMode.tag}</span>
									</button>
									<button
										type="button"
										onClick={() => onRemoveTag(tagWithMode.id)}
										className="hover:opacity-70 transition-opacity"
									>
										<X className="size-2.5" />
									</button>
								</div>
							))}
							
							<input
								ref={ref}
								value={search}
								onChange={handleInputChange}
								onKeyDown={handleKeyDown}
								onFocus={() => search.trim().length >= 2 && setShowSuggestions(true)}
								placeholder={placeholder || (tags.length === 0 ? "Search tags..." : "")}
								className="flex-1 min-w-20 sm:min-w-32 border-none outline-none text-base sm:text-lg placeholder:text-muted-foreground bg-transparent pr-24 sm:pr-28"
								style={{ boxShadow: "none" }}
							/>
						</div>

						<div className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2 z-10">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										onClick={() => onFilterAIChange(!filterAI)}
										variant="ghost"
										size="sm"
										className={`h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-none shrink-0 transition-colors ${
											filterAI
												? "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
												: "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
										}`}
										tabIndex={-1}
									>
										<SparklesIcon className="size-3.5 sm:size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="top">
									{filterAI ? "AI content is filtered" : "Click to filter AI content"}
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										onClick={cycleTagMode}
										variant="ghost"
										size="sm"
										className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-none text-muted-foreground hover:bg-muted/30 shrink-0"
										tabIndex={-1}
									>
										{getTagModeIcon(tagMode)}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="top">
									{getTagModeTooltip(tagMode)}
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										onClick={handleSearch}
										variant="ghost"
										size="sm"
										className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-none text-muted-foreground hover:bg-muted/30 shrink-0"
									>
										<ArrowRight className="size-3.5 sm:size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="top">
									Search
								</TooltipContent>
							</Tooltip>
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
		);
	}
);

SearchBar.displayName = "SearchBar";