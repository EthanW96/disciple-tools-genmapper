// Draws coaching groups as SVG markup: a triangle per coaching group (in its reserved slot)
// and a shape that hugs the triangle and the groups it coaches.
// Used by the on-screen chart and the print pack, so it only returns a string.
(function () {
    'use strict';

    const text = window.GenMapperSvgText;
    const CIRCLE = typeof boxHeight !== 'undefined' ? boxHeight : 80; // church-circles/template.js
    const SLOT_WIDTH = typeof NODE_WIDTH !== 'undefined' ? NODE_WIDTH : 320;
    const LINE_HEIGHT = 20;
    // Screen geometry; print pages pass their own (see markup options)
    const DEFAULTS = {
        idPrefix: 'gm-coaching',
        slotWidth: SLOT_WIDTH,
        sideGap: 14, // keeps neighbouring shapes apart (half the gap between siblings)
        above: 46, // metric icons and people count sit above the circle
        below: CIRCLE + LINE_HEIGHT * 4 + 8, // circle plus four text lines
    };
    const CORRIDOR = 50; // width of the band joining a group to its coached child (narrow enough to clear neighbouring trees)
    const RING = 4; // outline thickness
    // A group inside several coaching groups gets nested outlines: each further shape is this much smaller there
    const NEST_STEP = RING + 5;
    const TINT_OPACITY = 0.16;
    const TRIANGLE_HALF_WIDTH = 46;
    const NAME_SIZE = 15;
    const MEMBERS_SIZE = 13;

    const pieceBox = (point, geometry, inset) => {
        const half = geometry.slotWidth / 2 - geometry.sideGap - inset;
        const radius = Math.max(8, 40 - inset);
        return `<rect x="${point.x - half}" y="${point.y - geometry.above + inset}" width="${half * 2}" height="${geometry.above + geometry.below - inset * 2}" rx="${radius}" ry="${radius}"/>`;
    };

    // Same curve as the chart's links (genmapper.js redraw)
    const corridor = (parent, child, inset) => {
        const midY = (child.y + (parent.y + CIRCLE)) / 2;
        return `<path stroke-width="${CORRIDOR - inset * 2}" d="M${child.x},${child.y}C${child.x},${midY} ${parent.x},${midY} ${parent.x},${parent.y + CIRCLE}"/>`;
    };

    const sideCorridor = (from, to, inset) => `<path stroke-width="${CORRIDOR - inset * 2}" d="M${from.x},${from.y + CIRCLE / 2}H${to.x}"/>`;

    // inset(id): how much smaller this shape is drawn at a group shared with earlier shapes
    const pieces = (component, positions, color, geometry, inset) => {
        const spacer = positions.get(component.spacerId);
        const memberIds = component.ids.filter((id) => positions.has(id));
        const links = memberIds.filter((id) => component.ids.includes(positions.get(id).parentId))
            .map((id) => corridor(positions.get(positions.get(id).parentId), positions.get(id), inset(id)));
        const side = spacer && positions.get(component.rootId) ? sideCorridor(spacer, positions.get(component.rootId), inset(component.rootId)) : '';
        return (spacer ? pieceBox(spacer, geometry, 0) : '')
            + memberIds.map((id) => pieceBox(positions.get(id), geometry, inset(id))).join('')
            + `<g fill="none" stroke="${color}" stroke-linecap="round">${links.join('')}${side}</g>`;
    };

    // For each group: the shapes (by index) that contain it, in drawing order
    const shapesByGroup = (components) => {
        const map = new Map();
        components.forEach((component, index) => component.ids.forEach((id) => map.set(id, (map.get(id) || []).concat(index))));
        return map;
    };

    const ringFilter = (id, color) => `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="${RING}" result="grown"/>
        <feComposite in="grown" in2="SourceAlpha" operator="out" result="ring"/>
        <feFlood flood-color="${color}"/>
        <feComposite in2="ring" operator="in"/>
    </filter>`;

    const triangle = (point, group, geometry) => {
        const textWidth = geometry.slotWidth - 2 * geometry.sideGap - 10;
        const name = text.fitText(group.name, textWidth, NAME_SIZE, 700);
        const members = text.fitText(group.members, textWidth, MEMBERS_SIZE);
        return `<g class="coaching-triangle" data-record-id="${text.escapeText(group.id)}" transform="translate(${point.x},${point.y})">
            <title>${text.escapeText(group.name)}${group.members ? ` — ${text.escapeText(group.members)}` : ''}</title>
            <polygon points="0,2 ${TRIANGLE_HALF_WIDTH},${CIRCLE - 2} ${-TRIANGLE_HALF_WIDTH},${CIRCLE - 2}" fill="${group.color}" fill-opacity=".85" stroke="${group.color}" stroke-width="3" stroke-linejoin="round"/>
            <text y="${CIRCLE + 16}" text-anchor="middle" style="font:700 ${NAME_SIZE}px ${text.FONT_FAMILY};fill:#000;stroke:none">${text.escapeText(name)}</text>
            <text y="${CIRCLE + 34}" text-anchor="middle" style="font:400 ${MEMBERS_SIZE}px ${text.FONT_FAMILY};fill:#444;stroke:none">${text.escapeText(members)}</text>
        </g>`;
    };

    /**
     * @param {Array} items laid-out nodes: { row, x, y, parentId } (row = the node's data)
     * @param {Object} options idPrefix (unique per drawing on a page), slotWidth, sideGap, above, below
     * @returns {string} SVG markup: tints, then outlines, then triangles
     */
    const markup = (items, options = {}) => {
        const geometry = { ...DEFAULTS, ...options };
        const idPrefix = geometry.idPrefix;
        const positions = new Map(items.map((item) => [String(item.row.id), item]));
        const components = items.filter((item) => item.row.spacer).map((item) => ({
            spacerId: String(item.row.id),
            rootId: item.row.component_root,
            ids: item.row.component_ids || [],
            group: item.row.coaching_group,
        }));
        if (!components.length) {
            return '';
        }
        const shared = shapesByGroup(components);
        const insetFor = (index) => (id) => Math.max(0, (shared.get(id) || [index]).indexOf(index)) * NEST_STEP;
        const filters = components.map((component, index) => ringFilter(`${idPrefix}-ring-${index}`, component.group.color)).join('');
        const tints = components.map((component, index) => `<g opacity="${TINT_OPACITY}" fill="${component.group.color}">${pieces(component, positions, component.group.color, geometry, insetFor(index))}</g>`).join('');
        const rings = components.map((component, index) => `<g filter="url(#${idPrefix}-ring-${index})">${pieces(component, positions, '#000', geometry, insetFor(index))}</g>`).join('');
        const triangles = components.map((component) => triangle(positions.get(component.spacerId), component.group, geometry)).join('');
        return `<defs>${filters}</defs><g class="coaching-tints">${tints}</g><g class="coaching-rings">${rings}</g><g class="coaching-triangles">${triangles}</g>`;
    };

    // Laid-out d3 nodes -> items for markup(); getRow picks the chart row from a node
    const itemsFromNodes = (nodes, getRow = (node) => node.data) => nodes.map((node) => ({
        row: getRow(node),
        x: node.x,
        y: node.y,
        parentId: node.parent ? String(getRow(node.parent).id) : '',
    }));

    window.GenMapperCoachingShapes = { markup, itemsFromNodes };
})();
