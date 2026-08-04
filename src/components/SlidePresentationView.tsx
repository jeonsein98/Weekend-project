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
import { StoryItem, RosterStudent, WEEKS_LIST } from '../types';
import { InstagramStoryBar } from './InstagramStoryBar';

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

  // Filter stories by selected week AND selected class
  const filteredStories = stories.filter((s) => {
    const matchesWeek = selectedWeek === '전체' || s.week === selectedWeek;
    
    const studentMatch = roster.find(
      (r) => r.name.trim().toLowerCase() === s.studentName.trim().toLowerCase()
    );
    const studentClass = studentMatch?.className?.trim() || '은솔1반';
    const matchesClass = selectedClass === '전체' || studentClass === selectedClass;

    return matchesWeek && matchesClass;
  });

  const totalSlides = filteredStories.length;

  // Reset current index & photoSubIndex on filter or slide change
  useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) {
      setCurrentIndex(0);
    }
    setPhotoSubIndex(0);
  }, [selectedWeek, selectedClass, totalSlides, currentIndex]);

  // Reset image zoom whenever slide index or photo sub index changes
  useEffect(() => {
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentIndex, photoSubIndex]);

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

  const goToNext = useCallback(() => {
    if (totalSlides === 0) return;

    const currentStory = filteredStories[currentIndex];
    const photos = currentStory
      ? (currentStory.imageUrls && currentStory.imageUrls.length > 0
          ? currentStory.imageUrls
          : (currentStory.imageUrl ? [currentStory.imageUrl] : []))
      : [];
    const maxPhotoSteps = photos.length > 1 ? photos.length + 1 : 1;

    if (photoSubIndex < maxPhotoSteps - 1) {
      setPhotoSubIndex((prev) => prev + 1);
    } else {
      setPhotoSubIndex(0);
      setDirection(1);
      if (isShuffle && totalSlides > 1) {
        let nextIndex = Math.floor(Math.random() * totalSlides);
        if (nextIndex === currentIndex) nextIndex = (currentIndex + 1) % totalSlides;
        setCurrentIndex(nextIndex);
      } else {
        setCurrentIndex((prev) => (prev + 1) % totalSlides);
      }
    }
  }, [totalSlides, isShuffle, currentIndex, filteredStories, photoSubIndex]);

  const goToPrev = useCallback(() => {
    if (totalSlides === 0) return;

    if (photoSubIndex > 0) {
      setPhotoSubIndex((prev) => prev - 1);
    } else {
      setDirection(-1);
      const prevStoryIndex = (currentIndex - 1 + totalSlides) % totalSlides;
      const prevStory = filteredStories[prevStoryIndex];
      const prevPhotos = prevStory
        ? (prevStory.imageUrls && prevStory.imageUrls.length > 0
            ? prevStory.imageUrls
            : (prevStory.imageUrl ? [prevStory.imageUrl] : []))
        : [];
      const prevMaxSteps = prevPhotos.length > 1 ? prevPhotos.length + 1 : 1;

      setCurrentIndex(prevStoryIndex);
      setPhotoSubIndex(prevMaxSteps - 1);
    }
  }, [totalSlides, currentIndex, filteredStories, photoSubIndex]);

  // Double click heart reaction trigger
  const handleDoubleTap = (storyId: string) => {
    onUpdateReaction(storyId, '❤️');
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 800);
  };

  // Handle Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
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
  }, [goToNext, goToPrev]);

  // Handle Slideshow Autoplay Timer
  useEffect(() => {
    if (!isPlaying || totalSlides === 0) return;
    const timer = setInterval(() => {
      goToNext();
    }, autoPlaySpeed);
    return () => clearInterval(timer);
  }, [isPlaying, autoPlaySpeed, goToNext, totalSlides]);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.error(err));
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const currentStory = filteredStories[currentIndex];

  // Slide Animation Variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 250 : -250,
      opacity: 0,
      scale: 0.97
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 250 : -250,
      opacity: 0,
      scale: 0.97
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
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px] mb-4 shadow-sm">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[#dc2743]">
              <Calendar className="w-10 h-10" />
            </div>
          </div>
          <h3 className="text-xl font-black text-[#262626] mb-2">
            {selectedWeek === '전체' ? '등록된 이야기 게시물이 없습니다.' : `${selectedWeek}에 등록된 이야기가 없습니다.`}
          </h3>
          <p className="text-[#737373] max-w-md text-xs sm:text-sm mb-6 leading-relaxed">
            상단의 '게시물 작성' 버튼을 눌러 우리 아이의 주말 일상을 인스타그램 피드처럼 공유해보세요!
          </p>
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
            className="p-2 rounded-full bg-white border border-[#DBDBDB] text-[#262626] hover:bg-[#EFEFEF] transition-all"
            title="전체 화면 (F키)"
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
          className="absolute left-1 sm:left-6 z-30 p-2.5 sm:p-3.5 rounded-full bg-white/90 border border-[#DBDBDB] text-[#262626] hover:bg-black hover:text-white transition-all shadow-md backdrop-blur-md group"
          title="이전 슬라이드"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        {/* Right Arrow Button */}
        <button
          id="ppt-btn-next"
          onClick={goToNext}
          className="absolute right-1 sm:right-6 z-30 p-2.5 sm:p-3.5 rounded-full bg-black border border-black text-white hover:bg-pink-600 hover:border-pink-600 transition-all shadow-md backdrop-blur-md group"
          title="다음 슬라이드"
        >
          <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Instagram Card Container */}
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentStory.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-full lg:max-w-[1600px] bg-white border border-[#DBDBDB] rounded-3xl shadow-xl overflow-hidden my-2"
          >
            {/* Instagram Post Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#EFEFEF]">
              <div className="flex items-center gap-3.5">
                {/* Profile Avatar with Instagram Gradient Ring */}
                <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-xs">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white p-0.5 overflow-hidden flex items-center justify-center">
                    {currentStory.imageUrl ? (
                      <img
                        src={currentStory.imageUrl}
                        alt={currentStory.studentName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-extrabold">
                        {currentStory.studentName.slice(0, 2)}
                      </div>
                    )}
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
              {/* Floating Canva-style Magnifier Tool Overlay Bar */}
              <div
                className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-xl text-white"
                onClick={(e) => e.stopPropagation()}
              >
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
                  <span>{zoomScale > 1 ? `돋보기 ${Math.round(zoomScale * 100)}% (축소)` : '돋보기 확대'}</span>
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
                      <span>원본</span>
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const photos = currentStory.imageUrls && currentStory.imageUrls.length > 0
                  ? currentStory.imageUrls
                  : (currentStory.imageUrl ? [currentStory.imageUrl] : []);

                if (photos.length === 0) {
                  return (
                    <div className="w-full aspect-video bg-[#FAFAFA] flex flex-col items-center justify-center gap-3 text-[#8E8E8E] p-12">
                      <User className="w-16 h-16 stroke-1 text-gray-400" />
                      <span className="text-sm font-bold">등록된 사진이 없습니다.</span>
                    </div>
                  );
                }

                // If only 1 photo
                if (photos.length === 1) {
                  const cap = currentStory.imageCaptions?.[0];
                  return (
                    <div
                      className={`relative w-full aspect-[16/10] sm:aspect-[16/9] bg-black overflow-hidden group flex items-center justify-center ${
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
                      <img
                        src={photos[0]}
                        alt={currentStory.title}
                        style={{
                          transform: `scale(${zoomScale}) translate(${zoomPan.x / zoomScale}px, ${zoomPan.y / zoomScale}px)`,
                          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                        }}
                        className="w-full h-full object-cover pointer-events-none select-none"
                      />
                      <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-full text-xs font-extrabold text-white border border-white/20">
                        1/1
                      </div>

                      {cap && (
                        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent text-white z-10">
                          <p className="text-sm sm:text-base font-bold leading-relaxed text-pink-100">💬 {cap}</p>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedImage(photos[0]);
                        }}
                        className="absolute bottom-3 right-3 p-2.5 bg-black/70 rounded-full text-white opacity-80 hover:opacity-100 transition-opacity backdrop-blur-md border border-white/20 shadow-md z-10"
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
                        className={`relative w-full aspect-[16/10] sm:aspect-[16/9] bg-black overflow-hidden group flex items-center justify-center ${
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
                        <img
                          src={photos[photoSubIndex]}
                          alt={`${currentStory.title} - 사진 ${photoSubIndex + 1}`}
                          style={{
                            transform: `scale(${zoomScale}) translate(${zoomPan.x / zoomScale}px, ${zoomPan.y / zoomScale}px)`,
                            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                          }}
                          className="w-full h-full object-cover pointer-events-none select-none"
                        />

                        {/* Top Right Badge */}
                        <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-full text-xs font-extrabold text-white border border-white/20">
                          사진 {photoSubIndex + 1} / {photos.length}
                        </div>

                        {/* Photo Caption Overlay */}
                        {currentStory.imageCaptions?.[photoSubIndex] && (
                          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent text-white z-10">
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
                          className="absolute bottom-3 right-3 p-2.5 bg-black/70 rounded-full text-white opacity-80 hover:opacity-100 transition-opacity backdrop-blur-md border border-white/20 shadow-md z-10"
                          title="전체화면 크게 보기"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      /* Final Step: ALL Photos Together Grid View - Full Screen Maximize */
                      <div className="w-full bg-black flex flex-col">
                        <div className="w-full bg-black/90 px-4 py-2 flex items-center justify-between border-b border-white/10 text-white">
                          <span className="text-xs sm:text-sm font-black text-pink-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 fill-pink-400" />
                            <span>사진 {photos.length}장 모아보기 (TV 대형 화면)</span>
                          </span>
                          <span className="text-xs text-white/70 font-bold">사진 클릭 시 원본 크게보기</span>
                        </div>

                        <div className={`grid gap-2 p-1 bg-black w-full ${photos.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
                          {photos.map((imgUrl, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="relative w-full h-[450px] sm:h-[580px] lg:h-[680px] rounded-xl overflow-hidden bg-black border border-white/10 group cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(imgUrl);
                              }}
                            >
                              <img
                                src={imgUrl}
                                alt={`${currentStory.title} - 사진 ${imgIdx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                              />
                              <span className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-xs sm:text-sm font-black px-3 py-1 rounded-full border border-white/20 shadow-md z-10">
                                #{imgIdx + 1}
                              </span>
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                                <span className="bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 backdrop-blur-md">
                                  <ZoomIn className="w-4 h-4 text-pink-400" />
                                  <span>원본 크게 보기</span>
                                </span>
                              </div>
                            </div>
                          ))}
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
                  <span className="font-black mr-2 text-black text-base sm:text-lg lg:text-xl">{currentStory.studentName}</span>
                  <span className="font-extrabold text-pink-600 mr-2">[{currentStory.title}]</span>
                </p>
                <p className="whitespace-pre-wrap font-medium text-[#262626] leading-loose text-base sm:text-lg">
                  {currentStory.content}
                </p>

                {/* Hashtags */}
                <p className="text-xs sm:text-sm font-bold text-sky-600 pt-2 space-x-2">
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
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt={s.studentName} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full bg-[#EFEFEF] flex items-center justify-center text-[10px] text-[#262626] font-bold">
                    {s.studentName.slice(0, 2)}
                  </div>
                )}
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
              <img
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
    </div>
  );
};
