# Intercom 설정 가이드

## ✅ 완료된 항목
- [x] Intercom 계정 생성 및 App ID 설정
- [x] Next.js 프론트엔드 통합
- [x] 사용자 정보 자동 전달 (이메일, 이름, user_id)
- [x] 커스텀 런처 (물음표 버튼)

## 🔧 추가 설정 필요

### 1. 팀원 & 알림 설정

#### Slack 연동 (권장)
1. https://app.intercom.com/a/apps/rr01wcyd/app-store 접속
2. **Slack** 검색 → Install
3. Slack 워크스페이스 연결
4. 채널 선택 (예: `#customer-support`)
5. 새 대화 → Slack 알림 자동 전송

#### Linear 연동 (이슈 트래킹)
1. App Store → **Linear** 검색 → Install
2. Linear 워크스페이스 연결
3. 대화에서 버튼 클릭 → Linear 이슈 생성

#### 팀원 초대
1. Settings → Teammates → Invite teammate
2. 이메일 입력 → 역할 선택

### 2. 자동 응답 설정

#### 환영 메시지
- **Messenger** → **Automated messages** → **New message**
- Type: **Greeting**
- 메시지: "안녕하세요! Clink 팀입니다. 무엇을 도와드릴까요?"
- Rules: **First time visitor**

#### 부재중 메시지
- **Settings** → **General** → **Office hours**
- 운영 시간: 월-금 9am-6pm (Asia/Seoul)
- 부재중 메시지: "현재 운영 시간이 아닙니다. 이메일을 남겨주시면 운영 시간에 답변드리겠습니다."

### 3. 보안 설정 (운영 필수!)

**Identity Verification (JWT)**

현재는 `Insecurely installed` 상태입니다. 운영 배포 전 반드시 JWT 보안을 설정하세요.

#### 백엔드 구현 필요:

**1) Intercom Secret Key 확인**
- Settings → Installation → Security
- "Messenger secret" 복사 → 백엔드 환경변수 저장

**2) 백엔드 API 엔드포인트 추가**

\`\`\`typescript
// pages/api/intercom/user-hash.ts (예시)
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 사용자 인증 확인
  const userId = req.user?.id; // 실제 인증 로직
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // JWT 생성
  const secret = process.env.INTERCOM_MESSENGER_SECRET!;
  const payload = {
    user_id: userId,
    email: req.user.email,
    name: req.user.name,
  };

  // Intercom JWT 서명
  const userHash = crypto
    .createHmac('sha256', secret)
    .update(userId)
    .digest('hex');

  res.json({ userHash });
}
\`\`\`

**3) 프론트엔드 수정**

\`\`\`typescript
// IntercomChat.tsx
const response = await fetch('/api/intercom/user-hash');
const { userHash } = await response.json();

window.intercomSettings = {
  app_id: 'rr01wcyd',
  user_id: user.id,
  email: user.email,
  name: user.name,
  user_hash: userHash, // 추가
};
\`\`\`

**4) Intercom 대시보드에서 활성화**
- Settings → Installation → Security
- "Enable identity verification" 토글 ON

### 4. 헬프센터 (선택)

#### FAQ 문서 추가
1. **Help** → **Articles** → **New article**
2. 자주 묻는 질문 작성:
   - "How to create a project?"
   - "How to connect AI providers?"
   - "What is the pricing?"

#### 채팅에서 자동 제안
- Messenger → Settings → "Suggest relevant articles"

### 5. 모니터링 & 분석

#### 대시보드 확인
- **Home** → 실시간 대화 수, 응답 시간
- **Inbox** → 미답변 대화 확인
- **Reports** → 주간/월간 통계

#### 성과 지표 (KPI)
- First response time (첫 응답 시간)
- Resolution time (해결 시간)
- Customer satisfaction (만족도)

## 📱 모바일 앱 (선택)

Intercom 모바일 앱 다운로드:
- iOS: https://apps.apple.com/app/intercom/id1434348653
- Android: https://play.google.com/store/apps/details?id=io.intercom.android

→ 언제 어디서나 고객 대화 확인 가능

## 🎨 커스터마이징

### Messenger 색상 변경
- **Messenger** → **Messenger settings** → **Customize messenger**
- Primary color, Background, Button style 변경

### 런처 위치/스타일
- 현재: 커스텀 물음표 버튼 (우하단)
- 필요시: HelpFAB.tsx에서 스타일 수정

## 🚀 다음 단계

1. [ ] Slack 연동 → 팀 알림 받기
2. [ ] 부재중 메시지 설정
3. [ ] JWT 보안 구현 (운영 배포 전 필수)
4. [ ] FAQ 문서 3개 이상 작성
5. [ ] 팀원 1명 이상 초대

## 📚 참고 링크

- Intercom 대시보드: https://app.intercom.com/a/apps/rr01wcyd
- Slack 연동: https://www.intercom.com/help/en/articles/230-integrate-intercom-with-slack
- Linear 연동: https://www.intercom.com/help/en/articles/6367341
- JWT 보안: https://www.intercom.com/help/en/articles/10589769
- Messenger 커스터마이징: https://www.intercom.com/help/en/articles/867

---

**현재 상태**: ✅ 기본 설치 완료, 🔧 운영 설정 필요
