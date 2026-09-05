export interface StoryItem {
  id: string;
  week: string; // e.g. "9월 1주차(방학지낸 이야기)"
  studentName: string; // e.g. "김민준"
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
  "2/6~2/7",
  "2/13~2/14",
  "2/20~2/21",
  "2/27~2/28"
];

/**
 * Check if two week strings match, ignoring inner whitespace
 */
export function isWeekMatch(weekA?: string, weekB?: string): boolean {
  if (!weekA || !weekB) return false;
  if (weekA === '전체' || weekB === '전체') return true;
  return weekA.replace(/\s+/g, '') === weekB.replace(/\s+/g, '');
}

/**
 * 2026학년도 주말 일정 및 방학 주차를 기준으로 오늘 날짜에 해당하는 주차를 반환
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
    { label: "2/6~2/7", m: 2, startD: 1, endD: 9 },
    { label: "2/13~2/14", m: 2, startD: 10, endD: 16 },
    { label: "2/20~2/21", m: 2, startD: 17, endD: 23 },
    { label: "2/27~2/28", m: 2, startD: 24, endD: 29 },
  ];

  const matched = weekendDates.find(w => w.m === month && day >= w.startD && day <= w.endD);
  if (matched && WEEKS_LIST.includes(matched.label)) {
    return matched.label;
  }

  return WEEKS_LIST[0];
}

declare module 'heic2any';


