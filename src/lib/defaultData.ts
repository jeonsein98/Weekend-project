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
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80'
    ],
    imageCaptions: [
      '파도가 넘실거리는 에메랄드빛 동해 바닷가에서 찰칵! 🌊',
      '조개껍데기로 예쁘게 꾸민 커다란 모래성 앞에서 포즈 🏰',
      '노을 지는 해변을 걸으며 가족과 함께 나누는 소중한 행복 🌅'
    ],
    aiComment: '자연 속에서 가족과의 따뜻한 사랑과 협동심을 배운 최고의 여름방학 이야기입니다! 조개껍데기로 꾸민 모래성이 정말 동화 속 풍경 같아요. ✨🐚🌊',
    createdAt: new Date().toISOString(),
    reactions: { '❤️': 24, '👏': 18, '⭐': 15 }
  },
  {
    id: 'demo-1',
    week: '9월 1주차(방학지낸 이야기)',
    studentName: '김민준',
    parentPin: '1234',
    title: '여름 방학 강원도 계곡 캠핑 이야기',
    content: '여름 방학 동안 부모님과 함께 강원도 깨끗한 계곡으로 캠핑을 다녀왔어요. 모닥불 피워놓고 맛있는 마시멜로도 굽고 맑은 냇물에서 아빠랑 작은 물고기도 관찰했습니다!',
    imageUrls: [
      'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?auto=format&fit=crop&w=800&q=80'
    ],
    aiComment: '가족과 함께 자연 속에서 정서적 교감을 나눈 멋진 시간입니다. 오감을 자극하는 우수한 생태 탐구 활동이에요! 🏕️🔥',
    createdAt: new Date().toISOString(),
    reactions: { '❤️': 12, '👏': 15, '⭐': 10 }
  },
  {
    id: 'demo-2',
    week: '9월 1주차(방학지낸 이야기)',
    studentName: '이서연',
    parentPin: '1234',
    title: '할머니 댁에서 과일 수확 체험',
    content: '방학에 시골 할머니 댁에서 탐스럽게 익은 포도랑 사과를 직접 따보았어요. 바구니에 가득 담아서 유치원 친구들에게 나눠주고 싶었습니다.',
    imageUrls: [
      'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80'
    ],
    aiComment: '수확의 기쁨과 함께 나눠 먹는 고운 마음씨가 참 따뜻하고 어여쁩니다. 🍇🍎',
    createdAt: new Date().toISOString(),
    reactions: { '❤️': 10, '👏': 8, '⭐': 11 }
  },
  {
    id: 'demo-3',
    week: '9월 2주차',
    studentName: '박준우',
    parentPin: '1234',
    title: '아빠와 완성한 거대한 레고 자동차',
    content: '주말 동안 아빠와 머리를 맞대고 바퀴가 진짜 굴러가는 레고 소방차를 완성했어요. 불을 끄는 소방관 역할 놀이도 신나게 했습니다.',
    imageUrls: [
      'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80'
    ],
    aiComment: '집중력과 상상력이 돋보이는 모형 구성 활동이네요! 협동심도 아주 훌륭합니다. 🚒🧱',
    createdAt: new Date().toISOString(),
    reactions: { '❤️': 14, '👏': 11, '⭐': 12 }
  },
  {
    id: 'demo-4',
    week: '9월 2주차',
    studentName: '최하은',
    parentPin: '1234',
    title: '동네 공원에서 강아지랑 보낸 주말',
    content: '날씨가 참 가을다워서 댕댕이 콩이랑 공원에서 신나게 달리기 시합을 했습니다. 풀밭에서 예쁜 단풍잎도 주웠어요.',
    imageUrls: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80'
    ],
    aiComment: '자연과 동물을 사랑하는 순수한 마음이 잘 드러난 밝고 활기찬 주말 이야기입니다. 🐶🍁',
    createdAt: new Date().toISOString(),
    reactions: { '❤️': 9, '👏': 12, '⭐': 7 }
  }
];

