// View A: one group's journey. Its stages as one bar, events in lanes below,
// and labels for when it started, became an ecclesia and ended.
(function () {
    'use strict';

    const S = window.GenMapperTimelineSvg;
    const DAY = 86400;
    const MIN_WIDTH = 480;
    const HEIGHT = 178;
    const PAD = { left: 16, right: 24 };
    const BAR = { y: 66, height: 18 };
    const LANES = { health: 98, baptism: 116, multiplied: 134, coach: 152 };
    const AXIS = { top: 34, bottom: 160 };
    const SAME_DAY_GAP = 7 * DAY; // "entered in D.T." only shown when it differs from the start by more than this

    // options.minWidth: narrowest drawing width (the record tile is narrower than the Metrics page)
    const render = (container, group, stage, strings, now, options = {}) => {
        container.innerHTML = '';
        if (!stage.start) {
            container.insertAdjacentHTML('beforeend', `<p class="gm-tl-note">${S.escape(strings.no_start_date)}</p>`);
            return;
        }
        const minWidth = options.minWidth || MIN_WIDTH;
        const width = Math.max(minWidth, container.clientWidth || minWidth);
        const until = Math.min(stage.end || now, now);
        const eventTimes = (group.events || []).filter((event) => LANES[event.kind]).map((event) => event.time);
        const from = Math.min(stage.start, group.created || stage.start) - 15 * DAY;
        const to = Math.max(until, ...eventTimes) + 15 * DAY;
        const x = S.scale(from, to, PAD.left, width - PAD.right);
        const tip = S.tooltip(container);
        const svg = S.svg(container, width, HEIGHT, `${strings.timeline_of} ${group.name}`);

        S.timeAxis(svg, from, to, x, AXIS.top, AXIS.bottom);

        stage.segments.forEach((segment) => {
            const bar = S.el(svg, 'rect', {
                x: x(segment.from) + 1, y: BAR.y, width: Math.max(2, x(segment.to) - x(segment.from) - 2), height: BAR.height, rx: 4,
                class: `gm-tl-${segment.stage}`,
            });
            const toLabel = segment.to >= now - DAY ? strings.today : S.formatDate(segment.to);
            tip.attach(bar, `<b>${S.escape(S.stageName(segment.stage, strings))}</b><br>${S.escape(S.formatDate(segment.from))} – ${S.escape(toLabel)}`);
        });

        S.el(svg, 'text', { x: x(stage.start), y: BAR.y - 8, class: 'gm-tl-label' }, `${strings.started} ${S.formatDate(stage.start)}`);
        if (group.created && Math.abs(group.created - stage.start) > SAME_DAY_GAP) {
            const marker = S.el(svg, 'circle', { cx: x(group.created), cy: BAR.y + BAR.height / 2, r: 4, class: 'gm-tl-created' });
            tip.attach(marker, `<b>${S.escape(strings.entered_in_dt)}</b><br>${S.escape(S.formatDate(group.created))}`);
        }
        if (stage.ecclesia) {
            const ex = x(stage.ecclesia);
            const monthsTaken = Math.round((stage.ecclesia - stage.start) / window.GenMapperTimelineData.SECONDS_PER_MONTH);
            S.el(svg, 'line', { x1: ex, x2: ex, y1: 20, y2: BAR.y + BAR.height + 4, class: 'gm-tl-milestone' });
            const label = `${strings.became} ${strings.ecclesia} · ${monthsTaken} ${strings.months}${stage.ecclesiaSource === 'log' ? ` (${strings.recorded})` : ''}`;
            const anchor = ex > width * 0.7 ? 'end' : 'start';
            S.el(svg, 'text', { x: anchor === 'end' ? ex - 4 : ex + 4, y: 24, class: 'gm-tl-label gm-tl-label--strong', 'text-anchor': anchor }, label);
        }
        if (stage.end) {
            S.el(svg, 'text', { x: x(stage.end) + 4, y: BAR.y + BAR.height - 4, class: 'gm-tl-label' }, `${strings.ended} ${S.formatDate(stage.end)}`);
        }
        (group.events || []).filter((event) => LANES[event.kind]).forEach((event) => {
            S.eventMark(svg, event, x(event.time), LANES[event.kind], tip, strings);
        });
    };

    window.GenMapperTimelineJourney = { render };
})();
