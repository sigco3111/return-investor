    // Read-only UI projection. Not part of engine identities: no writes, future
    // prices, nextTurn() calls, clock changes or injected simulation fixtures.
    window.__returnCasualRead = () => {
      if (!state || !DATA) return null;
      if(storageReadBlocked||storageWriteBlocked||multiTabConflict||window.__returnStorageHalted)return {blocked:true};
      const r = assetLiquidityReview();
      const unpaid = careerCashActive() ? careerCashUnpaid() : 0;
      const f = state.flags || {};
      const holdingRows = Object.entries(state.holdings || {}).map(([id,h]) => ({id,name:productRule(id).name||id,value:holdingValue(id,h,state.month)}));
      return structuredClone({month:state.month,started:!!f.birth,ended:!!f.gameOver||state.month>GAME_END,
        cash:state.cash,total:totalAssets(),unpaid,chaos:state.chaos,liquidity:r?.values||null,
        trail:state.assetTrail||[],flags:{birth:f.birth,studyPath:f.studyPath,academicStatus:f.academicStatus,career:f.career,recoveryJob:f.recoveryJob,militaryUntil:f.militaryUntil,enrolledMonths:f.enrolledMonths},
        holdings:holdingRows,orders:(state.pendingOrders||[]).map(o=>({kind:o.kind,product:o.product,name:productRule(o.product).name||o.product})),
        eventIndex:state.eventIndex,turnCount:state.turnCount,pending:pending?{step:pending.step,direction:pending.direction,product:pending.product,name:pending.product?productRule(pending.product).name:null,rule:pending.rule,reserveOnly:!!pending.reserveOnly,settleMonth:pending.settleMonth}:null,
        schedule:careerCashActive()?careerCashSchedule(state.month):null,academic:state.academic?{policy:state.academic.policy,effort:state.academic.effort}:null,monthlyLiving:careerCashActive()?careerCashSchedule(state.month).living:null,
        cashModel:careerCashActive(),history:(state.history||[]).slice(-8).map(h=>({month:h.month,choice:h.choice}))});
    };
