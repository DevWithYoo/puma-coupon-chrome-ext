document.addEventListener('DOMContentLoaded', () => {
  const targetDiscountInput = document.getElementById('targetDiscount');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusEl = document.getElementById('status');
  const attemptCountEl = document.getElementById('attemptCount');

  // 저장된 상태 불러오기
  chrome.storage.local.get(['isRunning', 'targetDiscount', 'attemptCount'], (result) => {
    if (result.targetDiscount) {
      targetDiscountInput.value = result.targetDiscount;
    }
    if (result.attemptCount) {
      attemptCountEl.textContent = result.attemptCount;
    }
    updateUI(result.isRunning || false);
  });

  // 상태 변경 감지
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.isRunning) {
        updateUI(changes.isRunning.newValue);
      }
      if (changes.attemptCount) {
        attemptCountEl.textContent = changes.attemptCount.newValue || 0;
      }
      if (changes.statusMessage) {
        statusEl.textContent = changes.statusMessage.newValue || '대기 중';
      }
    }
  });

  // UI 업데이트 함수
  function updateUI(isRunning) {
    if (isRunning) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      targetDiscountInput.disabled = true;
      statusEl.textContent = '실행 중...';
      statusEl.className = 'status running';
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      targetDiscountInput.disabled = false;
      statusEl.className = 'status';
      chrome.storage.local.get(['statusMessage'], (result) => {
        statusEl.textContent = result.statusMessage || '대기 중';
      });
    }
  }

  // 시작 버튼 클릭
  startBtn.addEventListener('click', async () => {
    const targetDiscount = parseInt(targetDiscountInput.value, 10);

    if (isNaN(targetDiscount) || targetDiscount < 1 || targetDiscount > 100) {
      alert('목표 할인율은 1~100 사이의 숫자를 입력해주세요.');
      return;
    }

    // 상태 저장
    await chrome.storage.local.set({
      isRunning: true,
      targetDiscount: targetDiscount,
      attemptCount: 0,
      statusMessage: '시작 중...'
    });

    // 현재 탭에서 직접 스크립트 실행 (스토리지 클리어 + 새로고침)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
          }
        });
      } catch (err) {
        console.error('스크립트 실행 실패:', err);
        // 실패 시 메시지 방식으로 폴백
        chrome.tabs.sendMessage(tab.id, { action: 'start', targetDiscount });
      }
    }
  });

  // 중지 버튼 클릭
  stopBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
      isRunning: false,
      statusMessage: '중지됨'
    });

    // 현재 탭에 메시지 전송
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      try {
        chrome.tabs.sendMessage(tab.id, { action: 'stop' });
      } catch (err) {
        console.error('메시지 전송 실패:', err);
      }
    }
  });
});
