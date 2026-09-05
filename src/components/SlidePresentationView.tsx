import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Shuffle,
  Maximize2,
  Minimize2,
  Sparkles,
  Heart,
  ThumbsUp,
  Star,
  Smile,
  Calendar,
  User,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  Minus,
  X,
  Volume2,
  MessageCircle,
  Bookmark,
  Send,
  MoreHorizontal,
  CheckCircle2
} from 'lucide-react';
import { StoryItem, RosterStudent, WEEKS_LIST, isWeekMatch } from '../types';
import { InstagramStoryBar } from './InstagramStoryBar';
import { WeekTabBar } from './WeekTabBar';
import { RefreshCw, Camera } from 'lucide-react';
import { findPhotoForStudent } from '../lib/idb';

interface SlidePresentationViewProps {
  stories: StoryItem[];
  selectedWeek: string;
  setSelectedWeek?: (week: string) => void;
  selectedClass?: string;
  setSelectedClass?: (cName: string) => void;
  roster?: RosterStudent[];
  onUpdateReaction: (storyId: string, emoji: string) => void;
  onOpenAddModal?: () => void;
}

const SlideAvatar: React.FC<{ photoUrl?: string; studentName: string }> = ({ photoUrl, studentName }) => {
  const [currentUrl, setCurrentUrl] = useState(photoUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!photoUrl || photoUrl.startsWith('idb:')) {
      findPhotoForStudent(studentName).then((cached) => {
        if (cached && !cached.startsWith('idb:')) {
          setCurrentUrl(cached);
          setHasError(false);
        } else {
          setCurrentUrl(undefined);
        }
      });
    } else {
      setCurrentUrl(photoUrl);
      setHasError(false);
    }
  }, [photoUrl, studentName]);

  const handleAvatarError = async () => {
    try {
      const cached = await findPhotoForStudent(studentName);
      if (cached && !cached.startsWith('idb:') && cached !== currentUrl) {
        setCurrentUrl(cached);
        setHasError(false);
        return;
      }
    } catch {}
    setHasError(true);
  };

  if (currentUrl && !currentUrl.startsWith('idb:') && !hasError) {
    return (
      <img
        src={currentUrl}
        alt=""
        onError={handleAvatarError}
        className="w-full h-full object-cover rounded-full"
      />
    );
  }

  const displayName = studentName.length >= 2 ? studentName.slice(-2) : studentName;

  return (
    <div className="w-full h-full rounded-full bg-linear-to-br from-amber-500 to-pink-500 flex items-center justify-center text-white text-xs sm:text-sm font-extrabold select-none shadow-xs">
      {displayName}
    </div>
  );
};

interface SlidePhotoProps {
  src?: string;
  alt: string;
  studentName?: string;
  style?: React.CSSProperties;
  className?: string;
  fallbackIndex?: number;
  fitMode?: 'contain' | 'cover';
  showBackdropBlur?: boolean;
}

const SlidePhoto: React.FC<SlidePhotoProps> = ({
  src,
  alt,
  studentName,
  style,
  className,
  fallbackIndex = 0,
  fitMode = 'contain',
  showBackdropBlur = true
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isSelfHealing, setIsSelfHealing] = useState(false);

  useEffect(() => {
    if (!src || src.startsWith('idb:')) {
      if (studentName) {
        findPhotoForStudent(studentName, undefined, fallbackIndex).then((cached) => {
          if (cached && !cached.startsWith('idb:')) {
            setCurrentSrc(cached);
            setHasError(false);
            // Proactively heal on server in background if it's base64
            if (cached.startsWith('data:')) {
              fetch('/api/upload-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: cached,
                  name: `repaired_${studentName}_${fallbackIndex}`
                })
              }).catch(() => {});
            }
          } else {
            setCurrentSrc(undefined);
          }
        });
      } else {
        setCurrentSrc(undefined);
      }
    } else {
      setCurrentSrc(src);
      setRetryCount(0);
      setHasError(false);
    }
  }, [src, studentName, fallbackIndex]);

  const handleError = async () => {
    if (!isSelfHealing && studentName) {
      setIsSelfHealing(true);
      try {
        const idbPhoto = await findPhotoForStudent(studentName, undefined, fallbackIndex);
        if (idbPhoto && !idbPhoto.startsWith('idb:') && idbPhoto !== currentSrc) {
          setCurrentSrc(idbPhoto);
          setHasError(false);
          // Restore on server in background
          if (idbPhoto.startsWith('data:')) {
            fetch('/api/upload-photo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: idbPhoto,
                name: `repaired_${studentName}_${Date.now()}`
              })
            }).catch(() => {});
          }
          return;
        }
      } catch {}
    }

    if (retryCount < 2 && src && !src.startsWith('data:') && !src.startsWith('idb:')) {
      setRetryCount((prev) => prev + 1);
      setTimeout(() => {
        const sep = src.includes('?') ? '&' : '?';
        setCurrentSrc(`${src}${sep}retry=${Date.now()}`);
      }, 700);
    } else {
      setHasError(true);
    }
  };

  if (!currentSrc || hasError) {
    return (
      <div className="w-full h-full bg-[#18181B] flex flex-col items-center justify-center p-6 text-center text-white/90 select-none">
        <Camera className="w-12 h-12 text-amber-400/80 mb-3" />
        <span className="text-base font-extrabold text-amber-100">{alt || '사진을 준비 중입니다'}</span>
        <span className="text-xs text-white/50 mt-1">소중한 추억 사진이 안전하게 유지되고 있습니다</span>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            setHasError(false);
            setRetryCount(0);
            if (studentName) {
              const cached = await findPhotoForStudent(studentName, undefined, fallbackIndex);
              if (cached && !cached.startsWith('idb:')) {
                setCurrentSrc(cached);
                return;
              }
            }
            if (src && !src.startsWith('idb:')) {
              const sep = src.includes('?') ? '&' : '?';
              setCurrentSrc(`${src}${sep}reload=${Date.now()}`);
            }
          }}
          className="mt-3 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          사진 다시 불러오기
        </button>
      </div>
    );
  }

  if (fitMode === 'contain') {
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black select-none">
        {/* Ambient Blur Backdrop */}
        {showBackdropBlur && (
          <img
            src={currentSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none select-none"
          />
        )}
        {/* Full Uncropped Photo: 원본 비율 100% 보존 */}
        <img
          src={currentSrc}
          alt={alt}
          style={style}
          className={`relative z-10 max-h-full max-w-full m-auto object-contain pointer-events-none select-none drop-shadow-2xl ${className || ''}`}
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      style={style}
      className={`w-full h-full object-cover pointer-events-none select-none ${className || ''}`}
      onError={handleError}
    />
  );
};

export const SlidePresentationView: React.FC<SlidePresentationViewProps> = ({
  stories,
  selectedWeek,
  setSelectedWeek,
  selectedClass = '전체',
  setSelectedClass = () => {},
  roster = [],
  onUpdateReaction
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoSubIndex, setPhotoSubIndex] = useState(0);
  const [direction, setDirection] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<number>(5000); // 5 seconds
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<'cream' | 'sage' | 'dark'>('cream');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [imageFitMode, setImageFitMode] = useState<'contain' | 'cover'>('contain');

  // Free Zoom & Pan States
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Ref to distinguish click from drag
  const dragDistanceRef = useRef(0);
  const clickStartPosRef = useRef({ x: 0, y: 0 });

  // Lightbox Modal Zoom & Pan States
  const [modalZoomScale, setModalZoomScale] = useState(1);
  const [modalZoomPan, setModalZoomPan] = useState({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [modalDragStart, setModalDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const slideCardRef = useRef<HTMLDivElement>(null);

  // Filter stories by selected week AND selected class
  const filteredStories = stories.filter((s) => {
    const matchesWeek = selectedWeek === '전체' || isWeekMatch(s.week, selectedWeek);
    
    const studentMatch = roster.find(
      (r) => r.name.trim().toLowerCase() === s.studentName.trim().toLowerCase()
    );
    const studentClass = studentMatch?.className?.trim() || '은솔1반';
    const matchesClass = selectedClass === '전체' || studentClass === selectedClass;

    return matchesWeek && matchesClass;
  });

  const totalSlides = filteredStories.length;

  // Reset current index on filter change
  useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) {
      setCurrentIndex(0);
    }
    setPhotoSubIndex(0);
  }, [selectedWeek, selectedClass, totalSlides]);

  // Reset image zoom whenever slide index or photo sub index changes
  useEffect(() => {
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentIndex, photoSubIndex]);

  // Background Image Preloader: Proactively load adjacent students' photos to eliminate transition delay
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!filteredStories || filteredStories.length <= 1) return;

    const total = filteredStories.length;
    // Preload next 2 students and previous student
    const targetIndices = [
      (currentIndex + 1) % total,
      (currentIndex + 2) % total,
      (currentIndex - 1 + total) % total,
    ];

    targetIndices.forEach(async (idx) => {
      const story = filteredStories[idx];
      if (!story) return;

      const urlsToLoad: string[] = [];
      if (Array.isArray(story.imageUrls) && story.imageUrls.length > 0) {
        urlsToLoad.push(...story.imageUrls);
      } else if (story.imageUrl) {
        urlsToLoad.push(story.imageUrl);
      }

      for (let pIdx = 0; pIdx < urlsToLoad.length; pIdx++) {
        const u = urlsToLoad[pIdx];
        if (!u || preloadedUrlsRef.current.has(u)) continue;

        if (u.startsWith('idb:')) {
          try {
            const resolved = await findPhotoForStudent(story.studentName, undefined, pIdx);
            if (resolved && !preloadedUrlsRef.current.has(resolved)) {
              preloadedUrlsRef.current.add(resolved);
              const img = new Image();
              img.src = resolved;
              if ('decode' in img) img.decode().catch(() => {});
            }
          } catch {}
          continue;
        }

        if (u.startsWith('http') || u.startsWith('data:') || u.startsWith('/')) {
          preloadedUrlsRef.current.add(u);
          const img = new Image();
          img.src = u;
          if ('decode' in img) img.decode().catch(() => {});
        }
      }
    });
  }, [currentIndex, filteredStories]);

  // Reset modal zoom whenever modal image changes
  useEffect(() => {
    setModalZoomScale(1);
    setModalZoomPan({ x: 0, y: 0 });
    setIsModalDragging(false);
  }, [zoomedImage]);

  // Main Slide Zoom Handlers
  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomScale((prev) => Math.min(prev + 0.5, 4.0));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomScale((prev) => {
      const next = Math.max(prev - 0.5, 1.0);
      if (next === 1) setZoomPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
  };

  // Canva-style click-to-zoom handler: Click on desired part of photo to zoom in or out
  const handlePhotoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If user dragged more than 5px, do not trigger click zoom
    if (dragDistanceRef.current > 5) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (zoomScale === 1) {
      // Zoom in centered on clicked location (2.5x)
      const clickX = e.clientX - (rect.left + rect.width / 2);
      const clickY = e.clientY - (rect.top + rect.height / 2);
      setZoomScale(2.5);
      setZoomPan({ x: -clickX * 1.5, y: -clickY * 1.5 });
    } else {
      // Zoom back out to 100%
      handleResetZoom();
    }
  };

  // Main Slide Drag Handlers for Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    dragDistanceRef.current = 0;
    clickStartPosRef.current = { x: e.clientX, y: e.clientY };
    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoomPan.x, y: e.clientY - zoomPan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (clickStartPosRef.current) {
      const dist = Math.hypot(e.clientX - clickStartPosRef.current.x, e.clientY - clickStartPosRef.current.y);
      dragDistanceRef.current = dist;
    }
    if (!isDragging || zoomScale <= 1) return;
    setZoomPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragDistanceRef.current = 0;
    if (e.touches.length === 1) {
      clickStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (zoomScale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({ x: e.touches[0].clientX - zoomPan.x, y: e.touches[0].clientY - zoomPan.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (clickStartPosRef.current && e.touches.length === 1) {
      const dist = Math.hypot(e.touches[0].clientX - clickStartPosRef.current.x, e.touches[0].clientY - clickStartPosRef.current.y);
      dragDistanceRef.current = dist;
    }
    if (!isDragging || zoomScale <= 1 || e.touches.length !== 1) return;
    setZoomPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Lightbox Modal Zoom Handlers
  const handleModalZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setModalZoomScale((prev) => Math.min(prev + 0.5, 5.0));
  };

  const handleModalZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setModalZoomScale((prev) => {
      const next = Math.max(prev - 0.5, 1.0);
      if (next === 1) setModalZoomPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleModalResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setModalZoomScale(1);
    setModalZoomPan({ x: 0, y: 0 });
  };

  // Animation lock and throttle control to prevent multiple rapid triggers and rendering lag
  const isNavigatingRef = useRef(false);
  const lastNavTimeRef = useRef(0);
  const trailingNavTimerRef = useRef<NodeJS.Timeout | null>(null);
  const NAVIGATION_COOLDOWN = 200; // ms

  // Clean up trailing timer on unmount
  useEffect(() => {
    return () => {
      if (trailingNavTimerRef.current) {
        clearTimeout(trailingNavTimerRef.current);
      }
    };
  }, []);

  // Immediate state navigation with throttle & debounce
  const triggerNavigation = useCallback((dir: 1 | -1) => {
    if (totalSlides === 0) return;

    const now = Date.now();
    const elapsed = now - lastNavTimeRef.current;

    // Prevent duplicate rapid calls & buffer trailing click
    if (isNavigatingRef.current || elapsed < NAVIGATION_COOLDOWN) {
      if (trailingNavTimerRef.current) {
        clearTimeout(trailingNavTimerRef.current);
      }
      const delay = Math.max(NAVIGATION_COOLDOWN - elapsed, 40);
      trailingNavTimerRef.current = setTimeout(() => {
        triggerNavigation(dir);
      }, delay);
      return;
    }

    if (trailingNavTimerRef.current) {
      clearTimeout(trailingNavTimerRef.current);
      trailingNavTimerRef.current = null;
    }

    lastNavTimeRef.current = now;
    isNavigatingRef.current = true;

    // Immediate synchronous state updates: switches to the next/prev student with 0ms delay
    setDirection(dir);
    setPhotoSubIndex(0);
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setIsDragging(false);

    if (dir === 1) {
      setCurrentIndex((prev) => {
        if (isShuffle && totalSlides > 1) {
          let nextIndex = Math.floor(Math.random() * totalSlides);
          if (nextIndex === prev) nextIndex = (prev + 1) % totalSlides;
          return nextIndex;
        }
        return (prev + 1) % totalSlides;
      });
    } else {
      setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    }

    // Release animation lock once the transition settles
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, NAVIGATION_COOLDOWN);
  }, [totalSlides, isShuffle]);

  const goToNext = useCallback(() => triggerNavigation(1), [triggerNavigation]);
  const goToPrev = useCallback(() => triggerNavigation(-1), [triggerNavigation]);

  // Double click heart reaction trigger
  const handleDoubleTap = (storyId: string) => {
    onUpdateReaction(storyId, '❤️');
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 800);
  };

  // Fullscreen Handlers (Fullscreen API with cross-browser and iframe fallback)
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((el as any).mozRequestFullScreen) {
        await (el as any).mozRequestFullScreen();
      } else if ((el as any).msRequestFullscreen) {
        await (el as any).msRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen API unavailable or restricted:', err);
    }
    setIsFullscreen(true);
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Exit fullscreen error:', err);
    }
    setIsFullscreen(false);
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (isFullscreen || !!document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Handle Keyboard Navigation & Fullscreen Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (isFullscreen) {
          e.preventDefault();
          exitFullscreen();
        }
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, isFullscreen]);

  // Handle Slideshow Autoplay Timer
  useEffect(() => {
    if (!isPlaying || totalSlides === 0) return;
    const timer = setInterval(() => {
      goToNext();
    }, autoPlaySpeed);
    return () => clearInterval(timer);
  }, [isPlaying, autoPlaySpeed, goToNext, totalSlides]);

  // Fullscreen change listener across browsers
  useEffect(() => {
    const onFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement);
      setIsFullscreen(isFS);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  // Auto Scroll down to slide card on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      slideCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const currentStory = filteredStories[currentIndex];

  // Slide Animation Variants: Snappy, lightweight translation without 600ms exit-wait delay
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.99
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.99
    })
  };

  if (totalSlides === 0) {
    return (
      <div className="min-h-[80vh] bg-[#FAFAFA] flex flex-col">
        <InstagramStoryBar
          stories={stories}
          roster={roster}
          selectedClass={selectedClass}
          setSelectedClass={setSelectedClass}
          selectedWeek={selectedWeek}
        />
        {setSelectedWeek && (
          <WeekTabBar
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
            stories={stories}
          />
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px] mb-4 shadow-sm">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#dc2743]">
              <Calendar className="w-10 h-10" />
            </div>
          </div>
          <h3 className="text-xl font-black text-[#262626] mb-2">
            {selectedWeek === '전체' ? '등록된 이야기 게시물이 없습니다.' : `${selectedWeek}에 등록된 이야기가 없습니다.`}
          </h3>
          <p className="text-[#737373] max-w-md text-xs sm:text-sm mb-4 leading-relaxed">
            상단의 '게시물 작성' 버튼을 눌러 우리 아이의 주말 일상을 인스타그램 피드처럼 공유해보세요!
          </p>

          {stories.length > 0 && selectedWeek !== '전체' && (
            <div className="mt-2 flex flex-col items-center gap-2">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full font-bold">
                💡 다른 주차에 등록된 이야기가 총 {stories.length}건 있습니다!
              </p>
              <button
                onClick={() => setSelectedWeek && setSelectedWeek('전체')}
                className="mt-1 px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white text-xs font-black shadow-xs hover:opacity-90 transition-all active:scale-95 cursor-pointer"
              >
                전체 주차 이야기 보기 (총 {stories.length}건)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Find student class for current story
  const studentMatch = roster.find(
    (r) => r.name.trim().toLowerCase() === currentStory.studentName.trim().toLowerCase()
  );
  const studentClass = studentMatch?.className?.trim() || '햇살반';

  // Calculate total reactions count
  const totalReactions = (Object.values(currentStory.reactions || {}) as (number | string)[]).reduce<number>((acc, curr) => acc + (Number(curr) || 0), 0);

  // Extract all photos for current story
  const rawUrls = Array.isArray(currentStory.imageUrls)
    ? currentStory.imageUrls
    : (currentStory.imageUrl ? [currentStory.imageUrl] : []);
  const validUrls = rawUrls.filter((u: any) => typeof u === 'string' && u.trim().length > 0);
  const photos = validUrls.length > 0 ? validUrls : [''];

  return (
    <div
      ref={containerRef}
      id="ppt-slide-container"
      className="relative min-h-[85vh] flex flex-col justify-between bg-[#FAFAFA] text-[#262626] select-none pb-8"
    >
      {/* Instagram Story Bubble Bar */}
      <InstagramStoryBar
        stories={stories}
        roster={roster}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        selectedWeek={selectedWeek}
        onSelectStudentStory={(storyId) => {
          const foundIdx = filteredStories.findIndex((s) => s.id === storyId);
          if (foundIdx !== -1) {
            setDirection(foundIdx > currentIndex ? 1 : -1);
            setCurrentIndex(foundIdx);
          }
        }}
        currentStoryId={currentStory?.id}
      />

      {/* Week Date Tabs Bar (날짜탭) */}
      {setSelectedWeek && (
        <WeekTabBar
          selectedWeek={selectedWeek}
          onSelectWeek={setSelectedWeek}
          stories={stories}
        />
      )}

      {/* Control Top Bar */}
      <div className="max-w-4xl mx-auto w-full px-4 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white font-black px-3 py-1 rounded-full text-[11px] flex items-center gap-1 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            {currentStory.week}
          </span>
          <span className="text-[11px] font-bold text-[#737373]">
            피드 슬라이드 ({currentIndex + 1} / {totalSlides})
          </span>
        </div>

        {/* Presentation Control Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="ppt-btn-autoplay"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              isPlaying
                ? 'bg-[#262626] text-white border-[#262626] shadow-2xs'
                : 'bg-white border-[#DBDBDB] text-[#262626] hover:bg-[#EFEFEF]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? '자동 넘김 중' : '슬라이드 쇼'}</span>
          </button>

          {isPlaying && (
            <select
              id="ppt-speed-select"
              value={autoPlaySpeed}
              onChange={(e) => setAutoPlaySpeed(Number(e.target.value))}
              className="bg-white text-xs px-2.5 py-1.5 rounded-full border border-[#DBDBDB] font-bold focus:outline-none"
            >
              <option value={3000}>3초</option>
              <option value={5000}>5초</option>
              <option value={10000}>10초</option>
            </select>
          )}

          <button
            id="ppt-btn-shuffle"
            onClick={() => setIsShuffle(!isShuffle)}
            className={`p-2 rounded-full border transition-all ${
              isShuffle ? 'bg-pink-500 text-white border-pink-500' : 'bg-white border-[#DBDBDB] text-[#262626] hover:bg-[#EFEFEF]'
            }`}
            title="랜덤 넘김"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button
            id="ppt-btn-fullscreen"
            onClick={toggleFullscreen}
            className="p-2 sm:p-2.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center ring-2 ring-blue-300"
            title="전체 화면 슬라이드쇼 (PPT 모드, F11/클릭)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Instagram Post Feed Card */}
      <div className="relative flex-1 flex items-center justify-center my-4 px-2 sm:px-4">
        
        {/* Left Arrow Button */}
        <button
          id="ppt-btn-prev"
          onClick={goToPrev}
          className="absolute left-1 sm:left-6 z-30 p-2.5 sm:p-3.5 rounded-full bg-white/90 border border-[#DBDBDB] text-[#262626] hover:bg-black hover:text-white active:scale-90 transition-all shadow-md backdrop-blur-md group"
          title="이전 원아 슬라이드 (← 키)"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        {/* Right Arrow Button */}
        <button
          id="ppt-btn-next"
          onClick={goToNext}
          className="absolute right-1 sm:right-6 z-30 p-2.5 sm:p-3.5 rounded-full bg-black border border-black text-white hover:bg-pink-600 hover:border-pink-600 active:scale-90 transition-all shadow-md backdrop-blur-md group"
          title="다음 원아 슬라이드 (→ 키)"
        >
          <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Instagram Card Container */}
        <AnimatePresence custom={direction} mode="popLayout" initial={false}>
          <motion.div
            ref={slideCardRef}
            key={currentStory.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-full lg:max-w-[1600px] bg-white border border-[#DBDBDB] rounded-3xl shadow-xl overflow-hidden my-2"
          >
            {/* Instagram Post Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#EFEFEF]">
              <div className="flex items-center gap-3.5">
                {/* Profile Avatar with Instagram Gradient Ring */}
                <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-xs">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white p-0.5 overflow-hidden flex items-center justify-center">
                    <SlideAvatar
                      photoUrl={(currentStory.imageUrls && currentStory.imageUrls.length > 0) ? currentStory.imageUrls[0] : (currentStory.imageUrl || '')}
                      studentName={currentStory.studentName}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base sm:text-lg text-[#262626]">{currentStory.studentName}</span>
                    <CheckCircle2 className="w-4 h-4 text-sky-500 fill-sky-500" />
                    <span className="text-xs font-extrabold text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200">
                      {studentClass}
                    </span>
                  </div>
                  <p className="text-xs text-[#8E8E8E] font-bold mt-0.5">{currentStory.week}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="card-fullscreen-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    enterFullscreen();
                  }}
                  className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow transition-all active:scale-95 ring-2 ring-blue-300 flex items-center justify-center"
                  title="사진 전체화면 크게 보기 (PPT 슬라이드쇼, F11)"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onUpdateReaction(currentStory.id, '❤️')}
                  className="p-2.5 rounded-full hover:bg-gray-100 text-[#262626] transition-colors"
                  title="좋아요 누르기"
                >
                  <MoreHorizontal className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Instagram Post Media (Photos Area with Step Carousel & Canva Magnifier Zoom) */}
            <div
              className="relative w-full bg-black flex flex-col items-center justify-center overflow-hidden select-none min-h-[450px] sm:min-h-[580px] lg:min-h-[680px]"
              onDoubleClick={() => handleDoubleTap(currentStory.id)}
            >
              {/* Floating Canva-style Magnifier & Fit Mode Tool Overlay Bar */}
              <div
                className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-xl text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black transition-all ${
                    imageFitMode === 'contain'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xs'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title={imageFitMode === 'contain' ? '현재: 얼굴/전체 잘림 방지 (원본 맞춤) -> 꽉 채움으로 변경' : '현재: 꽉 채움 -> 얼굴/전체 잘림 방지 (원본 맞춤)으로 변경'}
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                  <span>{imageFitMode === 'contain' ? '잘림 방지 (원본 맞춤)' : '화면 꽉 채움'}</span>
                </button>

                <div className="h-3.5 w-px bg-white/20" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (zoomScale > 1) {
                      handleResetZoom();
                    } else {
                      setZoomScale(2.5);
                      setZoomPan({ x: 0, y: 0 });
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black transition-all ${
                    zoomScale > 1
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title="돋보기 (사진의 원하는 부분을 누르면 확대/축소)"
                >
                  <ZoomIn className="w-4 h-4 text-pink-300 fill-pink-300/30" />
                  <span>{zoomScale > 1 ? `돋보기 ${Math.round(zoomScale * 100)}%` : '돋보기'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoomScale <= 1}
                    className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 active:scale-95 flex items-center justify-center text-xs font-extrabold disabled:opacity-30 transition-all text-white"
                    title="축소 (-)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoomScale >= 4}
                    className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 active:scale-95 flex items-center justify-center text-xs font-extrabold disabled:opacity-30 transition-all text-white"
                    title="확대 (+)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {zoomScale > 1 && (
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      className="ml-1 px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-[10px] font-extrabold transition-all flex items-center gap-1 text-white"
                      title="화면 맞춤 초기화"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>초기화</span>
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const rawUrls = Array.isArray(currentStory.imageUrls)
                  ? currentStory.imageUrls
                  : (currentStory.imageUrl ? [currentStory.imageUrl] : []);
                const validUrls = rawUrls.filter((u: any) => typeof u === 'string' && u.trim().length > 0);
                const photos = validUrls.length > 0 ? validUrls : [''];

                // If only 1 photo
                if (photos.length === 1) {
                  const cap = currentStory.imageCaptions?.[0];
                  return (
                    <div
                      className={`relative w-full aspect-[16/10] sm:aspect-[16/9] min-h-[440px] sm:min-h-[560px] lg:min-h-[640px] bg-black overflow-hidden group flex items-center justify-center ${
                        zoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
                      }`}
                      onClick={handlePhotoClick}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <SlidePhoto
                        src={photos[0]}
                        alt={currentStory.title}
                        studentName={currentStory.studentName}
                        fitMode={imageFitMode}
                        showBackdropBlur={true}
                        style={{
                          transform: `scale(${zoomScale}) translate(${zoomPan.x / zoomScale}px, ${zoomPan.y / zoomScale}px)`,
                          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                        }}
                        className="pointer-events-none select-none drop-shadow-2xl"
                      />
                      <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-full text-xs font-extrabold text-white border border-white/20 z-20">
                        1/1
                      </div>

                      {cap && (
                        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent text-white z-20">
                          <p className="text-sm sm:text-base font-bold leading-relaxed text-pink-100">💬 {cap}</p>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedImage(photos[0]);
                        }}
                        className="absolute bottom-3 right-3 p-2.5 bg-black/70 rounded-full text-white opacity-80 hover:opacity-100 transition-opacity backdrop-blur-md border border-white/20 shadow-md z-20"
                        title="전체화면 크게 보기"
                      >
                        <ZoomIn className="w-5 h-5" />
                      </button>
                    </div>
                  );
                }

                // If multiple photos (e.g. 2 or 3 photos)
                const isAllGridStep = photoSubIndex === photos.length;

                return (
                  <div className="w-full flex flex-col">
                    {/* Top Step Selector Chips Bar */}
                    <div className="w-full bg-black/90 px-4 py-2.5 flex items-center justify-center gap-2 border-b border-white/10 overflow-x-auto z-10">
                      {photos.map((_, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoSubIndex(pIdx);
                          }}
                          className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 ${
                            photoSubIndex === pIdx
                              ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white shadow-md scale-105 ring-2 ring-pink-300'
                              : 'bg-white/15 text-white/80 hover:bg-white/30'
                          }`}
                        >
                          <span>사진 #{pIdx + 1}</span>
                        </button>
                      ))}

                      {/* Final All-Photos Grid Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoSubIndex(photos.length);
                        }}
                        className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 ${
                          isAllGridStep
                            ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white shadow-md scale-105 ring-2 ring-pink-400'
                            : 'bg-gradient-to-r from-purple-900/60 to-pink-900/60 text-pink-200 border border-pink-500/30 hover:bg-pink-800/40'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-pink-300 fill-pink-300" />
                        <span>전체 {photos.length}장 모아보기</span>
                      </button>
                    </div>

                    {/* Step Content */}
                    {!isAllGridStep ? (
                      /* Individual Photo Step View with Free Zoom & Drag */
                      <div
                        className={`relative w-full aspect-[16/10] sm:aspect-[16/9] min-h-[440px] sm:min-h-[560px] lg:min-h-[640px] bg-black overflow-hidden group flex items-center justify-center ${
                          zoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
                        }`}
                        onClick={handlePhotoClick}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      >
                        <SlidePhoto
                          src={photos[photoSubIndex]}
                          alt={`${currentStory.title} - 사진 ${photoSubIndex + 1}`}
                          studentName={currentStory.studentName}
                          fitMode={imageFitMode}
                          showBackdropBlur={true}
                          style={{
                            transform: `scale(${zoomScale}) translate(${zoomPan.x / zoomScale}px, ${zoomPan.y / zoomScale}px)`,
                            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                          }}
                          className="pointer-events-none select-none drop-shadow-2xl"
                        />

                        {/* Inner photo sub-navigation within current child */}
                        {photos.length > 1 && photoSubIndex > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoSubIndex((p) => p - 1);
                            }}
                            className="absolute left-3.5 z-20 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 shadow-lg cursor-pointer"
                            title="이전 사진 보기"
                          >
                            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        )}
                        {photos.length > 1 && photoSubIndex < photos.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoSubIndex((p) => p + 1);
                            }}
                            className="absolute right-3.5 z-20 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 shadow-lg cursor-pointer"
                            title="다음 사진 보기"
                          >
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        )}

                        {/* Top Right Badge */}
                        <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-full text-xs font-extrabold text-white border border-white/20 z-20">
                          사진 {photoSubIndex + 1} / {photos.length}
                        </div>

                        {/* Photo Caption Overlay */}
                        {currentStory.imageCaptions?.[photoSubIndex] && (
                          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent text-white z-20">
                            <p className="text-xs sm:text-sm font-extrabold text-pink-300 mb-0.5">
                              📷 사진 #{photoSubIndex + 1} 설명:
                            </p>
                            <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                              {currentStory.imageCaptions[photoSubIndex]}
                            </p>
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomedImage(photos[photoSubIndex]);
                          }}
                          className="absolute bottom-3 right-3 p-2.5 bg-black/70 rounded-full text-white opacity-80 hover:opacity-100 transition-opacity backdrop-blur-md border border-white/20 shadow-md z-20"
                          title="전체화면 크게 보기"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      /* Final Step: ALL Photos Together Grid View - Full Screen Maximize */
                      <div className="w-full bg-black flex flex-col">
                        <div className="w-full bg-black/90 px-4 py-2.5 flex items-center justify-between border-b border-white/10 text-white">
                          <span className="text-xs sm:text-sm font-black text-pink-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 fill-pink-400" />
                            <span>사진 {photos.length}장 모아보기 (TV 대형 화면)</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                enterFullscreen();
                              }}
                              className="px-3.5 py-1.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 ring-2 ring-blue-300 cursor-pointer"
                              title="전체 화면 슬라이드쇼 (PPT 모드, F11)"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>전체화면 확장 (PPT)</span>
                            </button>
                          </div>
                        </div>

                        <div className={`grid gap-2 p-1 bg-black w-full ${photos.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
                          {photos.map((imgUrl, imgIdx) => {
                            const captionText = currentStory.imageCaptions?.[imgIdx];
                            return (
                              <div
                                key={imgIdx}
                                className="relative w-full h-[450px] sm:h-[580px] lg:h-[680px] rounded-xl overflow-hidden bg-black border border-white/10 group cursor-pointer flex flex-col"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setZoomedImage(imgUrl);
                                }}
                              >
                                <SlidePhoto
                                  src={imgUrl}
                                  alt={`${currentStory.studentName} - 사진 ${imgIdx + 1}`}
                                  studentName={currentStory.studentName}
                                  fallbackIndex={imgIdx}
                                  fitMode="contain"
                                  showBackdropBlur={true}
                                  className="group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                                />
                                <span className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-xs sm:text-sm font-black px-3 py-1 rounded-full border border-white/20 shadow-md z-20">
                                  #{imgIdx + 1}
                                </span>
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                                  <span className="bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 backdrop-blur-md">
                                    <ZoomIn className="w-4 h-4 text-pink-400" />
                                    <span>원본 크게 보기</span>
                                  </span>
                                </div>

                                {/* Parent's photo caption overlay below each photo card */}
                                {captionText && (
                                  <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent text-white z-20 pointer-events-none">
                                    <div className="flex items-center gap-1.5 text-pink-300 text-xs font-black mb-1">
                                      <Sparkles className="w-3.5 h-3.5 fill-pink-300" />
                                      <span>사진 #{imgIdx + 1} 설명</span>
                                    </div>
                                    <p className="text-xs sm:text-sm lg:text-base font-bold text-white leading-relaxed line-clamp-3 drop-shadow-md">
                                      {captionText}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Animated Double-Tap Heart Overlay */}
              <AnimatePresence>
                {showHeartAnim && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                  >
                    <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-2xl" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Post Action Bar & Story Content for TV Screen */}
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <button
                    onClick={() => handleDoubleTap(currentStory.id)}
                    className="group transition-transform active:scale-125"
                    title="좋아요"
                  >
                    <Heart className={`w-7 h-7 transition-colors ${
                      (currentStory.reactions?.['❤️'] || 0) > 0
                        ? 'text-rose-500 fill-rose-500'
                        : 'text-[#262626] group-hover:text-rose-500'
                    }`} />
                  </button>

                  <button
                    onClick={() => onUpdateReaction(currentStory.id, '👏')}
                    className="group transition-transform active:scale-125"
                    title="박수 칭찬하기"
                  >
                    <MessageCircle className="w-7 h-7 text-[#262626] group-hover:text-pink-500" />
                  </button>

                  <button
                    onClick={() => onUpdateReaction(currentStory.id, '⭐')}
                    className="group transition-transform active:scale-125"
                    title="별빛 보내기"
                  >
                    <Send className="w-7 h-7 text-[#262626] group-hover:text-amber-500" />
                  </button>
                </div>

                <button
                  onClick={() => onUpdateReaction(currentStory.id, '😊')}
                  className="group"
                  title="저장하기"
                >
                  <Bookmark className="w-7 h-7 text-[#262626] group-hover:text-purple-600" />
                </button>
              </div>

              {/* Likes and Reactions summary */}
              <div className="text-sm font-extrabold text-[#262626] flex items-center gap-2">
                <span>반응 {totalReactions + 1}개</span>
              </div>

              {/* Post Caption & Content - Big Typography for Classroom TV */}
              <div className="text-sm sm:text-base lg:text-lg text-[#262626] leading-relaxed space-y-2 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                <p>
                  <span className="font-black text-black text-base sm:text-lg lg:text-xl">{currentStory.studentName}</span>
                </p>

                {/* Hashtags */}
                <p className="text-xs sm:text-sm font-bold text-sky-600 pt-1 space-x-2">
                  <span>#{studentClass}</span>
                  <span>#유치원주말지낸이야기</span>
                  <span>#{currentStory.studentName}의주말</span>
                  <span>#{currentStory.week.replace(/ /g, '')}</span>
                </p>
              </div>

              {/* Classmate Reaction Buttons Bar */}
              <div className="pt-3 border-t border-[#EFEFEF] flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-[#8E8E8E] mr-1">친구들 반응 보내기:</span>
                {[
                  { emoji: '❤️', label: '좋아요' },
                  { emoji: '👏', label: '멋져요' },
                  { emoji: '⭐', label: '최고예요' },
                  { emoji: '😊', label: '재밌어요' }
                ].map(({ emoji, label }) => {
                  const count = currentStory.reactions?.[emoji] || 0;
                  return (
                    <button
                      key={emoji}
                      onClick={() => onUpdateReaction(currentStory.id, emoji)}
                      className="px-4 py-1.5 rounded-full bg-[#F5F5F5] hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 border border-[#EFEFEF] text-xs sm:text-sm font-extrabold text-[#262626] flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                      <span className="text-xs text-pink-600 font-black">({count})</span>
                    </button>
                  );
                })}
              </div>

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="pt-2 z-20">
        <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-2 px-4 max-w-4xl mx-auto no-scrollbar">
          {filteredStories.map((s, idx) => (
            <button
              key={s.id}
              id={`thumbnail-btn-${idx}`}
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
              className={`relative shrink-0 w-14 sm:w-16 aspect-square rounded-full overflow-hidden p-[2px] transition-all ${
                idx === currentIndex
                  ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] scale-110 shadow-sm'
                  : 'bg-[#DBDBDB] opacity-60 hover:opacity-100'
              }`}
            >
              <div className="w-full h-full rounded-full bg-white p-0.5 overflow-hidden">
                <SlideAvatar
                  photoUrl={(s.imageUrls && s.imageUrls.length > 0) ? s.imageUrls[0] : (s.imageUrl || '')}
                  studentName={s.studentName}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-2 sm:p-6"
            onClick={() => setZoomedImage(null)}
          >
            {/* Top Toolbar in Modal */}
            <div
              className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between px-4 py-2 bg-black/70 backdrop-blur-md rounded-2xl border border-white/20 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <ZoomIn className="w-5 h-5 text-pink-400" />
                <span className="text-xs sm:text-sm font-extrabold text-white">TV 화면 원본 확대 보기</span>
                <span className="text-xs text-amber-300 font-bold ml-2">({Math.round(modalZoomScale * 100)}%)</span>
              </div>

              {/* Zoom Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleModalZoomOut}
                  disabled={modalZoomScale <= 1}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/40 active:scale-95 text-white disabled:opacity-30 transition-all"
                  title="축소 (-)"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleModalZoomIn}
                  disabled={modalZoomScale >= 5}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/40 active:scale-95 text-white disabled:opacity-30 transition-all"
                  title="확대 (+)"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {modalZoomScale > 1 && (
                  <button
                    type="button"
                    onClick={handleModalResetZoom}
                    className="px-3 py-1 rounded-full bg-pink-600 hover:bg-pink-500 text-xs font-extrabold transition-all flex items-center gap-1 text-white"
                    title="초기화"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>원래대로</span>
                  </button>
                )}

                <button
                  id="close-zoom-btn"
                  onClick={() => setZoomedImage(null)}
                  className="ml-2 p-2 bg-rose-600/90 text-white rounded-full hover:bg-rose-600 transition-colors border border-white/20 shadow-md"
                  title="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Display Area */}
            <div
              className="relative w-full max-w-6xl h-[80vh] flex items-center justify-center overflow-hidden rounded-3xl bg-black/60 p-2 cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                if (modalZoomScale <= 1) return;
                setIsModalDragging(true);
                setModalDragStart({ x: e.clientX - modalZoomPan.x, y: e.clientY - modalZoomPan.y });
              }}
              onMouseMove={(e) => {
                if (!isModalDragging || modalZoomScale <= 1) return;
                setModalZoomPan({
                  x: e.clientX - modalDragStart.x,
                  y: e.clientY - modalDragStart.y
                });
              }}
              onMouseUp={() => setIsModalDragging(false)}
              onMouseLeave={() => setIsModalDragging(false)}
            >
              <SlidePhoto
                src={zoomedImage}
                alt="원본 확대 이미지"
                style={{
                  transform: `scale(${modalZoomScale}) translate(${modalZoomPan.x / modalZoomScale}px, ${modalZoomPan.y / modalZoomScale}px)`,
                  transition: isModalDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                className="max-w-full max-h-full object-contain rounded-2xl pointer-events-none select-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PPT Fullscreen SlideShow View Overlay */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[99999] bg-black text-white w-screen h-screen flex flex-col justify-between overflow-hidden select-none cursor-pointer"
            onClick={exitFullscreen}
          >
            {/* Top Bar with Minimal Info and Exit Button */}
            <div
              className="w-full px-6 py-4 flex items-center justify-between z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none"
            >
              <div className="flex items-center gap-3">
                <span className="bg-blue-600/90 text-white font-black px-3.5 py-1.5 rounded-full text-xs sm:text-sm shadow-md flex items-center gap-1.5 border border-blue-400/30">
                  <Sparkles className="w-4 h-4 fill-white" />
                  {currentStory.studentName} 어린이 ({studentClass})
                </span>
                <span className="text-xs sm:text-sm font-bold text-white/70">
                  {currentStory.week} 주말 이야기 • {photos.length}장 사진 모아보기
                </span>
              </div>

              <div className="flex items-center gap-3 pointer-events-auto">
                <span className="text-xs text-white/50 hidden sm:inline-block">
                  화면 클릭 또는 ESC로 종료
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exitFullscreen();
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-rose-600 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 border border-white/20 shadow-lg transition-all active:scale-95 cursor-pointer"
                  title="전체 화면 종료 (ESC)"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>화면 복귀 (ESC)</span>
                </button>
              </div>
            </div>

            {/* Center Photos Container - PPT Slideshow Filling Screen */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
              {/* Previous Student Arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrev();
                }}
                className="absolute left-3 sm:left-6 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 shadow-2xl cursor-pointer"
                title="이전 원아 슬라이드 (← 키)"
              >
                <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>

              {/* Next Student Arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-3 sm:right-6 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 shadow-2xl cursor-pointer"
                title="다음 원아 슬라이드 (→ 키)"
              >
                <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>

              {/* Photos Grid: 1, 2, or 3 Photos */}
              <AnimatePresence custom={direction} mode="popLayout" initial={false}>
                <motion.div
                  key={currentStory.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className={`w-full h-full max-w-[98vw] max-h-[88vh] mx-auto grid gap-3 sm:gap-4 md:gap-5 items-center justify-center ${
                    photos.length === 1
                      ? 'grid-cols-1'
                      : photos.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : photos.length === 3
                      ? 'grid-cols-1 sm:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-4'
                  }`}
                >
                  {photos.map((imgUrl, imgIdx) => {
                    const captionText = currentStory.imageCaptions?.[imgIdx];
                    return (
                      <div
                        key={imgIdx}
                        className="relative w-full h-[82vh] max-h-[85vh] rounded-2xl overflow-hidden bg-black/90 border border-white/10 flex flex-col justify-center items-center shadow-2xl group"
                      >
                        <SlidePhoto
                          src={imgUrl}
                          alt={`${currentStory.studentName} - 사진 ${imgIdx + 1}`}
                          studentName={currentStory.studentName}
                          fallbackIndex={imgIdx}
                          fitMode="contain"
                          showBackdropBlur={true}
                          className="w-full h-full max-h-full max-w-full object-contain pointer-events-none select-none drop-shadow-2xl"
                        />

                        {/* Badge: 사진 #1, #2, #3 */}
                        <span className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full border border-white/20 shadow-md z-20 pointer-events-none">
                          사진 #{imgIdx + 1}
                        </span>

                        {/* Caption Overlay */}
                        {captionText && (
                          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent text-white z-20 pointer-events-none">
                            <p className="text-xs sm:text-sm font-black text-pink-300 mb-0.5">
                              💬 사진 #{imgIdx + 1}
                            </p>
                            <p className="text-xs sm:text-base font-bold text-white leading-relaxed line-clamp-3 drop-shadow-md">
                              {captionText}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Subtle Bar */}
            <div className="w-full py-2.5 px-6 flex items-center justify-between text-xs text-white/50 bg-gradient-to-t from-black/90 to-transparent z-30 pointer-events-none">
              <span>키보드 ← / → 키로 이전/다음 원아 넘김 가능</span>
              <span className="text-pink-300 font-bold">화면 어디든 클릭하면 이전 화면으로 복귀합니다</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
