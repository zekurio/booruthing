"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Image from "next/image";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
// Media Chrome React wrappers
import {
	MediaController,
	MediaControlBar,
	MediaPlayButton,
	MediaMuteButton,
	MediaVolumeRange,
	MediaTimeRange,
	MediaTimeDisplay,
	MediaFullscreenButton,
	MediaSeekBackwardButton,
	MediaSeekForwardButton,
} from "media-chrome/react";

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
	const [useProxy, setUseProxy] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	const isVideo = isVideoFile(post.file_url);
	const isGif = isGifFile(post.file_url);

	// Forward ref properly for video element
	useImperativeHandle(ref, () => {
		if (isVideo && videoRef.current) {
			return videoRef.current;
		}
		return null as any;
	}, [isVideo]);

	// Mobile fullscreen and orientation handling
	useEffect(() => {
		if (!isVideo || !isMobile || !videoRef.current) return;

		let previousOrientation: OrientationType | null = null;

		const handleFullscreenChange = async () => {
			if (!videoRef.current) return;

			// Check if we're in fullscreen
			const isFullscreen = !!(document.fullscreenElement || 
				(document as any).webkitFullscreenElement ||
				(document as any).mozFullScreenElement ||
				(document as any).msFullscreenElement);

			if (isFullscreen) {
				// Store current orientation
				if ('orientation' in screen && screen.orientation) {
					previousOrientation = screen.orientation.type;
				}

				// Try to lock orientation to current orientation to prevent rotation
				if ('orientation' in screen && screen.orientation && 'lock' in screen.orientation) {
					try {
						// Lock to current orientation
						await (screen.orientation as any).lock('any').catch(() => {
							// If 'any' fails, try current orientation
							if (screen.orientation.type.includes('portrait')) {
								return (screen.orientation as any).lock('portrait').catch(() => {});
							} else {
								return (screen.orientation as any).lock('landscape').catch(() => {});
							}
						});
					} catch (err) {
						// Orientation lock not supported or failed
						console.log('Orientation lock not supported');
					}
				}

				// Force resize for Chrome
				setTimeout(() => {
					window.dispatchEvent(new Event('resize'));
				}, 100);
			} else {
				// Unlock orientation when exiting fullscreen
				if ('orientation' in screen && screen.orientation && 'unlock' in screen.orientation) {
					try {
						(screen.orientation as any).unlock();
					} catch (err) {
						// Ignore unlock errors
					}
				}
			}
		};

		// Prevent fullscreen exit on orientation change
		const handleOrientationChange = (e: Event) => {
			const isFullscreen = !!(document.fullscreenElement || 
				(document as any).webkitFullscreenElement ||
				(document as any).mozFullScreenElement ||
				(document as any).msFullscreenElement);

			if (isFullscreen && videoRef.current) {
				// Prevent default behavior
				e.preventDefault();
				
				// Re-request fullscreen if it was lost
				setTimeout(() => {
					if (!document.fullscreenElement && videoRef.current) {
						const requestFullscreen = videoRef.current.requestFullscreen ||
							(videoRef.current as any).webkitRequestFullscreen ||
							(videoRef.current as any).mozRequestFullScreen ||
							(videoRef.current as any).msRequestFullscreen;
						
						if (requestFullscreen) {
							requestFullscreen.call(videoRef.current).catch(() => {});
						}
					}
				}, 100);
			}
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);
		document.addEventListener('MSFullscreenChange', handleFullscreenChange);
		
		window.addEventListener('orientationchange', handleOrientationChange);
		if ('orientation' in screen && screen.orientation) {
			screen.orientation.addEventListener('change', handleOrientationChange);
		}

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
			
			window.removeEventListener('orientationchange', handleOrientationChange);
			if ('orientation' in screen && screen.orientation) {
				screen.orientation.removeEventListener('change', handleOrientationChange);
			}
		};
	}, [isVideo, isMobile]);

	const handleMediaLoad = () => {
		if (onLoad) {
			onLoad();
		}
	};

	if (isVideo && !videoError) {
		const videoUrl = useProxy
			? `/api/proxy?url=${encodeURIComponent(post.file_url)}`
			: getMediaUrl(post.file_url, false);

		return (
			<MediaController
				style={{
					width: "100%",
					height: "100%",
					backgroundColor: "black",
					maxWidth: "100vw",
					maxHeight: "100vh",
					objectFit: "contain",
				}}
				className={className || "max-w-full max-h-full"}
			>
				<video
					slot="media"
					ref={videoRef}
					src={videoUrl}
					autoPlay
					muted
					loop
					playsInline
					crossOrigin="anonymous"
					poster={post.preview_url}
					onLoadedMetadata={handleMediaLoad}
					onError={() => {
						console.error("Video failed to load:", post.file_url);

						// If on mobile and not already using proxy, try proxy as fallback
						if (isMobile && !useProxy) {
							setUseProxy(true);
						} else {
							// If proxy also failed or not on mobile, show error
							setVideoError(true);
						}
					}}
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>

				{/* Basic mobile-friendly control bar */}
				<MediaControlBar>
					<MediaPlayButton />
					<MediaSeekBackwardButton seekOffset={10} />
					<MediaSeekForwardButton seekOffset={10} />
					<MediaTimeRange />
					<MediaTimeDisplay showDuration />
					<MediaMuteButton />
					<MediaVolumeRange />
					<MediaFullscreenButton />
				</MediaControlBar>
			</MediaController>
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