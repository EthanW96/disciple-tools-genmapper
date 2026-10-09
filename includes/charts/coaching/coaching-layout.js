// Coaching groups on the Groups chart: works out which groups each coaching group
// encloses and reserves a slot for its triangle at the same generation.
// decorate() never changes the chart's data; it returns a new list for layout.
(function () {
    'use strict';

    const PALETTE = ['#d1495b', '#3d85c6', '#2a9d8f', '#e0912f', '#8e5bb5', '#5c946e', '#c06c84', '#4a6fa5'];
    const ROOT_ID = 0;

    const key = (id) => String(id);
    const coachingOf = (row) => (row && !row.spacer && Array.isArray(row.coaching) ? row.coaching : []);

    // Every coaching group on the chart with a stable colour (sorted by name)
    const coachingGroups = (rows) => {
        const byId = new Map();
        rows.forEach((row) => coachingOf(row).forEach((group) => byId.set(key(group.id), group)));
        return Array.from(byId.values())
            .sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id - b.id)
            .map((group, index) => ({ ...group, color: PALETTE[index % PALETTE.length] }));
    };

    const colorMap = (rows) => new Map(coachingGroups(rows).map((group) => [key(group.id), group.color]));

    const childrenByParent = (rows) => {
        const map = new Map();
        rows.forEach((row) => {
            const parent = key(row.parentId);
            map.set(parent, (map.get(parent) || []).concat(row));
        });
        return map;
    };

    // Connected pieces of one coaching group's groups: each starts at a covered group whose parent isn't covered
    const components = (rows, group, children) => {
        const covered = new Set(rows.filter((row) => coachingOf(row).some((item) => key(item.id) === key(group.id))).map((row) => key(row.id)));
        const collect = (row) => [key(row.id)].concat((children.get(key(row.id)) || [])
            .filter((child) => covered.has(key(child.id)))
            .flatMap(collect));
        return rows
            .filter((row) => covered.has(key(row.id)) && !covered.has(key(row.parentId)))
            .map((root) => ({ root, ids: collect(root) }));
    };

    const spacerRow = (group, component) => ({
        id: `coaching-${group.id}-${component.root.id}`,
        parentId: component.root.parentId,
        name: group.name,
        spacer: true,
        node_class: 'node--spacer',
        active: true,
        coaching_group: group,
        component_root: key(component.root.id),
        component_ids: component.ids,
    });

    // Siblings that share a coaching group sit together; each triangle slot goes just before its group
    const orderChildren = (children, spacersByRoot) => {
        const clusters = new Map();
        children.forEach((child) => {
            const first = coachingOf(child)[0];
            const clusterKey = first ? `c${first.id}` : `own${child.id}`;
            clusters.set(clusterKey, (clusters.get(clusterKey) || []).concat(child));
        });
        return Array.from(clusters.values()).flat()
            .flatMap((child) => (spacersByRoot.get(key(child.id)) || []).concat(child));
    };

    const decorate = (rows) => {
        if (!Array.isArray(rows) || !rows.length) {
            return rows;
        }
        const groups = coachingGroups(rows);
        if (!groups.length) {
            return rows;
        }
        // A rebased view starts at a real group; give it the hidden "source" root so triangles have a slot beside it
        const hasSource = rows.some((row) => row.id === ROOT_ID);
        const top = rows.find((row) => row.parentId === '' || row.parentId === undefined || row.parentId === null);
        const base = hasSource || !top
            ? rows
            : [{ id: ROOT_ID, parentId: '', name: 'source' }].concat(rows.map((row) => (row === top ? { ...row, parentId: ROOT_ID } : row)));

        const children = childrenByParent(base);
        const spacersByRoot = new Map();
        groups.forEach((group) => components(base, group, children).forEach((component) => {
            const rootKey = key(component.root.id);
            spacersByRoot.set(rootKey, (spacersByRoot.get(rootKey) || []).concat(spacerRow(group, component)));
        }));

        // Walk from the root so the output order sets each parent's child order for d3.stratify
        const ordered = [];
        const visit = (row) => {
            ordered.push(row);
            orderChildren(children.get(key(row.id)) || [], spacersByRoot).forEach((child) => {
                if (child.spacer) {
                    ordered.push(child);
                } else {
                    visit(child);
                }
            });
        };
        const root = base.find((row) => row.id === ROOT_ID) || base.find((row) => row.parentId === '');
        if (!root) {
            return rows;
        }
        visit(root);
        // Only use the decorated list if every original group was placed
        const placed = new Set(ordered.map((row) => key(row.id)));
        return base.every((row) => placed.has(key(row.id))) ? ordered : rows;
    };

    window.GenMapperCoachingLayout = { decorate, coachingGroups, colorMap };
})();
