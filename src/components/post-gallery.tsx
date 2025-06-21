"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUp, Image as ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { type Post, PostsApiResponse, type TagWithMode } from "~/lib/types";
import { formatTagsForApi } from "~/lib/tag-utils";
import { usePostStore } from "~/lib/post-store";
import React from "react";
import { PostModal } from "~/components/post-modal";

interface PostCardProps {
	post: Post;
	onClick: () => void;
}

function PostCard({ post, onClick }: PostCardProps) {
	const [imageError, setImageError] = useState(false);
	const [videoThumbnailError, setVideoThumbnailError] = useState(false);

	// Reset error states when post changes
	useEffect(() => {
		setImageError(false);
		setVideoThumbnailError(false);
	}, [post.id]);

	// Use sample_url for better quality on larger thumbnails, with robust fallbacks
	const isVideo = post.file_url?.includes('.webm') || post.file_url?.includes('.mp4');
	const thumbnailSrc = imageError
		? null
		: isVideo
			? (videoThumbnailError ? post.preview_url : post.sample_url || post.preview_url)
			: post.sample_url || null;

	// Calculate aspect ratio with reasonable bounds for display
	const originalAspectRatio = post.width / post.height;
	// Limit extreme ratios for better layout but be more permissive
	const minAspectRatio = 0.4; // Very tall portraits
	const maxAspectRatio = 3.0; // Very wide landscapes
	const clampedAspectRatio = Math.max(minAspectRatio, Math.min(maxAspectRatio, originalAspectRatio));
	
	// Determine if this needs aspect ratio adjustment
	const isAspectRatioClamped = originalAspectRatio !== clampedAspectRatio;

	return (
		<div
			className="group relative w-full bg-muted overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl rounded-lg break-inside-avoid mb-2"
			style={{ aspectRatio: clampedAspectRatio }}
			onClick={onClick}
		>
			{!thumbnailSrc ? (
				<div className="w-full h-full flex items-center justify-center bg-muted">
					<ImageIcon className="size-12 text-muted-foreground" />
				</div>
			) : (
				<img
					src={thumbnailSrc}
					alt={`Post ${post.id}`}
					className={`w-full h-full transition-transform duration-300 group-hover:scale-105 ${
						isAspectRatioClamped 
							? 'object-cover' 
							: 'object-contain bg-muted'
					}`}
					loading="eager"
					onError={() => {
						if (isVideo && !videoThumbnailError) {
							// First error for video - try preview_url as fallback
							setVideoThumbnailError(true);
						} else {
							// Final fallback - hide image
							setImageError(true);
						}
					}}
				/>
			)}
			
			{/* Aspect ratio indicator for clamped ratios */}
			{isAspectRatioClamped && (
				<div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
					{originalAspectRatio.toFixed(2)}:1
				</div>
			)}
			
			{/* Dark overlay for text visibility */}
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
			
			{/* Post info on hover */}
			<div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
				<div className="font-bold text-sm">POST #{post.id}</div>
				<div className="text-xs opacity-90">
					{post.width} × {post.height}
				</div>
				{post.score !== undefined && (
					<div className="text-xs opacity-90 mt-1">
						SCORE: {post.score}
					</div>
				)}
			</div>
		</div>
	);
}

interface LoadingStateProps {
	message?: string;
}

function LoadingState({ message = "Loading posts..." }: LoadingStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 space-y-4">
			<Loader2 className="size-8 animate-spin text-muted-foreground" />
			<p className="text-muted-foreground">{message}</p>
		</div>
	);
}

interface ErrorStateProps {
	message?: string;
	onRetry?: () => void;
}

function ErrorState({
	message = "Failed to fetch posts",
	onRetry,
}: ErrorStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 space-y-4">
			<AlertCircle className="size-8 text-destructive" />
			<p className="text-destructive font-medium">{message}</p>
			{onRetry && (
				<Button variant="outline" onClick={onRetry}>
					Try Again
				</Button>
			)}
		</div>
	);
}

interface EmptyStateProps {
	message?: string;
}

function EmptyState({ message = "No posts found" }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 space-y-4">
			<ImageIcon className="size-8 text-muted-foreground" />
			<p className="text-muted-foreground">{message}</p>
			<p className="text-sm text-muted-foreground max-w-md text-center">
				Try adjusting your search tags or removing some filters to see more
				results.
			</p>
		</div>
	);
}

export function PostGallery({ tags }: { tags: TagWithMode[] }) {
	const { setPosts, searchState, setSearchState, setScrollPosition } = usePostStore();
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const [sortOrder, setSortOrder] = useState<string>(searchState.sortOrder);
	const [totalCount, setTotalCount] = useState<number | null>(searchState.totalCount);
	const [showBackToTop, setShowBackToTop] = useState(false);
	
	// Modal state
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Scroll handling for back-to-top button and position tracking
	useEffect(() => {
		const handleScroll = () => {
			const scrollY = window.scrollY;
			setShowBackToTop(scrollY > 500);
			// Throttle scroll position updates
			if (Math.abs(scrollY - searchState.scrollPosition) > 100) {
				setScrollPosition(scrollY);
			}
		};

		window.addEventListener("scroll", handleScroll);
		
		// Restore scroll position on mount
		if (searchState.scrollPosition > 0) {
			setTimeout(() => {
				window.scrollTo(0, searchState.scrollPosition);
			}, 100);
		}

		return () => window.removeEventListener("scroll", handleScroll);
	}, []);



	// Sync state changes to store
	useEffect(() => {
		setSearchState({ 
			sortOrder, 
			totalCount,
			tags 
		});
	}, [sortOrder, totalCount, tags, setSearchState]);

	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	// Get all tags including hidden AI filter if enabled (only when other tags are present)
	const getAllTags = () => {
		const allTags = [...tags];

		// Only apply AI filter when there are other search tags present
		if (searchState.filterAI && tags.length > 0) {
			const aiGeneratedTag: TagWithMode = {
				tag: "ai_generated",
				mode: "exclude",
				id: "ai-filter-hidden-generated",
			};

			const aiAssistedTag: TagWithMode = {
				tag: "ai_assisted",
				mode: "exclude",
				id: "ai-filter-hidden-assisted",
			};

			// Only add if not already present
			if (!allTags.some((tag) => tag.tag === "ai_generated" && tag.mode === "exclude")) {
				allTags.push(aiGeneratedTag);
			}
			
			if (!allTags.some((tag) => tag.tag === "ai_assisted" && tag.mode === "exclude")) {
				allTags.push(aiAssistedTag);
			}
		}

		return allTags;
	};

	const effectiveTags = getAllTags();
	const effectiveTagsString = formatTagsForApi(effectiveTags);

	// Client-side post counting using Rule34 API directly
	const { data: countData, isLoading: isCountLoading } = useQuery({
		queryKey: ["postCount", effectiveTagsString, sortOrder],
		queryFn: async (): Promise<number> => {
			if (!effectiveTagsString.trim()) return 0;

			const tagsWithSort = `${effectiveTagsString} sort:${sortOrder}`;
			const LIMIT_PER_PAGE = 50;
			let totalPosts = 0;
			let currentPage = 0;
			let hasMore = true;

			// Linear search through pages until we find a page with fewer posts than the limit
			while (hasMore) {
				const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsWithSort)}&pid=${currentPage}&limit=${LIMIT_PER_PAGE}`;
				
				const response = await fetch(apiUrl);
				if (!response.ok) {
					throw new Error(`API returned ${response.status}`);
				}

				const dataText = await response.text();
				if (!dataText.trim()) {
					// Empty response, no more posts
					hasMore = false;
				} else {
					try {
						const jsonData = JSON.parse(dataText);
						if (Array.isArray(jsonData)) {
							const postsOnThisPage = jsonData.length;
							
							if (postsOnThisPage === 0) {
								// No posts on this page, we're done
								hasMore = false;
							} else if (postsOnThisPage < LIMIT_PER_PAGE) {
								// Fewer posts than limit, this is the last page
								totalPosts = currentPage * LIMIT_PER_PAGE + postsOnThisPage;
								hasMore = false;
							} else {
								// Full page, continue to next page
								currentPage++;
							}
						} else {
							// Invalid response format
							hasMore = false;
						}
					} catch {
						// Parse error, stop searching
						hasMore = false;
					}
				}
			}

			return totalPosts;
		},
		enabled: !!effectiveTagsString.trim(),
		staleTime: 1000 * 60 * 10, // 10 minutes - counts change less frequently
		retry: 1,
	});

	// Update totalCount when query completes
	useEffect(() => {
		if (countData !== undefined) {
			setTotalCount(countData);
		}
	}, [countData]);

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		isError,
		error,
		refetch,
	} = useInfiniteQuery({
		queryKey: ["posts", effectiveTagsString, sortOrder],
		queryFn: async ({ pageParam = 0 }): Promise<Post[]> => {
			if (!effectiveTagsString.trim()) return [];

			// Build Rule34 API URL directly in the browser
			const tagsWithSort = `${effectiveTagsString} sort:${sortOrder}`;
			const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsWithSort)}&pid=${pageParam}&limit=100`;

			console.log("Fetching posts (client-side) →", { apiUrl });

			const response = await fetch(apiUrl);

			if (!response.ok) {
				// Attempt to read JSON error if available
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

			// Handle empty body which signals no more posts
			if (!dataText.trim()) return [];

			let jsonData: unknown;
			try {
				jsonData = JSON.parse(dataText);
			} catch (parseError) {
				console.error("Failed to parse JSON from Rule34 API:", parseError);
				throw new Error("Invalid JSON response from upstream API");
			}

			try {
				const result = PostsApiResponse.parse(jsonData);
				return result;
			} catch (zodError) {
				console.error("Zod parse error, falling back to raw array", zodError);
				if (Array.isArray(jsonData)) return jsonData as Post[];
				throw new Error("Unexpected response structure from Rule34 API");
			}
		},
		enabled: !!effectiveTagsString.trim(),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			// Rule34 API returns an empty array when no more results
			if (!lastPage || lastPage.length === 0) return undefined;
			return allPages.length; // Next pid equals number of pages already fetched
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: 2,
	});

	// Update the store when posts change
	const allPosts = data?.pages.flat() || [];
	useEffect(() => {
		console.log("Query state:", { 
			pagesCount: data?.pages.length || 0,
			totalPosts: allPosts.length,
			hasNextPage,
			isFetchingNextPage 
		});
		if (allPosts.length > 0) {
			setPosts(allPosts);
		}
		// Only update when data changes, not allPosts reference
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data, setPosts]);

	// Intersection Observer for infinite scrolling
	useEffect(() => {
		console.log("IntersectionObserver effect:", { hasNextPage, isFetchingNextPage });
		if (!hasNextPage || isFetchingNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				console.log("IntersectionObserver triggered:", entries[0].isIntersecting);
				if (entries[0].isIntersecting) {
					fetchNextPage();
				}
			},
			{ 
				threshold: 0.1,
				rootMargin: '200px' // Trigger earlier to account for fast scrolling
			},
		);

		const currentRef = loadMoreRef.current;
		if (currentRef) {
			console.log("Observing loadMoreRef");
			observer.observe(currentRef);
		}

		return () => {
			if (currentRef) {
				observer.unobserve(currentRef);
			}
		};
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Fallback scroll-based infinite scroll trigger
	useEffect(() => {
		if (!hasNextPage || isFetchingNextPage) return;

		let scrollTimeout: NodeJS.Timeout;
		const handleScroll = () => {
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				const scrollHeight = document.documentElement.scrollHeight;
				const scrollTop = window.scrollY;
				const clientHeight = window.innerHeight;
				
				// If we're within 800px of the bottom, trigger loading
				if (scrollHeight - (scrollTop + clientHeight) < 800) {
					console.log("Fallback scroll trigger activated");
					fetchNextPage();
				}
			}, 100); // Debounce scroll events
		};

		window.addEventListener("scroll", handleScroll);
		return () => {
			window.removeEventListener("scroll", handleScroll);
			clearTimeout(scrollTimeout);
		};
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Navigation handler
	const handlePostClick = (post: Post) => {
		// Find the actual index of this post in the store's posts array
		const actualIndex = allPosts.findIndex(p => p.id === post.id);
		if (actualIndex !== -1) {
			setSelectedIndex(actualIndex);
			setIsModalOpen(true);
		}
	};

	const handleModalClose = () => {
		setIsModalOpen(false);
		// Clear selected index to avoid stale state
		setSelectedIndex(-1);
	};

	if (isLoading) {
		return <LoadingState />;
	}

	if (isError) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to fetch posts";
		return <ErrorState message={errorMessage} onRetry={() => refetch()} />;
	}

	if (allPosts.length === 0) {
		return <EmptyState />;
	}

	return (
		<div className="w-full px-4 md:px-6 lg:px-8">
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<p className="text-sm text-muted-foreground">
						{allPosts.length.toLocaleString()}
					</p>
					{(isCountLoading || totalCount !== null) && (
						<>
							<span className="text-muted-foreground">/</span>
							{isCountLoading ? (
								<div className="flex items-center gap-1.5">
									<Loader2 className="size-3 animate-spin text-muted-foreground" />
									<span className="text-sm text-muted-foreground">
										counting...
									</span>
								</div>
							) : (
								totalCount !== null && (
									<p className="text-sm text-muted-foreground">
										{totalCount.toLocaleString()}
									</p>
								)
							)}
						</>
					)}
				</div>
				<div className="flex items-center gap-2 sm:gap-3">
					<Select value={sortOrder} onValueChange={setSortOrder}>
						<SelectTrigger className="h-10 w-[140px] sm:w-[180px]">
							<SelectValue placeholder="Sort by..." />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="id:desc">Newest</SelectItem>
							<SelectItem value="id:asc">Oldest</SelectItem>
							<SelectItem value="score:desc">Most Popular</SelectItem>
							<SelectItem value="score:asc">Least Popular</SelectItem>
							<SelectItem value="updated:desc">Recently Updated</SelectItem>
							<SelectItem value="random">Random</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Masonry-style layout with tight spacing */}
			<div 
				className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-2 space-y-0"
				style={{ columnFill: 'balance' }}
			>
				{data?.pages.map((page, pageIndex) => (
					<React.Fragment key={pageIndex}>
						{page.map((post) => (
							<PostCard 
								key={post.id} 
								post={post} 
								onClick={() => handlePostClick(post)} 
							/>
						))}
					</React.Fragment>
				))}
			</div>

			{/* Loading trigger for infinite scroll */}
			<div ref={loadMoreRef} className="mt-8 mb-16 min-h-[100px] flex justify-center items-center">
				{isFetchingNextPage && <LoadingState message="Loading more posts..." />}
				{!hasNextPage && allPosts.length > 0 && (
					<p className="text-muted-foreground text-sm py-8">
						{totalCount !== null && allPosts.length >= totalCount
							? `All ${totalCount.toLocaleString()} posts loaded`
							: "No more posts to load"}
					</p>
				)}
				{/* Invisible trigger element for intersection observer */}
				{hasNextPage && !isFetchingNextPage && (
					<div className="h-px w-full" aria-hidden="true" />
				)}
			</div>

			{/* Back to top button */}
			{showBackToTop && (
				<Button
					onClick={scrollToTop}
					size="icon"
					className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-none shadow-lg"
					aria-label="Back to top"
				>
					<ArrowUp className="size-5" />
				</Button>
			)}

			{/* Post Modal */}
			<PostModal 
				isOpen={isModalOpen}
				onClose={handleModalClose}
				initialIndex={selectedIndex}
			/>
		</div>
	);
}