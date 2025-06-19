"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Loader2, Tags, ChevronUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import { PostMedia } from "~/components/post-media";
import { PostActions } from "~/components/post-actions";
import { TagDisplay } from "~/components/tag-display";
import { usePostStore } from "~/lib/post-store";
import { useEffect, useState } from "react";
import type { Post } from "~/lib/types";
import { PostsApiResponse } from "~/lib/types";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { formatTagsForApi } from "~/lib/tag-utils";

export default function PostPage() {
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const postId = params.id as string;
	
	// Get post data from store or URL params
	const { posts, currentIndex, setCurrentIndex, searchState, setPosts, addPosts } = usePostStore();
	const [post, setPost] = useState<Post | null>(null);
	const [tagsLoading, setTagsLoading] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	
	// Format search tags for API
	const effectiveTagsString = formatTagsForApi(searchState.tags);
	
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

			console.log(
				"Fetching posts with tags:",
				effectiveTagsString,
				"sort:",
				searchState.sortOrder,
				"page:",
				pageParam,
			);

			const response = await fetch(
				`/api/posts?tags=${encodeURIComponent(effectiveTagsString)}&page=${pageParam}&sort=${encodeURIComponent(searchState.sortOrder)}`,
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
				return result;
			} catch (parseError) {
				console.error("Zod parse error:", parseError);

				// Fallback: try to use the data as-is if it's an array
				if (Array.isArray(jsonData)) {
					return jsonData as Post[];
				}

				throw new Error("Invalid response format from API");
			}
		},
		enabled: !!effectiveTagsString.trim() && searchState.tags.length > 0,
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			// Rule34 API returns empty array when no more results
			if (!lastPage || lastPage.length === 0) return undefined;
			return allPages.length;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: 2,
	});

	// Update the store when posts change from infinite query
	const allPosts = data?.pages.flat() || [];
	useEffect(() => {
		if (allPosts.length > 0 && searchState.tags.length > 0) {
			setPosts(allPosts);
		}
	}, [data, setPosts, searchState.tags.length]);
	
	// Fetch single post if not in store
	const fetchSinglePost = async () => {
		try {
			const response = await fetch(`/api/posts?tags=id:${postId}`);
			if (response.ok) {
				const data = await response.json();
				if (data && data.length > 0) {
					setPost(data[0]);
					// Add to store as single item
					usePostStore.getState().setPosts([data[0]]);
					setCurrentIndex(0);
				}
			}
		} catch (error) {
			console.error("Failed to fetch post:", error);
		}
	};
	
	// Try to get post from store first
	useEffect(() => {
		const index = parseInt(searchParams.get("index") || "-1");
		const postIdNum = parseInt(postId);
		
		if (index >= 0 && posts[index]?.id === postIdNum) {
			setPost(posts[index]);
			setCurrentIndex(index);
		} else {
			// Find post in store by ID
			const foundIndex = posts.findIndex((p: Post) => p.id === postIdNum);
			if (foundIndex >= 0) {
				setPost(posts[foundIndex]);
				setCurrentIndex(foundIndex);
			} else if (posts.length === 0) {
				// Only fetch if store is empty
				fetchSinglePost();
			}
		}
		// Remove posts from dependencies to avoid infinite loop
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [postId, searchParams]);

	// Mobile detection
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.matchMedia("(max-width: 768px)").matches);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
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
				console.log("Loading next page because we're at the end");
				await fetchNextPage();
				// Wait a moment for the store to update
				setTimeout(() => {
					const updatedPosts = usePostStore.getState().posts;
					if (updatedPosts.length > posts.length) {
						const newPost = updatedPosts[posts.length];
						router.push(`/post/${newPost.id}?index=${posts.length}`);
					}
				}, 100);
				return; // Exit early since we're handling navigation in the setTimeout
			}
		} else if (direction === 'previous' && currentIndex > 0) {
			newIndex = currentIndex - 1;
		}
		
		// Also check if we're near the end and should preload more posts
		if (direction === 'next' && 
			searchState.tags.length > 0 && 
			hasNextPage && 
			!isFetchingNextPage && 
			currentIndex >= posts.length - 3) { // Load when 3 posts remaining
			console.log("Preloading next page because we're near the end");
			fetchNextPage(); // Don't await this one, just preload
		}
		
		if (newIndex !== currentIndex) {
			const newPost = posts[newIndex];
			router.push(`/post/${newPost.id}?index=${newIndex}`);
		}
	};

	const handleClose = () => {
		// Navigate directly to home - search state is persisted so gallery will be restored
		router.push('/');
	};

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleClose();
			} else if (e.key === "ArrowLeft" && hasPrevious) {
				handleNavigate('previous');
			} else if (e.key === "ArrowRight" && hasNext) {
				handleNavigate('next');
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentIndex, posts.length, hasNext, hasPrevious]);

	// Fetch tag information
	const { data: tagInfo } = useQuery({
		queryKey: ["tags", post?.tags],
		queryFn: async () => {
			if (!post?.tags || post.tags.trim() === "") return {};
			
			const response = await fetch(
				`/api/tags?names=${encodeURIComponent(post.tags)}`,
			);
			if (!response.ok) throw new Error("Failed to fetch tag info");
			return response.json();
		},
		enabled: !!post?.tags && post.tags.trim() !== "",
		staleTime: 1000 * 60 * 10,
	});

	if (!post) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Mobile view
	if (isMobile) {
		return (
			<div className="fixed inset-0 z-[9999] bg-black flex flex-col">
				{/* Header */}
				<div className="flex-shrink-0 p-3 bg-black z-50">
					<div className="flex justify-between items-center">
						<div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
							<span className="text-white text-sm font-medium">
								#{post.id}
								{posts.length > 0 && (
									<span className="ml-2 text-xs opacity-70">
										{currentIndex + 1} / {posts.length}
									</span>
								)}
							</span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleClose}
							className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white transition-colors"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Media container */}
				<div className="flex-1 min-h-0 relative flex items-center justify-center bg-black">
					<PostMedia 
						post={post}
						className="max-w-full max-h-full object-contain"
						isMobile={true}
					/>
					
					{/* Navigation buttons */}
					{hasPrevious && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleNavigate('previous')}
							className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white transition-colors"
						>
							<ChevronLeft className="h-5 w-5" />
						</Button>
					)}
					{hasNext && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleNavigate('next')}
							className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white transition-colors"
							disabled={isFetchingNextPage}
						>
							{isFetchingNextPage ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<ChevronRight className="h-5 w-5" />
							)}
						</Button>
					)}
				</div>

				{/* Bottom sheet */}
				<div
					className={`flex-shrink-0 bg-background transition-all duration-300 ease-out z-50 ${
						showDetails ? "h-auto max-h-[250px]" : "h-[60px]"
					}`}
					style={{ 
						minHeight: "60px"
					}}
				>
					{/* Actions bar */}
					<div className="flex items-center justify-between px-4 pt-2 pb-3">
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
								size="sm" 
								maxHeight="120px"
								scrollable={true}
							/>
						</div>
					)}
				</div>
			</div>
		);
	}

	// Desktop view
	return (
		<div className="fixed inset-0 z-[9999] bg-black flex flex-col">
			{/* Header - matching mobile design */}
			<div className="flex-shrink-0 p-3 bg-black z-50">
				<div className="flex justify-between items-center">
					{/* Post info - left side */}
					<div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
							<span className="text-white text-sm font-medium">
								#{post.id}
								{posts.length > 0 && (
									<span className="ml-2 text-xs opacity-70">
										{currentIndex + 1} / {posts.length}
									</span>
								)}
							</span>
						</div>

					{/* Close button - right side */}
					<Button
						variant="ghost"
						size="icon"
						onClick={handleClose}
						className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white transition-colors"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Navigation buttons */}
			{hasPrevious && (
				<Button
					variant="ghost"
					size="icon"
					onClick={() => handleNavigate('previous')}
					className="absolute left-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white transition-colors"
					title="Previous post (←)"
				>
					<ChevronLeft className="h-6 w-6" />
				</Button>
			)}
			{hasNext && (
				<Button
					variant="ghost"
					size="icon"
					onClick={() => handleNavigate('next')}
					className="absolute right-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white transition-colors"
					title="Next post (→)"
					disabled={isFetchingNextPage}
				>
					{isFetchingNextPage ? (
						<Loader2 className="h-5 w-5 animate-spin" />
					) : (
						<ChevronRight className="h-6 w-6" />
					)}
				</Button>
			)}

			{/* Media container */}
			<div className="flex-1 min-h-0 relative flex items-center justify-center bg-black">
				<PostMedia 
					post={post}
					className="max-w-full max-h-full object-contain"
					isMobile={false}
				/>
			</div>

			{/* Bottom sheet - matching mobile design */}
			<div
				className={`flex-shrink-0 bg-background transition-all duration-300 ease-out z-50 ${
					showDetails ? "h-auto max-h-[200px]" : "h-[60px]"
				}`}
				style={{ 
					minHeight: "60px"
				}}
			>

				{/* Actions bar */}
				<div className="flex items-center justify-between px-4 pt-2 pb-3">
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
							maxHeight={isMobile ? "150px" : "120px"}
							scrollable={true}
						/>
					</div>
				)}
			</div>
		</div>
	);
} 