(function () {
  'use strict';
  // Explicit reading transitions only. No movement on boot, disclosures,
  // same-screen inputs, unchanged decisions, failures or modal confirmations.
  function readingKey() {
    const card = document.getElementById('turn-card');
    return [card?.querySelector('.date')?.textContent, card?.querySelector('h2')?.textContent, !!document.getElementById('cash-allocation-confirm'), !!document.getElementById('cash-reserve-confirm'), !!document.getElementById('career-cycle-confirm'), !!document.getElementById('order-reduce-confirm')].join('|');
  }
  let pendingSchoolReading = false;
  function showReadingStart() {
    if (document.getElementById('by') || window.__returnStorageHalted || document.querySelector('.storage-failure, .confirm-overlay') || document.querySelector('main')?.inert) return;
    const card = document.getElementById('turn-card');
    const heading = card?.querySelector('h2');
    if (!heading || !document.querySelector('#choices > button:not(:disabled)')) return;
    const chapter = document.getElementById('vn-first-chapter');
    const result = !['상품 선택', '비중 결정', '여기까지 진행됩니다', '이 대기 주문만 취소할까', '이 매수 예약금 일부만 풀기', '서울 대표 주택 한 채 매수', '서울 대표 주택 한 채 매도', '경기 대표 주택 한 채 매수', '경기 대표 주택 한 채 매도', '주택 게임 계약을 취소할까요?', '남은 주문의 가격조건 바꾸기', '이 남은 주문만 바꿀까', '남은 주문의 기한만 바꿀까', '한 상품에 모을까, 두 상품에 나눌까', '기존 적립 예약금을 현금으로 돌릴까', '투자 전에 현금을 얼마나 남길까', '수입을 다시 쌓을까, 투자 시간을 확보할까'].includes(heading.textContent) && document.querySelector('#unlock-area .unlock-banner');
    const target = chapter || result || heading;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    (chapter || result || card).scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function finishSchoolReading() {
    if (!pendingSchoolReading) return;
    if (window.__returnStorageHalted || document.querySelector('.storage-failure, #school-progress-save-error')) {
      pendingSchoolReading = false;
      return;
    }
    if (document.querySelector('main')?.inert || !document.getElementById('school-progress-result')) return;
    pendingSchoolReading = false;
    requestAnimationFrame(showReadingStart);
  }
  document.addEventListener('click', function (event) {
    const button = event.target.closest && event.target.closest('button, #dash-link');
    if (!button || button.disabled) return;
    if (button.id === 'school-progress') {
      pendingSchoolReading = true;
      return;
    }
    const dashboardTitle = document.querySelector('#turn-card h2')?.textContent;
    const dashboardEntry = ['dash-link', 'previous-life-review'].includes(button.id);
    const dashboardBack = dashboardTitle === '회귀 대시보드' && button.parentElement?.id === 'choices' && button.textContent === '돌아가기';
    if (dashboardEntry || dashboardBack) {
      requestAnimationFrame(function () {
        if (window.__returnStorageHalted || document.querySelector('.storage-failure, .confirm-overlay') || document.querySelector('main')?.inert) return;
        const card = document.getElementById('turn-card');
        const heading = card?.querySelector('h2');
        if (!heading || (dashboardEntry ? heading.textContent !== '회귀 대시보드' : heading.textContent === '회귀 대시보드')) return;
        if (dashboardEntry || document.getElementById('by')) {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
          card.scrollIntoView({ block: 'start', behavior: 'instant' });
        } else showReadingStart();
      });
      return;
    }
    const priorChapter = document.getElementById('vn-first-chapter');
    const chapterControl = button.id === 'vn-chapter-next' || button.id === 'vn-chapter-skip';
    const firstCareer = ['고1, 시간을 어디에 쓸까', '재학 중 시간 배분 방침을 정한다'].includes(document.querySelector('#turn-card h2')?.textContent);
    const skipPreview = document.querySelector('#turn-card h2')?.textContent === '여기까지 진행됩니다';
    const ordinaryChoice = button.parentElement?.id === 'choices' && (firstCareer || /^(유지|다음 달로 진입|건너뛰기|다음 뉴스까지 건너뛰기)/.test(button.textContent) || (skipPreview && /^(\d+개월 건너뛰기 실행|취소 \(돌아가기\))$/.test(button.textContent)));
    const positionTransition = button.parentElement?.id === 'choices' && (['상품 선택', '비중 결정'].includes(document.querySelector('#turn-card h2')?.textContent) || ['리밸런싱 (비중 조정)', '이 뉴스에 대응해 포지션 조정'].includes(button.textContent));
    const cancellationTransition = button.classList.contains('single-order-cancel-open') || ['single-order-cancel-back', 'single-order-cancel-confirm', 'job-reservations-cancel-open', 'job-reservations-cancel-back', 'job-reservations-cancel-confirm'].includes(button.id);
    const propertyTransition = button.hasAttribute('data-property-region') || button.hasAttribute('data-property-cancel') || ['property-contract-confirm', 'property-cancel-confirm'].includes(button.id) || (button.parentElement?.id === 'choices' && /^(계약하지 않고 돌아가기|계약 유지)$/.test(button.textContent));
    const reductionTransition = button.classList.contains('order-reduce-open') || button.classList.contains('order-reduce-percent') || ['order-reduce-confirm', 'order-reduce-edit', 'order-reduce-back'].includes(button.id);
    const orderEditTransition = button.classList.contains('order-condition-open') || button.classList.contains('order-deadline-open') || ['order-condition-review', 'order-condition-back', 'order-condition-confirm', 'order-condition-edit', 'order-condition-confirm-back', 'order-deadline-back'].includes(button.id) || (button.parentElement?.id === 'choices' && button.hasAttribute('data-deadline-months'));
    const planTransition = ['job-plan-open', 'career-plan-shortcut', 'cash-allocation-confirm', 'cash-allocation-edit', 'cash-allocation-back', 'cash-reserve-open', 'cash-reserve-confirm', 'cash-reserve-review-back', 'cash-reserve-back', 'career-cycle-open', 'career-cycle-confirm', 'career-cycle-review-back', 'career-cycle-back'].includes(button.id) || (button.parentElement?.id === 'choices' && (button.hasAttribute('data-plan-percent') || button.hasAttribute('data-reserve-target') || button.hasAttribute('data-career-cycle')));
    const start = button.id === 'cash-main-start';
    if (!start && !ordinaryChoice && !chapterControl && !positionTransition && !cancellationTransition && !propertyTransition && !reductionTransition && !orderEditTransition && !planTransition) return;
    const previousKey = readingKey();
    requestAnimationFrame(function () {
      if (document.getElementById('by') || window.__returnStorageHalted || document.querySelector('.storage-failure, .confirm-overlay') || document.querySelector('main')?.inert) return;
      const card = document.getElementById('turn-card');
      const heading = card && card.querySelector('h2');
      const chapter = document.getElementById('vn-first-chapter');
      if (!heading || !document.querySelector('#choices > button:not(:disabled)')) return;
      if (chapterControl ? (!priorChapter || chapter) : (!start && previousKey === readingKey() && chapter === priorChapter)) return;
      showReadingStart();
    });
  }, true);
  function updateOrderWeightGuide() {
    const card = document.getElementById('turn-card');
    if (card?.querySelector('h2')?.textContent !== '비중 결정' || !/포지션 조정 2\/2/.test(card.querySelector('.date')?.textContent || '')) return;
    const slider = card.querySelector('input#w[type="range"]');
    const preview = card.querySelector('#order-liquidity-preview');
    const names = {
      'buy-reserve': '매수 예약에 쓸 현금 비중',
      'deposit': '예치할 현금 비중',
      'sell-lock': '매도 주문에 잠글 보유 수량 비중',
      'withdraw': '해지할 보유액 비중'
    };
    const name = names[preview?.dataset.kind];
    if (!slider || !name) return;
    let label = card.querySelector('#order-weight-label');
    if (!label) {
      label = document.createElement('label');
      label.id = 'order-weight-label';
      label.htmlFor = slider.id;
      slider.parentElement.before(label);
    }
    if (label.textContent !== name) label.textContent = name;
    slider.setAttribute('aria-valuetext', slider.value + '%');
  }
  function updateProductGuide() {
    const card = document.getElementById('turn-card');
    if (card?.querySelector('h2')?.textContent !== '상품 선택' || !/포지션 조정 1\/2/.test(card.querySelector('.date')?.textContent || '')) return;
    for (const button of document.querySelectorAll('#choices > button')) {
      if (button.dataset.productGuide === 'ready') continue;
      const originalText = button.textContent;
      const start = originalText.indexOf('Yahoo Finance의 실제 일별 Close를 사용합니다.');
      const end = originalText.indexOf(' · 시세 지점', start);
      if (!originalText.includes('ETF') || start < 0 || end < 0 || !originalText.includes('배당현금도 지급하지 않아 총수익률이 아닙니다.')) continue;
      button.dataset.productGuide = 'ready';
      button.textContent = originalText.slice(0, start).trim() + originalText.slice(end);
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = '분할보정 단위이며 당시 1주의 원가격이 아닙니다. 배당 미지급으로 총수익률이 아니며, 가상 원화환산입니다. 실제 당시 체결가·거래비용·세금·가입자격을 재현하지 않습니다.';
      const detail = document.createElement('details');
      detail.className = 'choice-first-outlook product-price-detail';
      const summary = document.createElement('summary');
      summary.textContent = '가격 단위·분할·배당·체결 한계 원문';
      const original = document.createElement('p');
      original.textContent = originalText;
      detail.append(summary, original);
      button.after(note, detail);
    }
  }
  let activeConfirm = null;
  let confirmOpener = null;
  function updateConfirmFocus() {
    const modal = document.querySelector('.confirm-overlay');
    if (modal === activeConfirm) return;
    if (modal) {
      confirmOpener = document.activeElement;
      activeConfirm = modal;
      modal.setAttribute('aria-label', '선택 확인');
      const message = modal.querySelector('.confirm-card p');
      if (message) {
        message.id = 'return-confirm-message';
        modal.setAttribute('aria-describedby', message.id);
      }
      modal.querySelector('.confirm-cancel')?.focus({ preventScroll: true });
    } else {
      activeConfirm = null;
      const target = confirmOpener?.isConnected && !confirmOpener.disabled ? confirmOpener : document.querySelector('#turn-card h2');
      confirmOpener = null;
      if (target) {
        if (target.tagName === 'H2') target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }
  }
  document.addEventListener('keydown', function (event) {
    const modal = document.querySelector('.confirm-overlay');
    if (!modal || !['Tab', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const cancel = modal.querySelector('.confirm-cancel');
    if (event.key === 'Escape') { cancel?.click(); return; }
    const buttons = Array.from(modal.querySelectorAll('button:not(:disabled)'));
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement);
    const next = index < 0 ? buttons.indexOf(cancel) : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    buttons[Math.max(0, next)].focus({ preventScroll: true });
  }, true);
  function updatePortfolioActions() {
    for (const id of ['dash-link', 'voluntary-end-open', 'living-scenario-open']) {
      const original = document.getElementById(id);
      if (original?.tagName !== 'SPAN' || typeof original.onclick !== 'function') continue;
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.textContent = original.textContent;
      button.className = 'portfolio-action-button';
      button.style.cssText = 'min-height:44px;min-width:44px;max-width:100%;padding:8px 10px;border:1px solid #a7b2aa;border-radius:7px;background:#f3f6f1;color:inherit;font:inherit;text-align:left;cursor:pointer;overflow-wrap:anywhere';
      button.onclick = original.onclick;
      original.replaceWith(button);
    }
  }
  function updateUsedDeferralGuide() {
    const card = document.getElementById('turn-card');
    if (card?.querySelector('h2')?.textContent !== '입영 통지서가 도착했다' || window.__returnStorageHalted) return;
    let saved;
    try { saved = JSON.parse(localStorage.getItem('regression-invest-school-calendar-save-v1')); } catch (_) { return; }
    if (saved?.flags?.deferredUsed !== true) return;
    const month = card.querySelector('.date')?.textContent?.slice(0, 7);
    if (month !== saved.month) return;
    const button = Array.from(document.querySelectorAll('#choices > button')).find(b => b.textContent.startsWith('1년 유예 [시험용 가정'));
    if (!button) return;
    button.disabled = true;
    button.textContent = '1년 유예 사용 완료 · 추가 유예 불가 [게임규칙]';
    if (!card.querySelector('.used-deferral-note')) {
      const note = document.createElement('p');
      note.className = 'note used-deferral-note';
      note.textContent = '이번 회귀의 1년 유예를 이미 사용했습니다. 입대 예정은 ' + saved.flags.enlistAt + ' 그대로이며 추가 유예는 할 수 없습니다. 실제 병역 유예 규정이 아닌 게임 안의 1회 선택입니다.';
      card.append(note);
    }
  }
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
  new MutationObserver(function () { updateChoiceGuide(); updateProductGuide(); updateUsedDeferralGuide(); updatePortfolioActions(); updateConfirmFocus(); updateOrderWeightGuide(); finishSchoolReading(); }).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['inert']});
  updateChoiceGuide();
  updateProductGuide();
  updateUsedDeferralGuide();
  updatePortfolioActions();
  updateConfirmFocus();
  updateOrderWeightGuide();
})();

(function () {
  'use strict';
  function indexNotice() {
    const target = document.getElementById('intro-details');
    if (!target || document.getElementById('yahoo-index-data-note')) return;
    const note = document.createElement('p');
    note.id = 'yahoo-index-data-note';
    note.append(document.createTextNode('신규 회귀의 국내 지수는 Yahoo Finance 일별 종가를 가상 지수상품 평가에 사용합니다(코스피1996-12-11~, 코스닥2000-10-16~). 이전 초기 관측과 기존 저장은 유지합니다. 실제 당시 펀드·ETF 가격이나 매수 경로가 아니며 분배금·보수·세금은 미반영입니다. 관측일+2달력일은 게임 게이트이고 최초공개시각은 미확인입니다. Yahoo의 재배포 제한 안내가 있으며 소유자가 위험을 수용한 반영일 뿐 제공자 허락은 확인되지 않았습니다. '));
    const link = document.createElement('a');
    link.href = '7-DATA-NOTICE.md';
    link.textContent = '출처·조건 자세히';
    note.append(link);
    target.append(note);
  }
  new MutationObserver(indexNotice).observe(document.documentElement, {childList: true, subtree: true});
  indexNotice();
})();

(function () {
  'use strict';
  // Display protection only. Read the engine's rendered scope, never storage or rules.
  const scope = '전체 위험 미산정: 분모가 확인되지 않은 보유·매도잠금 노출이 있습니다. 아래 수치는 알려진 부분만 계산하며, 0이나 감소 표시는 안전을 뜻하지 않습니다.';
  const noSafeClaim = text => text.replace(/12개월 가정 내 주의\s*70\s*미도달/g, '전체 위험의 주의·한계 도달 여부는 미산정');
  function protectChaosScope() {
    const unknown = Array.from(document.querySelectorAll('.market-share')).some(row => row.textContent.includes('산정 불가'));
    const rows = Array.from(document.querySelectorAll('.row'));
    const chaos = rows.find(row => row.firstElementChild?.textContent === '카오스' || row.firstElementChild?.textContent === '카오스 [알려진 부분]');
    if (unknown && chaos) {
      if (chaos.firstElementChild.textContent !== '카오스 [알려진 부분]') chaos.firstElementChild.textContent = '카오스 [알려진 부분]';
      if (!document.getElementById('chaos-incomplete-scope')) {
        const note = document.createElement('p');
        note.id = 'chaos-incomplete-scope';
        note.className = 'note';
        note.style.cssText = 'padding:10px;border-left:3px solid #9b6136;background:#fff8ef;overflow-wrap:anywhere;';
        note.textContent = scope;
        chaos.before(note);
      }
      const trajectory = rows.find(row => row.firstElementChild?.textContent.startsWith('보유 유지 시 궤적'));
      if (trajectory) {
        const label = '보유 유지 시 궤적 [알려진 부분만]';
        if (trajectory.firstElementChild.textContent !== label) trajectory.firstElementChild.textContent = label;
        const value = trajectory.lastElementChild;
        const revised = noSafeClaim(value.textContent);
        if (value.textContent !== revised) value.textContent = revised;
      }
    }
    const preview = document.getElementById('chaos-preview');
    if (preview) {
      const missingOrder = /산정 (보류|불가)/.test(preview.textContent);
      if (unknown || missingOrder) {
        const prefix = '전체 위험 미산정 · 알려진 부분만 계산. ';
        const revised = (preview.textContent.startsWith(prefix) ? '' : prefix) + noSafeClaim(preview.textContent);
        if (preview.textContent !== revised) preview.textContent = revised;
      }
    }
  }
  new MutationObserver(protectChaosScope).observe(document.documentElement, {childList: true, subtree: true, characterData: true});
  protectChaosScope();
})();

(function(){'use strict';let state;const GAME_END='2026-10',CCV={JOB_INCOME:1500000,ALBA_INCOME:200000,LIVING_ADULT:700000};const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const careerCycleActive=()=>state?.careerCycleRules===1&&state?.commonChaos?.policy==='l2-common-decision-v2';const militaryActive=()=>state.flags.militaryUntil&&state.month<state.flags.militaryUntil;const careerCashUnpaid=()=>state.cashEvents.rows.reduce((s,r)=>s+r.living+r.tuition-r.paid,0);const addMonths=(m,n)=>{const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)};
function careerQuarterBudget(){
 if(!careerCycleActive()||militaryActive()||state.flags.gameOver||state.month>=GAME_END)return null;
 const cash=state.cash,unpaid=careerCashUnpaid();if(![cash,unpaid,CCV.JOB_INCOME,CCV.ALBA_INCOME,CCV.LIVING_ADULT].every(v=>Number.isFinite(v)&&v>=0))return null;
 const months=[];for(let n=1;n<=3;n++){const m=addMonths(state.month,n);if(m>GAME_END)break;months.push(m);if([3,6,9,12].includes(Number(m.slice(5))))break;}if(!months.length)return null;
 const rows=['job','fulltime','alba'].map(track=>{const income=track==='job'?CCV.JOB_INCOME:track==='alba'?CCV.ALBA_INCOME:0,net=income-CCV.LIVING_ADULT,needed=Math.max(0,-net*months.length);let available=cash,added=0,firstShort=null;for(const m of months){available+=income;const paid=Math.min(available,CCV.LIVING_ADULT);available-=paid;added+=CCV.LIVING_ADULT-paid;if(paid<CCV.LIVING_ADULT&&!firstShort)firstShort=m;}return{track,income,living:CCV.LIVING_ADULT,net,needed,neededWithArrears:needed+unpaid,cashBeforeOtherActions:available,newUnpaid:added,firstShort};});
 return {from:state.month,to:months.at(-1),endsBeforeReview:![3,6,9,12].includes(Number(months.at(-1).slice(5))),months:months.length,cash,unpaid,rows};
}
function careerQuarterBudgetHtml(selected=null){
 const p=careerQuarterBudget();if(!p)return '';const names={job:'취업',fulltime:'전업 투자',alba:'알바 병행 투자'},won=v=>Math.round(v).toLocaleString()+'원';
 let html='<section id="career-quarter-budget" style="padding:14px;border:2px solid #70827a;border-radius:12px;margin:16px 0;background:#f3f8f4;color:#25312a"><h3 style="margin-top:0">'+(p.endsBeforeReview?'회귀 구간 끝까지 생활비를 버틸까':'다음 진로 판단까지 생활비를 버틸까')+'</h3><p>'+esc(p.from)+' → '+esc(p.to)+' · '+p.months+'개월의 기본 수입·생활비만 비교합니다. 지금 사용가능현금 '+won(p.cash)+'입니다. 보유자산 평가와 이미 잠긴 매수 예약금은 쓸 돈으로 더하지 않습니다.</p>';
 for(const r of p.rows){html+='<div class="career-budget-row" data-track="'+r.track+'" data-needed="'+r.needed+'" data-new-unpaid="'+r.newUnpaid+'" style="border-top:1px solid #c7d5cb;padding:10px 0"><strong>'+names[r.track]+(selected===r.track?' · 확정 전 검토':'')+'</strong><p style="margin:6px 0">추가 미납 없이 '+p.months+'개월 유지에 필요한 지금 현금 '+won(r.needed)+'. '+(r.firstShort?'현재 현금만으로는 '+esc(r.firstShort)+'부터 부족 · 이 기간 추가 미납 '+won(r.newUnpaid):'현재 현금으로 이 기간의 생활비는 충당 가능')+'.</p>'+(p.unpaid>0?'<p style="margin:6px 0">기존 미납 '+won(p.unpaid)+'까지 먼저 전액 갚고 유지하려면 지금 현금 '+won(r.neededWithArrears)+' 필요.</p>':'')+'</div>';}
 html+='<p class="note">기본 수입·생활비는 현재 게임의 고정 설계값입니다. 실제 잔고나 수익을 예측하지 않습니다. 추가 매매·주문 체결/취소·이자·자동배분·중간 상환은 제외했습니다. 진로 확정은 돈을 입금하거나 기존 미납을 자동 상환하지 않습니다. 미납은 실제 상환 전까지 새 매수 접수·체결을 막습니다.</p>';
 if(state.flags.career==='job'&&state.jobSavingsPlan?.percent)html+='<p class="note">현재 취업 자동배분이 켜져 있습니다. 위 비교는 배분 전 생활비 기준이므로 배분을 계속하면 사용가능현금은 더 적을 수 있습니다. 이 화면은 배분을 끄지 않습니다.</p>';
 html+='<p class="note">비교를 읽거나 다른 진로 검토를 열어도 월·자금·주문·저장은 바뀌지 않습니다. 진로는 아래 확정 버튼을 눌러야 바뀝니다.</p></section>';return html;
}

function show(){const card=document.getElementById('turn-card');if(card?.querySelector('h2')?.textContent==='수입을 다시 쌓을까, 투자 시간을 확보할까'&&!document.getElementById('career-quarter-budget')){try{state=JSON.parse(localStorage.getItem('regression-invest-school-calendar-save-v1'));const html=careerQuarterBudgetHtml();if(html){const d=document.createElement('div');d.innerHTML=html;const coverage=card.querySelector('.career-cycle-coverage');(coverage||card.lastElementChild).after(d.firstElementChild);}}catch(_){} }const p=document.getElementById('chaos-preview');if(p?.textContent.includes('[비공개 비교 후보] 공통 게임예산 T '))p.textContent=p.textContent.replace('[비공개 비교 후보] 공통 게임예산 T ','[공통 카오스 게임규칙] 게임예산 T ').replace('지역 묶음은 후보 가정. ','묶음은 게임설계값. ')}new MutationObserver(show).observe(document.documentElement,{childList:true,subtree:true,characterData:true});show();})();
(function(){'use strict';const titles={
"독일 통일, 두 체제의 통합이 시작되다":["큰 변화와 내 준비의 속도", "멀리서 제도가 바뀌어도 내 졸업과 취업 준비가 대신 끝나지는 않습니다. 지금의 학업·알바 방침과 생활자금 여유를 보고 다음 선택을 이어갑니다."],"남북한, 유엔에 각각 회원국으로 가입":["외교 뉴스와 생활 계획은 구분", "긴장이 달라질 수 있다는 기대와 확정된 변화는 다릅니다. 뉴스만으로 앞으로의 수입을 늘려 잡지 않고 지금 선택 가능한 학업·알바와 현금·미납을 따로 확인합니다."],"금리자유화 1단계, 일부 상품부터 시행":["금리가 바뀌는 범위부터 확인", "금리자유화라는 제목만으로 내 예금 수익을 더해 잡을 수는 없습니다. 게임의 예금 조건은 별도로 확인하고, 학업·알바를 유지하는 데 필요한 현금과 미납을 먼저 구분합니다."],"소련 해체, 공화국들의 새 관계로 전환":["체제 변화와 오늘의 생계", "국가의 이름과 질서가 바뀌는 뉴스는 크지만 개인의 다음 수입을 보장하지 않습니다. 지금의 공부·일 방침과 확정된 현금·미납을 기준으로 생활 계획을 이어갑니다."],"한국과 중국, 대사급 외교관계 수립":["교류의 문과 내 진로", "교류 확대가 곧 나의 취업이나 수입 확정은 아닙니다. 앞으로 필요한 준비를 생각하되 현재의 학업·알바 선택과 생활비 제약 안에서 판단합니다."],"유럽공동체 단일시장 출범, 남은 장벽도 존재":["넓어진 시장에도 준비는 필요", "시장이 커진다는 뉴스가 내 급여나 일자리를 바로 정하지는 않습니다. 미래의 승리 업종을 찍는 대신 지금 할 수 있는 학업·알바와 생활자금 계획을 이어갑니다."],"북미자유무역협정 발효, 관세 인하는 단계적으로":["같은 무역 뉴스, 다른 적용 대상", "어느 나라끼리 맺은 협정인지부터 구분합니다. 한국 개인에게 새 상품이 열린 것으로 가정하지 않고 현재 가능한 진로·현금·미납 판단을 이어갑니다."],"개인연금 판매 시작, 중도해지 조건도 관심":["긴 저축과 당장의 생활비", "새 연금 상품이 소개됐지만 게임에 연금 가입 기능을 추가한 것은 아닙니다. 장기간 묶을 돈을 생각하기 전에 현재 현금·미납과 다음 학업·알바 방침부터 살펴봅니다."],"세계무역기구 출범, 협상 타결 뒤의 제도화":["합의 이후에도 적용을 확인", "협상 소식과 새 기구의 출범은 시점과 의미가 다릅니다. 큰 제도 변화를 내 수입 확정으로 옮기지 말고 지금의 진로 선택과 생활자금 계획을 이어갑니다."],"정부, 부동산실명제 도입 방안 발표":["계획 발표와 주거 결정", "집값의 상승·하락을 단정하는 신호가 아닙니다. 게임의 주택은 종전처럼 온전한 한 채를 소유하고 현금이 묶이는 선택입니다. 지금 생활자금과 미납을 먼저 확인합니다."],"고베 지진으로 항만 기능 타격, 한국도 운송 차질 우려":["재난을 수익의 정답으로 읽지 않기", "사람과 일터에 큰 피해가 난 사건입니다. 피해와 운송 차질을 이해하되 업종의 승패를 미리 정하지 않습니다. 내 선택은 현재의 학업·알바와 실제 생활자금 안에서 이어갑니다."],"베어링스 은행, 무단 거래 손실로 관리절차 신청":["알고 있는 손실과 모르는 손실", "평판보다 어떤 위험을 떠안는지 살펴야 합니다. 게임에 파생상품 거래를 여는 소식은 아닙니다. 지금 선택 가능한 진로와 현금·미납의 한도를 확인해 다음 판단을 준비합니다."],
"영국, 파운드의 유럽 환율제도 참여 중단":["제도의 약속과 내 생활의 여유", "나라가 지키던 환율 범위도 바뀔 수 있습니다. 그렇다고 지금 파운드 매매를 선택할 수 있는 것은 아닙니다. 현재 학업·알바 방침과 실제 현금·미납을 구분해 다음 판단을 준비합니다."],"우루과이라운드 협상 타결, 후속 절차는 남아":["큰 무역 합의와 오늘의 진로", "세계 무역의 제도 변화가 내 취업이나 수입을 즉시 보장하지는 않습니다. 뉴스를 읽은 뒤에도 지금 선택 가능한 진로와 생활자금의 제약은 그대로입니다. 미래의 승리 업종을 찍는 대신 다음 학업·알바 판단을 이어갑니다."],"중국, 이중 환율을 통합하는 외환제도 개편":["같은 중국 뉴스라도 투자 접근은 별개", "외환제도가 바뀌었다고 한국 개인에게 위안화나 중국 주식 거래가 바로 열리지는 않습니다. 상품접근 확인은 별도로 남겨 두고, 지금의 진로·현금·미납 안에서 다음 선택을 준비합니다."],
 '쿠웨이트 침공 뒤 유가 상승과 국제시장 불안 보도':['멀리서 온 불안과 지금의 준비','원유·금 가격의 움직임을 읽었다고 그 상품을 살 수 있는 것은 아닙니다. 현재 열려 있는 학업·알바 방침과 쓸 수 있는 현금을 먼저 나누어 봅니다. 이 시기에는 상품접근·시세 미확인으로 매매를 열지 않습니다.'],
 '미 연준, 재할인율을 4%에서 4.75%로 인상':['기사의 금리와 내 통장은 다르다','미국 정책금리 발표만으로 이 게임의 예금·채권 이자를 올려 받지는 않습니다. 이미 선택한 진로와 실제 들어온 수입·남은 현금을 확인한 뒤 현재 판단을 마칩니다.'],
 '미국, 외환안정기금을 통한 멕시코 금융지원 추진':['지원 소식과 내 생활자금','다른 나라의 지원 방침이 내 투자 손실이나 생활비를 대신해 주지는 않습니다. 지금 현금과 미납을 구분해 보고, 기존 진로에서 선택할 수 있는 다음 판단을 이어갑니다.']};
 function show(){const c=document.getElementById('turn-card'),v=titles[c?.querySelector('h2')?.textContent];if(!v||document.getElementById('early-news-life-context'))return;let s;try{s=JSON.parse(localStorage.getItem('regression-invest-school-calendar-save-v1'));}catch(_){return}if(!s||s.commonChaos?.policy!=='l2-common-decision-v2')return;const section=document.createElement('section');section.id='early-news-life-context';section.className='note';section.style.cssText='padding:12px;border-left:3px solid #70827a;background:#f3f8f4;color:#25312a;margin:14px 0';const h=document.createElement('h3');h.textContent=v[0];const p=document.createElement('p');p.textContent=v[1];const r=document.createElement('p'),unpaid=(s.cashEvents?.rows||[]).reduce((n,a)=>n+a.living+a.tuition-a.paid,0);const track=s.flags.militaryUntil&&s.month<s.flags.militaryUntil?'복무 중':s.flags.career==='job'?'취업':s.flags.recoveryJob==='alba'?'알바 병행':s.flags.career==='fulltime'?'전업 투자':s.flags.studyPath==='parttime'?'알바·전업 경로':s.flags.studyPath==='study'?'진학 경로':'진로 선택 전';r.textContent='이번 회귀 현재 기록 · '+track+' · 현금 '+s.cash.toLocaleString()+'원 · 미납 '+unpaid.toLocaleString()+'원. 이 설명은 저장을 읽기만 하며 수입·이자·학업·주문·날짜를 바꾸지 않습니다.';section.append(h,p,r);c.append(section);}new MutationObserver(show).observe(document.documentElement,{childList:true,subtree:true});show();})();
