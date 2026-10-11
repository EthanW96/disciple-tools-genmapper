// "Timeline" tile on a group's record: that group's journey (view A).
(function () {
    'use strict';

    const config = window.genTimeline;
    const S = window.GenMapperTimelineSvg;
    const strings = config.strings;
    const TILE_MIN_WIDTH = 260;

    // D.T. lays record tiles out in a masonry grid; tell it this tile changed height
    const relayoutTiles = () => {
        if (window.masonGrid && typeof window.masonGrid.masonry === 'function') {
            window.masonGrid.masonry('layout');
        }
    };

    const start = () => {
        const tile = document.getElementById('genmapper-timeline-tile');
        if (!tile) {
            return;
        }
        const groupId = parseInt(tile.getAttribute('data-group-id'), 10);
        if (!groupId) {
            return;
        }
        tile.innerHTML = `<p class="gm-tl-note">${S.escape(strings.loading)}</p>`;
        // With metrics access the whole movement loads, so flags use its pace; otherwise the default months
        const query = config.can_view_movement ? '' : `?group=${groupId}`;
        fetch(`${config.root}dt/v1/genmapper/timeline${query}`, { headers: { 'X-WP-Nonce': config.nonce } })
            .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
            .then(({ ok, body }) => {
                const groups = ok && body && Array.isArray(body.groups) ? body.groups : [];
                const group = groups.find((item) => item.id === groupId);
                if (!group) {
                    throw new Error((body && body.message) || strings.load_failed);
                }
                const now = Math.floor(Date.now() / 1000);
                const data = window.GenMapperTimelineData;
                const watch = window.GenMapperTimelineWatch;
                const stageById = new Map(groups.map((item) => [item.id, data.stages(item, now)]));
                const analysis = watch.analyse(groups, stageById, body.coaching_groups || [], config.watch, now, !config.can_view_movement);
                tile.innerHTML = `<div class="gm-tl">${S.legend(strings)}<div class="gm-tl-view" id="genmapper-timeline-journey"></div>${watch.flagListHtml(analysis.flagsById.get(groupId) || [], strings, analysis.settings)}</div>`;
                window.GenMapperTimelineJourney.render(document.getElementById('genmapper-timeline-journey'), group, stageById.get(groupId), strings, now, { minWidth: TILE_MIN_WIDTH });
                relayoutTiles();
            })
            .catch((error) => {
                console.error('Group timeline tile: could not load data', error);
                tile.innerHTML = `<p class="gm-tl-error">${S.escape(error.message || strings.load_failed)}</p>`;
                relayoutTiles();
            });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
