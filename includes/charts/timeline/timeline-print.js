// Timelines print-out on A4 landscape sheets. The swimlanes are cut into sheets that tape
// together top to bottom: same time scale on every sheet, the previous sheet's last row repeated
// (greyed) under a dashed trim line, and registration ticks and crosses where the sheets join.
(function () {
    'use strict';

    const S = window.GenMapperTimelineSvg;
    const W = window.GenMapperTimelineWatch;
    const Layout = window.GenMapperTimelinePrintLayout;

    // A4 landscape with a 10 mm safe area; drawings are made at 4 px per mm of the content width
    const SHEET = { width: 297, height: 210, margin: 10 };
    const CONTENT = { width: SHEET.width - 2 * SHEET.margin, height: SHEET.height - 2 * SHEET.margin };
    const PX_PER_MM = 4;
    const SWIMLANE_WIDTH_PX = CONTENT.width * PX_PER_MM;
    const CHART_WIDTH_PX = 640; // views C, D and the journey: narrower drawing = larger print
    const HEADER_MM = 12;
    const FOOTER_MM = 7;
    const LEGEND_MM = 5; // swimlane sheets only
    const WATCH_HEAD_MM = 8;
    const MARK = { tick: 12, cross: 10 }; // px
    const STYLE_SOURCES = ['/timeline/timeline.css', '/timeline/timeline-print.css'];

    const mm = (value) => `${value.toFixed(2)}mm`;

    // The page's own timeline styles, copied into the print document
    const styles = () => Array.from(document.styleSheets)
        .filter((sheet) => sheet.href && STYLE_SOURCES.some((source) => sheet.href.split('?')[0].endsWith(source)))
        .map((sheet) => {
            try {
                return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
            } catch (error) {
                console.error('Timelines print: could not read styles', sheet.href, error);
                return '';
            }
        }).join('\n');

    // Draws with a page renderer into an off-screen container of a fixed width
    const offscreen = (widthPx, draw) => {
        const holder = document.createElement('div');
        holder.className = 'gm-tl';
        holder.style.cssText = `position:absolute;left:-20000px;top:0;width:${widthPx}px;visibility:hidden`;
        const view = document.createElement('div');
        view.className = 'gm-tl-view';
        holder.appendChild(view);
        document.body.appendChild(holder);
        try {
            draw(view);
            view.querySelectorAll('.gm-tl-tip').forEach((tip) => tip.remove());
            return view;
        } finally {
            holder.remove();
        }
    };

    // ---- Swimlanes, tiled for taping ----

    const svgWindow = (inner, y0, heightPx, extra = '') => `<svg class="gm-tl-svg gm-print-window" viewBox="0 ${y0} ${SWIMLANE_WIDTH_PX} ${heightPx}"
        width="${mm(CONTENT.width)}" height="${mm(heightPx / PX_PER_MM)}" preserveAspectRatio="xMinYMin meet">${inner}${extra}</svg>`;

    const crosses = (y, className) => [8, SWIMLANE_WIDTH_PX - 8].map((x) => `<g class="${className}">
        <line x1="${x - MARK.cross}" x2="${x + MARK.cross}" y1="${y}" y2="${y}"/><line x1="${x}" x2="${x}" y1="${y - MARK.cross}" y2="${y + MARK.cross}"/></g>`).join('');

    const ticks = (xs, y1, y2) => xs.map((x) => `<line class="gm-print-tick" x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"/>`).join('');

    const swimlaneSheets = (context) => {
        const geometry = window.GenMapperTimelineSwimlanes.GEOMETRY;
        const view = offscreen(SWIMLANE_WIDTH_PX, (container) => window.GenMapperTimelineSwimlanes.render(
            container, context.rows, context.stageById, context.range, context.strings, () => {}, context.drawFlags));
        const svg = view.querySelector('svg');
        if (!svg) {
            return [];
        }
        // Grid and axis go on every window; each window only carries its own rows
        const children = Array.from(svg.children);
        const base = children.filter((child) => !child.classList.contains('gm-tl-row')).map((child) => child.outerHTML).join('');
        const rowMarkup = children.filter((child) => child.classList.contains('gm-tl-row')).map((child) => child.outerHTML);
        const gridXs = Array.from(new Set(Array.from(svg.querySelectorAll('line.gm-tl-grid')).map((line) => Number(line.getAttribute('x1')))));
        const axisY = geometry.TOP + context.rows.length * geometry.ROW;
        const axis = svgWindow(base, axisY - 1, geometry.AXIS_SPACE);
        const rowsHeightMm = CONTENT.height - HEADER_MM - LEGEND_MM - FOOTER_MM - 2 * (geometry.AXIS_SPACE / PX_PER_MM);
        const pages = Layout.paginateRows(context.rows.length, Math.floor(rowsHeightMm / (geometry.ROW / PX_PER_MM)));
        const strings = context.strings;

        return pages.map((page, index) => {
            const first = page.overlap === null ? page.from : page.overlap;
            const y0 = geometry.TOP + first * geometry.ROW;
            const height = (page.to - first) * geometry.ROW;
            const isLast = index === pages.length - 1;
            let extra = '';
            if (page.overlap !== null) {
                // Trim here: this greyed row lies over the last row of the sheet before
                extra += `<rect class="gm-print-overlap" x="0" y="${y0}" width="${SWIMLANE_WIDTH_PX}" height="${geometry.ROW}"/>
                    <line class="gm-print-trim" x1="0" x2="${SWIMLANE_WIDTH_PX}" y1="${y0 + 0.5}" y2="${y0 + 0.5}"/>
                    ${ticks(gridXs, y0, y0 + MARK.tick)}${crosses(y0, 'gm-print-cross')}`;
            }
            if (!isLast) {
                // Join line along the top of the last row, which the next sheet repeats
                const joinY = geometry.TOP + (page.to - 1) * geometry.ROW;
                extra += `<line class="gm-print-join" x1="0" x2="${SWIMLANE_WIDTH_PX}" y1="${joinY}" y2="${joinY}"/>
                    ${ticks(gridXs, joinY - MARK.tick, joinY)}${crosses(joinY, 'gm-print-cross')}`;
            }
            const notes = [];
            if (index === 0) {
                notes.push(strings.print_actual_size);
            }
            if (page.overlap !== null) {
                notes.push(strings.print_trim_note);
            }
            if (!isLast) {
                notes.push(strings.print_join_note);
            }
            return {
                section: strings.swimlanes,
                swimlanePart: index + 1,
                body: `${axis}${svgWindow(base + rowMarkup.slice(first, page.to).join(''), y0, height, extra)}${axis}`,
                notes,
            };
        });
    };

    // ---- Other sections ----

    const watchSheets = (context) => {
        const strings = context.strings;
        const analysis = context.analysis;
        const rows = context.groups
            .map((group) => ({ group, flags: (analysis.flagsById.get(group.id) || []).filter((flag) => W.matchesCategory([flag], context.category)) }))
            .filter((row) => row.flags.length)
            .sort((a, b) => b.flags[0].severity - a.flags[0].severity || a.group.name.localeCompare(b.group.name));
        if (!rows.length) {
            return [{ section: strings.health_watch, body: `<p>${S.escape(strings.watch_none)}</p>`, notes: [] }];
        }
        const head = `<thead><tr><th>${S.escape(strings.name)}</th><th>${S.escape(strings.what_to_check)}</th><th>${S.escape(strings.since)}</th></tr></thead>`;
        const rowHtml = ({ group, flags }) => `<tr>
            <td>${S.escape(group.name)}</td>
            <td>${flags.map((flag) => `<div><span class="gm-tl-flag-icon">!</span>${S.escape(W.reason(flag, strings, analysis.settings))}</div>`).join('')}</td>
            <td>${S.escape(S.formatDate(Math.min(...flags.map((flag) => flag.since))))}</td></tr>`;
        const table = (sheetRows) => `<table class="gm-print-watch">${head}<tbody>${sheetRows.map(rowHtml).join('')}</tbody></table>`;
        const heights = measureRows(table(rows));
        const room = CONTENT.height - HEADER_MM - FOOTER_MM - WATCH_HEAD_MM;
        return Layout.paginateByHeight(rows.map((row, index) => ({ row, height: heights[index] })), (item) => item.height, room)
            .map((items) => ({ section: strings.health_watch, body: table(items.map((item) => item.row)), notes: [] }));
    };

    const chartSheet = (section, caption, draw) => {
        const view = offscreen(CHART_WIDTH_PX, draw);
        return { section, body: `<p class="gm-print-caption">${S.escape(caption)}</p><div class="gm-print-chart">${view.innerHTML}</div>`, notes: [] };
    };

    // Row heights (mm) of a table laid out at the printed width with the print styles
    const measureRows = (tableHtml) => {
        const holder = document.createElement('div');
        holder.className = 'gm-print';
        holder.style.cssText = `position:absolute;left:-20000px;top:0;width:${CONTENT.width}mm;visibility:hidden`;
        holder.innerHTML = `<div class="gm-tl">${tableHtml}</div>`;
        document.body.appendChild(holder);
        try {
            const pxPerMm = holder.getBoundingClientRect().width / CONTENT.width;
            return Array.from(holder.querySelectorAll('tbody tr')).map((tr) => tr.getBoundingClientRect().height / pxPerMm);
        } finally {
            holder.remove();
        }
    };

    const sections = (context, chosen) => {
        const D = window.GenMapperTimelineData;
        const strings = context.strings;
        const stageList = context.groups.map((group) => context.stageById.get(group.id));
        const sheets = [];
        if (chosen.watch) {
            sheets.push(...watchSheets(context));
        }
        if (chosen.journey && context.selected) {
            sheets.push(chartSheet(`${strings.journey}: ${context.selected.name}`, '', (container) => {
                window.GenMapperTimelineJourney.render(container, context.selected, context.stageById.get(context.selected.id), strings, context.now);
                container.insertAdjacentHTML('beforeend', W.flagListHtml(context.analysis.flagsById.get(context.selected.id) || [], strings, context.analysis.settings));
            }));
        }
        if (chosen.swimlanes) {
            sheets.push(...swimlaneSheets(context));
        }
        if (chosen.ecclesia) {
            sheets.push(chartSheet(strings.time_to_ecclesia, strings.time_to_ecclesia_caption,
                (container) => window.GenMapperTimelineTimeToEcclesia.render(container, D.timeToEcclesia(stageList, context.now), strings)));
        }
        if (chosen.stages) {
            sheets.push(chartSheet(strings.stages_over_time, strings.stages_over_time_caption,
                (container) => window.GenMapperTimelineStages.render(container, D.monthlyCounts(stageList, context.now), context.range, strings)));
        }
        return sheets;
    };

    // Sheet numbers are only known once every section is laid out
    const documentHtml = (context, sheets) => {
        const strings = context.strings;
        const total = sheets.length;
        const swimlaneStart = sheets.findIndex((sheet) => sheet.swimlanePart);
        const body = sheets.map((sheet, index) => {
            const number = index + 1;
            const notes = sheet.notes.map((note) => W.format(note, { previous: number - 1, next: number + 1 }));
            const legend = sheet.swimlanePart ? S.legend(strings) : '';
            return `<section class="gm-print-sheet">
                <header class="gm-print-header">
                    <div><b>${S.escape(context.title)}</b> · ${S.escape(sheet.section)}${sheet.swimlanePart && swimlaneStart !== index ? ` (${S.escape(W.format(strings.print_continued, { previous: number - 1 }))})` : ''}</div>
                    <div class="gm-print-meta">${S.escape(context.filters)} · ${S.escape(strings.printed)} ${S.escape(S.formatDate(context.now))} · <b>${S.escape(W.format(strings.print_sheet_of, { number, total }))}</b></div>
                </header>
                ${legend}
                <div class="gm-print-body">${sheet.body}</div>
                <footer class="gm-print-footer">${notes.map((note) => S.escape(note)).join(' · ')}</footer>
            </section>`;
        }).join('');
        return `<!doctype html><html><head><meta charset="utf-8"><title>${S.escape(context.title)}</title>
            <style>@page { size: A4 landscape; margin: 0; }
            ${styles()}
            .gm-print-sheet { width: ${SHEET.width}mm; height: ${SHEET.height}mm; padding: ${SHEET.margin}mm; }
            .gm-print-header { height: ${HEADER_MM}mm; }
            .gm-print-footer { height: ${FOOTER_MM}mm; }
            .gm-print .gm-tl-legend { height: ${LEGEND_MM}mm; overflow: hidden; }</style>
            </head><body class="gm-print"><div class="gm-tl">${body}</div></body></html>`;
    };

    const dialogHtml = (context) => {
        const strings = context.strings;
        const option = (key, label, checked, disabled = false) => `<label><input type="checkbox" name="${key}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}> ${S.escape(label)}</label>`;
        return `<form method="dialog" class="gm-print-dialog-form">
            <h3>${S.escape(strings.print_title)}</h3>
            <p>${S.escape(strings.print_intro)}</p>
            ${option('watch', strings.health_watch, true)}
            ${option('journey', context.selected ? `${strings.journey}: ${context.selected.name}` : strings.journey, Boolean(context.selected), !context.selected)}
            ${option('swimlanes', strings.swimlanes, true)}
            ${option('ecclesia', strings.time_to_ecclesia, true)}
            ${option('stages', strings.stages_over_time, true)}
            <p class="gm-tl-caption">${S.escape(strings.print_actual_size)}</p>
            <div class="gm-print-dialog-buttons">
                <button type="submit" value="cancel" class="button hollow">${S.escape(strings.cancel)}</button>
                <button type="submit" value="print" class="button">${S.escape(strings.print)}</button>
            </div>
        </form>`;
    };

    /**
     * Asks what to include, then prints it.
     * @param {Object} context what the page shows now: title, filters (text), groups, category (watch list),
     *   rows (swimlanes), stageById, range, analysis, selected, drawFlags, strings, now
     * @param {Function} onError called with a message if printing fails
     */
    const open = (context, onError) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'gm-print-dialog';
        dialog.innerHTML = dialogHtml(context);
        document.body.appendChild(dialog);
        dialog.addEventListener('close', () => {
            const form = dialog.querySelector('form');
            const chosen = Object.fromEntries(Array.from(form.elements).filter((input) => input.type === 'checkbox').map((input) => [input.name, input.checked]));
            const confirmed = dialog.returnValue === 'print';
            dialog.remove();
            if (!confirmed) {
                return;
            }
            try {
                const sheets = sections(context, chosen);
                if (!sheets.length) {
                    onError(context.strings.print_nothing);
                    return;
                }
                if (!window.GenMapperPrintFrame.open(documentHtml(context, sheets))) {
                    onError(context.strings.print_failed);
                }
            } catch (error) {
                console.error('Timelines print: could not build the print-out', error);
                onError(context.strings.print_failed);
            }
        });
        dialog.showModal();
    };

    window.GenMapperTimelinePrint = { open, build: (context, chosen) => documentHtml(context, sections(context, chosen)) };
})();
