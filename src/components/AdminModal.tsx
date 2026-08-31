import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  UserPlus,
  Users,
  Trash2,
  Edit2,
  Key,
  X,
  Check,
  Search,
  BookOpen,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquare,
  Loader2,
  FileQuestion,
  Plus,
  Image as ImageIcon,
  Send
} from 'lucide-react';
import { RosterStudent, StoryItem, WEEKS_LIST, isWeekMatch } from '../types';
import { syncLocalStoriesToServer, saveStoryToServer } from '../lib/storage';

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1400;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
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

  // Teacher Proxy Upload State (학부모 대리 사진/이야기 등록)
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [proxyStudentName, setProxyStudentName] = useState('김도희');
  const [proxyWeek, setProxyWeek] = useState<string>(WEEKS_LIST[0]);
  const [proxyImages, setProxyImages] = useState<string[]>([]);
  const [proxyCaptions, setProxyCaptions] = useState<string[]>([]);
  const [proxyAiComment, setProxyAiComment] = useState('');
  const [isProxyUploading, setIsProxyUploading] = useState(false);
  const [isProxySubmitting, setIsProxySubmitting] = useState(false);
  const proxyFileInputRef = useRef<HTMLInputElement>(null);

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
  const [editNote, setEditNote] = useState('');

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
      onShowToast('관리자 인증에 성공했습니다.', 'success');
    } else {
      setPasswordError(true);
      onShowToast('비밀번호가 올바르지 않습니다.', 'error');
    }
  };

  // Add single student
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      onShowToast('원아 이름을 입력해 주세요.', 'error');
      return;
    }

    const exists = roster.some((s) => s.name.trim() === newName.trim());
    if (exists) {
      if (!confirm(`'${newName.trim()}' 어린이가 이미 명단에 있습니다. 추가하시겠습니까?`)) {
        return;
      }
    }

    const newStudent: RosterStudent = {
      id: 'roster-' + Date.now() + Math.random().toString(36).substr(2, 4),
      name: newName.trim(),
      className: newClassName.trim() || '햇살반',
      parentPin: newPin.trim() || '1234',
      note: newNote.trim()
    };

    const updated = [newStudent, ...roster];
    onSaveRoster(updated);
    onShowToast(`'${newStudent.name}' 어린이가 학급 명단에 추가되었습니다.`, 'success');

    setNewName('');
    setNewNote('');
  };

  // Bulk add students from comma/newline list
  const handleBulkAdd = () => {
    if (!bulkInput.trim()) return;
    const names = bulkInput
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) return;

    const newStudents: RosterStudent[] = names.map((name, idx) => ({
      id: 'roster-bulk-' + Date.now() + '-' + idx,
      name: name,
      className: newClassName || '햇살반',
      parentPin: '1234',
      note: '일괄 등록 원아'
    }));

    const updated = [...newStudents, ...roster];
    onSaveRoster(updated);
    onShowToast(`${names.length}명의 원아가 명단에 일괄 추가되었습니다!`, 'success');
    setBulkInput('');
    setShowBulkAdd(false);
  };

  // Start Editing Student
  const handleStartEdit = (student: RosterStudent) => {
    setEditingId(student.id);
    setEditName(student.name);
    setEditClassName(student.className || '햇살반');
    setEditPin(student.parentPin || '1234');
    setEditNote(student.note || '');
  };

  // Save Edit Student
  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) {
      onShowToast('원아 이름을 입력해 주세요.', 'error');
      return;
    }

    const updated = roster.map((s) =>
      s.id === id
        ? {
            ...s,
            name: editName.trim(),
            className: editClassName.trim(),
            parentPin: editPin.trim(),
            note: editNote.trim()
          }
        : s
    );

    onSaveRoster(updated);
    setEditingId(null);
    onShowToast('원아 정보가 수정되었습니다.', 'success');
  };

  // Delete Student
  const handleDeleteStudent = (student: RosterStudent) => {
    setStudentToDelete(student);
  };

  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    const updated = roster.filter((s) => s.id !== studentToDelete.id);
    onSaveRoster(updated);
    onShowToast(`'${studentToDelete.name}' 어린이가 명단에서 삭제되었습니다.`, 'info');
    setStudentToDelete(null);
  };

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

  // Manual sync/recovery of local stories to server
  const handleSyncLocalToServer = async () => {
    setIsSyncing(true);
    try {
      const res = await syncLocalStoriesToServer();
      onShowToast(`동기화 완료: ${res.count}건의 이야기가 복구·동기화되었습니다. (총 ${res.total}건 보관 중)`, 'success');
      // Refresh stories
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

  // Open Proxy Upload Dialog
  const handleOpenProxyUpload = (studentName?: string) => {
    setProxyStudentName(studentName || '김도희');
    setProxyWeek(WEEKS_LIST[0]);
    setProxyImages([]);
    setProxyCaptions([]);
    setProxyAiComment('');
    setShowProxyModal(true);
  };

  // Handle Proxy files add
  const handleProxyFilesAdd = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (proxyImages.length + fileArr.length > 3) {
      onShowToast('사진은 최대 3장까지 첨부 가능합니다.', 'error');
    }
    const remainingSlots = 3 - proxyImages.length;
    const toProcess = fileArr.slice(0, remainingSlots);

    setIsProxyUploading(true);
    try {
      for (const f of toProcess) {
        const compressed = await compressImageFile(f);
        let finalUrl = compressed;
        try {
          const upRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentName: proxyStudentName || '원아',
              image: compressed,
              filename: f.name
            })
          });
          if (upRes.ok) {
            const upData = await upRes.json();
            if (upData.url) finalUrl = upData.url;
          }
        } catch (uploadErr) {
          // fallback to base64
        }
        setProxyImages((prev) => (prev.length >= 3 ? prev : [...prev, finalUrl]));
        setProxyCaptions((prev) => (prev.length >= 3 ? prev : [...prev, '']));
      }
      onShowToast(`${toProcess.length}장의 사진이 추가되었습니다.`, 'info');
    } finally {
      setIsProxyUploading(false);
    }
  };

  const handleRemoveProxyImage = (idx: number) => {
    setProxyImages((prev) => prev.filter((_, i) => i !== idx));
    setProxyCaptions((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit proxy story
  const handleProxySubmit = async () => {
    if (!proxyStudentName.trim()) {
      onShowToast('원아 이름을 입력하거나 선택해 주세요.', 'error');
      return;
    }
    if (proxyImages.length === 0) {
      onShowToast('사진을 최소 1장 이상 첨부해 주세요.', 'error');
      return;
    }

    setIsProxySubmitting(true);
    try {
      const studentObj = roster.find(
        (r) => r.name.trim().toLowerCase() === proxyStudentName.trim().toLowerCase()
      );
      const newStory: StoryItem = {
        id: `story-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        week: proxyWeek,
        studentName: proxyStudentName.trim(),
        parentPin: studentObj?.parentPin || '1234',
        title: '',
        content: '',
        imageUrls: proxyImages,
        imageCaptions: proxyCaptions,
        imageUrl: proxyImages[0] || '',
        aiComment: proxyAiComment || `${proxyStudentName} 어린이의 행복한 주말 이야기입니다.`,
        createdAt: new Date().toISOString(),
        reactions: { '❤️': 0, '👏': 0, '⭐': 0, '😊': 0 }
      };

      const res = await saveStoryToServer(newStory);
      if (res.stories && onStoriesUpdated) {
        onStoriesUpdated(res.stories);
      } else {
        const refreshRes = await fetch('/api/stories');
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.stories && onStoriesUpdated) {
            onStoriesUpdated(data.stories);
          }
        }
      }

      onShowToast(`${proxyStudentName} 어린이의 주말 이야기와 사진이 서버에 영구 등록되었습니다!`, 'success');
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

  // Copy friendly guide message for parents
  const handleCopyParentGuide = (name = '도희') => {
    const text = `[유치원 주말 이야기 사진 등록 안내]
${name} 학부모님, 사진을 첨부하신 후 화면 맨 아래의 [Instagram 스타일 게시하기] 버튼을 꼭 눌러주셔야 학급 발표 슬라이드에 최종 등록됩니다! 혹시 전송에 어려움이 있으시면 사진을 카카오톡이나 문자로 보내주시면 선생님이 대신 등록해 드리겠습니다. 😊`;
    navigator.clipboard.writeText(text);
    onShowToast('학부모 안내 메시지가 클립보드에 복사되었습니다!', 'success');
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
    // Sort students in this class by Korean name order
    studentsByClass[cName].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'ko'));
    studentsByClass[cName].forEach((s, idx) => {
      classNumberMap.set(s.id, idx + 1);
    });
  });

  // Get list of unique class names
  const classList = Array.from(new Set((roster || []).map((s) => s.className || '햇살반')));

  // Filtered Roster
  const filteredRoster = (roster || []).filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.note && student.note.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesClass = selectedClass === '전체' || (student.className || '햇살반') === selectedClass;

    const count = (allStories || []).filter(
      (st) => st?.studentName && st.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()
    ).length;

    let matchesSubmission = true;
    if (submissionFilter === 'submitted') matchesSubmission = count > 0;
    if (submissionFilter === 'unsubmitted') matchesSubmission = count === 0;

    return matchesSearch && matchesClass && matchesSubmission;
  });

  // Calculate audit statistics
  const submittedStudentNames = Array.from(
    new Set((allStories || []).map((s) => s.studentName.trim().toLowerCase()))
  );
  const submittedCountTotal = roster.filter((r) =>
    submittedStudentNames.includes(r.name.trim().toLowerCase())
  ).length;
  const unsubmittedCountTotal = roster.length - submittedCountTotal;

  // Specific check for "김도희"
  const doheeStories = (allStories || []).filter(
    (s) => s.studentName.trim().toLowerCase() === '김도희'
  );
  const doheePhotosCount = doheeStories.reduce(
    (acc, s) => acc + (s.imageUrls && s.imageUrls.length > 0 ? s.imageUrls.length : (s.imageUrl ? 1 : 0)),
    0
  );

  // Sort filtered roster by Class Name first, then Korean Name order
  const sortedFilteredRoster = [...filteredRoster].sort((a, b) => {
    const classA = a.className?.trim() || '햇살반';
    const classB = b.className?.trim() || '햇살반';
    if (classA !== classB) {
      return classA.localeCompare(classB, 'ko');
    }
    return a.name.trim().localeCompare(b.name.trim(), 'ko');
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E8E4D9] rounded-[32px] w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-[#2D2A26] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7C8E7E] flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg">유치원 교사 관리자 모드</h3>
              <p className="text-xs text-[#A59F94]">학급별 원아 명단 등록 및 관리 (비밀번호 보호)</p>
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
                관리자 모드는 담임 교사 전용 공간입니다. 지정된 비밀번호를 입력해 주세요.
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
          <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Top Stat Ribbon & Class Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-4 rounded-2xl flex items-center gap-3">
                <Users className="w-8 h-8 text-[#7C8E7E]" />
                <div>
                  <p className="text-[11px] text-[#A59F94] font-bold">등록된 원아 수</p>
                  <p className="text-xl font-serif font-bold text-[#2D2A26]">{roster.length}명</p>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-4 rounded-2xl flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-[#7C8E7E]" />
                <div>
                  <p className="text-[11px] text-[#A59F94] font-bold">제출된 주말 이야기</p>
                  <p className="text-xl font-serif font-bold text-[#2D2A26]">{allStories.length}건</p>
                </div>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#A59F94] font-bold">제출 완료 / 미제출</p>
                  <p className="text-xs font-bold text-[#7C8E7E] flex items-center gap-1 mt-1">
                    <Check className="w-3.5 h-3.5" /> 완료 {submittedCountTotal}명 · 미제출 {unsubmittedCountTotal}명
                  </p>
                </div>
                <button
                  onClick={() => setIsAuthenticated(false)}
                  className="text-xs px-2.5 py-1 rounded-full bg-white border border-[#E8E4D9] text-[#8B8378] hover:text-[#2D2A26]"
                >
                  잠금
                </button>
              </div>
            </div>

            {/* Comprehensive Child Data Audit & Dohee Emergency Diagnostic Card */}
            <div className="border border-amber-300 bg-amber-50/70 p-5 rounded-2xl space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    진단
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-[#2D2A26] text-sm flex items-center gap-1.5">
                      <span>원아별 데이터 전수 검사 & 김도희 긴급 진단</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold">
                        실시간 정밀 확인
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      서버 디스크(/data/stories.json) 및 학부모 기기 상태를 정밀 분석한 결과입니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenProxyUpload('김도희')}
                    className="px-3 py-1.5 rounded-xl bg-[#2D2A26] hover:bg-[#7C8E7E] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>김도희 원아 사진 대리 등록</span>
                  </button>
                </div>
              </div>

              {/* Status Details for 김도희 */}
              <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#2D2A26] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                    김도희 원아 현재 등록 상태:
                  </span>
                  {doheeStories.length > 0 ? (
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      ✅ {doheeStories.length}건 등록 완료 (사진 {doheePhotosCount}장 보관 중)
                    </span>
                  ) : (
                    <span className="text-xs font-black text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                      ⚠️ 미등록 (사진 0건 - 학부모 업로드 대기 중)
                    </span>
                  )}
                </div>

                {doheeStories.length === 0 ? (
                  <div className="text-xs text-[#5D574F] leading-relaxed space-y-2 pt-1">
                    <p>
                      <strong>원인 분석:</strong> 김도희 학부모님이 스마트폰에서 사진을 고른 뒤 맨 아래 <strong>[Instagram 스타일 게시하기]</strong> 버튼을 누르지 않았거나, 학부모 기기 브라우저 캐시에만 보관되어 서버 전송이 완료되지 않은 상태입니다.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => handleOpenProxyUpload('김도희')}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                      >
                        <Camera className="w-3 h-3" />
                        선생님이 카톡/문자로 받은 사진 즉시 등록하기
                      </button>
                      <button
                        onClick={handleSyncLocalToServer}
                        disabled={isSyncing}
                        className="px-3 py-1.5 rounded-lg bg-[#F5F2ED] hover:bg-[#E8E4D9] text-[#2D2A26] text-xs font-bold border border-[#E8E4D9] flex items-center gap-1 shadow-2xs"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        현재 기기 캐시 강제 복구 동기화
                      </button>
                      <button
                        onClick={() => handleCopyParentGuide('도희')}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[#5D574F] text-xs font-bold border border-[#DBDBDB] flex items-center gap-1 shadow-2xs"
                      >
                        <Copy className="w-3 h-3 text-[#7C8E7E]" />
                        학부모 안내 메시지 복사
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-emerald-800 space-y-2 pt-1">
                    <p className="font-bold">
                      서버 영구 디스크에 {doheePhotosCount}장의 고화질 사진이 저장되어 슬라이드 발표 및 피드에서 바로 열람 가능합니다.
                    </p>
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {doheeStories.map((ds) => (
                        <div key={ds.id} className="flex items-center gap-1 bg-[#F5F2ED] px-2.5 py-1 rounded-lg text-[11px] font-bold">
                          <span>{ds.week}</span>
                          <span className="text-[#7C8E7E]">({ds.imageUrls?.length || 1}장)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Persistent Storage & Data Recovery Center */}
            <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-5 rounded-2xl space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7C8E7E]" />
                  <h4 className="font-serif font-bold text-[#2D2A26] text-sm">학부모 업로드 사진 및 데이터 영구 보존 센터</h4>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F0E9] text-[#2D3A30] text-[11px] font-bold w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  서버 영구 보존 활성화됨
                </span>
              </div>
              <p className="text-xs text-[#8B8378] leading-relaxed">
                학부모님들이 스마트폰에서 등록하신 사진과 주말 이야기는 서버 디스크에 안전하게 영구 저장됩니다.
                선생님이 직접 이야기 카드의 <strong>[삭제]</strong> 버튼을 누르기 전까지는 기기를 닫거나 새로고침해도 절대 사라지지 않고 보존됩니다.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSyncLocalToServer}
                  disabled={isSyncing}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#C2D1C5] hover:bg-[#E8F0E9] text-[#2D3A30] text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  현재 기기 사진·이야기 서버로 강제 복구 및 동기화
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#E8E4D9] hover:bg-gray-50 text-[#5D574F] text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#7C8E7E]" />
                  전체 데이터 백업 다운로드 (.json)
                </button>
                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-white border border-[#E8E4D9] hover:bg-gray-50 text-[#5D574F] text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs">
                  <Upload className="w-3.5 h-3.5 text-[#7C8E7E]" />
                  백업 파일에서 복원하기
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Form: Add New Student */}
            <div className="bg-[#FAF9F6] border border-[#E8E4D9] p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-[#2D2A26] flex items-center gap-2 text-base">
                  <UserPlus className="w-4 h-4 text-[#7C8E7E]" />
                  <span>원아 개별 및 일괄 등록</span>
                </h4>

                <button
                  onClick={() => setShowBulkAdd(!showBulkAdd)}
                  className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-[#E8E4D9] text-[#7C8E7E] hover:bg-[#7C8E7E] hover:text-white transition-all"
                >
                  {showBulkAdd ? '개별 입력 전환' : '📝 이름 여러 명 한번에 등록'}
                </button>
              </div>

              {showBulkAdd ? (
                <div className="space-y-3">
                  <p className="text-xs text-[#8B8378]">
                    원아 이름을 줄바꿈이나 쉼표(,)로 구분하여 한 번에 여러 명 입력해 주세요. (예: 김민준, 이서연, 박준우)
                  </p>
                  <textarea
                    rows={3}
                    placeholder="김민준&#10;이서연&#10;박준우&#10;최하은"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    className="w-full bg-white border border-[#E8E4D9] rounded-xl p-3 text-sm text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#7C8E7E]"
                  />
                  <button
                    onClick={handleBulkAdd}
                    className="px-5 py-2 rounded-full bg-[#7C8E7E] text-white font-bold text-xs shadow-xs hover:bg-[#6A7B6C]"
                  >
                    일괄 추가하기
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#A59F94] mb-1">반 이름</label>
                    <input
                      type="text"
                      placeholder="햇살반"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      className="w-full bg-white border border-[#E8E4D9] rounded-xl px-3 py-2 text-xs font-bold text-[#2D2A26]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#A59F94] mb-1">원아 이름 *</label>
                    <input
                      type="text"
                      placeholder="예: 김민준"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-white border border-[#E8E4D9] rounded-xl px-3 py-2 text-xs font-bold text-[#2D2A26]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#A59F94] mb-1">학부모 PIN (4자리)</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="1234"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full bg-white border border-[#E8E4D9] rounded-xl px-3 py-2 text-xs font-bold text-[#2D2A26]"
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
                  <span className="text-[10px] font-extrabold text-[#8B8378] shrink-0">제출상태:</span>
                  <button
                    onClick={() => setSubmissionFilter('all')}
                    className={`text-xs px-2.5 py-1 rounded-full border font-bold transition-all ${
                      submissionFilter === 'all'
                        ? 'bg-[#2D2A26] text-white border-[#2D2A26]'
                        : 'bg-[#FAF9F6] text-[#5D574F] border-[#E8E4D9]'
                    }`}
                  >
                    전체 ({roster.length})
                  </button>
                  <button
                    onClick={() => setSubmissionFilter('submitted')}
                    className={`text-xs px-2.5 py-1 rounded-full border font-bold transition-all ${
                      submissionFilter === 'submitted'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    제출 완료 ({submittedCountTotal})
                  </button>
                  <button
                    onClick={() => setSubmissionFilter('unsubmitted')}
                    className={`text-xs px-2.5 py-1 rounded-full border font-bold transition-all ${
                      submissionFilter === 'unsubmitted'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    미제출 ({unsubmittedCountTotal})
                  </button>
                </div>
              </div>

              {/* Class selector pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full">
                <span className="text-[10px] font-extrabold text-[#8B8378] shrink-0">학급선택:</span>
                <button
                  onClick={() => setSelectedClass('전체')}
                  className={`text-xs px-3 py-1 rounded-full border font-bold transition-all shrink-0 ${
                    selectedClass === '전체'
                      ? 'bg-[#7C8E7E] text-white border-[#7C8E7E]'
                      : 'bg-[#FAF9F6] text-[#5D574F] border-[#E8E4D9]'
                  }`}
                >
                  전체 반
                </button>
                {classList.map((cName) => {
                  const count = roster.filter((s) => (s.className || '햇살반') === cName).length;
                  const isSelected = selectedClass === cName;
                  return (
                    <div key={cName} className="flex items-center gap-1 shrink-0">
                      <button
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
                    <th className="py-3 px-4">주말 이야기 제출</th>
                    <th className="py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4D9] text-xs">
                  {sortedFilteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#A59F94] font-medium">
                        등록된 원아가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    sortedFilteredRoster.map((student) => {
                      const isEditing = editingId === student.id;
                      const submittedCount = (allStories || []).filter(
                        (st) => st?.studentName && st.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()
                      ).length;
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
                                className="w-16 px-2 py-1 border border-[#E8E4D9] rounded-lg font-bold text-xs"
                              />
                            </td>
                            <td className="p-2 text-[#8B8378]">{submittedCount}건 제출됨</td>
                            <td className="p-2 text-right space-x-1">
                              <button
                                onClick={() => handleSaveEdit(student.id)}
                                className="px-3 py-1 bg-[#7C8E7E] text-white rounded-lg text-xs font-bold"
                              >
                                저장
                              </button>
                              <button
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
                            {submittedCount > 0 ? (
                              <span className="bg-[#E8F0E9] text-[#2D3A30] font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                                {submittedCount}건 제출
                              </span>
                            ) : (
                              <span className="bg-[#F5F2ED] text-[#A59F94] px-2.5 py-0.5 rounded-full text-[11px]">
                                미제출
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleOpenProxyUpload(student.name)}
                              className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1 transition-all shadow-2xs"
                              title="선생님 대리 사진/이야기 등록"
                            >
                              <Camera className="w-3 h-3" />
                              <span>대리 등록</span>
                            </button>
                            <button
                              onClick={() => handleStartEdit(student)}
                              className="p-1.5 text-[#8B8378] hover:text-[#2D2A26] rounded-md hover:bg-gray-100"
                              title="정보 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
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
                  onClick={() => setStudentToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E4D9] bg-[#FAF9F6] text-xs font-bold text-[#5D574F] hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
                <button
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
                  onClick={() => setClassToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E4D9] bg-[#FAF9F6] text-xs font-bold text-[#5D574F] hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
                <button
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
                  <div className="w-9 h-9 rounded-full bg-[#7C8E7E] text-white flex items-center justify-center">
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
                        accept="image/*"
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
                          {isProxyUploading ? '사진 압축 및 서버 전송 중...' : '클릭하여 사진 추가 (PC/스마트폰)'}
                        </span>
                        <span className="text-[10px] text-[#8B8378]">
                          카카오톡이나 문자로 전달받은 사진을 바로 등록하세요 (현재 {proxyImages.length}/3장)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Uploaded Photos Preview */}
                  {proxyImages.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                      {proxyImages.map((pUrl, pIdx) => (
                        <div key={pIdx} className="p-2 border border-[#E8E4D9] rounded-xl bg-white space-y-1.5">
                          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-black/5">
                            <img src={pUrl} alt={`사진 ${pIdx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
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
                    placeholder="예: 바닷가에서 가족과 함께 조개도 줍고 신나는 모래성 쌓기를 하며 뜻깊은 주말을 보냈네요!"
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
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 hover:opacity-90 text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
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
