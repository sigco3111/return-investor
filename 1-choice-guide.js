(function () {
  'use strict';
  function updateChoiceGuide() {
    const card = document.getElementById('turn-card');
    if (!card) return;
    const title = card.querySelector('h2');
    const intro = card.querySelector('h2 + p');
    if (!title || !intro || intro.dataset.choiceGuide === 'ready') return;
    if (title.textContent === '고1, 시간을 어디에 쓸까') {
      const note = card.querySelector('.choice-first-note');
      if (note) {
        note.textContent = '아래에서 첫 진로를 고르세요. 진학 루트는 다음 화면에서 학업 방침을 정합니다. 금액과 일정은 게임설계값이며 실제 급여·학비·입시를 뜻하지 않습니다.';
      }
      intro.dataset.choiceGuide = 'ready';
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
