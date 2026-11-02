// Health watch on screen: flag wording, the watch list, the coaching load table and the
// "!" marker shared by the swimlanes, journey, record tile and egg chart.
(function () {
    'use strict';

    const S = window.GenMapperTimelineSvg;
    const F = window.GenMapperTimelineFlags;
    const LIST_LIMIT = 15;
    const MARK_RADIUS = 7;
    const HIT_SIZE = 18;

    const CATEGORY = {
        overdue: 'pace',
        quiet: 'quiet',
        practice_removed: 'health',
        missing_practices: 'health',
        members_dropped: 'health',
        no_members: 'health',
        no_start_date: 'data',
        no_church_start_date: 'data',
        dates_out_of_order: 'data',
    };
    const CATEGORIES = ['pace', 'quiet', 'health', 'data'];

    // "{name}" placeholders in translated strings
    const format = (template, values) => String(template).replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));

    const settingsFrom = (watch) => Object.assign({}, F.DEFAULT_SETTINGS, watch || {});

    /**
     * Flags for every group, judged against the movement's own pace.
     * @param {boolean} useDefaults true when only part of the movement is loaded: use the default months
     */
    const analyse = (groups, stageById, coachingGroups, watch, now, useDefaults = false) => {
        const settings = settingsFrom(watch);
        const groupNorms = F.norms(groups, stageById, now, useDefaults ? Object.assign({}, settings, { minSample: Infinity }) : settings);
        const flagsById = new Map(groups.map((group) => [group.id, F.flagsFor(group, stageById.get(group.id), groupNorms, settings, now)]));
        return { settings, norms: groupNorms, flagsById, load: F.coachingLoad(groups, stageById, coachingGroups, settings) };
    };

    const practiceNames = (keys, settings) => keys.map((key) => (settings.practiceLabels || {})[key] || key).join(', ');

    const reason = (flag, strings, settings) => {
        const months = (value) => Math.round(value);
        switch (flag.kind) {
        case 'overdue': {
            const detail = { movement: strings.flag_overdue_movement, guide: strings.flag_overdue_guide }[flag.normSource] || strings.flag_overdue_default;
            return `${strings[`flag_milestone_${flag.milestone}`]}: ${format(detail, { age: months(flag.ageMonths), norm: months(flag.normMonths), share: Math.round(settings.percentile * 100) })}`;
        }
        case 'quiet':
            return format(strings.flag_quiet, { months: months(flag.quietMonths) });
        case 'practice_removed':
            return format(strings.flag_practice_removed, { practice: flag.label });
        case 'missing_practices':
            return format(strings.flag_missing_practices, { practices: practiceNames(flag.practices, settings) });
        case 'members_dropped':
            return format(strings.flag_members_dropped, { from: flag.from, to: flag.to });
        default:
            return strings[`flag_${flag.kind}`] || flag.kind;
        }
    };

    // The thresholds in use, so the flags can be checked: "Usual pace (75% of groups): coach by 3 months · …"
    const paceSummary = (analysis, strings) => {
        const share = Math.round(analysis.settings.percentile * 100);
        const items = F.MILESTONES.map(({ key }) => {
            const norm = analysis.norms[key];
            const name = strings[`pace_${key}`];
            if (norm.months === null) {
                return format(strings.pace_uncommon, { milestone: name });
            }
            const template = { default: strings.pace_default, guide: strings.pace_guide }[norm.source] || strings.pace_item;
            return format(template, { milestone: name, months: Math.round(norm.months) });
        });
        return `${format(strings.pace_summary, { share })} ${items.join(' · ')}`;
    };

    const matchesCategory = (flags, category) => !category || flags.some((flag) => CATEGORY[flag.kind] === category);

    // Amber "!" marker: the status colour always comes with the glyph and words in its tooltip
    const flagMark = (parent, x, y, tip, html) => {
        const mark = S.el(parent, 'g', { class: 'gm-tl-flag' });
        S.el(mark, 'circle', { cx: x, cy: y, r: MARK_RADIUS });
        S.el(mark, 'text', { x, y: y + 4, 'text-anchor': 'middle' }, '!');
        const hit = S.el(parent, 'rect', { x: x - HIT_SIZE / 2, y: y - HIT_SIZE / 2, width: HIT_SIZE, height: HIT_SIZE, class: 'gm-tl-hit' });
        tip.attach(hit, html);
    };

    const flagTip = (group, flags, strings, settings) => `<b>${S.escape(strings.flags_title)}${group ? `: ${S.escape(group.name)}` : ''}</b><br>${flags.map((flag) => `! ${S.escape(reason(flag, strings, settings))}`).join('<br>')}`;

    // A short list of one group's flags (journey and record tile)
    const flagListHtml = (flags, strings, settings) => {
        if (!flags.length) {
            return '';
        }
        const items = flags.map((flag) => `<li><span class="gm-tl-flag-icon" aria-hidden="true">!</span>${S.escape(reason(flag, strings, settings))} <span class="gm-tl-muted">· ${S.escape(strings.since)} ${S.escape(S.formatDate(flag.since))}</span></li>`).join('');
        return `<div class="gm-tl-flags"><b>${S.escape(strings.flags_title)}</b><ul>${items}</ul></div>`;
    };

    // A record's name, linked to the record when its list URL is known
    const recordLink = (record, listUrl) => (listUrl && record.id
        ? `<a href="${S.escape(listUrl + record.id)}">${S.escape(record.name)}</a>`
        : S.escape(record.name));

    /**
     * The watch list: one row per flagged group, most pressing first.
     * @param {string} category '' for all, or pace / quiet / health / data
     */
    const renderList = (container, groups, analysis, strings, options) => {
        const { category, groupsUrl, onSelect } = options;
        const rows = groups
            .map((group) => ({ group, flags: (analysis.flagsById.get(group.id) || []).filter((flag) => !category || CATEGORY[flag.kind] === category) }))
            .filter((row) => row.flags.length)
            .sort((a, b) => b.flags[0].severity - a.flags[0].severity || a.group.name.localeCompare(b.group.name));
        const counts = CATEGORIES.map((key) => `${strings[`watch_${key}`]}: ${groups.filter((group) => matchesCategory(analysis.flagsById.get(group.id) || [], key)).length}`);
        container.innerHTML = `<p class="gm-tl-caption">${S.escape(paceSummary(analysis, strings))}</p><p class="gm-tl-caption"><b>${S.escape(counts.join(' · '))}</b></p>`;
        if (!rows.length) {
            container.insertAdjacentHTML('beforeend', `<p class="gm-tl-note">${S.escape(strings.watch_none)}</p>`);
            return;
        }
        const rowHtml = ({ group, flags }, index) => `<tr${index >= LIST_LIMIT ? ' class="gm-tl-more" hidden' : ''}>
            <td>${recordLink(group, groupsUrl)}<br><button type="button" class="gm-tl-linkbutton" data-group="${group.id}">${S.escape(strings.show_journey)}</button></td>
            <td><ul class="gm-tl-reasons">${flags.map((flag) => `<li><span class="gm-tl-flag-icon" aria-hidden="true">!</span>${S.escape(reason(flag, strings, analysis.settings))}</li>`).join('')}</ul></td>
            <td>${S.escape(S.formatDate(Math.min(...flags.map((flag) => flag.since))))}</td>
        </tr>`;
        const more = rows.length > LIST_LIMIT
            ? `<button type="button" class="button small gm-tl-show-more">${S.escape(format(strings.show_all, { count: rows.length }))}</button>`
            : '';
        container.insertAdjacentHTML('beforeend', `<table class="gm-tl-watch">
            <thead><tr><th>${S.escape(strings.name)}</th><th>${S.escape(strings.what_to_check)}</th><th>${S.escape(strings.since)}</th></tr></thead>
            <tbody>${rows.map(rowHtml).join('')}</tbody></table>${more}`);
        const byId = new Map(rows.map((row) => [String(row.group.id), row.group]));
        container.querySelectorAll('.gm-tl-linkbutton').forEach((button) => button.addEventListener('click', () => onSelect(byId.get(button.getAttribute('data-group')))));
        const showMore = container.querySelector('.gm-tl-show-more');
        if (showMore) {
            showMore.addEventListener('click', () => {
                container.querySelectorAll('.gm-tl-more').forEach((row) => row.removeAttribute('hidden'));
                showMore.remove();
            });
        }
    };

    // urls: { contacts, groups } list URLs ending in "/", for links to each coach and coaching group
    const renderLoad = (container, load, strings, urls = {}) => {
        const table = (head, body) => `<table class="gm-tl-watch"><thead><tr>${head.map((label) => `<th>${S.escape(label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
        const parts = [];
        if (load.coaches.length) {
            parts.push(table([strings.coach, strings.active_groups], load.coaches.map((coach) => `<tr><td>${recordLink(coach, urls.contacts)}</td><td>${coach.count}</td></tr>`).join('')));
        }
        if (load.coachingGroups.length) {
            parts.push(table([strings.coaching_group, strings.active_groups, strings.members, strings.groups_per_member],
                load.coachingGroups.map((group) => `<tr><td>${recordLink(group, urls.groups)}</td><td>${group.groups}</td><td>${group.members}</td><td>${(group.groups / group.members).toFixed(1)}</td></tr>`).join('')));
        }
        container.innerHTML = parts.length ? parts.join('') : `<p class="gm-tl-note">${S.escape(strings.coaching_load_none)}</p>`;
    };

    window.GenMapperTimelineWatch = {
        CATEGORIES, analyse, reason, matchesCategory, flagMark, flagTip, flagListHtml, renderList, renderLoad, format,
    };
})();
