import { StoryItem } from '../types';

export const INITIAL_STORIES: StoryItem[] = [
  {
    id: 'demo-eunsol',
    week: '9월 1주차(방학지낸 이야기)',
    studentName: '김은솔',
    parentPin: '1234',
    title: '신나는 여름방학 동해 바다 체험과 우리가족 모래성 쌓기',
    content: '안녕하세요! 은솔이네 가족의 즐거웠던 여름방학 주말 이야기입니다.\n\n방학 동안 은솔이와 함께 동해 바다로 여름 휴가를 다녀왔어요. 바닷가에서 맑은 파도 소리도 듣고, 아빠 엄마와 힘을 합쳐 커다란 인어공주 모래성도 만들었답니다. 조개껍데기를 주워서 모래성을 예쁘게 꾸미는 동안 은솔이 얼굴에 웃음꽃이 피어났어요. 저녁에는 신선한 해산물도 맛있게 먹고 밤하늘의 반짝이는 별도 관찰하며 소중한 추억을 가득 쌓았습니다.\n\n우리 유치원 친구들도 방학 동안 모두 건강하고 즐겁게 보냈기를 바라요! 💕',
    imageUrls: [
      '/eunsol_beach_laugh.jpg',
      '/eunsol_sandcastle.jpg',
      '/eunsol_family_sunset.jpg'
    ],
    imageCaptions: [
      '파도가 넘실거리는 에메랄드빛 동해 바닷가에서 찰칵! 🌊',
      '조개껍데기로 예쁘게 꾸민 커다란 모래성 앞에서 포즈 🏰',
      '노을 지는 해변을 걸으며 가족과 함께 나누는 소중한 행복 🌅'
    ],
    aiComment: '자연 속에서 가족과의 따뜻한 사랑과 협동심을 배운 최고의 여름방학 이야기입니다! 조개껍데기로 꾸민 모래성이 정말 동화 속 풍경 같아요. ✨🐚🌊',
    createdAt: new Date().toISOString(),
    reactions: { '❤️': 24, '👏': 18, '⭐': 15 }
  }
];


