import React, { useState, useEffect } from 'react';
import { RosterStudent, StoryItem, isWeekMatch } from '../types';
import { Users, Sparkles, UserCheck } from 'lucide-react';

interface InstagramStoryBarProps {
  stories: StoryItem[];
  roster: RosterStudent[];
  selectedClass: string;
  setSelectedClass: (cName: string) => void;
  selectedWeek: string;
  onSelectStudentStory?: (storyId: string) => void;
  currentStoryId?: string;
}

const StudentStoryAvatar: React.FC<{ photoUrl?: string; studentName: string }> = ({ photoUrl, studentName }) => {
  const [currentUrl, setCurrentUrl] = useState(photoUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentUrl(photoUrl);
    setHasError(false);
  }, [photoUrl]);

  if (currentUrl && !hasError) {
    return (
      <img
        src={currentUrl}
        alt=""
        onError={() => setHasError(true)}
        className="w-full h-full object-cover rounded-full"
      />
    );
  }

  const displayName = studentName.length >= 2 ? studentName.slice(-2) : studentName;

  return (
    <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-100 via-purple-50 to-amber-100 flex items-center justify-center text-xs font-extrabold text-pink-600">
      {displayName}
    </div>
  );
};

export const InstagramStoryBar: React.FC<InstagramStoryBarProps> = ({
  stories,
  roster,
  selectedClass,
  setSelectedClass,
  selectedWeek,
  onSelectStudentStory,
  currentStoryId
}) => {
  // Get list of all available classes
  const classesList = Array.from(
    new Set([
      '전체',
      ...roster.map((s) => s.className?.trim() || '은솔1반'),
      '은솔1반'
    ])
  );

  // Get stories for current week or overall
  const weekStories = stories.filter((s) => selectedWeek === '전체' || isWeekMatch(s.week, selectedWeek));

  return (
    <div className="w-full bg-white border-b border-[#DBDBDB] py-3.5 px-4 overflow-x-auto no-scrollbar shadow-2xs select-none">
      <div className="max-w-7xl mx-auto flex items-center gap-4 sm:gap-6 min-w-max">
        
        {/* Class Filter Story Bubbles */}
        {classesList.map((cName) => {
          const isSelected = selectedClass === cName;
          const classStoryCount = cName === '전체'
            ? weekStories.length
            : weekStories.filter((s) => {
                const match = roster.find((r) => r.name.trim().toLowerCase() === s.studentName.trim().toLowerCase());
                return (match?.className?.trim() || '은솔1반') === cName;
              }).length;

          return (
            <button
              key={cName}
              onClick={() => setSelectedClass(cName)}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div
                className={`p-[2.5px] rounded-full transition-all duration-300 ${
                  isSelected
                    ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] scale-105 shadow-xs ring-2 ring-pink-500/30'
                    : 'bg-[#DBDBDB] hover:bg-gradient-to-tr hover:from-purple-500 hover:to-pink-500'
                }`}
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white p-0.5 flex items-center justify-center">
                  <div
                    className={`w-full h-full rounded-full flex flex-col items-center justify-center text-xs font-extrabold transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-br from-purple-600 to-pink-500 text-white'
                        : 'bg-[#F5F5F5] text-[#262626] group-hover:bg-[#EFEFEF]'
                    }`}
                  >
                    {cName === '전체' ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      <span className="text-[11px] leading-tight">{cName.replace('반', '')}반</span>
                    )}
                    <span className="text-[9px] opacity-80 mt-0.5 font-normal">
                      {classStoryCount}개
                    </span>
                  </div>
                </div>
              </div>
              <span className={`text-[11px] font-bold max-w-[64px] truncate ${isSelected ? 'text-black' : 'text-[#737373]'}`}>
                {cName === '전체' ? '전체 학급' : cName}
              </span>
            </button>
          );
        })}

        {/* Vertical Divider */}
        <div className="w-px h-10 bg-[#DBDBDB] shrink-0" />

        {/* Individual Student Story Bubbles for Selected Week */}
        <div className="flex items-center gap-3.5 sm:gap-5">
          {weekStories.length === 0 ? (
            <span className="text-xs text-[#8E8E8E] font-medium italic py-2">
              이 주차에는 등록된 게시물이 없습니다.
            </span>
          ) : (
            weekStories.map((story) => {
              const isActive = story.id === currentStoryId;
              const photoUrl = (story.imageUrls && story.imageUrls.length > 0) ? story.imageUrls[0] : (story.imageUrl || '');

              return (
                <button
                  key={story.id}
                  onClick={() => onSelectStudentStory && onSelectStudentStory(story.id)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                  title={`${story.studentName}의 이야기`}
                >
                  <div
                    className={`p-[2px] rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] scale-110 shadow-sm ring-2 ring-pink-500/40'
                        : 'bg-gradient-to-tr from-amber-400 via-rose-400 to-purple-500 opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white p-0.5 overflow-hidden">
                      <StudentStoryAvatar photoUrl={photoUrl} studentName={story.studentName} />
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold max-w-[64px] truncate ${isActive ? 'text-black underline decoration-pink-500' : 'text-[#262626]'}`}>
                    {story.studentName}
                  </span>
                </button>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
