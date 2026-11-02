// Group timelines: turns group histories from the REST API into stage segments,
// time-to-ecclesia estimates and monthly stage counts. Pure functions (no DOM),
// so they can be tested in Node.
(function (root) {
    'use strict';

    const SECONDS_PER_MONTH = 30.4375 * 86400;
    const GROUP_TYPES = ['group', 'team']; // meeting groups that aren't (yet) an ecclesia
    const ECCLESIA_TYPE = 'church';
    const INACTIVE_STATUS = 'inactive';

    const months = (seconds) => seconds / SECONDS_PER_MONTH;
    const eventsOf = (group, kind) => (group.events || []).filter((event) => event.kind === kind);
    const firstLogged = (group, kind, values) => {
        const match = eventsOf(group, kind).find((event) => values.includes(event.value));
        return match ? match.time : null;
    };

    /**
     * Stages of one group: pre-group → group → ecclesia, from its start until it ended (or now).
     * Real dates (Start, Church Start, End) win over activity-log entry times.
     * @returns {{start, end, ecclesia, ecclesiaSource, segments: Array<{stage, from, to}>, issues: string[]}}
     */
    const stages = (group, now) => {
        const issues = [];
        const start = group.started || group.created;
        if (!start) {
            return { start: null, end: null, ecclesia: null, segments: [], issues: ['no-start'] };
        }
        const loggedEnd = group.status === INACTIVE_STATUS ? firstLogged(group, 'status', [INACTIVE_STATUS]) : null;
        const end = group.ended || loggedEnd || null;
        const until = Math.max(start, Math.min(end || now, now));

        const typeChanges = eventsOf(group, 'type');
        const initialType = group.first_type || (typeChanges[0] && typeChanges[0].value) || group.type;
        let ecclesia = group.ecclesia || firstLogged(group, 'type', [ECCLESIA_TYPE])
            || (group.type === ECCLESIA_TYPE ? start : null);
        const ecclesiaSource = group.ecclesia ? 'date' : (ecclesia ? 'log' : null);
        if (ecclesia && ecclesia < start) {
            issues.push('ecclesia-before-start');
            ecclesia = start;
        }
        let toGroup = GROUP_TYPES.includes(initialType) ? start : firstLogged(group, 'type', GROUP_TYPES);
        if (toGroup && toGroup < start) {
            toGroup = start;
        }
        if (toGroup && ecclesia && toGroup > ecclesia) {
            toGroup = null; // became an ecclesia without a logged group stage
        }

        const segments = [];
        const add = (stage, from, to) => {
            if (from !== null && to > from) {
                segments.push({ stage, from, to: Math.min(to, until) });
            }
        };
        const preEnd = toGroup || ecclesia || until;
        if (initialType !== ECCLESIA_TYPE) {
            add('pre', start, Math.min(preEnd, until));
        }
        if (toGroup) {
            add('group', toGroup, Math.min(ecclesia || until, until));
        }
        if (ecclesia && ecclesia < until) {
            add('ecclesia', ecclesia, until);
        }
        return { start, end, ecclesia: ecclesia && ecclesia <= until ? ecclesia : null, ecclesiaSource, segments: segments.filter((s) => s.to > s.from), issues };
    };

    /**
     * Kaplan–Meier estimate of the share of groups that have reached a milestone, by months since start.
     * Groups that haven't reached it yet count until now (or until they ended): they are "censored".
     * @param {Array<{start, end, reachedAt}>} items one per group; reachedAt is null when not reached
     */
    const timeToMilestone = (items, now) => {
        const observations = items
            .filter((item) => item.start)
            .map((item) => {
                const reached = item.reachedAt !== null && item.reachedAt !== undefined;
                const stop = reached ? Math.max(item.reachedAt, item.start) : Math.min(item.end || now, now);
                return { t: months(Math.max(0, stop - item.start)), reached };
            });
        const eventTimes = Array.from(new Set(observations.filter((o) => o.reached).map((o) => o.t))).sort((a, b) => a - b);
        let survival = 1;
        const curve = [{ t: 0, share: 0, atRisk: observations.length }];
        eventTimes.forEach((t) => {
            const atRisk = observations.filter((o) => o.t >= t).length;
            const reachedNow = observations.filter((o) => o.reached && o.t === t).length;
            if (atRisk > 0) {
                survival *= 1 - reachedNow / atRisk;
            }
            curve.push({ t, share: 1 - survival, atRisk });
        });
        const shareAt = (t) => curve.reduce((share, point) => (point.t <= t ? point.share : share), 0);
        // Months by which this share of groups had reached it (null if never estimated that high)
        const timeForShare = (share) => {
            const point = curve.find((p) => p.share >= share);
            return point ? point.t : null;
        };
        const medianPoint = curve.find((point) => point.share >= 0.5);
        return {
            curve,
            observations,
            n: observations.length,
            reached: observations.filter((o) => o.reached).length,
            censored: observations.filter((o) => !o.reached),
            median: medianPoint ? medianPoint.t : null,
            shareAt,
            timeForShare,
        };
    };

    // Share of groups that have become an ecclesia, by months since start
    const timeToEcclesia = (stageList, now) => timeToMilestone(
        stageList.map((item) => ({ start: item.start, end: item.end, reachedAt: item.ecclesia })), now
    );

    /**
     * Groups in each stage at the start of every month, from the earliest start until now.
     * @returns {Array<{month: number, pre: number, group: number, ecclesia: number}>}
     */
    const monthlyCounts = (stageList, now) => {
        const starts = stageList.filter((item) => item.start).map((item) => item.start);
        if (!starts.length) {
            return [];
        }
        const first = new Date(Math.min(...starts) * 1000);
        const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
        const result = [];
        while (cursor.getTime() / 1000 <= now) {
            const time = cursor.getTime() / 1000;
            const counts = { month: time, pre: 0, group: 0, ecclesia: 0 };
            stageList.forEach((item) => item.segments.forEach((segment) => {
                if (time >= segment.from && time < segment.to) {
                    counts[segment.stage] += 1;
                }
            }));
            result.push(counts);
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
        return result;
    };

    // Parent before children, siblings by start date: the order for swimlane rows
    const treeOrder = (groups, stageById) => {
        const ids = new Set(groups.map((group) => group.id));
        const children = new Map();
        groups.forEach((group) => {
            const parent = ids.has(group.parent_id) ? group.parent_id : 0;
            children.set(parent, (children.get(parent) || []).concat(group));
        });
        const byStart = (a, b) => ((stageById.get(a.id) || {}).start || Infinity) - ((stageById.get(b.id) || {}).start || Infinity);
        const ordered = [];
        const visit = (parentId, depth) => (children.get(parentId) || []).slice().sort(byStart).forEach((group) => {
            ordered.push({ group, depth });
            visit(group.id, depth + 1);
        });
        visit(0, 0);
        return ordered;
    };

    const api = { SECONDS_PER_MONTH, months, stages, timeToMilestone, timeToEcclesia, monthlyCounts, treeOrder };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.GenMapperTimelineData = api;
    }
})(typeof window !== 'undefined' ? window : this);
