import React from 'react';
import { Presentation, PenTool, LayoutGrid, Settings, Sparkles, Database, ShieldCheck } from 'lucide-react';
import { WEEKS_LIST, GasConfig, RosterStudent } from '../types';

interface HeaderProps {
  currentView: 'ppt' | 'form' | 'gallery';
  setCurrentView: (view: 'ppt' | 'form' | 'gallery') => void;
  selectedWeek: string;
  setSelectedWeek: (week: string) => void;
  selectedClass?: string;
  setSelectedClass?: (cName: string) => void;
  roster?: RosterStudent[];
  gasConfig: GasConfig;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  storyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  selectedWeek,
  setSelectedWeek,
  selectedClass = '전체',
  setSelectedClass,
  roster = [],
  gasConfig,
  onOpenSettings,
  onOpenAdmin,
  storyCount
}) => {
  const availableClasses = Array.from(
    new Set(
      roster.map((s) => s.className?.trim()).filter(Boolean) as string[]
    )
  );

  return (
    <header id="main-header" className="bg-white/95 border-b border-[#DBDBDB] sticky top-0 z-40 text-[#262626] backdrop-blur-md shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          
          {/* Logo & Instagram Branding */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setCurrentView('ppt')}>
            <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-sm hover:scale-105 transition-transform">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center p-0.5">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-500 flex items-center justify-center text-white">
                  <Presentation className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 bg-clip-text text-transparent flex items-center gap-1.5">
                  Classgram <Sparkles className="w-4 h-4 text-pink-500 fill-pink-500 inline" />
                </h1>
              </div>
              <p className="text-[11px] text-[#8E8E8E] font-bold tracking-tight hidden sm:block">우리들의 주말 이야기 • PPT Presentation</p>
            </div>
          </div>

          {/* Navigation View Buttons (Instagram-styled pill tabs) */}
          <nav className="flex items-center bg-[#EFEFEF] p-1 rounded-full border border-[#DBDBDB] text-xs font-semibold">
            <button
              id="nav-btn-ppt"
              onClick={() => setCurrentView('ppt')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all ${
                currentView === 'ppt'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold shadow-xs'
                  : 'text-[#737373] hover:text-[#262626] hover:bg-white/70'
              }`}
            >
              <Presentation className="w-4 h-4" />
              <span>PPT 발표</span>
              <span className={`ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full font-bold ${currentView === 'ppt' ? 'bg-white/20 text-white' : 'bg-[#DBDBDB] text-[#262626]'}`}>
                {storyCount}
              </span>
            </button>

            <button
              id="nav-btn-form"
              onClick={() => setCurrentView('form')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all ${
                currentView === 'form'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold shadow-xs'
                  : 'text-[#737373] hover:text-[#262626] hover:bg-white/70'
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span>학부모 작성/수정</span>
            </button>

            <button
              id="nav-btn-gallery"
              onClick={() => setCurrentView('gallery')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all ${
                currentView === 'gallery'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold shadow-xs'
                  : 'text-[#737373] hover:text-[#262626] hover:bg-white/70'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>전체 모아보기</span>
            </button>
          </nav>

          {/* Right Section: Class Filter, Week Filter, Admin Button & Settings */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Class Filter Selector */}
            {setSelectedClass && (
              <div className="relative">
                <select
                  id="header-class-select"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-[#F1EFE9] text-[#2D2A26] text-xs font-bold px-3.5 py-2 pr-7 rounded-full border border-[#E8E4D9] focus:outline-none focus:ring-2 focus:ring-[#7C8E7E] cursor-pointer appearance-none shadow-xs"
                >
                  <option value="전체">전체 학급</option>
                  {availableClasses.map((cName) => (
                    <option key={cName} value={cName}>
                      {cName}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#8B8378]">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Week Filter Selector */}
            <div className="relative">
              <select
                id="header-week-select"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-[#F1EFE9] text-[#2D2A26] text-xs font-bold px-4 py-2 pr-8 rounded-full border border-[#E8E4D9] focus:outline-none focus:ring-2 focus:ring-[#7C8E7E] cursor-pointer appearance-none shadow-xs"
              >
                <option value="전체">전체 주차 보기</option>
                {WEEKS_LIST.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#8B8378]">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>

            {/* Admin Management Button */}
            <button
              id="header-admin-btn"
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#E8E4D9] bg-[#2D2A26] text-white hover:bg-[#7C8E7E] text-xs font-bold transition-all shadow-xs"
              title="관리자 (원아 명단 관리)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4A373]" />
              <span className="hidden sm:inline">관리자</span>
            </button>

            {/* GAS Sync Status / Settings Button */}
            <button
              id="header-settings-btn"
              onClick={onOpenSettings}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition-all ${
                gasConfig.isConnected
                  ? 'bg-[#7C8E7E]/10 border-[#7C8E7E]/30 text-[#5A7269] hover:bg-[#7C8E7E]/20'
                  : 'bg-white border-[#E8E4D9] text-[#5D574F] hover:bg-[#F5F2ED]'
              }`}
              title="구글 시트(GAS) 연동 설정"
            >
              {gasConfig.isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#7C8E7E] animate-pulse" />
                  <Database className="w-3.5 h-3.5 text-[#7C8E7E]" />
                  <span className="hidden md:inline">시트 연동됨</span>
                </>
              ) : (
                <>
                  <Settings className="w-3.5 h-3.5 text-[#8B8378]" />
                  <span className="hidden md:inline">구글 시트 설정</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
