// View B: movement swimlanes. One row per group (parents before children, indented
// by generation), its stages as a bar and its events on the row. Click a row to see its journey.
(function () {
    'use strict';

    const S = window.GenMapperTimelineSvg;
    const text = window.GenMapperSvgText;
    const MIN_WIDTH = 560;
    const LABEL_WIDTH = 190;
    const INDENT = 10;
    const ROW = 22;
    const BAR_HEIGHT = 10;
    const TOP = 6;
    const AXIS_SPACE = 22;
    const LABEL_SIZE = 12;

    /**
     * @param {Array<{group, depth}>} rows tree-ordered rows
     * @param {Map} stageById group id -> stages() result
     * @param {{from, to}} range visible time range (Unix seconds)
     * @param {Function} onSelect called with the group when its row is clicked
     * @param {Function} [decorateRow] draws extra marks on a row: (row, group, rowMiddleY, clampX, tip)
     */
    const render = (container, rows, stageById, range, strings, onSelect, decorateRow = null) => {
        container.innerHTML = '';
        if (!rows.length) {
            container.insertAdjacentHTML('beforeend', `<p class="gm-tl-note">${S.escape(strings.no_groups)}</p>`);
            return;
        }
        const width = Math.max(MIN_WIDTH, container.clientWidth || MIN_WIDTH);
        const height = TOP + rows.length * ROW + AXIS_SPACE;
        const x0 = LABEL_WIDTH;
        const x1 = width - 12;
        const x = S.scale(range.from, range.to, x0, x1);
        const clampX = (time) => Math.max(x0, Math.min(x1, x(time)));
        const tip = S.tooltip(container);
        const svg = S.svg(container, width, height, strings.swimlanes_label);
        S.timeAxis(svg, range.from, range.to, x, TOP, TOP + rows.length * ROW);

        rows.forEach(({ group, depth }, index) => {
            const y = TOP + index * ROW;
            const stage = stageById.get(group.id);
            const row = S.el(svg, 'g', { class: 'gm-tl-row', tabindex: 0, role: 'button', 'aria-label': `${strings.show_journey}: ${group.name}` });
            S.el(row, 'rect', { x: 0, y, width, height: ROW, class: 'gm-tl-row-bg' });
            const labelX = 4 + Math.min(depth, 6) * INDENT;
            const name = text.fitText(group.name, x0 - labelX - 8, LABEL_SIZE);
            S.el(row, 'text', { x: labelX, y: y + 15, class: 'gm-tl-row-label' }, name);
            stage.segments.forEach((segment) => {
                if (segment.to <= range.from || segment.from >= range.to) {
                    return;
                }
                const left = clampX(segment.from);
                const bar = S.el(row, 'rect', {
                    x: left + 1, y: y + (ROW - BAR_HEIGHT) / 2, width: Math.max(2, clampX(segment.to) - left - 2), height: BAR_HEIGHT, rx: 3,
                    class: `gm-tl-${segment.stage}`,
                });
                tip.attach(bar, `<b>${S.escape(group.name)}</b> · ${S.escape(S.stageName(segment.stage, strings))}<br>${S.escape(S.formatDate(segment.from))} – ${S.escape(segment.to >= range.to - 86400 ? strings.today : S.formatDate(segment.to))}`);
            });
            (group.events || []).filter((event) => event.kind !== 'type' && event.kind !== 'status')
                .filter((event) => event.time >= range.from && event.time <= range.to)
                .forEach((event) => S.eventMark(row, event, x(event.time), y + ROW / 2, tip, strings));
            if (decorateRow) {
                decorateRow(row, group, y + ROW / 2, clampX, tip);
            }
            row.addEventListener('click', () => onSelect(group));
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(group);
                }
            });
        });
    };

    window.GenMapperTimelineSwimlanes = { render };
})();
