// Shared, non-mutating container checks for persisted travel data.
// This validates structure, not booking availability, prices or travel facts.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TripMateStateSchema = api;
})(globalThis, function () {
  'use strict';
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const labels = { trips: '收藏行程', orders: '订单', reminders: '提醒', expenses: '支出', packing: '行李清单' };
  function invalid(path, expected) {
    const error = new Error(`旅行数据格式不正确：${path}应为${expected}。未修改当前数据，请重新导出备份或检查文件。`);
    error.status = 400;
    error.code = 'STATE_INVALID';
    error.path = path;
    throw error;
  }
  function list(value, path, inspect) {
    if (!Array.isArray(value)) invalid(path, '列表');
    value.forEach((item, index) => {
      const at = `${path}[${index + 1}]`;
      if (!record(item)) invalid(at, '一条记录');
      if (inspect) inspect(item, at);
    });
  }
  function optionalList(value, path, inspect) {
    if (value != null) list(value, path, inspect);
  }
  function plan(value, path) {
    if (!record(value)) invalid(path, '行程对象');
    optionalList(value.days, `${path}.days`, (day, at) => list(day.events, `${at}.events`));
    optionalList(value.transportLegs, `${path}.transportLegs`);
    if (value.recommendations != null) {
      if (!record(value.recommendations)) invalid(`${path}.recommendations`, '对象');
      for (const kind of ['hotels', 'restaurants']) {
        optionalList(value.recommendations[kind], `${path}.recommendations.${kind}`, (item, at) => {
          if (item.reviewReasons != null && !Array.isArray(item.reviewReasons)) invalid(`${at}.reviewReasons`, '列表');
        });
      }
    }
    if (value.budget != null) {
      if (!record(value.budget)) invalid(`${path}.budget`, '对象');
      for (const kind of ['transport', 'lodging', 'foodTickets']) {
        const category = value.budget[kind];
        // Older plans store a category as a single amount instead of an object.
        if (Array.isArray(category)) invalid(`${path}.budget.${kind}`, '费用对象或旧版金额');
        if (record(category)) optionalList(category.items, `${path}.budget.${kind}.items`);
      }
    }
  }
  function assertState(state) {
    if (!record(state)) invalid('旅行数据', '对象');
    for (const [name, label] of Object.entries(labels)) {
      const value = state[`tripmate.v1.${name}`];
      if (value == null) continue; // Absent/null sections are valid in older backups.
      list(value, label, name === 'trips' ? (item, at) => {
        if (Object.prototype.hasOwnProperty.call(item, 'plan')) plan(item.plan, `${at}.plan`);
        else if (Array.isArray(item.days)) plan(item, at); // Native legacy archive shape.
        // Keep opaque legacy metadata records; do not discard/rewrite old archives.
      } : undefined);
    }
    if (state['tripmate.v1.draft'] != null) plan(state['tripmate.v1.draft'], '当前草稿');
    for (const name of ['emergency', 'preferences', 'fun']) {
      const value = state[`tripmate.v1.${name}`];
      if (value != null && !record(value)) invalid(name, '对象');
    }
    const fun = state['tripmate.v1.fun'];
    if (fun) {
      optionalList(fun.completed, '趣味任务.completed');
      if (fun.current != null && !record(fun.current)) invalid('趣味任务.current', '对象');
    }
    const largeMode = state['tripmate.v1.largeMode'];
    if (largeMode != null && typeof largeMode !== 'boolean') invalid('大字模式', '布尔值');
    return state;
  }
  return Object.freeze({ assertState });
});
