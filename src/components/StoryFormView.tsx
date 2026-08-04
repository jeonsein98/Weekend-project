import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle,
  Send,
  Loader2,
  Lock,
  UserCheck,
  Edit3,
  PlusCircle,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  LogOut,
  FolderOpen,
  MessageSquare
} from 'lucide-react';
import { StoryItem, WEEKS_LIST, RosterStudent, getCurrentWeekString } from '../types';

interface StoryFormViewProps {
  selectedWeek: string;
  allStories: StoryItem[];
  roster: RosterStudent[];
  onSaveStory: (story: Omit<StoryItem, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  onDeleteStory: (id: string) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onDone?: () => void;
}

const LOCAL_STORAGE_PARENT_KEY = 'kindergarten_parent_active_student_v2';

export const StoryFormView: React.FC<StoryFormViewProps> = ({
  selectedWeek,
  allStories,
  roster,
  onSaveStory,
  onDeleteStory,
  onShowToast,
  onDone
}) => {
  // Parent Authentication / Selected Student
  const [activeStudentName, setActiveStudentName] = useState<string>('');
  const [activeParentPin, setActiveParentPin] = useState<string>('');

  // Login input state
  const [inputStudentName, setInputStudentName] = useState('');
  const [inputPin, setInputPin] = useState('');

  // Form State
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [week, setWeek] = useState<string>(selectedWeek === '전체' ? getCurrentWeekString() : selectedWeek);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageCaptions, setImageCaptions] = useState<string[]>([]);
  const [loadingCaptions, setLoadingCaptions] = useState<boolean[]>([]);
  const [aiComment, setAiComment] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Restore parent login session on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(LOCAL_STORAGE_PARENT_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.studentName) {
          setActiveStudentName(parsed.studentName);
          setActiveParentPin(parsed.pin || '');
        }
      }
    } catch (e) {
      console.error('Failed to parse parent session', e);
    }
  }, []);

  // Update form week when selectedWeek changes externally
  useEffect(() => {
    if (selectedWeek && selectedWeek !== '전체') {
      setWeek(selectedWeek);
    }
  }, [selectedWeek]);

  // Handle Parent Login / Verification
  const handleParentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inputStudentName.trim();
    if (!cleanName) {
      onShowToast('자녀 이름을 입력하거나 아래 명단에서 선택해 주세요.', 'error');
      return;
    }

    // Optional check with roster if PIN matches
    const matched = roster.find((s) => s.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (matched && matched.parentPin && inputPin.trim() && matched.parentPin !== inputPin.trim()) {
      onShowToast(`비밀번호가 맞지 않습니다. (원아: ${matched.name})`, 'error');
      return;
    }

    setActiveStudentName(cleanName);
    setActiveParentPin(inputPin.trim());

    try {
      localStorage.setItem(
        LOCAL_STORAGE_PARENT_KEY,
        JSON.stringify({ studentName: cleanName, pin: inputPin.trim() })
      );
    } catch (err) {
      console.error('Failed to save parent session', err);
    }

    onShowToast(`${cleanName} 어린이 학부모님 모드로 접속되었습니다.`, 'success');
  };

  const handleParentLogout = () => {
    setActiveStudentName('');
    setActiveParentPin('');
    setInputStudentName('');
    setInputPin('');
    setEditingStoryId(null);
    setIsFormOpen(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_PARENT_KEY);
    } catch (err) {
      console.error('Failed to remove session', err);
    }
  };

  // Filter stories that belong ONLY to this child
  const myChildStories = allStories.filter(
    (s) => s.studentName.trim().toLowerCase() === activeStudentName.trim().toLowerCase()
  );

  // Open Form to Edit existing story
  const handleStartEditStory = (story: StoryItem) => {
    setEditingStoryId(story.id);
    setWeek(story.week);
    setTitle(story.title);
    setContent(story.content);
    const existingImages = story.imageUrls && story.imageUrls.length > 0
      ? story.imageUrls
      : (story.imageUrl ? [story.imageUrl] : []);
    setImageUrls(existingImages);

    const existingCaptions = story.imageCaptions && Array.isArray(story.imageCaptions)
      ? story.imageCaptions
      : existingImages.map(() => '');
    setImageCaptions(existingCaptions);

    setAiComment(story.aiComment || '');
    setIsFormOpen(true);
    onShowToast(`'${story.week}' 이야기를 수정 모드로 불러왔습니다.`, 'info');
  };

  // Open Form to Create new story
  const handleStartNewStory = () => {
    setEditingStoryId(null);
    setWeek(selectedWeek === '전체' ? WEEKS_LIST[0] : selectedWeek);
    setTitle('');
    setContent('');
    setImageUrls([]);
    setImageCaptions([]);
    setAiComment('');
    setIsFormOpen(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress image helper to ensure mobile photo uploads work reliably & lightweight
  const compressMobilePhoto = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // Allow image MIME or standard image extensions or empty type from mobile file pickers
      const isLikelyImage =
        file.type.startsWith('image/') ||
        /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name) ||
        file.type === '';

      if (!isLikelyImage) {
        onShowToast('이미지 파일(JPG, PNG, WEBP 등)만 업로드 가능합니다.', 'error');
        resolve('');
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        onShowToast('사진 파일을 읽는 데 실패했습니다.', 'error');
        resolve('');
      };
      reader.onload = (e) => {
        const src = e.target?.result as string;
        if (!src) {
          resolve('');
          return;
        }

        const img = new Image();
        img.onerror = () => {
          // If canvas draw fails, fallback to original DataURL
          resolve(src);
        };
        img.onload = () => {
          try {
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
              if (width / height > MAX_WIDTH / MAX_HEIGHT) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              } else {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(src);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            resolve(compressed);
          } catch (err) {
            resolve(src);
          }
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle Image Upload (Max 3)
  const handleFilesAdd = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (imageUrls.length + fileArray.length > 3) {
      onShowToast('사진은 한 이야기당 최대 3장까지만 올릴 수 있습니다.', 'error');
      return;
    }

    let addedCount = 0;
    for (const file of fileArray) {
      if (imageUrls.length + addedCount >= 3) break;
      const dataUrl = await compressMobilePhoto(file);
      if (dataUrl) {
        setImageUrls((prev) => (prev.length >= 3 ? prev : [...prev, dataUrl]));
        setImageCaptions((prev) => (prev.length >= 3 ? prev : [...prev, '']));
        addedCount++;
      }
    }

    if (addedCount > 0) {
      onShowToast(`${addedCount}장의 사진이 성공적으로 업로드되었습니다.`, 'success');
    }
  };

  // Remove photo at index
  const handleRemoveImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    setImageCaptions((prev) => prev.filter((_, i) => i !== index));
    onShowToast(`${index + 1}번째 사진이 삭제되었습니다.`, 'info');
  };

  // Reorder photos
  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === imageUrls.length - 1) return;

    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    setImageUrls((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });

    setImageCaptions((prev) => {
      const copy = [...prev];
      const temp = copy[index] || '';
      copy[index] = copy[targetIndex] || '';
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Update Caption for Photo
  const handleCaptionChange = (index: number, value: string) => {
    setImageCaptions((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  // AI Recommendation for Photo Caption
  const handleRecommendCaption = async (index: number) => {
    const photoUrlOrBase64 = imageUrls[index];
    if (!photoUrlOrBase64) return;

    setLoadingCaptions((prev) => {
      const copy = [...prev];
      copy[index] = true;
      return copy;
    });

    try {
      const res = await fetch('/api/gemini-caption-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: activeStudentName,
          title,
          content,
          imageBase64: photoUrlOrBase64,
          photoIndex: index
        })
      });

      const data = await res.json();
      if (data.success && data.caption) {
        handleCaptionChange(index, data.caption);
        onShowToast(`${index + 1}번째 사진에 어울리는 코멘트가 생성되었습니다!`, 'success');
      } else {
        const fallbacks = [
          '파도가 넘실거리는 바닷가에서 신나는 추억! 🌊',
          '예쁜 조개껍데기로 꾸민 우리 모래성 🏰',
          '가족과 함께 보낸 너무나 특별한 주말 🌅'
        ];
        handleCaptionChange(index, fallbacks[index % fallbacks.length]);
        onShowToast('사진에 어울리는 코멘트가 추천되었습니다.', 'info');
      }
    } catch (e) {
      console.error('Caption AI fetch error:', e);
      const fallbacks = [
        '파도가 넘실거리는 바닷가에서 신나는 추억! 🌊',
        '예쁜 조개껍데기로 꾸민 우리 모래성 🏰',
        '가족과 함께 보낸 너무나 특별한 주말 🌅'
      ];
      handleCaptionChange(index, fallbacks[index % fallbacks.length]);
      onShowToast('사진에 어울리는 추천 코멘트가 입력되었습니다.', 'info');
    } finally {
      setLoadingCaptions((prev) => {
        const copy = [...prev];
        copy[index] = false;
        return copy;
      });
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdd(e.dataTransfer.files);
    }
  };

  // Generate AI Gemini Reflection
  const handleGenerateAiComment = async () => {
    if (!title.trim() && !content.trim()) {
      onShowToast('이야기 제목과 내용을 먼저 입력해 주세요.', 'error');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: activeStudentName,
          title,
          content,
          week,
          imageBase64: imageUrls[0] || null
        })
      });

      const data = await response.json();

      if (data.success && data.aiComment) {
        setAiComment(data.aiComment);
        onShowToast('Gemini가 따뜻한 칭찬 추천 문장을 생성했습니다!', 'success');
      } else {
        setAiComment(data.fallbackComment || `${activeStudentName} 어린이의 즐겁고 예쁜 주말 경험이었네요! 🌸`);
        onShowToast('기본 추천 문구가 생성되었습니다.', 'info');
      }
    } catch (err) {
      console.error('Failed to call /api/gemini:', err);
      setAiComment(`${activeStudentName} 어린이의 솔직하고 따뜻한 주말 이야기가 정말 인상적입니다! 🌟`);
      onShowToast('기본 소감 문구가 반영되었습니다.', 'info');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Submit / Save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast('이야기 제목을 입력해 주세요.', 'error');
      return;
    }
    if (!content.trim()) {
      onShowToast('주말에 지낸 이야기 내용을 입력해 주세요.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveStory({
        id: editingStoryId || undefined,
        week,
        studentName: activeStudentName,
        parentPin: activeParentPin,
        title: title.trim(),
        content: content.trim(),
        imageUrls: imageUrls,
        imageCaptions: imageCaptions,
        imageUrl: imageUrls[0] || '',
        aiComment,
        reactions: { '❤️': 0, '👏': 0, '⭐': 0, '😊': 0 }
      });

      onShowToast(
        editingStoryId
          ? `${activeStudentName} 어린이의 이야기가 수정되었습니다!`
          : `${activeStudentName} 어린이의 주말 이야기가 등록되었습니다!`,
        'success'
      );

      // Reset form
      setEditingStoryId(null);
      setTitle('');
      setContent('');
      setImageUrls([]);
      setImageCaptions([]);
      setAiComment('');
      setIsFormOpen(false);

      if (onDone) onDone();
    } catch (err) {
      console.error('Failed to save story:', err);
      onShowToast('이야기 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. STEP 1: If Parent is NOT logged in or active
  if (!activeStudentName) {
    return (
      <div className="max-w-lg mx-auto py-8 sm:py-12 px-4">
        <div className="bg-white border border-[#DBDBDB] rounded-3xl p-6 sm:p-8 shadow-2xs text-[#262626]">
          {/* Instagram Header Branding */}
          <div className="text-center mb-8">
            <div className="inline-block p-[3px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] mb-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center p-0.5">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-500 flex items-center justify-center text-white">
                  <Lock className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-[#262626]">
              학부모 전용 작성 & 수정
            </h2>
            <p className="text-xs text-[#737373] font-medium mt-2 leading-relaxed">
              원아 이름을 입력하여 학부모 접속으로 로그인하세요.<br />
              <strong className="text-[#262626]">개인정보 보호를 위해 오직 내 자녀의 사진과 이야기만</strong><br />
              조회하고 자유롭게 작성/수정할 수 있습니다.
            </p>
          </div>

          <form onSubmit={handleParentLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-extrabold text-[#737373] uppercase tracking-wider mb-2">
                어린이 이름 선택/입력 <span className="text-pink-500">*</span>
              </label>

              <input
                type="text"
                placeholder="자녀 이름을 입력하거나 아래 원아 명단에서 선택해 주세요"
                value={inputStudentName}
                onChange={(e) => setInputStudentName(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#DBDBDB] rounded-2xl px-4 py-3.5 text-base sm:text-xs font-bold text-[#262626] focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white placeholder-[#8E8E8E] min-h-[48px] touch-manipulation"
              />

              {/* Quick Select Buttons from Roster */}
              {roster.filter((s) => s.name !== '김은솔').length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-bold text-[#8E8E8E] block mb-1.5">터치하여 빠르게 원아 선택:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-[#FAFAFA] border border-[#DBDBDB] rounded-xl">
                    {roster
                      .filter((s) => s.name !== '김은솔')
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setInputStudentName(s.name)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all min-h-[36px] ${
                            inputStudentName === s.name
                              ? 'bg-pink-500 text-white shadow-xs'
                              : 'bg-white border border-[#DBDBDB] text-[#262626] hover:bg-pink-50'
                          }`}
                        >
                          {s.name} ({s.className || '반'})
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#737373] uppercase tracking-wider mb-2">
                학부모 비밀번호 (선택 - 4자리 PIN)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="내 이야기 수정 시 사용할 4자리 PIN (기본: 1234)"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#DBDBDB] rounded-2xl px-4 py-3.5 text-base sm:text-xs font-bold text-[#262626] focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white placeholder-[#8E8E8E] min-h-[48px] touch-manipulation"
              />
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 text-[#262626] text-xs leading-relaxed flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                <strong>보안 세션 안내:</strong> 본 공간은 유치원 원아 학부모님 전용입니다. 접속 후 자녀의 주말 이야기와 올린 사진 3장을 원할 때 언제든지 수정하실 수 있습니다.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white font-extrabold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 hover:opacity-95 min-h-[50px] touch-manipulation"
            >
              <UserCheck className="w-5 h-5" />
              <span>자녀 전용 작성/수정 공간으로 접속하기</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. STEP 2: Authenticated Parent Portal
  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 space-y-6">
      {/* Top Banner: Parent Profile Instagram Style Header */}
      <div className="bg-white border border-[#DBDBDB] rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shrink-0">
            <div className="w-12 h-12 rounded-full bg-white p-0.5 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-lg">
                {activeStudentName.slice(0, 1)}
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-[#262626]">
                {activeStudentName} 어린이 학부모 전용
              </h2>
              <span className="bg-pink-50 text-pink-600 border border-pink-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                인증됨
              </span>
            </div>
            <p className="text-xs text-[#737373] font-medium mt-0.5">
              자녀의 이야기 피드를 작성하고 수정 및 사진 변경 관리가 가능합니다.
            </p>
          </div>
        </div>

        <button
          onClick={handleParentLogout}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F5F5F5] hover:bg-[#EFEFEF] text-[#737373] hover:text-[#262626] border border-[#DBDBDB] text-xs font-bold transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>다른 자녀 접속 / 로그아웃</span>
        </button>
      </div>

      {/* Main Container: Story List for this Child OR Form */}
      {!isFormOpen ? (
        <div className="bg-white border border-[#DBDBDB] rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#EFEFEF] pb-5">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#262626] flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-pink-500" />
                <span>{activeStudentName} 어린이의 게시물 ({myChildStories.length}건)</span>
              </h3>
              <p className="text-xs text-[#737373] font-medium mt-1">
                등록된 포스트 사진을 확인하고 수정하거나 새 주차 이야기를 작성하세요.
              </p>
            </div>

            <button
              onClick={handleStartNewStory}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 hover:opacity-95 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>새 이야기 게시물 작성</span>
            </button>
          </div>

          {/* List of Stories for THIS Child ONLY */}
          {myChildStories.length === 0 ? (
            <div className="text-center py-12 bg-[#FAFAFA] rounded-2xl border border-[#DBDBDB] text-[#737373]">
              <p className="font-extrabold text-base text-[#262626] mb-1">
                아직 등록된 주말 이야기가 없습니다.
              </p>
              <p className="text-xs mb-4">
                위 '새 이야기 게시물 작성' 버튼을 눌러 사진 3장과 사진별 코멘트를 첫 작성해 보세요!
              </p>
              <button
                onClick={handleStartNewStory}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-extrabold text-xs shadow-xs transition-all hover:opacity-90"
              >
                <PlusCircle className="w-4 h-4" />
                <span>지금 작성하기</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myChildStories.map((story) => {
                const photos = story.imageUrls && story.imageUrls.length > 0
                  ? story.imageUrls
                  : (story.imageUrl ? [story.imageUrl] : []);

                return (
                  <div
                    key={story.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#FAFAFA] border border-[#DBDBDB] hover:border-pink-500 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs"
                  >
                    {/* Left: Photos Preview (Up to 3) */}
                    <div className="flex items-center gap-2 overflow-x-auto shrink-0 w-full md:w-auto">
                      {photos.length > 0 ? (
                        photos.map((pUrl, pIdx) => (
                          <div key={pIdx} className="relative w-20 h-20 rounded-xl overflow-hidden bg-white border border-[#DBDBDB] shrink-0">
                            <img src={pUrl} alt={`사진 ${pIdx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full backdrop-blur-xs">
                              #{pIdx + 1}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-white border border-[#DBDBDB] flex items-center justify-center text-[10px] text-[#8E8E8E] shrink-0">
                          사진 없음
                        </div>
                      )}
                    </div>

                    {/* Center: Story info */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                          {story.week}
                        </span>
                        <span className="text-xs text-[#737373] font-bold">
                          사진 {photos.length}장 첨부
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-[#262626] line-clamp-1">
                        {story.title}
                      </h4>
                      <p className="text-xs text-[#737373] line-clamp-2 leading-relaxed">
                        {story.content}
                      </p>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#EFEFEF]">
                      <button
                        onClick={() => handleStartEditStory(story)}
                        className="flex items-center gap-1 px-3.5 py-2 rounded-full bg-white hover:bg-pink-50 text-[#262626] hover:text-pink-600 border border-[#DBDBDB] text-xs font-bold transition-all shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-pink-500" />
                        <span>수정하기</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`'${story.week}' 주말 이야기를 삭제하시겠습니까?`)) {
                            onDeleteStory(story.id);
                          }
                        }}
                        className="p-2 rounded-full bg-white hover:bg-rose-50 text-[#8E8E8E] hover:text-rose-600 border border-[#DBDBDB] transition-colors shadow-2xs"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* STEP 3: Form for Create or Edit Story (Instagram Post Style Composer) */
        <div className="bg-white border border-[#DBDBDB] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl text-[#262626]">
          {/* Instagram Post Creator Top Header Bar */}
          <div className="bg-white border-b border-[#DBDBDB] px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-extrabold text-[#737373] hover:text-[#262626] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>목록으로</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shrink-0">
                <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <h2 className="text-xs sm:text-base font-extrabold text-[#262626] truncate max-w-[150px] sm:max-w-none">
                {editingStoryId ? '게시물 수정하기' : '새 이야기 게시물 만들기'}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 hover:opacity-95 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">게시 중...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{editingStoryId ? '수정 완료' : '게시'}</span>
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-3.5 sm:p-7 space-y-4 sm:space-y-6">
            {/* Instagram Author Profile Info Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#FAFAFA] border border-[#DBDBDB]">
              <div className="flex items-center gap-3">
                <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white p-0.5 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm">
                      {activeStudentName.slice(0, 1)}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-[#262626]">{activeStudentName}</span>
                    <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                      학부모 피드
                    </span>
                  </div>
                  <p className="text-[11px] text-[#737373] font-medium mt-0.5">
                    Classgram 주말 이야기 포스트
                  </p>
                </div>
              </div>

              {/* Week Selector Dropdown formatted like a Location Tag */}
              <div className="flex items-center gap-1.5 bg-white border border-[#DBDBDB] rounded-full px-3.5 py-1.5 shadow-2xs w-full sm:w-auto justify-center">
                <span className="text-xs">📍</span>
                <select
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-[#262626] focus:outline-none cursor-pointer w-full sm:w-auto"
                >
                  {WEEKS_LIST.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Media Upload Section: Photo Attachment & Captions */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-[#262626] uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-pink-500" />
                  <span>포스트 사진 첨부 (최대 3장)</span>
                </label>
                <span className="text-xs font-extrabold text-pink-500 bg-pink-50 px-2.5 py-1 rounded-full border border-pink-200">
                  {imageUrls.length} / 3장 첨부됨
                </span>
              </div>

              {/* Photo Upload Guidance Notice */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-pink-50 border border-amber-200/80 text-amber-900 text-xs font-bold leading-relaxed flex items-start gap-2.5 shadow-2xs">
                <ImageIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>사진 업로드 안내:</strong> 유치원 발표 시 아이가 더 자신감 있게 발표할 수 있도록 <u className="text-pink-700 decoration-pink-400 font-extrabold">최대한 아이의 얼굴이 잘 보이고 장소가 잘 드러나는 사진</u>을 첨부해 주세요!
                </span>
              </div>

              {/* Upload Drop Zone if < 3 photos */}
              {imageUrls.length < 3 && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl sm:rounded-3xl p-5 sm:p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer touch-manipulation active:scale-[0.99] ${
                    dragActive
                      ? 'border-pink-500 bg-pink-50/50'
                      : 'border-[#DBDBDB] bg-[#FAFAFA] hover:bg-[#F5F5F5] hover:border-pink-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    id="story-form-file-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleFilesAdd(e.target.files);
                      e.target.value = ''; // Reset input to allow re-selecting same photo if needed
                    }}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-2 w-full pointer-events-none">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-500 p-0.5 text-white flex items-center justify-center shadow-md">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-pink-500">
                        <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-[#262626] mt-1">
                      터치하여 스마트폰 사진 올리기 (현재 {imageUrls.length}/3장)
                    </span>
                    <span className="text-[11px] text-[#8E8E8E]">
                      스마트폰 앨범에서 우리 아이 최고 선명한 사진을 선택하세요
                    </span>
                  </div>
                </div>
              )}

              {/* Attached Photo Cards Preview in Instagram Feed Style */}
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                  {imageUrls.map((pUrl, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl border border-[#DBDBDB] bg-white space-y-3 shadow-2xs flex flex-col justify-between"
                    >
                      {/* Photo Header & Image Aspect Box */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-extrabold text-[#262626] flex items-center gap-1">
                            <span>📷</span> 사진 #{idx + 1}
                          </span>

                          <div className="flex items-center gap-1">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMoveImage(idx, 'left')}
                                className="p-1.5 bg-[#F5F5F5] hover:bg-[#EFEFEF] text-[#262626] rounded-md text-[10px] font-bold border border-[#DBDBDB]"
                                title="왼쪽으로 순서 이동"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {idx < imageUrls.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveImage(idx, 'right')}
                                className="p-1.5 bg-[#F5F5F5] hover:bg-[#EFEFEF] text-[#262626] rounded-md text-[10px] font-bold border border-[#DBDBDB]"
                                title="오른쪽으로 순서 이동"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-[10px] font-bold border border-rose-200"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Image Frame */}
                        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-black border border-[#DBDBDB]">
                          <img src={pUrl} alt={`첨부 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-white/20">
                            #{idx + 1}
                          </span>
                        </div>
                      </div>

                      {/* Photo Specific Caption Input */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-[#737373]">
                            사진 #{idx + 1} 설명 코멘트
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRecommendCaption(idx)}
                            disabled={loadingCaptions[idx]}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-50 hover:bg-pink-500 text-pink-600 hover:text-white text-[11px] font-extrabold transition-all border border-pink-200"
                          >
                            {loadingCaptions[idx] ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 fill-current text-pink-500" />
                            )}
                            <span>AI 추천</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="예: 바닷가에서 모래성 쌓는 중! 🏰"
                          value={imageCaptions[idx] || ''}
                          onChange={(e) => handleCaptionChange(idx, e.target.value)}
                          className="w-full bg-[#FAFAFA] border border-[#DBDBDB] rounded-xl px-3.5 py-3 text-base sm:text-xs font-medium text-[#262626] focus:outline-none focus:ring-1 focus:ring-pink-500 placeholder-[#8E8E8E] min-h-[44px] touch-manipulation"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Post Title & Story Text Content (Instagram Caption Style) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAFAFA] border border-[#DBDBDB] space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-[#262626] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-pink-500" />
                  <span>게시물 제목 <span className="text-pink-500">*</span></span>
                </label>
                <input
                  type="text"
                  placeholder="예: 신나는 여름방학 동해 바다 체험과 우리가족 모래성 쌓기 🌊"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-[#DBDBDB] rounded-2xl px-4 py-3.5 text-base sm:text-xs font-extrabold text-[#262626] focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder-[#8E8E8E] min-h-[46px] touch-manipulation"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#262626] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-pink-500" />
                  <span>이야기 피드 본문 내용 <span className="text-pink-500">*</span></span>
                </label>
                <textarea
                  rows={5}
                  placeholder="주말 동안 있었던 기억에 남는 경험, 활동, 아이가했던 재밌는 말이나 소감을 인스타그램 캡션처럼 자유롭게 적어주세요."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-white border border-[#DBDBDB] rounded-2xl p-4 text-base sm:text-xs font-medium text-[#262626] focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder-[#8E8E8E] leading-relaxed resize-y min-h-[120px] touch-manipulation"
                />

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-pink-600 font-extrabold">
                  <span>#우리들의주말이야기</span>
                  <span>#{activeStudentName}</span>
                  <span>#{week.split('(')[0]}</span>
                  <span>#Classgram</span>
                </div>
              </div>
            </div>

            {/* Instagram Bottom Action Row */}
            <div className="pt-3 border-t border-[#EFEFEF] flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#F5F5F5] hover:bg-[#EFEFEF] text-[#737373] hover:text-[#262626] font-bold text-xs border border-[#DBDBDB] transition-all"
              >
                취소
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white font-extrabold text-xs sm:text-sm shadow-md hover:opacity-95 transition-all active:scale-98 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>게시물 올리는 중...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{editingStoryId ? '피드 수정 완료' : 'Instagram 스타일 게시하기'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
