(() => {
  let searchInterval = null;
  let isRunning = false;

  console.log("[룰렛 자동화] Content script 로드됨");

  // DOM 준비 후 실행
  function init() {
    console.log("[룰렛 자동화] 초기화 시작");

    // 저장된 상태 확인
    chrome.storage.local.get(
      ["isRunning", "targetDiscount", "attemptCount"],
      (result) => {
        console.log("[룰렛 자동화] 저장된 상태:", result);

        if (result.isRunning) {
          isRunning = true;
          // 약간의 딜레이 후 루프 시작 (페이지 완전 로드 대기)
          setTimeout(() => {
            startRouletteLoop(result.targetDiscount, result.attemptCount || 0);
          }, 1500);
        }
      },
    );
  }

  // 페이지 로드 상태에 따라 초기화
  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }

  // 메시지 수신 대기
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[룰렛 자동화] 메시지 수신:", message);

    if (message.action === "start") {
      clearStorageAndReload();
    } else if (message.action === "stop") {
      stopLoop();
    }
    sendResponse({ received: true });
  });

  // 스토리지 클리어 후 새로고침
  function clearStorageAndReload() {
    console.log("[룰렛 자동화] 스토리지 클리어 및 새로고침");
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
  }

  // 루프 중지
  function stopLoop() {
    console.log("[룰렛 자동화] 루프 중지");
    isRunning = false;
    if (searchInterval) {
      clearInterval(searchInterval);
      searchInterval = null;
    }
  }

  // 룰렛 자동화 루프 시작
  function startRouletteLoop(targetDiscount, currentAttempt) {
    let hasClicked = false;
    let attemptCount = currentAttempt;

    console.log(
      "[룰렛 자동화] 루프 시작 - 목표:",
      targetDiscount,
      "%, 현재 시도:",
      attemptCount,
    );
    updateStatus("룰렛 버튼 탐색 중...");

    // 매초마다 룰렛 버튼 검색
    searchInterval = setInterval(() => {
      if (!isRunning) {
        clearInterval(searchInterval);
        return;
      }

      if (hasClicked) return;

      // '100% 당첨! 룰렛 돌리기' 텍스트를 가진 요소 찾기
      const rouletteButton = findElementByText("100% 당첨! 룰렛 돌리기");

      if (rouletteButton) {
        hasClicked = true;
        attemptCount++;

        chrome.storage.local.set({ attemptCount });
        updateStatus(`${attemptCount}번째 시도 - 룰렛 클릭!`);
        console.log("[룰렛 자동화] 버튼 찾음, 클릭 실행");

        // 버튼 클릭
        rouletteButton.click();

        // 6초 후 결과 확인
        setTimeout(() => {
          checkCouponResult(targetDiscount, attemptCount);
        }, 6000);
      } else {
        console.log("[룰렛 자동화] 버튼 탐색 중...");
      }
    }, 1000);
  }

  // 텍스트로 요소 찾기
  function findElementByText(searchText) {
    // 방법 1: XPath로 텍스트 검색
    try {
      const xpath = `//*[contains(text(), '${searchText}')]`;
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      );
      if (result.singleNodeValue) {
        return result.singleNodeValue;
      }
    } catch (e) {
      console.log("[룰렛 자동화] XPath 검색 실패:", e);
    }

    // 방법 2: 모든 요소 순회
    const allElements = document.querySelectorAll("*");
    for (const el of allElements) {
      // innerText 확인
      if (el.innerText && el.innerText.includes(searchText)) {
        // 가장 구체적인 요소 찾기 (자식 중에서)
        let target = el;
        const children = el.querySelectorAll("*");
        for (const child of children) {
          if (child.innerText && child.innerText.includes(searchText)) {
            if (child.innerText.length <= el.innerText.length) {
              target = child;
            }
          }
        }
        return target;
      }
    }

    // 방법 3: textContent로 검색
    for (const el of allElements) {
      if (el.textContent && el.textContent.includes(searchText)) {
        // 클릭 가능한 요소인지 확인
        if (
          el.tagName === "BUTTON" ||
          el.tagName === "A" ||
          el.onclick ||
          el.getAttribute("role") === "button" ||
          el.style.cursor === "pointer"
        ) {
          return el;
        }
      }
    }

    return null;
  }

  // 쿠폰 결과 확인
  function checkCouponResult(targetDiscount, attemptCount) {
    if (!isRunning) return;

    console.log("[룰렛 자동화] 쿠폰 결과 확인 중...");

    // 페이지에서 'X% 쿠폰 당첨' 패턴 찾기
    const pageText = document.body.innerText;
    console.log(
      "[룰렛 자동화] 페이지 텍스트 일부:",
      pageText.substring(0, 500),
    );

    // 여러 패턴 시도
    const patterns = [/(\d+)\s*%\s*쿠폰\s*당첨을/];

    let match = null;
    for (const pattern of patterns) {
      match = pageText.match(pattern);
      if (match) {
        console.log("[룰렛 자동화] 매칭된 패턴:", pattern, "결과:", match[0]);
        break;
      }
    }

    if (match) {
      const foundDiscount = parseInt(match[1], 10);
      console.log("[룰렛 자동화] 쿠폰 발견:", foundDiscount, "%");
      updateStatus(`${foundDiscount}% 쿠폰 발견!`);

      if (foundDiscount >= targetDiscount) {
        // 목표 달성!
        console.log("[룰렛 자동화] 목표 달성!");
        isRunning = false;
        chrome.storage.local.set({
          isRunning: false,
          statusMessage: `🎉 성공! ${foundDiscount}% 쿠폰 획득 (${attemptCount}회 시도)`,
        });

        // 알림
        alert(
          `🎉 목표 달성!\n${foundDiscount}% 쿠폰을 획득했습니다!\n(총 ${attemptCount}회 시도)`,
        );
      } else {
        // 목표 미달 - 다시 시도
        console.log("[룰렛 자동화] 목표 미달, 재시도 예정");
        updateStatus(
          `${foundDiscount}% < ${targetDiscount}% (목표) - 재시도...`,
        );

        setTimeout(() => {
          clearStorageAndReload();
        }, 1000);
      }
    } else {
      // 쿠폰을 찾지 못함 - 다시 시도
      console.log("[룰렛 자동화] 쿠폰 패턴을 찾지 못함");
      updateStatus("쿠폰을 찾지 못함 - 재시도...");

      setTimeout(() => {
        clearStorageAndReload();
      }, 1000);
    }
  }

  // 상태 업데이트
  function updateStatus(message) {
    chrome.storage.local.set({ statusMessage: message });
    console.log("[룰렛 자동화]", message);
  }
})();
