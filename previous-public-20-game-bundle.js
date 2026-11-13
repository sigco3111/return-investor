import { FUND_SCALE_ROWS, FUND_SCALE_DATA_ID } from "./fund-scale-data.mjs";
import { FOREIGN_FUND_SCALE_RULES, FOREIGN_FUND_SCALE_IMPLEMENTATION, inspectForeignFundTag, foreignFundDenominator } from "./foreign-fund-scale.mjs";
import { marketLifeChapter, homeLifeChapter, lifeClosingChapter } from "./life-chapters.mjs";
import { FOREIGN_ETF_RULES, FOREIGN_ETF_PRODUCTS, inspectForeignTag } from "./foreign-etfs.mjs";
import * as HomeContract from "./property-contract.mjs";
import { PROPERTY_PRICE_MODEL, propertyPrices, estimatedPropertyPrice } from "./property-prices.mjs";
(function() {
  const module = void 0;
  const exports = void 0;
  (function(root) {
    "use strict";
    const ID = "trial-net-savings-v1";
    function descriptor(id = ID) {
      return { id, schemaVersion: 1 };
    }
    function inspect(state, expected = ID) {
      if (!state || typeof state !== "object" || Array.isArray(state)) return { ok: false, reason: "invalid-state" };
      if (!Object.prototype.hasOwnProperty.call(state, "economyModel")) return expected === ID ? { ok: true, legacy: true, id: ID } : { ok: false, reason: "missing-cash-model" };
      const m = state.economyModel;
      if (!m || typeof m !== "object" || Array.isArray(m) || Object.keys(m).sort().join(",") !== "id,schemaVersion" || m.id !== expected || ![ID, "trial-cash-events-v1", "trial-school-cash-events-v1", "game-living-2019q3-v1", "career-cash-events-v1"].includes(expected) || m.schemaVersion !== 1)
        return { ok: false, reason: "unsupported-economic-model" };
      if (["trial-cash-events-v1", "trial-school-cash-events-v1"].includes(expected)) {
        const c = state.cashEvents, obj = (x) => x && typeof x === "object" && !Array.isArray(x), month = (x) => typeof x === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
        if (!obj(c) || Object.keys(c).sort().join(",") !== "rows,tuitionIssued,version" || Object.prototype.hasOwnProperty.call(state, "savingsLedger") || c.version !== 1 || typeof c.tuitionIssued !== "boolean" || !Array.isArray(c.rows) || c.rows.length > 500) return { ok: false, reason: "invalid-cash-events" };
        const seen = /* @__PURE__ */ new Set(), idx = (m2) => Number(m2.slice(0, 4)) * 12 + Number(m2.slice(5)) - 1, startMonth = expected === "trial-school-cash-events-v1" && state.schoolStart ? state.schoolStart.startMonth : "1996-03", start = idx(startMonth);
        if (!month(startMonth) || startMonth < "1990-03" || startMonth > "2026-10" || expected === "trial-cash-events-v1" && startMonth !== "1996-03") return { ok: false, reason: "cash-start-month" };
        if (!month(state.month) || c.rows.length !== Math.min(idx(state.month), idx("2026-10")) - start) return { ok: false, reason: "cash-month-coverage" };
        for (const [i, r] of c.rows.entries()) {
          if (!obj(r) || Object.keys(r).sort().join(",") !== "income,living,month,paid,status,tuition" || !month(r.month) || idx(r.month) !== start + i + 1 || seen.has(r.month) || ![0, 3e5].includes(r.income) || r.living !== 1e5 || ![0, 8e5].includes(r.tuition) || !["due", "paid", "deferred"].includes(r.status) || !Number.isFinite(r.paid) || r.paid < 0 || r.paid > r.living + r.tuition || r.paid !== (r.status === "paid" ? r.living + r.tuition : 0)) return { ok: false, reason: "invalid-cash-row" };
          seen.add(r.month);
        }
        if (Object.prototype.hasOwnProperty.call(state, "cashAutomation")) {
          const a = state.cashAutomation;
          if (!obj(a) || Object.keys(a).sort().join(",") !== "enabled,enabledAfterMonth,paidMonths,version" || a.version !== 1 || typeof a.enabled !== "boolean" || !month(a.enabledAfterMonth) || a.enabledAfterMonth < startMonth || a.enabledAfterMonth > state.month || !Array.isArray(a.paidMonths) || a.paidMonths.length > c.rows.length || new Set(a.paidMonths).size !== a.paidMonths.length || a.paidMonths.some((m2, i) => !month(m2) || i > 0 && m2 <= a.paidMonths[i - 1] || !c.rows.some((r) => r.month === m2 && r.tuition === 0 && r.status === "paid" && r.paid === r.living))) return { ok: false, reason: "invalid-cash-automation" };
        }
        if (c.rows.filter((r) => r.status === "due").length > 1 || c.rows.some((r, i) => r.status === "due" && i !== c.rows.length - 1) || c.rows.filter((r) => r.tuition > 0).length > 1 || c.tuitionIssued !== c.rows.some((r) => r.tuition > 0)) return { ok: false, reason: "invalid-cash-sequence" };
      }
      if (expected === "career-cash-events-v1") {
        const c = state.cashEvents, obj = (x) => x && typeof x === "object" && !Array.isArray(x), month = (x) => typeof x === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
        if (!obj(c) || Object.keys(c).sort().join(",") !== "rows,version" || c.version !== 1 || !Array.isArray(c.rows) || c.rows.length > 500) return { ok: false, reason: "invalid-career-cash-events" };
        const seen = /* @__PURE__ */ new Set(), idx = (m2) => Number(m2.slice(0, 4)) * 12 + Number(m2.slice(5)) - 1, startMonth = state.schoolStart ? state.schoolStart.startMonth : null;
        if (!startMonth || !month(startMonth) || startMonth < "1990-03" || startMonth > "2026-10") return { ok: false, reason: "cash-start-month" };
        if (!month(state.month) || c.rows.length !== Math.min(idx(state.month), idx("2026-10")) - idx(startMonth)) return { ok: false, reason: "cash-month-coverage" };
        for (const [i, r] of c.rows.entries()) {
          if (!obj(r) || Object.keys(r).sort().join(",") !== "income,living,month,paid,status,tuition" || !month(r.month) || idx(r.month) !== idx(startMonth) + i + 1 || seen.has(r.month) || ![0, 2e5, 15e5].includes(r.income) || ![0, 1e5, 7e5].includes(r.living) || ![0, 9e5].includes(r.tuition) || !["paid", "partial"].includes(r.status) || !Number.isFinite(r.paid) || r.paid < 0 || r.paid > r.living + r.tuition || r.status === "paid" && r.paid !== r.living + r.tuition || r.status === "partial" && r.paid >= r.living + r.tuition) return { ok: false, reason: "invalid-career-cash-row" };
          seen.add(r.month);
        }
      }
      return { ok: true, legacy: false, id: expected };
    }
    function inspectCore(state) {
      const obj = (x) => x && typeof x === "object" && !Array.isArray(x);
      if (!obj(state) || typeof state.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(state.month) || !Number.isFinite(state.cash) || state.cash < 0 || !Number.isFinite(state.chaos) || state.chaos < 0 || !obj(state.flags) || !obj(state.holdings) || !Array.isArray(state.history) || !Array.isArray(state.unlocksSeen) || !Number.isInteger(state.eventIndex) || state.eventIndex < 0 || !Number.isInteger(state.turnCount) || state.turnCount < 0)
        return { ok: false, reason: "invalid-save-core" };
      return { ok: true };
    }
    function inspectRaw(raw) {
      if (raw === null) return { ok: true, exists: false, state: null };
      try {
        const state = JSON.parse(raw), result = inspectCore(state);
        return result.ok ? { ok: true, exists: true, state } : { ok: false, exists: true, reason: result.reason };
      } catch (_) {
        return { ok: false, exists: true, reason: "unreadable-save-json" };
      }
    }
    function inspectNested(state, products) {
      const obj = (x) => x && typeof x === "object" && !Array.isArray(x);
      const num = (x) => Number.isFinite(x) && x >= 0;
      const mon = (x) => typeof x === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
      const present = (k) => Object.prototype.hasOwnProperty.call(state, k);
      const fail = (reason) => ({ ok: false, reason });
      const known = (p) => typeof p === "string" && products.includes(p);
      for (const [product, h] of Object.entries(state.holdings)) {
        if (!known(product) || !obj(h) || !num(h.qty) || !num(h.avgPrice) || h.invested != null && !num(h.invested) || h.entryMonth != null && !mon(h.entryMonth)) return fail("invalid-holding");
      }
      if (present("pendingOrders")) {
        if (!Array.isArray(state.pendingOrders)) return fail("invalid-orders");
        const ids = /* @__PURE__ */ new Set();
        for (const o of state.pendingOrders) {
          if (!obj(o) || typeof o.id !== "string" || !o.id || ids.has(o.id) || !known(o.product) || !["buy", "sell"].includes(o.kind) || !mon(o.placedMonth)) return fail("invalid-order");
          ids.add(o.id);
          if (o.kind === "buy" ? !num(o.amount) || o.amount <= 0 : !num(o.qty) || o.qty <= 0 || !num(o.avgPrice) || !num(o.costBasis) || o.investedShare != null && !num(o.investedShare)) return fail("invalid-order-money");
          if (o.expiresAt != null && (o.kind !== "buy" || !mon(o.expiresAt) || o.expiresAt <= o.placedMonth)) return fail("invalid-order-expiry");
          if (Object.prototype.hasOwnProperty.call(o, "conditionRules") && (o.conditionRules !== 1 || o.reserve || o.condition && (!["above", "below"].includes(o.condition.op) || !num(o.condition.value) || o.condition.value <= 0))) return fail("invalid-directional-order");
          if (o.obsCutoff != null && (typeof o.obsCutoff !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.obsCutoff)) || o.obsPostClose != null && typeof o.obsPostClose !== "boolean") return fail("invalid-order-observation");
        }
      }
      if (present("decisionPaceRules") && (state.decisionPaceRules !== 1 || state.careerCycleRules !== 1)) return fail("invalid-decision-pace-rules");
      if (present("decisionPaceReport")) {
        const r = state.decisionPaceReport;
        if (!obj(r) || Object.keys(r).sort().join(",") !== "expiries,fills,from,reason,steps,to,unpaidAdded,version" || r.version !== 1 || state.decisionPaceRules !== 1 || !mon(r.from) || !mon(r.to) || r.from > r.to || r.to > state.month || !Number.isInteger(r.steps) || r.steps < 0 || r.steps > 500 || r.steps !== (Number(r.to.slice(0, 4)) - Number(r.from.slice(0, 4))) * 12 + Number(r.to.slice(5)) - Number(r.from.slice(5)) || typeof r.reason !== "string" || r.reason.length > 32 || ![r.fills, r.expiries].every((x) => Number.isInteger(x) && x >= 0) || !num(r.unpaidAdded)) return fail("invalid-decision-pace-report");
      }
      if (present("careerCycleRules") && (state.careerCycleRules !== 1 || state.cashPlanRules !== 1)) return fail("invalid-career-cycle-rules");
      if (present("careerCycle")) {
        const p = state.careerCycle;
        if (!obj(p) || Object.keys(p).sort().join(",") !== "changedMonth,from,to,version" || p.version !== 1 || !mon(p.changedMonth) || p.changedMonth > state.month || !["03", "06", "09", "12"].includes(p.changedMonth.slice(5)) || !["job", "fulltime", "alba"].includes(p.from) || !["job", "fulltime", "alba"].includes(p.to) || p.from === p.to || state.careerCycleRules !== 1 || (p.to === "job" ? state.flags.career !== "job" : state.flags.career !== "fulltime") || (p.to === "alba" ? state.flags.recoveryJob !== "alba" : state.flags.recoveryJob === "alba")) return fail("invalid-career-cycle");
      }
      if (present("cashReservePolicy")) {
        const p = state.cashReservePolicy;
        if (!obj(p) || Object.keys(p).sort().join(",") !== "amount,enabledAfterMonth,version" || p.version !== 1 || ![0, 7e5, 21e5, 42e5].includes(p.amount) || !mon(p.enabledAfterMonth) || p.enabledAfterMonth > state.month || state.cashPlanRules !== 1) return fail("invalid-cash-reserve-policy");
      }
      if (present("cashPlanRules") && (state.cashPlanRules !== 1 || state.economyModel?.id !== "career-cash-events-v1" || state.careerCashRules !== 3 || state.jobPlanProductRules !== 1 || state.directionConditionRules !== 1)) return fail("invalid-cash-plan-rules");
      if (present("directionConditionRules") && state.directionConditionRules !== 1) return fail("invalid-direction-condition-rules");
      if (present("jobPlanProductRules") && state.jobPlanProductRules !== 1) return fail("invalid-job-plan-product-rules");
      if (present("jobSavingsPlan")) {
        const p = state.jobSavingsPlan;
        if (!obj(p) || Object.prototype.hasOwnProperty.call(p, "product") && (state.jobPlanProductRules !== 1 || !["kospi", "fx", "usdeposit"].includes(p.product)) || p.version !== 1 || ![0, 50, 100].includes(p.percent) || !mon(p.enabledAfterMonth) || p.enabledAfterMonth > state.month || !Array.isArray(p.appliedMonths) || p.appliedMonths.length > 500 || p.appliedMonths.some((m, i) => !mon(m) || m > state.month || i > 0 && m <= p.appliedMonths[i - 1])) return fail("invalid-job-savings-plan");
      }
      if (present("savingsLedger") && (!Array.isArray(state.savingsLedger) || state.savingsLedger.some((r) => !obj(r) || !mon(r.month) || !num(r.amount) || typeof r.reason !== "string"))) return fail("invalid-savings-ledger");
      if (present("interestLedger") && (!Array.isArray(state.interestLedger) || state.interestLedger.some((r) => !obj(r) || !mon(r.month) || !Array.isArray(r.entries) || r.entries.some((e) => !obj(e) || !known(e.product) || !num(e.balanceBefore) || !num(e.balanceAfter) || !num(e.interest) || !num(e.annualRate) || typeof e.rateLabel !== "string" || !["KRW", "USD"].includes(e.unit))))) return fail("invalid-interest-ledger");
      if (state.flags.birth != null) {
        const b = state.flags.birth;
        if (!obj(b) || !Number.isInteger(b.year) || !Number.isInteger(b.month) || b.month < 1 || b.month > 12 || !Number.isInteger(b.hsYear)) return fail("invalid-birth");
      }
      if (state.flags.lifeDone != null && !obj(state.flags.lifeDone)) return fail("invalid-life-flags");
      return { ok: true };
    }
    const api = Object.freeze({ descriptor, inspect, inspectCore, inspectRaw, inspectNested });
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.ReturnEconomyPolicy = api;
  })(typeof globalThis !== "undefined" ? globalThis : this);
  (function(root) {
    "use strict";
    const monthIndex = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1 : null;
    function review(state, totalAssets) {
      const b = state.assetReviewBaseline;
      if (!b) return { available: false, reason: "missing-baseline" };
      if (b.version !== 1 || b.source !== "new-game" || monthIndex(b.month) === null || b.totalAssets !== 1e6 || Object.keys(b).sort().join(",") !== "month,source,totalAssets,version") return { available: false, reason: "unsupported-baseline" };
      const at = monthIndex(state.month), end = monthIndex("2026-10"), start = monthIndex(b.month), log = state.savingsLedger || [];
      if (at === null || at < start || !Array.isArray(log) || !Number.isFinite(totalAssets)) return { available: false, reason: "invalid-range" };
      const months = Math.min(at, end) - start;
      if (log.length !== months) return { available: false, reason: "incomplete-savings" };
      let savings = 0;
      const groups = /* @__PURE__ */ Object.create(null);
      for (let i = 0; i < log.length; i++) {
        const r = log[i];
        if (!r || monthIndex(r.month) !== start + i + 1 || !Number.isFinite(r.amount) || r.amount < 0 || r.basis !== "test-net-savings-v1") return { available: false, reason: "incomplete-savings" };
        savings += r.amount;
        if (!Number.isFinite(savings)) return { available: false, reason: "invalid-savings-total" };
        const reason = typeof r.reason === "string" ? r.reason : "\uAD6C\uBD84 \uBBF8\uAE30\uB85D";
        groups[reason] = (groups[reason] || 0) + r.amount;
      }
      return { available: true, basis: "trial-asset-review-v1", startMonth: b.month, endMonth: state.month, months, openingAssets: b.totalAssets, recordedSavings: savings, assetChangeRemainder: totalAssets - b.totalAssets - savings, totalAssets, savingsByReason: groups };
    }
    function inspectSnapshot(r, expectedTotal) {
      if (!r || r.available !== true) return { available: false, reason: "missing-recorded-review" };
      const start = monthIndex(r.startMonth), end = monthIndex(r.endMonth);
      if (r.basis !== "trial-asset-review-v1" || start === null || r.openingAssets !== 1e6 || end === null || end < start || r.months !== Math.min(end, monthIndex("2026-10")) - start) return { available: false, reason: "unsupported-recorded-review" };
      const amounts = [r.openingAssets, r.recordedSavings, r.assetChangeRemainder, r.totalAssets, expectedTotal];
      if (!amounts.every(Number.isFinite) || r.recordedSavings < 0 || r.totalAssets !== expectedTotal || Math.abs(r.openingAssets + r.recordedSavings + r.assetChangeRemainder - r.totalAssets) > 1e-6) return { available: false, reason: "invalid-recorded-review" };
      const g = r.savingsByReason;
      if (!g || typeof g !== "object" || Array.isArray(g) || !Object.values(g).every((v) => Number.isFinite(v) && v >= 0) || Math.abs(Object.values(g).reduce((a, b) => a + b, 0) - r.recordedSavings) > 1e-6) return { available: false, reason: "invalid-recorded-groups" };
      return r;
    }
    function compareSnapshots(a, aTotal, b, bTotal) {
      const left = inspectSnapshot(a, aTotal), right = inspectSnapshot(b, bTotal);
      if (!left.available || !right.available) return { available: false, reason: "missing-comparable-review", left, right };
      const differences = { months: right.months - left.months, openingAssets: right.openingAssets - left.openingAssets, recordedSavings: right.recordedSavings - left.recordedSavings, assetChangeRemainder: right.assetChangeRemainder - left.assetChangeRemainder, totalAssets: right.totalAssets - left.totalAssets };
      if (!Object.values(differences).every(Number.isFinite)) return { available: false, reason: "nonfinite-comparison", left, right };
      return { available: true, basis: "trial-asset-review-v1", left, right, differences };
    }
    const api = { review, inspectSnapshot, compareSnapshots };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.ReturnAssetReview = api;
  })(typeof window !== "undefined" ? window : globalThis);
  (function(root) {
    "use strict";
    const VERSION = 1;
    const SOURCES = Object.freeze([
      "https://www.law.go.kr/lsInfoP.do?lsiSeq=5542&ancYd=19810213&ancNo=03370&efYd=19810301&nwJoYnInfo=N&efGubun=Y&chrClsCd=010202&ancYnChk=0#0000",
      "https://www.korea.kr/briefing/policyBriefingView.do?newsId=148652811"
    ]);
    const monthIndex = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1;
    const monthValid = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
    const fromIndex = (n) => String(Math.floor(n / 12)).padStart(4, "0") + "-" + String(n % 12 + 1).padStart(2, "0");
    function nominal(birthYear, birthMonth) {
      if (!Number.isInteger(birthYear) || birthYear < 1975 || birthYear > 2010 || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return { ok: false, reason: "unsupported-birth-month" };
      const earlyCohort = birthYear <= 2002 && birthMonth <= 2;
      const primaryYear = birthYear + (earlyCohort ? 6 : 7);
      return {
        ok: true,
        version: VERSION,
        birthYear,
        birthMonth,
        earlyCohort,
        primaryYear,
        middleYear: primaryYear + 6,
        highYear: primaryYear + 9,
        highStart: primaryYear + 9 + "-03",
        highEnd: primaryYear + 12 + "-02",
        basis: earlyCohort ? "pre-2009-march-cohort" : "calendar-year-cohort-or-march-december",
        nominalProgressionOnly: true,
        individualSchoolHistoryVerified: false,
        exactBirthdayUsed: false
      };
    }
    function monthsBetween(start, end) {
      if (!monthValid(start) || !monthValid(end)) throw Error("Invalid month");
      return monthIndex(end) - monthIndex(start);
    }
    function startPlan(birthYear, birthMonth, end = "2026-10", currentStart = "1996-03") {
      const c = nominal(birthYear, birthMonth);
      if (!c.ok) return c;
      if (!monthValid(end) || !monthValid(currentStart)) return { ok: false, reason: "invalid-boundary" };
      if (c.highStart > end) return { ok: false, reason: "school-start-after-game-end", calendar: c };
      const elapsed = monthsBetween(c.highStart, end), delta = monthsBetween(c.highStart, currentStart);
      return {
        ok: true,
        version: VERSION,
        calendar: c,
        startMonth: c.highStart,
        endMonth: end,
        calendarMonthsInclusive: elapsed + 1,
        monthlyTransitionsThroughEnd: elapsed,
        oldPrototypeStart: currentStart,
        oldPrototypeStartMinusCohortStartMonths: delta,
        relationToOldStart: delta > 0 ? "cohort-earlier" : delta < 0 ? "cohort-later" : "same",
        earliestMonthlyEconomicRow: elapsed ? fromIndex(monthIndex(c.highStart) + 1) : null,
        finalObservationMonth: fromIndex(monthIndex(end) + 1),
        economicRowsIncludeStartingMonth: false,
        finalObservationAddsEconomicRow: false,
        migrationAllowed: false,
        planDoesNotMutateGame: true
      };
    }
    function recordedCoverage(plan, { eventDates = [], priceDates = [] } = {}) {
      if (!plan?.ok || !monthValid(plan.startMonth) || !monthValid(plan.endMonth)) return { ok: false, reason: "invalid-plan" };
      const news = new Set(eventDates.filter((x) => typeof x === "string" && /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(x)).map((x) => x.slice(0, 7)));
      const prices = new Set(priceDates.filter((x) => typeof x === "string" && /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(x)).map((x) => x.slice(0, 7)));
      const months = [];
      for (let i = monthIndex(plan.startMonth); i <= monthIndex(plan.endMonth); i++) {
        const month = fromIndex(i);
        months.push({ month, recordedNews: news.has(month), recordedPricePoint: prices.has(month) });
      }
      return {
        ok: true,
        months,
        noRecordedNewsMonths: months.filter((x) => !x.recordedNews).length,
        noRecordedPricePointMonths: months.filter((x) => !x.recordedPricePoint).length,
        priceCountIsAggregateNotPerProduct: true,
        absenceDoesNotProveQuietMonth: true,
        recordedPointsAreNotAccessOrVerificationEvidence: true
      };
    }
    const api = Object.freeze({ VERSION, SOURCES, nominal, startPlan, monthsBetween, recordedCoverage });
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.ReturnSchoolCalendar = api;
  })(typeof globalThis !== "undefined" ? globalThis : this);
  (function(root) {
    "use strict";
    var PENSION_RATE_PER_MILLE = 20;
    var EI_RATE_PER_MILLE = 3;
    var PENSION_MIN_WORKERS = 5;
    var EI_MIN_WORKERS = 30;
    var EI_WINDOW = { from: "1995-07", to: "1997-12" };
    var HEALTH_LEGAL_RANGE_PER_MILLE = [20, 80];
    var PENSION_GRADE_FROM = "1995-04";
    var PENSION_GRADE_TABLE = [
      [0, 22e4],
      [225e3, 23e4],
      [235e3, 24e4],
      [245e3, 25e4],
      [255e3, 26e4],
      [265e3, 27e4],
      [28e4, 29e4],
      [3e5, 31e4],
      [325e3, 34e4],
      [355e3, 37e4],
      [385e3, 4e5],
      [42e4, 44e4],
      [46e4, 48e4],
      [5e5, 52e4],
      [545e3, 57e4],
      [595e3, 62e4],
      [645e3, 67e4],
      [7e5, 73e4],
      [76e4, 79e4],
      [82e4, 85e4],
      [885e3, 92e4],
      [955e3, 99e4],
      [1025e3, 106e4],
      [1095e3, 113e4],
      [117e4, 121e4],
      [125e4, 129e4],
      [1335e3, 138e4],
      [1425e3, 147e4],
      [1515e3, 156e4],
      [161e4, 166e4],
      [171e4, 176e4],
      [181e4, 186e4],
      [1915e3, 197e4],
      [203e4, 208e4],
      [2135e3, 219e4],
      [2245e3, 23e5],
      [236e4, 242e4],
      [2475e3, 254e4],
      [26e5, 267e4],
      [273e4, 28e5],
      [287e4, 294e4],
      [301e4, 308e4],
      [315e4, 323e4],
      [331e4, 338e4],
      [345e4, 36e5]
    ];
    var VERIFIED_TAX_ROWS = [
      { table: "1997-01-01", fromK: 840, toK: 845, family: 1, taxWon: 4470 },
      { table: "1997-01-01", fromK: 840, toK: 845, family: 2, taxWon: 2180 },
      { table: "1997-01-01", fromK: 840, toK: 845, familyMin: 3, taxWon: 0 }
    ];
    function monthOk(m) {
      return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
    }
    function monthIdx(m) {
      return Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
    }
    function won(n) {
      return Math.round(n);
    }
    function computePartialDeductions(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "invalid-input" };
      var month = input.month, base = input.monthlyBaseWon;
      var size = input.workplaceSize === void 0 ? null : input.workplaceSize;
      var family = input.familyCount === void 0 ? null : input.familyCount;
      if (!monthOk(month)) return { ok: false, reason: "invalid-month" };
      if (!Number.isFinite(base) || base < 0) return { ok: false, reason: "invalid-base" };
      if (size !== null && (!Number.isInteger(size) || size < 0)) return { ok: false, reason: "invalid-workplace-size" };
      if (family !== null && (!Number.isInteger(family) || family < 1)) return { ok: false, reason: "invalid-family-count" };
      var assumptions = [
        "\uC6D4 \uBCF4\uC218 \uC785\uB825\uC740 \uC2DC\uD5D8\uAC00\uC815 \u2014 \uADDC\uCE59\uC0C1 \uD45C\uC900\uC18C\uB4DD\uC6D4\uC561\uC740 \uC804\uB144\uB3C4 \uC18C\uB4DD\uCD1D\uC561(\uC0C1\uC5EC\uAE08 \uD3EC\uD568, \uC81C3\uC870\u2460 \uC6D0\uBB38 \uD655\uC778)\uC744 \uC6D4\uC218\uB85C \uB098\uB220 \uC5F0 1\uD68C \uC815\uAE30\uACB0\uC815(\uC81C6\uC870\u2460)",
        "\uC124\uACC4\uC0C1 \uC120\uD0DD\uAC12(\uC9C1\uC885\xB7\uADFC\uB85C\uC2DC\uAC04\xB7\uC0AC\uC5C5\uC7A5 \uADDC\uBAA8)\uC740 \uD1B5\uACC4\uAC00 \uC790\uB3D9 \uC120\uD0DD\uD558\uC9C0 \uC54A\uC74C \u2014 \uC785\uB825 \uD30C\uB77C\uBBF8\uD130"
      ];
      var items = {};
      if (size === null) {
        items.nationalPension = {
          status: "unknown-applicability",
          amountWon: null,
          condition: "5\uC778 \uC774\uC0C1 \uC0AC\uC5C5\uC7A5 + \uAC1C\uBCC4 \uC801\uC6A9\uC81C\uC678(\uB300\uD1B5\uB839\uB839) \uC544\uB2D8 \u2014 \uC0AC\uC5C5\uC7A5 \uADDC\uBAA8 \uBBF8\uD655\uC778"
        };
      } else if (size < PENSION_MIN_WORKERS) {
        items.nationalPension = {
          status: "not-applicable",
          amountWon: 0,
          condition: "\uC0C1\uC2DC 5\uC778 \uBBF8\uB9CC \uC0AC\uC5C5\uC7A5 \u2014 \uC0AC\uC5C5\uC7A5\uAC00\uC785 \uB300\uC0C1 \uC544\uB2D8(0 \uACF5\uC81C\uB294 \uBBF8\uD655\uC815\uC774 \uC544\uB2D8)"
        };
      } else if (monthIdx(month) < monthIdx(PENSION_GRADE_FROM)) {
        items.nationalPension = {
          status: "out-of-scope",
          amountWon: null,
          condition: "\uBCC4\uD45C1 \uAC1C\uC815 1995\u318D4\u318D1 \uC774\uC804 \uB4F1\uAE09\uD45C \uBBF8\uB300\uC870 \u2014 \uC774 \uBAA8\uB4C8 \uBC94\uC704 \uBC16"
        };
      } else {
        var std = PENSION_GRADE_TABLE[0][1];
        for (var g = 0; g < PENSION_GRADE_TABLE.length; g++) {
          if (base >= PENSION_GRADE_TABLE[g][0]) std = PENSION_GRADE_TABLE[g][1];
          else break;
        }
        items.nationalPension = {
          status: "rule-verified",
          ratePerMille: PENSION_RATE_PER_MILLE,
          standardBaseWon: std,
          amountWon: won(std * PENSION_RATE_PER_MILLE / 1e3),
          verifiedScope: "\uADDC\uCE59\uB9CC \uC6D0\uBB38 \uD655\uC778(\uC694\uC728 20\u2030 \uBD80\uCE59\xB7\uBCC4\uD45C1 \uB4F1\uAE09\uD45C\xB7\uC18C\uB4DD \uBC94\uC704 \uC81C3\uC870\u2460). \uAE08\uC561\uC740 \uC2DC\uD5D8\uAC00\uC815 \uC801\uC6A9 \uACB0\uACFC - \uAC1C\uC778 \uC801\uC6A9\uB300\uC0C1 \uBBF8\uD655\uC815\uC774\uACE0, \uADDC\uCE59\uC740 \uC5F0 1\uD68C \uC815\uAE30\uACB0\uC815(\uC81C6\uC870\u2460)\uC778\uB370 \uC6D4 \uC785\uB825\uC73C\uB85C \uACC4\uC0B0\uD55C \uC2DC\uD5D8\uAC00\uC815\uC774\uB77C \uAC1C\uC778 \uC2E4\uACF5\uC81C\uC561 \uBCF4\uC7A5 \uC544\uB2D8",
          basis: "\uBC95\uB960 \uC81C3902\uD638 \uBD80\uCE59 \uC81C4\uC870\u2460-1 (1993~1997 \uAE30\uC5EC\uAE08 20\u2030), \uC81C77\uC870\u2460 \uC6D0\uCC9C\uACF5\uC81C; \uC2DC\uD589\uB839 \uBCC4\uD45C1(\uAC1C\uC815 1995\u318D4\u318D1, lsiSeq=15438 \uCCA8\uBD80 PDF) \uB4F1\uAE09 \uC801\uC6A9",
          condition: "5\uC778 \uC774\uC0C1 \uC0AC\uC5C5\uC7A5 + \uC801\uC6A9\uC81C\uC678 \uC544\uB2D8; \uC6D4 \uBCF4\uC218\uB294 \uC2DC\uD5D8\uAC00\uC815 \uC785\uB825(\uC0C1\uC5EC\uAE08\uC740 \uC18C\uB4DD \uBC94\uC704 \uD3EC\uD568\uC774 \uC6D0\uBB38 \uADDC\uCE59, \uC81C3\uC870\u2460)"
        };
      }
      if (monthIdx(month) < monthIdx(EI_WINDOW.from) || monthIdx(month) > monthIdx(EI_WINDOW.to)) {
        items.employmentInsurance = {
          status: "out-of-scope",
          amountWon: null,
          condition: "\uBAA8\uB4C8 \uBC94\uC704 " + EI_WINDOW.from + "~" + EI_WINDOW.to + " (\uACBD\uACFC\uC870\uCE58 \uAD6C\uAC04) \uBC16"
        };
      } else if (size === null) {
        items.employmentInsurance = {
          status: "unknown-applicability",
          amountWon: null,
          condition: "30\uC778 \uC774\uC0C1 \uC0AC\uC5C5\uC7A5 \u2014 \uC0AC\uC5C5\uC7A5 \uADDC\uBAA8 \uBBF8\uD655\uC778"
        };
      } else if (size < EI_MIN_WORKERS) {
        items.employmentInsurance = {
          status: "not-applicable",
          amountWon: 0,
          condition: "\uC0C1\uC2DC 30\uC778 \uBBF8\uB9CC \u2014 \uBD80\uCE59 \uC81C2\uC870\uB85C 1997-12-31\uAE4C\uC9C0 \uBC95 \uC804\uBD80 \uBBF8\uC801\uC6A9(0 \uACF5\uC81C\uB294 \uBBF8\uD655\uC815\uC774 \uC544\uB2D8)"
        };
      } else {
        items.employmentInsurance = {
          status: "verified",
          ratePerMille: EI_RATE_PER_MILLE,
          amountWon: won(base * EI_RATE_PER_MILLE / 1e3),
          basis: "\uB300\uD1B5\uB839\uB839 \uC81C14570\uD638 \uC81C69\uC870\u2460-3 (\uC2E4\uC5C5\uAE09\uC5EC 6\u2030\uC758 \uADFC\uB85C\uC790 \uC808\uBC18), \uC81C70\uC870 \uC6D0\uCC9C\uACF5\uC81C",
          condition: "30\uC778 \uC774\uC0C1 \uC0AC\uC5C5\uC7A5, 1995-07-01~1997-12-31 \uACBD\uACFC\uC870\uCE58 \uAD6C\uAC04"
        };
      }
      var baseK = Math.floor(base / 1e3);
      var taxRow = null, taxNote = null;
      if (family === null) {
        taxNote = "\uAC00\uC871\uC218 \uBBF8\uD655\uC778 \u2014 \uC5F4 \uC120\uD0DD \uBD88\uAC00";
      } else {
        for (var i = 0; i < VERIFIED_TAX_ROWS.length; i++) {
          var r = VERIFIED_TAX_ROWS[i];
          var famOk = r.family !== void 0 ? r.family === family : family >= r.familyMin;
          if (baseK >= r.fromK && baseK < r.toK && famOk) {
            var tableMonth = r.table.slice(0, 7);
            if (monthIdx(month) >= monthIdx(tableMonth)) {
              taxRow = r;
            } else {
              taxNote = "\uD655\uC778\uB41C \uD589\uC758 \uC2DC\uD589\uBCF8(" + r.table + ")\uC774 \uAD00\uCE21 \uC6D4\uBCF4\uB2E4 \uC774\uD6C4 \u2014 \uC18C\uAE09 \uAE08\uC9C0";
            }
            break;
          }
        }
        if (!taxRow && !taxNote) taxNote = "\uD655\uC778\uB41C \uBCC4\uD45C2 \uD589\uC5D0 \uD574\uB2F9 \uAD6C\uAC04\xB7\uAC00\uC871\uC218 \uC5C6\uC74C(\uC120\uD0DD \uD589\uB9CC \uD655\uC778\uB428) \u2014 \uACC4\uC0B0 \uBD88\uAC00";
      }
      items.incomeTax = taxRow ? {
        status: "verified-row",
        amountWon: taxRow.taxWon,
        basis: "\uBCC4\uD45C2 <\uAC1C\uC815 1996-12-31, \uC77C\uBC18\uC2DC\uD589 " + taxRow.table + "> " + taxRow.fromK + "~" + taxRow.toK + "\uCC9C\uC6D0 \uAD6C\uAC04 " + (taxRow.family || taxRow.familyMin + "\uC778 \uC774\uC0C1") + " \uC5F4",
        note: "\uAC04\uC774\uC138\uC561\uC740 \uC6D4 \uC6D0\uCC9C\uC9D5\uC218 \u2014 \uC5F0\uB9D0\uC815\uC0B0\xB7\uC8FC\uBBFC\uC138\xB7\uC0C1\uC5EC \uCC98\uB9AC\uB294 \uBBF8\uD3EC\uD568"
      } : { status: family === null ? "unknown-family" : "no-verified-row", amountWon: null, note: taxNote };
      items.healthInsurance = {
        status: "unresolved",
        amountWon: null,
        legalRangePerMille: HEALTH_LEGAL_RANGE_PER_MILLE,
        basis: "\uC758\uB8CC\uBCF4\uD5D8\uBC95 \uC81C4972\uD638 \uC81C51\uC870\u2460 \uBC95\uC815 \uBC94\uC704(\uC870\uD569\uC815\uAD00 \uACB0\uC815), \uC81C52\uC870\u2460 \uB178\uC0AC 50/50",
        note: "\uC870\uD569\uBCC4 \uC2E4\uD6A8\uC728\xB7\uBCF4\uC218 \uC0B0\uC785\uBC94\uC704 \uBBF8\uD655\uC815 \u2014 \uB300\uD45C\uAC12 \uC5C6\uC74C"
      };
      var verifiedSum = 0, conditionalSum = 0, hasUnknown = false;
      var keys = Object.keys(items);
      for (var k = 0; k < keys.length; k++) {
        var it = items[keys[k]];
        if (it.status === "verified" || it.status === "verified-row") verifiedSum += it.amountWon;
        else if (it.status === "conditional-test" || it.status === "rule-verified") conditionalSum += it.amountWon;
        else if (it.status !== "not-applicable" && it.status !== "out-of-scope" && it.status !== "unresolved") hasUnknown = true;
      }
      return {
        ok: true,
        scope: "\uD655\uC778\uB41C \uD56D\uBAA9 \uACF5\uC81C \uD6C4 \uBD80\uBD84 \uACC4\uC0B0 \u2014 \uC2E4\uC218\uB839(\uC138\uD6C4\uAE09\uC5EC) \uC544\uB2D8",
        inputs: { month, monthlyBaseWon: base, workplaceSize: size, familyCount: family },
        items,
        verifiedDeductionsWon: verifiedSum,
        conditionalTestDeductionsWon: conditionalSum,
        partialNetAfterVerifiedWon: hasUnknown ? null : won(base - verifiedSum),
        finalTakeHomeWon: null,
        unresolvedReason: "\uC758\uB8CC\uBCF4\uD5D8 \uC2E4\uD6A8\uC728 \uBBF8\uD655\uC815" + (hasUnknown ? " \uC678 \uC801\uC6A9 \uC5EC\uBD80 \uBD88\uBA85 \uD56D\uBAA9" : ""),
        assumptions
      };
    }
    var api = {
      computePartialDeductions,
      rates: {
        pensionPerMille: PENSION_RATE_PER_MILLE,
        employmentInsurancePerMille: EI_RATE_PER_MILLE,
        healthLegalRangePerMille: HEALTH_LEGAL_RANGE_PER_MILLE,
        pensionMinWorkers: PENSION_MIN_WORKERS,
        employmentInsuranceMinWorkers: EI_MIN_WORKERS,
        employmentInsuranceWindow: EI_WINDOW
      }
    };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.netpayPartial1995 = api;
  })(typeof self !== "undefined" ? self : this);
  (function(root) {
    "use strict";
    const RULESET = "return-rules-20261111-direction-conditions-v1";
    function validIdentity(x) {
      return !!x && x.version === 1 && x.rulesScope === "selected-engine-functions-v1" && /^[a-f0-9]{64}$/.test(x.rulesHash) && typeof x.ruleset === "string" && /^return-rules-[a-z0-9-]{1,100}$/.test(x.ruleset) && typeof x.mode === "string" && typeof x.economy === "string" && x.files && ["school-main", "school-cash", "career-planning-trial", "classic", "classic-cash"].includes(x.mode) && Object.keys(x.files).sort().join(",") === (x.mode.startsWith("school") || x.mode === "career-planning-trial" ? ["early-school-news", "events", "prices", "rates", "turns", "unlocks"] : ["events", "prices", "rates", "turns", "unlocks"]).map((n) => "data/" + n + ".json").sort().join(",") && Object.entries(x.files).every(([k, v]) => /^data\/[a-z0-9-]+\.json$/.test(k) && /^[a-f0-9]{64}$/.test(v));
    }
    function valid(p) {
      return !!p && p.version === 1 && typeof p.priorUnknown === "boolean" && typeof p.overflow === "boolean" && Array.isArray(p.contexts) && p.contexts.length <= 16 && p.contexts.every(validIdentity);
    }
    function key(x) {
      return JSON.stringify({ version: x.version, ruleset: x.ruleset, rulesScope: x.rulesScope, rulesHash: x.rulesHash, mode: x.mode, economy: x.economy, files: Object.fromEntries(Object.entries(x.files).sort(([a], [b]) => a.localeCompare(b))) });
    }
    function begin(identity) {
      return { version: 1, priorUnknown: !validIdentity(identity), overflow: false, contexts: validIdentity(identity) ? [JSON.parse(JSON.stringify(identity))] : [] };
    }
    function observe(prior, identity) {
      const p = valid(prior) ? JSON.parse(JSON.stringify(prior)) : { version: 1, priorUnknown: true, overflow: false, contexts: [] };
      if (!validIdentity(identity)) {
        p.priorUnknown = true;
        return p;
      }
      if (!p.contexts.some((x) => key(x) === key(identity))) {
        if (p.contexts.length < 16) p.contexts.push(JSON.parse(JSON.stringify(identity)));
        else p.overflow = true;
      }
      return p;
    }
    function inspect(p) {
      if (!valid(p) || p.priorUnknown || p.overflow || !p.contexts.length) return { status: "unknown", label: "\uADDC\uCE59\xB7\uC790\uB8CC \uC2DD\uBCC4 \uADFC\uAC70 \uBBF8\uAE30\uB85D \uB610\uB294 \uC77C\uBD80 \uAD6C\uAC04 \uBBF8\uD655\uC778" };
      if (p.contexts.length !== 1) return { status: "mixed", label: "\uC9C4\uD589 \uC911 \uADDC\uCE59\xB7\uC790\uB8CC \uC2DD\uBCC4\uC774 \uBC14\uB010 \uAE30\uB85D" };
      return { status: "single", label: "\uD55C \uADDC\uCE59\xB7\uC790\uB8CC \uC2DD\uBCC4 \uBC94\uC704\uB85C \uAE30\uB85D", identity: p.contexts[0] };
    }
    function compare(a, b) {
      const x = inspect(a), y = inspect(b);
      if (x.status === "unknown" || y.status === "unknown") return { status: "unknown", label: "\uADDC\uCE59\xB7\uC790\uB8CC \uB3D9\uC77C\uC131 \uD655\uC778 \uBD88\uAC00: \uBBF8\uAE30\uB85D \uAD6C\uAC04\uC774 \uC788\uC2B5\uB2C8\uB2E4" };
      if (x.status !== "single" || y.status !== "single") return { status: "mixed", label: "\uADDC\uCE59\xB7\uC790\uB8CC \uB3D9\uC77C\uC131 \uD655\uC778 \uBD88\uAC00: \uC9C4\uD589 \uC911 \uC2DD\uBCC4\uC774 \uBC14\uB010 \uAE30\uB85D\uC785\uB2C8\uB2E4" };
      if (key(x.identity) !== key(y.identity)) return { status: "different", label: "\uADDC\uCE59\xB7\uC790\uB8CC \uC2DD\uBCC4\uC774 \uB2E4\uB985\uB2C8\uB2E4: \uB3D9\uC870\uAC74 \uAE30\uB85D\uC73C\uB85C \uBCF4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" };
      return { status: "same", label: "\uAE30\uB85D\uB41C \uADDC\uCE59\xB7\uC790\uB8CC \uC2DD\uBCC4 \uC77C\uCE58. \uC0DD\uB144\xB7\uC120\uD0DD\xB7\uAE08\uC561\uAE4C\uC9C0 \uAC19\uC740 \uC870\uAC74\uC774\uB77C\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4" };
    }
    const api = Object.freeze({ RULESET, validIdentity, valid, begin, observe, inspect, compare });
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.ReturnRecordContext = api;
  })(typeof window === "undefined" ? globalThis : window);
  (function(root) {
    "use strict";
    const module2 = { exports: {} };
    const require = { main: null };
    const MODEL_ID = "living2019q3-minwage-scenario-v1";
    const SCENARIO = {
      wage_gross_monthly: 1745150,
      // 2019 고시 최저임금 8,350원 × 209h(주40h+유급주휴8h) — 법정 최저 조건
      declared_income: 1745150,
      // 신고소득=총급여로 함께 고정(시행령6조 초기결정·공단 신고 절차의 일반화 아님)
      hire_date: "2019-07-01",
      // 초일 취득 → 연금17조①1호·건보69조 당월 산입(법정, 희망 가정 불필요)
      pay_day: 25,
      // 매월 25일 당월 지급
      nontaxable: 0,
      // 비과세 0 명시
      family_count: 1,
      // 공제가족 1명
      withholding_rate_choice: 1,
      // 80/100/120 중 100%
      durunuri_applied: false,
      // 두루누리 미신청 명시(시험 전제, 실제 개인의 지원 없음 확정 사실 아님)
      workplace_kind: "general",
      // 명시 전제: 일반직장, 특수직역 아님
      other_supports: "none-applied",
      // 명시 전제: 다른 지원·경감 반영 없음. 법정 자동면제/경감이 없다는 실제 사실은 미입증 → 그 빈칸은 verified_net=null이 보존
      months: ["2019-07", "2019-08", "2019-09"]
    };
    const RULES = {
      pension: { rate: 0.045, base_min: 31e4, base_max: 486e4, ref: "\uC2DC\uD589\uB8395\uC870(\uCC9C\uC6D0\uBC84\uB9BC)\xB76\uC870, \uC5F0\uAE08\uBC9517\xB788\xB790\xB7117\uC870" },
      health: { rate: 0.0323, ref: "\uAC74\uBCF469\xB777\xB778\xB7107\uC870 + \uACF5\uB2E82019-01\uC548\uB0B4" },
      ltc: { rate_of_health: 0.0851, ref: "\uACF5\uB2E82019-01\uC548\uB0B4" },
      ei: { rate: 65e-4, ref: "\uC9D5\uC218\uBC9513\uC870(\uADFC\uB85C\uC790 \uC808\uBC18)\xB7\uC2DC\uD589\uB83912\uC870(\uCD1D13\u2030, 2019-07-01\uC2DC\uD589) \u2014 \uC6D0\uBC95 \uD655\uC778", quarter: "Q3 only(10\uC6D4 0.8%\uB294 \uBC94\uC704 \uBC16)" },
      local_tax: { rate_of_withheld_tax: 0.1, ref: "\uC9C0\uBC29\uC138\uBC95103\uC870\uC75813(2019-07-01)" },
      remittance: { due: "next-month-10", nominal_only: true, ref: "\uAC74\uBCF478\xB7\uC5F0\uAE0889\xB7\uC9C0\uBC29\uC138103\uC870\uC75813 \u2014 \uBA85\uBAA9 \uC6D0\uCE59\uB9CC, \uD734\uC77C \uC870\uC815 \uBBF8\uD655\uC778" }
    };
    const TAX_ROWS = [
      { lower: 174e4, upper: 175e4, tax_by_family: { 1: 13880, 2: 9380, 3: 1440 }, ref: "\uBCC4\uD45C2<\uAC1C\uC8152018.2.13> \uB450 \uD310\uBCF8 \uB3D9\uC77C(SHA e42f1489\u202655cf) + NTS PDF 20\uCABD \uC721\uC548 \uB300\uC870" }
    ];
    const floor10 = (x) => Math.floor((x + 1e-9) / 10) * 10;
    function standardBase(declared) {
      const r = Math.floor(declared / 1e3) * 1e3;
      return Math.min(Math.max(r, RULES.pension.base_min), RULES.pension.base_max);
    }
    function item(label, unrounded, provisional, status, ref) {
      return { label, amount_unrounded: unrounded, amount_provisional: provisional, status, ref };
    }
    const RANGE = ["2019-07", "2019-08", "2019-09"];
    function monthLedger(month) {
      if (!RANGE.includes(month)) throw new Error("out-of-scope month " + month + ": \uC774 \uBAA8\uD615\uC740 2019Q3 \uD55C\uC815 \uC2DC\uB098\uB9AC\uC624. \uAE30\uAC04 \uBC16 \uC694\uC728\uC740 \uBCC4\uB3C4 \uADFC\uAC70\xB7\uAC80\uC0B0 \uC5C6\uC774 \uC801\uC6A9 \uAE08\uC9C0");
      const g = SCENARIO.wage_gross_monthly;
      const taxable = g - SCENARIO.nontaxable;
      const row = TAX_ROWS.find((r) => taxable >= r.lower && taxable < r.upper) || null;
      const pensionBase = standardBase(SCENARIO.declared_income);
      const healthExact = g * RULES.health.rate;
      const items = [
        item(
          "\uAD6D\uBBFC\uC5F0\uAE08 \uBCF8\uC778 45\u2030 (\uAE30\uC900\uC18C\uB4DD " + pensionBase.toLocaleString() + " = \uC2E0\uACE0\uC18C\uB4DD \uCC9C\uC6D0\uBBF8\uB9CC \uBC84\uB9BC)",
          pensionBase * RULES.pension.rate,
          floor10(pensionBase * RULES.pension.rate),
          "verified-within-declared-inputs: \uC2E0\uACE0\uC18C\uB4DD=\uCD1D\uAE09\uC5EC \uACE0\uC815 \uC870\uAC74\uC5D0\uC11C\uB9CC 78,520. \uC790\uB3D9\uBC95\uC815 \uAC1C\uC778\uACE0\uC9C0 \uD655\uC778 \uC544\uB2D8",
          RULES.pension.ref
        ),
        item(
          "\uAC74\uAC15\uBCF4\uD5D8 \uBCF8\uC778 3.23%",
          healthExact,
          floor10(healthExact),
          "provisional: 50%\uBD84\uB2F4/\uACE0\uC9C0/\uB2E8\uC218 \uC21C\uC11C\uC758 \uD655\uC815 \uAC1C\uC778\uACE0\uC9C0\uC561 \uBBF8\uAC80\uC99D",
          RULES.health.ref
        ),
        item(
          "\uC7A5\uAE30\uC694\uC591 = \uAC74\uBCF4\uB8CC\uC758 8.51%",
          healthExact * RULES.ltc.rate_of_health,
          floor10(healthExact * RULES.ltc.rate_of_health),
          "provisional: \uC774 \uC785\uB825\uC5D0\uC11C\uB294 \uC808\uC0AC \uC804\uD6C4 \uAC74\uBCF4 \uC5B4\uB290 \uCABD \uAE30\uC900\uC774\uC5B4\uB3C4 4,790\uC73C\uB85C \uC77C\uCE58(\uC77C\uBC18\uC801 \uC21C\uC11C \uAC80\uC99D \uC544\uB2D8)",
          RULES.ltc.ref
        ),
        item(
          "\uACE0\uC6A9\uBCF4\uD5D8 \uADFC\uB85C\uC790 0.65%(Q3)",
          g * RULES.ei.rate,
          floor10(g * RULES.ei.rate),
          "rate-statutory-confirmed, \uAC1C\uC778 \uC6D0\uCC9C\uACF5\uC81C \uB05D\uC218 \uC21C\uC11C \uBBF8\uD574\uACB0 \u2192 11,340\uC740 \uC7A0\uC815",
          RULES.ei.ref
        )
      ];
      if (row) {
        const base = row.tax_by_family[SCENARIO.family_count] ?? null;
        items.push(item(
          "\uC18C\uB4DD\uC138 \uAC04\uC774\uC138\uC561(\uAC00\uC871" + SCENARIO.family_count + "\uBA85\xB7100%)",
          base,
          base,
          "verified-row: \uD574\uB2F9 \uD589 \uC6D0\uBB38/\uD310\uBCF8 \uB300\uC870 \uC644\uB8CC(\uC870\uAC74 \uCDA9\uC871 \uC2DC)",
          row.ref
        ));
        items.push(item(
          "\uC9C0\uBC29\uC18C\uB4DD\uC138 = \uC6D0\uCC9C\uC138\uC758 10%",
          base * 0.1,
          base * 0.1,
          "raw\uC0B0\uC220\uAC12\uB9CC: \uCD5C\uC885 \uC808\uC0AC \uD6C4 \uD2B9\uBCC4\uC9D5\uC218\uC561\uC740 null",
          RULES.local_tax.ref
        ));
      } else {
        items.push(item("\uC18C\uB4DD\uC138 \uAC04\uC774\uC138\uC561", null, null, "null: \uD574\uB2F9 \uC138\uC561\uD45C \uD589 \uBBF8\uB0B4\uC7A5", "\uBCC4\uD45C2"));
      }
      items.push(item("\uB450\uB8E8\uB204\uB9AC \uC9C0\uC6D0", 0, 0, "\uBA85\uC2DC \uAC00\uC815: \uBBF8\uC2E0\uCCAD(\uC2E4\uC81C \uC9C0\uC6D0 \uC5C6\uC74C \uD655\uC815 \uC544\uB2D8, \uC2E0\uCCAD \uC2DC \uCD5C\uB300 90% \uBBF8\uD655\uC815)", "moel 2019-01-18 \uC9C0\uCE68"));
      const sum = items.reduce((s, i) => s + (i.amount_provisional || 0), 0);
      return {
        month,
        pay_date: month + "-" + String(SCENARIO.pay_day).padStart(2, "0"),
        gross: g,
        deductions: items,
        verified_net: null,
        // 공식 실수령은 최종 검산(지방세 끝수·고용 끝수·건보/요양 절사 순서·납기 휴일조정) 전까지 null
        internal_arithmetic_example: {
          total_deductions: sum,
          net: g - sum,
          note: "STALE \uAC00\uB2A5 \uB0B4\uBD80 \uC0B0\uC220 \uC608\uC2DC. \uACF5\uC2DD\uAC12 \uC544\uB2C8\uBA70 \uAC8C\uC784 \uD45C\uC2DC\xB7\uBE44\uAD50\xB7\uD65C\uC131 \uC0AC\uC6A9 \uAE08\uC9C0. \uCD5C\uC885 \uAC80\uC0B0 \uD6C4 \uAC31\uC2E0."
        },
        remittance: {
          due_nominal: "next-month-10",
          note: "\uACF5\uC81C\uC6D4\uACFC \uB0A9\uAE30\uB294 \uBCC4\uB3C4 \uC0AC\uAC74. \uAE09\uC5EC\uC5D0\uC11C \uC774\uBBF8 \uACF5\uC81C\uB41C \uC561\uC744 \uB0A9\uAE30\uC5D0 \uD50C\uB808\uC774\uC5B4\uC5D0\uAC8C \uC7AC\uCC28\uAC10 \uAE08\uC9C0. 9\uC6D4\uBD84\uC740 \uC0AC\uC5C5\uC8FC \uBBF8\uB0A9 \uAC00\uB2A5 \uCC44\uBB34\uC774\uC9C0 \uBCF8\uC778 \uD604\uAE08 \uCC44\uBB34 \uC544\uB2D8. \uD734\uC77C \uC870\uC815(2019-08-10 \uD1A0) \uBBF8\uD655\uC778 \u2014 \uC601\uC5C5\uC77C \uC790\uB3D9 \uC870\uC815 \uD45C\uC2DC \uAE08\uC9C0.",
          ref: RULES.remittance.ref
        },
        status: "provisional: \uAC1C\uC778 \uD655\uC815 \uACE0\uC9C0\xB7\uC2E4\uC218\uB839 \uC544\uB2D8"
      };
    }
    function fulltimeBranchMonth(month) {
      if (!RANGE.includes(month)) throw new Error("out-of-scope month " + month);
      return {
        month,
        earned_income: 0,
        health: { status: "\uBA85\uC2DC \uC2DC\uB098\uB9AC\uC624: \uD53C\uBD80\uC591\uC790 \uB4F1\uC7AC(\uBD80\uBAA8 \uC9C1\uC7A5\uAC00\uC785\xB7\uC694\uAC74 \uCDA9\uC871 \uAC00\uC815) \u2192 \uBCF8\uC778 0\uC6D0. \uC2E4\uC81C \uC790\uACA9 \uC785\uC99D\uB41C \uC5ED\uC0AC \uC0AC\uC2E4 \uC544\uB2D8", amount: 0 },
        pension: { status: "null: \uB0A9\uBD80\uC608\uC678/\uC801\uC6A9\uC81C\uC678 \uC131\uB9BD \uBBF8\uD655\uC778(1994-03\uC0DD 25\uC138, \uC81C9\uC8703\uD638 \uD574\uC11D \uAC80\uC0B0 \uD56D\uBAA9)", amount: null },
        living_cost: { status: "null: \uBBF8\uD655\uC815\uC740 0\uC774 \uC544\uB2D8", amount: null },
        severance_unemployment: { status: "\uC0DD\uC131 \uC5C6\uC74C(\uCCAB\uCDE8\uC5C5 \uC544\uB2D8)", amount: 0 }
      };
    }
    const ledger = {
      model_id: MODEL_ID,
      naming: "2019Q3 \uBC95\uC815 \uCD5C\uC800 \uC870\uAC74 \uC2DC\uB098\uB9AC\uC624 [\uBA85\uC2DC \uAC00\uC815] \u2014 \uC2E4\uC81C \uC5ED\uC0AC \uC2DC\uBBAC \uC544\uB2D8, \uD604\uC7AC \uC870\uC0AC\uC5D0\uC11C \uD655\uBCF4\uD55C \uD55C\uC815 \uC2DC\uB098\uB9AC\uC624",
      runtime_activation: false,
      scenario: SCENARIO,
      job_branch: SCENARIO.months.map(monthLedger),
      fulltime_branch: SCENARIO.months.map(fulltimeBranchMonth),
      impossible_outputs: [
        "\uC2E4\uC81C \uC5ED\uC0AC \uAC1C\uC778 \uD604\uAE08\uD750\uB984 \uBCF5\uC6D0",
        "\uD604\uC2E4 \uC0DD\uACC4\uAC00\uB2A5\uC131\xB7\uC9C4\uB85C \uC6B0\uC5F4 \uD310\uC815(\uC0DD\uD65C\uBE44 null)",
        "\uC2E4\uC218\uB839 \uC644\uC131(\uC9C0\uBC29\uC138 \uB05D\uC218\xB7\uACE0\uC6A9 \uB05D\uC218\xB7\uAC74\uBCF4/\uC694\uC591 \uC808\uC0AC \uC21C\uC11C\xB7\uB0A9\uAE30 \uD734\uC77C\uC870\uC815 \uBBF8\uC644)",
        "\uAE30\uC874 \uC2DC\uD5D8 \uC21C\uC800\uCD95 \uBAA8\uD615\uACFC\uC758 \uCD1D\uC790\uC0B0 \uD569\uC0B0 \uBE44\uAD50",
        "2019Q3 \uBC16 \uAE30\uAC04 \uC77C\uBC18\uD654"
      ],
      open_verification_with_data_owner: [
        "\uC9C0\uBC29\uC18C\uB4DD\uC138 \uCD5C\uC885 \uB05D\uC218",
        "2019 \uACE0\uC6A9\uBCF4\uD5D8 \uAC1C\uC778 \uC6D0\uCC9C\uACF5\uC81C \uB05D\uC218",
        "\uAC74\uBCF4/\uC694\uC591 \uAC01 \uBD80\uB2F4\uC561 \uC808\uC0AC \uC21C\uC11C",
        "\uBA85\uBAA9\uB0A9\uAE30(\uC775\uC6D4 10\uC77C)\uC758 \uD734\uC77C \uC870\uC815"
      ]
    };
    if (require.main === module2) console.log(JSON.stringify(ledger, null, 2));
    module2.exports = { ledger, monthLedger };
    root.ReturnLivingScenario2019Q3 = module2.exports;
  })(typeof self !== "undefined" ? self : this);
  (function() {
    const GAME_LIVING = new URLSearchParams(location.search).get("economy") === "game-living-2019q3";
    const CLASSIC_MODE = GAME_LIVING || new URLSearchParams(location.search).get("start") === "classic";
    const CASH_MODE = !GAME_LIVING && new URLSearchParams(location.search).get("economy") === "cash-events-trial";
    const SCHOOL_MODE = !CLASSIC_MODE;
    const SCHOOL_CASH_MODE = SCHOOL_MODE && CASH_MODE;
    const CAREER_TRIAL = SCHOOL_MODE && !CASH_MODE && new URLSearchParams(location.search).get("career") === "planning-trial";
    const MODEL_ID = GAME_LIVING ? "game-living-2019q3-v1" : SCHOOL_CASH_MODE ? "trial-school-cash-events-v1" : CASH_MODE ? "trial-cash-events-v1" : "trial-net-savings-v1";
    const SAVE_KEY = GAME_LIVING ? "regression-invest-game-living-save-v1" : CAREER_TRIAL ? "regression-invest-career-planning-save-v1" : SCHOOL_CASH_MODE ? "regression-invest-school-cash-save-v1" : SCHOOL_MODE ? "regression-invest-school-calendar-save-v1" : CASH_MODE ? "regression-invest-cash-events-save-v1" : "regression-invest-save-v2";
    const LIVES_KEY = GAME_LIVING ? "regression-invest-game-living-lives-v1" : CAREER_TRIAL ? "regression-invest-career-planning-lives-v1" : SCHOOL_CASH_MODE ? "regression-invest-school-cash-lives-v1" : SCHOOL_MODE ? "regression-invest-school-calendar-lives-v1" : CASH_MODE ? "regression-invest-cash-events-lives-v1" : "regression-invest-lives";
    const initialStorage = (() => {
      try {
        const bootRaw = localStorage.getItem(SAVE_KEY);
        return {
          ok: true,
          legacy: CAREER_TRIAL ? null : localStorage.getItem("regression-invest-save-v1"),
          bootRaw,
          snapshot: ReturnEconomyPolicy.inspectRaw(bootRaw),
          lives: readLivesRaw()
        };
      } catch (_) {
        return { ok: false, legacy: null, bootRaw: null, snapshot: { ok: false, exists: null, state: null } };
      }
    })();
    const legacySave = initialStorage.legacy;
    let loadedSnapshot = initialStorage.snapshot;
    const freshState = () => ({
      archiveTransferId: "life-" + crypto.randomUUID(),
      // Same-life retries stable; identical later lives remain distinct.
      economyModel: ReturnEconomyPolicy.descriptor(MODEL_ID),
      assetReviewBaseline: { version: 1, source: "new-game", month: "1996-03", totalAssets: 1e6 },
      ...CASH_MODE ? { cashEvents: { version: 1, tuitionIssued: false, rows: [] } } : {},
      month: "1996-03",
      cash: 1e6,
      holdings: {},
      // product -> {qty, avgPrice}
      unlocksSeen: [],
      eventIndex: 0,
      history: [],
      turnCount: 0,
      chaos: 0,
      // 규모 기반 카오스 누적치 [전부 설계 제안 — 경제 사실 아님]
      flags: {}
      // 진로 선택 결과 (defer_used 등)
    });
    let state = (loadedSnapshot.ok && loadedSnapshot.exists ? loadedSnapshot.state : null) || freshState();
    let DATA = null;
    let currentRecordIdentity = null;
    let cashIdentityFields = null;
    let cashReserveIdentityFields = null;
    let cashCycleIdentityFields = null, cashCycleReserveIdentityFields = null;
    let cashPaceIdentityFields = null, cashPaceReserveIdentityFields = null;
    let cashTimeIdentityFields = null, cashTimeReserveIdentityFields = null;
    let chaosTimeIdentityFields = null, chaosTimeReserveIdentityFields = null;
    const GEN68_ADVANCE_MONTH_FINGERPRINT = 'function advanceMonth() {\n            if (storageWriteBlocked) return showStorageWriteUnavailable();\n            if (storageReadBlocked) return showStorageReadUnavailable();\n            if (!ReturnEconomyPolicy.inspect(state, currentEconomyId()).ok) return showEconomyConflict();\n            if (DATA && !ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map((u) => u.product)).ok) return showSaveConflict("\\uBCF4\\uC720\\uC790\\uC0B0\\xB7\\uB300\\uAE30\\uC8FC\\uBB38\\xB7\\uC7A5\\uBD80\\uC758 \\uC77C\\uBD80 \\uC800\\uC7A5 \\uD615\\uC2DD\\uC744 \\uD655\\uC778\\uD560 \\uC218 \\uC5C6\\uC5B4 \\uBA48\\uCDC4\\uC2B5\\uB2C8\\uB2E4. \\uAE08\\uC561\\uC744 \\uCD94\\uC815\\uD558\\uAC70\\uB098 \\uC6D0\\uBB38\\uC744 \\uB36E\\uC5B4\\uC4F0\\uC9C0 \\uC54A\\uC558\\uC5B4\\uC694.", "save-shape");\n            const [y, m] = state.month.split("-").map(Number);\n            const nm = m === 12 ? [y + 1, 1] : [y, m + 1];\n            state.month = nm[0] + "-" + String(nm[1]).padStart(2, "0");\n            if (GAME_LIVING) {\n              const entered = state.month, workMonth = addMonths2(entered, -1);\n              if (entered > GLV.startMonth && entered <= GLV.lastWorkMonth) {\n                const income = state.gameLivingTrack === "job" ? GLV.income : 0;\n                state.cash += income;\n                if (income) state.gameLivingSalaryReceived = (state.gameLivingSalaryReceived || 0) + income;\n                const expense = GLV.expense;\n                state.lastSavings = 0;\n                if (state.cash >= expense) {\n                  state.cash -= expense;\n                  state.gameLivingLedger = state.gameLivingLedger || [];\n                  state.gameLivingLedger.push({ month: entered, income, incomeFor: workMonth, expense, expenseDue: expense, shortfall: 0, cashAfter: state.cash, failed: false });\n                } else {\n                  state.gameLivingPendingDue = { month: entered, income, incomeFor: workMonth, expenseDue: expense };\n                }\n              } else if (entered === addMonths2(GLV.lastWorkMonth, 1) && state.gameLivingTrack === "job") {\n                state.gameLivingReceivable = GLV.income;\n              }\n            }\n            if (state.month > GAME_END) return;\n            const b0 = state.flags.birth;\n            if (b0 && state.flags.studyPath === "study") {\n              if (!state.flags.academicStatus && state.month >= b0.hsYear + 3 + "-03") {\n                if (!state.academic || state.flags.lifeDone.admitResult) {\n                  state.flags.academicStatus = "college";\n                  state.flags.enrolledMonths = 0;\n                }\n              }\n              if (state.academic && !state.flags.academicStatus && !militaryActive() && state.month < b0.hsYear + 3 + "-03") {\n                state.academic.effort += state.academic.policy === "focus" ? 2 : 1;\n              }\n              if (state.flags.academicStatus === "college" && !militaryActive()) {\n                state.flags.enrolledMonths = (state.flags.enrolledMonths || 0) + (state.acadRules === 3 && state.colPolicy === "balanced" ? 0.5 : 1);\n              }\n            }\n            effDate = state.month + "-01";\n            effPostClose = false;\n            tryFillOrders();\n            if (storageWriteBlocked || multiTabConflict) return;\n            if (CASH_MODE) {\n              const income = !militaryActive() && (state.flags.studyPath === "parttime" && b0 && state.month < b0.hsYear + 3 + "-03" || state.flags.career === "job" && state.flags.academicStatus === "graduated") ? 3e5 : 0;\n              const tuition = !state.cashEvents.tuitionIssued && state.flags.academicStatus === "college" ? 8e5 : 0;\n              state.cash += income;\n              const row = { month: state.month, income, living: 1e5, tuition, status: "due", paid: 0 };\n              const auto = state.cashAutomation;\n              if (auto && auto.enabled && state.month > auto.enabledAfterMonth && !tuition && state.cash >= row.living) {\n                state.cash -= row.living;\n                row.paid = row.living;\n                row.status = "paid";\n                auto.paidMonths.push(state.month);\n              }\n              state.cashEvents.rows.push(row);\n              if (tuition) state.cashEvents.tuitionIssued = true;\n              state.lastSavings = 0;\n            } else if (careerCashActive()) {\n              applyCareerCashMonth();\n            } else if (!GAME_LIVING) {\n              const sv = monthlySavings();\n              if (sv > 0) {\n                state.cash += sv;\n                state.lastSavings = sv;\n              } else {\n                state.lastSavings = 0;\n              }\n              applyJobSavingsPlan(sv);\n              state.savingsLedger = state.savingsLedger || [];\n              state.savingsLedger.push({ month: state.month, amount: sv, reason: militaryActive() ? "\\uBCF5\\uBB34 \\uC911" : state.flags.career === "job" && state.flags.academicStatus === "graduated" ? "\\uC878\\uC5C5 \\uD6C4 \\uCDE8\\uC5C5" : state.flags.studyPath === "parttime" && b0 && state.month < b0.hsYear + 3 + "-03" ? "\\uACE0\\uAD50 \\uC54C\\uBC14" : state.flags.studyPath === "study" && state.academic && state.academic.policy === "balanced" && b0 && !state.flags.academicStatus && state.month < b0.hsYear + 3 + "-03" ? "\\uD559\\uC5C5 \\uBCD1\\uD589 \\uC54C\\uBC14 [\\uC2DC\\uD5D8\\uAC12]" : state.acadRules === 3 && state.flags.academicStatus === "college" && state.colPolicy === "balanced" ? "\\uB300\\uD559 \\uBCD1\\uD589 \\uC54C\\uBC14 [\\uC2DC\\uD5D8\\uAC12]" : sv > 0 ? "\\uC9C4\\uB85C \\uBBF8\\uC815 \\uC2DC\\uC791 \\uADDC\\uCE59" : "\\uC815\\uAE30 \\uC21C\\uC800\\uCD95 \\uC5C6\\uC74C", basis: "test-net-savings-v1" });\n            }\n            const interestEntries = [];\n            for (const [p, h2] of Object.entries(state.holdings)) {\n              const u = DATA.unlocks.find((x) => x.product === p);\n              if (u && (u.rule === "accrual" || u.rule === "fxaccrual")) {\n                const before = h2.qty, rate = accrualRate(u);\n                h2.qty = h2.qty * (1 + rate.annual / 12);\n                if (before > 0) interestEntries.push({\n                  product: p,\n                  balanceBefore: before,\n                  interest: h2.qty - before,\n                  balanceAfter: h2.qty,\n                  annualRate: rate.annual,\n                  rateLabel: rate.label,\n                  unit: u.rule === "fxaccrual" ? "USD" : "KRW",\n                  basis: "prototype-monthly-accrual-v1"\n                });\n              }\n            }\n            state.interestLedger = state.interestLedger || [];\n            state.interestLedger.push({ month: state.month, entries: interestEntries });\n            chaosTick();\n            if (state.chaos >= CHAOS.overAt) state.flags.gameOver = "chaos";\n          }';
    const GEN68_TRADE_ACCESS_FINGERPRINT = 'function tradeAccess(turn) {\n            if (schoolDataGap()) return { allowed: false, label: "\\uC790\\uB8CC\\uACF5\\uBC31 \\uAD6C\\uAC04 - \\uB9E4\\uB9E4 \\uCC28\\uB2E8 (1996-03 \\uC804)" };\n            if (!turn || !["news", "quiet"].includes(turn.kind)) return { allowed: false, label: "\\uD3C9\\uAC00\\uB9CC \\uD45C\\uC2DC \\xB7 \\uC774 \\uD654\\uBA74\\uC5D0\\uC11C\\uB294 \\uC8FC\\uBB38\\uD558\\uC9C0 \\uC54A\\uC74C" };\n            if (CAREER_TRIAL && state.flags.career === "job" && !turn.settlement) return { allowed: false, label: "\\uACC4\\uD68D\\uD615 \\uCDE8\\uC5C5: \\uBD84\\uAE30 \\uC815\\uC0B0\\uC5D0\\uC11C\\uB9CC \\uC0C8 \\uD22C\\uC790\\uC8FC\\uBB38 \\xB7 \\uCDE8\\uC18C\\uAE08\\uC740 \\uD604\\uAE08\\uC73C\\uB85C \\uC989\\uC2DC \\uBC18\\uD658" };\n            if (turn.kind === "news") return state.flags.career === "job" ? { allowed: true, reserveOnly: true, label: "\\uB274\\uC2A4 \\uB300\\uC751 \\uC608\\uC57D \\uC8FC\\uBB38 \\u2014 \\uB2E4\\uAC00\\uC624\\uB294 \\uBD84\\uAE30 \\uC815\\uC0B0 \\uC774\\uD6C4 \\uC801\\uACA9 \\uAD00\\uCE21\\uC73C\\uB85C \\uCCB4\\uACB0 \\uB300\\uAE30 [\\uC124\\uACC4]" + (militaryActive() ? " \\xB7 \\uBCF5\\uBB34 \\uC911 \\uB9E4\\uC218 \\uBE44\\uC911 \\uC0C1\\uD55C 30%" : "") } : { allowed: true, label: "\\uB274\\uC2A4 \\uB300\\uC751 \\uC8FC\\uBB38 \\uAC00\\uB2A5" + (militaryActive() ? " \\xB7 \\uBCF5\\uBB34 \\uC911 \\uB9E4\\uC218 \\uBE44\\uC911 \\uC0C1\\uD55C 30%" : "") };\n            if (state.flags.career === "job" && !turn.settlement) return { allowed: false, label: "\\uD3C9\\uAC00\\uB9CC \\uD45C\\uC2DC \\xB7 \\uC9C1\\uC7A5\\uC778\\uC740 \\uC815\\uC0B0 \\uC804\\uC6A9 \\uD134\\uC5D0\\uC11C \\uC8FC\\uBB38" };\n            return { allowed: true, label: turn.settlement ? "\\uC815\\uC0B0 \\uC804\\uC6A9 \\uD134 \\uC8FC\\uBB38 \\uAC00\\uB2A5" : "\\uD3C9\\uC628 \\uD134 \\uB9AC\\uBC38\\uB7F0\\uC2F1 \\uAC00\\uB2A5" + (militaryActive() ? " \\xB7 \\uBCF5\\uBB34 \\uC911 \\uB9E4\\uC218 \\uBE44\\uC911 \\uC0C1\\uD55C 30%" : "") };\n          }';
    const GEN67_INSPECT_NESTED_FINGERPRINT = 'function inspectNested(state, products) {\n            const obj = (x) => x && typeof x === "object" && !Array.isArray(x);\n            const num = (x) => Number.isFinite(x) && x >= 0;\n            const mon = (x) => typeof x === "string" && /^\\d{4}-(0[1-9]|1[0-2])$/.test(x);\n            const present = (k2) => Object.prototype.hasOwnProperty.call(state, k2);\n            const fail = (reason) => ({ ok: false, reason });\n            const known = (p) => typeof p === "string" && products.includes(p);\n            for (const [product, h2] of Object.entries(state.holdings)) {\n              if (!known(product) || !obj(h2) || !num(h2.qty) || !num(h2.avgPrice) || h2.invested != null && !num(h2.invested) || h2.entryMonth != null && !mon(h2.entryMonth)) return fail("invalid-holding");\n            }\n            if (present("pendingOrders")) {\n              if (!Array.isArray(state.pendingOrders)) return fail("invalid-orders");\n              const ids = /* @__PURE__ */ new Set();\n              for (const o of state.pendingOrders) {\n                if (!obj(o) || typeof o.id !== "string" || !o.id || ids.has(o.id) || !known(o.product) || !["buy", "sell"].includes(o.kind) || !mon(o.placedMonth)) return fail("invalid-order");\n                ids.add(o.id);\n                if (o.kind === "buy" ? !num(o.amount) || o.amount <= 0 : !num(o.qty) || o.qty <= 0 || !num(o.avgPrice) || !num(o.costBasis) || o.investedShare != null && !num(o.investedShare)) return fail("invalid-order-money");\n                if (o.expiresAt != null && (o.kind !== "buy" || !mon(o.expiresAt) || o.expiresAt <= o.placedMonth)) return fail("invalid-order-expiry");\n                if (Object.prototype.hasOwnProperty.call(o, "conditionRules") && (o.conditionRules !== 1 || o.reserve || o.condition && (!["above", "below"].includes(o.condition.op) || !num(o.condition.value) || o.condition.value <= 0))) return fail("invalid-directional-order");\n                if (o.obsCutoff != null && (typeof o.obsCutoff !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(o.obsCutoff)) || o.obsPostClose != null && typeof o.obsPostClose !== "boolean") return fail("invalid-order-observation");\n              }\n            }\n            if (present("careerCycleRules") && (state.careerCycleRules !== 1 || state.cashPlanRules !== 1)) return fail("invalid-career-cycle-rules");\n            if (present("careerCycle")) {\n              const p = state.careerCycle;\n              if (!obj(p) || Object.keys(p).sort().join(",") !== "changedMonth,from,to,version" || p.version !== 1 || !mon(p.changedMonth) || p.changedMonth > state.month || !["03", "06", "09", "12"].includes(p.changedMonth.slice(5)) || !["job", "fulltime", "alba"].includes(p.from) || !["job", "fulltime", "alba"].includes(p.to) || p.from === p.to || state.careerCycleRules !== 1 || (p.to === "job" ? state.flags.career !== "job" : state.flags.career !== "fulltime") || (p.to === "alba" ? state.flags.recoveryJob !== "alba" : state.flags.recoveryJob === "alba")) return fail("invalid-career-cycle");\n            }\n            if (present("cashReservePolicy")) {\n              const p = state.cashReservePolicy;\n              if (!obj(p) || Object.keys(p).sort().join(",") !== "amount,enabledAfterMonth,version" || p.version !== 1 || ![0, 7e5, 21e5, 42e5].includes(p.amount) || !mon(p.enabledAfterMonth) || p.enabledAfterMonth > state.month || state.cashPlanRules !== 1) return fail("invalid-cash-reserve-policy");\n            }\n            if (present("cashPlanRules") && (state.cashPlanRules !== 1 || state.economyModel?.id !== "career-cash-events-v1" || state.careerCashRules !== 3 || state.jobPlanProductRules !== 1 || state.directionConditionRules !== 1)) return fail("invalid-cash-plan-rules");\n            if (present("directionConditionRules") && state.directionConditionRules !== 1) return fail("invalid-direction-condition-rules");\n            if (present("jobPlanProductRules") && state.jobPlanProductRules !== 1) return fail("invalid-job-plan-product-rules");\n            if (present("jobSavingsPlan")) {\n              const p = state.jobSavingsPlan;\n              if (!obj(p) || Object.prototype.hasOwnProperty.call(p, "product") && (state.jobPlanProductRules !== 1 || !["kospi", "fx", "usdeposit"].includes(p.product)) || p.version !== 1 || ![0, 50, 100].includes(p.percent) || !mon(p.enabledAfterMonth) || p.enabledAfterMonth > state.month || !Array.isArray(p.appliedMonths) || p.appliedMonths.length > 500 || p.appliedMonths.some((m, i) => !mon(m) || m > state.month || i > 0 && m <= p.appliedMonths[i - 1])) return fail("invalid-job-savings-plan");\n            }\n            if (present("savingsLedger") && (!Array.isArray(state.savingsLedger) || state.savingsLedger.some((r) => !obj(r) || !mon(r.month) || !num(r.amount) || typeof r.reason !== "string"))) return fail("invalid-savings-ledger");\n            if (present("interestLedger") && (!Array.isArray(state.interestLedger) || state.interestLedger.some((r) => !obj(r) || !mon(r.month) || !Array.isArray(r.entries) || r.entries.some((e2) => !obj(e2) || !known(e2.product) || !num(e2.balanceBefore) || !num(e2.balanceAfter) || !num(e2.interest) || !num(e2.annualRate) || typeof e2.rateLabel !== "string" || !["KRW", "USD"].includes(e2.unit))))) return fail("invalid-interest-ledger");\n            if (state.flags.birth != null) {\n              const b = state.flags.birth;\n              if (!obj(b) || !Number.isInteger(b.year) || !Number.isInteger(b.month) || b.month < 1 || b.month > 12 || !Number.isInteger(b.hsYear)) return fail("invalid-birth");\n            }\n            if (state.flags.lifeDone != null && !obj(state.flags.lifeDone)) return fail("invalid-life-flags");\n            return { ok: true };\n          }';
    function gen98DecisionPaceAllowed() {
      return decisionPaceActive() && !militaryActive() && !state.flags.gameOver && state.month <= GAME_END && ["fulltime", "alba"].includes(careerCycleTrack()) && nextTurn().kind === "quiet";
    }
    function gen98CommitDecisionPace(signature) {
      if (storageReadBlocked || storageWriteBlocked || !decisionPaceAllowed() || JSON.stringify([state.month, state.turnCount, state.flags, state.cash, state.pendingOrders, state.careerCycle]) !== signature) return;
      const from = state.month, unpaidBefore = careerCashUnpaid(), fillsBefore = (state.fillsLog || []).length, historyBefore = state.history.length;
      let steps = 0, reason = "\uD310\uB2E8 \uACBD\uACC4";
      while (steps < 500) {
        const t = nextTurn(), td = turnEffDate(t);
        effDate = td.date;
        effPostClose = td.postClose;
        tryFillOrders();
        const fills = (state.fillsLog || []).length - fillsBefore, expiries = state.history.slice(historyBefore).filter((h) => h.choice?.startsWith("order-expired:")).length;
        if (fills || expiries) {
          reason = "\uC8FC\uBB38 \uBCC0\uD654";
          break;
        }
        if (careerCashUnpaid() > unpaidBefore) {
          reason = "\uCD94\uAC00 \uBBF8\uB0A9";
          break;
        }
        if (steps > 0 && careerCycleStatus(t)?.allowed) {
          reason = "\uBD84\uAE30 \uC9C4\uB85C \uC7AC\uC120\uD0DD";
          break;
        }
        if (steps > 0) recordAssetTrail();
        if (t.kind !== "quiet" || state.flags.gameOver || state.month > GAME_END) {
          reason = { news: "\uB274\uC2A4", life: "\uC9C4\uB85C\xB7\uBCF5\uBB34", discharge: "\uC804\uC5ED", "natural-end": "\uC885\uB8CC", gameover: "\uAC8C\uC784 \uC885\uB8CC" }[t.kind] || t.kind;
          break;
        }
        const before = state.month;
        advanceMonth();
        if (storageReadBlocked || storageWriteBlocked || multiTabConflict || state.month === before) return;
        state.turnCount++;
        steps++;
      }
      if (steps === 500) reason = "\uC548\uC804 \uC0C1\uD55C";
      const report = { version: 1, from, to: state.month, steps, reason, fills: (state.fillsLog || []).length - fillsBefore, expiries: state.history.slice(historyBefore).filter((h) => h.choice?.startsWith("order-expired:")).length, unpaidAdded: Math.max(0, careerCashUnpaid() - unpaidBefore) };
      state.decisionPaceReport = report;
      state.history.push({ month: state.month, decisionMonth: from, choice: "decision-pace:" + steps, reason });
      if (save()) render();
    }
    let reservationIdentityFields = null, reservationReserveIdentityFields = null;
    let allocationIdentityFields = null, allocationReserveIdentityFields = null;
    let propertyIdentityFields = null, propertyReserveIdentityFields = null;
    let foreignIdentityFields = null, foreignReserveIdentityFields = null;
    let foreignFundScaleIdentityFields = null, foreignFundScaleReserveIdentityFields = null;
    const GEN137_MARKET_SIZE_FINGERPRINT = 'function marketSizeOf(p, month) {\n            if (p === "kospi" || p === "kosdaq") {\n              const cutoff = month === state.month ? effDate : month + "-31";\n              const rows = MARKET_SIZE_PLAY.filter((r) => r.product === p && r.evidenceVerified === true && r.usable_from <= cutoff).sort((a, b) => a.usable_from.localeCompare(b.usable_from));\n              const last = rows[rows.length - 1];\n              if (last) return { size: last.value, label: "\\uB2F9\\uC2DC \\uACF5\\uAC1C \\uADFC\\uAC70 \\uD655\\uC778 \\uC2DC\\uC7A5\\uADDC\\uBAA8 [\\uC2DC\\uC5F0 \\uACC4\\uC0B0]" };\n              return { size: null, label: "\\uB2F9\\uC2DC \\uACF5\\uAC1C\\uB41C \\uC2DC\\uC7A5\\uADDC\\uBAA8 \\uADFC\\uAC70 \\uBBF8\\uD655\\uC778 \\u2014 \\uCE74\\uC624\\uC2A4 \\uC0B0\\uC815 \\uBCF4\\uB958" };\n            }\n            if (p === "btc") {\n              const unit = fxUnit(month, "btc");\n              const supply = btcTheoreticalSupply(month);\n              if (unit == null || supply == null) return { size: null, label: "\\uBE44\\uD2B8\\uCF54\\uC778 \\uC2DC\\uC138\\xB7\\uD658\\uC728 \\uC9C0\\uC810 \\uBBF8\\uD655\\uBCF4 \\u2014 \\uCE74\\uC624\\uC2A4 \\uC0B0\\uC815 \\uBCF4\\uB958" };\n              return { size: unit * supply, label: "\\uBE44\\uD2B8\\uCF54\\uC778 \\uC2DC\\uC138\\xD7\\uC774\\uB860 \\uBC1C\\uD589\\uB7C9 [\\uC2DC\\uC5F0 \\uACC4\\uC0B0 \\xB7 \\uC2E4\\uC81C \\uC2DC\\uAC00\\uCD1D\\uC561 \\uD1B5\\uACC4 \\uC544\\uB2D8]" };\n            }\n            const test = { fx: 50, etf: 5, bundang: 20 }[p];\n            if (test) return { size: test * 1e12, label: test + "\\uC870 [\\uC2DC\\uC7A5\\uADDC\\uBAA8 \\uC2DC\\uD5D8\\uAC12]" };\n            return null;\n          }';
    const GEN133_CHAOS_TRAJECTORY_FINGERPRINT = "function chaosTrajectory(plan) {\n            const vals = [];\n            for (const [p, h2] of Object.entries(chaosExposureHoldings())) {\n              const m = marketSizeOf(p, state.month);\n              if (!m || !m.size || !isFinite(m.size)) continue;\n              let v = holdingValue(p, h2, state.month);\n              if (plan && plan.reduceProduct === p) v = Math.max(0, v - (plan.reduceValue || 0));\n              if (v > 0) vals.push({ v, size: m.size });\n            }\n            if (plan && plan.buyPerMonth > 0 && plan.buySize && isFinite(plan.buySize)) vals.push({ planned: true, per: plan.buyPerMonth, months: plan.buyMonths || 1, size: plan.buySize });\n            let chaos = state.chaos + (plan && plan.sellImpactNow || 0);\n            const points = [{ m: 0, chaos: Math.round(chaos * 10) / 10 }];\n            let warnMonth = chaos >= CHAOS.warnAt ? 0 : null, overMonth = chaos >= CHAOS.overAt ? 0 : null;\n            for (let i = 1; i <= 12; i++) {\n              let add = 0;\n              for (const e2 of vals) {\n                if (e2.planned) {\n                  if (i <= e2.months) add += e2.per / e2.size * CHAOS.scaleFactor;\n                } else add += e2.v / e2.size * CHAOS.scaleFactor;\n              }\n              let next = chaos + add;\n              if (add < 1) next -= CHAOS.decayPerMonth;\n              chaos = Math.round(Math.max(0, next) * 10) / 10;\n              points.push({ m: i, chaos });\n              if (warnMonth === null && chaos >= CHAOS.warnAt) warnMonth = i;\n              if (overMonth === null && chaos >= CHAOS.overAt) overMonth = i;\n            }\n            return { points, warnMonth, overMonth };\n          }";
    const GEN133_PRODUCT_AVAILABLE_FINGERPRINT = 'function productAvailable(u) {\n            if (u && u.requires_rules === "core-v4" && !(state && state.coreRules >= 4)) return false;\n            const cutoff = effDate && effDate.slice(0, 7) === state.month ? effDate : state.month + "-01";\n            return !!u && (!u.available_from || u.available_from <= cutoff);\n          }';
    const GEN133_CHOOSE_FINGERPRINT = 'function choose(id2, turn) {\n            if (storageWriteBlocked) return showStorageWriteUnavailable();\n            if (storageReadBlocked) return showStorageReadUnavailable();\n            if (turn && turn.kind === "life" && !id2.startsWith("life:")) {\n              render();\n              return;\n            }\n            if (id2 === "demo-continue") {\n              state.flags.demoEndShown = true;\n              finishTurn(null, id2);\n              return;\n            }\n            if (id2 === "end-continue") {\n              state.flags.gameEndShown = true;\n              finishTurn(null, id2);\n              return;\n            }\n            if (id2 === "voluntary-end-cancel") {\n              render();\n              return;\n            }\n            if (id2 === "living-settle-confirm") {\n              const due = state.gameLivingPendingDue;\n              if (!due) {\n                render();\n                return;\n              }\n              state.gameLivingLedger = state.gameLivingLedger || [];\n              if (state.cash >= due.expenseDue) {\n                state.cash -= due.expenseDue;\n                state.gameLivingLedger.push({ month: due.month, income: due.income, incomeFor: due.incomeFor, expense: due.expenseDue, expenseDue: due.expenseDue, shortfall: 0, cashAfter: state.cash, failed: false, adjusted: true });\n                state.gameLivingPendingDue = null;\n                state.history.push({ month: state.month, decisionMonth: state.month, choice: "game-living:settle-after-adjust" });\n              } else {\n                state.gameLivingLedger.push({ month: due.month, income: due.income, incomeFor: due.incomeFor, expense: 0, expenseDue: due.expenseDue, shortfall: due.expenseDue - state.cash, cashAfter: state.cash, failed: true });\n                state.gameLivingPendingDue = null;\n                state.flags.gameOver = "living-fail";\n                state.history.push({ month: state.month, decisionMonth: state.month, choice: "game-living:settle-failed" });\n              }\n              if (save()) render();\n              return;\n            }\n            if (id2.startsWith("living-adjust-sell:")) {\n              const product = id2.slice("living-adjust-sell:".length);\n              const h2 = state.holdings[product];\n              const due = state.gameLivingPendingDue;\n              if (!h2 || !due) {\n                render();\n                return;\n              }\n              const vv = livingAdjustValuation(product, h2);\n              const value = vv.blocked ? 0 : vv.v;\n              if (!(value > 0)) {\n                render();\n                return;\n              }\n              state.cash += value;\n              delete state.holdings[product];\n              state.history.push({ month: state.month, decisionMonth: state.month, choice: "game-living:adjust-sell:" + product, amount: value });\n              if (save()) render();\n              return;\n            }\n            if (id2 === "record-and-reset" || id2 === "record-and-reset-demo" || id2 === "record-and-reset-end" || id2 === "record-and-reset-voluntary" || id2 === "record-and-reset-livingfail") {\n              const causeMap = { "record-and-reset": "chaos", "record-and-reset-demo": "demo-end", "record-and-reset-end": "natural-end", "record-and-reset-voluntary": "voluntary-end", "record-and-reset-livingfail": "living-fail" };\n              const sourceRaw = localStorage.getItem(SAVE_KEY2);\n              document.querySelectorAll("#choices button").forEach((b) => b.disabled = true);\n              void (async () => {\n                try {\n                  if (typeof window.__returnStorageFlush === "function" && await window.__returnStorageFlush() === false) throw new Error("prior-write-failed");\n                  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceRaw || JSON.stringify(state)));\n                  const transferId = state.archiveTransferId || "end-sha256-" + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");\n                  settlePendingOrders();\n                  const log = readLives();\n                  if (!log) return;\n                  const record = {\n                    transferId,\n                    ...SCHOOL_MODE ? { schoolStart: { ...state.schoolStart }, birth: { ...state.flags.birth } } : {},\n                    recordContext: ReturnRecordContext.observe(state.recordContext, currentRecordIdentity),\n                    decisionReview: buildDecisionReview(),\n                    ended: id2 === "record-and-reset-end" ? GAME_END : state.month,\n                    observationMonth: state.month,\n                    turnCount: state.turnCount,\n                    totalAssets: totalAssets(),\n                    assetReview: CASH_MODE ? { available: false, reason: "separate-cash-events-model" } : ReturnAssetReview.review(state, totalAssets()),\n                    ...CASH_MODE ? { cashFlowSummary: cashSummary() } : {},\n                    ...!CASH_MODE && state.cashEvents && state.cashEvents.rows && state.cashEvents.rows.length ? { careerCashSummary: careerCashSummary() } : {},\n                    ...!CASH_MODE ? { careerMechanics: careerMechanicsSummary(state.fillsLog) } : {},\n                    assetTrail: Array.isArray(state.assetTrail) && state.assetTrail.length ? state.assetTrail.slice() : null,\n                    assetTrailFrom: Array.isArray(state.assetTrail) && state.assetTrail.length ? state.assetTrail[0].m : null,\n                    cause: causeMap[id2],\n                    path: state.flags.studyPath ? state.flags.studyPath + (state.flags.career ? "-" + state.flags.career : state.flags.studyPath === "parttime" ? "-fulltime" : "") : null,\n                    chaos: state.chaos\n                  };\n                  const alreadyArchived = log.some((row) => row.transferId === record.transferId);\n                  if (!alreadyArchived) log.push(record);\n                  try {\n                    const raw = typeof window.__returnRetainArchive === "function" ? window.__returnRetainArchive(JSON.stringify(log)) : JSON.stringify(log);\n                    if (alreadyArchived && typeof window.__returnArchiveVerified === "function") {\n                      if (await window.__returnArchiveVerified(raw) !== true) throw new Error("Archive reverify mismatch");\n                    } else {\n                      localStorage.setItem(LIVES_KEY2, raw);\n                      if (localStorage.getItem(LIVES_KEY2) !== raw) throw new Error("Archive readback mismatch");\n                    }\n                  } catch (_3) {\n                    storageWriteBlocked = true;\n                    pending = null;\n                    return showStorageWriteUnavailable();\n                  }\n                  const flush = window.__returnStorageFlush;\n                  if (typeof flush === "function" && await flush() === false) throw new Error("archive-write-failed");\n                  localStorage.removeItem(SAVE_KEY2);\n                  if (typeof flush === "function" && await flush() === false) throw new Error("save-delete-failed");\n                  if (localStorage.getItem(SAVE_KEY2) !== null) throw new Error("save-delete-readback");\n                  state = freshState();\n                  loadedSnapshot = { ok: true, exists: false, state: null };\n                  lastKnownRaw = null;\n                  pending = null;\n                  effDate = "1996-03-01";\n                  effPostClose = false;\n                  storageWriteBlocked = false;\n                  storageReadBlocked = false;\n                  multiTabConflict = false;\n                  await boot();\n                  document.getElementById("turn-card")?.scrollIntoView({ block: "start" });\n                } catch (_3) {\n                  storageWriteBlocked = true;\n                  pending = null;\n                  showStorageWriteUnavailable();\n                }\n              })();\n              return;\n            }\n            if (id2 === "discharge-ok") {\n              state.flags.dischargeShown = true;\n              state.flags.militaryUntil = null;\n              finishTurn(null, id2);\n              return;\n            }\n            if (id2.startsWith("life:")) {\n              const cid = id2.slice(5);\n              if (cid === "go-now") {\n                state.flags.militaryStart = state.month;\n                state.flags.militaryUntil = addMonths2(state.month, 26);\n                state.flags.lifeDone.enlist = true;\n              } else if (cid === "defer-1y" && !state.flags.deferredUsed) {\n                state.flags.deferredUsed = true;\n                state.flags.enlistAt = addMonths2(state.flags.enlistAt, 12);\n              } else if (cid === "scenario-study") {\n                const hs2 = state.flags.birth.hsYear;\n                const enlist = hs2 + 5 + "-06";\n                state.flags.studyPath = "study";\n                state.flags.academicStatus = "college";\n                state.flags.enrolledMonths = Math.max(0, monthsBetween(hs2 + 3 + "-03", enlist < "1996-03" ? enlist : "1996-03"));\n                state.flags.enlistAt = enlist;\n                state.flags.demoScenario = "pre1996-study";\n                state.flags.lifeDone.hs1 = true;\n                if (enlist < "1996-03") {\n                  state.flags.militaryStart = enlist;\n                  state.flags.militaryUntil = addMonths2(enlist, 26);\n                  state.flags.lifeDone.enlist = true;\n                }\n              } else if (cid === "scenario-plain") {\n                state.flags.lifeDone.hs1 = true;\n              } else if (cid === "acad-focus" || cid === "acad-balanced") {\n                const p = cid === "acad-focus" ? "focus" : "balanced";\n                if (!state.academic) state.academic = { policy: p, effort: 0, version: 1 };\n                else state.academic.policy = p;\n                state.flags.lifeDone.acadPolicy = true;\n                if (state.academic.effort > 0) state.flags.lifeDone.acadBoundaryHs3 = true;\n              } else if (cid === "acad-keep") {\n                state.flags.lifeDone.acadBoundaryHs3 = true;\n              } else if (cid === "acad-admit-ok") {\n                state.flags.lifeDone.admitResult = true;\n                if (state.academic && state.academic.effort < ACAD_ADMIT_MIN) {\n                  state.flags.studyPath = "parttime";\n                  state.flags.enlistAt = state.flags.birth.hsYear + 3 + "-08";\n                  if (state.flags.enlistAt < state.month) state.flags.enlistAt = addMonths2(state.month, 1);\n                }\n              } else if (cid === "acadcol-focus" || cid === "acadcol-balanced") {\n                state.colPolicy = cid === "acadcol-focus" ? "focus" : "balanced";\n                state.flags.lifeDone.acadColPolicy = true;\n              } else if (cid === "acadcol-keep-return") {\n                state.flags.lifeDone.acadColReturn = true;\n              } else if (cid === "acadcol-switch-return") {\n                state.colPolicy = state.colPolicy === "focus" ? "balanced" : "focus";\n                state.flags.lifeDone.acadColReturn = true;\n              } else if (cid === "acadcol-keep-y3") {\n                state.flags.lifeDone.acadColY3 = true;\n              } else if (cid === "acadcol-switch-y3") {\n                state.colPolicy = state.colPolicy === "focus" ? "balanced" : "focus";\n                state.flags.lifeDone.acadColY3 = true;\n              } else if (cid === "study" || cid === "parttime") {\n                state.flags.studyPath = cid;\n                state.flags.lifeDone.hs1 = true;\n                state.flags.enlistAt = cid === "study" ? state.flags.birth.hsYear + 5 + "-06" : state.flags.birth.hsYear + 3 + "-08";\n              } else if (cid === "job" || cid === "fulltime") {\n                state.flags.career = cid;\n                state.flags.lifeDone.college = true;\n                state.flags.academicStatus = "graduated";\n              }\n              finishTurn(turn.event || null, id2);\n              return;\n            }\n            if (id2 === "enter" || id2 === "rebalance") {\n              const ta2 = tradeAccess(turn);\n              if (!ta2.allowed) {\n                render();\n                return;\n              }\n              pending = { step: "product", event: turn.event || null };\n              if (ta2.reserveOnly) {\n                pending.reserveOnly = true;\n                pending.settleMonth = nextSettlementMonth();\n              }\n              render();\n              return;\n            }\n            if (id2 === "skip-preview") {\n              pending = { step: "skip-preview" };\n              render();\n              return;\n            }\n            if (id2 === "skip-to-news" || id2 === "skip-to-news-stop-settlement" || id2 === "skip-to-order-change") {\n              const stopOrderChange = id2 === "skip-to-order-change";\n              if (stopOrderChange && !(state.pendingOrders || []).length) {\n                render();\n                return;\n              }\n              const stopSettlement = id2 === "skip-to-news-stop-settlement" || stopOrderChange;\n              const from = state.month;\n              let k2 = 0, ks = 0, orderChanges = null;\n              while (!state.flags.gameOver && state.month <= GAME_END) {\n                const t = nextTurn();\n                if (t.kind !== "quiet") break;\n                if (t.settlement) {\n                  if (stopSettlement) break;\n                  state.flags.settledMonth = state.month;\n                  ks++;\n                }\n                const priorMonth = state.month, fillsBefore = (state.fillsLog || []).length, historyBefore = state.history.length;\n                advanceMonth();\n                if (storageWriteBlocked || multiTabConflict || state.month === priorMonth) return;\n                k2++;\n                if (stopOrderChange) {\n                  const fills = (state.fillsLog || []).length - fillsBefore;\n                  const expiries = state.history.slice(historyBefore).filter((h2) => typeof h2.choice === "string" && h2.choice.startsWith("order-expired:")).length;\n                  if (fills || expiries) {\n                    orderChanges = { fills, expiries };\n                    break;\n                  }\n                }\n                if (k2 > 500) break;\n              }\n              state.turnCount += k2;\n              state.lastSkip = k2 > 0 ? { from, months: k2, settlements: ks, stopSettlement, ...stopOrderChange ? { stopOrderChange: true, orderChanges } : {} } : null;\n              state.history.push({ month: state.month, decisionMonth: from, choice: (stopOrderChange ? "skip-to-order-change:" : stopSettlement ? "skip-to-news-stop-settlement:" : "skip-to-news:") + k2 });\n              save();\n              render();\n              return;\n            }\n            finishTurn(turn.event || null, id2);\n          }';
    const GEN133_ADVANCE_MONTH_FINGERPRINT = 'function advanceMonth() {\n            if (storageWriteBlocked) return showStorageWriteUnavailable();\n            if (storageReadBlocked) return showStorageReadUnavailable();\n            if (!ReturnEconomyPolicy.inspect(state, currentEconomyId()).ok) return showEconomyConflict();\n            if (DATA && (!ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map((u) => u.product)).ok || !albaTimeShapeOk(state))) return showSaveConflict("\\uBCF4\\uC720\\uC790\\uC0B0\\xB7\\uB300\\uAE30\\uC8FC\\uBB38\\xB7\\uC7A5\\uBD80\\uC758 \\uC77C\\uBD80 \\uC800\\uC7A5 \\uD615\\uC2DD\\uC744 \\uD655\\uC778\\uD560 \\uC218 \\uC5C6\\uC5B4 \\uBA48\\uCDC4\\uC2B5\\uB2C8\\uB2E4. \\uAE08\\uC561\\uC744 \\uCD94\\uC815\\uD558\\uAC70\\uB098 \\uC6D0\\uBB38\\uC744 \\uB36E\\uC5B4\\uC4F0\\uC9C0 \\uC54A\\uC558\\uC5B4\\uC694.", "save-shape");\n            const [y, m] = state.month.split("-").map(Number);\n            const nm = m === 12 ? [y + 1, 1] : [y, m + 1];\n            state.month = nm[0] + "-" + String(nm[1]).padStart(2, "0");\n            if (GAME_LIVING) {\n              const entered = state.month, workMonth = addMonths2(entered, -1);\n              if (entered > GLV.startMonth && entered <= GLV.lastWorkMonth) {\n                const income = state.gameLivingTrack === "job" ? GLV.income : 0;\n                state.cash += income;\n                if (income) state.gameLivingSalaryReceived = (state.gameLivingSalaryReceived || 0) + income;\n                const expense = GLV.expense;\n                state.lastSavings = 0;\n                if (state.cash >= expense) {\n                  state.cash -= expense;\n                  state.gameLivingLedger = state.gameLivingLedger || [];\n                  state.gameLivingLedger.push({ month: entered, income, incomeFor: workMonth, expense, expenseDue: expense, shortfall: 0, cashAfter: state.cash, failed: false });\n                } else {\n                  state.gameLivingPendingDue = { month: entered, income, incomeFor: workMonth, expenseDue: expense };\n                }\n              } else if (entered === addMonths2(GLV.lastWorkMonth, 1) && state.gameLivingTrack === "job") {\n                state.gameLivingReceivable = GLV.income;\n              }\n            }\n            if (state.month > GAME_END) return;\n            const b0 = state.flags.birth;\n            if (b0 && state.flags.studyPath === "study") {\n              if (!state.flags.academicStatus && state.month >= b0.hsYear + 3 + "-03") {\n                if (!state.academic || state.flags.lifeDone.admitResult) {\n                  state.flags.academicStatus = "college";\n                  state.flags.enrolledMonths = 0;\n                }\n              }\n              if (state.academic && !state.flags.academicStatus && !militaryActive() && state.month < b0.hsYear + 3 + "-03") {\n                state.academic.effort += state.academic.policy === "focus" ? 2 : 1;\n              }\n              if (state.flags.academicStatus === "college" && !militaryActive()) {\n                state.flags.enrolledMonths = (state.flags.enrolledMonths || 0) + (state.acadRules === 3 && state.colPolicy === "balanced" ? 0.5 : 1);\n              }\n            }\n            effDate = state.month + "-01";\n            effPostClose = false;\n            tryFillOrders();\n            if (storageWriteBlocked || multiTabConflict) return;\n            if (CASH_MODE) {\n              const income = !militaryActive() && (state.flags.studyPath === "parttime" && b0 && state.month < b0.hsYear + 3 + "-03" || state.flags.career === "job" && state.flags.academicStatus === "graduated") ? 3e5 : 0;\n              const tuition = !state.cashEvents.tuitionIssued && state.flags.academicStatus === "college" ? 8e5 : 0;\n              state.cash += income;\n              const row = { month: state.month, income, living: 1e5, tuition, status: "due", paid: 0 };\n              const auto = state.cashAutomation;\n              if (auto && auto.enabled && state.month > auto.enabledAfterMonth && !tuition && state.cash >= row.living) {\n                state.cash -= row.living;\n                row.paid = row.living;\n                row.status = "paid";\n                auto.paidMonths.push(state.month);\n              }\n              state.cashEvents.rows.push(row);\n              if (tuition) state.cashEvents.tuitionIssued = true;\n              state.lastSavings = 0;\n            } else if (careerCashActive()) {\n              applyCareerCashMonth();\n            } else if (!GAME_LIVING) {\n              const sv = monthlySavings();\n              if (sv > 0) {\n                state.cash += sv;\n                state.lastSavings = sv;\n              } else {\n                state.lastSavings = 0;\n              }\n              applyJobSavingsPlan(sv);\n              state.savingsLedger = state.savingsLedger || [];\n              state.savingsLedger.push({ month: state.month, amount: sv, reason: militaryActive() ? "\\uBCF5\\uBB34 \\uC911" : state.flags.career === "job" && state.flags.academicStatus === "graduated" ? "\\uC878\\uC5C5 \\uD6C4 \\uCDE8\\uC5C5" : state.flags.studyPath === "parttime" && b0 && state.month < b0.hsYear + 3 + "-03" ? "\\uACE0\\uAD50 \\uC54C\\uBC14" : state.flags.studyPath === "study" && state.academic && state.academic.policy === "balanced" && b0 && !state.flags.academicStatus && state.month < b0.hsYear + 3 + "-03" ? "\\uD559\\uC5C5 \\uBCD1\\uD589 \\uC54C\\uBC14 [\\uC2DC\\uD5D8\\uAC12]" : state.acadRules === 3 && state.flags.academicStatus === "college" && state.colPolicy === "balanced" ? "\\uB300\\uD559 \\uBCD1\\uD589 \\uC54C\\uBC14 [\\uC2DC\\uD5D8\\uAC12]" : sv > 0 ? "\\uC9C4\\uB85C \\uBBF8\\uC815 \\uC2DC\\uC791 \\uADDC\\uCE59" : "\\uC815\\uAE30 \\uC21C\\uC800\\uCD95 \\uC5C6\\uC74C", basis: "test-net-savings-v1" });\n            }\n            const interestEntries = [];\n            for (const [p, h2] of Object.entries(state.holdings)) {\n              const u = DATA.unlocks.find((x) => x.product === p);\n              if (u && (u.rule === "accrual" || u.rule === "fxaccrual")) {\n                const before = h2.qty, rate = accrualRate(u);\n                h2.qty = h2.qty * (1 + rate.annual / 12);\n                if (before > 0) interestEntries.push({\n                  product: p,\n                  balanceBefore: before,\n                  interest: h2.qty - before,\n                  balanceAfter: h2.qty,\n                  annualRate: rate.annual,\n                  rateLabel: rate.label,\n                  unit: u.rule === "fxaccrual" ? "USD" : "KRW",\n                  basis: "prototype-monthly-accrual-v1"\n                });\n              }\n            }\n            state.interestLedger = state.interestLedger || [];\n            state.interestLedger.push({ month: state.month, entries: interestEntries });\n            chaosTick();\n            if (state.chaos >= CHAOS.overAt) state.flags.gameOver = "chaos";\n          }';
    const GEN133_NEXT_LIFE_FINGERPRINT = 'function nextLifeEvent() {\n            if (GAME_LIVING) return null;\n            const b = state.flags.birth;\n            if (!b) return null;\n            if (!state.flags.lifeDone) state.flags.lifeDone = {};\n            const hs = b.hsYear;\n            const done = state.flags.lifeDone;\n            if (!done.hs1) {\n              const d = hs + "-03-02";\n              if (d.slice(0, 7) < schoolStartMonth()) {\n                if (hs <= 1994 && !state.flags.studyPath && !done.scenarioOffer) {\n                  return {\n                    _dynamic: true,\n                    id: "life-scenario",\n                    date: "1996-03-01",\n                    kind: "life",\n                    card_title: "\\uD68C\\uADC0 \\uC2DC\\uC810\\uC758 \\uC9C4\\uB85C \\uC774\\uB825\\uC744 \\uC815\\uD569\\uB2C8\\uB2E4",\n                    card_summary: "\\uC120\\uD0DD\\uD55C \\uC0DD\\uB144\\uC740 1996\\uB144 \\uC774\\uC804\\uC5D0 \\uACE0\\uB4F1\\uD559\\uAD50\\uC5D0 \\uC9C4\\uD559\\uD588\\uC5B4\\uC694. \\uC2DC\\uC81C\\uD488 \\uAD6C\\uAC04 \\uC548\\uC5D0\\uC11C \\uC878\\uC5C5\\xB7\\uCDE8\\uC5C5 \\uBD84\\uAE30\\uB97C \\uC2DC\\uC5F0\\uD558\\uB824\\uBA74 \\uC9C4\\uD559 \\uB8E8\\uD2B8\\uB85C \\uC2DC\\uC791\\uD558\\uB294 \\uC2DC\\uC5F0\\uC6A9 \\uC2DC\\uB098\\uB9AC\\uC624\\uB97C \\uACE0\\uB97C \\uC218 \\uC788\\uC5B4\\uC694. \\uC774\\uAC83\\uC740 \\uD655\\uC815\\uB41C \\uC9C4\\uB85C \\uC774\\uB825\\uC774 \\uC544\\uB2C8\\uB77C \\uC2DC\\uC5F0\\uC6A9 \\uAC00\\uC815\\uC774\\uC5D0\\uC694 [\\uC2DC\\uC5F0 \\uC81C\\uC57D].",\n                    impact_tags: [],\n                    unlock: null,\n                    choices: [\n                      { id: "scenario-study", label: "\\uC2DC\\uC5F0\\uC6A9: 1996\\uB144 \\uD604\\uC7AC \\uB300\\uD559 \\uC7AC\\uD559 \\uC911\\uC73C\\uB85C \\uC2DC\\uC791 (\\uC9C4\\uD559 \\uB8E8\\uD2B8 \\uAC00\\uC815)" },\n                      { id: "scenario-plain", label: "\\uC77C\\uBC18 \\uC2DC\\uC791 \\u2014 \\uC9C4\\uB85C \\uC774\\uB825 \\uBBF8\\uC815 (\\uC878\\uC5C5\\xB7\\uCDE8\\uC5C5 \\uBD84\\uAE30\\uB294 \\uC2DC\\uC81C\\uD488 \\uAD6C\\uAC04 \\uBC16)" }\n                    ]\n                  };\n                }\n                done.hs1 = true;\n              } else return {\n                _dynamic: true,\n                id: "life-hs1",\n                date: d,\n                kind: "life",\n                card_title: "\\uACE01, \\uC2DC\\uAC04\\uC744 \\uC5B4\\uB514\\uC5D0 \\uC4F8\\uAE4C",\n                card_summary: "\\uACF5\\uBD80\\uC5D0 \\uC9D1\\uC911\\uD574 \\uC9C4\\uD559\\uC744 \\uB178\\uB9AC\\uAC70\\uB098, \\uC54C\\uBC14\\uB85C \\uC885\\uC7A3\\uB3C8\\uC744 \\uBAA8\\uC544 \\uC804\\uC5C5 \\uD22C\\uC790\\uC758 \\uAE38\\uB85C \\uAC08 \\uC218 \\uC788\\uB2E4. \\uC9C4\\uB85C\\uB9C8\\uB2E4 \\uD22C\\uC790\\uC5D0 \\uC4F8 \\uC2DC\\uAC04\\uACFC \\uC18C\\uB4DD\\uC774 \\uB2EC\\uB77C\\uC9C4\\uB2E4. (\\uC77C\\uC815\\uC740 \\uC0DD\\uB144\\xB7\\uD559\\uC81C\\uC5D0\\uC11C \\uC0B0\\uCD9C)",\n                impact_tags: [],\n                unlock: null,\n                choices: careerCashActive() ? [\n                  { id: "study", label: "\\uACF5\\uBD80 \\uC9D1\\uC911 \\u2014 \\uC9C4\\uD559 \\uB8E8\\uD2B8 (\\uC7AC\\uD559 \\uD559\\uBE44 3\\xB79\\uC6D4 " + CCV.TUITION_PER_TERM.toLocaleString() + "\\uC6D0 \\xB7 \\uCDE8\\uC5C5 \\uAE09\\uC5EC \\uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\\uC6D0 [\\uC124\\uACC4\\uAC12])" },\n                  { id: "parttime", label: "\\uC54C\\uBC14 \\uBCD1\\uD589 \\u2014 " + albaWonPhrase() + "\\uC73C\\uB85C \\uC885\\uC7A3\\uB3C8\\uC744 \\uBAA8\\uC544 \\uC804\\uC5C5 \\uD22C\\uC790 \\uB8E8\\uD2B8" }\n                ] : [\n                  { id: "study", label: "\\uACF5\\uBD80 \\uC9D1\\uC911 \\u2014 \\uC9C4\\uD559 \\uB8E8\\uD2B8 (\\uC878\\uC5C5\\xB7\\uCDE8\\uC5C5 \\uD6C4 \\uC21C\\uC800\\uCD95 \\uC2DC\\uD5D8\\uAC12)" },\n                  { id: "parttime", label: "\\uC54C\\uBC14 \\uBCD1\\uD589 \\u2014 \\uC885\\uC7A3\\uB3C8\\uC744 \\uBAA8\\uC544 \\uC804\\uC5C5 \\uD22C\\uC790 \\uB8E8\\uD2B8" }\n                ]\n              };\n            }\n            if (SCHOOL_MODE && !CAREER_TRIAL && !CASH_MODE && state.flags.academicTrackV1 && state.flags.studyPath === "study" && !state.flags.gameOver && state.flags.birth) {\n              const hsA = state.flags.birth.hsYear;\n              if (!state.academic && !done.acadPolicy) {\n                return {\n                  _dynamic: true,\n                  id: "life-acad-policy",\n                  date: state.month + "-02",\n                  kind: "life",\n                  card_title: "\\uC7AC\\uD559 \\uC911 \\uC2DC\\uAC04 \\uBC30\\uBD84 \\uBC29\\uCE68\\uC744 \\uC815\\uD55C\\uB2E4",\n                  card_summary: "\\uACF5\\uBD80\\uC5D0 \\uC9D1\\uC911\\uD558\\uBA74 \\uC9C4\\uD559 \\uAE30\\uC900 \\uB3C4\\uB2EC\\uC774 \\uD655\\uC815\\uB418\\uACE0, \\uC54C\\uBC14\\uB97C \\uBCD1\\uD589\\uD558\\uBA74 " + albaWonPhrase() + "\\uC758 \\uC885\\uC7A3\\uB3C8\\uC744 \\uBAA8\\uC73C\\uC9C0\\uB9CC \\uC9C4\\uD559 \\uAE30\\uC900 \\uBBF8\\uB2EC\\uC774 \\uD655\\uC815\\uB41C\\uB2E4. \\uC2E4\\uC81C \\uD559\\uC5C5\\xB7\\uC785\\uC2DC\\xB7\\uADFC\\uB85C \\uBAA8\\uD615\\uC774 \\uC544\\uB2C8\\uB77C \\uAC8C\\uC784 \\uAC00\\uC815 [\\uC2DC\\uD5D8\\uADDC\\uCE59]\\uC774\\uB2E4. \\uBC29\\uCE68\\uC740 \\uACE03 3\\uC6D4\\uC5D0 \\uD55C \\uBC88 \\uB2E4\\uC2DC \\uBCFC \\uC218 \\uC788\\uB2E4. \\uC878\\uC5C5\\uAE4C\\uC9C0 " + monthsBetween(state.month, hsA + 3 + "-02") + "\\uAC1C\\uC6D4 \\uB204\\uC801 \\uAE30\\uC900\\uC73C\\uB85C \\uACF5\\uBD80 \\uC9D1\\uC911\\uC774\\uBA74 " + monthsBetween(state.month, hsA + 3 + "-02") * 2 + ", \\uC54C\\uBC14 \\uBCD1\\uD589\\uC774\\uBA74 " + monthsBetween(state.month, hsA + 3 + "-02") + " \\u2014 \\uC9C4\\uD559 \\uAE30\\uC900 " + ACAD_ADMIT_MIN + " [\\uC784\\uC758 \\uC2DC\\uD5D8\\uAC12]\\uC5D0 \\uB300\\uD574 \\uACF5\\uBD80 \\uC9D1\\uC911\\uC740 \\uB3C4\\uB2EC, \\uC54C\\uBC14 \\uBCD1\\uD589\\uC740 \\uBBF8\\uB2EC\\uC774 \\uC815\\uD574\\uC9C4 \\uAD6C\\uC870\\uB2E4 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uACC4\\uC0B0 \\xB7 \\uC2E4\\uC81C \\uC785\\uC2DC \\uC544\\uB2D8].",\n                  impact_tags: [],\n                  unlock: null,\n                  choices: [\n                    { id: "acad-focus", label: "\\uACF5\\uBD80 \\uC9D1\\uC911 \\u2014 \\uC218\\uC785 0\\uC6D0 \\xB7 \\uC9C4\\uD559 \\uAE30\\uC900 \\uB3C4\\uB2EC \\uD655\\uC815 [\\uC2DC\\uD5D8\\uADDC\\uCE59]" },\n                    { id: "acad-balanced", label: "\\uC54C\\uBC14 \\uBCD1\\uD589 \\u2014 " + albaWonPhrase() + " \\xB7 \\uC9C4\\uD559 \\uAE30\\uC900 \\uBBF8\\uB2EC \\uD655\\uC815 [\\uC2DC\\uD5D8\\uADDC\\uCE59]" }\n                  ]\n                };\n              }\n              if (state.academic && !state.flags.academicStatus && !done.acadBoundaryHs3 && hsA + 2 + "-03" <= state.month) {\n                if (!state.acadRules) {\n                  return {\n                    _dynamic: true,\n                    id: "life-acad-hs3",\n                    date: hsA + 2 + "-03-02",\n                    kind: "life",\n                    card_title: "\\uACE03, \\uB9C8\\uC9C0\\uB9C9 1\\uB144\\uC758 \\uBC29\\uCE68",\n                    card_summary: "\\uC9C0\\uAE08\\uAE4C\\uC9C0\\uC758 \\uB204\\uC801 \\uB178\\uB825\\uC740 " + state.academic.effort + " [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uB204\\uC801]. \\uC9C4\\uD559 \\uAE30\\uC900\\uC740 " + ACAD_ADMIT_MIN + " [\\uC784\\uC758 \\uC2DC\\uD5D8\\uAC12]. \\uBC29\\uCE68\\uC744 \\uBC14\\uAFB8\\uBA74 \\uB0A8\\uC740 \\uAE30\\uAC04\\uC758 \\uB204\\uC801 \\uC18D\\uB3C4\\uC640 \\uC54C\\uBC14 \\uC218\\uC785\\uC774 \\uBC14\\uB010\\uB2E4. \\uC2E4\\uC81C \\uC785\\uC2DC\\uAC00 \\uC544\\uB2CC \\uAC8C\\uC784 \\uAC00\\uC815\\uC774\\uB2E4.",\n                    impact_tags: [],\n                    unlock: null,\n                    choices: [\n                      { id: "acad-keep", label: "\\uD604\\uC7AC \\uBC29\\uCE68 \\uC720\\uC9C0 (" + (state.academic.policy === "focus" ? "\\uACF5\\uBD80 \\uC9D1\\uC911" : "\\uC54C\\uBC14 \\uBCD1\\uD589") + ")" },\n                      { id: state.academic.policy === "focus" ? "acad-balanced" : "acad-focus", label: state.academic.policy === "focus" ? "\\uC54C\\uBC14 \\uBCD1\\uD589\\uC73C\\uB85C \\uC804\\uD658 \\u2014 " + albaWonPhrase() : "\\uACF5\\uBD80 \\uC9D1\\uC911\\uC73C\\uB85C \\uC804\\uD658 \\u2014 \\uC218\\uC785 0\\uC6D0" }\n                    ]\n                  };\n                }\n                const remain = monthsBetween(state.month, hsA + 3 + "-02");\n                const maxFocus = state.academic.effort + remain * 2, maxBal = state.academic.effort + remain;\n                const nowFocus = state.academic.policy === "focus";\n                const keepMax = nowFocus ? maxFocus : maxBal, switchMax = nowFocus ? maxBal : maxFocus;\n                const keepPass = keepMax >= ACAD_ADMIT_MIN, switchPass = switchMax >= ACAD_ADMIT_MIN;\n                let sum = "\\uD604\\uC7AC \\uB204\\uC801 " + state.academic.effort + " [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uB204\\uC801] \\xB7 \\uC9C4\\uD559 \\uD310\\uC815\\uAE4C\\uC9C0 \\uB0A8\\uC740 " + remain + "\\uAC1C\\uC6D4 \\xB7 \\uAE30\\uC900 " + ACAD_ADMIT_MIN + " [\\uC784\\uC758 \\uC2DC\\uD5D8\\uAC12]. \\uC9C0\\uAE08 \\uBC29\\uCE68\\uC744 \\uC720\\uC9C0\\uD558\\uBA74 \\uCD5C\\uB300 " + keepMax + "\\uB85C \\uAE30\\uC900 " + (keepPass ? "\\uB3C4\\uB2EC" : "\\uBBF8\\uB2EC") + "\\uC774 \\uC815\\uD574\\uC838 \\uC788\\uB2E4. \\uC2E4\\uC81C \\uC785\\uC2DC\\uAC00 \\uC544\\uB2CC \\uAC8C\\uC784 \\uAC00\\uC815 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uACC4\\uC0B0].";\n                const ch = [{ id: "acad-keep", label: "\\uD604\\uC7AC \\uBC29\\uCE68 \\uC720\\uC9C0 (" + (nowFocus ? "\\uACF5\\uBD80 \\uC9D1\\uC911" : "\\uC54C\\uBC14 \\uBCD1\\uD589") + ") \\u2014 \\uC608\\uC0C1 \\uB204\\uC801 " + keepMax + " \\xB7 \\uAE30\\uC900 " + (keepPass ? "\\uB3C4\\uB2EC" : "\\uBBF8\\uB2EC") }];\n                if (nowFocus) {\n                  ch.push({ id: "acad-balanced", label: "\\uC54C\\uBC14 \\uBCD1\\uD589\\uC73C\\uB85C \\uC804\\uD658 \\u2014 " + albaWonPhrase() + " \\xB7 \\uC608\\uC0C1 \\uB204\\uC801 " + switchMax + " \\xB7 \\uAE30\\uC900 " + (switchPass ? "\\uB3C4\\uB2EC" : "\\uBBF8\\uB2EC\\uB85C \\uBC14\\uB01C") });\n                } else if (switchPass) {\n                  ch.push({ id: "acad-focus", label: "\\uACF5\\uBD80 \\uC9D1\\uC911\\uC73C\\uB85C \\uC804\\uD658 \\u2014 \\uC218\\uC785 0\\uC6D0 \\xB7 \\uC608\\uC0C1 \\uB204\\uC801 " + switchMax + " \\xB7 \\uAE30\\uC900 \\uB3C4\\uB2EC \\uAC00\\uB2A5" });\n                } else {\n                  sum += " \\uC774\\uC81C \\uACF5\\uBD80\\uC5D0\\uB9CC \\uC9D1\\uC911\\uD574\\uB3C4 \\uCD5C\\uB300 " + switchMax + "\\uB77C \\uC774\\uBC88 \\uAE30\\uC900\\uC5D0\\uB294 \\uB2FF\\uC9C0 \\uC54A\\uC544, \\uC9D1\\uC911 \\uC804\\uD658 \\uC120\\uD0DD\\uC9C0\\uB294 \\uB450\\uC9C0 \\uC54A\\uB294\\uB2E4. \\uC54C\\uBC14 \\uC218\\uC785\\uC740 \\uACC4\\uC18D\\uB41C\\uB2E4.";\n                }\n                return {\n                  _dynamic: true,\n                  id: "life-acad-hs3",\n                  date: hsA + 2 + "-03-02",\n                  kind: "life",\n                  card_title: "\\uACE03, \\uB9C8\\uC9C0\\uB9C9 1\\uB144\\uC758 \\uBC29\\uCE68",\n                  card_summary: sum,\n                  impact_tags: [],\n                  unlock: null,\n                  choices: ch\n                };\n              }\n              if (state.academic && !state.flags.academicStatus && !done.admitResult && hsA + 3 + "-02" <= state.month) {\n                const pass = state.academic.effort >= ACAD_ADMIT_MIN;\n                return {\n                  _dynamic: true,\n                  id: "life-admit-result",\n                  date: hsA + 3 + "-02-15",\n                  kind: "life",\n                  card_title: pass ? "\\uB300\\uD559\\uC5D0 \\uD569\\uACA9\\uD588\\uB2E4 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uD310\\uC815]" : "\\uC9C4\\uD559 \\uAE30\\uC900 \\uBBF8\\uB2EC \\u2014 \\uC9C4\\uB85C\\uAC00 \\uBC14\\uB010\\uB2E4 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uD310\\uC815]",\n                  card_summary: "\\uB204\\uC801 \\uB178\\uB825 " + state.academic.effort + " / \\uAE30\\uC900 " + ACAD_ADMIT_MIN + " [\\uC784\\uC758 \\uC2DC\\uD5D8\\uAC12]. " + (pass ? "\\uAE30\\uC874 \\uD750\\uB984\\uB300\\uB85C \\uB300\\uD559\\uC5D0 \\uC9C4\\uD559\\uD55C\\uB2E4." : "\\uC54C\\uBC14\\xB7\\uC804\\uC5C5 \\uB8E8\\uD2B8\\uB85C \\uC804\\uD658\\uB41C\\uB2E4. \\uC774 \\uD310\\uC815\\uC740 \\uC2E4\\uC81C \\uC785\\uC2DC\\uAC00 \\uC544\\uB2C8\\uB77C \\uAC8C\\uC784 \\uAC00\\uC815\\uC774\\uB2E4."),\n                  impact_tags: [],\n                  unlock: null,\n                  choices: [{ id: "acad-admit-ok", label: pass ? "\\uB300\\uD559 \\uC9C4\\uD559 (\\uAE30\\uC874 \\uD750\\uB984)" : "\\uC54C\\uBC14\\xB7\\uC804\\uC5C5 \\uB8E8\\uD2B8\\uB85C \\uC9C4\\uD589" }]\n                };\n              }\n              if (state.acadRules === 3 && state.flags.academicStatus === "college") {\n                const colRate = () => state.colPolicy === "balanced" ? 0.5 : 1;\n                const colRemain = () => Math.max(0, 48 - (state.flags.enrolledMonths || 0));\n                const colServiceNote = !state.flags.militaryStart && !state.flags.dischargeShown && state.flags.enlistAt ? " \\uC785\\uB300 \\uC608\\uC815 " + state.flags.enlistAt + "\\uBD80\\uD130 26\\uAC1C\\uC6D4 \\uBCF5\\uBB34[\\uC2DC\\uD5D8 \\uAC00\\uC815]\\uB97C \\uBC18\\uC601\\uD55C \\uC608\\uC0C1\\uC774\\uB2E4(\\uC720\\uC608 \\uC120\\uD0DD \\uC2DC \\uADF8\\uB9CC\\uD07C \\uC9C0\\uC5F0). " : "";\n                const colGradAt = (rate) => {\n                  let e2 = state.flags.enrolledMonths || 0, m = state.month, guard = 0;\n                  const enlist = !state.flags.militaryStart && !state.flags.dischargeShown ? state.flags.enlistAt : null;\n                  const mEnd = enlist ? addMonths2(enlist, 26) : null;\n                  while (e2 < 48 && guard++ < 400) {\n                    m = addMonths2(m, 1);\n                    const serving = enlist && m > enlist && m < mEnd;\n                    if (!serving) e2 += rate;\n                  }\n                  return m;\n                };\n                const albaWon = albaWonPhrase();\n                if (!state.colPolicy && !done.acadColPolicy) {\n                  return {\n                    _dynamic: true,\n                    id: "life-acad-col-policy",\n                    date: state.month + "-02",\n                    kind: "life",\n                    card_title: "\\uB300\\uD559\\uC5D0\\uC11C\\uC758 \\uC2DC\\uAC04 \\uBC30\\uBD84 \\uBC29\\uCE68\\uC744 \\uC815\\uD55C\\uB2E4",\n                    card_summary: "\\uD559\\uC5C5\\uC5D0 \\uC9D1\\uC911\\uD558\\uBA74 \\uC7AC\\uD559 \\uB204\\uC801\\uC774 \\uC6D4 1\\uB85C \\uC313\\uC5EC \\uC878\\uC5C5 \\uC694\\uAC74 48\\uAC1C\\uC6D4\\uC5D0 \\uBE68\\uB9AC \\uB2FF\\uACE0, \\uC54C\\uBC14\\uB97C \\uBCD1\\uD589\\uD558\\uBA74 " + albaWon + "\\uC744 \\uBAA8\\uC73C\\uC9C0\\uB9CC \\uC7AC\\uD559 \\uB204\\uC801\\uC774 \\uC6D4 0.5\\uB77C \\uC878\\uC5C5\\uC774 \\uADF8\\uB9CC\\uD07C \\uB2A6\\uC5B4\\uC9C4\\uB2E4. \\uC5B4\\uB290 \\uCABD\\uB3C4 \\uC2E4\\uD328\\uAC00 \\uC544\\uB2CC \\uC2DC\\uAC04\\uACFC \\uC218\\uC785\\uC758 \\uBC30\\uBD84\\uC774\\uB2E4. \\uC2E4\\uC81C \\uD559\\uC81C\\xB7\\uADFC\\uB85C \\uBAA8\\uD615\\uC774 \\uC544\\uB2C8\\uB77C \\uAC8C\\uC784 \\uAC00\\uC815 [\\uC2DC\\uD5D8\\uADDC\\uCE59]. \\uBC29\\uCE68\\uC740 \\uC804\\uC5ED \\uBCF5\\uD559 \\uB54C\\uC640 3\\uD559\\uB144 \\uC2DC\\uC791 \\uB54C \\uB2E4\\uC2DC \\uBCFC \\uC218 \\uC788\\uB2E4. " + colServiceNote + "\\uC9C0\\uAE08 \\uAE30\\uC900\\uC73C\\uB85C \\uD559\\uC5C5 \\uC911\\uC2EC\\uC774\\uBA74 \\uC878\\uC5C5 \\uC608\\uC0C1 " + colGradAt(1) + ", \\uC54C\\uBC14 \\uBCD1\\uD589\\uC774\\uBA74 \\uC878\\uC5C5 \\uC608\\uC0C1 " + colGradAt(0.5) + " [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uACC4\\uC0B0 \\xB7 \\uC2E4\\uC81C \\uD559\\uC81C \\uC544\\uB2D8].",\n                    impact_tags: [],\n                    unlock: null,\n                    choices: [\n                      { id: "acadcol-focus", label: "\\uD559\\uC5C5 \\uC911\\uC2EC \\u2014 \\uC218\\uC785 0\\uC6D0 \\xB7 \\uC878\\uC5C5 \\uC608\\uC0C1 " + colGradAt(1) + " [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uACC4\\uC0B0]" },\n                      { id: "acadcol-balanced", label: "\\uC54C\\uBC14 \\uBCD1\\uD589 \\u2014 " + albaWon + " \\xB7 \\uC878\\uC5C5 \\uC608\\uC0C1 " + colGradAt(0.5) + "\\uB85C \\uC9C0\\uC5F0" }\n                    ]\n                  };\n                }\n                if (state.colPolicy && !done.acadColReturn && state.flags.militaryStart && state.flags.dischargeShown) {\n                  const bal = state.colPolicy === "balanced";\n                  const keepG = colGradAt(colRate()), swG = colGradAt(bal ? 1 : 0.5);\n                  return {\n                    _dynamic: true,\n                    id: "life-acad-col-return",\n                    date: state.month + "-02",\n                    kind: "life",\n                    card_title: "\\uBCF5\\uD559, \\uC2DC\\uAC04 \\uBC30\\uBD84\\uC744 \\uB2E4\\uC2DC \\uC815\\uD55C\\uB2E4",\n                    card_summary: "\\uD604\\uC7AC \\uC7AC\\uD559 \\uB204\\uC801 " + (state.flags.enrolledMonths || 0) + "\\uAC1C\\uC6D4 \\xB7 \\uC878\\uC5C5 \\uC694\\uAC74 48\\uAC1C\\uC6D4\\uAE4C\\uC9C0 \\uB0A8\\uC740 " + colRemain() + "\\uAC1C\\uC6D4 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uB204\\uC801]. \\uC9C0\\uAE08 \\uBC29\\uCE68(" + (bal ? "\\uC54C\\uBC14 \\uBCD1\\uD589" : "\\uD559\\uC5C5 \\uC911\\uC2EC") + ")\\uC744 \\uC720\\uC9C0\\uD558\\uBA74 \\uC878\\uC5C5 \\uC608\\uC0C1 " + keepG + ", " + (bal ? "\\uD559\\uC5C5 \\uC911\\uC2EC\\uC73C\\uB85C \\uBC14\\uAFB8\\uBA74 \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG + "\\uB85C \\uC55E\\uB2F9\\uACA8\\uC9C0\\uACE0 \\uC218\\uC785\\uC774 \\uB04A\\uAE34\\uB2E4" : "\\uC54C\\uBC14 \\uBCD1\\uD589\\uC73C\\uB85C \\uBC14\\uAFB8\\uBA74 " + albaWon + "\\uC744 \\uBAA8\\uC73C\\uC9C0\\uB9CC \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG + "\\uB85C \\uB2A6\\uC5B4\\uC9C4\\uB2E4") + ". \\uC2E4\\uC81C \\uD559\\uC81C\\uAC00 \\uC544\\uB2CC \\uAC8C\\uC784 \\uAC00\\uC815 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uACC4\\uC0B0].",\n                    impact_tags: [],\n                    unlock: null,\n                    choices: [\n                      { id: "acadcol-keep-return", label: "\\uD604\\uC7AC \\uBC29\\uCE68 \\uC720\\uC9C0 (" + (bal ? "\\uC54C\\uBC14 \\uBCD1\\uD589" : "\\uD559\\uC5C5 \\uC911\\uC2EC") + ") \\u2014 \\uC878\\uC5C5 \\uC608\\uC0C1 " + keepG },\n                      { id: "acadcol-switch-return", label: bal ? "\\uD559\\uC5C5 \\uC911\\uC2EC\\uC73C\\uB85C \\uC804\\uD658 \\u2014 \\uC218\\uC785 0\\uC6D0 \\xB7 \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG : "\\uC54C\\uBC14 \\uBCD1\\uD589\\uC73C\\uB85C \\uC804\\uD658 \\u2014 " + albaWon + " \\xB7 \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG }\n                    ]\n                  };\n                }\n                if (state.colPolicy && !done.acadColY3 && (state.flags.enrolledMonths || 0) >= 24) {\n                  const bal = state.colPolicy === "balanced";\n                  const keepG = colGradAt(colRate()), swG = colGradAt(bal ? 1 : 0.5);\n                  return {\n                    _dynamic: true,\n                    id: "life-acad-col-y3",\n                    date: state.month + "-02",\n                    kind: "life",\n                    card_title: "3\\uD559\\uB144, \\uB0A8\\uC740 \\uAE30\\uAC04\\uC758 \\uBC29\\uCE68\\uC744 \\uB2E4\\uC2DC \\uBCF8\\uB2E4",\n                    card_summary: "\\uD604\\uC7AC \\uC7AC\\uD559 \\uB204\\uC801 " + (state.flags.enrolledMonths || 0) + "\\uAC1C\\uC6D4 \\xB7 \\uC878\\uC5C5 \\uC694\\uAC74 48\\uAC1C\\uC6D4\\uAE4C\\uC9C0 \\uB0A8\\uC740 " + colRemain() + "\\uAC1C\\uC6D4 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uB204\\uC801]. \\uC9C0\\uAE08 \\uBC29\\uCE68(" + (bal ? "\\uC54C\\uBC14 \\uBCD1\\uD589" : "\\uD559\\uC5C5 \\uC911\\uC2EC") + ")\\uC744 \\uC720\\uC9C0\\uD558\\uBA74 \\uC878\\uC5C5 \\uC608\\uC0C1 " + keepG + ", " + (bal ? "\\uD559\\uC5C5 \\uC911\\uC2EC\\uC73C\\uB85C \\uBC14\\uAFB8\\uBA74 \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG + "\\uB85C \\uC55E\\uB2F9\\uACA8\\uC9C0\\uACE0 \\uC218\\uC785\\uC774 \\uB04A\\uAE34\\uB2E4" : "\\uC54C\\uBC14 \\uBCD1\\uD589\\uC73C\\uB85C \\uBC14\\uAFB8\\uBA74 " + albaWon + "\\uC744 \\uBAA8\\uC73C\\uC9C0\\uB9CC \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG + "\\uB85C \\uB2A6\\uC5B4\\uC9C4\\uB2E4") + ". \\uC2E4\\uC81C \\uD559\\uC81C\\uAC00 \\uC544\\uB2CC \\uAC8C\\uC784 \\uAC00\\uC815 [\\uC2DC\\uD5D8\\uADDC\\uCE59 \\uACC4\\uC0B0].",\n                    impact_tags: [],\n                    unlock: null,\n                    choices: [\n                      { id: "acadcol-keep-y3", label: "\\uD604\\uC7AC \\uBC29\\uCE68 \\uC720\\uC9C0 (" + (bal ? "\\uC54C\\uBC14 \\uBCD1\\uD589" : "\\uD559\\uC5C5 \\uC911\\uC2EC") + ") \\u2014 \\uC878\\uC5C5 \\uC608\\uC0C1 " + keepG },\n                      { id: "acadcol-switch-y3", label: bal ? "\\uD559\\uC5C5 \\uC911\\uC2EC\\uC73C\\uB85C \\uC804\\uD658 \\u2014 \\uC218\\uC785 0\\uC6D0 \\xB7 \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG : "\\uC54C\\uBC14 \\uBCD1\\uD589\\uC73C\\uB85C \\uC804\\uD658 \\u2014 " + albaWon + " \\xB7 \\uC878\\uC5C5 \\uC608\\uC0C1 " + swG }\n                    ]\n                  };\n                }\n              }\n            }\n            if (!done.college && state.flags.studyPath === "study") {\n              if (state.flags.academicStatus === "college" && (state.flags.enrolledMonths || 0) >= 48 && !militaryActive()) {\n                return {\n                  _dynamic: true,\n                  id: "life-grad",\n                  date: state.month + "-15",\n                  kind: "life",\n                  card_title: "\\uB300\\uD559 \\uC878\\uC5C5\\uC744 \\uC55E\\uB450\\uACE0 \\uC9C4\\uB85C\\uB97C \\uC815\\uD55C\\uB2E4",\n                  card_summary: careerCashActive() ? "\\uCDE8\\uC5C5\\uD560\\uC9C0, \\uC804\\uC5C5 \\uD22C\\uC790\\uB85C \\uB098\\uC124\\uC9C0 \\uC815\\uD55C\\uB2E4. \\uBCF5\\uBB34 \\uD734\\uD559\\uC73C\\uB85C \\uB2A6\\uC5B4\\uC9C4 \\uACBD\\uC6B0 \\uADF8\\uB9CC\\uD07C \\uB4A4\\uC758 \\uC77C\\uC815\\uC774\\uC5D0\\uC694. \\uCDE8\\uC5C5\\uC744 \\uACE0\\uB974\\uBA74 \\uB2E4\\uC74C \\uB2EC\\uBD80\\uD130 \\uAE09\\uC5EC \\uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\\uC6D0\\uC774 \\uB4E4\\uC5B4\\uC624\\uACE0 \\uC0DD\\uD65C\\uBE44 \\uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\\uC6D0\\uC774 \\uB098\\uAC11\\uB2C8\\uB2E4 [\\uBA85\\uC2DC \\uAC8C\\uC784\\uC124\\uACC4\\uAC12]. \\uC804\\uC5C5\\uC740 \\uAE09\\uC5EC \\uC5C6\\uC774 \\uC0DD\\uD65C\\uBE44\\uAC00 \\uACC4\\uC18D \\uB098\\uAC00\\uACE0, \\uC7AC\\uD559 \\uC911 \\uBBF8\\uB0A9 \\uD559\\uBE44\\uAC00 \\uC788\\uC73C\\uBA74 \\uC0C1\\uD658\\uD574\\uC57C \\uD569\\uB2C8\\uB2E4." : "\\uCDE8\\uC5C5\\uD560\\uC9C0, \\uC804\\uC5C5 \\uD22C\\uC790\\uB85C \\uB098\\uC124\\uC9C0 \\uC815\\uD55C\\uB2E4. \\uBCF5\\uBB34 \\uD734\\uD559\\uC73C\\uB85C \\uB2A6\\uC5B4\\uC9C4 \\uACBD\\uC6B0 \\uADF8\\uB9CC\\uD07C \\uB4A4\\uC758 \\uC77C\\uC815\\uC774\\uC5D0\\uC694. \\uCDE8\\uC5C5\\uC744 \\uACE0\\uB974\\uBA74 \\uB2E4\\uC74C \\uB2EC\\uBD80\\uD130 \\uC6D4 \\uC21C\\uC800\\uCD95\\uC744 \\uB354\\uD569\\uB2C8\\uB2E4 [\\uC2DC\\uD5D8\\uC6A9 \\uC124\\uACC4\\uAC12]. \\uC2E4\\uC81C \\uAE09\\uC5EC \\uC218\\uC785\\uACFC \\uC9C0\\uCD9C\\uC744 \\uB098\\uB220 \\uACC4\\uC0B0\\uD558\\uB294 \\uBAA8\\uD615\\uC740 \\uC544\\uC9C1 \\uC5C6\\uC5B4\\uC694.",\n                  impact_tags: [],\n                  unlock: null,\n                  choices: careerCashActive() ? [\n                    { id: "job", label: "\\uCDE8\\uC5C5 \\u2014 \\uB2E4\\uC74C \\uB2EC\\uBD80\\uD130 \\uAE09\\uC5EC \\uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\\uC6D0 \\xB7 \\uC0DD\\uD65C\\uBE44 \\uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\\uC6D0 [\\uC124\\uACC4\\uAC12]" },\n                    { id: "fulltime", label: "\\uC804\\uC5C5 \\uD22C\\uC790 \\u2014 \\uC218\\uC785 0\\uC6D0 \\xB7 \\uC0DD\\uD65C\\uBE44 \\uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\\uC6D0 \\uCC28\\uAC10 [\\uC124\\uACC4\\uAC12]" }\n                  ] : [\n                    { id: "job", label: "\\uCDE8\\uC5C5 \\u2014 \\uB2E4\\uC74C \\uB2EC\\uBD80\\uD130 \\uC6D4 \\uC21C\\uC800\\uCD95 [\\uC2DC\\uD5D8\\uAC12]" },\n                    { id: "fulltime", label: "\\uC804\\uC5C5 \\uD22C\\uC790 \\u2014 \\uC815\\uAE30 \\uC21C\\uC800\\uCD95 \\uC5C6\\uC74C [\\uC0DD\\uD65C\\uBE44 \\uBBF8\\uAD6C\\uD604]" }\n                  ]\n                };\n              }\n            }\n            if (state.flags.studyPath === "parttime") done.college = true;\n            if (!done.enlist && state.flags.enlistAt) {\n              const d = state.flags.enlistAt + "-01";\n              if (d.slice(0, 7) < schoolStartMonth()) done.enlist = true;\n              else return {\n                _dynamic: true,\n                id: "life-enlist",\n                date: d,\n                kind: "life",\n                card_title: "\\uC785\\uC601 \\uD1B5\\uC9C0\\uC11C\\uAC00 \\uB3C4\\uCC29\\uD588\\uB2E4",\n                card_summary: "\\uC785\\uB300 \\uC2DC\\uC810\\uC744 \\uC815\\uD574\\uC57C \\uD55C\\uB2E4. \\uBCF5\\uBB34 \\uC911\\uC5D0\\uB294 \\uC2DC\\uC7A5 \\uB300\\uC751\\uC774 \\uC81C\\uD55C\\uB418\\uACE0, \\uC804\\uC5ED\\uD558\\uBA74 \\uADF8\\uB3D9\\uC548\\uC758 \\uC2DC\\uC7A5 \\uD750\\uB984\\uC744 \\uC815\\uB9AC\\uD574 \\uBC1B\\uB294\\uB2E4.",\n                impact_tags: [],\n                unlock: null,\n                choices: [\n                  { id: "go-now", label: "\\uBC14\\uB85C \\uC785\\uB300 (\\uC721\\uAD70 \\uAC00\\uC815 \\xB7 \\uB2F9\\uC2DC \\uADDC\\uC815 26\\uAC1C\\uC6D4)" },\n                  { id: "defer-1y", label: "1\\uB144 \\uC720\\uC608 [\\uC2DC\\uD5D8\\uC6A9 \\uAC00\\uC815 \\u2014 \\uC720\\uC608 \\uADDC\\uC815 \\uBBF8\\uAC80\\uC99D]" }\n                ]\n              };\n            }\n            return null;\n          }';
    const GEN133_RENDER_TRADE_FINGERPRINT = `function renderTrade() {
            if (storageWriteBlocked) return showStorageWriteUnavailable();
            if (storageReadBlocked) return showStorageReadUnavailable();
            const card = document.getElementById("turn-card");
            const box = document.getElementById("choices");
            box.innerHTML = "";
            if (pending.step !== "skip-preview" && !albaTimeAvailable()) {
              pending = null;
              render();
              return;
            }
            if (pending.step === "skip-preview") {
              const savedState = state;
              const savedEffDate = effDate, savedEffPostClose = effPostClose;
              let k2 = 0, ks = 0, arrive = null, stopAtSettlement = null, stopMonth = null, to2;
              state = structuredClone(savedState);
              try {
                while (!state.flags.gameOver && state.month <= GAME_END) {
                  const t = nextTurn();
                  if (t.kind !== "quiet") {
                    arrive = t.kind;
                    break;
                  }
                  if (t.settlement) {
                    if (stopAtSettlement === null) {
                      stopAtSettlement = k2;
                      stopMonth = state.month;
                    }
                    state.flags.settledMonth = state.month;
                    ks++;
                  }
                  advanceMonth();
                  k2++;
                  if (k2 > 500) break;
                }
                if (!arrive && state.month > GAME_END) arrive = "natural-end";
                to2 = state.month;
              } finally {
                state = savedState;
                effDate = savedEffDate;
                effPostClose = savedEffPostClose;
              }
              const kindLabel = { "cash-due": "\\uAC00\\uC0C1\\uC0DD\\uD65C\\uBE44\\xB7\\uD559\\uBE44 \\uC120\\uD0DD", news: "\\uB274\\uC2A4", life: "\\uC9C4\\uB85C\\xB7\\uC0DD\\uD65C", discharge: "\\uC804\\uC5ED", "demo-end": "\\uC2DC\\uC81C\\uD488 \\uAD6C\\uAC04 \\uC885\\uB8CC", "natural-end": "\\uC778\\uC0DD \\uACB0\\uC0B0", gameover: "\\uAC8C\\uC784 \\uC885\\uB8CC(\\uCE74\\uC624\\uC2A4)", "living-fail": "\\uAC8C\\uC784 \\uC0DD\\uD65C\\uACBD\\uC81C \\uC2DC\\uD5D8 \\uC2E4\\uD328", "living-adjust": "\\uC0DD\\uD65C\\uBE44 \\uC815\\uC0B0 \\uC804 \\uC870\\uC815" };
              card.innerHTML = '<div class="date">' + state.month + " \\xB7 \\uAC74\\uB108\\uB6F0\\uAE30 \\uBBF8\\uB9AC\\uBCF4\\uAE30</div><h2>\\uC5EC\\uAE30\\uAE4C\\uC9C0 \\uC9C4\\uD589\\uB429\\uB2C8\\uB2E4</h2><p>\\uB3C4\\uCC29: " + to2 + " \\xB7 " + (kindLabel[arrive] || arrive || "\\uAD6C\\uAC04 \\uB05D") + " \\xB7 " + k2 + "\\uAC1C\\uC6D4 \\uC9C4\\uD589" + (ks ? " \\xB7 \\uB118\\uAE30\\uB294 \\uBD84\\uAE30 \\uC815\\uC0B0 \\uAE30\\uD68C " + ks + "\\uD68C\\uB97C \\uC9C0\\uB098\\uCE69\\uB2C8\\uB2E4(\\uC8FC\\uBB38\\xB7\\uB9AC\\uBC38\\uB7F0\\uC2F1 \\uAE30\\uD68C \\uD3EC\\uAE30)" : " \\xB7 \\uB118\\uAE30\\uB294 \\uC815\\uC0B0 \\uAE30\\uD68C \\uC5C6\\uC74C") + ".</p><p>\\uC800\\uCD95\\xB7\\uC774\\uC790\\xB7\\uCE74\\uC624\\uC2A4\\xB7\\uD559\\uC801 \\uC804\\uC774\\uB294 1\\uAC1C\\uC6D4\\uC529 \\uC9C4\\uD589\\uD560 \\uB54C\\uC640 \\uAC19\\uC740 \\uADDC\\uCE59\\uC73C\\uB85C \\uB9E4\\uC6D4 \\uBC18\\uC601\\uB429\\uB2C8\\uB2E4 [\\uC2DC\\uC5F0 \\uADDC\\uCE59].</p>" + (state.jobSavingsPlan && state.jobSavingsPlan.percent ? "<p>\\uC124\\uC815\\uD55C \\uCDE8\\uC5C5 \\uC21C\\uC800\\uCD95 " + state.jobSavingsPlan.percent + "% \\uC801\\uB9BD \\uC608\\uC57D\\uB3C4 \\uB9E4\\uC6D4 \\uC801\\uC6A9\\uB429\\uB2C8\\uB2E4. \\uC608\\uC57D \\uD604\\uAE08\\uC774 \\uC7A0\\uAE30\\uACE0 \\uBD84\\uAE30 \\uC815\\uC0B0 \\uB4A4 \\uC0C8 \\uC801\\uACA9 \\uAD00\\uCE21\\uC744 \\uAE30\\uB2E4\\uB9BD\\uB2C8\\uB2E4. \\uC9C1\\uC811 \\uC8FC\\uBB38\\uC740 \\uD558\\uC9C0 \\uC54A\\uC740 \\uAC83\\uC73C\\uB85C \\uCC98\\uB9AC\\uD569\\uB2C8\\uB2E4.</p>" : "");
              const go2 = document.createElement("button");
              go2.textContent = k2 + "\\uAC1C\\uC6D4 \\uAC74\\uB108\\uB6F0\\uAE30 \\uC2E4\\uD589";
              go2.onclick = () => {
                pending = null;
                choose("skip-to-news", null);
              };
              if (albaTimeLimited()) {
                const note = document.createElement("p");
                note.className = "note alba-time-confirm";
                note.textContent = "\\uD655\\uC815\\uD558\\uBA74 " + state.month + " \\uC54C\\uBC14 \\uC218\\uB3D9 \\uD22C\\uC790 \\uD310\\uB2E81\\uD68C\\uB97C \\uC0AC\\uC6A9\\uD569\\uB2C8\\uB2E4. \\uAC19\\uC740 \\uB2EC \\uC0C8 \\uB9E4\\uC218\\xB7\\uB9E4\\uB3C4\\xB7\\uC870\\uAC74/\\uAE30\\uD55C \\uBCC0\\uACBD\\uC740 \\uB354 \\uD560 \\uC218 \\uC5C6\\uC2B5\\uB2C8\\uB2E4. \\uC785\\uB825 \\uCDE8\\uC18C\\uB294 \\uC0AC\\uC6A9\\uD558\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4 [\\uAC8C\\uC784\\uADDC\\uCE59].";
                card.append(note);
              }
              box.appendChild(go2);
              if (stopAtSettlement !== null && stopAtSettlement > 0) {
                const keep = document.createElement("button");
                keep.textContent = "\\uBD84\\uAE30 \\uC815\\uC0B0\\uC5D0\\uC11C \\uBA48\\uCD94\\uAE30 (" + stopAtSettlement + "\\uAC1C\\uC6D4 \\uC9C4\\uD589 \\xB7 \\uC815\\uC0B0 \\uAE30\\uD68C \\uC720\\uC9C0)";
                keep.onclick = () => {
                  pending = null;
                  choose("skip-to-news-stop-settlement", null);
                };
                box.appendChild(keep);
                const note = document.createElement("p");
                note.className = "note";
                note.textContent = "\\uC815\\uC0B0 \\uBA48\\uCDA4\\uC744 \\uACE0\\uB974\\uBA74 " + stopMonth + " \\uBD84\\uAE30 \\uC815\\uC0B0 \\uD654\\uBA74\\uC5D0\\uC11C \\uBA48\\uCDA5\\uB2C8\\uB2E4. \\uC815\\uC0B0 \\uD6C4 \\uB098\\uBA38\\uC9C0 \\uAD6C\\uAC04\\uC740 \\uB2E4\\uC2DC \\uAC74\\uB108\\uB6F8 \\uC218 \\uC788\\uC2B5\\uB2C8\\uB2E4.";
                box.appendChild(note);
              }
              if ((state.pendingOrders || []).length) {
                const keepOrders = document.createElement("button");
                keepOrders.id = "skip-stop-orders";
                keepOrders.textContent = "\\uB2E4\\uC74C \\uCCB4\\uACB0\\xB7\\uAE30\\uD55C\\uBC18\\uD658 \\uB610\\uB294 \\uBD84\\uAE30 \\uC815\\uC0B0\\uC5D0\\uC11C \\uBA48\\uCD94\\uAE30";
                keepOrders.disabled = stopAtSettlement === 0;
                keepOrders.onclick = () => {
                  pending = null;
                  choose("skip-to-order-change", null);
                };
                box.appendChild(keepOrders);
                const orderNote = document.createElement("p");
                orderNote.id = "skip-stop-orders-note";
                orderNote.className = "note";
                orderNote.textContent = stopAtSettlement === 0 ? "\\uD604\\uC7AC \\uBD84\\uAE30 \\uC815\\uC0B0\\uC744 \\uBA3C\\uC800 \\uC120\\uD0DD\\uD574 \\uC8FC\\uC138\\uC694. \\uC774 \\uC9C4\\uD589\\uC740 \\uC815\\uC0B0 \\uAE30\\uD68C\\uB97C \\uC9C0\\uB098\\uCE58\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4." : "\\uC774 \\uC120\\uD0DD\\uC740 \\uC704 \\uAE30\\uBCF8 \\uAC74\\uB108\\uB6F0\\uAE30 \\uB3C4\\uCC29\\uC6D4\\uAE4C\\uC9C0 \\uAC04\\uB2E4\\uB294 \\uB73B\\uC774 \\uC544\\uB2D9\\uB2C8\\uB2E4. \\uB2EC\\uB9C8\\uB2E4 \\uC2E4\\uC81C\\uB85C \\uC9C4\\uD589\\uD558\\uB2E4 \\uCCAB \\uC9C0\\uC5F0\\uCCB4\\uACB0(\\uBD84\\uD560 \\uC77C\\uBD80 \\uD3EC\\uD568)\\xB7\\uB9E4\\uC218 \\uAE30\\uD55C\\uBC18\\uD658\\xB7\\uBBF8\\uC815\\uC0B0 \\uBD84\\uAE30 \\uC815\\uC0B0\\uC5D0\\uC11C \\uBA48\\uCDA5\\uB2C8\\uB2E4. \\uB274\\uC2A4\\xB7\\uC9C4\\uB85C\\xB7\\uC804\\uC5ED\\xB7\\uC885\\uB8CC \\uACBD\\uACC4\\uAC00 \\uBA3C\\uC800 \\uC624\\uBA74 \\uADF8\\uACF3\\uC5D0\\uC11C \\uBA48\\uCDA5\\uB2C8\\uB2E4. \\uBBF8\\uB798 \\uCCB4\\uACB0\\uC6D4\\xB7\\uAC00\\uACA9\\xB7\\uBC18\\uD658 \\uACB0\\uACFC\\uB97C \\uBBF8\\uB9AC \\uAC80\\uC0C9\\uD558\\uAC70\\uB098 \\uBCF4\\uC7A5\\uD558\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4. \\uC0C8 \\uC9C1\\uC811\\uC8FC\\uBB38\\uC740 \\uD558\\uC9C0 \\uC54A\\uC73C\\uBA70 \\uCDE8\\uC5C5 \\uC801\\uB9BD\\uACC4\\uD68D\\uC740 \\uB9E4\\uC6D4 \\uACC4\\uC18D \\uC801\\uC6A9\\uB429\\uB2C8\\uB2E4.";
                box.appendChild(orderNote);
              }
              const cancel = document.createElement("button");
              cancel.textContent = "\\uCDE8\\uC18C (\\uB3CC\\uC544\\uAC00\\uAE30)";
              cancel.onclick = () => {
                pending = null;
                render();
              };
              box.appendChild(cancel);
              return;
            }
            if (pending.step === "product") {
              card.innerHTML = '<div class="date">' + state.month + " \\xB7 \\uD3EC\\uC9C0\\uC158 \\uC870\\uC815 1/2</div><h2>\\uC0C1\\uD488 \\uC120\\uD0DD</h2>";
              unlockedProducts().forEach((u) => {
                const b = document.createElement("button");
                if (u.rule === "accrual" || u.rule === "fxaccrual") {
                  b.textContent = u.name + " \\u2014 \\uC774\\uC790 \\uB204\\uC801 " + accrualRate(u).label + " \\xB7 \\uC608\\uCE58 \\uB2F9\\uC6D4\\uBD80\\uD130 \\uC6D4 \\uB2E8\\uC704 \\uBC1C\\uC0DD, \\uD574\\uC9C0 \\uB2F9\\uC6D4 \\uBBF8\\uBC1C\\uC0DD [\\uC2DC\\uC5F0 \\uBAA8\\uD615]";
                  if (u.rule === "fxaccrual") {
                    const pt0 = holdingPricePoint(u.product, state.month);
                    b.textContent += pt0 ? " \\xB7 \\uD658\\uC728 \\uC9C0\\uC810 " + pt0.value.toLocaleString() + " (" + fmtPtDate(pt0) + ")" : " \\xB7 \\uD658\\uC728 \\uC9C0\\uC810 \\uC5C6\\uC74C";
                    if (u.rule_note) b.textContent += " " + u.rule_note;
                  }
                } else if (u.rule === "fxprice") {
                  const pt3 = holdingPricePoint(u.product, state.month);
                  const fxpt0 = priceAt("fx", state.month);
                  b.textContent = u.name + (pt3 && fxpt0 ? (u.series === "btc" ? " \\u2014 \\uC2DC\\uC138 \\uC9C0\\uC810 " : " \\u2014 \\uC9C0\\uC218 \\uC9C0\\uC810 ") + pt3.value.toLocaleString() + " (" + fmtPtDate(pt3) + ") \\xD7 \\uD658\\uC728 " + fxpt0.value.toLocaleString() + " (" + fmtPtDate(fxpt0) + ")" : " \\u2014 \\uC2DC\\uC138 \\uC9C0\\uC810 \\uC5C6\\uC74C");
                  if (u.rule_note) b.textContent += " " + u.rule_note;
                } else {
                  const pt3 = holdingPricePoint(u.product, state.month);
                  b.textContent = u.name + (pt3 ? " \\u2014 \\uCD5C\\uC2E0 \\uD655\\uBCF4 \\uC9C0\\uC810 " + pt3.value.toLocaleString() + " (" + fmtPtDate(pt3) + ")" : " \\u2014 \\uC2DC\\uC138 \\uC9C0\\uC810 \\uC5C6\\uC74C");
                  if (u.rule_note) b.textContent += " " + u.rule_note;
                }
                if (u.rule === "price" || u.rule === "fxaccrual" || u.rule === "fxprice") {
                  const pt3 = holdingPricePoint(u.product, state.month);
                  if (u.rule === "fxprice") {
                    const fxptA = priceAt("fx", state.month);
                    const ageOf = (p) => {
                      const a = Math.round((Date.parse(effDate + "T00:00:00Z") - Date.parse(p.date + "T00:00:00Z")) / 864e5);
                      return Number.isFinite(a) && a > 0 ? a : 0;
                    };
                    if (pt3 && fxptA) b.textContent += " \\xB7 \\uC2DC\\uC138 \\uC9C0\\uC810\\uC740 \\uD310\\uB2E8\\uC77C " + ageOf(pt3) + "\\uC77C \\uC804, \\uD658\\uC728 \\uC9C0\\uC810\\uC740 " + ageOf(fxptA) + "\\uC77C \\uC804 \\uC790\\uB8CC \\xB7 \\uB458 \\uB2E4 \\uB2F9\\uC77C \\uAC70\\uB798\\uAC00 \\uC544\\uB2D8";
                    else if (pt3) b.textContent += " \\xB7 " + priceAgeNote(pt3);
                  } else {
                    if (pt3) b.textContent += " \\xB7 " + priceAgeNote(pt3);
                  }
                  const gn = priceGapNote(u);
                  if (gn) b.textContent += " \\xB7 " + gn;
                }
                if (u.tradable === false || u.rule === "unpriced") {
                  b.textContent += " \\xB7 " + (u.rule_note && u.rule === "unpriced" ? "" : "\\uC2DC\\uC5F0 \\uBBF8\\uC9C0\\uC6D0");
                  b.disabled = true;
                } else if ((u.rule === "price" || u.rule === "fxaccrual") && !holdingPricePoint(u.product, state.month)) {
                  b.disabled = true;
                } else if (u.rule === "fxprice" && (!holdingPricePoint(u.product, state.month) || !priceAt("fx", state.month))) {
                  b.disabled = true;
                }
                b.onclick = () => {
                  if (!productAvailable(u)) return;
                  const pt3 = holdingPricePoint(u.product, state.month);
                  pending.product = u.product;
                  pending.price = pt3 ? pt3.value : null;
                  pending.priceDate = pt3 ? pt3.date : null;
                  pending.rule = u.rule || "price";
                  pending.step = state.holdings[u.product] ? "direction" : "weight";
                  pending.direction = "buy";
                  render();
                };
                box.appendChild(b);
                if (u.product === "fx" || u.product === "usdeposit") {
                  const note = document.createElement("p");
                  note.className = "note";
                  note.textContent = productAccessDisplayNote(u);
                  box.appendChild(note);
                }
              });
              const cancel = document.createElement("button");
              cancel.textContent = "\\uCDE8\\uC18C (\\uB3CC\\uC544\\uAC00\\uAE30)";
              cancel.onclick = () => {
                pending = null;
                render();
              };
              box.appendChild(cancel);
            } else if (pending.step === "direction") {
              const u = productRule(pending.product);
              const h2 = state.holdings[pending.product];
              const cur = holdingValue(pending.product, h2, state.month);
              card.innerHTML = '<div class="date">' + state.month + " \\xB7 \\uD3EC\\uC9C0\\uC158 \\uC870\\uC815 1/2</div><h2>" + esc(u.name || pending.product) + "</h2><p>\\uD604\\uC7AC \\uC2DC\\uC5F0 \\uD3C9\\uAC00 " + cur.toLocaleString() + "\\uC6D0(\\uAD00\\uCE21\\xB7\\uD3C9\\uAC00 \\uAE30\\uC900\\uC77C " + effDate + (effPostClose ? ", \\uC7A5 \\uB9C8\\uAC10 \\uD6C4" : "") + "). " + (u.rule === "accrual" ? "\\uC774 \\uC774\\uC790 \\uB204\\uC801 \\uC2DC\\uC5F0 \\uC0C1\\uD488\\uC740 \\uC2E4\\uD589 \\uC2DC \\uBC14\\uB85C \\uC608\\uCE58\\xB7\\uD574\\uC9C0\\uD574\\uC694. \\uC6D4 \\uC774\\uC790\\uB294 \\uAC8C\\uC784\\uC758 \\uB2EC\\uC774 \\uC9C4\\uD589\\uB420 \\uB54C\\uB9CC \\uBC18\\uC601\\uB3FC\\uC694. \\uC2E4\\uC81C \\uACC4\\uC57D\\xB7\\uC218\\uC775\\uB960\\uC744 \\uC7AC\\uD604\\uD55C \\uAC83\\uC740 \\uC544\\uB2C8\\uC5D0\\uC694." : pending.reserveOnly ? "\\uC608\\uC57D \\uC8FC\\uBB38\\uC740 \\uC811\\uC218\\uB9CC \\uB3FC\\uC694. \\uB2E4\\uAC00\\uC624\\uB294 \\uBD84\\uAE30 \\uC815\\uC0B0(" + pending.settleMonth + ")\\uC774 \\uB05D\\uB09C \\uB4A4 \\uC0C8\\uB85C \\uAD00\\uCE21\\uB418\\uB294 \\uC2DC\\uC138 \\uC9C0\\uC810\\uC73C\\uB85C \\uCCB4\\uACB0\\uB3FC\\uC694. \\uADF8 \\uAC00\\uACA9\\uC740 \\uC9C0\\uAE08 \\uC54C \\uC218 \\uC5C6\\uACE0, \\uC801\\uACA9 \\uAD00\\uCE21\\uC774 \\uC5C6\\uC73C\\uBA74 \\uCCB4\\uACB0\\uB418\\uC9C0 \\uC54A\\uC740 \\uCC44 \\uBBF8\\uCCB4\\uACB0\\uB85C \\uB0A8\\uC544 \\uC778\\uC0DD \\uACB0\\uC0B0 \\uB54C \\uCDE8\\uC18C \\uBC18\\uD658\\uB3FC\\uC694. \\uC815\\uC0B0 \\uC804\\uAE4C\\uC9C0 \\uB300\\uAE30 \\uC8FC\\uBB38\\uC5D0\\uC11C \\uCDE8\\uC18C\\uD558\\uBA74 \\uC608\\uC57D\\uAE08\\xB7\\uC7A0\\uAE08 \\uC218\\uB7C9\\uC774 \\uADF8\\uB300\\uB85C \\uB3CC\\uC544\\uC640\\uC694. \\uD76C\\uC18C\\uC790\\uB8CC \\uAE30\\uBC18 \\uC9C0\\uC5F0\\uCCB4\\uACB0 \\uC2DC\\uC5F0 \\uBAA8\\uD615\\uC774\\uBA70 \\uC815\\uC2DD \\uB9E4\\uB9E4 \\uC7AC\\uD604\\uC740 \\uC544\\uB2C8\\uC5D0\\uC694." : "\\uC8FC\\uBB38\\uC740 \\uC811\\uC218\\uB9CC \\uB418\\uACE0, \\uCCB4\\uACB0\\uC740 \\uC774\\uD6C4 \\uC9C4\\uD589 \\uC911 \\uC0C8\\uB85C \\uAD00\\uCE21\\uB418\\uB294 \\uC2DC\\uC138 \\uC9C0\\uC810\\uC73C\\uB85C \\uC9D1\\uD589\\uB3FC\\uC694. \\uD76C\\uC18C\\uC790\\uB8CC \\uAE30\\uBC18 \\uC9C0\\uC5F0\\uCCB4\\uACB0 \\uC2DC\\uC5F0 \\uBAA8\\uD615\\uC774\\uBA70 \\uC815\\uC2DD \\uB9E4\\uB9E4 \\uC7AC\\uD604\\uC740 \\uC544\\uB2C8\\uC5D0\\uC694. \\uB2F9\\uC2DC \\uC2E4\\uC81C \\uCCB4\\uACB0\\uAC00\\uC640\\uB294 \\uAD6C\\uBD84\\uB3FC\\uC694.") + "</p>";
              const buy = document.createElement("button");
              buy.textContent = "\\uB9E4\\uC218 (\\uBE44\\uC911 \\uB298\\uB9AC\\uAE30)";
              buy.onclick = () => {
                pending.direction = "buy";
                pending.step = "weight";
                render();
              };
              box.appendChild(buy);
              const sell = document.createElement("button");
              sell.textContent = "\\uC77C\\uBD80 \\uB9E4\\uB3C4 (\\uBE44\\uC911 \\uC904\\uC774\\uAE30)";
              sell.onclick = () => {
                pending.direction = "sell";
                pending.step = "weight";
                render();
              };
              box.appendChild(sell);
              const cancel = document.createElement("button");
              cancel.textContent = "\\uCDE8\\uC18C (\\uB3CC\\uC544\\uAC00\\uAE30)";
              cancel.onclick = () => {
                pending = null;
                render();
              };
              box.appendChild(cancel);
            } else if (pending.step === "weight") {
              let conditionInputValid2 = function() {
                const cb = document.getElementById("cond-on"), num = document.getElementById("cond-val");
                return !cb || !cb.checked || !!(num && num.value.trim() && !num.validity.badInput && Number.isFinite(Number(num.value)) && Number(num.value) > 0);
              }, updatePreview2 = function() {
                wv.textContent = slider.value + "%";
                const lp = tradeLiquidityPreview(slider.value), money = (n) => n.toLocaleString() + "\\uC6D0", qty = (n) => n.toLocaleString("ko-KR", { maximumSignificantDigits: 8 });
                liquidity.textContent = "";
                if (lp) {
                  liquidity.dataset.kind = lp.kind;
                  liquidity.dataset.amount = String(lp.amount ?? "");
                  liquidity.dataset.cashAfter = String(lp.cashAfter);
                  liquidity.dataset.qty = String(lp.qty ?? "");
                  liquidity.dataset.reserveAfter = String(lp.reserveAfter ?? "");
                  const title = document.createElement("strong");
                  title.textContent = "\\uC774\\uBC88 \\uC8FC\\uBB38 \\uC811\\uC218 \\uC9C1\\uD6C4 [\\uC6D4 \\uC9C4\\uD589 \\uC804]";
                  liquidity.appendChild(title);
                  const line2 = document.createElement("p");
                  line2.textContent = lp.kind === "buy-reserve" ? "\\uC774\\uBC88 \\uB9E4\\uC218 \\uC608\\uC57D " + money(lp.amount) + " \\xB7 \\uB0A8\\uB294 \\uD604\\uAE08 " + money(lp.cashAfter) + ". \\uAE30\\uC874 \\uBBF8\\uCCB4\\uACB0 \\uB9E4\\uC218\\uC608\\uC57D " + money(lp.existingBuyReserve) + "\\uC640 \\uD569\\uCCD0 \\uCD1D " + money(lp.reserveAfter) + "\\uC774 \\uC7A0\\uAE41\\uB2C8\\uB2E4." : lp.kind === "deposit" ? "\\uC774\\uBC88 \\uC608\\uCE58 " + money(lp.amount) + " \\xB7 \\uB0A8\\uB294 \\uD604\\uAE08 " + money(lp.cashAfter) + ". \\uAE30\\uC874 \\uBBF8\\uCCB4\\uACB0 \\uB9E4\\uC218\\uC608\\uC57D " + money(lp.existingBuyReserve) + "\\uC740 \\uBCC4\\uB3C4\\uC785\\uB2C8\\uB2E4." : lp.kind === "sell-lock" ? "\\uC774\\uBC88 \\uB9E4\\uB3C4\\uC5D0 \\uC7A0\\uAE00 \\uC2DC\\uC5F0 \\uC218\\uB7C9 \\uC57D " + qty(lp.qty) + " \\xB7 \\uC8FC\\uBB38\\uC5D0 \\uBB36\\uC774\\uC9C0 \\uC54A\\uACE0 \\uB0A8\\uB294 \\uC218\\uB7C9 \\uC57D " + qty(lp.qtyAfter) + ". \\uC811\\uC218\\uB9CC\\uC73C\\uB85C \\uD604\\uAE08 " + money(lp.cashAfter) + "\\uC740 \\uB298\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4. \\uC2E4\\uC81C \\uB9E4\\uB3C4\\uB300\\uAE08\\uC740 \\uC774\\uD6C4 \\uC801\\uACA9 \\uAD00\\uCE21\\uC5D0\\uC11C \\uACB0\\uC815\\uB429\\uB2C8\\uB2E4." : "\\uC774\\uBC88 \\uD574\\uC9C0\\uB85C \\uD604\\uAE08 " + money(lp.amount) + " \\uC99D\\uAC00 \\xB7 \\uD574\\uC9C0 \\uC9C1\\uD6C4 \\uD604\\uAE08 " + money(lp.cashAfter) + ".";
                  liquidity.appendChild(line2);
                  const note = document.createElement("p");
                  note.textContent = "\\uD604\\uC7AC \\uC790\\uAE08\\uC758 \\uC774\\uB3D9\\uB9CC \\uBCF4\\uC5EC\\uC90D\\uB2C8\\uB2E4. \\uC774\\uC5B4\\uC9C0\\uB294 \\uC6D4 \\uC9C4\\uD589\\uC5D0\\uC11C \\uC21C\\uC800\\uCD95\\xB7\\uC774\\uC790\\xB7\\uC801\\uACA9 \\uCCB4\\uACB0\\uC774 \\uB354\\uD574\\uC9C8 \\uC218 \\uC788\\uC73C\\uBA70, \\uBBF8\\uB798 \\uAC00\\uACA9\\xB7\\uC218\\uC775\\xB7\\uCCB4\\uACB0\\uC2DC\\uC810\\uC740 \\uC608\\uCE21\\uD558\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4.";
                  liquidity.appendChild(note);
                }
                const mInfo = marketSizeOf(pending.product, state.month);
                const amount = Math.round(base * slider.value / 100);
                let impact = 0, mode = "";
                if (mInfo && mInfo.size && amount > 0) {
                  if (isSell) {
                    impact = amount / mInfo.size * CHAOS.sellImpactFactor * chaosWeight(pending.product);
                    mode = "\\uCCB4\\uACB0 \\uC2DC \\uCDA9\\uACA9";
                  } else {
                    impact = amount / mInfo.size * CHAOS.scaleFactor * chaosWeight(pending.product);
                    mode = "\\uC6D4 \\uB204\\uC801 \\uC99D\\uAC00";
                  }
                }
                const proj = state.chaos + (isSell ? impact : 0);
                let line;
                if (!mInfo) {
                  line = "\\uC774 \\uC0C1\\uD488\\uC740 \\uCE74\\uC624\\uC2A4 \\uC0B0\\uC815 \\uB300\\uC0C1\\uC774 \\uC544\\uB2C8\\uC5D0\\uC694 (\\uC548\\uC804\\uC790\\uAE08 [\\uC124\\uACC4 \\uC81C\\uC548]). \\uD604\\uC7AC \\uCE74\\uC624\\uC2A4 " + state.chaos.toFixed(1) + "/100.";
                } else if (!mInfo.size) {
                  line = mInfo.label + ". \\uD604\\uC7AC \\uCE74\\uC624\\uC2A4 " + state.chaos.toFixed(1) + "/100.";
                } else {
                  line = "\\uC774 \\uC8FC\\uBB38\\uC758 \\uC608\\uC0C1 \\uCE74\\uC624\\uC2A4 \\uC601\\uD5A5: " + mode + " +" + impact.toFixed(2) + " [\\uC124\\uACC4 \\uC81C\\uC548 \\uC218\\uCE58 \\xB7 \\uC2DC\\uC7A5\\uADDC\\uBAA8 " + mInfo.label + "]. \\uD604\\uC7AC " + state.chaos.toFixed(1) + "/100";
                  if (isSell) line += " \\u2192 \\uCDA9\\uACA9 \\uBC18\\uC601 \\uC2DC " + proj.toFixed(1);
                  else line += " (\\uB204\\uC801\\uC740 \\uC6D4 \\uC815\\uC0B0 \\uC2DC \\uBC18\\uC601)";
                  line += ".";
                }
                if (mInfo && mInfo.size && isFinite(mInfo.size) && amount > 0) {
                  const splitEl = document.getElementById("split-n");
                  const sn2 = splitEl ? Number(splitEl.value) : 1;
                  const splitN = Number.isInteger(sn2) && sn2 > 1 ? sn2 : 1;
                  const tr = chaosTrajectory({
                    sellImpactNow: isSell ? impact : 0,
                    reduceProduct: isSell ? pending.product : null,
                    reduceValue: isSell ? amount : 0,
                    buyPerMonth: isSell ? 0 : amount / splitN,
                    buyMonths: isSell ? 0 : splitN,
                    buySize: mInfo.size
                  });
                  const base12 = chaosTrajectory(null).points[12].chaos;
                  const fmtM = function(o) {
                    return "+" + o.m + "\\uAC1C\\uC6D4 " + o.chaos.toFixed(1);
                  };
                  line += " \\uACC4\\uD68D \\uADA4\\uC801 [\\uD604\\uC7AC \\uC9C0\\uC810 \\uAC00\\uACA9\\xB7\\uC2DC\\uC7A5\\uADDC\\uBAA8 \\uACE0\\uC815 \\uAC00\\uC815 \\xB7 \\uB9E4\\uC218 \\uC6D4 1\\uD68C \\uCCB4\\uACB0 \\uAC00\\uC815 \\xB7 \\uBBF8\\uB798 \\uAC00\\uACA9 \\uC608\\uCE21 \\uC544\\uB2D8 \\xB7 \\uC124\\uACC4 \\uC81C\\uC548 \\uC218\\uCE58]: " + fmtM(tr.points[3]) + " \\u2192 " + fmtM(tr.points[6]) + " \\u2192 " + fmtM(tr.points[12]) + "/100" + (tr.overMonth !== null ? tr.overMonth === 0 ? " \\xB7 \\uD604\\uC7AC \\uC774\\uBBF8 \\uD55C\\uACC4 100 \\uC774\\uC0C1(\\uAC00\\uC815)" : " \\xB7 \\uD55C\\uACC4 100 \\uB3C4\\uB2EC \\uAC00\\uC815 +" + tr.overMonth + "\\uAC1C\\uC6D4" : tr.warnMonth !== null ? tr.warnMonth === 0 ? " \\xB7 \\uD604\\uC7AC \\uC774\\uBBF8 \\uC8FC\\uC758 70 \\uC774\\uC0C1(\\uAC00\\uC815)" : " \\xB7 \\uC8FC\\uC758 70 \\uB3C4\\uB2EC \\uAC00\\uC815 +" + tr.warnMonth + "\\uAC1C\\uC6D4" : " \\xB7 12\\uAC1C\\uC6D4 \\uAC00\\uC815 \\uB0B4 \\uC8FC\\uC758 70 \\uBBF8\\uB3C4\\uB2EC") + ". \\uC774 \\uC8FC\\uBB38 \\uC5C6\\uC774 \\uD604 \\uBCF4\\uC720 \\uC720\\uC9C0 \\uC2DC +12\\uAC1C\\uC6D4 " + base12.toFixed(1) + "(\\uAC00\\uC815).";
                }
                if (proj >= CHAOS.overAt) {
                  line += " \\uC704\\uD5D8: \\uC774 \\uC8FC\\uBB38\\uC73C\\uB85C \\uCE74\\uC624\\uC2A4\\uAC00 \\uD55C\\uACC4\\uB97C \\uB118\\uC5B4 \\uC5ED\\uC0AC\\uAC00 \\uBC14\\uB01D\\uB2C8\\uB2E4.";
                  go2.textContent = "\\uC704\\uD5D8\\uC744 \\uC54C\\uACE0 \\uC2E4\\uD589";
                } else if (proj >= CHAOS.warnAt || state.chaos >= CHAOS.warnAt) {
                  line += " \\uC8FC\\uC758: \\uC784\\uACC4(100)\\uC5D0 \\uAC00\\uAE4C\\uC6CC\\uC694.";
                  go2.textContent = "\\uC8FC\\uC758\\uB97C \\uD655\\uC778\\uD558\\uACE0 \\uC2E4\\uD589";
                } else {
                  go2.textContent = "\\uC2E4\\uD589";
                }
                if (!isSell && GAME_LIVING && state.gameLivingTrack === "job") line += " \\uCDE8\\uC5C5 \\uAC08\\uB798 \\uD22C\\uC790 \\uC0C1\\uD55C [\\uAC8C\\uC784 \\uADDC\\uCE59]: \\uAC8C\\uC784 \\uC720\\uC785(\\uC2DC\\uC791 \\uC790\\uAE08+\\uBC1B\\uC740 \\uC6D4\\uAE09)\\uC758 30%\\uC5D0\\uC11C \\uC774\\uBBF8 \\uD22C\\uC790\\uD55C \\uC6D0\\uAC00\\uC640 \\uBBF8\\uCCB4\\uACB0 \\uB9E4\\uC218 \\uC608\\uC57D\\uC744 \\uBE80 \\uB9CC\\uD07C\\uB9CC \\uD22C\\uC790\\uD560 \\uC218 \\uC788\\uC5B4 \\uC774\\uBC88\\uC5D0 \\uC6C0\\uC9C1\\uC77C \\uC218 \\uC788\\uB294 \\uC0C1\\uD55C\\uC740 " + base.toLocaleString() + "\\uC6D0\\uC785\\uB2C8\\uB2E4.";
                prev.textContent = line;
                go2.disabled = Math.round(base * Number(slider.value) / 100) <= 0;
                if (go2.disabled) go2.textContent = "\\uC6C0\\uC9C1\\uC77C \\uAE08\\uC561\\uC774 \\uC5C6\\uC2B5\\uB2C8\\uB2E4";
                const valid = conditionInputValid2(), num = document.getElementById("cond-val"), error = document.getElementById("condition-error");
                if (num) num.setAttribute("aria-invalid", valid ? "false" : "true");
                if (error) {
                  error.hidden = valid;
                  error.textContent = valid ? "" : "\\uC870\\uAC74\\uAC12\\uC7400\\uBCF4\\uB2E4 \\uD070 \\uC720\\uD55C\\uD55C \\uC22B\\uC790\\uB85C \\uC785\\uB825\\uD558\\uC138\\uC694. \\uC870\\uAC74\\uC744 \\uB044\\uAE30 \\uC804\\uC5D0\\uB294 \\uC77C\\uBC18\\uC8FC\\uBB38\\uC73C\\uB85C \\uBC14\\uB00C\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4.";
                }
                if (!valid) {
                  go2.disabled = true;
                  go2.textContent = "\\uC870\\uAC74\\uAC12\\uC744 \\uD655\\uC778\\uD558\\uC138\\uC694";
                }
                if (!isSell && careerCashBuyHoldOn() && careerCashUnpaid() > 0) {
                  go2.disabled = true;
                  go2.textContent = "\\uBBF8\\uB0A9 " + careerCashUnpaid().toLocaleString() + "\\uC6D0 \\u2014 \\uC0C1\\uD658 \\uD6C4 \\uB9E4\\uC218 \\uAC00\\uB2A5";
                  prev.textContent = line + " \\uBBF8\\uB0A9\\uC774 \\uC788\\uB294 \\uB3D9\\uC548 \\uC0C8 \\uB9E4\\uC218 \\uC8FC\\uBB38\\uC740 \\uC811\\uC218\\uD558\\uC9C0 \\uC54A\\uACE0, \\uBBF8\\uB9AC \\uB123\\uC740 \\uB9E4\\uC218 \\uC8FC\\uBB38\\uC758 \\uCCB4\\uACB0\\uB3C4 \\uBCF4\\uB958\\uD569\\uB2C8\\uB2E4 [\\uC124\\uACC4 \\uADDC\\uCE59 \\xB7 \\uC790\\uB3D9\\uB9E4\\uB3C4\\xB7\\uB300\\uCD9C \\uC5C6\\uC74C]. \\uC790\\uC0B0\\uD45C\\uC758 \\uBBF8\\uB0A9 \\uC0C1\\uD658\\uC73C\\uB85C \\uBA3C\\uC800 \\uAC1A\\uC73C\\uC138\\uC694. \\uC720\\uC9C0\\xB7\\uB9E4\\uB3C4\\xB7\\uBBF8\\uCCB4\\uACB0 \\uCDE8\\uC18C\\uB294 \\uADF8\\uB300\\uB85C \\uAC00\\uB2A5\\uD569\\uB2C8\\uB2E4.";
                }
              };
              var conditionInputValid = conditionInputValid2, updatePreview = updatePreview2;
              const isSell = pending.direction === "sell";
              const h0 = state.holdings[pending.product];
              const base = isSell ? holdingValue(pending.product, h0, state.month) : Math.min(state.cash, gameLivingInvestCap());
              card.innerHTML = '<div class="date">' + state.month + " \\xB7 \\uD3EC\\uC9C0\\uC158 \\uC870\\uC815 2/2</div><h2>\\uBE44\\uC911 \\uACB0\\uC815</h2><p>" + (isSell ? "\\uBCF4\\uC720 \\uC2DC\\uC5F0 \\uD3C9\\uAC00 " + base.toLocaleString() + "\\uC6D0 \\uC911 \\uC5BC\\uB9C8\\uB97C \\uC904\\uC77C\\uAE4C\\uC694?" : "\\uD604\\uAE08 " + base.toLocaleString() + "\\uC6D0 \\uC911 \\uC5BC\\uB9C8\\uB97C \\uC6C0\\uC9C1\\uC77C\\uAE4C\\uC694?") + '</p><p class="note">\\uAD00\\uCE21\\xB7\\uD3C9\\uAC00 \\uAE30\\uC900\\uC77C ' + effDate + (effPostClose ? "(\\uC7A5 \\uB9C8\\uAC10 \\uD6C4)" : "") + ". " + (pending.rule === "accrual" ? "\\uC774 \\uC774\\uC790 \\uB204\\uC801 \\uC2DC\\uC5F0 \\uC0C1\\uD488\\uC740 \\uC2E4\\uD589 \\uC2DC \\uBC14\\uB85C \\uC608\\uCE58\\xB7\\uD574\\uC9C0\\uD574\\uC694. \\uC6D4 \\uC774\\uC790\\uB294 \\uB2EC\\uC774 \\uC9C4\\uD589\\uB420 \\uB54C\\uB9CC \\uBC18\\uC601\\uB3FC\\uC694. \\uC2E4\\uC81C \\uACC4\\uC57D\\xB7\\uC218\\uC775\\uB960 \\uC7AC\\uD604\\uC740 \\uC544\\uB2C8\\uC5D0\\uC694." : pending.reserveOnly ? "\\uC608\\uC57D \\uC8FC\\uBB38\\uC740 \\uC811\\uC218\\uB9CC \\uB3FC\\uC694. \\uB2E4\\uAC00\\uC624\\uB294 \\uBD84\\uAE30 \\uC815\\uC0B0(" + pending.settleMonth + ")\\uC774 \\uB05D\\uB09C \\uB4A4 \\uC0C8\\uB85C \\uAD00\\uCE21\\uB418\\uB294 \\uC2DC\\uC138 \\uC9C0\\uC810\\uC73C\\uB85C \\uCCB4\\uACB0\\uB3FC\\uC694. \\uADF8 \\uAC00\\uACA9\\uC740 \\uC9C0\\uAE08 \\uC54C \\uC218 \\uC5C6\\uACE0, \\uC801\\uACA9 \\uAD00\\uCE21\\uC774 \\uC5C6\\uC73C\\uBA74 \\uCCB4\\uACB0\\uB418\\uC9C0 \\uC54A\\uC740 \\uCC44 \\uBBF8\\uCCB4\\uACB0\\uB85C \\uB0A8\\uC544 \\uC778\\uC0DD \\uACB0\\uC0B0 \\uB54C \\uCDE8\\uC18C \\uBC18\\uD658\\uB3FC\\uC694. \\uC815\\uC0B0 \\uC804\\uAE4C\\uC9C0 \\uD3EC\\uD2B8\\uD3F4\\uB9AC\\uC624 \\uB300\\uAE30 \\uC8FC\\uBB38\\uC5D0\\uC11C \\uCDE8\\uC18C\\uD558\\uBA74 \\uC608\\uC57D\\uAE08\\xB7\\uC7A0\\uAE08 \\uC218\\uB7C9\\uC774 \\uADF8\\uB300\\uB85C \\uB3CC\\uC544\\uC640\\uC694." : "\\uC8FC\\uBB38 \\uC811\\uC218 \\uD6C4 \\uCCB4\\uACB0\\uC740 \\uC774\\uD6C4 \\uC9C4\\uD589 \\uC911 \\uC0C8\\uB85C \\uAD00\\uCE21\\uB418\\uB294 \\uC2DC\\uC138 \\uC9C0\\uC810\\uC73C\\uB85C \\uC9D1\\uD589\\uB3FC\\uC694. \\uD76C\\uC18C\\uC790\\uB8CC \\uAE30\\uBC18 \\uC9C0\\uC5F0\\uCCB4\\uACB0 \\uC2DC\\uC5F0 \\uBAA8\\uD615\\uC774\\uBA70 \\uC815\\uC2DD \\uB9E4\\uB9E4 \\uC7AC\\uD604\\uC740 \\uC544\\uB2C8\\uC5D0\\uC694. \\uB300\\uAE30 \\uC8FC\\uBB38\\uC740 \\uD3EC\\uD2B8\\uD3F4\\uB9AC\\uC624\\uC5D0\\uC11C \\uCDE8\\uC18C\\uD560 \\uC218 \\uC788\\uC5B4\\uC694.") + '</p><p><input type="range" id="w" min="10" max="' + (!isSell && militaryActive() ? "30" : "100") + '" step="10" value="' + (!isSell && militaryActive() ? "30" : "50") + '" style="width:100%"> <span id="wv">' + (!isSell && militaryActive() ? "30" : "50") + "%</span></p>";
              if (pending.rule === "price" || pending.rule === "fxaccrual") {
                const pt3 = holdingPricePoint(pending.product, state.month);
                if (pt3) {
                  const freshness = document.createElement("p");
                  freshness.className = "note";
                  freshness.textContent = "\\uAC00\\uACA9 \\uC790\\uB8CC: " + fmtPtDate(pt3) + " \\xB7 " + priceAgeNote(pt3) + ". \\uCCB4\\uACB0\\uC740 \\uC774\\uD6C4 \\uC9C4\\uD589 \\uC911 \\uC0C8\\uB85C \\uAD00\\uCE21\\uB418\\uB294 \\uC9C0\\uC810\\uC73C\\uB85C \\uCC98\\uB9AC\\uD558\\uB294 \\uC2DC\\uC5F0 \\uBAA8\\uD615\\uC774\\uC5D0\\uC694.";
                  card.appendChild(freshness);
                }
              }
              if (fulltimeActive() && pending.rule === "price" && !pending.reserveOnly) {
                const condWrap = document.createElement("p");
                condWrap.className = "note";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.id = "cond-on";
                const num = document.createElement("input");
                num.type = "number";
                num.id = "cond-val";
                num.min = "0";
                num.step = "any";
                num.placeholder = isSell ? "\\uC608: 1200" : "\\uC608: 800";
                num.style.cssText = state.directionConditionRules === 1 ? "box-sizing:border-box;width:100%;min-height:44px;font-size:14px;padding:8px;" : "width:110px;font-size:14px;padding:4px;";
                if (state.directionConditionRules === 1) num.setAttribute("aria-label", "\\uC870\\uAC74 \\uAE30\\uC900\\uAC12");
                num.disabled = true;
                cb.onchange = () => {
                  num.disabled = !cb.checked;
                  updatePreview2();
                };
                num.oninput = () => updatePreview2();
                num.setAttribute("aria-describedby", "condition-error");
                condWrap.appendChild(cb);
                condWrap.appendChild(document.createTextNode(" \\uC870\\uAC74 \\uC8FC\\uBB38(\\uC804\\uC5C5 \\uC2DC\\uD5D8): \\uC774\\uD6C4 \\uC0C8 \\uD655\\uBCF4 \\uC9C0\\uC810\\uC774 "));
                condWrap.appendChild(num);
                if (state.directionConditionRules === 1) {
                  const dir = document.createElement("select");
                  dir.id = "condition-direction";
                  dir.setAttribute("aria-label", "\\uC0C8 \\uD655\\uBCF4 \\uC9C0\\uC810\\uC758 \\uC870\\uAC74 \\uBC29\\uD5A5");
                  dir.style.cssText = "max-width:100%;min-height:44px;margin:8px 0";
                  for (const [v, t] of [["below", isSell ? "\\uAE30\\uC900\\uAC12 \\uC774\\uD558\\uC77C \\uB54C \\uB9E4\\uB3C4" : "\\uAE30\\uC900\\uAC12 \\uC774\\uD558\\uC77C \\uB54C \\uB9E4\\uC218"], ["above", isSell ? "\\uAE30\\uC900\\uAC12 \\uC774\\uC0C1\\uC77C \\uB54C \\uB9E4\\uB3C4" : "\\uAE30\\uC900\\uAC12 \\uC774\\uC0C1\\uC77C \\uB54C \\uB9E4\\uC218"]]) {
                    const op = document.createElement("option");
                    op.value = v;
                    op.textContent = t;
                    dir.appendChild(op);
                  }
                  dir.value = isSell ? "above" : "below";
                  condWrap.appendChild(dir);
                  const detail = document.createElement("p");
                  detail.className = "note condition-direction-note";
                  detail.textContent = "\\uC870\\uAC74 \\uBC29\\uD5A5\\uC744 \\uC9C1\\uC811 \\uC120\\uD0DD\\uD569\\uB2C8\\uB2E4. \\uD558\\uB77D \\uC9C0\\uC810 \\uB9E4\\uB3C4\\xB7\\uC0C1\\uC2B9 \\uC9C0\\uC810 \\uB9E4\\uC218\\uB3C4 \\uC774\\uD6C4 \\uD655\\uBCF4 \\uC9C0\\uC810\\uC5D0\\uC11C\\uB9CC \\uD310\\uC815\\uD569\\uB2C8\\uB2E4. \\uAE30\\uC900\\uAC12 \\uD1B5\\uACFC \\uC21C\\uAC04\\uC744 \\uAC10\\uC2DC\\uD558\\uC9C0 \\uC54A\\uACE0 \\uC911\\uAC04 \\uAC00\\uACA9\\uC744 \\uAC74\\uB108\\uB6F8 \\uC218 \\uC788\\uC5B4 \\uC190\\uC2E4\\uC81C\\uD55C\\xB7\\uCCB4\\uACB0\\uAC00\\uACA9\\uC744 \\uBCF4\\uC7A5\\uD558\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4. \\uBD84\\uD560\\uC774\\uBA74 \\uC870\\uAC74\\uC744 \\uCDA9\\uC871\\uD55C \\uC0C8 \\uC9C0\\uC810\\uC5D0\\uC11C \\uD55C \\uD68C\\uBD84\\uB9CC \\uC9D1\\uD589\\uD569\\uB2C8\\uB2E4 [\\uC0C8 \\uD68C\\uADC0 \\uC2DC\\uD5D8\\uADDC\\uCE59].";
                  condWrap.appendChild(detail);
                } else condWrap.appendChild(document.createTextNode((isSell ? " \\uC774\\uC0C1" : " \\uC774\\uD558") + "\\uC77C \\uB54C\\uB9CC " + (isSell ? "\\uB9E4\\uB3C4" : "\\uB9E4\\uC218")));
                const condNote = document.createElement("p");
                condNote.className = "note";
                condNote.textContent = "\\uC870\\uAC74\\uC774 \\uCDA9\\uC871\\uB41C \\uC0C8 \\uD655\\uBCF4 \\uC9C0\\uC810\\uC758 \\uAC00\\uACA9\\uC73C\\uB85C \\uCCB4\\uACB0\\uB3FC\\uC694(\\uC870\\uAC74\\uAC12\\uC740 \\uCCB4\\uACB0\\uAC00 \\uBCF4\\uC7A5\\uC774 \\uC544\\uB2D8). \\uBBF8\\uCDA9\\uC871\\uC774\\uBA74 \\uACC4\\uC18D \\uB300\\uAE30\\uD558\\uACE0 \\uD3EC\\uD2B8\\uD3F4\\uB9AC\\uC624\\uC5D0\\uC11C \\uCDE8\\uC18C\\uD558\\uBA74 \\uC608\\uC57D\\uAE08\\xB7\\uC7A0\\uAE08 \\uC218\\uB7C9\\uC774 \\uB3CC\\uC544\\uC640\\uC694. \\uC778\\uC0DD \\uACB0\\uC0B0 \\uC2DC \\uBBF8\\uCCB4\\uACB0\\uC740 \\uCDE8\\uC18C \\uBC18\\uD658\\uB3FC\\uC694. \\uD655\\uBCF4 \\uC9C0\\uC810\\uC740 \\uC2E4\\uC81C \\uC2DC\\uC7A5\\uC758 \\uB9E4 \\uC21C\\uAC04 \\uAC00\\uACA9\\uC774 \\uC544\\uB2C8\\uB77C \\uC218\\uC9D1\\uB41C \\uC790\\uB8CC \\uC9C0\\uC810\\uC774\\uC5D0\\uC694 [\\uC2DC\\uC5F0 \\uBAA8\\uD615].";
                card.appendChild(condWrap);
                card.appendChild(condNote);
                const condError = document.createElement("p");
                condError.id = "condition-error";
                condError.className = "note";
                condError.style.cssText = "color:#8b2924;background:#fff1ef;padding:8px;border-radius:6px;";
                condError.hidden = true;
                condError.setAttribute("role", "alert");
                card.appendChild(condError);
                const splitWrap = document.createElement("p");
                splitWrap.className = "note";
                const sel = document.createElement("select");
                sel.id = "split-n";
                sel.style.cssText = "font-size:14px;padding:4px;";
                [[1, "\\uB098\\uB204\\uC9C0 \\uC54A\\uC74C(\\uAE30\\uBCF8)"], [2, "2\\uD68C \\uBD84\\uD560"], [3, "3\\uD68C \\uBD84\\uD560"], [4, "4\\uD68C \\uBD84\\uD560"]].forEach(function(opt) {
                  const o = document.createElement("option");
                  o.value = String(opt[0]);
                  o.textContent = opt[1];
                  sel.appendChild(o);
                });
                splitWrap.appendChild(sel);
                splitWrap.appendChild(document.createTextNode(" \\u2014 \\uC774\\uD6C4 \\uC0C8 \\uD655\\uBCF4 \\uC9C0\\uC810\\uB9C8\\uB2E4 1\\uD68C\\uBD84\\uC529\\uB9CC \\uCCB4\\uACB0(\\uAC19\\uC740 \\uC9C0\\uC810 \\uC911\\uBCF5 \\uCCB4\\uACB0 \\uC5C6\\uC74C). \\uC870\\uAC74 \\uC8FC\\uBB38\\uACFC \\uD568\\uAED8 \\uC4F0\\uBA74 \\uC870\\uAC74 \\uCDA9\\uC871 \\uC9C0\\uC810\\uC5D0\\uC11C\\uB9CC 1\\uD68C\\uBD84\\uC529. \\uC218\\uC775 \\uBCF4\\uC7A5\\uC774 \\uC544\\uB2C8\\uB77C \\uC9D1\\uD589 \\uBD84\\uC0B0\\uC774\\uC5D0\\uC694 [\\uC2DC\\uC5F0 \\uBAA8\\uD615]."));
                card.appendChild(splitWrap);
                if (!isSell) {
                  const expiryLabel = document.createElement("label");
                  expiryLabel.htmlFor = "order-expiry";
                  expiryLabel.textContent = "\\uAE30\\uB2E4\\uB9B4 \\uAE30\\uAC04 [\\uC804\\uC5C5 \\uB9E4\\uC218 \\uC2DC\\uD5D8\\uADDC\\uCE59] ";
                  const expirySelect = document.createElement("select");
                  expirySelect.id = "order-expiry";
                  [[0, "\\uAE30\\uD55C \\uC5C6\\uC74C (\\uAE30\\uC874 \\uADDC\\uCE59)"], [3, "3\\uAC1C\\uC6D4 \\uB4A4 \\uC6D4\\uCD08 \\uC790\\uB3D9 \\uCDE8\\uC18C"], [12, "12\\uAC1C\\uC6D4 \\uB4A4 \\uC6D4\\uCD08 \\uC790\\uB3D9 \\uCDE8\\uC18C"]].forEach(([v, t]) => {
                    const opt = document.createElement("option");
                    opt.value = String(v);
                    opt.textContent = t;
                    expirySelect.appendChild(opt);
                  });
                  expiryLabel.appendChild(expirySelect);
                  card.appendChild(expiryLabel);
                  const expiryNote = document.createElement("p");
                  expiryNote.id = "order-expiry-note";
                  expiryNote.className = "note";
                  const expiryPreview = () => {
                    const n = Number(expirySelect.value);
                    expiryNote.textContent = n ? addMonths2(state.month, n) + "-01\\uBD80\\uD130 \\uBBF8\\uCCB4\\uACB0 \\uB9E4\\uC218\\uBD84\\uC744 \\uC790\\uB3D9 \\uCDE8\\uC18C\\uD574 \\uB0A8\\uC740 \\uC608\\uC57D\\uAE08\\uB9CC \\uB3CC\\uB824\\uC90D\\uB2C8\\uB2E4. \\uB9CC\\uB8CC\\uC6D4\\uC5D0\\uB294 \\uC0C8 \\uAD00\\uCE21\\uC774 \\uC788\\uC5B4\\uB3C4 \\uB354 \\uCCB4\\uACB0\\uD558\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4. \\uC774\\uBBF8 \\uCCB4\\uACB0\\uD55C \\uBD84\\uC740 \\uBCF4\\uC720\\uD569\\uB2C8\\uB2E4. \\uAE30\\uB2E4\\uB9B4 \\uAE30\\uD68C\\uC640 \\uB2E4\\uB978 \\uD22C\\uC790\\uC5D0 \\uC4F8 \\uD604\\uAE08\\uC744 \\uB9DE\\uBC14\\uAFB8\\uB294 \\uC120\\uD0DD\\uC774\\uBA70 \\uC218\\uC775 \\uBCF4\\uC7A5\\uC774 \\uC544\\uB2D9\\uB2C8\\uB2E4." : "\\uAE30\\uD55C \\uC5C6\\uC774 \\uC0C8 \\uC801\\uACA9 \\uAD00\\uCE21\\uC744 \\uAE30\\uB2E4\\uB9BD\\uB2C8\\uB2E4. \\uC870\\uAC74\\uC774 \\uC548 \\uB9DE\\uAC70\\uB098 \\uC790\\uB8CC\\uAC00 \\uC5C6\\uC73C\\uBA74 \\uACC4\\uC18D \\uB300\\uAE30\\uD569\\uB2C8\\uB2E4. \\uC911\\uAC04\\uC5D0 \\uC9C1\\uC811 \\uCDE8\\uC18C\\uD560 \\uC218 \\uC788\\uACE0 \\uC778\\uC0DD \\uACB0\\uC0B0 \\uB54C \\uBBF8\\uCCB4\\uACB0\\uBD84\\uC744 \\uBC18\\uD658\\uD569\\uB2C8\\uB2E4.";
                  };
                  expirySelect.onchange = expiryPreview;
                  expiryPreview();
                  card.appendChild(expiryNote);
                }
              }
              const slider = document.getElementById("w");
              const wv = document.getElementById("wv");
              const prev = document.createElement("p");
              prev.className = "note";
              prev.id = "chaos-preview";
              card.appendChild(prev);
              const liquidity = document.createElement("div");
              liquidity.id = "order-liquidity-preview";
              liquidity.className = "note";
              liquidity.style.cssText = "padding:10px;background:#f1f3f6;border-radius:8px;margin-top:8px;";
              card.appendChild(liquidity);
              const go2 = document.createElement("button");
              go2.id = "order-execute";
              slider.oninput = updatePreview2;
              updatePreview2();
              go2.onclick = () => {
                if (!albaTimeAvailable()) {
                  pending = null;
                  render();
                  return;
                }
                updatePreview2();
                if (!conditionInputValid2() || go2.disabled || Math.round(base * Number(slider.value) / 100) <= 0) return;
                const p = pending;
                if (!productAvailable(productRule(p.product))) {
                  pending = null;
                  render();
                  return;
                }
                if (p.direction !== "sell" && careerCashBuyHoldOn() && careerCashUnpaid() > 0) {
                  render();
                  return;
                }
                const condOn = document.getElementById("cond-on");
                if (condOn && condOn.checked) {
                  const cv = Number(document.getElementById("cond-val").value);
                  if (Number.isFinite(cv) && cv > 0) {
                    const dir = document.getElementById("condition-direction");
                    p.condition = { op: dir && ["above", "below"].includes(dir.value) ? dir.value : p.direction === "sell" ? "above" : "below", value: cv };
                    if (dir) p.conditionRules = 1;
                  }
                }
                const splitSel = document.getElementById("split-n");
                if (splitSel) {
                  const sn2 = Number(splitSel.value);
                  if (Number.isInteger(sn2) && sn2 > 1) p.split = { n: sn2, filled: 0 };
                }
                const expirySelect = document.getElementById("order-expiry");
                if (p.direction !== "sell" && expirySelect && [3, 12].includes(Number(expirySelect.value))) p.expiresAt = addMonths2(state.month, Number(expirySelect.value));
                pending = null;
                if (p.conditionRules === 1 && p.condition) state.history.push({ month: state.month, decisionMonth: state.month, choice: "order-condition-new:" + p.product + ":" + p.condition.op + ":" + p.condition.value });
                if (p.direction === "sell") {
                  const h2 = state.holdings[p.product];
                  if (h2) {
                    const cur = holdingValue(p.product, h2, state.month);
                    const frac = slider.value / 100;
                    const proceeds = Math.round(cur * frac);
                    const u0 = productRule(p.product);
                    if (u0.rule !== "accrual" && proceeds > 0) {
                      const q2 = h2.qty * frac;
                      const pt0 = holdingPricePoint(p.product, state.month);
                      const costBasis0 = h2.invested != null ? Math.round(h2.invested * frac) : Math.round(h2.avgPrice * q2);
                      h2.qty = h2.qty - q2;
                      if (h2.invested != null) h2.invested = Math.round(h2.invested * (1 - frac));
                      const ap0 = h2.avgPrice;
                      if (h2.qty <= 1e-12) delete state.holdings[p.product];
                      state.pendingOrders = state.pendingOrders || [];
                      state.pendingOrders.push({
                        id: "ord-" + state.turnCount + "-" + state.pendingOrders.length,
                        kind: "sell",
                        product: p.product,
                        qty: q2,
                        avgPrice: ap0,
                        costBasis: costBasis0,
                        investedShare: h2.invested != null ? costBasis0 : null,
                        placedMonth: state.month,
                        basePtDate: pt0 ? pt0.date : null,
                        ...p.reserveOnly ? reserveObsGate(p.settleMonth) : { obsCutoff: effDate, obsPostClose: effPostClose },
                        ...p.condition ? { condition: p.condition, ...p.conditionRules === 1 ? { conditionRules: 1 } : {} } : {},
                        ...p.split ? { split: p.split } : {},
                        ...p.reserveOnly ? { earliestFillMonth: p.settleMonth, reserve: "job-settlement" } : {}
                      });
                      state.lastTrade = { kind: "sell-order", product: p.product, month: state.month, proceeds: costBasis0, costBasis: costBasis0, pnl: 0, turn: state.turnCount };
                      albaTimeConsume("sell");
                      finishTurn(p.event, "sell-order:" + p.product + ":" + slider.value);
                      return;
                    }
                    if (proceeds > 0) {
                      const costBasis = h2.invested != null ? Math.round(h2.invested * frac) : Math.round(h2.avgPrice * h2.qty * frac);
                      if (frac >= 1) {
                        delete state.holdings[p.product];
                      } else {
                        h2.qty = h2.qty * (1 - frac);
                        if (h2.invested != null) h2.invested = Math.round(h2.invested * (1 - frac));
                      }
                      state.cash += proceeds;
                      const mSell = marketSizeOf(p.product, state.month);
                      if (mSell && mSell.size) {
                        state.chaos = Math.round((state.chaos + proceeds / mSell.size * CHAOS.sellImpactFactor * chaosWeight(p.product)) * 10) / 10;
                        if (state.chaos >= CHAOS.overAt) state.flags.gameOver = "chaos";
                      }
                      albaTimeConsume("sell");
                      state.lastTrade = {
                        kind: "sell",
                        product: p.product,
                        month: state.month,
                        proceeds,
                        costBasis,
                        pnl: proceeds - costBasis,
                        turn: state.turnCount
                      };
                    }
                  }
                  finishTurn(p.event, "sell:" + p.product + ":" + slider.value);
                  return;
                }
                const amount = Math.round(state.cash * slider.value / 100);
                if (amount > 0 && (p.rule === "price" || p.rule === "fxaccrual" || p.rule === "fxprice")) {
                  state.pendingOrders = state.pendingOrders || [];
                  state.pendingOrders.push({
                    id: "ord-" + state.turnCount + "-" + state.pendingOrders.length,
                    kind: "buy",
                    product: p.product,
                    amount,
                    placedMonth: state.month,
                    basePtDate: p.priceDate || null,
                    ...p.reserveOnly ? reserveObsGate(p.settleMonth) : { obsCutoff: effDate, obsPostClose: effPostClose },
                    ...p.expiresAt ? { expiresAt: p.expiresAt } : {},
                    ...p.condition ? { condition: p.condition, ...p.conditionRules === 1 ? { conditionRules: 1 } : {} } : {},
                    ...p.split ? { split: p.split } : {},
                    ...p.reserveOnly ? { earliestFillMonth: p.settleMonth, reserve: "job-settlement" } : {}
                  });
                  state.cash -= amount;
                  if (p.expiresAt) state.history.push({ month: state.month, decisionMonth: state.month, choice: "order-deadline:" + p.product + ":" + p.expiresAt, expiresAt: p.expiresAt, amount });
                  state.lastTrade = { kind: "buy-order", product: p.product, month: state.month, proceeds: amount, costBasis: amount, pnl: 0, turn: state.turnCount };
                  albaTimeConsume("buy");
                  finishTurn(p.event, "enter-order:" + p.product + ":" + slider.value);
                  return;
                }
                if (amount > 0 && p.rule === "accrual") {
                  const h2 = state.holdings[p.product] || { qty: 0, avgPrice: 0, entryMonth: state.month };
                  h2.qty = h2.qty + amount;
                  h2.avgPrice = 1;
                  h2.invested = (h2.invested || 0) + amount;
                  if (!h2.entryMonth) h2.entryMonth = state.month;
                  state.holdings[p.product] = h2;
                  state.cash -= amount;
                  state.lastTrade = { kind: "buy", product: p.product, month: state.month, proceeds: amount, costBasis: amount, pnl: 0, turn: state.turnCount };
                }
                if (amount > 0 && p.rule === "accrual") albaTimeConsume("buy");
                finishTurn(p.event, "enter:" + p.product + ":" + slider.value);
              };
              if (albaTimeLimited()) {
                const note = document.createElement("p");
                note.className = "note alba-time-confirm";
                note.textContent = "\\uD655\\uC815\\uD558\\uBA74 " + state.month + " \\uC54C\\uBC14 \\uC218\\uB3D9 \\uD22C\\uC790 \\uD310\\uB2E81\\uD68C\\uB97C \\uC0AC\\uC6A9\\uD569\\uB2C8\\uB2E4. \\uAC19\\uC740 \\uB2EC \\uC0C8 \\uB9E4\\uC218\\xB7\\uB9E4\\uB3C4\\xB7\\uC870\\uAC74/\\uAE30\\uD55C \\uBCC0\\uACBD\\uC740 \\uB354 \\uD560 \\uC218 \\uC5C6\\uC2B5\\uB2C8\\uB2E4. \\uC785\\uB825 \\uCDE8\\uC18C\\uB294 \\uC0AC\\uC6A9\\uD558\\uC9C0 \\uC54A\\uC2B5\\uB2C8\\uB2E4 [\\uAC8C\\uC784\\uADDC\\uCE59].";
                card.append(note);
              }
              box.appendChild(go2);
              const cancel = document.createElement("button");
              cancel.textContent = "\\uCDE8\\uC18C (\\uB3CC\\uC544\\uAC00\\uAE30)";
              cancel.onclick = () => {
                pending = null;
                render();
              };
              box.appendChild(cancel);
            }
          }`;
    const GEN133_COMMIT_PACE_FINGERPRINT = 'function commitDecisionPace(signature) {\n            if (storageReadBlocked || storageWriteBlocked || !decisionPaceAllowed() || JSON.stringify([state.month, state.turnCount, state.flags, state.cash, state.pendingOrders, state.careerCycle]) !== signature) return;\n            const from = state.month, unpaidBefore = careerCashUnpaid(), fillsBefore = (state.fillsLog || []).length, historyBefore = state.history.length;\n            let steps = 0, reason = "\\uD310\\uB2E8 \\uACBD\\uACC4";\n            while (steps < 500) {\n              const t = nextTurn(), td2 = turnEffDate(t);\n              effDate = td2.date;\n              effPostClose = td2.postClose;\n              tryFillOrders();\n              const fills = (state.fillsLog || []).length - fillsBefore, expiries = state.history.slice(historyBefore).filter((h2) => h2.choice?.startsWith("order-expired:")).length;\n              if (fills || expiries) {\n                reason = "\\uC8FC\\uBB38 \\uBCC0\\uD654";\n                break;\n              }\n              if (careerCashUnpaid() > unpaidBefore) {\n                reason = "\\uCD94\\uAC00 \\uBBF8\\uB0A9";\n                break;\n              }\n              if (reservationSettlementDue()) {\n                reason = "\\uAE30\\uC874 \\uC608\\uC57D \\uBD84\\uAE30 \\uC815\\uC0B0";\n                break;\n              }\n              if (steps > 0 && careerCycleStatus(t)?.allowed) {\n                reason = "\\uBD84\\uAE30 \\uC9C4\\uB85C \\uC7AC\\uC120\\uD0DD";\n                break;\n              }\n              if (steps > 0) recordAssetTrail();\n              if (t.kind !== "quiet" || state.flags.gameOver || state.month > GAME_END) {\n                reason = { news: "\\uB274\\uC2A4", life: "\\uC9C4\\uB85C\\xB7\\uBCF5\\uBB34", discharge: "\\uC804\\uC5ED", "natural-end": "\\uC885\\uB8CC", gameover: "\\uAC8C\\uC784 \\uC885\\uB8CC" }[t.kind] || t.kind;\n                break;\n              }\n              const before = state.month;\n              advanceMonth();\n              if (storageReadBlocked || storageWriteBlocked || multiTabConflict || state.month === before) return;\n              state.turnCount++;\n              steps++;\n            }\n            if (steps === 500) reason = "\\uC548\\uC804 \\uC0C1\\uD55C";\n            const report = { version: 1, from, to: state.month, steps, reason, fills: (state.fillsLog || []).length - fillsBefore, expiries: state.history.slice(historyBefore).filter((h2) => h2.choice?.startsWith("order-expired:")).length, unpaidAdded: Math.max(0, careerCashUnpaid() - unpaidBefore) };\n            state.decisionPaceReport = report;\n            state.history.push({ month: state.month, decisionMonth: from, choice: "decision-pace:" + steps, reason });\n            if (save()) render();\n          }';
    let legacyIdentityFields = null;
    const recordDataHashes = {};
    async function loadRecordData(url) {
      const r = await fetch(url);
      if (!r.ok) throw Error("http");
      const bytes = await r.arrayBuffer(), text = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(text);
      const listFile = /\/(events|prices|unlocks|early-school-news)\.json$/.test(url);
      if (listFile && (!Array.isArray(parsed) || !parsed.length || parsed.some((row) => !row || typeof row !== "object" || Array.isArray(row)))) throw Error("shape");
      if (/\/(events|early-school-news)\.json$/.test(url) && parsed.some((row) => typeof row.date !== "string" || typeof row.id !== "string" || typeof row.kind !== "string")) throw Error("shape");
      if (url === "data/prices.json" && parsed.some((row) => typeof row.date !== "string" || typeof row.series !== "string" || !Number.isFinite(row.value))) throw Error("shape");
      if (url === "data/unlocks.json" && parsed.some((row) => typeof row.product !== "string" || typeof row.name !== "string")) throw Error("shape");
      if (url === "data/rates.json" && (!parsed || typeof parsed.rates !== "object" || Array.isArray(parsed.rates) || !Object.keys(parsed.rates).length)) throw Error("shape");
      if (url === "data/turns.json" && (!parsed?.types || !parsed?.rules)) throw Error("shape");
      try {
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        recordDataHashes[url] = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
      } catch (_) {
        recordDataHashes[url] = null;
      }
      return parsed;
    }
    function showDataLoadUnavailable(failedFiles) {
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">\uD544\uC218 \uAC8C\uC784 \uC790\uB8CC \uD655\uC778 \uD544\uC694</div><h2>\uC790\uB8CC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD574 \uC2DC\uC791\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4</h2><p>\uBC30\uD3EC\uBCF8\uC758 \uD544\uC218 \uD30C\uC77C\uC774 \uC5C6\uAC70\uB098, \uC751\uB2F5\xB7JSON\uC758 \uAE30\uBCF8 \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uBE48 \uC2DC\uC138\uB098 \uC784\uC758 \uC5ED\uC0AC \uC790\uB8CC\uB85C \uB300\uCCB4\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p><ul id="data-load-failures" style="padding-left:20px;margin:12px 0;overflow-wrap:anywhere">' + failedFiles.map((f) => "<li>" + esc(f) + "</li>").join("") + "</ul><p>\uC774 \uC911\uB2E8\uAE4C\uC9C0 \uAE30\uC874 \uC800\uC7A5\uC744 \uC4F0\uAC70\uB098 \uC0AD\uC81C\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uC9C0\uC6B0\uC9C0 \uB9C8\uC138\uC694. \uD544\uC218 \uC790\uB8CC\uAC00 \uD3EC\uD568\uB41C \uAC19\uC740 \uBC30\uD3EC \uC8FC\uC18C\uC5D0\uC11C \uB2E4\uC2DC \uBD88\uB7EC\uC640 \uD655\uC778\uD558\uC138\uC694. \uB2E4\uB978 \uC8FC\uC18C\uB85C \uC62E\uAE30\uBA74 \uC800\uC7A5\uC774 \uC790\uB3D9\uC73C\uB85C \uB530\uB77C\uAC00\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
      box.innerHTML = "";
      const retry = document.createElement("button");
      retry.id = "data-load-retry";
      retry.textContent = "\uC790\uB8CC \uBC18\uC601 \uD6C4 \uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30";
      retry.onclick = () => location.reload();
      box.appendChild(retry);
      const portfolio = document.getElementById("portfolio");
      if (portfolio) portfolio.innerHTML = "<p>\uAC8C\uC784 \uC790\uB8CC\uAC00 \uC900\uBE44\uB418\uAE30 \uC804\uC5D0\uB294 \uD3C9\uAC00\xB7\uC8FC\uBB38\xB7\uC6D4 \uC9C4\uD589\uC744 \uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
    }
    let storageWriteBlocked = false;
    let storageReadBlocked = false;
    let multiTabConflict = false;
    let lastKnownRaw = initialStorage.ok ? initialStorage.bootRaw : null;
    let pending = null;
    let effDate = state.month + "-01";
    let effPostClose = false;
    function turnEffDate(turn) {
      if (turn && turn.settlement) return { date: turn.observationDate, postClose: turn.observationPostClose };
      if (turn && turn.event && turn.event.date) {
        const d = turn.event.date;
        if (d.length === 10) return { date: d, postClose: true };
        return { date: d + "-01", postClose: false };
      }
      return { date: state.month + "-01", postClose: false };
    }
    async function boot() {
      if (SCHOOL_MODE) document.querySelector("header p").textContent = CAREER_TRIAL ? "\uACC4\uD68D\uD615 \uCDE8\uC5C5 / \uB300\uC751\uD615 \uC804\uC5C5 \xB7 \uBCC4\uB3C4 \uC2DC\uC81C\uD488 \xB7 \uAE30\uC874 \uC800\uC7A5 \uBBF8\uBCC0\uACBD" : SCHOOL_CASH_MODE ? "\uACE01 \uB2EC\uB825 + \uD604\uAE08\uC0AC\uAC74 \uC5F0\uACB0 \uC2DC\uD5D8 \xB7 \uC0C8 \uC800\uC7A5\uD0A4 \xB7 \uBAA8\uB4E0 \uAE08\uC561 \uC784\uC758\uAC12" : "\uC0DD\uB144 \uACE01 \uB2EC\uB825 \uC2DC\uC791(\uBCF8\uD3B8) \xB7 \uC0DD\uB144\uC6D4\uBCC4 \uC800\uC7A5 \xB7 \uC5ED\uC0AC\uC790\uB8CC/\uC0DD\uD65C\uACBD\uC81C/\uC0C1\uD488\uC811\uADFC \uACE0\uC99D \uBBF8\uC644\uC131";
      if (!initialStorage.ok) return showStorageReadUnavailable();
      if (!inspectForeignFundTag(state)) return showSaveConflict("\uD574\uC678 \uD380\uB4DC\uC9D1\uC911\uB3C4 \uC790\uB8CC\xB7\uADDC\uCE59 \uC2DD\uBCC4\uC774 \uB9DE\uC9C0 \uC54A\uC544 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "foreign-fund-scale-shape");
      if (!propertyShapeOk(state)) return showSaveConflict("\uC8FC\uD0DD \uC18C\uC720\xB7\uACC4\uC57D \uAE30\uB85D\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "property-shape");
      const dataFiles = ["data/events.json", "data/prices.json", "data/turns.json", "data/unlocks.json", "data/rates.json", ...SCHOOL_MODE ? ["data/early-school-news.json"] : []];
      const results = await Promise.allSettled(dataFiles.map(loadRecordData));
      const failedFiles = dataFiles.filter((_, i) => results[i].status === "rejected");
      if (failedFiles.length) return showDataLoadUnavailable(failedFiles);
      const [baseEvents, prices, turns, unlocks, rates, schoolResult] = results.map((r) => r.value), schoolEvents = schoolResult || [];
      const PRESERVED_SETS = [
        { ev: "data/events.2026-11-13-gen139.json", pr: "data/prices.2026-11-13-gen139.json" }, // Exact creation bytes before Yahoo domestic index history.
        { ev: "data/events.2026-11-13-gen138.json", pr: "data/prices.2026-11-13-gen138.json" }, // Exact current creation bytes before domestic monthly density.
        { ev: "data/events.2026-11-13-gen137.json", pr: "data/prices.2026-11-13-gen137.json" },
        { ev: "data/events.2026-11-13-gen136.json", pr: "data/prices.2026-11-13-gen136.json" },
        // exact136 before official monthly FX observations
        { ev: "data/events.2026-11-12-gen133.json", pr: "data/prices.2026-11-12-gen133.json" },
        // exact133 before US/China ETF data
        { ev: "data/events.2026-11-12-gen117.json", pr: "data/prices.2026-11-12-gen117.json" },
        //117exact before2011policy bundle
        { ev: "data/events.2026-11-12-gen116.json", pr: "data/prices.2026-11-12-gen116.json" },
        //116exact before2013policy bundle
        { ev: "data/events.2026-11-12-gen114.json", pr: "data/prices.2026-11-12-gen114.json" },
        //114exact before2015policy bundle
        { ev: "data/events.2026-11-12-gen113.json", pr: "data/prices.2026-11-12-gen113.json" },
        //113exact before2016policy bundle
        { ev: "data/events.2026-11-12-gen112.json", pr: "data/prices.2026-11-12-gen112.json" },
        //112exact before2012news/price bundle
        { ev: "data/events.2026-11-12-gen111.json", pr: "data/prices.2026-11-12-gen111.json" },
        //111exact creation data before2017news/price bundle
        { ev: "data/events.2026-11-12-gen110.json", pr: "data/prices.2026-11-12-gen110.json" },
        // exact110 creation bytes before2014KOSPI sparse points
        { ev: "data/events.2026-11-12-gen109.json", pr: "data/prices.2026-11-12-gen109.json" },
        // exact109 creation bytes before2014news additions
        { ev: "data/events.2026-11-12-gen102.json", pr: "data/prices.2026-11-12-gen102.json" },
        // exact gen102 source bytes before2012-2013 KOSPI increment
        { ev: "data/events.2026-11-12-gen101.json", pr: "data/prices.2026-11-12-gen101.json" },
        // exact gen94-101 source bytes before2015 KOSPI increment
        { ev: "data/events.2026-11-12-gen93.json", pr: "data/prices.2026-11-12-gen93.json" },
        // exact gen92/93 data before2011 KOSPI increment
        { ev: "data/events.2026-11-11-gen91.json", pr: "data/prices.2026-11-11-gen91.json" },
        // exact gen88-91 creation data before2010FX increment
        { ev: "data/events.2026-11-11-gen87.json", pr: "data/prices.2026-11-11-gen87.json" },
        // gen87 exact data retained before2018 KOSDAQ increment
        { ev: "data/events.2026-11-11-gen86.json", pr: "data/prices.2026-11-11-gen86.json" },
        // gen86 exact creation data retained before2018 KOSPI increment
        { ev: "data/events.2026-11-11-gen85.json", pr: "data/prices.2026-11-11-gen85.json" },
        // gen85 exact creation data retained before2003 KOSPI increment
        { ev: "data/events.2026-11-11-gen84.json", pr: "data/prices.2026-11-11-gen84.json" },
        // gen84 exact creation data retained before2003 gap increment
        { ev: "data/events.2026-11-11-gen83.json", pr: "data/prices.2026-11-11-gen83.json" },
        // gen76-83 exact creation data retained before2018 gap increment
        { ev: "data/events.2026-11-11-gen74.json", pr: "data/prices.2026-11-11-gen74.json" },
        // gen71-74 exact creation data retained before2000 increment
        { ev: "data/events.2026-11-11-gen69.json", pr: "data/prices.2026-11-11-gen69.json" },
        // gen69/70 생성 자료 원바이트 보존
        { ev: "data/events.2026-11-11-gen61.json", pr: "data/prices.2026-11-11-gen61.json" },
        // gen61 직전 자료 원바이트 보존
        { ev: "data/events.2026-11-10-baseline.json", pr: "data/prices.2026-11-10-baseline.json" },
        // gen42 공개분 원바이트
        { ev: "data/events.2026-11-11-gen45.json", pr: "data/prices.2026-11-11-gen45.json" },
        // gen45(2022~23 6카드 증분) 원바이트
        { ev: "data/events.2026-11-11-gen46.json", pr: "data/prices.2026-11-11-gen46.json" },
        // gen46(2020년 5카드 증분) 원바이트
        { ev: "data/events.2026-11-11-gen48.json", pr: "data/prices.2026-11-11-gen48.json" },
        // gen48(2021년 5카드·종료리셋 교정) 원바이트
        { ev: "data/events.2026-11-11-gen49.json", pr: "data/prices.2026-11-11-gen49.json" },
        // gen49(2019년 5카드) 원바이트
        { ev: "data/events.2026-11-11-gen50.json", pr: "data/prices.2026-11-11-gen50.json" },
        // gen50(2024년 5카드) 원바이트
        { ev: "data/events.2026-11-11-gen51.json", pr: "data/prices.2026-11-11-gen51.json" }
        // gen51(2025년 5카드) 원바이트
      ];
      const preservedResults = await Promise.allSettled(PRESERVED_SETS.flatMap((s) => [s.ev, s.pr]).map(loadRecordData));
      const preservedSets = PRESERVED_SETS.map((s, i) => ({
        evPath: s.ev,
        prPath: s.pr,
        events: preservedResults[i * 2].status === "fulfilled" ? preservedResults[i * 2].value : null,
        prices: preservedResults[i * 2 + 1].status === "fulfilled" ? preservedResults[i * 2 + 1].value : null
      }));
      let rulesHash = null;
      try {
        const material = [tradeAccess, productAvailable, nextLifeEvent, choose, advanceMonth, monthlySavings, applyJobSavingsPlan, jobPlanProduct, tryFillOrders, accrualRate, marketSizeOf, monthlyChaosAdd, freshState, ReturnSchoolCalendar.nominal, ReturnEconomyPolicy.inspect].map((f) => f === productAvailable ? GEN133_PRODUCT_AVAILABLE_FINGERPRINT : f === nextLifeEvent ? GEN133_NEXT_LIFE_FINGERPRINT : f === choose ? GEN133_CHOOSE_FINGERPRINT : f === advanceMonth ? GEN68_ADVANCE_MONTH_FINGERPRINT : f === tradeAccess ? GEN68_TRADE_ACCESS_FINGERPRINT : f === tryFillOrders ? legacyTryFillOrders.toString().replace("legacyTryFillOrders", "tryFillOrders") : f === monthlyChaosAdd ? legacyMonthlyChaosAdd.toString().replace("legacyMonthlyChaosAdd", "monthlyChaosAdd") : f === marketSizeOf ? GEN137_MARKET_SIZE_FINGERPRINT : f.toString()).join("\n") + "\n" + JSON.stringify({ SAVINGS_BASE, CHAOS, DEMO_END, GAME_END, MODEL_ID, CAREER_TRIAL, SCHOOL_MODE, CASH_MODE });
        const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
        rulesHash = Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
      } catch (_) {
      }
      try {
        const material = [tryFillOrders, cashPlanActive, prepareCashPlanMonth, applyCareerCashMonth, careerCashSchedule, applyCashSavingsPlan, cashFlowReview, cashPlanCanSet].map((f) => f === applyCashSavingsPlan ? cashUnbufferedSavingsPlan.toString().replace("cashUnbufferedSavingsPlan", "applyCashSavingsPlan") : f.toString()).join("\n") + "\n" + JSON.stringify(CCV) + "\n" + rulesHash;
        const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
        cashIdentityFields = { economy: "career-cash-events-v1", ruleset: "return-rules-20261111-cash-main-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
      } catch (_) {
      }
      try {
        const material = [applyCashSavingsPlan, cashBufferedSavingsPlan, cashReservePreview].map((f) => f === applyCashSavingsPlan ? legacyApplyCashSavingsPlan.toString().replace("legacyApplyCashSavingsPlan", "applyCashSavingsPlan") : f.toString()).join("\n") + "\n" + cashIdentityFields?.rulesHash;
        const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
        cashReserveIdentityFields = { economy: "career-cash-events-v1", ruleset: "return-rules-20261111-cash-reserve-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
      } catch (_) {
      }
      try {
        const core = [careerCycleActive, careerCycleTrack, careerCycleStatus, commitCareerCycle, ReturnEconomyPolicy.inspectNested].map((f) => f === ReturnEconomyPolicy.inspectNested ? GEN67_INSPECT_NESTED_FINGERPRINT : f.toString()).join("\n");
        for (const reserve of [false, true]) {
          const material = core + "\n" + (reserve ? cashReserveIdentityFields?.rulesHash : cashIdentityFields?.rulesHash);
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
          const id = { economy: "career-cash-events-v1", ruleset: "return-rules-20261111-career-cycle" + (reserve ? "-reserve" : "") + "-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) cashCycleReserveIdentityFields = id;
          else cashCycleIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        const core = [decisionPaceActive, decisionPaceAllowed, commitDecisionPace, ReturnEconomyPolicy.inspectNested].map((f) => f === decisionPaceAllowed ? gen98DecisionPaceAllowed.toString().replace("gen98DecisionPaceAllowed", "decisionPaceAllowed") : f === commitDecisionPace ? gen98CommitDecisionPace.toString().replace("gen98CommitDecisionPace", "commitDecisionPace") : f.toString()).join("\n");
        for (const reserve of [false, true]) {
          const material = core + "\n" + (reserve ? cashCycleReserveIdentityFields?.rulesHash : cashCycleIdentityFields?.rulesHash);
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
          const id = { economy: "career-cash-events-v1", ruleset: "return-rules-20261111-decision-pace" + (reserve ? "-reserve" : "") + "-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) cashPaceReserveIdentityFields = id;
          else cashPaceIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        const core = [albaTimeActive, albaTimeLimited, albaTimeAvailable, albaTimeConsume, albaTimeShapeOk, tradeAccess, advanceMonth, renderTrade, orderConditionReview, renderOrderConditionConfirm, orderDeadlineReview, renderOrderDeadline].map((f) => f === renderTrade ? GEN133_RENDER_TRADE_FINGERPRINT : f === advanceMonth ? GEN133_ADVANCE_MONTH_FINGERPRINT : f.toString()).join("\n");
        for (const reserve of [false, true]) {
          const material = core + "\n" + (reserve ? cashPaceReserveIdentityFields?.rulesHash : cashPaceIdentityFields?.rulesHash);
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
          const id = { economy: "career-cash-events-v1", ruleset: "return-rules-20261111-alba-time" + (reserve ? "-reserve" : "") + "-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) cashTimeReserveIdentityFields = id;
          else cashTimeIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        const core = [chaosExposureActive, chaosExposureShapeOk, chaosExposureHoldings, monthlyChaosAdd, chaosTrajectory].map((f) => f === chaosTrajectory ? GEN133_CHAOS_TRAJECTORY_FINGERPRINT : f.toString()).join("\n");
        for (const reserve of [false, true]) {
          const base = reserve ? cashTimeReserveIdentityFields : cashTimeIdentityFields;
          if (!base) continue;
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(core + "\n" + JSON.stringify(base)));
          const id = { economy: base.economy, ruleset: "return-rules-20261111-chaos-exposure-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) chaosTimeReserveIdentityFields = id;
          else chaosTimeIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        const core = [reservationSettlementActive, reservationSettlementShapeOk, reservationSettlementDue, settlementDue, decisionPaceAllowed, commitDecisionPace].map((f) => f === commitDecisionPace ? GEN133_COMMIT_PACE_FINGERPRINT : f.toString()).join("\n");
        for (const reserve of [false, true]) {
          const base = reserve ? chaosTimeReserveIdentityFields : chaosTimeIdentityFields;
          if (!base) continue;
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(core + "\n" + JSON.stringify(base)));
          const id = { economy: base.economy, ruleset: "return-rules-20261112-reservation-settlement-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) reservationReserveIdentityFields = id;
          else reservationIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        const core = [cashAllocationShapeOk, cashAllocationAmounts, applyCashAllocationPlan, renderCashAllocationPlan].map((f) => f.toString()).join("\n");
        for (const reserve of [false, true]) {
          const base = reserve ? reservationReserveIdentityFields : reservationIdentityFields;
          if (!base) continue;
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(core + "\n" + JSON.stringify(base)));
          const id = { economy: base.economy, ruleset: "return-rules-20261112-cash-allocation-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) allocationReserveIdentityFields = id;
          else allocationIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        for (const reserve of [false, true]) {
          const base = reserve ? allocationReserveIdentityFields : allocationIdentityFields;
          if (!base) continue;
          const material = JSON.stringify(base) + "\n" + JSON.stringify(PROPERTY_PRICE_MODEL) + "\n" + JSON.stringify(HomeContract.PROPERTY_RULES) + "\n" + [HomeContract.placeProperty, HomeContract.quoteProperty, HomeContract.settleProperty, HomeContract.cancelProperty, HomeContract.closePropertyContracts, HomeContract.propertySnapshot, HomeContract.inspectProperty, estimatedPropertyPrice, propertyPrices, propertyValuationMonth, chaosTrajectory, propertyShapeOk, propertyActionAllowed, propertyChaosAdd].map((f) => f.toString()).join("\n");
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
          const id = { economy: base.economy, ruleset: "return-rules-20261112-whole-home-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) propertyReserveIdentityFields = id;
          else propertyIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        for (const reserve of [false, true]) {
          const base = reserve ? propertyReserveIdentityFields : propertyIdentityFields;
          if (!base) continue;
          const material = JSON.stringify(base) + "\n" + JSON.stringify(FOREIGN_ETF_RULES) + "\n" + JSON.stringify(FOREIGN_ETF_PRODUCTS) + "\n" + [inspectForeignTag, foreignShapeOk, foreignIdentity, enableForeignProducts, productAvailable].map((f) => f.toString()).join("\n");
          const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
          const id = { economy: base.economy, ruleset: "return-rules-20261112-foreign-etf-v1", rulesHash: Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("") };
          if (reserve) foreignReserveIdentityFields = id;
          else foreignIdentityFields = id;
        }
      } catch (_) {
      }
      try {
        for (const reserve of [false, true]) {
          const base = reserve ? foreignReserveIdentityFields : foreignIdentityFields;
          if (!base) continue;
          const material = JSON.stringify(base) + "\n" + JSON.stringify(FOREIGN_FUND_SCALE_RULES) + "\n" + JSON.stringify(FUND_SCALE_ROWS) + "\n" + FOREIGN_FUND_SCALE_IMPLEMENTATION + "\n" + [inspectForeignFundTag, foreignFundDenominator, foreignFundScaleActive, foreignFundScaleIdentity, foreignFundScaleMarket, foreignFundScaleCutoff, marketSizeOf].map((f) => f.toString()).join("\n");
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
          const id = { economy: base.economy, ruleset: "return-rules-20261113-foreign-fund-concentration-v1", rulesHash: Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("") };
          if (reserve) foreignFundScaleReserveIdentityFields = id;
          else foreignFundScaleIdentityFields = id;
        }
      } catch (_) {
      }
      currentRecordIdentity = { version: 1, ruleset: ReturnRecordContext.RULESET, rulesScope: "selected-engine-functions-v1", rulesHash, mode: CAREER_TRIAL ? "career-planning-trial" : SCHOOL_CASH_MODE ? "school-cash" : SCHOOL_MODE ? "school-main" : GAME_LIVING ? "game-living" : CASH_MODE ? "classic-cash" : "classic", economy: MODEL_ID, files: { ...recordDataHashes } };
      legacyIdentityFields = { economy: MODEL_ID, ruleset: ReturnRecordContext.RULESET, rulesHash };
      for (const s of PRESERVED_SETS) {
        delete currentRecordIdentity.files[s.ev];
        delete currentRecordIdentity.files[s.pr];
      }
      if (cashPlanActive()) {
        if (!cashIdentityFields) return showSaveConflict("\uC0C8 \uACBD\uC81C \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4.", "cash-identity");
        Object.assign(currentRecordIdentity, cashIdentityFields);
        if (state.cashReservePolicy) {
          if (!cashReserveIdentityFields) return showSaveConflict("\uC608\uBE44\uAE08 \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "cash-reserve-identity");
          Object.assign(currentRecordIdentity, cashReserveIdentityFields);
        }
        if (careerCycleActive()) {
          const id = careerCycleIdentity();
          if (!id) return showSaveConflict("\uC9C4\uB85C \uC21C\uD658 \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "career-cycle-identity");
          Object.assign(currentRecordIdentity, id);
        }
        if (decisionPaceActive()) {
          const id = decisionPaceIdentity();
          if (!id) return showSaveConflict("\uD310\uB2E8 \uACBD\uACC4 \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "decision-pace-identity");
          Object.assign(currentRecordIdentity, foreignFundScaleActive() ? foreignFundScaleIdentity() : foreignActive() ? foreignIdentity() : propertyActive() ? propertyIdentity() : id);
        }
      }
      let decisionBaseEvents = baseEvents;
      const events = baseEvents.concat(schoolEvents);
      events.sort((a, b) => a.date.localeCompare(b.date));
      prices.sort((a, b) => a.date.localeCompare(b.date));
      DATA = { events, prices, turns, unlocks, rates };
      enableForeignProducts();
      {
        const curEvH = recordDataHashes["data/events.json"], curPrH = recordDataHashes["data/prices.json"];
        const ctxs = loadedSnapshot.exists && state.recordContext && Array.isArray(state.recordContext.contexts) ? state.recordContext.contexts : [];
        const lastCtx = ctxs.length ? ctxs[ctxs.length - 1] : null;
        const matchesSet = (c, ev, pr) => !!(c && c.files && c.files["data/events.json"] === ev && c.files["data/prices.json"] === pr);
        if (lastCtx && lastCtx.files && !matchesSet(lastCtx, curEvH, curPrH)) {
          const pinSet = preservedSets.find((s) => s.events && s.prices && matchesSet(lastCtx, recordDataHashes[s.evPath], recordDataHashes[s.prPath]));
          if (pinSet) {
            decisionBaseEvents = pinSet.events;
            const pEvents = pinSet.events.concat(schoolEvents);
            pEvents.sort((a, b) => a.date.localeCompare(b.date));
            pinSet.prices.sort((a, b) => a.date.localeCompare(b.date));
            DATA = { events: pEvents, prices: pinSet.prices, turns, unlocks, rates };
            currentRecordIdentity.files["data/events.json"] = recordDataHashes[pinSet.evPath];
            currentRecordIdentity.files["data/prices.json"] = recordDataHashes[pinSet.prPath];
          } else if (preservedSets.some((s) => !s.events || !s.prices)) {
            return showSaveConflict("\uC774 \uC800\uC7A5\uC774 \uC9C4\uD589\uB418\uB358 \uB274\uC2A4\xB7\uC2DC\uC138 \uBB36\uC74C\uC744 \uC774 \uBC30\uD3EC\uBCF8\uC5D0\uC11C \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uC790\uB8CC\uB85C \uC790\uB3D9 \uB300\uCCB4\uD558\uAC70\uB098 \uC800\uC7A5 \uC6D0\uBB38\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC558\uC5B4\uC694.", "data-pin");
          } else {
            return showSaveConflict("\uC774 \uC800\uC7A5\uC774 \uAE30\uB85D\uD55C \uB274\uC2A4\xB7\uC2DC\uC138 \uBB36\uC74C\uC744 \uC774 \uBC30\uD3EC\uBCF8\uC758 \uD604\uC7AC\xB7\uBCF4\uC874 \uBB36\uC74C \uC5B4\uB514\uC5D0\uC11C\uB3C4 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uC790\uB8CC\uB85C \uC790\uB3D9 \uB300\uCCB4\uD558\uAC70\uB098 \uC800\uC7A5 \uC6D0\uBB38\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC558\uC5B4\uC694.", "data-pin-unknown");
          }
        } else if (loadedSnapshot.exists && !lastCtx) {
          return showSaveConflict("\uC774 \uC800\uC7A5\uC5D0\uB294 \uC9C4\uD589 \uB2F9\uC2DC \uB274\uC2A4\xB7\uC2DC\uC138 \uBB36\uC74C\uC758 \uC2DD\uBCC4 \uAE30\uB85D\uC774 \uC5C6\uC5B4 \uC790\uB8CC \uBCF4\uCDA9 \uD6C4\uC5D0\uB3C4 \uAC19\uC740 \uC704\uCE58\uC778\uC9C0 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uC6D0\uBB38\uC744 \uBC14\uAFB8\uAC70\uB098 \uCD94\uC815 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694.", "data-pin-unknown");
        }
      }
      enableForeignProducts();
      window.__returnDecisionData = Object.freeze({ events: Object.freeze(decisionBaseEvents.map((e) => Object.freeze({ ...e }))), prices: Object.freeze(DATA.prices.map((p) => Object.freeze({ ...p }))) });
      if (!foreignShapeOk(state)) return showSaveConflict("\uD574\uC678 ETF \uADDC\uCE59 \uC2DD\uBCC4\uACFC \uBCF4\uC720\xB7\uC8FC\uBB38\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "foreign-shape");
      if (!loadedSnapshot.ok) return showSaveConflict("\uC800\uC7A5 JSON \uB610\uB294 \uAE30\uBCF8 \uAD6C\uC870\uB97C \uC77D\uC744 \uC218 \uC5C6\uC5B4 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC0C8 \uAC8C\uC784\uC73C\uB85C \uC790\uB3D9 \uB300\uCCB4\uD558\uAC70\uB098 \uC6D0\uBB38\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC5B4\uC694.", "save-shape");
      if (!ReturnEconomyPolicy.inspect(state, currentEconomyId()).ok) return showEconomyConflict();
      if (!inspectForeignFundTag(state)) return showSaveConflict("\uD574\uC678 \uD380\uB4DC\uC9D1\uC911\uB3C4 \uC790\uB8CC\xB7\uADDC\uCE59 \uC2DD\uBCC4\uC774 \uB9DE\uC9C0 \uC54A\uC544 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "foreign-fund-scale-shape");
      if (!propertyShapeOk(state)) return showSaveConflict("\uC8FC\uD0DD \uBAA8\uD615\uC758 \uACC4\uC57D\xB7\uC18C\uC720 \uAE30\uB85D \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "property-shape");
      if (DATA && (!ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map((u) => u.product)).ok || !cashAllocationShapeOk(state) || !albaTimeShapeOk(state) || !chaosExposureShapeOk(state) || !reservationSettlementShapeOk(state))) return showSaveConflict("\uBCF4\uC720\uC790\uC0B0\xB7\uB300\uAE30\uC8FC\uBB38\xB7\uC7A5\uBD80\uC758 \uC77C\uBD80 \uC800\uC7A5 \uD615\uC2DD\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uAE08\uC561\uC744 \uCD94\uC815\uD558\uAC70\uB098 \uC6D0\uBB38\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC5B4\uC694.", "save-shape");
      if (loadedSnapshot.exists && SCHOOL_MODE && !validSchoolStart()) return showSaveConflict("\uACE01 \uB2EC\uB825 \uC2DC\uC791 \uC2DC\uD5D8\uC758 \uC2DC\uC791\uC6D4\xB7\uC0DD\uC6D4 \uADFC\uAC70\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uBAA8\uD615\uC73C\uB85C \uCD94\uC815 \uBCC0\uD658\uD558\uAC70\uB098 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC5B4\uC694.", "school-start");
      if (!loadedSnapshot.exists) {
        renderBirthSelect();
        if (legacySave) {
          const card = document.getElementById("turn-card");
          const note = document.createElement("p");
          note.style.cssText = "font-size:12px;color:#8a6d3b;background:#fcf8e3;border:1px solid #e8dcc0;border-radius:6px;padding:6px 8px;margin-top:8px;";
          note.textContent = "\uC774\uC804 \uC2DC\uC5F0 \uC800\uC7A5\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uC9C4\uB85C \uADDC\uCE59 \uBCC0\uACBD(\uACE01 \uBD84\uAE30\xB7\uC878\uC5C5 \uAE30\uBC18 \uC7AC\uBD84\uAE30)\uC73C\uB85C \uD638\uD658\uB418\uC9C0 \uC54A\uC544 \uC0C8\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4. \uC774\uC804 \uC800\uC7A5\uC740 \uC0AD\uC81C\uD558\uC9C0 \uC54A\uACE0 \uBCF4\uAD00\uB3FC \uC788\uC5B4\uC694.";
          card.appendChild(note);
        }
      } else if (restoreNewsCursor()) render();
    }
    function hsYear(birthYear, birthMonth) {
      if (SCHOOL_MODE) {
        const c = ReturnSchoolCalendar.nominal(birthYear, birthMonth);
        if (!c.ok) throw Error("Unsupported school cohort");
        return c.highYear;
      }
      return birthMonth <= 2 ? birthYear + 15 : birthYear + 16;
    }
    function schoolStartMonth() {
      return SCHOOL_MODE && state.schoolStart ? state.schoolStart.startMonth : "1996-03";
    }
    function schoolDataGap() {
      return SCHOOL_MODE && state.month < "1996-03";
    }
    function validSchoolStart() {
      const c = state.schoolStart, b = state.flags.birth, p = b && ReturnSchoolCalendar.startPlan(b.year, b.month);
      return !!c && Object.keys(c).sort().join(",") === "startMonth,version" && c.version === 1 && p?.ok && b.hsYear === p.calendar.highYear && c.startMonth === p.startMonth && state.month >= c.startMonth && state.month <= "2026-11" && state.assetReviewBaseline?.month === c.startMonth;
    }
    function careerTrialNote(open = false) {
      if (!CAREER_TRIAL) return "";
      return "<details " + (open ? "open " : "") + 'class="career-schedule-note" style="padding:12px;border:1px solid #8c9b89;border-radius:8px;margin:12px 0;overflow-wrap:anywhere"><summary style="cursor:pointer">\uBCC4\uB3C4 \uC2DC\uC81C\uD488 \uADDC\uCE59 \xB7 \uCDE8\uC5C5\uC740 \uBD84\uAE30\uACC4\uD68D / \uC804\uC5C5\uC740 \uB274\uC2A4\uB300\uC751 \xB7 \uCDE8\uC18C\uAE08 \uC7AC\uC0AC\uC6A9 \uC2DC\uC810</summary><p>\uAE30\uC874 \uBCF8\uD3B8\xB7\uD074\uB798\uC2DD\xB7\uD604\uAE08\uC2DC\uD5D8\uC758 \uC5EC\uB35F \uC800\uC7A5\uD0A4\uB97C \uC77D\uC5B4 \uC62E\uAE30\uAC70\uB098 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD604\uC2E4 \uC9C1\uC5C5\uBCC4 \uD22C\uC790\uB2A5\uB825\xB7\uC2DC\uAC04\uD45C\uB97C \uACE0\uC99D\uD55C \uADDC\uCE59\uC774 \uC544\uB2D9\uB2C8\uB2E4.</p><p>\uCDE8\uC5C5: \uD604\uC7AC \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC744 \uBC1B\uACE0, \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC0C8 \uC218\uB3D9\uC8FC\uBB38\uACFC \uC55E\uC73C\uB85C\uC758 \uBC30\uBD84\uC744 \uC815\uD569\uB2C8\uB2E4. \uBD84\uAE30\uC911 \uB274\uC2A4\uB294 \uAC19\uC740 \uC790\uB8CC\uB97C \uC77D\uB418 \uC0C8 \uC8FC\uBB38\uC744 \uC811\uC218\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uCCB4\uACB0 \uCDE8\uC18C\xB7\uC55E\uC73C\uB85C\uC758 \uC801\uB9BD \uC911\uB2E8\xB7\uAE30\uC874 \uC6D0\uD654 \uC774\uC790\uB204\uC801 \uC0C1\uD488\uC758 \uD604\uAE08\uD68C\uC218\uB294 \uC5B8\uC81C\uB4E0 \uAC00\uB2A5\uD558\uBA70, \uBC18\uD658 \uD604\uAE08\uC740 \uC989\uC2DC \uC794\uACE0\uB85C \uB3CC\uC544\uC635\uB2C8\uB2E4. \uADF8 \uD604\uAE08\uC73C\uB85C \uC0C8 \uD22C\uC790\uC8FC\uBB38\uC744 \uB0B4\uB294 \uAC83\uC740 \uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0\uBD80\uD130\uC785\uB2C8\uB2E4. \uD604\uC7AC \uC815\uC0B0 \uD654\uBA74\uC774 \uC544\uC9C1 \uC5F4\uB824 \uC788\uB2E4\uBA74 \uADF8 \uD654\uBA74\uC5D0\uC11C \uB2E4\uC2DC \uC8FC\uBB38\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p><p>\uC804\uC5C5: \uC815\uAE30 \uC21C\uC800\uCD950\uC6D0 \uB300\uC2E0 \uB274\uC2A4\xB7\uD3C9\uC628\uD134\uC5D0\uC11C \uC8FC\uBB38\xB7\uC870\uAC74\xB7\uBD84\uD560\uC744 \uACE0\uB985\uB2C8\uB2E4. \uBA3C\uC800 \uC811\uC218\uD574\uB3C4 \uC2E4\uC81C \uC0C8 \uC801\uACA9\uAD00\uCE21\uC774 \uC5C6\uC73C\uBA74 \uCCB4\uACB0\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAC19\uC740 \uC790\uB8CC\xB7\uAC00\uACA9\uC744 \uC4F0\uBA70 \uC218\uC775 \uBCF4\uB108\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC790\uB8CC\uACF5\uBC31\uC744 \uB354 \uB9CE\uC740 \uD074\uB9AD\uC774\uB098 \uAC00\uC0C1\uC2DC\uC138\uB85C \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><a href="./">\uAE30\uC874 \uBCF8\uD3B8\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30 (\uC800\uC7A5 \uBCC4\uB3C4)</a></details>';
    }
    function careerBatchAllowed() {
      if (!(SCHOOL_MODE && !CASH_MODE) || state.flags.career !== "job") return false;
      if (!CAREER_TRIAL && state.batchRules !== 1) return false;
      const t = nextTurn();
      return SCHOOL_MODE && !CASH_MODE && state.flags.career === "job" && state.flags.academicStatus === "graduated" && !state.flags.gameOver && state.month <= GAME_END && ["news", "quiet"].includes(t.kind) && !t.settlement;
    }
    function appendInlineProgress(box, kind) {
      const job = kind === "job", status = job ? null : careerCycleStatus(nextTurn());
      const section = document.createElement("section");
      section.className = "inline-progress";
      section.setAttribute("aria-label", job ? "\uCDE8\uC5C5 \uBB36\uC74C\uC9C4\uD589 \uC120\uD0DD" : "\uC804\uC5C5\xB7\uC54C\uBC14 \uD310\uB2E8 \uACBD\uACC4 \uC9C4\uD589 \uC120\uD0DD");
      const title = document.createElement("h3");
      title.textContent = job ? "\uACC4\uD68D\uB300\uB85C \uAE30\uB2E4\uB9AC\uAE30" : "\uB2E4\uC74C \uD310\uB2E8\uAE4C\uC9C0 \uAE30\uB2E4\uB9AC\uAE30";
      section.append(title);
      const scope = document.createElement("p");
      scope.className = "inline-progress-scope";
      scope.textContent = job ? "\uD604\uC7AC \uB274\uC2A4\uBD80\uD130 \uC790\uB3D9\uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC9C0\uB098\uAC04 \uB274\uC2A4\uB294 \uB0A0\uC9DC\uBCC4 \uC694\uC57D\uC73C\uB85C \uB0A8\uAE30\uBA70, \uAE30\uC0AC \uC6D0\uBB38\uC744 \uC77D\uAC70\uB098 \uC9C1\uC811 \uD22C\uC790\uD310\uB2E8\uD55C \uAE30\uB85D\uC740 \uC544\uB2D9\uB2C8\uB2E4. \uC0C8 \uC218\uB3D9\uC8FC\uBB38\xB7\uCDE8\uC18C\xB7\uACC4\uD68D\uC911\uB2E8 \uC5C6\uC774 \uD604\uC7AC \uBC30\uBD84\uACFC \uC6D4 \uC218\uC785\xB7\uCCAD\uAD6C\xB7\uC774\uC790\xB7\uAE30\uC874 \uC8FC\uBB38\uC744 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uCCAB \uBD84\uAE30 \uC815\uC0B0\xB7\uC9C4\uB85C\xB7\uC804\uC5ED\xB7\uC885\uB8CC \uB610\uB294 \uC2E4\uC81C \uCCB4\uACB0\xB7\uAE30\uD55C\uBC18\uD658\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4." : "\uD604\uC7AC \uC9C4\uB85C\xB7\uBCF4\uC720\xB7\uB300\uAE30 \uC8FC\uBB38\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uC6D4 \uC218\uC785\xB7\uCCAD\uAD6C\xB7\uC774\uC790\xB7\uAE30\uC874 \uC8FC\uBB38\uC740 \uBC18\uC601\uD558\uACE0, \uCCAB \uB274\uC2A4\xB7\uB2E4\uC74C \uC9C4\uB85C \uBD84\uAE30\xB7\uC9C4\uD559\xB7\uC785\uB300\xB7\uC804\uC5ED\xB7\uC885\uB8CC\xB7\uCCB4\uACB0\xB7\uAE30\uD55C\uBC18\uD658\xB7\uCD94\uAC00 \uBBF8\uB0A9 \uB610\uB294 \uAE30\uC874 \uC608\uC57D \uC815\uC0B0\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4. \uC0C8 \uC218\uB3D9\uB9E4\uB9E4\xB7\uCDE8\uC18C\xB7\uC0C1\uD658\uC740 \uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      section.append(scope);
      const caution = document.createElement("p");
      caution.className = "note";
      caution.textContent = job ? "\uD604\uC7AC \uB274\uC2A4\uBD80\uD130 \uD558\uB098\uC529 \uC77D\uAC70\uB098 \uC608\uC57D \uC8FC\uBB38\xB7\uCDE8\uC18C\xB7\uACC4\uD68D \uBCC0\uACBD\uC744 \uACE0\uB974\uB824\uBA74 \uC704\uC758 \uC9C1\uC811 \uC120\uD0DD \uB610\uB294 \uC544\uB798 \uC0C1\uC138 \uAC80\uD1A0\uB97C \uC774\uC6A9\uD558\uC138\uC694. \uBBF8\uB798 \uB274\uC2A4\xB7\uCCB4\uACB0\uC77C\xB7\uAC00\uACA9\uC744 \uBBF8\uB9AC \uBCF4\uC5EC\uC8FC\uB294 \uAE30\uB2A5\uC774 \uC544\uB2D9\uB2C8\uB2E4." : status?.allowed ? "\uC774 \uBC84\uD2BC\uC740 \uC9C0\uAE08 \uC5F4\uB9B0 \uC774\uBC88 \uBD84\uAE30\uC758 \uC9C4\uB85C\uB97C \uC720\uC9C0\uD558\uACE0 \uC9C0\uB098\uAC00\uB294 \uC120\uD0DD\uC785\uB2C8\uB2E4. \uC774\uBC88 \uBD84\uAE30\uC5D0 \uC9C4\uB85C\uB97C \uBC14\uAFB8\uB824\uBA74 \uC704\uC758 \uC7A5\uAE30 \uC9C4\uB85C \uBE44\uAD50\uB97C \uACE0\uB974\uC138\uC694. \uBBF8\uB798 \uB274\uC2A4\xB7\uCCB4\uACB0\uC77C\xB7\uAC00\uACA9\uC744 \uBBF8\uB9AC \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uC9C0\uAE08 \uD544\uC694\uD55C \uB9E4\uB9E4\xB7\uC8FC\uBB38 \uCDE8\uC18C\xB7\uC0C1\uD658\uC774 \uC788\uC73C\uBA74 \uBA3C\uC800 \uC9C1\uC811 \uACE0\uB974\uC138\uC694. \uBBF8\uB798 \uB274\uC2A4\xB7\uCCB4\uACB0\uC77C\xB7\uAC00\uACA9\uC744 \uBBF8\uB9AC \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      section.append(caution);
      const yes = document.createElement("button");
      yes.id = job ? "career-batch-inline-confirm" : "decision-pace-inline-confirm";
      yes.textContent = job ? "\uBC94\uC704\uB97C \uD655\uC778\uD588\uC5B4\uC694 \xB7 \uACC4\uD68D\uB300\uB85C \uBB36\uC74C\uC9C4\uD589" : status?.allowed ? "\uC774\uBC88 \uC9C4\uB85C \uC720\uC9C0 \xB7 \uB2E4\uC74C \uD310\uB2E8 \uACBD\uACC4\uAE4C\uC9C0" : "\uD604\uC7AC \uC9C4\uB85C \uC720\uC9C0 \xB7 \uB2E4\uC74C \uD310\uB2E8 \uACBD\uACC4\uAE4C\uC9C0";
      if (job) yes.onclick = commitCareerBatch;
      else {
        const signature = JSON.stringify([state.month, state.turnCount, state.flags, state.cash, state.pendingOrders, state.careerCycle]);
        yes.onclick = () => commitDecisionPace(signature);
      }
      const detail = document.createElement("button");
      detail.id = job ? "career-batch-open" : "decision-pace-open";
      detail.textContent = "\uC0C1\uC138 \uAC80\uD1A0 \uD654\uBA74 \uC5F4\uAE30 \xB7 \uC544\uC9C1 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC74C";
      detail.onclick = job ? renderCareerBatch : renderDecisionPace;
      section.append(yes, detail);
      box.append(section);
    }
    function renderCareerBatch() {
      if (storageReadBlocked || storageWriteBlocked || !careerBatchAllowed()) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uACC4\uD68D\uD615 \uBB36\uC74C\uC9C4\uD589 \uAC80\uD1A0</div><h2>\uB2E4\uC74C \uD310\uB2E8 \uACBD\uACC4\uAE4C\uC9C0 \uACC4\uD68D\uB300\uB85C \uC9C4\uD589\uD560\uAE4C</h2><p>\uC9C0\uAE08\uBD80\uD130 \uC0C8 \uC218\uB3D9\uC8FC\uBB38 \uC5C6\uC774 \uC6D4 \uADDC\uCE59\uACFC \uC774\uBBF8 \uC815\uD55C \uC2E0\uADDC\uC720\uC785 \uBC30\uBD84\uC744 \uC21C\uC11C\uB300\uB85C \uC801\uC6A9\uD569\uB2C8\uB2E4. \uC9C0\uB098\uAC04 \uB274\uC2A4\uB294 \uB3C4\uCC29 \uB4A4 \uB0A0\uC9DC\uBCC4 \uBAA9\uB85D\uC73C\uB85C \uB0A8\uAE41\uB2C8\uB2E4. \uC790\uB3D9\uD655\uC778\uC740 \uC9C1\uC811 \uACE0\uB978 \uB9E4\uB9E4\uB098 \uC2E4\uC81C \uC6D0\uBB38 \uC2E4\uB3C5\uC73C\uB85C \uAE30\uB85D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p>\uCCAB \uBD84\uAE30 \uC815\uC0B0\xB7\uC9C4\uB85C\xB7\uC804\uC5ED\xB7\uC885\uB8CC \uB610\uB294 \uC2E4\uC81C \uC8FC\uBB38 \uCCB4\uACB0/\uAE30\uD55C\uBC18\uD658\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4. \uB2E4\uC74C \uB274\uC2A4\xB7\uCCB4\uACB0\uC77C\xB7\uAC00\uACA9\uC744 \uBBF8\uB9AC \uAC80\uC0C9\uD558\uAC70\uB098 \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uB274\uC2A4\uBD80\uD130 \uC790\uB3D9\uD655\uC778\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC911\uAC04 \uB274\uC2A4\uB97C \uD558\uB098\uC529 \uC77D\uC73C\uB824\uBA74 \uCDE8\uC18C\uD558\uACE0 \uAE30\uC874 \uC9C4\uD589\uC744 \uACE0\uB974\uC138\uC694.</p><p>\uC774\uBC88 \uC9C4\uD589 \uC911\uC5D0\uB294 \uCDE8\uC18C/\uACC4\uD68D\uC911\uB2E8\uC744 \uC0C8\uB85C \uACE0\uB974\uC9C0 \uC54A\uB294 \uAC83\uC73C\uB85C \uCC98\uB9AC\uD569\uB2C8\uB2E4. \uB3C4\uCC29 \uB4A4 \uBBF8\uCCB4\uACB0 \uCDE8\uC18C\uB294 \uACC4\uC18D \uAC00\uB2A5\uD558\uBA70 \uBC18\uD658 \uD604\uAE08\uC740 \uC989\uC2DC \uC794\uACE0\uB85C \uB3CC\uC544\uC624\uC9C0\uB9CC \uC0C8 \uD22C\uC790\uC8FC\uBB38 \uC2DC\uAC04\uD45C\uB294 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.</p>" + (CAREER_TRIAL ? "" : "<p>\uBCF8\uD3B8 \uCDE8\uC5C5 \uACBD\uB85C\uC5D0\uC11C\uB294 \uB274\uC2A4 \uD134\uC5D0 \uC608\uC57D \uC8FC\uBB38\uC744 \uC811\uC218\uD560 \uC218 \uC788\uC9C0\uB9CC, \uBB36\uC74C\uC9C4\uD589 \uC911\uC5D0\uB294 \uC608\uC57D \uC8FC\uBB38\uB3C4 \uC0C8\uB85C \uC811\uC218\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uB2E4\uC2DC \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>");
      box.innerHTML = "";
      const yes = document.createElement("button");
      yes.id = "career-batch-confirm";
      yes.textContent = "\uACC4\uD68D\uB300\uB85C \uBB36\uC74C\uC9C4\uD589 \xB7 \uACBD\uACC4\uC5D0\uC11C \uBA48\uCD94\uAE30";
      yes.onclick = commitCareerBatch;
      const no = document.createElement("button");
      no.id = "career-batch-back";
      no.textContent = "\uCDE8\uC18C \xB7 \uD558\uB098\uC529 \uC77D\uC73C\uBA70 \uC9C4\uD589";
      no.onclick = () => render();
      box.append(yes, no);
      renderPortfolio();
    }
    function commitCareerBatch() {
      if (storageReadBlocked || storageWriteBlocked || !careerBatchAllowed()) return;
      const from = state.month, rows = [], fillsBefore = (state.fillsLog || []).length, historyBefore = state.history.length;
      let steps = 0, reason = "\uACBD\uACC4";
      while (steps < 1e3) {
        if (propertyActive() && state.history.slice(historyBefore).some((h) => /^property-(buy|sell)-settled:/.test(h.choice || ""))) {
          reason = "\uC8FC\uD0DD \uACC4\uC57D \uC815\uC0B0";
          break;
        }
        const t = nextTurn(), td = turnEffDate(t);
        effDate = td.date;
        effPostClose = td.postClose;
        tryFillOrders();
        const fills = (state.fillsLog || []).length - fillsBefore;
        const expiries = state.history.slice(historyBefore).filter((h) => typeof h.choice === "string" && h.choice.startsWith("order-expired:")).length;
        if (fills || expiries) {
          reason = "\uC8FC\uBB38\uBCC0\uD654";
          break;
        }
        if (t.settlement) {
          reason = "\uBD84\uAE30 \uC815\uC0B0";
          break;
        }
        if (!["news", "quiet"].includes(t.kind) || state.flags.gameOver || state.month > GAME_END) {
          reason = t.kind;
          break;
        }
        const prior = state.month;
        if (t.kind === "news") {
          const ev = t.event;
          rows.push({ id: ev.id, date: ev.date });
          state.eventIndex++;
          state.turnCount++;
          const next = DATA.events[state.eventIndex], lev = nextLifeEvent();
          if (!(next && next.date.slice(0, 7) <= state.month) && !(lev && lev.date.slice(0, 7) <= state.month && (!next || lev.date <= next.date)) && !settlementDue() && state.month <= GAME_END) advanceMonth();
          state.history.push({ month: state.month, sourceMonth: prior, choice: "career-news-auto:" + ev.id });
        } else {
          advanceMonth();
          state.turnCount++;
        }
        if (storageWriteBlocked || storageReadBlocked || multiTabConflict) return;
        steps++;
      }
      if (steps === 1e3) reason = "\uC548\uC804\uC0C1\uD55C";
      state.careerNewsBatch = { version: 1, from, to: state.month, steps, reason, news: rows };
      state.history.push({ month: state.month, decisionMonth: from, choice: "career-batch:" + steps });
      if (save()) render();
    }
    function careerBatchReportHtml() {
      const r = state.careerNewsBatch;
      if (!(CAREER_TRIAL || SCHOOL_MODE && !CASH_MODE && state.batchRules === 1) || !r || r.version !== 1 || !Array.isArray(r.news) || r.news.length > 1e3 || !r.news.every((e) => e && typeof e.id === "string" && typeof e.date === "string" && /^\d{4}-\d{2}(?:-\d{2})?$/.test(e.date)) || !/^\d{4}-\d{2}$/.test(r.from) || !/^\d{4}-\d{2}$/.test(r.to) || typeof r.reason !== "string" || r.from > r.to || r.to > state.month || r.news.some((e) => e.date.slice(0, 7) < r.from || e.date.slice(0, 7) > r.to)) return "";
      const rows = r.news.map((e) => {
        const ev = DATA.events.find((x, i) => i < state.eventIndex && x.id === e.id && x.date === e.date && x.kind === "news");
        if (!ev) return "<li>" + esc(e.date) + " \xB7 \uD604\uC7AC \uC790\uB8CC\uC640 \uAC19\uC740 \uC9C0\uB09C \uB274\uC2A4\uC778\uC9C0 \uBBF8\uD655\uC778 (\uB0B4\uC6A9 \uD45C\uC2DC \uC548 \uD568)</li>";
        const timing = ev.event_month ? " \xB7 \uC0AC\uAC74\uC6D4 " + ev.event_month + " / \uC815\uD655\uC77C \uBBF8\uD655\uC778" : ev.event_date ? " \xB7 \uC0AC\uAC74\uC77C " + ev.event_date : "";
        return '<li><details class="batch-news-review"><summary>' + esc(e.date) + " \xB7 " + esc(ev.card_title) + '</summary><p class="muted">\uC9C0\uB09C \uAC8C\uC784\uCE74\uB4DC \uB2E4\uC2DC \uBCF4\uAE30 \xB7 \uB178\uCD9C\uC77C ' + esc(e.date + timing) + "</p><p>" + esc(ev.card_summary || "\uC694\uC57D \uC5C6\uC74C") + "</p>" + (ev.historical_reconstruction ? '<p class="muted">\uC5ED\uC0AC \uC7AC\uAD6C\uC131 [\uC2DC\uC5F0]: \uB2F9\uC2DC \uAE30\uC0AC \uC6D0\uBB38 \uBBF8\uD655\uBCF4. \uD6C4\uB144 \uAE30\uB85D\uC744 \uBC14\uD0D5\uC73C\uB85C \uD55C \uCE74\uB4DC\uC774\uBA70 \uC815\uD655\uD55C \uB2F9\uC2DC \uBCF4\uB3C4\uC2DC\uAC01\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' : "") + sourceDetails(ev) + "</details></li>";
      }).join("");
      return '<details class="career-batch-report"><summary>\uB9C8\uC9C0\uB9C9 \uACC4\uD68D\uD615 \uBB36\uC74C\uC9C4\uD589 \xB7 ' + esc(r.from) + " \u2192 " + esc(r.to) + " \xB7 " + esc(r.reason) + " \uBA48\uCDA4 \xB7 \uB274\uC2A4 " + r.news.length + "\uAC74</summary><p>\uC774\uBBF8 \uC9C0\uB098\uAC04 \uAC8C\uC784\uB274\uC2A4 \uC790\uB3D9\uD655\uC778 \uBAA9\uB85D\uC785\uB2C8\uB2E4. \uC9C1\uC811 \uD22C\uC790\uD310\uB2E8\xB7\uAE30\uC0AC \uC6D0\uBB38 \uC2E4\uB3C5\uC758 \uAE30\uB85D\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC790\uB8CC\uC758 \uC0AC\uAC74\uC77C/\uB178\uCD9C\uC77C \uAD6C\uBD84\uC740 \uAC1C\uBCC4 \uB274\uC2A4\uC758 \uAE30\uC874 \uD45C\uAE30\uB97C \uB530\uB985\uB2C8\uB2E4. \uC55E\uC73C\uB85C\uC758 \uB274\uC2A4\xB7\uCCB4\uACB0\uC77C\uC744 \uBCF4\uC5EC\uC8FC\uB294 \uBBF8\uB9AC\uBCF4\uAE30\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC81C\uBAA9\uC744 \uC5F4\uC5B4 \uC9C0\uB09C \uCE74\uB4DC \uC694\uC57D\uACFC \uADFC\uAC70 \uBC94\uC704\uB97C \uB2E4\uC2DC \uBCFC \uC218 \uC788\uC5B4\uC694. \uC5F4\uB78C\uB9CC\uC73C\uB85C \uC6D4\xB7\uD134\xB7\uC790\uAE08\xB7\uC8FC\uBB38\xB7\uC790\uB3D9\uD655\uC778 \uAE30\uB85D\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB9C8\uC9C0\uB9C9 \uBB36\uC74C \uD55C \uBC88\uB9CC \uD45C\uC2DC\uD558\uBA70 \uC804\uCCB4 \uB274\uC2A4 \uBCF4\uAD00\uD568\uC740 \uC544\uB2D9\uB2C8\uB2E4.</p>" + (rows ? "<ol>" + rows + "</ol>" : "<p>\uC774\uBC88 \uBB36\uC74C\uC5D0\uC11C \uC790\uB3D9\uD655\uC778\uD55C \uC5F0\uACB0\uB274\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uC2DC\uC7A5\uC5D0 \uC0AC\uAC74\uC774 \uC5C6\uC5C8\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4.</p>") + "</details>";
    }
    function careerCashRecovery(product) {
      if (!CAREER_TRIAL || state.flags.career !== "job" || state.flags.gameOver || state.month > GAME_END || storageReadBlocked || storageWriteBlocked) return null;
      const u = productRule(product), h = state.holdings[product];
      if (!u || u.rule !== "accrual" || !h || !Number.isFinite(h.qty) || h.qty <= 0 || !Number.isFinite(h.avgPrice) || h.avgPrice <= 0) return null;
      const value = holdingValue(product, h, state.month);
      if (!Number.isFinite(value) || value <= 0) return null;
      return { product, name: u.name, value, signature: JSON.stringify([state.month, state.cash, h]) };
    }
    function renderCareerCashRecovery(product) {
      const r = careerCashRecovery(product);
      if (!r) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uAE30\uC874 \uC608\uCE58\uC790\uAE08 \uD68C\uC218 \uAC80\uD1A0</div><h2>" + esc(r.name) + "\uC744 \uD604\uAE08\uC73C\uB85C \uB3CC\uB9B4\uAE4C</h2><p>\uD604\uC7AC \uC774\uC790\uB204\uC801 \uC2DC\uC5F0 \uC794\uC561 " + r.value.toLocaleString() + "\uC6D0 \uC911 \uC808\uBC18 \uB610\uB294 \uC804\uC561\uC744 \uC9C0\uAE08 \uD604\uAE08\uC73C\uB85C \uB3CC\uB9BD\uB2C8\uB2E4. \uC2E4\uC81C \uC608\uAE08\xB7\uCC44\uAD8C\uC758 \uB9E4\uB3C4/\uC911\uB3C4\uD574\uC9C0 \uC815\uCC45\xB7\uC218\uC218\uB8CC\xB7\uC6D0\uAE08\uBCF4\uC7A5 \uD310\uC815\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAE30\uC874 \uAC8C\uC784\uC758 \uC6D0\uD654 \uC774\uC790\uB204\uC801 \uC0C1\uD488\uB9CC \uB300\uC0C1\uC73C\uB85C \uD558\uACE0 \uC678\uD654\uC608\uAE08\xB7\uAC00\uACA9\uD615 \uC790\uC0B0\uC740 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p>\uD604\uAE08 \uD68C\uC218\uC640 \uC0C8 \uD22C\uC790\uB294 \uBCC4\uAC1C\uC785\uB2C8\uB2E4. \uB274\uC2A4\xB7\uD604\uC7AC \uC6D4\xB7\uD134\uC218\xB7\uBD84\uAE30\uC815\uC0B0\xB7\uC21C\uC800\uCD95\xB7\uC774\uBBF8\uAE30\uB85D\uB41C \uC774\uC790\uB97C \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD68C\uC218\uD55C \uBE44\uC911\uC740 \uC774\uD6C4 \uC6D4\uC9C4\uD589 \uB54C \uC608\uCE58\uC774\uC790\uAC00 \uBD99\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uC0C1\uD488\uC758 \uC0C8 \uC8FC\uBB38\uC740 \uC5EC\uC804\uD788 \uC5F4\uB9B0 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uBD84\uAE30 \uBC16 \uD68C\uC218\uB294 \uC815\uC0B0\uC744 \uC0C8\uB85C \uC5F4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
      box.innerHTML = "";
      for (const percent of [50, 100]) {
        const amount = Math.round(r.value * percent / 100), b = document.createElement("button");
        b.dataset.recoveryPercent = String(percent);
        b.textContent = percent + "% \uD68C\uC218 \xB7 " + amount.toLocaleString() + "\uC6D0 \uD604\uAE08\uC73C\uB85C";
        b.disabled = amount <= 0;
        b.onclick = () => commitCareerCashRecovery(product, percent, r.signature);
        box.append(b);
      }
      const no = document.createElement("button");
      no.id = "career-recovery-back";
      no.textContent = "\uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      no.onclick = () => render();
      box.append(no);
      renderPortfolio();
    }
    function commitCareerCashRecovery(product, percent, signature) {
      const r = careerCashRecovery(product);
      if (!r || r.signature !== signature || ![50, 100].includes(percent)) return;
      const amount = Math.round(r.value * percent / 100);
      if (amount <= 0) return;
      const h = state.holdings[product], fraction = percent / 100;
      const cost = h.invested != null ? Math.round(h.invested * fraction) : Math.round(h.avgPrice * h.qty * fraction);
      if (percent === 100) delete state.holdings[product];
      else {
        h.qty = Math.max(0, h.qty - amount / h.avgPrice);
        if (h.invested != null) h.invested -= cost;
        if (h.qty <= 1e-12) delete state.holdings[product];
      }
      state.cash += amount;
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "career-cash-recovery:" + product + ":" + percent, amount, costBasis: cost });
      if (save()) render();
    }
    function careerPlanCanSet(percent) {
      return cashPlanActive() ? cashPlanCanSet(percent) : !CAREER_TRIAL || percent === 0 || !!nextTurn().settlement;
    }
    function schoolTrialNote(short = false) {
      if (short) return '<p class="note school-trial-note">\uC0DD\uB144 \uACE01 \uB2EC\uB825 \uC2DC\uC791 \xB7 \uBCC4\uB3C4 \uC800\uC7A5 \xB7 \uAE08\uC561/\uC9C4\uD559/\uBCF5\uBB34\uB294 \uC784\uC758 \uC2DC\uD5D8\uAC00\uC815.1996-03 \uC804 \uB9E4\uB9E4 \uCC28\uB2E8, \uC774\uD6C4\uB3C4 \uAE30\uC874 \uD76C\uC18C\uC790\uB8CC \uC2DC\uC5F0\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uC5ED\uC0AC\xB7\uC0DD\uD65C\uACBD\uC81C \uC644\uC131\uBCF8\uC774 \uC544\uB2D9\uB2C8\uB2E4.</p>';
      return '<p class="note school-trial-note">\uC0DD\uB144 \uACE01 \uB2EC\uB825 \uC2DC\uC791(\uBCF8\uD3B8) - \uD1B5\uC0C1\uC9C4\uAE09\uC758 \uD559\uB144\uC744 \uACC4\uC0B0\uD588\uC73C\uBA70 \uAC1C\uC778 \uD559\uC801\xB7\uC2E4\uC81C \uAC1C\uD559\uC77C\uC740 \uC544\uB2D9\uB2C8\uB2E4.1996-03 \uC804\uC740 \uC77C\uBD80 \uC120\uD0DD \uB274\uC2A4\uB9CC \uC5F0\uACB0\uD588\uACE0 \uC0C1\uD488\uC811\uADFC\xB7\uAC00\uACA9 \uADFC\uAC70\uAC00 \uBD80\uC871\uD574 \uB9E4\uB9E4\uB97C \uB9C9\uC558\uC2B5\uB2C8\uB2E4. \uC0C8 \uB274\uC2A4\uB294 \uAE30\uC874 \uC9C4\uD589\uC744 \uB418\uAC10\uC544 \uC7AC\uC0DD\uD558\uC9C0 \uC54A\uC544\uC694. 1996-03 \uC774\uD6C4\uB3C4 \uAE30\uC874 \uD76C\uC18C\xB7\uC77C\uBD80 \uBBF8\uAC80\uC99D\uC790\uB8CC \uC2DC\uC5F0\uC785\uB2C8\uB2E4. \uC2DC\uC791100\uB9CC\uC6D0\uACFC \uACBD\uC81C\xB7\uC9C4\uD559/\uBCF5\uBB34 \uC77C\uC815\uC740 \uC784\uC758 \uC2DC\uD5D8\uAC00\uC815\uC774\uBA701990\uB144\uB300 \uC0DD\uD65C\uACBD\uC81C \uACE0\uC99D\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC790\uC0B0\uBD84\uD574\uB294 \uC774 \uC2DC\uC791\uC6D4 \uAE30\uC900\uC73C\uB85C \uACC4\uC0B0\uD558\uBA70, \uAE30\uB85D\uC774 \uC628\uC804\uD558\uC9C0 \uC54A\uC740 \uAE30\uC874 \uC800\uC7A5\uC740 \uCD94\uC815 \uBCC0\uD658\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. <a href="?start=classic">\uC774\uC804 1996 \uACE0\uC815 \uC2DC\uC791(\uD074\uB798\uC2DD)\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30</a></p>';
    }
    function previousLifeBridgeHtml(lives) {
      if (!SCHOOL_MODE || CASH_MODE || CAREER_TRIAL || !Array.isArray(lives) || !lives.length) return "";
      const l = lives.at(-1), cause = { "natural-end": "\uC804\uCCB4 \uAD6C\uAC04 \uC885\uB8CC", "voluntary-end": "\uC120\uD0DD\uC73C\uB85C \uC911\uB3C4 \uB9C8\uCE68", "chaos": "\uCE74\uC624\uC2A4 \uD55C\uACC4 \uB3C4\uB2EC", "demo-end": "\uC2DC\uC81C\uD488 \uAD6C\uAC04 \uC885\uB8CC", "living-fail": "\uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 \uC885\uB8CC" };
      const ended = /^\d{4}-\d{2}$/.test(l.ended || "") ? l.ended : "\uC885\uB8CC\uC6D4 \uBBF8\uAE30\uB85D";
      const total = Number.isFinite(l.totalAssets) ? l.totalAssets.toLocaleString() + "\uC6D0" : "\uAE08\uC561 \uD655\uC778 \uD544\uC694";
      const net = cashRecordScore(l);
      return '<section class="previous-life-bridge" aria-label="\uC9C0\uB09C \uD68C\uADC0\uC5D0\uC11C \uB2E4\uC74C \uD68C\uADC0\uB85C"><h3>\uD55C \uC0B6\uC744 \uB0A8\uAE30\uACE0, \uB2E4\uC2DC \uACE01\uB85C</h3><p>\uB9C8\uC9C0\uB9C9 \uBCF4\uAD00 \uAE30\uB85D #' + lives.length + " \xB7 " + esc(ended) + " \xB7 " + esc(cause[l.cause] || "\uC885\uB8CC \uC0AC\uC720 \uBBF8\uAE30\uB85D") + "</p><p>\uAE30\uB85D \uCD1D\uC790\uC0B0 " + total + (net !== null ? " / \uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0 " + net.toLocaleString() + "\uC6D0" : "") + '</p><p class="note">\uBCF4\uAD00\uB41C \uACB0\uACFC\uB97C \uC77D\uAE30\uB9CC \uD569\uB2C8\uB2E4. \uC0C8 \uD68C\uADC0\uB294 \uC544\uB798\uC5D0\uC11C \uC0DD\uB144\uC6D4\uACFC \uADDC\uCE59\uC5D0 \uB3D9\uC758\uD55C \uB4A4 \uBCC4\uB3C4 \uC2DC\uC791\uC790\uAE08\uC73C\uB85C \uC2DC\uC791\uD558\uBA70, \uC9C0\uB09C \uC790\uC0B0\xB7\uBBF8\uB0A9\xB7\uC8FC\uBB38\xB7\uD559\uC801\xB7\uBCF5\uBB34\uB97C \uC774\uC5B4\uBC1B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC9C0\uB09C \uAE30\uB85D\uC740 \uB0A8\uACE0, \uC0C8 \uD68C\uADC0\uAC00 \uB05D\uB0A0 \uB54C \uAE30\uC874 \uBCF4\uAD00 \uC815\uCC45\uC5D0 \uB530\uB77C \uC55E\uC120 \uC6D4\uBCC4 \uC0C1\uC138\uAC00 \uC694\uC57D\uB429\uB2C8\uB2E4. \uB2E4\uB978 \uC870\uAC74\uC758 \uACB0\uACFC\uB85C \uD22C\uC790 \uC2E4\uB825\uC774\uB098 \uC9C4\uB85C\uC758 \uC6B0\uC5F4\uC744 \uD310\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><button type="button" id="previous-life-review">\uC9C0\uB09C \uD68C\uADC0 \uAE30\uB85D \uC77D\uAE30</button></section>';
    }
    function renderBirthSelect() {
      if (GAME_LIVING) {
        renderGameLivingStart();
        return;
      }
      vnScene("life");
      if (SCHOOL_MODE) {
        document.querySelector("header p").textContent = CAREER_TRIAL ? "\uACC4\uD68D\uD615 \uCDE8\uC5C5 / \uB300\uC751\uD615 \uC804\uC5C5 \xB7 \uBCC4\uB3C4 \uC2DC\uC81C\uD488 \xB7 \uAE30\uC874 \uC800\uC7A5 \uBBF8\uBCC0\uACBD" : SCHOOL_CASH_MODE ? "\uACE01 \uB2EC\uB825 + \uD604\uAE08\uC0AC\uAC74 \uC5F0\uACB0 \uC2DC\uD5D8 \xB7 \uC0C8 \uC800\uC7A5\uD0A4 \xB7 \uBAA8\uB4E0 \uAE08\uC561 \uC784\uC758\uAC12" : "\uC0DD\uB144 \uACE01 \uB2EC\uB825 \uC2DC\uC791(\uBCF8\uD3B8) \xB7 \uC0DD\uB144\uC6D4\uBCC4 \uC800\uC7A5 \xB7 \uC5ED\uC0AC\uC790\uB8CC/\uC0DD\uD65C\uACBD\uC81C/\uC0C1\uD488\uC811\uADFC \uACE0\uC99D \uBBF8\uC644\uC131";
      }
      const card = document.getElementById("turn-card");
      const box = document.getElementById("choices");
      box.innerHTML = "";
      card.innerHTML = '<div class="date">\uD68C\uADC0 \uC2DC\uC791</div><h2>\uC8FC\uC778\uACF5\uC758 \uC0DD\uB144\uC6D4</h2>' + (SCHOOL_MODE ? "<p>\uC0DD\uB144\uC6D4\uB85C \uD1B5\uC0C1\uC9C4\uAE09 \uACE01 \uD559\uB144\uC744 \uACC4\uC0B0\uD569\uB2C8\uB2E4. \uC61B \uCDE8\uD559\uAE30\uC900\uC7581\xB72\uC6D4\uC0DD \uB3D9\uAE30 \uAD6C\uBD84\uC7402002\uB144\uC0DD\uAE4C\uC9C0 \uC801\uC6A9\uD569\uB2C8\uB2E4.2009\uD559\uB144\uB3C4\uBD80\uD130\uC758 \uBCC0\uACBD\uC740 \uBCC4\uB3C4\uB85C \uACC4\uC0B0\uD558\uBA70, \uAC1C\uC778\uC758 \uC720\uC608\xB7\uC870\uAE30\uC785\uD559 \uC774\uB825\uC744 \uD655\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>" : "<p>\uC0DD\uB144\uC6D4\uC774 \uACE01 \uC2DC\uC791 \uC5F0\uB3C4\uB97C \uC815\uD569\uB2C8\uB2E4. 2008\uD559\uB144\uB3C4\uAE4C\uC9C0 \uCD08\uB4F1 \uCDE8\uD559 \uAE30\uC900\uC77C\uC774 3\uC6D4 1\uC77C\uC774\uB77C, 1\xB72\uC6D4\uC0DD\uC740 \uC804 \uD574 \uCD9C\uC0DD\uC544\uC640 \uD568\uAED8 1\uB144 \uC77C\uCC0D \uC785\uD559\uD588\uC5B4\uC694(\uBE60\uB978\uB144\uC0DD, 2009\uD559\uB144\uB3C4 \uD3D0\uC9C0).</p>") + '<div class="birth-controls"><label for="by">\uD0DC\uC5B4\uB09C \uD574<select id="by"></select></label><label for="bm">\uD0DC\uC5B4\uB09C \uB2EC<select id="bm"></select></label></div><p class="note" id="birth-precision-note">\uC77C\uC790\uB294 \uBC1B\uC9C0 \uC54A\uB294 \uC6D4 \uB2E8\uC704 \uC2DC\uC5F0\uC774\uC5D0\uC694. \uC815\uD655\uD55C \uC0DD\uC77C\uC5D0 \uB530\uB978 \uBC95\uC815 \uB098\uC774\xB7\uADFC\uB85C \uC790\uACA9\uC744 \uD310\uC815\uD558\uC9C0 \uC54A\uC544\uC694.</p><p class="note" id="hs-preview" role="status" aria-live="polite"></p>' + (CASH_MODE ? '<div class="cash-model-intro"><h3>\uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 \uD68C\uADC0 [\uBAA8\uB4E0 \uAE08\uC561 \uC784\uC758\uAC12]</h3><p>\uAE30\uC874 \uC800\uC7A5\xB7\uD68C\uADC0\uAE30\uB85D\uACFC \uB2E4\uB978 \uD0A4\uC5D0 \uC0C8\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4. \uAE30\uC874 \uC6D4 \uC21C\uC800\uCD95\uC740 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC544\uC694. \uC2DC\uC791100\uB9CC\uC6D0, \uB9E4\uC6D4 \uC0DD\uD65C \uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0(\uBCF5\uBB34 \uC911\uB3C4 \uB3D9\uC77C), \uC2DC\uD5D8\uC218\uC785\uC740 \uACE0\uAD50 \uC54C\uBC14\xB7\uC878\uC5C5\uCDE8\uC5C5 \uC6D430\uB9CC\uC6D0/\uADF8 \uC6780\uC6D0\uC785\uB2C8\uB2E4. \uCD5C\uCD08 \uB300\uD559 \uC7AC\uD559\uC6D4 \uC9C4\uD589\uC5D0 \uD559\uBE44 \uAC00\uC0C1\uCCAD\uAD6C80\uB9CC\uC6D0\uC744 \uD55C \uBC88 \uB0C5\uB2C8\uB2E4. \uC2E4\uC81C \uD559\uAD50\xB7\uAE09\uC5EC\xB7\uACF5\uC81C\xB7\uD559\uC801\uADDC\uC815\uC774 \uC544\uB2C8\uC5D0\uC694.</p><p>\uC218\uC785\uC740 \uC6D4 \uC9C4\uD589 \uB54C \uD55C \uBC88 \uC785\uAE08\uD558\uACE0 \uCCAD\uAD6C\uB97C \uC120\uD0DD \uC804\uC5D0 \uBCF4\uC5EC\uC918\uC694. \uC804\uC561 \uB0A9\uBD80 \uB610\uB294 \uBA85\uC2DC \uBCF4\uB958\uB97C \uACE0\uB985\uB2C8\uB2E4. \uBD80\uC871\uD558\uBA74 \uB0A9\uBD80\uB294 \uB9C9\uACE0 \uBBF8\uB0A9\uC744 \uB0A8\uACA8\uC694. \uBCF4\uB958\uB294 \uD559\uC801\uC5F0\uAE30\uB098 \uCC44\uBB34\uBA74\uC81C\uB97C \uB73B\uD558\uC9C0 \uC54A\uC73C\uBA70 \uC774 \uC2DC\uD5D8\uC5D0\uC11C\uB294 \uC7AC\uD559 \uC77C\uC815\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC544\uC694. \uBBF8\uB0A9\uC740 \uCD1D\uC790\uC0B0\uACFC \uB530\uB85C \uD45C\uC2DC\uD558\uACE0 \uB4A4\uC5D0 \uB2E4\uC2DC \uB0BC \uC218 \uC788\uC5B4\uC694. \uC790\uB3D9\uB300\uCD9C\xB7\uB9E4\uB3C4\xB7\uAC00\uC871\uC1A1\uAE08\uC740 \uC5C6\uC5B4\uC694. \uC804\uCCB4 \uC0DD\uACC4\xB7\uC7A5\uD559\xB7\uD658\uAE09 \uBAA8\uD615\uC774 \uC544\uB2CC \uCD5C\uC18C\uC5F0\uACB0 \uC2DC\uD5D8\uC785\uB2C8\uB2E4.</p><label><input id="cash-consent" type="checkbox"> \uC774 \uC784\uC758 \uC2DC\uD5D8\uAC00\uC815\uACFC \uBCC4\uB3C4 \uC800\uC7A5\uC73C\uB85C \uC0C8 \uD68C\uADC0 \uC2DC\uC791\uC5D0 \uB3D9\uC758</label><p><a href="?start=classic">\uAE30\uC874 \uC2DC\uD5D8\uC21C\uC800\uCD95 \uD68C\uADC0(\uD074\uB798\uC2DD)\uB85C \uB3CC\uC544\uAC00\uAE30</a></p></div>' : '<p><a id="cash-mode-entry" href="?start=classic&amp;economy=cash-events-trial">\uAE30\uC874 \uC800\uC7A5\uC744 \uADF8\uB300\uB85C \uB450\uACE0 \uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 \uD68C\uADC0 \uBCF4\uAE30</a></p>') + (!GAME_LIVING ? '<p><a id="game-living-entry" href="?economy=game-living-2019q3">2019Q3 \uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8(\uBCC4\uB3C4 \uC800\uC7A5 \xB7 \uBA85\uC2DC \uAC8C\uC784\uAC12) \uBCF4\uAE30</a></p>' : "");
      if (SCHOOL_CASH_MODE) card.innerHTML += '<div class="school-cash-intro"><h3>\uACE01 \uB2EC\uB825\uACFC \uD604\uAE08\uC0AC\uAC74 \uC5F0\uACB0 [\uBAA8\uB4E0 \uAE08\uC561 \uC784\uC758\uAC12]</h3><p>\uAE30\uC874 \uAE30\uBCF8\xB7\uD604\uAE08\xB7\uACE01 \uBAA8\uD615\uC758 \uC5EC\uC12F \uC800\uC7A5\uD0A4\uB97C \uC77D\uC5B4 \uC62E\uAE30\uAC70\uB098 \uBCC0\uD658\uD558\uC9C0 \uC54A\uACE0 \uB450 \uC0C8 \uD0A4\uC5D0 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uACE01 \uC120\uD0DD\uC6D4\uC5D0\uB294 \uCCAD\uAD6C\uAC00 \uC5C6\uACE0 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC218\uC785\xB7\uC0DD\uD65C \uAC00\uC0C1\uCCAD\uAD6C\uB97C \uD55C \uBC88\uC529 \uB9CC\uB4ED\uB2C8\uB2E4. \uC2E4\uC81C \uC5ED\uC0AC \uAE09\uC5EC\xB7\uD559\uBE44\xB7\uBBF8\uC131\uB144 \uAC00\uC785\uC870\uAC74\uC774\uB098 \uBCF5\uBB34\uADDC\uCE59\uC774 \uC544\uB2D9\uB2C8\uB2E4.1996-03 \uC804 \uB9E4\uB9E4\uCC28\uB2E8\uC740 \uADF8\uB300\uB85C\uC774\uBA70 \uD604\uAE08\uC774 \uC788\uC5B4\uB3C4 \uD574\uC81C\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC785\uB300 \uC120\uD0DD\uC6D4\uC740 \uC774\uBBF8 \uC0DD\uC131\uD55C \uD604\uAE08\uC0AC\uAC74\uC744 \uB2E4\uC2DC \uACC4\uC0B0\uD558\uC9C0 \uC54A\uACE0 \uB2E4\uC74C \uC6D4\uBD80\uD130 \uBCF5\uBB34 \uC911 \uC218\uC7850\uC6D0\uC744 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uC544\uB798 \uB450 \uB3D9\uC758 \uBAA8\uB450 \uD544\uC694\uD569\uB2C8\uB2E4.</p></div>';
      if (SCHOOL_MODE) card.innerHTML += careerTrialNote(true) + schoolTrialNote() + '<label class="birth-consent"><input id="school-consent" type="checkbox"> ' + (CAREER_TRIAL ? "\uC774 \uACC4\uD68D\uD615/\uB300\uC751\uD615 \uC2DC\uD5D8\uADDC\uCE59\xB7\uC790\uB8CC\uACF5\uBC31\xB7\uC784\uC758\uAC12\xB7\uBCC4\uB3C4 \uC800\uC7A5\uC73C\uB85C \uC2DC\uC791\uC5D0 \uB3D9\uC758" : "\uC774 \uC790\uB8CC\uACF5\uBC31\xB7\uC784\uC758\uAC12\xB7\uBCC4\uB3C4 \uC800\uC7A5\uC73C\uB85C \uC0DD\uB144 \uACE01 \uB2EC\uB825 \uC2DC\uC791(\uBCF8\uD3B8)\uC5D0 \uB3D9\uC758") + "</label>";
      else if (!CASH_MODE) card.innerHTML += '<p><a id="school-mode-entry" href="./">\uC0DD\uB144\uC6D4\uBCC4 \uACE01 \uB2EC\uB825 \uC2DC\uC791(\uBCF8\uD3B8)\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30</a></p>';
      if (!SCHOOL_CASH_MODE) card.innerHTML += '<p><a id="school-cash-mode-entry" href="?economy=cash-events-trial">\uAE30\uC874 \uC5EC\uC12F \uC800\uC7A5\uD0A4\uB97C \uADF8\uB300\uB85C \uB450\uACE0 \uACE01 \uB2EC\uB825+\uD604\uAE08\uC0AC\uAC74 \uC5F0\uACB0 \uC2DC\uD5D8 \uBCF4\uAE30</a></p>';
      if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) {
        const lives = readLives();
        if (!lives) return;
        const recap = previousLifeBridgeHtml(lives);
        if (recap) {
          card.insertAdjacentHTML("afterbegin", recap);
          document.getElementById("previous-life-review").onclick = () => renderDashboard();
        }
      }
      const by = document.getElementById("by"), bm = document.getElementById("bm");
      for (let y = 1975; y <= (SCHOOL_MODE ? 2010 : 1985); y++) {
        const o = document.createElement("option");
        o.value = y;
        o.textContent = y;
        if (y === 1980) o.selected = true;
        by.appendChild(o);
      }
      for (let m = 1; m <= 12; m++) {
        const o = document.createElement("option");
        o.value = m;
        o.textContent = m;
        if (m === 3) o.selected = true;
        bm.appendChild(o);
      }
      const prev = document.getElementById("hs-preview");
      function upd() {
        const y = Number(by.value), m = Number(bm.value);
        const hs = hsYear(y, m);
        if (SCHOOL_MODE) {
          const c = ReturnSchoolCalendar.startPlan(y, m);
          if (!c.ok) {
            prev.textContent = "\uC774 \uC0DD\uB144\uC6D4\uC740 2026-10 \uC885\uB8CC \uC804\uC5D0 \uACE01 \uD559\uB144\uB3C4\uAC00 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC544 \uC2DC\uC791\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (" + (c.reason || "\uACC4\uC0B0 \uBD88\uAC00") + ").";
            if (typeof goEl !== "undefined" && goEl) goEl.disabled = true;
            return;
          }
          if (typeof goEl !== "undefined" && goEl) goEl.disabled = !document.getElementById("school-consent")?.checked;
          prev.textContent = "\uD1B5\uC0C1\uC9C4\uAE09 \uACE01 \uD559\uB144\uB3C4 \uC2DC\uC791 " + c.startMonth + " / \uACE0\uAD50 \uB9C8\uC9C0\uB9C9 \uD559\uB144 \uB9D0 " + c.calendar.highEnd + " / 2026-10\uAE4C\uC9C0 \uB2EC\uB825 " + c.calendarMonthsInclusive + "\uAC1C\uC6D4 (\uC2DC\uC791\uC6D4 \uB4A4 \uC6D4\uC804\uC774 " + c.monthlyTransitionsThroughEnd + "\uD68C). \uCDE8\uD559\uC720\uC608\xB7\uC6D4\uBC18\xB7\uD734\uD559\uC740 \uC774 \uACC4\uC0B0\uC5D0 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.2002\uB1441~2\uC6D4\uC0DD\uAE4C\uC9C0 \uC608\uC804 \uCDE8\uD559\uAE30\uC900\uC744 \uC801\uC6A9\uD558\uBA702003\uB144\uC0DD\uBD80\uD130\uB294 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC544\uC694.";
          return;
        }
        prev.textContent = "\uACE01 \uC2DC\uC791: " + hs + "\uB144" + (m <= 2 ? " (\uBE60\uB978\uB144\uC0DD \uC801\uC6A9 \u2014 " + (y - 1) + "\uB144\uC0DD\uACFC \uB3D9\uAE30)" : "") + ". \uACE01 \uC2DC\uC791 \uBD84\uAE30(\uACF5\uBD80 vs \uC54C\uBC14\xB7\uC804\uC5C5\uD22C\uC790), \uC9C4\uD559 \uD6C4 \uC7AC\uBD84\uAE30(\uCDE8\uC5C5 vs \uC804\uC5C5\uD22C\uC790), \uC785\uB300 \uC77C\uC815\uC774 \uC774 \uC0DD\uB144\uC5D0\uC11C \uC790\uB3D9 \uC0B0\uCD9C\uB3FC\uC694" + (hs < 1993 || hs > 2e3 ? " (\uC77C\uBD80 \uACE01 \uC77C\uC815\uC774 \uC2DC\uC791\uC6D4 1996-03 \uC774\uC804\uC774\uB77C \uC0DD\uB7B5\uB418\uAC70\uB098 \uC2DC\uC5F0\uC6A9 \uC774\uB825 \uC120\uD0DD\uC73C\uB85C \uB300\uCCB4\uB3FC\uC694 [\uC2DC\uC5F0 \uC81C\uC57D])" : ".");
      }
      const go = document.createElement("button");
      let goEl = go;
      by.onchange = upd;
      bm.onchange = upd;
      upd();
      go.textContent = SCHOOL_CASH_MODE ? "\uACE01 \uB2EC\uB825+\uD604\uAE08\uC0AC\uAC74 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" : SCHOOL_MODE ? "\uC774\uC804 \uC2DC\uD5D8 \uC21C\uC800\uCD95 \uADDC\uCE59\uC73C\uB85C \uC0C8 \uC2DC\uC791" : "\uC774 \uC0DD\uB144\uC6D4\uB85C \uD68C\uADC0(\uD074\uB798\uC2DD 1996 \uACE0\uC815 \uC2DC\uC791)";
      const consentReady = () => (!SCHOOL_MODE || document.getElementById("school-consent").checked) && (!CASH_MODE || document.getElementById("cash-consent").checked);
      if (SCHOOL_MODE || CASH_MODE) {
        go.disabled = true;
        for (const id of ["school-consent", "cash-consent"]) {
          const el = document.getElementById(id);
          if (el) el.onchange = () => {
            go.disabled = !consentReady();
          };
        }
      }
      go.onclick = () => {
        if (!readLives()) return;
        if (CASH_MODE && !document.getElementById("cash-consent").checked) return;
        if (SCHOOL_MODE && !document.getElementById("school-consent").checked) return;
        const y = Number(by.value), m = Number(bm.value);
        if (SCHOOL_MODE) {
          const p = ReturnSchoolCalendar.startPlan(y, m);
          if (!p.ok) return;
          state.month = p.startMonth;
          state.schoolStart = { version: 1, startMonth: p.startMonth };
          state.assetReviewBaseline = { version: 1, source: "new-game", month: p.startMonth, totalAssets: 1e6 };
          state.eventIndex = DATA.events.findIndex((e) => e.date.slice(0, 7) >= p.startMonth);
          if (state.eventIndex < 0) state.eventIndex = DATA.events.length;
        }
        state.flags.birth = { year: y, month: m, hsYear: hsYear(y, m) };
        if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) state.flags.academicTrackV1 = true;
        if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) state.acadRules = 3;
        if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) state.coreRules = 4;
        if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) state.batchRules = 1;
        if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) {
          state.jobPlanProductRules = 1;
          state.directionConditionRules = 1;
        }
        state.resetRules = 1;
        state.assetTrail = [];
        state.livingScenarioRules = 1;
        Object.assign(currentRecordIdentity, legacyIdentityFields);
        state.recordContext = ReturnRecordContext.begin(currentRecordIdentity);
        save();
        render();
      };
      if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) {
        const ccNote = document.createElement("p");
        ccNote.className = "note";
        ccNote.textContent = "\uC0C8 \uACBD\uC81C \uC2DC\uC81C [\uAC8C\uC784 \uC124\uACC4\uAC12 \xB7 \uC2E4\uC81C \uAE09\uC5EC/\uBB3C\uAC00/\uD559\uBE44 \uC544\uB2D8]: \uC2E0\uADDC \uD68C\uADC0\uC758 \uC131\uC778 \uC54C\uBC14\uB294 \uC6D4 \uC218\uC78520\uB9CC\uC6D0 \uB300\uC2E0 \uD55C \uB2EC \uC218\uB3D9 \uD22C\uC790\uD310\uB2E81\uD68C, \uC804\uC5C5\uC740 \uC218\uC7850\uC6D0 \uB300\uC2E0 \uB9E4 \uD310\uB2E8 \uAE30\uD68C\uC5D0 \uC8FC\uBB38\uD569\uB2C8\uB2E4. \uC2E4\uC81C \uADFC\uB85C\uC2DC\uAC04 \uD1B5\uACC4\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC2E0\uADDC \uD68C\uADC0\uB294 \uC0AC\uD68C\uC9C4\uCD9C \uD6C4 \uCDE8\uC5C5\xB7\uC804\uC5C5\xB7\uC54C\uBC14\uB97C \uBD84\uAE30\uB9C8\uB2E4 \uC7AC\uC120\uD0DD\uD560 \uC218 \uC788\uC73C\uBA70 \uD55C \uBD84\uAE30 \uC911 \uC655\uBCF5\uC740 \uB9C9\uC2B5\uB2C8\uB2E4. \uC7AC\uCDE8\uC5C5 \uB4A4\uC5D0\uB3C4 \uB2E4\uC2DC \uC804\uC5C5\uC744 \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC800\uC7A5\uC758 \uC77C\uBC29\uD5A5 \uADDC\uCE59\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.  \uC6D4\uBCC4 \uC218\uC785\xB7\uC0DD\uD65C\xB7\uD559\uBE44 \uC0AC\uAC74\uC774 \uD559\uC5C5\xB7\uC54C\uBC14\xB7\uCDE8\uC5C5\xB7\uC804\uC5C5\uC744 \uAD00\uD1B5\uD569\uB2C8\uB2E4. \uD559\uC0DD\xB7\uC7AC\uD559 \uC0DD\uD65C\uBE44 0\uC6D0(\uAC00\uC815 \uBD80\uC591 \uAC00\uC815), \uB3C5\uB9BD \uD6C4 \uC6D4 70\uB9CC, \uBCF5\uBB34 \uC911 \uC6D4 10\uB9CC, \uC54C\uBC14 \uC6D4 20\uB9CC, \uCDE8\uC5C5 \uAE09\uC5EC \uC6D4 150\uB9CC, \uC7AC\uD559 \uC911 3\xB79\uC6D4 \uD559\uBE44 90\uB9CC. \uBD80\uC871\uD558\uBA74 \uBBF8\uB0A9\uC73C\uB85C \uB0A8\uACE0 \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC73C\uBA70, \uBBF8\uB0A9\uC774 \uC788\uB294 \uB3D9\uC548 \uC0C8 \uB9E4\uC218 \uC8FC\uBB38 \uC811\uC218\uC640 \uBBF8\uB9AC \uB123\uC740 \uB9E4\uC218 \uC8FC\uBB38(\uC608\uC57D\xB7\uC870\uAC74\xB7\uBD84\uD560)\uC758 \uCCB4\uACB0\uC774 \uBAA8\uB450 \uBCF4\uB958\uB429\uB2C8\uB2E4(\uC0C1\uD658 \uD6C4 \uC7AC\uAC1C). \uC774 \uC0C8 \uD68C\uADC0\uB294 \uCE74\uC624\uC2A4 \uC18C\uC720\uB178\uCD9C v1\uB85C \uBBF8\uCCB4\uACB0 \uB9E4\uB3C4 \uC7A0\uAE08\uC794\uB7C9\uB3C4 \uBCF4\uC720 \uADDC\uBAA8\uC5D0 \uD3EC\uD568\uD569\uB2C8\uB2E4(\uB9E4\uC218 \uC608\uC57D\uAE08 \uC81C\uC678). \uAC19\uC740 \uBCF8\uD3B8 \uC800\uC7A5\uC601\uC5ED\uC5D0 \uC0C8 \uD68C\uADC0\uB85C \uC800\uC7A5\uB418\uBA70, \uAE30\uC874 \uC800\uC7A5\uC740 \uC6D0\uB798 \uBAA8\uD615\uC73C\uB85C \uC774\uC5B4\uC9C0\uACE0 \uACFC\uAC70 \uCE74\uC624\uC2A4\uB294 \uB2E4\uC2DC \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uCDE8\uC5C5 \uD6C4 \uC0DD\uD65C\xB7\uD559\uBE44 \uB0A9\uBD80\uC640 \uACFC\uAC70 \uBBF8\uB0A9 \uD574\uC18C \uB4A4 \uADF8\uB2EC \uC2E0\uADDC \uC5EC\uC720\uAE08\uC758 0/50/100%\uB97C \uAD6D\uB0B4\uC9C0\uC218\xB7\uB2EC\uB7EC\xB7\uB2EC\uB7EC\uC608\uAE08\uC73C\uB85C \uC608\uC57D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uACC4\uD68D\uC740 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC124\uC815\uD558\uACE0 \uC5B8\uC81C\uB4E0 \uB04C \uC218 \uC788\uC73C\uBA70 \uAE30\uC874 \uC608\uC57D\uC740 \uBCC4\uB3C4\uB85C \uB0A8\uC2B5\uB2C8\uB2E4.";
        box.appendChild(ccNote);
        const goCC = document.createElement("button");
        goCC.textContent = "\uC774 \uC0DD\uB144\uC6D4 \uACE01\uBD80\uD130 \uC2DC\uC791 \xB7 \uC218\uC785\xB7\uC0DD\uD65C\xB7\uD559\uBE44 \uC5F0\uACB0";
        goCC.id = "cash-main-start";
        goCC.disabled = true;
        const syncCC = () => {
          goCC.disabled = !consentReady();
        };
        for (const id of ["school-consent", "cash-consent"]) {
          const el = document.getElementById(id);
          if (el) {
            const prev2 = el.onchange;
            el.onchange = () => {
              if (prev2) prev2();
              syncCC();
            };
          }
        }
        goCC.onclick = () => {
          if (!readLives()) return;
          if (!document.getElementById("school-consent").checked) return;
          const y = Number(by.value), m = Number(bm.value);
          const p = ReturnSchoolCalendar.startPlan(y, m);
          if (!p.ok) return;
          state.economyModel = ReturnEconomyPolicy.descriptor("career-cash-events-v1");
          state.foreignFundScale = { version: 1, dataId: FUND_SCALE_DATA_ID };
          state.foreignEtfRules = 1;
          enableForeignProducts();
          state.propertyRules = 1;
          state.property = HomeContract.freshPropertyState();
          state.cashAllocationRules = 1;
          state.reservationSettlementRules = 1;
          state.chaosExposureRules = 1;
          state.cashEvents = { version: 1, rows: [] };
          state.careerCashRules = 3;
          state.cashPlanRules = 1;
          state.careerCycleRules = 1;
          state.decisionPaceRules = 1;
          state.albaTimeRules = 1;
          state.jobPlanProductRules = 1;
          state.directionConditionRules = 1;
          state.month = p.startMonth;
          state.schoolStart = { version: 1, startMonth: p.startMonth };
          state.assetReviewBaseline = { version: 1, source: "new-game", month: p.startMonth, totalAssets: 1e6 };
          state.eventIndex = DATA.events.findIndex((e) => e.date.slice(0, 7) >= p.startMonth);
          if (state.eventIndex < 0) state.eventIndex = DATA.events.length;
          state.flags.birth = { year: y, month: m, hsYear: hsYear(y, m) };
          state.flags.academicTrackV1 = true;
          state.acadRules = 3;
          state.coreRules = 4;
          state.batchRules = 1;
          state.resetRules = 1;
          state.assetTrail = [];
          state.livingScenarioRules = 1;
          if (!foreignFundScaleIdentityFields) return showSaveConflict("\uC0C8 \uD380\uB4DC\uC9D1\uC911\uB3C4 \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC2DC\uC791\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "foreign-fund-scale-identity");
          if (!cashIdentityFields) return showSaveConflict("\uC0C8 \uACBD\uC81C \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC2DC\uC791\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "cash-identity");
          if (!careerCycleIdentity()) return showSaveConflict("\uC9C4\uB85C \uC21C\uD658 \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC2DC\uC791\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "career-cycle-identity");
          if (!(foreignFundScaleActive() ? foreignFundScaleIdentity() : foreignActive() ? foreignIdentity() : propertyActive() ? propertyIdentity() : decisionPaceIdentity())) return showSaveConflict("\uC0C8 \uC18C\uC720\uB178\uCD9C \uADDC\uCE59 \uC2DD\uBCC4\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC2DC\uC791\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "chaos-exposure-identity");
          Object.assign(currentRecordIdentity, foreignFundScaleActive() ? foreignFundScaleIdentity() : foreignActive() ? foreignIdentity() : propertyActive() ? propertyIdentity() : decisionPaceIdentity());
          state.recordContext = ReturnRecordContext.begin(currentRecordIdentity);
          save();
          render();
        };
        box.appendChild(goCC);
      }
      box.appendChild(go);
      if (SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL) {
        const consent = document.querySelector(".birth-consent"), mainStart = document.getElementById("cash-main-start");
        const rules = document.createElement("section");
        rules.className = "birth-entry-rules";
        rules.setAttribute("aria-label", "\uC2DC\uC791 \uC804\uC5D0 \uD655\uC778\uD560 \uADDC\uCE59");
        const heading = document.createElement("h3");
        heading.textContent = "\uC2DC\uC791 \uC804\uC5D0 \uD655\uC778\uD560 \uADDC\uCE59";
        rules.appendChild(heading);
        const schoolNote = card.querySelector(".school-trial-note");
        if (schoolNote) rules.appendChild(schoolNote);
        const economyNote = mainStart.previousElementSibling;
        if (economyNote) rules.appendChild(economyNote);
        card.insertBefore(rules, consent);
        consent.insertAdjacentElement("afterend", mainStart);
        const hint = document.createElement("p");
        hint.className = "note birth-entry-hint";
        hint.textContent = "\uADDC\uCE59\uC744 \uD655\uC778\uD55C \uB4A4 \uC704 \uB3D9\uC758\uB97C \uC9C1\uC811 \uC120\uD0DD\uD558\uBA74 \uC2DC\uC791\uD560 \uC218 \uC788\uC5B4\uC694. \uC2DC\uC791 \uC804\uC758 \uC0DD\uB144\uC6D4 \uC120\uD0DD\uACFC \uB3D9\uC758\uB294 \uB530\uB85C \uC800\uC7A5\uD558\uC9C0 \uC54A\uC544\uC694. \uC2DC\uC791\uC744 \uB204\uB974\uBA74 \uC120\uD0DD\uD55C \uC0DD\uB144\uC6D4\uB85C \uC0C8 \uD68C\uADC0\uB97C \uC800\uC7A5\uD569\uB2C8\uB2E4.";
        mainStart.insertAdjacentElement("beforebegin", hint);
        const alternate = document.createElement("section");
        alternate.className = "birth-entry-alternates";
        alternate.setAttribute("aria-label", "\uB2E4\uB978 \uC2DC\uC791 \uADDC\uCE59");
        const ah = document.createElement("h3");
        ah.textContent = "\uB2E4\uB978 \uC2DC\uC791 \uADDC\uCE59";
        alternate.appendChild(ah);
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "\uC544\uB798\uB294 \uB2E4\uB978 \uACBD\uC81C \uADDC\uCE59\uC73C\uB85C \uC2DC\uC791\uD558\uAC70\uB098 \uC124\uBA85\uC744 \uC5EC\uB294 \uAE30\uC874 \uC120\uD0DD\uC785\uB2C8\uB2E4. \uC704 \uBCF8\uD3B8 \uC2DC\uC791\uACFC \uAD6C\uBD84\uD574 \uACE8\uB77C \uC8FC\uC138\uC694.";
        alternate.appendChild(note);
        for (const id of ["cash-mode-entry", "game-living-entry", "school-cash-mode-entry"]) {
          const a = document.getElementById(id);
          if (a) alternate.appendChild(a.closest("p"));
        }
        alternate.appendChild(go);
        box.appendChild(alternate);
      }
      document.getElementById("portfolio").innerHTML = "";
    }
    function readLivesRaw() {
      const raw = localStorage.getItem(LIVES_KEY);
      const log = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(log) || log.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Unavailable life archive");
      return log;
    }
    function readLives() {
      try {
        return readLivesRaw();
      } catch (_) {
        storageReadBlocked = true;
        pending = null;
        showStorageReadUnavailable();
        return null;
      }
    }
    function recordAssetTrail() {
      let assets;
      const finalDeferred = DATA.events[state.eventIndex];
      const pendingFinalConfirmation = finalDeferred && finalDeferred.event_month && finalDeferred.event_month <= GAME_END && finalDeferred.date.slice(0, 7) <= state.month;
      const naturalEndSample = state.month === addMonths(GAME_END, 1) && !state.flags.gameEndShown && !pendingFinalConfirmation && !(CASH_MODE && state.cashEvents.rows.some((r) => r.status === "due")) && !["chaos", "living-fail"].includes(state.flags.gameOver) && !(GAME_LIVING && state.gameLivingPendingDue);
      if (naturalEndSample) {
        const priorDate = effDate, priorClose = effPostClose;
        try {
          effDate = state.month + "-01";
          effPostClose = false;
          assets = totalAssets();
        } finally {
          effDate = priorDate;
          effPostClose = priorClose;
        }
      } else assets = totalAssets();
      if (!Array.isArray(state.assetTrail)) state.assetTrail = [];
      const last = state.assetTrail[state.assetTrail.length - 1];
      if (last && last.m === state.month) {
        last.a = assets;
        return;
      }
      if (last && typeof last.m === "string" && last.m > state.month) return;
      state.assetTrail.push({ m: state.month, a: assets });
      if (state.assetTrail.length > 720) state.assetTrail = state.assetTrail.slice(-720);
    }
    function save() {
      if (!foreignShapeOk(state)) return showSaveConflict("\uD574\uC678 ETF \uADDC\uCE59\xB7\uC790\uC0B0 \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "foreign-shape");
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      if (!ReturnEconomyPolicy.inspect(state, currentEconomyId()).ok) return showEconomyConflict();
      if (!inspectForeignFundTag(state)) return showSaveConflict("\uD574\uC678 \uD380\uB4DC\uC9D1\uC911\uB3C4 \uC790\uB8CC\xB7\uADDC\uCE59 \uC2DD\uBCC4\uC774 \uB9DE\uC9C0 \uC54A\uC544 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "foreign-fund-scale-shape");
      if (!propertyShapeOk(state)) return showSaveConflict("\uC8FC\uD0DD \uBAA8\uD615\uC758 \uACC4\uC57D\xB7\uC18C\uC720 \uAE30\uB85D \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "property-shape");
      if (DATA && (!ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map((u) => u.product)).ok || !cashAllocationShapeOk(state) || !albaTimeShapeOk(state) || !chaosExposureShapeOk(state) || !reservationSettlementShapeOk(state))) return showSaveConflict("\uBCF4\uC720\uC790\uC0B0\xB7\uB300\uAE30\uC8FC\uBB38\xB7\uC7A5\uBD80\uC758 \uC77C\uBD80 \uC800\uC7A5 \uD615\uC2DD\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uAE08\uC561\uC744 \uCD94\uC815\uD558\uAC70\uB098 \uC6D0\uBB38\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC5B4\uC694.", "save-shape");
      if (!Object.prototype.hasOwnProperty.call(state, "economyModel")) state.economyModel = ReturnEconomyPolicy.descriptor(MODEL_ID);
      if (SCHOOL_MODE && state.flags.birth && !validSchoolStart()) return showSaveConflict("\uACE01 \uB2EC\uB825 \uC2DC\uC791 \uC2DC\uD5D8\uC758 \uC2DC\uC791\uC6D4\xB7\uC0DD\uC6D4 \uADFC\uAC70\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uC800\uC7A5\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "school-start");
      if (DATA) {
        const next = DATA.events[state.eventIndex];
        const prev = DATA.events[state.eventIndex - 1];
        state.newsCursor = {
          version: 1,
          nextId: next ? next.id : null,
          nextDate: next ? next.date : null,
          finishedThrough: prev ? prev.date : null,
          finishedOnIds: prev ? DATA.events.slice(0, state.eventIndex).filter((e) => e.date === prev.date).map((e) => e.id) : []
        };
      }
      if (multiTabConflict) return showMultiTabConflict();
      try {
        const currentRaw = localStorage.getItem(SAVE_KEY);
        if (currentRaw !== lastKnownRaw) {
          multiTabConflict = true;
          pending = null;
          return showMultiTabConflict();
        }
        if (DATA) recordAssetTrail();
        state.recordContext = ReturnRecordContext.observe(state.recordContext, currentRecordIdentity);
        const raw = JSON.stringify(state);
        localStorage.setItem(SAVE_KEY, raw);
        if (localStorage.getItem(SAVE_KEY) !== raw) throw new Error("Save readback mismatch");
        lastKnownRaw = raw;
        return true;
      } catch (_) {
        storageWriteBlocked = true;
        pending = null;
        return showStorageWriteUnavailable();
      }
    }
    function showStorageWriteUnavailable() {
      document.getElementById("footnote").textContent = "\uC800\uC7A5 \uBC18\uC601 \uBBF8\uD655\uC778 \xB7 \uCD94\uAC00 \uC9C4\uD589 \uC911\uC9C0";
      document.getElementById("unlock-area").innerHTML = "";
      const portfolio = document.getElementById("portfolio");
      portfolio.innerHTML = "";
      portfolio.hidden = true;
      document.getElementById("turn-card").innerHTML = '<div class="date">\uC800\uC7A5 \uBC18\uC601 \uD655\uC778 \uD544\uC694</div><h2>\uC9C4\uD589\uC744 \uC800\uC7A5\uD588\uB294\uC9C0 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4</h2><p>\uC800\uC7A5 \uC4F0\uAE30 \uB610\uB294 \uB2E4\uC2DC \uC77D\uAE30 \uD655\uC778\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uBC29\uAE08 \uC120\uD0DD\xB7\uC8FC\uBB38\xB7\uC6D4 \uC9C4\uD589\uC774 \uC800\uC7A5\uB410\uB2E4\uACE0 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uACE0, \uCD94\uAC00 \uC9C4\uD589\uACFC \uC7AC\uC2DC\uB3C4\uB97C \uBA48\uCDC4\uC2B5\uB2C8\uB2E4.</p><p>\uC774 \uD654\uBA74\uC740 \uB9C8\uC9C0\uB9C9 \uC815\uC0C1 \uC800\uC7A5\uC774\uB098 \uBC29\uAE08 \uBCC0\uACBD\uC758 \uBCF4\uC874\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC544\uC694. \uBE0C\uB77C\uC6B0\uC800 \uC800\uC7A5\uC18C \uAD8C\uD55C\xB7\uC6A9\uB7C9\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uBD88\uB7EC\uC640 \uC2E4\uC81C \uC800\uC7A5 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694. \uC800\uC7A5\uB418\uC9C0 \uC54A\uC740 \uBCC0\uACBD\uC740 \uC0AC\uB77C\uC9C8 \uC218 \uC788\uC73C\uBA70, \uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uC9C0\uC6B0\uBA74 \uAE30\uC874 \uC800\uC7A5\uC744 \uC783\uC744 \uC218 \uC788\uC5B4\uC694.</p>';
      const box = document.getElementById("choices");
      box.innerHTML = "";
      const reload = document.createElement("button");
      reload.textContent = "\uC800\uC7A5 \uC0C1\uD0DC \uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30";
      reload.onclick = () => {
        if (confirm("\uC800\uC7A5\uB418\uC9C0 \uC54A\uC740 \uBCC0\uACBD\uC740 \uC0AC\uB77C\uC9C8 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC800\uC7A5\uC18C\uC758 \uD604\uC7AC \uC0C1\uD0DC\uB97C \uB2E4\uC2DC \uBD88\uB7EC\uC62C\uAE4C\uC694?")) location.reload();
      };
      box.append(reload);
      return false;
    }
    function showMultiTabConflict() {
      document.getElementById("footnote").textContent = "\uB2E4\uB978 \uD0ED \uBCC0\uACBD \uAC10\uC9C0 \xB7 \uB36E\uC5B4\uC4F0\uAE30 \uC911\uC9C0";
      document.getElementById("unlock-area").innerHTML = "";
      const portfolio = document.getElementById("portfolio");
      portfolio.innerHTML = "";
      portfolio.hidden = true;
      document.getElementById("turn-card").innerHTML = '<div class="date">\uB2E4\uB978 \uD0ED\uC5D0\uC11C \uBCC0\uACBD\uB428</div><h2>\uB2E4\uB978 \uD0ED\uC774\uB098 \uCC3D\uC5D0\uC11C \uC774 \uC778\uC0DD \uAE30\uB85D\uC774 \uBC14\uB00C\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4</h2><p>\uC774 \uD0ED\uC774 \uB9C8\uC9C0\uB9C9\uC73C\uB85C \uD655\uC778\uD55C \uC800\uC7A5 \uB0B4\uC6A9\uACFC \uC9C0\uAE08 \uC800\uC7A5\uC18C\uC758 \uB0B4\uC6A9\uC774 \uB2EC\uB77C\uC694. \uC5B4\uB290 \uCABD \uC9C4\uD589\uB3C4 \uB2E4\uB978 \uCABD\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uB3C4\uB85D \uC774 \uD0ED\uC758 \uCD94\uAC00 \uC9C4\uD589\uACFC \uC800\uC7A5\uC744 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4.</p><p>\uB2E4\uB978 \uD0ED\uC758 \uCD5C\uC2E0 \uC0C1\uD0DC\uB97C \uC774 \uD0ED\uC5D0 \uBD88\uB7EC\uC624\uBA74, \uC774 \uD0ED\uC5D0\uC11C \uC800\uC7A5\uB418\uC9C0 \uC54A\uC740 \uC9C4\uD589\uC740 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4. \uB450 \uD0ED\uC5D0\uC11C \uB3D9\uC2DC\uC5D0 \uC9C4\uD589\uD558\uB294 \uAC83\uC740 \uC544\uC9C1 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694.</p>';
      const box = document.getElementById("choices");
      box.innerHTML = "";
      const reload = document.createElement("button");
      reload.textContent = "\uCD5C\uC2E0 \uC0C1\uD0DC \uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30";
      reload.onclick = () => {
        if (confirm("\uC774 \uD0ED\uC5D0\uC11C \uC800\uC7A5\uB418\uC9C0 \uC54A\uC740 \uC9C4\uD589\uC740 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4. \uC800\uC7A5\uC18C\uC758 \uCD5C\uC2E0 \uC0C1\uD0DC\uB97C \uB2E4\uC2DC \uBD88\uB7EC\uC62C\uAE4C\uC694?")) location.reload();
      };
      box.append(reload);
      return false;
    }
    window.addEventListener("storage", (e) => {
      if (e.key !== SAVE_KEY || e.storageArea !== localStorage) return;
      if (e.newValue === lastKnownRaw) return;
      if (!multiTabConflict) {
        multiTabConflict = true;
        pending = null;
        showMultiTabConflict();
      }
    });
    function restoreNewsCursor() {
      const c = state.newsCursor;
      if (c && c.version === 1) {
        if (c.nextId) {
          const found = DATA.events.findIndex((e) => e.id === c.nextId);
          if (found < 0) return showSaveConflict("\uC800\uC7A5\uB41C \uB2E4\uC74C \uB274\uC2A4\uAC00 \uD604\uC7AC \uB370\uC774\uD130\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uB274\uC2A4\uB85C \uC790\uB3D9 \uB300\uCCB4\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694.");
          if (c.nextDate && DATA.events[found].date !== c.nextDate)
            return showSaveConflict("\uC800\uC7A5\uB41C \uB2E4\uC74C \uB274\uC2A4\uC758 \uD655\uC778 \uB0A0\uC9DC\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uAC19\uC740 ID\uB9CC\uC73C\uB85C \uC9C4\uD589 \uC704\uCE58\uB97C \uCD94\uCE21\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694.");
          state.eventIndex = found;
        } else {
          const sameDay = DATA.events.filter((e) => e.date === c.finishedThrough);
          if (sameDay.some((e) => !Array.isArray(c.finishedOnIds) || !c.finishedOnIds.includes(e.id)))
            return showSaveConflict("\uB9C8\uC9C0\uB9C9 \uC644\uB8CC\uC77C\uC758 \uB274\uC2A4 \uAD6C\uC131\uC774 \uBC14\uB00C\uC5B4 \uC644\uB8CC \uC5EC\uBD80\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC790\uB3D9\uC73C\uB85C \uC774\uC5B4 \uAC00\uC9C0 \uC54A\uC558\uC5B4\uC694.");
          const found = DATA.events.findIndex((e) => (!c.finishedThrough || e.date > c.finishedThrough) && e.date.slice(0, 7) >= state.month);
          state.eventIndex = found < 0 ? DATA.events.length : found;
        }
        return true;
      }
      if (!state.eventIndex && !state.turnCount) return true;
      return showSaveConflict("\uC774\uC804 \uC800\uC7A5\uC5D0\uB294 \uB274\uC2A4 \uC21C\uC11C\uC758 \uC548\uC815 ID\uAC00 \uC5C6\uC5B4 \uB370\uC774\uD130 \uBCF4\uCDA9 \uD6C4 \uAC19\uC740 \uC704\uCE58\uC778\uC9C0 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC790\uC0B0\xB7\uB300\uAE30 \uC8FC\uBB38\uC744 \uBC14\uAFB8\uAC70\uB098 \uC790\uB3D9 \uCCB4\uACB0\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694.");
    }
    function showStorageReadUnavailable() {
      document.getElementById("unlock-area").innerHTML = "";
      const portfolio = document.getElementById("portfolio");
      portfolio.innerHTML = "";
      portfolio.hidden = true;
      document.getElementById("turn-card").innerHTML = '<div class="date">\uC800\uC7A5\uC18C \uC811\uADFC \uD655\uC778 \uD544\uC694</div><h2>\uC800\uC7A5 \uB0B4\uC6A9\uC744 \uC77D\uC744 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4</h2><p>\uBE0C\uB77C\uC6B0\uC800 \uC800\uC7A5\uC18C\uC5D0 \uC811\uADFC\uD560 \uC218 \uC5C6\uC5B4 \uAE30\uC874 \uC800\uC7A5\uC758 \uC720\uBB34\uC640 \uC6D0\uBB38\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC774 \uC77D\uAE30 \uC2E4\uD328\uB97C \uC5C6\uB294 \uC800\uC7A5\uC73C\uB85C \uCDE8\uAE09\uD574 \uC0C8 \uAC8C\uC784\uC73C\uB85C \uB300\uCCB4\uD558\uAC70\uB098 \uC6D0\uBB38\uC744 \uB36E\uC5B4\uC4F0\uACE0 \uC9C0\uC6B0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p><p>\uC6D0\uBB38\uC744 \uC77D\uC9C0 \uBABB\uD588\uC73C\uBBC0\uB85C \uBCC4\uB3C4 \uBCF4\uC874\uC774\uB098 \uC6D0\uBCF8 \uD30C\uC77C \uBC1B\uAE30\uAC00 \uC644\uB8CC\uB410\uB2E4\uB294 \uB73B\uC740 \uC544\uB2C8\uC5D0\uC694. \uBE0C\uB77C\uC6B0\uC800\uC758 \uC0AC\uC774\uD2B8 \uC800\uC7A5\uC18C \uAD8C\uD55C\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uBD88\uB7EC\uC624\uC138\uC694. \uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uC9C0\uC6B0\uBA74 \uAE30\uC874 \uC800\uC7A5\uC744 \uC783\uC744 \uC218 \uC788\uC5B4\uC694.</p>';
      const box = document.getElementById("choices");
      box.innerHTML = "";
      const retry = document.createElement("button");
      retry.textContent = "\uAD8C\uD55C \uD655\uC778 \uD6C4 \uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30";
      retry.onclick = () => location.reload();
      box.append(retry);
      return false;
    }
    function showEconomyConflict() {
      return showSaveConflict("\uC774 \uC800\uC7A5\uC758 \uC0DD\uD65C\uACBD\uC81C \uBAA8\uD615 \uB610\uB294 \uBC84\uC804\uC744 \uD604\uC7AC \uC2DC\uC81C\uD488\uC774 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC73C\uB85C \uBC14\uAFB8\uAC70\uB098 \uD559\uBE44\xB7\uD604\uAE08\xB7\uC8FC\uBB38\uC744 \uCD94\uC815 \uBC18\uC601\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694.", "economy-model");
    }
    function showSaveConflict(reason, scope) {
      const raw = localStorage.getItem(SAVE_KEY);
      const key = SAVE_KEY + (scope === "economy-model" ? "-preserved-before-economy-migration" : scope === "save-shape" ? "-preserved-before-shape-recovery" : "-preserved-before-news-migration");
      function preserveExactRaw() {
        if (raw === null) return false;
        try {
          let target = key, suffix = 1;
          while (localStorage.getItem(target) !== null && localStorage.getItem(target) !== raw) {
            suffix += 1;
            target = key + "-" + suffix;
          }
          if (localStorage.getItem(target) === null) localStorage.setItem(target, raw);
          return localStorage.getItem(target) === raw;
        } catch (_) {
          return false;
        }
      }
      const preserved = preserveExactRaw();
      document.getElementById("unlock-area").innerHTML = "";
      document.getElementById("portfolio").innerHTML = "";
      document.getElementById("portfolio").hidden = true;
      document.getElementById("turn-card").innerHTML = '<div class="date">\uC800\uC7A5 \uD638\uD658 \uD655\uC778 \uD544\uC694</div><h2>\uD604\uC7AC \uC800\uC7A5\uC744 \uC720\uC9C0\uD558\uACE0 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4</h2><p>' + esc(reason) + "</p><p>\uC6D0\uBCF8 \uC800\uC7A5\uC740 \uADF8\uB300\uB85C \uB0A8\uC544 \uC788\uC2B5\uB2C8\uB2E4. \uBCC4\uB3C4 \uBCF4\uC874\uBCF8\uC758 \uC800\uC7A5 \uD655\uC778 \uC804\uC5D0\uB294 \uC0C8 \uC2DC\uC791\uC744 \uB9C9\uC2B5\uB2C8\uB2E4.</p>";
      const box = document.getElementById("choices");
      box.innerHTML = "";
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "\uC6D0\uBCF8 \uC800\uC7A5 \uD30C\uC77C \uBC1B\uAE30";
      exportBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
        a.download = "return-preserved-save.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
      };
      const restartBtn = document.createElement("button");
      restartBtn.textContent = "\uBCF4\uC874\uBCF8\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791";
      if (!preserved) {
        const note = document.createElement("p");
        note.textContent = "\uBCC4\uB3C4 \uBCF4\uC874\uBCF8\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uC6D0\uBB38\uC740 \uC9C0\uC6B0\uC9C0 \uC54A\uC558\uC5B4\uC694. \uBA3C\uC800 \uC6D0\uBCF8 \uD30C\uC77C\uC744 \uBC1B\uC544 \uBCF4\uAD00\uD558\uC138\uC694. \uBCF4\uC874 \uD655\uC778 \uC804\uC5D0\uB294 \uC0C8 \uC2DC\uC791\uC744 \uB9C9\uC2B5\uB2C8\uB2E4.";
        document.getElementById("turn-card").append(note);
        restartBtn.disabled = true;
      }
      restartBtn.onclick = () => {
        if (!preserveExactRaw()) {
          restartBtn.disabled = true;
          return;
        }
        if (!confirm("\uAE30\uC874 \uC800\uC7A5\uC758 \uBCF4\uC874\uBCF8\uC740 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0\uB97C \uC2DC\uC791\uD560\uAE4C\uC694?")) return;
        if (localStorage.getItem(SAVE_KEY) !== raw || !preserveExactRaw()) {
          alert("\uC800\uC7A5 \uB0B4\uC6A9 \uB610\uB294 \uBCF4\uC874 \uC0C1\uD0DC\uAC00 \uBC14\uB00C\uC5B4 \uC0C8 \uC2DC\uC791\uC744 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uBCF8\uC744 \uB2E4\uC2DC \uD655\uC778\uD558\uC138\uC694.");
          return;
        }
        restartBtn.disabled = true;
        const flush = window.__returnStorageFlush;
        const done = (ok) => {
          if (!ok) {
            alert("\uBCF4\uC874\uBCF8 \uC800\uC7A5\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC0C8 \uC2DC\uC791\uC744 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uBCF8\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uC6D0\uBCF8 \uC800\uC7A5 \uD30C\uC77C \uBC1B\uAE30\uB85C \uBA3C\uC800 \uBCF4\uAD00\uD558\uC138\uC694.");
            restartBtn.disabled = false;
            return;
          }
          localStorage.removeItem(SAVE_KEY);
          location.reload();
        };
        if (typeof flush === "function") {
          Promise.resolve().then(() => flush()).then((ok) => done(ok !== false), () => done(false));
        } else done(true);
      };
      box.append(exportBtn, restartBtn);
      if (preserved && typeof window.__returnStorageFlush === "function") {
        restartBtn.disabled = true;
        Promise.resolve().then(() => window.__returnStorageFlush()).then((ok) => {
          if (ok !== false) {
            restartBtn.disabled = false;
            return;
          }
          const note = document.createElement("p");
          note.className = "preserved-backup-failed";
          note.textContent = "\uBCC4\uB3C4 \uBCF4\uC874\uBCF8\uC758 \uC601\uC18D \uC800\uC7A5\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC6D0\uBCF8\uC740 \uC9C0\uC6B0\uC9C0 \uC54A\uC558\uC5B4\uC694. \uC6D0\uBCF8 \uC800\uC7A5 \uD30C\uC77C \uBC1B\uAE30\uB85C \uBA3C\uC800 \uBCF4\uAD00\uD558\uC138\uC694. \uC774 \uD654\uBA74\uC5D0\uC11C\uB294 \uC0C8 \uC2DC\uC791\uC744 \uB9C9\uC2B5\uB2C8\uB2E4.";
          document.getElementById("turn-card").append(note);
        }, () => {
          restartBtn.disabled = true;
        });
      }
      return false;
    }
    function productAvailable(u) {
      if (u && u.requires_rules === "foreign-etf-v1" && !foreignActive()) return false;
      if (u && u.requires_rules === "core-v4" && !(state && state.coreRules >= 4)) return false;
      const cutoff = effDate && effDate.slice(0, 7) === state.month ? effDate : state.month + "-01";
      return !!u && (!u.available_from || u.available_from <= cutoff);
    }
    function unlockedProducts() {
      return DATA.unlocks.filter(productAvailable).map(productDisplayRecord);
    }
    function productAccessDisplayNote(u) {
      if (u.product === "fx") return "1998-07-22 \uBCF4\uC720 \uBAA9\uC801 \uAC1C\uC778 \uC678\uD654 \uB9E4\uC785\uC740 \uC5F0 2\uB9CC\uB2EC\uB7EC \uD55C\uB3C4\uC600\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uB2EC\uB7EC \uBCF4\uC720 \uC2DC\uC5F0\uC740 \uC5F0\uAC04 \uD55C\uB3C4\xB7\uBBF8\uC131\uB144\uC790\xB7\uC740\uD589 \uC870\uAC74\xB7\uD658\uC804 \uBE44\uC6A9\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC73C\uBA70, \uBB34\uC81C\uD55C \uD604\uCC30 \uB9E4\uC785\uC774 \uC5ED\uC0AC\uC801\uC73C\uB85C \uD5C8\uC6A9\uB410\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4.";
      if (u.product === "usdeposit") return "1998-07-22 \uAC1C\uC778\xB7\uAE30\uC5C5\uC758 \uAC70\uC8FC\uC790 \uC678\uD654\uC608\uAE08 \uBAA9\uC801 \uB9E4\uC785 \uC81C\uD55C\uC774 \uD574\uC81C\uB410\uC9C0\uB9CC \uAD6D\uC678 \uC608\uAE08 \uBAA9\uC801 \uD658\uC804 \uC81C\uD55C\uC740 \uB0A8\uC558\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uAD6D\uB0B4 \uC678\uD654\uC608\uAE08 \uC2DC\uC5F0\uC740 \uAC1C\uBCC4 \uAC00\uC785\xB7\uBBF8\uC131\uB144\uC790\xB7\uC740\uD589 \uC870\uAC74\uC744 \uAC80\uC99D\uD558\uC9C0 \uC54A\uC558\uACE0 \uC774\uC790\uC728\uC740 \uAC8C\uC784\uAC12\uC785\uB2C8\uB2E4.";
      return u.note || "";
    }
    function productStatusNote(u) {
      if (u.tradable === false) return "\uC2DC\uC5F0 \uBBF8\uC9C0\uC6D0 \xB7 \uB9E4\uB9E4 \uBE44\uD65C\uC131";
      if (u.rule === "unpriced") return "\uAC00\uACA9 \uC790\uB8CC \uBBF8\uD655\uBCF4 \xB7 \uB9E4\uB9E4 \uBE44\uD65C\uC131";
      if (u.rule === "accrual") return "\uC774\uC790 \uB204\uC801 \uBAA8\uD615 \xB7 \uC2E4\uC81C \uACC4\uC57D \uC544\uB2D8";
      if (u.rule === "fxprice") {
        return holdingPricePoint(u.product, state.month) && priceAt("fx", state.month) ? "\uAC00\uC0C1 \uD658\uC0B0 \uD3C9\uAC00 \xB7 \uC774\uD6C4 \uC801\uACA9 \uC9C0\uC810 \uCCB4\uACB0 \uB300\uAE30" : "\uC2DC\uC138 \uB610\uB294 \uD658\uC728 \uC790\uB8CC \uBBF8\uD655\uBCF4 \xB7 \uC0C8 \uC8FC\uBB38 \uBE44\uD65C\uC131";
      }
      if (u.rule === "price" || u.rule === "fxaccrual") {
        return holdingPricePoint(u.product, state.month) ? u.rule === "fxaccrual" ? "\uD658\uC728 \uD3C9\uAC00\xB7\uC2DC\uD5D8 \uC774\uC790 \uBAA8\uD615" : "\uC9C0\uC810 \uD3C9\uAC00 \uBAA8\uD615 \xB7 \uC774\uD6C4 \uC801\uACA9 \uC9C0\uC810 \uCCB4\uACB0 \uB300\uAE30" : "\uC2DC\uC138 \uC790\uB8CC \uBBF8\uD655\uBCF4 \xB7 \uC0C8 \uC8FC\uBB38 \uBE44\uD65C\uC131";
      }
      return "\uC0C1\uD488 \uADDC\uCE59 \uD655\uC778 \uD544\uC694";
    }
    const DEMO_END = "2003-12";
    const GAME_END = GAME_LIVING ? "2019-09" : "2026-10";
    const GLV = { startCash: 3e6, startMonth: "2019-07", lastWorkMonth: "2019-09", income: 145e4, expense: 7e5, investCapRatio: 0.3 };
    function gameLivingInvestCap() {
      if (!GAME_LIVING || state.gameLivingTrack !== "job") return Infinity;
      const capTotal = Math.floor((GLV.startCash + (state.gameLivingSalaryReceived || 0)) * GLV.investCapRatio);
      let used = 0;
      for (const p of Object.keys(state.holdings || {})) {
        const h = state.holdings[p];
        used += h.invested != null ? Math.round(h.invested) : Math.round(h.avgPrice * h.qty);
      }
      used += (state.pendingOrders || []).filter((o) => o.kind === "buy").reduce((sum, o) => sum + Math.max(0, o.amount - (o.split && o.split.n > 1 ? o.split.invested || 0 : 0)), 0);
      return Math.max(0, capTotal - used);
    }
    function livingAdjustValuation(p, h) {
      const r = productRule(p);
      if (r.rule === "accrual") return { v: Math.round(h.avgPrice * h.qty), basis: "\uC6D0\uAE08+\uB204\uC801 \uC774\uC790(\uC2DC\uC5F0 \uAE08\uB9AC)" };
      if (r.rule === "fxaccrual") {
        const pt = priceAt(r.series || p, state.month);
        if (pt) return { v: Math.round(pt.value * h.qty), basis: (r.series || p) + " " + pt.date + " \uC9C0\uC810" };
        return { v: Math.round(h.avgPrice * h.qty), basis: "\uC6D0\uAE08+\uB204\uC801 \uC774\uC790(\uC2DC\uC5F0 \uAE08\uB9AC \xB7 \uD658\uC728 \uC9C0\uC810 \uBBF8\uD655\uBCF4)" };
      }
      if (r.rule === "fxprice") {
        const sp = priceAt(r.series || "sp500", state.month), fx = priceAt("fx", state.month);
        if (sp && fx) return { v: Math.round(sp.value * fx.value * h.qty), basis: (r.series || "sp500") + " " + sp.date + " \uC9C0\uC810 \xD7 \uD658\uC728 " + fx.date + " \uC9C0\uC810" };
        return { v: 0, blocked: true, basis: "\uD655\uBCF4 \uC2DC\uC138 \uC9C0\uC810 \uBD80\uC871(" + [!sp ? "\uD574\uC678 \uC2DC\uC138" : "", !fx ? "\uD658\uC728" : ""].filter(Boolean).join("\xB7") + ") \u2014 \uD3C9\uAC00 \uBD88\uAC00\uB77C \uC815\uC0B0 \uB9E4\uB3C4 \uBD88\uAC00" };
      }
      if (r.rule === "price") {
        const pt = priceAt(r.series || p, state.month);
        if (pt) return { v: Math.round(pt.value * h.qty), basis: (r.series || p) + " " + pt.date + " \uC9C0\uC810" };
        return { v: 0, blocked: true, basis: "\uD655\uBCF4 \uC2DC\uC138 \uC9C0\uC810 \uC5C6\uC74C \u2014 \uD3C9\uAC00 \uBD88\uAC00\uB77C \uC815\uC0B0 \uB9E4\uB3C4 \uBD88\uAC00" };
      }
      return { v: 0, blocked: true, basis: "\uC2DC\uC138 \uBBF8\uD655\uBCF4 \uC0C1\uD488 \u2014 \uC815\uC0B0 \uB9E4\uB3C4 \uBD88\uAC00" };
    }
    function gameLivingSummaryHtml() {
      const rows = (state.gameLivingLedger || []).map((r) => "<tr><td>" + r.month + "</td><td>" + (r.income ? "+" + r.income.toLocaleString() + " (" + r.incomeFor + " \uADFC\uBB34\uBD84)" : r.startMonthRow && state.gameLivingTrack === "job" ? "0 (\uCCAB \uC6D4\uAE09\uC740 8\uC6D4 \uCD08)" : "0") + "</td><td>" + (r.failed ? "\uBBF8\uB0A9(\uBD80\uC871 " + r.shortfall.toLocaleString() + ")" : "-" + r.expense.toLocaleString() + " (" + r.month + "\uBD84)") + "</td><td>" + r.cashAfter.toLocaleString() + "</td></tr>").join("");
      return '<details class="game-living-summary" open><summary>\uC6D4\uBCC4 \uC6D0\uC7A5 [\uBA85\uC2DC \uAC8C\uC784\uAC12 \xB7 \uC2E4\uC81C \uAE09\uC5EC\xB7\uC0DD\uD65C\uBE44 \uC544\uB2D8]</summary><table><thead><tr><th>\uADFC\uBB34\xB7\uC0DD\uD65C \uC6D4</th><th>\uC785\uAE08(\uC6D0)</th><th>\uC0DD\uD65C\uBE44(\uC6D0)</th><th>\uC815\uC0B0 \uD6C4 \uD604\uAE08(\uC6D0)</th></tr></thead><tbody>' + rows + '</tbody></table><p class="note">\uCDE8\uC5C5 \uAC08\uB798 \uC6D4\uAE09\uC740 \uB2E4\uC74C \uB2EC \uCD08\uC5D0 \uC785\uAE08\uB429\uB2C8\uB2E4(7\uC6D4\uBD84\uC740 8\uC6D4 \uCD08). \uC774 \uAD6C\uAC04\uC5D0\uC11C \uC2E4\uC785\uAE08\uC740 7\xB78\uC6D4 \uADFC\uBB34\uBD84 2\uD68C\uC774\uBA70, 9\uC6D4 \uADFC\uBB34\uBD84 ' + GLV.income.toLocaleString() + "\uC6D0\uC740 10\uC6D4 \uCD08 \uC785\uAE08\uC774\uB77C \uAD6C\uAC04 \uBC16 \uBBF8\uC218 \uCC44\uAD8C\uC785\uB2C8\uB2E4(\uD604\uAE08 \uBBF8\uBC18\uC601). \uC2DC\uC791 \uD604\uAE08 " + GLV.startCash.toLocaleString() + "\uC6D0 \xB7 \uC6D4 \uC0DD\uD65C\uBE44 " + GLV.expense.toLocaleString() + "\uC6D0 \xB7 \uCDE8\uC5C5 \uC6D4\uAE09 " + GLV.income.toLocaleString() + "\uC6D0 \u2014 \uC804\uBD80 \uBA85\uC2DC \uAC8C\uC784 \uBC38\uB7F0\uC2A4 \uAC12\uC774\uBA70 \uC2E4\uC81C \uAE09\uC5EC\xB7\uACF5\uC81C\xB7\uC0DD\uD65C\uBE44 \uC870\uC0AC \uACB0\uACFC\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p></details>";
    }
    function gameLivingMarketAccessHtml() {
      const win = (d) => d >= GLV.startMonth + "-01" && d <= "2019-09-30";
      const endObs = (d) => d >= "2019-10-01" && d <= "2019-10-31";
      const accrual = [], open = [], closed = [];
      for (const u of DATA.unlocks) {
        const name = u.name || u.product;
        if (u.rule === "accrual" || u.rule === "fxaccrual") {
          accrual.push(name);
          continue;
        }
        if (u.rule === "unpriced") {
          closed.push(name + "(\uC2DC\uC138 \uC9C0\uC810 \uC5C6\uC74C)");
          continue;
        }
        const series = u.product === "etf" ? "kospi" : u.product;
        const pts = DATA.prices.filter((pp) => pp.series === series && win(pp.usable_from || pp.date));
        const epts = DATA.prices.filter((pp) => pp.series === series && endObs(pp.usable_from || pp.date));
        const months = [...new Set(pts.map((pp) => (pp.usable_from || pp.date).slice(0, 7)))].sort();
        const endNote = epts.length ? " \xB7 2019-10 \uC9C0\uC810 " + epts.length + "\uAC1C\uB294 9\uC6D4 \uACB0\uC815\uC758 \uC885\uB8CC \uAD00\uCE21(\uCCB4\uACB0\uC6A9)\uC774\uBA70 10\uC6D4 \uD50C\uB808\uC774\uB294 \uC5C6\uC74C" : "";
        if (months.length) open.push(name + "(\uAD6C\uAC04 \uB0B4 \uAD00\uCE21 \uC9C0\uC810 " + pts.length + "\uAC1C: " + months.join("\xB7") + endNote + ")");
        else closed.push(name + "(\uAD6C\uAC04 \uB0B4 \uC0C8 \uC9C0\uC810 \uC5C6\uC74C" + endNote + ")");
      }
      return '<details class="game-living-market"><summary>\uC774 3\uAC1C\uC6D4 \uAD6C\uAC04\uC758 \uC0C1\uD488\uBCC4 \uC2DC\uC138 \uC9C0\uC810(\uC2E4\uC81C \uC790\uB8CC \uAE30\uC900)</summary><p>\uAD6C\uAC04 \uB0B4(7~9\uC6D4) \uAD00\uCE21 \uC9C0\uC810\uC774 \uC5F4\uB9AC\uB294 \uC0C1\uD488: ' + (open.join(", ") || "\uC5C6\uC74C") + ".</p><p>\uAD6C\uAC04 \uB0B4 \uC0C8 \uC9C0\uC810\uC774 \uC5C6\uC5B4 \uC9C0\uC5F0\uCCB4\uACB0 \uB9E4\uC218\uAC00 \uAD6C\uAC04 \uB0B4\uC5D0 \uCCB4\uACB0\uB418\uC9C0 \uC54A\uB294 \uC0C1\uD488: " + (closed.join(", ") || "\uC5C6\uC74C") + ".</p><p>\uC774\uC790 \uB204\uC801 \uC0C1\uD488(\uC2DC\uC138 \uC9C0\uC810 \uBD88\uD544\uC694 \xB7 \uC2DC\uC5F0 \uAE08\uB9AC): " + accrual.join(", ") + '.</p><p class="note">\uAD6D\uB0B4 \uC9C0\uC218 \uC2DC\uC138 \uCD9C\uCC98: ECOS(\uD55C\uAD6D\uC740\uD589 \uACBD\uC81C\uD1B5\uACC4\uC2DC\uC2A4\uD15C), \uC791\uC131\uAE30\uAD00 \uD55C\uAD6D\uAC70\uB798\uC18C, \uC8FC\uC2DD\uC2DC\uC7A5(\uC77C) KOSPI\uC9C0\uC218, \uC870\uD68C 2026-11-10 \xB7 \uC774\uC6A9 \uAC1C\uC2DC\uC77C(\uC775\uC6D4 1\uC77C)\uC740 \uAC8C\uC784 \uAC00\uC815\uC774\uBA70 \uC2E4\uC81C \uCD5C\uCD08 \uACF5\uD45C\uC77C \uC99D\uBA85\uC774 \uC544\uB2D8 \xB7 KOSPI \uC885\uAC00 \uAE30\uC900 \uBAA8\uD615\uC73C\uB85C \uC2E4\uC81C ETF\xB7\uD380\uB4DC\uC758 NAV\xB7\uCCB4\uACB0\uAC00\xB7\uBD84\uBC30\uAE08\xB7\uC218\uC218\uB8CC\uAC00 \uC544\uB2D8</p><p class="note">\uB9E4\uC218 \uAE30\uD68C\uAC00 \uC5C6\uB294 \uC0C1\uD488\uC758 \uBE44\uAD50\uB294 \uBC38\uB7F0\uC2A4 \uAC80\uC99D\uC73C\uB85C \uC138\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p></details>';
    }
    function renderGameLivingStart() {
      vnScene("life");
      document.querySelector("header p").textContent = "2019Q3 \uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 \xB7 \uBCC4\uB3C4 \uC800\uC7A5 \xB7 \uC2DC\uC138\uB294 \uC2E4\uC81C \uC790\uB8CC / \uC218\uC785\xB7\uC9C0\uCD9C\uC740 \uBA85\uC2DC \uAC8C\uC784\uAC12";
      const card = document.getElementById("turn-card");
      const box = document.getElementById("choices");
      box.innerHTML = "";
      card.innerHTML = '<div class="date">\uD68C\uADC0 \uC2DC\uC791 \xB7 2019-07</div><h2>2019Q3 \uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 [\uC804\uBD80 \uBA85\uC2DC \uAC8C\uC784\uAC12]</h2><p>2019\uB144 7~9\uC6D4 3\uAC1C\uC6D4\uB9CC \uD50C\uB808\uC774\uD558\uB294 \uBCC4\uB3C4 \uC2DC\uD5D8\uC785\uB2C8\uB2E4. \uC2DC\uC138\xB7\uB274\uC2A4\uB294 \uBCF8\uD3B8\uACFC \uAC19\uC740 \uC2E4\uC81C \uC790\uB8CC\uB97C \uC4F0\uC9C0\uB9CC, \uC218\uC785\xB7\uC9C0\uCD9C\uC740 \uC2E4\uC81C \uAE09\uC5EC\xB7\uACF5\uC81C\xB7\uC0DD\uD65C\uBE44 \uACE0\uC99D\uC774 \uC544\uB2CC \uAC8C\uC784 \uBC38\uB7F0\uC2A4 \uAC12\uC785\uB2C8\uB2E4. \uC774 \uC2DC\uD5D8 \uACB0\uACFC\uB85C \uC2E4\uC81C \uC138\uD6C4\uC18C\uB4DD\xB7\uC0DD\uACC4 \uAC00\uB2A5\uC131\xB7\uC9C4\uB85C\uC758 \uC6B0\uC5F4\uC744 \uD310\uC815\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p><ul><li>\uC2DC\uC791 \uD604\uAE08 ' + GLV.startCash.toLocaleString() + "\uC6D0 [\uAC8C\uC784\uAC12] \xB7 \uB450 \uAC08\uB798 \uBAA8\uB450 \uAC19\uC740 \uCD08\uAE30 \uC870\uAC74</li><li>\uCDE8\uC5C5 \uAC08\uB798: \uC6D4\uAE09 " + GLV.income.toLocaleString() + "\uC6D0\uC744 \uB2E4\uC74C \uB2EC \uCD08\uC5D0 \uC785\uAE08(7\uC6D4\uBD84\uC740 8\uC6D4 \uCD08). \uAC8C\uC784 \uC720\uC785(\uC2DC\uC791 \uC790\uAE08+\uBC1B\uC740 \uC6D4\uAE09)\uC758 30%\uC5D0\uC11C \uAE30\uD22C\uC790 \uC6D0\uAC00\xB7\uBBF8\uCCB4\uACB0 \uB9E4\uC218 \uC608\uC57D\uC744 \uBE80 \uAE08\uC561\uAE4C\uC9C0\uB9CC \uD22C\uC790\uC5D0 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4 [\uAC8C\uC784 \uADDC\uCE59]</li><li>\uC804\uC5C5 \uAC08\uB798: \uC815\uAE30 \uC720\uC785 \uC5C6\uC74C \xB7 \uD22C\uC790 \uC0C1\uD55C \uC5C6\uC74C</li><li>\uC0DD\uD65C\uBE44 " + GLV.expense.toLocaleString() + "\uC6D0\uC740 \uB9E4\uC6D4 \uCD08 \uD574\uB2F9 \uC6D4\uBD84\uC744 \uD55C \uBC88 \uCC28\uAC10\uD569\uB2C8\uB2E4(7\uC6D4\uBD84\uC740 \uC2DC\uC791\uACFC \uD568\uAED8 \uCC28\uAC10, 7\uC6D4 \uC785\uAE08\uC740 0\uC6D0). \uD604\uAE08\uC774 \uBD80\uC871\uD558\uBA74 \uC815\uC0B0 \uC804\uC5D0 \uBCF4\uC720 \uC790\uC0B0\uC744 \uC815\uC0B0 \uB9E4\uB3C4\uD574 \uB9C8\uB828\uD560 \uAE30\uD68C\uAC00 \uD55C \uBC88 \uC788\uACE0, \uADF8\uB798\uB3C4 \uBD80\uC871\uD558\uBA74 \uC2E4\uD328 \uD68C\uADC0. \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C \uC5C6\uC74C</li>" + gameLivingMarketAccessHtml() + '<li>\uAE30\uC874 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC740 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4(\uC774 \uC6D0\uC7A5\uC73C\uB85C \uB300\uCCB4, \uC774\uC911 \uBC18\uC601 \uC5C6\uC74C). 2019-10 \uD50C\uB808\uC774\uB294 \uC5C6\uACE0 9\uC6D4\uBD84 \uC815\uC0B0 \uB4A4 \uAE30\uAC04 \uB9D0 \uC694\uC57D\uC73C\uB85C \uB2EB\uD799\uB2C8\uB2E4</li></ul><label><input id="game-living-consent" type="checkbox"> \uC774 \uBA85\uC2DC \uAC8C\uC784\uAC12\uACFC \uBCC4\uB3C4 \uC800\uC7A5\uC73C\uB85C \uC0C8 \uD68C\uADC0 \uC2DC\uC791\uC5D0 \uB3D9\uC758</label><p><a href="./">\uBCF8\uD3B8\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30</a> \xB7 <a href="?start=classic">\uD074\uB798\uC2DD\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30</a></p>';
      const mk = (track, label) => {
        const b = document.createElement("button");
        b.id = "game-living-start-" + track;
        b.textContent = label;
        b.disabled = true;
        b.style.minHeight = "44px";
        b.onclick = () => {
          if (!readLives()) return;
          if (!document.getElementById("game-living-consent").checked) return;
          state.month = GLV.startMonth;
          state.cash = GLV.startCash;
          state.gameLivingRules = 1;
          state.gameLivingTrack = track;
          state.gameLivingSalaryReceived = 0;
          state.cash -= GLV.expense;
          state.gameLivingLedger = [{ month: GLV.startMonth, income: 0, incomeFor: null, expense: GLV.expense, expenseDue: GLV.expense, shortfall: 0, cashAfter: state.cash, failed: false, startMonthRow: true }];
          state.flags.birth = { year: 1980, month: 3, hsYear: hsYear(1980, 3) };
          state.flags.studyPath = "study";
          state.flags.academicStatus = "graduated";
          state.flags.career = track;
          state.eventIndex = DATA.events.findIndex((e) => e.date.slice(0, 7) >= GLV.startMonth);
          if (state.eventIndex < 0) state.eventIndex = DATA.events.length;
          state.assetTrail = [];
          state.coreRules = 4;
          state.resetRules = 1;
          state.livingScenarioRules = 1;
          state.recordContext = ReturnRecordContext.begin(currentRecordIdentity);
          save();
          render();
        };
        box.appendChild(b);
        return b;
      };
      const bJob = mk("job", "\uCDE8\uC5C5\uC73C\uB85C \uC2DC\uC791 \u2014 \uC815\uAE30 \uC720\uC785 \xB7 \uD22C\uC790 \uC0C1\uD55C 30% [\uAC8C\uC784\uAC12]");
      const bFt = mk("fulltime", "\uC804\uC5C5\uC73C\uB85C \uC2DC\uC791 \u2014 \uC720\uC785 \uBD80\uC7AC \xB7 \uD22C\uC790 \uC0C1\uD55C \uC5C6\uC74C [\uAC8C\uC784\uAC12]");
      const consent = document.getElementById("game-living-consent");
      consent.onchange = () => {
        bJob.disabled = bFt.disabled = !consent.checked;
      };
      document.getElementById("portfolio").innerHTML = "";
    }
    function nextTurn() {
      if (CASH_MODE && state.cashEvents.rows.some((r) => r.status === "due")) return { kind: "cash-due" };
      if (state.flags.gameOver === "chaos") return { kind: "gameover" };
      if (state.flags.gameOver === "living-fail") return { kind: "living-fail" };
      if (GAME_LIVING && state.gameLivingPendingDue) return { kind: "living-adjust" };
      const finalDeferred = DATA.events[state.eventIndex];
      const pendingFinalConfirmation = finalDeferred && finalDeferred.event_month && finalDeferred.event_month <= GAME_END && finalDeferred.date.slice(0, 7) <= state.month;
      if (state.month > GAME_END && !state.flags.gameEndShown && !pendingFinalConfirmation) return { kind: "natural-end" };
      if (!SCHOOL_MODE && !GAME_LIVING && state.month > DEMO_END && state.month <= GAME_END && !state.flags.demoEndShown) return { kind: "demo-end" };
      if (state.flags.militaryUntil && state.month >= state.flags.militaryUntil && !state.flags.dischargeShown) {
        return { kind: "discharge" };
      }
      const lev = nextLifeEvent();
      let ev = DATA.events[state.eventIndex];
      while (ev && ev.requires_rules === "core-v4" && !(state.coreRules >= 4)) {
        state.eventIndex++;
        ev = DATA.events[state.eventIndex];
      }
      if (lev && (!ev || lev.date <= ev.date) && lev.date.slice(0, 7) <= state.month) return { kind: "life", event: lev };
      if (ev && ev.date.slice(0, 7) <= state.month) return { kind: ev.kind || "news", event: ev };
      if (settlementDue()) {
        const prev = DATA.events[state.eventIndex - 1];
        const date = prev && prev.date.slice(0, 7) === state.month ? prev.date : state.month + "-01";
        return { kind: "quiet", settlement: true, observationDate: date.length === 10 ? date : date + "-01", observationPostClose: date.length === 10 && !!prev && prev.date === date };
      }
      return { kind: "quiet" };
    }
    function nextLifeEvent() {
      if (GAME_LIVING) return null;
      const b = state.flags.birth;
      if (!b) return null;
      if (!state.flags.lifeDone) state.flags.lifeDone = {};
      const hs = b.hsYear;
      const done = state.flags.lifeDone;
      if (!done.hs1) {
        const d = hs + "-03-02";
        if (d.slice(0, 7) < schoolStartMonth()) {
          if (hs <= 1994 && !state.flags.studyPath && !done.scenarioOffer) {
            return {
              _dynamic: true,
              id: "life-scenario",
              date: "1996-03-01",
              kind: "life",
              card_title: "\uD68C\uADC0 \uC2DC\uC810\uC758 \uC9C4\uB85C \uC774\uB825\uC744 \uC815\uD569\uB2C8\uB2E4",
              card_summary: "\uC120\uD0DD\uD55C \uC0DD\uB144\uC740 1996\uB144 \uC774\uC804\uC5D0 \uACE0\uB4F1\uD559\uAD50\uC5D0 \uC9C4\uD559\uD588\uC5B4\uC694. \uC2DC\uC81C\uD488 \uAD6C\uAC04 \uC548\uC5D0\uC11C \uC878\uC5C5\xB7\uCDE8\uC5C5 \uBD84\uAE30\uB97C \uC2DC\uC5F0\uD558\uB824\uBA74 \uC9C4\uD559 \uB8E8\uD2B8\uB85C \uC2DC\uC791\uD558\uB294 \uC2DC\uC5F0\uC6A9 \uC2DC\uB098\uB9AC\uC624\uB97C \uACE0\uB97C \uC218 \uC788\uC5B4\uC694. \uC774\uAC83\uC740 \uD655\uC815\uB41C \uC9C4\uB85C \uC774\uB825\uC774 \uC544\uB2C8\uB77C \uC2DC\uC5F0\uC6A9 \uAC00\uC815\uC774\uC5D0\uC694 [\uC2DC\uC5F0 \uC81C\uC57D].",
              impact_tags: [],
              unlock: null,
              choices: [
                { id: "scenario-study", label: "\uC2DC\uC5F0\uC6A9: 1996\uB144 \uD604\uC7AC \uB300\uD559 \uC7AC\uD559 \uC911\uC73C\uB85C \uC2DC\uC791 (\uC9C4\uD559 \uB8E8\uD2B8 \uAC00\uC815)" },
                { id: "scenario-plain", label: "\uC77C\uBC18 \uC2DC\uC791 \u2014 \uC9C4\uB85C \uC774\uB825 \uBBF8\uC815 (\uC878\uC5C5\xB7\uCDE8\uC5C5 \uBD84\uAE30\uB294 \uC2DC\uC81C\uD488 \uAD6C\uAC04 \uBC16)" }
              ]
            };
          }
          done.hs1 = true;
        } else return {
          _dynamic: true,
          id: "life-hs1",
          date: d,
          kind: "life",
          card_title: "\uACE01, \uC2DC\uAC04\uC744 \uC5B4\uB514\uC5D0 \uC4F8\uAE4C",
          card_summary: "\uACF5\uBD80\uC5D0 \uC9D1\uC911\uD574 \uC9C4\uD559\uC744 \uB178\uB9AC\uAC70\uB098, \uC54C\uBC14\uB85C \uC885\uC7A3\uB3C8\uC744 \uBAA8\uC544 \uC804\uC5C5 \uD22C\uC790\uC758 \uAE38\uB85C \uAC08 \uC218 \uC788\uB2E4. \uC9C4\uB85C\uB9C8\uB2E4 \uD22C\uC790\uC5D0 \uC4F8 \uC2DC\uAC04\uACFC \uC18C\uB4DD\uC774 \uB2EC\uB77C\uC9C4\uB2E4. (\uC77C\uC815\uC740 \uC0DD\uB144\xB7\uD559\uC81C\uC5D0\uC11C \uC0B0\uCD9C)",
          impact_tags: [],
          unlock: null,
          choices: careerCashActive() ? [
            { id: "study", label: "\uACF5\uBD80 \uC9D1\uC911 \u2014 \uC9C4\uD559 \uB8E8\uD2B8 (\uC7AC\uD559 \uD559\uBE44 3\xB79\uC6D4 " + CCV.TUITION_PER_TERM.toLocaleString() + "\uC6D0 \xB7 \uCDE8\uC5C5 \uAE09\uC5EC \uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\uC6D0 [\uC124\uACC4\uAC12])" },
            { id: "parttime", label: "\uC54C\uBC14 \uBCD1\uD589 \u2014 " + albaWonPhrase() + "\uC73C\uB85C \uC885\uC7A3\uB3C8\uC744 \uBAA8\uC544 \uC804\uC5C5 \uD22C\uC790 \uB8E8\uD2B8" }
          ] : [
            { id: "study", label: "\uACF5\uBD80 \uC9D1\uC911 \u2014 \uC9C4\uD559 \uB8E8\uD2B8 (\uC878\uC5C5\xB7\uCDE8\uC5C5 \uD6C4 \uC21C\uC800\uCD95 \uC2DC\uD5D8\uAC12)" },
            { id: "parttime", label: "\uC54C\uBC14 \uBCD1\uD589 \u2014 \uC885\uC7A3\uB3C8\uC744 \uBAA8\uC544 \uC804\uC5C5 \uD22C\uC790 \uB8E8\uD2B8" }
          ]
        };
      }
      if (SCHOOL_MODE && !CAREER_TRIAL && !CASH_MODE && state.flags.academicTrackV1 && state.flags.studyPath === "study" && !state.flags.gameOver && state.flags.birth) {
        const hsA = state.flags.birth.hsYear;
        if (!state.academic && !done.acadPolicy) {
          return {
            _dynamic: true,
            id: "life-acad-policy",
            date: state.month + "-02",
            kind: "life",
            card_title: "\uC7AC\uD559 \uC911 \uC2DC\uAC04 \uBC30\uBD84 \uBC29\uCE68\uC744 \uC815\uD55C\uB2E4",
            card_summary: "\uACF5\uBD80\uC5D0 \uC9D1\uC911\uD558\uBA74 \uC9C4\uD559 \uAE30\uC900 \uB3C4\uB2EC\uC774 \uD655\uC815\uB418\uACE0, \uC54C\uBC14\uB97C \uBCD1\uD589\uD558\uBA74 " + albaWonPhrase() + "\uC758 \uC885\uC7A3\uB3C8\uC744 \uBAA8\uC73C\uC9C0\uB9CC \uC9C4\uD559 \uAE30\uC900 \uBBF8\uB2EC\uC774 \uD655\uC815\uB41C\uB2E4. \uC2E4\uC81C \uD559\uC5C5\xB7\uC785\uC2DC\xB7\uADFC\uB85C \uBAA8\uD615\uC774 \uC544\uB2C8\uB77C \uAC8C\uC784 \uAC00\uC815 [\uC2DC\uD5D8\uADDC\uCE59]\uC774\uB2E4. \uBC29\uCE68\uC740 \uACE03 3\uC6D4\uC5D0 \uD55C \uBC88 \uB2E4\uC2DC \uBCFC \uC218 \uC788\uB2E4. \uC878\uC5C5\uAE4C\uC9C0 " + monthsBetween(state.month, hsA + 3 + "-02") + "\uAC1C\uC6D4 \uB204\uC801 \uAE30\uC900\uC73C\uB85C \uACF5\uBD80 \uC9D1\uC911\uC774\uBA74 " + monthsBetween(state.month, hsA + 3 + "-02") * 2 + ", \uC54C\uBC14 \uBCD1\uD589\uC774\uBA74 " + monthsBetween(state.month, hsA + 3 + "-02") + " \u2014 \uC9C4\uD559 \uAE30\uC900 " + ACAD_ADMIT_MIN + " [\uC784\uC758 \uC2DC\uD5D8\uAC12]\uC5D0 \uB300\uD574 \uACF5\uBD80 \uC9D1\uC911\uC740 \uB3C4\uB2EC, \uC54C\uBC14 \uBCD1\uD589\uC740 \uBBF8\uB2EC\uC774 \uC815\uD574\uC9C4 \uAD6C\uC870\uB2E4 [\uC2DC\uD5D8\uADDC\uCE59 \uACC4\uC0B0 \xB7 \uC2E4\uC81C \uC785\uC2DC \uC544\uB2D8].",
            impact_tags: [],
            unlock: null,
            choices: [
              { id: "acad-focus", label: "\uACF5\uBD80 \uC9D1\uC911 \u2014 \uC218\uC785 0\uC6D0 \xB7 \uC9C4\uD559 \uAE30\uC900 \uB3C4\uB2EC \uD655\uC815 [\uC2DC\uD5D8\uADDC\uCE59]" },
              { id: "acad-balanced", label: "\uC54C\uBC14 \uBCD1\uD589 \u2014 " + albaWonPhrase() + " \xB7 \uC9C4\uD559 \uAE30\uC900 \uBBF8\uB2EC \uD655\uC815 [\uC2DC\uD5D8\uADDC\uCE59]" }
            ]
          };
        }
        if (state.academic && !state.flags.academicStatus && !done.acadBoundaryHs3 && hsA + 2 + "-03" <= state.month) {
          if (!state.acadRules) {
            return {
              _dynamic: true,
              id: "life-acad-hs3",
              date: hsA + 2 + "-03-02",
              kind: "life",
              card_title: "\uACE03, \uB9C8\uC9C0\uB9C9 1\uB144\uC758 \uBC29\uCE68",
              card_summary: "\uC9C0\uAE08\uAE4C\uC9C0\uC758 \uB204\uC801 \uB178\uB825\uC740 " + state.academic.effort + " [\uC2DC\uD5D8\uADDC\uCE59 \uB204\uC801]. \uC9C4\uD559 \uAE30\uC900\uC740 " + ACAD_ADMIT_MIN + " [\uC784\uC758 \uC2DC\uD5D8\uAC12]. \uBC29\uCE68\uC744 \uBC14\uAFB8\uBA74 \uB0A8\uC740 \uAE30\uAC04\uC758 \uB204\uC801 \uC18D\uB3C4\uC640 \uC54C\uBC14 \uC218\uC785\uC774 \uBC14\uB010\uB2E4. \uC2E4\uC81C \uC785\uC2DC\uAC00 \uC544\uB2CC \uAC8C\uC784 \uAC00\uC815\uC774\uB2E4.",
              impact_tags: [],
              unlock: null,
              choices: [
                { id: "acad-keep", label: "\uD604\uC7AC \uBC29\uCE68 \uC720\uC9C0 (" + (state.academic.policy === "focus" ? "\uACF5\uBD80 \uC9D1\uC911" : "\uC54C\uBC14 \uBCD1\uD589") + ")" },
                { id: state.academic.policy === "focus" ? "acad-balanced" : "acad-focus", label: state.academic.policy === "focus" ? "\uC54C\uBC14 \uBCD1\uD589\uC73C\uB85C \uC804\uD658 \u2014 " + albaWonPhrase() : "\uACF5\uBD80 \uC9D1\uC911\uC73C\uB85C \uC804\uD658 \u2014 \uC218\uC785 0\uC6D0" }
              ]
            };
          }
          const remain = monthsBetween(state.month, hsA + 3 + "-02");
          const maxFocus = state.academic.effort + remain * 2, maxBal = state.academic.effort + remain;
          const nowFocus = state.academic.policy === "focus";
          const keepMax = nowFocus ? maxFocus : maxBal, switchMax = nowFocus ? maxBal : maxFocus;
          const keepPass = keepMax >= ACAD_ADMIT_MIN, switchPass = switchMax >= ACAD_ADMIT_MIN;
          let sum = "\uD604\uC7AC \uB204\uC801 " + state.academic.effort + " [\uC2DC\uD5D8\uADDC\uCE59 \uB204\uC801] \xB7 \uC9C4\uD559 \uD310\uC815\uAE4C\uC9C0 \uB0A8\uC740 " + remain + "\uAC1C\uC6D4 \xB7 \uAE30\uC900 " + ACAD_ADMIT_MIN + " [\uC784\uC758 \uC2DC\uD5D8\uAC12]. \uC9C0\uAE08 \uBC29\uCE68\uC744 \uC720\uC9C0\uD558\uBA74 \uCD5C\uB300 " + keepMax + "\uB85C \uAE30\uC900 " + (keepPass ? "\uB3C4\uB2EC" : "\uBBF8\uB2EC") + "\uC774 \uC815\uD574\uC838 \uC788\uB2E4. \uC2E4\uC81C \uC785\uC2DC\uAC00 \uC544\uB2CC \uAC8C\uC784 \uAC00\uC815 [\uC2DC\uD5D8\uADDC\uCE59 \uACC4\uC0B0].";
          const ch = [{ id: "acad-keep", label: "\uD604\uC7AC \uBC29\uCE68 \uC720\uC9C0 (" + (nowFocus ? "\uACF5\uBD80 \uC9D1\uC911" : "\uC54C\uBC14 \uBCD1\uD589") + ") \u2014 \uC608\uC0C1 \uB204\uC801 " + keepMax + " \xB7 \uAE30\uC900 " + (keepPass ? "\uB3C4\uB2EC" : "\uBBF8\uB2EC") }];
          if (nowFocus) {
            ch.push({ id: "acad-balanced", label: "\uC54C\uBC14 \uBCD1\uD589\uC73C\uB85C \uC804\uD658 \u2014 " + albaWonPhrase() + " \xB7 \uC608\uC0C1 \uB204\uC801 " + switchMax + " \xB7 \uAE30\uC900 " + (switchPass ? "\uB3C4\uB2EC" : "\uBBF8\uB2EC\uB85C \uBC14\uB01C") });
          } else if (switchPass) {
            ch.push({ id: "acad-focus", label: "\uACF5\uBD80 \uC9D1\uC911\uC73C\uB85C \uC804\uD658 \u2014 \uC218\uC785 0\uC6D0 \xB7 \uC608\uC0C1 \uB204\uC801 " + switchMax + " \xB7 \uAE30\uC900 \uB3C4\uB2EC \uAC00\uB2A5" });
          } else {
            sum += " \uC774\uC81C \uACF5\uBD80\uC5D0\uB9CC \uC9D1\uC911\uD574\uB3C4 \uCD5C\uB300 " + switchMax + "\uB77C \uC774\uBC88 \uAE30\uC900\uC5D0\uB294 \uB2FF\uC9C0 \uC54A\uC544, \uC9D1\uC911 \uC804\uD658 \uC120\uD0DD\uC9C0\uB294 \uB450\uC9C0 \uC54A\uB294\uB2E4. \uC54C\uBC14 \uC218\uC785\uC740 \uACC4\uC18D\uB41C\uB2E4.";
          }
          return {
            _dynamic: true,
            id: "life-acad-hs3",
            date: hsA + 2 + "-03-02",
            kind: "life",
            card_title: "\uACE03, \uB9C8\uC9C0\uB9C9 1\uB144\uC758 \uBC29\uCE68",
            card_summary: sum,
            impact_tags: [],
            unlock: null,
            choices: ch
          };
        }
        if (state.academic && !state.flags.academicStatus && !done.admitResult && hsA + 3 + "-02" <= state.month) {
          const pass = state.academic.effort >= ACAD_ADMIT_MIN;
          return {
            _dynamic: true,
            id: "life-admit-result",
            date: hsA + 3 + "-02-15",
            kind: "life",
            card_title: pass ? "\uB300\uD559\uC5D0 \uD569\uACA9\uD588\uB2E4 [\uC2DC\uD5D8\uADDC\uCE59 \uD310\uC815]" : "\uC9C4\uD559 \uAE30\uC900 \uBBF8\uB2EC \u2014 \uC9C4\uB85C\uAC00 \uBC14\uB010\uB2E4 [\uC2DC\uD5D8\uADDC\uCE59 \uD310\uC815]",
            card_summary: "\uB204\uC801 \uB178\uB825 " + state.academic.effort + " / \uAE30\uC900 " + ACAD_ADMIT_MIN + " [\uC784\uC758 \uC2DC\uD5D8\uAC12]. " + (pass ? "\uAE30\uC874 \uD750\uB984\uB300\uB85C \uB300\uD559\uC5D0 \uC9C4\uD559\uD55C\uB2E4." : "\uC54C\uBC14\xB7\uC804\uC5C5 \uB8E8\uD2B8\uB85C \uC804\uD658\uB41C\uB2E4. \uC774 \uD310\uC815\uC740 \uC2E4\uC81C \uC785\uC2DC\uAC00 \uC544\uB2C8\uB77C \uAC8C\uC784 \uAC00\uC815\uC774\uB2E4."),
            impact_tags: [],
            unlock: null,
            choices: [{ id: "acad-admit-ok", label: pass ? "\uB300\uD559 \uC9C4\uD559 (\uAE30\uC874 \uD750\uB984)" : "\uC54C\uBC14\xB7\uC804\uC5C5 \uB8E8\uD2B8\uB85C \uC9C4\uD589" }]
          };
        }
        if (state.acadRules === 3 && state.flags.academicStatus === "college") {
          const colRate = () => state.colPolicy === "balanced" ? 0.5 : 1;
          const colRemain = () => Math.max(0, 48 - (state.flags.enrolledMonths || 0));
          const colServiceNote = !state.flags.militaryStart && !state.flags.dischargeShown && state.flags.enlistAt ? " \uC785\uB300 \uC608\uC815 " + state.flags.enlistAt + "\uBD80\uD130 26\uAC1C\uC6D4 \uBCF5\uBB34[\uC2DC\uD5D8 \uAC00\uC815]\uB97C \uBC18\uC601\uD55C \uC608\uC0C1\uC774\uB2E4(\uC720\uC608 \uC120\uD0DD \uC2DC \uADF8\uB9CC\uD07C \uC9C0\uC5F0). " : "";
          const colGradAt = (rate) => {
            let e = state.flags.enrolledMonths || 0, m = state.month, guard = 0;
            const enlist = !state.flags.militaryStart && !state.flags.dischargeShown ? state.flags.enlistAt : null;
            const mEnd = enlist ? addMonths(enlist, 26) : null;
            while (e < 48 && guard++ < 400) {
              m = addMonths(m, 1);
              const serving = enlist && m > enlist && m < mEnd;
              if (!serving) e += rate;
            }
            return m;
          };
          const albaWon = albaWonPhrase();
          if (!state.colPolicy && !done.acadColPolicy) {
            return {
              _dynamic: true,
              id: "life-acad-col-policy",
              date: state.month + "-02",
              kind: "life",
              card_title: "\uB300\uD559\uC5D0\uC11C\uC758 \uC2DC\uAC04 \uBC30\uBD84 \uBC29\uCE68\uC744 \uC815\uD55C\uB2E4",
              card_summary: "\uD559\uC5C5\uC5D0 \uC9D1\uC911\uD558\uBA74 \uC7AC\uD559 \uB204\uC801\uC774 \uC6D4 1\uB85C \uC313\uC5EC \uC878\uC5C5 \uC694\uAC74 48\uAC1C\uC6D4\uC5D0 \uBE68\uB9AC \uB2FF\uACE0, \uC54C\uBC14\uB97C \uBCD1\uD589\uD558\uBA74 " + albaWon + "\uC744 \uBAA8\uC73C\uC9C0\uB9CC \uC7AC\uD559 \uB204\uC801\uC774 \uC6D4 0.5\uB77C \uC878\uC5C5\uC774 \uADF8\uB9CC\uD07C \uB2A6\uC5B4\uC9C4\uB2E4. \uC5B4\uB290 \uCABD\uB3C4 \uC2E4\uD328\uAC00 \uC544\uB2CC \uC2DC\uAC04\uACFC \uC218\uC785\uC758 \uBC30\uBD84\uC774\uB2E4. \uC2E4\uC81C \uD559\uC81C\xB7\uADFC\uB85C \uBAA8\uD615\uC774 \uC544\uB2C8\uB77C \uAC8C\uC784 \uAC00\uC815 [\uC2DC\uD5D8\uADDC\uCE59]. \uBC29\uCE68\uC740 \uC804\uC5ED \uBCF5\uD559 \uB54C\uC640 3\uD559\uB144 \uC2DC\uC791 \uB54C \uB2E4\uC2DC \uBCFC \uC218 \uC788\uB2E4. " + colServiceNote + "\uC9C0\uAE08 \uAE30\uC900\uC73C\uB85C \uD559\uC5C5 \uC911\uC2EC\uC774\uBA74 \uC878\uC5C5 \uC608\uC0C1 " + colGradAt(1) + ", \uC54C\uBC14 \uBCD1\uD589\uC774\uBA74 \uC878\uC5C5 \uC608\uC0C1 " + colGradAt(0.5) + " [\uC2DC\uD5D8\uADDC\uCE59 \uACC4\uC0B0 \xB7 \uC2E4\uC81C \uD559\uC81C \uC544\uB2D8].",
              impact_tags: [],
              unlock: null,
              choices: [
                { id: "acadcol-focus", label: "\uD559\uC5C5 \uC911\uC2EC \u2014 \uC218\uC785 0\uC6D0 \xB7 \uC878\uC5C5 \uC608\uC0C1 " + colGradAt(1) + " [\uC2DC\uD5D8\uADDC\uCE59 \uACC4\uC0B0]" },
                { id: "acadcol-balanced", label: "\uC54C\uBC14 \uBCD1\uD589 \u2014 " + albaWon + " \xB7 \uC878\uC5C5 \uC608\uC0C1 " + colGradAt(0.5) + "\uB85C \uC9C0\uC5F0" }
              ]
            };
          }
          if (state.colPolicy && !done.acadColReturn && state.flags.militaryStart && state.flags.dischargeShown) {
            const bal = state.colPolicy === "balanced";
            const keepG = colGradAt(colRate()), swG = colGradAt(bal ? 1 : 0.5);
            return {
              _dynamic: true,
              id: "life-acad-col-return",
              date: state.month + "-02",
              kind: "life",
              card_title: "\uBCF5\uD559, \uC2DC\uAC04 \uBC30\uBD84\uC744 \uB2E4\uC2DC \uC815\uD55C\uB2E4",
              card_summary: "\uD604\uC7AC \uC7AC\uD559 \uB204\uC801 " + (state.flags.enrolledMonths || 0) + "\uAC1C\uC6D4 \xB7 \uC878\uC5C5 \uC694\uAC74 48\uAC1C\uC6D4\uAE4C\uC9C0 \uB0A8\uC740 " + colRemain() + "\uAC1C\uC6D4 [\uC2DC\uD5D8\uADDC\uCE59 \uB204\uC801]. \uC9C0\uAE08 \uBC29\uCE68(" + (bal ? "\uC54C\uBC14 \uBCD1\uD589" : "\uD559\uC5C5 \uC911\uC2EC") + ")\uC744 \uC720\uC9C0\uD558\uBA74 \uC878\uC5C5 \uC608\uC0C1 " + keepG + ", " + (bal ? "\uD559\uC5C5 \uC911\uC2EC\uC73C\uB85C \uBC14\uAFB8\uBA74 \uC878\uC5C5 \uC608\uC0C1 " + swG + "\uB85C \uC55E\uB2F9\uACA8\uC9C0\uACE0 \uC218\uC785\uC774 \uB04A\uAE34\uB2E4" : "\uC54C\uBC14 \uBCD1\uD589\uC73C\uB85C \uBC14\uAFB8\uBA74 " + albaWon + "\uC744 \uBAA8\uC73C\uC9C0\uB9CC \uC878\uC5C5 \uC608\uC0C1 " + swG + "\uB85C \uB2A6\uC5B4\uC9C4\uB2E4") + ". \uC2E4\uC81C \uD559\uC81C\uAC00 \uC544\uB2CC \uAC8C\uC784 \uAC00\uC815 [\uC2DC\uD5D8\uADDC\uCE59 \uACC4\uC0B0].",
              impact_tags: [],
              unlock: null,
              choices: [
                { id: "acadcol-keep-return", label: "\uD604\uC7AC \uBC29\uCE68 \uC720\uC9C0 (" + (bal ? "\uC54C\uBC14 \uBCD1\uD589" : "\uD559\uC5C5 \uC911\uC2EC") + ") \u2014 \uC878\uC5C5 \uC608\uC0C1 " + keepG },
                { id: "acadcol-switch-return", label: bal ? "\uD559\uC5C5 \uC911\uC2EC\uC73C\uB85C \uC804\uD658 \u2014 \uC218\uC785 0\uC6D0 \xB7 \uC878\uC5C5 \uC608\uC0C1 " + swG : "\uC54C\uBC14 \uBCD1\uD589\uC73C\uB85C \uC804\uD658 \u2014 " + albaWon + " \xB7 \uC878\uC5C5 \uC608\uC0C1 " + swG }
              ]
            };
          }
          if (state.colPolicy && !done.acadColY3 && (state.flags.enrolledMonths || 0) >= 24) {
            const bal = state.colPolicy === "balanced";
            const keepG = colGradAt(colRate()), swG = colGradAt(bal ? 1 : 0.5);
            return {
              _dynamic: true,
              id: "life-acad-col-y3",
              date: state.month + "-02",
              kind: "life",
              card_title: "3\uD559\uB144, \uB0A8\uC740 \uAE30\uAC04\uC758 \uBC29\uCE68\uC744 \uB2E4\uC2DC \uBCF8\uB2E4",
              card_summary: "\uD604\uC7AC \uC7AC\uD559 \uB204\uC801 " + (state.flags.enrolledMonths || 0) + "\uAC1C\uC6D4 \xB7 \uC878\uC5C5 \uC694\uAC74 48\uAC1C\uC6D4\uAE4C\uC9C0 \uB0A8\uC740 " + colRemain() + "\uAC1C\uC6D4 [\uC2DC\uD5D8\uADDC\uCE59 \uB204\uC801]. \uC9C0\uAE08 \uBC29\uCE68(" + (bal ? "\uC54C\uBC14 \uBCD1\uD589" : "\uD559\uC5C5 \uC911\uC2EC") + ")\uC744 \uC720\uC9C0\uD558\uBA74 \uC878\uC5C5 \uC608\uC0C1 " + keepG + ", " + (bal ? "\uD559\uC5C5 \uC911\uC2EC\uC73C\uB85C \uBC14\uAFB8\uBA74 \uC878\uC5C5 \uC608\uC0C1 " + swG + "\uB85C \uC55E\uB2F9\uACA8\uC9C0\uACE0 \uC218\uC785\uC774 \uB04A\uAE34\uB2E4" : "\uC54C\uBC14 \uBCD1\uD589\uC73C\uB85C \uBC14\uAFB8\uBA74 " + albaWon + "\uC744 \uBAA8\uC73C\uC9C0\uB9CC \uC878\uC5C5 \uC608\uC0C1 " + swG + "\uB85C \uB2A6\uC5B4\uC9C4\uB2E4") + ". \uC2E4\uC81C \uD559\uC81C\uAC00 \uC544\uB2CC \uAC8C\uC784 \uAC00\uC815 [\uC2DC\uD5D8\uADDC\uCE59 \uACC4\uC0B0].",
              impact_tags: [],
              unlock: null,
              choices: [
                { id: "acadcol-keep-y3", label: "\uD604\uC7AC \uBC29\uCE68 \uC720\uC9C0 (" + (bal ? "\uC54C\uBC14 \uBCD1\uD589" : "\uD559\uC5C5 \uC911\uC2EC") + ") \u2014 \uC878\uC5C5 \uC608\uC0C1 " + keepG },
                { id: "acadcol-switch-y3", label: bal ? "\uD559\uC5C5 \uC911\uC2EC\uC73C\uB85C \uC804\uD658 \u2014 \uC218\uC785 0\uC6D0 \xB7 \uC878\uC5C5 \uC608\uC0C1 " + swG : "\uC54C\uBC14 \uBCD1\uD589\uC73C\uB85C \uC804\uD658 \u2014 " + albaWon + " \xB7 \uC878\uC5C5 \uC608\uC0C1 " + swG }
              ]
            };
          }
        }
      }
      if (!done.college && state.flags.studyPath === "study") {
        if (state.flags.academicStatus === "college" && (state.flags.enrolledMonths || 0) >= 48 && !militaryActive()) {
          return {
            _dynamic: true,
            id: "life-grad",
            date: state.month + "-15",
            kind: "life",
            card_title: "\uB300\uD559 \uC878\uC5C5\uC744 \uC55E\uB450\uACE0 \uC9C4\uB85C\uB97C \uC815\uD55C\uB2E4",
            card_summary: careerCashActive() ? "\uCDE8\uC5C5\uD560\uC9C0, \uC804\uC5C5 \uD22C\uC790\uB85C \uB098\uC124\uC9C0 \uC815\uD55C\uB2E4. \uBCF5\uBB34 \uD734\uD559\uC73C\uB85C \uB2A6\uC5B4\uC9C4 \uACBD\uC6B0 \uADF8\uB9CC\uD07C \uB4A4\uC758 \uC77C\uC815\uC774\uC5D0\uC694. \uCDE8\uC5C5\uC744 \uACE0\uB974\uBA74 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uAE09\uC5EC \uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\uC6D0\uC774 \uB4E4\uC5B4\uC624\uACE0 \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0\uC774 \uB098\uAC11\uB2C8\uB2E4 [\uBA85\uC2DC \uAC8C\uC784\uC124\uACC4\uAC12]. \uC804\uC5C5\uC740 \uAE09\uC5EC \uC5C6\uC774 \uC0DD\uD65C\uBE44\uAC00 \uACC4\uC18D \uB098\uAC00\uACE0, \uC7AC\uD559 \uC911 \uBBF8\uB0A9 \uD559\uBE44\uAC00 \uC788\uC73C\uBA74 \uC0C1\uD658\uD574\uC57C \uD569\uB2C8\uB2E4." : "\uCDE8\uC5C5\uD560\uC9C0, \uC804\uC5C5 \uD22C\uC790\uB85C \uB098\uC124\uC9C0 \uC815\uD55C\uB2E4. \uBCF5\uBB34 \uD734\uD559\uC73C\uB85C \uB2A6\uC5B4\uC9C4 \uACBD\uC6B0 \uADF8\uB9CC\uD07C \uB4A4\uC758 \uC77C\uC815\uC774\uC5D0\uC694. \uCDE8\uC5C5\uC744 \uACE0\uB974\uBA74 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 \uC21C\uC800\uCD95\uC744 \uB354\uD569\uB2C8\uB2E4 [\uC2DC\uD5D8\uC6A9 \uC124\uACC4\uAC12]. \uC2E4\uC81C \uAE09\uC5EC \uC218\uC785\uACFC \uC9C0\uCD9C\uC744 \uB098\uB220 \uACC4\uC0B0\uD558\uB294 \uBAA8\uD615\uC740 \uC544\uC9C1 \uC5C6\uC5B4\uC694.",
            impact_tags: [],
            unlock: null,
            choices: careerCashActive() ? [
              { id: "job", label: "\uCDE8\uC5C5 \u2014 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uAE09\uC5EC \uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\uC6D0 \xB7 \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0 [\uC124\uACC4\uAC12]" },
              { id: "fulltime", label: "\uC804\uC5C5 \uD22C\uC790 \u2014 \uC218\uC785 0\uC6D0 \xB7 \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0 \uCC28\uAC10 [\uC124\uACC4\uAC12]" }
            ] : [
              { id: "job", label: "\uCDE8\uC5C5 \u2014 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 \uC21C\uC800\uCD95 [\uC2DC\uD5D8\uAC12]" },
              { id: "fulltime", label: "\uC804\uC5C5 \uD22C\uC790 \u2014 \uC815\uAE30 \uC21C\uC800\uCD95 \uC5C6\uC74C [\uC0DD\uD65C\uBE44 \uBBF8\uAD6C\uD604]" }
            ]
          };
        }
      }
      if (state.flags.studyPath === "parttime") done.college = true;
      if (!done.enlist && state.flags.enlistAt) {
        const d = state.flags.enlistAt + "-01";
        if (d.slice(0, 7) < schoolStartMonth()) done.enlist = true;
        else return {
          _dynamic: true,
          id: "life-enlist",
          date: d,
          kind: "life",
          card_title: "\uC785\uC601 \uD1B5\uC9C0\uC11C\uAC00 \uB3C4\uCC29\uD588\uB2E4",
          card_summary: "\uC785\uB300 \uC2DC\uC810\uC744 \uC815\uD574\uC57C \uD55C\uB2E4. \uBCF5\uBB34 \uC911\uC5D0\uB294 \uC2DC\uC7A5 \uB300\uC751\uC774 \uC81C\uD55C\uB418\uACE0, \uC804\uC5ED\uD558\uBA74 \uADF8\uB3D9\uC548\uC758 \uC2DC\uC7A5 \uD750\uB984\uC744 \uC815\uB9AC\uD574 \uBC1B\uB294\uB2E4.",
          impact_tags: [],
          unlock: null,
          choices: [
            { id: "go-now", label: "\uBC14\uB85C \uC785\uB300 (\uC721\uAD70 \uAC00\uC815 \xB7 \uB2F9\uC2DC \uADDC\uC815 26\uAC1C\uC6D4)" },
            { id: "defer-1y", label: "1\uB144 \uC720\uC608 [\uC2DC\uD5D8\uC6A9 \uAC00\uC815 \u2014 \uC720\uC608 \uADDC\uC815 \uBBF8\uAC80\uC99D]" }
          ]
        };
      }
      return null;
    }
    function priceAt(series, month) {
      const isCurrent = effDate && month === effDate.slice(0, 7);
      const cutoff = isCurrent ? effDate : month + "-31";
      const pts = DATA.prices.filter((p) => {
        if (p.series !== series) return false;
        if (!GAME_LIVING && p.model === "b-monthly-2019q3") return false;
        if (p.uncertain) return false;
        if (p.unverified) return false;
        if (p.usable_from) return p.usable_from <= cutoff;
        if (!isCurrent) return p.date <= cutoff;
        return effPostClose ? p.date <= cutoff : p.date < cutoff;
      });
      return pts.length ? pts[pts.length - 1] : null;
    }
    function fmtPtDate(pt) {
      if (pt && pt.official_ecos_source && /^\d{8}$/.test(pt.official_ecos_source.observed_date)) {
        const d = pt.official_ecos_source.observed_date;
        const kind = d.slice(4, 8) === "1231" ? "\uC5F0\uB9D0" : "\uC6D4\uB9D0";
        return d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8) + " (" + kind + " \uAD00\uCE21\uC77C \xB7 \uC774\uC6A9\uAC8C\uC774\uD2B8 \uC720\uC9C0)";
      }
      return pt && pt.date_precision === "year" ? pt.date.slice(0, 4) + "\uB144\uB9D0(\uAC70\uB798\uC77C \uBBF8\uD655\uC778)" : pt ? pt.date : "";
    }
    function productDisplayRecord(u) {
      const pt = u && u.product === "fx" ? priceAt("fx", state.month) : null;
      if (pt && pt.date_policy === "day_after_observed_article_day_conservative_demo") return { ...u, rule_note: "[\uC2DC\uC5F0: \uC678\uD654 \uD604\uAE08 \uBCF4\uC720 \xB7 \uC774\uC790 \uBBF8\uAD6C\uD604] ECOS \uC6D4\uB9D0 \uC885\uAC00\uC640 \uB2F9\uC2DC \uBCF4\uB3C4\uB97C \uB300\uC870\uD55C \uD604\uC7AC \uBCF4\uAD00\uC790\uB8CC. \uB2F9\uC2DC \uC885\uAC00\uC2DC\uAC01\xB7\uCD5C\uCD08\uACF5\uD45C\xB7\uC6D0\uBE48\uD2F0\uC9C0\uB294 \uBBF8\uD655\uC815\uC774\uBA70 \uAE30\uC0AC\uC77C \uB2E4\uC74C \uB0A0\uBD80\uD130 \uC774\uC6A9\uD558\uB294 \uBCF4\uC218\uC801 \uAC8C\uC784 \uAC8C\uC774\uD2B8\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uADF8\uB0A0 \uD658\uC804 \uAC00\uB2A5 \uAC00\uACA9\uC774 \uC544\uB2D9\uB2C8\uB2E4." };
      return u;
    }
    function priceAgeNote(pt) {
      if (!pt) return "";
      if (pt.date_policy === "official-monthend-close-plus-two-calendar-days-demo-gate" && ["kospi", "kosdaq"].includes(pt.series)) return "한국거래소 작성 · ECOS 현재 보관자료 · 최초공개시각/원빈티지 미확인 · 관측일+2달력일 게임 게이트 " + pt.usable_from + " · 당시 실제 상품가격·실거래 보장 아님";
      if (pt.date_policy === "day_after_observed_article_day_conservative_demo") return "\uD604\uC7AC ECOS \uBCF4\uAD00\uC790\uB8CC\xB7\uB2F9\uC2DC \uC885\uAC00 \uBCF4\uB3C4 \uB300\uC870 \xB7 \uCD5C\uCD08\uACF5\uD45C\xB7\uC6D0\uBE48\uD2F0\uC9C0\xB7\uB2F9\uC2DC \uC885\uAC00\uC2DC\uAC01 \uBBF8\uD655\uC815 \xB7 \uAE30\uC0AC\uC77C \uB2E4\uC74C \uB0A0 \uC774\uC6A9\uAC8C\uC774\uD2B8 " + pt.usable_from + " \xB7 \uC2E4\uC81C \uAC70\uB798\uAC00 \uC544\uB2D8";
      if (pt.date_precision === "year" && pt.official_ecos_source) return "ECOS(\uD55C\uAD6D\uC740\uD589) \uC5F0\uB9D0 \uB9C8\uC9C0\uB9C9 \uC885\uAC00 \xB7 \uACFC\uAC70 \uCD5C\uCD08\uACF5\uD45C\uC2DC\uC810 \uBBF8\uD655\uC778 \xB7 \uB2E4\uC74C\uD574 \uC774\uC6A9\uAC8C\uC774\uD2B8 \uC720\uC9C0 \xB7 \uB2F9\uC77C \uAC70\uB798\uAC00 \uC544\uB2D8";
      if (pt.date_precision === "year") return "\uC5F0\uB9D0 \uC790\uB8CC \xB7 \uC2E4\uC81C \uAC70\uB798\uC77C \uBBF8\uD655\uC778 \xB7 \uB2F9\uC77C \uAC70\uB798\uAC00 \uC544\uB2D8";
      if (pt.date.length !== 10) return "\uC6D4 \uB2E8\uC704 \uC790\uB8CC \xB7 \uC2E4\uC81C \uAC70\uB798\uC77C \uBBF8\uD655\uC778 \xB7 \uB2F9\uC77C \uAC70\uB798\uAC00 \uC544\uB2D8";
      const d = Date.parse(pt.date + "T00:00:00Z");
      const t = Date.parse(effDate + "T00:00:00Z");
      const age = Math.round((t - d) / 864e5);
      return Number.isFinite(age) && age > 0 ? "\uD310\uB2E8\uC77C\uBCF4\uB2E4 " + age + "\uC77C \uC55E\uC120 \uC790\uB8CC \xB7 \uB2F9\uC77C \uAC70\uB798\uAC00 \uC544\uB2D8" : "\uD655\uBCF4 \uC9C0\uC810\uC774\uBA70 \uC2E4\uC81C \uAC70\uB798\uAC00 \uBCF4\uC7A5\uC740 \uC544\uB2D8";
    }
    function priceGapNote(u) {
      if (!u || u.rule !== "price" && u.rule !== "fxprice" && u.rule !== "fxaccrual") return "";
      const series = u.rule === "fxprice" ? u.series || "sp500" : u.series || u.product;
      const pts = DATA.prices.filter((p) => p.series === series && !p.uncertain && !p.unverified && wasObservableAt(p, effDate, effPostClose)).map((p) => p.date).filter((d) => d.length === 10).sort();
      if (pts.length < 2) return "";
      const recent = pts.slice(-5), gaps = [];
      for (let i = 1; i < recent.length; i++) gaps.push((Date.parse(recent[i] + "T00:00:00Z") - Date.parse(recent[i - 1] + "T00:00:00Z")) / 864e5);
      gaps.sort((x, y) => x - y);
      const med = Math.round(gaps[Math.floor(gaps.length / 2)]);
      if (!Number.isFinite(med) || med <= 0) return "";
      return "\uCD5C\uADFC \uD655\uBCF4 \uC9C0\uC810 \uAC04\uACA9 \uC57D " + med + "\uC77C [\uAD00\uCE21 \uC790\uB8CC \uAE30\uC900 \xB7 \uC55E\uC73C\uB85C\uC758 \uAC04\uACA9 \uBCF4\uC7A5 \uC544\uB2D8]";
    }
    function productRule(p) {
      const u = DATA.unlocks.find((x) => x.product === p);
      return productDisplayRecord(u || {});
    }
    function monthsBetween(a, b) {
      const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number);
      return (yb - ya) * 12 + (mb - ma);
    }
    function convertForeignPointToKrw(assetPoint, fxPoint, cutoff) {
      if (!assetPoint || !fxPoint || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff || "")) return null;
      if (typeof assetPoint.currency !== "string" || assetPoint.currency !== fxPoint.baseCurrency || fxPoint.quoteCurrency !== "KRW") return null;
      if (!Number.isFinite(assetPoint.value) || assetPoint.value <= 0 || !Number.isFinite(fxPoint.value) || fxPoint.value <= 0 || !Number.isFinite(fxPoint.baseUnits) || fxPoint.baseUnits <= 0) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(assetPoint.date || "") || !/^\d{4}-\d{2}-\d{2}$/.test(fxPoint.date || "") || assetPoint.date > cutoff || fxPoint.date > cutoff) return null;
      const krw = assetPoint.value * (fxPoint.value / fxPoint.baseUnits);
      return Number.isFinite(krw) && krw > 0 ? krw : null;
    }
    function fxUnit(month, series) {
      const sp = priceAt(series || "sp500", month);
      const fx = priceAt("fx", month);
      if (!sp || !fx) return null;
      const cutoff = month === state.month ? effDate : month + "-31";
      return convertForeignPointToKrw(
        { value: sp.value, currency: "USD", date: sp.date },
        { value: fx.value, baseCurrency: "USD", quoteCurrency: "KRW", baseUnits: 1, date: fx.date },
        cutoff
      );
    }
    function btcTheoreticalSupply(month) {
      if (!month || month < "2009-01") return null;
      const end = addMonths(month, 1) + "-01";
      const eras = [["2009-01-03", 7200], ["2012-11-28", 3600], ["2016-07-09", 1800], ["2020-05-11", 900], ["2024-04-20", 450]];
      let total = 0;
      for (let i = 0; i < eras.length; i++) {
        const s = eras[i][0], e = i + 1 < eras.length ? eras[i + 1][0] : "9999-12-31";
        const ee = e < end ? e : end;
        if (s >= ee) continue;
        total += Math.round((new Date(ee) - new Date(s)) / 864e5) * eras[i][1];
      }
      return total;
    }
    function holdingValue(p, h, month) {
      const r = productRule(p);
      if (r.rule === "fxprice") {
        const u0 = fxUnit(month, r.series);
        return u0 != null ? Math.round(u0 * h.qty) : Math.round(h.avgPrice * h.qty);
      }
      if (r.rule === "accrual") {
        return Math.round(h.avgPrice * h.qty);
      }
      if (r.rule === "price" || r.rule === "fxaccrual") {
        const pt = priceAt(r.series || p, month);
        return pt ? Math.round(pt.value * h.qty) : Math.round(h.avgPrice * h.qty);
      }
      return Math.round(h.avgPrice * h.qty);
    }
    function holdingPricePoint(p, month) {
      const r = productRule(p);
      if (r.rule === "fxprice") return priceAt(r.series || "sp500", month);
      if (r.rule !== "price" && r.rule !== "fxaccrual") return null;
      return priceAt(r.series || p, month);
    }
    function addMonths(ym, n) {
      let [y, m] = ym.split("-").map(Number);
      m += n;
      while (m > 12) {
        m -= 12;
        y++;
      }
      return y + "-" + String(m).padStart(2, "0");
    }
    function fulltimeActive() {
      if (state.flags.career === "fulltime") return true;
      const b = state.flags.birth;
      return state.flags.career !== "job" && state.flags.studyPath === "parttime" && !!b && state.month >= b.hsYear + 3 + "-03";
    }
    function militaryActive() {
      return state.flags.militaryUntil && state.month < state.flags.militaryUntil;
    }
    function settlementDue() {
      return (state.flags.career === "job" || reservationSettlementDue()) && isSettlementMonth() && state.flags.settledMonth !== state.month;
    }
    function reservationSettlementActive() {
      return state.reservationSettlementRules === 1;
    }
    function reservationSettlementShapeOk(s) {
      return !Object.prototype.hasOwnProperty.call(s, "reservationSettlementRules") || s.reservationSettlementRules === 1 && s.chaosExposureRules === 1 && chaosExposureShapeOk(s);
    }
    function reservationSettlementDue() {
      return reservationSettlementActive() && state.flags.career !== "job" && isSettlementMonth() && state.flags.settledMonth !== state.month && (state.pendingOrders || []).some((o) => o.earliestFillMonth && o.earliestFillMonth <= state.month && (state.flags.settledMonth || "") < o.earliestFillMonth);
    }
    function isSettlementMonth() {
      return ["03", "06", "09", "12"].includes(state.month.slice(5));
    }
    function nextSettlementMonth() {
      if (isSettlementMonth(state.month) && state.flags.settledMonth !== state.month) return state.month;
      let y = Number(state.month.slice(0, 4)), m = Number(state.month.slice(5));
      for (let i = 0; i < 12; i++) {
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
        if ([3, 6, 9, 12].includes(m)) return y + "-" + String(m).padStart(2, "0");
      }
      return y + "-12";
    }
    function reserveObsGate(settleMonth) {
      const sm = settleMonth + "-01";
      if (effDate > sm || effDate === sm && effPostClose) return { obsCutoff: effDate, obsPostClose: effPostClose };
      return { obsCutoff: sm, obsPostClose: false };
    }
    function tradeAccess(turn) {
      if (!albaTimeAvailable()) return { allowed: false, label: "\uC54C\uBC14 \uD22C\uC790 \uC2DC\uAC04 \uC0AC\uC6A9 \uC644\uB8CC \xB7 \uB2E4\uC74C \uB2EC1\uD68C \uBCF5\uC6D0 [\uAC8C\uC784\uADDC\uCE59]" };
      if (schoolDataGap()) return { allowed: false, label: "\uC790\uB8CC\uACF5\uBC31 \uAD6C\uAC04 - \uB9E4\uB9E4 \uCC28\uB2E8 (1996-03 \uC804)" };
      if (!turn || !["news", "quiet"].includes(turn.kind)) return { allowed: false, label: "\uD3C9\uAC00\uB9CC \uD45C\uC2DC \xB7 \uC774 \uD654\uBA74\uC5D0\uC11C\uB294 \uC8FC\uBB38\uD558\uC9C0 \uC54A\uC74C" };
      if (CAREER_TRIAL && state.flags.career === "job" && !turn.settlement) return { allowed: false, label: "\uACC4\uD68D\uD615 \uCDE8\uC5C5: \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uC0C8 \uD22C\uC790\uC8FC\uBB38 \xB7 \uCDE8\uC18C\uAE08\uC740 \uD604\uAE08\uC73C\uB85C \uC989\uC2DC \uBC18\uD658" };
      if (turn.kind === "news") return state.flags.career === "job" ? { allowed: true, reserveOnly: true, label: "\uB274\uC2A4 \uB300\uC751 \uC608\uC57D \uC8FC\uBB38 \u2014 \uB2E4\uAC00\uC624\uB294 \uBD84\uAE30 \uC815\uC0B0 \uC774\uD6C4 \uC801\uACA9 \uAD00\uCE21\uC73C\uB85C \uCCB4\uACB0 \uB300\uAE30 [\uC124\uACC4]" + (militaryActive() ? " \xB7 \uBCF5\uBB34 \uC911 \uB9E4\uC218 \uBE44\uC911 \uC0C1\uD55C 30%" : "") } : { allowed: true, label: "\uB274\uC2A4 \uB300\uC751 \uC8FC\uBB38 \uAC00\uB2A5" + (militaryActive() ? " \xB7 \uBCF5\uBB34 \uC911 \uB9E4\uC218 \uBE44\uC911 \uC0C1\uD55C 30%" : "") };
      if (state.flags.career === "job" && !turn.settlement) return { allowed: false, label: "\uD3C9\uAC00\uB9CC \uD45C\uC2DC \xB7 \uC9C1\uC7A5\uC778\uC740 \uC815\uC0B0 \uC804\uC6A9 \uD134\uC5D0\uC11C \uC8FC\uBB38" };
      return { allowed: true, label: turn.settlement ? "\uC815\uC0B0 \uC804\uC6A9 \uD134 \uC8FC\uBB38 \uAC00\uB2A5" : "\uD3C9\uC628 \uD134 \uB9AC\uBC38\uB7F0\uC2F1 \uAC00\uB2A5" + (militaryActive() ? " \xB7 \uBCF5\uBB34 \uC911 \uB9E4\uC218 \uBE44\uC911 \uC0C1\uD55C 30%" : "") };
    }
    function totalAssets() {
      let t = state.cash;
      for (const [p, h] of Object.entries(state.holdings)) t += holdingValue(p, h, state.month);
      for (const o of state.pendingOrders || []) {
        if (o.kind === "buy") t += o.split && o.split.n > 1 ? o.amount - (o.split.invested || 0) : o.amount;
        else {
          const u = productRule(o.product);
          let unit = null;
          if (u.rule === "fxprice") unit = fxUnit(state.month, u.series);
          else {
            const pt = priceAt(u.series || o.product, state.month);
            unit = pt ? pt.value : null;
          }
          const lockedQty = o.split && o.split.n > 1 ? o.qty - (o.split.soldQty || 0) : o.qty;
          t += Math.round((unit != null ? unit : o.avgPrice) * lockedQty);
        }
      }
      if (propertyActive()) {
        const snap = HomeContract.propertySnapshot(state.property, propertyPrices(propertyValuationMonth()));
        if (!snap.ok) throw Error("property-valuation-unavailable");
        t += snap.total;
      }
      return Math.round(t);
    }
    function vnChapterEligible() {
      return SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL && state.chaosExposureRules === 1 && state.flags?.birth && !storageReadBlocked && !storageWriteBlocked;
    }
    function vnChapterClear() {
      document.getElementById("vn-first-chapter")?.remove();
    }
    function vnChapterPanel(lines, caption, receipt = null, options = {}) {
      vnChapterClear();
      const stage = document.getElementById("vn-stage");
      if (!stage) return;
      const panel = document.createElement("section");
      panel.id = "vn-first-chapter";
      panel.className = "vn-first-chapter";
      panel.setAttribute("aria-label", options.ariaLabel || "\uD68C\uADC0 \uCCAB \uC7A5 \uB300\uC0AC");
      const cap = document.createElement("p");
      cap.className = "vn-chapter-caption";
      cap.textContent = caption;
      const speaker = document.createElement("strong");
      speaker.textContent = "\uB098";
      const speech = document.createElement("p");
      speech.className = "vn-chapter-speech";
      speech.setAttribute("aria-live", "polite");
      const controls = document.createElement("div");
      controls.className = "vn-chapter-controls";
      const next = document.createElement("button");
      next.type = "button";
      next.id = "vn-chapter-next";
      const skip = document.createElement("button");
      skip.type = "button";
      skip.id = "vn-chapter-skip";
      skip.textContent = "\uC5F0\uCD9C \uB2EB\uAE30";
      let index = 0;
      const paint = () => {
        speech.textContent = lines[index];
        next.textContent = index < lines.length - 1 ? "\uB2E4\uC74C \uB300\uC0AC" : options.finishLabel || "\uC120\uD0DD \uD654\uBA74\uC73C\uB85C";
      };
      next.onclick = () => {
        if (index < lines.length - 1) {
          index++;
          paint();
        } else {
          panel.remove();
          document.querySelector("#choices button:not(:disabled)")?.focus();
        }
      };
      skip.onclick = () => {
        panel.remove();
        document.querySelector("#choices button:not(:disabled)")?.focus();
      };
      controls.append(next, skip);
      panel.append(cap, speaker, speech, controls);
      if (receipt) {
        const facts = document.createElement("p");
        facts.className = "vn-chapter-receipt";
        facts.textContent = receipt;
        panel.append(facts);
      }
      stage.after(panel);
      paint();
    }
    function vnChapterBeforeChoice(c, turn) {
      if (!vnChapterEligible()) return null;
      if (turn?.kind === "news" && c.id === "hold" && vnMarket2008Event(turn.event)) return { cid: c.id, market2008: turn.event.id, eventDate: turn.event.date, eventTitle: turn.event.card_title, turnCount: state.turnCount, historyLength: state.history.length, month: state.month };
      if (state.flags.studyPath === "parttime" && state.month === state.flags.birth.hsYear + 3 + "-02" && turn?.kind !== "life" && ["hold", "next", "skip"].includes(c.id)) return { cid: c.id, chapterEnd: true, turnCount: state.turnCount, historyLength: state.history.length, rows: state.cashEvents?.rows?.length || 0, month: state.month };
      if (turn?.kind === "discharge" && c.id === "discharge-ok") return { cid: c.id, service: "discharge", turnCount: state.turnCount, historyLength: state.history.length, rows: state.cashEvents?.rows?.length || 0, month: state.month, start: state.flags.militaryStart, until: state.flags.militaryUntil };
      if (turn?.kind !== "life" || !turn.event?._dynamic) return null;
      if (turn.event.id === "life-enlist" && ["life:go-now", "life:defer-1y"].includes(c.id)) return { cid: c.id.slice(5), service: "enlist", turnCount: state.turnCount, historyLength: state.history.length, rows: state.cashEvents?.rows?.length || 0, month: state.month, enlistAt: state.flags.enlistAt };
      const ids = ["study", "parttime", "acad-focus", "acad-balanced", "acad-keep", "acad-admit-ok"];
      if (turn.event.id === "life-grad" && ["life:job", "life:fulltime"].includes(c.id) && state.flags.academicStatus === "college") return { cid: c.id.slice(5), graduation: true, turnCount: state.turnCount, historyLength: state.history.length, cash: state.cash, rows: state.cashEvents?.rows?.length || 0, month: state.month };
      const cid = c.id.startsWith("life:") ? c.id.slice(5) : "";
      if (["life-acad-col-policy", "life-acad-col-return", "life-acad-col-y3"].includes(turn.event.id) && cid.startsWith("acadcol-")) return { cid, college: true, eventId: turn.event.id, colPolicy: state.colPolicy || null, enrolled: state.flags.enrolledMonths || 0, turnCount: state.turnCount, historyLength: state.history.length, cash: state.cash, rows: state.cashEvents?.rows?.length || 0, month: state.month };
      if (!ids.includes(cid) || state.flags.academicStatus === "graduated") return null;
      return {
        cid,
        turnCount: state.turnCount,
        historyLength: state.history.length,
        cash: state.cash,
        rows: state.cashEvents?.rows?.length || 0,
        month: state.month
      };
    }
    function vnChapterAfterChoice(before) {
      if (!before || !vnChapterEligible() || state.history.length <= before.historyLength || state.turnCount !== before.turnCount + 1) return;
      const last = state.history.at(-1);
      if (last?.choice !== (before.market2008 || before.chapterEnd || before.service === "discharge" ? before.cid : "life:" + before.cid)) return;
      if (before.market2008) {
        const scene = vnMarket2008Event({ id: before.market2008, kind: "news" });
        if (!scene || last.decisionMonth !== before.month) return;
        const showing = document.getElementById("vn-first-chapter");
        if (showing && showing.getAttribute("aria-label") !== "\uD68C\uADC0 2008 \uC2DC\uC7A5\uC0AC\uAC74 \uB300\uC0AC") return;
        vnChapterPanel([scene.hold, "\uC624\uB298 \uC0C8\uB85C \uB9E1\uAE34 \uC218\uB3D9 \uC8FC\uBB38\uC740 \uC5C6\uB2E4. \uBA3C\uC800 \uB9E1\uAE34 \uC8FC\uBB38\uACFC \uC0DD\uD65C\uC740 \uAE30\uC874 \uADDC\uCE59\uB300\uB85C \uC774\uC5B4\uC9C4\uB2E4. \uB2E4\uC74C \uD310\uB2E8\uB3C4 \uB0B4 \uBAAB\uC774\uB2E4."], state.month + " \xB7 \uC2DC\uC7A5\uC758 \uC7A5 / \uAE30\uC0AC \uC55E\uC5D0\uC11C \uC720\uC9C0\uD55C \uC120\uD0DD", "\uC120\uD0DD \uAE30\uB85D \xB7 " + before.eventDate + " " + before.eventTitle + " \xB7 \uD310\uB2E8 \uC6D4 " + before.month + " / \uD604\uC7AC \uC6D4 " + state.month + ". \uC0C8 \uB9E4\uB9E4\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC774\uBA70 \uAE30\uC874 \uC8FC\uBB38 \uCCB4\uACB0\xB7\uC6D4 \uC9C4\uD589\uAE4C\uC9C0 \uBA48\uCD98 \uAC83\uC740 \uC544\uB2D9\uB2C8\uB2E4.", { ariaLabel: "\uD68C\uADC0 2008 \uC720\uC9C0 \uBC18\uC751 \uB300\uC0AC", finishLabel: "\uD604\uC7AC \uD654\uBA74\uC73C\uB85C" });
        return;
      }
      if (before.chapterEnd && state.month !== state.flags.birth.hsYear + 3 + "-03") return;
      if (before.service) {
        const discharge = before.service === "discharge", deferred = before.cid === "defer-1y";
        if (discharge ? !state.flags.dischargeShown || state.flags.militaryUntil !== null : deferred ? !state.flags.deferredUsed || state.flags.enlistAt === before.enlistAt : !state.flags.militaryStart || !state.flags.militaryUntil) return;
        const rows = (state.cashEvents?.rows || []).slice(before.rows);
        const receipt2 = rows.length ? rows.map((r) => r.month + " \uC218\uC785 " + r.income.toLocaleString() + "\uC6D0 \xB7 \uCCAD\uAD6C " + (r.living + r.tuition).toLocaleString() + "\uC6D0 \xB7 \uB0A9\uBD80 " + r.paid.toLocaleString() + "\uC6D0").join(" / ") : "\uC0C8 \uC6D4 \uD604\uAE08\uC0AC\uAC74 \uC5C6\uC74C";
        const lines = discharge ? ["\uBC16\uC73C\uB85C \uB3CC\uC544\uC654\uB2E4. \uBE44\uC6CC \uB454 \uC2DC\uAC04\uB9CC\uD07C, \uC9C0\uAE08 \uB0B4 \uC0DD\uD65C\uC774 \uC5B4\uB514\uC5D0 \uC11C \uC788\uB294\uC9C0\uBD80\uD130 \uC0B4\uD3B4\uBCF4\uC790.", state.flags.academicStatus === "college" ? "\uB0A8\uC740 \uB300\uD559 \uC0DD\uD65C\uB85C \uB3CC\uC544\uAC04\uB2E4. \uBCF5\uD559 \uB4A4 \uC2DC\uAC04 \uBC30\uBD84\uC740 \uB2E4\uC74C \uAC08\uB9BC\uAE38\uC5D0\uC11C \uB2E4\uC2DC \uC815\uD55C\uB2E4." : "\uBCF5\uBB34\uAC00 \uB05D\uB0AC\uB2E4\uACE0 \uC0DD\uD65C\uC774 \uC800\uC808\uB85C \uC815\uB9AC\uB418\uC9C0\uB294 \uC54A\uB294\uB2E4. \uB0A8\uC740 \uD604\uAE08\uACFC \uCCAD\uAD6C, \uBCF4\uC720 \uC790\uC0B0\uBD80\uD130 \uD655\uC778\uD558\uC790."] : deferred ? ["\uC785\uB300\uB97C \uBBF8\uB918\uB2E4. \uADF8\uB3D9\uC548 \uBB34\uC5C7\uC744 \uD560\uC9C0, \uB0A8\uACA8 \uB454 \uC2DC\uAC04\uC5D0 \uCC45\uC784\uC838\uC57C \uD55C\uB2E4.", "\uC720\uC608\uAC00 \uBE5A\uC774\uB098 \uD559\uBE44\uB97C \uC5C6\uC560 \uC8FC\uC9C0\uB294 \uC54A\uB294\uB2E4. \uB2E4\uC74C \uC77C\uC815\uAE4C\uC9C0 \uC774\uC5B4\uC9C8 \uC0DD\uD65C\uC744 \uB2E4\uC2DC \uBCF4\uC790."] : ["\uC9D0\uC744 \uCC59\uACBC\uB2E4. \uC774\uC81C \uD55C\uB3D9\uC548\uC740 \uC2DC\uC7A5\uC5D0 \uC4F0\uB358 \uC2DC\uAC04\uC744 \uB9C8\uC74C\uB300\uB85C \uC4F8 \uC218 \uC5C6\uB2E4.", "\uB0B4\uAC00 \uC790\uB9AC\uB97C \uBE44\uC6B4 \uB3D9\uC548\uC5D0\uB3C4 \uC0DD\uD65C\uACFC \uBCF4\uC720 \uC790\uC0B0\uC740 \uB0A8\uB294\uB2E4. \uC544\uB294 \uBBF8\uB798\uAC00 \uC788\uC5B4\uB3C4, \uC9C0\uAE08 \uD560 \uC218 \uC788\uB294 \uC77C\uC5D0\uB294 \uD55C\uACC4\uAC00 \uC788\uB2E4."];
        const schedule = discharge ? "\uD655\uC778\uD55C \uBCF5\uBB34 \uC2DC\uC791 " + before.start + " / \uC804\uC5ED \uD655\uC778 \uC6D4 " + before.month : deferred ? "\uC785\uB300 \uC608\uC815 " + before.enlistAt + " \u2192 " + state.flags.enlistAt + " [1\uB144 \uC720\uC608 \uC2DC\uD5D8 \uAC00\uC815]" : "\uBCF5\uBB34 \uC2DC\uC791 " + state.flags.militaryStart + " / \uC804\uC5ED \uC608\uC815 " + state.flags.militaryUntil + " [26\uAC1C\uC6D4 \uC2DC\uD5D8 \uAC00\uC815]";
        vnChapterPanel(lines, state.month + " \xB7 \uBCF5\uBB34\uC758 \uC7A5 / " + (discharge ? "\uC0AC\uD68C\uB85C \uB3CC\uC544\uC624\uB2E4" : deferred ? "\uBBF8\uB904 \uB454 \uC77C\uC815" : "\uC785\uC601\uD558\uB294 \uB0A0"), "\uAC8C\uC784 \uC120\uD0DD \uAE30\uB85D \xB7 \uACB0\uC815 \uC6D4 " + before.month + " / \uD604\uC7AC \uC6D4 " + state.month + " \xB7 " + schedule + ". \uC6D4 \uC9C4\uD589 \uACB0\uACFC: " + receipt2 + ". \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0. \uC2E4\uC81C \uBCD1\uC5ED \uC774\uB825\xB7\uD604\uD589 \uADDC\uC815\uC774 \uC544\uB2CC \uAC8C\uC784 \uAC00\uC815\uC785\uB2C8\uB2E4. \uB300\uC0AC \uC790\uCCB4\uB294 \uC77C\uC815\xB7\uB3C8\xB7\uC8FC\uBB38\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", { ariaLabel: "\uD68C\uADC0 \uBCF5\uBB34 \uACB0\uACFC \uB300\uC0AC" });
        return;
      }
      if (before.college) {
        if (state.flags.academicStatus !== "college" || !["focus", "balanced"].includes(state.colPolicy)) return;
        const balanced = state.colPolicy === "balanced", changed = before.colPolicy && before.colPolicy !== state.colPolicy;
        const title = before.eventId === "life-acad-col-return" ? "\uB3CC\uC544\uC628 \uAC15\uC758\uC2E4" : before.eventId === "life-acad-col-y3" ? "\uB0A8\uC740 \uC2DC\uAC04\uC744 \uACE0\uB974\uB2E4" : "\uB300\uD559\uC5D0\uC11C\uC758 \uD558\uB8E8";
        const lines = [changed ? balanced ? "\uAC15\uC758\uAC00 \uB05D\uB09C \uB4A4\uC5D0\uB294 \uC77C\uC744 \uD558\uAE30\uB85C \uD588\uB2E4. \uC878\uC5C5\uAE4C\uC9C0\uC758 \uC2DC\uAC04\uACFC \uB2F9\uC7A5 \uC4F8 \uB3C8\uC744 \uD568\uAED8 \uC0DD\uAC01\uD55C \uC120\uD0DD\uC774\uB2E4." : "\uC77C\uD558\uB358 \uC2DC\uAC04\uC744 \uB2E4\uC2DC \uACF5\uBD80\uC5D0 \uC4F0\uAE30\uB85C \uD588\uB2E4. \uC218\uC785\uC774 \uC904\uC5B4\uB4DC\uB294 \uB9CC\uD07C, \uB0A8\uC740 \uD604\uAE08\uACFC \uD559\uBE44\uB97C \uB354 \uC790\uC8FC \uBCF4\uC790." : balanced ? "\uAC15\uC758\uC640 \uC77C\uC744 \uC624\uAC00\uB294 \uD558\uB8E8\uB97C \uD0DD\uD588\uB2E4. \uBAA8\uC744 \uB3C8\uACFC \uC878\uC5C5\uAE4C\uC9C0 \uAC78\uB9B4 \uC2DC\uAC04\uC744 \uD568\uAED8 \uAC10\uB2F9\uD574 \uBCF4\uC790." : "\uB300\uD559\uC5D0\uC11C\uC758 \uC2DC\uAC04\uC744 \uACF5\uBD80\uC5D0 \uC4F0\uAE30\uB85C \uD588\uB2E4. \uBE68\uB9AC \uB05D\uB0B4\uACE0 \uC2F6\uC740 \uB9C8\uC74C\uACFC \uC774\uBC88 \uB2EC \uD559\uBE44\uB294 \uB530\uB85C \uCC59\uACA8\uC57C \uD55C\uB2E4.", "\uC9C0\uB09C \uC2DC\uAC04\uC744 \uC5C6\uB358 \uC77C\uB85C \uB9CC\uB4E4\uC9C0\uB294 \uC54A\uB294\uB2E4. \uC9C0\uAE08 \uB0A8\uC740 \uC870\uAC74\uC5D0\uC11C \uB2E4\uC74C \uD558\uB8E8\uB97C \uC774\uC5B4 \uAC00\uC790."];
        const rows = (state.cashEvents?.rows || []).slice(before.rows);
        const receipt2 = rows.length ? rows.map((r) => r.month + " \uC218\uC785 " + r.income.toLocaleString() + "\uC6D0 \xB7 \uCCAD\uAD6C " + (r.living + r.tuition).toLocaleString() + "\uC6D0 \xB7 \uB0A9\uBD80 " + r.paid.toLocaleString() + "\uC6D0").join(" / ") : "\uC0C8 \uC6D4 \uD604\uAE08\uC0AC\uAC74 \uC5C6\uC74C";
        vnChapterPanel(lines, state.month + " \xB7 \uB300\uD559\uC758 \uC7A5 / " + title, "\uAC8C\uC784 \uC120\uD0DD \uAE30\uB85D \xB7 \uACB0\uC815 \uC6D4 " + before.month + " / \uD604\uC7AC \uC6D4 " + state.month + " \xB7 " + (balanced ? "\uC54C\uBC14 \uBCD1\uD589" : "\uD559\uC5C5 \uC911\uC2EC") + " \xB7 \uC7AC\uD559 \uB204\uC801 " + (state.flags.enrolledMonths || 0) + "\uAC1C\uC6D4. \uC6D4 \uC9C4\uD589 \uACB0\uACFC: " + receipt2 + ". \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0. \uAE30\uC874 \uAC8C\uC784 \uACC4\uC0B0\uC774\uBA70 \uB300\uC0AC\uB97C \uB118\uACA8\uB3C4 \uC7AC\uD559\xB7\uC218\uC785\xB7\uC8FC\uBB38\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", { ariaLabel: "\uD68C\uADC0 \uB300\uD559 \uBC29\uCE68 \uB300\uC0AC" });
        return;
      }
      if (before.graduation) {
        if (state.flags.academicStatus !== "graduated" || state.flags.career !== before.cid) return;
        const job = before.cid === "job";
        const lines = job ? ["\uBA3C\uC800 \uC77C\uD560 \uC790\uB9AC\uB97C \uD0DD\uD588\uB2E4. \uD22C\uC790\uD560 \uC2DC\uAC04\uC744 \uC804\uBD80 \uC4F0\uC9C0\uB294 \uBABB\uD574\uB3C4, \uC0DD\uD65C\uC744 \uC774\uC5B4 \uAC08 \uC218\uC785\uC744 \uB9CC\uB4E4\uACE0 \uC2F6\uB2E4.", "\uD1F4\uADFC \uB4A4\uC5D0 \uB0A8\uB294 \uC2DC\uAC04\uC5D0\uB3C4, \uB0B4\uAC00 \uACE0\uB978 \uC0B6\uC740 \uACC4\uC18D\uB41C\uB2E4."] : ["\uB0B4 \uC2DC\uAC04\uC744 \uD22C\uC790\uC5D0 \uC4F0\uAE30\uB85C \uD588\uB2E4. \uD68C\uC0AC\uC758 \uC6D4\uAE09 \uC5C6\uC774 \uD558\uB8E8\uB97C \uAFB8\uB824 \uAC00\uC57C \uD55C\uB2E4.", "\uBBF8\uB798\uB97C \uC548\uB2E4\uB294 \uC790\uC2E0\uAC10\uACFC, \uC774\uBC88 \uB2EC\uC744 \uBC84\uD2F8 \uD604\uAE08\uC740 \uB2E4\uB978 \uBB38\uC81C\uB2E4."];
        const rows = (state.cashEvents?.rows || []).slice(before.rows);
        const receipt2 = rows.length ? rows.map((r) => r.month + " \uC218\uC785 " + r.income.toLocaleString() + "\uC6D0 \xB7 \uCCAD\uAD6C " + (r.living + r.tuition).toLocaleString() + "\uC6D0 \xB7 \uB0A9\uBD80 " + r.paid.toLocaleString() + "\uC6D0").join(" / ") : "\uC0C8 \uC6D4 \uD604\uAE08\uC0AC\uAC74 \uC5C6\uC74C";
        if (job && rows.some((r) => r.month === state.month && r.income === CCV.JOB_INCOME) && vnGraduationIncomePresent({ kind: "quiet" })) return;
        const facts = job ? "\uAE09\uC5EC\uB294 \uC120\uD0DD \uC6D4\uC758 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uAE30\uC874 \uC6D4 \uC9C4\uD589 \uADDC\uCE59\uC73C\uB85C \uBC18\uC601\uD569\uB2C8\uB2E4." : "\uAE09\uC5EC 0\uC6D0. \uAE30\uC874 \uC0DD\uD65C\uBE44\uC640 \uBBF8\uB0A9 \uADDC\uCE59 \uC720\uC9C0.";
        vnChapterPanel(lines, state.month + " \xB7 \uB2E4\uC74C \uC7A5 / " + (job ? "\uC77C\uACFC \uD22C\uC790" : "\uC804\uC5C5 \uD22C\uC790"), "\uAC8C\uC784 \uACC4\uC0B0 \xB7 \uACB0\uC815 \uC6D4 " + before.month + " / \uD604\uC7AC \uC6D4 " + state.month + ". " + facts + " \uC774\uBC88 \uC120\uD0DD \uB4A4 \uC6D4 \uC9C4\uD589 \uACB0\uACFC: " + receipt2 + ". \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0. \uC5F0\uCD9C \uC790\uCCB4\uB294 \uB3C8\xB7\uC6D4\xB7\uC8FC\uBB38\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        return;
      }
      const cid = before.cid, alba = state.flags.studyPath === "parttime";
      let line = before.chapterEnd ? "\uACE0\uAD50\uC5D0\uC11C\uC758 \uC2DC\uAC04\uC744 \uB9C8\uCCE4\uB2E4. \uB2E4\uC74C \uC7A5\uC740 \uC804\uC5C5 \uD22C\uC790 \uACBD\uB85C\uB2E4. \uC218\uC785\uACFC \uC0DD\uD65C\uBE44\uB294 \uD604\uC7AC \uAC8C\uC784\uC758 \uAE30\uC874 \uADDC\uCE59\uC73C\uB85C \uC774\uC5B4\uC9C4\uB2E4." : cid === "study" ? "\uACF5\uBD80\uC5D0 \uC2DC\uAC04\uC744 \uC4F0\uAE30\uB85C \uD588\uB2E4. \uC54C\uACE0 \uC788\uB294 \uBBF8\uB798\uB9CC \uBBFF\uACE0, \uC624\uB298 \uD574\uC57C \uD560 \uC77C\uC744 \uAC74\uB108\uB6F0\uACE0 \uC2F6\uC9C0\uB294 \uC54A\uB2E4." : cid === "parttime" ? "\uAD50\uC2E4 \uBC16\uC5D0\uC11C \uC77C\uD558\uB294 \uC2DC\uAC04\uC744 \uD0DD\uD588\uB2E4. \uB0B4 \uC190\uC5D0 \uC4F8 \uC218 \uC788\uB294 \uB3C8\uC774 \uC0DD\uAE30\uBA74, \uB2E4\uC74C \uC120\uD0DD\uB3C4 \uB2EC\uB77C\uC9C8 \uC218 \uC788\uACA0\uC9C0." : cid === "acad-admit-ok" ? alba ? "\uC774\uBC88 \uC9C4\uD559 \uD310\uC815\uC740 \uAE30\uC900 \uBBF8\uB2EC\uC774\uB2E4. \uC774\uC81C \uC54C\uBC14\xB7\uC804\uC5C5 \uACBD\uB85C\uC5D0\uC11C \uB2E4\uC74C \uC120\uD0DD\uC744 \uD55C\uB2E4." : "\uC774\uBC88 \uC9C4\uD559 \uD310\uC815\uC740 \uD569\uACA9\uC774\uB2E4. \uB2E4\uC74C \uC7A5\uC740 \uB300\uD559\uC5D0\uC11C \uC2DC\uC791\uD55C\uB2E4." : state.academic?.policy === "balanced" ? "\uD559\uC5C5\uACFC \uC54C\uBC14\uB97C \uBCD1\uD589\uD558\uB294 \uBC29\uCE68\uC744 \uC815\uD588\uB2E4. \uC774 \uC120\uD0DD\uC758 \uACB0\uACFC\uB294 \uAE30\uC874 \uD559\uC5C5 \uADDC\uCE59\uC5D0 \uB530\uB77C \uC313\uC778\uB2E4." : "\uD559\uC5C5\uC5D0 \uC9D1\uC911\uD558\uB294 \uBC29\uCE68\uC744 \uC815\uD588\uB2E4. \uACB0\uACFC\uB97C \uC55E\uB2F9\uACA8 \uC54C \uC218\uB294 \uC5C6\uC9C0\uB9CC, \uC774\uBC88\uC5D0 \uC815\uD55C \uC2DC\uAC04 \uBC30\uBD84\uC740 \uB0A8\uB294\uB2E4.";
      const newRows = (state.cashEvents?.rows || []).slice(before.rows);
      const receipt = newRows.length ? newRows.map((r) => r.month + " \uC218\uC785 " + r.income.toLocaleString() + "\uC6D0 \xB7 \uC2E4\uC81C \uB0A9\uBD80 " + r.paid.toLocaleString() + "\uC6D0").join(" / ") : "\uC774\uBC88 \uC120\uD0DD \uB4A4 \uC0C8 \uC6D4 \uD604\uAE08\uC0AC\uAC74\uC740 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.";
      const feeling = cid === "study" ? "\uB208\uC55E\uC758 \uB3C8\uBCF4\uB2E4, \uC9C0\uAE08\uC740 \uACF5\uBD80\uD560 \uC2DC\uAC04\uC744 \uC9C0\uD0A4\uACE0 \uC2F6\uB2E4." : cid === "parttime" ? "\uC544\uB294 \uAC83\uC774 \uB9CE\uC544\uB3C4 \uC2DC\uC791\uD560 \uB3C8\uC740 \uD544\uC694\uD558\uB2E4. \uB0B4 \uC2DC\uAC04\uC744 \uC870\uAE08\uC529 \uB3C8\uC73C\uB85C \uBC14\uAFD4 \uBCF4\uC790." : cid === "acad-admit-ok" ? "\uB2E4\uC2DC \uC0B4\uC544\uB3C4 \uBAA8\uB4E0 \uAE38\uC744 \uD55C \uBC88\uC5D0 \uAC08 \uC218\uB294 \uC5C6\uB2E4. \uC9C0\uAE08 \uC5F4\uB9B0 \uAE38\uC5D0\uC11C \uB2E4\uC74C \uC120\uD0DD\uC744 \uD558\uC790." : "\uC774 \uBC29\uCE68\uC744 \uC815\uD55C \uAC83\uB3C4 \uB098\uB2E4. \uB2E4\uC74C \uAC08\uB9BC\uAE38\uC5D0\uC11C\uB294 \uC9C0\uAE08\uC758 \uC120\uD0DD\uC744 \uB3CC\uC544\uBCFC \uC218 \uC788\uACA0\uC9C0.";
      vnChapterPanel([line, feeling], state.month + " \xB7 \uCCAB \uC7A5 / " + (alba ? "\uAC00\uAC8C\uC5D0\uC11C \uC2DC\uC791\uD55C \uC2DC\uAC04" : "\uAD50\uC2E4\uC5D0 \uB0A8\uC740 \uC2DC\uAC04"), "\uAC8C\uC784 \uACC4\uC0B0 \xB7 " + receipt + " \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0.");
    }
    function vnInvestmentPresent(turn) {
      if (!["news", "quiet"].includes(turn?.kind) || state.month > GAME_END || state.flags.gameOver || state.month < state.flags.birth.hsYear + 3 + "-03") return false;
      const manualFills = (state.fillsLog || []).filter((f) => !f.planOrigin && ["buy-fill", "sell-fill"].includes(f.kind));
      const firstFill = manualFills[0];
      if (firstFill && (state.lastFills || []).some((f) => JSON.stringify(f) === JSON.stringify(firstFill))) {
        const name = productRule(firstFill.product).name || firstFill.product;
        const buy2 = firstFill.kind === "buy-fill";
        const amount = buy2 ? firstFill.amount : firstFill.proceeds;
        if (!Number.isFinite(amount) || !Number.isFinite(firstFill.price) || !firstFill.ptDate) return false;
        vnChapterPanel(
          ["\uC9C1\uC811 \uB9E1\uAE34 \uC8FC\uBB38\uC5D0 \uCCB4\uACB0 \uAE30\uB85D\uC774 \uC0DD\uACBC\uB2E4. \uC811\uC218 \uB54C\uB294 \uC815\uD574\uC9C0\uC9C0 \uC54A\uC558\uB358 \uAC00\uACA9\uC774 \uC7A5\uBD80\uC5D0 \uB0A8\uC558\uB2E4.", "\uC54C\uACE0 \uC788\uB358 \uBBF8\uB798\uAC00 \uC774\uBC88 \uC120\uD0DD\uC758 \uACB0\uACFC\uB97C \uB300\uC2E0\uD574 \uC8FC\uC9C0\uB294 \uC54A\uB294\uB2E4. \uC9C0\uAE08 \uB0A8\uC740 \uD604\uAE08\uACFC \uBCF4\uC720\uBD84\uBD80\uD130 \uB2E4\uC2DC \uBCF4\uC790."],
          state.month + " \xB7 \uD22C\uC790 \uCCAB \uC7A5 / \uCCB4\uACB0\uC744 \uD655\uC778\uD558\uB2E4",
          "\uAC8C\uC784 \uC9C0\uC5F0\uCCB4\uACB0 \xB7 " + name + " " + (buy2 ? "\uB9E4\uC218 \uD22C\uC785\uAE08 " : "\uB9E4\uB3C4\uB300\uAE08 ") + amount.toLocaleString() + "\uC6D0 \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C " + firstFill.ptDate + " \xB7 \uC9C0\uC810 " + firstFill.price.toLocaleString() + " \xB7 \uCCB4\uACB0 \uAD00\uCE21\uC6D4 " + firstFill.month + ". \uC2E4\uC81C \uAC70\uB798\xB7\uC138\uAE08\xB7\uC218\uC218\uB8CC \uC7AC\uD604\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAE08\uC561\uACFC \uC0C1\uC138 \uAE30\uB85D\uC740 \uC544\uB798 \uC790\uC0B0\uD45C\xB7\uCCB4\uACB0 \uB0B4\uC5ED\uC5D0\uC11C \uD655\uC778\uD569\uB2C8\uB2E4.",
          { ariaLabel: "\uD68C\uADC0 \uCCAB \uD22C\uC790 \uCCB4\uACB0 \uB300\uC0AC" }
        );
        return true;
      }
      const lt = state.lastTrade;
      if (!lt || !["buy-order", "sell-order"].includes(lt.kind) || lt.turn !== state.turnCount - 1) return false;
      const orders = state.history.filter((h) => /^(enter-order|sell-order):/.test(h.choice || ""));
      if (orders.length !== 1 || !orders[0].choice.startsWith((lt.kind === "buy-order" ? "enter-order:" : "sell-order:") + lt.product + ":")) return false;
      const pendingOrder = (state.pendingOrders || []).find((o) => o.id?.startsWith("ord-" + lt.turn + "-") && o.product === lt.product && o.kind === (lt.kind === "buy-order" ? "buy" : "sell"));
      if (!pendingOrder) return false;
      const buy = lt.kind === "buy-order";
      vnChapterPanel(
        ["\uB0B4\uAC00 \uC9C1\uC811 \uACE0\uB978 \uC8FC\uBB38\uC744 \uB9E1\uACBC\uB2E4. \uC544\uC9C1 \uB0B4 \uB73B\uB300\uB85C \uAC70\uB798\uAC00 \uB05D\uB09C \uAC83\uC740 \uC544\uB2C8\uB2E4.", "\uAE30\uB2E4\uB9AC\uB294 \uB3D9\uC548\uC5D0\uB3C4 \uC0DD\uD65C\uC740 \uC774\uC5B4\uC9C4\uB2E4. \uC8FC\uBB38\uC5D0 \uBB36\uC778 \uAC83\uACFC \uB2F9\uC7A5 \uC4F8 \uC218 \uC788\uB294 \uD604\uAE08\uC744 \uAD6C\uBD84\uD574 \uB450\uC790."],
        state.month + " \xB7 \uD22C\uC790 \uCCAB \uC7A5 / \uC8FC\uBB38\uC744 \uB9E1\uAE30\uB2E4",
        "\uAC8C\uC784 \uC8FC\uBB38 \uC811\uC218 \xB7 " + (productRule(lt.product).name || lt.product) + " " + (buy ? "\uB9E4\uC218 \uC608\uC57D\uAE08 " + pendingOrder.amount.toLocaleString() + "\uC6D0" : "\uB9E4\uB3C4 \uC794\uC5EC \uC218\uB7C9 \uC7A0\uAE08") + ". \uC544\uC9C1 \uCCB4\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC774\uD6C4 \uC801\uACA9 \uAD00\uCE21 \uC9C0\uC810\uC774 \uC5C6\uC73C\uBA74 \uC624\uB798 \uBBF8\uCCB4\uACB0\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB300\uC0AC\uB97C \uB118\uACA8\uB3C4 \uC6D4\xB7\uC8FC\uBB38\xB7\uB3C8\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
        { ariaLabel: "\uD68C\uADC0 \uCCAB \uD22C\uC790 \uC811\uC218 \uB300\uC0AC" }
      );
      return true;
    }
    function vnMarket2008Event(ev) {
      if (!ev || ev._dynamic || ev.kind !== "news") return null;
      const scenes = {
        "e20080916-lehman": { title: "\uAE30\uC5B5 \uC18D \uC704\uAE30\uAC00 \uC624\uB298\uC758 \uAE30\uC0AC\uB85C", line: "\uB274\uC2A4\uC758 \uBB38\uC7A5\uC744 \uB2E4\uC2DC \uC77D\uC5C8\uB2E4. \uAE30\uC5B5\uD558\uACE0 \uC788\uB2E4\uACE0 \uC0DD\uAC01\uD588\uB358 \uC704\uAE30\uB3C4, \uB0B4 \uB3C8\uC774 \uB193\uC778 \uD654\uBA74\uC5D0\uC11C\uB294 \uB2E4\uB978 \uBB34\uAC8C\uC600\uB2E4.", hold: "\uC624\uB298\uC740 \uC0C8 \uC8FC\uBB38\uC744 \uB0B4\uC9C0 \uC54A\uAE30\uB85C \uD588\uB2E4. \uC704\uAE30\uB97C \uBAA8\uB974\uB294 \uCC99\uD55C \uAC83\uC774 \uC544\uB2C8\uB77C, \uC774\uBC88 \uAE30\uC0AC \uC55E\uC5D0\uC11C \uB0B4\uAC00 \uACE0\uB978 \uD55C \uBC88\uC758 \uD310\uB2E8\uC774\uB2E4." },
        "e20081024-1000p": { title: "\uC22B\uC790\uC758 \uC55E\uC790\uB9AC\uAC00 \uBC14\uB010 \uB0A0", line: "\uC22B\uC790\uC758 \uC55E\uC790\uB9AC\uAC00 \uBC14\uB00C\uC5C8\uB2E4. \uB180\uB77C\uC11C \uB204\uB974\uB294 \uC8FC\uBB38\uACFC \uB0B4\uAC00 \uC815\uD55C \uC8FC\uBB38\uC744 \uAD6C\uBD84\uD558\uACE0 \uC2F6\uC5C8\uB2E4.", hold: "\uC22B\uC790\uAC00 \uD06C\uAC8C \uC6C0\uC9C1\uC778 \uB0A0\uC5D0\uB3C4 \uC0C8 \uC8FC\uBB38\uC740 \uB9E1\uAE30\uC9C0 \uC54A\uC558\uB2E4. \uC774 \uC120\uD0DD\uC774 \uC633\uC558\uB294\uC9C0\uB294 \uC544\uC9C1 \uBAA8\uB978\uB2E4. \uC9C0\uAE08\uC740 \uB0B4\uAC00 \uC9C0\uD0A8 \uCABD\uC744 \uAE30\uC5B5\uD574 \uB450\uC790." },
        "e20081030-swap": { title: "\uD06C\uAC8C \uC624\uB978 \uB0A0\uC758 \uB9DD\uC124\uC784", line: "\uD06C\uAC8C \uC62C\uB790\uB2E4\uB294 \uAE30\uC0AC\uAC00 \uB4E4\uC5B4\uC654\uB2E4. \uB193\uCCE4\uB2E4\uB294 \uB9C8\uC74C\uBD80\uD130 \uC55E\uC11C\uB294 \uAC74 \uC544\uB2CC\uC9C0, \uC8FC\uBB38\uC744 \uB204\uB974\uAE30 \uC804\uC5D0 \uC7A0\uAE50 \uBA48\uCDC4\uB2E4.", hold: "\uD06C\uAC8C \uC624\uB978 \uAE30\uC0AC\uB97C \uBCF4\uACE0\uB3C4 \uC0C8 \uC8FC\uBB38\uC740 \uB0B4\uC9C0 \uC54A\uC558\uB2E4. \uB354 \uC0AC\uC9C0 \uC54A\uC740 \uC544\uC26C\uC6C0\uACFC, \uC11C\uB450\uB974\uC9C0 \uC54A\uC740 \uB9C8\uC74C\uC774 \uD568\uAED8 \uB0A8\uB294\uB2E4." }
      };
      return scenes[ev.id] || null;
    }
    function vnMarket2008Present(turn) {
      const scene = turn?.kind === "news" ? vnMarket2008Event(turn.event) : null;
      if (!scene) return false;
      const orders = (state.pendingOrders || []).length, held = Object.values(state.holdings || {}).some((h) => h.qty > 0);
      const access = tradeAccess(turn);
      const context = !access.allowed ? "\uC9C0\uAE08\uC740 \uC774 \uC9C4\uB85C\uC5D0\uC11C \uC0C8 \uC8FC\uBB38\uC744 \uB0BC \uC2DC\uAC04\uC774 \uC544\uB2C8\uB2E4. \uBA3C\uC800 \uBCF4\uC720\uC640 \uAE30\uB2E4\uB9AC\uB294 \uC8FC\uBB38\uC744 \uBCF4\uACE0, \uC774 \uAE30\uC0AC\uB97C \uC5B4\uB5BB\uAC8C \uBC1B\uC544\uB4E4\uC77C\uC9C0 \uC815\uB9AC\uD558\uC790." : access.reserveOnly ? "\uC9C0\uAE08 \uB9E1\uAE30\uB294 \uC8FC\uBB38\uB3C4 \uBC14\uB85C \uCCB4\uACB0\uB418\uB294 \uAC83\uC740 \uC544\uB2C8\uB2E4. \uC608\uC57D\uC758 \uC2DC\uAC04\uD45C\uB97C \uD655\uC778\uD558\uACE0, \uC624\uB298 \uAE30\uC0AC\uB97C \uBCF8 \uB4A4\uC758 \uD310\uB2E8\uC744 \uACE0\uB974\uC790." : orders ? "\uBA3C\uC800 \uB9E1\uAE34 \uC8FC\uBB38\uB3C4 \uC544\uC9C1 \uB0A8\uC544 \uC788\uB2E4. \uC774\uBC88 \uAE30\uC0AC\uC5D0 \uB300\uD55C \uC0C8 \uD310\uB2E8\uACFC, \uC774\uBBF8 \uAE30\uB2E4\uB9AC\uB294 \uC8FC\uBB38\uC744 \uB098\uB204\uC5B4 \uBCF4\uC790." : held ? "\uBCF4\uC720\uD55C \uBAAB\uC744 \uADF8\uB300\uB85C \uB458\uC9C0, \uC9C0\uAE08 \uC8FC\uBB38 \uD654\uBA74\uC5D0\uC11C \uBC14\uAFC0\uC9C0. \uAE30\uC0AC\uC758 \uD06C\uAE30\uAC00 \uB0B4 \uACB0\uC815\uC744 \uB300\uC2E0\uD558\uAC8C \uB450\uC9C0\uB294 \uB9D0\uC790." : "\uC544\uC9C1 \uBCF4\uC720\uD55C \uC0C1\uD488\uC740 \uC5C6\uB2E4. \uC9C0\uAE08 \uB4E4\uC5B4\uAC08\uC9C0, \uD604\uAE08\uC73C\uB85C \uAE30\uB2E4\uB9B4\uC9C0. \uC54C\uACE0 \uC788\uB2E4\uB294 \uB9C8\uC74C\uB9CC\uC73C\uB85C \uC8FC\uBB38\uC744 \uC7AC\uCD09\uD558\uC9C0\uB294 \uB9D0\uC790.";
      vnChapterPanel([scene.line, context], turn.event.date + " \xB7 \uC2DC\uC7A5\uC758 \uC7A5 / " + scene.title, "\uD604\uC7AC \uD45C\uC2DC\uB41C \uAE30\uC0AC: " + turn.event.card_title + ". \uC774 \uC7A5\uBA74\uC740 \uD604\uC7AC \uAE30\uC0AC\uC640 \uBCF4\uC720\xB7\uB300\uAE30 \uC0C1\uD0DC\uB9CC \uC77D\uC2B5\uB2C8\uB2E4. \uC774\uD6C4 \uC2DC\uC138\xB7\uB2E4\uC74C \uC0AC\uAC74\xB7\uB9E4\uB9E4 \uC815\uB2F5\uC744 \uC81C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", { ariaLabel: "\uD68C\uADC0 2008 \uC2DC\uC7A5\uC0AC\uAC74 \uB300\uC0AC", finishLabel: "\uC774 \uAE30\uC0AC \uC55E\uC5D0\uC11C \uC120\uD0DD\uD558\uAE30" });
      return true;
    }
    function vnMarket2008OrderPresent(turn) {
      if (!["news", "quiet"].includes(turn?.kind) || state.flags.gameOver || state.month > GAME_END) return false;
      const ev = DATA.events[state.eventIndex - 1], scene = vnMarket2008Event(ev), lt = state.lastTrade, last = state.history.at(-1);
      if (!scene || !lt || !["buy-order", "sell-order"].includes(lt.kind) || lt.turn !== state.turnCount - 1 || !last || typeof last.choice !== "string" || !last.choice.startsWith((lt.kind === "buy-order" ? "enter-order:" : "sell-order:") + lt.product + ":")) return false;
      const order = (state.pendingOrders || []).find((o) => o.product === lt.product && o.kind === (lt.kind === "buy-order" ? "buy" : "sell") && o.id?.startsWith("ord-" + lt.turn + "-"));
      if (!order || order.reserve !== "job-settlement" || !order.earliestFillMonth || order.obsCutoff !== ev.date || order.obsPostClose !== true || last.decisionMonth !== ev.date.slice(0, 7)) return false;
      const buy = order.kind === "buy";
      vnChapterPanel([buy ? "\uC774 \uAE30\uC0AC\uB97C \uBCF8 \uB4A4, \uD604\uAE08\uC758 \uD55C \uBAAB\uC744 \uB9E4\uC218 \uC8FC\uBB38\uC5D0 \uB9E1\uACBC\uB2E4. \uC54C\uACE0 \uC788\uB2E4\uB294 \uC790\uC2E0\uAC10\uB3C4, \uD2C0\uB9B4 \uC218 \uC788\uB2E4\uB294 \uB9C8\uC74C\uB3C4 \uD568\uAED8 \uB193\uC558\uB2E4." : "\uC774 \uAE30\uC0AC\uB97C \uBCF8 \uB4A4, \uBCF4\uC720\uD55C \uD55C \uBAAB\uC744 \uD314\uAE30\uB85C \uB9E1\uACBC\uB2E4. \uB354 \uBC84\uD2F0\uACE0 \uC2F6\uC740 \uB9C8\uC74C\uACFC \uC904\uC774\uACE0 \uC2F6\uC740 \uB9C8\uC74C \uC0AC\uC774\uC5D0\uC11C \uC624\uB298\uC740 \uC774\uCABD\uC744 \uACE8\uB790\uB2E4.", "\uC8FC\uBB38\uC744 \uB9E1\uAE34 \uAC83\uACFC \uACB0\uACFC\uB97C \uBC1B\uC740 \uAC83\uC740 \uB2E4\uB974\uB2E4. \uC544\uC9C1 \uAE30\uB2E4\uB9AC\uB294 \uC774 \uC120\uD0DD\uC744 \uB0A8\uACA8 \uB450\uACE0, \uC9C0\uAE08\uC758 \uD558\uB8E8\uB97C \uC774\uC5B4 \uAC00\uC790."], state.month + " \xB7 \uC2DC\uC7A5\uC758 \uC7A5 / \uAE30\uC0AC \uB4A4\uC5D0 \uB9E1\uAE34 \uC8FC\uBB38", "\uD310\uB2E8 \uAE30\uC0AC " + ev.date + " " + ev.card_title + " \xB7 " + (productRule(order.product).name || order.product) + " " + (buy ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + " \uC811\uC218 \xB7 \uD604\uC7AC \uBBF8\uCCB4\uACB0. \uC870\uAC74\xB7\uC815\uC0B0\xB7\uAD00\uCE21 \uAC8C\uC774\uD2B8\uB294 \uAE30\uC874 \uC8FC\uBB38 \uB0B4\uC5ED \uADF8\uB300\uB85C\uC774\uBA70 \uB300\uC0AC\uB85C \uCCB4\uACB0\uD558\uAC70\uB098 \uB2E4\uC74C \uAC00\uACA9\uC744 \uC54C\uB824 \uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", { ariaLabel: "\uD68C\uADC0 2008 \uB274\uC2A4 \uC8FC\uBB38 \uBC18\uC751 \uB300\uC0AC", finishLabel: "\uC8FC\uBB38\uC744 \uB0A8\uAE30\uACE0 \uB2E4\uC74C \uD310\uB2E8\uC73C\uB85C" });
      return true;
    }
    function vnCrisisScene(turn) {
      if (!careerCashActive() || !["news", "quiet"].includes(turn?.kind) || state.flags.gameOver || state.month > GAME_END) return null;
      const rows = state.cashEvents?.rows || [], unpaid = careerCashUnpaid();
      if (!Number.isFinite(unpaid) || unpaid <= 0 || !Number.isFinite(state.cash)) return null;
      const firstDue = rows.find((r) => r.living + r.tuition > r.paid);
      if (!firstDue) return null;
      const sales = state.history.filter((h) => /^sell-order:/.test(h.choice || "") && h.decisionMonth >= firstDue.month);
      const firstFill = (state.fillsLog || []).find((f) => f.kind === "sell-fill" && f.month >= firstDue.month && f.obsCutoff >= firstDue.month + "-01");
      if (sales.length > 0 && firstFill && (state.lastFills || []).some((f) => JSON.stringify(f) === JSON.stringify(firstFill)) && Number.isFinite(firstFill.proceeds) && firstFill.ptDate) {
        return { kind: "arrival", title: "\uD314\uAE30\uB85C \uD55C \uBAAB\uC774 \uB3C4\uCC29\uD588\uB2E4", lines: [
          "\uB9E1\uACA8 \uB454 \uB9E4\uB3C4\uC5D0 \uC774\uC81C\uC57C \uCCB4\uACB0 \uAE30\uB85D\uC774 \uC0DD\uACBC\uB2E4. \uAE30\uB2E4\uB9AC\uB294 \uB3D9\uC548\uC5D0\uB3C4 \uC0DD\uD65C\uC740 \uBA48\uCD94\uC9C0 \uC54A\uC558\uB2E4.",
          "\uB4E4\uC5B4\uC628 \uB3C8\uC744 \uBAA8\uB450 \uB2E4\uC2DC \uD22C\uC790\uD560 \uD544\uC694\uB294 \uC5C6\uB2E4. \uC544\uC9C1 \uB0A8\uC740 \uCCAD\uAD6C\uC640 \uB2E4\uC74C \uC0DD\uD65C \uC0AC\uC774\uC5D0\uC11C, \uC774\uBC88 \uBAAB\uC744 \uC5B4\uB514\uC5D0 \uB458\uC9C0 \uB0B4\uAC00 \uC815\uD558\uC790."
        ], receipt: "\uB9E4\uB3C4 \uCCB4\uACB0 " + (productRule(firstFill.product).name || firstFill.product) + " \xB7 \uB300\uAE08 " + firstFill.proceeds.toLocaleString() + "\uC6D0 \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C " + firstFill.ptDate + " \xB7 \uCCB4\uACB0 \uAD00\uCE21\uC6D4 " + firstFill.month + ". \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \xB7 \uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0. \uCCB4\uACB0 \uB4A4 \uC0DD\uD65C\uBE44 \uB4F1\uC5D0 \uC4F0\uC778 \uAE08\uC561\uC774 \uC788\uC744 \uC218 \uC788\uC5B4 \uB300\uAE08\uACFC \uD604\uC7AC \uD604\uAE08\uC740 \uB2E4\uB985\uB2C8\uB2E4. \uC9C0\uC5F0\uCCB4\uACB0 \uAC8C\uC784 \uBAA8\uD615\uC774\uBA70 \uC790\uB3D9 \uC0C1\uD658\uC740 \uC544\uB2D9\uB2C8\uB2E4." };
      }
      const lt = state.lastTrade, lastSale = sales.at(-1);
      if (sales.length === 1 && lastSale && lt?.kind === "sell-order" && lt.turn === state.turnCount - 1 && lastSale.choice.startsWith("sell-order:" + lt.product + ":")) {
        const order = (state.pendingOrders || []).find((o) => o.kind === "sell" && o.product === lt.product && o.id?.startsWith("ord-" + lt.turn + "-"));
        if (order) return { kind: "decision", title: "\uBCF4\uC720\uB97C \uC0DD\uD65C \uCABD\uC73C\uB85C", lines: [
          "\uBCF4\uC720\uD55C \uAC83 \uC911 \uD55C \uBAAB\uC744 \uD314\uAE30\uB85C \uB9E1\uACBC\uB2E4. \uB354 \uC624\uB974\uAE30\uB97C \uAE30\uB2E4\uB9AC\uB294 \uB9C8\uC74C\uACFC, \uC624\uB298\uC758 \uC0DD\uD65C\uC744 \uC774\uC5B4\uC57C \uD558\uB294 \uB9C8\uC74C\uC774 \uD568\uAED8 \uB0A8\uB294\uB2E4.",
          "\uACB0\uC815\uD588\uB2E4\uACE0 \uD604\uAE08\uC774 \uB41C \uAC83\uC740 \uC544\uB2C8\uB2E4. \uC774 \uC8FC\uBB38\uC774 \uAE30\uB2E4\uB9AC\uB294 \uB3D9\uC548\uC758 \uC0DD\uD65C\uBD80\uD130 \uC0B4\uD3B4\uBCF4\uC790. \uB9E1\uAE30\uC9C0 \uC54A\uC740 \uBAAB\uACFC \uB2F9\uC7A5 \uC4F8 \uB3C8\uC744 \uB098\uB204\uC5B4 \uBCF4\uC790."
        ], receipt: (productRule(order.product).name || order.product) + " \uB9E4\uB3C4 \uC8FC\uBB38 \uC811\uC218 \xB7 \uC544\uC9C1 \uBBF8\uCCB4\uACB0. \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \xB7 \uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0. \uC774\uD6C4 \uC801\uACA9 \uC2DC\uC138 \uAD00\uCE21\uC774 \uC5C6\uAC70\uB098 \uC870\uAC74\uC774 \uB9DE\uC9C0 \uC54A\uC73C\uBA74 \uC624\uB798 \uAE30\uB2E4\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC811\uC218\uB294 \uC218\uB7C9 \uC7A0\uAE08\uC774\uBA70, \uB300\uC0AC\uB85C \uCCB4\uACB0\xB7\uC0C1\uD658\xB7\uC6D4 \uC9C4\uD589\uC740 \uC77C\uC5B4\uB098\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." };
      }
      if (firstDue.month === state.month && rows.at(-1) === firstDue && !state.history.some((h) => /^career-cash:repay:/.test(h.choice || "") && h.decisionMonth >= firstDue.month) && sales.length === 0) {
        return { kind: "shortfall", title: "\uC54C\uACE0 \uC788\uB294 \uBBF8\uB798\uC640 \uC624\uB298\uC758 \uC0DD\uD65C", lines: [
          Object.values(state.holdings || {}).some((h) => h.qty > 0) ? "\uC7A5\uBD80\uC5D0\uB294 \uBCF4\uC720 \uC790\uC0B0\uC774 \uB0A8\uC544 \uC788\uB294\uB370, \uC774\uBC88 \uB2EC \uC0DD\uD65C\uC5D0 \uB0BC \uD604\uAE08\uC740 \uBAA8\uC790\uB790\uB2E4. \uBBF8\uB798\uB97C \uAE30\uC5B5\uD558\uB294 \uAC83\uACFC \uC624\uB298\uC744 \uBC84\uD2F0\uB294 \uAC83\uC740 \uB2E4\uB978 \uC77C\uC774\uC5C8\uB2E4." : "\uC774\uBC88 \uB2EC \uCCAD\uAD6C\uB97C \uB2E4 \uB0B4\uC9C0 \uBABB\uD588\uB2E4. \uBBF8\uB798\uB97C \uAE30\uC5B5\uD558\uB294 \uAC83\uACFC \uC624\uB298\uC744 \uBC84\uD2F0\uB294 \uAC83\uC740 \uB2E4\uB978 \uC77C\uC774\uC5C8\uB2E4.",
          Object.values(state.holdings || {}).some((h) => h.qty > 0) ? "\uBCF4\uC720\uB97C \uC774\uC5B4 \uAC08 \uC218\uB3C4, \uC77C\uBD80\uB97C \uD314\uAE30\uB85C \uB9E1\uAE38 \uC218\uB3C4 \uC788\uB2E4. \uC5B4\uB290 \uCABD\uC774\uB4E0 \uC2DC\uAC04\uC774 \uB4E0\uB2E4. \uC9C0\uAE08\uC758 \uC0DD\uD65C\uC744 \uD568\uAED8 \uB193\uACE0 \uB2E4\uC74C \uC120\uD0DD\uC744 \uD558\uC790." : "\uC9C0\uAE08 \uC4F8 \uC218 \uC788\uB294 \uD604\uAE08\uACFC \uC544\uC9C1 \uBABB \uB0B8 \uCCAD\uAD6C\uB97C \uB2E4\uC2DC \uBCF4\uC790. \uC9C0\uAE08 \uAC00\uB2A5\uD55C \uC120\uD0DD\uC5D0\uC11C \uC0DD\uD65C\uC744 \uC774\uC5B4 \uAC00\uC57C \uD55C\uB2E4."
        ], receipt: state.month + " \uCCAD\uAD6C \uBBF8\uB0A9 " + (firstDue.living + firstDue.tuition - firstDue.paid).toLocaleString() + "\uC6D0 \xB7 \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0. \uC544\uB798 \uAE30\uC874 \uBCF4\uC720 \uD310\uB2E8\xB7\uD22C\uC790\xB7\uC9C4\uB85C \uC120\uD0DD\uC5D0\uC11C \uC774\uC5B4\uAC11\uB2C8\uB2E4. \uBCF4\uC720 \uC790\uC0B0\uC740 \uC790\uB3D9\uC73C\uB85C \uD314\uB9AC\uC9C0 \uC54A\uC73C\uBA70, \uB9E4\uB3C4 \uC811\uC218\uB3C4 \uC989\uC2DC \uD604\uAE08\uC774 \uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." };
      }
      return null;
    }
    function vnCrisisPresent(turn) {
      const scene = vnCrisisScene(turn);
      if (!scene) return false;
      vnChapterPanel(scene.lines, state.month + " \xB7 \uC0DD\uD65C\uC758 \uC7A5 / " + scene.title, scene.receipt, { ariaLabel: "\uD68C\uADC0 \uC0DD\uD65C \uC704\uAE30 " + scene.kind + " \uB300\uC0AC", finishLabel: "\uB0B4 \uB2E4\uC74C \uC120\uD0DD\uC73C\uB85C" });
      return true;
    }
    function vnRehireIncomeScene(turn) {
      if (!careerCashActive() || !["news", "quiet"].includes(turn?.kind) || state.flags.gameOver || state.month > GAME_END || state.flags.career !== "job") return null;
      const change = state.history.filter((h) => /^career-cycle:(job|fulltime|alba):(job|fulltime|alba)$/.test(h.choice || "") || /^career-recovery:(alba|rehire)$/.test(h.choice || "")).at(-1);
      if (!change || !/^career-cycle:(fulltime|alba):job$|^career-recovery:rehire$/.test(change.choice) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(change.decisionMonth || "") || addMonths(change.decisionMonth, 1) !== state.month) return null;
      const row = state.cashEvents?.rows?.at(-1), unpaid = careerCashUnpaid();
      if (!row || row.month !== state.month || row.income !== CCV.JOB_INCOME || ![row.income, row.living, row.tuition, row.paid, state.cash, unpaid].every((x) => Number.isFinite(x) && x >= 0) || row.paid > row.living + row.tuition) return null;
      return { lines: [
        "\uB2E4\uC2DC \uC77C\uD558\uAE30\uB85C \uD55C \uB4A4 \uCCAB \uC6D4\uC218\uC785\uC774 \uC7A5\uBD80\uC5D0 \uCC0D\uD614\uB2E4. \uB3C8\uC774 \uB4E4\uC5B4\uC628 \uB0A0\uC5D0\uB3C4 \uC774\uBC88 \uB2EC\uC758 \uC0DD\uD65C\uC740 \uD568\uAED8 \uB530\uB77C\uC654\uB2E4.",
        unpaid > 0 ? "\uC608\uC804\uC758 \uBBF8\uB0A9\uC740 \uADF8\uB300\uB85C \uB0A8\uC544 \uC788\uB2E4. \uC9C0\uAE08 \uC190\uC5D0 \uB0A8\uC740 \uB3C8\uC73C\uB85C \uBC00\uB9B0 \uBAAB\uC744 \uAC1A\uC744\uC9C0, \uB2F9\uC7A5 \uC4F8 \uD604\uAE08\uC73C\uB85C \uB0A8\uAE38\uC9C0. \uB2E4\uC2DC \uB0B4 \uCC28\uB840\uB2E4." : "\uC9C0\uAE08 \uB0A8\uC740 \uBBF8\uB0A9\uC740 \uC5C6\uB2E4. \uB3CC\uC544\uC628 \uC218\uC785\uC744 \uBAA8\uB450 \uD22C\uC790\uB85C \uBCF4\uB0B4\uC57C \uD558\uB294 \uAC83\uC740 \uC544\uB2C8\uB2E4. \uB2E4\uC74C \uC0DD\uD65C\uC5D0 \uB0A8\uAE38 \uBAAB\uB3C4 \uB0B4\uAC00 \uACE0\uB97C \uC218 \uC788\uB2E4."
      ], receipt: "\uAC8C\uC784 \uC785\uAE08 \uAE30\uB85D \xB7 \uC9C4\uB85C \uACB0\uC815 " + change.decisionMonth + " / \uC774\uBC88 \uC6D4\uC218\uC785 " + row.income.toLocaleString() + "\uC6D0 \xB7 \uC774\uBC88 \uC6D4\uCCAD\uAD6C " + (row.living + row.tuition).toLocaleString() + "\uC6D0 \uC911 \uB0A9\uBD80 " + row.paid.toLocaleString() + "\uC6D0. \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \xB7 \uB0A8\uC740 \uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0. \uC774\uBBF8 \uBC18\uC601\uB41C \uC7A5\uBD80\uC774\uBA70 \uC9C0\uAE08 \uCD94\uAC00 \uC785\uAE08\xB7\uC0C1\uD658\uD558\uB294 \uD654\uBA74\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC2E4\uC81C \uAE09\uC5EC\xB7\uADFC\uB85C\uC870\uAC74 \uC7AC\uD604\uC774 \uC544\uB2D9\uB2C8\uB2E4." };
    }
    function vnRehireIncomePresent(turn) {
      const scene = vnRehireIncomeScene(turn);
      if (!scene) return false;
      vnChapterPanel(scene.lines, state.month + " \xB7 \uC0DD\uD65C\uC758 \uC7A5 / \uB2E4\uC2DC \uC77C\uD55C \uCCAB \uB2EC", scene.receipt, { ariaLabel: "\uD68C\uADC0 \uC7AC\uCDE8\uC5C5 \uCCAB \uC785\uAE08 \uB300\uC0AC", finishLabel: "\uB0A8\uC740 \uB3C8\uC758 \uC4F0\uC784 \uACE0\uB974\uAE30" });
      return true;
    }
    function vnGraduationIncomePresent(turn) {
      if (!careerCashActive() || !["news", "quiet"].includes(turn?.kind) || state.flags.gameOver || state.month > GAME_END || state.flags.career !== "job" || state.flags.academicStatus !== "graduated") return false;
      const change = state.history.filter((h) => /^life:(job|fulltime)$|^career-cycle:(job|fulltime|alba):(job|fulltime|alba)$|^career-recovery:(alba|rehire)$/.test(h.choice || "")).at(-1);
      if (!change || change.choice !== "life:job" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(change.decisionMonth || "") || addMonths(change.decisionMonth, 1) !== state.month) return false;
      const row = state.cashEvents?.rows?.at(-1), unpaid = careerCashUnpaid();
      if (!row || row.month !== state.month || row.income !== CCV.JOB_INCOME || ![row.income, row.living, row.tuition, row.paid, state.cash, unpaid].every((x) => Number.isFinite(x) && x >= 0) || row.paid > row.living + row.tuition) return false;
      vnChapterPanel(
        ["\uC878\uC5C5 \uB4A4 \uC77C\uD558\uAE30\uB85C \uD55C \uB2E4\uC74C, \uCCAB \uC6D4\uC218\uC785\uC774 \uC7A5\uBD80\uC5D0 \uB0A8\uC558\uB2E4. \uAC15\uC758\uC2E4 \uBC16\uC5D0\uC11C \uBCF4\uB0BC \uD558\uB8E8\uAC00 \uB3C8\uC758 \uD750\uB984\uC73C\uB85C\uB3C4 \uC2DC\uC791\uB410\uB2E4.", unpaid > 0 ? "\uC0C8 \uC218\uC785\uC774 \uC0DD\uACA8\uB3C4 \uC9C0\uB09C \uD559\uBE44\uC640 \uC0DD\uD65C\uC758 \uBBF8\uB0A9\uC740 \uB0A8\uC544 \uC788\uB2E4. \uC9C0\uAE08 \uC4F8 \uB3C8\uACFC \uBC00\uB9B0 \uBAAB\uC744 \uC5B4\uB5BB\uAC8C \uB098\uB20C\uC9C0 \uB2E4\uC2DC \uACE8\uB77C \uBCF4\uC790." : "\uC774\uBC88 \uB2EC \uCCAD\uAD6C\uB97C \uBC18\uC601\uD558\uACE0\uB3C4 \uB0A8\uC740 \uB3C8\uC774 \uC788\uB2E4. \uBAA8\uB450 \uD22C\uC790\uB85C \uBCF4\uB0B4\uAE30 \uC804\uC5D0, \uB2E4\uC74C \uC0DD\uD65C\uC5D0 \uB0A8\uAE38 \uBAAB\uB3C4 \uB0B4 \uC190\uC73C\uB85C \uC815\uD574 \uBCF4\uC790."],
        state.month + " \xB7 \uC77C\uACFC \uD22C\uC790\uC758 \uC7A5 / \uC878\uC5C5 \uB4A4 \uCCAB \uC6D4\uC218\uC785",
        "\uC774\uBBF8 \uBC18\uC601\uB41C \uAC8C\uC784 \uC7A5\uBD80 \xB7 \uC878\uC5C5 \uCDE8\uC5C5 \uACB0\uC815 " + change.decisionMonth + " / \uC774\uBC88 \uC6D4\uC218\uC785 " + row.income.toLocaleString() + "\uC6D0 \xB7 \uC774\uBC88 \uC6D4\uCCAD\uAD6C " + (row.living + row.tuition).toLocaleString() + "\uC6D0 \uC911 \uB0A9\uBD80 " + row.paid.toLocaleString() + "\uC6D0. \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \xB7 \uB0A8\uC740 \uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0. \uC9C0\uAE08 \uCD94\uAC00 \uC785\uAE08\xB7\uC0C1\uD658\uD558\uB294 \uD654\uBA74\uC774 \uC544\uB2C8\uBA70 \uC2E4\uC81C \uAE09\uC5EC\xB7\uADFC\uB85C\uC870\uAC74 \uC7AC\uD604\uC774 \uC544\uB2D9\uB2C8\uB2E4.",
        { ariaLabel: "\uD68C\uADC0 \uC878\uC5C5\uCDE8\uC5C5 \uCCAB \uC785\uAE08 \uB300\uC0AC", finishLabel: "\uD604\uC7AC \uC0DD\uD65C\uB85C \uB3CC\uC544\uAC00\uAE30" }
      );
      return true;
    }
    function vnRepaymentPresent(turn) {
      if (!careerCashActive() || !["news", "quiet"].includes(turn?.kind) || state.month > GAME_END || state.flags.gameOver || state.month < state.flags.birth.hsYear + 3 + "-03") return false;
      const valid = (h) => h && typeof h.choice === "string" && /^career-cash:repay:[1-9]\d*$/.test(h.choice) && Number.isSafeInteger(Number(h.choice.slice("career-cash:repay:".length)));
      const first = state.history.find(valid), last = state.history.at(-1);
      if (!first || first !== last || last.decisionMonth !== state.month) return false;
      const amount = Number(last.choice.slice("career-cash:repay:".length)), unpaid = careerCashUnpaid();
      if (!Number.isFinite(unpaid) || unpaid < 0 || !Number.isFinite(state.cash)) return false;
      vnChapterPanel(
        ["\uB0A8\uACA8 \uB454 \uC0DD\uD65C\uACFC \uD559\uBE44\uC758 \uBBF8\uB0A9\uC5D0, \uC774\uBC88\uC5D0\uB294 \uC9C1\uC811 \uB3C8\uC744 \uBCF4\uB0C8\uB2E4.", unpaid === 0 ? "\uC9C0\uAE08\uAE4C\uC9C0 \uB0A8\uC740 \uBBF8\uB0A9\uC740 \uBAA8\uB450 \uC815\uB9AC\uB410\uB2E4. \uB2E4\uC74C \uB2EC\uC758 \uC0DD\uD65C\uC740, \uADF8\uB54C \uB0A8\uC740 \uB3C8\uC73C\uB85C \uB2E4\uC2DC \uC774\uC5B4 \uAC00\uC57C \uD55C\uB2E4." : "\uC774\uBC88\uC5D0 \uBCF4\uB0B8 \uB3C8\uB9CC\uD07C \uBBF8\uB0A9\uC774 \uC904\uC5C8\uB2E4. \uC544\uC9C1 \uB0A8\uC740 \uCCAD\uAD6C\uC640 \uB2F9\uC7A5 \uC4F8 \uD604\uAE08\uC744 \uB098\uB220 \uBCF4\uACE0, \uB2E4\uC74C \uC120\uD0DD\uC744 \uD558\uC790."],
        state.month + " \xB7 \uC0DD\uD65C\uC758 \uC7A5 / \uBBF8\uB0A9\uC744 \uAC1A\uB2E4",
        "\uAC8C\uC784 \uC0C1\uD658 \uAE30\uB85D \xB7 \uC774\uBC88 \uB0A9\uBD80 " + amount.toLocaleString() + "\uC6D0 \xB7 \uB0A8\uC740 \uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0 \xB7 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0. \uC624\uB798\uB41C \uC6D4 \uCCAD\uAD6C\uBD80\uD130 \uD55C \uB2EC \uB2E8\uC704\uB85C \uB0A9\uBD80\uD55C \uAE30\uC874 \uACB0\uACFC\uC785\uB2C8\uB2E4. \uC5F0\uCD9C\uC740 \uC6D4\xB7\uB274\uC2A4\xB7\uC9C4\uB85C\xB7\uBCF4\uC720\uBD84\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uC0DD\uD65C\uBE44\xB7\uD559\uBE44\xB7\uCC44\uBB34 \uAE30\uB85D\uC774 \uC544\uB2D9\uB2C8\uB2E4.",
        { ariaLabel: "\uD68C\uADC0 \uCCAB \uBBF8\uB0A9\uC0C1\uD658 \uB300\uC0AC" }
      );
      return true;
    }
    function vnCareerChangePresent(turn) {
      if (!careerCashActive() || !["news", "quiet"].includes(turn?.kind) || state.flags.gameOver || state.month > GAME_END) return false;
      const last = state.history.at(-1);
      if (!last || last.decisionMonth !== state.month || last.month !== state.month) return false;
      const cycle = /^career-cycle:(job|fulltime|alba):(job|fulltime|alba)$/.exec(last.choice || "");
      const recovery = /^career-recovery:(alba|rehire)$/.exec(last.choice || "");
      if (!cycle && !recovery) return false;
      const target = cycle ? cycle[2] : recovery[1] === "rehire" ? "job" : "alba";
      const from = cycle ? cycle[1] : recovery[1] === "rehire" && state.flags.recoveryAlbaMonth ? "alba" : "fulltime";
      if (from === target || careerCycleTrack() !== target) return false;
      const unpaid = careerCashUnpaid();
      if (!Number.isFinite(state.cash) || !Number.isFinite(unpaid) || unpaid < 0) return false;
      const names = { job: "\uCDE8\uC5C5", fulltime: "\uC804\uC5C5 \uD22C\uC790", alba: "\uC54C\uBC14 \uBCD1\uD589 \uD22C\uC790" };
      const lines = target === "job" ? ["\uC77C\uD560 \uC2DC\uAC04\uC744 \uB2E4\uC2DC \uC815\uD588\uB2E4. \uD22C\uC790\uB97C \uD3EC\uAE30\uD574\uC11C\uAC00 \uC544\uB2C8\uB77C, \uC0DD\uD65C\uC5D0 \uB4E4\uC5B4\uC62C \uB3C8\uC744 \uB0B4 \uC190\uC73C\uB85C \uC313\uACE0 \uC2F6\uC5B4\uC11C\uB2E4.", "\uC9C0\uB09C \uC120\uD0DD\uC758 \uBBF8\uB0A9\uB3C4, \uB9E1\uACA8 \uB454 \uC8FC\uBB38\uB3C4 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uB294\uB2E4. \uC774\uBC88\uC5D0\uB294 \uC77C\uACFC \uD22C\uC790 \uC0AC\uC774\uC5D0\uC11C \uD558\uB8E8\uB97C \uB098\uB220 \uBCF4\uC790."] : target === "alba" ? ["\uD558\uB8E8\uC758 \uC77C\uBD80\uB294 \uC77C\uD558\uACE0, \uB0A8\uC740 \uC2DC\uAC04\uC5D0\uB294 \uD22C\uC790\uB97C \uC774\uC5B4 \uAC00\uAE30\uB85C \uD588\uB2E4. \uBAA8\uB4E0 \uC2DC\uAC04\uC744 \uD55C\uCABD\uC5D0 \uC4F0\uC9C0\uB294 \uC54A\uACA0\uB2E4.", "\uC54C\uBC14 \uC218\uC785\uB9CC\uC73C\uB85C \uC0DD\uD65C\uBE44\uB97C \uB2E4 \uCC44\uC6B8 \uC218\uB294 \uC5C6\uB2E4. \uB0B4 \uC2DC\uAC04\uC744 \uB098\uB208 \uB9CC\uD07C, \uB2F9\uC7A5 \uC4F8 \uD604\uAE08\uACFC \uBB36\uC5B4 \uB454 \uB3C8\uC744 \uB530\uB85C \uBCF4\uC790."] : ["\uD22C\uC790\uC5D0 \uC4F8 \uC2DC\uAC04\uC744 \uB2E4\uC2DC \uD655\uBCF4\uD588\uB2E4. \uC6D4\uAE09\uC774 \uC5C6\uC5B4\uC9C4 \uC790\uB9AC\uB97C \uC218\uC775\uC774 \uAF2D \uCC44\uC6CC \uC900\uB2E4\uB294 \uC57D\uC18D\uC740 \uC5C6\uB2E4.", "\uC798\uB41C \uBCF4\uC720 \uC790\uC0B0\uC744 \uC0DD\uD65C\uBE44\uB85C \uB098\uB204\uC5B4 \uC4F0\uB294 \uAC83\uB3C4, \uB2E4\uC2DC \uC77C\uC744 \uD0DD\uD558\uB294 \uAC83\uB3C4 \uB0B4 \uC120\uD0DD\uC774\uB2E4. \uC9C0\uAE08 \uB0A8\uC740 \uC870\uAC74\uC5D0\uC11C \uB2E4\uC74C \uD558\uB8E8\uB97C \uACE0\uB974\uC790."];
      const income = target === "job" ? CCV.JOB_INCOME : target === "alba" ? CCV.ALBA_INCOME : 0;
      const orderTime = target === "job" ? "\uC0C8 \uC8FC\uBB38\uC740 \uAE30\uC874 \uCDE8\uC5C5 \uC2DC\uAC04\uD45C\uB97C \uB530\uB985\uB2C8\uB2E4." : target === "alba" && albaTimeActive() ? "\uC218\uB3D9 \uD22C\uC790 \uD310\uB2E8\uC740 \uAE30\uC874 \uC6D41\uD68C \uADDC\uCE59\uC744 \uB530\uB985\uB2C8\uB2E4." : "\uC0C8 \uC8FC\uBB38\uC740 \uAE30\uC874 \uC804\uC5C5 \uC2DC\uAC04\uD45C\uB97C \uB530\uB985\uB2C8\uB2E4.";
      const revisit = cycle ? "\uB2E4\uC74C \uBD84\uAE30\uC6D4\uC5D0 \uC9C4\uB85C\uB97C \uB2E4\uC2DC \uAC80\uD1A0\uD569\uB2C8\uB2E4." : "\uC774 \uC800\uC7A5\uC758 \uC0DD\uC131 \uB2F9\uC2DC \uD68C\uBCF5\xB7\uC7AC\uCDE8\uC5C5 \uADDC\uCE59\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4.";
      vnChapterPanel(
        lines,
        state.month + " \xB7 \uC0DD\uD65C\uC758 \uC7A5 / " + names[from] + "\uC5D0\uC11C " + names[target] + (target === "job" ? "\uC73C\uB85C" : "\uB85C"),
        "\uAC8C\uC784 \uC120\uD0DD \uAE30\uB85D \xB7 \uACB0\uC815 \uC6D4 " + last.decisionMonth + " / \uD604\uC7AC \uC6D4 " + state.month + ". \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4\uC218\uC785 " + income.toLocaleString() + "\uC6D0 / \uC0DD\uD65C\uBE44 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0 [\uAC8C\uC784\uAC12]. \uC9C0\uAE08 \uBC1B\uC740 \uB3C8\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \xB7 \uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0 \xB7 \uB300\uAE30 \uC8FC\uBB38 " + (state.pendingOrders || []).length + "\uAC74. " + orderTime + " \uAE30\uC874 \uBCF4\uC720\xB7\uC8FC\uBB38\xB7\uBBF8\uB0A9\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. " + revisit + " \uB300\uC0AC\uB97C \uB118\uAE30\uAC70\uB098 \uB2EB\uC544\uB3C4 \uC6D4\xB7\uB3C8\xB7\uAE30\uB85D\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
        { ariaLabel: "\uD68C\uADC0 \uC9C4\uB85C \uBCC0\uACBD \uACB0\uACFC \uB300\uC0AC", finishLabel: "\uD604\uC7AC \uC0DD\uD65C\uB85C \uB3CC\uC544\uAC00\uAE30" }
      );
      return true;
    }
    function vnChapterPresent(turn) {
      vnChapterClear();
      if (!vnChapterEligible()) return;
      if (turn?.kind === "natural-end" && !GAME_LIVING && state.month > GAME_END) {
        const closing = lifeClosingChapter(state);
        vnChapterPanel(closing?.lines || ["\uC54C\uACE0 \uC788\uB358 \uBBF8\uB798\uAC00 \uC624\uB298\uC774 \uB410\uB2E4. \uAC19\uC740 \uB2EC\uB825\uC744 \uB2E4\uC2DC \uC0B4\uC544\uB3C4, \uC774\uBC88\uC5D0 \uACE0\uB978 \uC2DC\uAC04\uC740 \uB0B4 \uAC83\uC774\uC5C8\uB2E4.", "\uC774 \uC0B6\uC758 \uAE30\uB85D\uC744 \uB0A8\uACA8 \uB450\uC790. \uB2E4\uC74C\uC5D0 \uB3CC\uC544\uC654\uC744 \uB54C\uB294, \uB0B4\uAC00 \uC5B4\uB5A4 \uC120\uD0DD\uC744 \uD588\uB294\uC9C0\uBD80\uD130 \uB2E4\uC2DC \uC77D\uACE0 \uC2F6\uB2E4."], GAME_END + " \xB7 \uB9C8\uC9C0\uB9C9 \uC7A5 / \uB2E4\uC2DC \uB9CC\uB09C \uC624\uB298", closing?.receipt || "\uAC8C\uC784 \uACB0\uC0B0\uACFC \uB0A8\uC740 \uBBF8\uB0A9\uC740 \uC544\uB798\uC5D0 \uADF8\uB300\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4. \uB300\uC0AC\uB97C \uB118\uAE30\uAC70\uB098 \uB2EB\uC544\uB3C4 \uAE30\uB85D\xB7\uAE08\uC561\xB7\uC2DC\uAC04\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", { finishLabel: "\uACB0\uC0B0 \uD654\uBA74\uC73C\uB85C", ariaLabel: "\uD68C\uADC0 \uB9C8\uC9C0\uB9C9 \uC7A5 \uB300\uC0AC" });
        return;
      }
      if (vnCareerChangePresent(turn)) return;
      if (vnRepaymentPresent(turn)) return;
      if (vnRehireIncomePresent(turn)) return;
      if (vnGraduationIncomePresent(turn)) return;
      if (vnCrisisPresent(turn)) return;
      if (vnMarket2008OrderPresent(turn)) return;
      const homeChapter = state.month <= GAME_END ? homeLifeChapter(state) : null;
      if (homeChapter) {
        vnChapterPanel(homeChapter.lines, homeChapter.caption, homeChapter.receipt, { ariaLabel: "\uD68C\uADC0 \uC8FC\uD0DD \uC18C\uC720\uC640 \uD68C\uC218 \uB300\uC0AC", finishLabel: "\uB2E4\uC74C \uC0DD\uD65C\uACFC \uD22C\uC790 \uD310\uB2E8\uC73C\uB85C" });
        return;
      }
      if (vnInvestmentPresent(turn)) return;
      if (vnMarket2008Present(turn)) return;
      const marketChapter = marketLifeChapter(state, turn, tradeAccess(turn));
      if (marketChapter) {
        vnChapterPanel(marketChapter.lines, marketChapter.caption, marketChapter.receipt, { ariaLabel: "\uD68C\uADC0 \uC2DC\uB300\uBCC4 \uC2DC\uC7A5\uACFC \uC0DD\uD65C \uB300\uC0AC", finishLabel: "\uC774 \uAE30\uC0AC \uC55E\uC5D0\uC11C \uC120\uD0DD\uD558\uAE30" });
        return;
      }
      if (turn?.kind === "discharge") {
        vnChapterPanel(["\uBCF5\uBB34\uAC00 \uB05D\uB0AC\uB2E4. \uBC16\uC758 \uB2EC\uB825\uC740 \uB0B4\uAC00 \uBA38\uBB3C\uB7EC \uC788\uB358 \uC2DC\uAC04\uB9CC\uD07C \uC55E\uC11C \uC788\uB2E4.", "\uD655\uBCF4\uB41C \uC2DC\uC7A5 \uAD00\uCE21\uC810 \uB458\uB9CC\uC73C\uB85C \uADF8\uB3D9\uC548\uC758 \uBAA8\uB4E0 \uC77C\uC744 \uC54C \uC218\uB294 \uC5C6\uB2E4. \uC544\uB798 \uCC38\uACE0 \uBE44\uAD50\uC640 \uC9C0\uAE08 \uB0A8\uC740 \uC0DD\uD65C\uC744 \uB098\uB220 \uBCF4\uC790."], state.month + " \xB7 \uBCF5\uBB34\uC758 \uC7A5 / \uC804\uC5ED\uC744 \uC55E\uB450\uACE0", "\uAC8C\uC784 \uC77C\uC815 \xB7 \uBCF5\uBB34 \uC2DC\uC791 " + state.flags.militaryStart + " / \uC804\uC5ED \uD655\uC778 \uC6D4 " + state.month + ". \uC544\uB798 \uAD00\uCE21\uC810 \uBE44\uAD50\uB294 \uC2E4\uC81C \uBCF5\uBB34\uAE30\uAC04 \uC218\uC775\uB960\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uD655\uC778 \uC804\uAE4C\uC9C0 \uAE30\uC874 \uC77C\uC815\uACFC \uC800\uC7A5\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.", { ariaLabel: "\uD68C\uADC0 \uC804\uC5ED \uB300\uC0AC" });
        return;
      }
      if (turn?.kind === "life" && turn.event?._dynamic && turn.event.id === "life-enlist") {
        vnChapterPanel(["\uC785\uC601 \uD1B5\uC9C0\uC11C\uAC00 \uC654\uB2E4. \uAC15\uC758\uC2E4\uC774\uB4E0 \uC77C\uD130\uB4E0, \uC9C0\uAE08\uC758 \uD558\uB8E8\uB97C \uC7A0\uC2DC \uB0B4\uB824\uB193\uC744 \uB54C\uAC00 \uB2E4\uAC00\uC628\uB2E4.", "\uBC14\uB85C \uAC08\uC9C0, \uD55C \uBC88 \uBBF8\uB8F0\uC9C0. \uC774 \uC2E4\uD589\uBCF8\uC740 \uBCF5\uBB34 26\uAC1C\uC6D4\uC744 \uC77C\uAD04 \uAC00\uC815\uD55C\uB2E4. \uD574\uB2F9 \uC5F0\uB3C4 \uC2E4\uC81C \uBCF5\uBB34\xB7\uC720\uC608 \uADDC\uC815\uC740 \uC544\uC9C1 \uC5F0\uACB0\uD558\uC9C0 \uC54A\uC558\uB2E4."], turn.event.date + " \xB7 \uBCF5\uBB34\uC758 \uC7A5 / \uC785\uB300\uC758 \uAC08\uB9BC\uAE38", "\uAC8C\uC784 \uC785\uB300 \uC608\uC815 " + state.flags.enlistAt + ". 1\uB144 \uC720\uC608\uB294 \uC2DC\uD5D8\uC6A9 \uAC00\uC815\uC774\uBA70 \uC2E4\uC81C \uC720\uC608 \uC694\uAC74\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", { ariaLabel: "\uD68C\uADC0 \uC785\uB300 \uAC08\uB9BC\uAE38 \uB300\uC0AC" });
        return;
      }
      if (turn?.kind !== "life" || !turn.event?._dynamic || state.flags.academicStatus === "graduated") return;
      const id = turn.event.id;
      if (id === "life-grad") {
        vnChapterPanel(["\uB300\uD559\uC5D0\uC11C \uBCF4\uB0B4\uB358 \uC2DC\uAC04\uC774 \uB05D\uB098 \uAC04\uB2E4. \uC774\uC81C \uB0B4 \uC0DD\uD65C\uC744 \uC5B4\uB5A4 \uC77C\uB85C \uC774\uC5B4 \uAC08\uC9C0 \uC815\uD574\uC57C \uD55C\uB2E4.", "\uC6D4\uAE09\uC744 \uBC1B\uC73C\uBA70 \uD22C\uC790\uD560\uC9C0, \uD558\uB8E8\uB97C \uD22C\uC790\uC5D0 \uC4F8\uC9C0. \uC544\uB294 \uBBF8\uB798\uBCF4\uB2E4 \uBA3C\uC800, \uB0B4\uAC00 \uAC10\uB2F9\uD560 \uD558\uB8E8\uB97C \uACE0\uB974\uC790."], turn.event.date + " \xB7 \uB2E4\uC74C \uC7A5 / \uC878\uC5C5\uC758 \uAC08\uB9BC\uAE38");
        return;
      }
      const lines = id === "life-hs1" ? ["\uB2E4\uC2DC \uACE01\uC774\uB2E4. \uBA3C\uC800 \uC815\uD560 \uAC83\uC740 \uC885\uBAA9\uC774 \uC544\uB2C8\uB77C, \uB0B4 \uC2DC\uAC04\uC744 \uC5B4\uB514\uC5D0 \uC4F8\uC9C0\uB2E4.", "\uACF5\uBD80\uC640 \uC54C\uBC14. \uAC19\uC740 \uB2EC\uB825\uC774\uB77C\uB3C4 \uB0B4 \uD558\uB8E8\uB294 \uB2EC\uB77C\uC9C4\uB2E4. \uC544\uB798\uC5D0\uC11C \uC774\uBC88 \uC0B6\uC758 \uCCAB \uBC29\uD5A5\uC744 \uACE0\uB974\uC790."] : id === "life-acad-policy" ? ["\uACF5\uBD80\uB97C \uD0DD\uD588\uC5B4\uB3C4 \uD558\uB8E8\uB97C \uC5B4\uB5BB\uAC8C \uC4F8\uC9C0\uB294 \uC544\uC9C1 \uB0A8\uC544 \uC788\uB2E4.", "\uC544\uB798 \uD559\uC5C5 \uBC29\uCE68\uC774 \uC2E4\uC81C \uB178\uB825 \uB204\uC801\uACFC \uC54C\uBC14 \uC218\uC785\uC744 \uC815\uD55C\uB2E4. \uC6D0\uD558\uB294 \uACB0\uACFC\uAC00 \uC544\uB2C8\uB77C \uAC10\uB2F9\uD560 \uC2DC\uAC04 \uBC30\uBD84\uC744 \uACE0\uB974\uC790."] : id === "life-acad-hs3" ? ["\uACE03\uC774 \uB410\uB2E4. \uC9C0\uAE08\uAE4C\uC9C0 \uC313\uC778 \uB178\uB825\uC740 \uC5C6\uB358 \uC77C\uC774 \uB418\uC9C0 \uC54A\uB294\uB2E4.", "\uB0A8\uC740 \uAE30\uAC04\uC5D0 \uBC14\uAFC0 \uC218 \uC788\uB294 \uAC83\uACFC \uC774\uBBF8 \uC815\uD574\uC9C4 \uAC83\uC744 \uBCF4\uACE0, \uBC29\uCE68\uC744 \uB2E4\uC2DC \uACE0\uB974\uC790."] : id === "life-acad-col-policy" ? ["\uB300\uD559 \uAC15\uC758\uC2E4\uC5D0 \uC549\uC558\uB2E4. \uACF5\uBD80\uC5D0 \uC4F8 \uC2DC\uAC04\uACFC \uC77C\uC744 \uD560 \uC2DC\uAC04\uC744 \uB2E4\uC2DC \uB098\uB220\uC57C \uD55C\uB2E4.", "\uD559\uC5C5 \uC911\uC2EC\uACFC \uC54C\uBC14 \uBCD1\uD589. \uC544\uB798 \uC878\uC5C5 \uC608\uC0C1\uACFC \uC218\uC785\uC740 \uC9C0\uAE08 \uBC29\uCE68\uC744 \uC774\uC5B4 \uAC08 \uB54C\uC758 \uAC8C\uC784 \uACC4\uC0B0\uC774\uB2E4. \uAC10\uB2F9\uD560 \uD558\uB8E8\uB97C \uACE0\uB974\uC790."] : id === "life-acad-col-return" ? ["\uB2E4\uC2DC \uAC15\uC758\uC2E4\uB85C \uB3CC\uC544\uC654\uB2E4. \uC790\uB9AC\uB97C \uBE44\uC6B4 \uB3D9\uC548\uC758 \uC120\uD0DD\uB3C4, \uB0A8\uC740 \uD559\uBE44\uB3C4 \uADF8\uB300\uB85C \uC774\uC5B4\uC9C4\uB2E4.", "\uBCF5\uD559 \uB4A4\uC5D0\uB294 \uC5B4\uB5A4 \uD558\uB8E8\uB97C \uC0B4\uAE4C. \uC9C0\uAE08\uAE4C\uC9C0 \uC313\uC778 \uC7AC\uD559 \uAE30\uAC04\uC744 \uBCF4\uACE0, \uC720\uC9C0\uD560\uC9C0 \uBC14\uAFC0\uC9C0 \uC815\uD558\uC790."] : id === "life-acad-col-y3" ? ["\uB300\uD559\uC5D0\uC11C \uBCF4\uB0B8 \uC2DC\uAC04\uC774 \uC313\uC600\uB2E4. \uC774\uC81C \uB0A8\uC740 \uC2DC\uAC04\uC744 \uC5B4\uB5BB\uAC8C \uC4F8\uC9C0 \uB2E4\uC2DC \uBCF4\uB824 \uD55C\uB2E4.", "\uBA3C\uC800 \uC815\uD55C \uBC29\uCE68\uC744 \uB05D\uAE4C\uC9C0 \uC9C0\uD0AC \uD544\uC694\uB294 \uC5C6\uB2E4. \uC774\uBBF8 \uC313\uC778 \uC7AC\uD559 \uAE30\uAC04\uACFC \uB0A8\uC740 \uD604\uAE08\uC744 \uBCF4\uACE0, \uB2E4\uC74C \uC2DC\uAC04\uC744 \uACE0\uB974\uC790."] : id === "life-admit-result" ? [state.academic?.effort >= ACAD_ADMIT_MIN ? "\uC9C4\uD559 \uAE30\uC900\uC5D0 \uB3C4\uB2EC\uD588\uB2E4. \uC774\uBC88 \uAC8C\uC784\uC758 \uD559\uC5C5 \uD310\uC815\uC774 \uB098\uC654\uB2E4." : "\uC774\uBC88\uC5D0\uB294 \uC9C4\uD559 \uAE30\uC900\uC5D0 \uB2FF\uC9C0 \uBABB\uD588\uB2E4. \uC5EC\uAE30\uC11C \uC0B6\uC774 \uB05D\uB098\uB294 \uAC83\uC740 \uC544\uB2C8\uB2E4.", "\uD655\uC778 \uBC84\uD2BC\uC740 \uAE30\uC874 \uD310\uC815\uC744 \uD55C \uBC88\uB9CC \uBC18\uC601\uD55C\uB2E4. \uB2E4\uC74C \uACBD\uB85C\uB294 \uADF8 \uACB0\uACFC\uC5D0\uC11C \uC774\uC5B4\uC9C4\uB2E4."] : null;
      if (lines) {
        const college = id.startsWith("life-acad-col-");
        vnChapterPanel(lines, turn.event.date + (college ? " \xB7 \uB300\uD559\uC758 \uC7A5" : " \xB7 \uCCAB \uC7A5 / " + (state.flags.studyPath === "parttime" ? "\uC54C\uBC14 \uACBD\uB85C" : "\uAD50\uC2E4")), null, college ? { ariaLabel: "\uD68C\uADC0 \uB300\uD559 \uAC08\uB9BC\uAE38 \uB300\uC0AC" } : {});
      }
    }
    function vnScene(kind) {
      const stage = document.getElementById("vn-stage");
      if (!stage) return;
      stage.dataset.scene = kind === "gameover" ? "danger" : kind === "life" ? "life" : state.chaos >= 70 ? "danger" : "news";
      let bg = "studio", bgName = "\uC6D0\uB8F8";
      const b = state.flags && state.flags.birth;
      if (b && state.month < b.hsYear + 3 + "-03" && state.flags.academicStatus !== "graduated") {
        bg = "classroom";
        bgName = "\uAD50\uC2E4";
      }
      if (b && state.flags.studyPath === "parttime" && state.month < b.hsYear + 3 + "-03" && state.flags.academicStatus !== "graduated") {
        bg = "alba";
        bgName = "\uC54C\uBC14 \uAC00\uAC8C";
      }
      if (b && state.flags.studyPath === "study" && state.month >= b.hsYear + 3 + "-03" && state.flags.academicStatus !== "graduated") {
        bg = "university";
        bgName = "\uB300\uD559 \uAC15\uC758\uC2E4";
      }
      if (state.flags.career === "job" && state.flags.academicStatus === "graduated") {
        bg = "office";
        bgName = "\uC9C1\uC7A5 \uC0AC\uBB34\uC2E4";
      }
      if (typeof fulltimeActive === "function" && fulltimeActive()) {
        bg = "home";
        bgName = "\uC790\uD0DD \uC11C\uC7AC(\uC804\uC5C5)";
      }
      if (typeof militaryActive === "function" && militaryActive()) {
        bg = "barracks";
        bgName = "\uBCF5\uBB34 \uB9C9\uC0AC";
      }
      stage.dataset.bg = bg;
      const visualEraYear = Number(String(state.month).slice(0, 4));
      const visualEra = visualEraYear < 2000 ? "early" : visualEraYear < 2010 ? "middle" : "recent";
      const visualEraName = {early:"아날로그풍",middle:"초기 디지털풍",recent:"최근 디지털풍"};
      stage.dataset.era = ["home", "studio"].includes(bg) ? visualEra : "shared";
      const visualCommonYear = Number(String(state.month).slice(0, 4));
      const visualCommonAge = b && Number.isInteger(b.year) ? visualCommonYear - b.year : null;
      const visualCommonCharacter = bg === "barracks" ? "soldier" : bg === "classroom" || bg === "alba" ? "student" : visualCommonAge !== null && visualCommonAge >= 40 ? "mature" : "adult";
      const visualCommonAlt = { student: "\uD5C8\uAD6C\uC758 \uD559\uC0DD \uC8FC\uC778\uACF5", adult: "\uD5C8\uAD6C\uC758 \uCCAD\uB144 \uC8FC\uC778\uACF5", mature: "\uD5C8\uAD6C\uC758 \uC911\uB144 \uC8FC\uC778\uACF5", soldier: "\uD5C8\uAD6C\uC758 \uBCF5\uBB34 \uC911 \uC8FC\uC778\uACF5" };
      const charImg = document.querySelector(".vn-char img");
      if (charImg) {
        const visualCommonFile = "char-" + visualCommonCharacter + "-common.png";
        if (!charImg.src.endsWith(visualCommonFile)) charImg.src = "" + visualCommonFile;
        charImg.alt = visualCommonAlt[visualCommonCharacter];
      }
      const visualCommonOwns = Object.keys(state.property?.holdings || {}).length > 0;
      const visualCommonProp = ["classroom", "university"].includes(bg) ? "books" : ["home", "studio"].includes(bg) && visualCommonOwns ? "keys" : ["home", "studio", "office"].includes(bg) ? "papers" : null;
      const visualCommonPropEl = document.getElementById("vn-prop");
      if (visualCommonPropEl) {
        visualCommonPropEl.hidden = !visualCommonProp;
        if (visualCommonProp) {
          visualCommonPropEl.src = "prop-" + visualCommonProp + "-common.png";
          visualCommonPropEl.alt = { books: "\uBCC4\uB3C4 \uB808\uC774\uC5B4: \uACF5\uC6A9 \uD559\uC2B5 \uCC45", papers: "\uBCC4\uB3C4 \uB808\uC774\uC5B4: \uC77D\uB294 \uC790\uB8CC\uB97C \uC0C1\uC9D5\uD558\uB294 \uBE48 \uC885\uC774", keys: "\uBCC4\uB3C4 \uB808\uC774\uC5B4: \uD604\uC7AC \uC8FC\uD0DD \uC18C\uC720\uB97C \uC0C1\uC9D5\uD558\uB294 \uC5F4\uC1E0" }[visualCommonProp];
        }
      }
      const label = document.getElementById("vn-scene-label");
      if (label) label.textContent = bgName + " · " + (["home", "studio"].includes(bg) ? visualEraName[visualEra] + " / 허구 미술" : "공통 허구 스타일");
      const artNote = document.getElementById("vn-art-note");
      if (artNote) artNote.textContent = "원룸·전업 서재는 게임 달력의 2000년 이전/2000~2009년/2010년 이후에 따라 생활 도구와 빛이 다른 허구 배경을 씁니다. 연도 경계는 미술 구분이며 실제 보급 시점·장소·복장 고증이 아닙니다. 배경은 자산이나 집의 실제 모습·구입 장비를 나타내지 않고 돈·능력·선택 결과를 바꾸지 않습니다. 나머지 공간은 기존 공통 배경입니다. 인물 4종과 소품 3종은 계속 재사용하며 중년 표현은 연도 차 40세부터입니다. 열쇠는 현재 게임 주택 소유만 상징합니다.";
    }
    function cashSummary() {
      const rows = state.cashEvents.rows;
      return {
        income: rows.reduce((v, r) => v + r.income, 0),
        paid: rows.reduce((v, r) => v + r.paid, 0),
        unpaid: rows.reduce((v, r) => v + r.living + r.tuition - r.paid, 0),
        months: rows.length,
        ...state.cashAutomation ? { automaticPaidMonths: state.cashAutomation.paidMonths.length } : {}
      };
    }
    function cashEndHtml() {
      if (!CASH_MODE) return "";
      const c = cashSummary();
      return '<p class="cash-ending-summary"><strong>\uBBF8\uB0A9 \uAC00\uC0C1\uCCAD\uAD6C ' + c.unpaid.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9\uCC28\uAC10 \uC2DC\uC5F0\uC21C\uC790\uC0B0 " + (totalAssets() - c.unpaid).toLocaleString() + '\uC6D0</strong></p><p class="note">\uC704 \uCD1D\uC790\uC0B0\uC740 \uBBF8\uB0A9 \uCC28\uAC10 \uC804\uC785\uB2C8\uB2E4. \uBCF4\uB958\uD55C \uBE44\uC6A9\uC774 \uBA74\uC81C\uB41C \uAC83\uC774 \uC544\uB2C8\uBA70 \uC2E4\uC81C \uC9C4\uB85C\uC6B0\uC5F4\uC774\uB098 \uC0DD\uACC4\uAC00\uB2A5\uC131 \uACB0\uACFC\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p>';
    }
    function cashAutomationHtml() {
      const policy = state.cashAutomation, paid = policy ? policy.paidMonths : [];
      return '<section class="cash-automation"><h4>\uC0DD\uD65C \uAC00\uC0C1\uCCAD\uAD6C \uCC98\uB9AC \uC815\uCC45</h4><p class="note">\uD604\uC7AC ' + (policy && policy.enabled ? "\uCF1C\uC9D0" : "\uAEBC\uC9D0 \xB7 \uC9C1\uC811 \uC120\uD0DD") + " / \uC790\uB3D9\uB0A9\uBD80 \uAE30\uB85D " + paid.length + '\uAC1C\uC6D4. \uCF1C\uBA74 \uB2E4\uC74C \uC6D4\uBD80\uD130 \uD559\uBE44 \uC5C6\uB294 \uC0DD\uD65C\uCCAD\uAD6C10\uB9CC\uC6D0\uB9CC \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC774 \uCDA9\uBD84\uD560 \uB54C \uC790\uB3D9\uB0A9\uBD80\uD569\uB2C8\uB2E4. \uD559\uBE44\xB7\uD604\uAE08\uBD80\uC871\xB7\uAE30\uC874\uBBF8\uB0A9\uC740 \uD56D\uC0C1 \uC9C1\uC811 \uD655\uC778\uD569\uB2C8\uB2E4. \uC608\uC57D\uAE08 \uC0AC\uC6A9\xB7\uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. \uC6D0\uD560 \uB54C \uB04C \uC218 \uC788\uC73C\uBA70 \uCF1C\uACE0 \uB044\uB294 \uAC83\uB9CC\uC73C\uB85C \uACFC\uAC70 \uCCAD\uAD6C\uB098 \uD604\uAE08\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><button id="cash-auto-toggle" style="min-height:44px" ' + (state.month > GAME_END ? "disabled" : "") + ">" + (policy && policy.enabled ? "\uC0DD\uD65C\uCCAD\uAD6C \uC790\uB3D9\uB0A9\uBD80 \uB044\uAE30" : "\uC870\uAC74\uC744 \uC77D\uACE0 \uC0DD\uD65C\uCCAD\uAD6C \uC790\uB3D9\uB0A9\uBD80 \uCF1C\uAE30") + "</button></section>";
    }
    function toggleCashAutomation() {
      if (storageWriteBlocked || storageReadBlocked || !CASH_MODE || state.month > GAME_END) return;
      const old = state.cashAutomation, enabled = !(old && old.enabled);
      if (!confirm(enabled ? "\uB2E4\uC74C \uC6D4\uBD80\uD130 \uD559\uBE44 \uC5C6\uB294 \uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0\uB9CC \uD604\uAE08\uC774 \uCDA9\uBD84\uD558\uBA74 \uC790\uB3D9\uB0A9\uBD80\uD560\uAE4C\uC694? \uD559\uBE44\xB7\uD604\uAE08\uBD80\uC871\xB7\uAE30\uC874\uBBF8\uB0A9\uC740 \uC9C1\uC811 \uD655\uC778\uD558\uBA70 \uC608\uC57D\uAE08\xB7\uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC744 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uCCAD\uAD6C\uB294 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uB2E4\uC74C \uC6D4\uBD80\uD130 \uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C \uC790\uB3D9\uB0A9\uBD80\uB97C \uB04C\uAE4C\uC694? \uC774\uBBF8 \uB0A9\uBD80\uD55C \uCCAD\uAD6C\uC640 \uD604\uC7AC \uD604\uAE08\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")) return;
      if (storageWriteBlocked || storageReadBlocked) return;
      state.cashAutomation = { version: 1, enabled, enabledAfterMonth: state.month, paidMonths: old ? old.paidMonths.slice() : [] };
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-policy:" + (enabled ? "enable-living" : "disable-living") });
      if (save()) render();
    }
    function cashEventsHtml() {
      const c = cashSummary(), gross = totalAssets();
      return '<div class="cash-events-review"><h3>\uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 v1 [\uC784\uC758\uAC12]</h3><p class="note">\uC6D0\uB798 \uC6D4 \uC21C\uC800\uCD950/2\uB9CC/10\uB9CC\uC6D0\uC744 \uAED0\uC2B5\uB2C8\uB2E4. \uC2DC\uC791100\uB9CC\uC6D0, \uACE0\uAD50\uC54C\uBC14\xB7\uC878\uC5C5\uCDE8\uC5C5 \uC6D4\uC218\uC78530\uB9CC\uC6D0/\uADF8 \uC678\xB7\uBCF5\uBB340\uC6D0, \uC6D4\uC0DD\uD65C \uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0(\uBCF5\uBB34 \uD3EC\uD568), \uCD5C\uCD08 \uC7AC\uD559 \uC6D4\uC9C4\uD589 \uD559\uBE44\uAC00\uC0C1\uCCAD\uAD6C80\uB9CC\uC6D0 \uD55C \uBC88. \uC138\uAE08\xB7\uC7A5\uD559\xB7\uAC00\uC871\uBD80\uB2F4\xB7\uC2E4\uC81C\uD559\uC801\uD6A8\uACFC\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.</p><div class="row"><span>\uAE30\uB85D\uB41C \uC6D4\uC218\uC785 \xB7 ' + c.months + "\uAC1C\uC6D4</span><strong>+" + c.income.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uC2E4\uC81C \uC120\uD0DD\uD55C \uAC00\uC0C1\uB0A9\uBD80</span><strong>-' + c.paid.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uBBF8\uB0A9 \uAC00\uC0C1\uCCAD\uAD6C \xB7 \uD604\uC7AC\uCCAD\uAD6C \uD3EC\uD568</span><strong>' + c.unpaid.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uCD1D\uC790\uC0B0(\uBBF8\uB0A9 \uCC28\uAC10 \uC804)</span><strong>' + gross.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uBBF8\uB0A9 \uCC28\uAC10 \uC2DC\uC5F0\uC21C\uC790\uC0B0</span><strong>' + (gross - c.unpaid).toLocaleString() + '\uC6D0</strong></div><p class="note">\uBBF8\uB0A9\uC740 \uBA74\uC81C\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC2DC\uC5F0\uC21C\uC790\uC0B0\uC740 \uCD1D\uC790\uC0B0-\uBBF8\uB0A9\uC774\uBA70 \uD22C\uC790\uC218\uC775\uB960\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uCD1D\uC790\uC0B0\uC5D0\uB294 \uC608\uC57D\uD604\uAE08\xB7\uC7A0\uAE34 \uB9E4\uB3C4\uD3C9\uAC00\uAC00 \uD3EC\uD568\uB418\uACE0 \uB0A9\uBD80\uB294 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC73C\uB85C\uB9CC \uD569\uB2C8\uB2E4. \uBCF4\uB958\uB294 \uC7AC\uD559\xB7\uBCF5\uBB34 \uC77C\uC815\uC5D0 \uC601\uD5A5\uC744 \uC8FC\uC9C0 \uC54A\uB294 \uCD5C\uC18C\uC2DC\uD5D8\uC774\uBA70 \uD604\uC2E4 \uD559\uC801\xB7\uCC44\uBB34 \uC815\uCC45\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC6D4\uC218\uC785\uACFC \uCCAD\uAD6C \uC0DD\uC131\uC740 \uC6D4\uC9C4\uD5891\uD68C, \uB0A9\uBD80\xB7\uBCF4\uB958\xB7\uC7AC\uB0A9\uBD80\uB294 \uC6D4\uC9C4\uD589 \uC5C6\uC774 \uCC98\uB9AC\uD569\uB2C8\uB2E4.</p><details class="cash-event-ledger"><summary>\uD604\uAE08\uC0AC\uAC74 \uC7A5\uBD80 \xB7 \uCD5C\uADFC12\uAC1C\uC6D4</summary>' + state.cashEvents.rows.slice(-12).reverse().map((r) => '<p class="note">' + esc(r.month) + " / \uC218\uC785 +" + r.income.toLocaleString() + "\uC6D0 / \uC0DD\uD65C " + r.living.toLocaleString() + "\uC6D0 / \uD559\uBE44 " + r.tuition.toLocaleString() + "\uC6D0 / " + esc({ due: "\uC120\uD0DD \uB300\uAE30", paid: "\uB0A9\uBD80", deferred: "\uBA85\uC2DC \uBCF4\uB958" }[r.status]) + " / \uB0A9\uBD80 " + r.paid.toLocaleString() + "\uC6D0" + (state.cashAutomation && state.cashAutomation.paidMonths.includes(r.month) ? " \xB7 \uBA85\uC2DC \uC815\uCC45\uC5D0 \uB530\uB978 \uC790\uB3D9\uB0A9\uBD80" : "") + "</p>").join("") + "</details>" + (state.cashEvents.rows.some((r) => r.status === "deferred") ? '<button id="cash-retry" style="min-height:44px">\uBCF4\uB958 \uBBF8\uB0A9\uC744 \uB2E4\uC2DC \uB0A9\uBD80\uD558\uAE30</button>' : "") + cashAutomationHtml() + "</div>";
    }
    function cashDecision(row, action) {
      if (storageWriteBlocked || !CASH_MODE || row.status !== "due") return;
      const cost = row.living + row.tuition;
      if (action === "paid" && state.cash < cost) return;
      if (!confirm(action === "paid" ? "\uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC5D0\uC11C " + cost.toLocaleString() + "\uC6D0\uC744 \uAC00\uC0C1 \uB0A9\uBD80\uD560\uAE4C\uC694? \uC6D4\uC740 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uAC00\uC0C1\uCCAD\uAD6C " + cost.toLocaleString() + "\uC6D0\uC744 \uBBF8\uB0A9\uC73C\uB85C \uB0A8\uAE38\uAE4C\uC694? \uBA74\uC81C\uAC00 \uC544\uB2C8\uBA70 \uD559\uC801\uC77C\uC815\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")) return;
      if (row.status !== "due" || action === "paid" && state.cash < cost) return;
      if (action === "paid") {
        state.cash -= cost;
        row.paid = cost;
      }
      row.status = action;
      state.turnCount++;
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-event:" + action + ":" + row.month });
      if (save()) render();
    }
    function researchDeductionPanelHtml(row) {
      if (typeof netpayPartial1995 === "undefined" || !row || !(row.income > 0)) return "";
      const m = row.month;
      if (m < "1995-04" || m > "1997-12") return "";
      const line = (label, it) => {
        if (!it) return "";
        if (it.status === "rule-verified") return '<p class="note">' + esc(label) + " " + it.amountWon.toLocaleString() + "\uC6D0 [\uADDC\uCE59 \uC6D0\uBB38 \uD655\uC778\xB7\uAE08\uC561\uC740 \uC2DC\uD5D8\uAC00\uC815 \uC801\uC6A9 \uACB0\uACFC] \u2014 " + esc(it.basis || "") + "</p>";
        if (it.status === "verified" || it.status === "verified-row") return '<p class="note">' + esc(label) + " " + it.amountWon.toLocaleString() + "\uC6D0 [\uC6D0\uBB38 \uD655\uC778] \u2014 " + esc(it.basis || "") + "</p>";
        if (it.status === "not-applicable") return '<p class="note">' + esc(label) + " 0\uC6D0 [\uBBF8\uC801\uC6A9 \u2014 \uBBF8\uD655\uC815\uC774 \uC544\uB2D8] \u2014 " + esc(it.condition || "") + "</p>";
        if (it.status === "unresolved") return '<p class="note">' + esc(label) + " \uBBF8\uD655\uC815 \u2014 " + esc(it.note || it.basis || "") + "</p>";
        return '<p class="note">' + esc(label) + " \uACC4\uC0B0 \uBD88\uAC00 \u2014 " + esc(it.note || it.condition || "") + "</p>";
      };
      const small = netpayPartial1995.computePartialDeductions({ month: m, monthlyBaseWon: row.income, workplaceSize: 5, familyCount: null });
      const large = netpayPartial1995.computePartialDeductions({ month: m, monthlyBaseWon: row.income, workplaceSize: 30, familyCount: null });
      if (!small.ok && !large.ok) return "";
      const scen = (title, r) => r.ok ? '<p class="note"><strong>' + esc(title) + "</strong></p>" + line("\uAD6D\uBBFC\uC5F0\uAE08", r.items.nationalPension) + line("\uACE0\uC6A9\uBCF4\uD5D8", r.items.employmentInsurance) : "";
      return '<details class="research-deduction-panel"><summary>\uACF5\uC81C \uBD80\uBD84\uACC4\uC0B0 \uCC38\uACE0 [\uC5F0\uAD6C\xB7\uC2DC\uD5D8\uAC00\uC815] \u2014 \uAC8C\uC784 \uD604\uAE08\uC5D0 \uBC18\uC601\uD558\uC9C0 \uC54A\uC74C</summary><p class="note">\uC2DC\uD5D8\uC218\uC785 ' + row.income.toLocaleString() + "\uC6D0(\uC784\uC758\uAC12)\uC744 \uC6D4 \uBCF4\uC218(\uAE30\uBCF8\uAE09+\uC218\uB2F9)\uB85C \uAC00\uC815\uD55C 1995~97 \uACF5\uC81C \uADDC\uCE59\uC758 \uBD80\uBD84\uACC4\uC0B0\uC785\uB2C8\uB2E4. \uC2E4\uC218\uB839(\uC138\uD6C4\uAE09\uC5EC)\uC774 \uC544\uB2C8\uBA70, \uC870\uD569\uBCC4 \uC758\uB8CC\uBCF4\uD5D8 \uC2E4\uD6A8\uC728\uC740 \uBBF8\uD655\uC815\uC785\uB2C8\uB2E4. \uAD6D\uBBFC\uC5F0\uAE08\uC758 \uC18C\uB4DD \uBC94\uC704\uC5D0\uB294 \uC0C1\uC5EC\uAE08 \uC0B0\uC785\uC774 \uC6D0\uBB38 \uADDC\uCE59(\uC2DC\uD589\uB839 \uC81C3\uC870\u2460)\uC73C\uB85C \uD655\uC778\uB410\uC9C0\uB9CC \uC774 \uC2DC\uD5D8\uC218\uC785\uC5D0\uB294 \uC0C1\uC5EC \uAD6C\uBD84\uC774 \uC5C6\uACE0, \uADDC\uCE59\uC0C1 \uD45C\uC900\uC18C\uB4DD\uC6D4\uC561\uC740 \uC804\uB144\uB3C4 \uC18C\uB4DD \uAE30\uC900 \uC5F0 1\uD68C \uACB0\uC815\uC785\uB2C8\uB2E4. \uC8FC\uC778\uACF5\uC758 \uC2E4\uC81C \uC0AC\uC5C5\uC7A5 \uADDC\uBAA8\xB7\uAC00\uC785 \uC870\uAC74\uC774 \uD655\uC778\uB418\uC9C0 \uC54A\uC544 \uB450 \uAC08\uB798 \uC2DC\uD5D8\uAC00\uC815\uC744 \uD568\uAED8 \uBCF4\uC5EC \uC90D\uB2C8\uB2E4. \uC5B4\uB290 \uAC08\uB798\uB3C4 \uC2E4\uC81C \uC870\uAC74\uC774 \uC544\uB2C8\uBA70, \uBBF8\uD655\uC815 \uD56D\uBAA9\uC774 \uC788\uC5B4 \uD569\uACC4\xB7\uC2E4\uC218\uB839\uC740 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>" + scen("\uAC00\uC815 A \xB7 \uC0C1\uC2DC 5\uC778 \uC774\uC0C1 30\uC778 \uBBF8\uB9CC \uC0AC\uC5C5\uC7A5", small) + scen("\uAC00\uC815 B \xB7 \uC0C1\uC2DC 30\uC778 \uC774\uC0C1 \uC0AC\uC5C5\uC7A5", large) + (large.ok ? '<p class="note"><strong>\uB450 \uAC00\uC815 \uACF5\uD1B5</strong></p>' + line("\uADFC\uB85C\uC18C\uB4DD \uAC04\uC774\uC138\uC561", large.items.incomeTax) + line("\uC758\uB8CC\uBCF4\uD5D8", large.items.healthInsurance) : "") + "</details>";
    }
    function renderCashDue() {
      const row = state.cashEvents.rows.find((r) => r.status === "due");
      if (!row) return render();
      effDate = state.month + "-01";
      effPostClose = false;
      const cost = row.living + row.tuition, short = Math.max(0, cost - state.cash);
      vnScene("life");
      document.getElementById("unlock-area").innerHTML = "";
      document.getElementById("turn-card").innerHTML = '<div class="date">' + esc(row.month) + " \xB7 \uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8</div><h2>\uAC00\uC0C1\uCCAD\uAD6C\uB97C \uC5B4\uB5BB\uAC8C \uCC98\uB9AC\uD560\uAE4C</h2><p>\uC774\uBC88 \uB2EC \uC2DC\uD5D8\uC218\uC785 +" + row.income.toLocaleString() + "\uC6D0\uC740 \uD55C \uBC88 \uC785\uAE08\uD588\uC2B5\uB2C8\uB2E4. \uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C " + row.living.toLocaleString() + "\uC6D0" + (row.tuition ? " + \uCD5C\uCD08\uC7AC\uD559 \uD559\uBE44\uAC00\uC0C1\uCCAD\uAD6C " + row.tuition.toLocaleString() + "\uC6D0" : "") + "\uC785\uB2C8\uB2E4. \uC804\uBD80 \uC784\uC758 \uC2DC\uD5D8\uAC12\uC785\uB2C8\uB2E4.</p><p>\uB0A9\uBD80\uC561 " + cost.toLocaleString() + "\uC6D0 / \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 / \uBD80\uC871 " + short.toLocaleString() + '\uC6D0.</p><p class="note">\uB0A9\uBD80 \uC804\uC5D0 \uD655\uC778\uD569\uB2C8\uB2E4. \uC608\uC57D\uD604\uAE08\xB7\uBBF8\uCCB4\uACB0\uB9E4\uB3C4\uB294 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uACE0 \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\xB7\uAC00\uC871\uC1A1\uAE08\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. \uC544\uB798 \uC790\uC0B0\uD45C\uC5D0\uC11C \uB300\uAE30\uC8FC\uBB38\uC744 \uBA85\uC2DC \uCDE8\uC18C\uD560 \uC218 \uC788\uC5B4\uC694. \uBCF4\uB958\uD558\uBA74 \uBBF8\uB0A9\uC744 \uB0A8\uAE30\uACE0 \uAC19\uC740 \uB2EC\uC758 \uBCF8\uAC8C\uC784\uC744 \uACC4\uC18D\uD558\uBA70, \uC774\uD6C4 \uB2E4\uC2DC \uB0BC \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBCF4\uB958\uD574\uB3C4 \uC774 \uCD5C\uC18C\uC2DC\uD5D8\uC758 \uC7AC\uD559 \uC77C\uC815\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      const rdp = researchDeductionPanelHtml(row);
      if (rdp) document.getElementById("turn-card").innerHTML += rdp;
      const box = document.getElementById("choices");
      box.innerHTML = "";
      const pay = document.createElement("button");
      pay.id = "cash-pay";
      pay.textContent = "\uC804\uC561 \uAC00\uC0C1 \uB0A9\uBD80 \uD655\uC778";
      pay.disabled = short > 0;
      pay.onclick = () => cashDecision(row, "paid");
      box.append(pay);
      const defer = document.createElement("button");
      defer.id = "cash-defer";
      defer.textContent = "\uBBF8\uB0A9\uC744 \uB0A8\uAE30\uACE0 \uBA85\uC2DC \uBCF4\uB958";
      defer.onclick = () => cashDecision(row, "deferred");
      box.append(defer);
      renderPortfolio();
    }
    function renderCashRepay() {
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      const rows = state.cashEvents.rows.filter((r) => r.status === "deferred"), cost = rows.reduce((v, r) => v + r.living + r.tuition - r.paid, 0);
      document.getElementById("turn-card").innerHTML = '<div class="date">' + state.month + " \xB7 \uBBF8\uB0A9 \uB2E4\uC2DC \uD655\uC778</div><h2>\uBCF4\uB958\uD55C \uAC00\uC0C1\uCCAD\uAD6C \uB0A9\uBD80</h2><p>\uBCF4\uB958 " + rows.length + "\uAC74 / \uD569\uACC4 " + cost.toLocaleString() + "\uC6D0 / \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0. \uC804\uCCB4\uB97C \uD55C \uBC88\uC5D0 \uB0B4\uAC70\uB098, \uBCF4\uB958\uD55C \uC6D4\uC744 \uC9C1\uC811 \uACE8\uB77C \uD55C \uAC74\uC529 \uC804\uC561 \uB0BC \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC790\uB3D9 \uC6B0\uC120\uC21C\uC704\xB7\uD55C \uCCAD\uAD6C\uC758 \uBD80\uBD84\uB0A9\uBD80\uB294 \uC5C6\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uC6D4\uC758 \uC120\uD0DD\uB300\uAE30 \uCCAD\uAD6C\uB294 \uC774 \uD569\uACC4\uC640 \uBCC4\uB3C4\uC785\uB2C8\uB2E4.</p><p>\uC6D0\uB798 \uC6D4\uC218\uC785\xB7\uC774\uC790\uB294 \uB2E4\uC2DC \uC801\uC6A9\uD558\uC9C0 \uC54A\uACE0 \uC6D4\xB7\uB274\uC2A4\xB7\uC9C4\uB85C\uB3C4 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC21C\uC800\uCD95 \uD68C\uADC0\uB294 \uAC74\uB4DC\uB9AC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
      const box = document.getElementById("choices");
      box.innerHTML = "";
      const pay = document.createElement("button");
      pay.id = "cash-repay-confirm";
      pay.textContent = "\uBCF4\uB958 \uBBF8\uB0A9 \uC804\uC561 \uB0A9\uBD80 \uD655\uC778";
      pay.disabled = !rows.length || state.cash < cost;
      pay.onclick = () => {
        if (storageWriteBlocked || state.cash < cost || rows.some((r) => r.status !== "deferred")) return;
        if (!confirm("\uBCF4\uB958 \uBBF8\uB0A9 " + cost.toLocaleString() + "\uC6D0\uC744 \uD604\uAE08\uC5D0\uC11C \uAC00\uC0C1 \uB0A9\uBD80\uD560\uAE4C\uC694?")) return;
        state.cash -= cost;
        rows.forEach((r) => {
          r.paid = r.living + r.tuition;
          r.status = "paid";
        });
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-event:repay:" + rows.length });
        if (save()) render();
      };
      box.append(pay);
      const label = document.createElement("label");
      label.htmlFor = "cash-repay-month";
      label.textContent = "\uB2E4\uC2DC \uB0BC \uBCF4\uB958 \uCCAD\uAD6C\uC6D4 \uC9C1\uC811 \uC120\uD0DD";
      box.append(label);
      const select = document.createElement("select");
      select.id = "cash-repay-month";
      select.style.cssText = "width:100%;min-height:44px;max-width:100%";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "\uCCAD\uAD6C\uC6D4\uC744 \uACE0\uB974\uC138\uC694 (\uC790\uB3D9\uC120\uD0DD \uC5C6\uC74C)";
      select.append(empty);
      rows.forEach((r) => {
        const option = document.createElement("option");
        option.value = r.month;
        option.textContent = r.month + " / " + (r.living + r.tuition - r.paid).toLocaleString() + "\uC6D0" + (r.tuition ? " (\uC0DD\uD65C+\uD559\uBE44)" : " (\uC0DD\uD65C)");
        select.append(option);
      });
      box.append(select);
      const detail = document.createElement("p");
      detail.id = "cash-repay-month-detail";
      detail.className = "note";
      detail.setAttribute("aria-live", "polite");
      box.append(detail);
      const one = document.createElement("button");
      one.id = "cash-repay-one";
      one.textContent = "\uC120\uD0DD\uD55C \uD55C \uB2EC \uCCAD\uAD6C \uC804\uC561 \uB0A9\uBD80 \uD655\uC778";
      one.disabled = true;
      box.append(one);
      const selected = () => rows.find((r) => r.month === select.value && r.status === "deferred");
      select.onchange = () => {
        const r = selected();
        one.disabled = !r || state.cash < r.living + r.tuition - r.paid;
        detail.textContent = r ? "\uC120\uD0DD " + r.month + " / \uB0A9\uBD80 " + (r.living + r.tuition - r.paid).toLocaleString() + "\uC6D0 / \uBD80\uC871 " + Math.max(0, r.living + r.tuition - r.paid - state.cash).toLocaleString() + "\uC6D0. \uB2E4\uB978 \uC6D4 \uBBF8\uB0A9\uC740 \uB0A8\uC2B5\uB2C8\uB2E4." : "\uCCAD\uAD6C\uC6D4\uC744 \uC9C1\uC811 \uACE8\uB77C\uC57C \uD569\uB2C8\uB2E4. \uC544\uC9C1 \uB0A9\uBD80\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
      };
      select.onchange();
      one.onclick = () => {
        const r = selected();
        if (storageWriteBlocked || !r) return;
        const amount = r.living + r.tuition - r.paid;
        if (state.cash < amount) return;
        if (!confirm(r.month + " \uBCF4\uB958 \uAC00\uC0C1\uCCAD\uAD6C " + amount.toLocaleString() + "\uC6D0\uC744 \uD604\uAE08\uC5D0\uC11C \uB0A9\uBD80\uD560\uAE4C\uC694? \uB2E4\uB978 \uC6D4 \uBBF8\uB0A9\uC740 \uADF8\uB300\uB85C\uC774\uBA70 \uC6D4\uC740 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")) return;
        if (storageWriteBlocked || r.status !== "deferred" || state.cash < amount) return;
        state.cash -= amount;
        r.paid = r.living + r.tuition;
        r.status = "paid";
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-event:repay-month:" + r.month });
        if (save()) render();
      };
      const cancel = document.createElement("button");
      cancel.id = "cash-repay-cancel";
      cancel.textContent = "\uCDE8\uC18C (\uAC8C\uC784\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30)";
      cancel.onclick = () => render();
      box.append(cancel);
      renderPortfolio();
    }
    function render() {
      if (storageReadBlocked) return showStorageReadUnavailable();
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      if (pending) {
        renderTrade();
        renderPortfolio();
        return;
      }
      if (CASH_MODE && state.cashEvents.rows.some((r) => r.status === "due")) return renderCashDue();
      const turn = nextTurn();
      effDate = turnEffDate(turn).date;
      effPostClose = turnEffDate(turn).postClose;
      const historyBeforeOrders = state.history.length;
      tryFillOrders();
      if (state.history.length !== historyBeforeOrders && !save()) return;
      if (storageWriteBlocked || multiTabConflict) return;
      vnScene(turn.kind);
      vnChapterPresent(turn);
      const card = document.getElementById("turn-card");
      const choices = document.getElementById("choices");
      const unlockArea = document.getElementById("unlock-area");
      unlockArea.innerHTML = "";
      choices.innerHTML = "";
      for (const e of state.history.filter((h) => h.month === state.month && typeof h.choice === "string" && h.choice.startsWith("order-expired:"))) {
        unlockArea.innerHTML += '<div class="unlock-banner">\uB9E4\uC218 \uB300\uAE30 \uAE30\uD55C \uC885\uB8CC: ' + esc(productRule(e.choice.slice(14)).name || e.choice.slice(14)) + " \xB7 " + esc(e.expiresAt) + " \uC6D4\uCD08\uBD80\uD130 \uBBF8\uCCB4\uACB0\uBD84 \uCDE8\uC18C \xB7 \uC608\uC57D\uAE08 " + e.refund.toLocaleString() + "\uC6D0 \uBC18\uD658. \uC774\uBBF8 \uCCB4\uACB0\uB41C \uBCF4\uC720\uBD84\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4 [\uC2DC\uD5D8\uADDC\uCE59]</div>";
      }
      if (state.lastFills && state.lastFills.length) {
        const autoGroups = /* @__PURE__ */ new Map();
        for (const f of state.lastFills.filter((f2) => ["job-savings", "career-cash"].includes(f2.planOrigin) && f2.kind === "buy-fill")) {
          const key = [f.product, f.price, f.ptDate, f.usableFrom, f.month].join("|");
          const group = autoGroups.get(key) || { ...f, count: 0, total: 0, past: false };
          group.count++;
          group.total += f.amount;
          group.past = group.past || !!(f.obsCutoff && f.ptDate < f.obsCutoff);
          autoGroups.set(key, group);
        }
        for (const f of autoGroups.values()) unlockArea.innerHTML += '<div class="unlock-banner job-plan-fill">\uC801\uB9BD \uC608\uC57D \uCCB4\uACB0: ' + esc(productRule(f.product).name || f.product) + " \xB7 " + f.count + "\uAC74 \uD569\uACC4 " + f.total.toLocaleString() + "\uC6D0 \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C " + esc(f.ptDate) + " \uC9C0\uC810 " + f.price.toLocaleString() + " \xB7 \uCCB4\uACB0 \uAD00\uCE21\uC6D4 " + esc(f.month) + (f.usableFrom ? " \xB7 \uAE30\uB85D\uB41C \uC2DC\uC5F0 \uC774\uC6A9 \uAC00\uB2A5\uC77C " + esc(f.usableFrom) : "") + (f.past ? " \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C\uC774 \uC811\uC218 \uD6C4 \uAD00\uCE21\uAC8C\uC774\uD2B8\uBCF4\uB2E4 \uACFC\uAC70\uC778 \uC9C0\uC810 \uD3EC\uD568 [\uC2DC\uC5F0 \uAC00\uC815]" : "") + " \xB7 \uAD00\uCE21\uAC8C\uC774\uD2B8\uC640 \uC2E4\uC81C \uC8FC\uBB38\uC77C\uC740 \uB2E4\uB97C \uC218 \uC788\uC73C\uBA70 \uC774\uC6A9 \uAC00\uB2A5\uC77C\uC740 \uCD5C\uCD08 \uACF5\uD45C\uC77C \uC99D\uAC70\uAC00 \uC544\uB2D9\uB2C8\uB2E4 [\uBD84\uAE30 \uC815\uC0B0 \uC774\uD6C4 \uC801\uACA9 \uAD00\uCE21 \xB7 \uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0]</div>";
        for (const f of state.lastFills) {
          if (["job-savings", "career-cash"].includes(f.planOrigin) && f.kind === "buy-fill") continue;
          const u = productRule(f.product);
          const pastFormed = f.obsCutoff && f.ptDate < f.obsCutoff;
          const ufNote = f.usableFrom ? " \xB7 \uAE30\uB85D\uB41C \uC2DC\uC5F0 \uC774\uC6A9 \uAC00\uB2A5\uC77C " + f.usableFrom : "";
          const fxNote = f.fxPtDate ? " \xB7 \uD658\uC728 \uAE30\uC900\uC77C " + f.fxPtDate + (f.fxPtDate < f.ptDate ? " (\uC9C0\uC218 \uAE30\uC900\uC77C\uBCF4\uB2E4 \uC624\uB798\uB41C \uD658\uC728 \uC801\uC6A9 [\uC2DC\uC5F0 \uAC00\uC815])" : "") : "";
          const pastNote = pastFormed ? ' <span style="color:#8a6d3b">\uAC00\uACA9 \uAE30\uC900\uC77C(' + esc(f.ptDate) + ")\uC774 \uC811\uC218 \uD6C4 \uAD00\uCE21\uAC8C\uC774\uD2B8(" + esc(f.obsCutoff) + ")\uBCF4\uB2E4 \uACFC\uAC70\uC608\uC694 [\uC2DC\uC5F0 \uAC00\uC815].</span>" : "";
          if (f.kind === "buy-fill") {
            unlockArea.innerHTML += '<div class="unlock-banner">\uC8FC\uBB38 \uCCB4\uACB0 (\uB9E4\uC218 ' + esc(u.name || f.product) + "): " + f.amount.toLocaleString() + "\uC6D0 \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C " + f.ptDate + " \uC9C0\uC810 " + f.price.toLocaleString() + " \xB7 \uCCB4\uACB0 \uAD00\uCE21\uC6D4 " + f.month + ufNote + fxNote + " [\uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615 \xB7 \uAC8C\uC774\uD2B8\uB294 \uC2E4\uC81C \uC8FC\uBB38\uC77C\uACFC \uB2E4\uB97C \uC218 \uC788\uACE0 \uC774\uC6A9 \uAC00\uB2A5\uC77C\uC740 \uCD5C\uCD08 \uACF5\uD45C\uC77C \uC99D\uAC70\uAC00 \uC544\uB2D9\uB2C8\uB2E4]" + pastNote + "</div>";
          } else {
            const sign = f.pnl >= 0 ? "+" : "";
            unlockArea.innerHTML += '<div class="unlock-banner">\uC8FC\uBB38 \uCCB4\uACB0 (\uB9E4\uB3C4 ' + esc(u.name || f.product) + "): \uB9E4\uB3C4\uB300\uAE08 " + f.proceeds.toLocaleString() + "\uC6D0 \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C " + f.ptDate + " \uC9C0\uC810 " + f.price.toLocaleString() + " \xB7 \uCCB4\uACB0 \uAD00\uCE21\uC6D4 " + f.month + ufNote + fxNote + pastNote + " \xB7 \uC2E4\uD604\uC190\uC775 " + sign + f.pnl.toLocaleString() + "\uC6D0 [\uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615 \xB7 \uAC8C\uC774\uD2B8\uB294 \uC2E4\uC81C \uC8FC\uBB38\uC77C\uACFC \uB2E4\uB97C \uC218 \uC788\uACE0 \uC774\uC6A9 \uAC00\uB2A5\uC77C\uC740 \uCD5C\uCD08 \uACF5\uD45C\uC77C \uC99D\uAC70\uAC00 \uC544\uB2D9\uB2C8\uB2E4]</div>";
          }
        }
        state.lastFills = [];
        if (!save()) return;
      }
      if (state.lastTrade && state.lastTrade.turn === state.turnCount - 1 && (!/-order$/.test(state.lastTrade.kind) || (state.pendingOrders || []).some((o) => o.id && o.id.startsWith("ord-" + state.lastTrade.turn + "-") && o.product === state.lastTrade.product))) {
        const lt = state.lastTrade;
        const u = productRule(lt.product);
        if (lt.kind === "buy-order") {
          unlockArea.innerHTML += '<div class="unlock-banner">\uC8FC\uBB38 \uC811\uC218 (\uB9E4\uC218 ' + esc(u.name || lt.product) + "): " + lt.proceeds.toLocaleString() + "\uC6D0 \u2014 \uCCB4\uACB0\uC740 \uC774\uD6C4 \uC9C4\uD589 \uC911 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810\uC73C\uB85C \uC9D1\uD589\uB3FC\uC694. \uC790\uB8CC \uACF5\uBC31\uC73C\uB85C \uC7A5\uAE30\uAC04 \uBBF8\uCCB4\uACB0\uC774 \uB420 \uC218 \uC788\uC5B4\uC694 [\uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615 \xB7 \uC815\uC2DD \uB9E4\uB9E4 \uC7AC\uD604 \uC544\uB2D8]</div>";
        } else if (lt.kind === "sell-order") {
          unlockArea.innerHTML += '<div class="unlock-banner">\uC8FC\uBB38 \uC811\uC218 (\uB9E4\uB3C4 ' + esc(u.name || lt.product) + ") \u2014 \uC218\uB7C9\uC774 \uC7A0\uACBC\uACE0 \uCCB4\uACB0\uC740 \uC774\uD6C4 \uC9C4\uD589 \uC911 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810\uC73C\uB85C \uC9D1\uD589\uB3FC\uC694 [\uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615]</div>";
        } else if (lt.kind === "sell") {
          const sign = lt.pnl >= 0 ? "+" : "";
          unlockArea.innerHTML += '<div class="unlock-banner">\uBC29\uAE08 \uB9E4\uB3C4 (' + esc(u.name || lt.product) + "): \uB9E4\uB3C4\uB300\uAE08 " + lt.proceeds.toLocaleString() + "\uC6D0 \xB7 \uD574\uB2F9 \uC6D0\uAC00 " + lt.costBasis.toLocaleString() + "\uC6D0 \xB7 \uC2E4\uD604\uC190\uC775 " + sign + lt.pnl.toLocaleString() + "\uC6D0 [\uC2DC\uC5F0 \uD3C9\uAC00 \uAE30\uC900 \u2014 \uC2E4\uC81C \uB2F9\uC2DC \uC190\uC775 \uC544\uB2D8]</div>";
        } else {
          unlockArea.innerHTML += '<div class="unlock-banner">\uBC29\uAE08 \uB9E4\uC218 (' + esc(u.name || lt.product) + "): \uD22C\uC785 " + lt.proceeds.toLocaleString() + "\uC6D0 [\uC2DC\uC5F0 \uCCB4\uACB0]</div>";
        }
      }
      if (militaryActive()) {
        unlockArea.innerHTML += '<div class="unlock-banner">\uBCF5\uBB34 \uC911 \u2014 \uD6C8\uB828 \uC77C\uC815\uC73C\uB85C \uC2DC\uC7A5 \uB300\uC751\uC774 \uC81C\uD55C\uB3FC\uC694 (\uB9E4\uC218 \uBE44\uC911 \uC0C1\uD55C 30%) [\uC124\uACC4 \uC81C\uC548]</div>';
      }
      if (state.chaos >= CHAOS.warnAt && !state.flags.gameOver) {
        unlockArea.innerHTML += '<div class="unlock-banner">\uCE74\uC624\uC2A4 \uACBD\uACE0 ' + state.chaos.toFixed(1) + "/100 \u2014 \uC2DC\uC7A5 \uC601\uD5A5\uC774 \uC313\uC5EC \uC5ED\uC0AC \uBCC0\uACBD \uC784\uACC4\uC5D0 \uAC00\uAE4C\uC6CC\uC694. \uBD84\uC0B0\uD558\uAC70\uB098 \uADDC\uBAA8\uB97C \uC904\uC774\uBA74 \uB204\uC801\uC774 \uB290\uB824\uC838\uC694 [\uC124\uACC4 \uC81C\uC548]</div>";
      }
      if (turn.kind === "gameover") {
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uAC8C\uC784 \uC624\uBC84</div><h2>\uC5ED\uC0AC\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4</h2><p>\uC2DC\uC7A5\uC5D0 \uC313\uC778 \uC601\uD5A5(\uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + '/100)\uC774 \uD55C\uACC4\uB97C \uB118\uC5B4, \uC54C\uACE0 \uC788\uB358 \uBBF8\uB798\uAC00 \uB354 \uC774\uC0C1 \uC720\uD6A8\uD558\uC9C0 \uC54A\uAC8C \uB410\uB2E4. \uC774 \uC778\uC0DD\uC740 \uC5EC\uAE30\uC11C \uB2EB\uD799\uB2C8\uB2E4. \uAE30\uB85D\uC740 \uD68C\uADC0 \uB300\uC2DC\uBCF4\uB4DC\uC5D0 \uB0A8\uC2B5\uB2C8\uB2E4.</p><p class="note">\uCE74\uC624\uC2A4 \uC218\uCE58\uC640 \uD55C\uACC4\uB294 \uC804\uBD80 \uC124\uACC4 \uC81C\uC548\uC774\uBA70 \uACBD\uC81C\uC801 \uC0AC\uC2E4\uC774 \uC544\uB2C8\uC5D0\uC694.</p>';
        card.innerHTML += cashEndHtml();
        card.innerHTML += careerEndHtml();
        renderChoices([{ id: "record-and-reset", label: "\uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" }], turn);
        renderPortfolio();
        return;
      }
      if (turn.kind === "living-adjust") {
        const due = state.gameLivingPendingDue;
        const sellable = Object.entries(state.holdings || {}).map(([p, h]) => Object.assign({ p, name: productRule(p).name || p }, livingAdjustValuation(p, h))).filter((r) => r.v > 0 || r.blocked);
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uC0DD\uD65C\uBE44 \uC815\uC0B0 \uC804 \uC870\uC815</div><h2>\uC0DD\uD65C\uBE44\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4 \u2014 \uC815\uC0B0 \uC804\uC5D0 \uC870\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4</h2><p>" + due.month + "\uBD84 \uC0DD\uD65C\uBE44 " + due.expenseDue.toLocaleString() + "\uC6D0 / \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 / \uBD80\uC871 " + Math.max(0, due.expenseDue - state.cash).toLocaleString() + '\uC6D0. \uBCF4\uC720 \uC790\uC0B0\uC744 \uB9C8\uC9C0\uB9C9 \uD655\uBCF4 \uAD00\uCE21 \uC9C0\uC810 \uD3C9\uAC00\uC561\uC73C\uB85C \uC989\uC2DC \uC815\uC0B0 \uB9E4\uB3C4\uD574 \uD604\uAE08\uC744 \uB9C8\uB828\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4 [\uAC8C\uC784 \uADDC\uCE59 \u2014 \uC2E4\uC81C \uC989\uC2DC \uB9E4\uB3C4 \uC7AC\uD604\uC774 \uC544\uB2C8\uBA70, \uC774 \uC870\uC815 \uD134\uC5D0\uC11C\uB294 \uC0C8 \uB9E4\uC218 \uC5C6\uC774 \uB9E4\uB3C4\uB9CC \uAC00\uB2A5]. \uADF8\uB798\uB3C4 \uBD80\uC871\uD558\uBA74 \uC2E4\uD328 \uD68C\uADC0\uC785\uB2C8\uB2E4.</p><p class="note">\uC2DC\uC138\uB294 \uC2E4\uC81C \uC790\uB8CC, \uC218\uC785\xB7\uC9C0\uCD9C\uC740 \uBA85\uC2DC \uAC8C\uC784\uAC12\uC785\uB2C8\uB2E4. \uC774 \uD654\uBA74\uC758 \uB9E4\uB3C4\uB294 \uC0DD\uD65C\uBE44 \uC815\uC0B0 \uC804 \uC870\uC815\uC5D0\uB9CC \uC4F0\uC774\uB294 \uAC8C\uC784 \uADDC\uCE59\uC785\uB2C8\uB2E4.</p>';
        const adjBox = document.getElementById("choices");
        adjBox.innerHTML = "";
        sellable.forEach((r) => {
          const b = document.createElement("button");
          b.id = "living-adjust-sell-" + r.p;
          b.textContent = r.blocked ? r.name + " \u2014 " + r.basis : r.name + " \uC804\uC561 \uC815\uC0B0 \uB9E4\uB3C4 (\uC57D " + r.v.toLocaleString() + "\uC6D0 \xB7 \uD3C9\uAC00: " + r.basis + ")";
          b.style.minHeight = "44px";
          if (r.blocked) b.disabled = true;
          else b.onclick = () => choose("living-adjust-sell:" + r.p, turn);
          adjBox.appendChild(b);
        });
        const settle = document.createElement("button");
        settle.id = "living-settle-confirm";
        settle.textContent = state.cash >= due.expenseDue ? "\uC815\uC0B0 \uD655\uC815 \u2014 \uC0DD\uD65C\uBE44 " + due.expenseDue.toLocaleString() + "\uC6D0 \uCC28\uAC10" : "\uC774\uB300\uB85C \uC815\uC0B0 \u2014 \uBD80\uC871 " + (due.expenseDue - state.cash).toLocaleString() + "\uC6D0 \xB7 \uC2E4\uD328 \uD68C\uADC0";
        settle.style.minHeight = "44px";
        settle.onclick = () => choose("living-settle-confirm", turn);
        adjBox.appendChild(settle);
        renderPortfolio();
        return;
      }
      if (turn.kind === "living-fail") {
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 \uC2E4\uD328</div><h2>\uC0DD\uD65C\uBE44\uB97C \uAC10\uB2F9\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4</h2><p>\uC774\uBC88 \uC815\uC0B0\uC5D0\uC11C \uC0DD\uD65C\uBE44 " + GLV.expense.toLocaleString() + "\uC6D0\uC744 \uB0BC \uD604\uAE08\uC774 \uBD80\uC871\uD588\uC2B5\uB2C8\uB2E4(\uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + '\uC6D0). \uD22C\uC790\uC5D0 \uB123\uC740 \uD604\uAE08\uC740 \uC0DD\uD65C\uBE44\uB85C \uC4F8 \uC218 \uC5C6\uACE0, \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC2B5\uB2C8\uB2E4 [\uAC8C\uC784 \uADDC\uCE59]. \uC774 \uC778\uC0DD\uC740 \uC5EC\uAE30\uC11C \uB2EB\uD799\uB2C8\uB2E4.</p><p class="note">\uC2DC\uC138\uB294 \uC2E4\uC81C \uC790\uB8CC\uC9C0\uB9CC \uC218\uC785\xB7\uC9C0\uCD9C\uC740 \uBA85\uC2DC \uAC8C\uC784\uAC12\uC774\uB77C, \uC774 \uC2E4\uD328\uAC00 \uC2E4\uC81C \uC0DD\uACC4 \uD310\uC815\uC744 \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' + gameLivingSummaryHtml();
        renderChoices([{ id: "record-and-reset-livingfail", label: "\uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" }], turn);
        renderPortfolio();
        return;
      }
      if (SCHOOL_MODE && !CASH_MODE && !GAME_LIVING && state.month > GAME_END && state.flags.gameEndShown && turn.kind === "quiet") {
        card.innerHTML = '<div class="date">' + GAME_END + " \uC885\uB8CC \xB7 \uACB0\uC0B0 \uB4A4 \uB458\uB7EC\uBCF4\uAE30</div><h2>\uC774\uBC88 \uC0B6\uC740 \uB05D\uB0AC\uACE0, \uAE30\uB85D\uC740 \uC544\uC9C1 \uB0A8\uAE38 \uC218 \uC788\uC2B5\uB2C8\uB2E4</h2><p>\uCD94\uAC00 \uC6D4\uC9C4\uD589\uC774\uB098 \uC0C8 \uC8FC\uBB38\uC744 \uC9C4\uD589\uD558\uB294 \uD654\uBA74\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC544\uB798 \uC790\uC0B0\uD45C\xB7\uC9C0\uB09C \uB274\uC2A4\xB7\uCCB4\uACB0 \uB0B4\uC5ED\xB7\uD68C\uADC0 \uB300\uC2DC\uBCF4\uB4DC\uB97C \uD655\uC778\uD55C \uB4A4, \uC774 \uC0B6\uC744 \uAE30\uB85D\uD558\uACE0 \uC0C8 \uD68C\uADC0\uB97C \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p><p>\uCD1D\uC790\uC0B0 " + totalAssets().toLocaleString() + "\uC6D0 \xB7 \uD134 " + state.turnCount + " \xB7 \uACB0\uC0B0 \uAD00\uCE21 " + state.month + "-01</p>" + careerEndHtml();
        renderChoices([{ id: "record-and-reset-end", label: "\uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" }], turn);
        document.querySelector("#choices .arrears-choice-note")?.remove();
        renderPortfolio();
        document.getElementById("footnote").textContent = GAME_END + " \uC885\uB8CC \xB7 \uCD94\uAC00 \uC6D4\uC9C4\uD589 \uC5C6\uC74C";
        return;
      }
      if (turn.kind === "natural-end" && GAME_LIVING) {
        card.innerHTML = '<div class="date">2019-09 \uC885\uB8CC \xB7 3\uAC1C\uC6D4 \uC2DC\uD5D8 \uAE30\uAC04 \uB9D0 \uC694\uC57D (\uC815\uC0B0 \uAD00\uCE21 ' + state.month + "-01)</div><h2>\uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 \uAD6C\uAC04\uC744 \uB9C8\uCCE4\uC2B5\uB2C8\uB2E4</h2><p>\uAC08\uB798: " + (state.gameLivingTrack === "job" ? "\uCDE8\uC5C5(\uC815\uAE30 \uC720\uC785 \xB7 \uD22C\uC790 \uC0C1\uD55C 30%)" : "\uC804\uC5C5(\uC720\uC785 \uBD80\uC7AC \xB7 \uC0C1\uD55C \uC5C6\uC74C)") + " [\uAC8C\uC784\uAC12] \xB7 \uCD1D\uC790\uC0B0 " + totalAssets().toLocaleString() + "\uC6D0 \xB7 \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \xB7 \uD134 " + state.turnCount + (state.gameLivingReceivable ? " \xB7 \uBBF8\uC218 \uAE09\uC5EC(\uAD6C\uAC04 \uBC16 10\uC6D4 \uCD08 \uC785\uAE08) " + state.gameLivingReceivable.toLocaleString() + "\uC6D0\uC740 \uCD1D\uC790\uC0B0\xB7\uD604\uAE08\uC5D0 \uBBF8\uBC18\uC601" : "") + ". \uC2DC\uC138\uB294 \uC2E4\uC81C \uC790\uB8CC, \uC218\uC785\xB7\uC9C0\uCD9C\uC740 \uBA85\uC2DC \uAC8C\uC784\uAC12\uC785\uB2C8\uB2E4. \uC774 \uACB0\uACFC\uB85C \uC2E4\uC81C \uAE09\uC5EC\xB7\uC0DD\uACC4\xB7\uC9C4\uB85C\uC758 \uC6B0\uC5F4\uC744 \uD310\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>" + gameLivingSummaryHtml() + ((state.pendingOrders || []).length ? '<p class="note">\uBBF8\uCCB4\uACB0 \uC8FC\uBB38\uC740 \uAE30\uB85D\uC744 \uB0A8\uAE38 \uB54C \uCDE8\uC18C \uBC18\uD658 \uD6C4 \uACB0\uC0B0\uD569\uB2C8\uB2E4 [\uC2DC\uC5F0 \uADDC\uCE59].</p>' : "");
        renderChoices([{ id: "record-and-reset-end", label: "\uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" }], turn);
        renderPortfolio();
        return;
      }
      if (turn.kind === "natural-end") {
        card.innerHTML = '<div class="date">' + GAME_END + " \uC885\uB8CC \xB7 \uC778\uC0DD \uACB0\uC0B0 (\uACB0\uC0B0 \uAD00\uCE21 " + state.month + "-01)</div><h2>\uC54C\uACE0 \uC788\uB358 \uBBF8\uB798\uAC00 \uC624\uB298\uC774 \uB410\uC2B5\uB2C8\uB2E4</h2><p>\uD68C\uADC0\uD55C \uC2DC\uC810\uC5D0 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4. \uC804\uCCB4 \uAC8C\uC784\uC740 2026\uB144 10\uC6D4\uC5D0 \uC778\uC0DD\uC774 \uB2EB\uD600\uC694. \uD3EC\uC9C0\uC158\uC740 \uAC15\uC81C \uB9E4\uB3C4\uD558\uC9C0 \uC54A\uACE0 \uADF8 \uC2DC\uC810 \uD3C9\uAC00\uC561\uC73C\uB85C \uACB0\uC0B0\uD574\uC694 [\uC124\uACC4 \uC81C\uC548]. \uAE30\uB85D\uC740 \uD68C\uADC0 \uB300\uC2DC\uBCF4\uB4DC\uC5D0 \uB0A8\uC2B5\uB2C8\uB2E4.</p><p>\uCD1D\uC790\uC0B0 " + totalAssets().toLocaleString() + "\uC6D0 \xB7 \uD134 " + state.turnCount + " \xB7 \uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + "/100</p>" + ((state.pendingOrders || []).length ? '<p class="note">\uBBF8\uCCB4\uACB0 \uB9E4\uC218 \uC608\uC57D\uAE08\xB7\uB9E4\uB3C4 \uC608\uC57D \uC218\uB7C9\uB3C4 \uCD1D\uC790\uC0B0\uC5D0 \uD3EC\uD568\uB3FC\uC694. \uAE30\uB85D\uC744 \uB0A8\uAE38 \uB54C \uBBF8\uCCB4\uACB0 \uC8FC\uBB38\uC744 \uCDE8\uC18C\uD558\uACE0 \uC608\uC57D\uAE08\uC744 \uBC18\uD658\uD574 \uACB0\uC0B0\uD574\uC694 [\uC2DC\uC5F0 \uADDC\uCE59].</p>' : "");
        if (CASH_MODE) {
          const n = document.createElement("p");
          n.className = "note";
          n.textContent = "\uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 \uD68C\uADC0 [\uC784\uC758\uAC12] - \uC6D0\uB798 \uC21C\uC800\uCD95\uC740 \uB044\uACE0 \uC218\uC785/\uAC00\uC0C1\uCCAD\uAD6C/\uBBF8\uB0A9\uC744 \uC790\uC0B0\uD45C\uC5D0 \uBCC4\uB3C4\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC2E4\uC81C\uAE09\uC5EC\xB7\uD559\uBE44\xB7\uC0DD\uD65C\uBE44 \uACE0\uC99D\uC740 \uC544\uB2C8\uC5D0\uC694.";
          card.append(n);
        }
        appendSkipBanner(card);
        card.innerHTML += cashEndHtml();
        card.innerHTML += careerEndHtml();
        renderChoices([
          { id: "record-and-reset-end", label: "\uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" },
          { id: "end-continue", label: "\uACC4\uC18D \uB458\uB7EC\uBCF4\uAE30 (\uCD94\uAC00 \uD655\uBCF4 \uB274\uC2A4 \uC5C6\uC74C)" }
        ], turn);
        renderPortfolio();
        document.getElementById("footnote").textContent = "\uD134 " + state.turnCount + " \xB7 \uAC80\uC99D\uB41C \uC2DC\uC138 \uC9C0\uC810\uB9CC \uD45C\uC2DC";
        return;
      }
      if (turn.kind === "demo-end") {
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uC2DC\uC81C\uD488 \uAD6C\uAC04 \uC885\uB8CC</div><h2>\uAE30\uBCF8 \uC2DC\uC5F0 \uAD6C\uAC04\uC744 \uB9C8\uCCE4\uC2B5\uB2C8\uB2E4</h2><p>\uAE30\uBCF8 \uC2DC\uC5F0 \uAD6C\uAC04\uC740 1996\uB144 3\uC6D4~2003\uB144 12\uC6D4\uC785\uB2C8\uB2E4. \uACC4\uC18D\uD558\uBA74 2026\uB144 10\uC6D4\uAE4C\uC9C0\uC758 \uD655\uC7A5 \uC790\uB8CC\uB85C \uC774\uC5B4\uC838\uC694. \uD655\uC7A5 \uAD6C\uAC04\uC5D0\uB3C4 \uC77C\uBD80 \uB274\uC2A4\uC640 \uAC00\uACA9\uC774 \uC788\uC9C0\uB9CC \uC5F0\uB3C4\uBCC4 \uACF5\uBC31\xB7\uBBF8\uAC80\uC99D \uC790\uB8CC\uAC00 \uB0A8\uC544 \uC788\uC2B5\uB2C8\uB2E4. \uC5EC\uAE30\uC11C \uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0\uB97C \uC2DC\uC791\uD560 \uC218\uB3C4 \uC788\uC5B4\uC694.</p><p>\uCD1D\uC790\uC0B0 " + totalAssets().toLocaleString() + "\uC6D0 \xB7 \uD134 " + state.turnCount + " \xB7 \uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + "/100</p>";
        card.innerHTML += cashEndHtml();
        card.innerHTML += careerEndHtml();
        renderChoices([
          { id: "record-and-reset-demo", label: "\uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" },
          { id: "demo-continue", label: "\uACC4\uC18D \uB458\uB7EC\uBCF4\uAE30 (\uD655\uC7A5 \uC790\uB8CC \xB7 2026\uB144 10\uC6D4\uAE4C\uC9C0)" }
        ], turn);
        renderPortfolio();
        return;
      }
      if (turn.kind === "discharge") {
        const startPt = state.flags.militaryStart ? priceAt("kospi", state.flags.militaryStart) : null;
        const nowPt = priceAt("kospi", state.month);
        let line = "\uBCF5\uBB34 \uAD6C\uAC04\uC758 \uD655\uBCF4 \uC9C0\uC810\uC774 \uBD80\uC871\uD574\uC694.";
        if (startPt && nowPt) {
          const chg = ((nowPt.value - startPt.value) / startPt.value * 100).toFixed(1);
          line = "\uD655\uBCF4\uB41C \uB450 \uAD00\uCE21\uC810 \uBE44\uAD50: " + startPt.date + " " + startPt.value.toLocaleString() + " \u2192 " + nowPt.date + " " + nowPt.value.toLocaleString() + " (" + (chg >= 0 ? "+" : "") + chg + "%). \uB450 \uB0A0\uC9DC\uB294 \uAC01\uAC01 \uAC00\uC7A5 \uAC00\uAE4C\uC6B4 \uD655\uBCF4 \uC9C0\uC810\uC774\uBA70, \uBCF5\uBB34\uAE30\uAC04\uC758 \uC2E4\uC81C \uC2DC\uC7A5 \uC131\uACFC\uAC00 \uC544\uB2C8\uC5D0\uC694.";
        }
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uC9C4\uB85C\xB7\uC0DD\uD65C</div><h2>\uC804\uC5ED\uD588\uC2B5\uB2C8\uB2E4</h2><p>\uBCF5\uBB34\uB97C \uB9C8\uCE58\uACE0 \uC0AC\uD68C\uB85C \uB3CC\uC544\uC654\uB2E4. \uD655\uBCF4\uB41C \uAD00\uCE21\uC810 \uAE30\uC900\uC758 \uCC38\uACE0 \uBE44\uAD50\uC608\uC694. \uC2E4\uC81C \uBCF5\uBB34\uAE30\uAC04\uC758 \uC2DC\uC7A5 \uACBD\uB85C\xB7\uC131\uACFC\uC640\uB294 \uAD6C\uBD84\uB3FC\uC694.</p><p>" + line + "</p>";
        renderChoices([{ id: "discharge-ok", label: "\uD655\uC778 \u2014 \uB2E4\uC74C \uC9C4\uC785\uC73C\uB85C" }], turn);
        renderPortfolio();
        return;
      }
      if (turn.kind === "news" || turn.kind === "life") {
        const ev = turn.event;
        card.innerHTML = '<div class="date">' + ev.date + (ev.event_month ? " \uB178\uCD9C (\uC0AC\uAC74\uC6D4 " + ev.event_month + " \xB7 \uC815\uD655\uC77C \uBBF8\uD655\uC778, \uC775\uC6D4\uB85C \uBCF4\uC218\uC801 \uBC30\uCE58)" : ev.event_date ? " \uB178\uCD9C (\uC0AC\uAC74\uC77C " + ev.event_date + " \xB7 \uBCF4\uC218\uC801 \uBC1C\uD45C/\uD655\uC778\uC77C \uBC30\uCE58)" : "") + " \xB7 " + (turn.kind === "life" ? "\uC9C4\uB85C\xB7\uC0DD\uD65C" : "\uB274\uC2A4") + (effPostClose ? " \xB7 \uC7A5 \uB9C8\uAC10 \uD6C4 \uD310\uB2E8" : "") + "</div><h2>" + esc(ev.card_title) + "</h2><p>" + esc(CASH_MODE && turn.kind === "life" && ev.id === "life-grad" ? "\uCDE8\uC5C5 \uB610\uB294 \uC804\uC5C5\uC744 \uACE0\uB985\uB2C8\uB2E4. \uC774 \uBCC4\uB3C4 \uC2DC\uD5D8\uC5D0\uC11C\uB294 \uCDE8\uC5C5 \uC6D4\uC218\uC78530\uB9CC\uC6D0/\uC804\uC5C50\uC6D0\uC774\uBA70 \uB9E4\uC6D4 \uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uC2E4\uC81C\uAE09\uC5EC\xB7\uC0DD\uACC4\uAC00\uB2A5\uC131 \uADDC\uCE59\uC774 \uC544\uB2C8\uC5D0\uC694." : CASH_MODE && turn.kind === "life" && ev.id === "life-hs1" ? "\uACF5\uBD80 \uB610\uB294 \uC54C\uBC14\uB97C \uACE0\uB985\uB2C8\uB2E4. \uC774 \uBCC4\uB3C4 \uC2DC\uD5D8\uC5D0\uC11C\uB294 \uACE0\uAD50 \uC54C\uBC14 \uC6D4\uC218\uC78530\uB9CC\uC6D0/\uD559\uC0DD0\uC6D0\uC774\uBA70 \uC6D4\uC0DD\uD65C \uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0\uC740 \uB450 \uACBD\uB85C \uBAA8\uB450 \uC788\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uD559\uC5C5/\uADFC\uB85C \uBAA8\uD615\uC774 \uC544\uB2C8\uC5D0\uC694." : ev.card_summary) + "</p>" + (ev.historical_reconstruction ? '<p class="muted">\uC5ED\uC0AC \uC7AC\uAD6C\uC131 [\uC2DC\uC5F0]: \uB2F9\uC2DC \uAE30\uC0AC \uC6D0\uBB38 \uBBF8\uD655\uBCF4. \uD6C4\uB144 \uAE30\uB85D\uC744 \uBC14\uD0D5\uC73C\uB85C \uD55C \uCE74\uB4DC\uC774\uBA70 \uC815\uD655\uD55C \uB2F9\uC2DC \uBCF4\uB3C4\uC2DC\uAC01\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' : "") + (ev.impact_tags.length ? '<div class="tags">\uC601\uD5A5: ' + ev.impact_tags.join(", ") + "</div>" : "") + settlementNote(turn) + sourceDetails(ev) + lifeOutlookHtml(turn) + (!CASH_MODE && !careerCashActive() && turn.kind === "life" && ["life-scenario", "life-hs1", "life-grad"].includes(ev.id) ? '<p class="note">\uC0DD\uD65C \uD750\uB984 [\uBBF8\uC644\uC131]: \uD604\uC7AC\uB294 \uC2DC\uD5D8\uC6A9 \uC21C\uC800\uCD95\uB9CC \uB354\uD558\uBA70 \uC0DD\uD65C\uBE44\xB7\uD559\uBE44\xB7\uC138\uAE08\xB7\uC784\uAE08\uC758 \uBCC4\uB3C4 \uD750\uB984\uC740 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC544\uC694. \uC804\uC5C5\uC758 \uC0DD\uD65C\uBE44 \uCC28\uAC10\uB3C4 \uC544\uC9C1 \uC5C6\uC5B4\uC694. ' + (SCHOOL_MODE ? "\uBCF8\uD3B8 \uC9C4\uB85C\uC5D0\uB294 \uC790\uC0B0 \uC790\uACA9\uC744 \uB450\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0DD\uD65C\uACBD\uC81C\uAC00 \uBBF8\uC5F0\uACB0\uC774\uB77C \uD604\uC7AC \uC790\uC0B0\uC73C\uB85C \uC2E4\uC81C \uC0DD\uACC4 \uAC00\uB2A5\uC131\uC744 \uD310\uC815\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC804\uC5C5\uC740 \uB2E4\uC74C \uB2EC \uC815\uAE30 \uC21C\uC800\uCD950\uC6D0\uACFC \uCDE8\uC5C5 \uBCF5\uADC0 \uC5C6\uC74C\uC744 \uAC10\uC218\uD558\uB294 \uC120\uD0DD\uC774\uBA70 \uC218\uC775 \uC6B0\uB300\uB294 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uC804\uC5C5 \uC790\uC0B0 \uD558\uD55C 1,200\uB9CC \uC6D0\uC740 \uC6D4 100\uB9CC \uC6D0\xD712\uAC1C\uC6D4\uC774\uB77C\uB294 \uC2DC\uD5D8\uAC12\uC774\uC9C0 \uC2E4\uC81C \uC0DD\uD65C \uAC00\uB2A5\uC131 \uD310\uC815\uC774 \uC544\uB2D9\uB2C8\uB2E4.") + "</p>" : "") + (careerCashActive() && turn.kind === "life" && ["life-scenario", "life-hs1", "life-grad"].includes(ev.id) ? '<p class="note">\uC6D4 \uD604\uAE08\uC0AC\uAC74 [\uBA85\uC2DC \uAC8C\uC784\uC124\uACC4\uAC12]: \uC218\uC785\xB7\uC0DD\uD65C\uBE44\xB7\uD559\uBE44\uAC00 \uB9E4\uB2EC \uC790\uB3D9 \uBC18\uC601\uB418\uACE0 \uBD80\uC871\uBD84\uC740 \uBBF8\uB0A9\uC73C\uB85C \uB0A8\uC2B5\uB2C8\uB2E4. \uC804\uC5C5\uC740 \uAE09\uC5EC 0\uC6D0\uC5D0 \uC0DD\uD65C\uBE44 \uC6D4 ' + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0\uC774 \uACC4\uC18D \uB098\uAC00\uB294 \uC120\uD0DD\uC774\uBA70 \uC218\uC775 \uC6B0\uB300\uB294 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uAE09\uC5EC\xB7\uBB3C\uAC00\xB7\uD559\uBE44 \uD1B5\uACC4\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p>" : "");
        if (ev.unlock && !state.unlocksSeen.includes(ev.unlock)) {
          const prod = DATA.unlocks.find((u) => u.product === ev.unlock);
          if (productAvailable(prod)) {
            unlockArea.innerHTML += '<div class="unlock-banner">\uC0C8 \uC811\uADFC \uACBD\uB85C: ' + esc(prod.name) + " \u2014 \uC2DC\uC7A5 \uAC1C\uC7A5\uACFC \uC2E4\uC81C \uAC1C\uC778 \uC0C1\uD488 \uC811\uADFC\uC740 \uBCC4\uAC1C\uB85C \uAC80\uC99D\uD574\uC694</div>";
            state.unlocksSeen.push(ev.unlock);
          }
        }
        if (turn.kind === "life" && ev.choices) {
          renderChoices(ev.choices.map((c) => ({ id: "life:" + c.id, label: CASH_MODE && c.id === "job" ? "\uCDE8\uC5C5 - \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC2DC\uD5D8\uC218\uC78530\uB9CC\uC6D0" : CASH_MODE && c.id === "study" ? "\uACF5\uBD80 \uC9D1\uC911 - \uC2DC\uD5D8\uC218\uC7850\uC6D0/\uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0" : CASH_MODE && c.id === "parttime" ? "\uC54C\uBC14 \uBCD1\uD589 - \uACE0\uAD50\uC2DC\uD5D8\uC218\uC78530\uB9CC\uC6D0/\uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0" : CASH_MODE && c.id === "fulltime" ? "\uC804\uC5C5 \uD22C\uC790 - \uC2DC\uD5D8\uC218\uC7850\uC6D0/\uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0" : SCHOOL_MODE && c.id === "go-now" ? "\uBC14\uB85C \uC785\uB300 (26\uAC1C\uC6D4 \uC784\uC758 \uC2DC\uD5D8 \xB7 \uD574\uB2F9\uC5F0\uB3C4 \uC2E4\uC81C \uADDC\uC815 \uBBF8\uC5F0\uACB0)" : c.label })), turn);
          if (ev.id === "life-grad" && !(SCHOOL_MODE && !CASH_MODE)) {
            const btn = [...document.getElementById("choices").children].find((x) => x.textContent.includes("\uC804\uC5C5 \uD22C\uC790"));
            if (btn && totalAssets() < FULLTIME_GATE) {
              btn.disabled = true;
              btn.textContent += " \u2014 \uC790\uC0B0 \uD558\uD55C " + FULLTIME_GATE.toLocaleString() + "\uC6D0 \uBBF8\uB2EC [\uC2DC\uD5D8\uC6A9 \uAC00\uC815]";
            }
          }
        } else {
          renderChoices([
            { id: "enter", label: "\uC774 \uB274\uC2A4\uC5D0 \uB300\uC751\uD574 \uD3EC\uC9C0\uC158 \uC870\uC815" },
            { id: "hold", label: "\uC720\uC9C0 (\uC9C0\uAE08 \uBCF4\uC720 \uADF8\uB300\uB85C)" },
            { id: "skip", label: "\uAC74\uB108\uB6F0\uAE30 (\uB2E4\uC74C \uC9C4\uC785\uC73C\uB85C)" }
          ], turn);
          {
            const ta0 = tradeAccess(turn);
            const b0 = document.getElementById("choices").querySelector("button");
            if (ta0.reserveOnly) b0.textContent = "\uC774 \uB274\uC2A4\uC5D0 \uB300\uC751\uD574 \uC608\uC57D \uC8FC\uBB38 (\uB2E4\uAC00\uC624\uB294 \uBD84\uAE30 \uC815\uC0B0 \uC774\uD6C4 \uCCB4\uACB0 \uB300\uAE30)";
            else if (!ta0.allowed) {
              b0.disabled = true;
              b0.textContent = !albaTimeAvailable() ? tradeAccess(turn).label : schoolDataGap() ? "\uC0C1\uD488\uC811\uADFC\xB7\uAC00\uACA9 \uBBF8\uD655\uC778 - \uB9E4\uB9E4 \uCC28\uB2E8 (1996-03 \uC804)" : CAREER_TRIAL ? "\uACC4\uD68D\uD615 \uCDE8\uC5C5: \uB274\uC2A4 \uC5F4\uB78C \xB7 \uC0C8 \uC8FC\uBB38\uC740 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C" : "\uB274\uC2A4 \uB300\uC751 \uC8FC\uBB38 \uBD88\uAC00 \u2014 \uC9C1\uC7A5\uC778\uC740 \uBD84\uAE30 \uC815\uC0B0 \uB9AC\uBC38\uB7F0\uC2F1\uC5D0\uC11C\uB9CC \uC8FC\uBB38 [\uC124\uACC4 \uC81C\uC548]";
            }
          }
        }
      } else {
        card.innerHTML = '<div class="date">' + state.month + (turn.settlement ? " \xB7 \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134" : schoolDataGap() ? " \xB7 \uC790\uB8CC\uACF5\uBC31 \uC6D4" : " \xB7 \uD3C9\uC628") + "</div>" + (turn.settlement ? CAREER_TRIAL ? "<h2>\uBD84\uAE30 \uACC4\uD68D\uC744 \uC815\uD569\uB2C8\uB2E4</h2><p>\uAC19\uC740 \uACF5\uAC1C\uC790\uB8CC\uB97C \uC77D\uACE0 \uD604\uC7AC\uC790\uAE08\uC758 \uC8FC\uBB38\uACFC \uC55E\uC73C\uB85C\uC758 \uC2E0\uADDC\uC720\uC785 \uBC30\uBD84\uC744 \uACE0\uB985\uB2C8\uB2E4. \uC0C8 \uC8FC\uBB38\uC744 \uD655\uC815\uD558\uAC70\uB098 \uC720\uC9C0\uB97C \uACE0\uB974\uBA74 \uC774 \uBD84\uAE30 \uAC80\uD1A0\uB97C \uB9C8\uCE69\uB2C8\uB2E4. \uBC30\uBD84 \uC124\uC815\xB7\uCDE8\uC18C\uB9CC\uC73C\uB85C\uB294 \uC815\uC0B0\uC744 \uC18C\uBE44\uD558\uC9C0 \uC54A\uC73C\uBA70, \uC5F4\uB9B0 \uC815\uC0B0\uC5D0\uC11C\uB294 \uBC18\uD658 \uD604\uAE08\uC73C\uB85C \uB2E4\uC2DC \uC8FC\uBB38\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC774 \uD654\uBA74\uB9CC\uC73C\uB85C \uC6D4\xB7\uC774\uC790\uAC00 \uB298\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 [\uC2DC\uD5D8\uADDC\uCE59].</p>" : "<h2>\uBD84\uAE30 \uC790\uC0B0\uC744 \uC810\uAC80\uD569\uB2C8\uB2E4</h2><p>\uC774 \uB2EC\uC758 \uB274\uC2A4 \uC120\uD0DD\uC744 \uB9C8\uCE5C \uB4A4 \uB9AC\uBC38\uB7F0\uC2F1 \uAE30\uD68C\uB97C \uD55C \uBC88 \uAC16\uC2B5\uB2C8\uB2E4. \uB274\uC2A4 \uB300\uC751 \uC8FC\uBB38\uACFC\uB294 \uBCC4\uAC1C\uC608\uC694. \uC774 \uD654\uBA74\uB9CC\uC73C\uB85C \uAC8C\uC784 \uC6D4\uC774\uB098 \uC774\uC790\uB294 \uCD94\uAC00\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 [\uC2DC\uC5F0 \uC124\uACC4].</p>" : quietIntro()) + quietMarketLine() + settlementNote(turn) + (reservationSettlementDue() ? '<p class="note reservation-settlement-note">\uCDE8\uC5C5 \uC911 \uC811\uC218\uD55C \uAE30\uC874 \uC608\uC57D\uC758 \uBD84\uAE30 \uC815\uC0B0\uC785\uB2C8\uB2E4. \uC9C4\uB85C\uB97C \uBC14\uAFD4\uB3C4 \uC774 \uAC80\uD1A0\uB294 \uB0A8\uC2B5\uB2C8\uB2E4. \uC720\uC9C0 \uB610\uB294 \uC8FC\uBB38 \uD655\uC815\uC73C\uB85C \uB9C8\uCE5C \uB4A4, \uBBF8\uB0A9\uC774 \uC5C6\uACE0 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uC774 \uC788\uC5B4\uC57C \uCCB4\uACB0\uB429\uB2C8\uB2E4. \uBBF8\uB798 \uBD84\uAE30\uB294 \uC55E\uB2F9\uAE30\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' : "");
        renderChoices([
          { id: "rebalance", label: "\uB9AC\uBC38\uB7F0\uC2F1 (\uBE44\uC911 \uC870\uC815)" },
          { id: "hold", label: "\uC720\uC9C0" },
          { id: "next", label: "\uB2E4\uC74C \uB2EC\uB85C \uC9C4\uC785" },
          { id: "skip-preview", label: "\uB2E4\uC74C \uB274\uC2A4\uAE4C\uC9C0 \uAC74\uB108\uB6F0\uAE30 (\uD655\uBCF4 \uC790\uB8CC \uAE30\uC900 \xB7 \uB3C4\uCC29 \uBBF8\uB9AC\uBCF4\uAE30)" }
        ], turn);
        if (!tradeAccess(turn).allowed) {
          const b0 = document.getElementById("choices").querySelector("button");
          b0.disabled = true;
          b0.textContent = !albaTimeAvailable() ? tradeAccess(turn).label : schoolDataGap() ? "\uC790\uB8CC\uACF5\uBC31 \uAD6C\uAC04 - \uB9E4\uB9E4 \uCC28\uB2E8 (1996-03 \uC804)" : "\uB9AC\uBC38\uB7F0\uC2F1 \uBD88\uAC00 \u2014 \uC9C1\uC7A5\uC778\uC740 \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134\uC5D0\uC11C\uB9CC \uC8FC\uBB38 [\uC124\uACC4 \uC81C\uC548]";
        }
      }
      if (CASH_MODE) {
        const n = document.createElement("p");
        n.className = "note";
        n.textContent = "\uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 \uD68C\uADC0 [\uC784\uC758\uAC12] - \uC6D0\uB798 \uC21C\uC800\uCD95\uC740 \uB044\uACE0 \uC218\uC785/\uAC00\uC0C1\uCCAD\uAD6C/\uBBF8\uB0A9\uC744 \uC790\uC0B0\uD45C\uC5D0 \uBCC4\uB3C4\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC2E4\uC81C\uAE09\uC5EC\xB7\uD559\uBE44\xB7\uC0DD\uD65C\uBE44 \uACE0\uC99D\uC740 \uC544\uB2C8\uC5D0\uC694.";
        card.append(n);
      }
      const switchStatus = careerSwitchStatus(turn);
      if (switchStatus) {
        const button = document.createElement("button");
        button.id = "career-switch-open";
        button.textContent = "\uCDE8\uC5C5 \uC720\uC9C0 \uB610\uB294 \uC804\uC5C5 \uC804\uD658 \uAC80\uD1A0 [\uC2DC\uD5D8\uADDC\uCE59]";
        button.disabled = !switchStatus.allowed;
        button.onclick = renderCareerSwitch;
        choices.append(button);
        const note = document.createElement("p");
        note.className = "note career-switch-status";
        note.textContent = switchStatus.reason + (careerCashActive() ? " \xB7 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uB2E4\uC2DC \uACE0\uB985\uB2C8\uB2E4. \uC804\uC5C5 \uC804\uD658 \uB4A4 \uAE09\uC5EC \uC218\uC785\uC740 0\uC6D0\uC785\uB2C8\uB2E4." : " \xB7 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uB2E4\uC2DC \uACE0\uB985\uB2C8\uB2E4. \uC804\uC5C5 \uC804\uD658 \uB4A4 \uC21C\uC800\uCD95\uC7400\uC6D0\uC785\uB2C8\uB2E4.");
        choices.append(note);
      }
      const recoveryStatus = careerRecoveryStatus(turn);
      if (recoveryStatus) {
        const rbutton = document.createElement("button");
        rbutton.id = "career-recovery-open";
        rbutton.textContent = "\uC804\uC5C5 \uC720\uC9C0 \uB610\uB294 \uC54C\uBC14\xB7\uC7AC\uCDE8\uC5C5 \uAC80\uD1A0 [\uC2DC\uD5D8\uADDC\uCE59]";
        rbutton.onclick = renderCareerRecovery;
        choices.append(rbutton);
        const rnote = document.createElement("p");
        rnote.className = "note career-switch-status";
        rnote.textContent = "\uB9E4 \uBD84\uAE30\uC6D4(03\xB706\xB709\xB712)\uC5D0 \uB2E4\uC2DC \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC7AC\uCDE8\uC5C5\uC744 \uACE0\uB974\uBA74 \uC804\uC5C5\xB7\uC54C\uBC14\uB85C \uB418\uB3CC\uC544\uC624\uB294 \uC120\uD0DD\uC740 \uC5C6\uC2B5\uB2C8\uB2E4.";
        choices.append(rnote);
      }
      const cycleStatus = careerCycleStatus(turn);
      if (cycleStatus) {
        const b = document.createElement("button");
        b.id = "career-cycle-open";
        b.textContent = "\uCDE8\uC5C5\xB7\uC804\uC5C5\xB7\uC54C\uBC14 \uC7A5\uAE30 \uC9C4\uB85C \uBE44\uAD50";
        b.onclick = () => renderCareerCycle();
        choices.append(b);
        const n = document.createElement("p");
        n.className = "note";
        n.textContent = cycleStatus.reason;
        choices.append(n);
      }
      appendCareerActionGuide(choices, turn);
      if (careerBatchAllowed()) appendInlineProgress(choices, "job");
      if (decisionPaceAllowed()) appendInlineProgress(choices, "pace");
      card.innerHTML += decisionPaceReportHtml();
      card.innerHTML += careerBatchReportHtml();
      if (SCHOOL_MODE) card.innerHTML += careerTrialNote() + schoolTrialNote(true);
      appendSkipBanner(card);
      renderPortfolio();
      document.getElementById("footnote").textContent = "\uD134 " + state.turnCount + (SCHOOL_MODE ? " \xB7 \uACE01 \uB2EC\uB825 \uC2DC\uD5D8 \xB7 \uC5ED\uC0AC/\uACBD\uC81C \uACE0\uC99D \uBBF8\uC644\uC131" : " \xB7 \uAC80\uC99D\uB41C \uC2DC\uC138 \uC9C0\uC810\uB9CC \uD45C\uC2DC") + (state.flags.birth ? " \xB7 " + state.flags.birth.year + "\uB144 " + state.flags.birth.month + "\uC6D4\uC0DD \xB7 \uACE01 " + state.flags.birth.hsYear + "\uB144" : "") + (state.flags.demoScenario === "pre1996-study" ? " \xB7 \uC2DC\uC5F0\uC6A9 \uC2DC\uB098\uB9AC\uC624: \uC9C4\uD559 \uB8E8\uD2B8 \uD655\uC815\xB7\uC7AC\uD559 \uC9C4\uD589 \uC0C1\uD0DC\uB85C \uC2DC\uC791 [\uC2DC\uC5F0 \uC81C\uC57D]" : "");
    }
    function careerActionGuide(turn) {
      if (!careerCycleActive() || !turn || !["news", "quiet"].includes(turn.kind) || militaryActive() || state.flags.gameOver || state.month > GAME_END) return null;
      const track = careerCycleTrack();
      if (!track) return null;
      const access = tradeAccess(turn), unpaid = careerCashBuyHoldOn() && careerCashUnpaid() > 0;
      let title = "", text = "", shortcut = "";
      if (track === "job") {
        const canSet = cashPlanCanSet(50), month = nextSettlementMonth();
        title = "\uCDE8\uC5C5 \xB7 \uC9C0\uAE08 \uD560 \uC218 \uC788\uB294 \uD589\uB3D9";
        text = canSet ? "\uC9C0\uAE08 \uC5F4\uB9B0 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC6D4 \uC5EC\uC720\uAE08 \uBC30\uBD84\uC744 \uC124\uC815\uD560 \uC218 \uC788\uC5B4\uC694. \uC124\uC815\uC740 \uB2E4\uC74C \uB2EC \uC0C8 \uC5EC\uC720\uAE08\uBD80\uD130 \uC801\uC6A9\uB429\uB2C8\uB2E4." : month > GAME_END ? "\uC774\uBC88 \uD68C\uADC0\uC5D0\uB294 \uB0A8\uC740 \uBD84\uAE30 \uC815\uC0B0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC55E\uC73C\uB85C\uC758 \uC0C8 \uC608\uC57D \uC911\uB2E8\uACFC \uAE30\uC874 \uC608\uC57D \uCDE8\uC18C\uB294 \uBCC4\uB3C4\uC608\uC694." : (month === state.month ? "\uC774\uBC88 \uB2EC(" + month + ") \uC815\uC0B0 \uC804\uC6A9 \uD134\uC5D0\uC11C" : "\uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0(" + month + ")\uC5D0\uC11C") + " \uC6D4 \uC5EC\uC720\uAE08 \uBC30\uBD84\uC744 \uC124\uC815\xB7\uC7AC\uAC1C\uD560 \uC218 \uC788\uC5B4\uC694. \uC55E\uC73C\uB85C\uC758 \uC0C8 \uC608\uC57D \uC911\uB2E8\uACFC \uAE30\uC874 \uC608\uC57D \uCDE8\uC18C\uB294 \uBCC4\uB3C4\uC608\uC694.";
        shortcut = canSet ? "\uC6D4 \uC5EC\uC720\uAE08 \uBC30\uBD84 \uAC80\uD1A0" : "\uD604\uC7AC \uBC30\uBD84\uACFC \uC124\uC815 \uC2DC\uC810 \uD655\uC778";
      } else {
        title = track === "alba" && albaTimeLimited() ? "\uC54C\uBC14 \xB7 \uC774\uBC88 \uB2EC \uC218\uB3D9 \uD22C\uC790 \uD310\uB2E8 " + (albaTimeAvailable() ? "1\uD68C \uB0A8\uC74C" : "\uC0AC\uC6A9 \uC644\uB8CC") : track === "alba" ? "\uC54C\uBC14 \xB7 \uC9C0\uAE08 \uD560 \uC218 \uC788\uB294 \uD589\uB3D9" : "\uC804\uC5C5 \uD22C\uC790 \xB7 \uC9C0\uAE08 \uD560 \uC218 \uC788\uB294 \uD589\uB3D9";
        text = track === "alba" && albaTimeLimited() && !albaTimeAvailable() ? "\uC0C8 \uC8FC\uBB38\xB7\uC870\uAC74\xB7\uAE30\uD55C \uBCC0\uACBD\uC740 \uB2E4\uC74C \uB2EC\uC5D0 1\uD68C \uBCF5\uC6D0\uB429\uB2C8\uB2E4. \uC8FC\uBB38 \uCDE8\uC18C\xB7\uBBF8\uB0A9 \uC0C1\uD658\uC740 \uBCC4\uB3C4\uC608\uC694." : access.label + " \xB7 \uAC00\uACA9\uD615 \uC8FC\uBB38\uC740 \uC811\uC218 \uB4A4 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uC744 \uAE30\uB2E4\uB9BD\uB2C8\uB2E4.";
      }
      if (unpaid) text += " \uBBF8\uB0A9 \uC0C1\uD658 \uC804\uC5D0\uB294 \uC0C8 \uB9E4\uC218 \uC811\uC218\xB7\uB300\uAE30 \uB9E4\uC218 \uCCB4\uACB0\uC774 \uBCF4\uB958\uB429\uB2C8\uB2E4.";
      return { title, text, shortcut };
    }
    function careerChaosRiskNote() {
      const tr = chaosTrajectory(null);
      const nearOver = Number.isInteger(tr.overMonth) && tr.overMonth > 0 && tr.overMonth <= 3;
      const nearWarn = Number.isInteger(tr.warnMonth) && tr.warnMonth > 0 && tr.warnMonth <= 3;
      if (!nearOver && !nearWarn) return null;
      const target = nearOver ? "\uD55C\uACC4100" : "\uC8FC\uC75870", months = nearOver ? tr.overMonth : tr.warnMonth;
      return "\uD604\uC7AC \uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + "/100 \xB7 \uD604 \uBCF4\uC720\xB7\uAC00\uACA9\xB7\uC2DC\uC7A5\uADDC\uBAA8\uB97C \uC720\uC9C0\uD558\uBA74 +" + months + "\uAC1C\uC6D4\uC5D0 " + target + " \uC774\uC0C1\uC778 \uAC00\uC815\uC785\uB2C8\uB2E4. \uC0B0\uC815 \uAC00\uB2A5\uD55C \uBCF4\uC720\uB9CC \uACC4\uC0B0\uD55C \uAC8C\uC784 \uCD94\uC815\uC774\uBA70 \uC2E4\uC81C \uB3C4\uB2EC\uC6D4\xB7\uBBF8\uB798 \uAC00\uACA9 \uC608\uCE21\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uB9E4\uB3C4 \uC811\uC218\uB9CC\uC73C\uB85C \uB178\uCD9C\uC774 \uC904\uC9C0\uB294 \uC54A\uACE0, \uC2E4\uC81C \uCCB4\uACB0 \uB54C \uB9E4\uB3C4 \uCDA9\uACA9\uB3C4 \uC0DD\uAE38 \uC218 \uC788\uC5B4\uC694.";
    }
    function holdingDecisionReview(turn) {
      if (!careerCycleActive() || !turn || !["news", "quiet"].includes(turn.kind) || militaryActive() || state.flags.gameOver || state.month > GAME_END) return null;
      const products = [.../* @__PURE__ */ new Set([...Object.keys(state.holdings).filter((p) => state.holdings[p]?.qty > 0), ...(state.pendingOrders || []).filter((o) => o.kind === "sell").map((o) => o.product)])];
      if (!products.length) return null;
      const previous = DATA.events[state.eventIndex - 1];
      const reference = previous ? turnEffDate({ event: previous }) : null;
      const usableReference = reference && reference.date <= effDate ? reference : null;
      const pointAtReference = (series) => {
        if (!usableReference) return null;
        const points = DATA.prices.filter((pt) => pt.series === series && !pt.uncertain && !pt.unverified && wasObservableAt(pt, usableReference.date, usableReference.postClose));
        return points.length ? points[points.length - 1] : null;
      };
      const same = (a, b) => !!a && !!b && a.date === b.date && a.value === b.value && (a.usable_from || null) === (b.usable_from || null);
      const rows = products.map((product) => {
        const rule = productRule(product), series = rule.series || product;
        const priced = ["price", "fxaccrual", "fxprice"].includes(rule.rule);
        const asset = priced ? priceAt(series, state.month) : null, before = priced ? pointAtReference(series) : null;
        const fx = rule.rule === "fxprice" ? priceAt("fx", state.month) : null, beforeFx = rule.rule === "fxprice" ? pointAtReference("fx") : null;
        return { product, name: rule.name || product, rule: rule.rule, unit: rule.rule === "fxprice" ? "USD" : series === "fx" ? "KRW/USD" : ["kospi", "kosdaq"].includes(series) ? "\uC9C0\uC218 pt" : "\uC6D0\uC790\uB8CC \uB2E8\uC704", asset, fx, before, beforeFx, assetStatus: !priced ? "not-priced" : !asset ? "missing" : !before ? "no-reference" : same(asset, before) ? "same" : "changed", fxStatus: rule.rule !== "fxprice" ? "not-used" : !fx ? "missing" : !beforeFx ? "no-reference" : same(fx, beforeFx) ? "same" : "changed" };
      });
      return { reference: usableReference?.date || null, rows };
    }
    function appendHoldingDecisionReview(section, turn) {
      const review = holdingDecisionReview(turn);
      if (!review) return;
      const details = document.createElement("details");
      details.className = "holding-decision-review";
      const summary = document.createElement("summary");
      summary.style.cssText = "min-height:44px;padding:10px 0;box-sizing:border-box;cursor:pointer";
      summary.textContent = "\uBCF4\uC720 \uD310\uB2E8 \uADFC\uAC70 \xB7 " + review.rows.length + "\uC0C1\uD488 / \uC2DC\uC138 \uC0C8 \uC9C0\uC810 " + review.rows.filter((r) => r.assetStatus === "changed").length + " \xB7 \uD658\uC728 \uC0C8 \uC9C0\uC810 " + (review.rows.some((r) => r.fxStatus === "changed") ? 1 : 0);
      details.append(summary);
      const intro = document.createElement("p");
      intro.textContent = review.reference ? "\uD604\uC7AC \uAD00\uCE21 " + effDate + "\uC640 \uC790\uB8CC\uBAA9\uB85D \uC9C1\uC804 \uB274\uC2A4 \uAE30\uC900 " + review.reference + "\uC758 \uD655\uBCF4 \uAC00\uB2A5 \uC9C0\uC810\uC744 \uBE44\uAD50\uD569\uB2C8\uB2E4. \uADF8 \uB274\uC2A4\uB97C \uC9C1\uC811 \uC77D\uAC70\uB098 \uB2F9\uC2DC \uC774 \uC0C1\uD488\uC744 \uBCF4\uC720\uD588\uB2E4\uB294 \uAE30\uB85D\uC740 \uC544\uB2D9\uB2C8\uB2E4." : "\uD604\uC7AC \uAD00\uCE21 " + effDate + "\uC758 \uBCF4\uC720 \uAD00\uB828 \uD655\uBCF4 \uC9C0\uC810\uC785\uB2C8\uB2E4. \uBE44\uAD50\uD560 \uC9C1\uC804 \uB274\uC2A4 \uAE30\uC900\uC740 \uC5C6\uC2B5\uB2C8\uB2E4.";
      details.append(intro);
      const labels = { same: "\uAE30\uC900\uACFC \uAC19\uC740 \uC9C0\uC810", changed: "\uAE30\uC900 \uB4A4 \uB2E4\uB978 \uC9C0\uC810 \uD655\uBCF4", "no-reference": "\uAE30\uC900 \uC2DC\uC810 \uC9C0\uC810 \uC5C6\uC74C", missing: "\uD604\uC7AC \uC9C0\uC810 \uC5C6\uC74C", "not-priced": "\uC2DC\uC138\uD615 \uC0C1\uD488 \uC544\uB2D8", "not-used": "\uBCC4\uB3C4 \uD658\uC728 \uBCC0\uD658 \uC5C6\uC74C" };
      const pointText = (pt) => pt ? pt.value.toLocaleString() + " \xB7 " + fmtPtDate(pt) + (pt.usable_from ? " \xB7 \uC774\uC6A9\uAC8C\uC774\uD2B8 " + pt.usable_from : "") : "\uC5C6\uC74C";
      for (const r of review.rows) {
        const row = document.createElement("section");
        row.className = "holding-decision-product";
        row.style.cssText = "padding:10px 0;border-top:1px solid #ddd;overflow-wrap:anywhere";
        const name = document.createElement("strong");
        name.textContent = r.name;
        row.append(name);
        const asset = document.createElement("p");
        asset.textContent = "\uC2DC\uC138: " + labels[r.assetStatus] + (r.asset ? " / " + pointText(r.asset) + " " + r.unit : "");
        row.append(asset);
        if (r.assetStatus === "changed") {
          const prior = document.createElement("p");
          prior.className = "note";
          prior.textContent = "\uBE44\uAD50 \uAE30\uC900 \uC2DC\uC138: " + pointText(r.before) + " " + r.unit;
          row.append(prior);
        }
        if (r.rule === "fxprice") {
          const fx = document.createElement("p");
          fx.textContent = "\uD658\uC728: " + labels[r.fxStatus] + " / " + pointText(r.fx) + " KRW/USD. \uC2DC\uC138\uC640 \uD658\uC728\uC758 \uC790\uB8CC \uB0A0\uC9DC\uB294 \uC11C\uB85C \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
          row.append(fx);
          if (r.fxStatus === "changed") {
            const prior = document.createElement("p");
            prior.className = "note";
            prior.textContent = "\uBE44\uAD50 \uAE30\uC900 \uD658\uC728: " + pointText(r.beforeFx) + " KRW/USD";
            row.append(prior);
          }
        }
        const orders = (state.pendingOrders || []).filter((o) => o.product === r.product);
        if (orders.length) {
          const order = document.createElement("p");
          order.textContent = "\uC774 \uC0C1\uD488 \uB300\uAE30 \uC8FC\uBB38 " + orders.length + "\uAC74. \uC811\uC218\uB9CC\uC73C\uB85C \uBCF4\uC720 \uB178\uCD9C\uC774 \uC904\uAC70\uB098 \uB9E4\uB3C4\uB300\uAE08\uC774 \uC0DD\uAE30\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC870\uAC74\xB7\uAE30\uD55C\xB7\uC7A0\uAE08 \uC218\uB7C9\uC740 \uC544\uB798 \uB300\uAE30 \uC8FC\uBB38\uC5D0\uC11C \uD655\uC778\xB7\uCDE8\uC18C\uD569\uB2C8\uB2E4.";
          row.append(order);
        }
        details.append(row);
      }
      const caution = document.createElement("p");
      caution.className = "note";
      caution.textContent = "\uC0C8 \uAD00\uCE21\uC740 \uB9E4\uC218\xB7\uB9E4\uB3C4 \uC2E0\uD638\uB098 \uCCB4\uACB0 \uBCF4\uC7A5\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAC19\uC740 \uC9C0\uC810\uC774\uC5B4\uB3C4 \uB274\uC2A4\uC758 \uC758\uBBF8\xB7\uC0DD\uD65C\uBE44\xB7\uBBF8\uB0A9\xB7\uCE74\uC624\uC2A4\uB294 \uB530\uB85C \uD310\uB2E8\uD569\uB2C8\uB2E4. \uC5C6\uB294 \uC2DC\uC138\xB7\uBBF8\uB798 \uAC00\uACA9\xB7\uB2E4\uC74C \uAD00\uCE21\uC77C\uC744 \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      details.append(caution);
      const access = tradeAccess(turn), trade = document.createElement("button");
      trade.id = "holding-review-trade";
      trade.textContent = access.reserveOnly ? "\uD604\uC7AC \uC8FC\uBB38 \uD654\uBA74\uC5D0\uC11C \uC608\uC57D \uAC80\uD1A0" : "\uD604\uC7AC \uC8FC\uBB38 \uD654\uBA74\uC5D0\uC11C \uBCF4\uC720 \uC870\uC815 \uAC80\uD1A0";
      trade.disabled = !access.allowed;
      trade.onclick = () => choose(turn.kind === "news" ? "enter" : "rebalance", turn);
      details.append(trade);
      if (!access.allowed) {
        const lock = document.createElement("p");
        lock.className = "note";
        lock.textContent = access.label;
        details.append(lock);
      }
      section.append(details);
    }
    function appendCareerActionGuide(choices, turn) {
      const guide = careerActionGuide(turn);
      if (!guide) return;
      const section = document.createElement("section");
      section.className = "career-action-guide note";
      section.setAttribute("aria-label", "\uD604\uC7AC \uC9C4\uB85C \uD589\uB3D9 \uC548\uB0B4");
      const title = document.createElement("strong");
      title.textContent = guide.title;
      section.append(title);
      const text = document.createElement("p");
      text.textContent = guide.text;
      text.style.margin = "6px 0 0";
      section.append(text);
      const risk = careerChaosRiskNote();
      if (risk) {
        const note = document.createElement("p");
        note.className = "career-chaos-risk-note";
        note.style.cssText = "margin:10px 0 0;padding:10px;border-left:3px solid #9b6136;background:#fff8ef;";
        note.textContent = risk;
        section.append(note);
      }
      if (guide.shortcut) {
        const button = document.createElement("button");
        button.id = "career-plan-shortcut";
        button.textContent = guide.shortcut;
        button.style.marginTop = "10px";
        button.onclick = () => renderJobSavingsPlan();
        section.append(button);
      }
      appendHoldingDecisionReview(section, turn);
      choices.append(section);
    }
    function cashLifeOutlookHtml(turn) {
      if (turn.kind !== "life" || !turn.event || !["life-hs1", "life-grad", "life-scenario"].includes(turn.event.id)) return "";
      const id = turn.event.id, c = cashSummary(), gross = totalAssets();
      const row = (title, text) => '<section style="padding:10px 0;border-top:1px solid #ddd;overflow-wrap:anywhere"><h3 style="font-size:1rem;margin:0 0 6px">' + esc(title) + '</h3><p style="margin:0">' + esc(text) + "</p></section>";
      let body = "";
      if (id === "life-hs1") {
        body += row("\uACF5\uBD80\uC640 \uC54C\uBC14\uC758 \uD604\uAE08 \uD750\uB984 [\uC784\uC758\uAC12]", "\uACF5\uBD80\xB7\uC7AC\uD559 \uC911 \uC6D4\uC218\uC7850\uC6D0, \uACE0\uAD50 \uC54C\uBC14 \uC6D4\uC218\uC78530\uB9CC\uC6D0\uC785\uB2C8\uB2E4. \uACE0\uAD50 \uC878\uC5C5 \uB4A4 \uC54C\uBC14 \uACBD\uB85C\uB294 \uC804\uC5C5\uC73C\uB85C \uC774\uC5B4\uC838 \uC6D4\uC218\uC7850\uC6D0\uC774\uBA70 \uBCC4\uB3C4 \uCDE8\uC5C5 \uC120\uD0DD\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. \uACF5\uBD80 \uACBD\uB85C\uB294 \uC7AC\uD55948\uAC1C\uC6D4\uC744 \uCC44\uC6B4 \uC878\uC5C5 \uC120\uD0DD\uC5D0\uC11C \uCDE8\uC5C5 \uC6D4\uC218\uC78530\uB9CC\uC6D0 \uB610\uB294 \uC804\uC5C50\uC6D0\uC744 \uACE0\uB985\uB2C8\uB2E4. \uB458 \uB2E4 \uB9E4\uC6D4 \uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0\uC774 \uC788\uACE0, \uC7AC\uD559 \uACBD\uB85C\uB294 \uCD5C\uCD08 \uC7AC\uD559 \uC6D4\uC9C4\uD589\uC5D0 \uD559\uBE44\uAC00\uC0C1\uCCAD\uAD6C80\uB9CC\uC6D0\uC774 \uD55C \uBC88 \uC788\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC6D4 \uC21C\uC800\uCD95\uC740 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      } else if (id === "life-scenario") {
        body += row("\uC2DC\uC791 \uC774\uB825\uC758 \uCC28\uC774 [\uC784\uC758\uAC12]", "\uC9C4\uD559 \uC2DC\uB098\uB9AC\uC624\uB294 \uB300\uD559 \uC7AC\uD559\uACFC \uC77C\uBD80 \uBCF5\uBB34 \uC774\uB825\uC744 \uAC00\uC815\uD558\uBA70, \uCD5C\uCD08 \uC7AC\uD559 \uC6D4\uC9C4\uD589\uC5D0 \uD559\uBE44\uAC00\uC0C1\uCCAD\uAD6C80\uB9CC\uC6D0\uC774 \uD55C \uBC88 \uC788\uC2B5\uB2C8\uB2E4. \uC77C\uBC18 \uC2DC\uC791\uC740 \uC9C4\uB85C \uC774\uB825 \uBBF8\uC815\uC774\uBA70 \uC790\uB3D9 \uCDE8\uC5C5\uC774\uB098 \uC6D4\uC218\uC785\uC744 \uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uACE0\uAD50 \uC54C\uBC14\xB7\uC878\uC5C5\uCDE8\uC5C5 \uC678\uC5D0\uB294 \uC6D4\uC218\uC7850\uC6D0, \uB450 \uC2DC\uC791 \uBAA8\uB450 \uC6D4\uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0\uC785\uB2C8\uB2E4. \uC2DC\uC791 \uC804 \uC18C\uB4DD\xB7\uC9C0\uCD9C\xB7\uC131\uC801\uC740 \uC18C\uAE09 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC73C\uBA70 \uAC19\uC740 \uC870\uAC74\uC758 \uC9C4\uB85C \uBE44\uAD50\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uAE30\uC874 \uC6D4 \uC21C\uC800\uCD95\uC740 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      } else {
        body += row("\uC878\uC5C5 \uB4A4 \uD604\uAE08\uACFC \uC8FC\uBB38 \uAE30\uD68C [\uC784\uC758\uAC12]", "\uCDE8\uC5C5\uC740 \uB2E4\uC74C \uC6D4\uC9C4\uD589\uBD80\uD130 \uC6D4\uC218\uC78530\uB9CC\uC6D0, \uC804\uC5C5\uC7400\uC6D0\uC785\uB2C8\uB2E4. \uB458 \uB2E4 \uC6D4\uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uCDE8\uC5C5\uC740 \uB274\uC2A4 \uD134\uC5D0 \uC608\uC57D \uC8FC\uBB38(\uC815\uC0B0 \uC774\uD6C4 \uCCB4\uACB0 \uB300\uAE30)\uC744 \uC811\uC218\uD558\uACE0 \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134\uC5D0\uC11C \uC8FC\uBB38\uD558\uBA70, \uC804\uC5C5\uC740 \uB274\uC2A4\xB7\uD3C9\uC628 \uD134\uC5D0\uC11C\uB3C4 \uC8FC\uBB38\uD560 \uC218 \uC788\uC9C0\uB9CC \uC0C1\uD488 \uD574\uAE08\xB7\uAD00\uCE21 \uC2DC\uC138\xB7\uC794\uACE0\xB7\uBCF5\uBB34 \uC81C\uD55C\uC744 \uB530\uB985\uB2C8\uB2E4. \uC218\uC785\uC740 \uB9E4\uCD9C\xB7\uC21C\uC218\uC775\xB7\uC2E4\uC81C\uAE09\uC5EC\uAC00 \uC544\uB2CC \uC784\uC758\uAC12\uC774\uACE0 \uAE30\uC874 \uC21C\uC800\uCD95\uC740 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        const short = Math.max(0, FULLTIME_GATE - gross);
        body += row("\uC9C0\uAE08 \uC804\uC5C5 \uBC84\uD2BC\uC774 \uBCF4\uB294 \uAC12", "\uCD1D\uC790\uC0B0(\uBBF8\uB0A9 \uCC28\uAC10 \uC804) " + gross.toLocaleString() + "\uC6D0 / \uC2DC\uD5D8\uD558\uD55C " + FULLTIME_GATE.toLocaleString() + "\uC6D0. " + (short ? "\uD604\uC7AC " + short.toLocaleString() + "\uC6D0 \uBD80\uC871\uD574 \uC804\uC5C5 \uBC84\uD2BC\uC774 \uC7A0\uAE41\uB2C8\uB2E4." : "\uD604\uC7AC \uD558\uD55C\uC744 \uCDA9\uC871\uD574 \uC804\uC5C5 \uBC84\uD2BC\uC744 \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4.") + " \uBBF8\uB0A9 " + c.unpaid.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9\uCC28\uAC10 \uC2DC\uC5F0\uC21C\uC790\uC0B0 " + (gross - c.unpaid).toLocaleString() + "\uC6D0 / \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0. \uD604\uC7AC \uBC84\uD2BC\uC740 \uBBF8\uB0A9\uCC28\uAC10 \uC21C\uC790\uC0B0\uC774\uB098 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC774 \uC544\uB2C8\uB77C \uCD1D\uC790\uC0B0\uC73C\uB85C \uD310\uC815\uD569\uB2C8\uB2E4. \uC608\uC57D\uAE08\xB7\uC0C1\uD488\uD3C9\uAC00\uB3C4 \uCD1D\uC790\uC0B0\uC5D0 \uD3EC\uD568\uB418\uBBC0\uB85C \uC774 \uD558\uD55C \uCDA9\uC871\uC740 \uB0A9\uBD80\uAC00\uB2A5\xB7\uC2E4\uC81C\uC0DD\uACC4\uAC00\uB2A5 \uD310\uC815\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
      }
      body += row("\uADF8\uB300\uB85C \uB0A8\uC740 \uC77C\uC815\uACFC \uBD88\uADE0\uD615", "\uBCF5\uBB34 \uC911 \uC6D4\uC218\uC7850\uC6D0\uC5D0\uB3C4 \uC0DD\uD65C\uAC00\uC0C1\uCCAD\uAD6C10\uB9CC\uC6D0\uC740 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uBCF5\uBB34 \uC911 \uC7AC\uD559\uAC1C\uC6D4\uC740 \uBA48\uCD94\uACE0 \uB9E4\uC218\uBE44\uC911 \uC0C1\uD55C30%\uB97C \uC801\uC6A9\uD569\uB2C8\uB2E4. \uB300\uD559\uC878\uC5C5 \uC804\uC5C5\uC740 \uCD1D\uC790\uC0B01200\uB9CC\uC6D0 \uD558\uD55C\uC744 \uAC80\uC0AC\uD558\uC9C0\uB9CC \uC54C\uBC14 \uB4A4 \uC804\uC5C5\uC5D0\uB294 \uAC19\uC740 \uAC80\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC2DC\uD5D8\uADDC\uCE59\uC744 \uC720\uC9C0\uD55C \uCC28\uC774\uC774\uBA70 \uC9C4\uB85C\uADE0\uD615\uC744 \uAC80\uC99D\uD55C \uACB0\uACFC\uAC00 \uC544\uB2D9\uB2C8\uB2E4.");
      body += row("\uBBF8\uB0A9\uC740 \uC5C6\uC5B4\uC9C0\uC9C0 \uC54A\uC544\uC694", "\uB0A9\uBD80\uB294 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC73C\uB85C \uC804\uC561\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uBA85\uC2DC \uBCF4\uB958\uB294 \uBBF8\uB0A9\uC744 \uB0A8\uAE30\uBA70 \uD559\uC801\xB7\uBCF5\uBB34 \uC77C\uC815\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC790\uB3D9\uB300\uCD9C\xB7\uB9E4\uB3C4\xB7\uAC00\uC871\uC1A1\uAE08\uC740 \uC5C6\uACE0 \uC138\uAE08\xB7\uC7A5\uD559\xB7\uD658\uAE09\xB7\uC5F0\uCCB4\uB8CC\xB7\uC2E4\uC5C5\uC740 \uBBF8\uAD6C\uD604\uC785\uB2C8\uB2E4. \uD559\uC5C5 \uC131\uACFC\uB294 \uC774 \uBE4C\uB4DC \uC774\uD6C4 \uC0C8 \uD68C\uADC0\uC5D0\uB9CC \uC2DC\uD5D8\uADDC\uCE59\uC73C\uB85C \uC801\uC6A9\uD558\uACE0 \uAE30\uC874 \uC800\uC7A5\uC5D0\uB294 \uC18C\uAE09\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC784\uC758 \uC2DC\uD5D8\uAC12\uC73C\uB85C \uBBF8\uB798\uC790\uC0B0\xB7\uC720\uB9AC\uD55C \uC9C4\uB85C\xB7\uD604\uC2E4 \uB0A9\uBD80\uC815\uCC45\uC744 \uC608\uCE21\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      return '<details class="life-outlook cash-life-outlook" style="margin:14px 0;padding:10px;border:1px solid #b8c8b6;border-radius:8px"><summary style="cursor:pointer">\uC120\uD0DD \uC804, \uD604\uAE08 \uD750\uB984\uACFC \uB0A8\uC740 \uC870\uAC74 \uBE44\uAD50 [\uC784\uC758\uAC12]</summary><p class="note">\uD604\uC7AC \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8\uADDC\uCE59\uB9CC \uC77D\uC2B5\uB2C8\uB2E4. \uC5F4\uAE30\xB7\uB2EB\uAE30\uB294 \uC6D4\xB7\uD604\uAE08\xB7\uC800\uC7A5\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC73C\uBA70 \uC544\uB798 \uC9C4\uB85C \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC57C \uC120\uD0DD\uB429\uB2C8\uB2E4.</p>' + body + "</details>";
    }
    function lifeOutlookHtml(turn) {
      if (CASH_MODE) return cashLifeOutlookHtml(turn);
      if (turn.kind !== "life" || !turn.event || !["life-hs1", "life-grad", "life-scenario"].includes(turn.event.id)) return "";
      const id = turn.event.id, b = state.flags.birth;
      const row = (title, text) => '<section style="padding:10px 0;border-top:1px solid #ddd;overflow-wrap:anywhere"><h3 style="font-size:1rem;margin:0 0 6px">' + esc(title) + '</h3><p style="margin:0">' + esc(text) + "</p></section>";
      if (careerCashActive()) {
        let cbody = "";
        if (id === "life-hs1") {
          cbody += row("\uACF5\uBD80 \u2192 \uC9C4\uD559 \u2192 \uC878\uC5C5 \uB54C \uB2E4\uC2DC \uC120\uD0DD", "\uD559\uC0DD\xB7\uC7AC\uD559 \uC911 \uC0DD\uD65C\uBE44 0\uC6D0(\uAC00\uC815 \uBD80\uC591 \uAC00\uC815)\uC774\uBA70 \uC7AC\uD559 \uC911 3\xB79\uC6D4\uC5D0 \uD559\uBE44 " + CCV.TUITION_PER_TERM.toLocaleString() + "\uC6D0\uC774 \uCCAD\uAD6C\uB429\uB2C8\uB2E4 [\uC124\uACC4\uAC12]. \uB300\uD559 \uC7AC\uD559 48\uAC1C\uC6D4\uC744 \uCC44\uC6B0\uBA74 \uCDE8\uC5C5\uACFC \uC804\uC5C5 \uD22C\uC790\uB97C \uB2E4\uC2DC \uACE0\uB985\uB2C8\uB2E4. \uBCF5\uBB34 \uC911 \uC7AC\uD559 \uAC1C\uC6D4\uC740 \uBA48\uCD94\uACE0 \uC0DD\uD65C\uBE44\uB294 \uC6D4 " + CCV.LIVING_MILITARY.toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4 [\uC124\uACC4\uAC12].");
          cbody += row("\uC54C\uBC14 \u2192 \uC878\uC5C5 \uB4A4 \uC804\uC5C5 \uD22C\uC790", "\uACE0\uAD50 \uAE30\uAC04 \uC54C\uBC14 \uC218\uC785 " + albaWonPhrase() + ". \uACE0\uAD50 \uC878\uC5C5 \uB4A4\uC5D0\uB294 \uB3C5\uB9BD \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0\uC774 \uB9E4\uB2EC \uB098\uAC00\uACE0 \uC815\uAE30 \uC218\uC785\uC740 \uC5C6\uC2B5\uB2C8\uB2E4 [\uC124\uACC4\uAC12]. \uD604\uAE08\uC774 \uBD80\uC871\uD558\uBA74 \uBBF8\uB0A9\uC73C\uB85C \uB0A8\uC2B5\uB2C8\uB2E4.");
        } else if (id === "life-grad") {
          cbody += row("\uCDE8\uC5C5\uC744 \uACE0\uB974\uBA74", "\uB2E4\uC74C \uB2EC\uBD80\uD130 \uAE09\uC5EC \uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\uC6D0\uC774 \uB4E4\uC5B4\uC624\uACE0 \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0\uC774 \uB098\uAC11\uB2C8\uB2E4 [\uC124\uACC4\uAC12]. \uC6D4 \uC21C\uC720\uC785\uC740 " + (CCV.JOB_INCOME - CCV.LIVING_ADULT).toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4.");
          cbody += row("\uC804\uC5C5 \uD22C\uC790\uB97C \uACE0\uB974\uBA74", "\uC218\uC785 0\uC6D0\uC5D0 \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0\uC774 \uACC4\uC18D \uB098\uAC11\uB2C8\uB2E4 [\uC124\uACC4\uAC12]. \uD604\uAE08\uC774 \uBD80\uC871\uD558\uBA74 \uBBF8\uB0A9\uC774 \uC313\uC774\uBA70 \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. " + careerFulltimeCoverageText());
          cbody += row("\uBBF8\uB0A9 \uC0C1\uD658", "\uD604\uC7AC \uBBF8\uB0A9\uC740 " + careerCashUnpaid().toLocaleString() + "\uC6D0\uC774\uBA70 \uC790\uC0B0\uD45C\uC5D0 \uB530\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4. \uC5B8\uC81C\uB4E0 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC73C\uB85C \uAC00\uC7A5 \uC624\uB798\uB41C \uB2EC\uBD80\uD130 \uC0C1\uD658\uD560 \uC218 \uC788\uACE0 \uBA74\uC81C\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.");
        } else {
          cbody += row("\uC0C8 \uACBD\uC81C \uC2DC\uC81C \uC548\uB0B4", "\uC774 \uC800\uC7A5\uC740 career-cash-events-v1 \uBAA8\uD615\uC785\uB2C8\uB2E4. \uC2DC\uB098\uB9AC\uC624 \uC2DC\uC791\uC740 \uACE0\uAD50 \uAD6C\uAC04\uC744 \uAC74\uB108\uB6F0\uBBC0\uB85C \uD559\uBE44\xB7\uC54C\uBC14 \uC0AC\uAC74\uC740 \uC2E4\uC81C \uC9C4\uD589 \uAD6C\uAC04\uC5D0\uC11C\uB9CC \uC0DD\uC131\uB429\uB2C8\uB2E4.");
        }
        cbody += row("\uBAA8\uD615\uC758 \uACBD\uACC4", "\uBAA8\uB4E0 \uAE08\uC561\uC740 \uBA85\uC2DC \uAC8C\uC784\uC124\uACC4\uAC12\uC774\uBA70 \uC2E4\uC81C \uAE09\uC5EC\xB7\uBB3C\uAC00\xB7\uD559\uBE44 \uD1B5\uACC4\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC120\uD0DD\uBCC4 \uBBF8\uB798 \uCD1D\uC790\uC0B0\xB7\uC218\uC775\uB960\xB7\uC720\uB9AC\uD55C \uC9C4\uB85C\uB97C \uC608\uCE21\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        return cbody;
      }
      const job = CAREER_TRIAL ? "\uACC4\uD68D\uD615 \uCDE8\uC5C5: \uB2E4\uC74C \uC6D4 \uC9C4\uD589\uBD80\uD130 \uC6D4 " + SAVINGS_BASE.toLocaleString() + "\uC6D0 \uC2DC\uD5D8 \uC21C\uC800\uCD95. \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC0C8 \uC218\uB3D9\uC8FC\uBB38\uACFC \uC2E0\uADDC\uC720\uC785 \uBC30\uBD84\uC744 \uC815\uD558\uACE0 \uBD84\uAE30\uC911 \uB274\uC2A4\uC5D0\uB294 \uC0C8 \uC8FC\uBB38\uC744 \uBC1B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uCCB4\uACB0 \uCDE8\uC18C\xB7\uC55E\uC73C\uB85C\uC758 \uC801\uB9BD \uC911\uB2E8\uC740 \uC5B8\uC81C\uB4E0 \uAC00\uB2A5\uD558\uC9C0\uB9CC \uBC18\uD658 \uD604\uAE08\uC73C\uB85C \uC0C8 \uD22C\uC790\uC8FC\uBB38\uC744 \uB0B4\uB294 \uAC83\uC740 \uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0\uBD80\uD130\uC785\uB2C8\uB2E4(\uD604\uC7AC \uC815\uC0B0\uC774 \uC544\uC9C1 \uC5F4\uB824 \uC788\uC73C\uBA74 \uADF8\uB54C \uAC00\uB2A5). \uAC19\uC740 \uACF5\uAC1C\uC790\uB8CC\uB97C \uC77D\uC73C\uBA70 \uC218\uC775\uC744 \uC6B0\uB300\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC790\uC0B0\uC790\uACA9 \uC5C6\uC774 \uC804\uC5C5 \uC804\uD658\uC744 \uAC80\uD1A0\uD560 \uC218 \uC788\uACE0 \uAE30\uC874 \uC608\uC57D \uAC8C\uC774\uD2B8\uB294 \uB2F9\uAE30\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uCDE8\uC5C5: \uC878\uC5C5 \uD6C4 \uB2E4\uC74C \uC6D4 \uC9C4\uD589\uBD80\uD130 \uC6D4 " + SAVINGS_BASE.toLocaleString() + "\uC6D0 \uC21C\uC800\uCD95 [\uC2DC\uD5D8\uAC12]. \uBCF5\uBB34 \uC911\uC740 0\uC6D0. \uB274\uC2A4 \uD134\uC5D0\uB294 \uC608\uC57D \uC8FC\uBB38(\uB2E4\uAC00\uC624\uB294 \uBD84\uAE30 \uC815\uC0B0 \uC774\uD6C4 \uCCB4\uACB0 \uB300\uAE30)\uC744 \uC811\uC218\uD558\uACE0 \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134\uC5D0\uC11C \uC8FC\uBB38\xB7\uB9AC\uBC38\uB7F0\uC2F1\uD569\uB2C8\uB2E4. \uC608\uC57D \uCCB4\uACB0\uAC00\uB294 \uC815\uC0B0 \uB4A4 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810 \uAC00\uACA9\uC774\uB77C \uC9C0\uAE08 \uAC00\uACA9\uC774 \uC544\uB2C8\uBA70, \uAC19\uC740 \uBD84\uAE30\uC5D0 \uC811\uC218\uB41C \uC801\uB9BD \uC608\uC57D\uC740 \uB2E4\uC74C \uC0C8 \uAD00\uCE21 \uC9C0\uC810\uC5D0 \uD568\uAED8 \uCCB4\uACB0\uB418\uC5B4 \uC6D4\uBCC4 \uAC00\uACA9 \uBD84\uC0B0\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 [\uD604\uC7AC \uC124\uACC4]. \uCDE8\uC5C5 \uB4A4\uC5D0\uB294 \uC0C8 \uC21C\uC800\uCD95\uC7580/50/100%\uB97C " + (state.jobPlanProductRules === 1 ? "\uAD6D\uB0B4\uC9C0\uC218\xB7\uB2EC\uB7EC \uBCF4\uC720\xB7\uB2EC\uB7EC\uC608\uAE08 \uC911 \uD604\uC7AC \uC811\uADFC\xB7\uC2DC\uC138\uAC00 \uD655\uC778\uB418\uB294 \uD55C \uC0C1\uD488" : "\uAD6D\uB0B4\uC9C0\uC218") + " \uC801\uB9BD \uC608\uC57D\uC73C\uB85C \uBC30\uBD84\uD558\uB294 \uACC4\uD68D\uC744 \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4(\uAE30\uBCF8\uAEBC\uC9D0\xB7\uB2E4\uC74C\uB2EC\uBD80\uD130 \uC801\uC6A9). \uC774\uBBF8 \uAC00\uC9C4 \uD604\uAE08\uC740 \uC790\uB3D9 \uD22C\uC790\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. " + (SCHOOL_MODE ? "\uC774\uD6C4 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC790\uC0B0\uD558\uD55C \uC5C6\uC774 \uC804\uC5C5 \uC804\uD658\uC744 \uB2E4\uC2DC \uAC80\uD1A0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4(\uD655\uC815 \uB4A4 \uCDE8\uC5C5 \uBCF5\uADC0 \uC5C6\uC74C)." : "\uC774\uD6C4 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uAC19\uC740 \uC2DC\uD5D8\uD558\uD55C\uC744 \uCDA9\uC871\uD558\uBA74 \uC804\uC5C5 \uC804\uD658\uC744 \uB2E4\uC2DC \uAC80\uD1A0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4(\uD655\uC815 \uB4A4 \uCDE8\uC5C5 \uBCF5\uADC0 \uC5C6\uC74C).");
      const ft = "\uC804\uC5C5 \uD22C\uC790: \uC815\uAE30 \uC21C\uC800\uCD95 0\uC6D0. \uB274\uC2A4\xB7\uD3C9\uC628 \uD134\uC5D0\uC11C \uC8FC\uBB38 \uAE30\uD68C\uAC00 \uC788\uACE0 \uC870\uAC74 \uC8FC\uBB38\xB7\uBD84\uD560 \uC8FC\uBB38(\uC804\uC5C5 \uC804\uC6A9 \uC2DC\uD5D8)\uC744 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uB9E4\uB9E4 \uAC00\uB2A5 \uC5EC\uBD80\uB294 \uC0C1\uD488 \uD574\uAE08\xB7\uAD00\uCE21 \uC2DC\uC138\xB7\uC794\uACE0\xB7\uBCF5\uBB34 \uC81C\uD55C\uC5D0 \uB530\uB77C \uB2EC\uB77C\uC9D1\uB2C8\uB2E4. \uC0DD\uD65C\uBE44\uB294 \uC544\uC9C1 \uCC28\uAC10\uD558\uC9C0 \uC54A\uC73C\uBBC0\uB85C 0\uC6D0 \uC0DD\uD65C\uBE44\uB85C \uC0B4 \uC218 \uC788\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4.";
      let body = "";
      if (id === "life-hs1") {
        body += row("\uACF5\uBD80 \u2192 \uC9C4\uD559 \u2192 \uC878\uC5C5 \uB54C \uB2E4\uC2DC \uC120\uD0DD", "\uD559\uC0DD\xB7\uC7AC\uD559 \uC911 \uC815\uAE30 \uC21C\uC800\uCD95 0\uC6D0 [\uC2DC\uD5D8\uAC12]. \uACE0\uAD50 \uC774\uD6C4 \uB300\uD559 \uC7AC\uD559 48\uAC1C\uC6D4\uC744 \uCC44\uC6B0\uBA74 \uCDE8\uC5C5\uACFC \uC804\uC5C5 \uD22C\uC790\uB97C \uB2E4\uC2DC \uACE0\uB985\uB2C8\uB2E4. \uBCF5\uBB34 \uC911 \uC7AC\uD559 \uAC1C\uC6D4\uC740 \uBA48\uCDA5\uB2C8\uB2E4. \uC785\uD559\xB7\uC878\uC5C5 \uC77C\uC815\uC740 \uD604\uC7AC \uD559\uC81C \uAC00\uC815\uC785\uB2C8\uB2E4. \uC774 \uBE4C\uB4DC \uC774\uD6C4 \uC0C8 \uD68C\uADC0\uC758 \uC9C4\uD559 \uD310\uC815\uC740 [\uC2DC\uD5D8\uADDC\uCE59] \uB204\uC801 \uB178\uB825\uC73C\uB85C\uB9CC \uD558\uBA70 \uC2E4\uC81C \uD569\uACA9\xB7\uCDE8\uC5C5 \uD655\uB960\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAE30\uC874 \uC800\uC7A5\uC740 \uAE30\uC874 \uADDC\uCE59 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.");
        body += row("\uC54C\uBC14 \u2192 \uC878\uC5C5 \uB4A4 \uC804\uC5C5 \uD22C\uC790", "\uACE0\uAD50 \uAE30\uAC04 \uC6D4 " + Math.round(SAVINGS_BASE * 0.2).toLocaleString() + "\uC6D0 \uC21C\uC800\uCD95 [\uC2DC\uD5D8\uAC12]. \uACE0\uAD50 \uC878\uC5C5 \uB4A4 \uC815\uAE30 \uC21C\uC800\uCD95\uC740 0\uC6D0\uC774\uBA70 \uB300\uD559 \uC878\uC5C5\uC758 \uB450 \uBC88\uC9F8 \uC120\uD0DD\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. \uBCC4\uB3C4 \uCDE8\uC5C5 \uC218\uC785\uC744 \uC790\uB3D9\uC73C\uB85C \uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        body += row("\uB450 \uACBD\uB85C\uC758 \uB2E4\uC74C \uAC08\uB9BC\uAE38", job + " " + ft + (SCHOOL_MODE ? " \uBCF8\uD3B8\uC5D0\uC11C\uB294 \uC54C\uBC14 \uC774\uD6C4 \uC804\uC5C5\uACFC \uB300\uD559 \uC878\uC5C5 \uC804\uC5C5 \uBAA8\uB450 \uC790\uC0B0\uC790\uACA9\uC744 \uC694\uAD6C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC9C4\uB85C\uB97C \uACE0\uB97C \uC218 \uC788\uB2E4\uB294 \uB73B\uC774\uC9C0 \uC2E4\uC81C \uC0DD\uD65C \uAC00\uB2A5\uC131\uC774\uB098 \uB450 \uACBD\uB85C\uC758 \uADE0\uD615\uC774 \uC785\uC99D\uB410\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4." : " \uB300\uD559 \uC878\uC5C5\uC758 \uC804\uC5C5 \uC120\uD0DD\uC5D0\uB294 \uCD1D\uC790\uC0B0 " + FULLTIME_GATE.toLocaleString() + "\uC6D0 \uD558\uD55C [\uC2DC\uD5D8\uAC12]\uC774 \uC788\uACE0 \uC54C\uBC14 \uACBD\uB85C\uC5D0\uB294 \uAC19\uC740 \uD558\uD55C \uAC80\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC774\uB294 \uD604\uC7AC \uAD6C\uD604 \uCC28\uC774\uC774\uBA70 \uD604\uC2E4\uC801 \uC6B0\uC5F4\uC774\uB098 \uADE0\uD615\uC744 \uAC80\uC99D\uD55C \uADDC\uCE59\uC774 \uC544\uB2D9\uB2C8\uB2E4."));
        body += row("\uBCF5\uBB34\uC640 \uB2EC\uB825", "\uD604\uC7AC \uC2DC\uD5D8 \uC77C\uC815\uC740 \uC9C4\uD559 \uACBD\uB85C " + (b.hsYear + 5) + "\uB144 6\uC6D4, \uC54C\uBC14 \uACBD\uB85C " + (b.hsYear + 3) + "\uB144 8\uC6D4\uC5D0 \uC785\uC601 \uC120\uD0DD\uC744 \uC81C\uC2DC\uD569\uB2C8\uB2E4. \uBC14\uB85C \uC785\uB300 \uC2DC 26\uAC1C\uC6D4, 1\uB144 \uC720\uC608 \uC120\uD0DD\uC740 \uBCC4\uB3C4 \uC2DC\uD5D8\uAC00\uC815\uC785\uB2C8\uB2E4. \uBCF5\uBB34 \uC911 \uC21C\uC800\uCD95 0\uC6D0\xB7\uB9E4\uC218 \uBE44\uC911 \uC0C1\uD55C 30%\uC774\uBA70 \uD559\uC801 \uAC1C\uC6D4\uC774 \uBA48\uCDA5\uB2C8\uB2E4. \uAD70\uC885\xB7\uAC1C\uC778\uBCC4 \uC790\uACA9\uC744 \uD310\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      } else if (id === "life-grad") {
        body += row("\uCDE8\uC5C5\uC744 \uACE0\uB974\uBA74", job);
        body += row("\uC804\uC5C5 \uD22C\uC790\uB97C \uACE0\uB974\uBA74", ft);
        const assets = totalAssets(), shortfall = Math.max(0, FULLTIME_GATE - assets);
        body += row("\uC9C0\uAE08\uC758 \uC804\uC5C5 \uC120\uD0DD \uC870\uAC74", SCHOOL_MODE ? "\uBCF8\uD3B8\uC740 \uC790\uC0B0\uAE08\uC561\uACFC \uAD00\uACC4\uC5C6\uC774 \uCDE8\uC5C5 \uB610\uB294 \uC804\uC5C5\uC744 \uACE0\uB985\uB2C8\uB2E4. \uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 / \uC2DC\uC5F0 \uCD1D\uC790\uC0B0 " + assets.toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4. \uC804\uC5C5\uC740 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC815\uAE30 \uC21C\uC800\uCD950\uC6D0\uC774\uBA70 \uD604 \uC2DC\uD5D8\uC5D0\uC11C \uCDE8\uC5C5 \uBCF5\uADC0\uB294 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uC775 \uBCF4\uB108\uC2A4\xB7\uC0C8 \uC790\uAE08 \uC9C0\uAE09\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0DD\uD65C\uBE44\xB7\uC2E4\uAE09\uC5EC\uAC00 \uBBF8\uC5F0\uACB0\uC774\uB77C \uC2E4\uC81C \uC0DD\uACC4 \uAC00\uB2A5\uC131\uC744 \uD310\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38\uC740 \uC5EC\uC804\uD788 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\xB7\uBCF4\uC720\uC218\uB7C9\xB7\uC0C1\uD488\uC811\uADFC\xB7\uC0C8 \uC801\uACA9\uAD00\uCE21 \uC81C\uD55C\uC744 \uB530\uB985\uB2C8\uB2E4." : "\uC2DC\uC5F0 \uCD1D\uC790\uC0B0 " + assets.toLocaleString() + "\uC6D0 / \uC2DC\uD5D8 \uD558\uD55C " + FULLTIME_GATE.toLocaleString() + "\uC6D0. " + (shortfall ? "\uD604\uC7AC " + shortfall.toLocaleString() + "\uC6D0 \uBD80\uC871\uD574 \uC804\uC5C5 \uBC84\uD2BC\uC774 \uC7A0\uAE41\uB2C8\uB2E4." : "\uD604\uC7AC \uD558\uD55C\uC744 \uCDA9\uC871\uD574 \uC804\uC5C5 \uBC84\uD2BC\uC744 \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4.") + " \uCD1D\uC790\uC0B0\uC5D0\uB294 \uC0C1\uD488 \uD3C9\uAC00\uC561\uACFC \uC8FC\uBB38 \uC608\uC57D\uBD84\uC774 \uD3EC\uD568\uB418\uBA70 \uC989\uC2DC \uC4F8 \uD604\uAE08\xB7\uC2E4\uC81C \uC0DD\uD65C\uBE44 \uCDA9\uB2F9 \uB2A5\uB825\uACFC \uAC19\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC774 \uD654\uBA74\uC744 \uC5F4\uC5B4\uB3C4 \uB9E4\uB3C4\xB7\uB300\uCD9C\xB7\uC790\uC0B0 \uC774\uB3D9\uC740 \uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      } else {
        body += row("\uC9C4\uD559 \uC774\uB825\uC744 \uACE8\uB77C \uC2DC\uC791", "\uACE01 \uC120\uD0DD\uC774 \uC2DC\uC81C\uD488 \uC2DC\uC791 \uC804\uC778 \uC0DD\uB144\uC785\uB2C8\uB2E4. \uC9C4\uD559 \uC2DC\uB098\uB9AC\uC624\uB97C \uACE0\uB974\uBA74 \uACFC\uAC70 \uC9C4\uD559\xB7\uC7AC\uD559 \uAC1C\uC6D4\uACFC \uC77C\uBD80 \uBCF5\uBB34 \uC774\uB825\uC744 \uC2DC\uC5F0\uC6A9\uC73C\uB85C \uAC00\uC815\uD569\uB2C8\uB2E4. \uACE0\uAD50 \uC2DC\uC808\uC758 \uD604\uAE08\xB7\uC54C\uBC14\xB7\uC131\uC801\uC744 \uC18C\uAE09 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB300\uD559 \uC7AC\uD559 48\uAC1C\uC6D4\uACFC \uBCF5\uBB34 \uD734\uD559 \uB4A4 \uC878\uC5C5 \uC120\uD0DD\uC5D0\uC11C \uCDE8\uC5C5 \uB610\uB294 \uC804\uC5C5\uC744 \uACE0\uB985\uB2C8\uB2E4.");
        body += row("\uC77C\uBC18 \uC2DC\uC791\uC744 \uACE0\uB974\uBA74", "\uC9C4\uB85C \uC774\uB825\uC740 \uBBF8\uC815\uC785\uB2C8\uB2E4. \uC878\uC5C5\xB7\uCDE8\uC5C5 \uC120\uD0DD\uC744 \uC784\uC758\uB85C \uCC44\uC6B0\uC9C0 \uC54A\uC73C\uBA70 \uD604\uC7AC\uC758 \uC9C4\uB85C \uBBF8\uC815 \uC2DC\uC791 \uADDC\uCE59\uC5D0\uC11C\uB294 \uBCF5\uBB34 \uC911\uC774 \uC544\uB2D0 \uB54C \uC6D4 " + SAVINGS_BASE.toLocaleString() + "\uC6D0 \uC21C\uC800\uCD95\uC774 \uB354\uD574\uC9D1\uB2C8\uB2E4 [\uC2DC\uD5D8\uAC12]. \uC774 \uADDC\uCE59\uACFC \uC9C4\uD559 \uC2DC\uB098\uB9AC\uC624\uB294 \uAC19\uC740 \uC870\uAC74 \uBE44\uAD50\uAC00 \uC544\uB2D9\uB2C8\uB2E4.");
        body += row("\uC9C4\uD559 \uC2DC\uB098\uB9AC\uC624\uC758 \uC878\uC5C5 \uB4A4", job + " " + ft + " \uC804\uC5C5 \uC120\uD0DD\uC5D0\uB294 \uCD1D\uC790\uC0B0 " + FULLTIME_GATE.toLocaleString() + "\uC6D0 \uD558\uD55C [\uC2DC\uD5D8\uAC12]\uC774 \uC788\uC2B5\uB2C8\uB2E4.");
      }
      body += row("\uC0DD\uD65C\uACBD\uC81C \uC5F0\uACB0 \uC804 \uBE44\uC5B4 \uC788\uB294 \uAC83", "\uAE09\uC5EC\xB7\uACF5\uC81C\xB7\uC0DD\uD65C\uBE44\xB7\uD559\uBE44\xB7\uC7A5\uD559\uAE08\xB7\uAC00\uC871\uBD80\uB2F4\xB7\uC2E4\uC5C5\uC744 \uAC1C\uBCC4 \uD604\uAE08 \uC0AC\uAC74\uC73C\uB85C \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uD655\uC778 \uBE44\uC6A9\uC744 0\uC6D0\uC73C\uB85C \uD655\uC815\uD558\uAC70\uB098 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC5D0\uC11C \uB2E4\uC2DC \uBE7C\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC120\uD0DD\uBCC4 \uBBF8\uB798 \uCD1D\uC790\uC0B0\xB7\uC218\uC775\uB960\xB7\uC720\uB9AC\uD55C \uC9C4\uB85C\uB294 \uC608\uCE21\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      return '<details class="life-outlook" style="margin:14px 0;padding:10px;border:1px solid #b8c8b6;border-radius:8px"><summary style="cursor:pointer">\uC120\uD0DD \uC804, \uC7A5\uAE30 \uD750\uB984\uACFC \uC0DD\uD65C\uACBD\uC81C \uBE48\uCE78 \uBE44\uAD50</summary><p class="note">\uD604\uC7AC \uAD6C\uD604\uD55C \uADDC\uCE59\uB9CC \uC124\uBA85\uD569\uB2C8\uB2E4. \uC5F4\uAE30\xB7\uB2EB\uAE30\uC5D0\uB294 \uAC8C\uC784 \uC6D4\xB7\uD604\uAE08\xB7\uAE30\uB85D \uBCC0\uD654\uAC00 \uC5C6\uACE0 \uC544\uB798 \uC9C4\uB85C \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC57C \uC120\uD0DD\uB429\uB2C8\uB2E4.</p>' + body + "</details>";
    }
    function careerRecoveryStatus(turn) {
      if (careerCycleActive()) return null;
      if (!careerCashActive() || state.careerCashRules !== 3 || !fulltimeActive() || state.flags.recoveryJob === "rehire" || state.flags.gameOver || state.month > GAME_END) return null;
      if (!turn || militaryActive() || !isSettlementMonth() || !["news", "quiet"].includes(turn.kind)) return null;
      return { unpaid: careerCashUnpaid(), alba: state.flags.recoveryJob === "alba" };
    }
    function careerRecoveryAlbaStart() {
      return state.flags.recoveryAlbaMonth || null;
    }
    function careerRecoveryRehireFrom() {
      const s = careerRecoveryAlbaStart();
      return s ? addMonths(s, 3) : null;
    }
    function renderCareerRecovery() {
      if (storageWriteBlocked || storageReadBlocked) return;
      const status = careerRecoveryStatus(nextTurn());
      if (!status) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      if (status.alba) {
        card.innerHTML = careerTrialNote() + '<div class="date">' + state.month + ' \xB7 \uC804\uC5C5 \uC774\uD6C4 \uD68C\uBCF5 \uC120\uD0DD [\uC2DC\uD5D8\uADDC\uCE59]</div><h2>\uC54C\uBC14 \uC720\uC9C0\uC640 \uC7AC\uCDE8\uC5C5</h2><p style="margin-top:12px">\uD604\uC7AC \uD604\uAE08 ' + state.cash.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9 " + status.unpaid.toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4. \uC54C\uBC14 \uC218\uC785 \uC6D4 " + CCV.ALBA_INCOME.toLocaleString() + "\uC6D0 [\uC124\uACC4\uAC12]\uC774 \uBC18\uC601 \uC911\uC774\uC9C0\uB9CC \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0\uC744 \uBE7C\uBA74 \uB9E4\uC6D4 " + (CCV.LIVING_ADULT - CCV.ALBA_INCOME).toLocaleString() + '\uC6D0\uC529 \uBBF8\uB0A9\uC774 \uACC4\uC18D \uB298\uC5B4\uB098\uB294 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.</p><p style="margin-top:12px">\uC7AC\uCDE8\uC5C5\uC73C\uB85C \uBC14\uAFB8\uBA74 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 ' + CCV.JOB_INCOME.toLocaleString() + "\uC6D0 \uAE09\uC5EC [\uC124\uACC4\uAC12]\uB85C \uC0DD\uD65C\uBE44\uB97C \uBE7C\uACE0 \uC6D4 " + (CCV.JOB_INCOME - CCV.LIVING_ADULT).toLocaleString() + '\uC6D0 \uD751\uC790\uAC00 \uB418\uC5B4 \uBBF8\uB0A9\uC744 \uAC1A\uC544 \uB098\uAC08 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB300\uC2E0 \uC0C8 \uC8FC\uBB38\uC740 \uCDE8\uC5C5\uACFC \uAC19\uC740 \uC2DC\uAC04 \uC81C\uC57D(\uB274\uC2A4 \uB300\uC751 \uC608\uC57D \uC8FC\uBB38\uACFC \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134)\uB9CC \uB0A8\uACE0 \uB274\uC2A4\xB7\uD3C9\uC628 \uD134\uC758 \uC790\uC720 \uC8FC\uBB38\uACFC \uC870\uAC74\xB7\uBD84\uD560\xB7\uB300\uAE30\uAE30\uD55C \uC120\uD0DD\uC740 \uB05D\uB0A9\uB2C8\uB2E4. \uC774\uBBF8 \uB123\uC740 \uC8FC\uBB38\uC740 \uADF8\uB300\uB85C \uB0A8\uACE0 \uCDE8\uC18C\uD558\uBA74 \uC608\uC57D\uAE08\uC774 \uD604\uAE08\uC73C\uB85C \uB3CC\uC544\uC635\uB2C8\uB2E4.</p><p class="note" style="margin-top:12px">\uC7AC\uCDE8\uC5C5 \uB4A4\uC5D0\uB294 \uC804\uC5C5\xB7\uC54C\uBC14\uB85C \uB418\uB3CC\uC544\uC624\uB294 \uC120\uD0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uAD6C\uC9C1\xB7\uADFC\uB85C \uC870\uAC74\xB7\uC2DC\uAE09 \uD1B5\uACC4\uAC00 \uC544\uB2CC \uAC8C\uC784 \uC124\uACC4\uAC12\uC785\uB2C8\uB2E4. \uCDE8\uC18C\uD558\uBA74 \uC54C\uBC14\uB97C \uC774\uC5B4\uAC11\uB2C8\uB2E4.</p>';
        box.innerHTML = "";
        const rehireFrom = careerRecoveryRehireFrom(), rehireGated = !!(rehireFrom && state.month < rehireFrom);
        if (rehireGated) {
          const gnote = document.createElement("p");
          gnote.className = "note";
          gnote.textContent = "\uC7AC\uCDE8\uC5C5 \uC804\uD658\uC740 \uB2E4\uC74C \uBD84\uAE30(" + rehireFrom + ")\uBD80\uD130 \uC5F4\uB9BD\uB2C8\uB2E4. [\uC548\uB0B4\uC640 \uB3D9\uC791\uC744 \uB9DE\uCD98 \uADDC\uCE59]";
          box.append(gnote);
        }
        const rehire2 = document.createElement("button");
        rehire2.id = "career-recovery-rehire";
        rehire2.textContent = "\uC7AC\uCDE8\uC5C5\uC73C\uB85C \uC804\uD658 \xB7 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\uC6D0 \xB7 \uC8FC\uBB38 \uC81C\uC57D [\uC124\uACC4\uAC12]";
        rehire2.disabled = rehireGated;
        rehire2.onclick = () => commitCareerRecovery("rehire");
        const no2 = document.createElement("button");
        no2.id = "career-recovery-cancel";
        no2.textContent = "\uC54C\uBC14 \uACC4\uC18D \xB7 \uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
        no2.onclick = () => render();
        box.append(rehire2, no2);
        renderPortfolio();
        return;
      }
      card.innerHTML = careerTrialNote() + '<div class="date">' + state.month + ' \xB7 \uC804\uC5C5 \uC774\uD6C4 \uD68C\uBCF5 \uC120\uD0DD [\uC2DC\uD5D8\uADDC\uCE59]</div><h2>\uC804\uC5C5 \uC720\uC9C0\uC640 \uC54C\uBC14\xB7\uC7AC\uCDE8\uC5C5</h2><p style="margin-top:12px">\uD604\uC7AC \uD604\uAE08 ' + state.cash.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9 " + status.unpaid.toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4. " + esc(careerFulltimeCoverageText()) + " \uC804\uC5C5\uC744 \uC720\uC9C0\uD558\uBA74 \uC218\uC785 0\uC6D0\uC73C\uB85C \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + '\uC6D0\uC774 \uACC4\uC18D \uB098\uAC11\uB2C8\uB2E4 [\uC124\uACC4\uAC12].</p><p style="margin-top:12px">\uC54C\uBC14\uB97C \uC2DC\uC791\uD558\uBA74 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 ' + CCV.ALBA_INCOME.toLocaleString() + "\uC6D0 \uC218\uC785\uC774 \uB4E4\uC5B4\uC635\uB2C8\uB2E4 [\uC124\uACC4\uAC12]. \uC8FC\uBB38 \uC790\uC720(\uB274\uC2A4\xB7\uD3C9\uC628 \uD134 \uC8FC\uBB38\uACFC \uC870\uAC74\xB7\uBD84\uD560\xB7\uB300\uAE30\uAE30\uD55C)\uB294 \uC804\uC5C5\uACFC \uAC19\uAC8C \uC720\uC9C0\uB429\uB2C8\uB2E4. \uB2E4\uB9CC \uC0DD\uD65C\uBE44\uB97C \uBE7C\uBA74 \uB9E4\uC6D4 " + (CCV.LIVING_ADULT - CCV.ALBA_INCOME).toLocaleString() + '\uC6D0\uC529 \uBBF8\uB0A9\uC774 \uACC4\uC18D \uB298\uC5B4\uB098 \uC774 \uC120\uD0DD\uB9CC\uC73C\uB85C\uB294 \uBBF8\uB0A9\uC774 \uC904\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38 \uC790\uC720\uB97C \uC9C0\uD0A4\uBA70 \uCD9C\uD608\uC744 \uB2A6\uCD94\uB294 \uC644\uCDA9 \uC120\uD0DD\uC774\uBA70, \uB2E4\uC74C \uBD84\uAE30\uC5D0 \uC7AC\uCDE8\uC5C5\uC73C\uB85C \uBC14\uAFC0 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p><p style="margin-top:12px">\uC7AC\uCDE8\uC5C5\uD558\uBA74 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 ' + CCV.JOB_INCOME.toLocaleString() + "\uC6D0 \uAE09\uC5EC [\uC124\uACC4\uAC12]\uB85C \uC0DD\uD65C\uBE44\uB97C \uBE7C\uACE0 \uC6D4 " + (CCV.JOB_INCOME - CCV.LIVING_ADULT).toLocaleString() + '\uC6D0 \uD751\uC790\uAC00 \uB418\uC5B4 \uBBF8\uB0A9\uC744 \uAC1A\uC544 \uB098\uAC08 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB300\uC2E0 \uC0C8 \uC8FC\uBB38\uC740 \uCDE8\uC5C5\uACFC \uAC19\uC740 \uC2DC\uAC04 \uC81C\uC57D(\uB274\uC2A4 \uB300\uC751 \uC608\uC57D \uC8FC\uBB38\uACFC \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134)\uB9CC \uAC00\uB2A5\uD558\uACE0 \uB274\uC2A4\xB7\uD3C9\uC628 \uD134\uC758 \uC790\uC720 \uC8FC\uBB38\uACFC \uC870\uAC74\xB7\uBD84\uD560\xB7\uB300\uAE30\uAE30\uD55C \uC120\uD0DD\uC740 \uB05D\uB0A9\uB2C8\uB2E4. \uC774\uBBF8 \uB123\uC740 \uC8FC\uBB38\uC740 \uADF8\uB300\uB85C \uB0A8\uACE0 \uCDE8\uC18C\uD558\uBA74 \uC608\uC57D\uAE08\uC774 \uD604\uAE08\uC73C\uB85C \uB3CC\uC544\uC635\uB2C8\uB2E4.</p><p class="note" style="margin-top:12px">\uC7AC\uCDE8\uC5C5 \uB4A4\uC5D0\uB294 \uC804\uC5C5\xB7\uC54C\uBC14\uB85C \uB418\uB3CC\uC544\uC624\uB294 \uC120\uD0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uAD6C\uC9C1\xB7\uADFC\uB85C \uC870\uAC74\xB7\uC2DC\uAE09 \uD1B5\uACC4\uAC00 \uC544\uB2CC \uAC8C\uC784 \uC124\uACC4\uAC12\uC774\uBA70, \uC54C\uBC14\xB7\uC7AC\uCDE8\uC5C5\uC774 \uC804\uC5C5\uBCF4\uB2E4 \uC720\uB9AC\uD558\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uCDE8\uC18C\uD558\uBA74 \uC6D4\xB7\uC790\uAE08\xB7\uAE30\uB85D\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.</p>';
      box.innerHTML = "";
      const alba = document.createElement("button");
      alba.id = "career-recovery-alba";
      alba.textContent = "\uC54C\uBC14 \uC2DC\uC791 \xB7 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 " + CCV.ALBA_INCOME.toLocaleString() + "\uC6D0 \xB7 \uC8FC\uBB38 \uC790\uC720 \uC720\uC9C0 [\uC124\uACC4\uAC12]";
      alba.onclick = () => commitCareerRecovery("alba");
      const rehire = document.createElement("button");
      rehire.id = "career-recovery-rehire";
      rehire.textContent = "\uC7AC\uCDE8\uC5C5 \xB7 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\uC6D0 \xB7 \uC8FC\uBB38 \uC81C\uC57D [\uC124\uACC4\uAC12]";
      rehire.onclick = () => commitCareerRecovery("rehire");
      const no = document.createElement("button");
      no.id = "career-recovery-cancel";
      no.textContent = "\uC804\uC5C5 \uC720\uC9C0 \xB7 \uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      no.onclick = () => render();
      box.append(alba, rehire, no);
      renderPortfolio();
    }
    function commitCareerRecovery(kind) {
      if (storageWriteBlocked || storageReadBlocked) return;
      if (!careerRecoveryStatus(nextTurn())) return;
      if (kind === "rehire" && state.flags.recoveryJob === "alba") {
        const from = careerRecoveryRehireFrom();
        if (from && state.month < from) return;
      }
      if (kind === "alba") {
        state.flags.recoveryJob = "alba";
        state.flags.recoveryAlbaMonth = state.month;
      } else {
        state.flags.career = "job";
        state.flags.academicStatus = "graduated";
        state.flags.recoveryJob = "rehire";
        state.flags.recoveredFromFulltime = true;
      }
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "career-recovery:" + kind });
      if (save()) render();
    }
    function albaTimeActive() {
      return decisionPaceActive() && state.albaTimeRules === 1;
    }
    function albaTimeLimited() {
      return albaTimeActive() && careerCycleTrack() === "alba";
    }
    function albaTimeAvailable() {
      return !albaTimeLimited() || state.albaTimeUse?.month !== state.month;
    }
    function albaTimeConsume(action) {
      if (albaTimeLimited()) {
        state.albaTimeUse = { version: 1, month: state.month, action };
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "alba-time:" + action });
      }
    }
    function albaTimeShapeOk(s) {
      if (Object.prototype.hasOwnProperty.call(s, "albaTimeRules") && (s.albaTimeRules !== 1 || s.decisionPaceRules !== 1)) return false;
      if (Object.prototype.hasOwnProperty.call(s, "albaTimeUse")) {
        const r = s.albaTimeUse;
        if (!r || typeof r !== "object" || Array.isArray(r) || Object.keys(r).sort().join(",") !== "action,month,version" || r.version !== 1 || s.albaTimeRules !== 1 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month) || r.month > s.month || !["buy", "sell", "condition", "deadline"].includes(r.action)) return false;
      }
      return true;
    }
    function albaTimeHtml() {
      if (!albaTimeActive()) return "";
      return '<details class="alba-time-note"><summary>\uC218\uC785\uACFC \uD22C\uC790 \uC2DC\uAC04 [\uC0C8 \uD68C\uADC0 \uAC8C\uC784\uADDC\uCE59]</summary><p>\uC54C\uBC14\uB294 \uC6D4 \uC218\uC78520\uB9CC\uC6D0 \uB300\uC2E0 \uD55C \uB2EC\uC5D0 \uC218\uB3D9 \uD22C\uC790 \uD310\uB2E81\uD68C\uC785\uB2C8\uB2E4. \uC0C8 \uB9E4\uC218\xB7\uB9E4\uB3C4, \uB300\uAE30\uC8FC\uBB38 \uAC00\uACA9\uC870\uAC74\xB7\uAE30\uD55C \uBCC0\uACBD \uC911 \uC131\uACF5\uD55C1\uD68C\uAC00 \uADF8\uB2EC \uC2DC\uAC04\uC744 \uC501\uB2C8\uB2E4. \uC804\uC5C5\uC740 \uC218\uC7850\uC6D0 \uB300\uC2E0 \uAC01 \uD310\uB2E8 \uAE30\uD68C\uC5D0 \uC8FC\uBB38\uD569\uB2C8\uB2E4. \uC2E4\uC81C \uADFC\uB85C\uC2DC\uAC04 \uD1B5\uACC4\uAC00 \uC544\uB2C8\uBA70 \uC218\uC775 \uBCF4\uB108\uC2A4\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.</p><p>\uAC80\uD1A0\xB7\uCDE8\uC18C\xB7\uC798\uBABB\uB41C \uC785\uB825\uC740 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC8FC\uBB38\uC758 \uCCB4\uACB0\xB7\uBD84\uD560\xB7\uAE30\uD55C\uBC18\uD658, \uC8FC\uBB38\uCDE8\uC18C\xB7\uC608\uC57D\uAE08\uCD95\uC18C\xB7\uBBF8\uB0A9\uC0C1\uD658\uC740 \uC81C\uD55C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uCDE8\uC18C\uD574\uB3C4 \uC774\uBBF8 \uC4F4 \uC2DC\uAC04\uC744 \uB3CC\uB824\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB2EC \uC790\uB3D9 \uBCF5\uC6D0\uD558\uBA70 \uC9C4\uB85C\uBCC0\uACBD\uC73C\uB85C \uAC19\uC740 \uB2EC \uAE30\uB85D\uC744 \uC9C0\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' + (albaTimeLimited() ? '<p class="alba-time-status">' + state.month + " \uC54C\uBC14 \uD22C\uC790 \uC2DC\uAC04: " + (albaTimeAvailable() ? "1\uD68C \uB0A8\uC74C" : "\uC0AC\uC6A9 \uC644\uB8CC \xB7 \uB2E4\uC74C \uB2EC \uB2E4\uC2DC1\uD68C") + "</p>" : "") + "</details>";
    }
    function decisionPaceActive() {
      return careerCycleActive() && state.decisionPaceRules === 1;
    }
    function decisionPaceAllowed() {
      return !reservationSettlementDue() && decisionPaceActive() && !militaryActive() && !state.flags.gameOver && state.month <= GAME_END && ["fulltime", "alba"].includes(careerCycleTrack()) && nextTurn().kind === "quiet";
    }
    function decisionPaceIdentity() {
      if (state.cashAllocationRules === 1) return state.cashReservePolicy ? allocationReserveIdentityFields : allocationIdentityFields;
      if (reservationSettlementActive()) return state.cashReservePolicy ? reservationReserveIdentityFields : reservationIdentityFields;
      if (!decisionPaceActive()) return null;
      if (albaTimeActive()) {
        if (chaosExposureActive()) return state.cashReservePolicy ? chaosTimeReserveIdentityFields : chaosTimeIdentityFields;
        return state.cashReservePolicy ? cashTimeReserveIdentityFields : cashTimeIdentityFields;
      }
      return state.cashReservePolicy ? cashPaceReserveIdentityFields : cashPaceIdentityFields;
    }
    function renderDecisionPace() {
      if (storageReadBlocked || storageWriteBlocked || !decisionPaceAllowed()) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices"), s = careerCycleStatus(nextTurn());
      card.innerHTML = '<div class="date">' + state.month + ' \xB7 \uD310\uB2E8 \uACBD\uACC4 \uC9C4\uD589</div><h2>\uD589\uB3D9\uD560 \uC21C\uAC04\uAE4C\uC9C0 \uAE30\uB2E4\uB9AC\uAE30</h2><p>\uC0C8 \uC8FC\uBB38\uC744 \uB0B4\uC9C0 \uC54A\uACE0 \uD604\uC7AC \uC9C4\uB85C\xB7\uBCF4\uC720\xB7\uBBF8\uCCB4\uACB0 \uC8FC\uBB38\uC744 \uC720\uC9C0\uD558\uBA70, \uC6D4\uBCC4 \uC218\uC785\xB7\uCCAD\uAD6C\xB7\uC774\uC790\xB7\uC801\uACA9 \uCCB4\uACB0\uC744 \uD55C \uB2EC\uC529 \uC2E4\uC81C\uB85C \uBC18\uC601\uD569\uB2C8\uB2E4. \uBBF8\uB798 \uB274\uC2A4\xB7\uCCB4\uACB0\uC77C\xB7\uAC00\uACA9\uC744 \uCC3E\uC544 \uB3C4\uCC29\uC6D4\uC744 \uBBF8\uB9AC \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p>\uCCAB \uB274\uC2A4, \uB2E4\uC74C \uC9C4\uB85C \uC7AC\uC120\uD0DD \uBD84\uAE30, \uC9C4\uD559\xB7\uC785\uB300\xB7\uC804\uC5ED, \uC885\uB8CC, \uC2E4\uC81C \uC9C0\uC5F0\uCCB4\uACB0\xB7\uAE30\uD55C\uBC18\uD658 \uB610\uB294 \uCD94\uAC00 \uBBF8\uB0A9\uC774 \uC0DD\uAE30\uBA74 \uBA48\uCDA5\uB2C8\uB2E4. \uBBF8\uB0A9\uC774 \uB298\uC5B4\uB098\uB294 \uC0C1\uD0DC\uB97C \uACC4\uC18D \uC228\uAE30\uBA70 \uB118\uAE30\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC790\uB8CC\uACF5\uBC31\uC740 \uAC00\uC0C1 \uB274\uC2A4\uB098 \uAC00\uC0C1 \uAC00\uACA9\uC73C\uB85C \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p class="note">' + (s?.allowed ? "\uC9C0\uAE08 \uC5F4\uB9B0 \uC774\uBC88 \uBD84\uAE30 \uC9C4\uB85C \uAC80\uD1A0\uB97C \uC720\uC9C0\uB85C \uC9C0\uB098\uAC11\uB2C8\uB2E4. \uB2E4\uC74C \uBD84\uAE30\uC6D4\uC5D0\uC11C \uB2E4\uC2DC \uBA48\uCDA5\uB2C8\uB2E4. \uC774\uBC88 \uBD84\uAE30\uC5D0 \uC9C4\uB85C\uB97C \uBC14\uAFB8\uB824\uBA74 \uCDE8\uC18C\uD558\uACE0 \uC9C4\uB85C \uBE44\uAD50\uB97C \uACE0\uB974\uC138\uC694." : "\uD604\uC7AC \uC9C4\uB85C\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4. \uB2E4\uC74C\uC5D0 \uC9C4\uB85C\uB97C \uB2E4\uC2DC \uACE0\uB97C \uC218 \uC788\uB294 \uBD84\uAE30\uC6D4\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4.") + " \uC9C4\uD589 \uC911 \uC0C8 \uC218\uB3D9\uB9E4\uB9E4\xB7\uC8FC\uBB38 \uCDE8\uC18C\xB7\uC0C1\uD658\uC740 \uD558\uC9C0 \uC54A\uC740 \uAC83\uC73C\uB85C \uCC98\uB9AC\uD569\uB2C8\uB2E4. \uADF8 \uD589\uB3D9\uC774 \uD544\uC694\uD558\uBA74 \uCDE8\uC18C\uD558\uACE0 \uC9C1\uC811 \uACE0\uB974\uC138\uC694.</p>";
      box.innerHTML = "";
      const signature = JSON.stringify([state.month, state.turnCount, state.flags, state.cash, state.pendingOrders, state.careerCycle]);
      const yes = document.createElement("button");
      yes.id = "decision-pace-confirm";
      yes.textContent = s?.allowed ? "\uC774\uBC88 \uC9C4\uB85C \uC720\uC9C0 \xB7 \uB2E4\uC74C \uD310\uB2E8 \uACBD\uACC4\uAE4C\uC9C0" : "\uD604\uC7AC \uC9C4\uB85C \uC720\uC9C0 \xB7 \uB2E4\uC74C \uD310\uB2E8 \uACBD\uACC4\uAE4C\uC9C0";
      yes.onclick = () => commitDecisionPace(signature);
      box.append(yes);
      const no = document.createElement("button");
      no.id = "decision-pace-back";
      no.textContent = "\uCDE8\uC18C \xB7 \uC774\uBC88 \uB2EC \uC9C1\uC811 \uD310\uB2E8";
      no.onclick = () => render();
      box.append(no);
      renderPortfolio();
    }
    function commitDecisionPace(signature) {
      if (storageReadBlocked || storageWriteBlocked || !decisionPaceAllowed() || JSON.stringify([state.month, state.turnCount, state.flags, state.cash, state.pendingOrders, state.careerCycle]) !== signature) return;
      const from = state.month, unpaidBefore = careerCashUnpaid(), fillsBefore = (state.fillsLog || []).length, historyBefore = state.history.length;
      let steps = 0, reason = "\uD310\uB2E8 \uACBD\uACC4";
      while (steps < 500) {
        const t = nextTurn(), td = turnEffDate(t);
        effDate = td.date;
        effPostClose = td.postClose;
        tryFillOrders();
        const fills = (state.fillsLog || []).length - fillsBefore, expiries = state.history.slice(historyBefore).filter((h) => h.choice?.startsWith("order-expired:")).length;
        if (propertyActive() && state.history.slice(historyBefore).some((h) => /^property-(buy|sell)-settled:/.test(h.choice || ""))) {
          reason = "\uC8FC\uD0DD \uACC4\uC57D \uC815\uC0B0";
          break;
        }
        if (fills || expiries) {
          reason = "\uC8FC\uBB38 \uBCC0\uD654";
          break;
        }
        if (careerCashUnpaid() > unpaidBefore) {
          reason = "\uCD94\uAC00 \uBBF8\uB0A9";
          break;
        }
        if (reservationSettlementDue()) {
          reason = "\uAE30\uC874 \uC608\uC57D \uBD84\uAE30 \uC815\uC0B0";
          break;
        }
        if (steps > 0 && careerCycleStatus(t)?.allowed) {
          reason = "\uBD84\uAE30 \uC9C4\uB85C \uC7AC\uC120\uD0DD";
          break;
        }
        if (steps > 0) recordAssetTrail();
        if (t.kind !== "quiet" || state.flags.gameOver || state.month > GAME_END) {
          reason = { news: "\uB274\uC2A4", life: "\uC9C4\uB85C\xB7\uBCF5\uBB34", discharge: "\uC804\uC5ED", "natural-end": "\uC885\uB8CC", gameover: "\uAC8C\uC784 \uC885\uB8CC" }[t.kind] || t.kind;
          break;
        }
        const before = state.month;
        advanceMonth();
        if (storageReadBlocked || storageWriteBlocked || multiTabConflict || state.month === before) return;
        state.turnCount++;
        steps++;
      }
      if (steps === 500) reason = "\uC548\uC804 \uC0C1\uD55C";
      const report = { version: 1, from, to: state.month, steps, reason, fills: (state.fillsLog || []).length - fillsBefore, expiries: state.history.slice(historyBefore).filter((h) => h.choice?.startsWith("order-expired:")).length, unpaidAdded: Math.max(0, careerCashUnpaid() - unpaidBefore) };
      state.decisionPaceReport = report;
      state.history.push({ month: state.month, decisionMonth: from, choice: "decision-pace:" + steps, reason });
      if (save()) render();
    }
    function decisionPaceReportHtml() {
      const r = state.decisionPaceReport;
      if (!decisionPaceActive() || !r) return "";
      return '<details class="decision-pace-report"><summary>\uB9C8\uC9C0\uB9C9 \uD310\uB2E8 \uACBD\uACC4 \uC9C4\uD589 \xB7 ' + esc(r.from) + " \u2192 " + esc(r.to) + " \xB7 " + esc(r.reason) + "</summary><p>" + r.steps + "\uAC1C\uC6D4 \uC2E4\uC81C \uC9C4\uD589 / \uCCB4\uACB0 " + r.fills + "\uAC74 / \uAE30\uD55C\uBC18\uD658 " + r.expiries + "\uAC74 / \uCD94\uAC00 \uBBF8\uB0A9 " + r.unpaidAdded.toLocaleString() + "\uC6D0. \uC0C8 \uC9C1\uC811\uB9E4\uB9E4\xB7\uC8FC\uBB38 \uCDE8\uC18C\xB7\uC0C1\uD658\uC774\uB098 \uAE30\uC0AC \uC6D0\uBB38 \uC2E4\uB3C5\uC73C\uB85C \uAE30\uB85D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC6D4\uBCC4 \uAE08\uC561\xB7\uCCB4\uACB0 \uB0B4\uC5ED\uC740 \uAE30\uC874 \uC7A5\uBD80\uC5D0 \uB0A8\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uACB0\uACFC\uB97C \uC608\uACE0\uD558\uB294 \uBBF8\uB9AC\uBCF4\uAE30\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p></details>";
    }
    function careerCycleActive() {
      return cashPlanActive() && state.careerCycleRules === 1;
    }
    function careerCycleTrack() {
      return state.flags.career === "job" ? "job" : state.flags.recoveryJob === "alba" ? "alba" : fulltimeActive() ? "fulltime" : null;
    }
    function careerCycleStatus(turn) {
      if (!careerCycleActive() || !turn || !["news", "quiet"].includes(turn.kind) || militaryActive() || state.flags.gameOver || state.month > GAME_END) return null;
      const track = careerCycleTrack();
      if (!track) return null;
      const choices = (state.history || []).filter((h) => h && typeof h.choice === "string" && (h.choice === "life:job" || h.choice === "life:fulltime" || h.choice.startsWith("career-cycle:")));
      const last = state.careerCycle?.changedMonth || choices.at(-1)?.decisionMonth || choices.at(-1)?.month || null;
      const q = (m) => Number(m.slice(0, 4)) * 4 + Math.floor((Number(m.slice(5)) - 1) / 3);
      const locked = !!(last && q(last) >= q(state.month)), quarter = isSettlementMonth();
      return { track, last, allowed: quarter && !locked, reason: !quarter ? "\uC9C4\uB85C \uC7AC\uC120\uD0DD\uC740 3\xB76\xB79\xB712\uC6D4\uC5D0 \uAC80\uD1A0\uD569\uB2C8\uB2E4." : locked ? "\uC774 \uBD84\uAE30\uC5D0\uB294 \uC774\uBBF8 \uC9C4\uB85C\uB97C \uC815\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uBD84\uAE30\uC6D4\uC5D0 \uB2E4\uC2DC \uAC80\uD1A0\uD569\uB2C8\uB2E4." : "\uC774\uBC88 \uBD84\uAE30\uC5D0 \uC218\uC785\uACFC \uC8FC\uBB38 \uC2DC\uAC04\uC744 \uB2E4\uC2DC \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." };
    }
    function careerCycleIdentity() {
      if (!careerCycleActive()) return state.cashReservePolicy ? cashReserveIdentityFields : cashIdentityFields;
      return state.cashReservePolicy ? cashCycleReserveIdentityFields : cashCycleIdentityFields;
    }
    function renderCareerCycle(target = null) {
      if (storageWriteBlocked || storageReadBlocked) return;
      const s = careerCycleStatus(nextTurn());
      if (!s) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices"), names = { job: "\uCDE8\uC5C5", fulltime: "\uC804\uC5C5 \uD22C\uC790", alba: "\uC54C\uBC14 \uBCD1\uD589 \uD22C\uC790" };
      card.innerHTML = '<div class="date">' + state.month + " \xB7 \uC7A5\uAE30 \uC9C4\uB85C \uC7AC\uC120\uD0DD</div><h2>\uC218\uC785\uC744 \uB2E4\uC2DC \uC313\uC744\uAE4C, \uD22C\uC790 \uC2DC\uAC04\uC744 \uD655\uBCF4\uD560\uAE4C</h2><p>\uD604\uC7AC " + names[s.track] + " \xB7 \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \xB7 \uBBF8\uB0A9 " + careerCashUnpaid().toLocaleString() + '\uC6D0</p><p>\uC7AC\uCDE8\uC5C5 \uB4A4\uC5D0\uB3C4 \uB2E4\uC2DC \uC804\uC5C5\uC744 \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uD55C \uBD84\uAE30\uC5D0 \uD55C \uBC88 \uBC14\uAFB8\uBA70 \uB2E4\uC74C \uBD84\uAE30\uC6D4\uAE4C\uC9C0 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uAE30\uC874 \uC8FC\uBB38\uC740 \uADF8\uB300\uB85C \uB0A8\uC2B5\uB2C8\uB2E4.</p><p class="note">' + esc(s.reason) + '</p><details class="career-cycle-coverage"><summary>\uC804\uC5C5 \uC900\uBE44\uAE08\uACFC \uC790\uB8CC \uD55C\uACC4</summary><p>' + esc(careerFulltimeCoverageText()) + "</p><p>\uC2E4\uC81C \uAD6C\uC9C1\xB7\uD1F4\uC9C1\xB7\uADFC\uB85C\uC870\uAC74\uC744 \uBCF5\uC6D0\uD55C \uAC83\uC774 \uC544\uB2CC \uAC8C\uC784 \uC124\uACC4\uC785\uB2C8\uB2E4. \uC790\uC0B0 \uC790\uACA9\uC774\uB098 \uC218\uC775 \uBCF4\uB108\uC2A4\uB294 \uC5C6\uC2B5\uB2C8\uB2E4. \uC544\uB798 \uC6D4 \uAE30\uBCF8\uD750\uB984\uC740 \uD22C\uC790\uC190\uC775\xB7\uAE30\uC874 \uBBF8\uB0A9 \uC0C1\uD658\uC744 \uC81C\uC678\uD55C \uACE0\uC815 \uAC8C\uC784\uAC12\uC785\uB2C8\uB2E4.</p></details>";
      box.innerHTML = "";
      card.innerHTML += albaTimeHtml();
      const details = { job: "\uC6D4 \uC218\uC785 1,500,000\uC6D0 - \uC0DD\uD65C 700,000\uC6D0 = \uC2E0\uADDC \uC5EC\uC720 800,000\uC6D0 [\uAC8C\uC784\uAC12]. \uB274\uC2A4\uC5D0\uC11C\uB294 \uBD84\uAE30 \uB4A4 \uC801\uACA9 \uAD00\uCE21\uC744 \uAE30\uB2E4\uB9AC\uB294 \uC608\uC57D\uB9CC, \uC9C1\uC811 \uC8FC\uBB38\uC740 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uACE0\uB985\uB2C8\uB2E4. \uC870\uAC74\xB7\uBD84\uD560\xB7\uB300\uAE30\uAE30\uD55C\uC744 \uC0C8\uB85C \uBD99\uC77C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", fulltime: "\uC6D4 \uC218\uC785 0\uC6D0 - \uC0DD\uD65C 700,000\uC6D0 = \uC6D4 700,000\uC6D0 \uAC10\uC18C [\uAC8C\uC784\uAC12]. \uB274\uC2A4\xB7\uD3C9\uC628 \uD134\uC5D0\uC11C \uC8FC\uBB38\uD558\uACE0 \uC870\uAC74\xB7\uBD84\uD560\xB7\uB300\uAE30\uAE30\uD55C\uC744 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uAC19\uC740 \uC790\uB8CC\uC640 \uAC00\uACA9\uC744 \uC4F0\uBA70 \uC218\uC775 \uBCF4\uB108\uC2A4\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.", alba: "\uC6D4 \uC218\uC785 200,000\uC6D0 - \uC0DD\uD65C 700,000\uC6D0 = \uC6D4 500,000\uC6D0 \uAC10\uC18C [\uAC8C\uC784\uAC12]. " + (albaTimeActive() ? "\uD55C \uB2EC \uC218\uB3D9 \uD22C\uC790 \uD310\uB2E81\uD68C(\uC0C8 \uC8FC\uBB38\xB7\uC870\uAC74/\uAE30\uD55C \uBCC0\uACBD)\uB85C \uC81C\uD55C\uB429\uB2C8\uB2E4. \uC804\uC5C5\uC740 \uAC01 \uD310\uB2E8 \uAE30\uD68C\uC5D0 \uB300\uC751\uD569\uB2C8\uB2E4." : "\uC804\uC5C5\uACFC \uAC19\uC740 \uC8FC\uBB38 \uC2DC\uAC04\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4.") + " \uC774 \uC120\uD0DD\uB9CC\uC73C\uB85C \uBBF8\uB0A9\uC744 \uAC1A\uC744 \uD751\uC790\uAC00 \uC0DD\uAE30\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." };
      for (const t of ["job", "fulltime", "alba"]) card.innerHTML += "<h3>" + names[t] + (t === s.track ? " \xB7 \uD604\uC7AC" : "") + "</h3><p>" + details[t] + "</p>";
      if (target !== null) {
        if (!["job", "fulltime", "alba"].includes(target) || target === s.track) return renderCareerCycle();
        const signature = JSON.stringify([state.month, state.flags, state.careerCycle, state.cash, state.jobSavingsPlan, state.pendingOrders]);
        card.innerHTML += "<h3>" + names[s.track] + " \u2192 " + names[target] + " \uD655\uC815 \uAC80\uD1A0</h3><p>\uC6D4\xB7\uD134\uACFC \uC9C0\uAE08\uAE4C\uC9C0 \uBC1B\uC740 \uC218\uC785\xB7\uB0A9\uBD80\uB294 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uC8FC\uBB38 \uC2DC\uAC04\uC740 \uD655\uC815 \uC9C1\uD6C4\uBD80\uD130 \uC0C8 \uC9C4\uB85C\uB97C \uB530\uB974\uACE0, \uC218\uC785\uC740 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uBC14\uB01D\uB2C8\uB2E4. \uAE30\uC874 \uBCF4\uC720\xB7\uBBF8\uB0A9\xB7\uB300\uAE30 \uC8FC\uBB38\xB7\uAD00\uCE21/\uC815\uC0B0 \uAC8C\uC774\uD2B8\uB294 \uB2F9\uAE30\uAC70\uB098 \uCDE8\uC18C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC870\uAC74\xB7\uBD84\uD560 \uC8FC\uBB38\uC740 \uAE30\uC874 \uC870\uAC74\uC73C\uB85C \uB0A8\uC2B5\uB2C8\uB2E4. \uCDE8\uC5C5\uC744 \uB5A0\uB098\uBA74 \uC55E\uC73C\uB85C\uC758 \uC790\uB3D9\uC801\uB9BD\uC744 \uB044\uBA70, \uB3CC\uC544\uC640\uB3C4 \uC790\uB3D9\uC73C\uB85C \uC7AC\uAC1C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC608\uBE44\uD604\uAE08 \uBAA9\uD45C\uB294 \uADF8\uB300\uB85C \uB0A8\uC2B5\uB2C8\uB2E4. \uAC19\uC740 \uBD84\uAE30\uC5D0 \uB2E4\uC2DC \uBC14\uAFC0 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>";
        const yes = document.createElement("button");
        yes.id = "career-cycle-confirm";
        yes.textContent = names[target] + " \uD655\uC815 \xB7 \uB2E4\uC74C \uBD84\uAE30\uC6D4\uAE4C\uC9C0 \uC720\uC9C0";
        yes.disabled = !s.allowed;
        yes.onclick = () => commitCareerCycle(target, signature);
        box.append(yes);
        const no = document.createElement("button");
        no.id = "career-cycle-review-back";
        no.textContent = "\uD655\uC815\uD558\uC9C0 \uC54A\uACE0 \uC9C4\uB85C \uBE44\uAD50\uB85C";
        no.onclick = () => renderCareerCycle();
        box.append(no);
      } else for (const t of ["job", "fulltime", "alba"]) if (t !== s.track) {
        const b = document.createElement("button");
        b.dataset.careerCycle = t;
        b.textContent = names[t] + "\uB85C \uBC14\uAFB8\uAE30 \uAC80\uD1A0";
        b.disabled = !s.allowed;
        b.onclick = () => renderCareerCycle(t);
        box.append(b);
      }
      const back = document.createElement("button");
      back.id = "career-cycle-back";
      back.textContent = names[s.track] + " \uC720\uC9C0 \xB7 \uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.append(back);
      renderPortfolio();
    }
    function commitCareerCycle(target, signature) {
      if (storageWriteBlocked || storageReadBlocked) return;
      const s = careerCycleStatus(nextTurn());
      if (!s?.allowed || !["job", "fulltime", "alba"].includes(target) || target === s.track || JSON.stringify([state.month, state.flags, state.careerCycle, state.cash, state.jobSavingsPlan, state.pendingOrders]) !== signature) return;
      state.flags.career = target === "job" ? "job" : "fulltime";
      state.flags.academicStatus = "graduated";
      if (target === "alba") {
        state.flags.recoveryJob = "alba";
        state.flags.recoveryAlbaMonth = state.month;
      } else {
        delete state.flags.recoveryJob;
        delete state.flags.recoveryAlbaMonth;
      }
      delete state.flags.recoveredFromFulltime;
      if (target !== "job" && state.jobSavingsPlan) state.jobSavingsPlan = { ...state.jobSavingsPlan, percent: 0, enabledAfterMonth: state.month };
      state.careerCycle = { version: 1, changedMonth: state.month, from: s.track, to: target };
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "career-cycle:" + s.track + ":" + target });
      if (save()) render();
    }
    function careerSwitchStatus(turn) {
      if (careerCycleActive()) return null;
      if (CASH_MODE || !SCHOOL_MODE || state.flags.career !== "job" || state.flags.academicStatus !== "graduated" || state.flags.gameOver || state.month > GAME_END || state.flags.recoveredFromFulltime) return null;
      if (!turn || !turn.settlement || militaryActive()) return null;
      const assets = totalAssets(), shortfall = 0;
      const futureReservation = (state.pendingOrders || []).some((o) => o.earliestFillMonth && o.earliestFillMonth > state.month);
      return { assets, shortfall, allowed: !futureReservation, reason: futureReservation ? "\uC544\uC9C1 \uC815\uC0B0\uC6D4\uC774 \uC624\uC9C0 \uC54A\uC740 \uCDE8\uC5C5 \uC608\uC57D\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uD574\uB2F9 \uC815\uC0B0 \uC774\uD6C4 \uB2E4\uC2DC \uAC80\uD1A0\uD558\uC138\uC694." : "\uBCF8\uD3B8 \uC9C4\uB85C\uB294 \uC790\uC0B0\uC790\uACA9 \uC5C6\uC774 \uC120\uD0DD \xB7 \uC0DD\uACC4\uAC00\uB2A5\uC131 \uBBF8\uD310\uC815" };
    }
    function renderCareerSwitch() {
      if (storageWriteBlocked || storageReadBlocked) return;
      const status = careerSwitchStatus(nextTurn());
      if (!status || !status.allowed) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      const ccModel = careerCashActive();
      const swP1 = ccModel ? "\uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 / \uC2DC\uC5F0 \uCD1D\uC790\uC0B0 " + status.assets.toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4. " + esc(careerFulltimeCoverageText()) + " \uBCF8\uD3B8 \uC9C4\uB85C\uB294 \uC790\uC0B0\uC790\uACA9 \uC5C6\uC774 \uACE0\uB985\uB2C8\uB2E4. \uCD1D\uC790\uC0B0\uC5D0\uB294 \uC0C1\uD488\uD3C9\uAC00\xB7\uC608\uC57D\uAE08\uB3C4 \uD3EC\uD568\uD558\uBA70 \uC989\uC2DC \uC4F8 \uC218 \uC788\uB294 \uD604\uAE08\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC804\uD658 \uBCF4\uB108\uC2A4\uB098 \uC0C8 \uC790\uAE08 \uC9C0\uAE09\uC740 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uD604\uC7AC \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 / \uC2DC\uC5F0 \uCD1D\uC790\uC0B0 " + status.assets.toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4. \uBCF8\uD3B8 \uC9C4\uB85C\uB294 \uC790\uC0B0\uC790\uACA9 \uC5C6\uC774 \uACE0\uB985\uB2C8\uB2E4. \uCD1D\uC790\uC0B0\uC5D0\uB294 \uC0C1\uD488\uD3C9\uAC00\xB7\uC608\uC57D\uAE08\uB3C4 \uD3EC\uD568\uD558\uBA70 \uC0DD\uD65C\uBE44\xB7\uC2E4\uAE09\uC5EC\uAC00 \uBBF8\uC5F0\uACB0\uC774\uB77C \uC2E4\uC81C \uC0DD\uACC4\uAC00\uB2A5\uC131\uC744 \uD310\uC815\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC804\uD658 \uBCF4\uB108\uC2A4\uB098 \uC0C8 \uC790\uAE08 \uC9C0\uAE09\uC740 \uC5C6\uC2B5\uB2C8\uB2E4.";
      const swP2 = ccModel ? "\uCDE8\uC5C5\uC744 \uC720\uC9C0\uD558\uBA74 \uB2E4\uC74C \uB2EC\uBD80\uD130\uB3C4 \uAE09\uC5EC \uC6D4 " + CCV.JOB_INCOME.toLocaleString() + "\uC6D0 \uC218\uC785\uACFC \uC0DD\uD65C\uBE44 \uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0 \uC9C0\uCD9C\uC774 \uACC4\uC18D \uBC18\uC601\uB429\uB2C8\uB2E4 [\uC124\uACC4\uAC12]. \uC804\uC5C5 \uC804\uD658\uC744 \uD655\uC815\uD558\uBA74 \uC774 \uBD84\uAE30 \uC815\uC0B0 \uC120\uD0DD\uC744 \uB9C8\uCE58\uACE0 \uB2E4\uC74C \uB2EC\uB85C \uC9C4\uD589\uD558\uBA70, \uB2E4\uC74C \uB2EC\uBD80\uD130 \uAE09\uC5EC \uC218\uC785\uC740 0\uC6D0\uC774 \uB418\uACE0 \uC0DD\uD65C\uBE44 \uC9C0\uCD9C\uC740 \uACC4\uC18D\uB429\uB2C8\uB2E4. \uC774\uBC88 \uB2EC\uAE4C\uC9C0 \uBC18\uC601\uB41C \uC218\uC785\xB7\uC9C0\uCD9C\uC740 \uB418\uB3CC\uB9AC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uCDE8\uC5C5\uC744 \uC720\uC9C0\uD558\uBA74 \uC55E\uC73C\uB85C\uB3C4 \uC6D4 \uC2DC\uD5D8 \uC21C\uC800\uCD95 " + SAVINGS_BASE.toLocaleString() + "\uC6D0\uACFC \uC2E0\uADDC\uC720\uC785 \uBC30\uBD84 \uACC4\uD68D\uC744 \uC774\uC5B4\uAC11\uB2C8\uB2E4. \uC804\uC5C5 \uC804\uD658\uC744 \uD655\uC815\uD558\uBA74 \uC774 \uBD84\uAE30 \uC815\uC0B0 \uC120\uD0DD\uC744 \uB9C8\uCE58\uACE0 \uB2E4\uC74C \uB2EC\uB85C \uC9C4\uD589\uD558\uBA70, \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC815\uAE30 \uC21C\uC800\uCD95\uC7400\uC6D0\xB7\uCDE8\uC5C5 \uC801\uB9BD \uACC4\uD68D\uC740\uAEBC\uC9D0\uC774 \uB429\uB2C8\uB2E4. \uC774\uBBF8 \uC774\uBC88\uB2EC \uBC1B\uC740 \uC21C\uC800\uCD95\uC740 \uB418\uB3CC\uB9AC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      const swP3 = (ccModel ? "\uCDE8\uC5C5 \uC911\uC5D0\uB294 \uB274\uC2A4 \uB300\uC751 \uC608\uC57D \uC8FC\uBB38(\uB2E4\uAC00\uC624\uB294 \uBD84\uAE30 \uC815\uC0B0 \uC774\uD6C4 \uC801\uACA9 \uAD00\uCE21\uC73C\uB85C \uCCB4\uACB0 \uB300\uAE30)\uACFC \uBD84\uAE30 \uC815\uC0B0 \uC804\uC6A9 \uD134 \uC8FC\uBB38\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uC804\uC5C5\uC73C\uB85C \uBC14\uAFB8\uBA74 \uC774\uD6C4 \uB274\uC2A4\xB7\uD3C9\uC628 \uD134 \uC8FC\uBB38\uACFC \uC870\uAC74\xB7\uBD84\uD560\xB7\uB300\uAE30\uAE30\uD55C \uC120\uD0DD\uC744 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : CAREER_TRIAL ? "\uACC4\uD68D\uD615 \uCDE8\uC5C5\uC740 \uC5F4\uB9B0 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uC0C8 \uD22C\uC790\uC8FC\uBB38\xB7\uBC30\uBD84\uC744 \uC815\uD558\uBA70 \uAE30\uC874 \uC6D0\uD654 \uC774\uC790\uB204\uC801 \uC0C1\uD488\uC758 \uD604\uAE08\uD68C\uC218\xB7\uBBF8\uCCB4\uACB0\uCDE8\uC18C\xB7\uC55E\uC73C\uB85C\uC758 \uC801\uB9BD\uC911\uB2E8\uC740 \uC5B8\uC81C\uB4E0 \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uC804\uC5C5\uC73C\uB85C \uBC14\uAFB8\uBA74 \uC774\uD6C4 \uB274\uC2A4\xB7\uD3C9\uC628 \uD134 \uC8FC\uBB38\uACFC \uC870\uAC74\xB7\uBD84\uD560\xB7\uAE30\uD55C \uC120\uD0DD\uC744 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : "\uC804\uC5C5\uC740 \uC774\uD6C4 \uB274\uC2A4\xB7\uD3C9\uC628 \uD134 \uC8FC\uBB38\uACFC \uC870\uAC74\xB7\uBD84\uD560\xB7\uB300\uAE30\uAE30\uD55C \uC120\uD0DD\uC744 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.") + " \uAE30\uC874 \uC608\uC57D\uC740 \uCDE8\uC18C\uD558\uAC70\uB098 \uAD00\uCE21\xB7\uC815\uC0B0\uC870\uAC74\uC744 \uB2F9\uAE30\uC9C0 \uC54A\uC73C\uBA70, \uC774\uBC88 \uBD84\uAE30 \uC815\uC0B0 \uC644\uB8CC \uB4A4\uC5D0\uB3C4 \uC0C8 \uC801\uACA9\uAD00\uCE21\uC774 \uC788\uC5B4\uC57C \uCCB4\uACB0\uB429\uB2C8\uB2E4. \uC804\uD658 \uC790\uCCB4\uB294 \uB9E4\uC218\xB7\uB9E4\uB3C4\uAC00 \uC544\uB2D9\uB2C8\uB2E4.";
      const swP4 = ccModel ? (state.careerCashRules === 3 ? "\uC804\uC5C5 \uC774\uD6C4\uC5D0\uB294 \uB9E4 \uBD84\uAE30\uC6D4 \uC54C\uBC14\xB7\uC7AC\uCDE8\uC5C5 \uD68C\uBCF5\uC744 \uAC80\uD1A0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC774 \uC800\uC7A5\uC758 \uC0DD\uC131 \uB2F9\uC2DC \uADDC\uCE59\uC5D0\uC11C\uB294 \uC7AC\uCDE8\uC5C5 \uB4A4 \uB2E4\uC2DC \uC804\uC5C5\uC73C\uB85C \uB3CC\uC544\uAC08 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uC774 \uC800\uC7A5\uC740 \uC0DD\uC131 \uB2F9\uC2DC \uADDC\uCE59\uC5D0 \uB530\uB77C \uC804\uC5C5 \uC774\uD6C4 \uCDE8\uC5C5\uC73C\uB85C \uB3CC\uC544\uC624\uB294 \uC120\uD0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") + " \uC2E4\uC81C \uD1F4\uC9C1\uAE08\xB7\uD1F4\uC9C1\uBE44\uC6A9\xB7\uAD6C\uC9C1 \uACFC\uC815\uC740 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uACE0 \uAE09\uC5EC\xB7\uC0DD\uD65C\uBE44\uB294 \uC704 \uC124\uACC4\uAC12\uB9CC \uBC18\uC601\uB429\uB2C8\uB2E4. \uC804\uC5C5\uC774 \uB354 \uC720\uB9AC\uD558\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uCDE8\uC18C\uD558\uBA74 \uC6D4\xB7\uC790\uAE08\xB7\uAE30\uB85D\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4." : "\uD604 \uC2DC\uD5D8\uC5D0\uC11C\uB294 \uCDE8\uC5C5\uC73C\uB85C \uB3CC\uC544\uC624\uB294 \uC120\uD0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uD1F4\uC9C1\uAE08\xB7\uD1F4\uC9C1\uBE44\uC6A9\xB7\uC7AC\uCDE8\uC5C5\xB7\uC0DD\uD65C\uBE44\uB97C \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC73C\uBA70\u3001\uC804\uC5C5\uC774 \uB354 \uC720\uB9AC\uD558\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uCDE8\uC18C\uD558\uBA74 \uC6D4\xB7\uC790\uAE08\xB7\uAE30\uB85D\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.";
      card.innerHTML = careerTrialNote() + '<div class="date">' + state.month + ' \xB7 \uCDE8\uC5C5 \uC774\uD6C4 \uC9C4\uB85C \uC7AC\uC120\uD0DD [\uC2DC\uD5D8\uADDC\uCE59]</div><h2>\uCDE8\uC5C5 \uC720\uC9C0\uC640 \uC804\uC5C5 \uC804\uD658</h2><p style="margin-top:12px">' + swP1 + '</p><p style="margin-top:12px">' + swP2 + '</p><p style="margin-top:12px">' + swP3 + '</p><p class="note" style="margin-top:12px">' + swP4 + "</p>";
      box.innerHTML = "";
      const yes = document.createElement("button");
      yes.id = "career-switch-confirm";
      yes.textContent = ccModel ? "\uC804\uC5C5 \uD655\uC815 \xB7 \uB2E4\uC74C \uB2EC \uAE09\uC5EC \uC218\uC785 0\uC6D0" : "\uC804\uC5C5 \uD655\uC815 \xB7 \uB2E4\uC74C \uB2EC \uC21C\uC800\uCD950\uC6D0";
      yes.onclick = commitCareerSwitch;
      const no = document.createElement("button");
      no.id = "career-switch-cancel";
      no.textContent = "\uCDE8\uC5C5 \uC720\uC9C0 \xB7 \uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      no.onclick = () => render();
      box.append(yes, no);
      renderPortfolio();
    }
    function commitCareerSwitch() {
      if (storageWriteBlocked || storageReadBlocked) return;
      const status = careerSwitchStatus(nextTurn());
      if (!status || !status.allowed) return;
      state.flags.settledMonth = state.month;
      state.flags.career = "fulltime";
      if (state.jobSavingsPlan) state.jobSavingsPlan = { ...state.jobSavingsPlan, percent: 0, enabledAfterMonth: state.month };
      finishTurn(null, "career-switch:fulltime");
    }
    function jobPlanProduct(plan = state.jobSavingsPlan) {
      return state.jobPlanProductRules === 1 && plan && ["kospi", "fx", "usdeposit"].includes(plan.product) ? plan.product : "kospi";
    }
    function jobPlanChoices() {
      return ["kospi", "fx", "usdeposit"].map(productRule).filter((u) => productAvailable(u) && u.tradable !== false && ["price", "fxaccrual"].includes(u.rule) && holdingPricePoint(u.product, state.month));
    }
    function jobSavingsPlanHtml() {
      if (cashPlanActive()) return cashSavingsPlanHtml();
      if (CASH_MODE || GAME_LIVING || careerCashActive() || state.flags.career !== "job" || state.flags.academicStatus !== "graduated") return "";
      const plan = state.jobSavingsPlan, label = state.jobPlanProductRules === 1 ? productRule(jobPlanProduct(plan)).name || "\uB300\uC0C1 \uBBF8\uD655\uC778" : "\uAD6D\uB0B4\uC9C0\uC218";
      return (CAREER_TRIAL ? '<p class="note career-plan-status">\uACC4\uD68D\uD615 \uCDE8\uC5C5: \uBC30\uBD84\uBE44\uC728 \uC124\uC815\xB7\uC7AC\uAC1C\uB294 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC, \uC55E\uC73C\uB85C\uC758 \uC801\uB9BD \uB044\uAE30\uB294 \uC5B8\uC81C\uB4E0 \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uCDE8\uC18C\uAE08\uC740 \uBC14\uB85C \uD604\uAE08\uC774 \uB418\uC9C0\uB9CC \uC0C8 \uD22C\uC790\uC8FC\uBB38\uC740 \uC815\uC0B0 \uC2DC\uAC04\uD45C\uB97C \uB530\uB985\uB2C8\uB2E4.</p>' : "") + '<details class="job-savings-plan"><summary>\uCDE8\uC5C5 \uC21C\uC800\uCD95 \uBC30\uBD84 \uACC4\uD68D \xB7 ' + (plan && plan.percent ? plan.percent + "% " + esc(label) + " \uB9E4\uC218 \uC608\uC57D (\uC6D4 \uC811\uC218 \xB7 \uBD84\uAE30 \uB4A4 \uCCAB \uAD00\uCE21 \uC9C0\uC810 \uC77C\uAD04 \uCCB4\uACB0)" : "\uAEBC\uC9D0 \xB7 \uD604\uAE08\uC73C\uB85C \uBCF4\uC720") + '</summary><p class="note">\uC774\uBBF8 \uAC00\uC9C4 \uD604\uAE08\uC740 \uAC74\uB4DC\uB9AC\uC9C0 \uC54A\uACE0, \uC124\uC815 \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC0C8\uB85C \uB4E4\uC5B4\uC624\uB294 \uC2DC\uD5D8 \uC21C\uC800\uCD95 \uC911 \uC120\uD0DD \uBE44\uC728\uB9CC ' + esc(label) + " \uB9E4\uC218\uB85C \uC608\uC57D\uD569\uB2C8\uB2E4. \uC811\uC218\uB294 \uB9E4\uC6D4 \uC774\uB904\uC9C0\uC9C0\uB9CC, \uBD84\uAE30 \uAC8C\uC774\uD2B8 \uB3D9\uC548 \uC811\uC218\uB41C \uC608\uC57D\uC740 \uC815\uC0B0 \uC644\uB8CC \uB4A4 \uCC98\uC74C \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC9C0\uC810 \uD558\uB098\uC5D0 \uAC19\uC740 \uAC00\uACA9\uC73C\uB85C \uD568\uAED8 \uCCB4\uACB0\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC6D4\uBCC4\uB85C \uB2E4\uB978 \uAC00\uACA9\uC5D0 \uB098\uB220 \uCCB4\uACB0\uB418\uB294 \uBD84\uC0B0\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC73C\uBA70 \uC218\uC775\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. " + (CAREER_TRIAL ? "\uC0C8 \uC9C1\uC811\uB9E4\uB9E4\uB294 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4." : "\uC9C1\uC811 \uB9E4\uB9E4\uB3C4 \uACC4\uC18D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.") + " \uC2E4\uC81C \uAE09\uC5EC\xB7\uC801\uB9BD\uC2DD \uC0C1\uD488\uC774 \uC544\uB2CC \uAC8C\uC784 \uC2DC\uD5D8\uADDC\uCE59\uC785\uB2C8\uB2E4.</p>" + (state.jobPlanProductRules === 1 ? '<p class="note">\uB300\uC0C1\uC744 \uBC14\uAFD4\uB3C4 \uC774\uBBF8 \uC811\uC218\uD55C \uB2E4\uB978 \uC0C1\uD488\uC758 \uC608\uC57D\uC740 \uB0A8\uC2B5\uB2C8\uB2E4. \uC0C8 \uB300\uC0C1\uC5D0 \uD604\uC7AC \uC801\uACA9 \uC2DC\uC138\uAC00 \uC5C6\uC73C\uBA74 \uADF8 \uB2EC \uC0C8 \uC720\uC785\uC740 \uD604\uAE08\uC73C\uB85C \uB0A8\uACE0 \uB098\uC911\uC5D0 \uC18C\uAE09 \uC608\uC57D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2EC\uB7EC\uC608\uAE08 \uC774\uC790\uB294 \uC2E4\uC81C \uACC4\uC57D\uAE08\uB9AC\uAC00 \uC544\uB2CC \uAE30\uC874 \uC5F04% \uAC8C\uC784\uAC12\uC785\uB2C8\uB2E4.</p>' : "") + '<button id="job-plan-open">\uC55E\uC73C\uB85C\uC758 \uBC30\uBD84 ' + (state.jobPlanProductRules === 1 ? "\uB300\uC0C1\xB7" : "") + "\uBE44\uC728 \uBC14\uAFB8\uAE30</button></details>";
    }
    function renderJobSavingsPlan() {
      if (cashPlanActive()) return renderCashSavingsPlan();
      if (storageWriteBlocked || storageReadBlocked || CASH_MODE || careerCashActive() || state.flags.career !== "job" || state.flags.academicStatus !== "graduated") return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices"), canChoose = state.jobPlanProductRules === 1;
      card.innerHTML = careerTrialNote() + '<div class="date">' + state.month + " \xB7 \uCDE8\uC5C5 \uD6C4 \uC790\uAE08 \uACC4\uD68D</div><h2>\uC55E\uC73C\uB85C\uC758 \uC21C\uC800\uCD95\uC744 \uC5B4\uB514\uC5D0 \uB458\uAE4C</h2><p>\uB2E4\uC74C \uB2EC\uBD80\uD130 \uC0C8 \uC6D4 \uC2DC\uD5D8 \uC21C\uC800\uCD95 " + SAVINGS_BASE.toLocaleString() + "\uC6D0 \uC911 " + (canChoose ? "\uACE0\uB978 \uC0C1\uD488" : "\uAD6D\uB0B4\uC9C0\uC218") + " \uB9E4\uC218\uB85C \uC608\uC57D\uD560 \uBE44\uC728\uC744 \uACE0\uB985\uB2C8\uB2E4. \uB098\uBA38\uC9C0\uB294 \uD604\uAE08\uC73C\uB85C \uB0A8\uAE41\uB2C8\uB2E4. \uBCF5\uBB34 \uC911\xB7\uC2E0\uADDC \uC21C\uC800\uCD950\uC6D0\xB7\uC0C1\uD488\uC811\uADFC/\uC2DC\uC138 \uBBF8\uD655\uBCF4 \uB54C\uB294 \uC608\uC57D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p>\uC608\uC57D\uAE08\uC740 \uB2E4\uB978 \uC8FC\uBB38\uC5D0 \uC4F8 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38\uC740 \uD574\uB2F9 \uBD84\uAE30 \uC815\uC0B0 \uC644\uB8CC \uD6C4 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uC744 \uAE30\uB2E4\uB9AC\uBA70 \uC790\uB8CC\uAC00 \uC5C6\uC73C\uBA74 \uC7A5\uAE30 \uBBF8\uCCB4\uACB0\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB300\uAE30\uC8FC\uBB38\uC5D0\uC11C \uC9C1\uC811 \uCDE8\uC18C\uD560 \uC218 \uC788\uACE0 \uACC4\uD68D \uC911\uB2E8" + (canChoose ? "\xB7\uB300\uC0C1 \uBCC0\uACBD" : "") + "\uC740 \uC774\uBBF8 \uC811\uC218\uD55C \uC8FC\uBB38\uC744 \uCDE8\uC18C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uACFC\uAC70 \uC21C\uC800\uCD95\uC740 \uC18C\uAE09 \uBC30\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
      box.innerHTML = "";
      if (canChoose) {
        const choices = jobPlanChoices(), label = document.createElement("label"), select = document.createElement("select");
        label.htmlFor = "job-plan-product";
        label.textContent = "\uC55E\uC73C\uB85C \uC0C8 \uC720\uC785\uC744 \uC608\uC57D\uD560 \uB300\uC0C1 ";
        select.id = "job-plan-product";
        select.style.cssText = "width:100%;min-height:44px;margin:8px 0";
        for (const u of choices) {
          const option = document.createElement("option");
          option.value = u.product;
          option.textContent = u.name;
          select.append(option);
        }
        const current = jobPlanProduct();
        if (choices.some((u) => u.product === current)) select.value = current;
        const note = document.createElement("p");
        note.id = "job-plan-product-note";
        note.className = "note";
        const refresh = () => {
          const u = productRule(select.value);
          note.textContent = (u.rule_note || "\uAE30\uC874 \uAD6D\uB0B4\uC9C0\uC218 \uD76C\uC18C\uC790\uB8CC \uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0\uC785\uB2C8\uB2E4.") + " " + productAccessDisplayNote(u);
        };
        select.onchange = refresh;
        refresh();
        card.append(label, select, note);
        const limits = document.createElement("p");
        limits.className = "note";
        limits.textContent = "\uAD6D\uB0B4\uC9C0\uC218\xB7\uB2EC\uB7EC \uBCF4\uC720\xB7\uB2EC\uB7EC\uC608\uAE08 \uC911 \uD604\uC7AC \uAC8C\uC784 \uC811\uADFC\uC77C\uACFC \uC2DC\uC138\uAC00 \uD655\uC778\uB418\uB294 \uB300\uC0C1\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC2E4\uAC00\uC785 \uC790\uACA9\uC774\uB098 \uC2E4\uC81C \uC8FC\uBB38\uAC00\uB97C \uBCF4\uC99D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC774 \uB300\uC0C1 \uC120\uD0DD\uC740 \uC774 \uBE4C\uB4DC \uC774\uD6C4 \uC0C8 \uBCF8\uD3B8 \uC21C\uC800\uCD95 \uD68C\uADC0\uC5D0\uB9CC \uC5F4\uB9BD\uB2C8\uB2E4. \uAE30\uC874 \uC800\uC7A5\uC740 \uAD6D\uB0B4\uC9C0\uC218 \uACC4\uD68D \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.";
        card.append(limits);
      }
      [[0, "\uD604\uAE08\uC73C\uB85C \uB0A8\uAE30\uAE30 (\uC55E\uC73C\uB85C\uC758 \uC608\uC57D \uB044\uAE30)"], [50, "\uC808\uBC18 \uC608\uC57D \xB7 \uC808\uBC18 \uD604\uAE08 (50%)"], [100, "\uC804\uC561 \uC608\uC57D \xB7 \uC0C8 \uC21C\uC800\uCD95 \uBAA8\uB450 \uB9E4\uC218 \uC608\uC57D (100%)"]].forEach(([percent, label]) => {
        const button = document.createElement("button");
        button.textContent = label;
        button.dataset.planPercent = String(percent);
        button.disabled = !careerPlanCanSet(percent) || canChoose && percent > 0 && !jobPlanChoices().length;
        if (!careerPlanCanSet(percent)) button.textContent += " \xB7 \uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC124\uC815";
        button.onclick = () => {
          if (storageWriteBlocked || storageReadBlocked || !careerPlanCanSet(percent)) return;
          const product = canChoose ? document.getElementById("job-plan-product")?.value : "kospi";
          if (canChoose && percent > 0 && !jobPlanChoices().some((u) => u.product === product)) return;
          state.jobSavingsPlan = { version: 1, percent, enabledAfterMonth: state.month, appliedMonths: state.jobSavingsPlan ? state.jobSavingsPlan.appliedMonths : [], ...canChoose ? { product: ["kospi", "fx", "usdeposit"].includes(product) ? product : jobPlanProduct() } : {} };
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "job-savings-plan:" + percent + (canChoose ? ":" + state.jobSavingsPlan.product : "") });
          if (save()) render();
        };
        box.appendChild(button);
      });
      const back = document.createElement("button");
      back.textContent = "\uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.appendChild(back);
      renderPortfolio();
    }
    function applyJobSavingsPlan(sv) {
      const plan = state.jobSavingsPlan;
      if (CASH_MODE || careerCashActive() || !plan || !plan.percent || state.month <= plan.enabledAfterMonth || state.flags.career !== "job" || state.flags.academicStatus !== "graduated" || militaryActive() || sv <= 0 || schoolDataGap() || plan.appliedMonths.includes(state.month)) return;
      const product = jobPlanProduct(plan), u = productRule(product), pt = priceAt(u.series || product, state.month);
      if (!productAvailable(u) || !pt || !wasObservableAt(pt, effDate, effPostClose)) return;
      const amount = Math.round(sv * plan.percent / 100);
      if (amount <= 0 || amount > state.cash) return;
      const settleMonth = nextSettlementMonth();
      state.pendingOrders = state.pendingOrders || [];
      state.pendingOrders.push({ id: "job-plan-" + state.month, kind: "buy", product, amount, placedMonth: state.month, basePtDate: pt.date, ...reserveObsGate(settleMonth), earliestFillMonth: settleMonth, reserve: "job-settlement", planOrigin: "job-savings" });
      state.cash -= amount;
      plan.appliedMonths.push(state.month);
      state.history.push({ month: state.month, choice: "job-savings-auto:" + product, amount, settleMonth });
    }
    function settlementNote(turn) {
      if (!isSettlementMonth()) return "";
      let s = '<div class="tags">' + (turn.settlement ? "\uBD84\uAE30 \uC815\uC0B0" : "\uBD84\uAE30\uC6D4 \uC790\uC0B0 \uD3C9\uAC00") + ": \uCD1D\uC790\uC0B0 " + totalAssets().toLocaleString() + "\uC6D0 (" + tradeAccess(turn).label + ")";
      for (const [p, h] of Object.entries(state.holdings)) {
        const u = DATA.unlocks.find((x) => x.product === p);
        const invested = Math.round(h.invested != null ? h.invested : h.avgPrice * h.qty);
        const val = holdingValue(p, h, state.month);
        let basis;
        if (u && (u.rule === "accrual" || u.rule === "fxaccrual")) {
          basis = " (\uC774\uC790 \uB204\uC801 " + accrualRate(u).label + " \xB7 \uC608\uCE58 \uB2F9\uC6D4\uBD80\uD130 \uC6D4 \uB2E8\uC704 \uBC1C\uC0DD, \uD574\uC9C0 \uB2F9\uC6D4 \uBBF8\uBC1C\uC0DD [\uC2DC\uC5F0 \uBAA8\uD615])";
          if (u.rule === "fxaccrual") {
            const pt0 = holdingPricePoint(p, state.month);
            if (pt0) basis += " \xB7 \uD658\uC728 \uC9C0\uC810 " + fmtPtDate(pt0);
          }
        } else {
          const pt = holdingPricePoint(p, state.month);
          basis = pt ? " (\uD655\uBCF4 \uC9C0\uC810 " + fmtPtDate(pt) + ")" : " (\uC9C0\uC810 \uC5C6\uC74C, \uD22C\uC785\uAC00 \uD45C\uC2DC)";
        }
        s += "<br>" + esc(u ? u.name : p) + ": \uD22C\uC785 " + invested.toLocaleString() + "\uC6D0 \u2192 \uC2DC\uC5F0 \uD3C9\uAC00 " + val.toLocaleString() + "\uC6D0" + basis;
      }
      s += "<br>\uD655\uBCF4\uB41C \uCD5C\uC2E0 \uC9C0\uC810 \uAE30\uC900\uC758 \uC2DC\uC5F0 \uD3C9\uAC00\uC608\uC694. \uB2F9\uC2DC \uC2E4\uC81C \uD3C9\uAC00\xB7\uC190\uC775\uACFC\uB294 \uAD6C\uBD84\uB3FC\uC694.</div>";
      return s;
    }
    function arrearsChoiceNoteHtml() {
      if (!careerCashActive() || !careerCashBuyHoldOn() || careerCashUnpaid() <= 0) return "";
      return '<aside class="arrears-choice-note"><h3>\uD604\uC7AC \uBBF8\uB0A9 ' + careerCashUnpaid().toLocaleString() + "\uC6D0</h3><p>\uC0C8 \uB9E4\uC218 \uC811\uC218\xB7\uB300\uAE30 \uB9E4\uC218 \uCCB4\uACB0\uC740 \uC0C1\uD658 \uC804\uAE4C\uC9C0 \uBCF4\uB958\uB429\uB2C8\uB2E4. \uBCF4\uC720 \uC720\uC9C0\xB7\uB9E4\uB3C4\xB7\uC608\uC57D \uCDE8\uC18C\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4.</p><p>\uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0\uC73C\uB85C \uC790\uC0B0\uD45C\uC5D0\uC11C \uC0C1\uD658\uD558\uC138\uC694. \uB9E4\uB3C4\uB300\uAE08\uC740 \uCCB4\uACB0 \uB4A4\uC5D0\uB9CC \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4." + (state.careerCashRules >= 3 ? " \uC18C\uB4DD \uC804\uD658\uC740 \uC5F4\uB9AC\uB294 \uBD84\uAE30\uC6D4\uC758 \uC9C4\uB85C \uBE44\uAD50\uC5D0\uC11C \uAC80\uD1A0\uD569\uB2C8\uB2E4." : "") + "</p></aside>";
    }
    function clarifyLockedBuyDisplay() {
      if (!pending || pending.step !== "weight" || pending.direction === "sell" || !careerCashBuyHoldOn() || careerCashUnpaid() <= 0) return;
      const card = document.getElementById("turn-card");
      if (card.querySelector(".locked-order-details")) return;
      const h = card.querySelector("h2");
      if (!h) return;
      const d = document.createElement("details");
      d.className = "locked-order-details";
      const summary = document.createElement("summary");
      summary.textContent = "\uD604\uC7AC \uC785\uB825\xB7\uAC00\uACA9\xB7\uC81C\uD55C \uADFC\uAC70 \uBCF4\uAE30";
      d.append(summary);
      while (h.nextSibling) d.append(h.nextSibling);
      h.textContent = "\uC0C1\uD658 \uC804\uC5D0\uB294 \uB9E4\uC218\uD560 \uC218 \uC5C6\uC5B4\uC694";
      const note = document.createElement("div");
      note.innerHTML = arrearsChoiceNoteHtml();
      card.append(note, d);
    }
    let schoolProgressRunning = false, schoolProgressRenderedTurn = null;
    function schoolProgressAvailable(turn) {
      const b = state.flags?.birth;
      const highschool = b && state.month < b.hsYear + 3 + "-03" && ["study", "parttime"].includes(state.flags.studyPath);
      const college = state.flags.studyPath === "study" && state.flags.academicStatus === "college" && state.acadRules === 3 && ["focus", "balanced"].includes(state.colPolicy);
      return vnChapterEligible() && careerCashActive() && (highschool || college) && turn?.kind === "quiet" && !turn.settlement && !militaryActive() && !state.flags.gameOver && state.month <= GAME_END;
    }
    async function runSchoolProgress(initialTurn) {
      if (schoolProgressRunning || storageReadBlocked || storageWriteBlocked || !schoolProgressAvailable(initialTurn) || initialTurn !== schoolProgressRenderedTurn) return;
      const beforeUnpaid = careerCashUnpaid(), beforeFills = (state.fillsLog || []).length, beforeHistory = state.history.length, beforeRows = state.cashEvents?.rows?.length || 0;
      let steps = 0, reason = "\uB2E4\uC74C \uC120\uD0DD", saveFailed = false, surface = document.querySelector("main");
      schoolProgressRunning = true;
      if (surface) surface.inert = true;
      try {
        while (steps < 48) {
          if (storageReadBlocked || storageWriteBlocked || multiTabConflict) break;
          const turn = schoolProgressRenderedTurn;
          if (careerCashUnpaid() > beforeUnpaid) {
            reason = "\uCD94\uAC00 \uBBF8\uB0A9";
            break;
          }
          if ((state.fillsLog || []).length > beforeFills || state.history.slice(beforeHistory).some((h) => /^property-(buy|sell)-settled:/.test(h.choice || "")) || state.history.slice(beforeHistory).some((h) => h.choice?.startsWith("order-expired:"))) {
            reason = "\uAE30\uC874 \uC8FC\uBB38 \uBCC0\uD654";
            break;
          }
          if (!schoolProgressAvailable(turn)) {
            reason = turn?.kind === "news" ? "\uC0C8 \uAE30\uC0AC" : turn?.kind === "life" ? "\uD559\uC5C5\xB7\uC9C4\uD559\xB7\uBCF5\uBB34 \uC120\uD0DD" : "\uC9C4\uD589 \uACBD\uACC4";
            break;
          }
          const month = state.month;
          schoolProgressRenderedTurn = null;
          vnChapterClear();
          const chapterBefore = vnChapterBeforeChoice({ id: "hold" }, turn);
          choose("hold", turn);
          vnChapterAfterChoice(chapterBefore);
          steps++;
          if (typeof window.__returnStorageFlush === "function" && await window.__returnStorageFlush() === false) {
            saveFailed = true;
            reason = "\uC800\uC7A5 \uD655\uC778 \uD544\uC694";
            break;
          }
          if (state.month === month) {
            reason = "\uAC19\uC740 \uB2EC\uC758 \uD310\uB2E8 \uACBD\uACC4";
            break;
          }
        }
      } catch (_) {
        saveFailed = true;
        reason = "\uC800\uC7A5 \uD655\uC778 \uD544\uC694";
      } finally {
        schoolProgressRunning = false;
        if (surface) surface.inert = false;
        if (saveFailed || storageReadBlocked || storageWriteBlocked || multiTabConflict) {
          if (saveFailed && !storageReadBlocked && !storageWriteBlocked && !multiTabConflict) showStorageWriteUnavailable();
          const note = document.createElement("p");
          note.id = "school-progress-save-error";
          note.className = "note";
          note.setAttribute("role", "alert");
          note.textContent = "\uD559\uAD50 \uC9C4\uD589\uC744 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uC644\uB8CC\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uD654\uBA74\uC758 \uBCF5\uAD6C \uC548\uB0B4\uB97C \uD655\uC778\uD558\uACE0, \uD655\uC778 \uC804\uC5D0\uB294 \uCD94\uAC00 \uC9C4\uD589\uD558\uC9C0 \uB9C8\uC138\uC694. \uC774 \uACB0\uACFC\uB97C \uC800\uC7A5 \uC644\uB8CC\uB85C \uBCF4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
          document.getElementById("choices")?.prepend(note);
        } else {
          const button = document.getElementById("school-progress");
          if (button) button.disabled = false;
          if (steps) {
            const note = document.createElement("p");
            note.className = "note";
            note.id = "school-progress-result";
            note.textContent = steps + "\uAC1C\uC6D4 \uAE30\uC874 \uC720\uC9C0 \uC2E4\uD589 \xB7 \uD604\uC7AC " + state.month + " \xB7 " + reason + ". \uAE30\uC0AC\xB7\uD559\uC5C5\xB7\uBCF5\uBB34 \uC120\uD0DD\uC740 \uC9C1\uC811 \uD655\uC778\uD569\uB2C8\uB2E4.";
            const rows = (state.cashEvents?.rows || []).slice(beforeRows);
            if (rows.length && rows.every((r) => [r.income, r.living, r.tuition, r.paid].every((x) => Number.isFinite(x) && x >= 0) && r.paid <= r.living + r.tuition)) {
              const sum = (key) => rows.reduce((n, r) => n + r[key], 0), receipt = document.createElement("span");
              receipt.id = "school-progress-cash-receipt";
              receipt.style.display = "block";
              receipt.textContent = "\uC774\uBC88 \uC9C4\uD589\uC5D0 \uC2E4\uC81C \uBC18\uC601\uB41C \uAC8C\uC784 \uC7A5\uBD80 \xB7 \uC218\uC785 " + sum("income").toLocaleString() + "\uC6D0 / \uCCAD\uAD6C " + (sum("living") + sum("tuition")).toLocaleString() + "\uC6D0 / \uB0A9\uBD80 " + sum("paid").toLocaleString() + "\uC6D0 \xB7 \uD604\uC7AC \uB0A8\uC740 \uBBF8\uB0A9 " + careerCashUnpaid().toLocaleString() + "\uC6D0. \uC790\uC0B0 \uD3C9\uAC00\uBCC0\uB3D9\xB7\uD22C\uC790\uC218\uC775\uACFC\uB294 \uBCC4\uB3C4\uC774\uBA70 \uCD94\uAC00 \uC785\uAE08\xB7\uC0C1\uD658\uC774 \uC544\uB2D9\uB2C8\uB2E4.";
              note.append(receipt);
            }
            document.getElementById("choices")?.prepend(note);
          }
        }
      }
    }
    function appendSchoolProgress(turn) {
      schoolProgressRenderedTurn = turn;
      if (!schoolProgressAvailable(turn)) return;
      const b = document.createElement("button");
      b.id = "school-progress";
      b.textContent = "\uD604\uC7AC \uD559\uAD50 \uBC29\uCE68 \uC720\uC9C0 \xB7 \uAE30\uC0AC\xB7\uAC08\uB9BC\uAE38\uC5D0\uC11C \uBA48\uCD94\uAE30";
      b.disabled = schoolProgressRunning;
      b.onclick = () => runSchoolProgress(turn);
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "\uB274\uC2A4 \uC5C6\uB294 \uB2EC\uC758 \uAE30\uC874 \uC720\uC9C0 \uC120\uD0DD\uC744 \uD55C \uB2EC\uC529 \uC2E4\uD589\uD569\uB2C8\uB2E4. \uD604\uC7AC \uACF5\uBD80\xB7\uC54C\uBC14 \uBC29\uCE68\uACFC \uC6D4\uBCC4 \uC218\uC785\xB7\uCCAD\uAD6C\xB7\uC8FC\uBB38\uC740 \uADF8\uB300\uB85C \uBC18\uC601\uD558\uACE0, \uCCAB \uAE30\uC0AC\xB7\uD559\uC5C5/\uC9C4\uD559/\uBCF5\uBB34 \uC120\uD0DD\xB7\uBBF8\uB0A9 \uC99D\uAC00\xB7\uAE30\uC874 \uC8FC\uBB38 \uBCC0\uD654\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4. \uBBF8\uB798 \uB0B4\uC6A9\uC740 \uBBF8\uB9AC \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      document.getElementById("choices")?.append(b, note);
    }
    function appendAcademicPosition(turn) {
      if (!vnChapterEligible() || !["news", "quiet", "life", "discharge"].includes(turn?.kind) || state.flags.gameOver || state.month > GAME_END) return;
      const f = state.flags, b = f.birth, highschool = Number.isInteger(b.hsYear) && state.month < b.hsYear + 3 + "-03";
      let title = "", detail = "", note = "";
      if (highschool && f.studyPath === "study" && state.academic && ["focus", "balanced"].includes(state.academic.policy) && Number.isFinite(state.academic.effort) && state.academic.effort >= 0) {
        title = "\uD604\uC7AC \uACE0\uAD50 \uD559\uC5C5";
        detail = (state.academic.policy === "focus" ? "\uACF5\uBD80 \uC9D1\uC911" : "\uC54C\uBC14 \uBCD1\uD589") + " \xB7 \uB178\uB825 \uB204\uC801 " + state.academic.effort + " / \uC9C4\uD559 \uD310\uC815 \uAE30\uC900 " + ACAD_ADMIT_MIN + " [\uAC8C\uC784\uAC12]";
        note = "\uC774\uBBF8 \uC313\uC778 \uB178\uB825\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uD569\uACA9 \uC608\uCE21\uC774\uB098 \uBBF8\uB798 \uC9C4\uD589 \uACB0\uACFC\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uBC29\uCE68 \uBCC0\uACBD\uC740 \uAE30\uC874 \uACE03 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uACE0\uB985\uB2C8\uB2E4.";
      } else if (f.studyPath === "study" && f.academicStatus === "college" && state.acadRules === 3 && ["focus", "balanced"].includes(state.colPolicy) && Number.isFinite(f.enrolledMonths) && f.enrolledMonths >= 0) {
        title = "\uD604\uC7AC \uB300\uD559 \uC7AC\uD559";
        detail = (state.colPolicy === "focus" ? "\uD559\uC5C5 \uC911\uC2EC" : "\uC54C\uBC14 \uBCD1\uD589") + " \xB7 \uC7AC\uD559 \uB204\uC801 " + f.enrolledMonths + " / \uC878\uC5C5 \uC694\uAC74 48\uAC1C\uC6D4 [\uAC8C\uC784\uAC12]";
        note = militaryActive() ? "\uC9C0\uAE08\uC740 \uBCF5\uBB34 \uC911\uC774\uB77C \uC7AC\uD559 \uB204\uC801\uC774 \uBA48\uCDA5\uB2C8\uB2E4. \uC774\uBBF8 \uC313\uC778 \uAE30\uAC04\uC740 \uB0A8\uC2B5\uB2C8\uB2E4." : "\uC774\uBBF8 \uC313\uC778 \uC7AC\uD559 \uAE30\uAC04\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC878\uC5C5 \uC608\uC0C1\uC6D4\uC740 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBC29\uCE68 \uBCC0\uACBD\uC740 \uAE30\uC874 \uBCF5\uD559\xB73\uD559\uB144 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uACE0\uB985\uB2C8\uB2E4.";
      } else return;
      const panel = document.createElement("aside");
      panel.id = "academic-position";
      panel.className = "note";
      panel.style.cssText = "margin:12px 0;padding:12px;border:1px solid #d9d1c5;border-radius:12px;background:#fff";
      panel.setAttribute("aria-label", "\uD604\uC7AC \uD559\uC5C5 \uC9C4\uD589");
      const h = document.createElement("h3");
      h.textContent = title;
      h.style.cssText = "font-size:1rem;margin:0 0 6px";
      const p = document.createElement("p");
      p.textContent = state.month + " \xB7 " + detail;
      const n = document.createElement("p");
      n.textContent = note + " \uC2E4\uC81C \uC131\uC801\xB7\uD559\uB825\xB7\uD559\uC81C\uAC00 \uC544\uB2CC \uAE30\uC874 \uAC8C\uC784 \uADDC\uCE59\uC758 \uB204\uC801\uC785\uB2C8\uB2E4.";
      panel.append(h, p, n);
      document.getElementById("choices")?.append(panel);
    }
    function renderChoices(list, turn) {
      const box = document.getElementById("choices");
      box.innerHTML = "";
      if (turn && ["news", "quiet"].includes(turn.kind)) box.insertAdjacentHTML("beforeend", arrearsChoiceNoteHtml());
      list.forEach((c) => {
        const b = document.createElement("button");
        b.textContent = c.label;
        b.onclick = () => {
          if (b.disabled) return;
          vnChapterClear();
          const before = vnChapterBeforeChoice(c, turn);
          if (before) b.disabled = true;
          choose(c.id, turn);
          vnChapterAfterChoice(before);
        };
        box.appendChild(b);
      });
      appendSchoolProgress(turn);
      appendAcademicPosition(turn);
    }
    function tradeLiquidityPreview(percent) {
      const fraction = Number(percent) / 100;
      if (!pending || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
      const deferred = pending.rule !== "accrual", isSell = pending.direction === "sell";
      if (isSell) {
        const h = state.holdings[pending.product];
        if (!h) return null;
        if (deferred) return { kind: "sell-lock", qty: h.qty * fraction, qtyAfter: h.qty * (1 - fraction), cashAfter: state.cash };
        const amount2 = Math.round(holdingValue(pending.product, h, state.month) * fraction);
        return { kind: "withdraw", amount: amount2, cashAfter: state.cash + amount2 };
      }
      const amount = Math.round(state.cash * fraction), existingBuyReserve = (state.pendingOrders || []).filter((o) => o.kind === "buy").reduce((sum, o) => sum + Math.max(0, o.amount - (o.split && o.split.n > 1 ? o.split.invested || 0 : 0)), 0);
      return { kind: deferred ? "buy-reserve" : "deposit", amount, cashAfter: state.cash - amount, existingBuyReserve, reserveAfter: existingBuyReserve + (deferred ? amount : 0) };
    }
    function renderTrade() {
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      const card = document.getElementById("turn-card");
      const box = document.getElementById("choices");
      box.innerHTML = "";
      if (pending.step !== "skip-preview" && !albaTimeAvailable()) {
        pending = null;
        render();
        return;
      }
      if (pending.step === "skip-preview") {
        const savedState = state;
        const savedEffDate = effDate, savedEffPostClose = effPostClose;
        let k = 0, ks = 0, arrive = null, stopAtSettlement = null, stopMonth = null, to;
        state = structuredClone(savedState);
        try {
          while (!state.flags.gameOver && state.month <= GAME_END) {
            const t = nextTurn();
            if (t.kind !== "quiet") {
              arrive = t.kind;
              break;
            }
            if (t.settlement) {
              if (stopAtSettlement === null) {
                stopAtSettlement = k;
                stopMonth = state.month;
              }
              state.flags.settledMonth = state.month;
              ks++;
            }
            advanceMonth();
            k++;
            if (k > 500) break;
          }
          if (!arrive && state.month > GAME_END) arrive = "natural-end";
          to = state.month;
        } finally {
          state = savedState;
          effDate = savedEffDate;
          effPostClose = savedEffPostClose;
        }
        const kindLabel = { "cash-due": "\uAC00\uC0C1\uC0DD\uD65C\uBE44\xB7\uD559\uBE44 \uC120\uD0DD", news: "\uB274\uC2A4", life: "\uC9C4\uB85C\xB7\uC0DD\uD65C", discharge: "\uC804\uC5ED", "demo-end": "\uC2DC\uC81C\uD488 \uAD6C\uAC04 \uC885\uB8CC", "natural-end": "\uC778\uC0DD \uACB0\uC0B0", gameover: "\uAC8C\uC784 \uC885\uB8CC(\uCE74\uC624\uC2A4)", "living-fail": "\uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 \uC2E4\uD328", "living-adjust": "\uC0DD\uD65C\uBE44 \uC815\uC0B0 \uC804 \uC870\uC815" };
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uAC74\uB108\uB6F0\uAE30 \uBBF8\uB9AC\uBCF4\uAE30</div><h2>\uC5EC\uAE30\uAE4C\uC9C0 \uC9C4\uD589\uB429\uB2C8\uB2E4</h2><p>\uB3C4\uCC29: " + to + " \xB7 " + (kindLabel[arrive] || arrive || "\uAD6C\uAC04 \uB05D") + " \xB7 " + k + "\uAC1C\uC6D4 \uC9C4\uD589" + (ks ? " \xB7 \uB118\uAE30\uB294 \uBD84\uAE30 \uC815\uC0B0 \uAE30\uD68C " + ks + "\uD68C\uB97C \uC9C0\uB098\uCE69\uB2C8\uB2E4(\uC8FC\uBB38\xB7\uB9AC\uBC38\uB7F0\uC2F1 \uAE30\uD68C \uD3EC\uAE30)" : " \xB7 \uB118\uAE30\uB294 \uC815\uC0B0 \uAE30\uD68C \uC5C6\uC74C") + ".</p><p>\uC800\uCD95\xB7\uC774\uC790\xB7\uCE74\uC624\uC2A4\xB7\uD559\uC801 \uC804\uC774\uB294 1\uAC1C\uC6D4\uC529 \uC9C4\uD589\uD560 \uB54C\uC640 \uAC19\uC740 \uADDC\uCE59\uC73C\uB85C \uB9E4\uC6D4 \uBC18\uC601\uB429\uB2C8\uB2E4 [\uC2DC\uC5F0 \uADDC\uCE59].</p>" + (state.jobSavingsPlan && state.jobSavingsPlan.percent ? "<p>\uC124\uC815\uD55C \uCDE8\uC5C5 \uC21C\uC800\uCD95 " + state.jobSavingsPlan.percent + "% \uC801\uB9BD \uC608\uC57D\uB3C4 \uB9E4\uC6D4 \uC801\uC6A9\uB429\uB2C8\uB2E4. \uC608\uC57D \uD604\uAE08\uC774 \uC7A0\uAE30\uACE0 \uBD84\uAE30 \uC815\uC0B0 \uB4A4 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uC744 \uAE30\uB2E4\uB9BD\uB2C8\uB2E4. \uC9C1\uC811 \uC8FC\uBB38\uC740 \uD558\uC9C0 \uC54A\uC740 \uAC83\uC73C\uB85C \uCC98\uB9AC\uD569\uB2C8\uB2E4.</p>" : "");
        const go = document.createElement("button");
        go.textContent = k + "\uAC1C\uC6D4 \uAC74\uB108\uB6F0\uAE30 \uC2E4\uD589";
        go.onclick = () => {
          pending = null;
          choose("skip-to-news", null);
        };
        if (albaTimeLimited()) {
          const note = document.createElement("p");
          note.className = "note alba-time-confirm";
          note.textContent = "\uD655\uC815\uD558\uBA74 " + state.month + " \uC54C\uBC14 \uC218\uB3D9 \uD22C\uC790 \uD310\uB2E81\uD68C\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uAC19\uC740 \uB2EC \uC0C8 \uB9E4\uC218\xB7\uB9E4\uB3C4\xB7\uC870\uAC74/\uAE30\uD55C \uBCC0\uACBD\uC740 \uB354 \uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC785\uB825 \uCDE8\uC18C\uB294 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 [\uAC8C\uC784\uADDC\uCE59].";
          card.append(note);
        }
        box.appendChild(go);
        if (stopAtSettlement !== null && stopAtSettlement > 0) {
          const keep = document.createElement("button");
          keep.textContent = "\uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uBA48\uCD94\uAE30 (" + stopAtSettlement + "\uAC1C\uC6D4 \uC9C4\uD589 \xB7 \uC815\uC0B0 \uAE30\uD68C \uC720\uC9C0)";
          keep.onclick = () => {
            pending = null;
            choose("skip-to-news-stop-settlement", null);
          };
          box.appendChild(keep);
          const note = document.createElement("p");
          note.className = "note";
          note.textContent = "\uC815\uC0B0 \uBA48\uCDA4\uC744 \uACE0\uB974\uBA74 " + stopMonth + " \uBD84\uAE30 \uC815\uC0B0 \uD654\uBA74\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4. \uC815\uC0B0 \uD6C4 \uB098\uBA38\uC9C0 \uAD6C\uAC04\uC740 \uB2E4\uC2DC \uAC74\uB108\uB6F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
          box.appendChild(note);
        }
        if ((state.pendingOrders || []).length) {
          const keepOrders = document.createElement("button");
          keepOrders.id = "skip-stop-orders";
          keepOrders.textContent = "\uB2E4\uC74C \uCCB4\uACB0\xB7\uAE30\uD55C\uBC18\uD658 \uB610\uB294 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uBA48\uCD94\uAE30";
          keepOrders.disabled = stopAtSettlement === 0;
          keepOrders.onclick = () => {
            pending = null;
            choose("skip-to-order-change", null);
          };
          box.appendChild(keepOrders);
          const orderNote = document.createElement("p");
          orderNote.id = "skip-stop-orders-note";
          orderNote.className = "note";
          orderNote.textContent = stopAtSettlement === 0 ? "\uD604\uC7AC \uBD84\uAE30 \uC815\uC0B0\uC744 \uBA3C\uC800 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694. \uC774 \uC9C4\uD589\uC740 \uC815\uC0B0 \uAE30\uD68C\uB97C \uC9C0\uB098\uCE58\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uC774 \uC120\uD0DD\uC740 \uC704 \uAE30\uBCF8 \uAC74\uB108\uB6F0\uAE30 \uB3C4\uCC29\uC6D4\uAE4C\uC9C0 \uAC04\uB2E4\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uB2EC\uB9C8\uB2E4 \uC2E4\uC81C\uB85C \uC9C4\uD589\uD558\uB2E4 \uCCAB \uC9C0\uC5F0\uCCB4\uACB0(\uBD84\uD560 \uC77C\uBD80 \uD3EC\uD568)\xB7\uB9E4\uC218 \uAE30\uD55C\uBC18\uD658\xB7\uBBF8\uC815\uC0B0 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4. \uB274\uC2A4\xB7\uC9C4\uB85C\xB7\uC804\uC5ED\xB7\uC885\uB8CC \uACBD\uACC4\uAC00 \uBA3C\uC800 \uC624\uBA74 \uADF8\uACF3\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4. \uBBF8\uB798 \uCCB4\uACB0\uC6D4\xB7\uAC00\uACA9\xB7\uBC18\uD658 \uACB0\uACFC\uB97C \uBBF8\uB9AC \uAC80\uC0C9\uD558\uAC70\uB098 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0C8 \uC9C1\uC811\uC8FC\uBB38\uC740 \uD558\uC9C0 \uC54A\uC73C\uBA70 \uCDE8\uC5C5 \uC801\uB9BD\uACC4\uD68D\uC740 \uB9E4\uC6D4 \uACC4\uC18D \uC801\uC6A9\uB429\uB2C8\uB2E4.";
          box.appendChild(orderNote);
        }
        const cancel = document.createElement("button");
        cancel.textContent = "\uCDE8\uC18C (\uB3CC\uC544\uAC00\uAE30)";
        cancel.onclick = () => {
          pending = null;
          render();
        };
        box.appendChild(cancel);
        return;
      }
      if (pending.step === "product") {
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uD3EC\uC9C0\uC158 \uC870\uC815 1/2</div><h2>\uC0C1\uD488 \uC120\uD0DD</h2>";
        unlockedProducts().forEach((u) => {
          const b = document.createElement("button");
          if (u.rule === "accrual" || u.rule === "fxaccrual") {
            b.textContent = u.name + " \u2014 \uC774\uC790 \uB204\uC801 " + accrualRate(u).label + " \xB7 \uC608\uCE58 \uB2F9\uC6D4\uBD80\uD130 \uC6D4 \uB2E8\uC704 \uBC1C\uC0DD, \uD574\uC9C0 \uB2F9\uC6D4 \uBBF8\uBC1C\uC0DD [\uC2DC\uC5F0 \uBAA8\uD615]";
            if (u.rule === "fxaccrual") {
              const pt0 = holdingPricePoint(u.product, state.month);
              b.textContent += pt0 ? " \xB7 \uD658\uC728 \uC9C0\uC810 " + pt0.value.toLocaleString() + " (" + fmtPtDate(pt0) + ")" : " \xB7 \uD658\uC728 \uC9C0\uC810 \uC5C6\uC74C";
              if (u.rule_note) b.textContent += " " + u.rule_note;
            }
          } else if (u.rule === "fxprice") {
            const pt = holdingPricePoint(u.product, state.month);
            const fxpt0 = priceAt("fx", state.month);
            b.textContent = u.name + (pt && fxpt0 ? (u.series === "btc" ? " \u2014 \uC2DC\uC138 \uC9C0\uC810 " : ["spy", "fxi"].includes(u.series) ? " \u2014 \uC2E4\uC81C ETF \uC885\uAC00(\uBD84\uD560\uBCF4\uC815) USD/\uBCF4\uC815\uB2E8\uC704 " : " \u2014 \uC9C0\uC218 \uC9C0\uC810 ") + pt.value.toLocaleString() + " (" + fmtPtDate(pt) + ") \xD7 \uD658\uC728 " + fxpt0.value.toLocaleString() + " (" + fmtPtDate(fxpt0) + ")" : " \u2014 \uC2DC\uC138 \uC9C0\uC810 \uC5C6\uC74C");
            if (u.rule_note) b.textContent += " " + u.rule_note;
          } else {
            const pt = holdingPricePoint(u.product, state.month);
            b.textContent = u.name + (pt ? " \u2014 \uCD5C\uC2E0 \uD655\uBCF4 \uC9C0\uC810 " + pt.value.toLocaleString() + " (" + fmtPtDate(pt) + ")" : " \u2014 \uC2DC\uC138 \uC9C0\uC810 \uC5C6\uC74C");
            if (u.rule_note) b.textContent += " " + u.rule_note;
          }
          if (u.rule === "price" || u.rule === "fxaccrual" || u.rule === "fxprice") {
            const pt = holdingPricePoint(u.product, state.month);
            if (u.rule === "fxprice") {
              const fxptA = priceAt("fx", state.month);
              const ageOf = (p) => {
                const a = Math.round((Date.parse(effDate + "T00:00:00Z") - Date.parse(p.date + "T00:00:00Z")) / 864e5);
                return Number.isFinite(a) && a > 0 ? a : 0;
              };
              if (pt && fxptA) b.textContent += " \xB7 \uC2DC\uC138 \uC9C0\uC810\uC740 \uD310\uB2E8\uC77C " + ageOf(pt) + "\uC77C \uC804, \uD658\uC728 \uC9C0\uC810\uC740 " + ageOf(fxptA) + "\uC77C \uC804 \uC790\uB8CC \xB7 \uB458 \uB2E4 \uB2F9\uC77C \uAC70\uB798\uAC00 \uC544\uB2D8";
              else if (pt) b.textContent += " \xB7 " + priceAgeNote(pt);
            } else {
              if (pt) b.textContent += " \xB7 " + priceAgeNote(pt);
            }
            const gn = priceGapNote(u);
            if (gn) b.textContent += " \xB7 " + gn;
          }
          if (u.tradable === false || u.rule === "unpriced") {
            b.textContent += " \xB7 " + (u.rule_note && u.rule === "unpriced" ? "" : "\uC2DC\uC5F0 \uBBF8\uC9C0\uC6D0");
            b.disabled = true;
          } else if ((u.rule === "price" || u.rule === "fxaccrual") && !holdingPricePoint(u.product, state.month)) {
            b.disabled = true;
          } else if (u.rule === "fxprice" && (!holdingPricePoint(u.product, state.month) || !priceAt("fx", state.month))) {
            b.disabled = true;
          }
          b.onclick = () => {
            if (!productAvailable(u)) return;
            const pt = holdingPricePoint(u.product, state.month);
            pending.product = u.product;
            pending.price = pt ? pt.value : null;
            pending.priceDate = pt ? pt.date : null;
            pending.rule = u.rule || "price";
            pending.step = state.holdings[u.product] ? "direction" : "weight";
            pending.direction = "buy";
            render();
          };
          box.appendChild(b);
          if (u.product === "fx" || u.product === "usdeposit") {
            const note = document.createElement("p");
            note.className = "note";
            note.textContent = productAccessDisplayNote(u);
            box.appendChild(note);
          }
        });
        const cancel = document.createElement("button");
        cancel.textContent = "\uCDE8\uC18C (\uB3CC\uC544\uAC00\uAE30)";
        cancel.onclick = () => {
          pending = null;
          render();
        };
        box.appendChild(cancel);
      } else if (pending.step === "direction") {
        const u = productRule(pending.product);
        const h = state.holdings[pending.product];
        const cur = holdingValue(pending.product, h, state.month);
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uD3EC\uC9C0\uC158 \uC870\uC815 1/2</div><h2>" + esc(u.name || pending.product) + "</h2><p>\uD604\uC7AC \uC2DC\uC5F0 \uD3C9\uAC00 " + cur.toLocaleString() + "\uC6D0(\uAD00\uCE21\xB7\uD3C9\uAC00 \uAE30\uC900\uC77C " + effDate + (effPostClose ? ", \uC7A5 \uB9C8\uAC10 \uD6C4" : "") + "). " + (u.rule === "accrual" ? "\uC774 \uC774\uC790 \uB204\uC801 \uC2DC\uC5F0 \uC0C1\uD488\uC740 \uC2E4\uD589 \uC2DC \uBC14\uB85C \uC608\uCE58\xB7\uD574\uC9C0\uD574\uC694. \uC6D4 \uC774\uC790\uB294 \uAC8C\uC784\uC758 \uB2EC\uC774 \uC9C4\uD589\uB420 \uB54C\uB9CC \uBC18\uC601\uB3FC\uC694. \uC2E4\uC81C \uACC4\uC57D\xB7\uC218\uC775\uB960\uC744 \uC7AC\uD604\uD55C \uAC83\uC740 \uC544\uB2C8\uC5D0\uC694." : pending.reserveOnly ? "\uC608\uC57D \uC8FC\uBB38\uC740 \uC811\uC218\uB9CC \uB3FC\uC694. \uB2E4\uAC00\uC624\uB294 \uBD84\uAE30 \uC815\uC0B0(" + pending.settleMonth + ")\uC774 \uB05D\uB09C \uB4A4 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810\uC73C\uB85C \uCCB4\uACB0\uB3FC\uC694. \uADF8 \uAC00\uACA9\uC740 \uC9C0\uAE08 \uC54C \uC218 \uC5C6\uACE0, \uC801\uACA9 \uAD00\uCE21\uC774 \uC5C6\uC73C\uBA74 \uCCB4\uACB0\uB418\uC9C0 \uC54A\uC740 \uCC44 \uBBF8\uCCB4\uACB0\uB85C \uB0A8\uC544 \uC778\uC0DD \uACB0\uC0B0 \uB54C \uCDE8\uC18C \uBC18\uD658\uB3FC\uC694. \uC815\uC0B0 \uC804\uAE4C\uC9C0 \uB300\uAE30 \uC8FC\uBB38\uC5D0\uC11C \uCDE8\uC18C\uD558\uBA74 \uC608\uC57D\uAE08\xB7\uC7A0\uAE08 \uC218\uB7C9\uC774 \uADF8\uB300\uB85C \uB3CC\uC544\uC640\uC694. \uD76C\uC18C\uC790\uB8CC \uAE30\uBC18 \uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615\uC774\uBA70 \uC815\uC2DD \uB9E4\uB9E4 \uC7AC\uD604\uC740 \uC544\uB2C8\uC5D0\uC694." : "\uC8FC\uBB38\uC740 \uC811\uC218\uB9CC \uB418\uACE0, \uCCB4\uACB0\uC740 \uC774\uD6C4 \uC9C4\uD589 \uC911 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810\uC73C\uB85C \uC9D1\uD589\uB3FC\uC694. \uD76C\uC18C\uC790\uB8CC \uAE30\uBC18 \uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615\uC774\uBA70 \uC815\uC2DD \uB9E4\uB9E4 \uC7AC\uD604\uC740 \uC544\uB2C8\uC5D0\uC694. \uB2F9\uC2DC \uC2E4\uC81C \uCCB4\uACB0\uAC00\uC640\uB294 \uAD6C\uBD84\uB3FC\uC694.") + "</p>";
        const buy = document.createElement("button");
        buy.textContent = "\uB9E4\uC218 (\uBE44\uC911 \uB298\uB9AC\uAE30)";
        buy.onclick = () => {
          pending.direction = "buy";
          pending.step = "weight";
          render();
        };
        box.appendChild(buy);
        const sell = document.createElement("button");
        sell.textContent = "\uC77C\uBD80 \uB9E4\uB3C4 (\uBE44\uC911 \uC904\uC774\uAE30)";
        sell.onclick = () => {
          pending.direction = "sell";
          pending.step = "weight";
          render();
        };
        box.appendChild(sell);
        const cancel = document.createElement("button");
        cancel.textContent = "\uCDE8\uC18C (\uB3CC\uC544\uAC00\uAE30)";
        cancel.onclick = () => {
          pending = null;
          render();
        };
        box.appendChild(cancel);
      } else if (pending.step === "weight") {
        let conditionInputValid = function() {
          const cb = document.getElementById("cond-on"), num = document.getElementById("cond-val");
          return !cb || !cb.checked || !!(num && num.value.trim() && !num.validity.badInput && Number.isFinite(Number(num.value)) && Number(num.value) > 0);
        }, updatePreview = function() {
          wv.textContent = slider.value + "%";
          const lp = tradeLiquidityPreview(slider.value), money = (n) => n.toLocaleString() + "\uC6D0", qty = (n) => n.toLocaleString("ko-KR", { maximumSignificantDigits: 8 });
          liquidity.textContent = "";
          if (lp) {
            liquidity.dataset.kind = lp.kind;
            liquidity.dataset.amount = String(lp.amount ?? "");
            liquidity.dataset.cashAfter = String(lp.cashAfter);
            liquidity.dataset.qty = String(lp.qty ?? "");
            liquidity.dataset.reserveAfter = String(lp.reserveAfter ?? "");
            const title = document.createElement("strong");
            title.textContent = "\uC774\uBC88 \uC8FC\uBB38 \uC811\uC218 \uC9C1\uD6C4 [\uC6D4 \uC9C4\uD589 \uC804]";
            liquidity.appendChild(title);
            const line2 = document.createElement("p");
            line2.textContent = lp.kind === "buy-reserve" ? "\uC774\uBC88 \uB9E4\uC218 \uC608\uC57D " + money(lp.amount) + " \xB7 \uB0A8\uB294 \uD604\uAE08 " + money(lp.cashAfter) + ". \uAE30\uC874 \uBBF8\uCCB4\uACB0 \uB9E4\uC218\uC608\uC57D " + money(lp.existingBuyReserve) + "\uC640 \uD569\uCCD0 \uCD1D " + money(lp.reserveAfter) + "\uC774 \uC7A0\uAE41\uB2C8\uB2E4." : lp.kind === "deposit" ? "\uC774\uBC88 \uC608\uCE58 " + money(lp.amount) + " \xB7 \uB0A8\uB294 \uD604\uAE08 " + money(lp.cashAfter) + ". \uAE30\uC874 \uBBF8\uCCB4\uACB0 \uB9E4\uC218\uC608\uC57D " + money(lp.existingBuyReserve) + "\uC740 \uBCC4\uB3C4\uC785\uB2C8\uB2E4." : lp.kind === "sell-lock" ? "\uC774\uBC88 \uB9E4\uB3C4\uC5D0 \uC7A0\uAE00 \uC2DC\uC5F0 \uC218\uB7C9 \uC57D " + qty(lp.qty) + " \xB7 \uC8FC\uBB38\uC5D0 \uBB36\uC774\uC9C0 \uC54A\uACE0 \uB0A8\uB294 \uC218\uB7C9 \uC57D " + qty(lp.qtyAfter) + ". \uC811\uC218\uB9CC\uC73C\uB85C \uD604\uAE08 " + money(lp.cashAfter) + "\uC740 \uB298\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uB9E4\uB3C4\uB300\uAE08\uC740 \uC774\uD6C4 \uC801\uACA9 \uAD00\uCE21\uC5D0\uC11C \uACB0\uC815\uB429\uB2C8\uB2E4." : "\uC774\uBC88 \uD574\uC9C0\uB85C \uD604\uAE08 " + money(lp.amount) + " \uC99D\uAC00 \xB7 \uD574\uC9C0 \uC9C1\uD6C4 \uD604\uAE08 " + money(lp.cashAfter) + ".";
            liquidity.appendChild(line2);
            const note = document.createElement("p");
            note.textContent = "\uD604\uC7AC \uC790\uAE08\uC758 \uC774\uB3D9\uB9CC \uBCF4\uC5EC\uC90D\uB2C8\uB2E4. \uC774\uC5B4\uC9C0\uB294 \uC6D4 \uC9C4\uD589\uC5D0\uC11C \uC21C\uC800\uCD95\xB7\uC774\uC790\xB7\uC801\uACA9 \uCCB4\uACB0\uC774 \uB354\uD574\uC9C8 \uC218 \uC788\uC73C\uBA70, \uBBF8\uB798 \uAC00\uACA9\xB7\uC218\uC775\xB7\uCCB4\uACB0\uC2DC\uC810\uC740 \uC608\uCE21\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
            liquidity.appendChild(note);
          }
          const mInfo = marketSizeOf(pending.product, state.month);
          const amount = Math.round(base * slider.value / 100);
          let impact = 0, mode = "";
          if (mInfo && mInfo.size && amount > 0) {
            if (isSell) {
              impact = amount / mInfo.size * CHAOS.sellImpactFactor * chaosWeight(pending.product);
              mode = foreignFundScaleActive() && ["spy", "fxi"].includes(pending.product) ? "\uCCB4\uACB0 \uC2DC \uC9D1\uC911\uB3C4 \uAC8C\uC784\uAC00\uC0B0" : "\uCCB4\uACB0 \uC2DC \uCDA9\uACA9";
            } else {
              impact = amount / mInfo.size * CHAOS.scaleFactor * chaosWeight(pending.product);
              mode = foreignFundScaleActive() && ["spy", "fxi"].includes(pending.product) ? "\uC6D4 \uC9D1\uC911\uB3C4 \uAC8C\uC784\uAC00\uC0B0" : "\uC6D4 \uB204\uC801 \uC99D\uAC00";
            }
          }
          const proj = state.chaos + (isSell ? impact : 0);
          let line;
          if (!mInfo && ["spy", "fxi"].includes(pending.product)) {
            line = "\uB2F9\uC2DC \uACF5\uAC1C\uB41C \uC2DC\uC7A5\uADDC\uBAA8 \uADFC\uAC70 \uBBF8\uD655\uC778 \xB7 \uCE74\uC624\uC2A4 \uC0B0\uC815 \uBCF4\uB958. \uC548\uC804\uC790\uAE08\uC774\uB77C\uB294 \uB73B\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uD604\uC7AC \uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + "/100.";
          } else if (!mInfo) {
            line = "\uC774 \uC0C1\uD488\uC740 \uCE74\uC624\uC2A4 \uC0B0\uC815 \uB300\uC0C1\uC774 \uC544\uB2C8\uC5D0\uC694 (\uC548\uC804\uC790\uAE08 [\uC124\uACC4 \uC81C\uC548]). \uD604\uC7AC \uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + "/100.";
          } else if (!mInfo.size) {
            line = mInfo.label + ". \uD604\uC7AC \uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + "/100.";
          } else {
            line = "\uC774 \uC8FC\uBB38\uC758 \uC608\uC0C1 \uCE74\uC624\uC2A4 \uC601\uD5A5: " + mode + " +" + impact.toFixed(2) + " [\uC124\uACC4 \uC81C\uC548 \uC218\uCE58 \xB7 \uC2DC\uC7A5\uADDC\uBAA8 " + mInfo.label + "]. \uD604\uC7AC " + state.chaos.toFixed(1) + "/100";
            if (isSell) line += " \u2192 \uCDA9\uACA9 \uBC18\uC601 \uC2DC " + proj.toFixed(1);
            else line += " (\uB204\uC801\uC740 \uC6D4 \uC815\uC0B0 \uC2DC \uBC18\uC601)";
            line += ".";
          }
          if (mInfo && mInfo.size && isFinite(mInfo.size) && amount > 0) {
            const splitEl = document.getElementById("split-n");
            const sn = splitEl ? Number(splitEl.value) : 1;
            const splitN = Number.isInteger(sn) && sn > 1 ? sn : 1;
            const tr = chaosTrajectory({
              sellImpactNow: isSell ? impact : 0,
              reduceProduct: isSell ? pending.product : null,
              reduceValue: isSell ? amount : 0,
              buyPerMonth: isSell ? 0 : amount / splitN,
              buyMonths: isSell ? 0 : splitN,
              buySize: mInfo.size
            });
            const base12 = chaosTrajectory(null).points[12].chaos;
            const fmtM = function(o) {
              return "+" + o.m + "\uAC1C\uC6D4 " + o.chaos.toFixed(1);
            };
            line += " \uACC4\uD68D \uADA4\uC801 [\uD604\uC7AC \uC9C0\uC810 \uAC00\uACA9\xB7\uC2DC\uC7A5\uADDC\uBAA8 \uACE0\uC815 \uAC00\uC815 \xB7 \uB9E4\uC218 \uC6D4 1\uD68C \uCCB4\uACB0 \uAC00\uC815 \xB7 \uBBF8\uB798 \uAC00\uACA9 \uC608\uCE21 \uC544\uB2D8 \xB7 \uC124\uACC4 \uC81C\uC548 \uC218\uCE58]: " + fmtM(tr.points[3]) + " \u2192 " + fmtM(tr.points[6]) + " \u2192 " + fmtM(tr.points[12]) + "/100" + (tr.overMonth !== null ? tr.overMonth === 0 ? " \xB7 \uD604\uC7AC \uC774\uBBF8 \uD55C\uACC4 100 \uC774\uC0C1(\uAC00\uC815)" : " \xB7 \uD55C\uACC4 100 \uB3C4\uB2EC \uAC00\uC815 +" + tr.overMonth + "\uAC1C\uC6D4" : tr.warnMonth !== null ? tr.warnMonth === 0 ? " \xB7 \uD604\uC7AC \uC774\uBBF8 \uC8FC\uC758 70 \uC774\uC0C1(\uAC00\uC815)" : " \xB7 \uC8FC\uC758 70 \uB3C4\uB2EC \uAC00\uC815 +" + tr.warnMonth + "\uAC1C\uC6D4" : " \xB7 12\uAC1C\uC6D4 \uAC00\uC815 \uB0B4 \uC8FC\uC758 70 \uBBF8\uB3C4\uB2EC") + ". \uC774 \uC8FC\uBB38 \uC5C6\uC774 \uD604 \uBCF4\uC720 \uC720\uC9C0 \uC2DC +12\uAC1C\uC6D4 " + base12.toFixed(1) + "(\uAC00\uC815).";
          }
          if (proj >= CHAOS.overAt) {
            line += " \uC704\uD5D8: \uC774 \uC8FC\uBB38\uC73C\uB85C \uCE74\uC624\uC2A4\uAC00 \uD55C\uACC4\uB97C \uB118\uC5B4 \uC5ED\uC0AC\uAC00 \uBC14\uB01D\uB2C8\uB2E4.";
            go.textContent = "\uC704\uD5D8\uC744 \uC54C\uACE0 \uC2E4\uD589";
          } else if (proj >= CHAOS.warnAt || state.chaos >= CHAOS.warnAt) {
            line += " \uC8FC\uC758: \uC784\uACC4(100)\uC5D0 \uAC00\uAE4C\uC6CC\uC694.";
            go.textContent = "\uC8FC\uC758\uB97C \uD655\uC778\uD558\uACE0 \uC2E4\uD589";
          } else {
            go.textContent = "\uC2E4\uD589";
          }
          if (!isSell && GAME_LIVING && state.gameLivingTrack === "job") line += " \uCDE8\uC5C5 \uAC08\uB798 \uD22C\uC790 \uC0C1\uD55C [\uAC8C\uC784 \uADDC\uCE59]: \uAC8C\uC784 \uC720\uC785(\uC2DC\uC791 \uC790\uAE08+\uBC1B\uC740 \uC6D4\uAE09)\uC758 30%\uC5D0\uC11C \uC774\uBBF8 \uD22C\uC790\uD55C \uC6D0\uAC00\uC640 \uBBF8\uCCB4\uACB0 \uB9E4\uC218 \uC608\uC57D\uC744 \uBE80 \uB9CC\uD07C\uB9CC \uD22C\uC790\uD560 \uC218 \uC788\uC5B4 \uC774\uBC88\uC5D0 \uC6C0\uC9C1\uC77C \uC218 \uC788\uB294 \uC0C1\uD55C\uC740 " + base.toLocaleString() + "\uC6D0\uC785\uB2C8\uB2E4.";
          prev.textContent = line;
          go.disabled = Math.round(base * Number(slider.value) / 100) <= 0;
          if (go.disabled) go.textContent = "\uC6C0\uC9C1\uC77C \uAE08\uC561\uC774 \uC5C6\uC2B5\uB2C8\uB2E4";
          const valid = conditionInputValid(), num = document.getElementById("cond-val"), error = document.getElementById("condition-error");
          if (num) num.setAttribute("aria-invalid", valid ? "false" : "true");
          if (error) {
            error.hidden = valid;
            error.textContent = valid ? "" : "\uC870\uAC74\uAC12\uC7400\uBCF4\uB2E4 \uD070 \uC720\uD55C\uD55C \uC22B\uC790\uB85C \uC785\uB825\uD558\uC138\uC694. \uC870\uAC74\uC744 \uB044\uAE30 \uC804\uC5D0\uB294 \uC77C\uBC18\uC8FC\uBB38\uC73C\uB85C \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
          }
          if (!valid) {
            go.disabled = true;
            go.textContent = "\uC870\uAC74\uAC12\uC744 \uD655\uC778\uD558\uC138\uC694";
          }
          if (!isSell && careerCashBuyHoldOn() && careerCashUnpaid() > 0) {
            go.disabled = true;
            go.textContent = "\uBBF8\uB0A9 " + careerCashUnpaid().toLocaleString() + "\uC6D0 \u2014 \uC0C1\uD658 \uD6C4 \uB9E4\uC218 \uAC00\uB2A5";
            prev.textContent = line + " \uBBF8\uB0A9\uC774 \uC788\uB294 \uB3D9\uC548 \uC0C8 \uB9E4\uC218 \uC8FC\uBB38\uC740 \uC811\uC218\uD558\uC9C0 \uC54A\uACE0, \uBBF8\uB9AC \uB123\uC740 \uB9E4\uC218 \uC8FC\uBB38\uC758 \uCCB4\uACB0\uB3C4 \uBCF4\uB958\uD569\uB2C8\uB2E4 [\uC124\uACC4 \uADDC\uCE59 \xB7 \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C \uC5C6\uC74C]. \uC790\uC0B0\uD45C\uC758 \uBBF8\uB0A9 \uC0C1\uD658\uC73C\uB85C \uBA3C\uC800 \uAC1A\uC73C\uC138\uC694. \uC720\uC9C0\xB7\uB9E4\uB3C4\xB7\uBBF8\uCCB4\uACB0 \uCDE8\uC18C\uB294 \uADF8\uB300\uB85C \uAC00\uB2A5\uD569\uB2C8\uB2E4.";
          }
        };
        const isSell = pending.direction === "sell";
        const h0 = state.holdings[pending.product];
        const base = isSell ? holdingValue(pending.product, h0, state.month) : Math.min(state.cash, gameLivingInvestCap());
        card.innerHTML = '<div class="date">' + state.month + " \xB7 \uD3EC\uC9C0\uC158 \uC870\uC815 2/2</div><h2>\uBE44\uC911 \uACB0\uC815</h2><p>" + (isSell ? "\uBCF4\uC720 \uC2DC\uC5F0 \uD3C9\uAC00 " + base.toLocaleString() + "\uC6D0 \uC911 \uC5BC\uB9C8\uB97C \uC904\uC77C\uAE4C\uC694?" : "\uD604\uAE08 " + base.toLocaleString() + "\uC6D0 \uC911 \uC5BC\uB9C8\uB97C \uC6C0\uC9C1\uC77C\uAE4C\uC694?") + '</p><p class="note">\uAD00\uCE21\xB7\uD3C9\uAC00 \uAE30\uC900\uC77C ' + effDate + (effPostClose ? "(\uC7A5 \uB9C8\uAC10 \uD6C4)" : "") + ". " + (pending.rule === "accrual" ? "\uC774 \uC774\uC790 \uB204\uC801 \uC2DC\uC5F0 \uC0C1\uD488\uC740 \uC2E4\uD589 \uC2DC \uBC14\uB85C \uC608\uCE58\xB7\uD574\uC9C0\uD574\uC694. \uC6D4 \uC774\uC790\uB294 \uB2EC\uC774 \uC9C4\uD589\uB420 \uB54C\uB9CC \uBC18\uC601\uB3FC\uC694. \uC2E4\uC81C \uACC4\uC57D\xB7\uC218\uC775\uB960 \uC7AC\uD604\uC740 \uC544\uB2C8\uC5D0\uC694." : pending.reserveOnly ? "\uC608\uC57D \uC8FC\uBB38\uC740 \uC811\uC218\uB9CC \uB3FC\uC694. \uB2E4\uAC00\uC624\uB294 \uBD84\uAE30 \uC815\uC0B0(" + pending.settleMonth + ")\uC774 \uB05D\uB09C \uB4A4 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810\uC73C\uB85C \uCCB4\uACB0\uB3FC\uC694. \uADF8 \uAC00\uACA9\uC740 \uC9C0\uAE08 \uC54C \uC218 \uC5C6\uACE0, \uC801\uACA9 \uAD00\uCE21\uC774 \uC5C6\uC73C\uBA74 \uCCB4\uACB0\uB418\uC9C0 \uC54A\uC740 \uCC44 \uBBF8\uCCB4\uACB0\uB85C \uB0A8\uC544 \uC778\uC0DD \uACB0\uC0B0 \uB54C \uCDE8\uC18C \uBC18\uD658\uB3FC\uC694. \uC815\uC0B0 \uC804\uAE4C\uC9C0 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uB300\uAE30 \uC8FC\uBB38\uC5D0\uC11C \uCDE8\uC18C\uD558\uBA74 \uC608\uC57D\uAE08\xB7\uC7A0\uAE08 \uC218\uB7C9\uC774 \uADF8\uB300\uB85C \uB3CC\uC544\uC640\uC694." : "\uC8FC\uBB38 \uC811\uC218 \uD6C4 \uCCB4\uACB0\uC740 \uC774\uD6C4 \uC9C4\uD589 \uC911 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810\uC73C\uB85C \uC9D1\uD589\uB3FC\uC694. \uD76C\uC18C\uC790\uB8CC \uAE30\uBC18 \uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615\uC774\uBA70 \uC815\uC2DD \uB9E4\uB9E4 \uC7AC\uD604\uC740 \uC544\uB2C8\uC5D0\uC694. \uB300\uAE30 \uC8FC\uBB38\uC740 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC5D0\uC11C \uCDE8\uC18C\uD560 \uC218 \uC788\uC5B4\uC694.") + '</p><p><input type="range" id="w" min="10" max="' + (!isSell && militaryActive() ? "30" : "100") + '" step="10" value="' + (!isSell && militaryActive() ? "30" : "50") + '" style="width:100%"> <span id="wv">' + (!isSell && militaryActive() ? "30" : "50") + "%</span></p>";
        if (pending.rule === "price" || pending.rule === "fxaccrual") {
          const pt = holdingPricePoint(pending.product, state.month);
          if (pt) {
            const freshness = document.createElement("p");
            freshness.className = "note";
            freshness.textContent = "\uAC00\uACA9 \uC790\uB8CC: " + fmtPtDate(pt) + " \xB7 " + priceAgeNote(pt) + ". \uCCB4\uACB0\uC740 \uC774\uD6C4 \uC9C4\uD589 \uC911 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC9C0\uC810\uC73C\uB85C \uCC98\uB9AC\uD558\uB294 \uC2DC\uC5F0 \uBAA8\uD615\uC774\uC5D0\uC694.";
            card.appendChild(freshness);
          }
        }
        if (fulltimeActive() && pending.rule === "price" && !pending.reserveOnly) {
          const condWrap = document.createElement("p");
          condWrap.className = "note";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.id = "cond-on";
          const num = document.createElement("input");
          num.type = "number";
          num.id = "cond-val";
          num.min = "0";
          num.step = "any";
          num.placeholder = isSell ? "\uC608: 1200" : "\uC608: 800";
          num.style.cssText = state.directionConditionRules === 1 ? "box-sizing:border-box;width:100%;min-height:44px;font-size:14px;padding:8px;" : "width:110px;font-size:14px;padding:4px;";
          if (state.directionConditionRules === 1) num.setAttribute("aria-label", "\uC870\uAC74 \uAE30\uC900\uAC12");
          num.disabled = true;
          cb.onchange = () => {
            num.disabled = !cb.checked;
            updatePreview();
          };
          num.oninput = () => updatePreview();
          num.setAttribute("aria-describedby", "condition-error");
          condWrap.appendChild(cb);
          condWrap.appendChild(document.createTextNode(" \uC870\uAC74 \uC8FC\uBB38(\uC804\uC5C5 \uC2DC\uD5D8): \uC774\uD6C4 \uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC774 "));
          condWrap.appendChild(num);
          if (state.directionConditionRules === 1) {
            const dir = document.createElement("select");
            dir.id = "condition-direction";
            dir.setAttribute("aria-label", "\uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC758 \uC870\uAC74 \uBC29\uD5A5");
            dir.style.cssText = "max-width:100%;min-height:44px;margin:8px 0";
            for (const [v, t] of [["below", isSell ? "\uAE30\uC900\uAC12 \uC774\uD558\uC77C \uB54C \uB9E4\uB3C4" : "\uAE30\uC900\uAC12 \uC774\uD558\uC77C \uB54C \uB9E4\uC218"], ["above", isSell ? "\uAE30\uC900\uAC12 \uC774\uC0C1\uC77C \uB54C \uB9E4\uB3C4" : "\uAE30\uC900\uAC12 \uC774\uC0C1\uC77C \uB54C \uB9E4\uC218"]]) {
              const op = document.createElement("option");
              op.value = v;
              op.textContent = t;
              dir.appendChild(op);
            }
            dir.value = isSell ? "above" : "below";
            condWrap.appendChild(dir);
            const detail = document.createElement("p");
            detail.className = "note condition-direction-note";
            detail.textContent = "\uC870\uAC74 \uBC29\uD5A5\uC744 \uC9C1\uC811 \uC120\uD0DD\uD569\uB2C8\uB2E4. \uD558\uB77D \uC9C0\uC810 \uB9E4\uB3C4\xB7\uC0C1\uC2B9 \uC9C0\uC810 \uB9E4\uC218\uB3C4 \uC774\uD6C4 \uD655\uBCF4 \uC9C0\uC810\uC5D0\uC11C\uB9CC \uD310\uC815\uD569\uB2C8\uB2E4. \uAE30\uC900\uAC12 \uD1B5\uACFC \uC21C\uAC04\uC744 \uAC10\uC2DC\uD558\uC9C0 \uC54A\uACE0 \uC911\uAC04 \uAC00\uACA9\uC744 \uAC74\uB108\uB6F8 \uC218 \uC788\uC5B4 \uC190\uC2E4\uC81C\uD55C\xB7\uCCB4\uACB0\uAC00\uACA9\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBD84\uD560\uC774\uBA74 \uC870\uAC74\uC744 \uCDA9\uC871\uD55C \uC0C8 \uC9C0\uC810\uC5D0\uC11C \uD55C \uD68C\uBD84\uB9CC \uC9D1\uD589\uD569\uB2C8\uB2E4 [\uC0C8 \uD68C\uADC0 \uC2DC\uD5D8\uADDC\uCE59].";
            condWrap.appendChild(detail);
          } else condWrap.appendChild(document.createTextNode((isSell ? " \uC774\uC0C1" : " \uC774\uD558") + "\uC77C \uB54C\uB9CC " + (isSell ? "\uB9E4\uB3C4" : "\uB9E4\uC218")));
          const condNote = document.createElement("p");
          condNote.className = "note";
          condNote.textContent = "\uC870\uAC74\uC774 \uCDA9\uC871\uB41C \uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC758 \uAC00\uACA9\uC73C\uB85C \uCCB4\uACB0\uB3FC\uC694(\uC870\uAC74\uAC12\uC740 \uCCB4\uACB0\uAC00 \uBCF4\uC7A5\uC774 \uC544\uB2D8). \uBBF8\uCDA9\uC871\uC774\uBA74 \uACC4\uC18D \uB300\uAE30\uD558\uACE0 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC5D0\uC11C \uCDE8\uC18C\uD558\uBA74 \uC608\uC57D\uAE08\xB7\uC7A0\uAE08 \uC218\uB7C9\uC774 \uB3CC\uC544\uC640\uC694. \uC778\uC0DD \uACB0\uC0B0 \uC2DC \uBBF8\uCCB4\uACB0\uC740 \uCDE8\uC18C \uBC18\uD658\uB3FC\uC694. \uD655\uBCF4 \uC9C0\uC810\uC740 \uC2E4\uC81C \uC2DC\uC7A5\uC758 \uB9E4 \uC21C\uAC04 \uAC00\uACA9\uC774 \uC544\uB2C8\uB77C \uC218\uC9D1\uB41C \uC790\uB8CC \uC9C0\uC810\uC774\uC5D0\uC694 [\uC2DC\uC5F0 \uBAA8\uD615].";
          card.appendChild(condWrap);
          card.appendChild(condNote);
          const condError = document.createElement("p");
          condError.id = "condition-error";
          condError.className = "note";
          condError.style.cssText = "color:#8b2924;background:#fff1ef;padding:8px;border-radius:6px;";
          condError.hidden = true;
          condError.setAttribute("role", "alert");
          card.appendChild(condError);
          const splitWrap = document.createElement("p");
          splitWrap.className = "note";
          const sel = document.createElement("select");
          sel.id = "split-n";
          sel.style.cssText = "font-size:14px;padding:4px;";
          [[1, "\uB098\uB204\uC9C0 \uC54A\uC74C(\uAE30\uBCF8)"], [2, "2\uD68C \uBD84\uD560"], [3, "3\uD68C \uBD84\uD560"], [4, "4\uD68C \uBD84\uD560"]].forEach(function(opt) {
            const o = document.createElement("option");
            o.value = String(opt[0]);
            o.textContent = opt[1];
            sel.appendChild(o);
          });
          splitWrap.appendChild(sel);
          splitWrap.appendChild(document.createTextNode(" \u2014 \uC774\uD6C4 \uC0C8 \uD655\uBCF4 \uC9C0\uC810\uB9C8\uB2E4 1\uD68C\uBD84\uC529\uB9CC \uCCB4\uACB0(\uAC19\uC740 \uC9C0\uC810 \uC911\uBCF5 \uCCB4\uACB0 \uC5C6\uC74C). \uC870\uAC74 \uC8FC\uBB38\uACFC \uD568\uAED8 \uC4F0\uBA74 \uC870\uAC74 \uCDA9\uC871 \uC9C0\uC810\uC5D0\uC11C\uB9CC 1\uD68C\uBD84\uC529. \uC218\uC775 \uBCF4\uC7A5\uC774 \uC544\uB2C8\uB77C \uC9D1\uD589 \uBD84\uC0B0\uC774\uC5D0\uC694 [\uC2DC\uC5F0 \uBAA8\uD615]."));
          card.appendChild(splitWrap);
          if (!isSell) {
            const expiryLabel = document.createElement("label");
            expiryLabel.htmlFor = "order-expiry";
            expiryLabel.textContent = "\uAE30\uB2E4\uB9B4 \uAE30\uAC04 [\uC804\uC5C5 \uB9E4\uC218 \uC2DC\uD5D8\uADDC\uCE59] ";
            const expirySelect = document.createElement("select");
            expirySelect.id = "order-expiry";
            [[0, "\uAE30\uD55C \uC5C6\uC74C (\uAE30\uC874 \uADDC\uCE59)"], [3, "3\uAC1C\uC6D4 \uB4A4 \uC6D4\uCD08 \uC790\uB3D9 \uCDE8\uC18C"], [12, "12\uAC1C\uC6D4 \uB4A4 \uC6D4\uCD08 \uC790\uB3D9 \uCDE8\uC18C"]].forEach(([v, t]) => {
              const opt = document.createElement("option");
              opt.value = String(v);
              opt.textContent = t;
              expirySelect.appendChild(opt);
            });
            expiryLabel.appendChild(expirySelect);
            card.appendChild(expiryLabel);
            const expiryNote = document.createElement("p");
            expiryNote.id = "order-expiry-note";
            expiryNote.className = "note";
            const expiryPreview = () => {
              const n = Number(expirySelect.value);
              expiryNote.textContent = n ? addMonths(state.month, n) + "-01\uBD80\uD130 \uBBF8\uCCB4\uACB0 \uB9E4\uC218\uBD84\uC744 \uC790\uB3D9 \uCDE8\uC18C\uD574 \uB0A8\uC740 \uC608\uC57D\uAE08\uB9CC \uB3CC\uB824\uC90D\uB2C8\uB2E4. \uB9CC\uB8CC\uC6D4\uC5D0\uB294 \uC0C8 \uAD00\uCE21\uC774 \uC788\uC5B4\uB3C4 \uB354 \uCCB4\uACB0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC774\uBBF8 \uCCB4\uACB0\uD55C \uBD84\uC740 \uBCF4\uC720\uD569\uB2C8\uB2E4. \uAE30\uB2E4\uB9B4 \uAE30\uD68C\uC640 \uB2E4\uB978 \uD22C\uC790\uC5D0 \uC4F8 \uD604\uAE08\uC744 \uB9DE\uBC14\uAFB8\uB294 \uC120\uD0DD\uC774\uBA70 \uC218\uC775 \uBCF4\uC7A5\uC774 \uC544\uB2D9\uB2C8\uB2E4." : "\uAE30\uD55C \uC5C6\uC774 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uC744 \uAE30\uB2E4\uB9BD\uB2C8\uB2E4. \uC870\uAC74\uC774 \uC548 \uB9DE\uAC70\uB098 \uC790\uB8CC\uAC00 \uC5C6\uC73C\uBA74 \uACC4\uC18D \uB300\uAE30\uD569\uB2C8\uB2E4. \uC911\uAC04\uC5D0 \uC9C1\uC811 \uCDE8\uC18C\uD560 \uC218 \uC788\uACE0 \uC778\uC0DD \uACB0\uC0B0 \uB54C \uBBF8\uCCB4\uACB0\uBD84\uC744 \uBC18\uD658\uD569\uB2C8\uB2E4.";
            };
            expirySelect.onchange = expiryPreview;
            expiryPreview();
            card.appendChild(expiryNote);
          }
        }
        const slider = document.getElementById("w");
        const wv = document.getElementById("wv");
        const prev = document.createElement("p");
        prev.className = "note";
        prev.id = "chaos-preview";
        card.appendChild(prev);
        const liquidity = document.createElement("div");
        liquidity.id = "order-liquidity-preview";
        liquidity.className = "note";
        liquidity.style.cssText = "padding:10px;background:#f1f3f6;border-radius:8px;margin-top:8px;";
        card.appendChild(liquidity);
        const go = document.createElement("button");
        go.id = "order-execute";
        slider.oninput = updatePreview;
        updatePreview();
        go.onclick = () => {
          if (!albaTimeAvailable()) {
            pending = null;
            render();
            return;
          }
          updatePreview();
          if (!conditionInputValid() || go.disabled || Math.round(base * Number(slider.value) / 100) <= 0) return;
          const p = pending;
          if (!productAvailable(productRule(p.product))) {
            pending = null;
            render();
            return;
          }
          if (p.direction !== "sell" && careerCashBuyHoldOn() && careerCashUnpaid() > 0) {
            render();
            return;
          }
          const condOn = document.getElementById("cond-on");
          if (condOn && condOn.checked) {
            const cv = Number(document.getElementById("cond-val").value);
            if (Number.isFinite(cv) && cv > 0) {
              const dir = document.getElementById("condition-direction");
              p.condition = { op: dir && ["above", "below"].includes(dir.value) ? dir.value : p.direction === "sell" ? "above" : "below", value: cv };
              if (dir) p.conditionRules = 1;
            }
          }
          const splitSel = document.getElementById("split-n");
          if (splitSel) {
            const sn = Number(splitSel.value);
            if (Number.isInteger(sn) && sn > 1) p.split = { n: sn, filled: 0 };
          }
          const expirySelect = document.getElementById("order-expiry");
          if (p.direction !== "sell" && expirySelect && [3, 12].includes(Number(expirySelect.value))) p.expiresAt = addMonths(state.month, Number(expirySelect.value));
          pending = null;
          if (p.conditionRules === 1 && p.condition) state.history.push({ month: state.month, decisionMonth: state.month, choice: "order-condition-new:" + p.product + ":" + p.condition.op + ":" + p.condition.value });
          if (p.direction === "sell") {
            const h = state.holdings[p.product];
            if (h) {
              const cur = holdingValue(p.product, h, state.month);
              const frac = slider.value / 100;
              const proceeds = Math.round(cur * frac);
              const u0 = productRule(p.product);
              if (u0.rule !== "accrual" && proceeds > 0) {
                const q = h.qty * frac;
                const pt0 = holdingPricePoint(p.product, state.month);
                const costBasis0 = h.invested != null ? Math.round(h.invested * frac) : Math.round(h.avgPrice * q);
                h.qty = h.qty - q;
                if (h.invested != null) h.invested = Math.round(h.invested * (1 - frac));
                const ap0 = h.avgPrice;
                if (h.qty <= 1e-12) delete state.holdings[p.product];
                state.pendingOrders = state.pendingOrders || [];
                state.pendingOrders.push({
                  id: "ord-" + state.turnCount + "-" + state.pendingOrders.length,
                  kind: "sell",
                  product: p.product,
                  qty: q,
                  avgPrice: ap0,
                  costBasis: costBasis0,
                  investedShare: h.invested != null ? costBasis0 : null,
                  placedMonth: state.month,
                  basePtDate: pt0 ? pt0.date : null,
                  ...p.reserveOnly ? reserveObsGate(p.settleMonth) : { obsCutoff: effDate, obsPostClose: effPostClose },
                  ...p.condition ? { condition: p.condition, ...p.conditionRules === 1 ? { conditionRules: 1 } : {} } : {},
                  ...p.split ? { split: p.split } : {},
                  ...p.reserveOnly ? { earliestFillMonth: p.settleMonth, reserve: "job-settlement" } : {}
                });
                state.lastTrade = { kind: "sell-order", product: p.product, month: state.month, proceeds: costBasis0, costBasis: costBasis0, pnl: 0, turn: state.turnCount };
                albaTimeConsume("sell");
                finishTurn(p.event, "sell-order:" + p.product + ":" + slider.value);
                return;
              }
              if (proceeds > 0) {
                const costBasis = h.invested != null ? Math.round(h.invested * frac) : Math.round(h.avgPrice * h.qty * frac);
                if (frac >= 1) {
                  delete state.holdings[p.product];
                } else {
                  h.qty = h.qty * (1 - frac);
                  if (h.invested != null) h.invested = Math.round(h.invested * (1 - frac));
                }
                state.cash += proceeds;
                const mSell = marketSizeOf(p.product, state.month);
                if (mSell && mSell.size) {
                  state.chaos = Math.round((state.chaos + proceeds / mSell.size * CHAOS.sellImpactFactor * chaosWeight(p.product)) * 10) / 10;
                  if (state.chaos >= CHAOS.overAt) state.flags.gameOver = "chaos";
                }
                albaTimeConsume("sell");
                state.lastTrade = {
                  kind: "sell",
                  product: p.product,
                  month: state.month,
                  proceeds,
                  costBasis,
                  pnl: proceeds - costBasis,
                  turn: state.turnCount
                };
              }
            }
            finishTurn(p.event, "sell:" + p.product + ":" + slider.value);
            return;
          }
          const amount = Math.round(state.cash * slider.value / 100);
          if (amount > 0 && (p.rule === "price" || p.rule === "fxaccrual" || p.rule === "fxprice")) {
            state.pendingOrders = state.pendingOrders || [];
            state.pendingOrders.push({
              id: "ord-" + state.turnCount + "-" + state.pendingOrders.length,
              kind: "buy",
              product: p.product,
              amount,
              placedMonth: state.month,
              basePtDate: p.priceDate || null,
              ...p.reserveOnly ? reserveObsGate(p.settleMonth) : { obsCutoff: effDate, obsPostClose: effPostClose },
              ...p.expiresAt ? { expiresAt: p.expiresAt } : {},
              ...p.condition ? { condition: p.condition, ...p.conditionRules === 1 ? { conditionRules: 1 } : {} } : {},
              ...p.split ? { split: p.split } : {},
              ...p.reserveOnly ? { earliestFillMonth: p.settleMonth, reserve: "job-settlement" } : {}
            });
            state.cash -= amount;
            if (p.expiresAt) state.history.push({ month: state.month, decisionMonth: state.month, choice: "order-deadline:" + p.product + ":" + p.expiresAt, expiresAt: p.expiresAt, amount });
            state.lastTrade = { kind: "buy-order", product: p.product, month: state.month, proceeds: amount, costBasis: amount, pnl: 0, turn: state.turnCount };
            albaTimeConsume("buy");
            finishTurn(p.event, "enter-order:" + p.product + ":" + slider.value);
            return;
          }
          if (amount > 0 && p.rule === "accrual") {
            const h = state.holdings[p.product] || { qty: 0, avgPrice: 0, entryMonth: state.month };
            h.qty = h.qty + amount;
            h.avgPrice = 1;
            h.invested = (h.invested || 0) + amount;
            if (!h.entryMonth) h.entryMonth = state.month;
            state.holdings[p.product] = h;
            state.cash -= amount;
            state.lastTrade = { kind: "buy", product: p.product, month: state.month, proceeds: amount, costBasis: amount, pnl: 0, turn: state.turnCount };
          }
          if (amount > 0 && p.rule === "accrual") albaTimeConsume("buy");
          finishTurn(p.event, "enter:" + p.product + ":" + slider.value);
        };
        if (albaTimeLimited()) {
          const note = document.createElement("p");
          note.className = "note alba-time-confirm";
          note.textContent = "\uD655\uC815\uD558\uBA74 " + state.month + " \uC54C\uBC14 \uC218\uB3D9 \uD22C\uC790 \uD310\uB2E81\uD68C\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uAC19\uC740 \uB2EC \uC0C8 \uB9E4\uC218\xB7\uB9E4\uB3C4\xB7\uC870\uAC74/\uAE30\uD55C \uBCC0\uACBD\uC740 \uB354 \uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC785\uB825 \uCDE8\uC18C\uB294 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 [\uAC8C\uC784\uADDC\uCE59].";
          card.append(note);
        }
        box.appendChild(go);
        const cancel = document.createElement("button");
        cancel.textContent = "\uCDE8\uC18C (\uB3CC\uC544\uAC00\uAE30)";
        cancel.onclick = () => {
          pending = null;
          render();
        };
        box.appendChild(cancel);
      }
    }
    function choose(id, turn) {
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      if (turn && turn.kind === "life" && !id.startsWith("life:")) {
        render();
        return;
      }
      if (id === "demo-continue") {
        state.flags.demoEndShown = true;
        finishTurn(null, id);
        return;
      }
      if (id === "end-continue") {
        state.flags.gameEndShown = true;
        finishTurn(null, id);
        return;
      }
      if (id === "voluntary-end-cancel") {
        render();
        return;
      }
      if (id === "living-settle-confirm") {
        const due = state.gameLivingPendingDue;
        if (!due) {
          render();
          return;
        }
        state.gameLivingLedger = state.gameLivingLedger || [];
        if (state.cash >= due.expenseDue) {
          state.cash -= due.expenseDue;
          state.gameLivingLedger.push({ month: due.month, income: due.income, incomeFor: due.incomeFor, expense: due.expenseDue, expenseDue: due.expenseDue, shortfall: 0, cashAfter: state.cash, failed: false, adjusted: true });
          state.gameLivingPendingDue = null;
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "game-living:settle-after-adjust" });
        } else {
          state.gameLivingLedger.push({ month: due.month, income: due.income, incomeFor: due.incomeFor, expense: 0, expenseDue: due.expenseDue, shortfall: due.expenseDue - state.cash, cashAfter: state.cash, failed: true });
          state.gameLivingPendingDue = null;
          state.flags.gameOver = "living-fail";
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "game-living:settle-failed" });
        }
        if (save()) render();
        return;
      }
      if (id.startsWith("living-adjust-sell:")) {
        const product = id.slice("living-adjust-sell:".length);
        const h = state.holdings[product];
        const due = state.gameLivingPendingDue;
        if (!h || !due) {
          render();
          return;
        }
        const vv = livingAdjustValuation(product, h);
        const value = vv.blocked ? 0 : vv.v;
        if (!(value > 0)) {
          render();
          return;
        }
        state.cash += value;
        delete state.holdings[product];
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "game-living:adjust-sell:" + product, amount: value });
        if (save()) render();
        return;
      }
      if (id === "record-and-reset" || id === "record-and-reset-demo" || id === "record-and-reset-end" || id === "record-and-reset-voluntary" || id === "record-and-reset-livingfail") {
        const causeMap = { "record-and-reset": "chaos", "record-and-reset-demo": "demo-end", "record-and-reset-end": "natural-end", "record-and-reset-voluntary": "voluntary-end", "record-and-reset-livingfail": "living-fail" };
        const sourceRaw = localStorage.getItem(SAVE_KEY);
        document.querySelectorAll("#choices button").forEach((b) => b.disabled = true);
        void (async () => {
          try {
            if (typeof window.__returnStorageFlush === "function" && await window.__returnStorageFlush() === false) throw new Error("prior-write-failed");
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceRaw || JSON.stringify(state)));
            const transferId = state.archiveTransferId || "end-sha256-" + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
            if (propertyActive()) {
              const x = HomeContract.closePropertyContracts(state.cash, state.property, state.month);
              if (!x.ok) throw Error("property-close-failed");
              state.cash = x.cash;
              state.property = x.property;
            }
            settlePendingOrders();
            const log = readLives();
            if (!log) return;
            const record = {
              transferId,
              ...SCHOOL_MODE ? { schoolStart: { ...state.schoolStart }, birth: { ...state.flags.birth } } : {},
              recordContext: ReturnRecordContext.observe(state.recordContext, currentRecordIdentity),
              decisionReview: buildDecisionReview(),
              ...propertyActive() ? { propertySummary: { version: 1, model: "estimated-regional-home-v1", state: structuredClone(state.property), snapshot: HomeContract.propertySnapshot(state.property, propertyPrices(propertyValuationMonth())) } } : {},
              ended: id === "record-and-reset-end" ? GAME_END : state.month,
              observationMonth: state.month,
              turnCount: state.turnCount,
              totalAssets: totalAssets(),
              assetReview: CASH_MODE ? { available: false, reason: "separate-cash-events-model" } : ReturnAssetReview.review(state, totalAssets()),
              ...CASH_MODE ? { cashFlowSummary: cashSummary() } : {},
              ...!CASH_MODE && state.cashEvents && state.cashEvents.rows && state.cashEvents.rows.length ? { careerCashSummary: careerCashSummary() } : {},
              ...!CASH_MODE ? { careerMechanics: careerMechanicsSummary(state.fillsLog) } : {},
              assetTrail: Array.isArray(state.assetTrail) && state.assetTrail.length ? state.assetTrail.slice() : null,
              assetTrailFrom: Array.isArray(state.assetTrail) && state.assetTrail.length ? state.assetTrail[0].m : null,
              cause: causeMap[id],
              path: state.flags.studyPath ? state.flags.studyPath + (state.flags.career ? "-" + state.flags.career : state.flags.studyPath === "parttime" ? "-fulltime" : "") : null,
              chaos: state.chaos
            };
            const alreadyArchived = log.some((row) => row.transferId === record.transferId);
            if (!alreadyArchived) log.push(record);
            try {
              const raw = typeof window.__returnRetainArchive === "function" ? window.__returnRetainArchive(JSON.stringify(log)) : JSON.stringify(log);
              if (alreadyArchived && typeof window.__returnArchiveVerified === "function") {
                if (await window.__returnArchiveVerified(raw) !== true) throw new Error("Archive reverify mismatch");
              } else {
                localStorage.setItem(LIVES_KEY, raw);
                if (localStorage.getItem(LIVES_KEY) !== raw) throw new Error("Archive readback mismatch");
              }
            } catch (_) {
              storageWriteBlocked = true;
              pending = null;
              return showStorageWriteUnavailable();
            }
            const flush = window.__returnStorageFlush;
            if (typeof flush === "function" && await flush() === false) throw new Error("archive-write-failed");
            localStorage.removeItem(SAVE_KEY);
            if (typeof flush === "function" && await flush() === false) throw new Error("save-delete-failed");
            if (localStorage.getItem(SAVE_KEY) !== null) throw new Error("save-delete-readback");
            state = freshState();
            loadedSnapshot = { ok: true, exists: false, state: null };
            lastKnownRaw = null;
            pending = null;
            effDate = "1996-03-01";
            effPostClose = false;
            storageWriteBlocked = false;
            storageReadBlocked = false;
            multiTabConflict = false;
            await boot();
            document.getElementById("turn-card")?.scrollIntoView({ block: "start" });
          } catch (_) {
            storageWriteBlocked = true;
            pending = null;
            showStorageWriteUnavailable();
          }
        })();
        return;
      }
      if (id === "discharge-ok") {
        state.flags.dischargeShown = true;
        state.flags.militaryUntil = null;
        finishTurn(null, id);
        return;
      }
      if (id.startsWith("life:")) {
        const cid = id.slice(5);
        if (cid === "go-now") {
          state.flags.militaryStart = state.month;
          state.flags.militaryUntil = addMonths(state.month, 26);
          state.flags.lifeDone.enlist = true;
        } else if (cid === "defer-1y" && !state.flags.deferredUsed) {
          state.flags.deferredUsed = true;
          state.flags.enlistAt = addMonths(state.flags.enlistAt, 12);
        } else if (cid === "scenario-study") {
          const hs2 = state.flags.birth.hsYear;
          const enlist = hs2 + 5 + "-06";
          state.flags.studyPath = "study";
          state.flags.academicStatus = "college";
          state.flags.enrolledMonths = Math.max(0, monthsBetween(hs2 + 3 + "-03", enlist < "1996-03" ? enlist : "1996-03"));
          state.flags.enlistAt = enlist;
          state.flags.demoScenario = "pre1996-study";
          state.flags.lifeDone.hs1 = true;
          if (enlist < "1996-03") {
            state.flags.militaryStart = enlist;
            state.flags.militaryUntil = addMonths(enlist, 26);
            state.flags.lifeDone.enlist = true;
          }
        } else if (cid === "scenario-plain") {
          state.flags.lifeDone.hs1 = true;
        } else if (cid === "acad-focus" || cid === "acad-balanced") {
          const p = cid === "acad-focus" ? "focus" : "balanced";
          if (!state.academic) state.academic = { policy: p, effort: 0, version: 1 };
          else state.academic.policy = p;
          state.flags.lifeDone.acadPolicy = true;
          if (state.academic.effort > 0) state.flags.lifeDone.acadBoundaryHs3 = true;
        } else if (cid === "acad-keep") {
          state.flags.lifeDone.acadBoundaryHs3 = true;
        } else if (cid === "acad-admit-ok") {
          state.flags.lifeDone.admitResult = true;
          if (state.academic && state.academic.effort < ACAD_ADMIT_MIN) {
            state.flags.studyPath = "parttime";
            state.flags.enlistAt = state.flags.birth.hsYear + 3 + "-08";
            if (state.flags.enlistAt < state.month) state.flags.enlistAt = addMonths(state.month, 1);
          }
        } else if (cid === "acadcol-focus" || cid === "acadcol-balanced") {
          state.colPolicy = cid === "acadcol-focus" ? "focus" : "balanced";
          state.flags.lifeDone.acadColPolicy = true;
        } else if (cid === "acadcol-keep-return") {
          state.flags.lifeDone.acadColReturn = true;
        } else if (cid === "acadcol-switch-return") {
          state.colPolicy = state.colPolicy === "focus" ? "balanced" : "focus";
          state.flags.lifeDone.acadColReturn = true;
        } else if (cid === "acadcol-keep-y3") {
          state.flags.lifeDone.acadColY3 = true;
        } else if (cid === "acadcol-switch-y3") {
          state.colPolicy = state.colPolicy === "focus" ? "balanced" : "focus";
          state.flags.lifeDone.acadColY3 = true;
        } else if (cid === "study" || cid === "parttime") {
          state.flags.studyPath = cid;
          state.flags.lifeDone.hs1 = true;
          state.flags.enlistAt = cid === "study" ? state.flags.birth.hsYear + 5 + "-06" : state.flags.birth.hsYear + 3 + "-08";
        } else if (cid === "job" || cid === "fulltime") {
          state.flags.career = cid;
          state.flags.lifeDone.college = true;
          state.flags.academicStatus = "graduated";
        }
        finishTurn(turn.event || null, id);
        return;
      }
      if (id === "enter" || id === "rebalance") {
        const ta = tradeAccess(turn);
        if (!ta.allowed) {
          render();
          return;
        }
        pending = { step: "product", event: turn.event || null };
        if (ta.reserveOnly) {
          pending.reserveOnly = true;
          pending.settleMonth = nextSettlementMonth();
        }
        render();
        return;
      }
      if (id === "skip-preview") {
        pending = { step: "skip-preview" };
        render();
        return;
      }
      if (id === "skip-to-news" || id === "skip-to-news-stop-settlement" || id === "skip-to-order-change") {
        const stopOrderChange = id === "skip-to-order-change";
        if (stopOrderChange && !(state.pendingOrders || []).length) {
          render();
          return;
        }
        const stopSettlement = id === "skip-to-news-stop-settlement" || stopOrderChange;
        const from = state.month;
        let k = 0, ks = 0, orderChanges = null;
        while (!state.flags.gameOver && state.month <= GAME_END) {
          const t = nextTurn();
          if (t.kind !== "quiet") break;
          if (t.settlement) {
            if (stopSettlement) break;
            state.flags.settledMonth = state.month;
            ks++;
          }
          const priorMonth = state.month, fillsBefore = (state.fillsLog || []).length, historyBefore = state.history.length;
          advanceMonth();
          if (storageWriteBlocked || multiTabConflict || state.month === priorMonth) return;
          k++;
          if (propertyActive() && state.history.slice(historyBefore).some((h) => /^property-(buy|sell)-settled:/.test(h.choice || ""))) break;
          if (stopOrderChange) {
            const fills = (state.fillsLog || []).length - fillsBefore;
            const expiries = state.history.slice(historyBefore).filter((h) => typeof h.choice === "string" && h.choice.startsWith("order-expired:")).length;
            if (fills || expiries) {
              orderChanges = { fills, expiries };
              break;
            }
          }
          if (k > 500) break;
        }
        state.turnCount += k;
        state.lastSkip = k > 0 ? { from, months: k, settlements: ks, stopSettlement, ...stopOrderChange ? { stopOrderChange: true, orderChanges } : {} } : null;
        state.history.push({ month: state.month, decisionMonth: from, choice: (stopOrderChange ? "skip-to-order-change:" : stopSettlement ? "skip-to-news-stop-settlement:" : "skip-to-news:") + k });
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
      const next = DATA.events[state.eventIndex];
      const nlev = nextLifeEvent();
      const pendingNews = next && next.date.slice(0, 7) <= state.month;
      const pendingLife = nlev && nlev.date.slice(0, 7) <= state.month && (!next || nlev.date <= next.date);
      if (!pendingNews && !pendingLife && !settlementDue() && state.month <= GAME_END) advanceMonth();
      state.history.push({ month: state.month, decisionMonth, choice: choiceId });
      save();
      render();
    }
    const MARKET_SIZE_PLAY = [];
    function marketSizeOf(p, month) {
      if (foreignFundScaleActive() && ["spy", "fxi"].includes(p)) return foreignFundScaleMarket(p, month);
      if (p === "kospi" || p === "kosdaq") {
        const cutoff = month === state.month ? effDate : month + "-31";
        const rows = MARKET_SIZE_PLAY.filter((r) => r.product === p && r.evidenceVerified === true && r.usable_from <= cutoff).sort((a, b) => a.usable_from.localeCompare(b.usable_from));
        const last = rows[rows.length - 1];
        if (last) return { size: last.value, label: "\uB2F9\uC2DC \uACF5\uAC1C \uADFC\uAC70 \uD655\uC778 \uC2DC\uC7A5\uADDC\uBAA8 [\uC2DC\uC5F0 \uACC4\uC0B0]" };
        return { size: null, label: "\uB2F9\uC2DC \uACF5\uAC1C\uB41C \uC2DC\uC7A5\uADDC\uBAA8 \uADFC\uAC70 \uBBF8\uD655\uC778 \u2014 \uCE74\uC624\uC2A4 \uC0B0\uC815 \uBCF4\uB958" };
      }
      if (p === "btc") {
        const unit = fxUnit(month, "btc");
        const supply = btcTheoreticalSupply(month);
        if (unit == null || supply == null) return { size: null, label: "\uBE44\uD2B8\uCF54\uC778 \uC2DC\uC138\xB7\uD658\uC728 \uC9C0\uC810 \uBBF8\uD655\uBCF4 \u2014 \uCE74\uC624\uC2A4 \uC0B0\uC815 \uBCF4\uB958" };
        return { size: unit * supply, label: "\uBE44\uD2B8\uCF54\uC778 \uC2DC\uC138\xD7\uC774\uB860 \uBC1C\uD589\uB7C9 [\uC2DC\uC5F0 \uACC4\uC0B0 \xB7 \uC2E4\uC81C \uC2DC\uAC00\uCD1D\uC561 \uD1B5\uACC4 \uC544\uB2D8]" };
      }
      const test = { fx: 50, etf: 5, bundang: 20 }[p];
      if (test) return { size: test * 1e12, label: test + "\uC870 [\uC2DC\uC7A5\uADDC\uBAA8 \uC2DC\uD5D8\uAC12]" };
      return null;
    }
    const CHAOS = {
      marketSize: { kospi: 1e14, kosdaq: 1e13, deposit: Infinity, bond: Infinity, fx: 5e13, etf: 5e12, bundang: 2e13 },
      scaleFactor: 100,
      // 보유액/시장규모 비율 × 이 계수 = 월 누적. 경고 뒤 최소 유예기간은 구현하지 않음 [설계 제안]
      sellImpactFactor: 100,
      // 매도 충격 = 매도대금/시장규모 × 이 계수 (규모 비례) [설계 제안]
      decayPerMonth: 2,
      // 보유 영향이 작으면(월 누적 < 1) 카오스 월 감소 [설계 제안]
      warnAt: 70,
      overAt: 100
      // 부동산은 시장규모를 작게(20조) 잡는 방식으로만 민감도 반영 — 별도 가중 곱하지 않음(이중 벌점 방지)
      // 코스피/코스닥은 당시공개근거 확인 전 계산보류. fx/etf/bundang은 명시된 시험값.
    };
    function chaosWeight(p) {
      return 1;
    }
    function legacyMonthlyChaosAdd() {
      let add = 0;
      for (const [p, h] of Object.entries(state.holdings)) {
        const m = marketSizeOf(p, state.month);
        if (!m || !m.size) continue;
        add += holdingValue(p, h, state.month) / m.size * CHAOS.scaleFactor * chaosWeight(p);
      }
      return add;
    }
    function chaosExposureActive() {
      return state.chaosExposureRules === 1;
    }
    function chaosExposureShapeOk(s) {
      if (!Object.prototype.hasOwnProperty.call(s, "chaosExposureRules")) return true;
      return s.chaosExposureRules === 1 && SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL && s.economyModel?.id === "career-cash-events-v1" && s.careerCashRules === 3 && s.cashPlanRules === 1 && s.careerCycleRules === 1 && s.decisionPaceRules === 1 && s.albaTimeRules === 1 && s.coreRules === 4;
    }
    function chaosExposureHoldings() {
      if (!chaosExposureActive()) return state.holdings;
      const exposure = Object.fromEntries(Object.entries(state.holdings).map(([p, h]) => [p, { ...h }]));
      for (const o of state.pendingOrders || []) {
        if (o.kind !== "sell") continue;
        const remaining = o.qty - (o.split && o.split.n > 1 ? o.split.soldQty || 0 : 0);
        if (!(remaining > 0)) continue;
        const h = exposure[o.product] || { qty: 0, avgPrice: o.avgPrice };
        const qty = h.qty + remaining;
        h.avgPrice = (h.avgPrice * h.qty + o.avgPrice * remaining) / qty;
        h.qty = qty;
        exposure[o.product] = h;
      }
      return exposure;
    }
    function monthlyChaosAdd() {
      if (!chaosExposureActive()) return legacyMonthlyChaosAdd();
      let add = 0;
      for (const [p, h] of Object.entries(chaosExposureHoldings())) {
        const m = marketSizeOf(p, state.month);
        if (!m || !m.size) continue;
        add += holdingValue(p, h, state.month) / m.size * CHAOS.scaleFactor * chaosWeight(p);
      }
      return add;
    }
    function chaosTick() {
      const add = monthlyChaosAdd() + propertyChaosAdd();
      let next = state.chaos + add;
      if (add < 1) next -= CHAOS.decayPerMonth;
      state.chaos = Math.round(Math.max(0, next) * 10) / 10;
    }
    function chaosTrajectory(plan) {
      const vals = [];
      for (const [p, h] of Object.entries(chaosExposureHoldings())) {
        const m = marketSizeOf(p, state.month);
        if (!m || !m.size || !isFinite(m.size)) continue;
        let v = holdingValue(p, h, state.month);
        if (plan && plan.reduceProduct === p) v = Math.max(0, v - (plan.reduceValue || 0));
        if (v > 0) vals.push({ v, size: m.size });
      }
      if (propertyActive()) {
        const snap = HomeContract.propertySnapshot(state.property, propertyPrices(propertyValuationMonth()));
        if (snap.ok && snap.valuation > 0) vals.push({ v: snap.valuation, size: 2e13 });
      }
      if (plan && plan.buyPerMonth > 0 && plan.buySize && isFinite(plan.buySize)) vals.push({ planned: true, per: plan.buyPerMonth, months: plan.buyMonths || 1, size: plan.buySize });
      let chaos = state.chaos + (plan && plan.sellImpactNow || 0);
      const points = [{ m: 0, chaos: Math.round(chaos * 10) / 10 }];
      let warnMonth = chaos >= CHAOS.warnAt ? 0 : null, overMonth = chaos >= CHAOS.overAt ? 0 : null;
      for (let i = 1; i <= 12; i++) {
        let add = 0;
        for (const e of vals) {
          if (e.planned) {
            if (i <= e.months) add += e.per / e.size * CHAOS.scaleFactor;
          } else add += e.v / e.size * CHAOS.scaleFactor;
        }
        let next = chaos + add;
        if (add < 1) next -= CHAOS.decayPerMonth;
        chaos = Math.round(Math.max(0, next) * 10) / 10;
        points.push({ m: i, chaos });
        if (warnMonth === null && chaos >= CHAOS.warnAt) warnMonth = i;
        if (overMonth === null && chaos >= CHAOS.overAt) overMonth = i;
      }
      return { points, warnMonth, overMonth };
    }
    const SAVINGS_BASE = 1e5;
    const ACAD_ADMIT_MIN = 66;
    const FULLTIME_GATE = 12e6;
    const CCV = { ALBA_INCOME: 2e5, JOB_INCOME: 15e5, LIVING_STUDENT: 0, LIVING_ADULT: 7e5, LIVING_MILITARY: 1e5, TUITION_PER_TERM: 9e5, version: 1 };
    function currentEconomyId() {
      return state.economyModel && state.economyModel.id || MODEL_ID;
    }
    function careerCashActive() {
      return SCHOOL_MODE && !CASH_MODE && !CAREER_TRIAL && currentEconomyId() === "career-cash-events-v1";
    }
    function careerCashBuyHoldOn() {
      return careerCashActive() && state.careerCashRules >= 2;
    }
    function careerFulltimeCoverage() {
      if (!careerCashActive()) return null;
      const unpaid = careerCashUnpaid();
      const cash = state.cash;
      let holdingsValue = 0, reserved = 0;
      const excluded = [];
      for (const [p, h] of Object.entries(state.holdings || {})) {
        if (!(h && h.qty > 0)) continue;
        const u = productRule(p);
        let unit = null;
        if (u.rule === "fxprice") unit = fxUnit(state.month, u.series);
        else {
          const pt = priceAt(u.series || p, state.month);
          unit = pt ? pt.value : null;
        }
        if (unit == null || !productAvailable(u)) {
          excluded.push(u.name || p);
          continue;
        }
        holdingsValue += Math.round(unit * h.qty);
      }
      for (const o of state.pendingOrders || []) if (o.kind === "buy") reserved += o.split && o.split.n > 1 ? Math.max(0, o.amount - (o.split.invested || 0)) : o.amount;
      const immediate = cash - unpaid;
      return { cash, unpaid, immediate, immediateMonths: immediate > 0 ? Math.floor(immediate / CCV.LIVING_ADULT) : 0, reserved, holdingsValue, excluded };
    }
    function careerFulltimeCoverageText() {
      const c = careerFulltimeCoverage();
      if (!c) return "";
      let t = "\uC9C0\uAE08 \uAE30\uC900 \uCC38\uACE0: \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + c.cash.toLocaleString() + "\uC6D0 - \uBBF8\uB0A9 " + c.unpaid.toLocaleString() + "\uC6D0 = \uC57D " + c.immediate.toLocaleString() + "\uC6D0 \u2192 \uC804\uC5C5 \uC0DD\uD65C\uBE44(\uC6D4 " + CCV.LIVING_ADULT.toLocaleString() + "\uC6D0 [\uC124\uACC4\uAC12]) \uC57D " + c.immediateMonths + "\uAC1C\uC6D4\uBD84 \uCC38\uACE0\uCE58\uC785\uB2C8\uB2E4. \uC815\uD655\uD55C \uAC1C\uC6D4\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      if (c.reserved > 0) t += " \uB9E4\uC218 \uC608\uC57D\uAE08 " + c.reserved.toLocaleString() + "\uC6D0\uC740 \uC8FC\uBB38\uC744 \uCDE8\uC18C\uD574\uC57C \uD604\uAE08\uC73C\uB85C \uB3CC\uC544\uC624\uBA70 \uC774 \uAC1C\uC6D4\uC218\uC5D0 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
      if (c.holdingsValue > 0) t += " \uBCF4\uC720 \uD3C9\uAC00 \uC57D " + c.holdingsValue.toLocaleString() + "\uC6D0\uC740 \uC989\uC2DC \uC4F8 \uD604\uAE08\uC774 \uC544\uB2C8\uB77C \uB9E4\uB3C4\uAC00 \uD544\uC694\uD558\uACE0 \uCCB4\uACB0\uC740 \uB2E4\uC74C \uC801\uACA9 \uAD00\uCE21 \uC9C0\uC810 \uAC00\uACA9\uC774\uB77C \uC9C0\uAE08 \uAC12\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC73C\uBA70 \uC774 \uAC1C\uC6D4\uC218\uC5D0 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
      if (c.excluded.length) t += " \uC2DC\uC138 \uC9C0\uC810 \uBBF8\uD655\uBCF4\xB7\uAC70\uB798 \uBD88\uAC00\uB85C \uD3C9\uAC00\uC5D0\uC11C \uC81C\uC678\uD55C \uBCF4\uC720: " + c.excluded.join(", ") + ".";
      if (careerCashBuyHoldOn()) t += " \uC804\uC5C5 \uC911 \uBBF8\uB0A9\uC774 \uC0DD\uAE30\uBA74 \uC0C8 \uB9E4\uC218 \uC811\uC218\uC640 \uAE30\uC874 \uB9E4\uC218 \uC8FC\uBB38\uC758 \uCCB4\uACB0\uC774 \uC7A0\uAE30\uACE0, \uC7A0\uAE08 \uD574\uC81C\uB294 \uC0C1\uD658\uBFD0\uC774\uBA70 \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC2B5\uB2C8\uB2E4." + (state.careerCashRules >= 3 ? " \uBCF4\uC720 \uC790\uC0B0\uC774 \uC5C6\uC73C\uBA74 \uBBF8\uB0A9 \uC911 \uC18C\uB4DD \uACBD\uB85C\uB294 \uB9E4 \uBD84\uAE30\uC6D4\uC758 \uC54C\uBC14\xB7\uC7AC\uCDE8\uC5C5 \uD68C\uBCF5 \uC120\uD0DD\uBFD0\uC785\uB2C8\uB2E4." : " \uBCF4\uC720 \uC790\uC0B0\uC774 \uC5C6\uC73C\uBA74 \uBBF8\uB0A9 \uC911 \uD68C\uBCF5 \uC218\uB2E8\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      else t += " \uC774 \uC800\uC7A5\uC740 \uC0DD\uC131 \uB2F9\uC2DC \uADDC\uCE59(\uBBF8\uB0A9 \uC911 \uB9E4\uC218 \uC81C\uD55C \uC5C6\uC74C)\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4. \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC2B5\uB2C8\uB2E4.";
      return t;
    }
    function cashPlanActive() {
      return careerCashActive() && state.cashPlanRules === 1;
    }
    function cashPlanCanSet(percent) {
      return percent === 0 || !!nextTurn().settlement;
    }
    function prepareCashPlanMonth() {
      if (!cashPlanActive() || state.month > GAME_END || state.month <= state.schoolStart.startMonth) return;
      if (state.cashEvents.rows.at(-1)?.month === state.month) return;
      applyCareerCashMonth();
      applyCashSavingsPlan();
    }
    function applyCashSavingsPlan() {
      if (state.cashAllocationRules === 1 && state.jobSavingsPlan?.allocation) return applyCashAllocationPlan();
      return legacyApplyCashSavingsPlan();
    }
    function legacyApplyCashSavingsPlan() {
      if (state.cashReservePolicy) return cashBufferedSavingsPlan();
      return cashUnbufferedSavingsPlan();
    }
    function cashUnbufferedSavingsPlan() {
      const plan = state.jobSavingsPlan, row = state.cashEvents.rows.at(-1);
      if (!cashPlanActive() || !plan || !plan.percent || state.month <= plan.enabledAfterMonth || state.flags.career !== "job" || militaryActive() || schoolDataGap() || careerCashUnpaid() > 0 || !row || row.month !== state.month || plan.appliedMonths.includes(state.month)) return;
      const base = Math.min(state.cash, Math.max(0, row.income - row.living - row.tuition));
      const amount = Math.round(base * plan.percent / 100);
      if (amount <= 0) return;
      const product = jobPlanProduct(plan), u = productRule(product), pt = priceAt(u.series || product, state.month);
      if (!productAvailable(u) || !pt || !wasObservableAt(pt, effDate, effPostClose)) return;
      const settleMonth = nextSettlementMonth();
      state.pendingOrders = state.pendingOrders || [];
      state.pendingOrders.push({ id: "cash-plan-" + state.month, kind: "buy", product, amount, placedMonth: state.month, basePtDate: pt.date, ...reserveObsGate(settleMonth), earliestFillMonth: settleMonth, reserve: "job-settlement", planOrigin: "career-cash" });
      state.cash -= amount;
      plan.appliedMonths.push(state.month);
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-savings-auto:" + product, amount, settleMonth, availableFlow: base });
    }
    function cashReservePreview(target, flow, cash, percent) {
      if (![0, 7e5, 21e5, 42e5].includes(target) || ![flow, cash, percent].every(Number.isFinite) || flow < 0 || cash < 0 || ![0, 50, 100].includes(percent)) return null;
      const base = Math.min(cash, flow), planned = Math.round(base * percent / 100), amount = Math.min(planned, Math.max(0, Math.floor(cash - target)));
      return { target, base, planned, amount, cashAfter: cash - amount, held: planned - amount };
    }
    function cashBufferedSavingsPlan() {
      const p = state.cashReservePolicy, plan = state.jobSavingsPlan, row = state.cashEvents.rows.at(-1);
      if (!p || !plan || !plan.percent || state.month <= plan.enabledAfterMonth || state.month <= p.enabledAfterMonth || state.flags.career !== "job" || militaryActive() || schoolDataGap() || careerCashUnpaid() > 0 || !row || row.month !== state.month || plan.appliedMonths.includes(state.month)) return;
      const q = cashReservePreview(p.amount, Math.max(0, row.income - row.living - row.tuition), state.cash, plan.percent);
      if (!q || q.amount <= 0) return;
      const product = jobPlanProduct(plan), u = productRule(product), pt = priceAt(u.series || product, state.month);
      if (!productAvailable(u) || !pt || !wasObservableAt(pt, effDate, effPostClose)) return;
      const settleMonth = nextSettlementMonth();
      state.pendingOrders = state.pendingOrders || [];
      state.pendingOrders.push({ id: "cash-plan-" + state.month, kind: "buy", product, amount: q.amount, placedMonth: state.month, basePtDate: pt.date, ...reserveObsGate(settleMonth), earliestFillMonth: settleMonth, reserve: "job-settlement", planOrigin: "career-cash" });
      state.cash -= q.amount;
      plan.appliedMonths.push(state.month);
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-savings-auto:" + product, amount: q.amount, settleMonth, availableFlow: q.base, reserveTarget: p.amount, withheldForReserve: q.held });
    }
    function cashReserveHtml() {
      const p = state.cashReservePolicy;
      return '<details class="cash-reserve"><summary>\uC790\uB3D9\uC801\uB9BD \uC804 \uC608\uBE44\uD604\uAE08 \xB7 ' + (p ? p.amount.toLocaleString() + "\uC6D0 \uBAA9\uD45C" : "\uBC29\uCE68 \uBBF8\uC124\uC815 \xB7 \uAE30\uC874 \uBC30\uBD84 \uADF8\uB300\uB85C") + '</summary><p class="note">\uC0DD\uD65C\xB7\uD559\uBE44\uB97C \uB0A9\uBD80\uD55C \uB4A4, \uC120\uD0DD\uD55C \uAE08\uC561\uC774 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC73C\uB85C \uB0A8\uB3C4\uB85D \uC55E\uC73C\uB85C\uC758 \uC790\uB3D9\uC801\uB9BD\uB9CC \uC904\uC785\uB2C8\uB2E4. \uD604\uAE08\uC774 \uBD80\uC871\uD574\uB3C4 \uC0C8 \uB3C8\uC744 \uB9CC\uB4E4\uAC70\uB098 \uC8FC\uBB38\uC744 \uCDE8\uC18C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBCF4\uC720\uD3C9\uAC00\xB7\uB9E4\uC218 \uC608\uC57D\uAE08\xB7\uB9E4\uB3C4 \uC7A0\uAE08\uC740 \uC608\uBE44\uD604\uAE08\uC73C\uB85C \uC138\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC218\uB3D9\uB9E4\uC218\xB7\uC0DD\uD65C\uBE44\xB7\uD559\uBE44\xB7\uBBF8\uB0A9 \uC0C1\uD658\uC744 \uB9C9\uB294 \uC7A0\uAE08\uC774 \uC544\uB2C8\uBA70 \uD604\uAE08\uC740 \uBAA9\uD45C \uC544\uB798\uB85C \uC904\uC5B4\uB4E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC0DD\uACC4 \uBCF4\uC7A5\xB7\uBBF8\uB798 \uC9C0\uCD9C \uC608\uCE21\uC774 \uC544\uB2CC \uACE0\uC815 \uAC8C\uC784 \uC608\uC0B0\uC785\uB2C8\uB2E4. \uC124\uC815\xB7\uBCC0\uACBD\uC740 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uACFC\uAC70 \uB204\uB77D\uBD84\uC740 \uC18C\uAE09 \uC801\uB9BD\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><button id="cash-reserve-open">\uC608\uBE44\uD604\uAE08 \uBAA9\uD45C \uAC80\uD1A0</button></details>';
    }
    function renderCashReserve(target = null) {
      if (storageWriteBlocked || storageReadBlocked || !cashPlanActive() || state.flags.career !== "job") return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices"), allowed = !!nextTurn().settlement;
      card.innerHTML = '<div class="date">' + state.month + " \xB7 \uCDE8\uC5C5 \uC608\uBE44\uD604\uAE08 \uBC29\uCE68</div><h2>\uD22C\uC790 \uC804\uC5D0 \uD604\uAE08\uC744 \uC5BC\uB9C8\uB098 \uB0A8\uAE38\uAE4C</h2>" + cashReserveHtml().replace('<button id="cash-reserve-open">\uC608\uBE44\uD604\uAE08 \uBAA9\uD45C \uAC80\uD1A0</button>', "");
      box.innerHTML = "";
      if (target !== null) {
        const percent = state.jobSavingsPlan?.percent || 0, s = careerCashSchedule(state.month), q = cashReservePreview(target, Math.max(0, s.income - s.living - s.tuition), state.cash, percent), signature = JSON.stringify([state.month, state.cash, state.jobSavingsPlan, state.cashReservePolicy]);
        if (!q) return renderCashReserve();
        card.innerHTML += "<h3>\uBAA9\uD45C " + target.toLocaleString() + "\uC6D0\uC73C\uB85C \uBC14\uAFB8\uAE30 \uAC80\uD1A0</h3><p>\uD604\uC7AC \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0, \uBC30\uBD84 " + percent + "%. \uC9C0\uAE08 \uD604\uAE08\uACFC \uD604\uC7AC \uC218\uC785\xB7\uCCAD\uAD6C\uB97C \uAE30\uC900\uC73C\uB85C \uACC4\uC0B0\uD55C \uB2E8\uC21C \uC608: \uC6D0\uB798 \uC608\uC57D " + q.planned.toLocaleString() + "\uC6D0 \u2192 \uC608\uBE44\uAE08 \uC801\uC6A9 " + q.amount.toLocaleString() + "\uC6D0, \uB0A8\uB294 \uD604\uAE08 " + q.cashAfter.toLocaleString() + '\uC6D0\uC785\uB2C8\uB2E4. \uB2E4\uC74C \uB2EC \uD604\uAE08\xB7\uC9C4\uB85C\xB7\uBBF8\uB0A9\xB7\uC2DC\uC138\uAC00 \uBC14\uB00C\uBA74 \uC774\uB300\uB85C \uC2E4\uD589\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uB798 \uACB0\uACFC\uB97C \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p class="note">\uD604\uC7AC \uD604\uAE08\xB7\uBCF4\uC720\xB7\uAE30\uC874 \uC608\uC57D\xB7\uBC30\uBD84 \uBE44\uC728\xB7\uC6D4\xB7\uD134\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB2EC \uC2E0\uADDC \uC608\uC57D\uBD80\uD130 \uC801\uC6A9\uD558\uBA70 \uBC29\uCE68\uC744 0\uC6D0\uC73C\uB85C \uBC14\uAFD4\uB3C4 \uADF8\uB3D9\uC548 \uB35C \uB123\uC740 \uAE08\uC561\uC744 \uD55C\uAEBC\uBC88\uC5D0 \uB530\uB77C\uC7A1\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBC29\uCE68 \uBCC0\uACBD\uC740 \uADDC\uCE59 \uB9E5\uB77D\uC5D0 \uC0C8 \uC2DD\uBCC4\uB85C \uB0A8\uACE0 \uACFC\uAC70 \uAE30\uB85D\uC740 \uACE0\uCCD0 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
        const yes = document.createElement("button");
        yes.id = "cash-reserve-confirm";
        yes.textContent = "\uB2E4\uC74C \uB2EC\uBD80\uD130 \uC608\uBE44\uD604\uAE08 " + target.toLocaleString() + "\uC6D0 \uBAA9\uD45C \uC801\uC6A9";
        yes.disabled = !allowed;
        yes.onclick = () => {
          if (storageWriteBlocked || storageReadBlocked || !cashPlanActive() || !nextTurn().settlement || JSON.stringify([state.month, state.cash, state.jobSavingsPlan, state.cashReservePolicy]) !== signature || !cashReserveIdentityFields) return;
          state.cashReservePolicy = { version: 1, amount: target, enabledAfterMonth: state.month };
          Object.assign(currentRecordIdentity, foreignFundScaleActive() ? foreignFundScaleIdentity() : foreignActive() ? foreignIdentity() : propertyActive() ? propertyIdentity() : decisionPaceActive() ? decisionPaceIdentity() : careerCycleIdentity());
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-reserve:" + target });
          if (save()) render();
        };
        box.append(yes);
        const no = document.createElement("button");
        no.id = "cash-reserve-review-back";
        no.textContent = "\uD655\uC815\uD558\uC9C0 \uC54A\uACE0 \uBAA9\uD45C \uC120\uD0DD\uC73C\uB85C";
        no.onclick = () => renderCashReserve();
        box.append(no);
      } else {
        for (const amount of [0, 7e5, 21e5, 42e5]) {
          const b = document.createElement("button");
          b.dataset.reserveTarget = String(amount);
          b.textContent = amount === 0 ? "\uC608\uBE44\uD604\uAE08 \uBAA9\uD45C \uC5C6\uC74C \xB7 0\uC6D0" : amount.toLocaleString() + "\uC6D0 \uB0A8\uAE30\uAE30 \uBAA9\uD45C";
          b.disabled = !allowed;
          if (!allowed) b.textContent += " \xB7 \uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC124\uC815";
          b.onclick = () => renderCashReserve(amount);
          box.append(b);
        }
      }
      const back = document.createElement("button");
      back.id = "cash-reserve-back";
      back.textContent = "\uBC29\uCE68\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.append(back);
      renderPortfolio();
    }
    function cashSavingsPlanHtml() {
      if (state.flags.career !== "job") return "";
      const p = state.jobSavingsPlan, unpaid = careerCashUnpaid(), last = p?.appliedMonths?.at(-1);
      const label = p?.percent ? p.percent + "% " + (p.allocation ? p.allocation.map((a) => esc(productRule(a.product).name) + " " + a.share + "%").join(" / ") : esc(productRule(jobPlanProduct()).name)) + " \uC124\uC815" + (unpaid > 0 ? " \xB7 \uBBF8\uB0A9\uC73C\uB85C \uC0C8 \uC608\uC57D \uBCF4\uB958" : "") : "\uAEBC\uC9D0 \xB7 \uD604\uAE08 \uBCF4\uC720";
      const receipt = p?.percent ? '<p class="note cash-plan-receipt">' + (unpaid > 0 ? "\uD604\uC7AC \uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0. \uBE44\uC728\uC744 \uC124\uC815\uD588\uC5B4\uB3C4 \uC0C8 \uC608\uC57D\uC740 \uC811\uC218\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC790\uC0B0\uD45C\uC5D0\uC11C \uC9C1\uC811 \uC0C1\uD658\uD574\uC57C \uD558\uBA70, \uC0C1\uD658 \uC804 \uB193\uCE5C \uC6D4\uC758 \uC5EC\uC720\uAE08\uC744 \uB098\uC911\uC5D0 \uC18C\uAE09 \uD22C\uC785\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. " : "") + (last ? "\uB9C8\uC9C0\uB9C9 \uC0C8 \uC608\uC57D \uC811\uC218 \uAE30\uB85D: " + esc(last) + "\uC6D4. \uB2F9\uC2DC \uB300\uC0C1\uC740 \uD604\uC7AC \uC124\uC815\uACFC \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4." : "\uC544\uC9C1 \uC0C8 \uC608\uC57D \uC811\uC218 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") + " \uBE44\uC728 \uC124\uC815, \uC0C8 \uC608\uC57D \uC811\uC218, \uC2E4\uC81C \uCCB4\uACB0\uC740 \uB2E4\uB978 \uB2E8\uACC4\uC774\uBA70, \uACFC\uAC70 \uC811\uC218 \uAE30\uB85D\uC740 \uC55E\uC73C\uB85C\uC758 \uC811\uC218\xB7\uCCB4\uACB0\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>" : "";
      return '<details class="job-savings-plan cash-savings-plan"><summary>\uCDE8\uC5C5 \uC6D4 \uC5EC\uC720\uAE08 \uBC30\uBD84 \uACC4\uD68D \xB7 ' + label + "</summary>" + receipt + '<p class="note">\uC774\uBC88 \uB2EC \uC218\uC785\uC5D0\uC11C \uC0DD\uD65C\uBE44\xB7\uD559\uBE44\uB97C \uB0A9\uBD80\uD55C \uB4A4 \uB0A8\uB294 \uC2E0\uADDC \uC5EC\uC720\uAE08\uACFC \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 \uC911 \uC791\uC740 \uAE08\uC561\uC758 0/50/100%\uB9CC \uC608\uC57D\uD569\uB2C8\uB2E4. \uACFC\uAC70 \uD604\uAE08\xB7\uB9E4\uB3C4\uB300\uAE08\xB7\uCDE8\uC18C \uBC18\uD658\uAE08\uC740 \uC790\uB3D9 \uD22C\uC785\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uACFC\uAC70 \uBBF8\uB0A9\uC774 \uB0A8\uC73C\uBA74 \uC608\uC57D\uD558\uC9C0 \uC54A\uACE0, \uC218\uC785\uC774 \uC5C6\uB294 \uB2EC\xB7\uBCF5\uBB34\xB7\uC2DC\uC138/\uC811\uADFC \uBBF8\uD655\uBCF4 \uB54C\uB3C4 \uC18C\uAE09\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uACE0\uC815 \uAC8C\uC784\uAC12\uC5D0\uC11C \uCDE8\uC5C5 \uC218\uC785 150\uB9CC\uC6D0 - \uC0DD\uD65C 70\uB9CC\uC6D0 = \uC6D4 80\uB9CC\uC6D0\uC774 \uD1B5\uC0C1 \uAE30\uC900\uC774\uBA70 \uC2E4\uC81C \uAE09\uC5EC\xB7\uBB3C\uAC00\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p><p class="note">\uACC4\uD68D \uC124\uC815\xB7\uC7AC\uAC1C\xB7\uB300\uC0C1 \uBCC0\uACBD\uC740 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C, \uC55E\uC73C\uB85C\uC758 \uC608\uC57D \uB044\uAE30\uB294 \uC5B8\uC81C\uB4E0 \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC6D4\uBCC4 \uC811\uC218\uD558\uBA70 \uC815\uC0B0 \uC644\uB8CC \uB4A4 \uCCAB \uC0C8 \uC801\uACA9 \uAD00\uCE21 \uC9C0\uC810\uC5D0 \uD568\uAED8 \uCCB4\uACB0\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC6D4\uBCC4 \uBD84\uC0B0 \uAC00\uACA9\uC774\uB098 \uC218\uC775\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB300\uC0C1 \uBCC0\uACBD\xB7\uC911\uB2E8\uC740 \uAE30\uC874 \uC608\uC57D\uC744 \uCDE8\uC18C\uD558\uC9C0 \uC54A\uC73C\uBA70 \uAE30\uC874 \uC608\uC57D\uC758 \uCDE8\uC18C\xB7\uCD95\uC18C\uB294 \uB300\uAE30\uC8FC\uBB38 \uADDC\uCE59\uC744 \uB530\uB985\uB2C8\uB2E4. \uB2EC\uB7EC\uC608\uAE08 \uC5F04%\uB294 \uAE30\uC874 \uAC8C\uC784\uAC12\uC785\uB2C8\uB2E4.</p><button id="job-plan-open">\uC55E\uC73C\uB85C\uC758 \uB300\uC0C1\xB7\uBE44\uC728 \uBC14\uAFB8\uAE30</button></details>';
    }
    function renderCashSavingsPlan() {
      if (state.cashAllocationRules === 1) return renderCashAllocationPlan();
      if (storageWriteBlocked || storageReadBlocked || state.flags.career !== "job") return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">' + state.month + " \xB7 \uCDE8\uC5C5 \uC6D4 \uC5EC\uC720\uAE08 \uACC4\uD68D</div><h2>\uC0DD\uD65C\xB7\uD559\uBE44\uB97C \uB0B8 \uB4A4 \uB0A8\uB294 \uC2E0\uADDC \uC5EC\uC720\uAE08 \uBC30\uBD84</h2>" + cashSavingsPlanHtml().replace('<button id="job-plan-open">\uC55E\uC73C\uB85C\uC758 \uB300\uC0C1\xB7\uBE44\uC728 \uBC14\uAFB8\uAE30</button>', "") + '<p class="note">\uC774\uBBF8 \uC811\uC218\uD55C \uC8FC\uBB38\uACFC \uAC00\uC9C4 \uD604\uAE08\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB2EC\uBD80\uD130 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uBBF8\uB0A9 \uC0C1\uD658\uC740 \uBCC4\uB3C4 \uBC84\uD2BC\uC73C\uB85C \uC9C1\uC811 \uC120\uD0DD\uD569\uB2C8\uB2E4.</p>';
      box.innerHTML = "";
      const choices = jobPlanChoices(), label = document.createElement("label"), select = document.createElement("select");
      label.htmlFor = "job-plan-product";
      label.textContent = "\uC55E\uC73C\uB85C \uC0C8 \uC5EC\uC720\uAE08\uC758 \uC608\uC57D \uB300\uC0C1";
      select.id = "job-plan-product";
      select.style.cssText = "width:100%;min-height:44px;margin:8px 0";
      for (const u of choices) {
        const option = document.createElement("option");
        option.value = u.product;
        option.textContent = u.name;
        select.append(option);
      }
      if (choices.some((u) => u.product === jobPlanProduct())) select.value = jobPlanProduct();
      card.append(label, select);
      [[0, "\uD604\uAE08\uC73C\uB85C \uB0A8\uAE30\uAE30 \xB7 \uC55E\uC73C\uB85C\uC758 \uC608\uC57D \uB044\uAE30 (0%)"], [50, "\uC808\uBC18 \uC608\uC57D \xB7 \uC808\uBC18 \uD604\uAE08 (50%)"], [100, "\uC2E0\uADDC \uC5EC\uC720\uAE08 \uC804\uC561 \uC608\uC57D (100%)"]].forEach(([percent, text]) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.dataset.planPercent = String(percent);
        b.disabled = !cashPlanCanSet(percent) || percent > 0 && !choices.length;
        if (!cashPlanCanSet(percent)) b.textContent += " \xB7 \uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC124\uC815";
        b.onclick = () => {
          if (storageWriteBlocked || storageReadBlocked || !cashPlanCanSet(percent) || !cashPlanActive()) return;
          const product = select.value;
          if (percent > 0 && !jobPlanChoices().some((u) => u.product === product)) return;
          state.jobSavingsPlan = { version: 1, percent, product: ["kospi", "fx", "usdeposit"].includes(product) ? product : jobPlanProduct(), enabledAfterMonth: state.month, appliedMonths: state.jobSavingsPlan?.appliedMonths || [] };
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-savings-plan:" + percent + ":" + state.jobSavingsPlan.product });
          if (save()) render();
        };
        box.append(b);
      });
      const back = document.createElement("button");
      back.textContent = "\uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.append(back);
      renderPortfolio();
    }
    function cashAllocationShapeOk(s) {
      const own = (k) => Object.prototype.hasOwnProperty.call(s, k), p = s.jobSavingsPlan;
      if (!own("cashAllocationRules")) return !p || !Object.prototype.hasOwnProperty.call(p, "allocation");
      if (s.cashAllocationRules !== 1 || s.reservationSettlementRules !== 1 || !chaosExposureShapeOk(s)) return false;
      if (!p || !Object.prototype.hasOwnProperty.call(p, "allocation")) return true;
      const a = p.allocation;
      return Array.isArray(a) && a.length === 2 && a.every((x) => x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).sort().join(",") === "product,share" && ["kospi", "fx", "usdeposit"].includes(x.product) && [25, 50, 75].includes(x.share)) && a[0].product !== a[1].product && a[0].share + a[1].share === 100 && p.product === a[0].product;
    }
    function cashAllocationAmounts(amount, allocation) {
      const first = Math.floor(amount * allocation[0].share / 100);
      return [{ product: allocation[0].product, amount: first }, { product: allocation[1].product, amount: amount - first }];
    }
    function applyCashAllocationPlan() {
      const plan = state.jobSavingsPlan, row = state.cashEvents.rows.at(-1);
      if (!cashPlanActive() || !cashAllocationShapeOk(state) || !plan?.allocation || !plan.percent || state.month <= plan.enabledAfterMonth || state.flags.career !== "job" || militaryActive() || schoolDataGap() || careerCashUnpaid() > 0 || !row || row.month !== state.month || plan.appliedMonths.includes(state.month)) return;
      const p = state.cashReservePolicy;
      if (p && state.month <= p.enabledAfterMonth) return;
      const base = Math.min(state.cash, Math.max(0, row.income - row.living - row.tuition));
      const q = p ? cashReservePreview(p.amount, base, state.cash, plan.percent) : { base, amount: Math.round(base * plan.percent / 100), held: 0 };
      if (!q || q.amount <= 0) return;
      const settleMonth = nextSettlementMonth(), allocation = cashAllocationAmounts(q.amount, plan.allocation), accepted = [], skipped = [];
      for (const a of allocation) {
        const u = productRule(a.product), pt = priceAt(u.series || a.product, state.month);
        if (a.amount <= 0 || !productAvailable(u) || !pt || !wasObservableAt(pt, effDate, effPostClose)) {
          skipped.push({ ...a, reason: a.amount <= 0 ? "zero" : "unavailable" });
          continue;
        }
        accepted.push({ ...a, pt });
      }
      if (!accepted.length) return;
      state.pendingOrders = state.pendingOrders || [];
      for (const a of accepted) {
        state.pendingOrders.push({ id: "cash-plan-" + state.month + "-" + a.product, kind: "buy", product: a.product, amount: a.amount, placedMonth: state.month, basePtDate: a.pt.date, ...reserveObsGate(settleMonth), earliestFillMonth: settleMonth, reserve: "job-settlement", planOrigin: "career-cash" });
        state.cash -= a.amount;
      }
      plan.appliedMonths.push(state.month);
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-allocation-auto", amount: accepted.reduce((n, a) => n + a.amount, 0), planned: q.amount, allocation: accepted.map((a) => ({ product: a.product, amount: a.amount })), skipped, settleMonth, availableFlow: q.base, ...p ? { reserveTarget: p.amount, withheldForReserve: q.held } : {} });
    }
    function renderCashAllocationPlan(review = null) {
      if (storageWriteBlocked || storageReadBlocked || !cashPlanActive() || state.flags.career !== "job") return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices"), choices = jobPlanChoices(), plan = state.jobSavingsPlan;
      card.innerHTML = '<div class="date">' + state.month + " \xB7 \uCDE8\uC5C5 \uC6D4 \uC5EC\uC720\uAE08 \uBC30\uBD84</div><h2>\uD55C \uC0C1\uD488\uC5D0 \uBAA8\uC744\uAE4C, \uB450 \uC0C1\uD488\uC5D0 \uB098\uB20C\uAE4C</h2>" + cashSavingsPlanHtml().replace('<button id="job-plan-open">\uC55E\uC73C\uB85C\uC758 \uB300\uC0C1\xB7\uBE44\uC728 \uBC14\uAFB8\uAE30</button>', "") + '<p class="note">\uBD84\uC0B0\uC740 \uC190\uC2E4\uC774\uB098 \uCE74\uC624\uC2A4\uB97C \uB9C9\uB294 \uBCF4\uC7A5\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uB2EC\uB7EC\uBCF4\uC720\uC640 \uB2EC\uB7EC\uC608\uAE08\uC740 \uAC19\uC740 \uD658\uC728\uC5D0 \uB178\uCD9C\uB429\uB2C8\uB2E4. \uB2EC\uB7EC\uC608\uAE08 \uC5F04%\uB294 \uAE30\uC874 \uAC8C\uC784\uAC12\uC785\uB2C8\uB2E4. \uCD1D \uC608\uC57D \uC608\uC0B0\uC744 \uBA3C\uC800 \uC815\uD558\uACE0 \uC608\uBE44\uD604\uAE08 \uC81C\uD55C\uC744 \uC801\uC6A9\uD55C \uB4A4 \uB458\uB85C \uB098\uB215\uB2C8\uB2E4. \uCCAB \uB300\uC0C1 \uAE08\uC561\uC758 \uC6D0 \uBBF8\uB9CC\uC740 \uBC84\uB9AC\uACE0 \uB098\uBA38\uC9C0\uB294 \uB450 \uBC88\uC9F8\uC5D0 \uBC30\uBD84\uD569\uB2C8\uB2E4. \uC790\uB8CC\xB7\uC811\uADFC\uC774 \uC5C6\uB294 \uB300\uC0C1 \uBAAB\uC740 \uD604\uAE08\uC73C\uB85C \uB0A8\uAE30\uBA70 \uB2E4\uB978 \uB300\uC0C1\uC73C\uB85C \uBAB0\uAC70\uB098 \uB2E4\uC74C \uB2EC\uC5D0 \uC18C\uAE09\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      box.innerHTML = "";
      const labelFor = (p) => productRule(p).name || p;
      if (review) {
        const sig = JSON.stringify([state.month, state.cash, state.jobSavingsPlan, state.cashReservePolicy]), percent = review.percent, a = review.allocation;
        card.innerHTML += "<h3>\uB2E4\uC74C \uB2EC\uBD80\uD130 " + percent + "% \uC608\uC57D \uAC80\uD1A0</h3><p>" + (percent ? a ? a.map((x) => esc(labelFor(x.product)) + " " + x.share + "%").join(" / ") : esc(labelFor(review.product)) : "\uC55E\uC73C\uB85C\uC758 \uC0C8 \uC608\uC57D \uC911\uB2E8") + "</p><p>\uD604\uC7AC \uD604\uAE08\xB7\uBCF4\uC720\xB7\uAE30\uC874 \uB300\uAE30\uC8FC\uBB38\xB7\uC6D4\xB7\uD134\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uBC30\uBD84\uBE44\uB294 \uC804\uCCB4 \uC790\uC0B0\uC758 \uBAA9\uD45C\uBE44\uC911\uC774 \uC544\uB2C8\uB77C \uC0C8 \uC608\uC57D \uC608\uC0B0 \uC548\uC758 \uBE44\uC728\uC785\uB2C8\uB2E4. \uAE30\uC874 \uC608\uC57D\uC744 \uC790\uB3D9 \uCDE8\uC18C\uD558\uAC70\uB098 \uB9E4\uB3C4\xB7\uB9AC\uBC38\uB7F0\uC2F1\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC6D4\uBCC4 \uC811\uC218 \uD6C4 \uC815\uC0B0 \uB4A4 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uC5D0\uC11C \uCCB4\uACB0\uD558\uBA70 \uB450 \uB300\uC0C1\uC758 \uCCB4\uACB0\uC77C\uC740 \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>";
        const yes = document.createElement("button");
        yes.id = "cash-allocation-confirm";
        yes.textContent = percent ? "\uB2E4\uC74C \uB2EC\uBD80\uD130 \uC774 \uBC30\uBD84 \uC801\uC6A9" : "\uC55E\uC73C\uB85C\uC758 \uC0C8 \uC608\uC57D \uC911\uB2E8 \uD655\uC815";
        yes.disabled = !cashPlanCanSet(percent);
        yes.onclick = () => {
          if (storageWriteBlocked || storageReadBlocked || !cashPlanCanSet(percent) || JSON.stringify([state.month, state.cash, state.jobSavingsPlan, state.cashReservePolicy]) !== sig) return;
          const products = a ? a.map((x) => x.product) : [review.product];
          if (percent && products.some((p) => !jobPlanChoices().some((u) => u.product === p))) return;
          state.jobSavingsPlan = { version: 1, percent, product: review.product, enabledAfterMonth: state.month, appliedMonths: plan?.appliedMonths || [], ...a ? { allocation: a.map((x) => ({ ...x })) } : {} };
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "cash-allocation-plan:" + percent + ":" + review.product + (a ? ":" + a[0].share + ":" + a[1].product : ""), product: review.product, ...a ? { allocation: a.map((x) => ({ ...x })) } : {} });
          if (save()) render();
        };
        box.append(yes);
        const edit = document.createElement("button");
        edit.id = "cash-allocation-edit";
        edit.textContent = "\uD655\uC815\uD558\uC9C0 \uC54A\uACE0 \uBC30\uBD84 \uB2E4\uC2DC \uACE0\uB974\uAE30";
        edit.onclick = () => renderCashAllocationPlan();
        box.append(edit);
      } else {
        const addSelect = (id, label, opts2, value) => {
          const l = document.createElement("label");
          l.htmlFor = id;
          l.textContent = label;
          const e = document.createElement("select");
          e.id = id;
          e.style.cssText = "width:100%;min-height:44px;margin:8px 0 16px";
          for (const [v, t] of opts2) {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = t;
            e.append(o);
          }
          if (opts2.some((x) => x[0] === value)) e.value = value;
          card.append(l, e);
          return e;
        };
        const mode = addSelect("cash-allocation-mode", "\uBC30\uBD84 \uBC29\uC2DD", [["single", "\uD55C \uC0C1\uD488"], ["dual", "\uB450 \uC0C1\uD488"]], plan?.allocation ? "dual" : "single"), opts = choices.map((u) => [u.product, u.name]);
        const first = addSelect("job-plan-product", "\uCCAB \uBC88\uC9F8 \uB300\uC0C1", opts, jobPlanProduct()), second = addSelect("cash-allocation-second", "\uB450 \uBC88\uC9F8 \uB300\uC0C1", opts, plan?.allocation?.[1]?.product || choices.find((u) => u.product !== first.value)?.product), share = addSelect("cash-allocation-share", "\uCCAB \uB300\uC0C1 : \uB458\uC9F8 \uB300\uC0C1 \uBE44\uC728", [["25", "25 : 75"], ["50", "50 : 50"], ["75", "75 : 25"]], String(plan?.allocation?.[0]?.share || 50));
        const refresh = () => {
          second.hidden = share.hidden = mode.value !== "dual";
          document.querySelector('label[for="cash-allocation-second"]').hidden = second.hidden;
          document.querySelector('label[for="cash-allocation-share"]').hidden = share.hidden;
        };
        mode.onchange = refresh;
        refresh();
        const error = document.createElement("p");
        error.id = "cash-allocation-error";
        error.setAttribute("role", "alert");
        card.append(error);
        for (const [percent, text] of [[0, "\uC0C8 \uC608\uC57D \uB044\uAE30 \xB7 \uD604\uAE08\uC73C\uB85C \uB0A8\uAE30\uAE30"], [50, "\uC5EC\uC720\uAE08 \uC808\uBC18 \uC608\uC57D \xB7 \uBC30\uBD84 \uAC80\uD1A0"], [100, "\uC5EC\uC720\uAE08 \uC804\uC561 \uC608\uC57D \xB7 \uBC30\uBD84 \uAC80\uD1A0"]]) {
          const b = document.createElement("button");
          b.dataset.planPercent = String(percent);
          b.textContent = text;
          b.disabled = !cashPlanCanSet(percent) || percent > 0 && !choices.length;
          if (!cashPlanCanSet(percent)) b.textContent += " \xB7 \uB2E4\uC74C \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC124\uC815";
          b.onclick = () => {
            if (percent && mode.value === "dual" && first.value === second.value) {
              error.textContent = "\uC11C\uB85C \uB2E4\uB978 \uB450 \uB300\uC0C1\uC744 \uACE8\uB77C \uC8FC\uC138\uC694.";
              return;
            }
            const product = first.value || jobPlanProduct();
            renderCashAllocationPlan({ percent, product, ...percent && mode.value === "dual" ? { allocation: [{ product, share: Number(share.value) }, { product: second.value, share: 100 - Number(share.value) }] } : {} });
          };
          box.append(b);
        }
      }
      const back = document.createElement("button");
      back.id = "cash-allocation-back";
      back.textContent = "\uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.append(back);
      renderPortfolio();
    }
    function cashFlowReview(s, gross) {
      const b = s.assetReviewBaseline, rows = s.cashEvents?.rows, month = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1 : null;
      if (!b || b.version !== 1 || b.source !== "new-game" || b.totalAssets !== 1e6 || month(b.month) === null || month(s.month) === null || !Array.isArray(rows) || rows.length !== Math.min(month(s.month), month("2026-10")) - month(b.month) || !Number.isFinite(gross)) return { available: false };
      let income = 0, billed = 0, paid = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (month(r.month) !== month(b.month) + i + 1 || ![r.income, r.living, r.tuition, r.paid].every((x) => Number.isFinite(x) && x >= 0) || r.paid > r.living + r.tuition) return { available: false };
        income += r.income;
        billed += r.living + r.tuition;
        paid += r.paid;
      }
      return { available: true, basis: "career-cash-review-v1", startMonth: b.month, endMonth: s.month, months: rows.length, openingAssets: b.totalAssets, income, billed, paid, unpaid: billed - paid, gross, net: gross - billed + paid, remainder: gross - b.totalAssets - income + paid };
    }
    function validCashFlowReview(r, expectedGross = null) {
      const mi = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1 : null;
      return !(!r?.available || mi(r.startMonth) === null || mi(r.endMonth) === null || !Number.isInteger(r.months) || r.months < 0 || r.months !== Math.min(mi(r.endMonth), mi("2026-10")) - mi(r.startMonth) || r.openingAssets !== 1e6 || [r.income, r.billed, r.paid, r.unpaid, r.gross].some((x) => !Number.isFinite(x) || x < 0) || expectedGross !== null && r.gross !== expectedGross || r.basis !== "career-cash-review-v1" || ![r.openingAssets, r.income, r.billed, r.paid, r.unpaid, r.gross, r.net, r.remainder].every(Number.isFinite) || r.unpaid !== r.billed - r.paid || Math.abs(r.gross - r.openingAssets - r.income + r.paid - r.remainder) > 0.01 || Math.abs(r.net - r.gross + r.unpaid) > 0.01);
    }
    function cashFlowReviewHtml(r, recorded = false, expectedGross = null) {
      if (!validCashFlowReview(r, expectedGross)) return '<details class="asset-review"><summary>\uD604\uAE08\uC0AC\uAC74 \uC790\uC0B0 \uBCF5\uAE30 \xB7 \uAE30\uB85D \uD655\uC778 \uD544\uC694</summary><p class="note">\uC218\uC785\xB7\uB0A9\uBD80\xB7\uBBF8\uB0A9 \uAE30\uB85D\uC774 \uC628\uC804\uD558\uC9C0 \uC54A\uC544 \uD22C\uC790 \uBCC0\uD654\uB85C \uCD94\uC815 \uBD84\uD574\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p></details>';
      const money = (x) => (Object.is(x, -0) ? 0 : x).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "\uC6D0", row = (k, v) => '<div class="row"><span>' + k + "</span><strong>" + money(v) + "</strong></div>";
      return '<details class="asset-review cash-flow-review"><summary>\uD604\uAE08\uC0AC\uAC74 \uC790\uC0B0 \uBCF5\uAE30 \xB7 ' + (recorded ? "\uC885\uB8CC \uB2F9\uC2DC" : "\uC218\uC785\xB7\uB0A9\uBD80\uC640 \uC790\uC0B0 \uBCC0\uD654 \uBD84\uB9AC") + '</summary><p class="note">' + esc(r.startMonth) + "\uBD80\uD130 " + esc(r.endMonth) + " \uAD00\uCE21 \xB7 " + r.months + "\uAC1C\uC6D4. \uC2E4\uC81C\uB85C \uAE30\uB85D\uD55C \uAC8C\uC784 \uD604\uAE08\uC0AC\uAC74\uB9CC \uBD84\uB9AC\uD558\uBA70 \uBBF8\uAE30\uB85D \uACFC\uAC70\uB97C \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>" + row("\uC2DC\uC791\uC790\uAE08", r.openingAssets) + row("\uAE30\uB85D \uC218\uC785", r.income) + row("\uC2E4\uC81C \uB0A9\uBD80 \uCC28\uAC10", -r.paid) + row("\uC0C1\uD488 \uBCC0\uD654 \uB4F1 \uC794\uCC28", r.remainder) + row("\uCD1D\uC790\uC0B0 \xB7 \uBBF8\uB0A9 \uCC28\uAC10 \uC804", r.gross) + row("\uCCAD\uAD6C \uB204\uACC4", r.billed) + row("\uB0A8\uC740 \uBBF8\uB0A9 \uCC28\uAC10", -r.unpaid) + row("\uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0", r.net) + '<p class="note">\uCD1D\uC790\uC0B0 = \uC2DC\uC791\uC790\uAE08 + \uC218\uC785 - \uC2E4\uC81C \uB0A9\uBD80 + \uC794\uCC28. \uC21C\uC790\uC0B0 = \uCD1D\uC790\uC0B0 - \uBBF8\uB0A9. \uC794\uCC28\uC5D0\uB294 \uD3C9\uAC00\xB7\uD658\uC728\xB7\uC774\uC790\xB7\uBC18\uC62C\uB9BC \uB4F1\uC774 \uC11E\uC774\uBA70 \uD22C\uC790\uC218\uC775\uB960\uC774\uB098 \uC2E4\uD604\uC218\uC775\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC608\uC57D\uAE08\xB7\uB9E4\uB3C4 \uC7A0\uAE08\uB3C4 \uCD1D\uC790\uC0B0\uC5D0 \uD3EC\uD568\uD558\uBA70 \uC790\uB3D9\uC608\uC57D \uC6D0\uAE08 \uC774\uB3D9\uC744 \uC218\uC785\uC73C\uB85C \uB354\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC218\uC785\xB7\uC0DD\uD65C\xB7\uD559\uBE44\uB294 \uACE0\uC815 \uAC8C\uC784 \uC124\uACC4\uAC12, \uC138\uAE08\xB7\uBCF4\uD5D8\xB7\uC778\uD50C\uB808\xB7\uB300\uCD9C\uC740 \uC5F0\uACB0\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p></details>';
    }
    function careerCashSchedule(month) {
      const b = state.flags.birth;
      const mil = militaryActive();
      const inHS = !!(b && !state.flags.academicStatus && month < b.hsYear + 3 + "-03");
      const college = state.flags.academicStatus === "college";
      const graduated = state.flags.academicStatus === "graduated";
      const alba = !mil && (state.flags.studyPath === "parttime" && inHS || state.academic && state.academic.policy === "balanced" && inHS || state.acadRules === 3 && college && state.colPolicy === "balanced");
      const job = !mil && state.flags.career === "job" && graduated;
      const recoveredAlba = !mil && state.flags.recoveryJob === "alba";
      const income = job ? CCV.JOB_INCOME : alba || recoveredAlba ? CCV.ALBA_INCOME : 0;
      const living = mil ? CCV.LIVING_MILITARY : inHS || college ? CCV.LIVING_STUDENT : CCV.LIVING_ADULT;
      const termMonth = month.slice(5) === "03" || month.slice(5) === "09";
      const tuition = college && !mil && termMonth ? CCV.TUITION_PER_TERM : 0;
      return { income, living, tuition };
    }
    function careerCashUnpaid() {
      if (!state.cashEvents) return 0;
      return state.cashEvents.rows.reduce((v, r) => v + r.living + r.tuition - r.paid, 0);
    }
    function applyCareerCashMonth() {
      if (cashPlanActive() && state.cashEvents?.rows.at(-1)?.month === state.month) return;
      const s = careerCashSchedule(state.month);
      state.cash += s.income;
      const due = s.living + s.tuition;
      const pay = Math.min(state.cash, due);
      state.cash -= pay;
      state.cashEvents = state.cashEvents || { version: 1, rows: [] };
      state.cashEvents.rows.push({ month: state.month, income: s.income, living: s.living, tuition: s.tuition, status: pay === due ? "paid" : "partial", paid: pay });
      state.lastSavings = 0;
    }
    function albaWonPhrase() {
      return careerCashActive() ? "\uC6D4 " + CCV.ALBA_INCOME.toLocaleString() + "\uC6D0[\uC124\uACC4\uAC12]" : "\uC6D4 " + Math.round(SAVINGS_BASE * 0.2).toLocaleString() + "\uC6D0[\uC2DC\uD5D8\uAC12]";
    }
    function careerCashRepay() {
      if (storageWriteBlocked || storageReadBlocked || !careerCashActive() || !state.cashEvents) return;
      const unpaid = careerCashUnpaid();
      if (unpaid <= 0 || state.cash <= 0) return;
      const repaymentUnlockNotice = careerCashRepaymentUnlockNotice();
      if (!confirm("\uBBF8\uB0A9 " + unpaid.toLocaleString() + "\uC6D0 \uC911 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0\uC73C\uB85C \uAC00\uC7A5 \uC624\uB798\uB41C \uB2EC\uBD80\uD130 \uC21C\uC11C\uB300\uB85C \uB0A9\uBD80\uD560\uAE4C\uC694? \uD55C \uB2EC \uCCAD\uAD6C\uC758 \uBD80\uBD84\uB0A9\uBD80\uB294 \uC5C6\uACE0 \uC6D4\xB7\uB274\uC2A4\xB7\uC9C4\uB85C\uB294 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC2B5\uB2C8\uB2E4." + (repaymentUnlockNotice ? "\n\n" + repaymentUnlockNotice : ""))) return;
      if (storageWriteBlocked) return;
      let paidTotal = 0;
      for (const r of state.cashEvents.rows) {
        const rem = r.living + r.tuition - r.paid;
        if (rem <= 0) continue;
        if (state.cash < rem) break;
        state.cash -= rem;
        r.paid += rem;
        r.status = "paid";
        paidTotal += rem;
      }
      if (paidTotal > 0) {
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "career-cash:repay:" + paidTotal });
        save();
        render();
      }
    }
    function careerCashRepaymentPreview() {
      if (!careerCashActive() || !state.cashEvents || !Array.isArray(state.cashEvents.rows) || !Number.isFinite(state.cash) || state.cash < 0) return null;
      let cash = state.cash, paid = 0, count = 0, unpaid = 0;
      for (const r of state.cashEvents.rows) {
        if (![r.living, r.tuition, r.paid].every((x) => Number.isFinite(x) && x >= 0)) return null;
        const remainder = r.living + r.tuition - r.paid;
        if (remainder < 0) return null;
        unpaid += remainder;
      }
      if (unpaid <= 0) return null;
      for (const r of state.cashEvents.rows) {
        const remainder = r.living + r.tuition - r.paid;
        if (remainder <= 0) continue;
        if (cash < remainder) break;
        cash -= remainder;
        paid += remainder;
        count++;
      }
      return { paid, count, cashAfter: cash, unpaidAfter: unpaid - paid };
    }
    function careerCashRepaymentUnlockNotice() {
      if (!careerCashBuyHoldOn()) return "";
      const p = careerCashRepaymentPreview();
      if (!p || p.paid <= 0 || p.unpaidAfter !== 0) return "";
      const buys = (state.pendingOrders || []).filter((o) => o.kind === "buy").length;
      if (!buys) return "";
      return "\uC774\uBC88 \uC0C1\uD658\uC73C\uB85C \uBBF8\uB0A9\uC774 \uC5C6\uC5B4\uC9C0\uBA74 \uAE30\uC874 \uB300\uAE30 \uB9E4\uC218 " + buys + '\uAC74\uC758 \uBCF4\uB958\uAC00 \uD480\uB9BD\uB2C8\uB2E4. \uC811\uC218 \uB4A4 \uD655\uBCF4\uB41C \uC801\uACA9 \uC9C0\uC810\uC774 \uC774\uBBF8 \uC788\uC73C\uBA74 \uC0C8 \uC9C0\uC810\uC744 \uAE30\uB2E4\uB9AC\uC9C0 \uC54A\uACE0 \uAC19\uC740 \uD654\uBA74 \uAC31\uC2E0\uC5D0 \uC608\uC57D\uAE08\uC73C\uB85C \uCCB4\uACB0\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC870\uAC74\xB7\uAE30\uD55C\xB7\uBD84\uD560\xB7\uC0C1\uD488 \uC811\uADFC\xB7\uBD84\uAE30 \uC815\uC0B0 \uADDC\uCE59\uC740 \uADF8\uB300\uB85C\uC5EC\uC11C \uC804\uBD80 \uCCB4\uACB0\uB418\uB294 \uAC83\uC740 \uC544\uB2D9\uB2C8\uB2E4. \uC6D0\uCE58 \uC54A\uC73C\uBA74 \uBA3C\uC800 \uC790\uC0B0\uD45C \uC544\uB798 \uB300\uAE30 \uC8FC\uBB38\uC758 "\uC8FC\uBB38 \uCDE8\uC18C"\uC5D0\uC11C \uAC80\uD1A0\uD558\uC138\uC694. \uC0C8 \uB9E4\uC218\uB97C \uC811\uC218\uD558\uB294 \uAE30\uB2A5\uC740 \uC544\uB2D9\uB2C8\uB2E4.';
    }
    function careerCashRepaymentPreviewHtml() {
      const p = careerCashRepaymentPreview();
      if (!p) return "";
      const unlockNotice = careerCashRepaymentUnlockNotice();
      return '<div class="note career-repayment-preview" style="margin:10px 0;padding:10px 0;border-top:1px solid #ddd"><strong>\uC0C1\uD658 \uBBF8\uB9AC\uBCF4\uAE30</strong><br>' + (p.paid > 0 ? p.count + "\uAC1C\uC6D4 \uC794\uC561 " + p.paid.toLocaleString() + "\uC6D0 \uB0A9\uBD80 \uAC00\uB2A5" : "\uC9C0\uAE08\uC740 \uB0A9\uBD80 \uAC00\uB2A5\uD55C \uCCAD\uAD6C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4") + "<br>\uC0C1\uD658 \uD6C4 \uD604\uAE08 " + p.cashAfter.toLocaleString() + "\uC6D0<br>\uC0C1\uD658 \uD6C4 \uBBF8\uB0A9 " + p.unpaidAfter.toLocaleString() + '\uC6D0<details><summary style="min-height:32px;cursor:pointer">\uC0C1\uD658 \uAE30\uC900</summary>\uC624\uB798\uB41C \uB2EC\uBD80\uD130 \uADF8\uB2EC\uC758 \uB0A8\uC740 \uCCAD\uAD6C \uC804\uC561\uC744 \uAC1A\uC73C\uBA70, \uD604\uAE08\uC774 \uBD80\uC871\uD55C \uCCAB \uB2EC\uC5D0\uC11C \uBA48\uCDA5\uB2C8\uB2E4. \uC774\uBBF8 \uC77C\uBD80 \uB0A9\uBD80\uD55C \uB2EC\uC740 \uC794\uC561\uB9CC \uD544\uC694\uD569\uB2C8\uB2E4. \uD604\uAE08\uB9CC \uC0AC\uC6A9\uD558\uBA70 \uBCF4\uC720\uC790\uC0B0\xB7\uB9E4\uB3C4 \uB300\uAE30\uAE08\xB7\uBBF8\uB798 \uC218\uC785\uC740 \uC81C\uC678\uD569\uB2C8\uB2E4. \uBBF8\uB9AC\uBCF4\uAE30\uB294 \uC6D4\xB7\uB3C8\xB7\uAE30\uB85D\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC73C\uBA70, \uC544\uB798 \uBC84\uD2BC\uC5D0\uC11C \uD655\uC778\uD574\uC57C \uB0A9\uBD80\uB429\uB2C8\uB2E4.</details>' + (unlockNotice ? '<p class="career-repayment-unlock-note" style="margin:8px 0 0;color:#8a4b00">' + esc(unlockNotice) + "</p>" : "") + "</div>";
    }
    function careerCashHtml() {
      if (!careerCashActive() || !state.cashEvents) return "";
      const rows = state.cashEvents.rows;
      const income = rows.reduce((v, r) => v + r.income, 0);
      const billed = rows.reduce((v, r) => v + r.living + r.tuition, 0);
      const paidAmt = rows.reduce((v, r) => v + r.paid, 0);
      const unpaid = careerCashUnpaid();
      const gross = totalAssets();
      const observedMonth = state.month > GAME_END ? GAME_END : state.month;
      const s = rows.find((r) => r.month === observedMonth);
      const currentLabel = (state.month > GAME_END ? "\uB9C8\uC9C0\uB9C9 \uACBD\uC81C\uC6D4 \uAE30\uB85D" : "\uC774\uBC88 \uB2EC \uAE30\uB85D") + " \xB7 " + observedMonth;
      return '<div class="cash-events-review"><h3>\uC6D4 \uD604\uAE08\uC0AC\uAC74 \uC7A5\uBD80 \xB7 ' + (cashPlanActive() ? "\uBCF8\uD3B8 \uC5F0\uACB0" : "\uC0C8 \uACBD\uC81C \uC2DC\uC81C") + ' [\uBA85\uC2DC \uAC8C\uC784\uC124\uACC4\uAC12]</h3><p class="note">\uC2E4\uC81C \uAE09\uC5EC\xB7\uBB3C\uAC00\xB7\uD559\uBE44 \uD1B5\uACC4\uAC00 \uC544\uB2CC \uAC8C\uC784 \uC124\uACC4\uAC12\uC785\uB2C8\uB2E4. \uC218\uC785\uC740 \uC6D4 \uC9C4\uD589 \uB54C \uC785\uAE08\uB418\uACE0 \uC0DD\uD65C\xB7\uD559\uBE44 \uCCAD\uAD6C\uAC00 \uAC19\uC740 \uB2EC\uC5D0 \uCC28\uAC10\uB429\uB2C8\uB2E4. \uD604\uAE08\uC774 \uBD80\uC871\uD558\uBA74 \uBD80\uC871\uBD84\uC774 \uBBF8\uB0A9\uC73C\uB85C \uB0A8\uACE0 \uC74C\uC218 \uD604\uAE08\xB7\uC790\uB3D9\uB9E4\uB3C4\xB7\uB300\uCD9C\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC740 \uC774 \uBAA8\uD615\uC5D0 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4(\uC774\uC911 \uBC18\uC601 \uC5C6\uC74C).</p><div class="row cash-event-current"><span>' + currentLabel + " [\uC124\uACC4\uAC12]</span><span>" + (s ? "\uC218\uC785 +" + s.income.toLocaleString() + "\uC6D0 / \uC0DD\uD65C " + s.living.toLocaleString() + "\uC6D0 / \uD559\uBE44 " + s.tuition.toLocaleString() + "\uC6D0" : "\uC544\uC9C1 \uAE30\uB85D\uB41C \uC218\uC785\xB7\uCCAD\uAD6C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC6D4 \uC9C4\uD589 \uC804 \uACC4\uD68D\uAC12\uC744 \uC785\uAE08\uC73C\uB85C \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.") + '</span></div><div class="row"><span>\uAE30\uB85D\uB41C \uC218\uC785 \uB204\uACC4 \xB7 ' + rows.length + "\uAC1C\uC6D4</span><strong>+" + income.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uCCAD\uAD6C \uB204\uACC4 / \uB0A9\uBD80 \uB204\uACC4</span><strong>' + billed.toLocaleString() + "\uC6D0 / " + paidAmt.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uBBF8\uB0A9 \uB204\uACC4</span><strong>' + unpaid.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uCD1D\uC790\uC0B0(\uBBF8\uB0A9 \uCC28\uAC10 \uC804)</span><strong>' + gross.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0</span><strong>' + (gross - unpaid).toLocaleString() + '\uC6D0</strong></div><p class="note">\uBBF8\uB0A9\uC740 \uBA74\uC81C\uB418\uC9C0 \uC54A\uC73C\uBA70 \uCD1D\uC790\uC0B0\uACFC \uB530\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0\uC740 \uD22C\uC790\uC218\uC775\uB960\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uB0A9\uBD80\uB294 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uC73C\uB85C\uB9CC \uD558\uACE0 \uC608\uC57D\uD604\uAE08\xB7\uBBF8\uCCB4\uACB0 \uB9E4\uB3C4 \uD3C9\uAC00\uB294 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uB0A9\uC774 \uC788\uB294 \uB3D9\uC548 \uC0C8 \uB9E4\uC218 \uC8FC\uBB38 \uC811\uC218\uC640 \uBBF8\uB9AC \uB123\uC740 \uB9E4\uC218 \uC8FC\uBB38\uC758 \uCCB4\uACB0\uC774 \uBCF4\uB958\uB429\uB2C8\uB2E4(\uC720\uC9C0\xB7\uB9E4\uB3C4\xB7\uBBF8\uCCB4\uACB0 \uCDE8\uC18C\xB7\uC0C1\uD658\uC740 \uAC00\uB2A5) [core-v11 \uC124\uACC4 \uADDC\uCE59].</p>' + (state.careerCashRules >= 2 ? "" : '<p class="note">\uC774 \uC800\uC7A5\uC740 \uC0DD\uC131 \uB2F9\uC2DC \uADDC\uCE59(\uBBF8\uB0A9 \uC911 \uB9E4\uC218 \uC81C\uD55C \uC5C6\uC74C \xB7 \uC804\uC5C5 \uD6C4 \uD68C\uBCF5 \uC120\uD0DD \uC5C6\uC74C)\uC73C\uB85C \uC774\uC5B4\uAC11\uB2C8\uB2E4. \uB9E4\uC218 \uC81C\uD55C\uACFC \uD68C\uBCF5 \uC120\uD0DD\uC740 \uC0C8 \uC2DC\uC791\uBD80\uD130 \uC801\uC6A9\uB418\uBA70 \uC774 \uC800\uC7A5\uC758 \uD589\uB3D9\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>') + (state.careerCashRules === 2 ? '<p class="note">\uC774 \uC800\uC7A5\uC740 \uC0DD\uC131 \uB2F9\uC2DC \uADDC\uCE59(\uC804\uC5C5 \uD6C4 \uC54C\uBC14\xB7\uC7AC\uCDE8\uC5C5 \uD68C\uBCF5 \uC120\uD0DD \uC5C6\uC74C)\uC73C\uB85C \uC774\uC5B4\uAC11\uB2C8\uB2E4. \uD68C\uBCF5 \uC120\uD0DD\uC740 \uC0C8 \uC2DC\uC791\uBD80\uD130 \uC801\uC6A9\uB418\uBA70 \uC774 \uC800\uC7A5\uC758 \uD589\uB3D9\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' : "") + '<details class="cash-event-ledger"><summary>\uD604\uAE08\uC0AC\uAC74 \uC7A5\uBD80 \xB7 \uCD5C\uADFC 12\uAC1C\uC6D4</summary>' + rows.slice(-12).reverse().map((r) => '<p class="note">' + esc(r.month) + " / \uC218\uC785 +" + r.income.toLocaleString() + "\uC6D0 / \uC0DD\uD65C " + r.living.toLocaleString() + "\uC6D0 / \uD559\uBE44 " + r.tuition.toLocaleString() + "\uC6D0 / \uB0A9\uBD80 " + r.paid.toLocaleString() + "\uC6D0" + (r.paid < r.living + r.tuition ? " (\uBBF8\uB0A9 " + (r.living + r.tuition - r.paid).toLocaleString() + "\uC6D0)" : "") + "</p>").join("") + "</details>" + careerCashRepaymentPreviewHtml() + (unpaid > 0 ? '<button id="career-cash-repay" style="min-height:44px">\uBBF8\uB0A9 \uC0C1\uD658 (\uC624\uB798\uB41C \uB2EC\uBD80\uD130 \xB7 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08 \uBC94\uC704)</button>' : "") + "</div>";
    }
    function careerCashSummary() {
      const rows = state.cashEvents && state.cashEvents.rows || [];
      return { ...cashPlanActive() ? { assetReview: cashFlowReview(state, totalAssets()) } : {}, months: rows.length, income: rows.reduce((v, r) => v + r.income, 0), paid: rows.reduce((v, r) => v + r.paid, 0), unpaid: careerCashUnpaid(), buyHold: state.careerCashRules >= 2 };
    }
    function lifeEndHtml() {
      if (!SCHOOL_MODE || CASH_MODE || CAREER_TRIAL || GAME_LIVING || !state.flags.birth) return "";
      const f = state.flags, b = f.birth, at = state.month > GAME_END ? GAME_END : state.month;
      if (!Number.isInteger(b.hsYear) || !/^\d{4}-\d{2}$/.test(at)) return "";
      const highschool = at < b.hsYear + 3 + "-03";
      const study = f.studyPath === "parttime" ? highschool ? "\uACE0\uAD50 \uC7AC\uD559" : "\uB300\uD559 \uC878\uC5C5 \uAE30\uB85D \uC5C6\uC74C" : f.academicStatus === "graduated" ? "\uB300\uD559 \uC878\uC5C5" : f.academicStatus === "college" ? "\uB300\uD559 \uC7AC\uD559" + (Number.isFinite(f.enrolledMonths) ? " \xB7 \uC7AC\uD559 \uB204\uC801 " + f.enrolledMonths + "\uAC1C\uC6D4" : "") : highschool ? "\uACE0\uAD50 \uC7AC\uD559" : "\uB300\uD559 \uC878\uC5C5 \uAE30\uB85D \uC5C6\uC74C";
      const serving = !!(f.militaryStart && f.militaryUntil && f.militaryStart <= at && at < f.militaryUntil);
      const service = serving ? "\uBCF5\uBB34 \uC911 \xB7 \uC804\uC5ED \uC608\uC815 " + f.militaryUntil + " [\uAC8C\uC784 \uC77C\uC815]" : f.dischargeShown ? "\uC804\uC5ED \uD655\uC778 \uC644\uB8CC" : f.militaryStart ? "\uC804\uC5ED \uD655\uC778 \uC804" + (f.militaryUntil ? " \xB7 \uC608\uC815 " + f.militaryUntil + " [\uAC8C\uC784 \uC77C\uC815]" : "") : "\uBBF8\uC785\uB300" + (f.enlistAt ? " \xB7 \uC785\uB300 \uC608\uC815 " + f.enlistAt + " [\uAC8C\uC784 \uC77C\uC815]" : " \xB7 \uC77C\uC815 \uBBF8\uAE30\uB85D");
      const work = serving ? "\uBCF5\uBB34\uB85C \uC2DC\uC7A5 \uB300\uC751 \uC81C\uD55C" : highschool ? f.studyPath === "parttime" ? "\uACE0\uAD50 \uC54C\uBC14 \uBCD1\uD589" : f.studyPath === "study" ? "\uACE0\uAD50 \uD559\uC5C5 \uACBD\uB85C" : "\uCCAB \uBC29\uD5A5 \uC120\uD0DD \uC804" : f.academicStatus === "college" ? state.colPolicy === "balanced" ? "\uB300\uD559 \uC54C\uBC14 \uBCD1\uD589" : state.colPolicy === "focus" ? "\uB300\uD559 \uD559\uC5C5 \uC911\uC2EC" : "\uB300\uD559 \uBC29\uCE68 \uC120\uD0DD \uC804" : f.career === "job" ? "\uCDE8\uC5C5 \uACBD\uB85C" : f.recoveryJob === "alba" ? "\uC54C\uBC14 \uBCD1\uD589 \uD22C\uC790" : fulltimeActive() ? "\uC804\uC5C5 \uD22C\uC790 \uACBD\uB85C" : "\uC9C4\uB85C \uC120\uD0DD \uC804";
      const row = (label, text) => '<div class="row"><span>' + label + "</span><strong>" + esc(text) + "</strong></div>";
      return '<section class="life-ending-position" aria-label="\uC885\uB8CC \uC2DC\uC810 \uC0B6\uC758 \uC0C1\uD0DC"><h3>\uC774 \uC0B6\uC774 \uBA48\uCD98 \uC790\uB9AC</h3><p>' + esc(at) + "\uAE4C\uC9C0 \uC9C4\uD589\uD55C \uAC8C\uC784 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.</p>" + row("\uD559\uC801", study) + row("\uC0DD\uD65C \uBC29\uD5A5", work) + row("\uBCF5\uBB34", service) + '<p class="note">\uC885\uB8CC \uB4A4 \uB0A8\uC740 \uC7AC\uD559\xB7\uBCF5\uBB34\uB97C \uC790\uB3D9\uC73C\uB85C \uB9C8\uCE58\uAC70\uB098 \uC774\uD6C4 \uAE09\uC5EC\xB7\uD559\uBE44\xB7\uC2DC\uC138\uB97C \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC608\uC815\uC740 \uC774\uBBF8 \uC800\uC7A5\uB41C \uAC8C\uC784 \uC77C\uC815\uC774\uBA70 \uC2E4\uC81C \uD559\uC81C\xB7\uBCD1\uC5ED \uADDC\uC815\uC774\uB098 \uC774 \uC0AC\uB78C\uC758 \uD604\uC2E4 \uC774\uB825\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC774 \uD45C\uB294 \uACB0\uC0B0 \uC804\uC6A9\uC774\uBA70, \uBCF4\uAD00 \uAE30\uB85D\uC5D0\uB294 \uAE30\uC874 \uC8FC\uC694 \uC120\uD0DD\uACFC \uC790\uAE08 \uD750\uB984\uC774 \uB0A8\uC2B5\uB2C8\uB2E4.</p></section>';
    }
    function careerEndHtml() {
      if (!careerCashActive() || !state.cashEvents) return lifeEndHtml();
      const u = careerCashUnpaid();
      return '<section class="cash-ending-summary"><div class="row"><span>\uB0A8\uC740 \uBBF8\uB0A9</span><strong>' + u.toLocaleString() + '\uC6D0</strong></div><div class="row"><span>\uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0</span><strong>' + (totalAssets() - u).toLocaleString() + '\uC6D0</strong></div><p class="note">\uBBF8\uB0A9\uC740 \uBA74\uC81C\uB418\uC9C0 \uC54A\uACE0 \uC704 \uCD1D\uC790\uC0B0\uC5D0\uC11C \uCC28\uAC10\uB429\uB2C8\uB2E4. \uD604\uC2E4 \uC0DD\uACC4\xB7\uC9C4\uB85C\uC758 \uD310\uC815\uC774 \uC544\uB2CC \uACE0\uC815 \uAC8C\uC784\uC124\uACC4\uAC12\uC785\uB2C8\uB2E4.</p></section>' + lifeEndHtml();
    }
    function monthlySavings() {
      if (CASH_MODE) return 0;
      if (militaryActive()) return 0;
      const b = state.flags.birth;
      if (!b) return SAVINGS_BASE;
      if (state.flags.studyPath === "study" && state.academic && state.academic.policy === "balanced" && !state.flags.academicStatus && state.month < b.hsYear + 3 + "-03") return Math.round(SAVINGS_BASE * 0.2);
      if (state.acadRules === 3 && state.flags.studyPath === "study" && state.flags.academicStatus === "college" && state.colPolicy === "balanced") return Math.round(SAVINGS_BASE * 0.2);
      if (state.flags.studyPath === "parttime" && state.month < b.hsYear + 3 + "-03") return Math.round(SAVINGS_BASE * 0.2);
      if (state.flags.career === "job" && state.flags.academicStatus === "graduated") return SAVINGS_BASE;
      if (!state.flags.studyPath) return SAVINGS_BASE;
      return 0;
    }
    function wasObservableAt(pt, cutoff, postClose) {
      if (!cutoff) return false;
      if (!GAME_LIVING && pt.model === "b-monthly-2019q3") return false;
      if (pt.usable_from) return pt.usable_from <= cutoff;
      return postClose ? pt.date <= cutoff : pt.date < cutoff;
    }
    function expireBuyOrders() {
      let changed = false;
      state.pendingOrders = (state.pendingOrders || []).filter((o) => {
        if (o.kind !== "buy" || !o.expiresAt || state.month < o.expiresAt) return true;
        const refund = o.split && o.split.n > 1 ? o.amount - (o.split.invested || 0) : o.amount;
        state.cash += refund;
        state.history.push({ month: state.month, choice: "order-expired:" + o.product, orderId: o.id, expiresAt: o.expiresAt, refund });
        changed = true;
        return false;
      });
      return changed;
    }
    function tryFillOrders() {
      if (cashPlanActive()) prepareCashPlanMonth();
      return legacyTryFillOrders();
    }
    function legacyTryFillOrders() {
      if (!state.pendingOrders) state.pendingOrders = [];
      expireBuyOrders();
      if (!state.pendingOrders.length) return;
      const fills = [];
      for (const o of state.pendingOrders) {
        if (o.kind === "buy" && careerCashBuyHoldOn() && careerCashUnpaid() > 0) continue;
        if (!o.obsCutoff || typeof o.obsPostClose !== "boolean") continue;
        if (o.earliestFillMonth && (state.flags.settledMonth || "") < o.earliestFillMonth) continue;
        const u = productRule(o.product);
        if (!productAvailable(u)) continue;
        const pt = priceAt(u.series || o.product, state.month);
        if (!pt || wasObservableAt(pt, o.obsCutoff, o.obsPostClose)) continue;
        if (!wasObservableAt(pt, effDate, effPostClose)) continue;
        if (o.condition) {
          if (o.conditionRules === 1) {
            if (o.condition.op === "below" ? pt.value > o.condition.value : pt.value < o.condition.value) continue;
          } else {
            if (o.kind === "buy" && o.condition.op === "below" && pt.value > o.condition.value) continue;
            if (o.kind === "sell" && o.condition.op === "above" && pt.value < o.condition.value) continue;
          }
        }
        let fillAmount = o.amount, fillQty = o.qty, fillCostBasis = o.costBasis;
        if (o.split && o.split.n > 1) {
          const ptKey = pt.usable_from || pt.date;
          if (o.split.lastPtKey === ptKey) continue;
          const left = o.split.n - (o.split.filled || 0);
          if (o.kind === "buy") {
            const remaining = o.amount - (o.split.invested || 0);
            fillAmount = left === 1 ? remaining : Math.round(o.amount / o.split.n);
            if (fillAmount <= 0 || fillAmount > remaining) fillAmount = remaining;
            if (fillAmount <= 0) {
              o._filled = true;
              continue;
            }
          } else {
            const remainingQty = o.qty - (o.split.soldQty || 0);
            const remainingCost = o.costBasis - (o.split.soldCostBasis || 0);
            fillQty = left === 1 ? remainingQty : o.qty / o.split.n;
            fillCostBasis = left === 1 ? remainingCost : Math.round(o.costBasis / o.split.n);
            if (fillQty <= 0) {
              o._filled = true;
              continue;
            }
          }
        }
        let unitPrice = pt.value;
        let fxPtDate = null;
        if (u.rule === "fxprice") {
          const fxpt = priceAt("fx", state.month);
          if (!fxpt) continue;
          unitPrice = pt.value * fxpt.value;
          fxPtDate = fxpt.date;
        }
        let basePtValue = null;
        if (u && (u.rule || "price") === "price" && typeof o.basePtDate === "string") {
          const bp = DATA.prices.find((x) => x.series === (u.series || o.product) && x.date === o.basePtDate && !x.uncertain && !x.unverified);
          if (bp && Number.isFinite(bp.value) && bp.value > 0) basePtValue = bp.value;
        }
        if (o.kind === "buy") {
          const h = state.holdings[o.product] || { qty: 0, avgPrice: 0 };
          const qty = fillAmount / unitPrice;
          const nq = h.qty + qty;
          h.avgPrice = (h.avgPrice * h.qty + fillAmount) / nq;
          h.qty = nq;
          h.entryMonth = state.month;
          if (u.rule === "fxaccrual") h.invested = (h.invested || 0) + fillAmount;
          state.holdings[o.product] = h;
          fills.push({ kind: "buy-fill", ...o.planOrigin ? { planOrigin: o.planOrigin } : {}, ...o.condition ? { conditional: true, conditionOp: o.condition.op, conditionValue: o.condition.value } : {}, basePtDate: o.basePtDate || null, basePtValue, product: o.product, amount: fillAmount, price: unitPrice, ptDate: pt.date, month: state.month, obsCutoff: o.obsCutoff || null, usableFrom: pt.usable_from || null, fxPtDate, ...o.split && o.split.n > 1 ? { splitPart: (o.split.filled || 0) + 1, splitN: o.split.n } : {} });
        } else {
          const proceeds = Math.round(unitPrice * fillQty);
          state.cash += proceeds;
          const mSell = marketSizeOf(o.product, state.month);
          if (mSell && mSell.size) {
            state.chaos = Math.round((state.chaos + proceeds / mSell.size * CHAOS.sellImpactFactor * chaosWeight(o.product)) * 10) / 10;
            if (state.chaos >= CHAOS.overAt) state.flags.gameOver = "chaos";
          }
          fills.push({ kind: "sell-fill", ...o.condition ? { conditional: true, conditionOp: o.condition.op, conditionValue: o.condition.value } : {}, basePtDate: o.basePtDate || null, basePtValue, product: o.product, proceeds, costBasis: fillCostBasis, pnl: proceeds - fillCostBasis, price: unitPrice, ptDate: pt.date, month: state.month, obsCutoff: o.obsCutoff || null, usableFrom: pt.usable_from || null, fxPtDate, ...o.split && o.split.n > 1 ? { splitPart: (o.split.filled || 0) + 1, splitN: o.split.n } : {} });
        }
        if (o.split && o.split.n > 1) {
          o.split.filled = (o.split.filled || 0) + 1;
          o.split.lastPtKey = pt.usable_from || pt.date;
          if (o.kind === "buy") o.split.invested = (o.split.invested || 0) + fillAmount;
          else {
            o.split.soldQty = (o.split.soldQty || 0) + fillQty;
            o.split.soldCostBasis = (o.split.soldCostBasis || 0) + fillCostBasis;
          }
          if (o.split.filled >= o.split.n) o._filled = true;
        } else {
          o._filled = true;
        }
      }
      if (fills.length) {
        state.pendingOrders = state.pendingOrders.filter((o) => !o._filled);
        state.lastFills = (state.lastFills || []).concat(fills);
        state.fillsLog = (state.fillsLog || []).concat(fills);
      }
    }
    function orderConditionReview(id) {
      if (CASH_MODE || !fulltimeActive() || state.flags.gameOver || state.month > GAME_END || !albaTimeAvailable()) return null;
      const o = (state.pendingOrders || []).find((x) => x.id === id);
      if (!o || !["buy", "sell"].includes(o.kind) || o.reserve || productRule(o.product).rule !== "price" || !o.obsCutoff || typeof o.obsPostClose !== "boolean") return null;
      const remaining = o.kind === "buy" ? o.amount - (o.split && o.split.n > 1 ? o.split.invested || 0 : 0) : o.qty - (o.split && o.split.n > 1 ? o.split.soldQty || 0 : 0);
      if (!Number.isFinite(remaining) || remaining <= 0) return null;
      const gate = o.obsCutoff > effDate ? { obsCutoff: o.obsCutoff, obsPostClose: o.obsPostClose } : o.obsCutoff === effDate ? { obsCutoff: effDate, obsPostClose: o.obsPostClose || effPostClose } : { obsCutoff: effDate, obsPostClose: effPostClose };
      return { id: o.id, product: o.product, kind: o.kind, directional: o.conditionRules === 1, remaining, condition: o.condition ? { ...o.condition } : null, gate, signature: JSON.stringify([state.month, effDate, effPostClose, o]) };
    }
    function conditionLabel(condition, kind) {
      return condition ? "\uC0C8 \uD655\uBCF4 \uC9C0\uC810 " + condition.value.toLocaleString() + (condition.op === "above" ? " \uC774\uC0C1" : " \uC774\uD558") + "\uC77C \uB54C\uB9CC" : "\uAC00\uACA9\uC870\uAC74 \uC5C6\uC74C \xB7 \uC774\uD6C4 \uC0C8 \uC801\uACA9 \uAD00\uCE21 \uB300\uAE30";
    }
    function renderOrderCondition(id) {
      if (storageWriteBlocked || storageReadBlocked) return;
      const review = orderConditionReview(id);
      if (!review) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      const unit = review.kind === "buy" ? review.remaining.toLocaleString() + "\uC6D0 \uC608\uC57D\uAE08" : Number(review.remaining.toFixed(6)).toLocaleString() + " \uC7A0\uAE08\uC218\uB7C9";
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uC804\uC5C5 \uB300\uAE30 \uC8FC\uBB38 \uC218\uC815</div><h2>\uB0A8\uC740 \uC8FC\uBB38\uC758 \uAC00\uACA9\uC870\uAC74 \uBC14\uAFB8\uAE30</h2><p>" + esc(productRule(review.product).name || review.product) + " \xB7 " + (review.kind === "buy" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + " \xB7 " + unit + "</p><p>\uD604\uC7AC \uC870\uAC74: " + esc(conditionLabel(review.condition, review.kind)) + '</p><p class="note">\uC608\uC57D\uAE08\xB7\uC7A0\uAE08\uC218\uB7C9\xB7\uBD84\uD560 \uC9C4\uD589\xB7\uC774\uBBF8 \uCCB4\uACB0\uB41C \uBCF4\uC720\uBD84\xB7\uB300\uAE30\uAE30\uD55C\uC740 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uC870\uAC74\uC744 \uBC14\uAFB8\uBA74 \uBCC0\uACBD \uC2DC\uC810\uAE4C\uC9C0 \uC774\uBBF8 \uAD00\uCE21\uD55C \uC9C0\uC810\uC740 \uC0C8 \uC870\uAC74\uC73C\uB85C \uB2E4\uC2DC \uAC80\uC0AC\uD558\uC9C0 \uC54A\uACE0 \uC774\uD6C4 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uBD80\uD130 \uAE30\uB2E4\uB9BD\uB2C8\uB2E4. \uC2E4\uC81C \uAC70\uB798\uC18C \uC815\uC815 \uC8FC\uBB38\uC774 \uC544\uB2CC \uAC8C\uC784 \uC2DC\uD5D8\uADDC\uCE59\uC785\uB2C8\uB2E4.</p>';
      const label = document.createElement("label");
      label.htmlFor = "order-condition-mode";
      label.textContent = "\uC0C8 \uC870\uAC74";
      const mode = document.createElement("select");
      mode.id = "order-condition-mode";
      mode.style.cssText = "width:100%;min-height:44px;margin:8px 0";
      for (const [value2, text] of [["price", review.kind === "sell" ? "\uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC774 \uAE30\uC900\uAC12 \uC774\uC0C1\uC77C \uB54C\uB9CC \uB9E4\uB3C4" : "\uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC774 \uAE30\uC900\uAC12 \uC774\uD558\uC77C \uB54C\uB9CC \uB9E4\uC218"], ["none", "\uAC00\uACA9\uC870\uAC74 \uC5C6\uC774 \uB2E4\uC74C \uC0C8 \uC801\uACA9 \uAD00\uCE21 \uB300\uAE30"]]) {
        const option = document.createElement("option");
        option.value = value2;
        option.textContent = text;
        mode.appendChild(option);
      }
      if (review.directional) {
        const option = document.createElement("option");
        option.value = "reverse";
        option.textContent = review.kind === "sell" ? "\uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC774 \uAE30\uC900\uAC12 \uC774\uD558\uC77C \uB54C\uB9CC \uB9E4\uB3C4" : "\uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC774 \uAE30\uC900\uAC12 \uC774\uC0C1\uC77C \uB54C\uB9CC \uB9E4\uC218";
        mode.appendChild(option);
      }
      mode.value = review.condition ? review.directional && review.condition.op === (review.kind === "sell" ? "below" : "above") ? "reverse" : "price" : "none";
      const valueLabel = document.createElement("label");
      valueLabel.htmlFor = "order-condition-value";
      valueLabel.textContent = "\uAE30\uC900\uAC12 (\uC0C1\uD488 \uC2DC\uC138 \uC9C0\uC810 \uB2E8\uC704)";
      const value = document.createElement("input");
      value.id = "order-condition-value";
      value.type = "number";
      value.min = "0";
      value.step = "any";
      value.style.cssText = "box-sizing:border-box;width:100%;min-height:44px;margin:8px 0";
      value.setAttribute("aria-describedby", "order-condition-error");
      const pt = holdingPricePoint(review.product, state.month);
      value.value = String(review.condition?.value ?? pt?.value ?? "");
      const point = document.createElement("p");
      point.className = "note";
      point.textContent = pt ? "\uD604\uC7AC \uD655\uBCF4 \uC9C0\uC810 " + pt.value.toLocaleString() + " \xB7 " + fmtPtDate(pt) + " [\uC870\uAC74\uAC12\uC740 \uCCB4\uACB0\uAC00 \uBCF4\uC7A5\uC774 \uC544\uB2D9\uB2C8\uB2E4]" : "\uD604\uC7AC \uD655\uBCF4 \uC9C0\uC810 \uC5C6\uC74C. \uBBF8\uB798 \uC2DC\uC138\uB294 \uC81C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      const error = document.createElement("p");
      error.id = "order-condition-error";
      error.className = "note";
      error.setAttribute("role", "alert");
      error.hidden = true;
      const update = () => {
        value.disabled = mode.value === "none";
        valueLabel.hidden = value.disabled;
        value.hidden = value.disabled;
        error.hidden = true;
      };
      mode.onchange = update;
      value.oninput = () => {
        error.hidden = true;
      };
      update();
      card.append(label, mode, valueLabel, value, point, error);
      box.innerHTML = "";
      const next = document.createElement("button");
      next.id = "order-condition-review";
      next.textContent = "\uBCC0\uACBD \uB0B4\uC6A9 \uD655\uC778";
      next.onclick = () => {
        const condition = mode.value === "none" ? null : { op: mode.value === "reverse" ? review.kind === "sell" ? "below" : "above" : review.kind === "sell" ? "above" : "below", value: Number(value.value) };
        if (condition && (!value.value.trim() || !Number.isFinite(condition.value) || condition.value <= 0)) {
          error.textContent = "\uAE30\uC900\uAC12\uC740 0\uBCF4\uB2E4 \uD070 \uC720\uD55C\uD55C \uC22B\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.";
          error.hidden = false;
          value.focus();
          return;
        }
        if (!condition && !review.condition || condition && review.condition && condition.op === review.condition.op && condition.value === review.condition.value) {
          error.textContent = "\uD604\uC7AC \uC870\uAC74\uACFC \uAC19\uC2B5\uB2C8\uB2E4. \uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAC70\uB098 \uB2E4\uB978 \uC870\uAC74\uC744 \uACE0\uB974\uC138\uC694.";
          error.hidden = false;
          return;
        }
        renderOrderConditionConfirm(review, condition);
      };
      const back = document.createElement("button");
      back.id = "order-condition-back";
      back.textContent = "\uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.append(next, back);
      renderPortfolio();
      const heading = card.querySelector("h2");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      card.style.scrollMarginTop = "96px";
      card.scrollIntoView({ block: "start" });
    }
    function renderOrderConditionConfirm(review, condition) {
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uAC00\uACA9\uC870\uAC74 \uCD5C\uC885 \uD655\uC778</div><h2>\uC774 \uB0A8\uC740 \uC8FC\uBB38\uB9CC \uBC14\uAFC0\uAE4C</h2><p>" + esc(productRule(review.product).name || review.product) + " \xB7 " + (review.kind === "buy" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + "</p><p>\uC774\uC804: " + esc(conditionLabel(review.condition, review.kind)) + "</p><p>\uBCC0\uACBD: " + esc(conditionLabel(condition, review.kind)) + '</p><p class="note">\uC6D4\xB7\uD134\xB7\uD604\uAE08\xB7\uBCF4\uC720\xB7\uC608\uC57D\uAE08\xB7\uC7A0\uAE08\uC218\uB7C9\xB7\uBD84\uD560\uD68C\uCC28\xB7\uAE30\uD55C\uC740 \uBC14\uB00C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC989\uC2DC \uCCB4\uACB0\uD558\uAC70\uB098 \uACFC\uAC70 \uC9C0\uC810\uC73C\uB85C \uC18C\uAE09\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAD00\uCE21\uAC8C\uC774\uD2B8 ' + esc(review.gate.obsCutoff) + (review.gate.obsPostClose ? " \uB9C8\uAC10 \uD6C4" : " \uB9C8\uAC10 \uC804") + "\uAE4C\uC9C0 \uC774\uBBF8 \uC774\uC6A9 \uAC00\uB2A5\uD588\uB358 \uC9C0\uC810\uC740 \uC81C\uC678\uD558\uBA70 \uADF8 \uB4A4 \uC0C8 \uC801\uACA9 \uAD00\uCE21\uC744 \uAE30\uB2E4\uB9BD\uB2C8\uB2E4. \uAC00\uACA9\uC870\uAC74\uC744 \uC5C6\uC560\uB3C4 \uC9C0\uAE08 \uCCB4\uACB0\uB418\uB294 \uAC83\uC740 \uC544\uB2D9\uB2C8\uB2E4. \uC870\uAC74\uAC12\uC740 \uCCB4\uACB0\uAC00 \uBCF4\uC7A5\uC774 \uC544\uB2D9\uB2C8\uB2E4 [\uAC8C\uC784 \uC2DC\uD5D8\uADDC\uCE59].</p>";
      if (albaTimeLimited()) card.innerHTML += '<p class="note alba-time-confirm">\uD655\uC815\uD558\uBA74 \uC774\uBC88 \uB2EC \uC54C\uBC14 \uC218\uB3D9 \uD22C\uC790 \uD310\uB2E81\uD68C\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uCDE8\uC18C\uB294 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      box.innerHTML = "";
      const yes = document.createElement("button");
      yes.id = "order-condition-confirm";
      yes.textContent = "\uC774 \uC870\uAC74\uC73C\uB85C \uBCC0\uACBD \uD655\uC815";
      yes.onclick = () => {
        if (storageWriteBlocked || storageReadBlocked) return;
        const current = orderConditionReview(review.id);
        if (!current || current.signature !== review.signature) {
          render();
          return;
        }
        const o = state.pendingOrders.find((x) => x.id === review.id);
        const previousGate = { obsCutoff: o.obsCutoff, obsPostClose: o.obsPostClose };
        if (condition) o.condition = { ...condition };
        else delete o.condition;
        Object.assign(o, review.gate);
        albaTimeConsume("condition");
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "order-condition-change:" + o.product + ":" + (condition ? condition.op + ":" + condition.value : "none"), orderId: o.id, previousCondition: review.condition, condition, previousGate, ...review.gate });
        if (save()) render();
      };
      const edit = document.createElement("button");
      edit.id = "order-condition-edit";
      edit.textContent = "\uC785\uB825\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30";
      edit.onclick = () => renderOrderCondition(review.id);
      const back = document.createElement("button");
      back.id = "order-condition-confirm-back";
      back.textContent = "\uBCC0\uACBD \uCDE8\uC18C \xB7 \uC8FC\uBB38 \uC720\uC9C0";
      back.onclick = () => render();
      box.append(yes, edit, back);
      renderPortfolio();
      const heading = card.querySelector("h2");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      card.style.scrollMarginTop = "96px";
      card.scrollIntoView({ block: "start" });
    }
    function orderDeadlineReview(id) {
      if (CASH_MODE || !fulltimeActive() || state.month > GAME_END || !albaTimeAvailable()) return null;
      const o = (state.pendingOrders || []).find((x) => x.id === id);
      if (!o || o.kind !== "buy" || o.reserve || productRule(o.product).rule !== "price") return null;
      const remaining = o.amount - (o.split && o.split.n > 1 ? o.split.invested || 0 : 0);
      if (!Number.isFinite(remaining) || remaining <= 0) return null;
      return { id: o.id, product: o.product, remaining, expiresAt: o.expiresAt || null, signature: JSON.stringify([state.month, o]) };
    }
    function renderOrderDeadline(id) {
      if (storageWriteBlocked || storageReadBlocked) return;
      const review = orderDeadlineReview(id);
      if (!review) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uBBF8\uCCB4\uACB0 \uB9E4\uC218 \uB300\uAE30\uAE30\uD55C \uAC80\uD1A0</div><h2>\uB0A8\uC740 \uC8FC\uBB38\uC758 \uAE30\uD55C\uB9CC \uBC14\uAFC0\uAE4C</h2><p>" + esc(productRule(review.product).name || review.product) + " \xB7 \uB0A8\uC740 \uC608\uC57D\uAE08 " + review.remaining.toLocaleString() + "\uC6D0 \xB7 \uAE30\uC874 \uAE30\uD55C " + (review.expiresAt ? esc(review.expiresAt) + " \uC6D4\uCD08" : "\uC5C6\uC74C") + '. \uC0C8 \uAE30\uD55C\uC740 \uBCC0\uACBD\uD558\uB294 \uC774\uBC88 \uB2EC\uBD80\uD130 \uC149\uB2C8\uB2E4.</p><p class="note">\uC811\uC218 \uB2F9\uC2DC \uAD00\uCE21 \uAC8C\uC774\uD2B8\xB7\uAC00\uACA9 \uC870\uAC74\xB7\uBD84\uD560 \uC9C4\uD589\xB7\uC774\uBBF8 \uCCB4\uACB0\uB41C \uBCF4\uC720\uBD84\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uC608\uC57D\uAE08 \uBC18\uD658\xB7\uC7AC\uC811\uC218\xB7\uC989\uC2DC \uCCB4\uACB0 \uC5C6\uC774 \uAE30\uD55C\uB9CC \uBC14\uAFC9\uB2C8\uB2E4. \uC6D4\xB7\uD134\uC218\xB7\uBD84\uAE30 \uC815\uC0B0\uC740 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uD55C\uC740 \uAC8C\uC784 \uC548\uC758 \uC2DC\uD5D8 \uADDC\uCE59\uC774\uBA70 \uC2E4\uC81C \uAC70\uB798\uC18C \uC8FC\uBB38 \uC720\uD6A8\uAE30\uAC04\uC774 \uC544\uB2D9\uB2C8\uB2E4.</p>';
      box.innerHTML = "";
      if (albaTimeLimited()) card.innerHTML += '<p class="note alba-time-confirm">\uBC14\uB010 \uAE30\uD55C\uC744 \uC120\uD0DD\uD558\uBA74 \uC774\uBC88 \uB2EC \uC54C\uBC14 \uC218\uB3D9 \uD22C\uC790 \uD310\uB2E81\uD68C\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uAC19\uC740 \uAE30\uD55C\xB7\uCDE8\uC18C\uB294 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      for (const months of [0, 3, 12]) {
        const expiry = months ? addMonths(state.month, months) : null;
        const b = document.createElement("button");
        b.dataset.deadlineMonths = String(months);
        b.textContent = months ? months + "\uAC1C\uC6D4 \xB7 " + expiry + " \uC6D4\uCD08 \uBBF8\uCCB4\uACB0\uBD84 \uBC18\uD658" : "\uAE30\uD55C \uC5C6\uC74C \xB7 \uC9C1\uC811 \uCDE8\uC18C\uD558\uAC70\uB098 \uC0C8 \uAD00\uCE21 \uB300\uAE30";
        b.onclick = () => {
          if (storageWriteBlocked || storageReadBlocked) return;
          const current = orderDeadlineReview(id);
          if (!current || current.signature !== review.signature) {
            render();
            return;
          }
          const o = state.pendingOrders.find((x) => x.id === id);
          if ((o.expiresAt || null) === expiry) {
            render();
            return;
          }
          if (expiry) o.expiresAt = expiry;
          else delete o.expiresAt;
          albaTimeConsume("deadline");
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "order-deadline-change:" + o.product + ":" + (expiry || "none"), orderId: id, previousExpiry: review.expiresAt, expiresAt: expiry, remaining: review.remaining });
          if (save()) render();
        };
        box.appendChild(b);
      }
      const back = document.createElement("button");
      back.id = "order-deadline-back";
      back.textContent = "\uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.appendChild(back);
      renderPortfolio();
    }
    function orderReductionReview(id, percent) {
      if (!SCHOOL_MODE || CASH_MODE || state.flags.gameOver || state.month > GAME_END || ![25, 50, 75].includes(percent)) return null;
      const o = (state.pendingOrders || []).find((x) => x.id === id);
      if (!o || o.kind !== "buy" || o.planOrigin || o.reserve || o.earliestFillMonth || o.split && o.split.n > 1 || !Number.isSafeInteger(o.amount) || o.amount < 2 || !o.obsCutoff || typeof o.obsPostClose !== "boolean") return null;
      const refund = Math.floor(o.amount * percent / 100), remaining = o.amount - refund;
      if (refund <= 0 || remaining <= 0 || !Number.isSafeInteger(state.cash) || !Number.isSafeInteger(state.cash + refund)) return null;
      return { id, percent, product: o.product, before: o.amount, refund, remaining, cashBefore: state.cash, cashAfter: state.cash + refund, signature: JSON.stringify([state.month, state.cash, o]) };
    }
    function renderOrderReduction(id, percent = null) {
      if (storageReadBlocked || storageWriteBlocked || multiTabConflict) return;
      const review = orderReductionReview(id, percent || 50);
      if (!review) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices"), o = state.pendingOrders.find((o2) => o2.id === id);
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uB9E4\uC218 \uC608\uC57D\uAE08 \uCD95\uC18C \uAC80\uD1A0</div><h2>\uC774 \uB9E4\uC218 \uC608\uC57D\uAE08 \uC77C\uBD80\uB9CC \uD480\uAE30</h2><p>" + esc(productRule(review.product).name || review.product) + " \xB7 \uD604\uC7AC \uC608\uC57D\uAE08 " + review.before.toLocaleString() + '\uC6D0</p><p>\uC8FC\uBB38\uC744 \uC804\uBD80 \uCDE8\uC18C\uD558\uC9C0 \uC54A\uACE0 \uC77C\uBD80 \uC608\uC57D\uAE08\uB9CC \uD604\uAE08\uC73C\uB85C \uB3CC\uB9BD\uB2C8\uB2E4. \uAC19\uC740 \uC8FC\uBB38\uC758 \uC811\uC218\uC6D4\xB7\uAC00\uACA9\uC870\uAC74\xB7\uB300\uAE30\uAE30\uD55C\xB7\uAD00\uCE21\uAC8C\uC774\uD2B8\uB294 \uADF8\uB300\uB85C\uC774\uBA70 \uB0A8\uC740 \uAE08\uC561\uB9CC \uB2E4\uC74C \uC0C8 \uC801\uACA9 \uC9C0\uC810\uC5D0\uC11C \uCCB4\uACB0\uC744 \uAE30\uB2E4\uB9BD\uB2C8\uB2E4. \uC0C8 \uC8FC\uBB38\uC774\uB098 \uCCB4\uACB0\uAC00 \uBCF4\uC7A5\uC774 \uC544\uB2D9\uB2C8\uB2E4.</p><p class="note">\uBE44\uBD84\uD560 \uC218\uB3D9 \uB9E4\uC218\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uBD84\uD560\xB7\uB9E4\uB3C4\xB7\uCDE8\uC5C5 \uC801\uB9BD \uC608\uC57D\uC740 \uC774 \uC120\uD0DD\uC5D0\uC11C \uB2E4\uB8E8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC6D4\xB7\uD134\xB7\uB2E4\uB978 \uC8FC\uBB38\xB7\uD5A5\uD6C4 \uACC4\uD68D\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC73C\uBA70, \uCD1D\uC790\uC0B0\uC774 \uB298\uC5B4\uB098\uB294 \uAC83\uC774 \uC544\uB2C8\uB77C \uC608\uC57D\uAE08\uC774 \uD604\uAE08\uC73C\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4. \uCDE8\uC18C\uD55C \uAE08\uC561\uC744 \uB418\uB3CC\uB824 \uB298\uB9AC\uB294 \uAE30\uB2A5\uC740 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
      box.innerHTML = "";
      if (percent === null) {
        for (const n of [25, 50, 75]) {
          const r = orderReductionReview(id, n);
          if (!r) continue;
          const b = document.createElement("button");
          b.className = "order-reduce-percent";
          b.dataset.percent = String(n);
          b.textContent = n + "% \uD480\uAE30 \xB7 " + r.refund.toLocaleString() + "\uC6D0 \uBC18\uD658 / " + r.remaining.toLocaleString() + "\uC6D0 \uC608\uC57D \uC720\uC9C0";
          b.onclick = () => renderOrderReduction(id, n);
          box.append(b);
        }
      } else {
        const detail = document.createElement("p");
        detail.className = "order-reduce-effect";
        detail.textContent = percent + "% \uCD95\uC18C: \uC608\uC57D " + review.before.toLocaleString() + "\uC6D0 \u2192 " + review.remaining.toLocaleString() + "\uC6D0 \xB7 \uD604\uAE08 " + review.cashBefore.toLocaleString() + "\uC6D0 \u2192 " + review.cashAfter.toLocaleString() + "\uC6D0. \uBC18\uD658\uC561 " + review.refund.toLocaleString() + "\uC6D0(\uC6D0 \uBBF8\uB9CC \uBC84\uB9BC). \uC811\uC218 \uAD00\uCE21\uAC8C\uC774\uD2B8 " + o.obsCutoff + (o.obsPostClose ? " \uB9C8\uAC10 \uD6C4" : " \uB9C8\uAC10 \uC804") + " \uC720\uC9C0.";
        card.append(detail);
        const yes = document.createElement("button");
        yes.id = "order-reduce-confirm";
        yes.textContent = review.refund.toLocaleString() + "\uC6D0 \uBC18\uD658\uD558\uACE0 " + review.remaining.toLocaleString() + "\uC6D0 \uC608\uC57D \uC720\uC9C0";
        yes.onclick = () => {
          if (storageReadBlocked || storageWriteBlocked || multiTabConflict) return;
          const current = orderReductionReview(id, percent);
          if (!current || current.signature !== review.signature) {
            render();
            return;
          }
          const before = JSON.stringify(state), order = state.pendingOrders.find((o2) => o2.id === id);
          order.amount = current.remaining;
          state.cash = current.cashAfter;
          state.history.push({ month: state.month, decisionMonth: state.month, choice: "order-reduce:" + current.product + ":" + percent + ":" + current.refund, orderId: id, amountBefore: current.before, amountAfter: current.remaining, refund: current.refund });
          if (save()) render();
          else state = JSON.parse(before);
        };
        box.append(yes);
        const edit = document.createElement("button");
        edit.id = "order-reduce-edit";
        edit.textContent = "\uBE44\uC728 \uB2E4\uC2DC \uACE0\uB974\uAE30";
        edit.onclick = () => renderOrderReduction(id);
        box.append(edit);
      }
      const back = document.createElement("button");
      back.id = "order-reduce-back";
      back.textContent = "\uBC14\uAFB8\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => render();
      box.append(back);
      renderPortfolio();
    }
    function careerCashReuseNote() {
      return CAREER_TRIAL && state.flags.career === "job" ? '<p class="career-cancel-reuse">\uB9E4\uC218 \uCDE8\uC18C\xB7\uC608\uCE58\uC790\uAE08 \uD68C\uC218\uC758 \uBC18\uD658\uAE08\uC740 \uC9C0\uAE08 \uD604\uAE08 \uC794\uACE0\uC5D0 \uB4E4\uC5B4\uC624\uBA70 \uBCC4\uB3C4 \uC7A0\uAE08\xB7\uBC8C\uAE08\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uB9E4\uB3C4 \uC8FC\uBB38\uC744 \uCDE8\uC18C\uD558\uBA74 \uD604\uAE08\uC774 \uC544\uB2C8\uB77C \uC7A0\uAE08\uC218\uB7C9\uC744 \uBCF4\uC720\uB85C \uBCF5\uC6D0\uD569\uB2C8\uB2E4. \uC0C8 \uD22C\uC790\uC8FC\uBB38 \uC811\uC218\uB294 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uD604\uC7AC \uC815\uC0B0 \uD654\uBA74\uC774 \uC544\uC9C1 \uC5F4\uB824 \uC788\uC73C\uBA74 \uAC70\uAE30\uB85C \uB3CC\uC544\uAC00 \uC8FC\uBB38\uD560 \uC218 \uC788\uACE0, \uC815\uC0B0\uC744 \uB05D\uB0C8\uAC70\uB098 \uB274\uC2A4\xB7\uD3C9\uC628 \uD654\uBA74\uC774\uBA74 \uB2E4\uC74C \uC815\uC0B0\uAE4C\uC9C0 \uD604\uAE08\uC73C\uB85C \uBCF4\uC720\uD569\uB2C8\uB2E4. \uCDE8\uC18C\xB7\uD68C\uC218\uB294 \uC815\uC0B0\uC744 \uC0C8\uB85C \uC5F4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' : "";
    }
    function singleOrderCancellationReview(id) {
      if (state.flags.gameOver || state.month > GAME_END) return null;
      const o = (state.pendingOrders || []).find((x) => x.id === id);
      if (!o || !["buy", "sell"].includes(o.kind)) return null;
      const split = o.split && o.split.n > 1;
      const remaining = o.kind === "buy" ? o.amount - (split ? o.split.invested || 0 : 0) : o.qty - (split ? o.split.soldQty || 0 : 0);
      if (!Number.isFinite(remaining) || remaining <= 0) return null;
      return { id: o.id, product: o.product, kind: o.kind, remaining, placedMonth: o.placedMonth, condition: o.condition || null, split: split ? o.split : null, expiresAt: o.expiresAt || null, planOrigin: o.planOrigin || null, signature: JSON.stringify([state.month, state.cash, o, state.holdings[o.product] || null]) };
    }
    function cancelStatusNote(id) {
      const ord = (state.pendingOrders || []).find((x) => x.id === id);
      if (!ord) return "";
      return '<p class="note single-cancel-status">\uD604\uC7AC \uB300\uAE30 \uC0C1\uD0DC: ' + esc(pendingOrderReview(ord).reason) + " \uC774 \uC0C1\uD0DC \uD45C\uC2DC\uB294 \uCCB4\uACB0\uC744 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
    }
    function renderSingleOrderCancellation(id) {
      if (storageWriteBlocked || storageReadBlocked) return;
      const review = singleOrderCancellationReview(id);
      if (!review) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      const amount = review.kind === "buy" ? review.remaining.toLocaleString() + "\uC6D0" : Number(review.remaining.toFixed(6)).toLocaleString() + " \uC2DC\uC5F0\uC218\uB7C9";
      const effect = review.kind === "buy" ? "\uB0A8\uC740 \uC608\uC57D\uAE08 " + amount + "\uB9CC \uD604\uAE08\uC73C\uB85C \uBC18\uD658\uD569\uB2C8\uB2E4. \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \u2192 " + (state.cash + review.remaining).toLocaleString() + "\uC6D0." : "\uB0A8\uC740 \uC7A0\uAE08 " + amount + "\uB9CC \uAE30\uC874 \uCDE8\uB4DD\uC6D0\uAC00 \uAE30\uC900\uC73C\uB85C \uBCF4\uC720\uC5D0 \uBCF5\uC6D0\uD569\uB2C8\uB2E4. \uB9E4\uB3C4\uB300\uAE08\uC740 \uBC1C\uC0DD\uD558\uC9C0 \uC54A\uC73C\uBA70 \uD604\uAE08\uC740 " + state.cash.toLocaleString() + "\uC6D0 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.";
      let terms = "\uC811\uC218\uC6D4 " + review.placedMonth;
      if (review.condition) terms += " \xB7 \uC870\uAC74 " + review.condition.value.toLocaleString() + (review.condition.op === "below" ? " \uC774\uD558" : " \uC774\uC0C1");
      if (review.split) terms += " \xB7 \uBD84\uD560 " + (review.split.filled || 0) + "/" + review.split.n + " \uCCB4\uACB0";
      if (review.expiresAt) terms += " \xB7 \uB300\uAE30\uAE30\uD55C " + review.expiresAt + " \uC6D4\uCD08";
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uAC1C\uBCC4 \uC8FC\uBB38 \uCDE8\uC18C \uAC80\uD1A0</div><h2>\uC774 \uB300\uAE30 \uC8FC\uBB38\uB9CC \uCDE8\uC18C\uD560\uAE4C</h2><p>" + esc(productRule(review.product).name || review.product) + " \xB7 " + (review.kind === "buy" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + '</p><p class="single-cancel-terms">' + esc(terms) + "</p>" + cancelStatusNote(id) + '<p class="single-cancel-effect">' + esc(effect) + '</p><p class="note">\uC774\uBBF8 \uCCB4\uACB0\uB41C \uD68C\uBD84\xB7\uB2E4\uB978 \uC8FC\uBB38\xB7\uD604\uC7AC \uC6D4\xB7\uD134\uC218\xB7\uBD84\uAE30 \uC815\uC0B0\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uCD1D\uC790\uC0B0\uC774 \uB298\uC5B4\uB098\uB294 \uAC83\uC774 \uC544\uB2C8\uBA70 \uC2E4\uC81C \uAE08\uC735 \uC8FC\uBB38 \uCDE8\uC18C\uAC00 \uC544\uB2CC \uAC8C\uC784 \uADDC\uCE59\uC785\uB2C8\uB2E4. \uCDE8\uC18C\uD55C \uC870\uAC74\xB7\uBD84\uD560 \uC9C4\uD589\xB7\uC811\uC218 \uAD00\uCE21\uAC8C\uC774\uD2B8\uB294 \uB418\uC0B4\uB9AC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC8FC\uBB38\uD558\uBA74 \uC0C8 \uC8FC\uBB38\uC73C\uB85C \uC811\uC218\uB429\uB2C8\uB2E4.</p>' + (["job-savings", "career-cash"].includes(review.planOrigin) ? '<p class="note">\uC774 1\uAC74\uB9CC \uCDE8\uC18C\uD569\uB2C8\uB2E4. \uC55E\uC73C\uB85C\uC758 \uCDE8\uC5C5 \uC21C\uC800\uCD95 \uBC30\uBD84 \uACC4\uD68D\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC73C\uBA70, \uACC4\uD68D\uC774 \uCF1C\uC838 \uC788\uC73C\uBA74 \uC774\uD6C4 \uC0C8 \uC608\uC57D\uC774 \uC0DD\uAE38 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>' : "");
      if (cashPlanActive()) card.innerHTML = card.innerHTML.replaceAll("\uCDE8\uC5C5 \uC2E0\uADDC \uC21C\uC800\uCD95", "\uC0DD\uD65C\xB7\uD559\uBE44 \uB0A9\uBD80 \uB4A4 \uCDE8\uC5C5 \uC2E0\uADDC \uC5EC\uC720\uAE08").replaceAll("\uCDE8\uC5C5 \uC21C\uC800\uCD95", "\uCDE8\uC5C5 \uC6D4 \uC5EC\uC720\uAE08").replaceAll("\uC0C8 \uC21C\uC800\uCD95", "\uC0C8 \uC6D4 \uC5EC\uC720\uAE08");
      card.innerHTML += careerCashReuseNote();
      box.innerHTML = "";
      const yes = document.createElement("button");
      yes.id = "single-order-cancel-confirm";
      yes.textContent = review.kind === "buy" ? amount + " \uBC18\uD658\uD558\uACE0 \uC774 \uC8FC\uBB38 \uCDE8\uC18C" : amount + " \uBCF5\uC6D0\uD558\uACE0 \uC774 \uC8FC\uBB38 \uCDE8\uC18C";
      yes.onclick = () => {
        if (storageWriteBlocked || storageReadBlocked) return;
        const current = singleOrderCancellationReview(id);
        if (!current || current.signature !== review.signature) {
          render();
          return;
        }
        cancelOrder(id);
      };
      box.appendChild(yes);
      const no = document.createElement("button");
      no.id = "single-order-cancel-back";
      no.textContent = "\uC8FC\uBB38 \uC720\uC9C0 \xB7 \uCDE8\uC18C\uD558\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      no.onclick = () => render();
      box.appendChild(no);
      renderPortfolio();
    }
    function jobReservationCancellationReview() {
      if (CASH_MODE || state.month > GAME_END) return null;
      const orders = (state.pendingOrders || []).filter((o) => o.kind === "buy" && (state.jobPlanProductRules === 1 || o.product === "kospi") && o.reserve === "job-settlement" && ["job-savings", "career-cash"].includes(o.planOrigin));
      if (!orders.length) return null;
      const rows = orders.map((o) => ({ id: o.id, remaining: o.amount - (o.split && o.split.n > 1 ? o.split.invested || 0 : 0) }));
      if (rows.some((o) => !Number.isFinite(o.remaining) || o.remaining < 0)) return null;
      return { rows, count: rows.length, refund: rows.reduce((n, o) => n + o.remaining, 0), signature: JSON.stringify(rows) };
    }
    function current_status_rows(state2, review) {
      const orders = (state2.pendingOrders || []).filter((o) => review.rows.some((r) => r.id === o.id));
      if (!orders.length) return null;
      return { count: orders.length, items: orders.map((o) => (state2.jobPlanProductRules === 1 ? (productRule(o.product).name || o.product) + " \xB7 " : "") + o.placedMonth + " \uC811\uC218 \xB7 \uB0A8\uC740 \uC608\uC57D\uAE08 " + pendingOrderReview(o).remaining.toLocaleString() + "\uC6D0 \xB7 " + pendingOrderReview(o).reason) };
    }
    function renderJobReservationCancellation() {
      if (storageWriteBlocked || storageReadBlocked) return;
      const review = jobReservationCancellationReview();
      if (!review) return;
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">' + esc(state.month) + " \xB7 \uCDE8\uC5C5 \uC801\uB9BD \uB300\uAE30\uBD84 \uCDE8\uC18C \uAC80\uD1A0</div><h2>\uAE30\uC874 \uC801\uB9BD \uC608\uC57D\uAE08\uC744 \uD604\uAE08\uC73C\uB85C \uB3CC\uB9B4\uAE4C</h2><p>\uCDE8\uC5C5 \uC2E0\uADDC \uC21C\uC800\uCD95\uC73C\uB85C \uC811\uC218\uD55C " + (state.jobPlanProductRules === 1 ? "\uC0C1\uD488\uBCC4" : "\uAD6D\uB0B4\uC9C0\uC218") + " \uB9E4\uC218 \uC608\uC57D " + review.count + "\uAC74\uC758 \uB0A8\uC740 \uC608\uC57D\uAE08 " + review.refund.toLocaleString() + "\uC6D0\uB9CC \uBC18\uD658\uD569\uB2C8\uB2E4. \uD604\uAE08 " + state.cash.toLocaleString() + "\uC6D0 \u2192 " + (state.cash + review.refund).toLocaleString() + '\uC6D0. \uD604\uC7AC \uBCF4\uC720\xB7\uC774\uBBF8 \uCCB4\uACB0\uB41C \uD68C\uBD84\xB7\uC218\uB3D9 \uB9E4\uC218\xB7\uB9E4\uB3C4 \uC8FC\uBB38\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.</p><p class="note">\uC6D4\xB7\uD134\uC218\xB7\uBD84\uAE30 \uC815\uC0B0 \uC0C1\uD0DC\uB97C \uC9C4\uD589\uD558\uC9C0 \uC54A\uACE0, \uB9E4\uB3C4\uB098 \uC2E0\uADDC \uAC70\uB798\uB97C \uC2E4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uCD1D\uC790\uC0B0\uC774 \uB298\uC5B4\uB098\uB294 \uAC83\uC774 \uC544\uB2C8\uB77C \uBBF8\uCCB4\uACB0 \uC608\uC57D\uAE08\uC774 \uD604\uAE08\uC73C\uB85C \uBC14\uB01D\uB2C8\uB2E4. \uBC18\uD658\uC740 \uAC8C\uC784 \uC548\uC758 \uC2DC\uD5D8 \uADDC\uCE59\uC774\uBA70 \uC2E4\uC81C \uAE08\uC735\uACC4\uC57D \uD574\uC9C0\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p><p class="note job-cancel-plan-note">' + (state.jobSavingsPlan && state.jobSavingsPlan.percent ? "\uC55E\uC73C\uB85C\uC758 " + state.jobSavingsPlan.percent + "% \uCDE8\uC5C5 \uC21C\uC800\uCD95 \uC801\uB9BD \uACC4\uD68D\uC740 \uCF1C\uC9C4 \uCC44 \uC720\uC9C0\uB429\uB2C8\uB2E4. \uC774\uD6C4 \uC870\uAC74\uC774 \uB9DE\uB294 \uC0C8 \uC21C\uC800\uCD95\uC740 \uB2E4\uC2DC \uC608\uC57D\uB429\uB2C8\uB2E4. \uC55E\uC73C\uB85C\uC758 \uC801\uB9BD\uB3C4 \uBA48\uCD94\uB824\uBA74 \uBC30\uBD84 \uACC4\uD68D\uC744 \uBCC4\uB3C4\uB85C \uAEBC \uC8FC\uC138\uC694." : "\uC55E\uC73C\uB85C\uC758 \uCDE8\uC5C5 \uC21C\uC800\uCD95 \uC801\uB9BD \uACC4\uD68D\uC740 \uAEBC\uC9C4 \uC0C1\uD0DC \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uC774 \uCDE8\uC18C\uB85C \uACC4\uD68D\uC744 \uCF1C\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.") + "</p>";
      box.innerHTML = "";
      {
        const stRows = current_status_rows(state, review);
        if (stRows) card.innerHTML += '<details class="job-cancel-status"><summary style="min-height:44px;box-sizing:border-box;padding:10px 0;cursor:pointer;">\uAC74\uBCC4 \uD604\uC7AC \uB300\uAE30 \uC0C1\uD0DC ' + stRows.count + '\uAC74</summary><p class="note">\uCDE8\uC18C \uAC80\uD1A0 \uC2DC\uC810\uC758 \uC2E4\uC81C \uC5D4\uC9C4 \uC0C1\uD0DC \uADF8\uB300\uB85C\uC774\uBA70 \uCCB4\uACB0\uC744 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><ul>' + stRows.items.map((t) => '<li style="overflow-wrap:anywhere">' + esc(t) + "</li>").join("") + "</ul></details>";
      }
      if (cashPlanActive()) card.innerHTML = card.innerHTML.replaceAll("\uCDE8\uC5C5 \uC2E0\uADDC \uC21C\uC800\uCD95", "\uC0DD\uD65C\xB7\uD559\uBE44 \uB0A9\uBD80 \uB4A4 \uCDE8\uC5C5 \uC2E0\uADDC \uC5EC\uC720\uAE08").replaceAll("\uCDE8\uC5C5 \uC21C\uC800\uCD95", "\uCDE8\uC5C5 \uC6D4 \uC5EC\uC720\uAE08").replaceAll("\uC0C8 \uC21C\uC800\uCD95", "\uC0C8 \uC6D4 \uC5EC\uC720\uAE08");
      card.innerHTML += careerCashReuseNote();
      const yes = document.createElement("button");
      yes.id = "job-reservations-cancel-confirm";
      yes.textContent = review.count + "\uAC74 \uBBF8\uCCB4\uACB0\uBD84 " + review.refund.toLocaleString() + "\uC6D0 \uBC18\uD658 \uD655\uC778";
      yes.onclick = () => {
        if (storageWriteBlocked || storageReadBlocked) return;
        const current = jobReservationCancellationReview();
        if (!current || current.signature !== review.signature) {
          render();
          return;
        }
        const ids = new Set(current.rows.map((o) => o.id));
        state.cash += current.refund;
        state.pendingOrders = state.pendingOrders.filter((o) => !ids.has(o.id));
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "cancel-job-reservations:" + current.count, refund: current.refund });
        if (save()) render();
      };
      box.appendChild(yes);
      const no = document.createElement("button");
      no.id = "job-reservations-cancel-back";
      no.textContent = "\uCDE8\uC18C\uD558\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      no.onclick = () => render();
      box.appendChild(no);
      renderPortfolio();
    }
    function cancelOrder(id) {
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      const o = (state.pendingOrders || []).find((x) => x.id === id);
      if (!o) return;
      if (o.kind === "buy") {
        state.cash += o.split && o.split.n > 1 ? o.amount - (o.split.invested || 0) : o.amount;
      } else {
        const restQty = o.split && o.split.n > 1 ? o.qty - (o.split.soldQty || 0) : o.qty;
        if (restQty > 0) {
          const h = state.holdings[o.product] || { qty: 0, avgPrice: 0 };
          const nq = h.qty + restQty;
          h.avgPrice = nq ? (h.avgPrice * h.qty + o.avgPrice * restQty) / nq : 0;
          h.qty = nq;
          if (o.investedShare != null) h.invested = (h.invested || 0) + Math.max(0, o.investedShare - (o.split && o.split.n > 1 ? o.split.soldCostBasis || 0 : 0));
          if (!h.entryMonth) h.entryMonth = o.placedMonth;
          state.holdings[o.product] = h;
        }
      }
      state.pendingOrders = state.pendingOrders.filter((x) => x.id !== id);
      state.history.push({ month: state.month, decisionMonth: state.month, choice: "cancel-order:" + o.product });
      save();
      render();
    }
    function settlePendingOrders() {
      for (const o of state.pendingOrders || []) {
        if (o.kind === "buy") state.cash += o.split && o.split.n > 1 ? o.amount - (o.split.invested || 0) : o.amount;
        else {
          const restQty = o.split && o.split.n > 1 ? o.qty - (o.split.soldQty || 0) : o.qty;
          if (restQty <= 0) continue;
          const h = state.holdings[o.product] || { qty: 0, avgPrice: 0 };
          const nq = h.qty + restQty;
          h.avgPrice = nq ? (h.avgPrice * h.qty + o.avgPrice * restQty) / nq : 0;
          h.qty = nq;
          if (o.investedShare != null) h.invested = (h.invested || 0) + Math.max(0, o.investedShare - (o.split && o.split.n > 1 ? o.split.soldCostBasis || 0 : 0));
          state.holdings[o.product] = h;
        }
      }
      state.pendingOrders = [];
    }
    function advanceMonth() {
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      if (!ReturnEconomyPolicy.inspect(state, currentEconomyId()).ok) return showEconomyConflict();
      if (DATA && (!ReturnEconomyPolicy.inspectNested(state, DATA.unlocks.map((u) => u.product)).ok || !albaTimeShapeOk(state))) return showSaveConflict("\uBCF4\uC720\uC790\uC0B0\xB7\uB300\uAE30\uC8FC\uBB38\xB7\uC7A5\uBD80\uC758 \uC77C\uBD80 \uC800\uC7A5 \uD615\uC2DD\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uAE08\uC561\uC744 \uCD94\uC815\uD558\uAC70\uB098 \uC6D0\uBB38\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC5B4\uC694.", "save-shape");
      if (!inspectForeignFundTag(state)) return showSaveConflict("\uD574\uC678 \uD380\uB4DC\uC9D1\uC911\uB3C4 \uC790\uB8CC\xB7\uADDC\uCE59 \uC2DD\uBCC4\uC774 \uB9DE\uC9C0 \uC54A\uC544 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "foreign-fund-scale-shape");
      if (!propertyShapeOk(state)) return showSaveConflict("\uC8FC\uD0DD \uC18C\uC720\xB7\uACC4\uC57D \uAE30\uB85D\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "property-shape");
      const [y, m] = state.month.split("-").map(Number);
      const nm = m === 12 ? [y + 1, 1] : [y, m + 1];
      state.month = nm[0] + "-" + String(nm[1]).padStart(2, "0");
      if (propertyActive() && state.month <= GAME_END) {
        const x = HomeContract.settleProperty(state.cash, state.property, state.month);
        if (!x.ok) return showSaveConflict("\uC8FC\uD0DD \uACC4\uC57D \uC815\uC0B0\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "property-settlement");
        state.cash = x.cash;
        state.property = x.property;
        for (const r of x.receipts) state.history.push({ month: state.month, decisionMonth: state.month, choice: "property-" + r.kind + "-settled:" + r.region, ...r });
      }
      if (GAME_LIVING) {
        const entered = state.month, workMonth = addMonths(entered, -1);
        if (entered > GLV.startMonth && entered <= GLV.lastWorkMonth) {
          const income = state.gameLivingTrack === "job" ? GLV.income : 0;
          state.cash += income;
          if (income) state.gameLivingSalaryReceived = (state.gameLivingSalaryReceived || 0) + income;
          const expense = GLV.expense;
          state.lastSavings = 0;
          if (state.cash >= expense) {
            state.cash -= expense;
            state.gameLivingLedger = state.gameLivingLedger || [];
            state.gameLivingLedger.push({ month: entered, income, incomeFor: workMonth, expense, expenseDue: expense, shortfall: 0, cashAfter: state.cash, failed: false });
          } else {
            state.gameLivingPendingDue = { month: entered, income, incomeFor: workMonth, expenseDue: expense };
          }
        } else if (entered === addMonths(GLV.lastWorkMonth, 1) && state.gameLivingTrack === "job") {
          state.gameLivingReceivable = GLV.income;
        }
      }
      if (state.month > GAME_END) return;
      const b0 = state.flags.birth;
      if (b0 && state.flags.studyPath === "study") {
        if (!state.flags.academicStatus && state.month >= b0.hsYear + 3 + "-03") {
          if (!state.academic || state.flags.lifeDone.admitResult) {
            state.flags.academicStatus = "college";
            state.flags.enrolledMonths = 0;
          }
        }
        if (state.academic && !state.flags.academicStatus && !militaryActive() && state.month < b0.hsYear + 3 + "-03") {
          state.academic.effort += state.academic.policy === "focus" ? 2 : 1;
        }
        if (state.flags.academicStatus === "college" && !militaryActive()) {
          state.flags.enrolledMonths = (state.flags.enrolledMonths || 0) + (state.acadRules === 3 && state.colPolicy === "balanced" ? 0.5 : 1);
        }
      }
      effDate = state.month + "-01";
      effPostClose = false;
      tryFillOrders();
      if (storageWriteBlocked || multiTabConflict) return;
      if (CASH_MODE) {
        const income = !militaryActive() && (state.flags.studyPath === "parttime" && b0 && state.month < b0.hsYear + 3 + "-03" || state.flags.career === "job" && state.flags.academicStatus === "graduated") ? 3e5 : 0;
        const tuition = !state.cashEvents.tuitionIssued && state.flags.academicStatus === "college" ? 8e5 : 0;
        state.cash += income;
        const row = { month: state.month, income, living: 1e5, tuition, status: "due", paid: 0 };
        const auto = state.cashAutomation;
        if (auto && auto.enabled && state.month > auto.enabledAfterMonth && !tuition && state.cash >= row.living) {
          state.cash -= row.living;
          row.paid = row.living;
          row.status = "paid";
          auto.paidMonths.push(state.month);
        }
        state.cashEvents.rows.push(row);
        if (tuition) state.cashEvents.tuitionIssued = true;
        state.lastSavings = 0;
      } else if (careerCashActive()) {
        applyCareerCashMonth();
      } else if (!GAME_LIVING) {
        const sv = monthlySavings();
        if (sv > 0) {
          state.cash += sv;
          state.lastSavings = sv;
        } else {
          state.lastSavings = 0;
        }
        applyJobSavingsPlan(sv);
        state.savingsLedger = state.savingsLedger || [];
        state.savingsLedger.push({ month: state.month, amount: sv, reason: militaryActive() ? "\uBCF5\uBB34 \uC911" : state.flags.career === "job" && state.flags.academicStatus === "graduated" ? "\uC878\uC5C5 \uD6C4 \uCDE8\uC5C5" : state.flags.studyPath === "parttime" && b0 && state.month < b0.hsYear + 3 + "-03" ? "\uACE0\uAD50 \uC54C\uBC14" : state.flags.studyPath === "study" && state.academic && state.academic.policy === "balanced" && b0 && !state.flags.academicStatus && state.month < b0.hsYear + 3 + "-03" ? "\uD559\uC5C5 \uBCD1\uD589 \uC54C\uBC14 [\uC2DC\uD5D8\uAC12]" : state.acadRules === 3 && state.flags.academicStatus === "college" && state.colPolicy === "balanced" ? "\uB300\uD559 \uBCD1\uD589 \uC54C\uBC14 [\uC2DC\uD5D8\uAC12]" : sv > 0 ? "\uC9C4\uB85C \uBBF8\uC815 \uC2DC\uC791 \uADDC\uCE59" : "\uC815\uAE30 \uC21C\uC800\uCD95 \uC5C6\uC74C", basis: "test-net-savings-v1" });
      }
      const interestEntries = [];
      for (const [p, h] of Object.entries(state.holdings)) {
        const u = DATA.unlocks.find((x) => x.product === p);
        if (u && (u.rule === "accrual" || u.rule === "fxaccrual")) {
          const before = h.qty, rate = accrualRate(u);
          h.qty = h.qty * (1 + rate.annual / 12);
          if (before > 0) interestEntries.push({
            product: p,
            balanceBefore: before,
            interest: h.qty - before,
            balanceAfter: h.qty,
            annualRate: rate.annual,
            rateLabel: rate.label,
            unit: u.rule === "fxaccrual" ? "USD" : "KRW",
            basis: "prototype-monthly-accrual-v1"
          });
        }
      }
      state.interestLedger = state.interestLedger || [];
      state.interestLedger.push({ month: state.month, entries: interestEntries });
      chaosTick();
      if (state.chaos >= CHAOS.overAt) state.flags.gameOver = "chaos";
    }
    function accrualRate(u) {
      if (u.product === "deposit" && DATA.rates) {
        const rm = addMonths(state.month, -2);
        const pct = DATA.rates.rates[rm];
        if (pct != null) {
          return { annual: pct / 100, label: pct.toFixed(2) + "%/\uB144 (" + rm + " \uD1B5\uACC4 \uCC38\uACE0\uCE58 \xB7 \uBC1C\uD45C\uC77C \uBBF8\uD655\uC778\uC73C\uB85C \uBCF4\uC218\uC801 2\uAC1C\uC6D4 \uC9C0\uC5F0 \uC801\uC6A9 \xB7 \uACC4\uC57D\uAE08\uB9AC \uC544\uB2D8 [\uACF5\uC2DD ECOS \uC218\uCE58 \uB300\uC870 \uC644\uB8CC \xB7 \uACFC\uAC70 \uACF5\uD45C\uC77C \uBBF8\uD655\uC778])" };
        }
      }
      return { annual: u.rate_annual || 0, label: ((u.rate_annual || 0) * 100).toFixed(1) + "%/\uB144 " + (u.rate_note || "[\uC2DC\uD5D8\uC6A9 \uC124\uACC4\uAC12]") + " (\uD655\uC815 \uC2DC\uACC4\uC5F4 \uBBF8\uD655\uBCF4 \uAD6C\uAC04)" };
    }
    function appendSkipBanner(cardEl) {
      if (!state.lastSkip) return;
      const sk = state.lastSkip;
      state.lastSkip = null;
      const sb = document.createElement("div");
      sb.className = "tags";
      sb.textContent = "\uBB36\uC74C \uC9C4\uD589: " + sk.from + "\uBD80\uD130 " + sk.months + "\uAC1C\uC6D4\uC744 \uAC74\uB108\uB6F0\uC5C8\uC5B4\uC694" + (sk.settlements ? " (\uBD84\uAE30 \uC815\uC0B0\uC6D4 " + sk.settlements + "\uD68C \uC9C0\uB098\uCE68 \u2014 \uADF8 \uC0AC\uC774 \uC8FC\uBB38\xB7\uB9AC\uBC38\uB7F0\uC2F1\uC740 \uD558\uC9C0 \uC54A\uC740 \uAC83\uC73C\uB85C \uCC98\uB9AC)" : " (\uADF8 \uC0AC\uC774 \uC0C8 \uC9C1\uC811\uC8FC\uBB38 \uC5C6\uC74C)") + ". \uC800\uCD95\xB7\uC774\uC790\xB7\uCE74\uC624\uC2A4\uB294 \uB9E4\uC6D4 \uADDC\uCE59\uB300\uB85C \uBC18\uC601\uB410\uC5B4\uC694 [\uC2DC\uC5F0 \uADDC\uCE59]." + (state.jobSavingsPlan && state.jobSavingsPlan.percent ? " \uC124\uC815\uD55C \uCDE8\uC5C5 \uC21C\uC800\uCD95 \uC801\uB9BD \uC608\uC57D\uC740 \uACC4\uC18D \uC801\uC6A9\uD588\uC2B5\uB2C8\uB2E4(\uC9C1\uC811 \uC8FC\uBB38\uACFC \uAD6C\uBD84)." : "");
      if (sk.stopOrderChange) sb.textContent += " \uC8FC\uBB38\uBCC0\uD654 \uBA48\uCDA4: " + (sk.orderChanges ? "\uC774\uBC88 \uC9C4\uD589 \uC911 \uC9C0\uC5F0\uCCB4\uACB0 " + sk.orderChanges.fills + "\uAC74\xB7\uAE30\uD55C\uBC18\uD658 " + sk.orderChanges.expiries + "\uAC74\uC744 \uC2E4\uC81C \uBC18\uC601\uD55C \uCCAB \uB2EC\uC5D0\uC11C \uBA48\uCDC4\uC5B4\uC694." : "\uB274\uC2A4\xB7\uC9C4\uB85C\xB7\uC804\uC5ED\xB7\uC885\uB8CC \uB610\uB294 \uBBF8\uC815\uC0B0 \uBD84\uAE30 \uC815\uC0B0\uC774 \uBA3C\uC800 \uC640\uC11C \uBA48\uCDC4\uC5B4\uC694. \uBBF8\uB798 \uCCB4\uACB0\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC544\uC694.");
      cardEl.appendChild(sb);
    }
    function quietStreak() {
      const newsMonths = new Set(DATA.events.map((e) => e.date.slice(0, 7)));
      let n = 0, m = addMonths(state.month, -1);
      while (!newsMonths.has(m) && m >= schoolStartMonth() && n < 24) {
        n++;
        m = addMonths(m, -1);
      }
      return n;
    }
    function quietIntro() {
      if (schoolDataGap()) return "<h2>\uC5ED\uC0AC\uC790\uB8CC\uAC00 \uC544\uC9C1 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC740 \uB2EC</h2><p>\uC774 \uB2EC\uC758 \uB274\uC2A4\uB97C \uD655\uBCF4\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C\uB85C \uC870\uC6A9\uD588\uB358 \uB2EC\uC774\uB77C\uB294 \uB73B\uC774 \uC544\uB2C8\uC5D0\uC694. \uC9C4\uB85C\xB7\uBCF5\uBB34\uC640 \uC6D4\uC9C4\uD589\uB9CC \uC2DC\uD5D8\uD558\uACE0 \uB9E4\uB9E4\uB294 \uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB2EC\uB85C \uD55C \uB2EC\uC529 \uC9C4\uD589\uD560 \uC218 \uC788\uC5B4\uC694.</p>";
      const streak = quietStreak();
      const mm = state.month.slice(5);
      const seasonal = {
        "01": "\uC0C8\uD574 \uCCAB \uB2EC",
        "03": "\uBD84\uAE30 \uB9C8\uAC10\uC758 \uB2EC",
        "06": "\uC0C1\uBC18\uAE30 \uB9C8\uAC10\uC758 \uB2EC",
        "09": "\uBD84\uAE30 \uB9C8\uAC10\uC758 \uB2EC",
        "12": "\uC5F0\uB9D0 \uACB0\uC0B0 \uC2DC\uC98C"
      }[mm] || null;
      const head = "\uC774 \uB2EC\uC5D0 \uC5F0\uACB0\uB41C \uB274\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4";
      let body = "\uD604\uC7AC \uD655\uBCF4\uD55C \uC790\uB8CC\uC5D0\uC11C \uC774 \uB2EC\uC758 \uB274\uC2A4\uAC00 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694. \uC2E4\uC81C \uC2DC\uC7A5\uC774 \uC870\uC6A9\uD588\uAC70\uB098 \uC911\uC694\uD55C \uC77C\uC774 \uC5C6\uC5C8\uB2E4\uB294 \uB73B\uC740 \uC544\uB2C8\uC5D0\uC694.";
      if (streak) body += streak === 24 ? " \uC9C1\uC804 24\uAC1C\uC6D4 \uD655\uC778 \uBC94\uC704\uC5D0\uB3C4 \uC5F0\uACB0\uB41C \uB274\uC2A4\uAC00 \uC5C6\uC5C8\uC5B4\uC694." : " \uC9C1\uC804 " + streak + "\uAC1C\uC6D4\uB3C4 \uC5F0\uACB0\uB41C \uB274\uC2A4\uAC00 \uC5C6\uC5C8\uC5B4\uC694.";
      body += " \uAE30\uC874 \uC6D4 \uADDC\uCE59\uB300\uB85C \uC790\uC0B0\uC744 \uC810\uAC80\uD558\uACE0 \uD55C \uB2EC\uC529 \uC9C4\uD589\uD558\uAC70\uB098 \uD655\uBCF4\uB41C \uB2E4\uC74C \uB274\uC2A4\xB7\uC9C4\uB85C \uACBD\uACC4\uAE4C\uC9C0 \uAC74\uB108\uB6F8 \uC218 \uC788\uC5B4\uC694.";
      if (seasonal) body += " (" + seasonal + ")";
      return "<h2>" + head + '</h2><p class="news-coverage-note">' + body + "</p>";
    }
    function quietMarketLine() {
      if (schoolDataGap()) return '<p class="note">\uC774 \uB2EC\uC758 \uC0C1\uD488 \uC811\uADFC\uACFC \uC2DC\uC138 \uACE0\uC99D \uBBF8\uC644\uB8CC - \uAE30\uC874 \uC774\uD6C4 \uC790\uB8CC\uB97C \uB04C\uC5B4\uC624\uAC70\uB098 \uBCF4\uAC04\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      const [y, m] = state.month.split("-").map(Number);
      const pm = m === 1 ? y - 1 + "-12" : y + "-" + String(m - 1).padStart(2, "0");
      const rows = [];
      for (const s of ["kospi", "kosdaq"]) {
        const cur = priceAt(s, state.month);
        if (!cur) continue;
        const prev = priceAt(s, pm);
        let delta = "";
        if (prev && prev !== cur && prev.value) {
          const pct = (cur.value / prev.value - 1) * 100;
          let span = "";
          if (prev.date.length === 10 && cur.date.length === 10) {
            const days = Math.round((Date.parse(cur.date + "T00:00:00Z") - Date.parse(prev.date + "T00:00:00Z")) / 864e5);
            if (Number.isFinite(days) && days > 0) span = " \xB7 " + (days < 45 ? days + "\uC77C" : "\uC57D " + Math.round(days / 30.44) + "\uAC1C\uC6D4") + " \uAC04\uACA9";
          }
          delta = " \xB7 \uC9C1\uC804 \uD655\uBCF4 \uC9C0\uC810 " + fmtPtDate(prev) + " \uB300\uBE44 " + (pct >= 0 ? "\u25B2" : "\u25BC") + Math.abs(pct).toFixed(1) + "%" + span;
        }
        rows.push((s === "kospi" ? "\uCF54\uC2A4\uD53C" : "\uCF54\uC2A4\uB2E5") + " " + cur.value.toLocaleString() + " (" + fmtPtDate(cur) + " \uC9C0\uC810)" + delta);
      }
      if (!rows.length) return '<p class="note">\uC774 \uC2DC\uC810\uC758 \uC9C0\uC218 \uAC00\uACA9 \uC9C0\uC810\uC740 \uC544\uC9C1 \uD655\uBCF4\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694 (\uACF5\uBC31).</p>';
      return '<p class="note">\uC2DC\uC7A5 \uB3D9\uD5A5: ' + rows.join(" \xB7 ") + "</p>";
    }
    function assetReviewHtml(r = ReturnAssetReview.review(state, totalAssets()), recorded = false) {
      if (!r.available && recorded) return '<details class="asset-review recorded-asset-review"><summary>\uC120\uD0DD \uACB0\uACFC \uBCF5\uAE30 \xB7 \uC774 \uAE30\uB85D\uC758 \uBD84\uD574 \uADFC\uAC70 \uC5C6\uC74C</summary><p class="note">\uB2F9\uC2DC \uC2DC\uC791\uC790\uAE08\xB7\uC6D4 \uC21C\uC800\uCD95 \uBD84\uD574\uAC12\uC744 \uD568\uAED8 \uB0A8\uAE30\uC9C0 \uC54A\uC558\uAC70\uB098 \uC9C0\uC6D0\uD558\uB294 \uD615\uC2DD\uC774 \uC544\uB2C8\uC5D0\uC694. \uCD5C\uC885\uC790\uC0B0\uC5D0\uC11C \uACFC\uAC70 \uC800\uCD95\uC774\uB098 \uC218\uC775\uC744 \uCD94\uCE21 \uBCF5\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694. \uAE30\uC874 \uAE30\uB85D\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uC558\uC5B4\uC694.</p></details>';
      if (!r.available) return '<details class="asset-review"><summary>\uC120\uD0DD \uACB0\uACFC \uBCF5\uAE30 \xB7 \uC804\uCCB4 \uBCC0\uD654 \uBD84\uB9AC \uBD88\uAC00</summary><p class="note">\uC2DC\uC791\uC790\uAE08 \uADFC\uAC70 \uB610\uB294 \uC6D4 \uC21C\uC800\uCD95 \uAE30\uB85D\uC774 \uC628\uC804\uD558\uC9C0 \uC54A\uC544 \uCD1D\uC790\uC0B0\uC744 \uD22C\uC790 \uC131\uACFC\uB85C \uB098\uB204\uC9C0 \uC54A\uC558\uC5B4\uC694. \uC774\uC804 \uC800\uC7A5\uC758 \uACFC\uAC70 \uAE08\uC561\uC744 \uCD94\uCE21\uD558\uC9C0 \uC54A\uC544\uC694. \uAE30\uB85D\uB41C \uC21C\uC800\uCD95\xB7\uC774\uC790\uB294 \uC544\uB798 \uC7A5\uBD80\uC5D0\uC11C \uD655\uC778\uD560 \uC218 \uC788\uC5B4\uC694.</p></details>';
      const money = (n) => n.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "\uC6D0";
      const signed = (n) => (n > 0 ? "+" : "") + money(n);
      return '<details class="asset-review' + (recorded ? " recorded-asset-review" : "") + '"><summary>\uC120\uD0DD \uACB0\uACFC \uBCF5\uAE30 \xB7 ' + (recorded ? "\uC885\uB8CC \uB54C\uC758 \uC790\uC0B0 \uBCC0\uD654" : "\uC790\uC0B0\uC774 \uC5B4\uB514\uC11C \uB298\uC5C8\uB098") + '</summary><p class="note">\uC0C8 \uAC8C\uC784 \uC2DC\uC791\uC790\uAE08\uACFC \uB9E4\uC6D4 \uC2E4\uC81C\uB85C \uAE30\uB85D\uD55C \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC744 ' + (recorded ? "\uAE30\uB85D \uB2F9\uC2DC" : "\uD604\uC7AC") + " \uCD1D\uC790\uC0B0\uC5D0\uC11C \uBD84\uB9AC\uD574\uC694. \uCD1D\uC790\uC0B0\uC774 \uB298\uC5C8\uB2E4\uACE0 \uC804\uBD80 \uD22C\uC790 \uC131\uACFC\uC778 \uAC83\uC740 \uC544\uB2C8\uC5D0\uC694." + (recorded ? " \uAE30\uB85D \uBC94\uC704 " + esc(r.startMonth) + "\uBD80\uD130 " + esc(r.endMonth) + " \uAD00\uCE21\uAE4C\uC9C0\uC608\uC694." : "") + '</p><div class="row"><span>\uC0C8 \uAC8C\uC784 \uC2DC\uC791\uC790\uAE08</span><strong>' + money(r.openingAssets) + '</strong></div><div class="row"><span>\uAE30\uB85D\uB41C \uC2DC\uD5D8 \uC21C\uC800\uCD95<br>' + r.months + "\uAC1C\uC6D4</span><strong>+" + money(r.recordedSavings) + '</strong></div><div class="row"><span>\uC0C1\uD488 \uBCC0\uD654 \uB4F1 \uC794\uCC28</span><strong>' + signed(r.assetChangeRemainder) + '</strong></div><div class="row"><span>' + (recorded ? "\uAE30\uB85D \uB2F9\uC2DC \uC2DC\uC5F0 \uCD1D\uC790\uC0B0" : "\uD604\uC7AC \uC2DC\uC5F0 \uCD1D\uC790\uC0B0") + "</span><strong>" + money(r.totalAssets) + '</strong></div><p class="note">\uC794\uCC28 = ' + (recorded ? "\uAE30\uB85D \uB2F9\uC2DC" : "\uD604\uC7AC") + ' \uCD1D\uC790\uC0B0 - \uC2DC\uC791\uC790\uAE08 - \uAE30\uB85D\uB41C \uC2DC\uD5D8 \uC21C\uC800\uCD95. \uC0C1\uD488 \uD3C9\uAC00\uBCC0\uD654\xB7\uB204\uC801\uC774\uC790\xB7\uD658\uC728\uD658\uC0B0\xB7\uBC18\uC62C\uB9BC \uB4F1\uC774 \uC11E\uC5EC \uC788\uC5B4 \uC218\uC775\uB960\uC774\uB098 \uC2E4\uD604\uC218\uC775\uC774 \uC544\uB2C8\uC5D0\uC694. \uBBF8\uCCB4\uACB0 \uB9E4\uC218 \uC608\uC57D\uAE08\xB7\uB9E4\uB3C4 \uC218\uB7C9\uB3C4 \uCD1D\uC790\uC0B0\uC5D0 \uD3EC\uD568\uD558\uBA70 \uB9E4\uB9E4 \uC6D0\uAE08 \uC774\uB3D9\uC740 \uC218\uC785\uC73C\uB85C \uB354\uD558\uC9C0 \uC54A\uC544\uC694. \uC2E4\uC81C \uD559\uBE44\xB7\uC0DD\uD65C\uBE44\xB7\uC138\uAE08\xB7\uC218\uC218\uB8CC\uB294 \uC5F0\uACB0\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694.</p><p class="note">\uC9C4\uB85C\uC5D0 \uB530\uB978 \uC2DC\uD5D8 \uC21C\uC800\uCD95 \uB204\uC801: ' + (Object.entries(r.savingsByReason).map(([reason, amount]) => esc(reason) + " " + money(amount)).join(" \xB7 ") || "\uC544\uC9C1 \uC6D4 \uC9C4\uD589 \uC5C6\uC74C") + ". \uC774 \uC2DC\uD5D8\uAC12\uB9CC\uC73C\uB85C \uD604\uC2E4\uC758 \uC9C4\uB85C \uC6B0\uC5F4\uC744 \uC815\uD558\uC9C0 \uC54A\uC544\uC694.</p></details>";
    }
    function savingsLedgerHtml() {
      const log = state.savingsLedger || [];
      const total = log.reduce((sum, r) => sum + r.amount, 0);
      const recent = log.slice(-12).reverse();
      return '<details class="savings-ledger"><summary>\uC2DC\uD5D8\uC6A9 \uC21C\uC800\uCD95 \uAE30\uB85D \xB7 ' + log.length + "\uAC1C\uC6D4 \xB7 \uB204\uC801 " + total.toLocaleString() + '\uC6D0</summary><p class="note">\uC2E4\uC81C\uB85C \uC6D4\uC774 \uC9C4\uD589\uB420 \uB54C \uBC18\uC601\uD55C \uC21C\uC800\uCD95\uB9CC \uAE30\uB85D\uD569\uB2C8\uB2E4. \uAC19\uC740 \uB2EC\uC758 \uB274\uC2A4\xB7\uACB0\uC0B0\xB7\uC8FC\uBB38 \uD655\uC778\uC774\uB098 \uC0C8\uB85C\uACE0\uCE68\uC740 \uC800\uCD95\uC744 \uB354\uD558\uC9C0 \uC54A\uC544\uC694. \uAE09\uC5EC \uC218\uC785\xB7\uC0DD\uD65C\uBE44\xB7\uD559\uBE44\xB7\uC138\uAE08\uC758 \uC0C1\uC138 \uC7A5\uBD80\uAC00 \uC544\uB2C8\uBA70 \uAE08\uC561\uC740 \uBAA8\uB450 \uC2DC\uD5D8\uC6A9 \uC124\uACC4\uAC12\uC785\uB2C8\uB2E4. \uAE30\uC874 \uC800\uC7A5\uC758 \uAE30\uB85D \uC2DC\uC791 \uC804 \uAE08\uC561\uC740 \uBCF5\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694.</p>' + (recent.length ? '<p class="note">\uAE30\uB85D \uBC94\uC704 ' + esc(log[0].month) + "\uBD80\uD130 " + esc(log[log.length - 1].month) + "\uAE4C\uC9C0 \xB7 \uCD5C\uADFC " + recent.length + '\uAC1C\uC6D4 \uD45C\uC2DC</p><table style="width:100%;font-size:12px"><thead><tr><th scope="col">\uC6D4</th><th scope="col">\uC2DC\uD5D8 \uC21C\uC800\uCD95</th><th scope="col">\uAD6C\uBD84</th></tr></thead><tbody>' + recent.map((r) => "<tr><td>" + esc(r.month) + "</td><td>" + r.amount.toLocaleString() + "\uC6D0</td><td>" + esc(r.reason) + "</td></tr>").join("") + "</tbody></table>" : '<p class="note">\uC544\uC9C1 \uAE30\uB85D\uB41C \uC6D4\uC774 \uC5C6\uC5B4\uC694. \uB2E4\uC74C \uB2EC \uC9C4\uD589\uBD80\uD130 \uAE30\uB85D\uD569\uB2C8\uB2E4.</p>') + "</details>";
    }
    function interestLedgerHtml() {
      const log = state.interestLedger || [], recent = log.slice(-6).reverse();
      const applied = log.filter((r) => r.entries.length).length;
      function balance(n, unit) {
        return n.toLocaleString("ko-KR", { maximumFractionDigits: unit === "USD" ? 6 : 2 }) + (unit === "USD" ? "\uB2EC\uB7EC" : "\uC6D0");
      }
      return '<details class="interest-ledger"><summary>\uC2DC\uC5F0 \uC6D4 \uC774\uC790 \uAE30\uB85D \xB7 \uAE30\uB85D ' + log.length + "\uAC1C\uC6D4 \xB7 \uC774\uC790 \uBC18\uC601 " + applied + '\uAC1C\uC6D4</summary><p class="note">\uC2E4\uC81C\uB85C \uB2EC\uC774 \uC9C4\uD589\uB418\uBA70 \uC801\uC6A9\uD55C \uACC4\uC0B0\uB9CC \uAE30\uB85D\uD569\uB2C8\uB2E4. \uAC19\uC740 \uB2EC \uB274\uC2A4\xB7\uC8FC\uBB38 \uD655\uC778\xB7\uC0C8\uB85C\uACE0\uCE68\uC740 \uC774\uC790 \uD68C\uCC28\uB97C \uB298\uB9AC\uC9C0 \uC54A\uC544\uC694. \uC6D0\uD654\uC640 \uB2EC\uB7EC\uB97C \uD569\uC0B0\uD558\uC9C0 \uC54A\uC73C\uBA70 \uC774\uC790\uB294 \uD604\uAE08 \uC785\uAE08\uC774 \uC544\uB2C8\uB77C \uD574\uB2F9 \uC0C1\uD488 \uC794\uC561\uC5D0 \uB354\uD574\uC9D1\uB2C8\uB2E4. \uC138\uC804 \uC6D4\uBCF5\uB9AC \uC2DC\uC5F0 \uACC4\uC0B0\uC774\uBA70 \uC2E4\uC81C \uACC4\uC57D\xB7\uC138\uD6C4 \uC218\uC775\uC744 \uC7AC\uD604\uD55C \uAC83\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAD6C \uC800\uC7A5\uC758 \uC774\uC804 \uD68C\uCC28\uB294 \uBCF5\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694.</p>' + (recent.length ? '<p class="note">\uAE30\uB85D \uBC94\uC704 ' + esc(log[0].month) + "\uBD80\uD130 " + esc(log[log.length - 1].month) + "\uAE4C\uC9C0 \xB7 \uCD5C\uADFC " + recent.length + "\uAC1C\uC6D4 \uD45C\uC2DC. \uD654\uBA74\uC740 \uBC18\uC62C\uB9BC\uD558\uBA70 \uC800\uC7A5 \uACC4\uC0B0\uAC12\uC740 \uC6D0\uC815\uBC00\uB3C4\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4.</p>" + recent.map((r) => '<div class="monthly-interest-entry" style="padding:8px 0;border-top:1px solid #ddd;overflow-wrap:anywhere"><strong>' + esc(r.month) + "</strong>" + (r.entries.length ? r.entries.map((e) => '<p class="note">' + esc((DATA.unlocks.find((u) => u.product === e.product) || {}).name || e.product) + " \xB7 \uACC4\uC0B0 \uC794\uC561 " + balance(e.balanceBefore, e.unit) + " \u2192 " + balance(e.balanceAfter, e.unit) + "<br>\uBC18\uC601 \uC774\uC790 +" + balance(e.interest, e.unit) + " \xB7 \uC5F0\uC728\xF712 \uC801\uC6A9<br>" + esc(e.rateLabel) + "</p>").join("") : '<p class="note">\uC774\uC790 \uB204\uC801 \uC0C1\uD488\uC758 \uBCF4\uC720 \uC794\uC561\uC774 \uC5C6\uC5B4 \uC774\uC790 \uBC18\uC601 \uC5C6\uC74C</p>') + "</div>").join("") : '<p class="note">\uC544\uC9C1 \uAE30\uB85D\uB41C \uC6D4\uC774 \uC5C6\uC5B4\uC694. \uB2E4\uC74C \uB2EC \uC9C4\uD589\uBD80\uD130 \uAE30\uB85D\uD569\uB2C8\uB2E4.</p>') + "</details>";
    }
    function pendingOrderReview(o) {
      const split = o.split && o.split.n > 1;
      const remaining = o.kind === "buy" ? o.amount - (split ? o.split.invested || 0 : 0) : o.qty - (split ? o.split.soldQty || 0 : 0);
      const waited = Math.max(0, monthsBetween(o.placedMonth, state.month));
      let reason;
      if (!o.obsCutoff || typeof o.obsPostClose !== "boolean") reason = "\uC811\uC218 \uAD00\uCE21\uC2DC\uAC01 \uBBF8\uD655\uC778: \uAD6C \uD615\uC2DD \uC8FC\uBB38\uC740 \uCD94\uCE21 \uCCB4\uACB0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      else if (o.earliestFillMonth && (state.flags.settledMonth || "") < o.earliestFillMonth) reason = "\uBD84\uAE30 \uC815\uC0B0 \uB300\uAE30: " + o.earliestFillMonth + " \uC815\uC0B0 \uC120\uD0DD \uC644\uB8CC\uAC00 \uBA3C\uC800\uC785\uB2C8\uB2E4.";
      else {
        const u = productRule(o.product), pt = priceAt(u.series || o.product, state.month);
        const prevMonth = addMonths(state.month, -1);
        const ptPrev = priceAt(u.series || o.product, prevMonth);
        const noNewPointThisMonth = !!(pt && ptPrev && (pt.usable_from || pt.date) === (ptPrev.usable_from || ptPrev.date));
        const noNewNote = noNewPointThisMonth ? "\uC774\uBC88 \uB2EC \uC0C8 \uD655\uBCF4 \uC9C0\uC810\uC740 \uC544\uC9C1 \uACF5\uAC1C\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4(\uC790\uB8CC \uACF5\uBC31\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4). " : "";
        if (!productAvailable(u)) reason = "\uC0C1\uD488 \uC811\uADFC \uADFC\uAC70 \uB300\uAE30: \uD604\uC7AC \uC811\uADFC\uC774 \uC5F4\uB9AC\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
        else if (!pt || !wasObservableAt(pt, effDate, effPostClose) || wasObservableAt(pt, o.obsCutoff, o.obsPostClose)) reason = "\uAD00\uCE21 \uC5C6\uC74C: \uC811\uC218 \uB4A4 \uC0C8\uB85C \uACF5\uAC1C\uB41C \uC2E4\uD589 \uAC00\uB2A5 \uC9C0\uC810\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4. \uC9C0\uC810\uC774 \uACF5\uAC1C\uB3FC\uC57C \uC870\uAC74 \uD310\uC815\xB7\uCCB4\uACB0 \uAC80\uC0AC\uAC00 \uAC00\uB2A5\uD569\uB2C8\uB2E4.";
        else if (o.condition && (o.conditionRules === 1 ? o.condition.op === "below" ? pt.value > o.condition.value : pt.value < o.condition.value : o.kind === "buy" && o.condition.op === "below" && pt.value > o.condition.value || o.kind === "sell" && o.condition.op === "above" && pt.value < o.condition.value)) reason = noNewNote + "\uC870\uAC74 \uBBF8\uB3C4\uB2EC: \uAC00\uC7A5 \uCD5C\uADFC \uACF5\uAC1C \uC9C0\uC810 " + pt.date + " " + pt.value.toLocaleString() + "\uC740(\uB294) \uC124\uC815 \uC870\uAC74(" + o.condition.value.toLocaleString() + (o.condition.op === "below" ? " \uC774\uD558" : " \uC774\uC0C1") + ")\uC5D0 \uB2FF\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC0C8 \uC9C0\uC810\uC774 \uACF5\uAC1C\uB418\uBA74 \uADF8 \uC9C0\uC810\uC73C\uB85C\uB9CC \uB2E4\uC2DC \uD310\uC815\uD558\uBA70, \uC774 \uD45C\uC2DC\uB294 \uCCB4\uACB0\uC744 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
        else if (split && o.split.lastPtKey === (pt.usable_from || pt.date)) reason = noNewNote + "\uB2E4\uC74C \uBD84\uD560 \uC9C0\uC810 \uB300\uAE30: \uD604\uC7AC \uACF5\uAC1C \uC9C0\uC810\uC740 \uC774\uBBF8 \uD55C \uD68C\uBD84\uC5D0 \uC0AC\uC6A9\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC0C8 \uC9C0\uC810\uC774 \uACF5\uAC1C\uB3FC\uC57C \uB2E4\uC74C \uD68C\uBD84\uC744 \uAC80\uC0AC\uD569\uB2C8\uB2E4.";
        else if (u.rule === "fxprice" && !priceAt("fx", state.month)) reason = "\uD658\uC728 \uC9C0\uC810 \uB300\uAE30: \uC6D0\uD654 \uCCB4\uACB0\uAC00\uB97C \uACC4\uC0B0\uD560 \uAD00\uCE21\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
        else reason = noNewNote + "\uD604\uC7AC \uACF5\uAC1C \uC9C0\uC810\uC73C\uB85C \uB2E4\uC74C \uC9D1\uD589 \uAC80\uC0AC\uB97C \uAE30\uB2E4\uB9BD\uB2C8\uB2E4. \uC774 \uD45C\uC2DC\uAC00 \uCCB4\uACB0\uC744 \uBCF4\uC7A5\uD558\uC9C0\uB294 \uC54A\uC2B5\uB2C8\uB2E4.";
        if (o.expiresAt) reason += " \uAE30\uD55C \uBC18\uD658 \uC608\uC815: " + o.expiresAt + " \uC6D4\uCD08\uC5D0 \uBBF8\uCCB4\uACB0 " + (o.kind === "buy" ? "\uC608\uC57D\uAE08 " + remaining.toLocaleString() + "\uC6D0\uC774 \uD604\uAE08\uC73C\uB85C" : "\uC7A0\uAE08 \uC218\uB7C9\uC774 \uBCF4\uC720\uBD84\uC73C\uB85C") + " \uC790\uB3D9 \uBC18\uD658\uB429\uB2C8\uB2E4. \uB9CC\uB8CC\uC6D4\uC5D0\uB294 \uC0C8 \uAD00\uCE21\uC774 \uACF5\uAC1C\uB3FC\uB3C4 \uCCB4\uACB0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      }
      return { remaining, waited, reason };
    }
    function careerMechanicsSummary(log) {
      const valid = (f) => f && (f.kind === "buy-fill" || f.kind === "sell-fill") && typeof f.product === "string";
      const fills = (Array.isArray(log) ? log : []).filter(valid);
      const job = fills.filter((f) => ["job-savings", "career-cash"].includes(f.planOrigin) && f.kind === "buy-fill");
      const isSplit = (f) => Number.isInteger(f.splitN) && f.splitN > 1;
      const cond = fills.filter((f) => f.conditional === true);
      const split = fills.filter((f) => isSplit(f) && !["job-savings", "career-cash"].includes(f.planOrigin) && f.conditional !== true);
      const other = fills.filter((f) => !["job-savings", "career-cash"].includes(f.planOrigin) && !isSplit(f) && f.conditional !== true);
      let comparable = 0, comparableBuy = 0, comparableSell = 0, sumBuy = 0, sumSell = 0, noBase = 0;
      for (const f of cond) {
        if (!(Number.isFinite(f.basePtValue) && f.basePtValue > 0 && Number.isFinite(f.price) && f.price > 0)) {
          noBase++;
          continue;
        }
        if (f.kind === "buy-fill") {
          sumBuy += f.price / f.basePtValue - 1;
          comparableBuy++;
        } else {
          sumSell += f.price / f.basePtValue - 1;
          comparableSell++;
        }
        comparable++;
      }
      const pct = (x) => Math.round(x * 1e3) / 10;
      return {
        version: 3,
        totalFills: fills.length,
        jobSavingsFills: job.length,
        jobSavingsInvested: job.reduce((s, f) => s + (Number.isFinite(f.amount) ? f.amount : 0), 0),
        splitFills: split.length,
        conditionalFills: cond.length,
        comparable,
        comparableBuy,
        comparableSell,
        noBase,
        avgVsBasePctBuy: comparableBuy ? pct(sumBuy / comparableBuy) : null,
        avgVsBasePctSell: comparableSell ? pct(sumSell / comparableSell) : null,
        otherFills: other.length
      };
    }
    function careerMechanicsLine(s) {
      if (!s || s.version !== 3) return null;
      const safe = ["totalFills", "jobSavingsFills", "jobSavingsInvested", "splitFills", "conditionalFills", "comparable", "comparableBuy", "comparableSell", "noBase", "otherFills"].every((k) => Number.isInteger(s[k]) && s[k] >= 0) && (s.avgVsBasePctBuy === null || Number.isFinite(s.avgVsBasePctBuy)) && (s.avgVsBasePctSell === null || Number.isFinite(s.avgVsBasePctSell));
      if (!safe) return null;
      const signed = (v) => (v > 0 ? "+" : "") + v + "%";
      const parts = [];
      parts.push("\uCDE8\uC5C5 \uC790\uB3D9 \uC801\uB9BD \uCCB4\uACB0 " + s.jobSavingsFills + "\uAC74 \xB7 \uB204\uC801 \uD22C\uC785 " + s.jobSavingsInvested.toLocaleString() + "\uC6D0");
      let condPart = "\uC804\uC5C5 \uC804\uC6A9 \uC870\uAC74 \uC8FC\uBB38 \uCCB4\uACB0 " + s.conditionalFills + "\uAC74";
      if (s.comparableBuy > 0) condPart += " \xB7 \uB9E4\uC218 " + s.comparableBuy + "\uAC74\uC758 \uCCB4\uACB0\uAC00\uB294 \uC811\uC218 \uC2DC \uAD00\uCE21 \uAE30\uC900 \uC9C0\uC810 \uAC12 \uB300\uBE44 \uD3C9\uADE0 " + signed(s.avgVsBasePctBuy) + "(\uCCB4\uACB0\uAC00\xF7\uAE30\uC900\u22121, \uAC00\uACA9 \uBCC0\uD654 \uC6D0\uBD80\uD638)";
      if (s.comparableSell > 0) condPart += " \xB7 \uB9E4\uB3C4 " + s.comparableSell + "\uAC74\uC758 \uCCB4\uACB0\uAC00\uB294 \uC811\uC218 \uC2DC \uAD00\uCE21 \uAE30\uC900 \uC9C0\uC810 \uAC12 \uB300\uBE44 \uD3C9\uADE0 " + signed(s.avgVsBasePctSell) + "(\uCCB4\uACB0\uAC00\xF7\uAE30\uC900\u22121, \uAC00\uACA9 \uBCC0\uD654 \uC6D0\uBD80\uD638)";
      parts.push(condPart);
      if (s.noBase > 0) parts.push("\uAE30\uC900 \uC9C0\uC810 \uBBF8\uAE30\uB85D\xB7\uD1B5\uD654 \uBD84\uB9AC \uBD88\uAC00\uB85C \uBE44\uAD50 null " + s.noBase + "\uAC74");
      parts.push("\uC804\uC5C5 \uC804\uC6A9 \uBD84\uD560 \uC8FC\uBB38 \uCCB4\uACB0 " + s.splitFills + "\uAC74");
      if (s.otherFills > 0) parts.push("\uADF8 \uBC16\uC758 \uCCB4\uACB0 " + s.otherFills + "\uAC74(\uC218\uB3D9 \uC608\uC57D\xB7\uB9C8\uCEE4 \uB3C4\uC785 \uC804 \uCCB4\uACB0. \uC870\uAC74 \uC8FC\uBB38\uC774\uC5C8\uB294\uC9C0 \uAE30\uB85D\uC774 \uC5C6\uC5B4 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4)");
      return parts.join(" \xB7 ");
    }
    function careerMechanicsHtml() {
      const s = careerMechanicsSummary(state.fillsLog);
      if (!(s.totalFills > 0)) return "";
      const line = careerMechanicsLine(s);
      return '<details class="career-mechanics"><summary>\uC9C4\uB85C \uC804\uC6A9 \uADDC\uCE59 \uCCB4\uACB0 \uC2E4\uC801</summary><p>' + esc(line || "\uC9D1\uACC4 \uADFC\uAC70\uB97C \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uAE30\uB85D\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.") + '</p><p class="note">\uCCB4\uACB0 \uC7A5\uBD80\uC5D0 \uC2E4\uC81C \uAE30\uB85D\uB41C \uCCB4\uACB0\uB9CC \uC9D1\uACC4\uD569\uB2C8\uB2E4. \uC870\uAC74 \uBBF8\uCDA9\uC871 \uB300\uAE30\xB7\uCDE8\uC18C\xB7\uB9CC\uB8CC \uC8FC\uBB38\uC740 \uCCB4\uACB0\uC774 \uC544\uB2C8\uB77C \uC9D1\uACC4\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4. \uC811\uC218 \uC2DC \uAD00\uCE21 \uAE30\uC900 \uC9C0\uC810\uC740 \uC811\uC218 \uC2DC\uC810\uC5D0 \uC2E4\uC81C \uCCB4\uACB0 \uAC00\uB2A5\uD588\uB358 \uAC00\uACA9\uC774 \uC544\uB2C8\uBA70, \uAE30\uC900 \uB300\uBE44 \uCC28\uC774\uB294 \uC218\uC775 \uAC1C\uC120\uC774\uB098 \uC870\uAC74 \uC8FC\uBB38\uC758 \uC6B0\uC704\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD3C9\uADE0\uC740 \uC11C\uB85C \uB2E4\uB978 \uB0A0\uC9DC\xB7\uAE30\uC900 \uAC12\uC758 \uB2E8\uC21C \uD3C9\uADE0\uC73C\uB85C \uC2DC\uC810\uC774 \uB2E4\uB978 \uAC00\uACA9\uC744 \uC11E\uC740 \uCC38\uACE0\uAC12\uC785\uB2C8\uB2E4. \uAC1C\uBCC4 \uCCB4\uACB0\uC758 \uB0A0\uC9DC\xB7\uC9C0\uC810\xB7\uC870\uAC74\uC740 \uCCB4\uACB0 \uC7A5\uBD80 \uD56D\uBAA9\uC774 \uC6D0\uBCF8\uC785\uB2C8\uB2E4. \uBE44\uAD50\uB294 \uC6D0\uD654 \uC9C0\uC218 \uC0C1\uD488\uB9CC\uC774\uBA70 \uB2EC\uB7EC \uC9C0\uC218\xB7\uD658\uC728 \uACB0\uD569 \uC0C1\uD488\uC740 \uB2E8\uC704\xB7\uD1B5\uD654\uB97C \uBD84\uB9AC\uD560 \uC218 \uC5C6\uC5B4 null\uC785\uB2C8\uB2E4. \uC9C4\uB85C\uC758 \uC218\uC775 \uC6B0\uC5F4\uC774\uB098 \uD604\uC2E4 \uC7AC\uD604\uC774 \uC544\uB2C8\uB77C \uC774\uBC88 \uD68C\uADC0\uC5D0\uC11C \uC804\uC6A9 \uADDC\uCE59\uC774 \uC2E4\uC81C\uB85C \uC9D1\uD589\uB41C \uAE30\uB85D\uC785\uB2C8\uB2E4.</p></details>';
    }
    function fillLedgerEntries() {
      const month = (v) => typeof v === "string" && /^\d{4}-\d{2}$/.test(v), date = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
      return (Array.isArray(state.fillsLog) ? state.fillsLog : []).map((f, index) => ({ f, index })).filter(({ f }) => f && ["buy-fill", "sell-fill"].includes(f.kind) && typeof f.product === "string" && month(f.month) && Number.isFinite(f.price) && f.price > 0 && (f.kind === "buy-fill" ? Number.isFinite(f.amount) && f.amount > 0 : Number.isFinite(f.proceeds) && f.proceeds >= 0));
    }
    function fillLedgerHtml(selected = null) {
      const log = state.fillsLog;
      if (log == null || Array.isArray(log) && !log.length) return '<p class="note fill-ledger-empty">\uC544\uC9C1 \uC800\uC7A5\uB41C \uC9C0\uC5F0\uCCB4\uACB0 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38 \uC811\uC218\xB7\uC989\uC2DC \uC608\uCE58\xB7\uCDE8\uC18C\uB97C \uCCB4\uACB0\uB85C \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      if (!Array.isArray(log)) return '<p class="note fill-ledger-unavailable">\uC800\uC7A5\uB41C \uCCB4\uACB0 \uC7A5\uBD80 \uD615\uC2DD\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uAE30\uB85D\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      const month = (v) => typeof v === "string" && /^\d{4}-\d{2}$/.test(v), date = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const entries = fillLedgerEntries();
      const recent = selected === null ? entries.slice(-10).reverse() : selected;
      let html = '<details class="fill-ledger"><summary style="min-height:44px;box-sizing:border-box;padding:10px 0;cursor:pointer;">\uCCB4\uACB0 \uC7A5\uBD80 \xB7 ' + (selected === null ? "\uC800\uC7A5 \uC21C\uC11C \uCD5C\uADFC " : "\uD544\uD130\uB85C \uACE0\uB978 \uAE30\uB85D ") + recent.length + "\uAC74 / \uC77D\uC744 \uC218 \uC788\uB294 " + entries.length + '\uAC74</summary><p class="note">\uC0C8\uB85C \uAD00\uCE21\uB41C \uC9C0\uC810\uC73C\uB85C \uC2E4\uD589\uD55C \uC9C0\uC5F0\uCCB4\uACB0\uB9CC \uBCF4\uC5EC\uC90D\uB2C8\uB2E4. \uCD5C\uADFC \uC800\uC7A5 \uC21C\uC11C\uAC00 \uBA3C\uC800\uC774\uBA70 \uBC88\uD638\uB294 \uC804\uCCB4 \uC7A5\uBD80\uC758 \uC6D0\uB798 \uC704\uCE58\uC785\uB2C8\uB2E4. \uAC19\uC740 \uB2EC\xB7\uAC19\uC740 \uAC00\uACA9\uC758 \uC801\uB9BD\uB3C4 \uAC1C\uBCC4 \uC8FC\uBB38 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4. \uC811\uC218 \uAD00\uCE21\uAC8C\uC774\uD2B8\uB294 \uC2E4\uC81C \uC8FC\uBB38\uC77C\xB7\uCCAB \uACF5\uAC1C\uC2DC\uAC01\uACFC \uB2E4\uB97C \uC218 \uC788\uACE0, \uAE30\uB85D\uB418\uC9C0 \uC54A\uC740 \uB0A0\uC9DC\xB7\uC218\uB7C9\uC740 \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC989\uC2DC \uC608\uCE58\xB7\uD574\uC9C0\xB7\uCDE8\uC18C\uB294 \uC774 \uC7A5\uBD80 \uBC16\uC774\uBA70 \uC138\uAE08\xB7\uC218\uC218\uB8CC\xB7\uD604\uC2E4 \uC218\uC775\uB960\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      if (entries.length !== log.length) html += '<p class="note fill-ledger-skipped">\uC77D\uC744 \uC218 \uC5C6\uB294 ' + (log.length - entries.length) + "\uAC74\uC740 \uAE08\uC561\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uACE0 \uC81C\uC678\uD588\uC2B5\uB2C8\uB2E4. \uC6D0\uB798 \uC800\uC7A5\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.</p>";
      for (const { f, index } of recent) {
        const number = (n) => Number.isFinite(n) ? n.toLocaleString() + "\uC6D0" : "\uAE30\uB85D \uC5C6\uC74C";
        html += '<article class="fill-ledger-entry" data-fill-index="' + index + '" style="border-top:1px solid #e5e0dc;padding:10px 0;overflow-wrap:anywhere;"><strong>#' + (index + 1) + " \xB7 " + esc(f.month) + " \uCCB4\uACB0 \uAD00\uCE21 \xB7 " + esc(productRule(f.product).name || f.product) + " " + (f.kind === "buy-fill" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + "</strong><p>" + (f.kind === "buy-fill" ? "\uD22C\uC785\uAE08 " + number(f.amount) : "\uB9E4\uB3C4\uB300\uAE08 " + number(f.proceeds) + " \xB7 \uCDE8\uB4DD\uC6D0\uAC00 " + number(f.costBasis) + " \xB7 \uC2DC\uC5F0 \uC190\uC775 " + number(f.pnl)) + '</p><p class="note">\uC9C0\uC810 ' + f.price.toLocaleString() + " \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C " + (date(f.ptDate) ? esc(f.ptDate) : "\uAE30\uB85D \uC5C6\uC74C") + " \xB7 \uAD00\uCE21\uAC8C\uC774\uD2B8(\uC870\uAC74\uBCC0\uACBD \uC2DC \uAC31\uC2E0 \uAC00\uB2A5) " + (date(f.obsCutoff) ? esc(f.obsCutoff) : "\uAE30\uB85D \uC5C6\uC74C") + (date(f.usableFrom) ? " \xB7 \uAE30\uB85D\uB41C \uC774\uC6A9 \uAC00\uB2A5\uC77C " + esc(f.usableFrom) : " \xB7 \uC774\uC6A9 \uAC00\uB2A5\uC77C \uAE30\uB85D \uC5C6\uC74C") + (date(f.fxPtDate) ? " \xB7 \uD658\uC728 \uAE30\uC900\uC77C " + esc(f.fxPtDate) : "") + "</p>";
        if (Number.isInteger(f.splitPart) && Number.isInteger(f.splitN) && f.splitPart > 0 && f.splitPart <= f.splitN) html += '<p class="note">\uBD84\uD560 ' + f.splitPart + "/" + f.splitN + " \uCCB4\uACB0\uBD84</p>";
        if (f.conditional === true) {
          const readableCondition = Number.isFinite(f.conditionValue) && f.conditionValue > 0 && ["above", "below"].includes(f.conditionOp);
          let cl = readableCondition ? "\uC870\uAC74 \uC8FC\uBB38 \uCCB4\uACB0 \xB7 \uC870\uAC74: \uC0C8 \uD655\uBCF4 \uC9C0\uC810 " + f.conditionValue.toLocaleString() + (f.conditionOp === "below" ? " \uC774\uD558" : " \uC774\uC0C1") + "\uC77C \uB54C\uB9CC" : "\uC870\uAC74 \uC8FC\uBB38 \uCCB4\uACB0 \xB7 \uC870\uAC74\uAC12\xB7\uBC29\uD5A5 \uAE30\uB85D \uBD88\uC644\uC804(\uCD94\uC815\uD558\uC9C0 \uC54A\uC74C)";
          if (date(f.basePtDate)) cl += " \xB7 \uC811\uC218 \uC2DC \uAD00\uCE21 \uAE30\uC900 \uC9C0\uC810 " + (Number.isFinite(f.basePtValue) ? Number(f.basePtValue).toLocaleString() : "\uAC12 \uAE30\uB85D \uC5C6\uC74C") + " (" + esc(f.basePtDate) + ")";
          if (Number.isFinite(f.basePtValue) && f.basePtValue > 0) {
            const pct = Math.round((f.price / f.basePtValue - 1) * 1e3) / 10;
            cl += " \xB7 \uAE30\uC900 \uB300\uBE44 " + (pct > 0 ? "+" : "") + pct + "%(\uCCB4\uACB0\uAC00\xF7\uAE30\uC900\u22121, \uAC00\uACA9 \uBCC0\uD654 \uC6D0\uBD80\uD638 \xB7 \uB2E8\uC21C \uAE30\uC900 \uAD00\uCE21 \uB300\uBE44 \xB7 \uC811\uC218 \uC2DC \uC2E4\uC81C \uCCB4\uACB0 \uAC00\uB2A5 \uAC00\uACA9 \uC544\uB2D8)";
          } else cl += " \xB7 \uAE30\uC900 \uC9C0\uC810 \uAC12 \uBBF8\uAE30\uB85D\xB7\uD1B5\uD654 \uBD84\uB9AC \uBD88\uAC00\uB85C \uBE44\uAD50 null";
          html += '<p class="note">' + esc(cl) + "</p>";
        }
        if (["job-savings", "career-cash"].includes(f.planOrigin)) html += '<p class="note">\uCDE8\uC5C5 \uC2E0\uADDC \uC21C\uC800\uCD95 \uC801\uB9BD \uC608\uC57D</p>';
        if (date(f.ptDate) && date(f.obsCutoff) && f.ptDate < f.obsCutoff) html += '<p class="note">\uAC00\uACA9 \uD615\uC131\uC77C\uC774 \uC811\uC218 \uAD00\uCE21\uAC8C\uC774\uD2B8\uBCF4\uB2E4 \uACFC\uAC70\uC778 \uB2A6\uC740 \uACF5\uAC1C \uC9C0\uC810\uC785\uB2C8\uB2E4 [\uC2DC\uC5F0 \uAC00\uC815].</p>';
        html += "</article>";
      }
      return html + "</details>";
    }
    function openFillLibrary() {
      if (storageReadBlocked || storageWriteBlocked || multiTabConflict || document.getElementById("fill-library")) return;
      const origin = document.activeElement, all = fillLedgerEntries();
      const entries = all.filter(({ f }) => f.month <= state.month && (!f.usableFrom || f.usableFrom <= effDate) && (!f.ptDate || f.ptDate <= effDate)).reverse();
      const dialog = document.createElement("dialog");
      dialog.id = "fill-library";
      dialog.setAttribute("aria-labelledby", "fill-library-title");
      dialog.style.cssText = "box-sizing:border-box;width:calc(100vw - 24px);max-width:640px;max-height:88dvh;margin:auto;overflow:auto;border:1px solid #cfc7be;border-radius:14px;padding:18px;background:#fffdf9;color:#24201d;";
      dialog.innerHTML = '<h2 id="fill-library-title">\uC800\uC7A5\uB41C \uC804\uCCB4 \uCCB4\uACB0 \uCC3E\uAE30</h2><p>\uC774\uBC88 \uD68C\uADC0\uC758 \uC9C0\uC5F0\uCCB4\uACB0\uC744 \uCD5C\uADFC \uC800\uC7A5 \uC21C\uC11C\uBD80\uD130 \uBD05\uB2C8\uB2E4. \uBC88\uD638\uB294 \uC804\uCCB4 \uC7A5\uBD80\uC758 \uC6D0\uB798 \uC704\uCE58\uC785\uB2C8\uB2E4. \uC811\uC218 \uAD00\uCE21\uAC8C\uC774\uD2B8\xB7\uC774\uC6A9 \uAC00\uB2A5\uC77C\uC740 \uC2E4\uC81C \uC8FC\uBB38\uC77C\xB7\uCD5C\uCD08 \uACF5\uD45C\uC77C \uC99D\uAC70\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC989\uC2DC \uC608\uCE58\xB7\uD574\uC9C0\xB7\uCDE8\uC18C\uB294 \uC774 \uC7A5\uBD80 \uBC16\uC774\uBA70 \uD604\uC2E4 \uC218\uC775\uB960\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC5F4\uB78C\uC740 \uC6D4\xB7\uC8FC\uBB38\xB7\uB3C8\xB7\uC800\uC7A5\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><label for="fill-library-year">\uCCB4\uACB0 \uAD00\uCE21\uC5F0\uB3C4</label><select id="fill-library-year"><option value="">\uC804\uCCB4 \uC5F0\uB3C4</option></select><label for="fill-library-product">\uC0C1\uD488</label><select id="fill-library-product"><option value="">\uC804\uCCB4 \uC0C1\uD488</option></select><label for="fill-library-kind">\uBC29\uD5A5</label><select id="fill-library-kind"><option value="">\uB9E4\uC218\xB7\uB9E4\uB3C4 \uBAA8\uB450</option><option value="buy-fill">\uB9E4\uC218</option><option value="sell-fill">\uB9E4\uB3C4</option></select><button id="fill-library-clear" type="button">\uD544\uD130 \uC9C0\uC6B0\uAE30</button><p id="fill-library-count" role="status" aria-live="polite"></p><div id="fill-library-results"></div><div style="display:flex;gap:8px"><button id="fill-library-prev" type="button">\uC774\uC804 12\uAC74</button><button id="fill-library-next" type="button">\uB2E4\uC74C 12\uAC74</button></div><button id="fill-library-close" type="button">\uB2EB\uAE30 \xB7 \uC6D0\uB798 \uD310\uB2E8 \uD654\uBA74</button>';
      dialog.querySelector("h2").style.cssText = "font-size:21px;font-weight:700;margin:0 0 12px";
      dialog.querySelectorAll("button").forEach((b) => b.style.cssText = "box-sizing:border-box;min-height:44px;width:100%;padding:10px 12px;margin:6px 0;border:1px solid #d6d0c9;border-radius:9px;background:#fff;color:#24201d;font:inherit;cursor:pointer");
      dialog.querySelectorAll("select").forEach((e) => e.style.cssText = "box-sizing:border-box;display:block;width:100%;min-height:44px;margin:6px 0 12px;padding:8px;border:1px solid #d6d0c9;border-radius:6px;background:#fff;color:#24201d;font:inherit");
      const year = dialog.querySelector("#fill-library-year"), product = dialog.querySelector("#fill-library-product"), kind = dialog.querySelector("#fill-library-kind");
      [...new Set(entries.map(({ f }) => f.month.slice(0, 4)))].sort().reverse().forEach((y) => {
        const op = document.createElement("option");
        op.value = y;
        op.textContent = y + "\uB144";
        year.append(op);
      });
      [...new Set(entries.map(({ f }) => f.product))].sort().forEach((p) => {
        const op = document.createElement("option");
        op.value = p;
        op.textContent = productRule(p).name || p;
        product.append(op);
      });
      let page = 0;
      const paint = () => {
        const matches = entries.filter(({ f }) => (!year.value || f.month.startsWith(year.value)) && (!product.value || f.product === product.value) && (!kind.value || f.kind === kind.value));
        page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(matches.length / 12) - 1)));
        const shown = matches.slice(page * 12, page * 12 + 12), out = dialog.querySelector("#fill-library-results");
        out.innerHTML = "";
        const rawCount = Array.isArray(state.fillsLog) ? state.fillsLog.length : 0;
        dialog.querySelector("#fill-library-count").textContent = matches.length + "\uAC74 / \uD604\uC7AC \uAD00\uCE21\uC77C\uAE4C\uC9C0 \uC77D\uC744 \uC218 \uC788\uB294 " + entries.length + "\uAC74" + (shown.length ? " \xB7 " + (page * 12 + 1) + "~" + (page * 12 + shown.length) + "\uBC88\uC9F8" : "") + (rawCount !== entries.length ? " \xB7 \uD615\uC2DD\xB7\uAD00\uCE21 \uBC94\uC704\uAC00 \uB9DE\uC9C0 \uC54A\uB294 " + (rawCount - entries.length) + "\uAC74 \uC81C\uC678" : "");
        if (shown.length) {
          const fragment = document.createElement("div");
          fragment.innerHTML = fillLedgerHtml(shown);
          fragment.querySelectorAll(".fill-ledger-entry").forEach((e) => out.append(e));
        } else {
          const empty = document.createElement("p");
          empty.id = "fill-library-empty";
          empty.textContent = entries.length ? "\uC774 \uD544\uD130\uC5D0 \uB9DE\uB294 \uCCB4\uACB0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uD544\uD130\uB97C \uC9C0\uC6B0\uBA74 \uB2E4\uC2DC \uBCFC \uC218 \uC788\uC5B4\uC694." : Array.isArray(state.fillsLog) || state.fillsLog == null ? "\uD604\uC7AC \uAD00\uCE21\uC77C\uAE4C\uC9C0 \uC77D\uC744 \uC218 \uC788\uB294 \uC9C0\uC5F0\uCCB4\uACB0 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uACFC\uAC70 \uAE30\uB85D\xB7\uC218\uB7C9\uC744 \uCD94\uC815\uD574 \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uC800\uC7A5\uB41C \uCCB4\uACB0 \uC7A5\uBD80 \uD615\uC2DD\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uACFC\uAC70 \uAE30\uB85D\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
          out.append(empty);
        }
        dialog.querySelector("#fill-library-prev").disabled = page === 0;
        dialog.querySelector("#fill-library-next").disabled = (page + 1) * 12 >= matches.length;
      };
      year.onchange = product.onchange = kind.onchange = () => {
        page = 0;
        paint();
      };
      dialog.querySelector("#fill-library-clear").onclick = () => {
        year.value = "";
        product.value = "";
        kind.value = "";
        page = 0;
        paint();
        year.focus({ preventScroll: true });
        dialog.scrollTop = 0;
      };
      dialog.querySelector("#fill-library-prev").onclick = () => {
        page--;
        paint();
      };
      dialog.querySelector("#fill-library-next").onclick = () => {
        page++;
        paint();
      };
      dialog.querySelector("#fill-library-close").onclick = () => dialog.close();
      dialog.addEventListener("close", () => {
        dialog.remove();
        if (origin && origin.isConnected) origin.focus();
      }, { once: true });
      document.body.append(dialog);
      paint();
      dialog.showModal();
      year.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    }
    function buildPendingOrderRow(o) {
      const u = productRule(o.product);
      const line = document.createElement("div");
      line.className = "row pending-order";
      const review = pendingOrderReview(o);
      let desc = o.kind === "buy" ? ((state.history || []).some((h) => h.orderId === o.id && typeof h.choice === "string" && h.choice.startsWith("order-reduce:")) ? "\uB9E4\uC218 \uCD95\uC18C \uD6C4 \uC608\uC57D " : "\uB9E4\uC218 \uC6D0\uC811\uC218 ") + o.amount.toLocaleString() + "\uC6D0 \xB7 \uB0A8\uC740 \uC608\uC57D\uAE08 " + review.remaining.toLocaleString() + "\uC6D0" : "\uB9E4\uB3C4 \uB0A8\uC740 \uC7A0\uAE08\uC218\uB7C9 " + Number(review.remaining.toFixed(6)).toLocaleString();
      desc += " (" + o.placedMonth + " \uC811\uC218 \xB7 " + review.waited + "\uAC1C\uC6D4 \uB300\uAE30)";
      if (o.expiresAt) desc += " \xB7 " + o.expiresAt + " \uC6D4\uCD08 \uBBF8\uCCB4\uACB0\uBD84 \uC790\uB3D9\uCDE8\uC18C";
      if (o.condition) desc += " \xB7 \uC870\uAC74: \uC0C8 \uD655\uBCF4 \uC9C0\uC810 " + o.condition.value.toLocaleString() + (o.condition.op === "below" ? " \uC774\uD558" : " \uC774\uC0C1") + "\uC77C \uB54C\uB9CC";
      if (o.split && o.split.n > 1) desc += " \xB7 \uBD84\uD560 " + (o.split.filled || 0) + "/" + o.split.n + " \uCCB4\uACB0";
      line.innerHTML = "<span>\u2514 " + esc(u.name || o.product) + " " + desc + (o.earliestFillMonth ? " \xB7 \uBD84\uAE30 \uC815\uC0B0(" + o.earliestFillMonth + ") \uC774\uD6C4 \uCCB4\uACB0 \uB300\uAE30" : "") + (!o.obsCutoff || typeof o.obsPostClose !== "boolean" ? " \xB7 \uAD6C \uD615\uC2DD: \uC811\uC218 \uAD00\uCE21\uC2DC\uAC01 \uBBF8\uD655\uC778\uC73C\uB85C \uCCB4\uACB0 \uBCF4\uB958. \uCDE8\uC18C \uAC00\uB2A5" : "") + "</span>";
      const reduction = [...state.history].reverse().find((h) => h.orderId === o.id && typeof h.choice === "string" && h.choice.startsWith("order-reduce:"));
      if (reduction) {
        const note = document.createElement("p");
        note.className = "note pending-reduction";
        note.textContent = "\uC608\uC57D\uAE08 \uC77C\uBD80 \uCD95\uC18C " + reduction.decisionMonth + " \xB7 " + reduction.refund.toLocaleString() + "\uC6D0 \uBC18\uD658 \xB7 \uC6D0\uB798 \uAD00\uCE21\uAC8C\uC774\uD2B8 \uC720\uC9C0";
        line.firstElementChild.append(note);
      }
      const amendment = [...state.history].reverse().find((h) => h.orderId === o.id && typeof h.choice === "string" && h.choice.startsWith("order-condition-change:"));
      if (amendment) {
        const note = document.createElement("p");
        note.className = "note pending-condition-amendment";
        note.textContent = "\uAC00\uACA9\uC870\uAC74 \uBCC0\uACBD " + amendment.decisionMonth + " \xB7 \uD604\uC7AC \uAD00\uCE21\uAC8C\uC774\uD2B8 " + o.obsCutoff + (o.obsPostClose ? " \uB9C8\uAC10 \uD6C4" : " \uB9C8\uAC10 \uC804") + " \uB4A4 \uC0C8 \uC9C0\uC810\uBD80\uD130 \uD310\uC815. \uC811\uC218\uC6D4\xB7\uBD84\uD560 \uC9C4\uD589\uC740 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.";
        line.firstElementChild.append(note);
      }
      const why = document.createElement("p");
      why.className = "note pending-reason";
      why.textContent = review.reason + " \uBBF8\uB798 \uAD00\uCE21\uC77C\uC740 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
      line.firstElementChild.append(why);
      const btn = document.createElement("button");
      btn.textContent = "\uC8FC\uBB38 \uCDE8\uC18C";
      btn.style.cssText = "font-size:12px;padding:8px;min-height:44px;";
      btn.className = "single-order-cancel-open";
      btn.setAttribute("aria-label", "\uC8FC\uBB38 \uCDE8\uC18C \uAC80\uD1A0");
      btn.onclick = () => renderSingleOrderCancellation(o.id);
      line.appendChild(btn);
      if (orderConditionReview(o.id)) {
        const edit = document.createElement("button");
        edit.className = "order-condition-open";
        edit.textContent = "\uAC00\uACA9\uC870\uAC74 \uBCC0\uACBD \uAC80\uD1A0";
        edit.style.cssText = "font-size:12px;padding:8px;min-height:44px;";
        edit.onclick = () => renderOrderCondition(o.id);
        line.appendChild(edit);
      }
      if (orderReductionReview(o.id, 50)) {
        const edit = document.createElement("button");
        edit.className = "order-reduce-open";
        edit.textContent = "\uC608\uC57D\uAE08 \uC77C\uBD80 \uD480\uAE30 \uAC80\uD1A0";
        edit.style.cssText = "font-size:12px;padding:8px;min-height:44px;";
        edit.onclick = () => renderOrderReduction(o.id);
        line.appendChild(edit);
      }
      if (orderDeadlineReview(o.id)) {
        const edit = document.createElement("button");
        edit.className = "order-deadline-open";
        edit.textContent = "\uB300\uAE30\uAE30\uD55C \uBCC0\uACBD \uAC80\uD1A0";
        edit.style.cssText = "font-size:12px;padding:8px;min-height:44px;";
        edit.onclick = () => renderOrderDeadline(o.id);
        line.appendChild(edit);
      }
      return line;
    }
    function assetLiquidityReview() {
      const values = { cash: state.cash, holdings: 0, buyReserved: 0, sellLocked: 0 };
      const valid = (n) => Number.isFinite(n) && n >= 0;
      if (!valid(values.cash)) return null;
      for (const [p, h] of Object.entries(state.holdings)) {
        const n = holdingValue(p, h, state.month);
        if (!valid(n)) return null;
        values.holdings += n;
      }
      for (const o of state.pendingOrders || []) {
        if (o.kind === "buy") {
          const n = o.split && o.split.n > 1 ? o.amount - (o.split.invested || 0) : o.amount;
          if (!valid(n)) return null;
          values.buyReserved += n;
        } else if (o.kind === "sell") {
          const u = productRule(o.product), unit = u.rule === "fxprice" ? fxUnit(state.month, u.series) : priceAt(u.series || o.product, state.month)?.value;
          const qty = o.split && o.split.n > 1 ? o.qty - (o.split.soldQty || 0) : o.qty;
          if (!valid(qty) || !valid(unit ?? o.avgPrice)) return null;
          const n = Math.round((unit ?? o.avgPrice) * qty);
          if (!valid(n)) return null;
          values.sellLocked += n;
        } else return null;
      }
      if (!Object.values(values).every(valid)) return null;
      if (propertyActive()) {
        const snap = HomeContract.propertySnapshot(state.property, propertyPrices(propertyValuationMonth()));
        if (!snap.ok) return null;
        values.propertyOwned = snap.valuation;
        values.propertyLocked = snap.lockedCash;
      }
      const sum = Object.values(values).reduce((a, b) => a + b, 0), total = totalAssets();
      if (!valid(total) || !Number.isFinite(sum) || Math.round(sum) !== total) return null;
      return { values, sum, total };
    }
    function assetLiquidityHtml() {
      const r = assetLiquidityReview();
      if (!r) return '<details class="asset-liquidity"><summary>\uC790\uC0B0\uC774 \uBB36\uC778 \uACF3 \xB7 \uD569\uC0B0 \uD655\uC778 \uD544\uC694</summary><p class="note">\uC790\uC0B0 \uAD6C\uC131\uAC12\uC774 \uC5D4\uC9C4 \uCD1D\uC790\uC0B0\uACFC \uB9DE\uC9C0 \uC54A\uC544 \uBE44\uC911\uC744 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC800\uC7A5\xB7\uAE08\uC561\uC744 \uCD94\uC815\uD558\uAC70\uB098 \uC218\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p></details>';
      const labels = { cash: "\uC794\uACE0 \uD604\uAE08", holdings: "\uC8FC\uBB38\uC5D0 \uC7A0\uAE30\uC9C0 \uC54A\uC740 \uBCF4\uC720 \uD3C9\uAC00", buyReserved: "\uBBF8\uCCB4\uACB0 \uB9E4\uC218 \uC608\uC57D\uAE08", sellLocked: "\uBBF8\uCCB4\uACB0 \uB9E4\uB3C4 \uC7A0\uAE08\uC218\uB7C9 \uD3C9\uAC00" };
      if (propertyActive()) Object.assign(labels, { propertyOwned: "\uC8FC\uD0DD \uD55C \uCC44 \uC18C\uC720 \uD3C9\uAC00 [\uCD94\uC815]", propertyLocked: "\uC8FC\uD0DD \uACC4\uC57D \uC7A0\uAE08\uD604\uAE08" });
      const pct = (n) => r.sum > 0 ? (n / r.sum * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "%" : "\uBE44\uC911 \uC5C6\uC74C";
      let html = '<details class="asset-liquidity"><summary style="min-height:44px;box-sizing:border-box;padding:10px 0;cursor:pointer;">\uC790\uC0B0\uC774 \uBB36\uC778 \uACF3 \xB7 \uCD1D ' + r.total.toLocaleString() + '\uC6D0</summary><p class="note">\uD604\uC7AC \uAD00\uCE21\uC77C ' + esc(effDate) + ' \uAE30\uC900 \uC5D4\uC9C4\uC758 \uCD1D\uC790\uC0B0\uC744 \uB098\uB215\uB2C8\uB2E4. \uC218\uC775\uB960\xB7\uD22C\uC790 \uCD94\uCC9C\uC774 \uC544\uB2C8\uB77C \uC9C0\uAE08 \uC790\uAE08\uC774 \uB193\uC778 \uACF3\uC785\uB2C8\uB2E4. \uBBF8\uB0A9\xB7\uBD80\uCC44 \uCC28\uAC10 \uC804\uC774\uBA70 \uD604\uAE08 \uC794\uACE0\uAC00 \uACE7 \uC0C8 \uC8FC\uBB38 \uAC00\uB2A5\uC561\uC774\uB77C\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4.</p><div class="asset-liquidity-rows">';
      for (const key of Object.keys(labels)) {
        const n = r.values[key], width = r.sum > 0 ? Math.max(0, Math.min(100, n / r.sum * 100)) : 0;
        html += '<div class="asset-liquidity-entry" data-kind="' + key + '" data-amount="' + n + '" style="padding:10px 0;border-top:1px solid #e5e0dc;overflow-wrap:anywhere"><div style="display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:space-between"><span>' + labels[key] + "</span><strong>" + n.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "\uC6D0 \xB7 " + pct(n) + '</strong></div><div aria-hidden="true" style="height:6px;margin-top:8px;background:#ece9e6;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + width + "%;background:" + (key === "cash" ? "#2b6b70" : "#8a9c9d") + '"></div></div></div>';
      }
      html += '</div><p class="note">\uAC01 \uB9C9\uB300\uB294 \uAC19\uC740 \uCD1D\uC790\uC0B0\uC744 100%\uB85C \uD55C \uBE44\uC911\uC785\uB2C8\uB2E4. \uC6D0 \uB2E8\uC704 \uCD1D\uC561\uC740 \uD569\uC0B0 \uB4A4 \uBC18\uC62C\uB9BC\uD558\uACE0 \uBE44\uC911\uC740 \uC18C\uC218 \uCCAB\uC9F8 \uC790\uB9AC\uAE4C\uC9C0 \uBCF4\uC5EC\uC918 \uD569\uC774 100%\uC640 \uC870\uAE08 \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uCD1D\uC790\uC0B0\uC774 0\uC6D0\uC774\uBA74 \uBE44\uC911\uC744 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><p class="note">\uB9E4\uC218 \uC608\uC57D\uAE08\uC740 \uCCB4\uACB0 \uC804\uC5D0\uB3C4 \uCD1D\uC790\uC0B0\uC5D0 \uD3EC\uD568\uB418\uC9C0\uB9CC \uB2E4\uB978 \uC8FC\uBB38\uC5D0 \uC4F8 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uBD84\uD560 \uCCB4\uACB0\uBD84\uC740 \uBCF4\uC720 \uD3C9\uAC00, \uB0A8\uC740 \uD68C\uBD84\uB9CC \uC608\uC57D\uAE08\uC5D0 \uC149\uB2C8\uB2E4. \uB9E4\uB3C4 \uC7A0\uAE08\uC218\uB7C9\uC740 \uC544\uC9C1 \uB9E4\uB3C4\uB300\uAE08\uC774 \uC544\uB2C8\uBA70 \uD604\uC7AC \uD655\uBCF4 \uC9C0\uC810 \uB610\uB294 \uAE30\uC874 \uC5D4\uC9C4 \uC6D0\uAC00 \uB300\uC6A9\uAC12\uC73C\uB85C \uD3C9\uAC00\uD569\uB2C8\uB2E4. \uB0A8\uC740 \uB9E4\uB3C4\uC218\uB7C9\uC740 \uBCF4\uC720\uC640 \uC911\uBCF5\uD574 \uC138\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC774\uC790\uB204\uC801 \uC0C1\uD488\uB3C4 \uBCF4\uC720 \uD3C9\uAC00\uC5D0 \uB4E4\uC5B4\uAC00\uBA70 \uC989\uC2DC \uC778\uCD9C \uAC00\uB2A5\uC131\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0C8 \uC2DC\uC138\uAC00 \uC5C6\uC73C\uBA74 \uD3C9\uAC00\uAC00 \uC624\uB798\uB41C \uC9C0\uC810\uC5D0 \uBA38\uBB3C \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p></details>';
      return html;
    }
    function foreignFundScaleActive() {
      return state.foreignFundScale?.version === 1 && state.foreignFundScale.dataId === FUND_SCALE_DATA_ID;
    }
    function foreignFundScaleIdentity() {
      return state.cashReservePolicy ? foreignFundScaleReserveIdentityFields : foreignFundScaleIdentityFields;
    }
    function foreignFundScaleCutoff(month) {
      if (month === state.month) return effDate;
      if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
      return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
    }
    function foreignFundScaleMarket(product, month) {
      const cutoff = foreignFundScaleCutoff(month), point = priceAt("fx", month), official = point?.official_ecos_source?.observed_date;
      const observedDate = typeof official === "string" && /^\d{8}$/.test(official) ? official.slice(0, 4) + "-" + official.slice(4, 6) + "-" + official.slice(6, 8) : point?.date_precision === "year" ? null : point?.date;
      const fx = point ? { value: point.value, observedDate, usableFrom: point.usable_from || point.date } : null;
      const d = foreignFundDenominator(product, cutoff, fx);
      if (d.status !== "available") return { size: null, label: (d.status === "stale" ? "\uACF5\uAC1C\uB41C \uD380\uB4DC\uC21C\uC790\uC0B0 \uAD00\uCE21\uC774550\uC77C\uC744 \uB118\uC5B4" : "\uAD00\uCE21\uAC00\uB2A5 \uD380\uB4DC\uC21C\uC790\uC0B0 \uB610\uB294 \uD658\uC728\uC774 \uC5C6\uC5B4") + " \uD380\uB4DC\uC9D1\uC911\uB3C4 \uAC8C\uC784 \uC0B0\uC815 \uBCF4\uB958 \xB7 \uC548\uC804\uC790\uAE08\xB7\uC2E4\uC81C\uCDA9\uACA90\uC744 \uB73B\uD558\uC9C0 \uC54A\uC74C" };
      return { size: d.sizeKRW, label: "\uACF5\uC2DC \uD380\uB4DC\uC21C\uC790\uC0B0 " + d.sizeUSD.toLocaleString() + "USD (" + d.row.measuredAt + " \uCE21\uC815 \xB7 " + d.row.knownPublicDate + " \uBB38\uC11C \xB7 " + d.row.usableFrom + " \uAC8C\uC784\uC774\uC6A9) \xD7 \uD658\uC728 " + d.fx.value.toLocaleString() + "\uC6D0 (" + d.fx.observedDate + " \uAD00\uCE21) [\uD380\uB4DC\uC9D1\uC911\uB3C4 \uAC8C\uC784\uBD84\uBAA8 \xB7 \uAE30\uCD08\uC2DC\uC7A5\uC2DC\uCD1D/\uC2E4\uC81C\uC2DC\uC7A5\uCDA9\uACA9 \uC544\uB2D8]", sourceUrl: d.row.sourceUrl, publicationSourceUrl: d.row.publicationSourceUrl };
    }
    function foreignActive() {
      return state.foreignEtfRules === 1;
    }
    function foreignIdentity() {
      return state.cashReservePolicy ? foreignReserveIdentityFields : foreignIdentityFields;
    }
    function foreignShapeOk(s) {
      return inspectForeignTag(s) && (!Object.prototype.hasOwnProperty.call(s, "foreignEtfRules") || s.propertyRules === 1 && s.cashAllocationRules === 1);
    }
    function enableForeignProducts() {
      if (!DATA) return;
      const old = DATA.unlocks.filter((u) => u.requires_rules !== "foreign-etf-v1");
      DATA.unlocks = foreignActive() ? old.concat(FOREIGN_ETF_PRODUCTS.map((u) => ({ ...u }))) : old;
    }
    function propertyValuationMonth() {
      return state.month > GAME_END ? GAME_END : state.month;
    }
    function propertyActive() {
      return state.propertyRules === 1;
    }
    function propertyIdentity() {
      return state.cashReservePolicy ? propertyReserveIdentityFields : propertyIdentityFields;
    }
    function propertyShapeOk(s) {
      const tag = Object.prototype.hasOwnProperty.call(s, "propertyRules"), has = Object.prototype.hasOwnProperty.call(s, "property");
      return !tag && !has || tag && has && s.propertyRules === 1 && s.cashAllocationRules === 1 && s.chaosExposureRules === 1 && chaosExposureShapeOk(s) && HomeContract.inspectProperty(s.property) && Object.values(s.property.holdings).every((h) => h.acquiredMonth <= s.month) && s.property.contracts.every((c) => c.placedMonth <= s.month);
    }
    function propertyChaosAdd() {
      if (!propertyActive()) return 0;
      const snap = HomeContract.propertySnapshot(state.property, propertyPrices(propertyValuationMonth()));
      return snap.ok ? snap.valuation / 2e13 * 100 : 0;
    }
    function propertyActionAllowed(kind) {
      if (!propertyActive() || !propertyShapeOk(state) || storageReadBlocked || storageWriteBlocked || multiTabConflict || pending || state.flags.gameOver || state.month > GAME_END) return false;
      const b = state.flags.birth;
      if (!b || state.month < b.year + 18 + "-" + String(b.month).padStart(2, "0") || militaryActive()) return false;
      const turn = nextTurn();
      if (!["quiet", "news"].includes(turn.kind) || !tradeAccess(turn).allowed || !albaTimeAvailable()) return false;
      if (state.flags.career === "job" && !turn.settlement) return false;
      if (kind === "buy" && careerCashBuyHoldOn() && careerCashUnpaid() > 0) return false;
      return true;
    }
    function propertyPanelHtml() {
      if (!propertyActive()) return "";
      const prices = propertyPrices(propertyValuationMonth()), snap = HomeContract.propertySnapshot(state.property, prices);
      if (!snap.ok) return "<p>\uC8FC\uD0DD \uBAA8\uD615 \uD3C9\uAC00 \uD655\uC778 \uD544\uC694</p>";
      let h = '<section class="property-panel"><h3>\uC11C\uC6B8\xB7\uACBD\uAE30 \uB300\uD45C \uC8FC\uD0DD [\uCD94\uC815 \uAC8C\uC784\uAC00\uACA9]</h3><p class="note">\uD2B9\uC815 \uB2E8\uC9C0\uC758 \uC2E4\uAC70\uB798\uAC00\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC9C0\uC5ED\xB7\uC2DC\uAE30\uBCC4 \uCC38\uACE0\uAC12\uACFC \uC124\uACC4\uAC12 \uC0AC\uC774\uC758 \uC6D4\uBCC4 \uCD94\uC815\uAC00\uACA9\uC785\uB2C8\uB2E4. \uAC01 \uC9C0\uC5ED \uCD5C\uB300 \uD55C \uCC44, \uC870\uAC01 \uB9E4\uC218\xB7\uC784\uB300\xB7\uB300\uCD9C \uC5C6\uC74C. \uB9E4\uC218\uBE44\uC6A92%\xB7\uB9E4\uB3C4\uBE44\uC6A91%\xB7\uACC4\uC57D\uD6C41\uAC1C\uC6D4 \uC815\uC0B0\uC740 \uD604\uC2E4\uC138\uBC95/\uAE30\uAC04\uC774 \uC544\uB2CC \uAC8C\uC784\uADDC\uCE59\uC785\uB2C8\uB2E4. \uC18C\uC720 \uC8FC\uD0DD\uC740 \uCE74\uC624\uC2A4 \uC18C\uC720\uADDC\uBAA8\uC5D0 \uD3EC\uD568\uB429\uB2C8\uB2E4.</p>';
      for (const r of ["seoul", "gyeonggi"]) {
        const own = state.property.holdings[r], c = state.property.contracts.find((x) => x.region === r && x.status === "pending"), name = r === "seoul" ? "\uC11C\uC6B8 \uB300\uD45C \uC8FC\uD0DD" : "\uACBD\uAE30 \uB300\uD45C \uC8FC\uD0DD";
        h += '<div class="row"><span>' + name + " \xB7 " + (own ? "1\uCC44 \uC18C\uC720" : "\uBBF8\uC18C\uC720") + "</span><strong>" + prices[r].toLocaleString() + "\uC6D0 [\uCD94\uC815]</strong></div>";
        if (c) h += "<p>" + (c.kind === "buy" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + (state.month > GAME_END ? " \uBBF8\uC815\uC0B0 \xB7 \uD68C\uADC0 \uAE30\uB85D \uC2DC \uCDE8\uC18C/\uBC18\uD658 \xB7 \uC6D0\uC18C\uC720 \uC720\uC9C0 \xB7 " : " \uACC4\uC57D \uB300\uAE30 \xB7 " + c.dueMonth + " \uC815\uC0B0 \xB7 ") + "\uC7A0\uAE08\uD604\uAE08 " + c.lockedCash.toLocaleString() + '\uC6D0</p><button data-property-cancel="' + c.id + '" ' + (state.month > GAME_END ? "disabled" : "") + ">" + name + " \uACC4\uC57D \uCDE8\uC18C\xB7\uBC18\uD658 \uD655\uC778</button>";
        else h += '<button data-property-region="' + r + '" data-property-kind="' + (own ? "sell" : "buy") + '" ' + (propertyActionAllowed(own ? "sell" : "buy") ? "" : "disabled") + ">" + name + " " + (own ? "\uD55C \uCC44 \uB9E4\uB3C4 \uAC80\uD1A0" : "\uD55C \uCC44 \uB9E4\uC218 \uAC80\uD1A0") + "</button>";
      }
      return h + "<p>\uC8FC\uD0DD \uCD94\uC815\uD3C9\uAC00 " + snap.valuation.toLocaleString() + "\uC6D0 \xB7 \uACC4\uC57D \uC7A0\uAE08\uD604\uAE08 " + snap.lockedCash.toLocaleString() + "\uC6D0. \uB458\uC740 \uC0AC\uC6A9\uAC00\uB2A5\uD604\uAE08\uACFC \uAD6C\uBD84\uD569\uB2C8\uB2E4. \uC131\uC778\xB7\uBCF5\uBB34\uC544\uB2D8\xB7\uD604\uC7AC\uC9C4\uB85C \uAC70\uB798\uAC00\uB2A5 \uD310\uB2E8\uC5D0\uC11C \uACC4\uC57D \uAC80\uD1A0, \uCDE8\uC5C5\uC740 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C\uB9CC \uC811\uC218\uD569\uB2C8\uB2E4. \uBBF8\uB0A9\uC911 \uC0C8 \uB9E4\uC218\uBD88\uAC00.</p></section>";
    }
    function bindPropertyPanel() {
      if (!propertyActive()) return;
      document.querySelectorAll("[data-property-region]").forEach((b) => b.onclick = () => renderPropertyConfirm(b.dataset.propertyRegion, b.dataset.propertyKind));
      document.querySelectorAll("[data-property-cancel]").forEach((b) => b.onclick = () => renderPropertyCancel(Number(b.dataset.propertyCancel)));
    }
    function renderPropertyConfirm(region, kind) {
      if (!propertyActionAllowed(kind)) return;
      const q = HomeContract.quoteProperty(state.property, region, kind, propertyPrices(propertyValuationMonth())[region], state.month);
      if (!q.ok) return;
      const sig = JSON.stringify([state.month, state.cash, state.property, state.flags, state.turnCount]);
      const c = q.quote, name = region === "seoul" ? "\uC11C\uC6B8 \uB300\uD45C \uC8FC\uD0DD" : "\uACBD\uAE30 \uB300\uD45C \uC8FC\uD0DD";
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = '<div class="date">' + state.month + " \xB7 \uC8FC\uD0DD \uACC4\uC57D \uD655\uC778</div><h2>" + name + " \uD55C \uCC44 " + (kind === "buy" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + "</h2><p>\uCD94\uC815 \uAC8C\uC784\uAC00\uACA9 " + c.price.toLocaleString() + "\uC6D0 + " + (kind === "buy" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + " \uAC04\uC774\uBE44\uC6A9 " + c.fee.toLocaleString() + "\uC6D0. \uC2E4\uC81C \uAC70\uB798\uAC00\uACA9\xB7\uC2E4\uC81C \uC138\uAE08/\uC911\uAC1C\uBE44\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p><p>" + (kind === "buy" ? "\uC9C0\uAE08 " + c.lockedCash.toLocaleString() + "\uC6D0\uC744 \uD604\uAE08\uC5D0\uC11C \uC7A0\uADF8\uACE0 " + c.dueMonth + "\uC5D0 \uC18C\uC720\uB97C \uBC1B\uC2B5\uB2C8\uB2E4. \uBE44\uC6A9\uC740 \uC18C\uC720 \uC815\uC0B0\uC2DC \uC790\uC0B0\uC5D0\uC11C \uBE60\uC9D1\uB2C8\uB2E4." : "\uC8FC\uD0DD\uC740 " + c.dueMonth + "\uAE4C\uC9C0 \uC18C\uC720\xB7\uCE74\uC624\uC2A4\uC5D0 \uB0A8\uACE0, \uADF8\uB54C \uBE44\uC6A9\uC744 \uBE80 " + (c.price - c.fee).toLocaleString() + "\uC6D0\uC744 \uBC1B\uC2B5\uB2C8\uB2E4.") + " \uB300\uAE30\uC911 \uCDE8\uC18C\uD558\uBA74 \uB9E4\uC218 \uC7A0\uAE08\uD604\uAE08 \uC804\uC561 \uBC18\uD658, \uB9E4\uB3C4\uB294 \uC6D0\uB798 \uD55C\uCC44\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4. \uACC4\uC57D \uAC00\uACA9\uC740 \uC9C0\uAE08 \uD655\uC815\uD558\uBA70 \uB2E4\uC74C \uB2EC \uCD94\uC815\uAC00\uACA9\uC73C\uB85C \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
      box.innerHTML = "";
      const yes = document.createElement("button");
      yes.id = "property-contract-confirm";
      yes.textContent = "\uAC8C\uC784 \uACC4\uC57D \uD655\uC815";
      yes.disabled = kind === "buy" && state.cash < c.lockedCash;
      yes.onclick = () => {
        if (!propertyActionAllowed(kind) || JSON.stringify([state.month, state.cash, state.property, state.flags, state.turnCount]) !== sig) return;
        const x = HomeContract.placeProperty(state.cash, state.property, region, kind, c.price, state.month);
        if (!x.ok) return;
        state.cash = x.cash;
        state.property = x.property;
        albaTimeConsume(kind);
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "property-" + kind + "-contract:" + region, price: c.price, fee: c.fee, id: c.id });
        if (save()) render();
      };
      const no = document.createElement("button");
      no.textContent = "\uACC4\uC57D\uD558\uC9C0 \uC54A\uACE0 \uB3CC\uC544\uAC00\uAE30";
      no.onclick = () => render();
      box.append(yes, no);
    }
    function renderPropertyCancel(id) {
      const c = state.property?.contracts.find((x) => x.id === id && x.status === "pending");
      if (!c || storageReadBlocked || storageWriteBlocked || multiTabConflict || state.flags.gameOver || state.month > GAME_END) return;
      const sig = JSON.stringify([state.month, state.cash, state.property]);
      const card = document.getElementById("turn-card"), box = document.getElementById("choices");
      card.innerHTML = "<h2>\uC8FC\uD0DD \uAC8C\uC784 \uACC4\uC57D\uC744 \uCDE8\uC18C\uD560\uAE4C\uC694?</h2><p>\uBC18\uD658\uD604\uAE08 " + c.lockedCash.toLocaleString() + "\uC6D0. \uB9E4\uB3C4\uACC4\uC57D \uCDE8\uC18C\uB294 \uD604\uAE08 \uC785\uAE08 \uC5C6\uC774 \uC6D0\uB798 \uC8FC\uD0DD \uC18C\uC720\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4.</p>";
      box.innerHTML = "";
      const yes = document.createElement("button");
      yes.textContent = "\uACC4\uC57D \uCDE8\uC18C \uD655\uC815";
      yes.id = "property-cancel-confirm";
      yes.onclick = () => {
        if (storageReadBlocked || storageWriteBlocked || multiTabConflict || state.flags.gameOver || state.month > GAME_END || JSON.stringify([state.month, state.cash, state.property]) !== sig) return;
        const x = HomeContract.cancelProperty(state.cash, state.property, id, state.month);
        if (!x.ok) return;
        state.cash = x.cash;
        state.property = x.property;
        state.history.push({ month: state.month, decisionMonth: state.month, choice: "property-contract-cancel:" + id });
        if (save()) render();
      };
      const no = document.createElement("button");
      no.textContent = "\uACC4\uC57D \uC720\uC9C0";
      no.onclick = () => render();
      box.append(yes, no);
    }
    function renderPortfolio() {
      clarifyLockedBuyDisplay();
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      const el = document.getElementById("portfolio");
      const kp = schoolDataGap() ? null : priceAt("kospi", state.month);
      let rows = (foreignActive() ? '<details class="foreign-etf-policy"><summary>\uBBF8\uAD6D\xB7\uC911\uAD6D ETF \uAC00\uACA9\xB7\uC218\uB7C9 \uAE30\uC900</summary><p>' + esc(FOREIGN_ETF_RULES.displayPolicy) + "</p><p>SPY: \uBBF8\uAD6D S&P500 \uCD94\uC885. FXI: \uD64D\uCF69\uC0C1\uC7A5 \uC911\uAD6D \uB300\uD615\uC8FC\uB97C \uB2F4\uC740 \uBBF8\uAD6D\uC0C1\uC7A5 ETF, \uC911\uAD6D\uBCF8\uD1A0\uC9C0\uC218 \uC544\uB2D8. \uC0C1\uD488 \uC0C1\uC7A5\uC77C \uC774\uD6C4\uC758 \uAC00\uC0C1 \uC811\uADFC\uC774\uBA70 \uB2F9\uC2DC \uD55C\uAD6D \uAC70\uC8FC\uC790\uC758 \uC99D\uAD8C\uC0AC \uAC00\uC785\xB7\uD658\uC804\xB7\uD574\uC678\uD22C\uC790 \uC790\uACA9\uC740 \uBCF5\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uAD6D \uC885\uAC00\uC77C+2\uC77C \uB4A4\uBD80\uD130 \uAD00\uCE21\uD558\uB294 \uAC8C\uC784\uAC8C\uC774\uD2B8\uB85C \uC2DC\uAC04\uB300 \uC55E\uB2F9\uAE40\uC744 \uB9C9\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uCD5C\uCD08 \uACF5\uD45C\uC77C \uC99D\uAC70\uB294 \uC544\uB2D9\uB2C8\uB2E4.</p></details>" : "") + propertyPanelHtml() + albaTimeHtml() + assetLiquidityHtml() + '<div class="row"><span>\uD604\uAE08</span><strong>' + state.cash.toLocaleString() + "\uC6D0</strong></div>";
      for (const [p, h] of Object.entries(state.holdings)) {
        const u = DATA.unlocks.find((x) => x.product === p);
        const invested = Math.round(h.invested != null ? h.invested : h.qty * h.avgPrice);
        const cur = holdingValue(p, h, state.month);
        rows += '<div class="row"><span>' + esc(u ? u.name : p) + "</span><strong>" + invested.toLocaleString() + "\uC6D0 \uD22C\uC785" + (cur !== invested ? " \xB7 \uD3C9\uAC00 " + cur.toLocaleString() + "\uC6D0" : "") + "</strong></div>";
      }
      rows += '<div class="row"><span>\uCF54\uC2A4\uD53C \uCD5C\uC2E0 \uD655\uBCF4 \uC9C0\uC810</span><strong>' + (kp ? kp.value.toLocaleString() + " (" + fmtPtDate(kp) + ")" : "\uC9C0\uC810 \uC5C6\uC74C (\uACF5\uBC31)") + " \xB7 \uAD00\uCE21\uC77C " + effDate + "</strong></div>";
      if (!schoolDataGap()) {
        if (!kp) rows += '<p class="note data-gap-note">\uAD6D\uB0B4 \uC9C0\uC218\uC758 \uACF5\uAC1C \uC9C0\uC810\uC774 \uC5C6\uC5B4 \uC870\uAC74 \uD310\uC815\xB7\uCCB4\uACB0 \uAC80\uC0AC\uAC00 \uBA48\uCDB0 \uC788\uC2B5\uB2C8\uB2E4(\uAD00\uCE21 \uC790\uB8CC \uACF5\uBC31). \uC0C8 \uC9C0\uC810\uC758 \uACF5\uAC1C \uC77C\uC815\uC774\uB098 \uCCB4\uACB0\uC744 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
        else {
          const kpBase = (kp.usable_from || kp.date || "").slice(0, 7);
          const kpGap = kpBase ? monthsBetween(kpBase, state.month) : 0;
          if (kpGap >= 2) rows += '<p class="note data-gap-note">\uAD6D\uB0B4 \uC9C0\uC218\uC758 \uCD5C\uADFC \uACF5\uAC1C \uC9C0\uC810\uC774 ' + esc(kpBase) + "\uC5D0 \uBA48\uCDB0 " + kpGap + "\uAC1C\uC6D4\uC9F8 \uC0C8 \uC9C0\uC810\uC774 \uACF5\uAC1C\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4(\uAD00\uCE21 \uC790\uB8CC \uACF5\uBC31\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4). \uC0C8 \uC9C0\uC810\uC774 \uACF5\uAC1C\uB418\uAE30 \uC804\uAE4C\uC9C0 \uC870\uAC74 \uD310\uC815\xB7\uCCB4\uACB0 \uAC80\uC0AC\uAC00 \uC81C\uD55C\uB418\uBA70, \uC55E\uC73C\uB85C\uC758 \uACF5\uAC1C \uC77C\uC815\uC774\uB098 \uCCB4\uACB0\uC744 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
        }
      }
      if (GAME_LIVING) {
        rows += '<div class="row"><span>\uC6D4 \uAE09\uC5EC [\uAC8C\uC784\uAC12]</span><span>' + (state.gameLivingTrack === "job" ? GLV.income.toLocaleString() + "\uC6D0 \xB7 \uB2E4\uC74C \uB2EC \uCD08\uC785\uAE08(9\uC6D4\uBD84\uC740 \uAD6C\uAC04 \uBC16 \uBBF8\uC218)" : "0\uC6D0 \xB7 \uC804\uC5C5 \uC720\uC785 \uBD80\uC7AC") + "</span></div>";
        rows += '<div class="row"><span>\uC0DD\uD65C\uBE44 \uCC28\uAC10 [\uAC8C\uC784\uAC12]</span><span>\uC6D4 ' + GLV.expense.toLocaleString() + "\uC6D0 \uBC18\uC601 \uC911 \xB7 \uBD80\uC871 \uC2DC \uC815\uC0B0 \uC804 \uC870\uC815 \uD6C4 \uC2E4\uD328 \uD68C\uADC0</span></div>";
        if (state.gameLivingReceivable) rows += '<div class="row"><span>\uBBF8\uC218 \uAE09\uC5EC [\uAC8C\uC784\uAC12]</span><span>' + state.gameLivingReceivable.toLocaleString() + "\uC6D0 \xB7 \uAD6C\uAC04 \uBC16 \uC785\uAE08 \u2014 \uD604\uAE08\xB7\uCD1D\uC790\uC0B0 \uBBF8\uBC18\uC601</span></div>";
        rows += '<p class="note economy-model-note">\uC0DD\uD65C\uACBD\uC81C \uBAA8\uD615: \uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 v1 \xB7 \uC218\uC785\xB7\uC9C0\uCD9C\uC740 \uBA85\uC2DC \uAC8C\uC784\uAC12\uC774\uBA70 \uAE30\uC874 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC740 \uC774 \uACBD\uB85C\uC5D0 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      } else if (careerCashActive()) {
        rows += '<div class="row"><span>\uC6D4 \uC800\uCD95</span><span>\uC2DC\uD5D8 \uC21C\uC800\uCD95 \uBBF8\uC801\uC6A9 \u2014 \uC6D4 \uD604\uAE08\uC0AC\uAC74 \uBAA8\uD615</span></div>';
        rows += '<div class="row"><span>\uC0DD\uD65C\uBE44\xB7\uD559\uBE44 \uCC28\uAC10 [\uC124\uACC4\uAC12]</span><span>\uC6D4 \uD604\uAE08\uC0AC\uAC74\uC73C\uB85C \uC790\uB3D9 \uBC18\uC601 \xB7 \uBBF8\uB0A9 ' + careerCashUnpaid().toLocaleString() + "\uC6D0</span></div>";
        rows += '<p class="note economy-model-note">\uC0DD\uD65C\uACBD\uC81C \uBAA8\uD615: career-cash-events-v1 \xB7 \uBA85\uC2DC \uAC8C\uC784\uC124\uACC4\uAC12\uC774\uBA70 \uC2E4\uC81C \uAE09\uC5EC\xB7\uBB3C\uAC00\xB7\uD559\uBE44 \uD1B5\uACC4\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uAE30\uC874 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC740 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
        rows += cashPlanActive() ? cashFlowReviewHtml(cashFlowReview(state, totalAssets())) : assetReviewHtml();
        rows += careerCashHtml();
      } else if (!CASH_MODE) {
        rows += '<div class="row"><span>\uC6D4 \uC800\uCD95</span><span>' + (SCHOOL_MODE && !state.flags.studyPath ? "\uACE01 \uC120\uD0DD \uC804 \uBBF8\uD655\uC815" : militaryActive() ? "\uBCF5\uBB34 \uC911 0\uC6D0 [\uC2DC\uD5D8\uC6A9 \uC124\uACC4\uAC12]" : monthlySavings().toLocaleString() + "\uC6D0 [\uC2DC\uD5D8\uC6A9 \uC124\uACC4\uAC12]") + "</span></div>";
        rows += '<div class="row"><span>\uC0DD\uD65C\uBE44 \uCC28\uAC10</span><span>\uBBF8\uAD6C\uD604 \xB7 \uC2DC\uD5D8\uC6A9 \uC21C\uC800\uCD95\uB9CC \uBC18\uC601</span></div>';
        rows += '<p class="note economy-model-note">\uC0DD\uD65C\uACBD\uC81C \uBAA8\uD615: \uC2DC\uD5D8 \uC21C\uC800\uCD95 v1 \xB7 \uC2E4\uC81C \uAE09\uC5EC\xB7\uD559\uBE44\xB7\uC138\uAE08\uBCC4 \uD604\uAE08\uD750\uB984\uC740 \uC544\uC9C1 \uC5F0\uACB0\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694. \uAE30\uC874 \uAE30\uB85D\uC744 \uC2E4\uBE44 \uBAA8\uD615\uC73C\uB85C \uBC14\uAFB8\uC9C0 \uC54A\uC544\uC694.</p>';
        rows += assetReviewHtml();
        rows += savingsLedgerHtml();
      } else rows += cashEventsHtml();
      rows += interestLedgerHtml();
      rows += jobSavingsPlanHtml();
      if (cashPlanActive() && state.flags.career === "job") rows += cashReserveHtml();
      if (state.month > GAME_END) rows += '<p class="note ending-economic-boundary">\uACBD\uC81C \uD68C\uCC28\uB294 ' + GAME_END + "\uAE4C\uC9C0\uC785\uB2C8\uB2E4. \uACB0\uC0B0 \uAD00\uCE21\uC77C\uC744 \uC704\uD574 \uB2E4\uC74C \uB2EC\uB85C \uD45C\uC2DC\uD558\uB354\uB77C\uB3C4 \uCD94\uAC00 \uC21C\uC800\uCD95\xB7\uC774\uC790\xB7\uC8FC\uBB38 \uCCB4\uACB0\uC740 \uBC18\uC601\uD558\uC9C0 \uC54A\uC544\uC694.</p>";
      if (foreignFundScaleActive()) rows += '<details class="foreign-fund-scale-note"><summary style="min-height:44px;padding:10px 0;box-sizing:border-box">\uBBF8\uAD6D\xB7\uC911\uAD6D \uD380\uB4DC\uC9D1\uC911\uB3C4 \uAC8C\uC784\uADDC\uCE59</summary><p>SPY/FXI\uB294 \uAE30\uCD08 \uC8FC\uC2DD\uC2DC\uC7A5 \uC2DC\uAC00\uCD1D\uC561\uC774 \uC544\uB2C8\uB77C \uACFC\uAC70 \uACF5\uC2DC \uD380\uB4DC\uC21C\uC790\uC0B053\uC810 \uC911 \uADF8\uB54C \uC54C\uB824\uC9C4 \uB9C8\uC9C0\uB9C9 \uBB38\uC11C\uB97C \uBD84\uBAA8\uB85C \uC501\uB2C8\uB2E4. \uCE21\uC815\uC77C\xB7\uC54C\uB824\uC9C4 \uBB38\uC11C\uB0A0\uC9DC\xB7\uBB38\uC11C+2\uB2EC\uB825\uC77C \uAC8C\uC784\uAC8C\uC774\uD2B8\uB97C \uAD6C\uBD84\uD558\uACE0, \uAD00\uCE21\uC774550\uC77C\uBCF4\uB2E4 \uC624\uB798\uB418\uAC70\uB098 \uD658\uC728 \uC9C0\uC810\uC774 \uC5C6\uC73C\uBA74 \uC0B0\uC815\uC744 \uBCF4\uB958\uD569\uB2C8\uB2E4.550\uC77C\uACFC \uBCF4\uC720\uC561/\uD380\uB4DC\uC21C\uC790\uC0B0 \uC6D0\uD654\uD658\uC0B0\xD7100\uC740 \uAC8C\uC784\uC124\uACC4\uAC12\uC774\uBA70 \uD604\uC2E4 \uC2DC\uC7A5\uCDA9\uACA9 \uBAA8\uD615\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uBBF8\uCCB4\uACB0 \uB9E4\uB3C4 \uC7A0\uAE08\uC794\uB7C9\uB3C4 \uCCB4\uACB0 \uC804\uAE4C\uC9C0 \uBCF4\uC720 \uB178\uCD9C\uC5D0 \uB0A8\uACE0 \uB9E4\uB3C4 \uCCB4\uACB0\uB300\uAE08\uC5D0\uB294 \uAC19\uC740 \uBE44\uC728\uC758 \uC77C\uD68C \uAC8C\uC784\uAC00\uC0B0\uC744 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uB9E4\uC218\uC608\uC57D\uAE08\uC740 \uC81C\uC678\uD569\uB2C8\uB2E4. \uCD5C\uCD08\uAE00\uB85C\uBC8C\uACF5\uD45C\xB7\uB2F9\uC2DC\uD55C\uAD6D\uAC1C\uC778 \uC811\uADFC \uC99D\uBA85\uC740 \uC544\uB2C8\uBA70 \uC774\uC804\uD68C\uADC0\uB294 \uC6D0\uADDC\uCE59\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uC791\uC740\uC218\uCE58\uB294 \uD45C\uC2DC\xB7\uCE74\uC624\uC2A4 \uBC18\uC62C\uB9BC/\uAC10\uC18C\uC5D0 \uAC00\uB824\uC9C8 \uC218 \uC788\uACE0, \uC0B0\uC815\uBCF4\uB958\uB294 \uC548\uC804\uC790\uAE08\uC774\uB098 \uCDA9\uACA90 \uBCF4\uC7A5\uC774 \uC544\uB2D9\uB2C8\uB2E4.</p></details>';
      rows += '<div class="row"><span>\uCE74\uC624\uC2A4</span><span>' + state.chaos.toFixed(1) + " / 100 (\uC6D4 +" + monthlyChaosAdd().toFixed(2) + (monthlyChaosAdd() < 1 ? ", \uAC10\uC18C \uAD6C\uAC04" : "") + ") [\uC124\uACC4 \uC81C\uC548 \uC218\uCE58]</span></div>";
      {
        const btr = chaosTrajectory(null);
        rows += '<div class="row"><span>\uBCF4\uC720 \uC720\uC9C0 \uC2DC \uADA4\uC801</span><span>+3\uAC1C\uC6D4 ' + btr.points[3].chaos.toFixed(1) + " \u2192 +12\uAC1C\uC6D4 " + btr.points[12].chaos.toFixed(1) + "/100" + (btr.overMonth !== null ? btr.overMonth === 0 ? " \xB7 \uD604\uC7AC \uC774\uBBF8 \uD55C\uACC4 100 \uC774\uC0C1(\uAC00\uC815)" : " \xB7 \uD55C\uACC4 100 \uB3C4\uB2EC \uAC00\uC815 +" + btr.overMonth + "\uAC1C\uC6D4" : btr.warnMonth !== null ? btr.warnMonth === 0 ? " \xB7 \uD604\uC7AC \uC774\uBBF8 \uC8FC\uC758 70 \uC774\uC0C1(\uAC00\uC815)" : " \xB7 \uC8FC\uC758 70 \uB3C4\uB2EC \uAC00\uC815 +" + btr.warnMonth + "\uAC1C\uC6D4" : " \xB7 12\uAC1C\uC6D4 \uAC00\uC815 \uB0B4 \uC8FC\uC758 70 \uBBF8\uB3C4\uB2EC") + " [\uD604\uC7AC \uC9C0\uC810 \uAC00\uACA9\xB7\uC2DC\uC7A5\uADDC\uBAA8 \uACE0\uC815 \uAC00\uC815 \xB7 \uBBF8\uB798 \uAC00\uACA9 \uC608\uCE21 \uC544\uB2D8 \xB7 \uC124\uACC4 \uC81C\uC548 \uC218\uCE58]</span></div>";
      }
      for (const [p, h] of Object.entries(chaosExposureHoldings())) {
        const mInfo = marketSizeOf(p, state.month);
        if (mInfo && mInfo.size) {
          const share = holdingValue(p, h, state.month) / mInfo.size * 100;
          const u = DATA.unlocks.find((x) => x.product === p);
          rows += '<div class="row market-share"><span>\u2514 ' + esc(u ? u.name : p) + (foreignFundScaleActive() && ["spy", "fxi"].includes(p) ? " \uD380\uB4DC\uC21C\uC790\uC0B0 \uB300\uBE44 \uBCF4\uC720 \uBE44\uC911" : " \uC2DC\uC7A5 \uBE44\uC911") + "</span><span>" + (share < 0.01 ? share.toFixed(4) : share.toFixed(2)) + "% (" + mInfo.label + ")</span></div>";
        } else if (mInfo) {
          const u = DATA.unlocks.find((x) => x.product === p);
          rows += '<div class="row market-share"><span>\u2514 ' + esc(u ? u.name : p) + (foreignFundScaleActive() && ["spy", "fxi"].includes(p) ? " \uD380\uB4DC\uC21C\uC790\uC0B0 \uB300\uBE44 \uBCF4\uC720 \uBE44\uC911" : " \uC2DC\uC7A5 \uBE44\uC911") + "</span><span>\uC0B0\uC815 \uBD88\uAC00 - " + mInfo.label + "</span></div>";
        }
      }
      if (chaosExposureActive()) rows += '<p class="note chaos-exposure-note">\uC18C\uC720\uB178\uCD9C v1 [\uC774 \uC0C8 \uD68C\uADC0 \uADDC\uCE59] \xB7 \uCCB4\uACB0 \uC804 \uB9E4\uB3C4 \uC7A0\uAE08\uC794\uB7C9\uB3C4 \uBCF4\uC720 \uADDC\uBAA8\uC5D0 \uD3EC\uD568\uD569\uB2C8\uB2E4. \uB9E4\uC218 \uC608\uC57D\uAE08\uC740 \uC81C\uC678\uD569\uB2C8\uB2E4. \uC774\uC804 \uD68C\uADC0\uC758 \uCE74\uC624\uC2A4\uB098 \uAE30\uB85D\uC740 \uB2E4\uC2DC \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      rows += schoolDataGap() ? '<p class="note">\uC790\uB8CC\uACF5\uBC31 \uAD6C\uAC04: \uC0C1\uD488 \uC811\uADFC \uACE0\uC99D \uBBF8\uC644\uB8CC, \uB9E4\uB9E4 \uCC28\uB2E8</p>' : '<div class="product-list"><div>\uC2DC\uC5F0 \uC0C1\uD488 \uC0C1\uD0DC</div><p class="note">\uBAA9\uB85D \uB178\uCD9C\uC740 \uC2E4\uC81C \uC5ED\uC0AC\uC801 \uAC00\uC785 \uC790\uACA9\uC774\uB098 \uC989\uC2DC \uCCB4\uACB0\uC744 \uB73B\uD558\uC9C0 \uC54A\uC544\uC694. \uD604\uC7AC \uC9C4\uB85C\xB7\uD310\uB2E8 \uD134\xB7\uD604\uAE08 \uC870\uAC74\uC740 \uC8FC\uBB38 \uD654\uBA74\uC5D0\uC11C \uB530\uB85C \uD655\uC778\uD569\uB2C8\uB2E4.</p><ul>' + unlockedProducts().map((u) => "<li>" + esc(u.name) + " \u2014 " + esc(productStatusNote(u)) + (u.product === "fx" || u.product === "usdeposit" ? '<p class="note">' + esc(productAccessDisplayNote(u)) + "</p>" : "") + "</li>").join("") + "</ul></div>";
      const lives = readLives();
      if (!lives) return;
      if (SCHOOL_MODE && !CASH_MODE) rows += '<div class="row"><span>\uC9C0\uB098\uAC04 \uAC8C\uC784\uB274\uC2A4</span><button id="news-library-open" type="button" style="width:auto;min-height:44px;padding:6px 10px;margin:0">\uB274\uC2A4\uD568 \uC5F4\uAE30</button></div>';
      rows += '<div class="row"><span>\uD68C\uADC0 \uAE30\uB85D</span><span id="dash-link" style="cursor:pointer;text-decoration:underline">' + (lives.length ? lives.length + "\uAC74 \u2014 \uB300\uC2DC\uBCF4\uB4DC \uC5F4\uAE30" : "\uB300\uC2DC\uBCF4\uB4DC \uC5F4\uAE30") + "</span></div>";
      if (state.resetRules === 1 && !state.flags.gameOver && state.month <= GAME_END) rows += '<div class="row"><span>\uD68C\uADC0 \uB9C8\uCE58\uAE30</span><span id="voluntary-end-open" style="cursor:pointer;text-decoration:underline">\uC774 \uD68C\uADC0\uB97C \uC5EC\uAE30\uC11C \uB9C8\uCE58\uACE0 \uAE30\uB85D \uB0A8\uAE30\uAE30 [voluntary-reset-v1]</span></div>';
      if (state.livingScenarioRules === 1) rows += '<div class="row"><span>\uC870\uAC74 \uC2DC\uB098\uB9AC\uC624 \uC7A5\uBD80</span><span id="living-scenario-open" style="cursor:pointer;text-decoration:underline">2019Q3 \uBC95\uC815 \uCD5C\uC800 \uC870\uAC74 \uC2DC\uB098\uB9AC\uC624(\uC5F4\uB78C \uC804\uC6A9 \xB7 \uD604\uAE08 \uBBF8\uBC18\uC601) [living-scenario-v1]</span></div>';
      if (state.pendingOrders && state.pendingOrders.length) {
        const reserved = state.pendingOrders.filter((o) => o.kind === "buy").reduce((sum, o) => sum + pendingOrderReview(o).remaining, 0);
        rows += '<div class="row pending-liquidity"><span>\uB300\uAE30 \uC8FC\uBB38 \xB7 \uB9E4\uC218 \uC608\uC57D\uAE08</span><span>' + state.pendingOrders.length + "\uAC74 \xB7 " + reserved.toLocaleString() + "\uC6D0 (\uD604\uAE08\uACFC \uBCC4\uB3C4)</span></div>";
      }
      const latestFill = (state.fillsLog || []).slice(-1)[0];
      if (latestFill) {
        const u = productRule(latestFill.product);
        const resultNote = latestFill.kind === "sell-fill" ? " \xB7 \uB9E4\uB3C4\uB300\uAE08 " + (Number.isFinite(latestFill.proceeds) ? latestFill.proceeds.toLocaleString() + "\uC6D0" : "\uBBF8\uD655\uC778") + " \xB7 \uCDE8\uB4DD\uC6D0\uAC00 " + (Number.isFinite(latestFill.costBasis) ? latestFill.costBasis.toLocaleString() + "\uC6D0" : "\uBBF8\uD655\uC778") + " \xB7 \uC2DC\uC5F0 \uC190\uC775 " + (Number.isFinite(latestFill.pnl) ? (latestFill.pnl >= 0 ? "+" : "") + latestFill.pnl.toLocaleString() + "\uC6D0" : "\uBBF8\uD655\uC778") : " \xB7 \uD22C\uC785\uAE08 " + (Number.isFinite(latestFill.amount) ? latestFill.amount.toLocaleString() + "\uC6D0" : "\uBBF8\uD655\uC778");
        rows += '<div class="product-list"><div>\uCD5C\uADFC \uCCB4\uACB0 [\uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0]</div><p class="note">' + esc(u.name || latestFill.product) + " " + (latestFill.kind === "buy-fill" ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + " \xB7 \uCCB4\uACB0 \uAD00\uCE21\uC6D4 " + esc(latestFill.month) + " \xB7 \uAC00\uACA9 \uAE30\uC900\uC77C " + esc(latestFill.ptDate) + " \xB7 \uC9C0\uC810 " + Number(latestFill.price).toLocaleString() + (latestFill.usableFrom ? " \xB7 \uC2DC\uC5F0 \uC774\uC6A9 \uAC00\uB2A5\uC77C " + esc(latestFill.usableFrom) : "") + resultNote + ". \uC2E4\uC81C \uAC70\uB798 \uCCB4\uACB0\xB7\uC138\uAE08\xB7\uC218\uC218\uB8CC\uB97C \uC7AC\uD604\uD55C \uAC83\uC740 \uC544\uB2C8\uC5D0\uC694.</p></div>";
      }
      const jobCancellation = jobReservationCancellationReview();
      if (jobCancellation) rows += '<section class="job-reservation-cancellation"><p class="note">\uCDE8\uC5C5 \uC801\uB9BD \uBBF8\uCCB4\uACB0 ' + jobCancellation.count + "\uAC74 \xB7 \uB0A8\uC740 \uC608\uC57D\uAE08 " + jobCancellation.refund.toLocaleString() + '\uC6D0. \uC55E\uC73C\uB85C\uC758 \uACC4\uD68D\uC744 \uBC14\uAFB8\uB294 \uAC83\uACFC \uAE30\uC874 \uC608\uC57D \uCDE8\uC18C\uB294 \uBCC4\uAC1C\uC785\uB2C8\uB2E4.</p><button id="job-reservations-cancel-open" style="min-height:44px">\uCDE8\uC5C5 \uC801\uB9BD \uBBF8\uCCB4\uACB0\uBD84\uB9CC \uD568\uAED8 \uCDE8\uC18C \uAC80\uD1A0</button></section>';
      rows += fillLedgerHtml() + '<button id="fill-library-open" type="button" style="width:100%;min-height:44px;margin:8px 0;padding:10px;border:1px solid #cfc7be;border-radius:8px;background:#fff;color:inherit;font:inherit;cursor:pointer">\uC800\uC7A5\uB41C \uC804\uCCB4 \uCCB4\uACB0 \uCC3E\uAE30</button>';
      if (!CASH_MODE) rows += careerMechanicsHtml();
      if (SCHOOL_MODE) rows += schoolTrialNote();
      else rows += '<p><a href="' + (CASH_MODE ? "?start=classic" : "?start=classic&amp;economy=cash-events-trial") + '">' + (CASH_MODE ? "\uAE30\uC874 \uC2DC\uD5D8\uC21C\uC800\uCD95 \uD68C\uADC0(\uD074\uB798\uC2DD)\uB85C \uB3CC\uC544\uAC00\uAE30" : "\uAE30\uC874 \uC800\uC7A5\uC744 \uADF8\uB300\uB85C \uB450\uACE0 \uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 \uD68C\uADC0(\uD074\uB798\uC2DD) \uBCF4\uAE30") + "</a></p>";
      if (!SCHOOL_CASH_MODE) rows += '<p><a id="school-cash-mode-entry" href="?economy=cash-events-trial">\uAE30\uC874 \uC5EC\uC12F \uC800\uC7A5\uD0A4\uB97C \uADF8\uB300\uB85C \uB450\uACE0 \uACE01 \uB2EC\uB825+\uD604\uAE08\uC0AC\uAC74 \uC5F0\uACB0 \uC2DC\uD5D8 \uBCF4\uAE30</a></p>';
      if (!SCHOOL_MODE && !CASH_MODE) rows += '<p><a id="school-mode-entry" href="./">\uC0DD\uB144\uC6D4\uBCC4 \uACE01 \uB2EC\uB825 \uC2DC\uC791(\uBCF8\uD3B8)\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30</a></p>';
      if (cashPlanActive()) rows = rows.replaceAll("\uCDE8\uC5C5 \uC21C\uC800\uCD95", "\uCDE8\uC5C5 \uC6D4 \uC5EC\uC720\uAE08").replaceAll("\uC2E0\uADDC \uC21C\uC800\uCD95", "\uC2E0\uADDC \uC6D4 \uC5EC\uC720\uAE08");
      el.innerHTML = rows;
      bindPropertyPanel();
      const cancelJobOpen = document.getElementById("job-reservations-cancel-open");
      if (cancelJobOpen) cancelJobOpen.onclick = renderJobReservationCancellation;
      const reserveOpen = document.getElementById("cash-reserve-open");
      if (reserveOpen) reserveOpen.onclick = () => renderCashReserve();
      const jobPlanOpen = document.getElementById("job-plan-open");
      if (jobPlanOpen) jobPlanOpen.onclick = () => renderJobSavingsPlan();
      if (CAREER_TRIAL && state.flags.career === "job") for (const product of Object.keys(state.holdings)) {
        const r = careerCashRecovery(product);
        if (!r) continue;
        const b = document.createElement("button");
        b.className = "career-recovery-open";
        b.dataset.product = product;
        b.textContent = r.name + " \xB7 \uAE30\uC874 \uC608\uCE58\uAE08 \uD604\uAE08\uD68C\uC218 \uAC80\uD1A0";
        b.style.minHeight = "44px";
        b.onclick = () => renderCareerCashRecovery(product);
        el.append(b);
      }
      if (CASH_MODE) {
        const b = document.getElementById("cash-retry");
        if (b) b.onclick = () => renderCashRepay();
        const policy = document.getElementById("cash-auto-toggle");
        if (policy) policy.onclick = () => toggleCashAutomation();
      }
      if (careerCashActive()) {
        const rb = document.getElementById("career-cash-repay");
        if (rb) rb.onclick = () => careerCashRepay();
      }
      if (state.pendingOrders && state.pendingOrders.length) {
        const jobGroup = (state.pendingOrders || []).filter((o) => ["job-savings", "career-cash"].includes(o.planOrigin));
        const otherOrders = (state.pendingOrders || []).filter((o) => !["job-savings", "career-cash"].includes(o.planOrigin));
        for (const o of otherOrders) el.appendChild(buildPendingOrderRow(o));
        if (jobGroup.length === 1) el.appendChild(buildPendingOrderRow(jobGroup[0]));
        else if (jobGroup.length >= 2) {
          const group = document.createElement("details");
          group.className = "pending-job-group";
          const groupRemaining = jobGroup.reduce((sum, o) => sum + pendingOrderReview(o).remaining, 0);
          const summary = document.createElement("summary");
          summary.textContent = "\uCDE8\uC5C5 \uC801\uB9BD \uB300\uAE30 \uC8FC\uBB38 " + jobGroup.length + "\uAC74 \xB7 \uB0A8\uC740 \uC608\uC57D\uAE08 \uD569\uACC4 " + groupRemaining.toLocaleString() + "\uC6D0";
          group.appendChild(summary);
          const gnote = document.createElement("p");
          gnote.className = "note";
          gnote.textContent = "\uAC19\uC740 \uC801\uB9BD \uACC4\uD68D\uC5D0\uC11C \uC811\uC218\uB41C \uB300\uAE30 \uC8FC\uBB38\uC744 \uBB36\uC5B4 \uBCF4\uC785\uB2C8\uB2E4. \uC870\uAC74 \uBBF8\uCDA9\uC871\xB7\uC0C8 \uAD00\uCE21 \uBD80\uC7AC\uB85C \uBBF8\uCCB4\uACB0\uC774 \uC774\uC5B4\uC9C8 \uC218 \uC788\uC73C\uBA70 \uC774 \uBB36\uC74C \uD45C\uC2DC\uB294 \uCCB4\uACB0\uC744 \uC608\uACE0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAC74\uBCC4 \uC0C1\uD0DC \uD655\uC778\xB7\uCDE8\uC18C\uB294 \uD3BC\uCE58\uBA74 \uADF8\uB300\uB85C \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
          group.appendChild(gnote);
          for (const o of jobGroup) group.appendChild(buildPendingOrderRow(o));
          el.appendChild(group);
        }
        const hint = document.createElement("div");
        hint.className = "row pending-hint";
        hint.innerHTML = '<span style="font-size:12px;color:#666">\uB300\uAE30 \uC8FC\uBB38\uC740 \uC774\uD6C4 \uC9C4\uD589 \uC911 \uC0C8\uB85C \uAD00\uCE21\uB418\uB294 \uC2DC\uC138 \uC9C0\uC810\uC5D0\uC11C \uCCB4\uACB0\uB3FC\uC694. \uC790\uB8CC \uACF5\uBC31\uC73C\uB85C \uC7A5\uAE30\uAC04 \uBBF8\uCCB4\uACB0\uC774 \uC774\uC5B4\uC9C8 \uC218 \uC788\uC5B4\uC694 [\uC9C0\uC5F0\uCCB4\uACB0 \uC2DC\uC5F0 \uBAA8\uD615]</span>';
        el.appendChild(hint);
        if (careerCashBuyHoldOn() && careerCashUnpaid() > 0 && (state.pendingOrders || []).some((o) => o.kind === "buy")) {
          const holdNote = document.createElement("div");
          holdNote.className = "row pending-hint";
          holdNote.innerHTML = '<span style="font-size:12px;color:#8a4b00">\uBBF8\uB0A9 ' + careerCashUnpaid().toLocaleString() + "\uC6D0 \u2014 \uB300\uAE30 \uB9E4\uC218 \uC8FC\uBB38\uC758 \uCCB4\uACB0\uC774 \uBCF4\uB958 \uC911\uC785\uB2C8\uB2E4. \uCDE8\uC18C\uD558\uBA74 \uC608\uC57D\uAE08\uC774 \uC989\uC2DC \uD604\uAE08\uC73C\uB85C \uB3CC\uC544\uC640 \uC0C1\uD658\uC5D0 \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4 [core-v11]</span>";
          el.appendChild(holdNote);
        }
      }
      const fl = document.getElementById("fill-library-open");
      if (fl) fl.onclick = openFillLibrary;
      const nl = document.getElementById("news-library-open");
      if (nl) nl.onclick = openNewsLibrary;
      const dl = document.getElementById("dash-link");
      if (dl) dl.onclick = () => renderDashboard();
      const ve = document.getElementById("voluntary-end-open");
      if (ve) ve.onclick = () => renderVoluntaryEndConfirm();
      const lsOpen = document.getElementById("living-scenario-open");
      if (lsOpen) lsOpen.onclick = () => renderLivingScenario();
    }
    function renderVoluntaryEndConfirm() {
      if (storageReadBlocked || storageWriteBlocked) return;
      if (state.resetRules !== 1 || state.flags.gameOver || state.month > GAME_END) return;
      const card = document.getElementById("turn-card");
      card.innerHTML = '<div class="date">' + state.month + " \xB7 \uD68C\uADC0 \uB9C8\uCE58\uAE30 \uD655\uC778</div><h2>\uC774 \uD68C\uADC0\uB97C \uC5EC\uAE30\uC11C \uB9C8\uCE60\uAE4C\uC694?</h2><p>\uC9C0\uAE08 \uC778\uC0DD\uC744 \uB9C8\uCE58\uACE0 \uAE30\uB85D\uC744 \uB0A8\uAE34 \uB4A4 \uC0C8 \uD68C\uADC0\uB97C \uC2DC\uC791\uD569\uB2C8\uB2E4. \uC804\uCCB4 \uACB0\uC0B0 \uC2DC\uC810(" + GAME_END + ")\uBCF4\uB2E4 \uC774\uB978 \uC911\uB3C4 \uB9C8\uCE68\uC73C\uB85C \uAE30\uB85D\uB3FC\uC694. \uBBF8\uCCB4\uACB0 \uC8FC\uBB38\uC740 \uC778\uC0DD \uACB0\uC0B0\uACFC \uAC19\uC740 \uADDC\uCE59\uC73C\uB85C \uCDE8\uC18C\xB7\uBC18\uD658\uD574 \uACB0\uC0B0\uD569\uB2C8\uB2E4 [\uC2DC\uC5F0 \uADDC\uCE59]. \uB0A8\uC740 \uAE30\uAC04\uC758 \uB274\uC2A4\xB7\uC815\uC0B0 \uAE30\uD68C\uB97C \uD3EC\uAE30\uD558\uB294 \uC120\uD0DD\uC774\uBA70 \uC218\uC775 \uBCF4\uC7A5\uC774 \uC544\uB2C8\uC5D0\uC694.</p><p>\uD604\uC7AC \uCD1D\uC790\uC0B0 " + totalAssets().toLocaleString() + "\uC6D0 \xB7 \uD134 " + state.turnCount + " \xB7 \uCE74\uC624\uC2A4 " + state.chaos.toFixed(1) + "/100</p>" + lifeEndHtml();
      renderChoices([
        { id: "record-and-reset-voluntary", label: "\uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0 \uC0C8 \uD68C\uADC0 \uC2DC\uC791" },
        { id: "voluntary-end-cancel", label: "\uB3CC\uC544\uAC00\uAE30 \u2014 \uACC4\uC18D \uC9C4\uD589" }
      ], null);
    }
    function assetTrailEndpointNotice(l) {
      if (!l || !Number.isFinite(l.totalAssets) || typeof l.observationMonth !== "string") return "";
      const detail = Array.isArray(l.assetTrail) ? l.assetTrail.at(-1) : null;
      const summary = l.assetTrailSummary;
      const last = detail && detail.m === l.observationMonth && Number.isFinite(detail.a) ? detail.a : l.archiveDetail?.level === "summary" && summary?.to === l.observationMonth && Number.isFinite(summary.lastAssets) ? summary.lastAssets : null;
      if (last === null || Math.abs(last - l.totalAssets) <= 1) return "";
      return '<p class="note asset-trail-endpoint-notice">\uC774 \uAE30\uB85D\uC758 \uC6D4\uBCC4 \uB9C8\uC9C0\uB9C9 \uC800\uC7A5\uAC12 ' + last.toLocaleString() + "\uC6D0\uACFC \uCD5C\uC885 \uACB0\uC0B0 \uC790\uC0B0 " + l.totalAssets.toLocaleString() + "\uC6D0\uC774 \uB2E4\uB985\uB2C8\uB2E4. \uC11C\uB85C \uB2E4\uB978 \uAE30\uB85D\uAC12\uC744 \uADF8\uB300\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC6D4\uBCC4 \uB05D\uC810\uC744 \uCD5C\uC885 \uACB0\uC0B0\uAC12\uC73C\uB85C \uC77D\uAC70\uB098 \uB458 \uC0AC\uC774\uB97C \uC218\uC775\uB960\uB85C \uD574\uC11D\uD558\uC9C0 \uB9C8\uC138\uC694. \uACFC\uAC70 \uAE30\uB85D\uC744 \uB2E4\uC2DC \uACC4\uC0B0\uD558\uAC70\uB098 \uBC14\uAFB8\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p>";
    }
    function assetTrailHtml(l) {
      const endpointNotice = assetTrailEndpointNotice(l);
      if (l && l.archiveDetail && l.archiveDetail.version === 1 && l.archiveDetail.level === "summary") {
        const r = l.assetTrailSummary, valid = r && /^\d{4}-\d{2}$/.test(r.from) && /^\d{4}-\d{2}$/.test(r.to) && Number.isInteger(r.recordedMonths) && r.recordedMonths > 0 && ["minAssets", "maxAssets", "firstAssets", "lastAssets"].every((k) => Number.isFinite(r[k]));
        return endpointNotice + '<details class="asset-trail-summary"><summary>\uC6D4\uBCC4 \uC0C1\uC138\uB97C \uC904\uC778 \uC694\uC57D \uBCF4\uAD00</summary><p class="note">\uCD5C\uADFC \uC644\uB8CC \uD68C\uADC0 1\uAC74\uC740 \uC0C1\uC138\uB85C \uB0A8\uAE30\uACE0, \uC774\uC804 \uD68C\uADC0\uB294 \uC6D4\uBCC4 \uCD1D\uC790\uC0B0 \uB0B4\uC5ED\uC744 \uC694\uC57D\uD569\uB2C8\uB2E4. \uC5C6\uC564 \uC6D4\uBCC4 \uADF8\uB798\uD504\xB7\uD2B9\uC815 \uC6D4 \uC790\uC0B0\uC740 \uBCF5\uC6D0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uC694 \uC120\uD0DD \uB0A0\uC9DC\xB7\uCD5C\uC885 \uC790\uC0B0\xB7\uC9C4\uB85C\xB7\uBE44\uAD50 \uADFC\uAC70\uB294 \uADF8\uB300\uB85C \uB0A8\uC2B5\uB2C8\uB2E4.</p>' + (valid ? "<p>" + esc(r.from) + " ~ " + esc(r.to) + " \xB7 \uAE30\uB85D " + r.recordedMonths + "\uAC1C\uC6D4 \xB7 \uAE30\uB85D \uC9C0\uC810 \uCD5C\uC800 " + r.minAssets.toLocaleString() + "\uC6D0 / \uCD5C\uACE0 " + r.maxAssets.toLocaleString() + "\uC6D0 \xB7 \uCC98\uC74C " + r.firstAssets.toLocaleString() + "\uC6D0 / \uB9C8\uC9C0\uB9C9 " + r.lastAssets.toLocaleString() + '\uC6D0</p><p class="note">\uC800\uC7A5 \uB2F9\uC2DC \uC2DC\uC5F0 \uCD1D\uC790\uC0B0\uC758 \uC694\uC57D\uC774\uBA70 \uC2E4\uC81C \uC2DC\uC7A5 \uCD5C\uC800\xB7\uCD5C\uACE0\uAC00\uB098 \uD22C\uC790 \uC218\uC775\uB960\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uBBF8\uAE30\uB85D \uAD6C\uAC04\uC744 \uCC44\uC6B0\uAC70\uB098 \uADF8\uB798\uD504\uB97C \uC774\uC5B4 \uADF8\uB9AC\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>' : '<p class="note">\uC694\uC57D \uAC00\uB2A5\uD55C \uC720\uD6A8 \uC6D4\uBCC4 \uC9C0\uC810\uC774 \uC5C6\uC5C8\uC2B5\uB2C8\uB2E4. \uACFC\uAC70 \uC6D4\uBCC4 \uC790\uC0B0\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>') + "</details>";
      }
      if (!l || !Array.isArray(l.assetTrail) || l.assetTrail.length < 2) return '<p class="note">\uC6D4\uBCC4 \uC790\uC0B0 \uADA4\uC801 \uBBF8\uAE30\uB85D \u2014 \uADA4\uC801 \uAE30\uB85D[asset-trail-v1] \uC774\uC804\uC758 \uD68C\uADC0\uC774\uAC70\uB098 \uAE30\uB85D \uAD6C\uAC04\uC774 2\uAC1C\uC6D4 \uBBF8\uB9CC\uC785\uB2C8\uB2E4. \uACFC\uAC70 \uC6D4\uC744 \uCD94\uC815\uD574 \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      const pts = l.assetTrail.filter((p) => p && typeof p.m === "string" && Number.isFinite(p.a));
      if (pts.length < 2) return '<p class="note">\uC6D4\uBCC4 \uC790\uC0B0 \uADA4\uC801 \uBBF8\uAE30\uB85D \u2014 \uC720\uD6A8\uD55C \uADA4\uC801 \uC9C0\uC810\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4.</p>';
      const w = 300, h = 44, pad = 2;
      const vals = pts.map((p) => p.a);
      const min = Math.min(...vals), max = Math.max(...vals);
      const span = max - min || 1;
      const step = (w - pad * 2) / (pts.length - 1);
      const points = pts.map((p, i) => (pad + i * step).toFixed(1) + "," + (h - pad - (p.a - min) / span * (h - pad * 2)).toFixed(1)).join(" ");
      const runStart = l.schoolStart && l.schoolStart.startMonth || "1996-03";
      const coverageNote = l.assetTrailFrom && l.assetTrailFrom > runStart ? " \uADA4\uC801\uC740 " + esc(l.assetTrailFrom) + "\uBD80\uD130 \uAE30\uB85D \u2014 \uC774\uC804 \uAD6C\uAC04\uC740 \uAE30\uB85D \uAE30\uB2A5 \uC774\uC804\uC774\uB77C \uC18C\uAE09\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "";
      return endpointNotice + '<details class="asset-trail"><summary>\uC6D4\uBCC4 \uCD1D\uC790\uC0B0 \uADA4\uC801 \xB7 ' + pts.length + '\uAC1C\uC6D4</summary><svg viewBox="0 0 ' + w + " " + h + '" width="100%" height="' + h + '" role="img" aria-label="\uC6D4\uBCC4 \uCD1D\uC790\uC0B0 \uADA4\uC801"><polyline points="' + points + '" fill="none" stroke="#335" stroke-width="1.5"/></svg><p class="note">' + esc(pts[0].m) + " ~ " + esc(pts[pts.length - 1].m) + " \xB7 \uCD5C\uC800 " + min.toLocaleString() + "\uC6D0 \xB7 \uCD5C\uACE0 " + max.toLocaleString() + "\uC6D0. \uC800\uC7A5 \uC2DC\uC810\uC758 \uCD1D\uC790\uC0B0(\uD604\uAE08+\uBCF4\uC720 \uC2DC\uC5F0\uD3C9\uAC00+\uC608\uC57D\uAE08 \uD3EC\uD568)\uC744 \uC6D4\uBCC4\uB85C \uB0A8\uAE34 \uAC83\uC73C\uB85C \uC2E4\uC81C \uACC4\uC88C \uD750\uB984 \uC7AC\uD604\uC774 \uC544\uB2C8\uC5D0\uC694." + coverageNote + "</p></details>";
    }
    function renderLivingScenario() {
      if (state.livingScenarioRules !== 1 || storageReadBlocked || storageWriteBlocked) return;
      const M = typeof ReturnLivingScenario2019Q3 !== "undefined" ? ReturnLivingScenario2019Q3 : null;
      const card = document.getElementById("turn-card");
      const box = document.getElementById("choices");
      const backBtn = () => {
        box.innerHTML = "";
        const b = document.createElement("button");
        b.textContent = "\uB3CC\uC544\uAC00\uAE30 - \uACC4\uC18D \uC9C4\uD589";
        b.onclick = () => render();
        box.appendChild(b);
      };
      if (!M || !M.ledger) {
        card.innerHTML = '<div class="date">\uC870\uAC74 \uC2DC\uB098\uB9AC\uC624 \uC7A5\uBD80</div><h2>\uC7A5\uBD80 \uBAA8\uB4C8\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4</h2><p>\uD45C\uC2DC\uB97C \uC9C0\uC5B4\uB0B4\uC9C0 \uC54A\uACE0 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uBCF8\uD3B8 \uC9C4\uD589\uC5D0\uB294 \uC601\uD5A5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        backBtn();
        return;
      }
      const L = M.ledger;
      const chip = (status) => {
        if (/^verified-within-declared-inputs/.test(status)) return "\uAC80\uC99D\uB428(\uBA85\uC2DC \uC870\uAC74 \uD55C\uC815)";
        if (/^verified-row/.test(status)) return "\uAC80\uC99D\uB428(\uD574\uB2F9 \uD45C \uD589 \uC6D0\uBB38 \uB300\uC870)";
        if (/^rate-statutory-confirmed/.test(status)) return "\uC694\uC728 \uBC95\uB839 \uD655\uC778 \xB7 \uACF5\uC81C\uC561 \uC7A0\uC815";
        if (/^provisional/.test(status)) return "\uC7A0\uC815(\uAC80\uC0B0 \uC804)";
        if (/^raw산술값만/.test(status)) return "\uBBF8\uD655\uC815(\uCD5C\uC885 \uB05D\uC218 \uAC80\uC0B0 \uC804)";
        if (/^명시 가정/.test(status)) return "\uBA85\uC2DC \uAC00\uC815";
        if (/^명시 시나리오/.test(status)) return "\uBA85\uC2DC \uC2DC\uB098\uB9AC\uC624(\uAC00\uC815 - \uC2E4\uC81C \uC790\uACA9 \uC785\uC99D \uC544\uB2D8)";
        if (/^생성 없음/.test(status)) return "\uD574\uB2F9 \uC5C6\uC74C";
        if (/^null/.test(status)) return "\uBBF8\uD655\uC778(null)";
        return "\uC0C1\uD0DC \uD655\uC778 \uD544\uC694";
      };
      const src = (status, ref) => '<details class="living-status-src"><summary>\uC0C1\uD0DC\xB7\uADFC\uAC70 \uC6D0\uBB38</summary><p class="note">' + esc(status) + "</p>" + (ref ? '<p class="note">' + esc(ref) + "</p>" : "") + "</details>";
      let html = '<div class="date">\uC5F4\uB78C \uC804\uC6A9 \uC2DC\uC81C\uD488 \xB7 \uBAA8\uD615 ID ' + esc(L.model_id) + ' \xB7 \uD604\uAE08 \uBBF8\uBC18\uC601</div><h2>2019Q3 \uBC95\uC815 \uCD5C\uC800 \uC870\uAC74 \uC2DC\uB098\uB9AC\uC624 \uC7A5\uBD80 [\uBA85\uC2DC \uAC00\uC815]</h2><p class="note">\uC2E4\uC81C \uC5ED\uC0AC \uC2DC\uBBAC\uC774 \uC544\uB2C8\uB77C \uD604\uC7AC \uC870\uC0AC\uC5D0\uC11C \uD655\uBCF4\uD55C \uD55C\uC815 \uC2DC\uB098\uB9AC\uC624\uC758 \uBA85\uC2DC \uAC00\uC815 \uC704\uC758 \uACC4\uC0B0\uC785\uB2C8\uB2E4. \uC774 \uD654\uBA74\uC758 \uC5B4\uB5A4 \uAE08\uC561\uB3C4 \uBCF8\uD3B8 \uD604\uAE08\xB7\uC8FC\uBB38 \uAC00\uB2A5\uC561\xB7\uC2DC\uD5D8 \uC21C\uC800\uCD95\uC5D0 \uBC18\uC601\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4(\uC0AC\uC6A9\uC790\uAC00 \uCCB4\uAC10\uD558\uB294 \uD604\uAE08 \uC5F0\uACB0\uC740 \uC544\uC9C1 \uC544\uB2D8). \uACF5\uC2DD \uC2E4\uC218\uB839 \uD569\uACC4\uB294 \uAC80\uC0B0 \uC804\uC774\uB77C null\uB85C \uC7A0\uACA8 \uC788\uACE0, \uB450 \uC9C4\uB85C\uC758 \uD604\uC2E4 \uC0DD\uACC4 \uC6B0\uC5F4\uC740 \uC0B0\uCD9C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uD655\uC815\uC740 0\uC6D0\uC774 \uC544\uB2C8\uB77C null\uC785\uB2C8\uB2E4.</p><details><summary>\uBA85\uC2DC \uAC00\uC815(\uC704\uC784 \uC124\uACC4\uC758 \uB3C5\uB9BD \uC2DC\uD5D8 \uC870\uAC74 - \uAC1C\uC778\uC0AC\uC2E4 \uC544\uB2D8)</summary><ul>' + ["\uC6D4 \uCD1D\uAE09\uC5EC 1,745,150\uC6D0(2019 \uACE0\uC2DC \uCD5C\uC800\uC784\uAE08 8,350\uC6D0\xD7209h, \uBC95\uC815 \uCD5C\uC800 \uC870\uAC74)", "\uC2E0\uACE0\uC18C\uB4DD=\uCD1D\uAE09\uC5EC \uACE0\uC815", "2019-07-01 \uCD08\uC77C \uC785\uC0AC(\uB2F9\uC6D4 \uC0B0\uC785\uC740 \uBC95\uC815)", "\uB9E4\uC6D4 25\uC77C \uB2F9\uC6D4 \uC9C0\uAE09", "\uBE44\uACFC\uC138 0\uC6D0 \xB7 \uACF5\uC81C\uAC00\uC871 1\uBA85 \xB7 \uC6D0\uCC9C 100%", "\uB450\uB8E8\uB204\uB9AC \uBBF8\uC2E0\uCCAD \uBA85\uC2DC(\uC2E4\uC81C \uC9C0\uC6D0 \uC5C6\uC74C \uD655\uC815 \uC544\uB2D8)", "\uC77C\uBC18\uC9C1\uC7A5 \xB7 \uD2B9\uC218\uC9C1\uC5ED \uC544\uB2D8 \xB7 \uB2E4\uB978 \uC9C0\uC6D0/\uACBD\uAC10 \uBC18\uC601 \uC5C6\uC74C(\uC790\uB3D9\uBA74\uC81C \uBD80\uC7AC\uB294 \uBBF8\uC785\uC99D)"].map((x) => "<li>" + x + "</li>").join("") + "</ul></details>";
      html += "<h3>\uCDE8\uC5C5 \uAC08\uB798 \uC6D4\uBCC4 \uC7A5\uBD80(2019-07 ~ 2019-09)</h3>";
      for (const m of L.job_branch) {
        html += "<details><summary>" + esc(m.month) + " \xB7 \uCD1D\uAE09\uC5EC " + m.gross.toLocaleString() + "\uC6D0 \xB7 \uC2E4\uC218\uB839 null(\uAC80\uC0B0 \uC804)</summary><ul>" + m.deductions.map((d) => "<li>" + esc(d.label) + " - " + (d.amount_provisional === null ? "null" : Number(d.amount_provisional).toLocaleString() + "\uC6D0") + " \xB7 <strong>" + chip(d.status) + "</strong>" + src(d.status, d.ref) + "</li>").join("") + '</ul><p class="note">' + esc(m.remittance.note) + "</p></details>";
      }
      html += "<h3>\uC804\uC5C5 \uAC08\uB798 \uC6D4\uBCC4 \uC7A5\uBD80(2019-07 ~ 2019-09)</h3>";
      for (const m of L.fulltime_branch) {
        html += "<details><summary>" + esc(m.month) + " \xB7 \uADFC\uB85C\uC18C\uB4DD 0\uC6D0</summary><ul>" + ["health", "pension", "living_cost", "severance_unemployment"].map((k) => "<li><strong>" + chip(m[k].status) + "</strong>" + (m[k].amount === null ? " - null" : " - " + m[k].amount.toLocaleString() + "\uC6D0") + src(m[k].status) + "</li>").join("") + "</ul></details>";
      }
      html += "<details><summary>\uC774 \uBAA8\uD615\uC73C\uB85C \uC0B0\uCD9C\uD560 \uC218 \uC5C6\uB294 \uAC83</summary><ul>" + L.impossible_outputs.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></details><details><summary>\uC790\uB8CC\uB2F4\uB2F9\uACFC \uAC80\uC0B0 \uC911\uC778 4\uAC1C \uACBD\uACC4</summary><ul>" + L.open_verification_with_data_owner.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></details>";
      card.innerHTML = html;
      backBtn();
    }
    function recordContextHtml(value) {
      const r = ReturnRecordContext.inspect(value), contexts = ReturnRecordContext.valid(value) ? value.contexts : [];
      return '<details class="record-context"><summary>' + esc(r.label) + "</summary><p>\uAC8C\uC784 \uADDC\uCE59 \uC2DD\uBCC4\uC790\xB7\uC120\uD0DD\uB41C \uC2E4\uD589 \uADDC\uCE59 \uD568\uC218\uC758 \uC9C0\uBB38\uACFC \uC2E4\uC81C \uC77D\uC740 \uC790\uB8CC \uD30C\uC77C\uC758 SHA-256\uC744 \uBCF4\uC874\uD569\uB2C8\uB2E4. \uC5ED\uC0AC\uC0AC\uC2E4\xB7\uAC1C\uC778 \uAC00\uC785\uC790\uACA9\xB7\uC2E4\uC81C \uCCB4\uACB0\uAC00\uC758 \uAC80\uC99D \uD45C\uC2DC\uAC00 \uC544\uB2C8\uBA70 \uC0DD\uB144\xB7\uC120\uD0DD\xB7\uAE08\uC561\xB7\uAE30\uAC04\uAE4C\uC9C0 \uAC19\uB2E4\uB294 \uB73B\uB3C4 \uC544\uB2D9\uB2C8\uB2E4. \uC2E4\uD589 \uCF54\uB4DC \uC804\uCCB4\uC758 \uD574\uC2DC\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uACFC\uAC70 \uBBF8\uAE30\uB85D \uAD6C\uAC04\uC740 \uC18C\uAE09 \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>" + contexts.map((c) => "<p>" + esc(c.ruleset) + " \xB7 " + esc(c.mode) + " \xB7 " + esc(c.economy) + '</p><p style="overflow-wrap:anywhere">\uC120\uD0DD \uADDC\uCE59 \uD568\uC218 \uC9C0\uBB38 \xB7 ' + esc(c.rulesHash) + "</p><ul>" + Object.entries(c.files).map(([name, hash]) => '<li style="overflow-wrap:anywhere">' + esc(name) + " \xB7 " + esc(hash) + "</li>").join("") + "</ul>").join("") + "</details>";
    }
    function decisionInfo(choice) {
      if (typeof choice === "string" && /^career-cash:repay:[1-9]\d*$/.test(choice)) {
        const amount = Number(choice.slice("career-cash:repay:".length));
        if (Number.isSafeInteger(amount)) return { group: "\uBBF8\uB0A9 \uC0C1\uD658 \uC120\uD0DD", label: "\uBCF8\uD3B8 \uC0DD\uD65C\xB7\uD559\uBE44 \uBBF8\uB0A9 " + amount.toLocaleString() + "\uC6D0 \uC0C1\uD658 \xB7 \uC624\uB798\uB41C \uC6D4 \uCCAD\uAD6C\uBD80\uD130 [\uAC8C\uC784 \uC124\uACC4\uAC12\xB7\uC6D4\uC9C4\uD589 \uC5C6\uC74C]" };
      }
      if (typeof choice === "string" && /^career-cycle:(job|fulltime|alba):(job|fulltime|alba)$/.test(choice)) {
        const p = choice.split(":"), n = { job: "\uCDE8\uC5C5", fulltime: "\uC804\uC5C5", alba: "\uC54C\uBC14 \uBCD1\uD589 \uD22C\uC790" };
        return { group: "\uC9C4\uB85C\xB7\uBCF5\uBB34 \uC120\uD0DD", label: n[p[1]] + " \u2192 " + n[p[2]] + " \uC9C4\uB85C \uC7AC\uC120\uD0DD \xB7 \uB2E4\uC74C \uBD84\uAE30\uC6D4\uAE4C\uC9C0 \uC720\uC9C0 [\uAC8C\uC784\uADDC\uCE59]" };
      }
      const life = { "life:scenario-study": "\uC9C4\uD559 \uC2DC\uB098\uB9AC\uC624\uB85C \uC2DC\uC791 [\uACFC\uAC70 \uC7AC\uD559\xB7\uC77C\uBD80 \uBCF5\uBB34\uB294 \uAC00\uC815]", "life:scenario-plain": "\uC9C4\uB85C \uC774\uB825 \uBBF8\uC815\uC73C\uB85C \uC2DC\uC791", "life:study": "\uACF5\uBD80\xB7\uC9C4\uD559 \uC120\uD0DD", "life:parttime": "\uACE0\uAD50 \uC54C\uBC14 \uACBD\uB85C \uC120\uD0DD", "life:job": "\uB300\uD559 \uC878\uC5C5 \uD6C4 \uCDE8\uC5C5 \uC120\uD0DD", "life:fulltime": "\uB300\uD559 \uC878\uC5C5 \uD6C4 \uC804\uC5C5 \uC120\uD0DD", "life:go-now": "\uBC14\uB85C \uC785\uB300 \uC120\uD0DD", "life:defer-1y": "\uC785\uB3001\uB144 \uC720\uC608 \uC120\uD0DD [\uC2DC\uD5D8\uAC00\uC815]", "life:acad-focus": "\uC7AC\uD559 \uBC29\uCE68 \uACF5\uBD80 \uC9D1\uC911 [\uC2DC\uD5D8\uADDC\uCE59]", "life:acad-balanced": "\uC7AC\uD559 \uBC29\uCE68 \uC54C\uBC14 \uBCD1\uD589 [\uC2DC\uD5D8\uADDC\uCE59]", "life:acad-keep": "\uC7AC\uD559 \uBC29\uCE68 \uC720\uC9C0 [\uC2DC\uD5D8\uADDC\uCE59]", "life:acad-admit-ok": "\uC9C4\uD559 \uD310\uC815 \uD655\uC778 [\uC2DC\uD5D8\uADDC\uCE59]" };
      if (Object.prototype.hasOwnProperty.call(life, choice)) return { group: "\uC9C4\uB85C\xB7\uBCF5\uBB34 \uC120\uD0DD", label: life[choice] };
      if (choice === "cash-policy:enable-living" || choice === "cash-policy:disable-living") return { group: "\uAC00\uC0C1\uCCAD\uAD6C \uC120\uD0DD", label: choice === "cash-policy:enable-living" ? "\uB2E4\uC74C\uC6D4\uBD80\uD130 \uC0DD\uD65C\uCCAD\uAD6C \uC870\uAC74\uBD80 \uC790\uB3D9\uB0A9\uBD80 \uC815\uCC45 \uCF1C\uAE30 [\uC784\uC758\uAC12]" : "\uB2E4\uC74C\uC6D4\uBD80\uD130 \uC0DD\uD65C\uCCAD\uAD6C \uC790\uB3D9\uB0A9\uBD80 \uC815\uCC45 \uB044\uAE30 [\uC784\uC758\uAC12]" };
      if (typeof choice === "string" && choice.startsWith("order-condition-new:")) {
        const parts = choice.split(":"), u = DATA.unlocks.find((u2) => u2.product === parts[1]);
        if (u && parts.length === 4 && ["above", "below"].includes(parts[2]) && Number.isFinite(Number(parts[3])) && Number(parts[3]) > 0) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: u.name + " \uC0C8 \uC870\uAC74 \uC8FC\uBB38 \xB7 " + Number(parts[3]).toLocaleString() + (parts[2] === "above" ? " \uC774\uC0C1" : " \uC774\uD558") + " \uC9C0\uC810\uC5D0\uC11C\uB9CC [\uAC00\uACA9\uBCF4\uC7A5 \uC5C6\uC74C]" };
      }
      if (typeof choice === "string" && choice.startsWith("order-condition-change:")) {
        const parts = choice.split(":"), u = DATA.unlocks.find((u2) => u2.product === parts[1]);
        if (u && (parts.length === 3 && parts[2] === "none" || parts.length === 4 && ["above", "below"].includes(parts[2]) && Number.isFinite(Number(parts[3])) && Number(parts[3]) > 0)) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: u.name + " \uB300\uAE30 \uC870\uAC74 \uBCC0\uACBD \xB7 " + (parts[2] === "none" ? "\uAC00\uACA9\uC870\uAC74 \uD574\uC81C" : "\uC0C8 \uC9C0\uC810 " + Number(parts[3]).toLocaleString() + (parts[2] === "above" ? " \uC774\uC0C1" : " \uC774\uD558")) + " [\uB2E4\uC74C \uC0C8 \uC801\uACA9\uAD00\uCE21\uBD80\uD130]" };
      }
      if (typeof choice === "string" && /^order-deadline-change:[^:]+:(none|\d{4}-\d{2})$/.test(choice)) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uAE30\uC874 \uB9E4\uC218 \uAE30\uD55C \uBCC0\uACBD \xB7 " + (choice.endsWith(":none") ? "\uAE30\uD55C \uC5C6\uC74C" : choice.slice(-7) + " \uC6D4\uCD08 \uBC18\uD658") + " [\uC2DC\uD5D8\uADDC\uCE59]" };
      if (typeof choice === "string" && /^order-deadline:[^:]+:\d{4}-\d{2}$/.test(choice)) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uB9E4\uC218 \uB300\uAE30 \uAE30\uD55C " + choice.slice(-7) + " \uC6D4\uCD08 \uC124\uC815 [\uC2DC\uD5D8\uADDC\uCE59]" };
      if (typeof choice === "string" && /^cash-reserve:(0|700000|2100000|4200000)$/.test(choice)) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uB2E4\uC74C \uB2EC\uBD80\uD130 \uCDE8\uC5C5 \uC790\uB3D9\uC801\uB9BD \uC804 \uC608\uBE44\uD604\uAE08 " + Number(choice.split(":")[1]).toLocaleString() + "\uC6D0 \uB0A8\uAE30\uAE30 \uBC29\uCE68" };
      if (typeof choice === "string" && /^cash-savings-plan:(0|50|100):(kospi|fx|usdeposit)$/.test(choice)) {
        const p = choice.split(":");
        return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uB2E4\uC74C \uB2EC\uBD80\uD130 \uC0DD\uD65C\xB7\uD559\uBE44 \uB0A9\uBD80 \uB4A4 \uC2E0\uADDC \uC5EC\uC720\uAE08 " + p[1] + "% " + (productRule(p[2]).name || p[2]) + " \uC801\uB9BD \uC608\uC57D \uACC4\uD68D" };
      }
      if (typeof choice === "string" && /^cash-allocation-plan:(0|50|100):(kospi|fx|usdeposit)(:(25|50|75):(kospi|fx|usdeposit))?$/.test(choice)) {
        const p = choice.split(":");
        return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uB2E4\uC74C \uB2EC \uC2E0\uADDC \uC5EC\uC720\uAE08 " + p[1] + "% \uC608\uC57D \xB7 " + (p[1] === "0" ? "\uC55E\uC73C\uB85C\uC758 \uC608\uC57D \uC911\uB2E8" : p.length === 6 ? productRule(p[2]).name + " " + p[3] + "% / " + productRule(p[4]).name + " " + (100 - Number(p[3])) + "%" : p.length === 5 ? productRule(p[2]).name + " " + p[3] + "% / " + productRule(p[4]).name + " " + (100 - Number(p[3])) + "%" : productRule(p[2]).name) };
      }
      if (choice === "cash-allocation-auto") return null;
      if (typeof choice === "string" && choice.startsWith("cash-savings-auto:")) return null;
      if (typeof choice === "string" && /^job-savings-plan:(0|50|100):(kospi|fx|usdeposit)$/.test(choice)) {
        const parts = choice.split(":");
        return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uB2E4\uC74C \uB2EC\uBD80\uD130 \uC2DC\uD5D8 \uC21C\uC800\uCD95 " + parts[1] + "% " + (productRule(parts[2]).name || parts[2]) + " \uC801\uB9BD \uC608\uC57D \uACC4\uD68D" };
      }
      if (typeof choice === "string" && /^job-savings-plan:(0|50|100)$/.test(choice)) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uB2E4\uC74C \uB2EC\uBD80\uD130 \uC2DC\uD5D8 \uC21C\uC800\uCD95 " + choice.split(":")[1] + "% \uAD6D\uB0B4\uC9C0\uC218 \uC801\uB9BD \uC608\uC57D \uACC4\uD68D" };
      if (typeof choice === "string" && choice.startsWith("job-savings-auto:")) return null;
      if (typeof choice === "string" && /^career-cash-recovery:(deposit|bond):(50|100)$/.test(choice)) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uAE30\uC874 \uC6D0\uD654 \uC774\uC790\uB204\uC801 \uC0C1\uD488 " + choice.split(":")[1] + " " + choice.split(":")[2] + "% \uD604\uAE08\uD68C\uC218 [\uC2DC\uD5D8\uADDC\uCE59\xB7\uC7AC\uD22C\uC790 \uC2DC\uAC04\uD45C \uBCC4\uB3C4]" };
      if (choice === "career-switch:fulltime") return { group: "\uC9C4\uB85C\xB7\uBCF5\uBB34 \uC120\uD0DD", label: "\uCDE8\uC5C5 \uD6C4 \uBD84\uAE30 \uC815\uC0B0\uC5D0\uC11C \uC804\uC5C5 \uC804\uD658 \xB7 \uB2E4\uC74C\uC6D4 \uC21C\uC800\uCD950\uC6D0 [\uC2DC\uD5D8\uADDC\uCE59]" };
      if (typeof choice === "string" && /^cancel-job-reservations:[1-9]\d*$/.test(choice)) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: "\uCDE8\uC5C5 \uC801\uB9BD \uBBF8\uCCB4\uACB0 " + choice.split(":")[1] + "\uAC74 \uD568\uAED8 \uCDE8\uC18C [\uD5A5\uD6C4 \uACC4\uD68D \uBCC4\uB3C4]" };
      if (choice === "discharge-ok") return { group: "\uC790\uB3D9\uC77C\uC815 \uD655\uC778", label: "\uC790\uB3D9 \uC804\uC5ED\uC77C\uC815 \uD655\uC778 [\uC804\uC5ED\uC77C\uC744 \uACE0\uB978 \uC120\uD0DD\uC774 \uC544\uB2D8]" };
      let m = typeof choice === "string" && choice.match(/^cash-event:(paid|deferred):(\d{4}-(?:0[1-9]|1[0-2]))$/);
      if (m) return { group: "\uAC00\uC0C1\uCCAD\uAD6C \uC120\uD0DD", label: m[2] + " \uCCAD\uAD6C " + (m[1] === "paid" ? "\uC804\uC561 \uAC00\uC0C1\uB0A9\uBD80" : "\uBBF8\uB0A9\uC744 \uB0A8\uAE30\uACE0 \uBCF4\uB958") + " [\uC784\uC758\uAC12]" };
      m = typeof choice === "string" && choice.match(/^cash-event:repay-month:(\d{4}-(?:0[1-9]|1[0-2]))$/);
      if (m) return { group: "\uAC00\uC0C1\uCCAD\uAD6C \uC120\uD0DD", label: m[1] + " \uBCF4\uB958 \uCCAD\uAD6C \uD55C \uAC74 \uC804\uC561 \uC7AC\uB0A9\uBD80 [\uC784\uC758\uAC12]" };
      m = typeof choice === "string" && choice.match(/^cash-event:repay:([1-9]\d*)$/);
      if (m) return { group: "\uAC00\uC0C1\uCCAD\uAD6C \uC120\uD0DD", label: "\uBCF4\uB958 \uCCAD\uAD6C " + m[1] + "\uAC74 \uC7AC\uB0A9\uBD80 [\uC784\uC758\uAC12]" };
      m = typeof choice === "string" && choice.match(/^(enter|enter-order|sell|sell-order):([a-z0-9]+):(\d+)$/);
      if (m && Number(m[3]) <= 100) {
        const u = DATA.unlocks.find((u2) => u2.product === m[2]);
        if (u) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: u.name + " " + (m[1].startsWith("enter") ? "\uB9E4\uC218" : "\uB9E4\uB3C4") + (m[1].endsWith("order") ? " \uC2E0\uCCAD" : " \uC2E4\uD589") + " \xB7 \uC785\uB825\uBE44\uC911 " + m[3] + "% [\uC2E4\uC81C \uAC70\uB798 \uC544\uB2D8]" };
      }
      m = typeof choice === "string" && choice.match(/^order-reduce:([a-z0-9]+):(25|50|75):([1-9]\d*)$/);
      if (m) {
        const u = DATA.unlocks.find((u2) => u2.product === m[1]);
        if (u) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: u.name + " \uB9E4\uC218 \uC608\uC57D\uAE08 " + m[2] + "% \uCD95\uC18C \xB7 " + Number(m[3]).toLocaleString() + "\uC6D0 \uD604\uAE08 \uBC18\uD658 [\uC794\uC5EC \uC8FC\uBB38 \uC720\uC9C0]" };
      }
      m = typeof choice === "string" && choice.match(/^cancel-order:([a-z0-9]+)$/);
      if (m) {
        const u = DATA.unlocks.find((u2) => u2.product === m[1]);
        if (u) return { group: "\uB9E4\uB9E4 \uC120\uD0DD", label: u.name + " \uB300\uAE30\uC8FC\uBB38 \uCDE8\uC18C" };
      }
      return null;
    }
    function buildDecisionReview() {
      const relevant = state.history.filter((h) => h && decisionInfo(h.choice));
      const exact = relevant.filter((h) => typeof h.decisionMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(h.decisionMonth));
      return { version: 1, source: "recorded-user-actions-v1", missingDateCount: relevant.length - exact.length, entries: exact.map((h) => ({ month: h.decisionMonth, choice: h.choice })) };
    }
    function validDecisionReview(r) {
      const mon = (x) => typeof x === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
      return !!r && r.version === 1 && r.source === "recorded-user-actions-v1" && Number.isInteger(r.missingDateCount) && r.missingDateCount >= 0 && Array.isArray(r.entries) && r.entries.length <= 2e3 && r.entries.every((e) => e && mon(e.month) && decisionInfo(e.choice));
    }
    function decisionReviewHtml(record) {
      const r = record.decisionReview;
      if (!validDecisionReview(r)) return '<p class="note decision-review-missing">\uC8FC\uC694\uC120\uD0DD \uC5F0\uD45C \uADFC\uAC70 \uBBF8\uAE30\uB85D\xB7\uBBF8\uD655\uC778 - \uACFC\uAC70 \uC120\uD0DD\uC6D4\uC774\uB098 \uC790\uB3D9\uC774\uB825\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      const groups = ["\uC9C4\uB85C\xB7\uBCF5\uBB34\xB7\uC790\uAE08 \uD750\uB984", "\uAC00\uC0C1\uCCAD\uAD6C \uC120\uD0DD"];
      let html = '<details class="decision-review"><summary>\uC8FC\uC694\uC120\uD0DD \uC5F0\uD45C \xB7 \uB0A0\uC9DC\uAE30\uB85D ' + r.entries.length + '\uAC74</summary><p class="note">\uC2E4\uC81C \uBC84\uD2BC\uC744 \uD655\uC815\uD558\uAE30 \uC804 \uAC8C\uC784 \uC6D4\uC785\uB2C8\uB2E4. \uACFC\uAC70 history\uC758 \uC9C4\uD589 \uD6C4 \uC6D4\uC744 \uC120\uD0DD\uC6D4\uB85C \uBC14\uAFB8\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC18C\uAE09 \uAC00\uC815\uD55C \uC7AC\uD559\xB7\uBCF5\uBB34\xB7\uC790\uB3D9\uC878\uC5C5\uC740 \uC0AC\uC6A9\uC790\uAC00 \uACE0\uB978 \uC120\uD0DD\uC73C\uB85C \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB9E4\uB9E4 \uC2E0\uCCAD\uC740 \uCCB4\uACB0\uACFC \uB2E4\uB974\uBA70, \uB0A9\uBD80\uB294 \uC784\uC758 \uC2DC\uD5D8\uCCAD\uAD6C\uC785\uB2C8\uB2E4. \uC544\uB798 \uBC88\uD638\uB294 \uC774 \uC5F0\uD45C \uC548\uC758 \uC800\uC7A5 \uC21C\uC11C\uC785\uB2C8\uB2E4.</p>';
      if (r.missingDateCount) html += '<p class="note decision-review-partial">\uC120\uD0DD\uC6D4 \uADFC\uAC70\uAC00 \uC5C6\uB294 \uC774\uC804 \uC8FC\uC694\uD589\uB3D9 ' + r.missingDateCount + "\uAC74\uC740 \uC5F0\uD45C\uC5D0\uC11C \uC81C\uC678\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC6D4\uC744 \uAC70\uAFB8\uB85C \uCD94\uC815\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p>";
      if (!r.entries.length) html += '<p class="note">\uB0A0\uC9DC \uADFC\uAC70\uAC00 \uB0A8\uC740 \uC8FC\uC694\uC120\uD0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uACFC\uAC70\uB97C \uBCF4\uC644\uD574 \uB9CC\uB4E4\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      for (const group of groups) {
        const rows = r.entries.map((e, i) => ({ ...e, index: i + 1, info: decisionInfo(e.choice) })).filter((e) => group === "\uAC00\uC0C1\uCCAD\uAD6C \uC120\uD0DD" ? e.info.group === group : e.info.group !== "\uAC00\uC0C1\uCCAD\uAD6C \uC120\uD0DD");
        if (!rows.length) continue;
        html += '<details class="decision-group"><summary>' + esc(group) + " \xB7 " + rows.length + '\uAC74</summary><ol style="padding-left:22px;overflow-wrap:anywhere">' + rows.map((e) => '<li value="' + e.index + '"><strong>' + esc(e.month) + "</strong> \xB7 [" + esc(e.info.group) + "] " + esc(e.info.label) + "</li>").join("") + "</ol></details>";
      }
      return html + "</details>";
    }
    function activeDecisionComparisonHtml(lives, index) {
      const current = buildDecisionReview();
      let html = '<section class="active-decision-review" aria-label="\uC774\uBC88 \uD68C\uADC0\uC640 \uC9C0\uB09C \uD68C\uADC0 \uC120\uD0DD \uBCF5\uAE30"><h3>\uC774\uBC88 \uD68C\uADC0\uC640 \uC9C0\uB09C \uD68C\uADC0 \uC120\uD0DD \uBCF5\uAE30</h3><p class="note">\uD604\uC7AC \uAC8C\uC784 \uC6D4 ' + esc(state.month) + '\uAE4C\uC9C0 \uB0A0\uC9DC \uADFC\uAC70\uAC00 \uC788\uB294 \uC120\uD0DD\uC744 \uAC19\uC740 \uB2EC\uB07C\uB9AC \uB098\uB780\uD788 \uBD05\uB2C8\uB2E4. \uAC19\uC740 \uB2EC\uC774\uC5B4\uB3C4 \uC0DD\uB144\xB7\uC9C4\uB85C\xB7\uC9C4\uD589 \uC870\uAC74\uC740 \uB2E4\uB97C \uC218 \uC788\uACE0, \uACFC\uAC70 \uAE30\uB85D\uC758 \uC0DD\uB144 \uADFC\uAC70\uAC00 \uC5C6\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC120\uD0DD\uC774 \uC5C6\uB294 \uCE78\uC740 \uD589\uB3D9\uC774 \uC5C6\uC5C8\uB2E4\uB294 \uC99D\uAC70\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC218\uC775 \uD6A8\uACFC\xB7\uCD94\uCC9C\xB7\uD604\uC2E4 \uC9C4\uB85C\uC6B0\uC5F4\uC744 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC790\uB3D9\uC77C\uC815 \uD655\uC778\uC740 \uC0AC\uC6A9\uC790 \uC120\uD0DD\uACFC \uB530\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4.</p><div class="current-decision-review"><h4>\uC774\uBC88 \uD68C\uADC0 \xB7 \uC9C4\uD589 \uC911</h4>' + decisionReviewHtml({ decisionReview: current }).replace('class="decision-review"', 'class="live-decision-timeline"').replaceAll('class="decision-group"', 'class="live-decision-group"') + "</div>";
      if (!lives.length) return html + '<p class="note">\uBE44\uAD50\uD560 \uC9C0\uB09C \uD68C\uADC0\uAC00 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4. \uC774\uBC88 \uAE30\uB85D\uC740 \uC9C4\uD589 \uC911\uC778 \uC2E4\uC81C \uC120\uD0DD\uB9CC \uC77D\uC2B5\uB2C8\uB2E4.</p></section>';
      html += '<label for="decision-life-select">\uD568\uAED8 \uBCFC \uC9C0\uB09C \uD68C\uADC0</label> <select id="decision-life-select"><option value="">\uAE30\uB85D\uC744 \uACE0\uB974\uC138\uC694</option>' + lives.map((l, i) => '<option value="' + i + '" ' + (index === i ? "selected" : "") + ">#" + (i + 1) + " \xB7 " + esc(l.ended || "\uC885\uB8CC\uC6D4 \uBBF8\uAE30\uB85D") + "</option>").join("") + "</select>";
      if (index === null) return html + "</section>";
      html += '<p class="record-context-comparison">' + esc(ReturnRecordContext.compare(ReturnRecordContext.observe(state.recordContext, currentRecordIdentity), lives[index].recordContext).label) + "</p>";
      const past = lives[index].decisionReview;
      if (!validDecisionReview(past)) return html + '<p class="note active-decision-missing">\uACE0\uB978 \uC9C0\uB09C \uD68C\uADC0\uC758 \uC8FC\uC694\uC120\uD0DD \uC5F0\uD45C \uADFC\uAC70\uAC00 \uBBF8\uAE30\uB85D\xB7\uBBF8\uD655\uC778\uC785\uB2C8\uB2E4. \uC9C4\uD589 \uD6C4 \uC6D4\uB85C \uC120\uD0DD\uC6D4\uC744 \uCC44\uC6B0\uAC70\uB098 \uCC28\uC774\uB97C \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p></section>';
      const prior = past.entries.filter((e) => e.month <= state.month), now = current.entries.filter((e) => e.month <= state.month), months = [...new Set([...now, ...prior].map((e) => e.month))].sort();
      html += '<p class="note">#' + (index + 1) + " \uAE30\uB85D\uACFC \uBE44\uAD50 \xB7 \uC774\uBC88 " + now.length + "\uAC74 / \uC9C0\uB09C " + prior.length + "\uAC74. \uC9C0\uB09C \uD68C\uADC0\uC758 \uD604\uC7AC\uC6D4 \uB4A4 " + (past.entries.length - prior.length) + "\uAC74\uC740 \uC774 \uB098\uB780\uD788 \uBCF4\uAE30\uC5D0\uC11C \uC81C\uC678\uD569\uB2C8\uB2E4. \uC120\uD0DD\uC6D4 \uADFC\uAC70 \uB204\uB77D: \uC774\uBC88 " + current.missingDateCount + "\uAC74 / \uC9C0\uB09C " + past.missingDateCount + "\uAC74. \uAD6C\uAE30\uB85D\uC744 \uBCF4\uC644\uD558\uAC70\uB098 \uC800\uC7A5\uC744 \uACE0\uCCD0 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
      if (!months.length) html += '<p class="note">\uD604\uC7AC\uC6D4\uAE4C\uC9C0 \uB098\uB780\uD788 \uBCFC \uB0A0\uC9DC\uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
      const list = (entries) => entries.length ? "<ol>" + entries.map((e) => {
        const info = decisionInfo(e.choice);
        return "<li>[" + esc(info.group) + "] " + esc(info.label) + "</li>";
      }).join("") + "</ol>" : '<p class="note">\uC774 \uB2EC\uC758 \uC8FC\uC694\uC120\uD0DD \uB0A0\uC9DC\uAE30\uB85D \uC5C6\uC74C</p>';
      html += '<details class="decision-month-comparison"><summary>\uAC19\uC740 \uB2EC \uC120\uD0DD \uD3BC\uCE58\uAE30 \xB7 ' + months.length + "\uAC1C\uC6D4</summary>" + months.map((month) => '<section class="decision-month"><h4>' + esc(month) + '</h4><div class="decision-current"><strong>\uC774\uBC88 \uD68C\uADC0</strong>' + list(now.filter((e) => e.month === month)) + '</div><div class="decision-prior"><strong>\uC9C0\uB09C \uD68C\uADC0 #' + (index + 1) + "</strong>" + list(prior.filter((e) => e.month === month)) + "</div></section>").join("") + "</details></section>";
      return html;
    }
    function reflectionTrail(record, cutoff) {
      if (record && record.archiveDetail && record.archiveDetail.level === "summary") return { kind: "summary", points: [] };
      const a = record && record.assetTrail;
      if (!Array.isArray(a) || !a.length) return { kind: "missing", points: [] };
      if (a.length > 720 || a.some((p, i) => !p || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.m) || !Number.isFinite(p.a) || p.a < 0 || i > 0 && p.m <= a[i - 1].m)) return { kind: "invalid", points: [] };
      return { kind: "full", points: a.filter((p) => p.m <= cutoff) };
    }
    function reflectionGraph(points) {
      if (!points.length) return "";
      const idx = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1, first = idx(points[0].m), last = idx(points.at(-1).m), lo = Math.min(...points.map((p) => p.a)), hi = Math.max(...points.map((p) => p.a));
      const x = (p) => 8 + (idx(p.m) - first) / Math.max(1, last - first) * 284, y = (p) => hi === lo ? 35 : 64 - (p.a - lo) / (hi - lo) * 56;
      let paths = "", segment = [];
      points.forEach((p, i) => {
        if (i && idx(p.m) !== idx(points[i - 1].m) + 1) {
          if (segment.length > 1) paths += '<polyline points="' + segment.join(" ") + '" fill="none" stroke="#255d61" stroke-width="2"/>';
          segment = [];
        }
        segment.push(x(p).toFixed(2) + "," + y(p).toFixed(2));
      });
      if (segment.length > 1) paths += '<polyline points="' + segment.join(" ") + '" fill="none" stroke="#255d61" stroke-width="2"/>';
      return '<details class="active-reflection-trail"><summary>\uC774\uBC88 \uD68C\uADC0 \uC6D4\uBCC4 \uCD1D\uC790\uC0B0 \xB7 ' + points.length + '\uAC1C\uC6D4</summary><svg viewBox="0 0 300 72" width="100%" height="72" role="img" aria-label="\uC774\uBC88 \uD68C\uADC0 \uAE30\uB85D\uB41C \uC6D4\uBCC4 \uCD1D\uC790\uC0B0. \uBBF8\uAE30\uB85D \uC6D4\uC740 \uC120\uC744 \uC787\uC9C0 \uC54A\uC74C">' + paths + points.map((p) => '<circle cx="' + x(p).toFixed(2) + '" cy="' + y(p).toFixed(2) + '" r="1.8" fill="#255d61"/>').join("") + '</svg><p class="note">' + esc(points[0].m) + " ~ " + esc(points.at(-1).m) + " \xB7 \uAE30\uB85D \uC9C0\uC810 \uCD5C\uC800 " + lo.toLocaleString() + "\uC6D0 / \uCD5C\uACE0 " + hi.toLocaleString() + "\uC6D0. \uBBF8\uAE30\uB85D \uC6D4\uC740 \uC120\uC744 \uC787\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC22B\uC790\uB294 \uC544\uB798 \uC6D4 \uC120\uD0DD\uC5D0\uC11C \uD655\uC778\uD569\uB2C8\uB2E4.</p></details>";
    }
    function activeAssetReflectionHtml(lives, index, chosenMonth) {
      if (!SCHOOL_MODE || CASH_MODE) return "";
      const cutoff = state.month, active = reflectionTrail(state, cutoff), past = index === null ? null : reflectionTrail(lives[index], cutoff);
      const points = active.points, prior = past ? past.points : [], months = [...new Set([...points, ...prior].map((p) => p.m))].sort();
      const common = points.filter((p) => prior.some((q) => q.m === p.m));
      const month = months.includes(chosenMonth) ? chosenMonth : common.at(-1)?.m || months.at(-1) || null;
      let html = '<section class="active-asset-reflection" aria-label="\uC9C4\uD589 \uC911 \uC790\uC0B0\uACFC \uC120\uD0DD \uBCF5\uAE30"><h3>\uC9C4\uD589 \uC911 \uC790\uC0B0\uACFC \uC120\uD0DD \uBCF5\uAE30</h3><p class="note">\uC774\uBC88 \uD68C\uADC0\uC758 \uC2E4\uC81C \uC800\uC7A5\uB41C \uC6D4\uBCC4 \uCD1D\uC790\uC0B0\uB9CC \uBD05\uB2C8\uB2E4. \uAC19\uC740 \uB2EC\uC740 \uB9C8\uC9C0\uB9C9 \uC800\uC7A5\uAC12\uC774\uBA70 \uC6D4\uB9D0 \uC885\uAC00\xB7\uC77C\uBCC4 \uACBD\uB85C\uB098 \uC218\uC775\uB960\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uD604\uAE08\xB7\uBCF4\uC720 \uC2DC\uC5F0\uD3C9\uAC00\xB7\uBBF8\uCCB4\uACB0 \uC608\uC57D\uAE08\uC744 \uD3EC\uD568\uD569\uB2C8\uB2E4. \uD604\uC7AC \uAC8C\uC784 \uC6D4 ' + esc(cutoff) + " \uB4A4\uC758 \uC9C0\uB09C \uAE30\uB85D\uC740 \uC774 \uD328\uB110\uC5D0 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC5F4\uB78C\xB7\uC6D4 \uC120\uD0DD\uC740 \uC9C4\uD589\uACFC \uC800\uC7A5\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>";
      if (lives.length) html += '<label for="reflection-life-select">\uAC19\uC740 \uB2EC\uC5D0 \uBCFC \uC9C0\uB09C \uD68C\uADC0</label><select id="reflection-life-select"><option value="">\uC774\uBC88 \uD68C\uADC0\uB9CC \uBCF4\uAE30</option>' + lives.map((l, i) => '<option value="' + i + '" ' + (index === i ? "selected" : "") + ">#" + (i + 1) + " \xB7 " + esc(l.ended || "\uC885\uB8CC\uC6D4 \uBBF8\uAE30\uB85D") + "</option>").join("") + "</select>";
      if (active.kind === "invalid") html += '<p class="note reflection-invalid">\uD604\uC7AC \uADA4\uC801\uC758 \uC6D4 \uC21C\uC11C\xB7\uAE08\uC561\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uADF8\uB798\uD504\uC640 \uC6D4\uBCC4 \uAC12\uC744 \uC228\uACBC\uC2B5\uB2C8\uB2E4. \uC6D0\uAE30\uB85D\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</p>';
      else if (!points.length) html += '<p class="note reflection-missing">\uC774\uBC88 \uD68C\uADC0\uC5D0 \uC77D\uC744 \uC218 \uC788\uB294 \uC6D4\uBCC4 \uC790\uC0B0 \uAE30\uB85D\uC774 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4. \uACFC\uAC70 \uC6D4\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
      else html += reflectionGraph(points);
      if (index === null) html += '<p class="note">' + (lives.length ? "\uC9C0\uB09C \uD68C\uADC0\uB97C \uACE0\uB974\uBA74 \uAC19\uC740 \uB2EC\uC758 \uC800\uC7A5\uAC12\uACFC \uC8FC\uC694\uC120\uD0DD\uC744 \uB098\uB780\uD788 \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4." : "\uC544\uC9C1 \uC644\uB8CC\uD55C \uD68C\uADC0\uAC00 \uC5C6\uC5B4 \uC774\uBC88 \uAE30\uB85D\uB9CC \uBD05\uB2C8\uB2E4. \uD68C\uADC0\uB97C \uB9C8\uCE5C \uB4A4 \uC0C1\uC138\uAC00 \uB0A8\uC740 \uAE30\uB85D\uACFC \uAC19\uC740 \uB2EC\uC744 \uBE44\uAD50\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.") + "</p>";
      else {
        html += '<p class="record-context-comparison">\uC9C0\uB09C \uD68C\uADC0 #' + (index + 1) + " \xB7 " + esc(ReturnRecordContext.compare(ReturnRecordContext.observe(state.recordContext, currentRecordIdentity), lives[index].recordContext).label) + "</p>";
        if (past.kind === "summary") html += '<p class="note reflection-prior-summary">\uC774 \uC9C0\uB09C \uD68C\uADC0\uB294 \uC6D4\uBCC4 \uC0C1\uC138\uB97C \uC694\uC57D\uD574 \uD2B9\uC815 \uC6D4 \uC790\uC0B0 \uBE44\uAD50\xB7\uADF8\uB798\uD504\uB97C \uBCF5\uC6D0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uC694\uC120\uD0DD \uB0A0\uC9DC\uB294 \uC544\uB798\uC5D0\uC11C \uACC4\uC18D \uBE44\uAD50\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>';
        else if (past.kind === "invalid" || past.kind === "missing") html += '<p class="note reflection-prior-missing">\uC9C0\uB09C \uD68C\uADC0\uC758 \uC6D4\uBCC4 \uC0C1\uC138 \uADFC\uAC70\uAC00 \uC5C6\uAC70\uB098 \uD615\uC2DD\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC5C6\uB294 \uC6D4\uC740 \uACC4\uC0B0\uD558\uAC70\uB098 \uCC44\uC6B0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>';
        else html += '<p class="note">\uC9C0\uB09C \uD68C\uADC0\uB3C4 \uD604\uC7AC \uAC8C\uC784 \uC6D4\uAE4C\uC9C0 \uB0A8\uC544 \uC788\uB294 \uC9C0\uC810\uB9CC \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uAC19\uC740 \uB2EC\uC774\uC5B4\uB3C4 \uC800\uC7A5\uC77C\xB7\uC2DC\uC791\uC6D4\xB7\uC0DD\uB144\xB7\uC9C4\uB85C\xB7\uC2DC\uD5D8 \uC21C\uC800\uCD95\xB7\uC790\uB8CC\xB7\uADDC\uCE59\uC774 \uB2E4\uB97C \uC218 \uC788\uC5B4 \uAC19\uC740 \uC870\uAC74\uC758 \uC131\uACFC\uB098 \uC120\uD0DD\uC758 \uC218\uC775 \uD6A8\uACFC \uBE44\uAD50\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p>';
      }
      if (!month) return html + "</section>";
      html += '<label for="reflection-month-select">\uAE30\uB85D\uB41C \uB2EC \uC120\uD0DD</label><select id="reflection-month-select">' + months.map((m) => '<option value="' + m + '" ' + (m === month ? "selected" : "") + ">" + m + "</option>").join("") + '</select><div class="reflection-month-result" data-month="' + month + '"><h4>' + esc(month) + " \xB7 \uC800\uC7A5\uAC12\uACFC \uADF8 \uB2EC \uC8FC\uC694\uC120\uD0DD</h4>";
      const decisionList = (review, m) => validDecisionReview(review) ? review.entries.filter((e) => e.month === m).map((e) => "<li>" + esc(decisionInfo(e.choice).label) + "</li>").join("") : null;
      const column = (label, point, review) => {
        const ds = decisionList(review, month);
        return '<div class="reflection-month-column"><strong>' + label + '</strong><p class="reflection-month-assets">' + (point ? point.a.toLocaleString() + "\uC6D0" : "\uC774 \uB2EC \uC790\uC0B0 \uAE30\uB85D \uC5C6\uC74C") + "</p>" + (ds === null ? '<p class="note">\uC8FC\uC694\uC120\uD0DD \uB0A0\uC9DC \uADFC\uAC70 \uBBF8\uD655\uC778</p>' : ds ? "<ul>" + ds + "</ul>" : '<p class="note">\uC774 \uB2EC\uC758 \uC8FC\uC694\uC120\uD0DD \uB0A0\uC9DC\uAE30\uB85D \uC5C6\uC74C</p>') + "</div>";
      };
      html += '<div class="reflection-month-grid">' + column("\uC774\uBC88 \uD68C\uADC0", points.find((p) => p.m === month), buildDecisionReview()) + (index === null ? "" : column("\uC9C0\uB09C \uD68C\uADC0 #" + (index + 1), prior.find((p) => p.m === month), lives[index].decisionReview)) + '</div><p class="note">\uAE30\uB85D \uC5C6\uC74C\uC740 0\uC6D0\uC774\uB098 \uD589\uB3D9 \uC5C6\uC74C\uC758 \uC99D\uAC70\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uAC19\uC740 \uB2EC\uC5D0 \uD568\uAED8 \uB098\uD0C0\uB09C \uBCC0\uD654\uC640 \uC120\uD0DD \uC0AC\uC774 \uC778\uACFC\xB7\uD22C\uC790 \uC6B0\uC5F4\uC744 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p></div></section>';
      return html;
    }
    function newCashRecord(l) {
      return !!(l.careerCashSummary && Object.hasOwn(l.careerCashSummary, "assetReview"));
    }
    function careerRecordMonthsValid(l) {
      const c = l.careerCashSummary;
      if (!c || !Number.isInteger(c.months) || c.months < 0) return false;
      if (Object.hasOwn(c, "assetReview")) return validCashFlowReview(c.assetReview, l.totalAssets) && c.months === c.assetReview.months;
      const mon = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
      const start = l.schoolStart?.startMonth, end = l.ended;
      if (mon(start) && mon(end)) return c.months <= Math.max(0, monthsBetween(start, end > GAME_END ? GAME_END : end));
      return c.months <= 400;
    }
    function cashRecordScore(l) {
      const c = l.careerCashSummary, r = c?.assetReview;
      if (!newCashRecord(l) || !r || r.available !== true || r.basis !== "career-cash-review-v1" || ![l.totalAssets, c.income, c.paid, c.unpaid, r.gross, r.net, r.income, r.paid, r.unpaid, r.billed].every(Number.isFinite) || c.income < 0 || c.paid < 0 || c.unpaid < 0 || !careerRecordMonthsValid(l) || r.months !== c.months || r.gross !== l.totalAssets || r.income !== c.income || r.paid !== c.paid || r.unpaid !== c.unpaid || r.unpaid !== r.billed - r.paid || Math.abs(r.net - r.gross + r.unpaid) > 0.01) return null;
      return r.net;
    }
    function renderDashboard(selected = [], decisionIndex = null, reflectionMonth = null) {
      vnChapterClear();
      if (storageWriteBlocked) return showStorageWriteUnavailable();
      if (storageReadBlocked) return showStorageReadUnavailable();
      const card = document.getElementById("turn-card");
      const box = document.getElementById("choices");
      box.innerHTML = "";
      const lives = readLives();
      if (!lives) return;
      const causeLabel = { chaos: "\uC5ED\uC0AC \uBCC0\uACBD(\uCE74\uC624\uC2A4 \uD55C\uACC4)", "demo-end": "\uC2DC\uC81C\uD488 \uAD6C\uAC04 \uC885\uB8CC", "natural-end": "\uC778\uC0DD \uACB0\uC0B0(\uC804\uCCB4 \uAD6C\uAC04 \uC885\uB8CC)", "voluntary-end": "\uC120\uD0DD\uC73C\uB85C \uC911\uB3C4 \uB9C8\uCE68(\uACB0\uC0B0 \uC804 \uC885\uB8CC)", "living-fail": "\uAC8C\uC784 \uC0DD\uD65C\uACBD\uC81C \uC2DC\uD5D8 \uC2E4\uD328(\uC0DD\uD65C\uBE44 \uD604\uAE08 \uBD80\uC871)" };
      const careerMechanicsRecordHtml = (l) => {
        if (CASH_MODE) return "";
        const c = l.careerMechanics;
        if (!c) return '<p class="note career-mechanics-missing">\uC9C4\uB85C \uC804\uC6A9 \uADDC\uCE59 \uCCB4\uACB0 \uC2E4\uC801 \uAD6C\uBD84 \uAE30\uB85D \uC5C6\uC74C(\uAE30\uB85D \uBC84\uC804 \uB3C4\uC785 \uC804 \uD68C\uADC0).</p>';
        const line = careerMechanicsLine(c);
        return '<p class="note career-mechanics-record">' + esc(line || "\uC9C4\uB85C \uC804\uC6A9 \uADDC\uCE59 \uC2E4\uC801 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.") + "</p>";
      };
      const careerRecordHtml = (l) => {
        const c = l.careerCashSummary;
        if (!c) return "";
        if (!["income", "paid", "unpaid"].every((k) => Number.isFinite(c[k]) && c[k] >= 0) || !careerRecordMonthsValid(l) || !Number.isFinite(l.totalAssets)) return '<p class="note">\uC6D4 \uD604\uAE08\uC0AC\uAC74 \uC694\uC57D \uADFC\uAC70 \uBBF8\uD655\uC778 - \uACFC\uAC70 \uAE08\uC561\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC544\uC694.</p>';
        return '<p class="cash-record-summary note">\uC6D4 \uD604\uAE08\uC0AC\uAC74 [\uC124\uACC4\uAC12] ' + c.months + "\uAC1C\uC6D4 / \uC218\uC785 +" + c.income.toLocaleString() + "\uC6D0 / \uB0A9\uBD80 -" + c.paid.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9 " + c.unpaid.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9\uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0 " + (l.totalAssets - c.unpaid).toLocaleString() + "\uC6D0. \uCD1D\uC790\uC0B0 \uBE44\uAD50\uB294 \uBBF8\uB0A9 \uCC28\uAC10 \uC804\uC774\uBA70 \uD604\uC2E4 \uC9C4\uB85C\uC6B0\uC5F4\uC774 \uC544\uB2C8\uC5D0\uC694.</p>";
      };
      const cashRecordHtml = (l) => {
        const c = l.cashFlowSummary;
        if (!CASH_MODE) return "";
        if (!c || !["income", "paid", "unpaid"].every((k) => Number.isFinite(c[k]) && c[k] >= 0) || !Number.isInteger(c.months) || c.months < 0 || c.months > (SCHOOL_CASH_MODE && l.schoolStart ? (2026 - Number(l.schoolStart.startMonth.slice(0, 4))) * 12 + 10 - Number(l.schoolStart.startMonth.slice(5)) : 367) || !Number.isFinite(l.totalAssets)) return '<p class="note">\uD604\uAE08\uC0AC\uAC74 \uC694\uC57D \uADFC\uAC70 \uBBF8\uD655\uC778 - \uACFC\uAC70 \uAE08\uC561\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC544\uC694.</p>';
        return '<p class="cash-record-summary note">\uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 ' + c.months + "\uAC1C\uC6D4 / \uC218\uC785 +" + c.income.toLocaleString() + "\uC6D0 / \uB0A9\uBD80 -" + c.paid.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9 " + c.unpaid.toLocaleString() + "\uC6D0 / \uBBF8\uB0A9\uCC28\uAC10 \uC2DC\uC5F0\uC21C\uC790\uC0B0 " + (l.totalAssets - c.unpaid).toLocaleString() + "\uC6D0." + (Number.isInteger(c.automaticPaidMonths) && c.automaticPaidMonths >= 0 && c.automaticPaidMonths <= c.months ? " \uC790\uB3D9\uB0A9\uBD80 \uAE30\uB85D " + c.automaticPaidMonths + "\uAC1C\uC6D4." : " \uC790\uB3D9\uB0A9\uBD80 \uBD84\uB9AC\uADFC\uAC70 \uBBF8\uAE30\uB85D.") + " \uCD1D\uC790\uC0B0 \uBE44\uAD50\uB294 \uBBF8\uB0A9 \uCC28\uAC10 \uC804\uC774\uBA70 \uD604\uC2E4 \uC9C4\uB85C\uC6B0\uC5F4\uC774 \uC544\uB2C8\uC5D0\uC694.</p>";
      };
      const pathLabel = {
        "study": "\uC9C4\uD559 \uC900\uBE44(\uD559\uC0DD)",
        "parttime": "\uC54C\uBC14\uB85C \uC885\uC7A3\uB3C8 \uB9C8\uB828 \uC911",
        "study-job": "\uC9C4\uD559 \uD6C4 \uCDE8\uC5C5",
        "study-fulltime": "\uC9C4\uD559 \uD6C4 \uC804\uC5C5\uD22C\uC790",
        "parttime-fulltime": "\uC54C\uBC14 \uD6C4 \uC804\uC5C5\uD22C\uC790"
      };
      selected = selected.filter((i, n, arr) => Number.isInteger(i) && i >= 0 && i < lives.length && arr.indexOf(i) === n).slice(0, 2);
      decisionIndex = Number.isInteger(decisionIndex) && decisionIndex >= 0 && decisionIndex < lives.length ? decisionIndex : null;
      if (SCHOOL_MODE && !state.flags.birth) document.getElementById("footnote").textContent = "\uC0C8 \uD68C\uADC0 \uC2DC\uC791 \uC804 \xB7 \uBCF4\uAD00 \uAE30\uB85D \uC5F4\uB78C \xB7 \uC5ED\uC0AC/\uACBD\uC81C \uACE0\uC99D \uBBF8\uC644\uC131";
      const activeReviewHtml = SCHOOL_MODE && !state.flags.birth ? '<section class="dashboard-no-active" aria-label="\uC0C8 \uD68C\uADC0 \uC2DC\uC791 \uC804"><h3>\uC544\uC9C1 \uC0C8 \uD68C\uADC0\uB97C \uC2DC\uC791\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4</h3><p>\uC544\uB798 \uBCF4\uAD00 \uAE30\uB85D\uC744 \uC77D\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB3CC\uC544\uAC00\uAE30\uC5D0\uC11C \uC0DD\uB144\uC6D4\uACFC \uADDC\uCE59\uC5D0 \uB3D9\uC758\uD55C \uB4A4 \uC0C8 \uD68C\uADC0\uB97C \uC2DC\uC791\uD569\uB2C8\uB2E4. \uC9C0\uB09C \uC790\uC0B0\xB7\uBBF8\uB0A9\xB7\uC8FC\uBB38\uC744 \uC774\uC5B4\uBC1B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p></section>' : activeAssetReflectionHtml(lives, decisionIndex, reflectionMonth) + activeDecisionComparisonHtml(lives, decisionIndex);
      let html = '<div class="date">\uD68C\uADC0 \uAE30\uB85D</div><h2>\uD68C\uADC0 \uB300\uC2DC\uBCF4\uB4DC</h2>' + activeReviewHtml;
      if (lives.length > 1 && !CASH_MODE) {
        html += '<section class="life-comparison" aria-label="\uC120\uD0DD\uD55C \uB450 \uAE30\uB85D \uBE44\uAD50"><h3>\uB0B4\uAC00 \uACE0\uB978 \uB450 \uAE30\uB85D</h3><p>\uC544\uB798\uC5D0\uC11C \uB450 \uAE30\uB85D\uC744 \uACE8\uB77C \uAC01 \uAE30\uB85D\uC758 \uC790\uAE08 \uD750\uB984\uC744 \uD568\uAED8 \uBCF4\uC138\uC694. \uC120\uD0DD\uC740 \uC774 \uD654\uBA74\uC5D0\uC11C\uB9CC \uC720\uC9C0\uB418\uBA70 \uC6D0\uBCF8 \uAE30\uB85D\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uC544\uC694.</p>';
        html += '<p id="life-selection-status">' + selected.map((i) => "#" + (i + 1)).join(" / ") + " \xB7 " + selected.length + "/2\uAC1C \uC120\uD0DD</p>";
        if (selected.length === 2) {
          const [a, b] = selected.map((i) => lives[i]), cashPair = newCashRecord(a) && newCashRecord(b), mixedCash = newCashRecord(a) !== newCashRecord(b), c = ReturnAssetReview.compareSnapshots(a.assetReview, a.totalAssets, b.assetReview, b.totalAssets);
          selected.forEach((index, n) => {
            const l = lives[index], r = n === 0 ? c.left : c.right;
            html += '<div class="selected-life"><h4>' + (n + 1) + "\uBC88\uC9F8 \xB7 #" + (index + 1) + " \xB7 " + esc(pathLabel[l.path] || "\uC9C4\uB85C \uBBF8\uAE30\uB85D") + "</h4><p>" + esc(l.ended || "\uC885\uB8CC\uC6D4 \uBBF8\uAE30\uB85D") + " \uC885\uB8CC / \uAD00\uCE21 " + esc(l.observationMonth || "\uBBF8\uAE30\uB85D") + "</p>" + (newCashRecord(l) ? cashFlowReviewHtml(l.careerCashSummary.assetReview, true, l.totalAssets) : assetReviewHtml(r, true)) + "</div>";
          });
          html += '<p class="record-context-comparison">' + esc(ReturnRecordContext.compare(a.recordContext, b.recordContext).label) + "</p>";
          if (cashPair) {
            const left = a.careerCashSummary.assetReview, right = b.careerCashSummary.assetReview;
            if (validCashFlowReview(left, a.totalAssets) && validCashFlowReview(right, b.totalAssets) && cashRecordScore(a) !== null && cashRecordScore(b) !== null) {
              const money = (n) => (n > 0 ? "+" : "") + (Object.is(n, -0) ? 0 : n).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "\uC6D0";
              html += '<div class="life-difference cash-life-difference"><h4>\uB450 \uBC88\uC9F8 - \uCCAB \uBC88\uC9F8 \uD604\uAE08\uC0AC\uAC74 \uAE30\uB85D</h4>' + (left.startMonth !== right.startMonth || left.endMonth !== right.endMonth ? '<p class="note">\uB450 \uAE30\uB85D\uC758 \uC9C4\uD589 \uAD6C\uAC04\uC774 \uB2E4\uB985\uB2C8\uB2E4(\uCCAB \uBC88\uC9F8 ' + esc(left.startMonth) + " ~ " + esc(left.endMonth) + " / \uB450 \uBC88\uC9F8 " + esc(right.startMonth) + " ~ " + esc(right.endMonth) + "). \uAC19\uC740 \uC870\uAC74\uC758 \uBE44\uAD50\uAC00 \uC544\uB2D9\uB2C8\uB2E4.</p>" : "") + '<div class="row"><span>\uAE30\uB85D \uAC1C\uC6D4 \uCC28\uC774</span><strong>' + (right.months - left.months) + "\uAC1C\uC6D4</strong></div>" + [["\uC2DC\uC791\uC790\uAE08 \uCC28\uC774", "openingAssets"], ["\uAE30\uB85D \uC218\uC785 \uCC28\uC774", "income"], ["\uC2E4\uC81C \uB0A9\uBD80\uC561 \uCC28\uC774", "paid"], ["\uC0C1\uD488 \uBCC0\uD654 \uB4F1 \uC794\uCC28 \uCC28\uC774", "remainder"], ["\uCD1D\uC790\uC0B0 \uCC28\uC774 \xB7 \uBBF8\uB0A9 \uCC28\uAC10 \uC804", "gross"], ["\uCCAD\uAD6C \uB204\uACC4 \uCC28\uC774", "billed"], ["\uB0A8\uC740 \uBBF8\uB0A9 \uCC28\uC774", "unpaid"], ["\uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0 \uCC28\uC774", "net"]].map(([label, key]) => '<div class="row"><span>' + label + "</span><strong>" + money(right[key] - left[key]) + "</strong></div>").join("") + '<p class="note">\uC800\uC7A5\uB41C \uAC8C\uC784 \uD604\uAE08\uC0AC\uAC74\uC758 \uB2E8\uC21C \uCC28\uC774\uC785\uB2C8\uB2E4. \uB0A9\uBD80\uC561\xB7\uBBF8\uB0A9 \uCC28\uC774\uC758 \uC591\uC218\uB294 \uB450 \uBC88\uC9F8 \uAE30\uB85D\uC758 \uAE08\uC561\uC774 \uB354 \uD06C\uB2E4\uB294 \uB73B\uC774\uBA70 \uC774\uC775\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC794\uCC28\uB294 \uC218\uC775\uB960\uC774 \uC544\uB2C8\uBA70, \uAE30\uAC04\xB7\uC0DD\uB144\xB7\uC9C4\uB85C\xB7\uC120\uD0DD\xB7\uC790\uB8CC\uAC00 \uB2E4\uB974\uBA74 \uAC19\uC740 \uC870\uAC74\uC758 \uBE44\uAD50\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uD22C\uC790 \uC2E4\uB825\xB7\uC120\uD0DD\uC758 \uC778\uACFC\xB7\uD604\uC2E4 \uC9C4\uB85C\uC6B0\uC5F4\uC744 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p></div>';
            } else html += '<p class="note comparison-unavailable">\uD604\uAE08\uC0AC\uAC74 \uBD84\uD574 \uADFC\uAC70\uAC00 \uC628\uC804\uD55C \uB450 \uAE30\uB85D\uC774 \uC544\uB2C8\uC5B4\uC11C \uCC28\uC774\uB97C \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694. \uBE60\uC9C4 \uC218\uC785\xB7\uB0A9\uBD80\xB7\uBBF8\uB0A9\uC744 \uCD94\uC815\uD558\uAC70\uB098 \uAE30\uB85D\uC744 \uACE0\uCCD0 \uC4F0\uC9C0 \uC54A\uC544\uC694.</p>';
          } else if (mixedCash) html += '<p class="note comparison-unavailable mixed-cash-comparison">\uD604\uAE08\uC0AC\uAC74\uACFC \uC774\uC804 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC740 \uC11C\uB85C \uB2E4\uB978 \uBAA8\uD615\uC774\uC5B4\uC11C \uAE08\uC561 \uCC28\uC774\uB97C \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAC01 \uAE30\uB85D\uC758 \uC790\uAE08 \uD750\uB984\uC744 \uB530\uB85C \uC77D\uACE0, \uC5C6\uB294 \uACFC\uAC70 \uC218\uC785\xB7\uBBF8\uB0A9\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uC544\uC694.</p>';
          else if (c.available) {
            const money = (n) => (n > 0 ? "+" : "") + n.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "\uC6D0";
            html += '<div class="life-difference"><h4>\uB450 \uBC88\uC9F8 - \uCCAB \uBC88\uC9F8 \uAE30\uB85D</h4>' + (c.left.startMonth !== c.right.startMonth ? '<p class="note">\uB450 \uAE30\uB85D\uC758 \uC2DC\uC791\uC6D4\uC774 \uB2E4\uB985\uB2C8\uB2E4(\uCCAB \uBC88\uC9F8 ' + esc(c.left.startMonth) + " / \uB450 \uBC88\uC9F8 " + esc(c.right.startMonth) + "). \uC9C4\uD589 \uAD6C\uAC04\uC774 \uB2EC\uB77C \uAC19\uC740 \uC870\uAC74\uC758 \uBE44\uAD50\uAC00 \uC544\uB2C8\uC5D0\uC694. \uAC1C\uC6D4 \uCC28\uC774\uAC00 0\uC774\uC5B4\uB3C4 \uAE30\uAC04\uC774 \uB2E4\uB985\uB2C8\uB2E4.</p>" : "") + '<div class="row"><span>\uAE30\uB85D \uAC1C\uC6D4 \uCC28\uC774</span><strong>' + c.differences.months + "\uAC1C\uC6D4</strong></div>" + [["\uC2DC\uC791\uC790\uAE08 \uCC28\uC774", "openingAssets"], ["\uC2DC\uD5D8 \uC21C\uC800\uCD95 \uCC28\uC774", "recordedSavings"], ["\uC0C1\uD488 \uBCC0\uD654 \uB4F1 \uC794\uCC28 \uCC28\uC774", "assetChangeRemainder"], ["\uCD1D\uC790\uC0B0 \uCC28\uC774", "totalAssets"]].map(([label, key]) => '<div class="row"><span>' + label + "</span><strong>" + money(c.differences[key]) + "</strong></div>").join("") + '<p class="note">\uAE08\uC561\uC758 \uBD84\uD574 \uCC28\uC774\uC77C \uBFD0 \uC218\uC775\uB960\xB7\uD22C\uC790 \uC2E4\uB825\xB7\uD604\uC2E4 \uC9C4\uB85C\uC758 \uC6B0\uC5F4\uC774 \uC544\uB2C8\uC5D0\uC694. \uAC19\uC740 \uAC1C\uC6D4\uC774\uC5B4\uB3C4 \uC9C4\uB85C\xB7\uC2DC\uD5D8 \uC21C\uC800\uCD95\xB7\uC120\uD0DD\uC774 \uB2EC\uB77C \uC870\uAC74\uC744 \uD1B5\uC81C\uD55C \uBE44\uAD50\uAC00 \uC544\uB2C8\uC5D0\uC694.</p></div>';
          } else html += '<p class="note comparison-unavailable">\uBD84\uD574 \uADFC\uAC70\uAC00 \uC628\uC804\uD55C \uB450 \uAE30\uB85D\uC774 \uC544\uB2C8\uC5B4\uC11C \uCC28\uC774\uB97C \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694. \uBE60\uC9C4 \uACFC\uAC70\uB97C \uCD94\uCE21\uD558\uAC70\uB098 \uC6D0\uBCF8 \uAE30\uB85D\uC744 \uACE0\uCCD0 \uC4F0\uC9C0 \uC54A\uC544\uC694.</p>';
        }
        html += '<button type="button" id="life-selection-clear" ' + (!selected.length ? "disabled" : "") + ">\uBE44\uAD50 \uC120\uD0DD \uD574\uC81C</button></section>";
      }
      if (!lives.length) {
        html += "<p>\uC544\uC9C1 \uB2EB\uD78C \uC778\uC0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uCCAB \uD68C\uADC0\uC758 \uAE30\uB85D\uC774 \uC5EC\uAE30\uC5D0 \uB0A8\uC2B5\uB2C8\uB2E4.</p>";
      } else {
        const cashRecords = lives.filter(newCashRecord), legacyRecords = lives.filter((l) => !newCashRecord(l));
        const best = legacyRecords.reduce((a, b) => !a || b.totalAssets > a.totalAssets ? b : a, null);
        const rankedCash = cashRecords.filter((l) => cashRecordScore(l) !== null), cashBest = rankedCash.reduce((a, b) => !a || cashRecordScore(b) > cashRecordScore(a) ? b : a, null);
        lives.forEach((l, i) => {
          const pathTxt = l.path && pathLabel[l.path] ? pathLabel[l.path] : "\uC9C4\uB85C \uBBF8\uAE30\uB85D";
          html += '<div style="border-bottom:1px solid var(--line);padding:8px 0"><div class="row"><span>#' + (i + 1) + " \xB7 " + l.ended + " \uC885\uB8CC</span><span>" + (causeLabel[l.cause] || l.cause || "\uAE30\uB85D \uC5C6\uC74C") + '</span></div><div class="row life-record-assets"><span>' + pathTxt + "</span><strong>\uCD5C\uC885 \uC790\uC0B0 " + (l.totalAssets || 0).toLocaleString() + "\uC6D0" + (l === best && !CASH_MODE ? cashRecords.length ? " \xB7 \uC774\uC804 \uADDC\uCE59 \uCD1D\uC790\uC0B0 \uCD5C\uACE0" : " \xB7 \uCD5C\uACE0 \uAE30\uB85D" : "") + "</strong></div>" + (newCashRecord(l) ? '<div class="row cash-record-score"><span>\uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0</span><strong>' + (cashRecordScore(l) === null ? "\uAE30\uB85D \uD655\uC778 \uD544\uC694" : cashRecordScore(l).toLocaleString() + "\uC6D0" + (l === cashBest ? " \xB7 \uD604\uAE08\uC0AC\uAC74 \uAE30\uB85D \uC21C\uC790\uC0B0 \uCD5C\uACE0" : "")) + "</strong></div>" : "") + cashRecordHtml(l) + careerRecordHtml(l) + careerMechanicsRecordHtml(l) + assetTrailHtml(l) + recordContextHtml(l.recordContext) + decisionReviewHtml(l) + (CASH_MODE ? "" : l.careerCashSummary?.assetReview ? cashFlowReviewHtml(l.careerCashSummary.assetReview, true, l.totalAssets) : assetReviewHtml(ReturnAssetReview.inspectSnapshot(l.assetReview, l.totalAssets), true)) + (lives.length > 1 && !CASH_MODE ? '<button type="button" class="life-select" data-life-index="' + i + '" aria-pressed="' + selected.includes(i) + '" ' + (!selected.includes(i) && selected.length === 2 ? "disabled" : "") + ">" + (selected.includes(i) ? "#" + (i + 1) + " \uBE44\uAD50\uC5D0\uC11C \uBE7C\uAE30" : "#" + (i + 1) + " \uBE44\uAD50\uC5D0 \uB123\uAE30") + "</button>" : "") + "</div>";
        });
        html += CASH_MODE ? '<p class="note">\uBCC4\uB3C4 \uD604\uAE08\uC0AC\uAC74 \uC2DC\uD5D8 \uD68C\uADC0\uAE30\uB85D\uC785\uB2C8\uB2E4. \uCD1D\uC790\uC0B0\uC740 \uBBF8\uB0A9 \uCC28\uAC10 \uC804\uC785\uB2C8\uB2E4. \uAC01 \uAE30\uB85D\uC758 \uC218\uC785\xB7\uB0A9\uBD80\xB7\uBBF8\uB0A9\xB7\uC2DC\uC5F0\uC21C\uC790\uC0B0\uC744 \uD568\uAED8 \uC77D\uACE0 \uC2E4\uC81C \uC9C4\uB85C\uC6B0\uC5F4\xB7\uD22C\uC790\uC2E4\uB825\xB7\uC218\uC775\uB960 \uC21C\uC704\uB85C \uD574\uC11D\uD558\uC9C0 \uB9C8\uC138\uC694. \uC6D0\uB798 \uC2DC\uD5D8\uC21C\uC800\uCD95 \uBAA8\uD615\uC758 \uAE30\uB85D\uACFC \uD569\uCE58\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC774 \uAE30\uAE30\uC5D0\uB9CC \uC800\uC7A5\uB429\uB2C8\uB2E4.</p>' : '<p class="note">\uCD5C\uACE0 \uAE30\uB85D\uC740 \uC2DC\uC5F0 \uCD1D\uC790\uC0B0 \uAE30\uC900\uC774\uBA70 \uD22C\uC790 \uC2E4\uB825\xB7\uC218\uC775\uB960 \uC21C\uC704\uAC00 \uC544\uB2C8\uC5D0\uC694. \uC9C4\uD589 \uAC1C\uC6D4\uACFC \uC9C4\uB85C\uC758 \uC2DC\uD5D8 \uC21C\uC800\uCD95\uC774 \uB2E4\uB974\uBA74 \uB2E8\uC21C \uBE44\uAD50\uD560 \uC218 \uC5C6\uC5B4\uC694. \uC2E4\uC81C \uD559\uBE44\xB7\uC0DD\uD65C\uBE44\xB7\uC138\uAE08\uC740 \uBBF8\uC5F0\uACB0\uC774\uC5D0\uC694.</p><p class="note">\uACE0\uC815 \uBAA9\uD45C \uC790\uC0B0\uC740 \uC5C6\uC2B5\uB2C8\uB2E4. \uCD5C\uACE0 \uAE30\uB85D \uAC31\uC2E0\uC774 \uC774 \uAC8C\uC784\uC758 \uC7A5\uAE30 \uBAA9\uD45C\uC608\uC694. \uAE30\uB85D\uC740 \uC774 \uAE30\uAE30\uC5D0\uB9CC \uC800\uC7A5\uB429\uB2C8\uB2E4.</p>';
      }
      if (lives.some(newCashRecord)) {
        html = html.replace("\uCD5C\uACE0 \uAE30\uB85D\uC740 \uC2DC\uC5F0 \uCD1D\uC790\uC0B0 \uAE30\uC900\uC774\uBA70 \uD22C\uC790 \uC2E4\uB825\xB7\uC218\uC775\uB960 \uC21C\uC704\uAC00 \uC544\uB2C8\uC5D0\uC694.", "\uC774\uC804 \uADDC\uCE59\uC758 \uCD5C\uACE0 \uAE30\uB85D\uC740 \uC2DC\uC5F0 \uCD1D\uC790\uC0B0 \uAE30\uC900\uC785\uB2C8\uB2E4. \uC0C8 \uD604\uAE08\uC0AC\uAC74 \uAE30\uB85D\uC740 \uBBF8\uB0A9 \uCC28\uAC10 \uD6C4 \uC21C\uC790\uC0B0 \uCD5C\uACE0\uB97C \uB530\uB85C \uD45C\uC2DC\uD558\uBA70 \uD22C\uC790 \uC2E4\uB825\xB7\uC218\uC775\uB960 \uC21C\uC704\uAC00 \uC544\uB2C8\uC5D0\uC694.");
        html += '<p class="note cash-score-boundary">\uC0C8 \uD604\uAE08\uC0AC\uAC74 \uAE30\uB85D\uC758 \uCD5C\uACE0 \uD45C\uC2DC\uB294 \uBBF8\uB0A9\uC744 \uBE80 \uC21C\uC790\uC0B0 \uAE30\uC900\uC774\uBA70, \uC774\uC804 \uADDC\uCE59\uC758 \uCD1D\uC790\uC0B0 \uCD5C\uACE0\uC640 \uB530\uB85C \uC9D1\uACC4\uD569\uB2C8\uB2E4. \uBAA8\uD615\xB7\uAE30\uAC04\xB7\uC9C4\uB85C\uAC00 \uB2E4\uB974\uBA74 \uAC19\uC740 \uC870\uAC74\uC758 \uC21C\uC704\uAC00 \uC544\uB2C8\uBA70 \uD22C\uC790 \uC2E4\uB825\xB7\uC218\uC775\uB960\xB7\uD604\uC2E4 \uC9C4\uB85C\uC758 \uC6B0\uC5F4\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAD6C\uAE30\uB85D\uC5D0 \uC5C6\uB294 \uBBF8\uB0A9\xB7\uD604\uAE08\uD750\uB984\uC740 \uCD94\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uBBF8\uB0A9 \uCC28\uAC10 \uC21C\uC790\uC0B0 \uADFC\uAC70\uAC00 \uBD88\uC644\uC804\uD55C \uAE30\uB85D\uC740 \uCD5C\uACE0 \uC9D1\uACC4\uC5D0\uC11C \uC81C\uC678\uD569\uB2C8\uB2E4.</p>';
      }
      card.innerHTML = html;
      card.querySelectorAll(".life-select").forEach((button) => {
        button.onclick = () => {
          const i = Number(button.dataset.lifeIndex);
          renderDashboard(selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i], decisionIndex, reflectionMonth);
          document.querySelector('.life-select[data-life-index="' + i + '"]')?.focus();
        };
      });
      const clear = card.querySelector("#life-selection-clear");
      if (clear) clear.onclick = () => {
        renderDashboard([], decisionIndex, reflectionMonth);
        document.querySelector(".life-select")?.focus();
      };
      const reflectionLifeSelect = card.querySelector("#reflection-life-select");
      if (reflectionLifeSelect) reflectionLifeSelect.onchange = () => {
        renderDashboard(selected, reflectionLifeSelect.value === "" ? null : Number(reflectionLifeSelect.value));
        document.getElementById("reflection-life-select")?.focus();
      };
      const reflectionSelect = card.querySelector("#reflection-month-select");
      if (reflectionSelect) reflectionSelect.onchange = () => {
        renderDashboard(selected, decisionIndex, reflectionSelect.value);
        document.getElementById("reflection-month-select")?.focus();
      };
      const decisionSelect = card.querySelector("#decision-life-select");
      if (decisionSelect) decisionSelect.onchange = () => {
        const value = decisionSelect.value;
        renderDashboard(selected, value === "" ? null : Number(value));
        document.getElementById("decision-life-select")?.focus();
      };
      const back = document.createElement("button");
      back.textContent = "\uB3CC\uC544\uAC00\uAE30";
      back.onclick = () => !state.flags.birth && SCHOOL_MODE ? renderBirthSelect() : render();
      box.appendChild(back);
    }
    function pastLibraryNews() {
      const start = state.schoolStart && state.schoolStart.startMonth;
      if (!SCHOOL_MODE || CASH_MODE || !/^\d{4}-\d{2}$/.test(start || "") || !Number.isInteger(state.eventIndex)) return [];
      return DATA.events.slice(0, state.eventIndex).filter((ev) => ev.kind === "news" && ev.date.slice(0, 7) >= start && ev.date.slice(0, 7) <= state.month && !(ev.requires_rules === "core-v4" && !(state.coreRules >= 4)));
    }
    function openNewsLibrary() {
      if (storageReadBlocked || storageWriteBlocked || multiTabConflict || document.getElementById("news-library")) return;
      const origin = document.activeElement, events = pastLibraryNews().slice().reverse(), dialog = document.createElement("dialog");
      dialog.id = "news-library";
      dialog.setAttribute("aria-labelledby", "news-library-title");
      dialog.style.cssText = "box-sizing:border-box;width:calc(100vw - 24px);max-width:640px;max-height:88dvh;margin:auto;overflow:auto;border:1px solid #cfc7be;border-radius:14px;padding:18px;background:#fffdf9;color:#24201d;";
      dialog.innerHTML = '<h2 id="news-library-title">\uC9C0\uB098\uAC04 \uAC8C\uC784\uB274\uC2A4</h2><p>\uC774\uBC88 \uD68C\uADC0\uC758 \uC2DC\uC791\uC6D4\uBD80\uD130 \uC774\uBBF8 \uC9C0\uB098\uAC04 \uCE74\uB4DC\uB9CC \uBD05\uB2C8\uB2E4. \uC9C1\uC811 \uC77D\uC5C8\uAC70\uB098 \uD22C\uC790\uD310\uB2E8\uC744 \uD588\uB2E4\uB294 \uAE30\uB85D\uC740 \uC544\uB2C8\uBA70, \uC790\uB3D9\uD655\uC778\uB3C4 \uD3EC\uD568\uD569\uB2C8\uB2E4. \uD604\uC7AC \uACE0\uC815 \uC790\uB8CC\uC758 \uC694\uC57D\xB7\uAC80\uC99D \uBC94\uC704\uB97C \uADF8\uB300\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uBBF8\uB798 \uCE74\uB4DC\xB7\uC2DC\uC138\uB294 \uBCF4\uC5EC\uC8FC\uC9C0 \uC54A\uACE0 \uC6D4\xB7\uD134\xB7\uB3C8\xB7\uC8FC\uBB38\xB7\uC800\uC7A5\uC740 \uBC14\uAFB8\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p><label for="news-library-year">\uB178\uCD9C \uC5F0\uB3C4</label><select id="news-library-year" style="width:100%;min-height:44px;margin:6px 0 12px"><option value="">\uC804\uCCB4 \uC5F0\uB3C4</option></select><label for="news-library-search">\uC81C\uBAA9\xB7\uC694\uC57D \uAC80\uC0C9</label><input id="news-library-search" type="search" maxlength="100" placeholder="\uC608: \uAE08\uB9AC" style="box-sizing:border-box;width:100%;min-height:44px;margin:6px 0 12px"><button id="news-library-clear" type="button">\uD544\uD130 \uC9C0\uC6B0\uAE30</button><p id="news-library-count" role="status" aria-live="polite"></p><div id="news-library-results"></div><div style="display:flex;gap:8px"><button id="news-library-prev" type="button">\uC774\uC804 12\uAC74</button><button id="news-library-next" type="button">\uB2E4\uC74C 12\uAC74</button></div><button id="news-library-close" type="button">\uB2EB\uAE30 \xB7 \uC6D0\uB798 \uD310\uB2E8 \uD654\uBA74</button>';
      dialog.querySelector("h2").style.cssText = "font-size:21px;font-weight:700;margin:0 0 12px";
      dialog.querySelectorAll("button").forEach((b) => b.style.cssText = "box-sizing:border-box;min-height:44px;width:100%;padding:10px 12px;margin:6px 0;border:1px solid #d6d0c9;border-radius:9px;background:#fff;color:#24201d;font:inherit;cursor:pointer");
      const year = dialog.querySelector("#news-library-year"), search = dialog.querySelector("#news-library-search");
      [...new Set(events.map((e) => e.date.slice(0, 4)))].forEach((y) => {
        const op = document.createElement("option");
        op.value = y;
        op.textContent = y + "\uB144";
        year.append(op);
      });
      let page = 0;
      const paint = () => {
        const query = search.value.trim().toLocaleLowerCase(), matches = events.filter((e) => (!year.value || e.date.startsWith(year.value)) && (!query || (e.card_title + " " + (e.card_summary || "")).toLocaleLowerCase().includes(query)));
        page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(matches.length / 12) - 1)));
        const shown = matches.slice(page * 12, page * 12 + 12), out = dialog.querySelector("#news-library-results");
        out.innerHTML = "";
        dialog.querySelector("#news-library-count").textContent = matches.length + "\uAC74 / \uC9C0\uB098\uAC04 \uC5F0\uACB0 \uCE74\uB4DC " + events.length + "\uAC74" + (matches.length ? " \xB7 " + (page * 12 + 1) + "~" + (page * 12 + shown.length) + "\uBC88\uC9F8" : "");
        if (!shown.length) {
          const p = document.createElement("p");
          p.id = "news-library-empty";
          p.textContent = events.length ? "\uC774 \uD544\uD130\uC5D0 \uB9DE\uB294 \uC9C0\uB098\uAC04 \uCE74\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uD544\uD130\uB97C \uC9C0\uC6B0\uBA74 \uB2E4\uC2DC \uBCFC \uC218 \uC788\uC5B4\uC694." : "\uC774 \uD68C\uADC0\uC5D0\uC11C \uC544\uC9C1 \uC9C0\uB098\uAC04 \uC5F0\uACB0 \uB274\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uC2DC\uC7A5\uC5D0 \uC0AC\uAC74\uC774 \uC5C6\uC5C8\uB2E4\uB294 \uB73B\uC740 \uC544\uB2D9\uB2C8\uB2E4.";
          out.append(p);
        }
        shown.forEach((ev) => {
          const d = document.createElement("details");
          d.className = "news-library-card";
          d.style.cssText = "padding:12px 0;border-top:1px solid #e1dcd5;overflow-wrap:anywhere";
          d.dataset.newsId = ev.id;
          const summary = document.createElement("summary");
          summary.style.cssText = "cursor:pointer;min-height:44px";
          summary.textContent = ev.date + " \xB7 " + (ev.card_title || "\uC81C\uBAA9 \uC5C6\uC74C");
          d.append(summary);
          const timing = document.createElement("p");
          timing.className = "note";
          timing.textContent = "\uAC8C\uC784 \uB178\uCD9C\uC77C " + ev.date + (ev.event_month ? " \xB7 \uC0AC\uAC74\uC6D4 " + ev.event_month + " / \uC815\uD655\uC77C \uBBF8\uD655\uC778" : ev.event_date ? " \xB7 \uC0AC\uAC74\uC77C " + ev.event_date : "");
          d.append(timing);
          const text = document.createElement("p");
          text.textContent = ev.card_summary || "\uC694\uC57D \uC5C6\uC74C";
          d.append(text);
          if (ev.historical_reconstruction) {
            const n = document.createElement("p");
            n.className = "note";
            n.textContent = "\uC5ED\uC0AC \uC7AC\uAD6C\uC131 [\uC2DC\uC5F0]: \uB2F9\uC2DC \uAE30\uC0AC \uC6D0\uBB38 \uBBF8\uD655\uBCF4. \uD6C4\uB144 \uAE30\uB85D\uC744 \uBC14\uD0D5\uC73C\uB85C \uD55C \uCE74\uB4DC\uC774\uBA70 \uC815\uD655\uD55C \uB2F9\uC2DC \uBCF4\uB3C4\uC2DC\uAC01\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
            d.append(n);
          }
          const evidence = document.createElement("div");
          evidence.innerHTML = sourceDetails(ev);
          d.append(evidence);
          out.append(d);
        });
        dialog.querySelector("#news-library-prev").disabled = page === 0;
        dialog.querySelector("#news-library-next").disabled = (page + 1) * 12 >= matches.length;
      };
      year.onchange = search.oninput = () => {
        page = 0;
        paint();
      };
      dialog.querySelector("#news-library-clear").onclick = () => {
        year.value = "";
        search.value = "";
        page = 0;
        paint();
        search.focus();
      };
      dialog.querySelector("#news-library-prev").onclick = () => {
        page--;
        paint();
      };
      dialog.querySelector("#news-library-next").onclick = () => {
        page++;
        paint();
      };
      dialog.querySelector("#news-library-close").onclick = () => dialog.close();
      dialog.addEventListener("close", () => {
        dialog.remove();
        if (origin && origin.isConnected) origin.focus();
      }, { once: true });
      document.body.append(dialog);
      paint();
      dialog.showModal();
      year.focus();
    }
    function sourceLabel(url) {
      const names = { "www.yna.co.kr": "\uC5F0\uD569\uB274\uC2A4", "www.khan.co.kr": "\uACBD\uD5A5\uC2E0\uBB38", "www.inews24.com": "\uC544\uC774\uB274\uC2A424", "www.seoul.co.kr": "\uC11C\uC6B8\uC2E0\uBB38", "www.mk.co.kr": "\uB9E4\uC77C\uACBD\uC81C", "www.ajunews.com": "\uC544\uC8FC\uACBD\uC81C", "www.ebn.co.kr": "EBN", "www.koreaherald.com": "\uCF54\uB9AC\uC544\uD5E4\uB7F4\uB4DC", "www.newsis.com": "\uB274\uC2DC\uC2A4", "www.etoday.co.kr": "\uC774\uD22C\uB370\uC774", "www.fsc.go.kr": "\uAE08\uC735\uC704\uC6D0\uD68C", "www.etnews.com": "\uC804\uC790\uC2E0\uBB38", "www.newswire.co.kr": "\uB274\uC2A4\uC640\uC774\uC5B4(\uBC1C\uD45C\uBB38)", "www.sedaily.com": "\uC11C\uC6B8\uACBD\uC81C", "www.busan.com": "\uBD80\uC0B0\uC77C\uBCF4", "news.kbs.co.kr": "KBS", "www.munhwa.com": "\uBB38\uD654\uC77C\uBCF4", "biz.chosun.com": "\uC870\uC120\uC77C\uBCF4(\uC870\uC120\uBE44\uC988 \uBCF4\uAD00)", "www.joongang.co.kr": "\uC911\uC559\uC77C\uBCF4", "encykorea.aks.ac.kr": "\uD55C\uAD6D\uBBFC\uC871\uBB38\uD654\uB300\uBC31\uACFC", "www.g-enews.com": "\uAE00\uB85C\uBC8C\uC774\uCF54\uB178\uBBF9", "news.sbs.co.kr": "SBS", "elischolar.library.yale.edu": "\uC7AC\uC815\uACBD\uC81C\uC6D0 \uC790\uB8CC(Yale \uBCF4\uAD00)", "www.hani.co.kr": "\uD55C\uACA8\uB808", "www.asiae.co.kr": "\uC544\uC2DC\uC544\uACBD\uC81C", "www.asiatoday.co.kr": "\uC544\uC2DC\uC544\uD22C\uB370\uC774", "mofe.go.kr": "\uAE30\uD68D\uC7AC\uC815\uBD80 \uC6A9\uC5B4\uC0AC\uC804" };
      try {
        const h = new URL(url).hostname;
        return names[h] || h;
      } catch (e) {
        return "\uC6D0\uCD9C\uCC98";
      }
    }
    function sourceDetails(ev) {
      if (!ev || ev.kind !== "news") return "";
      const v = ev.validation || {};
      const scoped = Array.isArray(v.source_urls) && v.source_urls.length;
      const fullScoped = typeof v.article === "string" && v.article.startsWith("selected_body_passages_read; not_all_claims_independently_verified");
      const priceOnly = ev.verification === "price-only-verified";
      const lines = !fullScoped && !priceOnly && ev.validation_display ? ["\uC218\uCE58: " + ev.validation_display.numeric, "\uB0A0\uC9DC: " + ev.validation_display.date, "\uAE30\uC0AC \uBCF8\uBB38: " + ev.validation_display.article, "\uB2F9\uC2DC \uACF5\uAC1C \uC5EC\uBD80: " + ev.validation_display.point_in_time] : priceOnly ? [
        "\uC218\uCE58: \uD655\uBCF4\uB41C \uC9C0\uC218 \uC885\uAC00\uC640 \uC77C\uCE58",
        "\uB0A0\uC9DC: \uC2DC\uC138 \uD589\uC758 \uB0A0\uC9DC \uD655\uC778",
        "\uAE30\uC0AC \uBCF8\uBB38: \uB2F9\uC77C \uAE30\uC0AC \uBBF8\uD655\uBCF4",
        "\uB2F9\uC2DC \uACF5\uAC1C \uC5EC\uBD80: \uD574\uB2F9\uC77C\uAE4C\uC9C0\uC758 \uC2DC\uC138\uB9CC \uC0AC\uC6A9, \uC815\uD655\uD55C \uACF5\uAC1C \uC2DC\uAC01 \uBBF8\uD655\uC778"
      ] : fullScoped ? [
        "\uC218\uCE58: \uCE74\uB4DC\uC758 \uC9C0\uC218 \uC885\uAC00\uB97C \uD655\uBCF4 \uC2DC\uACC4\uC5F4\uACFC \uB300\uC870. \uB2E4\uB978 \uC22B\uC790\uB294 \uAE30\uC0AC \uADFC\uAC70 \uBC94\uC704\uB9CC \uD655\uC778",
        "\uB0A0\uC9DC: \uC0AC\uAC74\uC77C\xB7\uAE30\uC0AC \uB0A0\uC9DC \uB300\uC870. \uC815\uD655\uD55C \uBCF4\uB3C4 \uC2DC\uAC01\uC740 \uBCC4\uB3C4",
        "\uAE30\uC0AC \uBCF8\uBB38: \uC120\uD0DD\uD55C \uAD6C\uC808 \uB300\uC870. \uBAA8\uB4E0 \uC8FC\uC7A5 \uB3C5\uB9BD \uAC80\uC99D\uC744 \uB73B\uD558\uC9C0 \uC54A\uC74C",
        "\uB2F9\uC2DC \uACF5\uAC1C \uC5EC\uBD80: \uC54C\uB824\uC9C4 \uC0AC\uD6C4 \uC0AC\uC2E4\uC740 \uBCF8\uBB38\uC5D0\uC11C \uC81C\uC678. \uCD5C\uCD08 \uACF5\uAC1C \uC2DC\uAC01\uC740 \uC77C\uBD80 \uBBF8\uD655\uC778"
      ] : [
        "\uC218\uCE58\xB7\uB0A0\uC9DC\xB7\uAE30\uC0AC \uBCF8\uBB38\xB7\uB2F9\uC2DC \uACF5\uAC1C \uC5EC\uBD80: \uAE30\uC874 \uADFC\uAC70 \uAE30\uB85D\uC758 \uC804\uCCB4 \uC7AC\uAC10\uC0AC\uB294 \uBBF8\uC644\uB8CC. \uC774\uBC88\uC5D0\uB294 \uBCF8\uBB38\uC758 \uC2DC\uC810 \uD45C\uD604\uB9CC \uC810\uAC80",
        "\uBC18\uC601\uB41C \uCE74\uB4DC \uC218\uC640 \uBAA8\uB4E0 \uC0AC\uC2E4 \uAC80\uC99D \uC644\uB8CC\uB294 \uB2E4\uB985\uB2C8\uB2E4"
      ];
      const links = scoped ? "<ul>" + v.source_urls.filter((url) => /^https:\/\//.test(url)).map((url, i) => '<li><a target="_blank" rel="noopener noreferrer" href="' + esc(url) + '">' + esc(sourceLabel(url)) + " \xB7 " + esc(v.source_metadata && v.source_metadata[url] || "\uC0AC\uAC74\uC77C " + (ev.event_date || ev.event_month || ev.date)) + "</a></li>").join("") + "</ul>" : "";
      return '<details class="source-details"><summary>\uADFC\uAC70\uC640 \uAC80\uC99D \uBC94\uC704</summary><ul>' + lines.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>" + links + '<p class="muted">\uAC8C\uC784\uC740 \uC2DC\uC5F0 \uBAA8\uD615\uC774\uBA70 \uC815\uD655\uD55C \uCCB4\uACB0\xB7\uBCF4\uB3C4 \uC2DC\uAC01\uC744 \uC7AC\uD604\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p></details>';
    }
    function esc(s) {
      return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    }
    boot();
  })();
})();
