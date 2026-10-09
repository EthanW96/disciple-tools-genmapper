// One-page overview for the print pack: the whole tree drawn sideways.
// Generations are columns; groups stack down the page, one row per branch end,
// so even ~100 groups keep readable names on a single sheet.
(function () {
    'use strict';

    const common = window.GenMapperPrintCommon;

    const MAX_TREE_COLUMNS = 3;
    const COLUMN_GAP_PT = 14;
    const GEN_HEADER_PT = 14;
    const TREE_GAP_ROWS = 0.6;
    const MAX_NAME_PT = 11;
    const LEADER_RATIO = 0.78; // leader text size relative to the name
    const NAME_WEIGHT = 700;
    const SPINE_GAP_PT = 5; // room before the next generation for the connector
    // Vertical space one row needs, as multiples of the name size plus fixed gaps (pt):
    // name ascent above the connector line, leader (with descenders) below it
    const NAME_ASCENT = 0.8;
    const LEADER_EXTENT = 1.05;
    const ROW_GAPS_PT = 3;
    const NAME_BASELINE_GAP_PT = 1.5; // name baseline sits this far above the connector line
    const LEADER_GAP_PT = 1;
    const TEXT_GAP_PT = 2; // between circle, text and health grid

    // Where things sit inside one generation cell (x relative to the cell, y relative to the row line).
    // With health on, a square 3x3 icon grid as tall as the name + leader block sits right of the text.
    const cellGeometry = (fontSize, genWidth, withHealth) => {
        const leaderSize = fontSize * LEADER_RATIO;
        const radius = fontSize * 0.5;
        const blockTop = NAME_BASELINE_GAP_PT + NAME_ASCENT * fontSize;
        const blockHeight = blockTop + LEADER_GAP_PT + LEADER_EXTENT * leaderSize;
        const gridSize = withHealth ? blockHeight : 0;
        const textLeft = radius * 2 + TEXT_GAP_PT;
        const gridLeft = genWidth - SPINE_GAP_PT - gridSize;
        const textWidth = gridLeft - (withHealth ? TEXT_GAP_PT : 0) - textLeft;
        return { leaderSize, radius, blockTop, gridSize, textLeft, gridLeft, textWidth };
    };

    const leafCount = common.realLeafCount; // coaching triangle slots don't take rows

    // Spread trees over `count` columns, balancing rows, keeping the original order inside each column
    const splitIntoColumns = (trees, count) => {
        const columns = Array.from({ length: count }, () => ({ trees: [], rows: 0 }));
        trees
            .map((tree, index) => ({ tree, index, rows: leafCount(tree) }))
            .sort((a, b) => b.rows - a.rows)
            .forEach((item) => {
                const target = columns.reduce((best, column) => (column.rows < best.rows ? column : best));
                target.trees.push(item);
                target.rows += item.rows + TREE_GAP_ROWS;
            });
        return columns
            .filter((column) => column.trees.length)
            .map((column) => ({
                trees: column.trees.sort((a, b) => a.index - b.index).map((item) => item.tree),
                rows: column.rows - TREE_GAP_ROWS,
            }));
    };

    const PEOPLE_ICON_RATIO = 0.85; // icon size relative to the name
    const PEOPLE_GAP_RATIO = 0.3;

    // Member Count after the name: "Name [icon]12" (empty when the setting is off)
    const peopleText = (node) => (common.showPeopleCount() ? String(node.data.people_count || 0) : '');
    const peopleWidthAt = (node, size) => {
        const text = peopleText(node);
        return text ? size * (PEOPLE_GAP_RATIO * 2 + PEOPLE_ICON_RATIO) + common.measure(text, size) : 0;
    };

    // Size for the longest name (plus its people count) so no group name gets cut off
    const widestNameAt1pt = (trees) => Math.max(1, ...trees.flatMap(common.realDescendants)
        .map((node) => common.measure(node.data.name, 1, NAME_WEIGHT) + peopleWidthAt(node, 1)));

    // Try 1..3 tree columns and keep the arrangement that gives the biggest names
    const planLayout = (trees, page) => {
        const box = common.contentBox(page);
        const generations = Math.max(1, ...trees.map((tree) => common.realHeight(tree) + 1));
        const nameWidth = widestNameAt1pt(trees);
        const withHealth = common.showHealth();
        let best = null;
        for (let count = 1; count <= Math.min(MAX_TREE_COLUMNS, trees.length); count++) {
            const columns = splitIntoColumns(trees, count);
            const columnWidth = (box.w - COLUMN_GAP_PT * (columns.length - 1)) / columns.length;
            const genWidth = columnWidth / generations;
            const rows = Math.max(...columns.map((column) => column.rows));
            const rowHeight = (box.h - GEN_HEADER_PT) / rows;
            const fontByHeight = (rowHeight - ROW_GAPS_PT) / (NAME_ASCENT + LEADER_RATIO * LEADER_EXTENT);
            // Text width shrinks linearly with font size (circle and icon grid grow): width(f) = a - b·f
            const widthAtZero = cellGeometry(0, genWidth, withHealth).textWidth;
            const shrinkPerPt = widthAtZero - cellGeometry(1, genWidth, withHealth).textWidth;
            const fontByWidth = widthAtZero / (nameWidth + shrinkPerPt);
            const fontSize = Math.min(MAX_NAME_PT, fontByHeight, fontByWidth);
            if (!best || fontSize > best.fontSize) {
                best = { columns, columnWidth, genWidth, rowHeight, fontSize, generations, box, withHealth };
            }
        }
        return best;
    };

    // Row position for every node: branch ends get the next row, parents sit between their children
    const assignRows = (tree, startRow) => {
        const rows = new Map();
        let next = startRow;
        const visit = (node) => {
            const children = common.realChildren(node);
            if (!children.length) {
                rows.set(node, next);
                next += 1;
                return;
            }
            children.forEach(visit);
            rows.set(node, (rows.get(children[0]) + rows.get(children[children.length - 1])) / 2);
        };
        visit(tree);
        return { rows, nextRow: next };
    };

    const drawNode = (node, x, y, layout) => {
        const nameSize = layout.fontSize;
        const cell = cellGeometry(nameSize, layout.genWidth, layout.withHealth);
        const textX = x + cell.textLeft;
        const peopleWidth = peopleWidthAt(node, nameSize);
        const name = common.fitText(node.data.name, cell.textWidth - peopleWidth, nameSize, NAME_WEIGHT);
        const nameEnd = textX + common.measure(name, nameSize, NAME_WEIGHT);
        const leader = common.fitText(node.data.coach, cell.textWidth, cell.leaderSize);
        const inactive = node.data.active ? '' : ' pp-inactive';
        const health = layout.withHealth
            ? `<g class="pp-health${inactive}">${common.healthGridMarkup(node.data, x + cell.gridLeft, y - cell.blockTop, cell.gridSize / 3)}</g>`
            : '';
        return common.circleMarkup(node.data, x + cell.radius, y, cell.radius)
            + `<text x="${textX}" y="${y - NAME_BASELINE_GAP_PT}" class="pp-name${inactive}" style="font-size:${nameSize}px">${common.escapeText(name)}</text>`
            + (leader ? `<text x="${textX}" y="${y + LEADER_GAP_PT + cell.leaderSize * NAME_ASCENT}" class="pp-leader" style="font-size:${cell.leaderSize}px">${common.escapeText(leader)}</text>` : '')
            + peopleMarkup(node, nameEnd, y, nameSize)
            + health;
    };

    const peopleMarkup = (node, x, y, size) => {
        const text = peopleText(node);
        if (!text) {
            return '';
        }
        const iconSize = size * PEOPLE_ICON_RATIO;
        const iconX = x + size * PEOPLE_GAP_RATIO;
        const baseline = y - NAME_BASELINE_GAP_PT;
        return `<image href="${common.escapeText(common.peopleIcon())}" x="${iconX}" y="${baseline - iconSize * 0.9}" width="${iconSize}" height="${iconSize}"/>`
            + `<text x="${iconX + iconSize + size * PEOPLE_GAP_RATIO}" y="${baseline}" class="pp-count" style="font-size:${size}px">${common.escapeText(text)}</text>`;
    };

    // Bracket connector: along the parent's row, down a spine, then across to each child
    const drawConnectors = (node, position, layout) => {
        const children = common.realChildren(node);
        if (!children.length) {
            return '';
        }
        const cell = cellGeometry(layout.fontSize, layout.genWidth, layout.withHealth);
        const parent = position(node);
        const spineX = parent.x + layout.genWidth - SPINE_GAP_PT / 2;
        const childPoints = children.map(position);
        const top = Math.min(parent.y, ...childPoints.map((point) => point.y));
        const bottom = Math.max(parent.y, ...childPoints.map((point) => point.y));
        // Along the parent's row between its name and leader, stepping around the icon grid
        const alongRow = layout.withHealth
            ? `M${parent.x + cell.radius * 2},${parent.y} H${parent.x + cell.gridLeft - 1} M${parent.x + cell.gridLeft + cell.gridSize},${parent.y} H${spineX}`
            : `M${parent.x + cell.radius * 2},${parent.y} H${spineX}`;
        return `<path class="pp-connector" d="${alongRow} M${spineX},${top} V${bottom} `
            + childPoints.map((point) => `M${spineX},${point.y} H${point.x}`).join(' ') + '"/>';
    };

    const drawColumn = (column, columnX, layout) => {
        const firstGeneration = Math.min(...column.trees.map(common.generationOf));
        const top = layout.box.y + GEN_HEADER_PT;
        const t = common.strings();
        let markup = '';
        for (let level = 0; level < layout.generations; level++) {
            markup += `<text x="${columnX + level * layout.genWidth}" y="${layout.box.y + 8}" class="pp-gen">${common.escapeText(`${t.gen_prefix} ${firstGeneration + level}`)}</text>`;
        }
        let startRow = 0;
        column.trees.forEach((tree) => {
            const { rows, nextRow } = assignRows(tree, startRow);
            const baseGeneration = common.generationOf(tree) - firstGeneration;
            const position = (node) => ({
                x: columnX + (baseGeneration + node.depth - tree.depth) * layout.genWidth,
                y: top + (rows.get(node) + 0.5) * layout.rowHeight,
            });
            const nodes = common.realDescendants(tree);
            markup += nodes.map((node) => drawConnectors(node, position, layout)).join('');
            markup += nodes.map((node) => {
                const point = position(node);
                return drawNode(node, point.x, point.y, layout);
            }).join('');
            startRow = nextRow + TREE_GAP_ROWS;
        });
        return markup;
    };

    const OVERVIEW_CSS = `
        .pp-overview .pp-name { font-family: Helvetica, Arial, sans-serif; font-weight: 700; fill: #000; }
        .pp-overview .pp-name.pp-inactive { fill: #888; }
        .pp-overview .pp-leader { font-family: Helvetica, Arial, sans-serif; fill: #555; }
        .pp-overview .pp-count { font-family: Helvetica, Arial, sans-serif; fill: #444; }
        .pp-overview .pp-gen { font: 700 8px Helvetica, Arial, sans-serif; fill: #777; }
        .pp-overview .pp-connector { fill: none; stroke: #bbb; stroke-width: .6; }
        .pp-overview .pp-health.pp-inactive { opacity: .5; }
    `;

    // Returns { markup, fontSize } for the overview page, or null when there is nothing to draw
    const build = (trees, page) => {
        if (!trees.length) {
            return null;
        }
        const layout = planLayout(trees, page);
        const t = common.strings();
        const summary = common.summarize(trees);
        const header = common.headerMarkup(page, `${t.chart_label} — ${t.overview_title}`, t.overview_subtitle, summary);
        let columnX = layout.box.x;
        const columns = layout.columns.map((column) => {
            const markup = drawColumn(column, columnX, layout);
            columnX += layout.columnWidth + COLUMN_GAP_PT;
            return markup;
        }).join('');
        return {
            markup: `<style>${OVERVIEW_CSS}</style>${header}<g class="pp-overview">${columns}</g>`,
            fontSize: layout.fontSize,
        };
    };

    const estimate = (trees, page) => (trees.length ? planLayout(trees, page).fontSize : 0);

    window.GenMapperPrintOverview = { build, estimate };
})();
