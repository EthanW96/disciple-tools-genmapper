// Metrics → Egg Chart → Timelines: filters, data-quality note, the four views and a table.
(function () {
    'use strict';

    const config = window.genTimeline;
    const S = window.GenMapperTimelineSvg;
    const D = window.GenMapperTimelineData;
    const W = window.GenMapperTimelineWatch;
    const strings = config.strings;
    const YEAR = 365.25 * 86400;
    const PERIODS = { all: null, three_years: 3 * YEAR, one_year: YEAR };
    const RESIZE_DELAY_MS = 200;
    const FLAG_MERGE_PX = 12; // flags closer than this on a swimlane share one marker

    const state = { groups: [], coachingGroups: [], stageById: new Map(), rootOf: new Map(), analysis: null, selected: null, now: Math.floor(Date.now() / 1000) };

    const section = (id, title, caption) => `<section class="gm-tl-section">
        <h3>${S.escape(title)}</h3><p class="gm-tl-caption">${S.escape(caption)}</p><div id="${id}" class="gm-tl-view"></div>
    </section>`;

    const layout = () => `<div class="gm-tl">
        <span class="section-header">${S.escape(config.chart_label)} — ${S.escape(strings.timelines)}</span>
        <div class="gm-tl-filters">
            <label>${S.escape(strings.tree)} <select id="gm-tl-tree"><option value="">${S.escape(strings.all_trees)}</option></select></label>
            <label>${S.escape(strings.period)} <select id="gm-tl-period">
                <option value="all">${S.escape(strings.all_time)}</option>
                <option value="three_years">${S.escape(strings.last_3_years)}</option>
                <option value="one_year">${S.escape(strings.last_year)}</option>
            </select></label>
            <label>${S.escape(strings.health_watch)} <select id="gm-tl-watch-filter">
                <option value="">${S.escape(strings.all_groups)}</option>
                <option value="flagged">${S.escape(strings.flagged_only)}</option>
                ${W.CATEGORIES.map((key) => `<option value="${key}">${S.escape(strings[`watch_${key}`])}</option>`).join('')}
            </select></label>
            <label class="gm-tl-check"><input type="checkbox" id="gm-tl-inactive" checked> ${S.escape(strings.include_inactive)}</label>
        </div>
        <p class="gm-tl-quality" id="gm-tl-quality"></p>
        ${section('gm-tl-watch', strings.health_watch, strings.watch_caption)}
        ${section('gm-tl-load', strings.coaching_load, strings.coaching_load_caption)}
        ${S.legend(strings)}
        <section class="gm-tl-section" id="gm-tl-detail-section"><h3 id="gm-tl-detail-title">${S.escape(strings.journey)}</h3>
            <p class="gm-tl-caption">${S.escape(strings.journey_hint)}</p><div id="gm-tl-detail" class="gm-tl-view"></div></section>
        ${section('gm-tl-swimlanes', strings.swimlanes, strings.swimlanes_caption)}
        ${section('gm-tl-ecclesia', strings.time_to_ecclesia, strings.time_to_ecclesia_caption)}
        ${section('gm-tl-stages', strings.stages_over_time, strings.stages_over_time_caption)}
        <details class="gm-tl-table"><summary>${S.escape(strings.show_table)}</summary><div id="gm-tl-table"></div></details>
    </div>`;

    // First-generation ancestor of every group, for the tree filter
    const firstGenerationRoots = (groups) => {
        const byId = new Map(groups.map((group) => [group.id, group]));
        const rootOf = new Map();
        groups.forEach((group) => {
            let current = group;
            const seen = new Set();
            while (current && byId.has(current.parent_id) && !seen.has(current.id)) {
                seen.add(current.id);
                current = byId.get(current.parent_id);
            }
            rootOf.set(group.id, current ? current.id : group.id);
        });
        return rootOf;
    };

    const filters = () => ({
        tree: document.getElementById('gm-tl-tree').value,
        period: document.getElementById('gm-tl-period').value,
        includeInactive: document.getElementById('gm-tl-inactive').checked,
        watch: document.getElementById('gm-tl-watch-filter').value,
    });

    const flagsOf = (group) => state.analysis.flagsById.get(group.id) || [];

    // The watch filter narrows the swimlanes and table, not the movement-wide charts
    const watchedGroups = (groups, watch) => {
        if (!watch) {
            return groups;
        }
        return groups.filter((group) => flagsOf(group).length && W.matchesCategory(flagsOf(group), watch === 'flagged' ? '' : watch));
    };

    // Amber "!" where each flag began; nearby flags share one marker
    const drawFlags = (row, group, y, clampX, tip) => {
        const clusters = [];
        flagsOf(group).slice().sort((a, b) => a.since - b.since).forEach((flag) => {
            const x = clampX(flag.since);
            const last = clusters[clusters.length - 1];
            if (last && x - last.x < FLAG_MERGE_PX) {
                last.flags.push(flag);
            } else {
                clusters.push({ x, flags: [flag] });
            }
        });
        clusters.forEach((cluster) => W.flagMark(row, cluster.x, y, tip, W.flagTip(group, cluster.flags, strings, state.analysis.settings)));
    };

    const visibleGroups = (filter) => state.groups.filter((group) => {
        if (filter.tree && String(state.rootOf.get(group.id)) !== filter.tree) {
            return false;
        }
        return filter.includeInactive || !state.stageById.get(group.id).end;
    });

    const timeRange = (groups, period) => {
        const starts = groups.map((group) => state.stageById.get(group.id).start).filter(Boolean);
        const earliest = starts.length ? Math.min(...starts) : state.now - YEAR;
        const span = PERIODS[period];
        return { from: span ? Math.max(earliest, state.now - span) : earliest, to: state.now };
    };

    const qualityNote = (groups) => {
        const stagesOf = groups.map((group) => state.stageById.get(group.id));
        const noStart = groups.filter((group) => !group.started).length;
        const loggedEcclesia = stagesOf.filter((stage) => stage.ecclesia && stage.ecclesiaSource === 'log').length;
        const issues = stagesOf.filter((stage) => stage.issues.length).length;
        const parts = [];
        if (noStart) {
            parts.push(`${noStart} ${strings.quality_no_start}`);
        }
        if (loggedEcclesia) {
            parts.push(`${loggedEcclesia} ${strings.quality_logged_ecclesia}`);
        }
        if (issues) {
            parts.push(`${issues} ${strings.quality_issues}`);
        }
        return parts.length ? `${strings.data_note}: ${parts.join(' · ')}` : '';
    };

    const tableHtml = (rows) => {
        const cell = (value) => `<td>${S.escape(value)}</td>`;
        const body = rows.map(({ group }) => {
            const stage = state.stageById.get(group.id);
            const monthsTaken = stage.ecclesia ? `${Math.round(D.months(stage.ecclesia - stage.start))}` : '';
            return `<tr>${cell(group.name)}${cell(group.generation)}${cell(stage.start ? S.formatDate(stage.start) : '')}${cell(stage.ecclesia ? S.formatDate(stage.ecclesia) : '')}${cell(monthsTaken)}${cell(stage.end ? S.formatDate(stage.end) : '')}${cell((group.events || []).filter((e) => e.kind === 'baptism').reduce((total, e) => total + e.count, 0))}</tr>`;
        }).join('');
        const head = [strings.name, strings.generation, strings.started, strings.became_ecclesia, strings.months_to_ecclesia, strings.ended, strings.baptisms]
            .map((label) => `<th>${S.escape(label)}</th>`).join('');
        return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    };

    const renderJourney = (group) => {
        const detail = document.getElementById('gm-tl-detail');
        window.GenMapperTimelineJourney.render(detail, group, state.stageById.get(group.id), strings, state.now);
        detail.insertAdjacentHTML('beforeend', W.flagListHtml(flagsOf(group), strings, state.analysis.settings));
    };

    const showJourney = (group) => {
        state.selected = group;
        document.getElementById('gm-tl-detail-title').textContent = `${strings.journey}: ${group.name}`;
        renderJourney(group);
        document.getElementById('gm-tl-detail-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const renderAll = () => {
        const filter = filters();
        const groups = visibleGroups(filter);
        const range = timeRange(groups, filter.period);
        const rows = D.treeOrder(watchedGroups(groups, filter.watch), state.stageById);
        const stageList = groups.map((group) => state.stageById.get(group.id));
        document.getElementById('gm-tl-quality').textContent = qualityNote(groups);
        W.renderList(document.getElementById('gm-tl-watch'), groups, state.analysis, strings, {
            category: W.CATEGORIES.includes(filter.watch) ? filter.watch : '', groupsUrl: config.groups_url, onSelect: showJourney,
        });
        W.renderLoad(document.getElementById('gm-tl-load'), state.analysis.load, strings);
        window.GenMapperTimelineSwimlanes.render(document.getElementById('gm-tl-swimlanes'), rows, state.stageById, range, strings, showJourney, drawFlags);
        window.GenMapperTimelineTimeToEcclesia.render(document.getElementById('gm-tl-ecclesia'), D.timeToEcclesia(stageList, state.now), strings);
        window.GenMapperTimelineStages.render(document.getElementById('gm-tl-stages'), D.monthlyCounts(stageList, state.now), range, strings);
        document.getElementById('gm-tl-table').innerHTML = tableHtml(rows);
        if (state.selected && groups.some((group) => group.id === state.selected.id)) {
            renderJourney(state.selected);
        }
    };

    const fillTreeFilter = () => {
        const select = document.getElementById('gm-tl-tree');
        const roots = state.groups.filter((group) => state.rootOf.get(group.id) === group.id);
        const sizes = new Map();
        state.groups.forEach((group) => sizes.set(state.rootOf.get(group.id), (sizes.get(state.rootOf.get(group.id)) || 0) + 1));
        roots.sort((a, b) => a.name.localeCompare(b.name)).forEach((root) => {
            select.insertAdjacentHTML('beforeend', `<option value="${root.id}">${S.escape(root.name)} (${sizes.get(root.id)})</option>`);
        });
    };

    const showError = (chart, message) => {
        chart.innerHTML = `<p class="gm-tl-error">${S.escape(message)}</p>`;
    };

    const start = () => {
        const chart = document.getElementById('chart');
        if (!chart) {
            return;
        }
        chart.innerHTML = `<p class="gm-tl-note">${S.escape(strings.loading)}</p>`;
        fetch(`${config.root}dt/v1/genmapper/timeline`, { headers: { 'X-WP-Nonce': config.nonce } })
            .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
            .then(({ ok, body }) => {
                if (!ok || !body || !Array.isArray(body.groups)) {
                    throw new Error((body && body.message) || strings.load_failed);
                }
                state.groups = body.groups;
                state.stageById = new Map(body.groups.map((group) => [group.id, D.stages(group, state.now)]));
                state.rootOf = firstGenerationRoots(body.groups);
                state.coachingGroups = body.coaching_groups || [];
                state.analysis = W.analyse(state.groups, state.stageById, state.coachingGroups, config.watch, state.now);
                chart.innerHTML = layout();
                fillTreeFilter();
                ['gm-tl-tree', 'gm-tl-period', 'gm-tl-inactive', 'gm-tl-watch-filter'].forEach((id) => document.getElementById(id).addEventListener('change', renderAll));
                let resizeTimer = null;
                window.addEventListener('resize', () => {
                    clearTimeout(resizeTimer);
                    resizeTimer = setTimeout(renderAll, RESIZE_DELAY_MS);
                });
                renderAll();
            })
            .catch((error) => {
                console.error('Group timelines: could not load data', error);
                showError(chart, error.message || strings.load_failed);
            });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
