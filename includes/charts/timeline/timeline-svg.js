// Shared drawing helpers for the group timeline views: SVG elements, one tooltip,
// time axes, event markers and the legend. Colours live in timeline.css.
(function () {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const MARK_SIZE = 10;
    const HIT_SIZE = 18; // hover target bigger than the mark

    const escape = (text) => String(text == null ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const el = (parent, tag, attrs = {}, text = null) => {
        const node = document.createElementNS(NS, tag);
        Object.keys(attrs).forEach((key) => node.setAttribute(key, attrs[key]));
        if (text !== null) {
            node.textContent = text;
        }
        if (parent) {
            parent.appendChild(node);
        }
        return node;
    };

    const svg = (container, width, height, label) => el(container, 'svg', {
        width: '100%', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label, class: 'gm-tl-svg',
    });

    // D.T. may set lang="en_US"; Intl needs "en-US"
    const locale = () => {
        const lang = (document.documentElement.lang || '').replace('_', '-');
        try {
            return Intl.DateTimeFormat.supportedLocalesOf(lang).length ? lang : undefined;
        } catch (error) {
            return undefined;
        }
    };
    const formatDate = (seconds, style = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(seconds * 1000).toLocaleDateString(locale(), style);
    const formatMonth = (seconds) => formatDate(seconds, { month: 'short', year: 'numeric' });

    const scale = (from, to, x0, x1) => (value) => x0 + ((value - from) / Math.max(1, to - from)) * (x1 - x0);

    // Year ticks for long spans, quarters for shorter ones
    const timeTicks = (from, to) => {
        const spanYears = (to - from) / (365.25 * 86400);
        const stepMonths = spanYears > 3 ? 12 : spanYears > 1 ? 6 : 3;
        const start = new Date(from * 1000);
        const cursor = new Date(Date.UTC(start.getUTCFullYear(), Math.ceil(start.getUTCMonth() / stepMonths) * stepMonths, 1));
        const ticks = [];
        while (cursor.getTime() / 1000 <= to) {
            const time = cursor.getTime() / 1000;
            ticks.push({ time, label: stepMonths === 12 ? String(cursor.getUTCFullYear()) : formatMonth(time) });
            cursor.setUTCMonth(cursor.getUTCMonth() + stepMonths);
        }
        return ticks;
    };

    const timeAxis = (parent, from, to, x, top, bottom) => {
        timeTicks(from, to).forEach((tick) => {
            el(parent, 'line', { x1: x(tick.time), x2: x(tick.time), y1: top, y2: bottom, class: 'gm-tl-grid' });
            el(parent, 'text', { x: x(tick.time) + 3, y: bottom + 13, class: 'gm-tl-tick' }, tick.label);
        });
        el(parent, 'line', { x1: x(from), x2: x(to), y1: bottom, y2: bottom, class: 'gm-tl-axis' });
    };

    // One tooltip per view container, positioned inside it (never position: fixed)
    const tooltip = (container) => {
        let tip = container.querySelector('.gm-tl-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'gm-tl-tip';
            container.appendChild(tip);
        }
        const show = (event, html) => {
            const box = container.getBoundingClientRect();
            tip.innerHTML = html;
            tip.style.display = 'block';
            tip.style.left = `${Math.min(event.clientX - box.left + 12, box.width - 260)}px`;
            tip.style.top = `${event.clientY - box.top + 12}px`;
        };
        const hide = () => {
            tip.style.display = 'none';
        };
        return { show, hide, attach: (node, html) => {
            node.addEventListener('mousemove', (event) => show(event, typeof html === 'function' ? html() : html));
            node.addEventListener('mouseleave', hide);
        } };
    };

    const eventTitle = (event, strings) => {
        const names = { baptism: strings.baptisms, coach: strings.coach_assigned, multiplied: strings.multiplied, health: strings.health_added };
        const detail = event.kind === 'baptism' ? ` (${event.count})` : event.label ? `: ${event.label}` : '';
        const when = event.source === 'log' ? `${strings.recorded_on} ${formatDate(event.time)}` : formatDate(event.time);
        return `<b>${escape(names[event.kind] || event.kind)}</b>${escape(detail)}<br>${escape(when)}`;
    };

    // Upward triangle centred on (x, y): the coaching motif used across the charts
    const triangle = (x, y, half) => `${x},${y - half} ${x + half},${y + half * 0.8} ${x - half},${y + half * 0.8}`;

    // Distinct shape per event kind (colour is never the only cue)
    const eventMark = (parent, event, x, y, tip, strings) => {
        const half = MARK_SIZE / 2;
        if (event.kind === 'baptism') {
            el(parent, 'circle', { cx: x, cy: y, r: half + 0.5, class: 'gm-tl-ev gm-tl-ev--baptism' });
        } else if (event.kind === 'coach') {
            el(parent, 'polygon', { points: triangle(x, y, half + 1), class: 'gm-tl-ev gm-tl-ev--coach' });
        } else if (event.kind === 'multiplied') {
            el(parent, 'rect', { x: x - half, y: y - half, width: MARK_SIZE, height: MARK_SIZE, rx: 1.5, class: 'gm-tl-ev gm-tl-ev--multiplied' });
        } else if (event.kind === 'health') {
            el(parent, 'line', { x1: x, x2: x, y1: y - half, y2: y + half, class: 'gm-tl-ev--health' });
        } else {
            return;
        }
        const hit = el(parent, 'rect', { x: x - HIT_SIZE / 2, y: y - HIT_SIZE / 2, width: HIT_SIZE, height: HIT_SIZE, class: 'gm-tl-hit' });
        tip.attach(hit, eventTitle(event, strings));
    };

    const legend = (strings) => `<div class="gm-tl-legend">
        <span><i class="gm-tl-swatch gm-tl-pre"></i>${escape(strings.pre_group)}</span>
        <span><i class="gm-tl-swatch gm-tl-group"></i>${escape(strings.group)}</span>
        <span><i class="gm-tl-swatch gm-tl-ecclesia"></i>${escape(strings.ecclesia)}</span>
        <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" class="gm-tl-ev--baptism"/></svg>${escape(strings.baptisms)}</span>
        <span><svg width="12" height="12" aria-hidden="true"><polygon points="${triangle(6, 6.5, 5.5)}" class="gm-tl-ev--coach"/></svg>${escape(strings.coach_assigned)}</span>
        <span><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="1" class="gm-tl-ev--multiplied"/></svg>${escape(strings.multiplied)}</span>
        <span><svg width="12" height="12" aria-hidden="true"><line x1="6" y1="1" x2="6" y2="11" class="gm-tl-ev--health"/></svg>${escape(strings.health_added)}</span>
    </div>`;

    const stageName = (stage, strings) => ({ pre: strings.pre_group, group: strings.group, ecclesia: strings.ecclesia })[stage] || stage;

    window.GenMapperTimelineSvg = { escape, el, svg, scale, timeAxis, tooltip, eventMark, eventTitle, legend, stageName, formatDate, formatMonth };
})();
