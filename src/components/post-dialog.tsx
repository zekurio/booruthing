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
import { Dialog, DialogContent } from "~/components/ui/dialog";
import type { Post } from "~/lib/types";

interface PostDialogProps {
	post: Post;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function PostDialog({ post, open, onOpenChange }: PostDialogProps) {
	const [_aspectRatio, setAspectRatio] = useState<number | null>(null);
	const [videoError, setVideoError] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	const [imageError, setImageError] = useState(false);
	const [_useProxyForImage, setUseProxyForImage] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

	// Mobile detection effect
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.matchMedia("(max-width: 640px)").matches);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);

		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	const isVideo = post.file_url?.match(/\.(webm|mp4|mov|avi|mkv|m4v)$/i);
	const isGif = post.file_url?.match(/\.gif$/i);

	// Use proxy for videos to bypass referrer restrictions
	const getMediaUrl = (url: string, forceProxy = false) => {
		if ((isVideo || forceProxy) && url) {
			// Use direct URL for mobile devices if no video error occurred
			if (isMobile && !videoError && !forceProxy) {
				return url;
			}
			return `/api/proxy?url=${encodeURIComponent(url)}`;
		}
		return url;
	};

	// Get Rule34 post page URL
	const getRule34PostUrl = () => {
		return `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;
	};

	// Fetch tag information with categories
	const { data: tagInfo, isLoading: tagsLoading } = useQuery({
		queryKey: ["tags", post.tags],
		queryFn: async () => {
			if (!post.tags || post.tags.trim() === "") return {};

			console.log("Fetching tags for:", post.tags);
			const response = await fetch(
				`/api/tags?names=${encodeURIComponent(post.tags)}`,
			);
			if (!response.ok) throw new Error("Failed to fetch tag info");
			const data = await response.json();
			console.log("Tag info received:", data);
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
				// Tag can have multiple types, use the first one
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
			if (post.width && post.height) {
				setAspectRatio(post.width / post.height);
			}
			// Reset error states when opening a new post
			setVideoError(false);
			setImageError(false);
			setUseProxyForImage(false);
			// Reset details state - hide by default
			setShowDetails(false);
		}
	}, [open, post]);

	const handleMediaLoad = () => {
		if (mediaRef.current) {
			const { naturalWidth, naturalHeight, videoWidth, videoHeight } =
				mediaRef.current as any;
			const width = naturalWidth || videoWidth;
			const height = naturalHeight || videoHeight;

			if (width && height) {
				setAspectRatio(width / height);
			}
		}
	};

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
					className="max-w-full max-h-full object-contain"
					onLoadedMetadata={handleMediaLoad}
					onError={(e) => {
						console.error("Video failed to load:", post.file_url, e);
						const video = e.target as HTMLVideoElement;

						// If on mobile and using direct URL, try proxy as fallback
						if (isMobile && !video.src.includes("/api/proxy")) {
							video.src = `/api/proxy?url=${encodeURIComponent(post.file_url)}`;
						} else {
							setVideoError(true);
						}
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
					className="max-w-full max-h-full object-contain"
					onLoad={handleMediaLoad}
				/>
			);
		} else if (isGif) {
			// Load full GIF file to preserve animation
			return (
				<img
					ref={mediaRef as React.RefObject<HTMLImageElement>}
					src={post.file_url}
					alt={`Post ${post.id}`}
					className="max-w-full max-h-full object-contain"
					onLoad={handleMediaLoad}
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
					className="max-w-full max-h-full object-contain"
					loading="eager"
					onLoad={() => {
						handleMediaLoad();
					}}
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

	// Handle body scroll for mobile portal
	useEffect(() => {
		if (isMobile && open) {
			document.body.style.overflow = "hidden";
			document.documentElement.style.overflow = "hidden";

			return () => {
				document.body.style.overflow = "";
				document.documentElement.style.overflow = "";
			};
		}
	}, [isMobile, open]);

	// Use a portal-based approach for mobile
	if (isMobile) {
		if (!open) return null;

		const mobileContent = (
			<div
				className="fixed inset-0 z-[9999] bg-background dark:bg-black"
				style={{ height: window.visualViewport?.height || "100vh" }}
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
				<div className="absolute inset-0 flex items-center justify-center px-2">
					{renderMedia()}
				</div>

				{/* Bottom sheet */}
				<div
					className={`absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl transition-transform duration-300 ease-out ${
						showDetails ? "translate-y-0" : "translate-y-[calc(100%-60px)]"
					}`}
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
								className={`size-3 transition-transform ${showDetails ? "" : "rotate-180"}`}
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
								onClick={async () => {
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
								}}
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

					{/* Tag details - mobile optimized */}
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
			return createPortal(mobileContent, document.body);
		}

		return null;
	}

	// Desktop version (existing Dialog implementation)
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="p-0 overflow-hidden bg-background dark:bg-black w-screen h-screen rounded-none flex flex-col"
				showCloseButton={false}
				style={{
					maxWidth: "100vw",
					maxHeight: "100vh",
					width: "100vw",
					height: "100vh",
				}}
			>
				{/* Add close button */}
				<Button
					variant="ghost"
					size="icon"
					onClick={() => onOpenChange(false)}
					className="absolute top-2 right-2 z-50 h-9 w-9 rounded-full bg-background/80 hover:bg-background/90 backdrop-blur-sm border border-border/50 shadow-md"
				>
					<X className="h-4 w-4" />
					<span className="sr-only">Close</span>
				</Button>

				<div className="flex flex-col h-full w-full relative">
					{/* Media container - adjust to be properly flexible */}
					<div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
						<div className="relative w-full h-full flex items-center justify-center">
							{renderMedia()}
						</div>
					</div>

					{/* Footer - ensure it's always visible with fixed positioning on mobile */}
					<div
						className="bg-background border-t flex flex-col flex-shrink-0 transition-all duration-200 relative z-40"
						style={{
							height: showDetails ? "min(40vh, 300px)" : "48px",
							minHeight: "48px",
							maxHeight: "40vh",
						}}
					>
						<div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b min-h-[48px] bg-background">
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold">Post #{post.id}</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowDetails(!showDetails)}
									className="h-7 w-7 p-0"
									title={showDetails ? "Hide details" : "Show details"}
								>
									<Tags className="size-3.5 sm:size-4" />
								</Button>
							</div>

							<div className="flex gap-1.5 sm:gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => window.open(getRule34PostUrl(), "_blank")}
									className="h-7 w-7 sm:h-8 sm:w-8 p-0"
									title="View on Rule34"
								>
									<ExternalLink className="size-3.5 sm:size-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									disabled={isDownloading}
									className="h-7 w-7 sm:h-8 sm:w-8 p-0"
									title="Download"
									onClick={async () => {
										try {
											setIsDownloading(true);

											// Use proxy for all media types to ensure download works
											const response = await fetch(
												`/api/proxy?url=${encodeURIComponent(post.file_url)}`,
											);
											if (!response.ok) throw new Error("Download failed");

											const blob = await response.blob();
											const url = URL.createObjectURL(blob);

											// Get file extension from URL
											const extension = post.file_url.split(".").pop() || "mp4";

											const link = document.createElement("a");
											link.href = url;
											link.download = `post_${post.id}.${extension}`;
											document.body.appendChild(link);
											link.click();
											document.body.removeChild(link);

											// Clean up the blob URL
											setTimeout(() => URL.revokeObjectURL(url), 100);
										} catch (error) {
											console.error("Download failed:", error);
											// Fallback to opening in new tab
											window.open(post.file_url, "_blank");
										} finally {
											setIsDownloading(false);
										}
									}}
								>
									{isDownloading ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Download className="size-4" />
									)}
								</Button>
							</div>
						</div>

						{/* Tag information */}
						{showDetails && (
							<div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3">
								{tagsLoading ? (
									<div className="flex items-center justify-center py-6 sm:py-8">
										<Loader2 className="size-5 sm:size-6 animate-spin text-muted-foreground" />
									</div>
								) : (
									<>
										{/* Artists */}
										{groupedTags.artist && groupedTags.artist.length > 0 && (
											<div>
												<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 sm:mb-2.5 flex items-center gap-1">
													<Tag className="size-3" />
													Artists
												</h3>
												<div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
													{groupedTags.artist.map((tag) => (
														<span
															key={tag}
															className="px-1.5 sm:px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full text-[11px] sm:text-xs"
														>
															{tag.replace(/_/g, " ")}
														</span>
													))}
												</div>
											</div>
										)}

										{/* Characters */}
										{groupedTags.character &&
											groupedTags.character.length > 0 && (
												<div>
													<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 sm:mb-2.5 flex items-center gap-1">
														<Tag className="size-3" />
														Characters
													</h3>
													<div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
														{groupedTags.character.map((tag) => (
															<span
																key={tag}
																className="px-1.5 sm:px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full text-[11px] sm:text-xs"
															>
																{tag.replace(/_/g, " ")}
															</span>
														))}
													</div>
												</div>
											)}

										{/* Copyright */}
										{groupedTags.copyright &&
											groupedTags.copyright.length > 0 && (
												<div>
													<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 sm:mb-2.5 flex items-center gap-1">
														<Tag className="size-3" />
														Series
													</h3>
													<div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
														{groupedTags.copyright.map((tag) => (
															<span
																key={tag}
																className="px-1.5 sm:px-2 py-0.5 bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400 rounded-full text-[11px] sm:text-xs"
															>
																{tag.replace(/_/g, " ")}
															</span>
														))}
													</div>
												</div>
											)}

										{/* Meta */}
										{groupedTags.meta && groupedTags.meta.length > 0 && (
											<div>
												<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 sm:mb-2.5 flex items-center gap-1">
													<Tag className="size-3" />
													Meta
												</h3>
												<div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
													{groupedTags.meta.map((tag) => (
														<span
															key={tag}
															className="px-1.5 sm:px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-full text-[11px] sm:text-xs"
														>
															{tag.replace(/_/g, " ")}
														</span>
													))}
												</div>
											</div>
										)}

										{/* General */}
										{groupedTags.general && groupedTags.general.length > 0 && (
											<div>
												<h3 className="text-xs font-semibold text-muted-foreground mb-1.5 sm:mb-2.5 flex items-center gap-1">
													<Tag className="size-3" />
													General
												</h3>
												<div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
													{groupedTags.general.map((tag) => (
														<span
															key={tag}
															className="px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full text-[11px] sm:text-xs"
														>
															{tag.replace(/_/g, " ")}
														</span>
													))}
												</div>
											</div>
										)}
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
