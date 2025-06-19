"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Image from "next/image";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import type { Post } from "~/lib/types";
import { getMediaUrl, isGifFile, isVideoFile } from "~/lib/media-utils";

interface PostMediaProps {
	post: Post;
	onLoad?: () => void;
	className?: string;
	isMobile?: boolean;
}

export const PostMedia = forwardRef<
	HTMLImageElement | HTMLVideoElement,
	PostMediaProps
>(({ post, onLoad, className, isMobile = false }, ref) => {
	const [videoError, setVideoError] = useState(false);
	const [imageError, setImageError] = useState(false);

	const isVideo = isVideoFile(post.file_url);
	const isGif = isGifFile(post.file_url);

	// Handle fullscreen persistence on orientation change
	useEffect(() => {
		if (!isVideo || !isMobile) return;

		const handleFullscreenChange = () => {
			const videoElement = ref && 'current' in ref ? ref.current as HTMLVideoElement : null;
			if (!videoElement) return;

			// Store fullscreen state
			const isFullscreen = !!(document.fullscreenElement || 
				(document as any).webkitFullscreenElement ||
				(document as any).mozFullScreenElement ||
				(document as any).msFullscreenElement);

			if (isFullscreen) {
				// Apply mobile fullscreen fixes
				document.body.style.overflow = 'hidden';
				document.documentElement.style.overflow = 'hidden';
				
				// Force background color to prevent white lines
				videoElement.style.background = 'black';
				videoElement.style.position = 'fixed';
				// Pin to all screen edges to avoid sub-pixel gaps (white lines)
				videoElement.style.top = '0';
				videoElement.style.left = '0';
				videoElement.style.right = '0';
				videoElement.style.bottom = '0';
				// Use full viewport units to ensure proper coverage
				videoElement.style.width = '100vw';
				videoElement.style.height = '100vh';
				videoElement.style.objectFit = 'contain';
				videoElement.style.zIndex = '9999';
				
				// Lock orientation if possible (experimental API)
				try {
					if ('orientation' in screen && 'lock' in (screen.orientation as any)) {
						(screen.orientation as any).lock('landscape').catch(() => {
							// Orientation lock not supported or failed
						});
					}
				} catch {
					// Orientation API not supported
				}
			} else {
				// Reset body overflow
				document.body.style.overflow = '';
				document.documentElement.style.overflow = '';
				
				// Reset video styles
				videoElement.style.position = '';
				videoElement.style.top = '';
				videoElement.style.left = '';
				videoElement.style.right = '';
				videoElement.style.bottom = '';
				videoElement.style.width = '';
				videoElement.style.height = '';
				videoElement.style.zIndex = '';
				
				// Unlock orientation when exiting fullscreen
				try {
					if ('orientation' in screen && screen.orientation) {
						screen.orientation.unlock();
					}
				} catch {
					// Orientation API not supported
				}
			}
		};

		// Handle viewport changes on mobile
		const handleViewportChange = () => {
			const videoElement = ref && 'current' in ref ? ref.current as HTMLVideoElement : null;
			if (!videoElement) return;
			
			const isFullscreen = !!(document.fullscreenElement || 
				(document as any).webkitFullscreenElement ||
				(document as any).mozFullScreenElement ||
				(document as any).msFullscreenElement);
				
			if (isFullscreen) {
				// Reapply fullscreen styles on viewport change
				setTimeout(() => {
					videoElement.style.height = '100vh';
					videoElement.style.width = '100vw';
				}, 50);
			}
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);
		document.addEventListener('MSFullscreenChange', handleFullscreenChange);
		
		// Listen for viewport changes (mobile keyboard, orientation, etc.)
		window.addEventListener('resize', handleViewportChange);
		window.visualViewport?.addEventListener('resize', handleViewportChange);

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
			window.removeEventListener('resize', handleViewportChange);
			window.visualViewport?.removeEventListener('resize', handleViewportChange);
		};
	}, [isVideo, isMobile, ref]);

	const handleMediaLoad = () => {
		if (onLoad) {
			onLoad();
		}
	};

	if (isVideo && !videoError) {
		// Create video props object with proper attribute names
		const videoProps: React.VideoHTMLAttributes<HTMLVideoElement> = {
			src: getMediaUrl(post.file_url, false),
			controls: true,
			muted: true,
			autoPlay: true,
			loop: true,
			playsInline: true,
			preload: "metadata",
			controlsList: "nodownload",
			disablePictureInPicture: false,
			className: className || "max-w-full max-h-full object-contain",
			style: {
				WebkitTapHighlightColor: "transparent",
				backgroundColor: "black",
				margin: 0,
				padding: 0,
				// Fix for mobile fullscreen white line
				...(isMobile && {
					// Ensure video covers entire screen in fullscreen
					position: "relative",
					width: "100%",
					height: "100%",
					// Prevent white lines during fullscreen transitions
					WebkitTransform: "translateZ(0)",
					transform: "translateZ(0)",
					// Handle safe area insets on mobile
					WebkitMaskImage: "-webkit-radial-gradient(white, black)",
				}),
			},
			onLoadedMetadata: handleMediaLoad,
			onError: (e) => {
				console.error("Video failed to load:", post.file_url, e);
				const video = e.target as HTMLVideoElement;

				// If on mobile and using direct URL, try proxy as fallback
				if (isMobile && !video.src.includes("/api/proxy")) {
					video.src = `/api/proxy?url=${encodeURIComponent(post.file_url)}`;
				} else {
					setVideoError(true);
				}
			},
		};

		// Add webkit attributes as lowercase data attributes
		return (
			<video
				ref={ref as React.RefObject<HTMLVideoElement>}
				{...videoProps}
				data-webkit-playsinline="true"
				data-x5-playsinline="true"
				data-webkit-allowsinlinemediaplayback="true"
			/>
		);
	}

	if (isVideo && videoError) {
		// Fallback to preview image for failed videos
		return (
			<img
				ref={ref as React.RefObject<HTMLImageElement>}
				src={post.preview_url}
				alt={`Post ${post.id}`}
				className={className || "max-w-full max-h-full object-contain"}
				onLoad={handleMediaLoad}
			/>
		);
	}

	if (isGif) {
		// Load full GIF file to preserve animation
		return (
			<img
				ref={ref as React.RefObject<HTMLImageElement>}
				src={post.file_url}
				alt={`Post ${post.id}`}
				className={className || "max-w-full max-h-full object-contain"}
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
	}

	// Regular images
	const getImageSrc = () => {
		if (imageError) {
			// On error, fallback to sample_url, then preview_url
			return post.sample_url || post.preview_url;
		}
		// Always use file_url for full resolution
		return post.file_url;
	};

	return (
		<TransformWrapper
			wheel={{ disabled: false }}
			pinch={{ disabled: false }}
			doubleClick={{ disabled: false }}
		>
			<TransformComponent
				wrapperStyle={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
				contentStyle={{ width: "100%", height: "100%" }}
			>
				<Image
					ref={ref as React.RefObject<HTMLImageElement>}
					src={getImageSrc()}
					alt={`Post ${post.id}`}
					width={post.width}
					height={post.height}
					unoptimized
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
					className={className || "select-none"}
					sizes="100vw"
					priority
					onLoad={handleMediaLoad}
				/>
			</TransformComponent>
		</TransformWrapper>
	);
});

PostMedia.displayName = "PostMedia"; 