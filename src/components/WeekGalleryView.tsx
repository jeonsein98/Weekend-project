import React, { useState, useEffect } from 'react';
import { Presentation, Trash2, Search, Sparkles, Heart, Filter, MessageCircle, CheckCircle2, Camera, ImageOff, RefreshCw } from 'lucide-react';
import { StoryItem, WEEKS_LIST, isWeekMatch } from '../types';
import { WeekTabBar } from './WeekTabBar';

interface WeekGalleryViewProps {
  stories: StoryItem[];
  selectedWeek: string;
  setSelectedWeek: (week: string) => void;
  onSelectForPresentation: (week: string) => void;
  onDeleteStory: (id: string) => void;
}

const GalleryCardPhoto: React.FC<{
  photoUrl?: string;
  studentName: string;
  title?: string;
}> = ({ photoUrl, studentName, title }) => {
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(photoUrl);
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentUrl(photoUrl);
    setRetryCount(0);
    setHasError(false);
  }, [photoUrl]);

  const handleImageError = () => {
    if (retryCount < 2 && photoUrl) {
      setRetryCount((prev) => prev + 1);
      // Retry loading once or twice in case network was busy
      setTimeout(() => {
        const sep = photoUrl.includes('?') ? '&' : '?';
        setCurrentUrl(`${photoUrl}${sep}r=${Date.now()}`);
      }, 600);
    } else {
      setHasError(true);
    }
  };

  if (!photoUrl) {
    return (
      <div className="w-full h-full bg-linear-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center p-4 text-center select-none">
        <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-amber-600 mb-2 font-bold text-sm">
          {studentName.slice(0, 2)}
        </div>
        <span className="text-xs font-bold text-[#2D2A26]">{studentName} 어린이</span>
        <span className="text-[10px] text-[#8E8E8E] mt-0.5">사진 등록 대기 중</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full bg-[#1F1E1D] flex flex-col items-center justify-center p-4 text-center select-none text-white/90">
        <Camera className="w-8 h-8 text-amber-400 mb-2 opacity-80" />
        <span className="text-xs font-bold text-amber-200">{studentName} 어린이 사진</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setHasError(false);
            setRetryCount(0);
            const sep = photoUrl.includes('?') ? '&' : '?';
            setCurrentUrl(`${photoUrl}${sep}reload=${Date.now()}`);
          }}
          className="mt-2 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[10px] font-bold flex items-center gap-1 text-white transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <>
      <img
        src={currentUrl}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none"
      />
      <img
        src={currentUrl}
        alt={title || `${studentName}의 주말 이야기`}
        onError={handleImageError}
        className="relative z-10 max-h-full max-w-full object-contain group-hover/img:scale-105 transition-transform duration-500 drop-shadow-md"
      />
    </>
  );
};

export const WeekGalleryView: React.FC<WeekGalleryViewProps> = ({
  stories,
  selectedWeek,
  setSelectedWeek,
  onSelectForPresentation,
  onDeleteStory
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStories = stories.filter((s) => {
    const matchesWeek = selectedWeek === '전체' || isWeekMatch(s.week, selectedWeek);
    const matchesSearch =
      !searchQuery.trim() ||
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWeek && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4">
      {/* Week Date Tabs Bar (날짜탭) */}
      <WeekTabBar
        selectedWeek={selectedWeek}
        onSelectWeek={setSelectedWeek}
        stories={stories}
        className="rounded-2xl border mb-6 shadow-2xs"
      />

      {/* Instagram Profile-style Header Controls */}
      <div className="bg-white border border-[#DBDBDB] rounded-3xl p-5 sm:p-6 mb-6 text-[#262626] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-2xs">
        
        <div className="flex items-center gap-3">
          <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-2xs shrink-0">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center p-0.5">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white">
                <Sparkles className="w-6 h-6 fill-white" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#262626] flex items-center gap-1.5">
              인스타그램 그리드 피드
            </h2>
            <p className="text-xs text-[#737373] font-medium mt-0.5">
              학급 전체 이야기를 한눈에 모아보고 원하는 순간으로 발표를 시작해보세요.
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Selector */}
          <div className="flex items-center gap-2 bg-[#F5F5F5] px-3.5 py-2 rounded-full border border-[#DBDBDB]">
            <Filter className="w-4 h-4 text-pink-500" />
            <select
              id="gallery-week-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-[#262626] focus:outline-none cursor-pointer"
            >
              <option value="전체" className="bg-white text-[#262626]">전체 주차 ({stories.length}건)</option>
              {WEEKS_LIST.map((w) => {
                const count = stories.filter((s) => isWeekMatch(s.week, w)).length;
                return (
                  <option key={w} value={w} className="bg-white text-[#262626]">
                    {w} ({count}건)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Student Name Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-[#8E8E8E]" />
            <input
              id="gallery-search-input"
              type="text"
              placeholder="학생 또는 내용 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F5F5F5] border border-[#DBDBDB] rounded-full pl-9 pr-4 py-2 text-xs text-[#262626] placeholder-[#8E8E8E] focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Quick PPT Presentation Trigger */}
          <button
            id="gallery-start-ppt-btn"
            onClick={() => onSelectForPresentation(selectedWeek)}
            disabled={filteredStories.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 hover:opacity-90 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Presentation className="w-4 h-4" />
            <span>PPT 발표 시작</span>
          </button>
        </div>

      </div>

      {/* Stories Grid */}
      {filteredStories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#DBDBDB] text-[#737373] p-6">
          <p className="font-extrabold text-base text-[#262626] mb-1">
            {selectedWeek === '전체' ? '일치하는 이야기 게시물이 없습니다.' : `'${selectedWeek}'에 등록된 이야기가 없습니다.`}
          </p>
          <p className="text-xs mb-4">주차 필터를 변경하거나 새로운 게시물을 등록해 보세요.</p>
          {stories.length > 0 && selectedWeek !== '전체' && (
            <button
              onClick={() => setSelectedWeek('전체')}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white text-xs font-black shadow-xs hover:opacity-90 transition-all active:scale-95 cursor-pointer"
            >
              전체 주차 이야기 보기 (총 {stories.length}건)
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {filteredStories.map((story) => {
            const rawPhotos = story.imageUrls && story.imageUrls.length > 0
              ? story.imageUrls
              : (story.imageUrl ? [story.imageUrl] : []);
            const photos = rawPhotos.filter((u: any) => typeof u === 'string' && u.trim().length > 0);
            const coverPhoto = photos[0];
            const totalReactions = (Object.values(story.reactions || {}) as (number | string)[]).reduce<number>((acc, curr) => acc + (Number(curr) || 0), 0);

            return (
              <div
                key={story.id}
                className="bg-white border border-[#DBDBDB] rounded-2xl overflow-hidden hover:border-pink-500 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between group relative"
              >
                {/* Header Profile Bar */}
                <div className="flex items-center justify-between p-2.5 bg-white border-b border-[#EFEFEF]">
                  <div className="flex items-center gap-2">
                    <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]">
                      <div className="w-6 h-6 rounded-full bg-white p-0.5 flex items-center justify-center">
                        <span className="text-[9px] font-black text-[#262626]">{story.studentName.slice(0, 1)}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#262626] truncate max-w-[90px]">
                      {story.studentName}
                    </span>
                    <CheckCircle2 className="w-3 h-3 text-sky-500 fill-sky-500 shrink-0" />
                  </div>

                  <span className="text-[10px] text-[#8E8E8E] font-bold">
                    {story.week}
                  </span>
                </div>

                {/* Photo Grid Box */}
                <div className="relative aspect-square bg-black overflow-hidden group/img cursor-pointer flex items-center justify-center" onClick={() => onSelectForPresentation(story.week)}>
                  <GalleryCardPhoto photoUrl={coverPhoto} studentName={story.studentName} title={story.title} />

                  {/* Multi-photo badge */}
                  {photos.length > 1 && (
                    <span className="absolute top-2 right-2 bg-black/70 text-white border border-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md">
                      📷 {photos.length}
                    </span>
                  )}

                  {/* Hover Overlay with Heart & Comments */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-extrabold text-sm backdrop-blur-xs">
                    <span className="flex items-center gap-1">
                      <Heart className="w-5 h-5 fill-white text-white" />
                      {totalReactions}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-5 h-5 fill-white text-white" />
                      1
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    id={`gallery-delete-btn-${story.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`${story.studentName} 학생의 이야기를 삭제하시겠습니까?`)) {
                        onDeleteStory(story.id);
                      }
                    }}
                    className="absolute top-2 left-2 p-1.5 bg-black/60 text-white hover:text-rose-400 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity border border-white/20 backdrop-blur-md shadow-xs z-10"
                    title="게시물 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

