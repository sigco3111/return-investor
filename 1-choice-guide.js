(function () {
  'use strict';
  // A new game replaces the long birth/rules form above the old scroll position.
  // Move once, only for an explicit successful main-start activation. Reopening a
  // saved game or expanding an explanation must not move the user's reading point.
  document.addEventListener('click', function (event) {
    const start = event.target.closest && event.target.closest('#cash-main-start');
    if (!start || start.disabled) return;
    requestAnimationFrame(function () {
      if (document.getElementById('by') || window.__returnStorageHalted || document.querySelector('.storage-failure, .confirm-overlay')) return;
      const card = document.getElementById('turn-card');
      const heading = card && card.querySelector('h2');
      if (!heading || !document.querySelector('#choices > button:not(:disabled)')) return;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      card.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }, true);
  function updateChoiceGuide() {
    const card = document.getElementById('turn-card');
    if (!card) return;
    const title = card.querySelector('h2');
    const intro = card.querySelector('h2 + p');
    if (title && title.textContent === '이 달에 연결된 뉴스가 없습니다' && document.querySelector('#choices #school-progress')) {
      const panel = card.querySelector('details.decision-panel');
      if (panel && panel.dataset.quietGuide !== 'ready') {
        panel.dataset.quietGuide = 'ready';
        const compact = document.createElement('div');
        compact.className = 'quiet-market-compact note';
        compact.setAttribute('aria-label', '시장 참고 요약과 자료 공백');
        for (const row of panel.querySelectorAll('.dp-market-row')) {
          const line = document.createElement('p');
          const name = row.querySelector('strong');
          if (!name) continue;
          line.textContent = name.textContent + (row.querySelector('p') ? ' / ' + row.querySelector('p').textContent : '');
          compact.append(line);
        }
        const caution = document.createElement('p');
        caution.textContent = '확보 지점 기준이며 현재 시세·체결가를 보장하지 않습니다. 비교 수치와 원래 설명은 아래에서 펼쳐 확인하세요.';
        compact.append(caution);
        const gap = panel.querySelector('.dp-market-gap');
        if (gap) {
          const warning = document.createElement('p');
          warning.className = 'dp-market-gap';
          warning.textContent = gap.textContent;
          compact.append(warning);
        }
        panel.before(compact);
        panel.querySelector('summary').textContent = '판단 참고 · 비교 수치와 전체 근거 펼치기';
        panel.open = false;
      }
    }
    if (!title || !intro || intro.dataset.choiceGuide === 'ready') return;
    if (title.textContent === '고1, 시간을 어디에 쓸까') {
      const note = card.querySelector('.choice-first-note');
      if (note) {
        note.textContent = '아래에서 첫 진로를 고르세요. 진학 루트는 다음 화면에서 학업 방침을 정합니다. 금액과 일정은 게임설계값이며 실제 급여·학비·입시를 뜻하지 않습니다.';
      }
      intro.dataset.choiceGuide = 'ready';
    }
    if (title.textContent === '이 달에 연결된 뉴스가 없습니다') {
      const choices = document.getElementById('choices');
      if (!choices || !choices.querySelector('#school-progress')) return;
      const originalText = intro.textContent;
      if (!originalText.includes('실제 시장이 조용했거나')) return;
      intro.dataset.choiceGuide = 'ready';
      intro.textContent = '이 달에 연결된 자료가 없다는 뜻이며, 실제 시장에 사건이 없었다는 뜻은 아닙니다. 한 번씩 진행하거나 기사·학교 갈림길까지 현재 방침으로 진행할 수 있습니다.';
      const detail = document.createElement('details');
      detail.className = 'quiet-progress-detail choice-first-outlook';
      const summary = document.createElement('summary');
      summary.textContent = '자료 공백과 진행 방법 안내';
      const original = document.createElement('p');
      original.textContent = originalText;
      const help = document.createElement('p');
      help.textContent = '유지와 다음 달로 진입은 모두 현재 판단을 마칩니다. 다음 뉴스까지 건너뛰기는 도착·지나칠 분기 정산 기회를 먼저 확인한 뒤 실행합니다. 현재 학교 방침 유지는 기존 유지 선택을 여러 달 실행하며 기사·갈림길·미납 증가·주문 변화에서 멈춥니다. 진행한 달의 수입·청구와 기존 주문은 그대로 반영됩니다.';
      detail.append(summary, original, help);
      intro.after(detail);
      for (const button of choices.querySelectorAll(':scope > button')) {
        if (button.textContent === '유지') button.textContent = '유지 - 현재 판단 마치기';
        if (button.textContent === '다음 달로 진입') button.textContent = '다음 달로 진입 - 한 번씩 진행';
      }
      return;
    }
    if (title.textContent !== '재학 중 시간 배분 방침을 정한다') return;
    const originalText = intro.textContent;
    // Only format the current deterministic-policy explanation, leaving other versions untouched.
    if (!originalText.includes('진학 기준 도달이 확정') || !originalText.includes('고3 3월')) return;
    intro.dataset.choiceGuide = 'ready';
    const rule = originalText.split('실제 학업')[0].trim();
    intro.textContent = '진학 경로를 골랐습니다. 이번에는 재학 중 시간 배분을 정합니다. ' + rule + ' 고3 3월에 한 번 다시 검토합니다. 실제 입시 예측이 아닌 게임규칙입니다.';
    const detail = document.createElement('details');
    detail.className = 'academic-choice-detail choice-first-outlook';
    const summary = document.createElement('summary');
    summary.textContent = '진학 기준 계산과 원래 설명 보기 [시험규칙]';
    const original = document.createElement('p');
    original.textContent = originalText;
    detail.append(summary, original);
    intro.after(detail);
  }
  new MutationObserver(updateChoiceGuide).observe(document.body, {childList: true, subtree: true});
  updateChoiceGuide();
})();
