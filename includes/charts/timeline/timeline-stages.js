// View D: groups in each stage, month by month, as stacked areas with a hover crosshair.
(function () {
    'use strict';

    const S = window.GenMapperTimelineSvg;
    const MIN_WIDTH = 480;
    const HEIGHT = 220;
    const PAD = { left: 40, right: 16, top: 12, bottom: 28 };
    const STACK = ['ecclesia', 'group', 'pre']; // bottom to top
    const NICE_STEP = 5;

    const render = (container, counts, range, strings) => {
        container.innerHTML = '';
        const visible = counts.filter((c) => c.month >= range.from && c.month <= range.to);
        if (visible.length < 2) {
            container.insertAdjacentHTML('beforeend', `<p class="gm-tl-note">${S.escape(strings.no_groups)}</p>`);
            return;
        }
        const width = Math.max(MIN_WIDTH, container.clientWidth || MIN_WIDTH);
        const max = Math.max(1, ...visible.map((c) => c.pre + c.group + c.ecclesia));
        const top = Math.ceil(max / NICE_STEP) * NICE_STEP;
        const from = visible[0].month;
        const to = visible[visible.length - 1].month;
        const x = S.scale(from, to, PAD.left, width - PAD.right);
        const y = (value) => HEIGHT - PAD.bottom - (value / top) * (HEIGHT - PAD.top - PAD.bottom);
        const tip = S.tooltip(container);
        const svg = S.svg(container, width, HEIGHT, strings.stages_over_time_label);

        [0, top / 2, top].forEach((value) => {
            S.el(svg, 'line', { x1: PAD.left, x2: width - PAD.right, y1: y(value), y2: y(value), class: value ? 'gm-tl-grid' : 'gm-tl-axis' });
            S.el(svg, 'text', { x: PAD.left - 6, y: y(value) + 4, 'text-anchor': 'end', class: 'gm-tl-tick' }, Math.round(value));
        });
        S.timeAxis(svg, from, to, x, HEIGHT - PAD.bottom, HEIGHT - PAD.bottom);

        let base = visible.map(() => 0);
        STACK.forEach((stage) => {
            const tops = visible.map((c, i) => base[i] + c[stage]);
            const upper = visible.map((c, i) => `${x(c.month)},${y(tops[i])}`).join(' L');
            const lower = visible.map((c, i) => `${x(c.month)},${y(base[i])}`).reverse().join(' L');
            S.el(svg, 'path', { d: `M${upper} L${lower} Z`, class: `gm-tl-area gm-tl-${stage}` });
            base = tops;
        });

        const cross = S.el(svg, 'line', { x1: 0, x2: 0, y1: PAD.top, y2: HEIGHT - PAD.bottom, class: 'gm-tl-crosshair' });
        const hit = S.el(svg, 'rect', { x: PAD.left, y: PAD.top, width: width - PAD.left - PAD.right, height: HEIGHT - PAD.top - PAD.bottom, class: 'gm-tl-hit' });
        hit.addEventListener('mousemove', (event) => {
            const box = svg.getBoundingClientRect();
            const px = ((event.clientX - box.left) / box.width) * width;
            const index = visible.reduce((best, c, i) => (Math.abs(x(c.month) - px) < Math.abs(x(visible[best].month) - px) ? i : best), 0);
            const c = visible[index];
            cross.setAttribute('x1', x(c.month));
            cross.setAttribute('x2', x(c.month));
            cross.style.opacity = 1;
            tip.show(event, `<b>${S.escape(S.formatMonth(c.month))}</b><br>${S.escape(strings.ecclesia)} ${c.ecclesia} · ${S.escape(strings.group)} ${c.group} · ${S.escape(strings.pre_group)} ${c.pre}`);
        });
        hit.addEventListener('mouseleave', () => {
            cross.style.opacity = 0;
            tip.hide();
        });
    };

    window.GenMapperTimelineStages = { render };
})();
