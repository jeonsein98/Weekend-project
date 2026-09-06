export interface StoryItem {
  id: string;
  week: string; // e.g. "9월 1주차(방학지낸 이야기)"
  studentName: string; // e.g. "김민준"
  className?: string; // e.g. "은솔1반"
  parentPin?: string; // 학부모 인증 비밀번호 (4자리)
  title: string;
  content: string;
  imageUrls: string[]; // 업로드한 사진 최대 3장 (순서대로 저장)
  imageCaptions?: string[]; // 각 사진별 설명 코멘트 (최대 3개, imageUrls와 1:1 매칭)
  imageUrl?: string; // 호환성용 단일 이미지 필드
  aiComment?: string; // AI Gemini 교사 소감/칭찬
  createdAt: string;
  reactions?: Record<string, number>;
}

export interface RosterStudent {
  id: string;
  name: string;
  className?: string;
  parentPin?: string;
  note?: string;
}

export interface GasConfig {
  webAppUrl: string;
  isConnected: boolean;
  lastSyncedAt?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const WEEKS_LIST = [
  "9월 1주차(방학지낸이야기)",
  "9/5~9/6",
  "9/12~9/13",
  "9/19~9/20",
  "9/26~9/27",
  "10/3~10/4",
  "10/10~10/11",
  "10/17~10/18",
  "10/24~10/25",
  "10/31~11/1",
  "11/7~11/8",
  "11/14~11/15",
  "11/21~11/22",
  "11/28~11/29",
  "12/5~12/6",
  "12/12~12/13",
  "12/19~12/20",
  "12/26~12/27",
  "1/2~1/3",
  "1/9~1/10",
  "1/16~1/17",
  "1/23~1/24",
  "1/30~1/31",
  "2월 1주차(방학지낸이야기)",
  "2/6~2/7"
];

/**
 * Canonical week key mapping so that all equivalent expressions mutually match:
 * - "9월 1주차(방학지낸이야기)" === "9월 1주차" === "9월1주차" === "9/5~9/6" === "9.5~9.6" -> "w_9_1"
 * - "9월 2주차" === "9/12~9/13" -> "w_9_2"
 * - "9월 3주차" === "9/19~9/20" -> "w_9_3"
 * - "9월 4주차" === "9/26~9/27" -> "w_9_4"
 * - "10월 1주차" === "10/3~10/4" -> "w_10_1"
 * - "10월 2주차" === "10/10~10/11" -> "w_10_2"
 * - "10월 3주차" === "10/17~10/18" -> "w_10_3"
 * - "10월 4주차" === "10/24~10/25" -> "w_10_4"
 * - "10월 5주차" === "10/31~11/1" -> "w_10_5"
 * - "11월 1주차" === "11/7~11/8" -> "w_11_1"
 * - "11월 2주차" === "11/14~11/15" -> "w_11_2"
 * - "11월 3주차" === "11/21~11/22" -> "w_11_3"
 * - "11월 4주차" === "11/28~11/29" -> "w_11_4"
 * - "12월 1주차" === "12/5~12/6" -> "w_12_1"
 * - "12월 2주차" === "12/12~12/13" -> "w_12_2"
 * - "12월 3주차" === "12/19~12/20" -> "w_12_3"
 * - "12월 4주차" === "12/26~12/27" -> "w_12_4"
 * - "1월 1주차" === "1/2~1/3" -> "w_1_1"
 * - "1월 2주차" === "1/9~1/10" -> "w_1_2"
 * - "1월 3주차" === "1/16~1/17" -> "w_1_3"
 * - "1월 4주차" === "1/23~1/24" -> "w_1_4"
 * - "1월 5주차" === "1/30~1/31" -> "w_1_5"
 * - "2월 1주차" === "2/6~2/7" === "2월 1주차(방학지낸이야기)" -> "w_2_1"
 * - "3월 1주차" === "3/6~3/7" === "3/7~3/8" === "3/5~3/6" -> "w_3_1"
 */
export function getCanonicalWeekKey(weekStr?: string): string {
  if (!weekStr) return '';
  const clean = weekStr.replace(/\s+/g, '').toLowerCase().trim();
  if (clean === '전체' || clean === 'all') return 'all';

  // Vacation stories mapping
  if (clean.includes('방학지낸이야기') || clean.includes('방학이야기')) {
    if (clean.includes('2월') || clean.includes('2/')) return 'w_2_1';
    return 'w_9_1';
  }

  // Date ranges like 9/5~9/6 or 9.5~9.6 or 9-5~9-6
  const dateRangeMatch = clean.match(/(\d+)[\/\.\-](\d+)~(\d+)[\/\.\-](\d+)/);
  if (dateRangeMatch) {
    const m = parseInt(dateRangeMatch[1], 10);
    const d = parseInt(dateRangeMatch[2], 10);
    if (m === 9) {
      if (d <= 9) return 'w_9_1';
      if (d <= 16) return 'w_9_2';
      if (d <= 23) return 'w_9_3';
      return 'w_9_4';
    }
    if (m === 10) {
      if (d <= 7) return 'w_10_1';
      if (d <= 14) return 'w_10_2';
      if (d <= 21) return 'w_10_3';
      if (d <= 28) return 'w_10_4';
      return 'w_10_5';
    }
    if (m === 11) {
      if (d <= 10) return 'w_11_1';
      if (d <= 17) return 'w_11_2';
      if (d <= 24) return 'w_11_3';
      return 'w_11_4';
    }
    if (m === 12) {
      if (d <= 8) return 'w_12_1';
      if (d <= 15) return 'w_12_2';
      if (d <= 22) return 'w_12_3';
      return 'w_12_4';
    }
    if (m === 1) {
      if (d <= 5) return 'w_1_1';
      if (d <= 12) return 'w_1_2';
      if (d <= 19) return 'w_1_3';
      if (d <= 26) return 'w_1_4';
      return 'w_1_5';
    }
    if (m === 2) {
      return 'w_2_1';
    }
    if (m === 3) {
      if (d <= 10) return 'w_3_1';
      if (d <= 17) return 'w_3_2';
      if (d <= 24) return 'w_3_3';
      return 'w_3_4';
    }
  }

  // Month and week pattern: e.g. "9월 1주차", "9월1주차", "9월1주"
  const mwMatch = clean.match(/(\d+)월\s*(\d+)주차?/);
  if (mwMatch) {
    return `w_${mwMatch[1]}_${mwMatch[2]}`;
  }

  // Fallback: stripped string without brackets
  return clean.replace(/[\(\)\[\]（）]/g, '');
}

/**
 * Check if two week strings match with high fault tolerance:
 * - Uses canonical week mapping (e.g. "9월 1주차" matches "9/5~9/6" and "9월 1주차(방학지낸이야기)")
 * - Ignores spaces and punctuation
 * - Handles '전체' / 'all' wildcard
 */
export function isWeekMatch(weekA?: string, weekB?: string): boolean {
  if (!weekA || !weekB) return false;
  if (weekA === '전체' || weekB === '전체' || weekA === 'all' || weekB === 'all') return true;

  const cleanA = weekA.replace(/\s+/g, '').trim();
  const cleanB = weekB.replace(/\s+/g, '').trim();
  if (cleanA === cleanB) return true;

  const canonA = getCanonicalWeekKey(cleanA);
  const canonB = getCanonicalWeekKey(cleanB);
  if (canonA && canonB && canonA === canonB) return true;

  // Compare after removing brackets and parentheses
  const strippedA = cleanA.replace(/[\(\)\[\]（）]/g, '');
  const strippedB = cleanB.replace(/[\(\)\[\]（）]/g, '');
  if (strippedA === strippedB) return true;
  if (strippedA.includes(strippedB) || strippedB.includes(strippedA)) return true;

  return false;
}

/**
 * Check if two class strings match:
 * - Handles '전체' / 'all' wildcard
 * - Ignores spacing ("은솔 1반" === "은솔1반")
 * - Case-insensitive
 */
export function isClassMatch(classA?: string, classB?: string): boolean {
  if (!classA || !classB) return true; // Wildcard if unspecified
  if (classA === '전체' || classB === '전체' || classA === 'all' || classB === 'all') return true;

  const normA = classA.replace(/\s+/g, '').toLowerCase().trim();
  const normB = classB.replace(/\s+/g, '').toLowerCase().trim();
  if (normA === normB) return true;

  return normA.includes(normB) || normB.includes(normA);
}

/**
 * Resolve a student's class name from roster or story
 */
export function getStudentClass(
  studentName: string,
  roster: RosterStudent[] = [],
  story?: Partial<StoryItem> & { className?: string }
): string {
  if (!studentName) return '은솔1반';
  const cleanName = studentName.trim().toLowerCase();

  const matched = roster.find(
    (r) => r.name && r.name.trim().toLowerCase() === cleanName
  );
  if (matched?.className?.trim()) {
    return matched.className.trim();
  }

  if (story?.className?.trim()) {
    return story.className.trim();
  }

  return '은솔1반';
}

/**
 * 2026학년도 주말 일정 및 방학 주차를 기준으로 오늘 날짜에 해당하는 주차를 반환 (2월 중순 이전까지)
 */
export function getCurrentWeekString(now = new Date()): string {
  const month = now.getMonth() + 1; // 1 ~ 12
  const day = now.getDate();

  // 9월 첫 주 시작 전 (8월 또는 9월 4일 이전)
  if (month < 9 && month > 2) {
    return "9월 1주차(방학지낸이야기)";
  }
  if (month === 9 && day < 5) {
    return "9월 1주차(방학지낸이야기)";
  }

  // 2월은 2/6~2/7까지 진행 후 종료
  if (month === 2) {
    return "2/6~2/7";
  }

  // 2026년도 주말 날짜 매핑표 (토요일~일요일 주말 기준)
  const weekendDates = [
    { label: "9/5~9/6", m: 9, startD: 5, endD: 11 },
    { label: "9/12~9/13", m: 9, startD: 12, endD: 18 },
    { label: "9/19~9/20", m: 9, startD: 19, endD: 25 },
    { label: "9/26~9/27", m: 9, startD: 26, endD: 30 },
    { label: "10/3~10/4", m: 10, startD: 1, endD: 9 },
    { label: "10/10~10/11", m: 10, startD: 10, endD: 16 },
    { label: "10/17~10/18", m: 10, startD: 17, endD: 23 },
    { label: "10/24~10/25", m: 10, startD: 24, endD: 30 },
    { label: "10/31~11/1", m: 10, startD: 31, endD: 31 },
    { label: "10/31~11/1", m: 11, startD: 1, endD: 6 },
    { label: "11/7~11/8", m: 11, startD: 7, endD: 13 },
    { label: "11/14~11/15", m: 11, startD: 14, endD: 20 },
    { label: "11/21~11/22", m: 11, startD: 21, endD: 27 },
    { label: "11/28~11/29", m: 11, startD: 28, endD: 30 },
    { label: "12/5~12/6", m: 12, startD: 1, endD: 11 },
    { label: "12/12~12/13", m: 12, startD: 12, endD: 18 },
    { label: "12/19~12/20", m: 12, startD: 19, endD: 25 },
    { label: "12/26~12/27", m: 12, startD: 26, endD: 31 },
    { label: "1/2~1/3", m: 1, startD: 1, endD: 5 },
    { label: "1/9~1/10", m: 1, startD: 6, endD: 12 },
    { label: "1/16~1/17", m: 1, startD: 13, endD: 19 },
    { label: "1/23~1/24", m: 1, startD: 20, endD: 26 },
    { label: "1/30~1/31", m: 1, startD: 27, endD: 31 },
    { label: "2/6~2/7", m: 2, startD: 1, endD: 29 },
  ];

  const matched = weekendDates.find(w => w.m === month && day >= w.startD && day <= w.endD);
  if (matched && WEEKS_LIST.includes(matched.label)) {
    return matched.label;
  }

  return WEEKS_LIST[0];
}

declare module 'heic2any';


