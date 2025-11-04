# GitHub Integration - Frontend Implementation Guide

## API Endpoints Overview

### Account Management
- `GET /api/github/connection/status` - 계정 연결 상태 확인
- `GET /api/github/installations` - 연결된 Organization 목록
- `GET /api/github/install` - GitHub App 설치 URL 받기
- `DELETE /api/github/connection/{installationId}` - 연결 해제

### Project Sync
- `GET /api/github/projects/{projectId}/sync/status` - 프로젝트 동기화 상태
- `POST /api/github/projects/{projectId}/sync/enable` - 동기화 활성화
- `POST /api/github/projects/{projectId}/sync/disable` - 동기화 비활성화

## UI Flow Implementation

### 1. Connected Account 섹션 (Admin 표시)

```javascript
// 계정 연결 상태 확인
const checkAccountStatus = async () => {
  const res = await fetch('/api/github/connection/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();

  if (data.connected) {
    // "Admin" 부분에 표시
    setAccountName(data.installation.targetLogin);
  }
};

// GitHub 계정 추가 (Add your GitHub account 클릭)
const addGitHubAccount = async () => {
  const res = await fetch('/api/github/install', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { installUrl } = await res.json();
  window.open(installUrl, '_blank');
};
```

### 2. Connect Project 섹션

```javascript
// 프로젝트 연결 상태 확인
const checkProjectStatus = async (projectId) => {
  const res = await fetch(`/api/github/projects/${projectId}/sync/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();

  return {
    isConnected: data.isSynced,
    repository: data.repository
  };
};

// Connect Project 버튼 클릭 → Organization 선택 모달
const showOrgSelector = async () => {
  const res = await fetch('/api/github/installations', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { installations } = await res.json();

  // 모달에 Organization 목록 표시
  return installations.map(inst => ({
    id: inst.id,
    name: inst.targetLogin,
    type: inst.targetType
  }));
};
```

### 3. Organization 선택 및 프로젝트 연결

```javascript
// Organization 선택 후 Continue 클릭
const connectProjectToOrg = async (projectId, installationId) => {
  const res = await fetch(`/api/github/projects/${projectId}/sync/enable`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      installationId: installationId,
      // repositoryName: "custom-name", // 선택적
      private: true
    })
  });

  const data = await res.json();
  return {
    repoUrl: data.repository.url,
    repoName: data.repository.fullName
  };
};

// 토글 스위치로 동기화 ON/OFF
const toggleSync = async (projectId, enabled) => {
  const endpoint = enabled
    ? `/api/github/projects/${projectId}/sync/enable`
    : `/api/github/projects/${projectId}/sync/disable`;

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};
```

### 4. Add Organizations 클릭

```javascript
// "Add Organizations" 버튼 클릭 → GitHub 모달
const addOrganization = async () => {
  const res = await fetch('/api/github/install', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { installUrl } = await res.json();

  // GitHub App 설치 페이지 새 창 열기
  window.open(installUrl, '_blank');

  // 설치 완료 후 콜백 처리 (자동)
  // 프론트엔드는 /github/success 또는 /github/error로 리다이렉트됨
};
```

## Complete React Component Example

```jsx
function GitHubIntegration({ projectId }) {
  const [account, setAccount] = useState(null);
  const [projectConnected, setProjectConnected] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [showOrgModal, setShowOrgModal] = useState(false);

  useEffect(() => {
    // 초기 로드
    checkAccountStatus();
    checkProjectStatus();
  }, []);

  // 1. Connected Account 확인
  const checkAccountStatus = async () => {
    const res = await fetch('/api/github/connection/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.connected) {
      setAccount(data.installation);
    }
  };

  // 2. Project 연결 상태 확인
  const checkProjectStatus = async () => {
    const res = await fetch(`/api/github/projects/${projectId}/sync/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setProjectConnected(data.isSynced);
  };

  // 3. Connect Project 클릭
  const handleConnectProject = async () => {
    const res = await fetch('/api/github/installations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { installations } = await res.json();
    setOrganizations(installations);
    setShowOrgModal(true);
  };

  // 4. Organization 선택
  const selectOrganization = async (installationId) => {
    await fetch(`/api/github/projects/${projectId}/sync/enable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ installationId })
    });
    setProjectConnected(true);
    setShowOrgModal(false);
  };

  // 5. Add Organizations
  const addOrganization = async () => {
    const res = await fetch('/api/github/install', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { installUrl } = await res.json();
    window.open(installUrl, '_blank');
  };

  return (
    <div>
      {/* Connected Account Section */}
      <div>
        <h3>Connected Account</h3>
        {account ? (
          <span>Admin: {account.targetLogin}</span>
        ) : (
          <button onClick={addOrganization}>Add GitHub account</button>
        )}
      </div>

      {/* Connect Project Section */}
      <div>
        <h3>Connect Project</h3>
        {projectConnected ? (
          <span>✓ Connected</span>
        ) : (
          <button onClick={handleConnectProject}>Connect Project</button>
        )}
      </div>

      {/* Organization Selection Modal */}
      {showOrgModal && (
        <div className="modal">
          <h4>GitHub Organizations</h4>
          {organizations.map(org => (
            <div key={org.id}>
              <label>
                <input
                  type="radio"
                  name="org"
                  onChange={() => selectOrganization(org.id)}
                />
                {org.targetLogin}
              </label>
            </div>
          ))}
          <button onClick={addOrganization}>Add Organizations</button>
        </div>
      )}
    </div>
  );
}
```

## Authorization Header

모든 API 요청에 JWT 토큰 필수:
```javascript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('token')}`
}
```

## Error Handling

```javascript
// 401: 인증 필요
// 404: 프로젝트/설치 없음
// 409: 이미 연결됨

if (!res.ok) {
  const error = await res.json();
  console.error(error.message);
}
```