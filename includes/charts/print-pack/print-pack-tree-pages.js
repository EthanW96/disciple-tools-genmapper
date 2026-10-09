// Print pack: one page per first-generation tree, in the full egg-chart style.
// Nodes are cloned from the live chart (health icons, classes, Gen labels) and
// re-laid out with tighter spacing, then scaled to fit the page.
(function () {
    'use strict';

    const common = window.GenMapperPrintCommon;

    const CIRCLE = typeof boxHeight !== 'undefined' ? boxHeight : 80; // from church-circles/template.js
    const NODE_WIDTH = 190;
    const NODE_HEIGHT = 205;
    const NAME_SIZE = 13;
    const LEADER_SIZE = 11;
    const NAME_WEIGHT = 700;
    const TEXT_WIDTH = NODE_WIDTH - 12;
    const SPACE_ABOVE = 45; // metric icons sit above the circle
    const SPACE_BELOW = CIRCLE + 36; // circle plus name and leader lines
    const SIDE_SPACE = 60; // Gen label on the left of the circle
    const MAX_SCALE = 1.2;
    const LIVE_NODE_SELECTOR = '#genmapper-graph-svg .node';
    const BUTTON_SELECTOR = '.addNode, .removeNode, .rebaseNode';

    // Map of group id -> the <g> drawn on screen for it
    const liveNodesById = () => {
        const map = new Map();
        document.querySelectorAll(LIVE_NODE_SELECTOR).forEach((element) => {
            const datum = element.__data__;
            if (datum && datum.data) {
                map.set(String(datum.data.id), element);
            }
        });
        return map;
    };

    // Coaching triangle slots for the tree's first group live beside it, under the hidden root
    const rootSpacers = (tree) => (tree.parent ? tree.parent.children : [])
        .filter((node) => common.isSpacer(node) && node.data.component_root === String(tree.data.id));

    // Fresh hierarchy so the screen layout is never modified
    const layoutTree = (tree) => {
        const spacers = rootSpacers(tree);
        const source = spacers.length ? { synthetic: true, children: spacers.concat(tree) } : tree;
        const copy = d3.hierarchy(source, (node) => node.children);
        d3.tree().nodeSize([NODE_WIDTH, NODE_HEIGHT]).separation((a, b) => (a.parent === b.parent ? 1 : 1.15))(copy);
        const nodes = copy.descendants().filter((node) => !node.data.synthetic);
        const minX = Math.min(...nodes.map((node) => node.x)) - NODE_WIDTH / 2 - SIDE_SPACE / 2;
        const maxX = Math.max(...nodes.map((node) => node.x)) + NODE_WIDTH / 2;
        const minY = Math.min(...nodes.map((node) => node.y));
        const maxY = Math.max(...nodes.map((node) => node.y));
        return { copy, nodes, minX, minY, width: maxX - minX, height: SPACE_ABOVE + (maxY - minY) + SPACE_BELOW };
    };

    const rowOf = (node) => node.data.data;
    const isRealNode = (node) => !common.isSpacer(node.data);

    // Coaching group shapes and triangles, sized to this page's tighter node spacing
    const coachingMarkup = (layout, pageIndex) => {
        if (!window.GenMapperCoachingShapes) {
            return '';
        }
        const items = layout.nodes.map((node) => ({
            row: rowOf(node),
            x: node.x,
            y: node.y,
            parentId: node.parent && !node.parent.data.synthetic ? String(rowOf(node.parent).id) : '',
        }));
        return window.GenMapperCoachingShapes.markup(items, {
            idPrefix: `pp-coaching-${pageIndex}`,
            slotWidth: NODE_WIDTH,
            sideGap: (NODE_WIDTH - TEXT_WIDTH) / 2,
            above: SPACE_ABOVE - 6,
            below: SPACE_BELOW - 4,
        });
    };

    const fitScale = (layout, page) => {
        const box = common.contentBox(page);
        return Math.min(MAX_SCALE, box.w / layout.width, box.h / layout.height);
    };

    const textMarkup = (text, y, size, weight, color) => {
        const value = common.fitText(text, TEXT_WIDTH, size, weight);
        return value
            ? `<text y="${y}" style="font:${weight} ${size}px ${common.FONT_FAMILY};text-anchor:middle;stroke:none;fill:${color}">${common.escapeText(value)}</text>`
            : '';
    };

    const nodeMarkup = (node, liveNodes) => {
        const group = node.data.data;
        const live = liveNodes.get(String(group.id));
        let inner = '';
        if (live) {
            const clone = live.cloneNode(true);
            clone.querySelectorAll(`foreignObject, ${BUTTON_SELECTOR}`).forEach((element) => element.remove());
            inner = clone.innerHTML;
        } else {
            inner = common.circleMarkup(group, 0, CIRCLE / 2, CIRCLE / 2);
        }
        const nameColor = group.active ? '#000' : '#888';
        const classes = live ? live.getAttribute('class') : 'node';
        return `<g class="${classes}" transform="translate(${node.x},${node.y})">${inner}`
            + textMarkup(group.name, CIRCLE + 16, NAME_SIZE, NAME_WEIGHT, nameColor)
            + textMarkup(group.coach, CIRCLE + 31, LEADER_SIZE, 400, '#555')
            + '</g>';
    };

    // Same curve as the on-screen chart (genmapper.js redraw)
    const linkMarkup = (node) => {
        const parent = node.parent;
        const midY = (node.y + (parent.y + CIRCLE)) / 2;
        return `<path class="link" d="M${node.x},${node.y}C${node.x},${midY} ${parent.x},${midY} ${parent.x},${parent.y + CIRCLE}"/>`;
    };

    const locationOf = (tree) => tree.data.location || '';

    const buildPage = (tree, page, liveNodes, pageIndex) => {
        const t = common.strings();
        const layout = layoutTree(tree);
        const scale = fitScale(layout, page);
        const box = common.contentBox(page);
        const offsetX = box.x + (box.w - layout.width * scale) / 2 - layout.minX * scale;
        const offsetY = box.y + (SPACE_ABOVE - layout.minY) * scale;
        const summary = common.summarize([tree]);
        const subtitle = [locationOf(tree), tree.data.coach].filter(Boolean).join('  ·  ');
        const header = common.headerMarkup(page, `${t.chart_label} — ${tree.data.name}`, subtitle, summary);
        const links = layout.nodes.filter((node) => node.parent && !node.parent.data.synthetic && isRealNode(node)).map(linkMarkup).join('');
        const nodes = layout.nodes.filter(isRealNode).map((node) => nodeMarkup(node, liveNodes)).join('');
        return {
            markup: `${header}<g transform="translate(${offsetX},${offsetY}) scale(${scale})">${coachingMarkup(layout, pageIndex)}${links}${nodes}</g>`,
            name: tree.data.name,
            fontSize: NAME_SIZE * scale,
        };
    };

    const build = (trees, page) => {
        const liveNodes = liveNodesById();
        return trees.map((tree, index) => buildPage(tree, page, liveNodes, index));
    };

    // Name size (pt) each tree page would print at, without building it
    const estimate = (trees, page) => trees.map((tree) => ({
        name: tree.data.name,
        fontSize: NAME_SIZE * fitScale(layoutTree(tree), page),
    }));

    window.GenMapperPrintTreePages = { build, estimate };
})();
