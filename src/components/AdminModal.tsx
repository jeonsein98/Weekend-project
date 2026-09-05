import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  UserPlus,
  Users,
  Trash2,
  Edit2,
  X,
  Check,
  Search,
  BookOpen,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  Camera,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Send,
  Calendar
} from 'lucide-react';
import { RosterStudent, StoryItem, WEEKS_LIST, isWeekMatch, getCurrentWeekString } from '../types';
import { savePhotoToIndexedDB } from '../lib/idb';
import { optimizeAndStandardizePhoto } from '../lib/imageOptimizer';
import {
  syncLocalStoriesToServer,
  saveStoryToServer
} from '../lib/storage';

async function compressImageFile(file: File): Promise<string> {
  try {
    const result = await optimizeAndStandardizePhoto(file, { maxDimension: 1400, quality: 0.84 });
    return result.dataUrl;
  } catch (err) {
    console.error('[AdminModal] compressImageFile error:', err);
    return '';
  }
}

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterStudent[];
  allStories: StoryItem[];
  onSaveRoster: (roster: RosterStudent[]) => void;
  onStoriesUpdated?: (stories: StoryItem[]) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ADMIN_PASSWORD_CORRECT = '0459';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  roster = [],
  allStories = [],
  onSaveRoster,
  onStoriesUpdated,
  onShowToast
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('전체');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'submitted' | 'unsubmitted'>('all');

  // Weekly Audit Selector (Defaults to today's active week)
  const [selectedAuditWeek, setSelectedAuditWeek] = useState<string>(() => {
    const curr = getCurrentWeekString();
    return WEEKS_LIST.includes(curr) ? curr : WEEKS_LIST[WEEKS_LIST.length - 1];
  });

  // Teacher Proxy Upload State (학부모 대리 사진/이야기 등록)
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [proxyStudentName, setProxyStudentName] = useState('');
  const [proxyWeek, setProxyWeek] = useState<string>(WEEKS_LIST[0]);
  const [proxyImages, setProxyImages] = useState<string[]>([]);
  const [proxyCaptions, setProxyCaptions] = useState<string[]>([]);
  const [proxyAiComment, setProxyAiComment] = useState('');
  const [isProxyUploading, setIsProxyUploading] = useState(false);
  const [isProxySubmitting, setIsProxySubmitting] = useState(false);
  const proxyFileInputRef = useRef<HTMLInputElement>(null);
  const proxyPreviewMapRef = useRef<Map<string, string>>(new Map());

  // New Student Form State
  const [newName, setNewName] = useState('');
  const [newClassName, setNewClassName] = useState('은솔1반');
  const [newPin, setNewPin] = useState('1234');
  const [newNote, setNewNote] = useState('');

  // Bulk Add Modal
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editClassName, setEditClassName] = useState('');
  const [editPin, setEditPin] = useState('');

  // Deletion confirmation states
  const [studentToDelete, setStudentToDelete] = useState<RosterStudent | null>(null);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPasswordInput('');
      setPasswordError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === ADMIN_PASSWORD_CORRECT) {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  // Add single student
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      onShowToast('원아 이름을 입력해주세요.', 'error');
      return;
    }

    const trimmedClass = newClassName.trim() || '햇살반';
    const exists = roster.some(
      (s) =>
        s.name.trim().toLowerCase() === newName.trim().toLowerCase() &&
        (s.className || '햇살반') === trimmedClass
    );

    if (exists) {
      onShowToast(`'${trimmedClass}'에 '${newName}' 원아가 이미 등록되어 있습니다.`, 'error');
      return;
    }

    const newStudent: RosterStudent = {
      id: `roster-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newName.trim(),
      className: trimmedClass,
      parentPin: newPin.trim() || '1234',
      note: newNote.trim()
    };

    onSaveRoster([...roster, newStudent]);
    setNewName('');
    setNewPin('1234');
    setNewNote('');
    onShowToast(`'${newStudent.name}' 원아가 등록되었습니다.`, 'success');
  };

  // Bulk add students
  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;

    const names = bulkInput
      .split(/[\n,]/)
      .map((n) => n.replace(/^\d+[\.\)\s\-]+/, '').trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      onShowToast('추가할 원아 이름을 입력해주세요.', 'error');
      return;
    }

    const targetClass = newClassName.trim() || '햇살반';
    const existingNames = new Set(
      roster
        .filter((s) => (s.className || '햇살반') === targetClass)
        .map((s) => s.name.trim().toLowerCase())
    );

    const newStudents: RosterStudent[] = [];
    let duplicates = 0;

    names.forEach((name, idx) => {
      if (existingNames.has(name.toLowerCase())) {
        duplicates++;
      } else {
        existingNames.add(name.toLowerCase());
        newStudents.push({
          id: `roster-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          name,
          className: targetClass,
          parentPin: '1234',
          note: '일괄 등록'
        });
      }
    });

    if (newStudents.length > 0) {
      onSaveRoster([...roster, ...newStudents]);
      setBulkInput('');
      setShowBulkAdd(false);
      onShowToast(
        `${newStudents.length}명의 원아가 ${targetClass}에 등록되었습니다.${
          duplicates > 0 ? ` (중복 ${duplicates}명 제외)` : ''
        }`,
        'success'
      );
    } else {
      onShowToast('입력하신 원아가 모두 이미 등록되어 있습니다.', 'info');
    }
  };

  // Start editing student
  const handleStartEdit = (student: RosterStudent) => {
    setEditingId(student.id);
    setEditName(student.name);
    setEditClassName(student.className || '햇살반');
    setEditPin(student.parentPin || '1234');
  };

  // Save student edit
  const handleSaveEdit = (studentId: string) => {
    if (!editName.trim()) {
      onShowToast('원아 이름을 입력해주세요.', 'error');
      return;
    }

    const updated = roster.map((s) => {
      if (s.id === studentId) {
        return {
          ...s,
          name: editName.trim(),
          className: editClassName.trim() || '햇살반',
          parentPin: editPin.trim() || '1234'
        };
      }
      return s;
    });

    onSaveRoster(updated);
    setEditingId(null);
    onShowToast('원아 정보가 수정되었습니다.', 'success');
  };

  // Delete student request
  const handleDeleteStudent = (student: RosterStudent) => {
    setStudentToDelete(student);
  };

  // Confirm delete single student
  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    const updated = roster.filter((s) => s.id !== studentToDelete.id);
    onSaveRoster(updated);
    onShowToast(`'${studentToDelete.name}' 원아가 삭제되었습니다.`, 'info');
    setStudentToDelete(null);
  };

  // Confirm delete class
  const handleConfirmDeleteClass = () => {
    if (!classToDelete) return;
    const updated = roster.filter((s) => (s.className || '햇살반') !== classToDelete);
    onSaveRoster(updated);
    onShowToast(`'${classToDelete}' 학급이 삭제되었습니다.`, 'info');
    if (selectedClass === classToDelete) {
      setSelectedClass('전체');
    }
    setClassToDelete(null);
  };

  // Sync server stories
  const handleSyncLocalToServer = async () => {
    setIsSyncing(true);
    try {
      const res = await syncLocalStoriesToServer();
      onShowToast(`서버 동기화 완료: ${res.count}건 동기화됨 (총 ${res.total}건 보관 중)`, 'success');
      const refreshRes = await fetch('/api/stories');
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.stories && onStoriesUpdated) {
          onStoriesUpdated(data.stories);
        }
      }
    } catch (err) {
      onShowToast('동기화 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Download full JSON backup
  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error('Backup failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekend_stories_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('전체 데이터 백업 파일이 다운로드되었습니다.', 'success');
    } catch (err) {
      onShowToast('백업 다운로드에 실패했습니다.', 'error');
    }
  };

  // Restore from JSON backup file
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || (!parsed.stories && !Array.isArray(parsed))) {
          onShowToast('올바른 백업 JSON 파일 형식이 아닙니다.', 'error');
          return;
        }

        const storiesToRestore = parsed.stories || (Array.isArray(parsed) ? parsed : []);
        const rosterToRestore = parsed.roster || [];

        const restoreRes = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stories: storiesToRestore, roster: rosterToRestore })
        });

        if (restoreRes.ok) {
          const resData = await restoreRes.json();
          if (resData.stories && onStoriesUpdated) {
            onStoriesUpdated(resData.stories);
          }
          if (resData.roster) {
            onSaveRoster(resData.roster);
          }
          onShowToast('백업 데이터가 성공적으로 복원되었습니다!', 'success');
        }
      } catch (err) {
        onShowToast('백업 복원 중 오류가 발생했습니다.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Open Proxy Upload Dialog for a student
  const handleOpenProxyUpload = (studentName?: string, defaultWeek?: string) => {
    const targetName = studentName || (roster[0]?.name || '');
    setProxyStudentName(targetName);
    const chosenWeek = defaultWeek && WEEKS_LIST.includes(defaultWeek)
      ? defaultWeek
      : (selectedAuditWeek !== '전체' ? selectedAuditWeek : (WEEKS_LIST[WEEKS_LIST.length - 1] || WEEKS_LIST[0]));
    setProxyWeek(chosenWeek);
    setProxyImages([]);
    setProxyCaptions([]);
    setProxyAiComment('');
    setShowProxyModal(true);
  };

  // Handle Proxy files add
  const handleProxyFilesAdd = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    const currentCount = proxyImages.length;
    const remainingSlots = 3 - currentCount;
    if (remainingSlots <= 0) {
      onShowToast('사진은 최대 3장까지만 첨부 가능합니다.', 'error');
      return;
    }

    const toProcess = fileArr.slice(0, remainingSlots);
    if (fileArr.length > remainingSlots) {
      onShowToast(`최대 3장까지만 등록 가능하여 ${remainingSlots}장만 추가됩니다.`, 'info');
    }

    setIsProxyUploading(true);
    try {
      const newUrls: string[] = [];
      const newCaptions: string[] = [];

      for (let i = 0; i < toProcess.length; i++) {
        const file = toProcess[i];
        const previewUrl = URL.createObjectURL(file);
        const dataUrl = await compressImageFile(file);

        if (!dataUrl) {
          onShowToast(`${file.name} 사진 최적화 중 오류가 발생했습니다.`, 'error');
          continue;
        }

        try {
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: dataUrl,
              filename: file.name
            })
          });

          if (uploadRes.ok) {
            const upJson = await uploadRes.json();
            if (upJson.url) {
              proxyPreviewMapRef.current.set(upJson.url, dataUrl);
              await savePhotoToIndexedDB(upJson.url, dataUrl);
              newUrls.push(upJson.url);
              newCaptions.push('');
              continue;
            }
          }
        } catch (serverErr) {
          console.warn('Proxy upload server error, using dataUrl fallback:', serverErr);
        }

        newUrls.push(dataUrl);
        newCaptions.push('');
      }

      setProxyImages((prev) => [...prev, ...newUrls]);
      setProxyCaptions((prev) => [...prev, ...newCaptions]);
      onShowToast(`사진 ${newUrls.length}장이 등록되었습니다.`, 'success');
    } catch (err) {
      console.error('Error adding proxy files:', err);
      onShowToast('사진 변환 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProxyUploading(false);
    }
  };

  const handleRemoveProxyImage = (index: number) => {
    setProxyImages((prev) => prev.filter((_, i) => i !== index));
    setProxyCaptions((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Proxy Story
  const handleProxySubmit = async () => {
    if (!proxyStudentName.trim()) {
      onShowToast('원아 이름을 선택하거나 입력해 주세요.', 'error');
      return;
    }
    if (proxyImages.length === 0) {
      onShowToast('최소 1장 이상의 사진을 등록해 주세요.', 'error');
      return;
    }

    setIsProxySubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      const newStory: StoryItem = {
        id: `story-proxy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        studentName: proxyStudentName.trim(),
        week: proxyWeek,
        title: `${proxyStudentName.trim()} 어린이의 주말 이야기`,
        content: proxyAiComment.trim() || '선생님이 대리 등록한 주말 이야기 사진입니다.',
        imageUrl: proxyImages[0] || '',
        imageUrls: [...proxyImages],
        imageCaptions: [...proxyCaptions],
        aiComment: proxyAiComment.trim() || undefined,
        createdAt: nowStr
      };

      await saveStoryToServer(newStory);

      const refreshRes = await fetch('/api/stories');
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.stories && onStoriesUpdated) {
          onStoriesUpdated(data.stories);
        }
      }

      onShowToast(
        `'${newStory.studentName}' 어린이의 ${newStory.week} 주말 이야기가 등록되었습니다!`,
        'success'
      );
      setShowProxyModal(false);
      setProxyImages([]);
      setProxyCaptions([]);
      setProxyAiComment('');
    } catch (e) {
      console.error('Failed to proxy upload story:', e);
      onShowToast('이야기 등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProxySubmitting(false);
    }
  };

  // Group all roster students by class to compute in-class alphabetical numbering (1번, 2번, 3번...)
  const classNumberMap = new Map<string, number>();
  const studentsByClass: Record<string, RosterStudent[]> = {};

  (roster || []).forEach((s) => {
    const cName = s.className?.trim() || '햇살반';
    if (!studentsByClass[cName]) studentsByClass[cName] = [];
    studentsByClass[cName].push(s);
  });

  Object.keys(studentsByClass).forEach((cName) => {
    studentsByClass[cName].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'ko'));
    studentsByClass[cName].forEach((s, idx) => {
      classNumberMap.set(s.id, idx + 1);
    });
  });

  // Unique class names
  const classList = Array.from(new Set((roster || []).map((s) => s.className || '햇살반')));

  // Target roster based on selectedClass
  const targetRosterForAudit = (roster || []).filter(
    (s) => selectedClass === '전체' || (s.className || '햇살반') === selectedClass
  );

  // Stories in the selected audit week
  const storiesInSelectedWeek = (allStories || []).filter((st) => {
    if (selectedAuditWeek === '전체') return true;
    return isWeekMatch(st.week, selectedAuditWeek);
  });

  // Submitted vs Unsubmitted students for the selected audit week
  const submittedStudentsThisWeek = targetRosterForAudit.filter((student) => {
    return storiesInSelectedWeek.some(
      (st) => st?.studentName && st.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()
    );
  });

  const unsubmittedStudentsThisWeek = targetRosterForAudit.filter((student) => {
    return !storiesInSelectedWeek.some(
      (st) => st?.studentName && st.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()
    );
  });

  const submittedThisWeekCount = submittedStudentsThisWeek.length;
  const unsubmittedThisWeekCount = unsubmittedStudentsThisWeek.length;
  const targetTotalCount = targetRosterForAudit.length;
  const submissionRate = targetTotalCount > 0
    ? Math.round((submittedThisWeekCount / targetTotalCount) * 100)
    : 0;

  // Global total submissions
  const submittedStudentNamesGlobal = Array.from(
    new Set((allStories || []).map((s) => s.studentName.trim().toLowerCase()))
  );
  const submittedCountTotalGlobal = (roster || []).filter((r) =>
    submittedStudentNamesGlobal.includes(r.name.trim().toLowerCase())
  ).length;

  // Filtered Roster for Table
  const filteredRoster = (roster || []).filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.note && student.note.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesClass = selectedClass === '전체' || (student.className || '햇살반') === selectedClass;

    const hasSubmittedThisWeek = storiesInSelectedWeek.some(
      (st) => st?.studentName && st.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()
    );

    let matchesSubmission = true;
    if (submissionFilter === 'submitted') matchesSubmission = hasSubmittedThisWeek;
    if (submissionFilter === 'unsubmitted') matchesSubmission = !hasSubmittedThisWeek;

    return matchesSearch && matchesClass && matchesSubmission;
  });

  // Sort filtered roster by Class Name first, then Korean Name order
  const sortedFilteredRoster = [...filteredRoster].sort((a, b) => {
    const classA = a.className?.trim() || '햇살반';
    const classB = b.className?.trim() || '햇살반';
    if (classA !== classB) {
      return classA.localeCompare(classB, 'ko');
    }
    return a.name.trim().localeCompare(b.name.trim(), 'ko');
  });

  // Quick copy unsubmitted list for teachers
  const handleCopyUnsubmittedList = () => {
    if (unsubmittedStudentsThisWeek.length === 0) {
      onShowToast('모든 원아가 주말 이야기를 제출했습니다!', 'info');
      return;
    }
    const names = unsubmittedStudentsThisWeek.map((s) => s.name).join(', ');
    const weekLabel = selectedAuditWeek === '전체' ? '전체 기간' : selectedAuditWeek;
    const text = `[${weekLabel} 주말 이야기 미제출 원아 (${unsubmittedStudentsThisWeek.length}명)]\n${names}`;
    navigator.clipboard.writeText(text);
    onShowToast(`미제출 원아 ${unsubmittedStudentsThisWeek.length}명 명단이 클립보드에 복사되었습니다.`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E8E4D9] rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-[#2D2A26] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7C8E7E] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg">유치원 교사 관리자 모드</h3>
              <p className="text-xs text-[#A59F94]">학급 원아 명단 및 주차별 이야기 제출 현황 실시간 관리</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#A59F94] hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {!isAuthenticated ? (
          /* Password Authentication Gate */
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="w-16 h-16 bg-[#FAF9F6] border border-[#E8E4D9] rounded-full flex items-center justify-center mx-auto text-[#7C8E7E] shadow-xs">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-xl font-serif font-bold text-[#2D2A26]">관리자 비밀번호 입력</h4>
              <p className="text-xs text-[#8B8378] font-medium mt-1">
                관리자 모드는 담임 교사 전용 공간입니다. 비밀번호를 입력해 주세요.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="max-w-xs mx-auto space-y-4">
              <div>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="비밀번호 4자리"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className={`w-full text-center text-xl font-mono font-bold tracking-widest px-4 py-3.5 rounded-2xl border ${
                    passwordError
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-[#E8E4D9] bg-[#FAF9F6] text-[#2D2A26] focus:ring-2 focus:ring-[#7C8E7E]'
                  } focus:outline-none`}
                  autoFocus
                />
                {passwordError && (
                  <p className="text-xs text-rose-600 font-bold mt-2 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> 비밀번호가 올바르지 않습니다.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-[#2D2A26] hover:bg-[#7C8E7E] text-white font-bold text-sm shadow-md transition-all active:scale-95"
              >
                관리자 인증하기
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Admin Dashboard */
          <div className="p-6 sm:p-8 space-y-6 max-h-[82vh] overflow-y-auto">
            {/* Top Stat Summary Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-4 rounded-2xl flex items-center gap-3">
                <Users className="w-8 h-8 text-[#7C8E7E] shrink-0" />
                <div>
                  <p className="text-[11px] text-[#A59F94] font-bold">등록된 원아 수</p>
                  <p className="text-xl font-serif font-bold text-[#2D2A26]">{roster.length}명</p>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-4 rounded-2xl flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-[#7C8E7E] shrink-0" />
                <div>
                  <p className="text-[11px] text-[#A59F94] font-bold">전체 등록 이야기</p>
                  <p className="text-xl font-serif font-bold text-[#2D2A26]">{allStories.length}건</p>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#A59F94] font-bold">전체 제출 참여</p>
                  <p className="text-xs font-bold text-[#7C8E7E] flex items-center gap-1 mt-1">
                    <Check className="w-3.5 h-3.5" /> {submittedCountTotalGlobal}명 1회 이상 제출
                  </p>
                </div>
                <button
                  onClick={() => setIsAuthenticated(false)}
                  className="text-xs px-2.5 py-1 rounded-full bg-white border border-[#E8E4D9] text-[#8B8378] hover:text-[#2D2A26] transition-colors"
                >
                  잠금
                </button>
              </div>
            </div>

            {/* REAL-TIME WEEKLY SUBMISSION / UNSUBMITTED TRACKER */}
            <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-5 rounded-2xl space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#7C8E7E] text-white flex items-center justify-center shadow-xs">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-[#2D2A26] text-base flex items-center gap-2">
                      <span>주차별 제출 / 미제출 현황</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                        실시간
                      </span>
                    </h4>
                    <p className="text-xs text-[#8B8378]">
                      주차별로 제출 완료 및 미제출 어린이를 실시간 파악하고 대리 등록을 진행할 수 있습니다.
                    </p>
                  </div>
                </div>

                {/* Week Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-[#5D574F] shrink-0">조회 주차:</label>
                  <select
                    value={selectedAuditWeek}
                    onChange={(e) => setSelectedAuditWeek(e.target.value)}
                    className="bg-white border border-[#C2D1C5] text-[#2D2A26] text-xs font-bold px-3 py-2 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#7C8E7E]"
                  >
                    <option value="전체">전체 주차 (누적)</option>
                    {WEEKS_LIST.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real-time Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-[#E8E4D9] space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8B8378]">
                    <span>조회 대상 원아 ({selectedClass})</span>
                    <Users className="w-3.5 h-3.5 text-[#7C8E7E]" />
                  </div>
                  <div className="text-xl font-black text-[#2D2A26]">
                    {targetTotalCount}명
                  </div>
                  <div className="text-[10px] text-[#A59F94]">
                    {selectedClass === '전체' ? '전체 학급 원아 기준' : `${selectedClass} 원아 기준`}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span>제출 완료</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-700">
                    {submittedThisWeekCount}명
                    <span className="text-xs font-bold text-emerald-600 ml-1.5">({submissionRate}%)</span>
                  </div>
                  <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, submissionRate)}%` }}
                    />
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border space-y-1 ${
                  unsubmittedThisWeekCount > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-[#E8E4D9]'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span>미제출 원아</span>
                    <AlertCircle className={`w-3.5 h-3.5 ${unsubmittedThisWeekCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                  </div>
                  <div className={`text-xl font-black ${unsubmittedThisWeekCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                    {unsubmittedThisWeekCount}명
                  </div>
                  <div className="text-[10px] text-amber-800">
                    {unsubmittedThisWeekCount > 0 ? '사진/이야기 등록 대기 중' : '전원 제출 완료! 🎉'}
                  </div>
                </div>
              </div>

              {/* Unsubmitted Students Detailed Badges & Quick Action */}
              <div className="bg-white p-4 rounded-xl border border-[#E8E4D9] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#2D2A26] flex items-center gap-1.5">
                      {unsubmittedThisWeekCount > 0 ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>미제출 원아 명단 ({unsubmittedThisWeekCount}명)</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-800">모든 원아 제출 완료</span>
                        </>
                      )}
                    </span>
                    <span className="text-[11px] text-[#8B8378]">
                      [{selectedAuditWeek === '전체' ? '전체 주차' : selectedAuditWeek}] 기준
                    </span>
                  </div>

                  {unsubmittedThisWeekCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyUnsubmittedList}
                      className="px-2.5 py-1 rounded-lg bg-[#FAF9F6] hover:bg-[#F5F2ED] border border-[#E8E4D9] text-[#5D574F] text-xs font-bold flex items-center gap-1 shadow-2xs self-start sm:self-auto transition-colors"
                    >
                      <Copy className="w-3 h-3 text-[#7C8E7E]" />
                      <span>미제출 명단 텍스트 복사</span>
                    </button>
                  )}
                </div>

                {unsubmittedThisWeekCount === 0 ? (
                  <div className="p-3 bg-emerald-50 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>해당 주차에 대상 원아가 모두 주말 이야기를 제출하였습니다!</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#8B8378]">
                      원아 버튼을 누르면 선생님이 학부모님께 받은 사진을 즉시 대리 등록할 수 있습니다:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unsubmittedStudentsThisWeek.map((student) => (
                        <button
                          key={`unsub-${student.id}`}
                          type="button"
                          onClick={() => handleOpenProxyUpload(student.name, selectedAuditWeek !== '전체' ? selectedAuditWeek : undefined)}
                          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold transition-all shadow-2xs active:scale-95"
                          title={`${student.name} 원아 사진/이야기 대리 등록`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>{student.name}</span>
                          <span className="text-[10px] text-amber-700 font-normal">({student.className || '햇살반'})</span>
                          <Camera className="w-3 h-3 text-amber-600 group-hover:scale-110 transition-transform ml-0.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Student Registration Form */}
            <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-5 rounded-2xl space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#7C8E7E]" />
                  <h4 className="font-serif font-bold text-[#2D2A26] text-sm">새 원아 등록</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkAdd(!showBulkAdd)}
                  className="text-xs text-[#7C8E7E] hover:underline font-bold"
                >
                  {showBulkAdd ? '개별 입력으로 전환' : '+ 여러 명 한 번에 일괄 등록'}
                </button>
              </div>

              {showBulkAdd ? (
                <form onSubmit={handleBulkAdd} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#5D574F]">등록할 학급:</span>
                    <input
                      type="text"
                      placeholder="학급명 (예: 은솔1반)"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-[#E8E4D9] rounded-xl text-xs font-bold text-[#2D2A26]"
                    />
                  </div>
                  <textarea
                    rows={4}
                    placeholder="원아 이름을 쉼표(,)나 줄바꿈으로 구분하여 입력하세요. (예: 김도희, 이서연, 박준우...)"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    className="w-full p-3 bg-white border border-[#E8E4D9] rounded-xl text-xs font-medium text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#7C8E7E]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkAdd(false)}
                      className="px-4 py-2 rounded-xl border border-[#E8E4D9] bg-white text-xs font-bold text-[#5D574F]"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#2D2A26] hover:bg-[#7C8E7E] text-white font-bold text-xs transition-colors"
                    >
                      일괄 등록 실행
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#8B8378] mb-1">학급명</label>
                    <input
                      type="text"
                      placeholder="예: 은솔1반"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E8E4D9] rounded-xl text-xs font-bold text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#7C8E7E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8B8378] mb-1">원아 이름 *</label>
                    <input
                      type="text"
                      placeholder="예: 김도희"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E8E4D9] rounded-xl text-xs font-bold text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#7C8E7E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8B8378] mb-1">학부모 PIN</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="기본: 1234"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E8E4D9] rounded-xl text-xs font-mono font-bold text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#7C8E7E]"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-[#2D2A26] hover:bg-[#7C8E7E] text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>원아 등록</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Roster Search & Filter */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#A59F94]" />
                  <input
                    type="text"
                    placeholder="원아 이름 검색 (예: 김도희)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#FAF9F6] border border-[#E8E4D9] rounded-xl text-xs font-bold text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#7C8E7E]"
                  />
                </div>

                {/* Submission Status Filter */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  <span className="text-[10px] font-extrabold text-[#8B8378] shrink-0">
                    [{selectedAuditWeek === '전체' ? '전체' : selectedAuditWeek}] 상태:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubmissionFilter('all')}
                    className={`text-xs px-2.5 py-1 rounded-full border font-bold transition-all ${
                      submissionFilter === 'all'
                        ? 'bg-[#2D2A26] text-white border-[#2D2A26]'
                        : 'bg-[#FAF9F6] text-[#5D574F] border-[#E8E4D9]'
                    }`}
                  >
                    전체 ({targetTotalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionFilter('submitted')}
                    className={`text-xs px-2.5 py-1 rounded-full border font-bold transition-all ${
                      submissionFilter === 'submitted'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    제출 완료 ({submittedThisWeekCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionFilter('unsubmitted')}
                    className={`text-xs px-2.5 py-1 rounded-full border font-bold transition-all ${
                      submissionFilter === 'unsubmitted'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    미제출 ({unsubmittedThisWeekCount})
                  </button>
                </div>
              </div>

              {/* Class selector pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full">
                <span className="text-[10px] font-extrabold text-[#8B8378] shrink-0">학급선택:</span>
                <button
                  type="button"
                  onClick={() => setSelectedClass('전체')}
                  className={`text-xs px-3 py-1 rounded-full border font-bold transition-all shrink-0 ${
                    selectedClass === '전체'
                      ? 'bg-[#7C8E7E] text-white border-[#7C8E7E]'
                      : 'bg-[#FAF9F6] text-[#5D574F] border-[#E8E4D9]'
                  }`}
                >
                  전체 반 ({roster.length})
                </button>
                {classList.map((cName) => {
                  const count = roster.filter((s) => (s.className || '햇살반') === cName).length;
                  const isSelected = selectedClass === cName;
                  return (
                    <div key={cName} className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedClass(cName)}
                        className={`text-xs px-3 py-1 rounded-full border font-bold transition-all ${
                          isSelected
                            ? 'bg-[#7C8E7E] text-white border-[#7C8E7E]'
                            : 'bg-[#FAF9F6] text-[#5D574F] border-[#E8E4D9]'
                        }`}
                      >
                        {cName} ({count})
                      </button>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => setClassToDelete(cName)}
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-full border border-rose-200 text-xs font-bold flex items-center gap-1 px-2 transition-all shadow-2xs"
                          title={`${cName} 학급 및 원아 전체 삭제`}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span className="text-[10px]">학급 삭제</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Roster Table */}
            <div className="border border-[#E8E4D9] rounded-2xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-[#E8E4D9] text-[11px] font-bold text-[#8B8378]">
                    <th className="py-3 px-3 text-center w-16">번호</th>
                    <th className="py-3 px-4">반</th>
                    <th className="py-3 px-4">원아 이름</th>
                    <th className="py-3 px-4">학부모 PIN</th>
                    <th className="py-3 px-4">
                      {selectedAuditWeek === '전체' ? '주말 이야기' : `선택 주차 (${selectedAuditWeek})`}
                    </th>
                    <th className="py-3 px-4">총 누적</th>
                    <th className="py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4D9] text-xs">
                  {sortedFilteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#A59F94] font-medium">
                        조건에 맞는 원아가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    sortedFilteredRoster.map((student) => {
                      const isEditing = editingId === student.id;
                      const totalStudentStories = (allStories || []).filter(
                        (st) => st?.studentName && st.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()
                      );
                      const totalSubmittedCount = totalStudentStories.length;

                      const weekStoriesForStudent = (allStories || []).filter((st) => {
                        const nameMatch = st?.studentName && st.studentName.trim().toLowerCase() === student.name.trim().toLowerCase();
                        if (!nameMatch) return false;
                        if (selectedAuditWeek === '전체') return true;
                        return isWeekMatch(st.week, selectedAuditWeek);
                      });
                      const hasSubmittedThisWeek = weekStoriesForStudent.length > 0;
                      const weekPhotosCount = weekStoriesForStudent.reduce(
                        (acc, s) => acc + (s.imageUrls && s.imageUrls.length > 0 ? s.imageUrls.length : (s.imageUrl ? 1 : 0)),
                        0
                      );

                      const classNum = classNumberMap.get(student.id) || 1;

                      if (isEditing) {
                        return (
                          <tr key={student.id} className="bg-[#FFFDF9]">
                            <td className="p-2 text-center font-bold text-xs text-[#7C8E7E]">
                              {classNum}번
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={editClassName}
                                onChange={(e) => setEditClassName(e.target.value)}
                                className="w-20 px-2 py-1 border border-[#E8E4D9] rounded-lg font-bold text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-28 px-2 py-1 border border-[#E8E4D9] rounded-lg font-bold text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                maxLength={4}
                                value={editPin}
                                onChange={(e) => setEditPin(e.target.value)}
                                className="w-16 px-2 py-1 border border-[#E8E4D9] rounded-lg font-bold text-xs font-mono"
                              />
                            </td>
                            <td colSpan={2} className="p-2 text-[#8B8378]">
                              수정 중...
                            </td>
                            <td className="p-2 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(student.id)}
                                className="px-3 py-1 bg-[#7C8E7E] text-white rounded-lg text-xs font-bold"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                              >
                                취소
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={student.id} className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[#E8F0E9] text-[#2D3A30] font-bold text-xs border border-[#C2D1C5]">
                              {classNum}번
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-[#7C8E7E]">
                            {student.className || '햇살반'}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#2D2A26]">
                            <span>{student.name}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#8B8378]">
                            {student.parentPin || '1234'}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {hasSubmittedThisWeek ? (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>완료 ({weekPhotosCount}장)</span>
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2.5 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>미제출</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#8B8378]">
                            {totalSubmittedCount}건
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenProxyUpload(student.name, selectedAuditWeek !== '전체' ? selectedAuditWeek : undefined)}
                              className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1 transition-all shadow-2xs"
                              title="선생님 대리 사진/이야기 등록"
                            >
                              <Camera className="w-3 h-3" />
                              <span>대리 등록</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(student)}
                              className="p-1.5 text-[#8B8378] hover:text-[#2D2A26] rounded-md hover:bg-gray-100"
                              title="정보 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(student)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Subtle Data Backup & Sync Tools */}
            <div className="pt-2 border-t border-[#E8E4D9] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8B8378]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[11px]">데이터 보존 및 백업:</span>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-2.5 py-1 rounded-lg bg-white border border-[#E8E4D9] hover:bg-gray-50 text-[#5D574F] font-bold inline-flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3 h-3" />
                  <span>백업 파일 다운로드 (.json)</span>
                </button>
                <label className="px-2.5 py-1 rounded-lg bg-white border border-[#E8E4D9] hover:bg-gray-50 text-[#5D574F] font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>백업 파일 복원</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSyncLocalToServer}
                disabled={isSyncing}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#E8E4D9] hover:bg-gray-50 text-[#5D574F] font-bold inline-flex items-center gap-1 shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>서버 동기화</span>
              </button>
            </div>
          </div>
        )}

        {/* Student Delete Confirmation Modal */}
        {studentToDelete && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E8E4D9] text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#2D2A26]">원아 명단 삭제</h3>
                <p className="text-xs text-[#8B8378] mt-1">
                  <span className="font-bold text-[#2D2A26]">{studentToDelete.name}</span> 어린이를 학급 명단에서 삭제하시겠습니까?
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E4D9] bg-[#FAF9F6] text-xs font-bold text-[#5D574F] hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteStudent}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  삭제하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Class Delete Confirmation Modal */}
        {classToDelete && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E8E4D9] text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#2D2A26]">학급 삭제</h3>
                <p className="text-xs text-[#8B8378] mt-1">
                  '<span className="font-bold text-[#2D2A26]">{classToDelete}</span>' 학급을 삭제하시겠습니까?
                </p>
                {(() => {
                  const count = roster.filter((s) => (s.className || '햇살반') === classToDelete).length;
                  return count > 0 ? (
                    <p className="text-xs text-rose-600 font-bold mt-2.5 bg-rose-50 p-2.5 rounded-xl border border-rose-100 leading-relaxed">
                      ⚠️ 해당 학급에 속한 원아 <span className="underline">{count}명</span>의 명단도 함께 삭제됩니다.
                    </p>
                  ) : (
                    <p className="text-xs text-[#8B8378] mt-1">등록된 원아가 없습니다.</p>
                  );
                })()}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClassToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E4D9] bg-[#FAF9F6] text-xs font-bold text-[#5D574F] hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteClass}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  학급 삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teacher Proxy Story Upload Modal (대리 사진 및 이야기 등록) */}
        {showProxyModal && (
          <div className="fixed inset-0 z-70 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-[#E8E4D9] space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-[#E8E4D9] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#7C8E7E] text-white flex items-center justify-center shadow-xs">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#2D2A26]">
                      선생님 대리 사진 및 이야기 등록
                    </h3>
                    <p className="text-xs text-[#8B8378]">
                      학부모님이 보내주신 사진을 서버에 즉시 영구 저장합니다.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProxyModal(false)}
                  className="p-1.5 text-[#8B8378] hover:text-[#2D2A26] rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#8B8378] mb-1">
                      원아 이름 *
                    </label>
                    <input
                      type="text"
                      value={proxyStudentName}
                      onChange={(e) => setProxyStudentName(e.target.value)}
                      placeholder="예: 김도희"
                      className="w-full bg-[#FAF9F6] border border-[#E8E4D9] rounded-xl px-3 py-2 text-sm font-bold text-[#2D2A26]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8B8378] mb-1">
                      해당 주차 *
                    </label>
                    <select
                      value={proxyWeek}
                      onChange={(e) => setProxyWeek(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#E8E4D9] rounded-xl px-3 py-2 text-xs font-bold text-[#2D2A26]"
                    >
                      {WEEKS_LIST.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Photo Upload Box */}
                <div>
                  <label className="block text-[11px] font-bold text-[#8B8378] mb-1">
                    사진 첨부 (최대 3장) *
                  </label>

                  {proxyImages.length < 3 && (
                    <div
                      onClick={() => proxyFileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#C2D1C5] hover:border-[#7C8E7E] rounded-2xl p-4 text-center cursor-pointer bg-[#FAF9F6] transition-colors"
                    >
                      <input
                        ref={proxyFileInputRef}
                        type="file"
                        accept="image/*,.heic,.heif,.HEIC,.HEIF"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) handleProxyFilesAdd(e.target.files);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center gap-1 text-[#7C8E7E]">
                        {isProxyUploading ? (
                          <Loader2 className="w-6 h-6 animate-spin text-[#7C8E7E]" />
                        ) : (
                          <Upload className="w-6 h-6 text-[#7C8E7E]" />
                        )}
                        <span className="font-bold text-xs">
                          {isProxyUploading ? '사진 최적화 및 서버 전송 중...' : '클릭하여 사진 추가 (아이폰 HEIC / 갤럭시 / PC)'}
                        </span>
                        <span className="text-[10px] text-[#8B8378]">
                          카카오톡, 문자, 앨범 사진 자동 표준화 지원 (현재 {proxyImages.length}/3장)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Uploaded Photos Preview */}
                  {proxyImages.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                      {proxyImages.map((pUrl, pIdx) => (
                        <div key={`proxy-img-${pIdx}-${pUrl.slice(0, 32)}`} className="p-2 border border-[#E8E4D9] rounded-xl bg-white space-y-1.5">
                          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-black/90 flex items-center justify-center">
                            <img
                              src={pUrl}
                              alt=""
                              aria-hidden="true"
                              onError={(e) => {
                                const fallback = proxyPreviewMapRef.current.get(pUrl);
                                if (fallback && e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                }
                              }}
                              className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
                            />
                            <img
                              src={pUrl}
                              alt={`사진 ${pIdx + 1}`}
                              onError={(e) => {
                                const fallback = proxyPreviewMapRef.current.get(pUrl);
                                if (fallback && e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                }
                              }}
                              className="relative z-10 max-h-full max-w-full object-contain pointer-events-none"
                            />
                            <span className="absolute top-1 left-1 z-20 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              #{pIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveProxyImage(pIdx)}
                              className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-xs"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="사진 설명 (선택)"
                            value={proxyCaptions[pIdx] || ''}
                            onChange={(e) => {
                              const copy = [...proxyCaptions];
                              copy[pIdx] = e.target.value;
                              setProxyCaptions(copy);
                            }}
                            className="w-full text-[11px] p-1.5 border border-[#E8E4D9] rounded-md font-medium"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI / Teacher Comment */}
                <div>
                  <label className="block text-[11px] font-bold text-[#8B8378] mb-1">
                    교사 소감 및 칭찬 문구 (선택)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="예: 바닷가에서 가족과 함께 신나는 모래놀이를 하며 즐거운 주말을 보냈네요!"
                    value={proxyAiComment}
                    onChange={(e) => setProxyAiComment(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#E8E4D9] rounded-xl p-2.5 text-xs font-medium text-[#2D2A26]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#E8E4D9]">
                <button
                  type="button"
                  onClick={() => setShowProxyModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E4D9] bg-[#FAF9F6] text-xs font-bold text-[#5D574F] hover:bg-gray-100"
                >
                  닫기
                </button>
                <button
                  type="button"
                  disabled={isProxySubmitting || proxyImages.length === 0}
                  onClick={handleProxySubmit}
                  className="flex-1 py-2.5 rounded-xl bg-[#2D2A26] hover:bg-[#7C8E7E] text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  {isProxySubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>서버 디스크 저장 중...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>서버 디스크에 즉시 영구 등록</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
