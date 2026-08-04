import React, { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { RosterStudent, StoryItem } from '../types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterStudent[];
  allStories: StoryItem[];
  onSaveRoster: (roster: RosterStudent[]) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ADMIN_PASSWORD_CORRECT = '0459';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  roster = [],
  allStories = [],
  onSaveRoster,
  onShowToast
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('전체');

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
    return matchesSearch && matchesClass;
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
                  <p className="text-[11px] text-[#A59F94] font-bold">관리자 인증 상태</p>
                  <p className="text-xs font-bold text-[#7C8E7E] flex items-center gap-1 mt-1">
                    <Check className="w-3.5 h-3.5" /> 비밀번호 인증됨
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#A59F94]" />
                <input
                  type="text"
                  placeholder="원아 이름 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF9F6] border border-[#E8E4D9] rounded-xl text-xs font-bold text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#7C8E7E]"
                />
              </div>

              {/* Class selector pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  onClick={() => setSelectedClass('전체')}
                  className={`text-xs px-3 py-1 rounded-full border font-bold transition-all ${
                    selectedClass === '전체'
                      ? 'bg-[#7C8E7E] text-white border-[#7C8E7E]'
                      : 'bg-[#FAF9F6] text-[#5D574F] border-[#E8E4D9]'
                  }`}
                >
                  전체 ({roster.length})
                </button>
                {classList.map((cName) => {
                  const count = roster.filter((s) => (s.className || '햇살반') === cName).length;
                  const isSelected = selectedClass === cName;
                  return (
                    <div key={cName} className="flex items-center gap-1">
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
                          <td className="py-3 px-4 text-right space-x-1">
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
      </div>
    </div>
  );
};
