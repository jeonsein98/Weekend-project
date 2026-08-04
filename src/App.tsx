/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SlidePresentationView } from './components/SlidePresentationView';
import { StoryFormView } from './components/StoryFormView';
import { WeekGalleryView } from './components/WeekGalleryView';
import { GasSettingsModal } from './components/GasSettingsModal';
import { AdminModal } from './components/AdminModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { StoryItem, GasConfig, RosterStudent, getCurrentWeekString } from './types';
import {
  getLocalStories,
  saveLocalStories,
  getGasConfig,
  saveGasConfig,
  syncFromGas,
  postToGas,
  getRosterList,
  saveRosterList
} from './lib/storage';
import { INITIAL_STORIES } from './lib/defaultData';

export default function App() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(() => getCurrentWeekString());
  const [selectedClass, setSelectedClass] = useState<string>('전체');
  const [currentView, setCurrentView] = useState<'ppt' | 'form' | 'gallery'>('ppt');
  const [gasConfig, setGasConfig] = useState<GasConfig>({ webAppUrl: '', isConnected: false });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load initial local data and gas config on mount
  useEffect(() => {
    const localData = getLocalStories();
    setStories(localData);

    const initialRoster = getRosterList();
    setRoster(initialRoster);

    const gasConf = getGasConfig();
    setGasConfig(gasConf);

    // If GAS is configured, sync in background
    if (gasConf.isConnected && gasConf.webAppUrl) {
      syncFromGas(gasConf.webAppUrl).then((remoteStories) => {
        if (remoteStories && remoteStories.length > 0) {
          setStories(remoteStories);
          saveLocalStories(remoteStories);
        }
      });
    }
  }, []);

  // Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Update Story Reaction
  const handleUpdateReaction = (storyId: string, emoji: string) => {
    setStories((prev) => {
      const updated = prev.map((item) => {
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
      });
      saveLocalStories(updated);
      return updated;
    });
  };

  // Save or Edit Story
  const handleSaveStory = async (storyData: Omit<StoryItem, 'id' | 'createdAt'> & { id?: string }) => {
    let updatedStories: StoryItem[];
    let savedStory: StoryItem;

    if (storyData.id) {
      // Editing existing story by ID
      savedStory = {
        ...storyData,
        id: storyData.id,
        createdAt: new Date().toISOString()
      } as StoryItem;

      updatedStories = stories.map((s) => (s.id === storyData.id ? savedStory : s));
    } else {
      // Check if there is already a story for this student and this week
      const existing = stories.find(
        (s) => s.studentName === storyData.studentName && s.week === storyData.week
      );

      if (existing) {
        // Update existing story for that student and week
        savedStory = {
          ...existing,
          ...storyData,
          id: existing.id,
          createdAt: new Date().toISOString()
        };
        updatedStories = stories.map((s) => (s.id === existing.id ? savedStory : s));
      } else {
        // Create new story
        savedStory = {
          ...storyData,
          id: 'story-' + Date.now(),
          createdAt: new Date().toISOString()
        };
        updatedStories = [savedStory, ...stories];
      }
    }

    setStories(updatedStories);
    saveLocalStories(updatedStories);

    // Sync to GAS if connected
    if (gasConfig.isConnected && gasConfig.webAppUrl) {
      postToGas(gasConfig.webAppUrl, savedStory);
    }

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
    setStories(INITIAL_STORIES);
    saveLocalStories(INITIAL_STORIES);
  };

  // Delete Story
  const handleDeleteStory = (id: string) => {
    const updated = stories.filter((s) => s.id !== id);
    setStories(updated);
    saveLocalStories(updated);
    showToast('이야기가 삭제되었습니다.', 'info');
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
          const matchWeek = selectedWeek === '전체' || s.week === selectedWeek;
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
        <p>우리의 주말 지낸 이야기 • Natural Tones Classroom Storyboard • Google Gemini AI & Apps Script Google Sheets 연동</p>
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

      {/* Admin Student Roster Modal */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        roster={roster}
        allStories={stories}
        onSaveRoster={(newRoster) => {
          setRoster(newRoster);
          saveRosterList(newRoster);
        }}
        onShowToast={showToast}
      />
    </div>
  );
}
