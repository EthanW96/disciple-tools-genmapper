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
        fetch(`${config.root}dt/v1/genmapper/timeline?group=${groupId}`, { headers: { 'X-WP-Nonce': config.nonce } })
            .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
            .then(({ ok, body }) => {
                const group = ok && body && Array.isArray(body.groups) ? body.groups[0] : null;
                if (!group) {
                    throw new Error((body && body.message) || strings.load_failed);
                }
                const now = Math.floor(Date.now() / 1000);
                tile.innerHTML = `<div class="gm-tl">${S.legend(strings)}<div class="gm-tl-view" id="genmapper-timeline-journey"></div></div>`;
                window.GenMapperTimelineJourney.render(document.getElementById('genmapper-timeline-journey'), group, window.GenMapperTimelineData.stages(group, now), strings, now, { minWidth: TILE_MIN_WIDTH });
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
