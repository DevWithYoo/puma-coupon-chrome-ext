// 서비스 워커 - 상태 관리

// 익스텐션 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isRunning: false,
    targetDiscount: 30,
    attemptCount: 0,
    statusMessage: '대기 중'
  });
  console.log('[룰렛 자동화] 익스텐션 설치됨');
});

// 탭 업데이트 시 content script 상태 유지
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get(['isRunning'], (result) => {
      if (result.isRunning) {
        // 페이지 로드 완료 후 content script가 자동으로 상태를 확인하고 실행함
        console.log('[룰렛 자동화] 페이지 로드 완료 - 자동화 계속 실행 중');
      }
    });
  }
});

// 메시지 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getState') {
    chrome.storage.local.get(['isRunning', 'targetDiscount', 'attemptCount'], (result) => {
      sendResponse(result);
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});
