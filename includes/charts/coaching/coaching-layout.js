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

    // One triangle slot for a run of side-by-side components (siblings) of the same coaching group.
    // side 'after' puts the slot right of the run instead of left of it.
    const spacerRow = (group, run, side) => ({
        id: `coaching-${group.id}-${run[0].root.id}`,
        parentId: run[0].root.parentId,
        name: group.name,
        spacer: true,
        node_class: 'node--spacer',
        active: true,
        coaching_group: group,
        component_root: key(run[0].root.id),
        component_roots: run.map((component) => key(component.root.id)),
        component_ids: run.flatMap((component) => component.ids),
        slot_side: side,
    });

    // A band comes down into the run when its parent group sits inside another coaching shape.
    // Put the triangle on the side away from it: runs in the right half of the siblings get it on their right.
    const slotSide = (run, ordered, parentRow) => {
        const parentInShape = parentRow && parentRow.id !== ROOT_ID && coachingOf(parentRow).length > 0;
        if (!parentInShape) {
            return 'before';
        }
        const first = ordered.findIndex((row) => key(row.id) === key(run[0].root.id));
        const last = first + run.length - 1;
        return (first + last) / 2 >= (ordered.length - 1) / 2 ? 'after' : 'before';
    };

    // Siblings that share a coaching group sit together
    const clusterOrder = (children) => {
        const clusters = new Map();
        children.forEach((child) => {
            const first = coachingOf(child)[0];
            const clusterKey = first ? `c${first.id}` : `own${child.id}`;
            clusters.set(clusterKey, (clusters.get(clusterKey) || []).concat(child));
        });
        return Array.from(clusters.values()).flat();
    };

    // Components of one coaching group whose roots are next to each other share one triangle and shape.
    // A run breaks at a gap, or at a group that also starts another coaching group's shape.
    const siblingRuns = (orderedSiblings, componentsByRoot, group) => {
        const runs = [];
        let run = [];
        orderedSiblings.forEach((sibling) => {
            const rooted = componentsByRoot.get(key(sibling.id)) || [];
            const component = rooted.find((item) => key(item.group.id) === key(group.id));
            const startsOtherShape = rooted.length > 1;
            if (component && run.length && !startsOtherShape) {
                run.push(component);
                return;
            }
            if (run.length) {
                runs.push(run);
            }
            run = component ? [component] : [];
        });
        return run.length ? runs.concat([run]) : runs;
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
        const componentsByRoot = new Map();
        groups.forEach((group) => components(base, group, children).forEach((component) => {
            const rootKey = key(component.root.id);
            componentsByRoot.set(rootKey, (componentsByRoot.get(rootKey) || []).concat({ ...component, group }));
        }));

        // Triangle slots per parent: one per run of side-by-side components, beside the run's first or last group
        const rowsById = new Map(base.map((row) => [key(row.id), row]));
        const slotsBefore = new Map();
        const slotsAfter = new Map();
        const orderedChildren = new Map();
        const addSlot = (map, rowKey, spacer) => map.set(rowKey, (map.get(rowKey) || []).concat(spacer));
        children.forEach((siblings, parentKey) => {
            const ordered = clusterOrder(siblings);
            orderedChildren.set(parentKey, ordered);
            groups.forEach((group) => siblingRuns(ordered, componentsByRoot, group).forEach((run) => {
                const side = slotSide(run, ordered, rowsById.get(parentKey));
                const spacer = spacerRow(group, run, side);
                if (side === 'after') {
                    addSlot(slotsAfter, key(run[run.length - 1].root.id), spacer);
                } else {
                    addSlot(slotsBefore, key(run[0].root.id), spacer);
                }
            }));
        });

        // Walk from the root so the output order sets each parent's child order for d3.stratify
        const ordered = [];
        const visit = (row) => {
            ordered.push(row);
            (orderedChildren.get(key(row.id)) || []).forEach((child) => {
                (slotsBefore.get(key(child.id)) || []).forEach((spacer) => ordered.push(spacer));
                visit(child);
                (slotsAfter.get(key(child.id)) || []).forEach((spacer) => ordered.push(spacer));
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
