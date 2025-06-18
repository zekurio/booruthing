"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Download, Loader2, Tag, ChevronUp, ChevronDown, Tags, X } from "lucide-react";
import { Post } from "~/lib/types";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";

interface PostDialogProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDialog({ post, open, onOpenChange }: PostDialogProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [useProxyForImage, setUseProxyForImage] = useState(false);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  
  let isMobile = window.matchMedia("(max-width: 600px)").matches;
  
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

  // Fetch tag information with categories
  const { data: tagInfo, isLoading: tagsLoading } = useQuery({
    queryKey: ["tags", post.tags],
    queryFn: async () => {
      if (!post.tags || post.tags.trim() === "") return {};
      
      console.log("Fetching tags for:", post.tags);
      const response = await fetch(`/api/tags?names=${encodeURIComponent(post.tags)}`);
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
    
    const tags = post.tags.split(' ').filter(Boolean);
    const grouped: { [key: string]: string[] } = {
      artist: [],
      character: [],
      copyright: [],
      general: [],
      meta: []
    };
    
    tags.forEach(tag => {
      const info = tagInfo[tag];
      if (info && info.types && info.types.length > 0) {
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
      const { naturalWidth, naturalHeight, videoWidth, videoHeight } = mediaRef.current as any;
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
            console.error('Video failed to load:', post.file_url, e);
            const video = e.target as HTMLVideoElement;
            
            // If on mobile and using direct URL, try proxy as fallback
            if (isMobile && !video.src.includes('/api/proxy')) {
              video.src = `/api/proxy?url=${encodeURIComponent(post.file_url)}`;
            } else {
              setVideoError(true);
            }
          }}
        />
      );
    } else if ((isVideo && videoError) || isGif) {
      // Fallback to image for failed videos or GIFs
      return (
        <img
          ref={mediaRef as React.RefObject<HTMLImageElement>}
          src={post.preview_url}
          alt={`Post ${post.id}`}
          className="max-w-full max-h-full object-contain"
          onLoad={handleMediaLoad}
        />
      );
    } else {
      // Determine which URL to use based on error state
      let imageSrc = post.file_url;
      if (imageError) {
        if (post.sample_url) {
          imageSrc = post.sample_url;
        } else {
          imageSrc = post.preview_url;
        }
      }
      
      return (
        <img
          ref={mediaRef as React.RefObject<HTMLImageElement>}
          src={useProxyForImage ? getMediaUrl(imageSrc, true) : imageSrc}
          alt={`Post ${post.id}`}
          className="max-w-full max-h-full object-contain"
          onLoad={() => {
            console.log('Image loaded successfully:', imageSrc);
            handleMediaLoad();
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            console.error('Image failed to load:', target.src);
            
            // Try different fallback strategies
            if (!useProxyForImage && !imageError) {
              // First, try using proxy for the original URL
              setUseProxyForImage(true);
            } else if (!imageError) {
              // If proxy didn't work, mark as error and let the component re-render with fallback URLs
              setImageError(true);
              setUseProxyForImage(false);
            } else if (post.sample_url && !target.src.includes(post.sample_url)) {
              // Try sample URL directly
              target.src = post.sample_url;
            } else if (!target.src.includes(post.preview_url)) {
              // Final fallback to preview URL
              target.src = post.preview_url;
            }
          }}
        />
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="p-0 overflow-hidden bg-black w-screen h-screen rounded-none flex flex-col"
        style={{
          maxWidth: '100vw',
          maxHeight: '100vh',
          width: '100vw',
          height: '100vh'
        }}
      >
        {/* Add close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute top-2 right-2 z-50 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex flex-col h-full">
          {/* Media container - adjust max height to account for footer */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center">
              {renderMedia()}
            </div>
          </div>
          
          {/* Footer - ensure it's always visible */}
          <div 
            className="bg-background border-t flex flex-col flex-shrink-0 transition-all duration-200" 
            style={{ 
              height: showDetails ? 'min(30vh, 300px)' : '48px',
              minHeight: '48px'
            }}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b min-h-[48px]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Post #{post.id}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                  className="h-6 w-6 p-0"
                  title={showDetails ? "Hide details" : "Show details"}
                >
                  <Tags className="size-4" />
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(post.file_url, '_blank')}
                    className="h-8 w-8 p-0"
                    title="Source"
                  >
                  <ExternalLink className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isDownloading}
                  className="h-8 w-8 p-0"
                  title="Download"
                  onClick={async () => {
                    try {
                      setIsDownloading(true);
                      
                      // Use proxy for all media types to ensure download works
                      const response = await fetch(`/api/proxy?url=${encodeURIComponent(post.file_url)}`);
                      if (!response.ok) throw new Error('Download failed');
                      
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      
                      // Get file extension from URL
                      const extension = post.file_url.split('.').pop() || 'mp4';
                      
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `post_${post.id}.${extension}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      // Clean up the blob URL
                      setTimeout(() => URL.revokeObjectURL(url), 100);
                    } catch (error) {
                      console.error('Download failed:', error);
                      // Fallback to opening in new tab
                      window.open(post.file_url, '_blank');
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
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {tagsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
              {/* Artists */}
              {groupedTags.artist && groupedTags.artist.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2.5 flex items-center gap-1">
                    <Tag className="size-3" />
                    Artists
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {groupedTags.artist.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full text-xs">
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Characters */}
              {groupedTags.character && groupedTags.character.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2.5 flex items-center gap-1">
                    <Tag className="size-3" />
                    Characters
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {groupedTags.character.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full text-xs">
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Copyright */}
              {groupedTags.copyright && groupedTags.copyright.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2.5 flex items-center gap-1">
                    <Tag className="size-3" />
                    Series
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {groupedTags.copyright.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400 rounded-full text-xs">
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Meta */}
              {groupedTags.meta && groupedTags.meta.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2.5 flex items-center gap-1">
                    <Tag className="size-3" />
                    Meta
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {groupedTags.meta.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-full text-xs">
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* General */}
              {groupedTags.general && groupedTags.general.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2.5 flex items-center gap-1">
                    <Tag className="size-3" />
                    General
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {groupedTags.general.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full text-xs">
                        {tag.replace(/_/g, ' ')}
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