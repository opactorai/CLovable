/**
 * Amplitude Analytics 이벤트 트래킹 유틸리티
 */
import * as amplitude from '@amplitude/analytics-browser';
import { clientLogger } from './client-logger';

let isInitialized = false;

/**
 * Amplitude 초기화
 */
export function initializeAmplitude(apiKey: string): void {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  try {
    amplitude.init(apiKey, undefined, {
      defaultTracking: {
        pageViews: true,
        sessions: true,
        formInteractions: true,
        fileDownloads: true,
      },
    });
    isInitialized = true;
    clientLogger.info('Amplitude Analytics initialized');
  } catch (error) {
    console.error('Error initializing Amplitude:', error);
  }
}

export type AmplitudeEventProps = Record<string, string | number | boolean>;

/**
 * Amplitude 커스텀 이벤트 전송
 */
export function trackEvent(
  eventName: string,
  props?: AmplitudeEventProps
): void {
  if (typeof window === 'undefined' || !isInitialized) {
    clientLogger.warn('Amplitude Analytics is not initialized');
    return;
  }

  try {
    amplitude.track(eventName, props);
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

/**
 * 사용자 식별
 */
export function identifyUser(userId: string, userProperties?: AmplitudeEventProps): void {
  if (typeof window === 'undefined' || !isInitialized) {
    return;
  }

  try {
    amplitude.setUserId(userId);
    if (userProperties) {
      const identifyEvent = new amplitude.Identify();
      Object.entries(userProperties).forEach(([key, value]) => {
        identifyEvent.set(key, value);
      });
      amplitude.identify(identifyEvent);
    }
  } catch (error) {
    console.error('Error identifying user:', error);
  }
}

/**
 * 사용자 속성 설정
 */
export function setUserProperties(properties: AmplitudeEventProps): void {
  if (typeof window === 'undefined' || !isInitialized) {
    return;
  }

  try {
    const identifyEvent = new amplitude.Identify();
    Object.entries(properties).forEach(([key, value]) => {
      identifyEvent.set(key, value);
    });
    amplitude.identify(identifyEvent);
  } catch (error) {
    console.error('Error setting user properties:', error);
  }
}

/**
 * 프로젝트 생성 이벤트
 */
export function trackProjectCreated(projectType?: string): void {
  trackEvent('Project Created', {
    type: projectType || 'default',
  });
}

/**
 * 프로젝트 공유 이벤트
 */
export function trackProjectShared(platform: string): void {
  trackEvent('Project Shared', {
    platform,
  });
}

/**
 * AI 모델 선택 이벤트
 */
export function trackModelSelected(model: string): void {
  trackEvent('Model Selected', {
    model,
  });
}

/**
 * AI 채팅 메시지 전송
 */
export function trackChatMessage(messageType: 'user' | 'assistant'): void {
  trackEvent('Chat Message', {
    type: messageType,
  });
}

/**
 * 에러 추적
 */
export function trackError(errorType: string, errorMessage?: string): void {
  const props: AmplitudeEventProps = { errorType };
  if (errorMessage) {
    props.message = errorMessage;
  }
  trackEvent('Error', props);
}

/**
 * CTA 클릭 추적
 */
export function trackCTAClick(ctaName: string, location: string): void {
  trackEvent('CTA Click', {
    name: ctaName,
    location,
  });
}

/**
 * 기능 사용 추적
 */
export function trackFeatureUsed(featureName: string): void {
  trackEvent('Feature Used', {
    feature: featureName,
  });
}

/**
 * 페이지 뷰 추적
 */
export function trackPageView(url?: string): void {
  if (typeof window === 'undefined' || !isInitialized) {
    return;
  }

  const pageUrl = url || window.location.pathname;
  amplitude.track('Page View', { path: pageUrl });
}

/**
 * UTM 파라미터 타입
 */
export interface UTMParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  first_visit?: string;
}

/**
 * UTM 파라미터를 localStorage에 저장
 */
export function saveUTMParameters(): UTMParameters | null {
  if (typeof window === 'undefined') return null;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    const utmTerm = urlParams.get('utm_term');
    const utmContent = urlParams.get('utm_content');
    const referrer = document.referrer;

    // Only save if we have at least one UTM parameter or a referrer
    if (utmSource || utmMedium || utmCampaign || utmTerm || utmContent || referrer) {
      const existingUTM = localStorage.getItem('utm_params');

      // Only save if this is the first visit or if we don't have UTM data
      if (!existingUTM) {
        const utmData: UTMParameters = {
          landing_page: window.location.pathname + window.location.search,
          first_visit: new Date().toISOString(),
        };

        if (utmSource) utmData.utm_source = utmSource;
        if (utmMedium) utmData.utm_medium = utmMedium;
        if (utmCampaign) utmData.utm_campaign = utmCampaign;
        if (utmTerm) utmData.utm_term = utmTerm;
        if (utmContent) utmData.utm_content = utmContent;
        if (referrer) utmData.referrer = referrer;

        localStorage.setItem('utm_params', JSON.stringify(utmData));
        return utmData;
      }
    }

    return null;
  } catch (error) {
    console.error('Error saving UTM parameters:', error);
    return null;
  }
}

/**
 * localStorage에서 UTM 파라미터 가져오기
 */
export function getUTMParameters(): UTMParameters | null {
  if (typeof window === 'undefined') return null;

  try {
    const utmData = localStorage.getItem('utm_params');
    return utmData ? JSON.parse(utmData) : null;
  } catch (error) {
    console.error('Error getting UTM parameters:', error);
    return null;
  }
}

/**
 * UTM 파라미터 삭제
 */
export function clearUTMParameters(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('utm_params');
  } catch (error) {
    console.error('Error clearing UTM parameters:', error);
  }
}

/**
 * 유입 경로 추적 및 저장
 */
export function trackReferrer(): void {
  if (typeof window === 'undefined') return;

  // Save UTM parameters to localStorage for later attribution
  const savedUTM = saveUTMParameters();

  // Track the traffic source event
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source');
  const utmMedium = urlParams.get('utm_medium');
  const utmCampaign = urlParams.get('utm_campaign');
  const utmTerm = urlParams.get('utm_term');
  const utmContent = urlParams.get('utm_content');
  const referrer = document.referrer;

  if (utmSource || referrer) {
    const props: AmplitudeEventProps = {};

    if (utmSource) props.utm_source = utmSource;
    if (utmMedium) props.utm_medium = utmMedium;
    if (utmCampaign) props.utm_campaign = utmCampaign;
    if (utmTerm) props.utm_term = utmTerm;
    if (utmContent) props.utm_content = utmContent;
    if (referrer) props.referrer = referrer;

    trackEvent('Traffic Source', props);
  }
}

/**
 * AI 프로바이더 선택 이벤트
 */
export function trackProviderSelected(provider: string, isFirstTime: boolean): void {
  trackEvent('AI Provider Selected', {
    provider,
    isFirstTime,
  });
}

/**
 * Pro Plan Modal 조회 이벤트
 */
export function trackProPlanModalViewed(
  feature: string,
  location: string
): void {
  trackEvent('Pro Plan Modal Viewed', {
    feature,
    location,
  });
}

/**
 * Pro Plan 업그레이드 이벤트
 */
export function trackProPlanUpgraded(source: string): void {
  trackEvent('Pro Plan Upgraded', {
    source,
  });
}

/**
 * Pro Plan Modal 닫기 이벤트
 */
export function trackProPlanModalDismissed(
  feature: string,
  location: string
): void {
  trackEvent('Pro Plan Modal Dismissed', {
    feature,
    location,
  });
}

/**
 * Build Settings 상호작용 이벤트
 */
export function trackBuildSettingToggled(
  setting: string,
  enabled: boolean,
  requiresPro: boolean
): void {
  trackEvent('Build Setting Toggled', {
    setting,
    enabled,
    requiresPro,
  });
}

/**
 * Project Published 이벤트
 */
export function trackProjectPublished(
  projectId: string,
  subdomainName: string,
  isFirstPublish: boolean
): void {
  trackEvent('Project Published', {
    projectId,
    subdomainName,
    isFirstPublish,
  });
}

/**
 * Project Publish Updated 이벤트
 */
export function trackProjectPublishUpdated(
  projectId: string,
  subdomainName: string
): void {
  trackEvent('Project Publish Updated', {
    projectId,
    subdomainName,
  });
}

/**
 * 로그아웃 이벤트
 */
export function trackLogout(): void {
  trackEvent('Logout', {});
}

/**
 * GitHub 계정 연결 이벤트
 */
export function trackGitHubConnected(success: boolean): void {
  trackEvent('GitHub Account Connected', {
    success,
  });
}

/**
 * GitHub 프로젝트 연결 이벤트
 */
export function trackGitHubProjectConnected(projectId: string, repoName?: string): void {
  const props: AmplitudeEventProps = { projectId };
  if (repoName) {
    props.repoName = repoName;
  }
  trackEvent('GitHub Project Connected', props);
}

/**
 * Supabase 계정 연결 이벤트
 */
export function trackSupabaseConnected(success: boolean): void {
  trackEvent('Supabase Account Connected', {
    success,
  });
}

/**
 * Supabase 프로젝트 연결 이벤트
 */
export function trackSupabaseProjectConnected(projectId: string, supabaseProjectId?: string): void {
  const props: AmplitudeEventProps = { projectId };
  if (supabaseProjectId) {
    props.supabaseProjectId = supabaseProjectId;
  }
  trackEvent('Supabase Project Connected', props);
}

/**
 * Appearance 설정 변경 이벤트
 */
export function trackAppearanceChanged(setting: string, value: string | boolean): void {
  trackEvent('Appearance Setting Changed', {
    setting,
    value: String(value),
  });
}
