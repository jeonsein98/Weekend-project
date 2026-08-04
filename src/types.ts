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

export const WEEKS_LIST = [
  "9월 1주차(방학지낸 이야기)",
  "9월 2주차",
  "9월 3주차",
  "9월 4주차",
  "10월 1주차",
  "10월 2주차",
  "10월 3주차",
  "10월 4주차",
  "11월 1주차",
  "11월 2주차",
  "11월 3주차",
  "11월 4주차",
  "12월 1주차",
  "12월 2주차",
  "12월 3주차",
  // 12월 4주차부터 1월 한 달간 방학 제외
  "2월 1주차(방학지낸 이야기)",
  "2월 2주차"
];

/**
 * 9월 1주차를 시작으로 오늘 날짜에 해당하는 주차를 자동으로 계산하여 반환
 */
export function getCurrentWeekString(now = new Date()): string {
  const month = now.getMonth() + 1; // 1 ~ 12
  const day = now.getDate();

  let weekNum = Math.ceil(day / 7);
  if (weekNum > 4) weekNum = 4;

  let calculatedWeek = "9월 1주차(방학지낸 이야기)";

  if (month === 9) {
    calculatedWeek = weekNum === 1 ? "9월 1주차(방학지낸 이야기)" : `9월 ${weekNum}주차`;
  } else if (month === 10) {
    calculatedWeek = `10월 ${weekNum}주차`;
  } else if (month === 11) {
    calculatedWeek = `11월 ${weekNum}주차`;
  } else if (month === 12) {
    calculatedWeek = weekNum >= 3 ? "12월 3주차" : `12월 ${weekNum}주차`;
  } else if (month === 1) {
    calculatedWeek = "2월 1주차(방학지낸 이야기)";
  } else if (month === 2) {
    calculatedWeek = weekNum === 1 ? "2월 1주차(방학지낸 이야기)" : "2월 2주차";
  } else {
    // 3월 ~ 8월학기 준비 기간 -> 기본 9월 1주차
    calculatedWeek = "9월 1주차(방학지낸 이야기)";
  }

  // WEEKS_LIST에 존재하는 값인지 검증
  if (WEEKS_LIST.includes(calculatedWeek)) {
    return calculatedWeek;
  }
  return WEEKS_LIST[0];
}


