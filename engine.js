/* 리턴: 회귀 투자자 — 시제품 엔진 v2 (제목 승인 완료 11-08)
   - 정적 웹 앱, 서버 없음. 데이터는 data/*.json 4분할.
   - 빈 시세 구간은 만들어 내지 않는다. 당시 서술과 회고 해설을 분리한다.
   - 매 턴 능동 선택 1개 이상: 유지/건너뛰기도 선택. 새 매매 강제 없음. */
(function () {
  const CASH_MODE = new URLSearchParams(location.search).get('economy') === 'cash-events-trial';
  const SCHOOL_MODE = new URLSearchParams(location.search).get('start') === 'school-calendar-trial';
  const SCHOOL_CASH_MODE = SCHOOL_MODE && CASH_MODE;
  const MODEL_ID = SCHOOL_CASH_MODE ? 'trial-school-cash-events-v1' : CASH_MODE ? 'trial-cash-events-v1' : 'trial-net-savings-v1';
  const SAVE_KEY = SCHOOL_CASH_MODE ? 'regression-invest-school-cash-save-v1' : SCHOOL_MODE ? 'regression-invest-school-calendar-save-v1' : CASH_MODE ? 'regression-invest-cash-events-save-v1' : 'regression-invest-save-v2';
  const LIVES_KEY = SCHOOL_CASH_MODE ? 'regression-invest-school-cash-lives-v1' : SCHOOL_MODE ? 'regression-invest-school-calendar-lives-v1' : CASH_MODE ? 'regression-invest-cash-events-lives-v1' : 'regression-invest-lives';

  // A denied storage read is not an absent save. Do not show a new-game form
  // or claim preservation when even the original bytes cannot be retrieved.
  const initialStorage = (() => {
    try {
      return { ok: true, legacy: localStorage.getItem('regression-invest-save-v1'),
        snapshot: ReturnEconomyPolicy.inspectRaw(localStorage.getItem(SAVE_KEY)),
        lives: readLivesRaw() };
    } catch (_) { return { ok: false, legacy: null, snapshot: { ok: false, exists: null, state: null } }; }
  })();
  const legacySave = initialStorage.legacy;
  const loadedSnapshot = initialStorage.snapshot;
  let state = (loadedSnapshot.ok && loadedSnapshot.exists ? loadedSnapshot.state : null) || {
    economyModel: ReturnEconomyPolicy.descriptor(MODEL_ID),
    assetReviewBaseline: { version: 1, source: 'new-game', month: '1996-03', totalAssets: 1000000 },
    ...(CASH_MODE ? {cashEvents:{version:1,tuitionIssued:false,rows:[]}} : {}),
    month: '1996-03',
    cash: 1000000,
    holdings: {},              // product -> {qty, avgPrice}
    unlocksSeen: [],
    eventIndex: 0,
    history: [],
    turnCount: 0,
    chaos: 0,                  // 규모 기반 카오스 누적치 [전부 설계 제안 — 경제 사실 아님]
    flags: {}                  // 진로 선택 결과 (defer_used 등)
  };

  let DATA = null;
  let storageWriteBlocked = false;
  let storageReadBlocked = false;
  let pending = null;          // {step, event, product} 주문 진행 상태
  // 턴 유효 관측일(YYYY-MM-DD). 뉴스·진로 턴은 이벤트 일자(월 정밀도면 그 달 1일), 평온 턴은 관측월 1일.
  // 이 날짜 이후의 가격 지점은 그 턴에서 보지 못한다(같은 달 미래 지점 차단 — 2026-06 턴에 2026-06-22 지점 미사용).
  let effDate = state.month + '-01';
  let effPostClose = false; // true면 턴 판단 시점이 '당일 장 마감 후'로 고정(당일 종가 지점 사용 가능)
  function turnEffDate(turn) {
    if (turn && turn.settlement) return {date:turn.observationDate,postClose:turn.observationPostClose};
    if (turn && turn.event && turn.event.date) {
      const d = turn.event.date;
      if (d.length === 10) return { date: d, postClose: true }; // 일 정밀도 뉴스·진로 턴: 장 마감 후 판단으로 고정
      return { date: d + '-01', postClose: false }; // 월 정밀도: 관측 시각 미정 → 보수적
    }
    return { date: state.month + '-01', postClose: false }; // 평온·결산 턴: 관측 시각 미정
  }

  async function boot() {
    if(SCHOOL_MODE)document.querySelector('header p').textContent=(SCHOOL_CASH_MODE?'고1 달력 + 현금사건 연결 시험 · 새 저장키 · 모든 금액 임의값':'고1 달력 시작 시험 · 생년월별 별도 저장 · 역사자료/생활경제/상품접근 고증 미완성');
    if (!initialStorage.ok) return showStorageReadUnavailable();
    const [baseEvents, prices, turns, unlocks, rates, schoolEvents] = await Promise.all([
      fetch('data/events.json').then(r => r.json()),
      fetch('data/prices.json').then(r => r.json()),
      fetch('data/turns.json').then(r => r.json()),
      fetch('data/unlocks.json').then(r => r.json()),
      fetch('data/rates.json').then(r => r.json()),
      SCHOOL_MODE ? fetch('data/early-school-news.json').then(r => {if(!r.ok)throw Error('School news unavailable');return r.json();}) : Promise.resolve([])
    ]);
    const events = baseEvents.concat(schoolEvents);
    events.sort((a, b) => a.date.localeCompare(b.date));
    prices.sort((a, b) => a.date.localeCompare(b.date));
    DATA = { events, prices, turns, unlocks, rates };
    if (!loadedSnapshot.ok) return showSaveConflict('저장 JSON 또는 기본 구조를 읽을 수 없어 진행하지 않았습니다. 새 게임으로 자동 대체하거나 원문을 덮어쓰지 않았어요.', 'save-shape');
    if (!ReturnEconomyPolicy.inspect(state, MODEL_ID).ok) return showEconomyConflict();
    if (DATA && !ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map(u=>u.product)).ok) return showSaveConflict('보유자산·대기주문·장부의 일부 저장 형식을 확인할 수 없어 멈췄습니다. 금액을 추정하거나 원문을 덮어쓰지 않았어요.', 'save-shape');
    if (loadedSnapshot.exists && SCHOOL_MODE && !validSchoolStart()) return showSaveConflict('고1 달력 시작 시험의 시작월·생월 근거를 확인할 수 없어 멈췄습니다. 기존 모형으로 추정 변환하거나 덮어쓰지 않았어요.', 'school-start');
    if (!loadedSnapshot.exists) {
      renderBirthSelect();
      if (legacySave) {
        const card = document.getElementById('turn-card');
        const note = document.createElement('p');
        note.style.cssText = 'font-size:12px;color:#8a6d3b;background:#fcf8e3;border:1px solid #e8dcc0;border-radius:6px;padding:6px 8px;margin-top:8px;';
        note.textContent = '이전 시연 저장이 있습니다. 진로 규칙 변경(고1 분기·졸업 기반 재분기)으로 호환되지 않아 새로 시작합니다. 이전 저장은 삭제하지 않고 보관돼 있어요.';
        card.appendChild(note);
      }
    } else if (restoreNewsCursor()) render();
  }

  // 생년/학제 연동: 2008학년도까지 취학 기준일 3월 1일 → 1·2월생은 전 해 출생아와 입학(빠른년생)
  // 근거: 정책브리핑·연합뉴스 (1차 기획 확인분). 3~12월생 고1 = 생년+16, 1·2월생 = 생년+15.
  function hsYear(birthYear, birthMonth) {
    if(SCHOOL_MODE){const c=ReturnSchoolCalendar.nominal(birthYear,birthMonth);if(!c.ok)throw Error('Unsupported school cohort');return c.highYear;}
    return birthMonth <= 2 ? birthYear + 15 : birthYear + 16;
  }
  function schoolStartMonth(){return SCHOOL_MODE&&state.schoolStart?state.schoolStart.startMonth:'1996-03';}
  function schoolDataGap(){return SCHOOL_MODE&&state.month<'1996-03';}
  function validSchoolStart(){
    const c=state.schoolStart,b=state.flags.birth,p=b&&ReturnSchoolCalendar.startPlan(b.year,b.month);
    return !!c&&Object.keys(c).sort().join(',')==='startMonth,version'&&c.version===1&&p?.ok&&b.hsYear===p.calendar.highYear&&c.startMonth===p.startMonth&&state.month>=c.startMonth&&state.month<='2026-11'&&state.assetReviewBaseline?.month===c.startMonth;
  }
  function schoolTrialNote(short=false){if(short)return '<p class="note school-trial-note">고1 달력 시작 시험 · 별도 저장 · 금액/진학/복무는 임의 시험가정.1996-03 전 매매 차단, 이후도 기존 희소자료 시연입니다. 실제 역사·생활경제 완성본이 아닙니다.</p>';return '<p class="note school-trial-note">별도 고1 달력 시작 시험 - 통상진급의 학년을 계산했으며 개인 학적·실제 개학일은 아닙니다.1996-03 전은 일부 선택 뉴스만 연결했고 상품접근·가격 근거가 부족해 매매를 막았습니다. 새 뉴스는 기존 진행을 되감아 재생하지 않아요. 1996-03 이후도 기존 희소·일부 미검증자료 시연입니다. 시작100만원과 경제·진학/복무 일정은 임의 시험가정이며1990년대 생활경제 고증이 아닙니다. 자산분해는 이 시작월을 아직 지원하지 않아 계산하지 않습니다. <a href="?">기존1996시작 회귀로 돌아가기</a></p>';}
  function renderBirthSelect() {
    vnScene('life');
    if(SCHOOL_MODE){document.querySelector('header p').textContent=(SCHOOL_CASH_MODE?'고1 달력 + 현금사건 연결 시험 · 새 저장키 · 모든 금액 임의값':'고1 달력 시작 시험 · 생년월별 별도 저장 · 역사자료/생활경제/상품접근 고증 미완성');}
    const card = document.getElementById('turn-card');
    const box = document.getElementById('choices');
    box.innerHTML = '';
    card.innerHTML = '<div class="date">회귀 시작</div><h2>주인공의 생년월</h2>' +
      (SCHOOL_MODE?'<p>생년월로 통상진급 고1 학년을 계산합니다. 옛 취학기준의1·2월생 동기 구분은2002년생까지 적용합니다.2009학년도부터의 변경은 별도로 계산하며, 개인의 유예·조기입학 이력을 확정하지 않습니다.</p>':'<p>생년월이 고1 시작 연도를 정합니다. 2008학년도까지 초등 취학 기준일이 3월 1일이라, 1·2월생은 전 해 출생아와 함께 1년 일찍 입학했어요(빠른년생, 2009학년도 폐지).</p>') +
      '<p><select id="by"></select> 년생 <select id="bm"></select> 월생</p>' +
      '<p class="note" id="birth-precision-note">일자는 받지 않는 월 단위 시연이에요. 정확한 생일에 따른 법정 나이·근로 자격을 판정하지 않아요.</p>' +
      '<p class="note" id="hs-preview"></p>' +
      (CASH_MODE ? '<div class="cash-model-intro"><h3>별도 현금사건 시험 회귀 [모든 금액 임의값]</h3><p>기존 저장·회귀기록과 다른 키에 새로 시작합니다. 기존 월 순저축은 적용하지 않아요. 시작100만원, 매월 생활 가상청구10만원(복무 중도 동일), 시험수입은 고교 알바·졸업취업 월30만원/그 외0원입니다. 최초 대학 재학월 진행에 학비 가상청구80만원을 한 번 냅니다. 실제 학교·급여·공제·학적규정이 아니에요.</p><p>수입은 월 진행 때 한 번 입금하고 청구를 선택 전에 보여줘요. 전액 납부 또는 명시 보류를 고릅니다. 부족하면 납부는 막고 미납을 남겨요. 보류는 학적연기나 채무면제를 뜻하지 않으며 이 시험에서는 재학 일정은 바꾸지 않아요. 미납은 총자산과 따로 표시하고 뒤에 다시 낼 수 있어요. 자동대출·매도·가족송금은 없어요. 전체 생계·장학·환급 모형이 아닌 최소연결 시험입니다.</p><label><input id="cash-consent" type="checkbox"> 이 임의 시험가정과 별도 저장으로 새 회귀 시작에 동의</label><p><a href="?">기존 시험순저축 회귀로 돌아가기</a></p></div>' : '<p><a id="cash-mode-entry" href="?economy=cash-events-trial">기존 저장을 그대로 두고 별도 현금사건 시험 회귀 보기</a></p>');
    if(SCHOOL_CASH_MODE)card.innerHTML+='<div class="school-cash-intro"><h3>고1 달력과 현금사건 연결 [모든 금액 임의값]</h3><p>기존 기본·현금·고1 모형의 여섯 저장키를 읽어 옮기거나 변환하지 않고 두 새 키에 시작합니다. 고1 선택월에는 청구가 없고 다음 달부터 수입·생활 가상청구를 한 번씩 만듭니다. 실제 역사 급여·학비·미성년 가입조건이나 복무규칙이 아닙니다.1996-03 전 매매차단은 그대로이며 현금이 있어도 해제되지 않습니다. 입대 선택월은 이미 생성한 현금사건을 다시 계산하지 않고 다음 월부터 복무 중 수입0원을 적용합니다. 아래 두 동의 모두 필요합니다.</p></div>';
    if(SCHOOL_MODE)card.innerHTML+=schoolTrialNote()+'<label><input id="school-consent" type="checkbox"> 이 자료공백·임의값·별도 저장으로 고1 달력 시험 시작에 동의</label>';
    else if(!CASH_MODE)card.innerHTML+='<p><a id="school-mode-entry" href="?start=school-calendar-trial">기존 저장을 그대로 두고 생년월별 고1 달력 시작 시험 보기</a></p>';
    if(!SCHOOL_CASH_MODE)card.innerHTML+='<p><a id="school-cash-mode-entry" href="?start=school-calendar-trial&amp;economy=cash-events-trial">기존 여섯 저장키를 그대로 두고 고1 달력+현금사건 연결 시험 보기</a></p>';
    const by = document.getElementById('by'), bm = document.getElementById('bm');
    for (let y = 1975; y <= (SCHOOL_MODE?2010:1985); y++) { const o = document.createElement('option'); o.value = y; o.textContent = y; if (y === 1980) o.selected = true; by.appendChild(o); }
    for (let m = 1; m <= 12; m++) { const o = document.createElement('option'); o.value = m; o.textContent = m; if (m === 3) o.selected = true; bm.appendChild(o); }
    const prev = document.getElementById('hs-preview');
    function upd() {
      const y = Number(by.value), m = Number(bm.value);
      const hs = hsYear(y, m);
      if(SCHOOL_MODE){const c=ReturnSchoolCalendar.startPlan(y,m);prev.textContent='통상진급 고1 학년도 시작 '+c.startMonth+' / 고교 마지막 학년 말 '+c.calendar.highEnd+' / 2026-10까지 달력 '+c.calendarMonthsInclusive+'개월 (시작월 뒤 월전이 '+c.monthlyTransitionsThroughEnd+'회). 취학유예·월반·휴학은 이 계산에 포함하지 않습니다.2002년1~2월생까지 예전 취학기준을 적용하며2003년생부터는 적용하지 않아요.';return;}
      prev.textContent = '고1 시작: ' + hs + '년' + (m <= 2 ? ' (빠른년생 적용 — ' + (y - 1) + '년생과 동기)' : '') +
        '. 고1 시작 분기(공부 vs 알바·전업투자), 진학 후 재분기(취업 vs 전업투자), 입대 일정이 이 생년에서 자동 산출돼요' +
        (hs < 1993 || hs > 2000 ? ' (일부 고1 일정이 시작월 1996-03 이전이라 생략되거나 시연용 이력 선택으로 대체돼요 [시연 제약])' : '.');
    }
    by.onchange = upd; bm.onchange = upd; upd();
    const go = document.createElement('button');
    go.textContent = SCHOOL_CASH_MODE?'고1 달력+현금사건 새 회귀 시작':SCHOOL_MODE?'이 생년월 고1부터 달력 시험':'이 생년월로 회귀';
    const consentReady=()=> (!SCHOOL_MODE||document.getElementById('school-consent').checked)&&(!CASH_MODE||document.getElementById('cash-consent').checked);
    if(SCHOOL_MODE||CASH_MODE){go.disabled=true;for(const id of ['school-consent','cash-consent']){const el=document.getElementById(id);if(el)el.onchange=()=>{go.disabled=!consentReady()}}}
    go.onclick = () => {
      if (!readLives()) return;
      if(CASH_MODE&&!document.getElementById('cash-consent').checked)return;
      if(SCHOOL_MODE&&!document.getElementById('school-consent').checked)return;
      const y = Number(by.value), m = Number(bm.value);
      if(SCHOOL_MODE){const p=ReturnSchoolCalendar.startPlan(y,m);if(!p.ok)return;state.month=p.startMonth;state.schoolStart={version:1,startMonth:p.startMonth};state.assetReviewBaseline={version:1,source:'new-game',month:p.startMonth,totalAssets:1000000};state.eventIndex=DATA.events.findIndex(e=>e.date.slice(0,7)>=p.startMonth);if(state.eventIndex<0)state.eventIndex=DATA.events.length;}
      state.flags.birth = { year: y, month: m, hsYear: hsYear(y, m) };
      save();
      render();
    };
    box.appendChild(go);
    document.getElementById('portfolio').innerHTML = '';
  }

  function readLivesRaw() {
    const raw = localStorage.getItem(LIVES_KEY);
    const log = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(log) || log.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Unavailable life archive');
    return log;
  }
  function readLives() {
    try { return readLivesRaw(); }
    catch (_) { storageReadBlocked = true; pending = null; showStorageReadUnavailable(); return null; }
  }

  function save() {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    if (!ReturnEconomyPolicy.inspect(state, MODEL_ID).ok) return showEconomyConflict();
    if (DATA && !ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map(u=>u.product)).ok) return showSaveConflict('보유자산·대기주문·장부의 일부 저장 형식을 확인할 수 없어 멈췄습니다. 금액을 추정하거나 원문을 덮어쓰지 않았어요.', 'save-shape');
    // Identify the existing trial rules only on an actual save; never recalculate old money.
    if (!Object.prototype.hasOwnProperty.call(state, 'economyModel')) state.economyModel = ReturnEconomyPolicy.descriptor(MODEL_ID);
    if(SCHOOL_MODE&&state.flags.birth&&!validSchoolStart())return showSaveConflict('고1 달력 시작 시험의 시작월·생월 근거를 확인할 수 없어 저장하지 않았습니다.', 'school-start');
    if (DATA) {
      const next = DATA.events[state.eventIndex];
      const prev = DATA.events[state.eventIndex - 1];
      state.newsCursor = { version: 1, nextId: next ? next.id : null, nextDate: next ? next.date : null,
        finishedThrough: prev ? prev.date : null,
        finishedOnIds: prev ? DATA.events.slice(0,state.eventIndex).filter(e=>e.date===prev.date).map(e=>e.id) : [] };
    }
    try {
      const raw = JSON.stringify(state);
      localStorage.setItem(SAVE_KEY, raw);
      if (localStorage.getItem(SAVE_KEY) !== raw) throw new Error('Save readback mismatch');
      return true;
    } catch (_) {
      storageWriteBlocked = true;
      pending = null;
      return showStorageWriteUnavailable();
    }
  }

  function showStorageWriteUnavailable() {
    document.getElementById('footnote').textContent = '저장 반영 미확인 · 추가 진행 중지';
    document.getElementById('unlock-area').innerHTML = '';
    const portfolio = document.getElementById('portfolio');
    portfolio.innerHTML = ''; portfolio.hidden = true;
    document.getElementById('turn-card').innerHTML = '<div class="date">저장 반영 확인 필요</div><h2>진행을 저장했는지 확인할 수 없어 멈췄습니다</h2><p>저장 쓰기 또는 다시 읽기 확인에 실패했어요. 방금 선택·주문·월 진행이 저장됐다고 표시하지 않고, 추가 진행과 재시도를 멈췄습니다.</p><p>이 화면은 마지막 정상 저장이나 방금 변경의 보존을 보장하지 않아요. 브라우저 저장소 권한·용량을 확인한 뒤 다시 불러와 실제 저장 상태를 확인하세요. 저장되지 않은 변경은 사라질 수 있으며, 사이트 데이터를 지우면 기존 저장을 잃을 수 있어요.</p>';
    const box = document.getElementById('choices'); box.innerHTML = '';
    const reload = document.createElement('button'); reload.textContent = '저장 상태 다시 불러오기';
    reload.onclick = () => {
      if (confirm('저장되지 않은 변경은 사라질 수 있습니다. 저장소의 현재 상태를 다시 불러올까요?')) location.reload();
    };
    box.append(reload);
    return false;
  }

  function restoreNewsCursor() {
    const c = state.newsCursor;
    if (c && c.version === 1) {
      if (c.nextId) {
        const found = DATA.events.findIndex(e => e.id === c.nextId);
        if (found < 0) return showSaveConflict('저장된 다음 뉴스가 현재 데이터에 없습니다. 다른 뉴스로 자동 대체하지 않았어요.');
        if (c.nextDate && DATA.events[found].date !== c.nextDate)
          return showSaveConflict('저장된 다음 뉴스의 확인 날짜가 바뀌었습니다. 같은 ID만으로 진행 위치를 추측하지 않았어요.');
        state.eventIndex = found;
      } else {
        // 완료일에 새로 끼워진 뉴스는 완료 여부를 추측하지 않는다.
        const sameDay = DATA.events.filter(e=>e.date===c.finishedThrough);
        if (sameDay.some(e=>!Array.isArray(c.finishedOnIds) || !c.finishedOnIds.includes(e.id)))
          return showSaveConflict('마지막 완료일의 뉴스 구성이 바뀌어 완료 여부를 확인할 수 없습니다. 자동으로 이어 가지 않았어요.');
        // 이전 데이터의 마지막 뉴스까지 완료. 이후 추가된 미래 뉴스만 이어 간다.
        const found = DATA.events.findIndex(e => (!c.finishedThrough || e.date > c.finishedThrough) && e.date.slice(0, 7) >= state.month);
        state.eventIndex = found < 0 ? DATA.events.length : found;
      }
      return true;
    }
    if (!state.eventIndex && !state.turnCount) return true; // 아직 뉴스를 진행하지 않은 저장
    return showSaveConflict('이전 저장에는 뉴스 순서의 안정 ID가 없어 데이터 보충 후 같은 위치인지 확인할 수 없습니다. 자산·대기 주문을 바꾸거나 자동 체결하지 않았어요.');
  }

  function showStorageReadUnavailable() {
    document.getElementById('unlock-area').innerHTML = '';
    const portfolio = document.getElementById('portfolio');
    portfolio.innerHTML = ''; portfolio.hidden = true;
    document.getElementById('turn-card').innerHTML = '<div class="date">저장소 접근 확인 필요</div><h2>저장 내용을 읽을 수 없어 멈췄습니다</h2><p>브라우저 저장소에 접근할 수 없어 기존 저장의 유무와 원문을 확인하지 못했어요. 이 읽기 실패를 없는 저장으로 취급해 새 게임으로 대체하거나 원문을 덮어쓰고 지우지 않았습니다.</p><p>원문을 읽지 못했으므로 별도 보존이나 원본 파일 받기가 완료됐다는 뜻은 아니에요. 브라우저의 사이트 저장소 권한을 확인한 뒤 다시 불러오세요. 사이트 데이터를 지우면 기존 저장을 잃을 수 있어요.</p>';
    const box = document.getElementById('choices'); box.innerHTML = '';
    const retry = document.createElement('button'); retry.textContent = '권한 확인 후 다시 불러오기';
    retry.onclick = () => location.reload(); box.append(retry);
    return false;
  }

  function showEconomyConflict() {
    return showSaveConflict('이 저장의 생활경제 모형 또는 버전을 현재 시제품이 지원하지 않습니다. 기존 시험 순저축으로 바꾸거나 학비·현금·주문을 추정 반영하지 않았어요.', 'economy-model');
  }

  function showSaveConflict(reason, scope) {
    const raw = localStorage.getItem(SAVE_KEY);
    const key = SAVE_KEY + (scope === 'economy-model' ? '-preserved-before-economy-migration' : scope === 'save-shape' ? '-preserved-before-shape-recovery' : '-preserved-before-news-migration');
    function preserveExactRaw() {
      if (raw === null) return false;
      try {
        let target = key, suffix = 1;
        while (localStorage.getItem(target) !== null && localStorage.getItem(target) !== raw) {
          suffix += 1; target = key + '-' + suffix;
        }
        if (localStorage.getItem(target) === null) localStorage.setItem(target, raw);
        return localStorage.getItem(target) === raw;
      } catch (_) { return false; }
    }
    const preserved = preserveExactRaw();
    document.getElementById('unlock-area').innerHTML = '';
    document.getElementById('portfolio').innerHTML = '';
    document.getElementById('portfolio').hidden = true;
    document.getElementById('turn-card').innerHTML = '<div class="date">저장 호환 확인 필요</div><h2>' + (preserved ? '기존 저장을 보존했습니다' : '현재 저장을 유지하고 멈췄습니다') + '</h2><p>' + esc(reason) + '</p><p>원본 저장은 그대로 남아 있습니다. 새 회귀를 시작해도 별도 보존본은 지우지 않습니다.</p>';
    const box = document.getElementById('choices'); box.innerHTML = '';
    const exportBtn = document.createElement('button'); exportBtn.textContent = '원본 저장 파일 받기';
    exportBtn.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([raw], {type:'application/json'})); a.download = 'return-preserved-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
    const restartBtn = document.createElement('button'); restartBtn.textContent = '보존본을 남기고 새 회귀 시작';
    if (!preserved) {
      const note = document.createElement('p');
      note.textContent = '별도 보존본을 저장하지 못했습니다. 현재 원문은 지우지 않았어요. 먼저 원본 파일을 받아 보관하세요. 보존 확인 전에는 새 시작을 막습니다.';
      document.getElementById('turn-card').append(note);
      restartBtn.disabled = true;
    }
    restartBtn.onclick = () => {
      if (!preserveExactRaw()) { restartBtn.disabled = true; return; }
      if (!confirm('기존 저장의 보존본은 남기고 새 회귀를 시작할까요?')) return;
      if (localStorage.getItem(SAVE_KEY) !== raw || !preserveExactRaw()) {
        alert('저장 내용 또는 보존 상태가 바뀌어 새 시작을 멈췄습니다. 원본을 다시 확인하세요.'); return;
      }
      localStorage.removeItem(SAVE_KEY); location.reload();
    };
    box.append(exportBtn, restartBtn);
    return false;
  }

  function productAvailable(u) {
    // 월말을 앞당겨 쓰지 않는다. 현재 판단일 이전의 접근 경로만 신규 접수/체결에 쓴다.
    const cutoff = effDate && effDate.slice(0, 7) === state.month ? effDate : state.month + '-01';
    return !!u && (!u.available_from || u.available_from <= cutoff);
  }
  function unlockedProducts() {
    return DATA.unlocks.filter(productAvailable);
  }

  const DEMO_END = '2003-12'; // 시제품 데이터 구간 끝 (전체 게임 종료 2026-10과 별개)
  const GAME_END = '2026-10'; // 전체 게임 종료월 — 회귀 시점 직전까지 인생을 사는 구조 [1차 기획]
  function nextTurn() {
    if(CASH_MODE && state.cashEvents.rows.some(r=>r.status==='due'))return {kind:'cash-due'};
    if (state.flags.gameOver === 'chaos') return { kind: 'gameover' };
    const finalDeferred = DATA.events[state.eventIndex];
    const pendingFinalConfirmation = finalDeferred && finalDeferred.event_month && finalDeferred.event_month <= GAME_END && finalDeferred.date.slice(0,7) <= state.month;
    if (state.month > GAME_END && !state.flags.gameEndShown && !pendingFinalConfirmation) return { kind: 'natural-end' };
    if (!SCHOOL_MODE && state.month > DEMO_END && state.month <= GAME_END && !state.flags.demoEndShown) return { kind: 'demo-end' };
    if (state.flags.militaryUntil && state.month >= state.flags.militaryUntil && !state.flags.dischargeShown) {
      return { kind: 'discharge' };
    }
    // 진로·복무 이벤트는 생년/학제에서 동적 산출 (고1 = hsYear → 졸업·진로 hsYear+3년 2월, 대학 루트 입대 hsYear+5년 6월,
    // 취업 루트 입대 hsYear+3년 8월 [설계 제안 — 입대 시기는 개인 선택이라 시험용])
    const lev = nextLifeEvent();
    const ev = DATA.events[state.eventIndex];
    if (lev && (!ev || lev.date <= ev.date) && lev.date.slice(0, 7) <= state.month) return { kind: 'life', event: lev };
    if (ev && ev.date.slice(0, 7) <= state.month) return { kind: ev.kind || 'news', event: ev };
    if (settlementDue()) {
      const prev = DATA.events[state.eventIndex - 1];
      const date = prev && prev.date.slice(0,7) === state.month ? prev.date : state.month + '-01';
      return {kind:'quiet',settlement:true,observationDate:date.length===10?date:date+'-01',observationPostClose:date.length===10 && !!prev && prev.date===date};
    }
    return { kind: 'quiet' };
  }

  function nextLifeEvent() {
    const b = state.flags.birth;
    if (!b) return null;
    if (!state.flags.lifeDone) state.flags.lifeDone = {};
    const hs = b.hsYear;
    const done = state.flags.lifeDone;
    // 시제품 시작(1996-03) 이전에 지난 진로는 이미 지나간 것으로 생략 [시연 제약]
    // 1단 분기(고1): 공부·진학 vs 알바·전업투자
    if (!done.hs1) {
      const d = hs + '-03-02';
      if (d.slice(0, 7) < schoolStartMonth()) {
        // 시제품 시작 전에 고1 분기가 지난 생년. 2단 분기가 구간에 드는 생년(hsYear<=1994)은
        // 시연용 시나리오를 '선택지'로 제공 — 진로 이력을 자동 확정하지 않음 [시연 제약]
        if (hs <= 1994 && !state.flags.studyPath && !done.scenarioOffer) {
          return { _dynamic: true, id: 'life-scenario', date: '1996-03-01', kind: 'life',
            card_title: '회귀 시점의 진로 이력을 정합니다',
            card_summary: '선택한 생년은 1996년 이전에 고등학교에 진학했어요. 시제품 구간 안에서 졸업·취업 분기를 시연하려면 진학 루트로 시작하는 시연용 시나리오를 고를 수 있어요. 이것은 확정된 진로 이력이 아니라 시연용 가정이에요 [시연 제약].',
            impact_tags: [], unlock: null,
            choices: [
              { id: 'scenario-study', label: '시연용: 1996년 현재 대학 재학 중으로 시작 (진학 루트 가정)' },
              { id: 'scenario-plain', label: '일반 시작 — 진로 이력 미정 (졸업·취업 분기는 시제품 구간 밖)' }
            ] };
        }
        done.hs1 = true;
      }
      else return { _dynamic: true, id: 'life-hs1', date: d, kind: 'life',
        card_title: '고1, 시간을 어디에 쓸까',
        card_summary: '공부에 집중해 진학을 노리거나, 알바로 종잣돈을 모아 전업 투자의 길로 갈 수 있다. 진로마다 투자에 쓸 시간과 소득이 달라진다. (일정은 생년·학제에서 산출)',
        impact_tags: [], unlock: null,
        choices: [
          { id: 'study', label: '공부 집중 — 진학 루트 (졸업·취업 후 순저축 시험값)' },
          { id: 'parttime', label: '알바 병행 — 종잣돈을 모아 전업 투자 루트' }
        ] };
    }
    // 2단 분기(진학 루트): 졸업 시점에 취업 vs 전업투자 — 사용자 지정. 졸업은 재학 48개월 충족 시점이며
    // 복무 휴학 중에는 재학 개월이 멈춰 졸업이 늦어진다(상태 기반). 시제품 구간(2003-12) 안에 졸업이 안 오는
    // 생년·복무 조합은 구간 종료까지 2단 분기가 발생하지 않음 [시연 제약]
    if (!done.college && state.flags.studyPath === 'study') {
      if (state.flags.academicStatus === 'college' && (state.flags.enrolledMonths || 0) >= 48 && !militaryActive()) {
        return { _dynamic: true, id: 'life-grad', date: state.month + '-15', kind: 'life',
          card_title: '대학 졸업을 앞두고 진로를 정한다',
          card_summary: '취업할지, 전업 투자로 나설지 정한다. 복무 휴학으로 늦어진 경우 그만큼 뒤의 일정이에요. 취업을 고르면 다음 달부터 월 순저축을 더합니다 [시험용 설계값]. 실제 급여 수입과 지출을 나눠 계산하는 모형은 아직 없어요.',
          impact_tags: [], unlock: null,
          choices: [
            { id: 'job', label: '취업 — 다음 달부터 월 순저축 [시험값]' },
            { id: 'fulltime', label: '전업 투자 — 정기 순저축 없음 [생활비 미구현]' }
          ] };
      }
    }
    if (state.flags.studyPath === 'parttime') done.college = true; // 알바 루트는 2단 분기 없이 전업투자로
    if (!done.enlist && state.flags.enlistAt) {
      const d = state.flags.enlistAt + '-01';
      if (d.slice(0, 7) < schoolStartMonth()) done.enlist = true;
      else return { _dynamic: true, id: 'life-enlist', date: d, kind: 'life',
        card_title: '입영 통지서가 도착했다',
        card_summary: '입대 시점을 정해야 한다. 복무 중에는 시장 대응이 제한되고, 전역하면 그동안의 시장 흐름을 정리해 받는다.',
        impact_tags: [], unlock: null,
        choices: [
          { id: 'go-now', label: '바로 입대 (육군 가정 · 당시 규정 26개월)' },
          { id: 'defer-1y', label: '1년 유예 [시험용 가정 — 유예 규정 미검증]' }
        ] };
    }
    return null;
  }

  function priceAt(series, month) {
    // 현재 관측월이면 턴 유효일(effDate)까지의 지점만. 과거 월 조회는 월말까지.
    const isCurrent = effDate && month === effDate.slice(0, 7);
    const cutoff = isCurrent ? effDate : month + '-31';
    const pts = DATA.prices.filter(p => {
      if (p.series !== series) return false;
      if (p.uncertain) return false; // 날짜·값 미해결 충돌 지점: 원본은 파일에 보존하되 체결·평가의 가격 선택에서 격리
      if (p.unverified) return false; // 2차 단일 미러 지점: 독립 출처 대조 전까지 기본 가격 선택에서 제외(연구 자료로만 보존)
      if (p.usable_from) return p.usable_from <= cutoff; // date_precision 'year': 실제 거래일 미확인 — 보수적 이용가능일(익년 1/1)로 게이팅
      if (!isCurrent) return p.date <= cutoff;
      // 관측 시각 미정 턴(평온·월 정밀도)은 당일 종가를 알 수 없으므로 당일 지점 제외(익일부터). 장 마감 후 고정 턴만 당일 사용.
      return effPostClose ? p.date <= cutoff : p.date < cutoff;
    });
    return pts.length ? pts[pts.length - 1] : null;
  }
  function fmtPtDate(pt) {
    return pt && pt.date_precision === 'year' ? pt.date.slice(0, 4) + '년말(거래일 미확인)' : (pt ? pt.date : '');
  }

  function priceAgeNote(pt) {
    if (!pt) return '';
    if (pt.date_precision === 'year') return '연말 자료 · 실제 거래일 미확인 · 당일 거래가 아님';
    if (pt.date.length !== 10) return '월 단위 자료 · 실제 거래일 미확인 · 당일 거래가 아님';
    const d = Date.parse(pt.date + 'T00:00:00Z');
    const t = Date.parse(effDate + 'T00:00:00Z');
    const age = Math.round((t - d) / 86400000);
    return Number.isFinite(age) && age > 0 ? '판단일보다 ' + age + '일 앞선 자료 · 당일 거래가 아님' : '확보 지점이며 실제 거래가 보장은 아님';
  }

  // 상품별 체결·평가 규칙: accrual(이자 누적) / price(시세 지점) / unpriced(시세 미확보)
  function productRule(p) {
    const u = DATA.unlocks.find(x => x.product === p);
    return u || {};
  }
  function monthsBetween(a, b) {
    const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }
  function usindexUnit(month) {
    // fxprice 단가(원화) = 해외 지수 지점(달러) × 환율 지점(원/달러). 둘 다 현재 관측 규칙으로 확보된 것만.
    const sp = priceAt('sp500', month);
    const fx = priceAt('fx', month);
    return sp && fx ? sp.value * fx.value : null;
  }
  function holdingValue(p, h, month) {
    const r = productRule(p);
    if (r.rule === 'fxprice') {
      const u0 = usindexUnit(month);
      return u0 != null ? Math.round(u0 * h.qty) : Math.round(h.avgPrice * h.qty);
    }
    if (r.rule === 'accrual') {
      return Math.round(h.avgPrice * h.qty); // 이자는 advanceMonth에서 월 단위로 반영
    }
    if (r.rule === 'price' || r.rule === 'fxaccrual') {
      const pt = priceAt(r.series || p, month);
      return pt ? Math.round(pt.value * h.qty) : Math.round(h.avgPrice * h.qty); // 지점 없으면 투입가 표시
    }
    return Math.round(h.avgPrice * h.qty); // unpriced: 원금 표시
  }
  function holdingPricePoint(p, month) {
    const r = productRule(p);
    if (r.rule === 'fxprice') return priceAt(r.series || 'sp500', month);
    if (r.rule !== 'price' && r.rule !== 'fxaccrual') return null;
    return priceAt(r.series || p, month);
  }

  function addMonths(ym, n) {
    let [y, m] = ym.split('-').map(Number);
    m += n; while (m > 12) { m -= 12; y++; }
    return y + '-' + String(m).padStart(2, '0');
  }
  function militaryActive() {
    return state.flags.militaryUntil && state.month < state.flags.militaryUntil;
  }
  function settlementDue() {
    return state.flags.career === 'job' && isSettlementMonth() && state.flags.settledMonth !== state.month;
  }
  function isSettlementMonth() {
    return ['03', '06', '09', '12'].includes(state.month.slice(5));
  }
  // One permission rule feeds both labels and actual trade-entry handlers.
  function tradeAccess(turn) {
    if(schoolDataGap())return {allowed:false,label:'자료공백 구간 - 매매 차단 (1996-03 전)'};
    if (!turn || !['news','quiet'].includes(turn.kind)) return {allowed:false, label:'평가만 표시 · 이 화면에서는 주문하지 않음'};
    if (turn.kind === 'news') return state.flags.career === 'job'
      ? {allowed:false, label:'평가만 표시 · 뉴스 대응 주문 불가, 이후 정산 전용 턴에서 주문'}
      : {allowed:true, label:'뉴스 대응 주문 가능' + (militaryActive() ? ' · 복무 중 매수 비중 상한 30%' : '')};
    if (state.flags.career === 'job' && !turn.settlement) return {allowed:false, label:'평가만 표시 · 직장인은 정산 전용 턴에서 주문'};
    return {allowed:true, label:turn.settlement ? '정산 전용 턴 주문 가능' : '평온 턴 리밸런싱 가능' + (militaryActive() ? ' · 복무 중 매수 비중 상한 30%' : '')};
  }

  function totalAssets() {
    let t = state.cash;
    for (const [p, h] of Object.entries(state.holdings)) t += holdingValue(p, h, state.month);
    for (const o of (state.pendingOrders || [])) {
      if (o.kind === 'buy') t += o.amount; // 예약 잠금 현금은 자산에 포함
      else {
        const u = productRule(o.product);
        let unit = null;
        if (u.rule === 'fxprice') unit = usindexUnit(state.month);
        else { const pt = priceAt(u.series || o.product, state.month); unit = pt ? pt.value : null; }
        t += Math.round((unit != null ? unit : o.avgPrice) * o.qty); // 잠금 매도 수량 평가 포함
      }
    }
    return Math.round(t);
  }

  function vnScene(kind) {
    const stage = document.getElementById('vn-stage');
    if (!stage) return;
    stage.dataset.scene = kind === 'gameover' ? 'danger' : kind === 'life' ? 'life' : (state.chaos >= 70 ? 'danger' : 'news');
    const label = document.getElementById('vn-scene-label');
    if (label) label.textContent = '배경·스탠딩·대화창 분리 레이어 — 에셋은 생성 샘플 1차 (교실 1996·남학생 중립) [샘플 시연]';
  }

  function cashSummary() {
    const rows=state.cashEvents.rows;
    return {income:rows.reduce((v,r)=>v+r.income,0), paid:rows.reduce((v,r)=>v+r.paid,0),
      unpaid:rows.reduce((v,r)=>v+r.living+r.tuition-r.paid,0), months:rows.length, ...(state.cashAutomation?{automaticPaidMonths:state.cashAutomation.paidMonths.length}:{})};
  }
  function cashEndHtml() {
    if(!CASH_MODE)return '';
    const c=cashSummary();return '<p class="cash-ending-summary"><strong>미납 가상청구 '+c.unpaid.toLocaleString()+'원 / 미납차감 시연순자산 '+(totalAssets()-c.unpaid).toLocaleString()+'원</strong></p><p class="note">위 총자산은 미납 차감 전입니다. 보류한 비용이 면제된 것이 아니며 실제 진로우열이나 생계가능성 결과가 아닙니다.</p>';
  }
  function cashAutomationHtml() {
    const policy=state.cashAutomation, paid=policy?policy.paidMonths:[];
    return '<section class="cash-automation"><h4>생활 가상청구 처리 정책</h4><p class="note">현재 '+(policy&&policy.enabled?'켜짐':'꺼짐 · 직접 선택')+' / 자동납부 기록 '+paid.length+'개월. 켜면 다음 월부터 학비 없는 생활청구10만원만 사용가능현금이 충분할 때 자동납부합니다. 학비·현금부족·기존미납은 항상 직접 확인합니다. 예약금 사용·자동매도·대출은 없습니다. 원할 때 끌 수 있으며 켜고 끄는 것만으로 과거 청구나 현금은 바뀌지 않습니다.</p><button id="cash-auto-toggle" style="min-height:44px" '+(state.month>GAME_END?'disabled':'')+'>'+(policy&&policy.enabled?'생활청구 자동납부 끄기':'조건을 읽고 생활청구 자동납부 켜기')+'</button></section>';
  }
  function toggleCashAutomation() {
    if(storageWriteBlocked||storageReadBlocked||!CASH_MODE||state.month>GAME_END)return;
    const old=state.cashAutomation,enabled=!(old&&old.enabled);
    if(!confirm(enabled?'다음 월부터 학비 없는 생활가상청구10만원만 현금이 충분하면 자동납부할까요? 학비·현금부족·기존미납은 직접 확인하며 예약금·자동매도·대출을 쓰지 않습니다. 현재 청구는 바꾸지 않습니다.':'다음 월부터 생활가상청구 자동납부를 끌까요? 이미 납부한 청구와 현재 현금은 바꾸지 않습니다.'))return;
    if(storageWriteBlocked||storageReadBlocked)return;
    state.cashAutomation={version:1,enabled,enabledAfterMonth:state.month,paidMonths:old?old.paidMonths.slice():[]};
    state.history.push({month:state.month,decisionMonth:state.month,choice:'cash-policy:'+(enabled?'enable-living':'disable-living')});if(save())render();
  }
  function cashEventsHtml() {
    const c=cashSummary(), gross=totalAssets();
    return '<div class="cash-events-review"><h3>별도 현금사건 시험 v1 [임의값]</h3><p class="note">원래 월 순저축0/2만/10만원을 껐습니다. 시작100만원, 고교알바·졸업취업 월수입30만원/그 외·복무0원, 월생활 가상청구10만원(복무 포함), 최초 재학 월진행 학비가상청구80만원 한 번. 세금·장학·가족부담·실제학적효과는 없습니다.</p>' +
      '<div class="row"><span>기록된 월수입 · '+c.months+'개월</span><strong>+'+c.income.toLocaleString()+'원</strong></div>' +
      '<div class="row"><span>실제 선택한 가상납부</span><strong>-'+c.paid.toLocaleString()+'원</strong></div>' +
      '<div class="row"><span>미납 가상청구 · 현재청구 포함</span><strong>'+c.unpaid.toLocaleString()+'원</strong></div>' +
      '<div class="row"><span>총자산(미납 차감 전)</span><strong>'+gross.toLocaleString()+'원</strong></div>' +
      '<div class="row"><span>미납 차감 시연순자산</span><strong>'+(gross-c.unpaid).toLocaleString()+'원</strong></div>' +
      '<p class="note">미납은 면제되지 않습니다. 시연순자산은 총자산-미납이며 투자수익률이 아닙니다. 총자산에는 예약현금·잠긴 매도평가가 포함되고 납부는 사용가능현금으로만 합니다. 보류는 재학·복무 일정에 영향을 주지 않는 최소시험이며 현실 학적·채무 정책이 아닙니다. 월수입과 청구 생성은 월진행1회, 납부·보류·재납부는 월진행 없이 처리합니다.</p>' +
      '<details class="cash-event-ledger"><summary>현금사건 장부 · 최근12개월</summary>'+state.cashEvents.rows.slice(-12).reverse().map(r=>'<p class="note">'+esc(r.month)+' / 수입 +'+r.income.toLocaleString()+'원 / 생활 '+r.living.toLocaleString()+'원 / 학비 '+r.tuition.toLocaleString()+'원 / '+esc({due:'선택 대기',paid:'납부',deferred:'명시 보류'}[r.status])+' / 납부 '+r.paid.toLocaleString()+'원'+(state.cashAutomation&&state.cashAutomation.paidMonths.includes(r.month)?' · 명시 정책에 따른 자동납부':'')+'</p>').join('')+'</details>' +
      (state.cashEvents.rows.some(r=>r.status==='deferred')?'<button id="cash-retry" style="min-height:44px">보류 미납을 다시 납부하기</button>':'')+cashAutomationHtml()+'</div>';
  }
  function cashDecision(row, action) {
    if(storageWriteBlocked || !CASH_MODE || row.status!=='due')return;
    const cost=row.living+row.tuition;
    if(action==='paid'&&state.cash<cost)return;
    if(!confirm(action==='paid'?'사용가능현금에서 '+cost.toLocaleString()+'원을 가상 납부할까요? 월은 진행하지 않습니다.':'가상청구 '+cost.toLocaleString()+'원을 미납으로 남길까요? 면제가 아니며 학적일정은 바꾸지 않습니다.'))return;
    if(row.status!=='due'||(action==='paid'&&state.cash<cost))return;
    if(action==='paid'){state.cash-=cost;row.paid=cost;}
    row.status=action;
    state.turnCount++;state.history.push({month:state.month,decisionMonth:state.month,choice:'cash-event:'+action+':'+row.month});
    if(save())render();
  }
  function renderCashDue() {
    const row=state.cashEvents.rows.find(r=>r.status==='due');if(!row)return render();
    effDate=state.month+'-01';effPostClose=false; // 월초 청구 판단. 전월 관측일 표시를 이어 쓰지 않는다.
    const cost=row.living+row.tuition, short=Math.max(0,cost-state.cash);
    vnScene('life');document.getElementById('unlock-area').innerHTML='';
    document.getElementById('turn-card').innerHTML='<div class="date">'+esc(row.month)+' · 별도 현금사건 시험</div><h2>가상청구를 어떻게 처리할까</h2><p>이번 달 시험수입 +'+row.income.toLocaleString()+'원은 한 번 입금했습니다. 생활가상청구 '+row.living.toLocaleString()+'원'+(row.tuition?' + 최초재학 학비가상청구 '+row.tuition.toLocaleString()+'원':'')+'입니다. 전부 임의 시험값입니다.</p><p>납부액 '+cost.toLocaleString()+'원 / 사용가능현금 '+state.cash.toLocaleString()+'원 / 부족 '+short.toLocaleString()+'원.</p><p class="note">납부 전에 확인합니다. 예약현금·미체결매도는 사용할 수 없고 자동매도·대출·가족송금은 없습니다. 아래 자산표에서 대기주문을 명시 취소할 수 있어요. 보류하면 미납을 남기고 같은 달의 본게임을 계속하며, 이후 다시 낼 수 있습니다. 보류해도 이 최소시험의 재학 일정은 바꾸지 않습니다.</p>';
    const box=document.getElementById('choices');box.innerHTML='';
    const pay=document.createElement('button');pay.id='cash-pay';pay.textContent='전액 가상 납부 확인';pay.disabled=short>0;pay.onclick=()=>cashDecision(row,'paid');box.append(pay);
    const defer=document.createElement('button');defer.id='cash-defer';defer.textContent='미납을 남기고 명시 보류';defer.onclick=()=>cashDecision(row,'deferred');box.append(defer);
    renderPortfolio();
  }
  function renderCashRepay() {
    if(storageWriteBlocked)return showStorageWriteUnavailable();
    const rows=state.cashEvents.rows.filter(r=>r.status==='deferred'), cost=rows.reduce((v,r)=>v+r.living+r.tuition-r.paid,0);
    document.getElementById('turn-card').innerHTML='<div class="date">'+state.month+' · 미납 다시 확인</div><h2>보류한 가상청구 납부</h2><p>보류 '+rows.length+'건 / 합계 '+cost.toLocaleString()+'원 / 사용가능현금 '+state.cash.toLocaleString()+'원. 전체를 한 번에 내거나, 보류한 월을 직접 골라 한 건씩 전액 낼 수 있습니다. 자동 우선순위·한 청구의 부분납부는 없습니다. 현재 월의 선택대기 청구는 이 합계와 별도입니다.</p><p>원래 월수입·이자는 다시 적용하지 않고 월·뉴스·진로도 진행하지 않습니다. 기존 순저축 회귀는 건드리지 않습니다.</p>';
    const box=document.getElementById('choices');box.innerHTML='';const pay=document.createElement('button');pay.id='cash-repay-confirm';pay.textContent='보류 미납 전액 납부 확인';pay.disabled=!rows.length||state.cash<cost;pay.onclick=()=>{if(storageWriteBlocked||state.cash<cost||rows.some(r=>r.status!=='deferred'))return;if(!confirm('보류 미납 '+cost.toLocaleString()+'원을 현금에서 가상 납부할까요?'))return;state.cash-=cost;rows.forEach(r=>{r.paid=r.living+r.tuition;r.status='paid'});state.history.push({month:state.month,decisionMonth:state.month,choice:'cash-event:repay:'+rows.length});if(save())render()};box.append(pay);
    const label=document.createElement('label');label.htmlFor='cash-repay-month';label.textContent='다시 낼 보류 청구월 직접 선택';box.append(label);
    const select=document.createElement('select');select.id='cash-repay-month';select.style.cssText='width:100%;min-height:44px;max-width:100%';
    const empty=document.createElement('option');empty.value='';empty.textContent='청구월을 고르세요 (자동선택 없음)';select.append(empty);
    rows.forEach(r=>{const option=document.createElement('option');option.value=r.month;option.textContent=r.month+' / '+(r.living+r.tuition-r.paid).toLocaleString()+'원'+(r.tuition?' (생활+학비)':' (생활)');select.append(option)});box.append(select);
    const detail=document.createElement('p');detail.id='cash-repay-month-detail';detail.className='note';detail.setAttribute('aria-live','polite');box.append(detail);
    const one=document.createElement('button');one.id='cash-repay-one';one.textContent='선택한 한 달 청구 전액 납부 확인';one.disabled=true;box.append(one);
    const selected=()=>rows.find(r=>r.month===select.value&&r.status==='deferred');
    select.onchange=()=>{const r=selected();one.disabled=!r||state.cash<r.living+r.tuition-r.paid;detail.textContent=r?'선택 '+r.month+' / 납부 '+(r.living+r.tuition-r.paid).toLocaleString()+'원 / 부족 '+Math.max(0,r.living+r.tuition-r.paid-state.cash).toLocaleString()+'원. 다른 월 미납은 남습니다.':'청구월을 직접 골라야 합니다. 아직 납부하지 않았습니다.'};select.onchange();
    one.onclick=()=>{const r=selected();if(storageWriteBlocked||!r)return;const amount=r.living+r.tuition-r.paid;if(state.cash<amount)return;if(!confirm(r.month+' 보류 가상청구 '+amount.toLocaleString()+'원을 현금에서 납부할까요? 다른 월 미납은 그대로이며 월은 진행하지 않습니다.'))return;if(storageWriteBlocked||r.status!=='deferred'||state.cash<amount)return;state.cash-=amount;r.paid=r.living+r.tuition;r.status='paid';state.history.push({month:state.month,decisionMonth:state.month,choice:'cash-event:repay-month:'+r.month});if(save())render()};
    const cancel=document.createElement('button');cancel.id='cash-repay-cancel';cancel.textContent='취소 (게임으로 돌아가기)';cancel.onclick=()=>render();box.append(cancel);renderPortfolio();
  }

  function render() {
    if (storageReadBlocked) return showStorageReadUnavailable();
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    if (pending) { renderTrade(); renderPortfolio(); return; }
    if(CASH_MODE&&state.cashEvents.rows.some(r=>r.status==='due'))return renderCashDue();
    const turn = nextTurn();
    effDate = turnEffDate(turn).date;
    effPostClose = turnEffDate(turn).postClose;
    tryFillOrders(); // 같은 달 연속 뉴스 등 월 진행 없이 관측일만 전진한 경우의 체결 검사 [지연체결 시연 모형]
    vnScene(turn.kind);
    const card = document.getElementById('turn-card');
    const choices = document.getElementById('choices');
    const unlockArea = document.getElementById('unlock-area');
    unlockArea.innerHTML = '';
    choices.innerHTML = '';

    if (state.lastFills && state.lastFills.length) {
      for (const f of state.lastFills) {
        const u = productRule(f.product);
        // 3축 구분: 접수 시각(obsCutoff) / 가격 형성일(ptDate) / 최초 관측 가능일(usableFrom).
        // 가격 형성일이 접수 시각보다 과거(늦은 공개)면 시연 가정을 화면에 명시.
        const pastFormed = f.obsCutoff && f.ptDate < f.obsCutoff;
        const ufNote = f.usableFrom ? ' · 최초 관측 가능일 ' + f.usableFrom : '';
        const fxNote = f.fxPtDate
          ? ' · 환율 기준일 ' + f.fxPtDate + (f.fxPtDate < f.ptDate ? ' (지수 기준일보다 오래된 환율 적용 [시연 가정])' : '')
          : '';
        const pastNote = pastFormed
          ? ' <span style="color:#8a6d3b">가격 형성일(' + f.ptDate + ')이 주문 접수 시점보다 과거예요 — 늦게 공개된 가격으로 체결되는 시연 가정이며 정식 매매 재현이 아니에요.</span>'
          : '';
        if (f.kind === 'buy-fill') {
          unlockArea.innerHTML += '<div class="unlock-banner">주문 체결 (매수 ' + esc(u.name || f.product) + '): ' +
            f.amount.toLocaleString() + '원 · 가격 기준일 ' + f.ptDate + ' 지점 ' + f.price.toLocaleString() + ' · 체결 관측월 ' + f.month + ufNote + fxNote + ' [지연체결 시연 모형]' + pastNote + '</div>';
        } else {
          const sign = f.pnl >= 0 ? '+' : '';
          unlockArea.innerHTML += '<div class="unlock-banner">주문 체결 (매도 ' + esc(u.name || f.product) + '): 매도대금 ' +
            f.proceeds.toLocaleString() + '원 · 가격 기준일 ' + f.ptDate + ' 지점 ' + f.price.toLocaleString() + ' · 체결 관측월 ' + f.month + ufNote + fxNote + pastNote + ' · 실현손익 ' +
            sign + f.pnl.toLocaleString() + '원 [지연체결 시연 모형]</div>';
        }
      }
      state.lastFills = [];
      if (!save()) return;
    }
    if (state.lastTrade && state.lastTrade.turn === state.turnCount - 1 && (!/-order$/.test(state.lastTrade.kind) || (state.pendingOrders || []).some(o => o.id && o.id.startsWith('ord-' + state.lastTrade.turn + '-') && o.product === state.lastTrade.product))) {
      const lt = state.lastTrade;
      const u = productRule(lt.product);
      if (lt.kind === 'buy-order') {
        unlockArea.innerHTML += '<div class="unlock-banner">주문 접수 (매수 ' + esc(u.name || lt.product) + '): ' +
          lt.proceeds.toLocaleString() + '원 — 체결은 이후 진행 중 새로 관측되는 시세 지점으로 집행돼요. 자료 공백으로 장기간 미체결이 될 수 있어요 [지연체결 시연 모형 · 정식 매매 재현 아님]</div>';
      } else if (lt.kind === 'sell-order') {
        unlockArea.innerHTML += '<div class="unlock-banner">주문 접수 (매도 ' + esc(u.name || lt.product) + ') — 수량이 잠겼고 체결은 이후 진행 중 새로 관측되는 시세 지점으로 집행돼요 [지연체결 시연 모형]</div>';
      } else if (lt.kind === 'sell') {
        const sign = lt.pnl >= 0 ? '+' : '';
        unlockArea.innerHTML += '<div class="unlock-banner">방금 매도 (' + esc(u.name || lt.product) + '): 매도대금 ' +
          lt.proceeds.toLocaleString() + '원 · 해당 원가 ' + lt.costBasis.toLocaleString() + '원 · 실현손익 ' +
          sign + lt.pnl.toLocaleString() + '원 [시연 평가 기준 — 실제 당시 손익 아님]</div>';
      } else {
        unlockArea.innerHTML += '<div class="unlock-banner">방금 매수 (' + esc(u.name || lt.product) + '): 투입 ' +
          lt.proceeds.toLocaleString() + '원 [시연 체결]</div>';
      }
    }

    if (militaryActive()) {
      unlockArea.innerHTML += '<div class="unlock-banner">복무 중 — 훈련 일정으로 시장 대응이 제한돼요 (매수 비중 상한 30%) [설계 제안]</div>';
    }
    if (state.chaos >= CHAOS.warnAt && !state.flags.gameOver) {
      unlockArea.innerHTML += '<div class="unlock-banner">카오스 경고 ' + state.chaos.toFixed(1) + '/100 — 시장 영향이 쌓여 역사 변경 임계에 가까워요. 분산하거나 규모를 줄이면 누적이 느려져요 [설계 제안]</div>';
    }
    if (turn.kind === 'gameover') {
      card.innerHTML = '<div class="date">' + state.month + ' · 게임 오버</div>' +
        '<h2>역사가 바뀌었습니다</h2>' +
        '<p>시장에 쌓인 영향(카오스 ' + state.chaos.toFixed(1) + '/100)이 한계를 넘어, 알고 있던 미래가 더 이상 유효하지 않게 됐다. 이 인생은 여기서 닫힙니다. 기록은 회귀 대시보드에 남습니다.</p>' +
        '<p class="note">카오스 수치와 한계는 전부 설계 제안이며 경제적 사실이 아니에요.</p>';
      card.innerHTML+=cashEndHtml();
      renderChoices([{ id: 'record-and-reset', label: '기록을 남기고 새 회귀 시작' }], turn);
      renderPortfolio();
      return;
    }
    if (turn.kind === 'natural-end') {
      card.innerHTML = '<div class="date">' + GAME_END + ' 종료 · 인생 결산 (결산 관측 ' + state.month + '-01)</div>' +
        '<h2>알고 있던 미래가 오늘이 됐습니다</h2>' +
        '<p>회귀한 시점에 도달했습니다. 전체 게임은 2026년 10월에 인생이 닫혀요. 포지션은 강제 매도하지 않고 그 시점 평가액으로 결산해요 [설계 제안]. 기록은 회귀 대시보드에 남습니다.</p>' +
        '<p>총자산 ' + totalAssets().toLocaleString() + '원 · 턴 ' + state.turnCount + ' · 카오스 ' + state.chaos.toFixed(1) + '/100</p>' +
        ((state.pendingOrders || []).length ? '<p class="note">미체결 매수 예약금·매도 예약 수량도 총자산에 포함돼요. 기록을 남길 때 미체결 주문을 취소하고 예약금을 반환해 결산해요 [시연 규칙].</p>' : '');
      if(CASH_MODE){const n=document.createElement('p');n.className='note';n.textContent='별도 현금사건 시험 회귀 [임의값] - 원래 순저축은 끄고 수입/가상청구/미납을 자산표에 별도로 표시합니다. 실제급여·학비·생활비 고증은 아니에요.';card.append(n);}
    appendSkipBanner(card);
      card.innerHTML+=cashEndHtml();
      renderChoices([
        { id: 'record-and-reset-end', label: '기록을 남기고 새 회귀 시작' },
        { id: 'end-continue', label: '계속 둘러보기 (새 뉴스 없음)' }
      ], turn);
      renderPortfolio();
      document.getElementById('footnote').textContent = '턴 ' + state.turnCount + ' · 검증된 시세 지점만 표시';
      return;
    }
    if (turn.kind === 'demo-end') {
      card.innerHTML = '<div class="date">' + state.month + ' · 시제품 구간 종료</div>' +
        '<h2>기본 시연 구간을 마쳤습니다</h2>' +
        '<p>기본 시연 구간은 1996년 3월~2003년 12월입니다. 계속하면 2026년 10월까지의 확장 자료로 이어져요. 확장 구간에도 일부 뉴스와 가격이 있지만 연도별 공백·미검증 자료가 남아 있습니다. 여기서 기록을 남기고 새 회귀를 시작할 수도 있어요.</p>' +
        '<p>총자산 ' + totalAssets().toLocaleString() + '원 · 턴 ' + state.turnCount + ' · 카오스 ' + state.chaos.toFixed(1) + '/100</p>';
      card.innerHTML+=cashEndHtml();
      renderChoices([
        { id: 'record-and-reset-demo', label: '기록을 남기고 새 회귀 시작' },
        { id: 'demo-continue', label: '계속 둘러보기 (확장 자료 · 2026년 10월까지)' }
      ], turn);
      renderPortfolio();
      return;
    }
    if (turn.kind === 'discharge') {
      const startPt = state.flags.militaryStart ? priceAt('kospi', state.flags.militaryStart) : null;
      const nowPt = priceAt('kospi', state.month);
      let line = '복무 구간의 확보 지점이 부족해요.';
      if (startPt && nowPt) {
        const chg = ((nowPt.value - startPt.value) / startPt.value * 100).toFixed(1);
        line = '확보된 두 관측점 비교: ' + startPt.date + ' ' + startPt.value.toLocaleString() + ' → ' + nowPt.date + ' ' +
          nowPt.value.toLocaleString() + ' (' + (chg >= 0 ? '+' : '') + chg + '%). 두 날짜는 각각 가장 가까운 확보 지점이며, 복무기간의 실제 시장 성과가 아니에요.';
      }
      card.innerHTML = '<div class="date">' + state.month + ' · 진로·생활</div>' +
        '<h2>전역했습니다</h2><p>복무를 마치고 사회로 돌아왔다. 확보된 관측점 기준의 참고 비교예요. 실제 복무기간의 시장 경로·성과와는 구분돼요.</p>' +
        '<p>' + line + '</p>';
      renderChoices([{ id: 'discharge-ok', label: '확인 — 다음 진입으로' }], turn);
      renderPortfolio();
      return;
    }
    if (turn.kind === 'news' || turn.kind === 'life') {
      const ev = turn.event;
      card.innerHTML =
        '<div class="date">' + ev.date + (ev.event_month ? ' 노출 (사건월 ' + ev.event_month + ' · 정확일 미확인, 익월로 보수적 배치)' : ev.event_date ? ' 노출 (사건일 ' + ev.event_date + ' · 보수적 발표/확인일 배치)' : '') + ' · ' + (turn.kind === 'life' ? '진로·생활' : '뉴스') + (effPostClose ? ' · 장 마감 후 판단' : '') + '</div>' +
        '<h2>' + esc(ev.card_title) + '</h2>' +
        '<p>' + esc(CASH_MODE && turn.kind==='life' && ev.id==='life-grad' ? '취업 또는 전업을 고릅니다. 이 별도 시험에서는 취업 월수입30만원/전업0원이며 매월 생활가상청구10만원은 그대로입니다. 실제급여·생계가능성 규칙이 아니에요.' : CASH_MODE && turn.kind==='life' && ev.id==='life-hs1' ? '공부 또는 알바를 고릅니다. 이 별도 시험에서는 고교 알바 월수입30만원/학생0원이며 월생활 가상청구10만원은 두 경로 모두 있습니다. 실제 학업/근로 모형이 아니에요.' : ev.card_summary) + '</p>' +
        (ev.historical_reconstruction ? '<p class="muted">역사 재구성 [시연]: 당시 기사 원문 미확보. 후년 기록을 바탕으로 한 카드이며 정확한 당시 보도시각을 재현하지 않습니다.</p>' : '') +
        (ev.impact_tags.length ? '<div class="tags">영향: ' + ev.impact_tags.join(', ') + '</div>' : '') +
        settlementNote(turn) + sourceDetails(ev) + lifeOutlookHtml(turn) + (!CASH_MODE && turn.kind === 'life' && ['life-scenario','life-hs1','life-grad'].includes(ev.id) ? '<p class="note">생활 흐름 [미완성]: 현재는 시험용 순저축만 더하며 생활비·학비·세금·임금의 별도 흐름은 계산하지 않아요. 전업의 생활비 차감도 아직 없어요. 전업 자산 하한 1,200만 원은 월 100만 원×12개월이라는 시험값이지 실제 생활 가능성 판정이 아닙니다.</p>' : '');
      if (ev.unlock && !state.unlocksSeen.includes(ev.unlock)) {
        const prod = DATA.unlocks.find(u => u.product === ev.unlock);
        if (productAvailable(prod)) {
          unlockArea.innerHTML += '<div class="unlock-banner">새 접근 경로: ' + esc(prod.name) + ' — 시장 개장과 실제 개인 상품 접근은 별개로 검증해요</div>';
          state.unlocksSeen.push(ev.unlock);
        }
      }
      if (turn.kind === 'life' && ev.choices) {
        // 진로·입대는 실제 선택으로만 완료. 일반 hold는 동적 사건을 완료하지 못해 같은 화면에 턴만 쌓이던 오류가 있었다.
        renderChoices(ev.choices.map(c => ({ id: 'life:' + c.id, label: CASH_MODE&&c.id==='job'?'취업 - 다음 달부터 시험수입30만원':CASH_MODE&&c.id==='study'?'공부 집중 - 시험수입0원/생활가상청구10만원':CASH_MODE&&c.id==='parttime'?'알바 병행 - 고교시험수입30만원/생활가상청구10만원':CASH_MODE&&c.id==='fulltime'?'전업 투자 - 시험수입0원/생활가상청구10만원':SCHOOL_MODE&&c.id==='go-now'?'바로 입대 (26개월 임의 시험 · 해당연도 실제 규정 미연결)':c.label })), turn);
        if (ev.id === 'life-grad') { // 전업 해금 게이트: 자산 하한(생활비 12개월분) 미달이면 전업 선택 불가 [시험용 가정]
          const btn = [...document.getElementById('choices').children].find(x => x.textContent.includes('전업 투자'));
          if (btn && totalAssets() < FULLTIME_GATE) {
            btn.disabled = true;
            btn.textContent += ' — 자산 하한 ' + FULLTIME_GATE.toLocaleString() + '원 미달 [시험용 가정]';
          }
        }
      } else {
        renderChoices([
          { id: 'enter', label: '이 뉴스에 대응해 포지션 조정' },
          { id: 'hold', label: '유지 (지금 보유 그대로)' },
          { id: 'skip', label: '건너뛰기 (다음 진입으로)' }
        ], turn);
        if (!tradeAccess(turn).allowed) { // same permission used by status text and choose()
          const b0 = document.getElementById('choices').querySelector('button');
          b0.disabled = true;
          b0.textContent = schoolDataGap()?'상품접근·가격 미확인 - 매매 차단 (1996-03 전)':'뉴스 대응 주문 불가 — 직장인은 분기 정산 리밸런싱에서만 주문 [설계 제안]';
        }
      }
    } else {
      card.innerHTML =
        '<div class="date">' + state.month + (turn.settlement ? ' · 분기 정산 전용 턴' : (schoolDataGap()?' · 자료공백 월':' · 평온')) + '</div>' +
        (turn.settlement ? '<h2>분기 자산을 점검합니다</h2><p>이 달의 뉴스 선택을 마친 뒤 리밸런싱 기회를 한 번 갖습니다. 뉴스 대응 주문과는 별개예요. 이 화면만으로 게임 월이나 이자는 추가되지 않습니다 [시연 설계].</p>' : quietIntro()) +
        quietMarketLine() +
        settlementNote(turn);
      renderChoices([
        { id: 'rebalance', label: '리밸런싱 (비중 조정)' },
        { id: 'hold', label: '유지' },
        { id: 'next', label: '다음 달로 진입' },
        { id: 'skip-preview', label: '다음 뉴스까지 건너뛰기 (도착 지점 미리보기)' }
      ], turn);
      if (!tradeAccess(turn).allowed) { // no separate month-based exception
        const b0 = document.getElementById('choices').querySelector('button');
        b0.disabled = true;
        b0.textContent = schoolDataGap()?'자료공백 구간 - 매매 차단 (1996-03 전)':'리밸런싱 불가 — 직장인은 분기 정산 전용 턴에서만 주문 [설계 제안]';
      }
    }
    if(CASH_MODE){const n=document.createElement('p');n.className='note';n.textContent='별도 현금사건 시험 회귀 [임의값] - 원래 순저축은 끄고 수입/가상청구/미납을 자산표에 별도로 표시합니다. 실제급여·학비·생활비 고증은 아니에요.';card.append(n);}
    if(SCHOOL_MODE)card.innerHTML+=schoolTrialNote(true);
    appendSkipBanner(card);
    renderPortfolio();
    document.getElementById('footnote').textContent =
      '턴 ' + state.turnCount + (SCHOOL_MODE?' · 고1 달력 시험 · 역사/경제 고증 미완성':' · 검증된 시세 지점만 표시') +
      (state.flags.birth ? ' · ' + state.flags.birth.year + '년 ' + state.flags.birth.month + '월생 · 고1 ' + state.flags.birth.hsYear + '년' : '') +
      (state.flags.demoScenario === 'pre1996-study' ? ' · 시연용 시나리오: 진학 루트 확정·재학 진행 상태로 시작 [시연 제약]' : '');
  }

  // Cash-mode choice context only. Does not change eligibility, cash flow, or saved state.
  function cashLifeOutlookHtml(turn) {
    if (turn.kind !== 'life' || !turn.event || !['life-hs1','life-grad','life-scenario'].includes(turn.event.id)) return '';
    const id=turn.event.id, c=cashSummary(), gross=totalAssets();
    const row=(title,text)=>'<section style="padding:10px 0;border-top:1px solid #ddd;overflow-wrap:anywhere"><h3 style="font-size:1rem;margin:0 0 6px">'+esc(title)+'</h3><p style="margin:0">'+esc(text)+'</p></section>';
    let body='';
    if(id==='life-hs1') {
      body+=row('공부와 알바의 현금 흐름 [임의값]', '공부·재학 중 월수입0원, 고교 알바 월수입30만원입니다. 고교 졸업 뒤 알바 경로는 전업으로 이어져 월수입0원이며 별도 취업 선택은 없습니다. 공부 경로는 재학48개월을 채운 졸업 선택에서 취업 월수입30만원 또는 전업0원을 고릅니다. 둘 다 매월 생활가상청구10만원이 있고, 재학 경로는 최초 재학 월진행에 학비가상청구80만원이 한 번 있습니다. 기존 월 순저축은 적용하지 않습니다.');
    } else if(id==='life-scenario') {
      body+=row('시작 이력의 차이 [임의값]', '진학 시나리오는 대학 재학과 일부 복무 이력을 가정하며, 최초 재학 월진행에 학비가상청구80만원이 한 번 있습니다. 일반 시작은 진로 이력 미정이며 자동 취업이나 월수입을 주지 않습니다. 고교 알바·졸업취업 외에는 월수입0원, 두 시작 모두 월생활가상청구10만원입니다. 시작 전 소득·지출·성적은 소급 계산하지 않으며 같은 조건의 진로 비교가 아닙니다. 기존 월 순저축은 적용하지 않습니다.');
    } else {
      body+=row('졸업 뒤 현금과 주문 기회 [임의값]', '취업은 다음 월진행부터 월수입30만원, 전업은0원입니다. 둘 다 월생활가상청구10만원을 유지합니다. 취업은 분기 정산 전용 턴에서 주문하고 전업은 뉴스·평온 턴에서도 주문할 수 있지만 상품 해금·관측 시세·잔고·복무 제한을 따릅니다. 수입은 매출·순수익·실제급여가 아닌 임의값이고 기존 순저축은 적용하지 않습니다.');
      const short=Math.max(0,FULLTIME_GATE-gross);
      body+=row('지금 전업 버튼이 보는 값', '총자산(미납 차감 전) '+gross.toLocaleString()+'원 / 시험하한 '+FULLTIME_GATE.toLocaleString()+'원. '+(short?'현재 '+short.toLocaleString()+'원 부족해 전업 버튼이 잠깁니다.':'현재 하한을 충족해 전업 버튼을 고를 수 있습니다.')+' 미납 '+c.unpaid.toLocaleString()+'원 / 미납차감 시연순자산 '+(gross-c.unpaid).toLocaleString()+'원 / 사용가능현금 '+state.cash.toLocaleString()+'원. 현재 버튼은 미납차감 순자산이나 사용가능현금이 아니라 총자산으로 판정합니다. 예약금·상품평가도 총자산에 포함되므로 이 하한 충족은 납부가능·실제생계가능 판정이 아닙니다.');
    }
    body+=row('그대로 남은 일정과 불균형', '복무 중 월수입0원에도 생활가상청구10만원은 유지합니다. 복무 중 재학개월은 멈추고 매수비중 상한30%를 적용합니다. 대학졸업 전업은 총자산1200만원 하한을 검사하지만 알바 뒤 전업에는 같은 검사가 없습니다. 기존 시험규칙을 유지한 차이이며 진로균형을 검증한 결과가 아닙니다.');
    body+=row('미납은 없어지지 않아요', '납부는 사용가능현금으로 전액만 가능합니다. 명시 보류는 미납을 남기며 학적·복무 일정은 바꾸지 않습니다. 자동대출·매도·가족송금은 없고 세금·장학·환급·연체료·실업·학업성과는 미구현입니다. 임의 시험값으로 미래자산·유리한 진로·현실 납부정책을 예측하지 않습니다.');
    return '<details class="life-outlook cash-life-outlook" style="margin:14px 0;padding:10px;border:1px solid #b8c8b6;border-radius:8px"><summary style="cursor:pointer">선택 전, 현금 흐름과 남은 조건 비교 [임의값]</summary><p class="note">현재 현금사건 시험규칙만 읽습니다. 열기·닫기는 월·현금·저장을 바꾸지 않으며 아래 진로 버튼을 눌러야 선택됩니다.</p>'+body+'</details>';
  }

  // Read-only map of the rules already implemented. No forecast, new fee, or state write.
  function lifeOutlookHtml(turn) {
    if(CASH_MODE)return cashLifeOutlookHtml(turn);
    if (turn.kind !== 'life' || !turn.event || !['life-hs1', 'life-grad', 'life-scenario'].includes(turn.event.id)) return '';
    const id = turn.event.id, b = state.flags.birth;
    const row = (title, text) => '<section style="padding:10px 0;border-top:1px solid #ddd;overflow-wrap:anywhere"><h3 style="font-size:1rem;margin:0 0 6px">' + esc(title) + '</h3><p style="margin:0">' + esc(text) + '</p></section>';
    const job = '취업: 졸업 후 다음 월 진행부터 월 ' + SAVINGS_BASE.toLocaleString() + '원 순저축 [시험값]. 복무 중은 0원. 뉴스 턴에서는 주문하지 못하고 분기 정산 전용 턴에서 주문합니다 [현재 설계].';
    const ft = '전업 투자: 정기 순저축 0원. 뉴스·평온 턴에서 주문 기회가 있지만 실제 매매 가능 여부는 상품 해금·관측 시세·잔고·복무 제한에 따라 달라집니다. 생활비는 아직 차감하지 않으므로 0원 생활비로 살 수 있다는 뜻이 아닙니다.';
    let body = '';
    if (id === 'life-hs1') {
      body += row('공부 → 진학 → 졸업 때 다시 선택', '학생·재학 중 정기 순저축 0원 [시험값]. 고교 이후 대학 재학 48개월을 채우면 취업과 전업 투자를 다시 고릅니다. 복무 중 재학 개월은 멈춥니다. 입학·졸업 일정은 현재 학제 가정이며 합격·취업 확률이나 공부 성과를 계산하지 않습니다.');
      body += row('알바 → 졸업 뒤 전업 투자', '고교 기간 월 ' + Math.round(SAVINGS_BASE * 0.2).toLocaleString() + '원 순저축 [시험값]. 고교 졸업 뒤 정기 순저축은 0원이며 대학 졸업의 두 번째 선택은 없습니다. 별도 취업 수입을 자동으로 주지 않습니다.');
      body += row('두 경로의 다음 갈림길', job + ' ' + ft + ' 대학 졸업의 전업 선택에는 총자산 ' + FULLTIME_GATE.toLocaleString() + '원 하한 [시험값]이 있고 알바 경로에는 같은 하한 검사가 없습니다. 이는 현재 구현 차이이며 현실적 우열이나 균형을 검증한 규칙이 아닙니다.');
      body += row('복무와 달력', '현재 시험 일정은 진학 경로 ' + (b.hsYear + 5) + '년 6월, 알바 경로 ' + (b.hsYear + 3) + '년 8월에 입영 선택을 제시합니다. 바로 입대 시 26개월, 1년 유예 선택은 별도 시험가정입니다. 복무 중 순저축 0원·매수 비중 상한 30%이며 학적 개월이 멈춥니다. 군종·개인별 자격을 판정하지 않습니다.');
    } else if (id === 'life-grad') {
      body += row('취업을 고르면', job);
      body += row('전업 투자를 고르면', ft);
      const assets = totalAssets(), shortfall = Math.max(0, FULLTIME_GATE - assets);
      body += row('지금의 전업 선택 조건', '시연 총자산 ' + assets.toLocaleString() + '원 / 시험 하한 ' + FULLTIME_GATE.toLocaleString() + '원. ' + (shortfall ? '현재 ' + shortfall.toLocaleString() + '원 부족해 전업 버튼이 잠깁니다.' : '현재 하한을 충족해 전업 버튼을 고를 수 있습니다.') + ' 총자산에는 상품 평가액과 주문 예약분이 포함되며 즉시 쓸 현금·실제 생활비 충당 능력과 같지 않습니다. 이 화면을 열어도 매도·대출·자산 이동은 하지 않습니다.');
    } else {
      body += row('진학 이력을 골라 시작', '고1 선택이 시제품 시작 전인 생년입니다. 진학 시나리오를 고르면 과거 진학·재학 개월과 일부 복무 이력을 시연용으로 가정합니다. 고교 시절의 현금·알바·성적을 소급 계산하지 않습니다. 대학 재학 48개월과 복무 휴학 뒤 졸업 선택에서 취업 또는 전업을 고릅니다.');
      body += row('일반 시작을 고르면', '진로 이력은 미정입니다. 졸업·취업 선택을 임의로 채우지 않으며 현재의 진로 미정 시작 규칙에서는 복무 중이 아닐 때 월 ' + SAVINGS_BASE.toLocaleString() + '원 순저축이 더해집니다 [시험값]. 이 규칙과 진학 시나리오는 같은 조건 비교가 아닙니다.');
      body += row('진학 시나리오의 졸업 뒤', job + ' ' + ft + ' 전업 선택에는 총자산 ' + FULLTIME_GATE.toLocaleString() + '원 하한 [시험값]이 있습니다.');
    }
    body += row('생활경제 연결 전 비어 있는 것', '급여·공제·생활비·학비·장학금·가족부담·실업을 개별 현금 사건으로 계산하지 않습니다. 미확인 비용을 0원으로 확정하거나 시험 순저축에서 다시 빼지 않았습니다. 선택별 미래 총자산·수익률·유리한 진로는 예측하지 않습니다.');
    return '<details class="life-outlook" style="margin:14px 0;padding:10px;border:1px solid #b8c8b6;border-radius:8px"><summary style="cursor:pointer">선택 전, 장기 흐름과 생활경제 빈칸 비교</summary><p class="note">현재 구현한 규칙만 설명합니다. 열기·닫기에는 게임 월·현금·기록 변화가 없고 아래 진로 버튼을 눌러야 선택됩니다.</p>' + body + '</details>';
  }

  function settlementNote(turn) {
    if (!isSettlementMonth()) return '';
    let s = '<div class="tags">' + (turn.settlement ? '분기 정산' : '분기월 자산 평가') + ': 총자산 ' + totalAssets().toLocaleString() + '원 (' + tradeAccess(turn).label + ')';
    for (const [p, h] of Object.entries(state.holdings)) {
      const u = DATA.unlocks.find(x => x.product === p);
      const invested = Math.round(h.invested != null ? h.invested : h.avgPrice * h.qty);
      const val = holdingValue(p, h, state.month);
      let basis;
      if (u && (u.rule === 'accrual' || u.rule === 'fxaccrual')) {
        basis = ' (이자 누적 ' + accrualRate(u).label + ' · 예치 당월부터 월 단위 발생, 해지 당월 미발생 [시연 모형])';
        if (u.rule === 'fxaccrual') { const pt0 = holdingPricePoint(p, state.month); if (pt0) basis += ' · 환율 지점 ' + fmtPtDate(pt0); }
      } else {
        const pt = holdingPricePoint(p, state.month);
        basis = pt ? ' (확보 지점 ' + fmtPtDate(pt) + ')' : ' (지점 없음, 투입가 표시)';
      }
      s += '<br>' + esc(u ? u.name : p) + ': 투입 ' + invested.toLocaleString() + '원 → 시연 평가 ' + val.toLocaleString() + '원' + basis;
    }
    s += '<br>확보된 최신 지점 기준의 시연 평가예요. 당시 실제 평가·손익과는 구분돼요.</div>';
    return s;
  }

  function renderChoices(list, turn) {
    const box = document.getElementById('choices');
    box.innerHTML = '';
    list.forEach(c => {
      const b = document.createElement('button');
      b.textContent = c.label;
      b.onclick = () => choose(c.id, turn);
      box.appendChild(b);
    });
  }

  // 단계2: 상품 선택 → 단계3: 비중
  function renderTrade() {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    const card = document.getElementById('turn-card');
    const box = document.getElementById('choices');
    box.innerHTML = '';
    if (pending.step === 'skip-preview') {
      // 사전 미리보기: 상태 복제 후 시연 진행해 도착 지점·개월 수·정산월 수를 계산(실제 상태 불변)
      const savedState = state;
      state = structuredClone(savedState);
      let k = 0, ks = 0, arrive = null;
      while (!state.flags.gameOver && state.month <= GAME_END) {
        const t = nextTurn();
        if (t.kind !== 'quiet') { arrive = t.kind; break; }
        if (t.settlement) { state.flags.settledMonth = state.month; ks++; }
        advanceMonth();
        k++;
        if (k > 500) break;
      }
      if (!arrive && state.month > GAME_END) arrive = 'natural-end';
      const to = state.month;
      state = savedState;
      const kindLabel = { 'cash-due':'가상생활비·학비 선택', news: '뉴스', life: '진로·생활', discharge: '전역', 'demo-end': '시제품 구간 종료', 'natural-end': '인생 결산', gameover: '게임 종료(카오스)' };
      card.innerHTML = '<div class="date">' + state.month + ' · 건너뛰기 미리보기</div><h2>여기까지 진행됩니다</h2>' +
        '<p>도착: ' + to + ' · ' + (kindLabel[arrive] || arrive || '구간 끝') + ' · ' + k + '개월 진행' +
        (ks ? ' · 넘기는 분기 정산 기회 ' + ks + '회를 지나칩니다(주문·리밸런싱 기회 포기)' : ' · 넘기는 정산 기회 없음') + '.</p>' +
        '<p>저축·이자·카오스·학적 전이는 1개월씩 진행할 때와 같은 규칙으로 매월 반영됩니다 [시연 규칙].</p>';
      const go = document.createElement('button');
      go.textContent = k + '개월 건너뛰기 실행';
      go.onclick = () => { pending = null; choose('skip-to-news', null); };
      box.appendChild(go);
      const cancel = document.createElement('button');
      cancel.textContent = '취소 (돌아가기)';
      cancel.onclick = () => { pending = null; render(); };
      box.appendChild(cancel);
      return;
    }
    if (pending.step === 'product') {
      card.innerHTML = '<div class="date">' + state.month + ' · 포지션 조정 1/2</div><h2>상품 선택</h2>';
      unlockedProducts().forEach(u => {
        const b = document.createElement('button');
        if (u.rule === 'accrual' || u.rule === 'fxaccrual') {
          b.textContent = u.name + ' — 이자 누적 ' + accrualRate(u).label + ' · 예치 당월부터 월 단위 발생, 해지 당월 미발생 [시연 모형]';
          if (u.rule === 'fxaccrual') { const pt0 = holdingPricePoint(u.product, state.month); b.textContent += pt0 ? ' · 환율 지점 ' + pt0.value.toLocaleString() + ' (' + fmtPtDate(pt0) + ')' : ' · 환율 지점 없음'; if (u.rule_note) b.textContent += ' ' + u.rule_note; }
        } else if (u.rule === 'fxprice') {
          const pt = holdingPricePoint(u.product, state.month);
          const fxpt0 = priceAt('fx', state.month);
          b.textContent = u.name + (pt && fxpt0
            ? ' — 지수 지점 ' + pt.value.toLocaleString() + ' (' + fmtPtDate(pt) + ') × 환율 ' + fxpt0.value.toLocaleString() + ' (' + fmtPtDate(fxpt0) + ')'
            : ' — 시세 지점 없음');
          if (u.rule_note) b.textContent += ' ' + u.rule_note;
        } else {
          const pt = holdingPricePoint(u.product, state.month);
          b.textContent = u.name + (pt ? ' — 최신 확보 지점 ' + pt.value.toLocaleString() + ' (' + fmtPtDate(pt) + ')' : ' — 시세 지점 없음');
          if (u.rule_note) b.textContent += ' ' + u.rule_note;
        }
        if (u.rule === 'price' || u.rule === 'fxaccrual') {
          const pt = holdingPricePoint(u.product, state.month);
          if (pt) b.textContent += ' · ' + priceAgeNote(pt);
        }
        if (u.tradable === false || u.rule === 'unpriced') {
          b.textContent += ' · ' + (u.rule_note && u.rule === 'unpriced' ? '' : '시연 미지원');
          b.disabled = true;
        } else if ((u.rule === 'price' || u.rule === 'fxaccrual') && !holdingPricePoint(u.product, state.month)) {
          b.disabled = true;
        } else if (u.rule === 'fxprice' && (!holdingPricePoint(u.product, state.month) || !priceAt('fx', state.month))) {
          b.disabled = true; // 지수·환율 지점 모두 현재 확보돼야 주문 가능(현재 기준 판정)
        }
        b.onclick = () => {
          if (!productAvailable(u)) return;
          const pt = holdingPricePoint(u.product, state.month);
          pending.product = u.product;
          pending.price = pt ? pt.value : null;
          pending.priceDate = pt ? pt.date : null;
          pending.rule = u.rule || 'price';
          pending.step = state.holdings[u.product] ? 'direction' : 'weight';
          pending.direction = 'buy';
          render();
        };
        box.appendChild(b);
      });
      const cancel = document.createElement('button');
      cancel.textContent = '취소 (돌아가기)';
      cancel.onclick = () => { pending = null; render(); };
      box.appendChild(cancel);
    } else if (pending.step === 'direction') {
      const u = productRule(pending.product);
      const h = state.holdings[pending.product];
      const cur = holdingValue(pending.product, h, state.month);
      card.innerHTML = '<div class="date">' + state.month + ' · 포지션 조정 1/2</div>' +
        '<h2>' + esc(u.name || pending.product) + '</h2>' +
        '<p>현재 시연 평가 ' + cur.toLocaleString() + '원(관측·평가 기준일 ' + effDate + (effPostClose ? ', 장 마감 후' : '') + '). ' + (u.rule === 'accrual' ? '이 이자 누적 시연 상품은 실행 시 바로 예치·해지해요. 월 이자는 게임의 달이 진행될 때만 반영돼요. 실제 계약·수익률을 재현한 것은 아니에요.' : '주문은 접수만 되고, 체결은 이후 진행 중 새로 관측되는 시세 지점으로 집행돼요. 희소자료 기반 지연체결 시연 모형이며 정식 매매 재현은 아니에요. 당시 실제 체결가와는 구분돼요.') + '</p>';
      const buy = document.createElement('button');
      buy.textContent = '매수 (비중 늘리기)';
      buy.onclick = () => { pending.direction = 'buy'; pending.step = 'weight'; render(); };
      box.appendChild(buy);
      const sell = document.createElement('button');
      sell.textContent = '일부 매도 (비중 줄이기)';
      sell.onclick = () => { pending.direction = 'sell'; pending.step = 'weight'; render(); };
      box.appendChild(sell);
      const cancel = document.createElement('button');
      cancel.textContent = '취소 (돌아가기)';
      cancel.onclick = () => { pending = null; render(); };
      box.appendChild(cancel);
    } else if (pending.step === 'weight') {
      const isSell = pending.direction === 'sell';
      const h0 = state.holdings[pending.product];
      const base = isSell ? holdingValue(pending.product, h0, state.month) : state.cash;
      card.innerHTML = '<div class="date">' + state.month + ' · 포지션 조정 2/2</div>' +
        '<h2>비중 결정</h2><p>' + (isSell
          ? '보유 시연 평가 ' + base.toLocaleString() + '원 중 얼마를 줄일까요?'
          : '현금 ' + base.toLocaleString() + '원 중 얼마를 움직일까요?') + '</p>' +
        '<p class="note">관측·평가 기준일 ' + effDate + (effPostClose ? '(장 마감 후)' : '') + '. ' + (pending.rule === 'accrual' ? '이 이자 누적 시연 상품은 실행 시 바로 예치·해지해요. 월 이자는 달이 진행될 때만 반영돼요. 실제 계약·수익률 재현은 아니에요.' : '주문 접수 후 체결은 이후 진행 중 새로 관측되는 시세 지점으로 집행돼요. 희소자료 기반 지연체결 시연 모형이며 정식 매매 재현은 아니에요. 대기 주문은 포트폴리오에서 취소할 수 있어요.') + '</p>' +
        '<p><input type="range" id="w" min="10" max="' + (!isSell && militaryActive() ? '30' : '100') + '" step="10" value="' + (!isSell && militaryActive() ? '30' : '50') + '" style="width:100%"> ' +
        '<span id="wv">' + (!isSell && militaryActive() ? '30' : '50') + '%</span></p>';
      if (pending.rule === 'price' || pending.rule === 'fxaccrual') {
        const pt = holdingPricePoint(pending.product, state.month);
        if (pt) {
          const freshness = document.createElement('p');
          freshness.className = 'note';
          freshness.textContent = '가격 자료: ' + fmtPtDate(pt) + ' · ' + priceAgeNote(pt) + '. 체결은 이후 진행 중 새로 관측되는 지점으로 처리하는 시연 모형이에요.';
          card.appendChild(freshness);
        }
      }
      const slider = document.getElementById('w');
      const wv = document.getElementById('wv');
      const prev = document.createElement('p');
      prev.className = 'note';
      prev.id = 'chaos-preview';
      card.appendChild(prev);
      const go = document.createElement('button');
      function updatePreview() {
        wv.textContent = slider.value + '%';
        const mInfo = marketSizeOf(pending.product, state.month);
        const amount = Math.round(base * slider.value / 100);
        let impact = 0, mode = '';
        if (mInfo && mInfo.size && amount > 0) {
          if (isSell) { impact = (amount / mInfo.size) * CHAOS.sellImpactFactor * chaosWeight(pending.product); mode = '체결 시 충격'; }
          else { impact = (amount / mInfo.size) * CHAOS.scaleFactor * chaosWeight(pending.product); mode = '월 누적 증가'; }
        }
        const proj = state.chaos + (isSell ? impact : 0);
        let line;
        if (!mInfo) {
          line = '이 상품은 카오스 산정 대상이 아니에요 (안전자금 [설계 제안]). 현재 카오스 ' + state.chaos.toFixed(1) + '/100.';
        } else if (!mInfo.size) {
          line = mInfo.label + '. 현재 카오스 ' + state.chaos.toFixed(1) + '/100.';
        } else {
          line = '이 주문의 예상 카오스 영향: ' + mode + ' +' + impact.toFixed(2) +
            ' [설계 제안 수치 · 시장규모 ' + mInfo.label + ']. 현재 ' + state.chaos.toFixed(1) + '/100';
          if (isSell) line += ' → 충격 반영 시 ' + proj.toFixed(1);
          else line += ' (누적은 월 정산 시 반영)';
          line += '.';
        }
        if (proj >= CHAOS.overAt) {
          line += ' 위험: 이 주문으로 카오스가 한계를 넘어 역사가 바뀝니다.';
          go.textContent = '위험을 알고 실행';
        } else if (proj >= CHAOS.warnAt || state.chaos >= CHAOS.warnAt) {
          line += ' 주의: 임계(100)에 가까워요.';
          go.textContent = '주의를 확인하고 실행';
        } else {
          go.textContent = '실행';
        }
        prev.textContent = line;
        go.disabled = Math.round(base * Number(slider.value) / 100) <= 0;
        if (go.disabled) go.textContent = '움직일 금액이 없습니다';
      }
      slider.oninput = updatePreview;
      updatePreview();
      go.onclick = () => {
        if (go.disabled || Math.round(base * Number(slider.value) / 100) <= 0) return;
        const p = pending;
        if (!productAvailable(productRule(p.product))) { pending = null; render(); return; }
        pending = null;
        if (p.direction === 'sell') {
          const h = state.holdings[p.product];
          if (h) {
            const cur = holdingValue(p.product, h, state.month);
            const frac = slider.value / 100;
            const proceeds = Math.round(cur * frac);
            const u0 = productRule(p.product);
            if (u0.rule !== 'accrual' && proceeds > 0) {
              // 지연체결: 수량 잠금 후 주문 접수 (체결은 이후 진행에서 새로 관측되는 지점으로)
              const q = h.qty * frac;
              const pt0 = holdingPricePoint(p.product, state.month);
              const costBasis0 = h.invested != null ? Math.round(h.invested * frac) : Math.round(h.avgPrice * q);
              h.qty = h.qty - q;
              if (h.invested != null) h.invested = Math.round(h.invested * (1 - frac));
              const ap0 = h.avgPrice;
              if (h.qty <= 1e-12) delete state.holdings[p.product];
              state.pendingOrders = state.pendingOrders || [];
              state.pendingOrders.push({
                id: 'ord-' + state.turnCount + '-' + state.pendingOrders.length,
                kind: 'sell', product: p.product, qty: q, avgPrice: ap0,
                costBasis: costBasis0, investedShare: h.invested != null ? costBasis0 : null,
                placedMonth: state.month, basePtDate: pt0 ? pt0.date : null,
                obsCutoff: effDate, obsPostClose: effPostClose
              });
              state.lastTrade = { kind: 'sell-order', product: p.product, month: state.month, proceeds: costBasis0, costBasis: costBasis0, pnl: 0, turn: state.turnCount };
              finishTurn(p.event, 'sell-order:' + p.product + ':' + slider.value);
              return;
            }
            if (proceeds > 0) {
              // 해당 원가: accrual은 매도 비중만큼의 투입 원금, price형은 평균단가×매도 수량
              const costBasis = h.invested != null
                ? Math.round(h.invested * frac)
                : Math.round(h.avgPrice * h.qty * frac);
              if (frac >= 1) {
                delete state.holdings[p.product];
              } else {
                h.qty = h.qty * (1 - frac);
                if (h.invested != null) h.invested = Math.round(h.invested * (1 - frac));
                // price형은 avgPrice 유지(잔여 수량의 평균단가 불변)
              }
              state.cash += proceeds;
              const mSell = marketSizeOf(p.product, state.month);
              if (mSell && mSell.size) {
                state.chaos = Math.round((state.chaos + (proceeds / mSell.size) * CHAOS.sellImpactFactor * chaosWeight(p.product)) * 10) / 10;
                if (state.chaos >= CHAOS.overAt) state.flags.gameOver = 'chaos';
              }
              state.lastTrade = {
                kind: 'sell', product: p.product, month: state.month,
                proceeds: proceeds, costBasis: costBasis, pnl: proceeds - costBasis,
                turn: state.turnCount
              };
            }
          }
          finishTurn(p.event, 'sell:' + p.product + ':' + slider.value);
          return;
        }
        const amount = Math.round(state.cash * slider.value / 100);
        if (amount > 0 && (p.rule === 'price' || p.rule === 'fxaccrual' || p.rule === 'fxprice')) {
          // 지연체결: 현금 예약 잠금 후 주문 접수 (체결은 이후 진행에서 새로 관측되는 지점으로)
          state.pendingOrders = state.pendingOrders || [];
          state.pendingOrders.push({
            id: 'ord-' + state.turnCount + '-' + state.pendingOrders.length,
            kind: 'buy', product: p.product, amount: amount,
            placedMonth: state.month, basePtDate: p.priceDate || null,
            obsCutoff: effDate, obsPostClose: effPostClose
          });
          state.cash -= amount;
          state.lastTrade = { kind: 'buy-order', product: p.product, month: state.month, proceeds: amount, costBasis: amount, pnl: 0, turn: state.turnCount };
          finishTurn(p.event, 'enter-order:' + p.product + ':' + slider.value);
          return;
        }
        if (amount > 0 && p.rule === 'accrual') {
          const h = state.holdings[p.product] || { qty: 0, avgPrice: 0, entryMonth: state.month };
          // 원금 단위로 적립. 이자는 월 반영으로 잔액(qty)이 불어나므로 투입 원금은 별도 추적
          h.qty = h.qty + amount; h.avgPrice = 1;
          h.invested = (h.invested || 0) + amount;
          if (!h.entryMonth) h.entryMonth = state.month;
          state.holdings[p.product] = h;
          state.cash -= amount;
          state.lastTrade = { kind: 'buy', product: p.product, month: state.month, proceeds: amount, costBasis: amount, pnl: 0, turn: state.turnCount };
        }
        finishTurn(p.event, 'enter:' + p.product + ':' + slider.value);
      };
      box.appendChild(go);
      const cancel = document.createElement('button');
      cancel.textContent = '취소 (돌아가기)';
      cancel.onclick = () => { pending = null; render(); };
      box.appendChild(cancel);
    }
  }

  function choose(id, turn) {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    if (turn && turn.kind === 'life' && !id.startsWith('life:')) { render(); return; } // unsupported generic hold cannot inflate turns
    if (id === 'demo-continue') { state.flags.demoEndShown = true; finishTurn(null, id); return; }
    if (id === 'end-continue') { state.flags.gameEndShown = true; finishTurn(null, id); return; }
    if (id === 'record-and-reset' || id === 'record-and-reset-demo' || id === 'record-and-reset-end') {
      const causeMap = { 'record-and-reset': 'chaos', 'record-and-reset-demo': 'demo-end', 'record-and-reset-end': 'natural-end' };
      settlePendingOrders(); // 미체결 주문은 전부 취소 반환 후 결산 [시연 규칙]
      const log = readLives();
      if (!log) return;
      if (!state.archiveTransferId) state.archiveTransferId = crypto.randomUUID();
      if (!save()) return;
      const record = {
        transferId: state.archiveTransferId,
        ...(SCHOOL_MODE?{schoolStart:{...state.schoolStart},birth:{...state.flags.birth}}:{}),
        decisionReview: buildDecisionReview(),
        ended: id === 'record-and-reset-end' ? GAME_END : state.month, observationMonth: state.month, turnCount: state.turnCount,
        totalAssets: totalAssets(), assetReview: SCHOOL_MODE?{available:false,reason:'separate-school-calendar-model'}:CASH_MODE?{available:false,reason:'separate-cash-events-model'}:ReturnAssetReview.review(state, totalAssets()), ...(CASH_MODE?{cashFlowSummary:cashSummary()}:{}), cause: causeMap[id],
        path: state.flags.studyPath ? (state.flags.studyPath + (state.flags.career ? '-' + state.flags.career : (state.flags.studyPath === 'parttime' ? '-fulltime' : ''))) : null, chaos: state.chaos
      };
      // A failed delete may leave the same completed life in both keys. Reuse
      // its transfer ID after an explicit reload instead of archiving twice.
      if (!log.some(row => row.transferId === record.transferId)) log.push(record);
      try {
        const raw = JSON.stringify(log);
        localStorage.setItem(LIVES_KEY, raw);
        if (localStorage.getItem(LIVES_KEY) !== raw) throw new Error('Archive readback mismatch');
        localStorage.removeItem(SAVE_KEY);
        if (localStorage.getItem(SAVE_KEY) !== null) throw new Error('Save deletion unconfirmed');
      } catch (_) {
        storageWriteBlocked = true; pending = null;
        return showStorageWriteUnavailable();
      }
      location.reload();
      return;
    }
    if (id === 'discharge-ok') {state.flags.dischargeShown = true;state.flags.militaryUntil = null;finishTurn(null,id);return;}
    if (id.startsWith('life:')) {
      const cid = id.slice(5);
      if (cid === 'go-now') {
        // 육군 26개월: 2003년 이전 입영 기준 규정(동아일보 2018-01-16 등). 군종 미정 — 시험용 가정. [제안]
        state.flags.militaryStart = state.month;
        state.flags.militaryUntil = addMonths(state.month, 26);
        state.flags.lifeDone.enlist = true;
      } else if (cid === 'defer-1y' && !state.flags.deferredUsed) {
        state.flags.deferredUsed = true;
        state.flags.enlistAt = addMonths(state.flags.enlistAt, 12);
      } else if (cid === 'scenario-study') {
        // 시연용 시나리오(플레이어 명시 선택): 진학 루트 확정·재학 진행 상태로 시작 [시연 제약]
        const hs2 = state.flags.birth.hsYear;
        const enlist = (hs2 + 5) + '-06';
        state.flags.studyPath = 'study';
        state.flags.academicStatus = 'college';
        state.flags.enrolledMonths = Math.max(0, monthsBetween((hs2 + 3) + '-03', enlist < '1996-03' ? enlist : '1996-03'));
        state.flags.enlistAt = enlist;
        state.flags.demoScenario = 'pre1996-study';
        state.flags.lifeDone.hs1 = true;
        if (enlist < '1996-03') { // 시제품 시작 시 이미 복무 중 [시연 제약 — 입대 선택 생략]
          state.flags.militaryStart = enlist;
          state.flags.militaryUntil = addMonths(enlist, 26);
          state.flags.lifeDone.enlist = true;
        }
      } else if (cid === 'scenario-plain') {
        state.flags.lifeDone.hs1 = true; // 진로 이력 미정으로 시작 [시연 제약]
      } else if (cid === 'study' || cid === 'parttime') {
        state.flags.studyPath = cid;
        state.flags.lifeDone.hs1 = true;
        // 입대: 진학 루트는 대학 2학년 수료 무렵, 알바·전업 루트는 졸업 직후 [설계 제안 — 시기는 개인 선택]
        state.flags.enlistAt = cid === 'study'
          ? (state.flags.birth.hsYear + 5) + '-06'
          : (state.flags.birth.hsYear + 3) + '-08';
      } else if (cid === 'job' || cid === 'fulltime') {
        state.flags.career = cid;
        state.flags.lifeDone.college = true;
        state.flags.academicStatus = 'graduated';
      }
      finishTurn(turn.event || null, id);
      return;
    }
    if (id === 'enter' || id === 'rebalance') {
      if (!tradeAccess(turn).allowed) { render(); return; }
      pending = { step: 'product', event: turn.event || null };
      render();
      return;
    }
    if (id === 'skip-preview') { pending = { step: 'skip-preview' }; render(); return; }
    if (id === 'skip-to-news') {
      // 평온 턴 묶음 건너뛰기: 다음 뉴스/진로/전역/구간 종료까지 월 단위로 진행(저축·이자·카오스는 매월 동일 적용)
      const from = state.month;
      let k = 0, ks = 0;
      while (!state.flags.gameOver && state.month <= GAME_END) {
        const t = nextTurn();
        if (t.kind !== 'quiet') break;
        if (t.settlement) { state.flags.settledMonth = state.month; ks++; }
        advanceMonth();
        k++;
        if (k > 500) break; // 안전 상한
      }
      state.turnCount += k;
      state.lastSkip = k > 0 ? { from: from, months: k, settlements: ks } : null;
      state.history.push({ month: state.month, decisionMonth:from,choice: 'skip-to-news:' + k });
      save();
      render();
      return;
    }
    finishTurn(turn.event || null, id);
  }

  function finishTurn(ev, choiceId) {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    const decisionMonth = state.month;
    const completedSettlement = !ev && nextTurn().settlement;
    if (completedSettlement) state.flags.settledMonth = state.month;
    if (ev && !ev._dynamic) state.eventIndex++;
    state.turnCount++;
    // 같은 달에 밀린 사건(뉴스·생활 모두)은 달을 넘기지 않고 연속 턴으로 처리 (뉴스 밀도 = 진입 밀도)
    const next = DATA.events[state.eventIndex];
    const nlev = nextLifeEvent();
    const pendingNews = next && next.date.slice(0, 7) <= state.month;
    const pendingLife = nlev && nlev.date.slice(0, 7) <= state.month && (!next || nlev.date <= next.date);
    if (!pendingNews && !pendingLife && !settlementDue() && state.month <= GAME_END) advanceMonth();
    state.history.push({ month: state.month, decisionMonth, choice: choiceId });
    save();
    render();
  }

  // 플레이용 시장규모는 당시 공개 근거와 관측가능일을 개별 확인한 항목만 연결한다.
  // 후대 연도별 집계 연구표는 docs/market-size-retrospective-research.txt에 보존. 플레이에 주입하지 않는다.
  const MARKET_SIZE_PLAY = []; // {product, value, usable_from, evidenceVerified}; 아직 적격 항목 없음
  function marketSizeOf(p, month) {
    if (p === 'kospi' || p === 'kosdaq') {
      const cutoff = month === state.month ? effDate : month + '-31';
      const rows = MARKET_SIZE_PLAY.filter(r => r.product === p && r.evidenceVerified === true && r.usable_from <= cutoff).sort((a,b) => a.usable_from.localeCompare(b.usable_from));
      const last = rows[rows.length - 1];
      if (last) return {size:last.value,label:'당시 공개 근거 확인 시장규모 [시연 계산]'};
      return {size:null,label:'당시 공개된 시장규모 근거 미확인 — 카오스 산정 보류'};
    }
    const test = { fx: 50, etf: 5, bundang: 20 }[p];
    if (test) return { size: test * 1e12, label: test + '조 [시장규모 시험값]' };
    return null; // 안전자금 등 산정 대상 아님
  }
  const CHAOS = {
    marketSize: { kospi: 100000000000000, kosdaq: 10000000000000, deposit: Infinity, bond: Infinity, fx: 50000000000000, etf: 5000000000000, bundang: 20000000000000 },
    scaleFactor: 100,        // 보유액/시장규모 비율 × 이 계수 = 월 누적 (경고→종료 6개월 이상 원칙) [설계 제안]
    sellImpactFactor: 100,   // 매도 충격 = 매도대금/시장규모 × 이 계수 (규모 비례) [설계 제안]
    decayPerMonth: 2,        // 보유 영향이 작으면(월 누적 < 1) 카오스 월 감소 [설계 제안]
    warnAt: 70, overAt: 100
    // 부동산은 시장규모를 작게(20조) 잡는 방식으로만 민감도 반영 — 별도 가중 곱하지 않음(이중 벌점 방지)
    // 코스피/코스닥은 당시공개근거 확인 전 계산보류. fx/etf/bundang은 명시된 시험값.
  };
  function chaosWeight(p) { return 1; }
  function monthlyChaosAdd() {
    let add = 0;
    for (const [p, h] of Object.entries(state.holdings)) {
      const m = marketSizeOf(p, state.month);
      if (!m || !m.size) continue;
      add += (holdingValue(p, h, state.month) / m.size) * CHAOS.scaleFactor * chaosWeight(p);
    }
    return add;
  }
  function chaosTick() {
    const add = monthlyChaosAdd();
    let next = state.chaos + add;
    if (add < 1) next -= CHAOS.decayPerMonth; // 보유 영향이 작으면 서서히 감소 [설계 제안]
    state.chaos = Math.round(Math.max(0, next) * 10) / 10;
  }

  // 월 저축: 금액은 전부 [시험용 설계값]. 당시 실제 소득·저축률 검증 전. 복무 중 0원.
  const SAVINGS_BASE = 100000;
  const FULLTIME_GATE = 12000000; // 전업 해금 자산 하한 = 생활비 12개월분 [시험용 가정: 월 100만원 플레이스홀더 — 실제 가계 지출 근거 미확인]
  function monthlySavings() {
    if(CASH_MODE)return 0;
    if (militaryActive()) return 0;
    const b = state.flags.birth;
    if (!b) return SAVINGS_BASE;
    // 단계별 저축 [시험용 설계값]: 학생 0 / 알바(고교 중) 0.2배 / 졸업 후 취업 1배 / 전업투자 0
    if (state.flags.studyPath === 'parttime' && state.month < (b.hsYear + 3) + '-03') return Math.round(SAVINGS_BASE * 0.2);
    if (state.flags.career === 'job' && state.flags.academicStatus === 'graduated') return SAVINGS_BASE;
    if (!state.flags.studyPath) return SAVINGS_BASE; // 1단 분기 전 시작월
    return 0;
  }

  // === 지연체결 시연 모형 (희소자료 기반) ===
  // 주문은 접수 시 체결되지 않는다. 월 진행(advanceMonth) 중 새로 관측 가능해진 적격 지점에서만 체결.
  // 미래 누출 금지: 접수 시점에는 현재 해금·기존 확보 시세·잔고만 본다. 미래 지점 검색·예고 없음.
  // 이 모형이 실제 정식 매매(익일 시가 체결 등)를 재현하는 것은 아님 — 화면 고지 유지.
  // 접수 시점 관측 cutoff에서 이미 관측 가능했던 지점인지 판정 (뒤늦게 확보된 과거 지점으로 체결하는 오류 방지)
  function wasObservableAt(pt, cutoff, postClose) {
    if (!cutoff) return false;
    if (pt.usable_from) return pt.usable_from <= cutoff;
    return postClose ? pt.date <= cutoff : pt.date < cutoff;
  }
  function tryFillOrders() {
    if (!state.pendingOrders) state.pendingOrders = [];
    if (!state.pendingOrders.length) return;
    const fills = [];
    for (const o of state.pendingOrders) {
      if (!o.obsCutoff || typeof o.obsPostClose !== 'boolean') continue; // 주문 접수 관측시각이 없는 구 형식은 추측 체결하지 않음
      const u = productRule(o.product);
      if (!productAvailable(u)) continue; // 이전 버전의 이른 주문은 예약을 보존하고 접근일 전 체결하지 않음
      const pt = priceAt(u.series || o.product, state.month);
      if (!pt || wasObservableAt(pt, o.obsCutoff, o.obsPostClose)) continue; // 접수 후 새로 관측 가능해진 적격 지점만
      let unitPrice = pt.value;
      let fxPtDate = null;
      if (u.rule === 'fxprice') {
        const fxpt = priceAt('fx', state.month);
        if (!fxpt) continue; // 환율 지점 미확보 시 체결 보류(대기 유지)
        unitPrice = pt.value * fxpt.value; // 달러 지수 × 환율 [시연 규칙 — 실제 ETF 가격 재현 아님]
        fxPtDate = fxpt.date; // 지수 기준일과 환율 기준일이 다를 수 있음(시연 가정, 배너 고지)
      }
      // 연정밀도 지점(과거 연말 값이 usable_from에 공개)으로의 체결은 명시적 시연 가정 — 가격기준일(ptDate)과 체결월을 구분 표기
      if (o.kind === 'buy') {
        const h = state.holdings[o.product] || { qty: 0, avgPrice: 0 };
        const qty = o.amount / unitPrice;
        const nq = h.qty + qty;
        h.avgPrice = (h.avgPrice * h.qty + o.amount) / nq;
        h.qty = nq;
        h.entryMonth = state.month; // 체결월 기준 (이자 불변식)
        if (u.rule === 'fxaccrual') h.invested = (h.invested || 0) + o.amount;
        state.holdings[o.product] = h;
        fills.push({ kind: 'buy-fill', product: o.product, amount: o.amount, price: unitPrice, ptDate: pt.date, month: state.month, obsCutoff: o.obsCutoff || null, usableFrom: pt.usable_from || null, fxPtDate: fxPtDate });
      } else {
        const proceeds = Math.round(unitPrice * o.qty);
        state.cash += proceeds;
        const mSell = marketSizeOf(o.product, state.month);
        if (mSell && mSell.size) {
          state.chaos = Math.round((state.chaos + (proceeds / mSell.size) * CHAOS.sellImpactFactor * chaosWeight(o.product)) * 10) / 10;
          if (state.chaos >= CHAOS.overAt) state.flags.gameOver = 'chaos';
        }
        fills.push({ kind: 'sell-fill', product: o.product, proceeds: proceeds, costBasis: o.costBasis, pnl: proceeds - o.costBasis, price: unitPrice, ptDate: pt.date, month: state.month, obsCutoff: o.obsCutoff || null, usableFrom: pt.usable_from || null, fxPtDate: fxPtDate });
      }
      o._filled = true;
    }
    if (fills.length) {
      state.pendingOrders = state.pendingOrders.filter(o => !o._filled);
      state.lastFills = (state.lastFills || []).concat(fills);
      state.fillsLog = (state.fillsLog || []).concat(fills);
    }
  }

  function cancelOrder(id) {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    const o = (state.pendingOrders || []).find(x => x.id === id);
    if (!o) return;
    if (o.kind === 'buy') {
      state.cash += o.amount; // 예약 현금 반환
    } else {
      const h = state.holdings[o.product] || { qty: 0, avgPrice: 0 };
      const nq = h.qty + o.qty;
      h.avgPrice = nq ? (h.avgPrice * h.qty + o.avgPrice * o.qty) / nq : 0;
      h.qty = nq;
      if (o.investedShare != null) h.invested = (h.invested || 0) + o.investedShare;
      if (!h.entryMonth) h.entryMonth = o.placedMonth;
      state.holdings[o.product] = h;
    }
    state.pendingOrders = state.pendingOrders.filter(x => x.id !== id);
    state.history.push({ month: state.month, decisionMonth:state.month,choice: 'cancel-order:' + o.product });
    save(); render();
  }

  function settlePendingOrders() {
    // 인생 결산·게임 종료 기록 시 미체결 주문은 전부 취소 반환 [시연 규칙]
    for (const o of (state.pendingOrders || [])) {
      if (o.kind === 'buy') state.cash += o.amount;
      else {
        const h = state.holdings[o.product] || { qty: 0, avgPrice: 0 };
        const nq = h.qty + o.qty;
        h.avgPrice = nq ? (h.avgPrice * h.qty + o.avgPrice * o.qty) / nq : 0;
        h.qty = nq;
        if (o.investedShare != null) h.invested = (h.invested || 0) + o.investedShare;
        state.holdings[o.product] = h;
      }
    }
    state.pendingOrders = [];
  }

  function advanceMonth() {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    if (!ReturnEconomyPolicy.inspect(state, MODEL_ID).ok) return showEconomyConflict();
    if (DATA && !ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map(u=>u.product)).ok) return showSaveConflict('보유자산·대기주문·장부의 일부 저장 형식을 확인할 수 없어 멈췄습니다. 금액을 추정하거나 원문을 덮어쓰지 않았어요.', 'save-shape');
    const [y, m] = state.month.split('-').map(Number);
    const nm = m === 12 ? [y + 1, 1] : [y, m + 1];
    state.month = nm[0] + '-' + String(nm[1]).padStart(2, '0');
    // 종료 다음 달 1일은 최종 관측·기록 화면용이다. 종료월 밖의 체결·순저축·이자·학적·카오스 회차를 적용하지 않는다.
    if (state.month > GAME_END) return;
    // 학적 전이: 진학 루트는 hsYear+3-03에 대학 입학, 이후 재학 개월 누적(복무 휴학 중 정지)
    const b0 = state.flags.birth;
    if (b0 && state.flags.studyPath === 'study') {
      if (!state.flags.academicStatus && state.month >= (b0.hsYear + 3) + '-03') {
        state.flags.academicStatus = 'college';
        state.flags.enrolledMonths = 0;
      }
      if (state.flags.academicStatus === 'college' && !militaryActive()) {
        state.flags.enrolledMonths = (state.flags.enrolledMonths || 0) + 1;
      }
    }
    tryFillOrders(); // 월 진행 중 새로 관측된 지점에서 미체결 주문 체결 [지연체결 시연 모형]
    if(CASH_MODE){
      const income=!militaryActive() && ((state.flags.studyPath==='parttime' && b0 && state.month<(b0.hsYear+3)+'-03') || (state.flags.career==='job' && state.flags.academicStatus==='graduated')) ? 300000 : 0;
      const tuition=!state.cashEvents.tuitionIssued && state.flags.academicStatus==='college' ? 800000 : 0;
      state.cash += income;
      const row={month:state.month,income,living:100000,tuition,status:'due',paid:0};
      const auto=state.cashAutomation;
      if(auto&&auto.enabled&&state.month>auto.enabledAfterMonth&&!tuition&&state.cash>=row.living){
        state.cash-=row.living;row.paid=row.living;row.status='paid';auto.paidMonths.push(state.month);
      }
      state.cashEvents.rows.push(row);
      if(tuition)state.cashEvents.tuitionIssued=true;
      state.lastSavings=0;
    } else {
    const sv = monthlySavings();
    if (sv > 0) { state.cash += sv; state.lastSavings = sv; } else { state.lastSavings = 0; }
    // 새 기능 도입 후 실제로 진행한 월만 기록. 구 저장의 과거 수입·지출을 역산하지 않는다.
    state.savingsLedger = state.savingsLedger || [];
    state.savingsLedger.push({ month: state.month, amount: sv, reason: militaryActive() ? '복무 중' : state.flags.career === 'job' && state.flags.academicStatus === 'graduated' ? '졸업 후 취업' : state.flags.studyPath === 'parttime' && b0 && state.month < (b0.hsYear + 3) + '-03' ? '고교 알바' : sv > 0 ? '진로 미정 시작 규칙' : '정기 순저축 없음', basis: 'test-net-savings-v1' });
    }
    // 이자 누적 상품: 기존 계산식 그대로 적용하고 실제 반영한 회차만 기록한다.
    const interestEntries = [];
    for (const [p, h] of Object.entries(state.holdings)) {
      const u = DATA.unlocks.find(x => x.product === p);
      // fxaccrual은 달러 잔액에 이자 누적. 원화 환산 손익과 섞지 않는다.
      if (u && (u.rule === 'accrual' || u.rule === 'fxaccrual')) {
        const before = h.qty, rate = accrualRate(u);
        h.qty = h.qty * (1 + rate.annual / 12);
        if (before > 0) interestEntries.push({ product: p, balanceBefore: before, interest: h.qty - before,
          balanceAfter: h.qty, annualRate: rate.annual, rateLabel: rate.label,
          unit: u.rule === 'fxaccrual' ? 'USD' : 'KRW', basis: 'prototype-monthly-accrual-v1' });
      }
    }
    state.interestLedger = state.interestLedger || [];
    state.interestLedger.push({ month: state.month, entries: interestEntries });
    chaosTick();
    if (state.chaos >= CHAOS.overAt) state.flags.gameOver = 'chaos';
  }

  function accrualRate(u) {
    // 반환 {annual, label}: 예금은 월별 실측 수신금리 시계열 [원기사 대조 대기], 그 외는 [시험용 설계값]
    // 미래정보 차단(보수적 시연 규칙): M월중 가중평균금리는 통상 M+1월 말경 발표 — 현대 사례 3건만 확인(2021-10분→11/27, 2025-12분→2026-01-27, 2026-01분→2/27).
    // 1996~2020 발표일은 미검증이라 'M-2 확정'이 아니라 '발표일 미확인으로 보수적 2개월 지연' 규칙. 예외 지연이 있었다면 M-2도 미래일 수 있음 — 완전 차단은 검증 범위 내에서만 주장.
    if (u.product === 'deposit' && DATA.rates) {
      const rm = addMonths(state.month, -2);
      const pct = DATA.rates.rates[rm];
      if (pct != null) {
        return { annual: pct / 100, label: pct.toFixed(2) + '%/년 (' + rm + ' 통계 참고치 · 발표일 미확인으로 보수적 2개월 지연 적용 · 계약금리 아님 [원천 대조 대기])' };
      }
    }
    return { annual: u.rate_annual || 0, label: ((u.rate_annual || 0) * 100).toFixed(1) + '%/년 ' + (u.rate_note || '[시험용 설계값]') + ' (확정 시계열 미확보 구간)' };
  }

  function appendSkipBanner(cardEl) {
    if (!state.lastSkip) return;
    const sk = state.lastSkip;
    state.lastSkip = null;
    const sb = document.createElement('div');
    sb.className = 'tags';
    sb.textContent = '묶음 진행: ' + sk.from + '부터 ' + sk.months + '개월을 건너뛰었어요' +
      (sk.settlements ? ' (분기 정산월 ' + sk.settlements + '회 지나침 — 그 사이 주문·리밸런싱은 하지 않은 것으로 처리)' : ' (그 사이 주문 없음)') +
      '. 저축·이자·카오스는 매월 규칙대로 반영됐어요 [시연 규칙].';
    cardEl.appendChild(sb);
  }

  function quietStreak() {
    // 직전 연속 평온 개월 수 (뉴스 없는 달의 연속)
    const newsMonths = new Set(DATA.events.map(e => e.date.slice(0, 7)));
    let n = 0, m = addMonths(state.month, -1);
    while (!newsMonths.has(m) && m >= schoolStartMonth() && n < 24) { n++; m = addMonths(m, -1); }
    return n;
  }
  function quietIntro() {
    if(schoolDataGap())return '<h2>역사자료가 아직 연결되지 않은 달</h2><p>이 달의 뉴스를 확보하지 못했습니다. 실제로 조용했던 달이라는 뜻이 아니에요. 진로·복무와 월진행만 시험하고 매매는 하지 않습니다. 다음 달로 한 달씩 진행할 수 있어요.</p>';
    const streak = quietStreak();
    const mm = state.month.slice(5);
    const seasonal = {
      '01': '새해 첫 달', '03': '분기 마감의 달', '06': '상반기 마감의 달',
      '09': '분기 마감의 달', '12': '연말 결산 시즌'
    }[mm] || null;
    let head, body;
    if (streak >= 3) {
      head = '뉴스 없는 달이 이어집니다';
      body = '조용한 달이 ' + streak + '개월째예요. 건너뛰기로 다음 뉴스까지 한 번에 갈 수도 있어요.';
    } else if (streak >= 1) {
      head = '조용한 달이 이어집니다';
      body = '특별한 뉴스 없이 ' + (streak + 1) + '개월째예요.';
    } else {
      head = '특별한 뉴스가 없는 달';
      body = '시장이 조용합니다. 보유 자산을 점검하고 다음 진입 시점을 고릅니다.';
    }
    if (seasonal) body += ' (' + seasonal + ')';
    return '<h2>' + head + '</h2><p>' + body + '</p>';
  }
  function quietMarketLine() {
    if(schoolDataGap())return '<p class="note">이 달의 상품 접근과 시세 고증 미완료 - 기존 이후 자료를 끌어오거나 보간하지 않습니다.</p>';
    // 평온 턴 카드에 시장 동향 1줄: priceAt 경유라 미래 지점 미노출. 지점이 없으면 공백을 공백으로 표시.
    const [y, m] = state.month.split('-').map(Number);
    const pm = m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
    const rows = [];
    for (const s of ['kospi', 'kosdaq']) {
      const cur = priceAt(s, state.month);
      if (!cur) continue;
      const prev = priceAt(s, pm);
      let delta = '';
      if (prev && prev !== cur && prev.value) {
        const pct = (cur.value / prev.value - 1) * 100;
        delta = ' · 전월 대비 ' + (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(1) + '%';
      }
      rows.push((s === 'kospi' ? '코스피' : '코스닥') + ' ' + cur.value.toLocaleString() + ' (' + fmtPtDate(cur) + ' 지점)' + delta);
    }
    if (!rows.length) return '<p class="note">이 시점의 지수 가격 지점은 아직 확보되지 않았어요 (공백).</p>';
    return '<p class="note">시장 동향: ' + rows.join(' · ') + '</p>';
  }

  function assetReviewHtml(r = ReturnAssetReview.review(state, totalAssets()), recorded = false) {
    if (!r.available && recorded) return '<details class="asset-review recorded-asset-review"><summary>선택 결과 복기 · 이 기록의 분해 근거 없음</summary><p class="note">당시 시작자금·월 순저축 분해값을 함께 남기지 않았거나 지원하는 형식이 아니에요. 최종자산에서 과거 저축이나 수익을 추측 복원하지 않아요. 기존 기록을 덮어쓰지 않았어요.</p></details>';
    if(!r.available&&SCHOOL_MODE)return '<details class="asset-review"><summary>선택 결과 복기 · 고1별도시작 분해 미지원</summary><p class="note">이 시험의 생월별 시작월은 기존1996-03 자산분해 형식과 다릅니다. 불완전한 형식을 추정 변환하지 않고 자산분해를 계산하지 않습니다. 실제 기록된 월 현금흐름은 현재 모형의 별도 장부로 확인합니다.</p></details>';
    if (!r.available) return '<details class="asset-review"><summary>선택 결과 복기 · 전체 변화 분리 불가</summary><p class="note">시작자금 근거 또는 월 순저축 기록이 온전하지 않아 총자산을 투자 성과로 나누지 않았어요. 이전 저장의 과거 금액을 추측하지 않아요. 기록된 순저축·이자는 아래 장부에서 확인할 수 있어요.</p></details>';
    const money = n => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '원';
    const signed = n => (n > 0 ? '+' : '') + money(n);
    return '<details class="asset-review' + (recorded ? ' recorded-asset-review' : '') + '"><summary>선택 결과 복기 · ' + (recorded ? '종료 때의 자산 변화' : '자산이 어디서 늘었나') + '</summary>' +
      '<p class="note">새 게임 시작자금과 매월 실제로 기록한 시험 순저축을 ' + (recorded ? '기록 당시' : '현재') + ' 총자산에서 분리해요. 총자산이 늘었다고 전부 투자 성과인 것은 아니에요.' + (recorded ? ' 기록 범위 ' + esc(r.startMonth) + '부터 ' + esc(r.endMonth) + ' 관측까지예요.' : '') + '</p>' +
      '<div class="row"><span>새 게임 시작자금</span><strong>' + money(r.openingAssets) + '</strong></div>' +
      '<div class="row"><span>기록된 시험 순저축<br>' + r.months + '개월</span><strong>+' + money(r.recordedSavings) + '</strong></div>' +
      '<div class="row"><span>상품 변화 등 잔차</span><strong>' + signed(r.assetChangeRemainder) + '</strong></div>' +
      '<div class="row"><span>' + (recorded ? '기록 당시 시연 총자산' : '현재 시연 총자산') + '</span><strong>' + money(r.totalAssets) + '</strong></div>' +
      '<p class="note">잔차 = ' + (recorded ? '기록 당시' : '현재') + ' 총자산 - 시작자금 - 기록된 시험 순저축. 상품 평가변화·누적이자·환율환산·반올림 등이 섞여 있어 수익률이나 실현수익이 아니에요. 미체결 매수 예약금·매도 수량도 총자산에 포함하며 매매 원금 이동은 수입으로 더하지 않아요. 실제 학비·생활비·세금·수수료는 연결하지 않았어요.</p>' +
      '<p class="note">진로에 따른 시험 순저축 누적: ' + (Object.entries(r.savingsByReason).map(([reason, amount]) => esc(reason) + ' ' + money(amount)).join(' · ') || '아직 월 진행 없음') + '. 이 시험값만으로 현실의 진로 우열을 정하지 않아요.</p></details>';
  }

  function savingsLedgerHtml() {
    const log = state.savingsLedger || [];
    const total = log.reduce((sum, r) => sum + r.amount, 0);
    const recent = log.slice(-12).reverse();
    return '<details class="savings-ledger"><summary>시험용 순저축 기록 · ' + log.length + '개월 · 누적 ' + total.toLocaleString() + '원</summary>' +
      '<p class="note">실제로 월이 진행될 때 반영한 순저축만 기록합니다. 같은 달의 뉴스·결산·주문 확인이나 새로고침은 저축을 더하지 않아요. 급여 수입·생활비·학비·세금의 상세 장부가 아니며 금액은 모두 시험용 설계값입니다. 기존 저장의 기록 시작 전 금액은 복원하지 않아요.</p>' +
      (recent.length ? '<p class="note">기록 범위 ' + esc(log[0].month) + '부터 ' + esc(log[log.length - 1].month) + '까지 · 최근 ' + recent.length + '개월 표시</p><table style="width:100%;font-size:12px"><thead><tr><th scope="col">월</th><th scope="col">시험 순저축</th><th scope="col">구분</th></tr></thead><tbody>' + recent.map(r => '<tr><td>' + esc(r.month) + '</td><td>' + r.amount.toLocaleString() + '원</td><td>' + esc(r.reason) + '</td></tr>').join('') + '</tbody></table>' : '<p class="note">아직 기록된 월이 없어요. 다음 달 진행부터 기록합니다.</p>') + '</details>';
  }

  function interestLedgerHtml() {
    const log = state.interestLedger || [], recent = log.slice(-6).reverse();
    const applied = log.filter(r => r.entries.length).length;
    function balance(n, unit) {
      return n.toLocaleString('ko-KR', { maximumFractionDigits: unit === 'USD' ? 6 : 2 }) + (unit === 'USD' ? '달러' : '원');
    }
    return '<details class="interest-ledger"><summary>시연 월 이자 기록 · 기록 ' + log.length + '개월 · 이자 반영 ' + applied + '개월</summary>' +
      '<p class="note">실제로 달이 진행되며 적용한 계산만 기록합니다. 같은 달 뉴스·주문 확인·새로고침은 이자 회차를 늘리지 않아요. 원화와 달러를 합산하지 않으며 이자는 현금 입금이 아니라 해당 상품 잔액에 더해집니다. 세전 월복리 시연 계산이며 실제 계약·세후 수익을 재현한 것이 아닙니다. 구 저장의 이전 회차는 복원하지 않아요.</p>' +
      (recent.length ? '<p class="note">기록 범위 ' + esc(log[0].month) + '부터 ' + esc(log[log.length - 1].month) + '까지 · 최근 ' + recent.length + '개월 표시. 화면은 반올림하며 저장 계산값은 원정밀도를 유지합니다.</p>' + recent.map(r => '<div class="monthly-interest-entry" style="padding:8px 0;border-top:1px solid #ddd;overflow-wrap:anywhere"><strong>' + esc(r.month) + '</strong>' +
        (r.entries.length ? r.entries.map(e => '<p class="note">' + esc((DATA.unlocks.find(u => u.product === e.product) || {}).name || e.product) +
          ' · 계산 잔액 ' + balance(e.balanceBefore, e.unit) + ' → ' + balance(e.balanceAfter, e.unit) +
          '<br>반영 이자 +' + balance(e.interest, e.unit) + ' · 연율÷12 적용<br>' + esc(e.rateLabel) + '</p>').join('') : '<p class="note">이자 누적 상품의 보유 잔액이 없어 이자 반영 없음</p>') + '</div>').join('') : '<p class="note">아직 기록된 월이 없어요. 다음 달 진행부터 기록합니다.</p>') + '</details>';
  }

  function renderPortfolio() {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    const el = document.getElementById('portfolio');
    const kp = schoolDataGap()?null:priceAt('kospi', state.month);
    let rows = '<div class="row"><span>현금</span><strong>' + state.cash.toLocaleString() + '원</strong></div>';
    for (const [p, h] of Object.entries(state.holdings)) {
      const u = DATA.unlocks.find(x => x.product === p);
      const invested = Math.round(h.invested != null ? h.invested : h.qty * h.avgPrice);
      const cur = holdingValue(p, h, state.month);
      rows += '<div class="row"><span>' + esc(u ? u.name : p) + '</span><strong>' +
        invested.toLocaleString() + '원 투입' + (cur !== invested ? ' · 평가 ' + cur.toLocaleString() + '원' : '') + '</strong></div>';
    }
    rows += '<div class="row"><span>코스피 최신 확보 지점</span><strong>' +
      (kp ? kp.value.toLocaleString() + ' (' + fmtPtDate(kp) + ')' : '지점 없음 (공백)') + ' · 관측일 ' + effDate + '</strong></div>';
    if(!CASH_MODE){rows += '<div class="row"><span>월 저축</span><span>' +
      (SCHOOL_MODE&&!state.flags.studyPath?'고1 선택 전 미확정':militaryActive() ? '복무 중 0원 [시험용 설계값]' : monthlySavings().toLocaleString() + '원 [시험용 설계값]') + '</span></div>';
    rows += '<div class="row"><span>생활비 차감</span><span>미구현 · 시험용 순저축만 반영</span></div>';
    rows += '<p class="note economy-model-note">생활경제 모형: 시험 순저축 v1 · 실제 급여·학비·세금별 현금흐름은 아직 연결하지 않았어요. 기존 기록을 실비 모형으로 바꾸지 않아요.</p>';
    rows += assetReviewHtml(SCHOOL_MODE?{available:false,reason:'separate-school-calendar-model'}:undefined);
    rows += savingsLedgerHtml();
    }else rows+=cashEventsHtml();
    rows += interestLedgerHtml();
    if (state.month > GAME_END) rows += '<p class="note ending-economic-boundary">경제 회차는 ' + GAME_END + '까지입니다. 결산 관측일을 위해 다음 달로 표시하더라도 추가 순저축·이자·주문 체결은 반영하지 않아요.</p>';
    rows += '<div class="row"><span>카오스</span><span>' + state.chaos.toFixed(1) + ' / 100 (월 +' + monthlyChaosAdd().toFixed(2) + (monthlyChaosAdd() < 1 ? ', 감소 구간' : '') + ') [설계 제안 수치]</span></div>';
    for (const [p, h] of Object.entries(state.holdings)) {
      const mInfo = marketSizeOf(p, state.month);
      if (mInfo && mInfo.size) {
        const share = holdingValue(p, h, state.month) / mInfo.size * 100;
        const u = DATA.unlocks.find(x => x.product === p);
        rows += '<div class="row market-share"><span>└ ' + esc(u ? u.name : p) + ' 시장 비중</span><span>' +
          (share < 0.01 ? share.toFixed(4) : share.toFixed(2)) + '% (' + mInfo.label + ')</span></div>';
      } else if (mInfo) {
        const u = DATA.unlocks.find(x => x.product === p);
        rows += '<div class="row market-share"><span>└ ' + esc(u ? u.name : p) + ' 시장 비중</span><span>산정 불가 — ' + mInfo.label + '</span></div>';
      }
    }
    rows += schoolDataGap()?'<p class="note">자료공백 구간: 상품 접근 고증 미완료, 매매 차단</p>':'<div class="product-list"><div>해금 상품</div><ul>' +
      unlockedProducts().map(u => '<li>' + esc(u.name) + '</li>').join('') + '</ul></div>';
    const lives = readLives();
    if (!lives) return;
    rows += '<div class="row"><span>회귀 기록</span><span id="dash-link" style="cursor:pointer;text-decoration:underline">' +
      (lives.length ? lives.length + '건 — 대시보드 열기' : '대시보드 열기') + '</span></div>';
    if (state.pendingOrders && state.pendingOrders.length) {
      rows += '<div class="row"><span>대기 주문</span><span>' + state.pendingOrders.length + '건 (미체결)</span></div>';
    }
    const latestFill = (state.fillsLog || []).slice(-1)[0];
    if (latestFill) {
      const u = productRule(latestFill.product);
      const resultNote = latestFill.kind === 'sell-fill'
        ? ' · 매도대금 ' + (Number.isFinite(latestFill.proceeds) ? latestFill.proceeds.toLocaleString() + '원' : '미확인') + ' · 취득원가 ' + (Number.isFinite(latestFill.costBasis) ? latestFill.costBasis.toLocaleString() + '원' : '미확인') + ' · 시연 손익 ' + (Number.isFinite(latestFill.pnl) ? (latestFill.pnl >= 0 ? '+' : '') + latestFill.pnl.toLocaleString() + '원' : '미확인')
        : ' · 투입금 ' + (Number.isFinite(latestFill.amount) ? latestFill.amount.toLocaleString() + '원' : '미확인');
      rows += '<div class="product-list"><div>최근 체결 [지연체결 시연]</div><p class="note">' + esc(u.name || latestFill.product) + ' ' + (latestFill.kind === 'buy-fill' ? '매수' : '매도') + ' · 체결 관측월 ' + esc(latestFill.month) + ' · 가격 기준일 ' + esc(latestFill.ptDate) + ' · 지점 ' + Number(latestFill.price).toLocaleString() + (latestFill.usableFrom ? ' · 시연 이용 가능일 ' + esc(latestFill.usableFrom) : '') + resultNote + '. 실제 거래 체결·세금·수수료를 재현한 것은 아니에요.</p></div>';
    }
    if(SCHOOL_MODE)rows+=schoolTrialNote();
    else rows+='<p><a href="'+(CASH_MODE?'?':'?economy=cash-events-trial')+'">'+(CASH_MODE?'기존 시험순저축 회귀로 돌아가기':'기존 저장을 그대로 두고 별도 현금사건 시험 회귀 보기')+'</a></p>';
    if(!SCHOOL_CASH_MODE)rows+='<p><a id="school-cash-mode-entry" href="?start=school-calendar-trial&amp;economy=cash-events-trial">기존 여섯 저장키를 그대로 두고 고1 달력+현금사건 연결 시험 보기</a></p>';
    if(!SCHOOL_MODE&&!CASH_MODE)rows+='<p><a id="school-mode-entry" href="?start=school-calendar-trial">기존 저장을 그대로 두고 생년월별 고1 달력 시작 시험 보기</a></p>';
    el.innerHTML = rows;
    if(CASH_MODE){const b=document.getElementById('cash-retry');if(b)b.onclick=()=>renderCashRepay();const policy=document.getElementById('cash-auto-toggle');if(policy)policy.onclick=()=>toggleCashAutomation();}
    if (state.pendingOrders && state.pendingOrders.length) {
      for (const o of state.pendingOrders) {
        const u = productRule(o.product);
        const line = document.createElement('div');
        line.className = 'row pending-order';
        const desc = o.kind === 'buy'
          ? '매수 접수 ' + o.amount.toLocaleString() + '원 (' + o.placedMonth + ' 접수)'
          : '매도 접수 (' + o.placedMonth + ', 수량 잠금)';
        line.innerHTML = '<span>└ ' + esc(u.name || o.product) + ' ' + desc + ((!o.obsCutoff || typeof o.obsPostClose !== 'boolean') ? ' · 구 형식: 접수 관측시각 미확인으로 체결 보류. 취소 가능' : '') + '</span>';
        const btn = document.createElement('button');
        btn.textContent = '주문 취소';
        btn.style.cssText = 'font-size:12px;padding:8px;min-height:44px;';
        btn.onclick = () => cancelOrder(o.id);
        line.appendChild(btn);
        el.appendChild(line);
      }
      const hint = document.createElement('div');
      hint.className = 'row pending-hint';
      hint.innerHTML = '<span style="font-size:12px;color:#666">대기 주문은 이후 진행 중 새로 관측되는 시세 지점에서 체결돼요. 자료 공백으로 장기간 미체결이 이어질 수 있어요 [지연체결 시연 모형]</span>';
      el.appendChild(hint);
    }
    const dl = document.getElementById('dash-link');
    if (dl) dl.onclick = () => renderDashboard();
  }

  function decisionInfo(choice) {
    const life={ 'life:scenario-study':'진학 시나리오로 시작 [과거 재학·일부 복무는 가정]', 'life:scenario-plain':'진로 이력 미정으로 시작', 'life:study':'공부·진학 선택', 'life:parttime':'고교 알바 경로 선택', 'life:job':'대학 졸업 후 취업 선택', 'life:fulltime':'대학 졸업 후 전업 선택', 'life:go-now':'바로 입대 선택', 'life:defer-1y':'입대1년 유예 선택 [시험가정]' };
    if(Object.prototype.hasOwnProperty.call(life,choice))return {group:'진로·복무 선택',label:life[choice]};
    if(choice==='cash-policy:enable-living'||choice==='cash-policy:disable-living')return {group:'가상청구 선택',label:choice==='cash-policy:enable-living'?'다음월부터 생활청구 조건부 자동납부 정책 켜기 [임의값]':'다음월부터 생활청구 자동납부 정책 끄기 [임의값]'};
    if(choice==='discharge-ok')return {group:'자동일정 확인',label:'자동 전역일정 확인 [전역일을 고른 선택이 아님]'};
    let m=typeof choice==='string'&&choice.match(/^cash-event:(paid|deferred):(\d{4}-(?:0[1-9]|1[0-2]))$/);
    if(m)return {group:'가상청구 선택',label:m[2]+' 청구 '+(m[1]==='paid'?'전액 가상납부':'미납을 남기고 보류')+' [임의값]'};
    m=typeof choice==='string'&&choice.match(/^cash-event:repay-month:(\d{4}-(?:0[1-9]|1[0-2]))$/);
    if(m)return {group:'가상청구 선택',label:m[1]+' 보류 청구 한 건 전액 재납부 [임의값]'};
    m=typeof choice==='string'&&choice.match(/^cash-event:repay:([1-9]\d*)$/);
    if(m)return {group:'가상청구 선택',label:'보류 청구 '+m[1]+'건 재납부 [임의값]'};
    m=typeof choice==='string'&&choice.match(/^(enter|enter-order|sell|sell-order):([a-z0-9]+):(\d+)$/);
    if(m&&Number(m[3])<=100){const u=DATA.unlocks.find(u=>u.product===m[2]);if(u)return {group:'매매 선택',label:u.name+' '+(m[1].startsWith('enter')?'매수':'매도')+(m[1].endsWith('order')?' 신청':' 실행')+' · 입력비중 '+m[3]+'% [실제 거래 아님]'};}
    m=typeof choice==='string'&&choice.match(/^cancel-order:([a-z0-9]+)$/);
    if(m){const u=DATA.unlocks.find(u=>u.product===m[1]);if(u)return {group:'매매 선택',label:u.name+' 대기주문 취소'};}
    return null;
  }
  function buildDecisionReview() {
    const relevant=state.history.filter(h=>h&&decisionInfo(h.choice));
    const exact=relevant.filter(h=>typeof h.decisionMonth==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(h.decisionMonth));
    return {version:1,source:'recorded-user-actions-v1',missingDateCount:relevant.length-exact.length,entries:exact.map(h=>({month:h.decisionMonth,choice:h.choice}))};
  }
  function validDecisionReview(r) {
    const mon=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
    return !!r&&r.version===1&&r.source==='recorded-user-actions-v1'&&Number.isInteger(r.missingDateCount)&&r.missingDateCount>=0&&Array.isArray(r.entries)&&r.entries.length<=2000&&r.entries.every(e=>e&&mon(e.month)&&decisionInfo(e.choice));
  }
  function decisionReviewHtml(record) {
    const r=record.decisionReview;
    if(!validDecisionReview(r))return '<p class="note decision-review-missing">주요선택 연표 근거 미기록·미확인 - 과거 선택월이나 자동이력을 추정하지 않습니다.</p>';
    const groups=['진로·복무·매매 흐름','가상청구 선택'];
    let html='<details class="decision-review"><summary>주요선택 연표 · 날짜기록 '+r.entries.length+'건</summary><p class="note">실제 버튼을 확정하기 전 게임 월입니다. 과거 history의 진행 후 월을 선택월로 바꾸지 않았습니다. 소급 가정한 재학·복무·자동졸업은 사용자가 고른 선택으로 채우지 않습니다. 매매 신청은 체결과 다르며, 납부는 임의 시험청구입니다. 아래 번호는 이 연표 안의 저장 순서입니다.</p>';
    if(r.missingDateCount)html+='<p class="note decision-review-partial">선택월 근거가 없는 이전 주요행동 '+r.missingDateCount+'건은 연표에서 제외했습니다. 기존 월을 거꾸로 추정하지 않았습니다.</p>';
    if(!r.entries.length)html+='<p class="note">날짜 근거가 남은 주요선택이 없습니다. 과거를 보완해 만들지 않습니다.</p>';
    for(const group of groups){const rows=r.entries.map((e,i)=>({...e,index:i+1,info:decisionInfo(e.choice)})).filter(e=>group==='가상청구 선택'?e.info.group===group:e.info.group!=='가상청구 선택');if(!rows.length)continue;html+='<details class="decision-group"><summary>'+esc(group)+' · '+rows.length+'건</summary><ol style="padding-left:22px;overflow-wrap:anywhere">'+rows.map(e=>'<li value="'+e.index+'"><strong>'+esc(e.month)+'</strong> · ['+esc(e.info.group)+'] '+esc(e.info.label)+'</li>').join('')+'</ol></details>';}
    return html+'</details>';
  }

  function activeDecisionComparisonHtml(lives, index) {
    const current=buildDecisionReview();
    let html='<section class="active-decision-review" aria-label="이번 회귀와 지난 회귀 선택 복기"><h3>이번 회귀와 지난 회귀 선택 복기</h3><p class="note">현재 게임 월 '+esc(state.month)+'까지 날짜 근거가 있는 선택을 같은 달끼리 나란히 봅니다. 같은 달이어도 생년·진로·진행 조건은 다를 수 있고, 과거 기록의 생년 근거가 없을 수 있습니다. 선택이 없는 칸은 행동이 없었다는 증거가 아닙니다. 수익 효과·추천·현실 진로우열을 계산하지 않습니다. 자동일정 확인은 사용자 선택과 따로 표시합니다.</p><div class="current-decision-review"><h4>이번 회귀 · 진행 중</h4>'+decisionReviewHtml({decisionReview:current}).replace('class="decision-review"','class="live-decision-timeline"').replaceAll('class="decision-group"','class="live-decision-group"')+'</div>';
    if(!lives.length)return html+'<p class="note">비교할 지난 회귀가 아직 없습니다. 이번 기록은 진행 중인 실제 선택만 읽습니다.</p></section>';
    html+='<label for="decision-life-select">함께 볼 지난 회귀</label> <select id="decision-life-select"><option value="">기록을 고르세요</option>'+lives.map((l,i)=>'<option value="'+i+'" '+(index===i?'selected':'')+'>#'+(i+1)+' · '+esc(l.ended||'종료월 미기록')+'</option>').join('')+'</select>';
    if(index===null)return html+'</section>';
    const past=lives[index].decisionReview;
    if(!validDecisionReview(past))return html+'<p class="note active-decision-missing">고른 지난 회귀의 주요선택 연표 근거가 미기록·미확인입니다. 진행 후 월로 선택월을 채우거나 차이를 계산하지 않습니다.</p></section>';
    const prior=past.entries.filter(e=>e.month<=state.month),now=current.entries.filter(e=>e.month<=state.month),months=[...new Set([...now,...prior].map(e=>e.month))].sort();
    html+='<p class="note">#'+(index+1)+' 기록과 비교 · 이번 '+now.length+'건 / 지난 '+prior.length+'건. 지난 회귀의 현재월 뒤 '+(past.entries.length-prior.length)+'건은 이 나란히 보기에서 제외합니다. 선택월 근거 누락: 이번 '+current.missingDateCount+'건 / 지난 '+past.missingDateCount+'건. 구기록을 보완하거나 저장을 고쳐 쓰지 않습니다.</p>';
    if(!months.length)html+='<p class="note">현재월까지 나란히 볼 날짜기록이 없습니다.</p>';
    const list=entries=>entries.length?'<ol>'+entries.map(e=>{const info=decisionInfo(e.choice);return '<li>['+esc(info.group)+'] '+esc(info.label)+'</li>'}).join('')+'</ol>':'<p class="note">이 달의 주요선택 날짜기록 없음</p>';
    html+='<details class="decision-month-comparison"><summary>같은 달 선택 펼치기 · '+months.length+'개월</summary>'+months.map(month=>'<section class="decision-month"><h4>'+esc(month)+'</h4><div class="decision-current"><strong>이번 회귀</strong>'+list(now.filter(e=>e.month===month))+'</div><div class="decision-prior"><strong>지난 회귀 #'+(index+1)+'</strong>'+list(prior.filter(e=>e.month===month))+'</div></section>').join('')+'</details></section>';
    return html;
  }

  // 회귀 기록 대시보드 (1차 기획 확정 10: 단회성 인생 + 영구 기록)
  function renderDashboard(selected = [], decisionIndex = null) {
    if (storageWriteBlocked) return showStorageWriteUnavailable();
    if (storageReadBlocked) return showStorageReadUnavailable();
    const card = document.getElementById('turn-card');
    const box = document.getElementById('choices');
    box.innerHTML = '';
    const lives = readLives();
    if (!lives) return;
    const causeLabel = { chaos: '역사 변경(카오스 한계)', 'demo-end': '시제품 구간 종료', 'natural-end': '인생 결산(전체 구간 종료)' };
    const cashRecordHtml=l=>{const c=l.cashFlowSummary;if(!CASH_MODE)return '';if(!c||!['income','paid','unpaid'].every(k=>Number.isFinite(c[k])&&c[k]>=0)||!Number.isInteger(c.months)||c.months<0||c.months>(SCHOOL_CASH_MODE&&l.schoolStart?((2026-Number(l.schoolStart.startMonth.slice(0,4)))*12+10-Number(l.schoolStart.startMonth.slice(5))):367)||!Number.isFinite(l.totalAssets))return '<p class="note">현금사건 요약 근거 미확인 - 과거 금액을 추정하지 않아요.</p>';return '<p class="cash-record-summary note">별도 현금사건 시험 '+c.months+'개월 / 수입 +'+c.income.toLocaleString()+'원 / 납부 -'+c.paid.toLocaleString()+'원 / 미납 '+c.unpaid.toLocaleString()+'원 / 미납차감 시연순자산 '+(l.totalAssets-c.unpaid).toLocaleString()+'원.'+(Number.isInteger(c.automaticPaidMonths)&&c.automaticPaidMonths>=0&&c.automaticPaidMonths<=c.months?' 자동납부 기록 '+c.automaticPaidMonths+'개월.':' 자동납부 분리근거 미기록.')+' 총자산 비교는 미납 차감 전이며 현실 진로우열이 아니에요.</p>'};
    const pathLabel = { 'study': '진학 준비(학생)', 'parttime': '알바로 종잣돈 마련 중',
      'study-job': '진학 후 취업', 'study-fulltime': '진학 후 전업투자', 'parttime-fulltime': '알바 후 전업투자' };
    selected=selected.filter((i,n,arr)=>Number.isInteger(i)&&i>=0&&i<lives.length&&arr.indexOf(i)===n).slice(0,2);
    decisionIndex=Number.isInteger(decisionIndex)&&decisionIndex>=0&&decisionIndex<lives.length?decisionIndex:null;
    let html = '<div class="date">회귀 기록</div><h2>지난 인생 대시보드</h2>'+activeDecisionComparisonHtml(lives,decisionIndex);
    if(lives.length>1 && !CASH_MODE){
      html+='<section class="life-comparison" aria-label="선택한 두 기록 비교"><h3>내가 고른 두 기록</h3><p>아래에서 두 기록을 골라 시작자금·시험 순저축·잔차를 함께 보세요. 선택은 이 화면에서만 유지되며 원본 기록을 바꾸지 않아요.</p>';
      html+='<p id="life-selection-status">'+selected.map(i=>'#'+(i+1)).join(' / ')+' · '+selected.length+'/2개 선택</p>';
      if(selected.length===2){
        const [a,b]=selected.map(i=>lives[i]),c=ReturnAssetReview.compareSnapshots(a.assetReview,a.totalAssets,b.assetReview,b.totalAssets);
        selected.forEach((index,n)=>{const l=lives[index],r=n===0?c.left:c.right;html+='<div class="selected-life"><h4>'+ (n+1)+'번째 · #'+(index+1)+' · '+esc(pathLabel[l.path]||'진로 미기록')+'</h4><p>'+esc(l.ended||'종료월 미기록')+' 종료 / 관측 '+esc(l.observationMonth||'미기록')+'</p>'+assetReviewHtml(r,true)+'</div>'});
        if(c.available){const money=n=>(n>0?'+':'')+n.toLocaleString('ko-KR',{maximumFractionDigits:2})+'원';html+='<div class="life-difference"><h4>두 번째 - 첫 번째 기록</h4><div class="row"><span>기록 개월 차이</span><strong>'+c.differences.months+'개월</strong></div>'+[['시작자금 차이','openingAssets'],['시험 순저축 차이','recordedSavings'],['상품 변화 등 잔차 차이','assetChangeRemainder'],['총자산 차이','totalAssets']].map(([label,key])=>'<div class="row"><span>'+label+'</span><strong>'+money(c.differences[key])+'</strong></div>').join('')+'<p class="note">금액의 분해 차이일 뿐 수익률·투자 실력·현실 진로의 우열이 아니에요. 같은 개월이어도 진로·시험 순저축·선택이 달라 조건을 통제한 비교가 아니에요.</p></div>'}
        else html+='<p class="note comparison-unavailable">분해 근거가 온전한 두 기록이 아니어서 차이를 계산하지 않았어요. 빠진 과거를 추측하거나 원본 기록을 고쳐 쓰지 않아요.</p>';
      }
      html+='<button type="button" id="life-selection-clear" '+(!selected.length?'disabled':'')+'>비교 선택 해제</button></section>';
    }
    if (!lives.length) {
      html += '<p>아직 닫힌 인생이 없습니다. 첫 회귀의 기록이 여기에 남습니다.</p>';
    } else {
      const best = lives.reduce((a, b) => b.totalAssets > a.totalAssets ? b : a, lives[0]);
      lives.forEach((l, i) => {
        const pathTxt = (l.path && pathLabel[l.path]) ? pathLabel[l.path] : '진로 미기록';
        html += '<div style="border-bottom:1px solid var(--line);padding:8px 0">' +
          '<div class="row"><span>#' + (i + 1) + ' · ' + l.ended + ' 종료</span><span>' + (causeLabel[l.cause] || l.cause || '기록 없음') + '</span></div>' +
          '<div class="row life-record-assets"><span>' + pathTxt + '</span><strong>최종 자산 ' + (l.totalAssets || 0).toLocaleString() + '원' + (l === best && !CASH_MODE ? ' · 최고 기록' : '') + '</strong></div>' + cashRecordHtml(l) + decisionReviewHtml(l) +
          (CASH_MODE?'':assetReviewHtml(ReturnAssetReview.inspectSnapshot(l.assetReview,l.totalAssets),true)) + (lives.length>1&&!CASH_MODE?'<button type="button" class="life-select" data-life-index="'+i+'" aria-pressed="'+selected.includes(i)+'" '+(!selected.includes(i)&&selected.length===2?'disabled':'')+'>'+ (selected.includes(i)?'#'+(i+1)+' 비교에서 빼기':'#'+(i+1)+' 비교에 넣기')+'</button>':'')+'</div>';
      });
      html += CASH_MODE ? '<p class="note">별도 현금사건 시험 회귀기록입니다. 총자산은 미납 차감 전입니다. 각 기록의 수입·납부·미납·시연순자산을 함께 읽고 실제 진로우열·투자실력·수익률 순위로 해석하지 마세요. 원래 시험순저축 모형의 기록과 합치지 않습니다. 이 기기에만 저장됩니다.</p>' : '<p class="note">최고 기록은 시연 총자산 기준이며 투자 실력·수익률 순위가 아니에요. 진행 개월과 진로의 시험 순저축이 다르면 단순 비교할 수 없어요. 실제 학비·생활비·세금은 미연결이에요.</p><p class="note">고정 목표 자산은 없습니다. 최고 기록 갱신이 이 게임의 장기 목표예요. 기록은 이 기기에만 저장됩니다.</p>';
    }
    card.innerHTML = html;
    card.querySelectorAll('.life-select').forEach(button=>{button.onclick=()=>{const i=Number(button.dataset.lifeIndex);renderDashboard(selected.includes(i)?selected.filter(x=>x!==i):[...selected,i],decisionIndex);document.querySelector('.life-select[data-life-index="'+i+'"]')?.focus()}});
    const clear=card.querySelector('#life-selection-clear');if(clear)clear.onclick=()=>{renderDashboard([],decisionIndex);document.querySelector('.life-select')?.focus()};
    const decisionSelect=card.querySelector('#decision-life-select');
    if(decisionSelect)decisionSelect.onchange=()=>{const value=decisionSelect.value;renderDashboard(selected,value===''?null:Number(value));document.getElementById('decision-life-select')?.focus()};
    const back = document.createElement('button');
    back.textContent = '돌아가기';
    back.onclick = () => render();
    box.appendChild(back);
  }

  function sourceLabel(url) {
    const names={'www.yna.co.kr':'연합뉴스','www.khan.co.kr':'경향신문','www.inews24.com':'아이뉴스24','www.seoul.co.kr':'서울신문','www.mk.co.kr':'매일경제','www.ajunews.com':'아주경제','www.ebn.co.kr':'EBN','www.koreaherald.com':'코리아헤럴드','www.newsis.com':'뉴시스','www.etoday.co.kr':'이투데이','www.fsc.go.kr':'금융위원회','www.etnews.com':'전자신문','www.newswire.co.kr':'뉴스와이어(발표문)','www.sedaily.com':'서울경제','www.busan.com':'부산일보','news.kbs.co.kr':'KBS','www.munhwa.com':'문화일보','biz.chosun.com':'조선일보(조선비즈 보관)','www.joongang.co.kr':'중앙일보','encykorea.aks.ac.kr':'한국민족문화대백과','www.g-enews.com':'글로벌이코노믹','news.sbs.co.kr':'SBS','elischolar.library.yale.edu':'재정경제원 자료(Yale 보관)','www.hani.co.kr':'한겨레','www.asiae.co.kr':'아시아경제','www.asiatoday.co.kr':'아시아투데이','mofe.go.kr':'기획재정부 용어사전'};
    try {const h=new URL(url).hostname;return names[h]||h;} catch(e){return '원출처';}
  }

  function sourceDetails(ev) {
    if (!ev || ev.kind !== 'news') return '';
    const v = ev.validation || {};
    const scoped = Array.isArray(v.source_urls) && v.source_urls.length;
    const fullScoped = typeof v.article === 'string' && v.article.startsWith('selected_body_passages_read; not_all_claims_independently_verified');
    const priceOnly = ev.verification === 'price-only-verified';
    const lines = !fullScoped && !priceOnly && ev.validation_display ? ['수치: ' + ev.validation_display.numeric, '날짜: ' + ev.validation_display.date, '기사 본문: ' + ev.validation_display.article, '당시 공개 여부: ' + ev.validation_display.point_in_time] : priceOnly ? [
      '수치: 확보된 지수 종가와 일치', '날짜: 시세 행의 날짜 확인',
      '기사 본문: 당일 기사 미확보', '당시 공개 여부: 해당일까지의 시세만 사용, 정확한 공개 시각 미확인'
    ] : fullScoped ? [
      '수치: 카드의 지수 종가를 확보 시계열과 대조. 다른 숫자는 기사 근거 범위만 확인',
      '날짜: 사건일·기사 날짜 대조. 정확한 보도 시각은 별도',
      '기사 본문: 선택한 구절 대조. 모든 주장 독립 검증을 뜻하지 않음',
      '당시 공개 여부: 알려진 사후 사실은 본문에서 제외. 최초 공개 시각은 일부 미확인'
    ] : [
      '수치·날짜·기사 본문·당시 공개 여부: 기존 근거 기록의 전체 재감사는 미완료. 이번에는 본문의 시점 표현만 점검',
      '반영된 카드 수와 모든 사실 검증 완료는 다릅니다'
    ];
    const links = scoped ? '<ul>' + v.source_urls.filter(url => /^https:\/\//.test(url)).map((url, i) =>
      '<li><a target="_blank" rel="noopener noreferrer" href="' + esc(url) + '">' + esc(sourceLabel(url)) + ' · ' + esc((v.source_metadata && v.source_metadata[url]) || ('사건일 ' + (ev.event_date || ev.event_month || ev.date))) + '</a></li>').join('') + '</ul>' : '';
    return '<details class="source-details"><summary>근거와 검증 범위</summary><ul>' +
      lines.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' + links +
      '<p class="muted">게임은 시연 모형이며 정확한 체결·보도 시각을 재현하지 않습니다.</p></details>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  boot();
})();
