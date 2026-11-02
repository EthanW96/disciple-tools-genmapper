// Health watch: flags for groups that may need attention, judged against the movement's own pace.
// Pure functions (no DOM), so they can be tested in Node.
(function (root) {
    'use strict';

    const Data = typeof module !== 'undefined' && module.exports
        ? require('./timeline-data.js')
        : root.GenMapperTimelineData;
    const MONTH = Data.SECONDS_PER_MONTH;
    const YEAR = 12 * MONTH;

    const DEFAULT_SETTINGS = {
        percentile: 0.75, // overdue = later than this share of groups reached the milestone
        quietMonths: 3,
        keyPractices: ['church_leaders', 'church_baptism', 'church_communion'],
        memberDropShare: 0.3,
        maxGroupsPerCoach: 5,
        minSample: 10, // fewer groups than this reached a milestone: use the guide months instead
        // Guide months per milestone: never flagged sooner, and used for small movements (plugin settings)
        milestoneMonths: { coach: 3, group: 4, baptism: 9, ecclesia: 18, multiplied: 24 },
    };

    // Milestones every group is expected to reach
    const MILESTONES = [{ key: 'coach' }, { key: 'group' }, { key: 'baptism' }, { key: 'ecclesia' }, { key: 'multiplied' }];

    const guideMonths = (key, settings) => (settings.milestoneMonths || {})[key] || DEFAULT_SETTINGS.milestoneMonths[key];

    const firstEventTime = (group, kind) => {
        const event = (group.events || []).find((e) => e.kind === kind);
        return event ? event.time : null;
    };

    // When a group reached a milestone (null if it hasn't)
    const reachedAt = (key, group, stage) => {
        if (key === 'coach') {
            // A coach linked before D.T. logged it still counts, from the start
            return firstEventTime(group, 'coach') || ((group.coaches || []).length ? stage.start : null);
        }
        if (key === 'group') {
            const groupStage = stage.segments.find((segment) => segment.stage !== 'pre');
            return groupStage ? groupStage.from : null;
        }
        if (key === 'baptism') {
            return firstEventTime(group, 'baptism');
        }
        if (key === 'ecclesia') {
            return stage.ecclesia;
        }
        return firstEventTime(group, 'multiplied');
    };

    const isActive = (group, stage) => !stage.end && group.status !== 'inactive';

    /**
     * Months by which `percentile` of groups reached each milestone (Kaplan–Meier, so groups
     * still on their way count). Falls back to the guide months when too few groups have reached it,
     * and never goes below them (records entered with their coach already set would give "0 months").
     * When fewer than `percentile` of groups have got there so far, not reaching it is normal: months is null.
     * @returns {Object} key -> { months, source: 'movement'|'guide'|'default'|'uncommon', movementMonths, reached }
     */
    const norms = (groups, stageById, now, settings = DEFAULT_SETTINGS) => {
        const result = {};
        MILESTONES.forEach((milestone) => {
            const items = groups.map((group) => {
                const stage = stageById.get(group.id);
                return { start: stage.start, end: stage.end, reachedAt: stage.start ? reachedAt(milestone.key, group, stage) : null };
            });
            const estimate = Data.timeToMilestone(items, now);
            const guide = guideMonths(milestone.key, settings);
            if (estimate.reached < settings.minSample) {
                result[milestone.key] = { months: guide, source: 'default', movementMonths: null, reached: estimate.reached };
                return;
            }
            const movementMonths = estimate.timeForShare(settings.percentile);
            if (movementMonths === null) {
                result[milestone.key] = { months: null, source: 'uncommon', movementMonths, reached: estimate.reached };
                return;
            }
            const isFaster = movementMonths < guide;
            result[milestone.key] = { months: isFaster ? guide : movementMonths, source: isFaster ? 'guide' : 'movement', movementMonths, reached: estimate.reached };
        });
        return result;
    };

    const overdueFlags = (group, stage, groupNorms, now) => {
        const ageMonths = Data.months(now - stage.start);
        return MILESTONES
            .filter((milestone) => groupNorms[milestone.key].months !== null)
            .filter((milestone) => reachedAt(milestone.key, group, stage) === null)
            .filter((milestone) => ageMonths > groupNorms[milestone.key].months)
            .map((milestone) => ({
                kind: 'overdue',
                milestone: milestone.key,
                since: stage.start + groupNorms[milestone.key].months * MONTH,
                ageMonths,
                normMonths: groupNorms[milestone.key].months,
                normSource: groupNorms[milestone.key].source,
                severity: ageMonths / groupNorms[milestone.key].months,
            }));
    };

    const healthFlags = (group, stage, settings, now) => {
        const flags = [];
        const current = new Set(group.health || []);
        const removed = new Map();
        (group.events || []).filter((e) => e.kind === 'health_removed' && !current.has(e.value))
            .forEach((e) => removed.set(e.value, e)); // latest removal of each practice
        removed.forEach((event) => flags.push({ kind: 'practice_removed', label: event.label, since: event.time, severity: 1.1 }));

        if (stage.ecclesia) {
            const missing = settings.keyPractices.filter((key) => !current.has(key));
            if (missing.length) {
                flags.push({ kind: 'missing_practices', practices: missing, since: stage.ecclesia, severity: 1.2 });
            }
        }

        const recent = (group.events || []).filter((e) => e.kind === 'members' && e.time >= now - YEAR);
        const counts = recent.flatMap((e) => [e.from, e.to]).filter((value) => value !== null && value !== undefined);
        const highest = Math.max(0, ...counts);
        const memberCount = group.member_count;
        if (memberCount === 0) {
            flags.push({ kind: 'no_members', since: recent.length ? recent[recent.length - 1].time : stage.start, severity: 1.5 });
        } else if (memberCount !== null && memberCount !== undefined && highest > 0 && memberCount <= highest * (1 - settings.memberDropShare)) {
            const lastDrop = recent.slice().reverse().find((e) => e.from !== null && e.to < e.from);
            flags.push({ kind: 'members_dropped', from: highest, to: memberCount, since: lastDrop ? lastDrop.time : now, severity: 1 + (highest - memberCount) / highest });
        }
        return flags;
    };

    const dataGapFlags = (group, stage) => {
        const flags = [];
        if (!group.started) {
            flags.push({ kind: 'no_start_date', since: stage.start, severity: 0.1 });
        }
        if (stage.ecclesia && stage.ecclesiaSource === 'log') {
            flags.push({ kind: 'no_church_start_date', since: stage.ecclesia, severity: 0.1 });
        }
        if ((stage.issues || []).includes('ecclesia-before-start')) {
            flags.push({ kind: 'dates_out_of_order', since: stage.start, severity: 0.1 });
        }
        return flags;
    };

    /**
     * Everything worth checking on one group, most pressing first.
     * Overdue, quiet and health flags only apply to groups that are still active.
     */
    const flagsFor = (group, stage, groupNorms, settings = DEFAULT_SETTINGS, now) => {
        if (!stage.start) {
            return dataGapFlags(group, stage);
        }
        const flags = [];
        if (isActive(group, stage)) {
            flags.push(...overdueFlags(group, stage, groupNorms, now));
            const quietMonths = group.last_activity ? Data.months(now - group.last_activity) : null;
            if (quietMonths !== null && quietMonths > settings.quietMonths) {
                flags.push({ kind: 'quiet', since: group.last_activity + settings.quietMonths * MONTH, quietMonths, severity: quietMonths / settings.quietMonths });
            }
            flags.push(...healthFlags(group, stage, settings, now));
        }
        flags.push(...dataGapFlags(group, stage));
        return flags.sort((a, b) => b.severity - a.severity);
    };

    /**
     * Coaches and coaching groups carrying more active groups than the setting allows.
     * @returns {{coaches: Array<{id, name, count, groups}>, coachingGroups: Array<{id, name, groups, members}>}}
     */
    const coachingLoad = (groups, stageById, coachingGroups, settings = DEFAULT_SETTINGS) => {
        const active = groups.filter((group) => isActive(group, stageById.get(group.id)));
        const byCoach = new Map();
        active.forEach((group) => (group.coaches || []).forEach((coach) => {
            const entry = byCoach.get(coach.id) || { id: coach.id, name: coach.name, groups: [] };
            entry.groups.push(group.name);
            byCoach.set(coach.id, entry);
        }));
        const coaches = Array.from(byCoach.values())
            .filter((entry) => entry.groups.length > settings.maxGroupsPerCoach)
            .map((entry) => ({ id: entry.id, name: entry.name, count: entry.groups.length, groups: entry.groups }))
            .sort((a, b) => b.count - a.count);
        const covered = (coachingGroups || []).map((coaching) => ({
            id: coaching.id,
            name: coaching.name,
            members: (coaching.members || []).length,
            groups: active.filter((group) => (group.coaching || []).includes(coaching.id)).length,
        }));
        return {
            coaches,
            coachingGroups: covered.filter((c) => c.members > 0 && c.groups / c.members > settings.maxGroupsPerCoach)
                .sort((a, b) => b.groups / b.members - a.groups / a.members),
        };
    };

    const api = { DEFAULT_SETTINGS, MILESTONES, reachedAt, norms, flagsFor, coachingLoad };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.GenMapperTimelineFlags = api;
    }
})(typeof window !== 'undefined' ? window : this);
