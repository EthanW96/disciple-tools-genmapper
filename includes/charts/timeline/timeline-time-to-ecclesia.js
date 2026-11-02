// View C: time from start to ecclesia. A Kaplan–Meier step curve (groups that haven't become
// an ecclesia yet still count until today, shown as ticks), with the median and headline figures.
(function () {
    'use strict';

    const S = window.GenMapperTimelineSvg;
    const MIN_WIDTH = 480;
    const HEIGHT = 220;
    const PAD = { left: 44, right: 16, top: 14, bottom: 30 };
    const SMALL_SAMPLE = 10;
    const MONTH_STEP = 6;
    const HEADLINE_MONTHS = 12;

    const tiles = (result, strings) => {
        const within = `${Math.round(result.shareAt(HEADLINE_MONTHS) * 100)}%`;
        // No median until half the groups have got there: say how many have so far instead
        const soFar = strings.reached_so_far
            .replace('{reached}', result.reached)
            .replace('{total}', result.n)
            .replace('{share}', result.n ? Math.round((result.reached / result.n) * 100) : 0);
        const half = result.median === null
            ? `${S.escape(strings.not_reached_yet)} <span>${S.escape(soFar)}</span>`
            : S.escape(`${Math.round(result.median)} ${strings.months}`);
        return `<div class="gm-tl-tiles">
            <div class="gm-tl-tile"><small>${S.escape(strings.median_time)}</small><b>${half}</b></div>
            <div class="gm-tl-tile"><small>${S.escape(strings.within_12_months)}</small><b>${S.escape(within)}</b></div>
            <div class="gm-tl-tile"><small>${S.escape(strings.groups_counted)}</small><b>${result.n} <span>(${result.censored.length} ${S.escape(strings.still_on_their_way)})</span></b></div>
        </div>`;
    };

    const render = (container, result, strings) => {
        container.innerHTML = tiles(result, strings);
        if (!result.n) {
            container.insertAdjacentHTML('beforeend', `<p class="gm-tl-note">${S.escape(strings.no_groups)}</p>`);
            return;
        }
        if (result.n < SMALL_SAMPLE) {
            container.insertAdjacentHTML('beforeend', `<p class="gm-tl-note">${S.escape(strings.small_sample)}</p>`);
        }
        const width = Math.max(MIN_WIDTH, container.clientWidth || MIN_WIDTH);
        const longest = Math.max(HEADLINE_MONTHS, ...result.observations.map((o) => o.t));
        const tMax = Math.ceil(longest / MONTH_STEP) * MONTH_STEP;
        const x = S.scale(0, tMax, PAD.left, width - PAD.right);
        const y = (share) => HEIGHT - PAD.bottom - share * (HEIGHT - PAD.top - PAD.bottom);
        const tip = S.tooltip(container);
        const svg = S.svg(container, width, HEIGHT, strings.time_to_ecclesia_label);

        [0, 0.25, 0.5, 0.75, 1].forEach((share) => {
            S.el(svg, 'line', { x1: PAD.left, x2: width - PAD.right, y1: y(share), y2: y(share), class: share ? 'gm-tl-grid' : 'gm-tl-axis' });
            S.el(svg, 'text', { x: PAD.left - 6, y: y(share) + 4, 'text-anchor': 'end', class: 'gm-tl-tick' }, `${share * 100}%`);
        });
        for (let t = 0; t <= tMax; t += MONTH_STEP) {
            S.el(svg, 'text', { x: x(t), y: HEIGHT - PAD.bottom + 16, 'text-anchor': 'middle', class: 'gm-tl-tick' }, `${t} ${strings.months_short}`);
        }

        let path = `M${x(0)},${y(0)}`;
        result.curve.slice(1).forEach((point) => {
            path += ` H${x(point.t)} V${y(point.share)}`;
        });
        path += ` H${x(tMax)}`;
        S.el(svg, 'path', { d: path, class: 'gm-tl-curve' });

        // Groups still on their way: a tick where they stand today
        result.censored.forEach((o) => {
            const cx = x(o.t);
            const cy = y(result.shareAt(o.t));
            S.el(svg, 'line', { x1: cx, x2: cx, y1: cy - 5, y2: cy + 5, class: 'gm-tl-censor' });
        });

        if (result.median !== null) {
            S.el(svg, 'line', { x1: x(result.median), x2: x(result.median), y1: y(0.5), y2: y(0), class: 'gm-tl-median' });
            S.el(svg, 'text', { x: x(result.median) + 4, y: y(0.5) - 6, class: 'gm-tl-label gm-tl-label--strong' }, `${strings.median} ${Math.round(result.median)} ${strings.months}`);
        }

        result.curve.slice(1).forEach((point) => {
            const hit = S.el(svg, 'rect', { x: x(point.t) - 7, y: y(point.share) - 7, width: 14, height: 14, class: 'gm-tl-hit' });
            tip.attach(hit, `${Math.round(point.t)} ${S.escape(strings.months_after_start)}<br><b>${Math.round(point.share * 100)}%</b> ${S.escape(strings.had_become_ecclesia)}`);
        });
    };

    window.GenMapperTimelineTimeToEcclesia = { render };
})();
