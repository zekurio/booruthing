import {
	Maximize as FullscreenIcon,
	VolumeX as MuteIcon,
	Pause as PauseIcon,
	Play as PlayIcon,
	Volume2 as VolumeIcon,
} from "lucide-react";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";

interface VideoPlayerProps {
	src: string;
	poster?: string;
	autoPlay?: boolean;
	loop?: boolean;
	isMobile?: boolean;
	onLoaded?: () => void;
	onError?: () => void;
	className?: string;
}

/**
 * Custom HTML5 video player with shadcn/ui controls.
 */
export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
	(
		{
			src,
			poster,
			autoPlay = true,
			loop = true,
			isMobile = false,
			onLoaded,
			onError,
			className,
		},
		ref,
	) => {
		const videoRef = useRef<HTMLVideoElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);

		// Expose video element ref
		useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

		// Player state
		const [isPlaying, setIsPlaying] = useState(autoPlay);
		const [isMuted, setIsMuted] = useState(true);
		const [volume, setVolume] = useState(0.5);
		const [progress, setProgress] = useState(0);
		const [duration, setDuration] = useState(0);
		const [isFullscreen, setIsFullscreen] = useState(false);

		// Update progress timer
		useEffect(() => {
			const video = videoRef.current;
			if (!video) return;

			const handleTimeUpdate = () => {
				setProgress(video.currentTime);
			};
			const handleDurationChange = () => setDuration(video.duration || 0);

			video.addEventListener("timeupdate", handleTimeUpdate);
			video.addEventListener("durationchange", handleDurationChange);
			return () => {
				video.removeEventListener("timeupdate", handleTimeUpdate);
				video.removeEventListener("durationchange", handleDurationChange);
			};
		}, []);

		// Fullscreen listeners
		useEffect(() => {
			const handleFsChange = () => {
				const fsElement =
					document.fullscreenElement ||
					(document as any).webkitFullscreenElement ||
					(document as any).mozFullScreenElement ||
					(document as any).msFullscreenElement;
				setIsFullscreen(!!fsElement);
			};

			document.addEventListener("fullscreenchange", handleFsChange);
			document.addEventListener("webkitfullscreenchange", handleFsChange);
			document.addEventListener("mozfullscreenchange", handleFsChange);
			document.addEventListener("MSFullscreenChange", handleFsChange);

			return () => {
				document.removeEventListener("fullscreenchange", handleFsChange);
				document.removeEventListener("webkitfullscreenchange", handleFsChange);
				document.removeEventListener("mozfullscreenchange", handleFsChange);
				document.removeEventListener("MSFullscreenChange", handleFsChange);
			};
		}, []);

		// Orientation lock on mobile when in fullscreen
		useEffect(() => {
			if (!isMobile) return;
			let _previousOrientation: OrientationType | null = null;

			const lockOrientation = async () => {
				if ("orientation" in screen && screen.orientation) {
					_previousOrientation = screen.orientation.type;
					try {
						await (screen.orientation as any).lock("any").catch(() => {});
					} catch (_) {}
				}
			};

			const unlockOrientation = () => {
				if (
					"orientation" in screen &&
					screen.orientation &&
					"unlock" in screen.orientation
				) {
					try {
						(screen.orientation as any).unlock();
					} catch (_) {}
				}
			};

			if (isFullscreen) {
				lockOrientation();
			} else {
				unlockOrientation();
			}
		}, [isFullscreen, isMobile]);

		// Orientation change can cause some mobile browsers to exit fullscreen. Re-enter it automatically.
		useEffect(() => {
			if (!isMobile) return;

			/**
			 * Some mobile browsers (especially Safari) exit fullscreen automatically
			 * when the user rotates the device. We try to re-enter fullscreen a few
			 * times after the orientation change because the browser may still be
			 * processing the transition when the first attempt occurs.
			 */
			const attemptReenterFullscreen = () => {
				const MAX_RETRIES = 4;
				let tries = 0;

				const tryRequest = () => {
					const fsElement =
						document.fullscreenElement ||
						(document as any).webkitFullscreenElement ||
						(document as any).mozFullScreenElement ||
						(document as any).msFullscreenElement;

					// If we are no longer fullscreen, request it again.
					if (!fsElement) {
						// Prefer the container, fall back to the <video> element (required on Safari < 16)
						const target = containerRef.current || videoRef.current;
						if (target) {
							const request =
								target.requestFullscreen ||
								(target as any).webkitRequestFullscreen ||
								(target as any).webkitEnterFullscreen || // iOS Safari proprietary
								(target as any).mozRequestFullScreen ||
								(target as any).msRequestFullscreen;

							if (typeof request === "function") {
								try {
									request.call(target);
								} catch (_) {
									/* silently fail */
								}
							}
						}
					}

					// Retry a few times in case the first request is ignored.
					tries += 1;
					if (!document.fullscreenElement && tries < MAX_RETRIES) {
						setTimeout(tryRequest, 200);
					}
				};

				// Slight delay to allow the browser to exit fullscreen first.
				setTimeout(tryRequest, 100);
			};

			window.addEventListener("orientationchange", attemptReenterFullscreen);
			if ("orientation" in screen && screen.orientation) {
				screen.orientation.addEventListener("change", attemptReenterFullscreen);
			}

			return () => {
				window.removeEventListener(
					"orientationchange",
					attemptReenterFullscreen,
				);
				if ("orientation" in screen && screen.orientation) {
					screen.orientation.removeEventListener(
						"change",
						attemptReenterFullscreen,
					);
				}
			};
		}, [isMobile]);

		// Play / Pause toggle
		const togglePlay = () => {
			const video = videoRef.current;
			if (!video) return;
			if (video.paused) {
				video.play();
				setIsPlaying(true);
			} else {
				video.pause();
				setIsPlaying(false);
			}
		};

		// Mute toggle
		const toggleMute = () => {
			const video = videoRef.current;
			if (!video) return;
			const newMuted = !isMuted;
			video.muted = newMuted;
			setIsMuted(newMuted);
		};

		// Handle volume change
		const handleVolumeChange = (value: number[]) => {
			const vol = value[0] ?? 0;
			setVolume(vol);
			const video = videoRef.current;
			if (video) {
				video.volume = vol;
				if (vol > 0) {
					video.muted = false;
					setIsMuted(false);
				}
			}
		};

		// Seek handler
		const handleSeek = (value: number[]) => {
			const time = value[0] ?? 0;
			const video = videoRef.current;
			if (video) {
				video.currentTime = time;
				setProgress(time);
			}
		};

		// Fullscreen handler
		const toggleFullscreen = () => {
			if (!containerRef.current) return;
			if (!isFullscreen) {
				const request =
					containerRef.current.requestFullscreen ||
					(containerRef.current as any).webkitRequestFullscreen ||
					(containerRef.current as any).mozRequestFullScreen ||
					(containerRef.current as any).msRequestFullscreen;
				if (request) request.call(containerRef.current);
			} else {
				const exit =
					document.exitFullscreen ||
					(document as any).webkitExitFullscreen ||
					(document as any).mozCancelFullScreen ||
					(document as any).msExitFullscreen;
				if (exit) exit.call(document);
			}
		};

		// Update mute/volume defaults on mount
		useEffect(() => {
			const video = videoRef.current;
			if (video) {
				video.muted = isMuted;
				video.volume = volume;
			}
		}, [isMuted, volume]);

			// Format time helper
	const formatTime = (seconds: number) => {
		if (!isFinite(seconds)) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const sliderStyle =
		"[&_>[data-slot=slider-track]]:bg-white/30 [&_>[data-slot=slider-range]]:bg-white [&_>[data-slot=slider-thumb]]:bg-white [&_>[data-slot=slider-thumb]]:border-white";

	return (
			<div
				ref={containerRef}
				className={`relative w-full h-full bg-black flex items-center justify-center ${className || ""}`}
				style={{ maxWidth: "100vw", maxHeight: "100vh" }}
			>
				<video
					ref={videoRef}
					src={src}
					poster={poster}
					className="w-full h-full object-contain cursor-pointer"
					playsInline
					autoPlay={autoPlay}
					loop={loop}
					muted={isMuted}
					onLoadedMetadata={onLoaded}
					onError={onError}
					onClick={togglePlay}
				/>

				{/* Controls overlay */}
				<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-6 flex flex-col gap-1 select-none">
					{/* Seek */}
					{duration > 0 && (
						<Slider
							value={[progress]}
							max={duration}
							step={0.1}
							onValueChange={handleSeek}
							className={`w-full h-2 ${sliderStyle}`}
						/>
					)}

					{/* Control row */}
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-1.5">
							{/* Play/Pause */}
							<Button
								variant="ghost"
								size="icon"
								onClick={togglePlay}
								className="h-7 w-7 text-white hover:bg-white/20"
							>
								{isPlaying ? (
									<PauseIcon className="h-4 w-4" />
								) : (
									<PlayIcon className="h-4 w-4" />
								)}
							</Button>

							{/* Mute */}
							<Button
								variant="ghost"
								size="icon"
								onClick={toggleMute}
								className="h-7 w-7 text-white hover:bg-white/20"
							>
								{isMuted ? (
									<MuteIcon className="h-4 w-4" />
								) : (
									<VolumeIcon className="h-4 w-4" />
								)}
							</Button>

							{/* Volume slider */}
					
							<Slider
								value={[volume]}
								max={1}
								step={0.01}
								onValueChange={handleVolumeChange}
								className={`w-24 ${sliderStyle}`}
							/>
						
						</div>

						<div className="flex items-center gap-1.5">
							{/* Duration display */}
							{duration > 0 && (
								<span className="text-white text-xs font-mono whitespace-nowrap">
									{formatTime(progress)} / {formatTime(duration)}
								</span>
							)}
							{/* Fullscreen */}
							<Button
								variant="ghost"
								size="icon"
								onClick={toggleFullscreen}
								className="h-7 w-7 text-white hover:bg-white/20"
							>
								<FullscreenIcon className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	},
);