import { useState, useEffect, useRef } from 'react';
import { StoryItem, ToastMessage, GasConfig, RosterStudent, getCurrentWeekString, isWeekMatch } from './types';
import { Header } from './components/Header';
import { StoryFormView } from './components/StoryFormView';
import { SlidePresentationView } from './components/SlidePresentationView';
import { WeekGalleryView } from './components/WeekGalleryView';
import { GasSettingsModal } from './components/GasSettingsModal';
import { AdminModal } from './components/AdminModal';
import { ToastContainer } from './components/Toast';
import {
  getLocalStories,
  saveLocalStories,
  getGasConfig,
  saveGasConfig,
  syncFromGas,
  postToGas,
  getRosterList,
  fetchStoriesFromServer,
  saveStoryToServer,
  deleteStoryFromServer,
  updateReactionOnServer,
  fetchRosterFromServer,
  saveRosterToServer,
  healLegacyStories
} from './lib/storage';
import { INITIAL_STORIES } from './lib/defaultData';

export default function App() {
  const [stories, setStories] = useState<StoryItem[]>(() => getLocalStories());
  const [roster, setRoster] = useState<RosterStudent[]>(() => getRosterList());
  const [selectedWeek, setSelectedWeek] = useState<string>(() => getCurrentWeekString());
  const [selectedClass, setSelectedClass] = useState<string>('전체');
  const [currentView, setCurrentView] = useState<'ppt' | 'form' | 'gallery'>('form');
  const [gasConfig, setGasConfig] = useState<GasConfig>({ webAppUrl: '', isConnected: false });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Track if initial sync has occurred
  const isInitialLoadedRef = useRef(false);

  // Load server-side persistent data & roster on mount + background polling for real-time multi-device sync
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [serverStories, serverRoster] = await Promise.all([
          fetchStoriesFromServer(),
          fetchRosterFromServer()
        ]);
        if (serverStories && serverStories.length > 0) {
          setStories(serverStories);
        }
        if (serverRoster && serverRoster.length > 0) {
          setRoster(serverRoster);
        }

        // Proactively heal any legacy idb: references in local cache
        healLegacyStories().then((healed) => {
          if (healed && healed.length > 0) {
            setStories(healed);
          }
        }).catch(() => {});
      } catch (e) {
        console.warn('Initial server fetch warning:', e);
      } finally {
        isInitialLoadedRef.current = true;
      }
    }

    loadInitialData();

    // Load GAS config
    const gasConf = getGasConfig();
    setGasConfig(gasConf);

    // Background polling every 8 seconds so stories submitted by parents on their phones automatically show on the teacher's screen
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/stories');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.stories)) {
            setStories((prev) => {
              const makeKey = (s: StoryItem) =>
                `${s.studentName.trim().toLowerCase()}_${(s.week || '전체').replace(/\s+/g, '')}`;

              const map = new Map<string, StoryItem>();
              for (const s of prev) {
                if (s && s.studentName) {
                  map.set(makeKey(s), s);
                }
              }
              for (const s of data.stories as StoryItem[]) {
                if (s && s.studentName) {
                  const k = makeKey(s);
                  const existing = map.get(k);
                  if (!existing) {
                    map.set(k, s);
                  } else {
                    const exPhotos = (existing.imageUrls || []).filter(
                      (u: string) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
                    );
                    const newPhotos = (s.imageUrls || []).filter(
                      (u: string) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
                    );
                    const bestPhotos = newPhotos.length >= exPhotos.length ? newPhotos : exPhotos;
                    const cleanCover = (s.imageUrl && !s.imageUrl.startsWith('idb:'))
                      ? s.imageUrl
                      : ((existing.imageUrl && !existing.imageUrl.startsWith('idb:')) ? existing.imageUrl : (bestPhotos[0] || ''));
                    const merged: StoryItem = {
                      ...existing,
                      ...s,
                      id: s.id || existing.id,
                      imageUrls: bestPhotos.length > 0 ? bestPhotos : (existing.imageUrls || []).filter(u => typeof u === 'string' && !u.startsWith('idb:')),
                      imageUrl: bestPhotos[0] || cleanCover
                    };
                    map.set(k, merged);
                  }
                }
              }
              const finalStories = Array.from(map.values());
              saveLocalStories(finalStories);
              return finalStories;
            });
          }
        }
      } catch (err) {
        // Silent polling error
      }
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Update Story Reaction
  const handleUpdateReaction = async (storyId: string, emoji: string) => {
    // Optimistic UI update
    setStories((prev) =>
      prev.map((item) => {
        if (item.id === storyId) {
          const currentReactions = item.reactions || {};
          const currentCount = currentReactions[emoji] || 0;
          return {
            ...item,
            reactions: {
              ...currentReactions,
              [emoji]: currentCount + 1
            }
          };
        }
        return item;
      })
    );

    try {
      const updatedList = await updateReactionOnServer(storyId, emoji);
      if (updatedList && updatedList.length > 0) {
        setStories(updatedList);
      }
    } catch (e) {
      console.error('Reaction sync error:', e);
    }
  };

  // Save or Edit Story (Stored permanently on server)
  const handleSaveStory = async (storyData: Omit<StoryItem, 'id' | 'createdAt'> & { id?: string }) => {
    let savedStory: StoryItem;

    if (storyData.id) {
      // Editing existing story by ID
      savedStory = {
        ...storyData,
        id: storyData.id,
        createdAt: new Date().toISOString()
      } as StoryItem;
    } else {
      // Check if there is already a story for this student and this week
      const existing = stories.find(
        (s) =>
          s.studentName.trim().toLowerCase() === storyData.studentName.trim().toLowerCase() &&
          isWeekMatch(s.week, storyData.week)
      );

      if (existing) {
        savedStory = {
          ...existing,
          ...storyData,
          id: existing.id,
          createdAt: existing.createdAt || new Date().toISOString()
        };
      } else {
        savedStory = {
          ...storyData,
          id: 'story-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          createdAt: new Date().toISOString()
        };
      }
    }

    // Persist to server (converts images to permanent disk files)
    const result = await saveStoryToServer(savedStory);

    if (result.stories && result.stories.length > 0) {
      setStories(result.stories);
    } else {
      setStories((prev) => {
        const idx = prev.findIndex((s) => s.id === savedStory.id);
        if (idx !== -1) {
          const cp = [...prev];
          cp[idx] = savedStory;
          return cp;
        }
        return [savedStory, ...prev];
      });
    }

    // Sync to GAS if connected
    if (gasConfig.isConnected && gasConfig.webAppUrl) {
      postToGas(gasConfig.webAppUrl, savedStory);
    }

    showToast('사진과 이야기가 저장되었습니다!', 'success');

    // Automatically switch to PPT view of that week so teacher/students can see the slide!
    setSelectedWeek(savedStory.week);
    setCurrentView('ppt');
  };

  // Save GAS config
  const handleSaveGasConfig = (config: GasConfig) => {
    setGasConfig(config);
    saveGasConfig(config);
  };

  // Reset Sample Data
  const handleResetSampleData = () => {
    if (!confirm('데이터를 초기화하시겠습니까?')) return;
    setStories([]);
    saveLocalStories([]);
    showToast('데이터가 초기화되었습니다.', 'info');
  };

  // Delete Story
  const handleDeleteStory = async (id: string) => {
    if (!confirm('이 주말 이야기를 삭제하시겠습니까?')) {
      return;
    }
    const updated = await deleteStoryFromServer(id);
    setStories(updated);
    showToast('이야기가 정상적으로 삭제되었습니다.', 'info');
  };

  // Save Roster
  const handleSaveRoster = async (newRoster: RosterStudent[]) => {
    setRoster(newRoster);
    const updated = await saveRosterToServer(newRoster);
    setRoster(updated);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#3D3A35] font-sans antialiased selection:bg-[#7C8E7E] selection:text-white flex flex-col justify-between">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Main Header Bar */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        selectedWeek={selectedWeek}
        setSelectedWeek={setSelectedWeek}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        roster={roster}
        gasConfig={gasConfig}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        storyCount={stories.filter((s) => {
          const matchWeek = selectedWeek === '전체' || isWeekMatch(s.week, selectedWeek);
          const stClass = roster.find(r => r.name.trim().toLowerCase() === s.studentName.trim().toLowerCase())?.className || '은솔1반';
          const matchClass = selectedClass === '전체' || stClass === selectedClass;
          return matchWeek && matchClass;
        }).length}
      />

      {/* Main Content Area based on current view */}
      <main className="flex-1">
        {currentView === 'ppt' && (
          <SlidePresentationView
            stories={stories}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            selectedClass={selectedClass}
            setSelectedClass={setSelectedClass}
            roster={roster}
            onUpdateReaction={handleUpdateReaction}
          />
        )}

        {currentView === 'form' && (
          <StoryFormView
            selectedWeek={selectedWeek}
            allStories={stories}
            roster={roster}
            onSaveStory={handleSaveStory}
            onDeleteStory={handleDeleteStory}
            onShowToast={showToast}
          />
        )}

        {currentView === 'gallery' && (
          <WeekGalleryView
            stories={stories}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            onSelectForPresentation={(week) => {
              if (week) setSelectedWeek(week);
              setCurrentView('ppt');
            }}
            onDeleteStory={handleDeleteStory}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-[#E8E4D9] bg-[#F5F2ED] text-center text-xs text-[#8B8378] font-medium">
        <p>우리의 주말 지낸 이야기 • Natural Tones Classroom Storyboard • 실시간 다중 기기 영구 저장 & Google Gemini AI</p>
      </footer>

      {/* Google Apps Script Settings Modal */}
      <GasSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        gasConfig={gasConfig}
        onSaveGasConfig={handleSaveGasConfig}
        onResetSampleData={handleResetSampleData}
        onShowToast={showToast}
      />

      {/* Admin Student Roster & Data Recovery Modal */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        roster={roster}
        allStories={stories}
        onSaveRoster={handleSaveRoster}
        onStoriesUpdated={(newStories) => setStories(newStories)}
        onShowToast={showToast}
      />
    </div>
  );
}
