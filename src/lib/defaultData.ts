import { StoryItem } from '../types';

// Canonical registered stories from 9/5~9/6 (김강모, 강루하)
// Ensures that on any fresh instance, PC, or mobile device, these registered stories are immediately visible without 0-count delay.
export const INITIAL_STORIES: StoryItem[] = [
  {
    id: 'story-1788706123876-krj5',
    studentName: '김강모',
    week: '9월 1주차(방학지낸이야기)',
    className: '은솔1반',
    title: '모바일 연동 테스트',
    content: '테스트 내용입니다.',
    imageUrl: '/kindergarten_beach_vacation.jpg',
    imageUrls: ['/kindergarten_beach_vacation.jpg'],
    createdAt: '2026-09-06T14:48:43.876Z',
    reactions: { '❤️': 2, '👏': 1 }
  },
  {
    id: 'story-1788705341837-06rn',
    studentName: '강루하',
    week: '9월 1주차(방학지낸이야기)',
    className: '은솔1반',
    title: '주말 이야기 테스트',
    content: '가족과 함께 재미있게 보냈어요.',
    imageUrl: '/kindergarten_family_picnic.jpg',
    imageUrls: ['/kindergarten_family_picnic.jpg'],
    createdAt: '2026-09-06T14:35:41.837Z',
    reactions: { '❤️': 1, '⭐': 2 }
  }
];

