"use client";

import { useQuery } from "@tanstack/react-query";
import {
	ChevronUp,
	Download,
	ExternalLink,
	Loader2,
	Tag,
	Tags,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "~/components/ui/button";
import type { Post } from "~/lib/types";
import { cn } from "~/lib/utils";

interface PostViewerMobileProps {
	post: Post;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function PostViewerMobile({
	post,
	open,
	onOpenChange,
}: PostViewerMobileProps) {
	const [videoError, setVideoError] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	const [imageError, setImageError] = useState(false);
	const [viewportHeight, setViewportHeight] = useState(0);
	const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const isVideo = post.file_url?.match(/\.(webm|mp4|mov|avi|mkv|m4v)$/i);
	const isGif = post.file_url?.match(/\.gif$/i);

	// Get Rule34 post page URL
	const getRule34PostUrl = () => {
		return `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;
	};

	// Track viewport height to handle mobile browser chrome
	useEffect(() => {
		const updateViewportHeight = () => {
			setViewportHeight(window.visualViewport?.height || window.innerHeight);
		};

		updateViewportHeight();
		window.visualViewport?.addEventListener("resize", updateViewportHeight);
		window.addEventListener("resize", updateViewportHeight);

		return () => {
			window.visualViewport?.removeEventListener(
				"resize",
				updateViewportHeight,
			);
			window.removeEventListener("resize", updateViewportHeight);
		};
	}, []);

	// Use proxy for videos to bypass referrer restrictions
	const getMediaUrl = (url: string, forceProxy = false) => {
		if ((isVideo || forceProxy) && url) {
			return `/api/proxy?url=${encodeURIComponent(url)}`;
		}
		return url;
	};

	// Fetch tag information with categories
	const { data: tagInfo, isLoading: tagsLoading } = useQuery({
		queryKey: ["tags", post.tags],
		queryFn: async () => {
			if (!post.tags || post.tags.trim() === "") return {};

			const response = await fetch(
				`/api/tags?names=${encodeURIComponent(post.tags)}`,
			);
			if (!response.ok) throw new Error("Failed to fetch tag info");
			const data = await response.json();
			return data;
		},
		enabled: open && !!post.tags && post.tags.trim() !== "",
		staleTime: 1000 * 60 * 10, // 10 minutes
	});

	// Group tags by category
	const groupedTags = (() => {
		if (!post.tags || !tagInfo) return {};

		const tags = post.tags.split(" ").filter(Boolean);
		const grouped: { [key: string]: string[] } = {
			artist: [],
			character: [],
			copyright: [],
			general: [],
			meta: [],
		};

		tags.forEach((tag) => {
			const info = tagInfo[tag];
			if (info?.types && info.types.length > 0) {
				const type = info.types[0];
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
	})();

	useEffect(() => {
		if (open && post) {
			// Reset error states when opening a new post
			setVideoError(false);
			setImageError(false);
			setShowDetails(false);

			// Prevent body scroll when viewer is open
			document.body.style.overflow = "hidden";
			document.documentElement.style.overflow = "hidden";
		}

		return () => {
			document.body.style.overflow = "";
			document.documentElement.style.overflow = "";
		};
	}, [open, post]);

	const renderMedia = () => {
		if (isVideo && !videoError) {
			return (
				<video
					ref={mediaRef as React.RefObject<HTMLVideoElement>}
					src={getMediaUrl(post.file_url)}
					controls
					muted
					autoPlay
					loop
					playsInline
					webkit-playsinline="true"
					preload="metadata"
					className="w-full h-full object-contain"
					onError={(e) => {
						console.error("Video failed to load:", post.file_url, e);
						setVideoError(true);
					}}
				/>
			);
		} else if (isVideo && videoError) {
			// Fallback to preview image for failed videos
			return (
				<img
					ref={mediaRef as React.RefObject<HTMLImageElement>}
					src={post.preview_url}
					alt={`Post ${post.id}`}
					className="w-full h-full object-contain"
				/>
			);
		} else if (isGif) {
			// Load full GIF file to preserve animation
			return (
				<img
					ref={mediaRef as React.RefObject<HTMLImageElement>}
					src={post.file_url}
					alt={`Post ${post.id}`}
					className="w-full h-full object-contain"
					onError={(e) => {
						console.error("GIF failed to load:", post.file_url);
						// Fallback to sample or preview if GIF fails
						const img = e.target as HTMLImageElement;
						if (img.src !== post.sample_url && post.sample_url) {
							img.src = post.sample_url;
						} else if (img.src !== post.preview_url) {
							img.src = post.preview_url;
						}
					}}
				/>
			);
		} else {
			// Load full resolution image (file_url) for best quality
			const getImageSrc = () => {
				if (imageError) {
					// On error, fallback to sample_url, then preview_url
					return post.sample_url || post.preview_url;
				}
				// Always use file_url for full resolution
				return post.file_url;
			};

			return (
				<img
					ref={mediaRef as React.RefObject<HTMLImageElement>}
					src={getImageSrc()}
					alt={`Post ${post.id}`}
					className="w-full h-full object-contain"
					loading="eager"
					onError={(e) => {
						console.error(
							"Image failed to load:",
							(e.target as HTMLImageElement).src,
						);
						if (!imageError) {
							setImageError(true);
						}
					}}
				/>
			);
		}
	};

	const handleDownload = async () => {
		try {
			setIsDownloading(true);

			const response = await fetch(
				`/api/proxy?url=${encodeURIComponent(post.file_url)}`,
			);
			if (!response.ok) throw new Error("Download failed");

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);

			const extension = post.file_url.split(".").pop() || "mp4";

			const link = document.createElement("a");
			link.href = url;
			link.download = `post_${post.id}.${extension}`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			setTimeout(() => URL.revokeObjectURL(url), 100);
		} catch (error) {
			console.error("Download failed:", error);
			window.open(post.file_url, "_blank");
		} finally {
			setIsDownloading(false);
		}
	};

	if (!open) return null;

	const content = (
		<div
			ref={containerRef}
			className="fixed inset-0 z-[9999] bg-background dark:bg-black"
			style={{ height: viewportHeight || "100vh" }}
		>
			{/* Header */}
			<div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-white/80 dark:from-black/60 to-transparent p-3">
				<div className="flex justify-between items-center">
					<span className="text-foreground dark:text-white text-sm font-medium">
						Post #{post.id}
					</span>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onOpenChange(false)}
						className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 backdrop-blur-sm text-foreground dark:text-white"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Media container */}
			<div className="absolute inset-0 flex items-center justify-center">
				{renderMedia()}
			</div>

			{/* Bottom sheet */}
			<div
				className={cn(
					"absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl transition-transform duration-300 ease-out",
					showDetails ? "translate-y-0" : "translate-y-[calc(100%-60px)]",
				)}
				style={{ maxHeight: "50vh" }}
			>
				{/* Handle bar */}
				<button
					onClick={() => setShowDetails(!showDetails)}
					className="w-full py-2 flex justify-center"
				>
					<div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
				</button>

				{/* Actions bar */}
				<div className="flex items-center justify-between px-4 pb-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowDetails(!showDetails)}
						className="flex items-center gap-1.5"
					>
						<Tags className="size-4" />
						<span className="text-sm">Tags</span>
						<ChevronUp
							className={cn(
								"size-3 transition-transform",
								showDetails ? "" : "rotate-180",
							)}
						/>
					</Button>

					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => window.open(getRule34PostUrl(), "_blank")}
							className="h-8 w-8"
							title="View on Rule34"
						>
							<ExternalLink className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							disabled={isDownloading}
							onClick={handleDownload}
							className="h-8 w-8"
						>
							{isDownloading ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Download className="size-4" />
							)}
						</Button>
					</div>
				</div>

				{/* Tag details */}
				{showDetails && (
					<div
						className="px-4 pb-4 overflow-y-auto"
						style={{ maxHeight: "calc(50vh - 100px)" }}
					>
						{tagsLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
							</div>
						) : (
							<div className="space-y-3">
								{/* Artists */}
								{groupedTags.artist?.length > 0 && (
									<div>
										<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
											<Tag className="size-3" />
											Artists
										</h3>
										<div className="flex flex-wrap gap-1 mt-1">
											{groupedTags.artist.map((tag) => (
												<span
													key={tag}
													className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full text-xs"
												>
													{tag.replace(/_/g, " ")}
												</span>
											))}
										</div>
									</div>
								)}

								{/* Characters */}
								{groupedTags.character?.length > 0 && (
									<div>
										<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
											<Tag className="size-3" />
											Characters
										</h3>
										<div className="flex flex-wrap gap-1 mt-1">
											{groupedTags.character.map((tag) => (
												<span
													key={tag}
													className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full text-xs"
												>
													{tag.replace(/_/g, " ")}
												</span>
											))}
										</div>
									</div>
								)}

								{/* Copyright */}
								{groupedTags.copyright?.length > 0 && (
									<div>
										<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
											<Tag className="size-3" />
											Series
										</h3>
										<div className="flex flex-wrap gap-1 mt-1">
											{groupedTags.copyright.map((tag) => (
												<span
													key={tag}
													className="px-2 py-0.5 bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400 rounded-full text-xs"
												>
													{tag.replace(/_/g, " ")}
												</span>
											))}
										</div>
									</div>
								)}

								{/* Meta */}
								{groupedTags.meta?.length > 0 && (
									<div>
										<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
											<Tag className="size-3" />
											Meta
										</h3>
										<div className="flex flex-wrap gap-1 mt-1">
											{groupedTags.meta.map((tag) => (
												<span
													key={tag}
													className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-full text-xs"
												>
													{tag.replace(/_/g, " ")}
												</span>
											))}
										</div>
									</div>
								)}

								{/* General */}
								{groupedTags.general?.length > 0 && (
									<div>
										<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
											<Tag className="size-3" />
											General
										</h3>
										<div className="flex flex-wrap gap-1 mt-1">
											{groupedTags.general.map((tag) => (
												<span
													key={tag}
													className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full text-xs"
												>
													{tag.replace(/_/g, " ")}
												</span>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);

	// Portal to render outside of any parent constraints
	if (typeof document !== "undefined") {
		return createPortal(content, document.body);
	}

	return null;
}
