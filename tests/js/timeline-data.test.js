// Run with: node tests/js/timeline-data.test.js
const assert = require('assert');
const data = require('../../includes/charts/timeline/timeline-data.js');

const MONTH = data.SECONDS_PER_MONTH;
const START = 1700000000;
const at = (m) => START + m * MONTH;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
let passed = 0;
const test = (name, fn) => {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
};

test('stages: pre-group, then group (logged), then ecclesia (Church Start Date)', () => {
    const group = {
        started: at(0), created: at(1), type: 'church', status: 'active', ecclesia: at(9), first_type: 'pre-group',
        events: [{ kind: 'type', value: 'pre-group', time: at(1) }, { kind: 'type', value: 'group', time: at(3) }],
    };
    const result = data.stages(group, at(20));
    assert.deepStrictEqual(result.segments.map((s) => s.stage), ['pre', 'group', 'ecclesia']);
    assert.strictEqual(result.segments[1].from, at(3));
    assert.strictEqual(result.segments[2].from, at(9));
    assert.strictEqual(result.segments[2].to, at(20));
    assert.strictEqual(result.ecclesiaSource, 'date');
});

test('stages: no Start Date falls back to the D.T. created time; no start at all is flagged', () => {
    assert.strictEqual(data.stages({ created: at(2), type: 'group', events: [] }, at(5)).start, at(2));
    assert.deepStrictEqual(data.stages({ type: 'group', events: [] }, at(5)).issues, ['no-start']);
});

test('stages: ecclesia date before the start is clamped and flagged', () => {
    const result = data.stages({ started: at(5), type: 'church', ecclesia: at(2), events: [] }, at(8));
    assert.strictEqual(result.ecclesia, at(5));
    assert.ok(result.issues.includes('ecclesia-before-start'));
});

test('stages: an inactive group ends at its End Date (or when it was logged inactive)', () => {
    const withDate = data.stages({ started: at(0), ended: at(6), status: 'inactive', type: 'group', events: [] }, at(12));
    assert.strictEqual(withDate.segments[withDate.segments.length - 1].to, at(6));
    const logged = data.stages({ started: at(0), status: 'inactive', type: 'group', events: [{ kind: 'status', value: 'inactive', time: at(4) }] }, at(12));
    assert.strictEqual(logged.end, at(4));
});

test('time to ecclesia: Kaplan–Meier matches the hand-worked example', () => {
    // reached at 4, 6, 10 months; still on their way at 5 and 12 months
    const stageList = [
        { start: at(0), ecclesia: at(4), end: null },
        { start: at(0), ecclesia: at(6), end: null },
        { start: at(0), ecclesia: null, end: at(5) },
        { start: at(0), ecclesia: at(10), end: null },
        { start: at(8), ecclesia: null, end: null },
    ];
    const result = data.timeToEcclesia(stageList, at(20));
    const shares = result.curve.slice(1).map((p) => [Math.round(p.t), p.share]);
    near(shares[0][1], 0.2, 'share at 4');
    near(shares[1][1], 1 - 0.8 * (2 / 3), 'share at 6');
    near(shares[2][1], 1 - 0.8 * (2 / 3) * 0.5, 'share at 10');
    near(result.median, 10, 'median');
    assert.strictEqual(result.n, 5);
    assert.strictEqual(result.censored.length, 2);
    near(result.shareAt(12), 1 - 0.8 * (2 / 3) * 0.5, 'share within 12 months');
});

test('time to ecclesia: median is null when fewer than half have become one', () => {
    const result = data.timeToEcclesia([
        { start: at(0), ecclesia: at(3), end: null },
        { start: at(0), ecclesia: null, end: null },
        { start: at(0), ecclesia: null, end: null },
    ], at(10));
    assert.strictEqual(result.median, null);
});

test('monthly counts: groups are counted in the stage they were in at the start of each month', () => {
    const jan = Date.UTC(2025, 0, 1) / 1000;
    const mar = Date.UTC(2025, 2, 1) / 1000;
    const stageList = [{ start: jan, segments: [{ stage: 'pre', from: jan, to: mar }, { stage: 'ecclesia', from: mar, to: Date.UTC(2025, 5, 1) / 1000 }] }];
    const counts = data.monthlyCounts(stageList, Date.UTC(2025, 4, 15) / 1000);
    assert.deepStrictEqual(counts.map((c) => `${c.pre}${c.group}${c.ecclesia}`), ['100', '100', '001', '001', '001']);
});

test('tree order: parents before children, siblings by start date', () => {
    const groups = [{ id: 1, parent_id: 0 }, { id: 2, parent_id: 1 }, { id: 3, parent_id: 1 }, { id: 4, parent_id: 0 }];
    const starts = new Map([[1, { start: 10 }], [2, { start: 30 }], [3, { start: 20 }], [4, { start: 5 }]]);
    assert.deepStrictEqual(data.treeOrder(groups, starts).map((row) => `${row.group.id}@${row.depth}`), ['4@0', '1@0', '3@1', '2@1']);
});

console.log(`${passed} tests passed`);
