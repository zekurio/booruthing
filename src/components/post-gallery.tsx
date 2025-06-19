"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, Cpu, Image as ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PostDialog } from "~/components/post-dialog";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Toggle } from "~/components/ui/toggle";
import { type Post, PostsApiResponse, type TagWithMode } from "~/lib/types";

const formatTagsForApi = (tags: TagWithMode[]): string => {
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
};

interface PostCardProps {
	post: Post;
}

function PostCard({ post }: PostCardProps) {
	const [imageError, setImageError] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	// Check if mobile on mount
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.matchMedia("(max-width: 640px)").matches);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);

		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Use sample_url (higher quality) on mobile, preview_url on desktop
	const thumbnailSrc = imageError
		? null
		: isMobile
			? post.sample_url || post.preview_url
			: post.preview_url || post.sample_url;

	return (
		<>
			<div
				className="group relative w-full aspect-square bg-muted rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
				onClick={() => setDialogOpen(true)}
			>
				{!thumbnailSrc ? (
					<div className="w-full h-full flex items-center justify-center bg-muted">
						<ImageIcon className="size-12 text-muted-foreground" />
					</div>
				) : (
					<img
						src={thumbnailSrc}
						alt={`Post ${post.id}`}
						className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
						loading="lazy"
						onError={() => setImageError(true)}
					/>
				)}
				<div className="absolute inset-0 bg-gradient-to-t from-white/90 dark:from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
				<div className="absolute bottom-2 left-2 right-2 text-foreground dark:text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
					<div className="font-medium truncate">Post #{post.id}</div>
					<div className="text-foreground/70 dark:text-white/80 text-xs">
						{post.width} × {post.height}
					</div>
				</div>
			</div>

			<PostDialog post={post} open={dialogOpen} onOpenChange={setDialogOpen} />
		</>
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
	const _tagsString = formatTagsForApi(tags);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const [sortOrder, setSortOrder] = useState<string>("id:desc");
	const [filterAI, setFilterAI] = useState(false);
	const [totalCount, setTotalCount] = useState<number | null>(null);
	const [isCountLoading, setIsCountLoading] = useState(false);

	// Get all tags including hidden AI filter if enabled
	const getAllTags = () => {
		const allTags = [...tags];

		if (filterAI) {
			const aiFilterTag: TagWithMode = {
				tag: "ai*",
				mode: "exclude",
				id: "ai-filter-hidden",
			};

			// Only add if not already present
			if (!allTags.some((tag) => tag.tag === "ai*" && tag.mode === "exclude")) {
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
		enabled: !!effectiveTagsString.trim(),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			// Rule34 API returns empty array when no more results
			if (!lastPage || lastPage.length === 0) return undefined;
			return allPages.length;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: 2,
	});

	// Intersection Observer for infinite scrolling
	useEffect(() => {
		if (!hasNextPage || isFetchingNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					fetchNextPage();
				}
			},
			{ threshold: 0.1 },
		);

		const currentRef = loadMoreRef.current;
		if (currentRef) {
			observer.observe(currentRef);
		}

		return () => {
			if (currentRef) {
				observer.unobserve(currentRef);
			}
		};
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const allPosts = data?.pages.flat() || [];

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
		<div className="w-full max-w-7xl mx-auto px-4">
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<p className="text-sm text-muted-foreground">
						{allPosts.length.toLocaleString()} posts loaded
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
										{totalCount.toLocaleString()} total
									</p>
								)
							)}
						</>
					)}
				</div>
				<div className="flex items-center gap-2 sm:gap-3">
					<Toggle
						pressed={filterAI}
						onPressedChange={setFilterAI}
						size="sm"
						variant="outline"
						aria-label="Toggle AI filter"
						title={
							filterAI ? "AI content is filtered" : "Click to filter AI content"
						}
						className={
							filterAI
								? "data-[state=on]:bg-red-100 data-[state=on]:text-red-800 dark:data-[state=on]:bg-red-900/30 dark:data-[state=on]:text-red-400"
								: ""
						}
					>
						<Cpu className="size-4" />
						<span className="hidden sm:inline">
							{filterAI ? "AI Filtered" : "Filter AI"}
						</span>
					</Toggle>
					<Select value={sortOrder} onValueChange={setSortOrder}>
						<SelectTrigger className="w-[140px] sm:w-[180px]">
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
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
				{allPosts.map((post) => (
					<PostCard key={post.id} post={post} />
				))}
			</div>

			{/* Loading trigger for infinite scroll */}
			<div ref={loadMoreRef} className="mt-8 flex justify-center">
				{isFetchingNextPage && <LoadingState message="Loading more posts..." />}
				{!hasNextPage && allPosts.length > 0 && (
					<p className="text-muted-foreground text-sm py-8">
						{totalCount !== null && allPosts.length >= totalCount
							? `All ${totalCount.toLocaleString()} posts loaded`
							: "No more posts to load"}
					</p>
				)}
			</div>
		</div>
	);
}
