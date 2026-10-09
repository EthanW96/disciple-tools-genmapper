// Text helpers shared by the chart's SVG drawings (coaching shapes, print pack):
// measuring text and cutting it with "…" so it fits a width.
(function () {
    'use strict';

    const FONT_FAMILY = 'Helvetica, Arial, sans-serif';
    const ELLIPSIS = '…';

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

    window.GenMapperSvgText = { FONT_FAMILY, escapeText, measure, fitText };
})();
