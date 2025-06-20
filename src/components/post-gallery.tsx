"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
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

	// Use sample_url for better quality on larger thumbnails, with robust fallbacks
	const thumbnailSrc = imageError
		? null
		: post.file_url?.toLowerCase().includes('.mp4') || post.file_url?.toLowerCase().includes('.webm')
			? post.preview_url
			: post.file_url?.toLowerCase().includes('.jpeg') || post.file_url?.toLowerCase().includes('.jpg')
				? post.sample_url
				: post.file_url || post.sample_url || null;

	return (
		<div
			className="group relative w-full aspect-square bg-muted overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl"
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
					className="w-full h-full object-cover"
					loading="eager"
					onError={() => setImageError(true)}
				/>
			)}
			{/* Dark overlay for text visibility - no gradient, just solid dark */}
			<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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

interface PageSeparatorProps {
	pageNumber: number;
}

function PageSeparator({ pageNumber }: PageSeparatorProps) {
	return (
		<div className="col-span-full flex items-center justify-center py-4 my-4">
			<div className="flex-1 h-px bg-border" />
			<span className="px-4 text-sm text-muted-foreground font-medium">
				Page {pageNumber}
			</span>
			<div className="flex-1 h-px bg-border" />
		</div>
	);
}

export function PostGallery({ tags }: { tags: TagWithMode[] }) {
	const { setPosts, searchState, setSearchState, setScrollPosition } = usePostStore();
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const [sortOrder, setSortOrder] = useState<string>(searchState.sortOrder);
	const [totalCount, setTotalCount] = useState<number | null>(searchState.totalCount);
	const [isCountLoading, setIsCountLoading] = useState(false);
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

	// Get all tags including hidden AI filter if enabled
	const getAllTags = () => {
		const allTags = [...tags];

		if (searchState.filterAI) {
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

	// Fetch total count when tags or sort changes
	useEffect(() => {
		if (!effectiveTagsString.trim()) return;

		setIsCountLoading(true);
		setTotalCount(null);

		const fetchCount = async () => {
			try {
				const response = await fetch(
					`/api/posts/count?tags=${encodeURIComponent(effectiveTagsString)}&sort=${encodeURIComponent(sortOrder)}`,
				);

				if (response.ok) {
					const data = await response.json();
					setTotalCount(data.totalPosts);
				}
			} catch (error) {
				console.error("Failed to fetch post count:", error);
			} finally {
				setIsCountLoading(false);
			}
		};

		fetchCount();
	}, [effectiveTagsString, sortOrder]);

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

			console.log(
				"Fetching posts with tags:",
				effectiveTagsString,
				"sort:",
				sortOrder,
				"page:",
				pageParam,
			);

			const response = await fetch(
				`/api/posts?tags=${encodeURIComponent(effectiveTagsString)}&page=${pageParam}&sort=${encodeURIComponent(sortOrder)}`,
				{
					method: "GET",
					headers: {
						Accept: "application/json",
					},
				},
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error || `HTTP ${response.status}: ${response.statusText}`,
				);
			}

			const jsonData = await response.json();

			try {
				const result = PostsApiResponse.parse(jsonData);
				console.log(`Fetched ${result.length} posts for page ${pageParam}`);
				return result;
			} catch (parseError) {
				console.error("Zod parse error:", parseError);

				// Fallback: try to use the data as-is if it's an array
				if (Array.isArray(jsonData)) {
					console.log(`Fallback: returning ${jsonData.length} posts for page ${pageParam}`);
					return jsonData as Post[];
				}

				throw new Error("Invalid response format from API");
			}
		},
		enabled: !!effectiveTagsString.trim(),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			// Rule34 API returns empty array when no more results
			console.log("getNextPageParam called:", { 
				lastPageLength: lastPage?.length || 0, 
				totalPages: allPages.length,
				nextPage: allPages.length,
				totalPostsLoaded: allPages.flat().length
			});
			// Rule34 returns 60 posts per page normally
			// With AI filtering, we might get fewer, but if we get very few (< 10), 
			// it likely means we're near the end
			if (!lastPage || lastPage.length === 0) return undefined;
			
			// Continue loading if we got a reasonable number of posts
			// This helps with AI filtering where some posts are excluded
			return allPages.length;
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

			{/* Larger grid layout with better spacing */}
			<div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
				{data?.pages.map((page, pageIndex) => (
					<React.Fragment key={pageIndex}>
						{pageIndex > 0 && (
							<div className="hidden sm:block col-span-full">
								<PageSeparator pageNumber={pageIndex + 1} />
							</div>
						)}
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