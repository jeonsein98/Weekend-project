import React, { useRef, useEffect } from 'react';
import { StoryItem, WEEKS_LIST, isWeekMatch } from '../types';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekTabBarProps {
  selectedWeek: string;
  onSelectWeek: (week: string) => void;
  stories?: StoryItem[];
  className?: string;
}

export const WeekTabBar: React.FC<WeekTabBarProps> = ({
  selectedWeek,
  onSelectWeek,
  stories = [],
  className = ''
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active tab into view when selectedWeek changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [selectedWeek]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 240;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const allTabs = ['전체', ...WEEKS_LIST];

  return (
    <div className={`w-full bg-[#FAF9F6] border-y border-[#E8E4D9] py-2 px-3 relative select-none ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center gap-1.5">
        {/* Left Scroll Button */}
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="hidden sm:flex p-1.5 rounded-full hover:bg-white text-[#8B8378] hover:text-[#2D2A26] transition-colors shrink-0 shadow-2xs border border-transparent hover:border-[#E8E4D9]"
          title="이전 주차 보기"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable Tabs Track */}
        <div
          ref={scrollRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 touch-manipulation"
        >
          {allTabs.map((weekLabel) => {
            const isAll = weekLabel === '전체';
            const isSelected = isAll ? selectedWeek === '전체' : isWeekMatch(selectedWeek, weekLabel);

            const count = isAll
              ? stories.length
              : stories.filter((s) => isWeekMatch(s.week, weekLabel)).length;

            const isVacationWeek = weekLabel.includes('방학지낸이야기') || weekLabel.includes('방학지낸 이야기');

            return (
              <button
                key={weekLabel}
                ref={isSelected ? activeTabRef : undefined}
                type="button"
                onClick={() => onSelectWeek(weekLabel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 min-h-[34px] ${
                  isSelected
                    ? isVacationWeek
                      ? 'bg-[#7C8E7E] text-white shadow-sm ring-1 ring-[#5A6D5C]'
                      : 'bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white shadow-sm'
                    : isVacationWeek
                    ? 'bg-[#EBF1EC] text-[#425945] border border-[#C6D9C8] hover:bg-[#DDE7DE]'
                    : 'bg-white text-[#5D574F] border border-[#E8E4D9] hover:bg-[#F3EFEA] hover:text-[#2D2A26]'
                }`}
              >
                {isAll ? (
                  <>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>전체 주차</span>
                  </>
                ) : (
                  <span>{weekLabel}</span>
                )}

                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected
                        ? 'bg-white/30 text-white'
                        : isVacationWeek
                        ? 'bg-[#C6D9C8] text-[#2F4432]'
                        : 'bg-[#E8E4D9] text-[#2D2A26]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="hidden sm:flex p-1.5 rounded-full hover:bg-white text-[#8B8378] hover:text-[#2D2A26] transition-colors shrink-0 shadow-2xs border border-transparent hover:border-[#E8E4D9]"
          title="다음 주차 보기"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
