// Shared helpers for the Groups chart print pack: paper sizes, text fitting,
// page header (title, legend, summary numbers) and the printable document.
(function () {
    'use strict';

    // Paper sizes in points (1pt = 1/72in), portrait
    const PAPERS = {
        a4: { w: 595.28, h: 841.89 },
        letter: { w: 612, h: 792 },
        a3: { w: 841.89, h: 1190.55 },
        tabloid: { w: 792, h: 1224 },
    };
    const MARGIN_PT = 22; // ~8mm, inside most printers' printable area
    const HEADER_PT = 46;
    const MIN_FONT_PT = 6;
    const FONT_FAMILY = 'Helvetica, Arial, sans-serif';
    const ELLIPSIS = '…';

    const strings = () => (window.genPrintPack && window.genPrintPack.translations) || {};

    const pageSize = (paper, orientation) => {
        const size = PAPERS[paper] || PAPERS.a4;
        return orientation === 'portrait' ? { w: size.w, h: size.h } : { w: size.h, h: size.w };
    };

    const contentBox = (page) => ({
        x: MARGIN_PT,
        y: MARGIN_PT + HEADER_PT,
        w: page.w - MARGIN_PT * 2,
        h: page.h - MARGIN_PT * 2 - HEADER_PT,
    });

    const escapeText = (text) => String(text == null ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const measureContext = document.createElement('canvas').getContext('2d');
    const measure = (text, fontSize, weight = 400) => {
        measureContext.font = `${weight} ${fontSize}px ${FONT_FAMILY}`;
        return measureContext.measureText(String(text || '')).width;
    };

    // Cut text with "…" so it fits maxWidth (same units as fontSize)
    const fitText = (text, maxWidth, fontSize, weight = 400) => {
        const value = String(text || '');
        if (measure(value, fontSize, weight) <= maxWidth) {
            return value;
        }
        let low = 0;
        let high = value.length;
        while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (measure(value.slice(0, mid) + ELLIPSIS, fontSize, weight) <= maxWidth) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return low > 0 ? value.slice(0, low).trimEnd() + ELLIPSIS : '';
    };

    // The first-generation trees currently on screen (all trees, or the one group being viewed)
    const firstGenerationTrees = (root) => {
        if (!root) {
            return [];
        }
        return root.data && root.data.id === 0 ? (root.children || []) : [root];
    };

    const generationOf = (node) => Number(node.data.generation) || node.depth || 1;

    const summarize = (trees) => {
        const nodes = trees.flatMap((tree) => tree.descendants());
        const byGeneration = {};
        nodes.forEach((node) => {
            const generation = generationOf(node);
            byGeneration[generation] = (byGeneration[generation] || 0) + 1;
        });
        return {
            groups: nodes.length,
            churches: nodes.filter((node) => node.data.group_type === 'church').length,
            active: nodes.filter((node) => node.data.active).length,
            coached: nodes.filter((node) => node.data.coached).length,
            byGeneration,
        };
    };

    const showCoaching = () => window.genApiTemplate && window.genApiTemplate.show_coaching === '1';
    const showHealth = () => window.genApiTemplate && window.genApiTemplate.show_icons === '1';

    // Health practices in the same 3x3 arrangement as the circle on screen (church-circles/template.js)
    const HEALTH_GRID = ['giving', 'fellowship', 'communion', 'baptism', 'prayer', 'leaders', 'bible', 'praise', 'sharing'];
    const UNMET_OPACITY = 0.15;

    // [{ key, icon, label }] from the group field settings loaded by template.js
    const healthIcons = () => {
        const fields = typeof health_fields !== 'undefined' ? health_fields : {};
        return HEALTH_GRID
            .filter((key) => fields[`church_${key}`] && fields[`church_${key}`].icon)
            .map((key) => ({ key, icon: fields[`church_${key}`].icon, label: fields[`church_${key}`].label || key }));
    };

    // 3x3 grid of health icons; marked practices at full colour, the rest faded
    const healthGridMarkup = (node, x, y, cell) => healthIcons().map((item, index) => {
        const met = Boolean(node[`health_metrics_${item.key}`]);
        const size = cell * 0.92;
        return `<image href="${escapeText(item.icon)}" x="${x + (index % 3) * cell}" y="${y + Math.floor(index / 3) * cell}" width="${size}" height="${size}"${met ? '' : ` opacity="${UNMET_OPACITY}"`}/>`;
    }).join('');

    // Circle using the chart's own classes, so fill/dash/fade match the screen
    const circleMarkup = (node, cx, cy, radius) => {
        const nodeClasses = ['node', node.active ? 'node--active' : 'node--inactive'];
        if (showCoaching() && node.coached) {
            nodeClasses.push('node--coached');
        }
        if (showHealth() && node.health_metrics_commitment) {
            nodeClasses.push('health--commitment');
        }
        const typeClass = node.group_type === 'church' ? 'is-church' : 'is-not-church';
        return `<g class="${nodeClasses.join(' ')}"><circle class="node-church-box ${typeClass}" cx="${cx}" cy="${cy}" r="${radius}"/></g>`;
    };

    const LEGEND_FONT_PT = 7.5;
    const LEGEND_MIN_FONT_PT = 6;

    // Circle key (church / group / inactive / coached) then the health icon key, on one line
    const legendMarkup = (x, y, width) => {
        const t = strings();
        const circles = [
            { data: { active: true, group_type: 'church' }, label: t.legend_church },
            { data: { active: true, group_type: 'group' }, label: t.legend_group },
            { data: { active: false, group_type: 'group' }, label: t.legend_inactive },
        ];
        if (showCoaching()) {
            circles.push({ data: { active: true, group_type: 'group', coached: true }, label: t.legend_coached });
        }
        const commitment = typeof health_fields !== 'undefined' && health_fields.church_commitment;
        if (showHealth() && commitment) {
            // Green outline, as on the chart (church-circles/style.css .health--commitment)
            circles.push({ data: { active: true, group_type: 'church', health_metrics_commitment: true }, label: commitment.label });
        }
        const icons = showHealth() ? healthIcons() : [];
        const markerWidth = 11;
        const itemGap = 10;
        const labels = circles.map((item) => item.label).concat(icons.map((item) => item.label));
        const widthAt = (size) => labels.reduce((total, label) => total + markerWidth + measure(label, size) + itemGap, 0);
        const size = Math.max(LEGEND_MIN_FONT_PT, Math.min(LEGEND_FONT_PT, LEGEND_FONT_PT * width / widthAt(LEGEND_FONT_PT)));
        let cursor = x;
        const label = (text) => {
            const markup = `<text x="${cursor + markerWidth}" y="${y}" class="pp-small" style="font-size:${size}px">${escapeText(text)}</text>`;
            cursor += markerWidth + measure(text, size) + itemGap;
            return markup;
        };
        const circleItems = circles.map((item) => circleMarkup(item.data, cursor + 4, y - 3, 3.5) + label(item.label)).join('');
        const iconItems = icons.map((item) => `<image href="${escapeText(item.icon)}" x="${cursor}" y="${y - 7.5}" width="9" height="9"/>` + label(item.label)).join('');
        return circleItems + iconItems;
    };

    const statsLine = (summary) => {
        const t = strings();
        const percent = summary.groups ? Math.round((100 * summary.coached) / summary.groups) : 0;
        // "Label: count" uses the site's D.T terms as-is (no guessing at plurals of custom names)
        const parts = [
            `${t.stat_groups}: ${summary.groups}`,
            `${t.legend_church}: ${summary.churches}`,
            `${t.stat_active}: ${summary.active}`,
        ];
        if (showCoaching()) {
            parts.push(`${t.legend_coached}: ${summary.coached} (${percent}%)`);
        }
        const generations = Object.keys(summary.byGeneration).sort((a, b) => a - b)
            .map((generation) => `${t.gen_prefix} ${generation}: ${summary.byGeneration[generation]}`);
        return parts.concat(generations).join('  ·  ');
    };

    // Title, date, legend and summary numbers across the top of a page
    const headerMarkup = (page, title, subtitle, summary) => {
        const t = strings();
        const x = MARGIN_PT;
        const width = page.w - MARGIN_PT * 2;
        const printed = `${t.printed} ${t.printed_date}`;
        const details = [subtitle, statsLine(summary)].filter(Boolean).join('  ·  ');
        const line1 = MARGIN_PT + 12;
        const line2 = line1 + 12;
        const line3 = line2 + 12;
        return `<g class="pp-header">
            <text x="${x}" y="${line1}" class="pp-title">${escapeText(fitText(title, width * 0.7, 14, 700))}</text>
            <text x="${x + width}" y="${line1}" class="pp-small" text-anchor="end">${escapeText(printed)}</text>
            <text x="${x}" y="${line2}" class="pp-small">${escapeText(fitText(details, width, 8))}</text>
            ${legendMarkup(x, line3, width)}
            <line x1="${x}" x2="${x + width}" y1="${MARGIN_PT + HEADER_PT - 5}" y2="${MARGIN_PT + HEADER_PT - 5}" class="pp-rule"/>
        </g>`;
    };

    // Every CSS rule from this plugin's stylesheets, so printed nodes match the screen
    const pluginCss = () => Array.from(document.styleSheets)
        .filter((sheet) => sheet.href && sheet.href.includes('/disciple-tools-genmapper/'))
        .map((sheet) => {
            try {
                return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
            } catch (error) {
                console.error('Print pack: could not read stylesheet', sheet.href, error);
                return '';
            }
        })
        .join('\n');

    const PRINT_CSS = `
        body { margin: 0; background: #fff; font-family: ${FONT_FAMILY}; }
        .pp-page { overflow: hidden; break-after: page; page-break-after: always; }
        .pp-page:last-child { break-after: auto; page-break-after: auto; }
        .pp-page svg { display: block; }
        .pp-title { font: 700 14px ${FONT_FAMILY}; fill: #000; }
        .pp-subtitle { font: 400 9px ${FONT_FAMILY}; fill: #333; }
        .pp-small { font: 400 8px ${FONT_FAMILY}; fill: #555; }
        .pp-rule { stroke: #ccc; stroke-width: .5; }
        circle.node-church-box { fill: #fff; } /* chart CSS only fills rects; coached rule still wins */
        .pp-header .node-church-box, .pp-overview .node-church-box { stroke-width: .8; }
        .pp-header .is-not-church, .pp-overview .is-not-church { stroke-dasharray: 1.6 1.2; }
        .pp-header .node--inactive .node-church-box, .pp-overview .node--inactive .node-church-box { stroke: #bbb; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `;

    const buildDocument = (title, page, pagesMarkup) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeText(title)}</title>
<style>
@page { size: ${page.w}pt ${page.h}pt; margin: 0; }
.pp-page { width: ${page.w}pt; height: ${page.h}pt; }
${pluginCss()}
${PRINT_CSS}
</style></head><body>
${pagesMarkup.map((markup) => `<section class="pp-page"><svg xmlns="http://www.w3.org/2000/svg" width="${page.w}pt" height="${page.h}pt" viewBox="0 0 ${page.w} ${page.h}">${markup}</svg></section>`).join('\n')}
</body></html>`;

    window.GenMapperPrintCommon = {
        MARGIN_PT,
        HEADER_PT,
        MIN_FONT_PT,
        FONT_FAMILY,
        strings,
        pageSize,
        contentBox,
        escapeText,
        measure,
        fitText,
        firstGenerationTrees,
        generationOf,
        showHealth,
        healthGridMarkup,
        summarize,
        circleMarkup,
        headerMarkup,
        buildDocument,
    };
})();
