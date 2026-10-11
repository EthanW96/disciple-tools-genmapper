// Run with: node tests/js/timeline-flags.test.js
const assert = require('assert');
const data = require('../../includes/charts/timeline/timeline-data.js');
const flags = require('../../includes/charts/timeline/timeline-flags.js');

const MONTH = data.SECONDS_PER_MONTH;
const T0 = 1700000000;
const at = (m) => T0 + m * MONTH;
const NOW = at(24);
const settings = { ...flags.DEFAULT_SETTINGS, minSample: 3 };
let passed = 0;
const test = (name, fn) => {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
};
const kinds = (list) => list.map((f) => (f.milestone ? `${f.kind}:${f.milestone}` : f.kind));

// A small movement: coaches assigned at 1, 2, 2, 3 months; one group never coached
const coached = (id, months) => ({ id, started: at(0), type: 'group', status: 'active', events: [{ kind: 'coach', time: at(months) }, { kind: 'type', value: 'group', time: at(0) }], health: [], member_count: 8, last_activity: at(23) });
const movement = [coached(1, 1), coached(2, 2), coached(3, 2), coached(4, 3), { id: 5, started: at(0), type: 'group', status: 'active', events: [{ kind: 'type', value: 'group', time: at(0) }], health: [], member_count: 8, last_activity: at(23) }];
const stageById = new Map(movement.map((g) => [g.id, data.stages(g, NOW)]));

test('norms: 75% of groups had a coach by 3 months (Kaplan–Meier, with the uncoached group still counting)', () => {
    const result = flags.norms(movement, stageById, NOW, settings);
    assert.strictEqual(result.coach.source, 'movement');
    assert.ok(Math.abs(result.coach.months - 3) < 1e-9, `coach norm ${result.coach.months}`);
});

test('norms: too few groups reached a milestone -> the default months are used', () => {
    const result = flags.norms(movement, stageById, NOW, settings);
    assert.strictEqual(result.ecclesia.source, 'default');
    assert.strictEqual(result.ecclesia.months, 18);
});

test('norms: a milestone fewer than the percentile of groups ever reach is not flagged', () => {
    const result = flags.norms(movement, stageById, NOW, { ...settings, percentile: 0.9 });
    assert.strictEqual(result.coach.source, 'uncommon');
    assert.strictEqual(result.coach.months, null);
    const list = flags.flagsFor(movement[4], stageById.get(5), result, settings, NOW);
    assert.ok(!list.some((f) => f.milestone === 'coach'));
});

test('overdue: the uncoached group is flagged, with how far past the norm it is', () => {
    const groupNorms = flags.norms(movement, stageById, NOW, settings);
    const list = flags.flagsFor(movement[4], stageById.get(5), groupNorms, settings, NOW);
    const coach = list.find((f) => f.kind === 'overdue' && f.milestone === 'coach');
    assert.ok(coach, kinds(list).join(','));
    assert.ok(Math.abs(coach.severity - 24 / 3) < 1e-9);
    assert.strictEqual(coach.since, at(3));
    assert.ok(!flags.flagsFor(movement[0], stageById.get(1), groupNorms, settings, NOW).some((f) => f.milestone === 'coach'));
});

test('overdue and quiet flags skip groups that have ended', () => {
    const ended = { id: 9, started: at(0), ended: at(5), status: 'inactive', type: 'group', events: [], health: [], member_count: 3, last_activity: at(5) };
    const list = flags.flagsFor(ended, data.stages(ended, NOW), flags.norms(movement, stageById, NOW, settings), settings, NOW);
    assert.deepStrictEqual(kinds(list), []);
});

test('quiet: no change for longer than the quiet months', () => {
    const quiet = { ...movement[0], id: 10, last_activity: at(18) };
    const list = flags.flagsFor(quiet, data.stages(quiet, NOW), flags.norms(movement, stageById, NOW, settings), settings, NOW);
    assert.ok(kinds(list).includes('quiet'));
});

test('health: removed practice, ecclesia missing key practices, member drop, no members', () => {
    const church = {
        id: 11, started: at(0), ecclesia: at(6), type: 'church', status: 'active', last_activity: at(23), member_count: 5,
        health: ['church_baptism'],
        events: [
            { kind: 'coach', time: at(1) }, { kind: 'baptism', time: at(2), count: 1 }, { kind: 'multiplied', time: at(10) },
            { kind: 'health_removed', value: 'church_prayer', label: 'Prayer', time: at(20) },
            { kind: 'members', from: 12, to: 9, time: at(15) }, { kind: 'members', from: 9, to: 5, time: at(20) },
        ],
    };
    const list = flags.flagsFor(church, data.stages(church, NOW), flags.norms(movement, stageById, NOW, settings), settings, NOW);
    assert.ok(kinds(list).includes('practice_removed'));
    const missing = list.find((f) => f.kind === 'missing_practices');
    assert.deepStrictEqual(missing.practices, ['church_leaders', 'church_communion']);
    const drop = list.find((f) => f.kind === 'members_dropped');
    assert.deepStrictEqual([drop.from, drop.to], [12, 5]);
    const empty = { ...church, id: 12, member_count: 0 };
    assert.ok(kinds(flags.flagsFor(empty, data.stages(empty, NOW), flags.norms(movement, stageById, NOW, settings), settings, NOW)).includes('no_members'));
});

test('data gaps: no Start Date, ecclesia only known from the log', () => {
    const gap = { id: 13, created: at(0), type: 'church', status: 'active', events: [{ kind: 'type', value: 'church', time: at(4) }], health: [], member_count: 4, last_activity: at(23) };
    const list = kinds(flags.flagsFor(gap, data.stages(gap, NOW), flags.norms(movement, stageById, NOW, settings), settings, NOW));
    assert.ok(list.includes('no_start_date') && list.includes('no_church_start_date'), list.join(','));
});

test('coaching load: coaches and coaching groups over the limit', () => {
    const groups = Array.from({ length: 7 }, (_, i) => ({ id: 100 + i, name: `G${i}`, started: at(0), status: 'active', type: 'group', events: [], coaches: [{ id: 1, name: 'Busy coach' }], coaching: [50] }));
    const stages = new Map(groups.map((g) => [g.id, data.stages(g, NOW)]));
    const load = flags.coachingLoad(groups, stages, [{ id: 50, name: 'Team A', members: ['x'] }, { id: 51, name: 'Team B', members: ['y'] }], settings);
    assert.deepStrictEqual(load.coaches.map((c) => `${c.name}:${c.count}`), ['Busy coach:7']);
    assert.deepStrictEqual(load.coachingGroups.map((c) => `${c.name}:${c.groups}/${c.members}`), ['Team A:7/1']);
});

console.log(`${passed} tests passed`);
