"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Loader2, Tags, ChevronUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import { PostMedia } from "~/components/post-media";
import { PostActions } from "~/components/post-actions";
import { TagDisplay } from "~/components/tag-display";
import { usePostStore } from "~/lib/post-store";
import type { Post, TagWithMode } from "~/lib/types";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { formatTagsForApi } from "~/lib/tag-utils";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

interface PostModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialIndex: number;
}

export function PostModal({ isOpen, onClose, initialIndex }: PostModalProps) {
	const { posts, currentIndex, setCurrentIndex, searchState, setPosts, addPosts } = usePostStore();
	const [post, setPost] = useState<Post | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	const [viewportHeight, setViewportHeight] = useState(0);
	
	// Get all tags including hidden AI filter if enabled (only when other tags are present)
	const getAllTags = () => {
		const allTags = [...searchState.tags];

		// Only apply AI filter when there are other search tags present
		if (searchState.filterAI && searchState.tags.length > 0) {
			const aiFilterTag: TagWithMode = {
				tag: "ai_generated",
				mode: "exclude",
				id: "ai-filter-hidden",
			};

			// Only add if not already present
			if (!allTags.some((tag) => tag.tag === "ai_generated" && tag.mode === "exclude")) {
				allTags.push(aiFilterTag);
			}
		}

		return allTags;
	};

	const effectiveTags = getAllTags();
	const effectiveTagsString = formatTagsForApi(effectiveTags);
	
	// Set up infinite query for pagination (only if we have search state)
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useInfiniteQuery({
		queryKey: ["posts", effectiveTagsString, searchState.sortOrder],
		queryFn: async ({ pageParam = 0 }): Promise<Post[]> => {
			if (!effectiveTagsString.trim()) return [];

			// Build Rule34 API URL directly in the browser
			const tagsWithSort = `${effectiveTagsString} sort:${searchState.sortOrder}`;
			const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsWithSort)}&pid=${pageParam}&limit=100`;

			const response = await fetch(apiUrl);

			if (!response.ok) {
				let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
				try {
					const errJson = await response.json();
					if (errJson?.error) errorMessage = errJson.error;
				} catch {
					// ignore parse errors
				}
				throw new Error(errorMessage);
			}

			const dataText = await response.text();
			if (!dataText.trim()) return [];

			let jsonData: unknown;
			try {
				jsonData = JSON.parse(dataText);
			} catch (parseError) {
				console.error("Failed to parse JSON from Rule34 API:", parseError);
				throw new Error("Invalid JSON response from upstream API");
			}

			if (Array.isArray(jsonData)) return jsonData as Post[];
			throw new Error("Unexpected response structure from Rule34 API");
		},
		enabled: !!effectiveTagsString.trim() && searchState.tags.length > 0,
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage || lastPage.length === 0) return undefined;
			return allPages.length;
		},
		staleTime: 1000 * 60 * 5,
		retry: 2,
	});

	// Update the store when new posts are fetched
	const allPosts = data?.pages.flat() || [];
	useEffect(() => {
		if (allPosts.length > posts.length && searchState.tags.length > 0) {
			// Only add new posts that aren't already in the store
			const existingIds = new Set(posts.map(p => p.id));
			const newPosts = allPosts.filter(p => !existingIds.has(p.id));
			if (newPosts.length > 0) {
				addPosts(newPosts);
				// If we were at the last post and new posts were added, we can now navigate to them
				if (currentIndex === posts.length - 1 && !post) {
					setPost(newPosts[0]);
					setCurrentIndex(posts.length);
				}
			}
		}
	}, [data, posts.length, searchState.tags.length, currentIndex, post]);
	
	// Set initial post
	useEffect(() => {
		if (isOpen && posts.length > 0) {
			const index = initialIndex >= 0 && initialIndex < posts.length ? initialIndex : 0;
			setCurrentIndex(index);
			setPost(posts[index]);
		}
	}, [isOpen, initialIndex]);

	// Update post when currentIndex changes
	useEffect(() => {
		if (currentIndex >= 0 && currentIndex < posts.length) {
			setPost(posts[currentIndex]);
		}
	}, [currentIndex, posts]);

	// Mobile detection and viewport height handling
	useEffect(() => {
		const updateViewport = () => {
			const isMobileDevice = window.matchMedia("(max-width: 768px)").matches;
			setIsMobile(isMobileDevice);
			
			// Set viewport height for mobile to handle address bar issues
			if (isMobileDevice) {
				const vh = window.innerHeight;
				setViewportHeight(vh);
				// Set CSS custom property for consistent viewport height
				document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
			}
		};

		updateViewport();
		window.addEventListener("resize", updateViewport);
		window.addEventListener("orientationchange", updateViewport);
		
		return () => {
			window.removeEventListener("resize", updateViewport);
			window.removeEventListener("orientationchange", updateViewport);
		};
	}, []);

	// Computed values
	const tagList = post?.tags ? post.tags.split(" ").filter(Boolean) : [];
	const hasNext = currentIndex < posts.length - 1 || (hasNextPage && searchState.tags.length > 0);
	const hasPrevious = currentIndex > 0;

	// Navigation handlers
	const handleNavigate = async (direction: 'next' | 'previous') => {
		if (!posts.length) return;
		
		let newIndex = currentIndex;
		
		if (direction === 'next') {
			if (currentIndex < posts.length - 1) {
				newIndex = currentIndex + 1;
			} else if (hasNextPage && searchState.tags.length > 0 && !isFetchingNextPage) {
				// We're at the end of current posts but there are more pages
				await fetchNextPage();
				return; // Let the useEffect handle updating when new posts arrive
			}
		} else if (direction === 'previous' && currentIndex > 0) {
			newIndex = currentIndex - 1;
		}
		
		// Also check if we're near the end and should preload more posts
		if (direction === 'next' && 
			searchState.tags.length > 0 && 
			hasNextPage && 
			!isFetchingNextPage && 
			currentIndex >= posts.length - 5) {
			fetchNextPage(); // Don't await this one, just preload
		}
		
		if (newIndex !== currentIndex && newIndex < posts.length) {
			setCurrentIndex(newIndex);
		}
	};

	// Keyboard navigation
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			} else if (e.key === "ArrowLeft" && hasPrevious) {
				handleNavigate('previous');
			} else if (e.key === "ArrowRight" && hasNext) {
				handleNavigate('next');
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, currentIndex, posts.length, hasNext, hasPrevious, onClose]);

	if (!post || !isOpen) {
		return null;
	}

	const modalContent = (
		<div 
			className="fixed inset-0 bg-background flex flex-col w-screen"
			style={{
				height: isMobile && viewportHeight > 0 ? `${viewportHeight}px` : '100vh'
			}}
		>
			{/* Visually hidden title for accessibility */}
			<VisuallyHidden.Root>
				<DialogTitle>
					Post {post.id} - {posts.length > 0 ? `${currentIndex + 1} of ${posts.length}` : 'Viewing post'}
				</DialogTitle>
			</VisuallyHidden.Root>

			{/* Header - matching original design */}
			<div className="flex-shrink-0 p-3 bg-background z-50">
				<div className="flex justify-between items-center">
					{/* Post info - left side */}
					<div className="flex items-center gap-2">
						<div className="bg-muted/80 backdrop-blur-sm rounded-none px-3 py-1.5">
							<span className="text-foreground text-sm font-medium">
								#{post.id}
								{posts.length > 0 && (
									<span className="ml-2 text-xs opacity-70">
										{currentIndex + 1} / {posts.length}
									</span>
								)}
							</span>
						</div>
						{post.score !== undefined && (
							<div className="bg-muted/80 backdrop-blur-sm rounded-none px-3 py-1.5">
								<span className="text-foreground text-sm font-medium">
									SCORE: {post.score}
								</span>
							</div>
						)}
					</div>

					{/* Close button - right side */}
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-8 w-8 rounded-none bg-muted/80 hover:bg-muted backdrop-blur-sm transition-colors"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Media container */}
			<div className="flex-1 min-h-0 relative flex items-center justify-center bg-muted/50">
				<PostMedia 
					post={post}
					className="max-w-full max-h-full object-contain"
					isMobile={isMobile}
				/>
				
				{/* Navigation buttons */}
				{hasPrevious && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => handleNavigate('previous')}
						className={`absolute ${isMobile ? 'left-2' : 'left-4'} top-1/2 -translate-y-1/2 ${isMobile ? 'h-10 w-10' : 'h-12 w-12'} rounded-none bg-background/80 hover:bg-background/95 backdrop-blur-sm border border-border/50 transition-colors`}
						title="Previous post (←)"
					>
						<ChevronLeft className={isMobile ? "h-5 w-5" : "h-6 w-6"} />
					</Button>
				)}
				{hasNext && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => handleNavigate('next')}
						className={`absolute ${isMobile ? 'right-2' : 'right-4'} top-1/2 -translate-y-1/2 ${isMobile ? 'h-10 w-10' : 'h-12 w-12'} rounded-none bg-background/80 hover:bg-background/95 backdrop-blur-sm border border-border/50 transition-colors`}
						title="Next post (→)"
						disabled={isFetchingNextPage}
					>
						{isFetchingNextPage ? (
							<Loader2 className={isMobile ? "h-4 w-4 animate-spin" : "h-5 w-5 animate-spin"} />
						) : (
							<ChevronRight className={isMobile ? "h-5 w-5" : "h-6 w-6"} />
						)}
					</Button>
				)}
			</div>

			{/* Bottom sheet */}
			<div
				className={`flex-shrink-0 bg-background transition-all duration-300 ease-out z-50 ${
					showDetails ? (isMobile ? "h-auto max-h-[250px]" : "h-auto max-h-[200px]") : "h-[60px]"
				}`}
				style={{ 
					minHeight: "60px"
				}}
			>
				{/* Actions bar */}
				<div className="flex items-center justify-between px-4 py-3 h-[60px]">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowDetails(!showDetails)}
						className="flex items-center gap-1.5 focus-visible:ring-0 focus-visible:ring-offset-0"
						tabIndex={0}
					>
						<Tags className="size-4" />
						<span className="text-sm">Tags</span>
						<ChevronUp
							className={`size-3 transition-transform ${showDetails ? "" : "rotate-180"}`}
						/>
					</Button>

					<PostActions post={post} />
				</div>

				{/* Tag details */}
				{showDetails && (
					<div className="px-4 pb-4 flex-1">
						<TagDisplay 
							tagList={tagList} 
							size={isMobile ? "sm" : "xs"} 
							maxHeight={isMobile ? "120px" : "120px"}
							scrollable={true}
						/>
					</div>
				)}
			</div>
		</div>
	);

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent 
				className="!fixed !inset-0 !p-0 !max-w-none !w-screen !h-screen !rounded-none !border-0 !top-0 !left-0 !translate-x-0 !translate-y-0"
				showCloseButton={false}
			>
				{modalContent}
			</DialogContent>
		</Dialog>
	);
} 