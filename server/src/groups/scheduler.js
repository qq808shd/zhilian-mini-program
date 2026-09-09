// Main path: 00:05 Asia/Shanghai. Startup compensation, bounded batches yield between DB work.
const { dateKey, shiftDate } = require('../../../miniprogram/utils/groupRules');
function nextSettlementAt(now) {
  let next = Date.parse(dateKey(now) + 'T00:05:00+08:00');
  if (next <= now) next = Date.parse(shiftDate(dateKey(now), 1) + 'T00:05:00+08:00');
  return next;
}
function startGroupScheduler(groups, { clock = Date.now, log = entry => console.error(JSON.stringify(entry)) } = {}) {
  let timer, immediate, stopped = false;
  function schedule(delay) { if (!stopped) { timer = setTimeout(() => run(''), delay); timer.unref(); } }
  function run(cursor) {
    if (stopped) return;
    try {
      const result = groups.settleBatch(cursor);
      if (result.cursor) immediate = setImmediate(() => run(result.cursor));
      else schedule(nextSettlementAt(clock()) - clock());
    } catch (error) {
      log({ scope: 'study_groups', kind: 'settlement_failure', message: error.message });
      schedule(60000); // Retry an interrupted transaction, not a successful settlement.
    }
  }
  immediate = setImmediate(() => run(''));
  return () => { stopped = true; clearTimeout(timer); clearImmediate(immediate); };
}
module.exports = { startGroupScheduler, nextSettlementAt };
