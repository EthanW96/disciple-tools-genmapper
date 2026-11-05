/**
 * "Update map" print for the groups GenMapper.
 *
 * Prints the tree currently shown in the egg chart style (the same circles, health icons and
 * links as on screen) with write-in lines in the white space either side of every circle:
 * counts and location on the left, leader/coach, start date and notes on the right.
 *
 * Eggs keep a fixed, writable size, so large trees are split across pages, one location per
 * sheet. Pages are cut between eggs (never through one); links that cross a page show
 * "from <parent name> (p. N)" on the child and "more child groups: p. N" on the parent.
 */
(function () {
  'use strict';

  const settings = window.genmapperUpdateMapSettings;
  if (!settings) {
    return;
  }
  const t = settings.translations;

  const DPI = 96;
  const MARGIN_IN = 0.4;
  const GAP_X = 16;
  const GAP_Y = 24;

  // Egg geometry (CSS px). The circle is the on-screen chart's (church-circles/template.js,
  // 80px), drawn a little larger so it holds its own beside the write-in lines.
  const CIRCLE = 80;
  const EGG_SCALE = 1.15;
  const CIRCLE_PX = CIRCLE * EGG_SCALE;
  const TOP_H = 18; // generation and "from <parent>" line
  const SIDE_W = 100; // write-in lines either side of the circle
  const CENTER_W = 110;
  const CELL_W = SIDE_W * 2 + CENTER_W;
  const TEXT_H = 52; // name, leader names, page note
  const PITCH_X = CELL_W + GAP_X;
  // Vertical layout depends on whether the chart shows metric icons above the circle,
  // so it is worked out when printing (see setGeometry).
  let ABOVE = 0;
  let CIRCLE_TOP = 0;
  let TEXT_Y = 0;
  let CELL_H = 0;
  let PITCH_Y = 0;
  function setGeometry() {
    const metricsShown =
      window.genApiTemplate && window.genApiTemplate.show_metrics === '1';
    ABOVE = Math.round((metricsShown ? 42 : 6) * EGG_SCALE);
    CIRCLE_TOP = TOP_H + ABOVE;
    TEXT_Y = CIRCLE_TOP + CIRCLE_PX + 4;
    CELL_H = TEXT_Y + TEXT_H;
    PITCH_Y = CELL_H + GAP_Y;
  }
  const LINES_PER_SIDE = 3;

  // Fallback drawing when a group is not on screen (or outside GenMapper, e.g. in tests)
  const R = CIRCLE / 2;
  const HEALTH_ICON = 17;

  // Header type sizes (CSS px): kept large enough to read without glasses.
  const H = {
    header: 12,
    title: 12,
    location: 18,
    small: 12,
    legendIcon: 12,
    gap: 13,
    blankFixed: 160,
    blankShort: 93,
  };

  const LIVE_NODE_SELECTOR = '#genmapper-graph-svg .node';
  // Text, buttons, and the member tally (its count is on the "member count" write-in line)
  const LIVE_NODE_DROP =
    'foreignObject, .addNode, .removeNode, .rebaseNode, .node-generation_label, .node-people-icon, .node-people_count';

  const PAPER = {
    letter: { w: 8.5, h: 11, css: 'letter' },
    a4: { w: 8.27, h: 11.69, css: 'A4' },
  };

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function format(template, ...values) {
    return values
      .reduce(
        (text, value, index) => text.split(`%${index + 1}$s`).join(value),
        template,
      )
      .replace('%s', values[0])
      .replace('%d', values[0]);
  }

  /**
   * Inline icons as data URIs so the print iframe has nothing left to load.
   */
  function toDataUri(url) {
    if (!url) {
      return Promise.resolve('');
    }
    return fetch(url, { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.blob() : null))
      .then(
        (blob) =>
          new Promise((resolve) => {
            if (!blob) {
              resolve('');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => '');
  }

  function fetchLabels(lang) {
    const url = `${settings.root}?lang=${encodeURIComponent(lang)}`;
    return fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': settings.nonce },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then((labels) => {
        const items = [...labels.counts, ...labels.health];
        return Promise.all(items.map((item) => toDataUri(item.icon))).then(
          (uris) => {
            items.forEach((item, index) => {
              item.icon = uris[index];
            });
            // Commitment is shown by the circle itself (solid = church), as on screen.
            labels.health = labels.health.filter(
              (item) => item.option !== 'church_commitment',
            );
            return labels;
          },
        );
      });
  }

  function formatDate(timestamp, locale) {
    if (!timestamp) {
      return '';
    }
    try {
      return new Intl.DateTimeFormat(locale.replace('_', '-'), {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(timestamp * 1000));
    } catch (e) {
      return new Date(timestamp * 1000).toISOString().slice(0, 10);
    }
  }

  function headerCss() {
    return `
      .um-header { border-bottom: 1.5px solid #111; padding-bottom: 3px; font-size: ${H.header}px; font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #111; }
      .um-header * { box-sizing: border-box; }
      .um-header-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 2px 12px; }
      .um-header-row strong { font-size: ${H.title}px; }
      .um-location { font-size: ${H.location}px; font-weight: bold; margin-inline-end: 10px; }
      .um-legend { display: flex; flex-wrap: wrap; gap: 0 ${H.gap}px; font-size: ${H.small}px; line-height: 1.4; color: #333; margin-top: 2px; }
      .um-legend > span { white-space: nowrap; }
      .um-legend > .um-instructions { white-space: normal; }
      .um-legend-item img { width: ${H.legendIcon}px; height: ${H.legendIcon}px; vertical-align: -2px; margin-inline-end: 2px; }
      .um-header .um-blank { display: inline-block; border-bottom: 1px solid #888; height: ${H.header}px; }
      .um-blank-fixed { width: ${H.blankFixed}px; }
      .um-blank-short { width: ${H.blankShort}px; }`;
  }

  /**
   * The first sheet of each location carries the full key (count and health icons with their
   * names); later sheets of that location repeat only the written instructions, so they have
   * more room for groups.
   */
  function renderHeader(page, total, layout, labels) {
    const legendIcons = (items) =>
      items
        .map(
          (item) =>
            `<span class="um-legend-item">${item.icon ? `<img src="${item.icon}" alt="">` : ''}${esc(item.label)}</span>`,
        )
        .join('');
    return `
      <header class="um-header">
        <div class="um-header-row">
          <span><span class="um-location">${esc(page.location || labels.strings.no_location)}</span>
            <strong>${esc(labels.strings.title)}: ${esc(layout.rootName ?? labels.strings.all_groups)}</strong></span>
          <span>${esc(format(labels.strings.page, page.number, total))}</span>
          <span>${esc(format(labels.strings.printed, formatDate(Date.now() / 1000, labels.locale)))}
            &nbsp; ${esc(labels.strings.updated_by)} <span class="um-blank um-blank-fixed"></span>
            ${esc(labels.strings.date)} <span class="um-blank um-blank-short"></span></span>
        </div>
        ${
          page.fullHeader
            ? `<div class="um-legend">${legendIcons(labels.counts)}<span>${esc(labels.strings.legend_lines)}</span></div>
        <div class="um-legend">${legendIcons(labels.health)}<span>${esc(labels.strings.legend_health)}</span></div>`
            : `<div class="um-legend"><span class="um-instructions">${esc(labels.strings.legend_lines)} ${esc(labels.strings.legend_health)}</span></div>`
        }
      </header>`;
  }

  /**
   * Height of the page header, measured in this document so wrapped legend lines are never
   * cut off. Without a document (or labels) fall back to an estimate.
   */
  function headerHeight(contentW, layoutLike, labels, longestLocation, full) {
    const estimate = Math.ceil(
      H.location * 1.3 + (full ? 3 : 1) * H.small * 1.4 + 12,
    );
    if (!labels || typeof document === 'undefined' || !document.body) {
      return estimate;
    }
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;left:-10000px;top:0;visibility:hidden;width:${contentW}px;`;
    box.innerHTML = `<style>${headerCss()}</style>${renderHeader({ number: 999, location: longestLocation, fullHeader: full }, 999, layoutLike, labels)}`;
    document.body.appendChild(box);
    const height = box
      .querySelector('.um-header')
      .getBoundingClientRect().height;
    box.remove();
    return height > 0 ? Math.ceil(height) + 6 : estimate;
  }

  /**
   * Split the tree into pages without cutting any egg.
   *
   * The tree is cut into "pieces": starting at the top, each piece is a group plus as many
   * generations below it as fit on one page (fewer if the family is too wide). Groups just
   * below a piece start new pieces. Pieces are then packed in tree order onto pages, side
   * by side and in rows, so small families share a page.
   */
  function paginate(data, options, labels) {
    setGeometry();
    const root = d3.stratify()(data.map((row) => ({ ...row })));
    // id 0 is GenMapper's placeholder root for "all first generation groups".
    const skipRoot = String(root.data.id) === '0';
    const rootName = skipRoot ? null : root.data.name;

    const paper = PAPER[options.paper];
    const pageW = options.orientation === 'landscape' ? paper.h : paper.w;
    const pageH = options.orientation === 'landscape' ? paper.w : paper.h;
    const contentW = Math.floor((pageW - 2 * MARGIN_IN) * DPI);

    // Each sheet holds groups of one location only (the location exactly as recorded).
    const locationOf = (node) => String(node.data.location || '').trim();
    const longestLocation = root
      .descendants()
      .map(locationOf)
      .reduce(
        (longest, location) =>
          location.length > longest.length ? location : longest,
        labels ? labels.strings.no_location : '',
      );
    const headerFullH = headerHeight(
      contentW,
      { rootName },
      labels,
      longestLocation,
      true,
    );
    const headerCompactH = Math.min(
      headerFullH,
      headerHeight(contentW, { rootName }, labels, longestLocation, false),
    );
    // A few px spare so rounding never pushes a page onto a second sheet.
    const bodyH = Math.floor((pageH - 2 * MARGIN_IN) * DPI) - 4;
    const contentH = bodyH - headerFullH;
    // Pieces are cut to fit the shortest sheet body (a first sheet, with the full key).
    const rowsPerPage = Math.max(1, Math.floor((contentH + GAP_Y) / PITCH_Y));
    const heightOf = (rows) => rows * PITCH_Y - GAP_Y;

    const sameLocationChildren = (n) =>
      (n.children || []).filter((child) => locationOf(child) === locationOf(n));

    // A piece: `node`, its first `childLimit` children and their descendants, `depth` generations
    // deep, keeping only groups in the same location as `node`.
    const layoutPiece = (node, depth, childLimit) => {
      const piece = d3.hierarchy(node, (n) => {
        if (n.depth - node.depth >= depth - 1) {
          return null;
        }
        const children = sameLocationChildren(n);
        return n === node ? children.slice(0, childLimit) : children;
      });
      d3
        .tree()
        .nodeSize([PITCH_X, PITCH_Y])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.08))(piece);
      const xs = piece.descendants().map((member) => member.x);
      const minX = Math.min(...xs);
      return {
        piece,
        minX,
        width: Math.max(...xs) - minX + CELL_W,
        rows: piece.height + 1,
      };
    };

    const pieces = [];
    const cut = (node) => {
      // Keep as many of the group's children as fit on a page, then as many generations.
      const childCount = sameLocationChildren(node).length;
      let result = null;
      for (let limit = childCount; limit >= 1 && !result; limit--) {
        for (let depth = rowsPerPage; depth >= 2 && !result; depth--) {
          const candidate = layoutPiece(node, depth, limit);
          if (candidate.width <= contentW) {
            result = candidate;
          }
        }
      }
      if (!result) {
        result = layoutPiece(node, 1, 0);
      }
      result.id = pieces.length;
      result.location = locationOf(node);
      pieces.push(result);
      const members = result.piece.descendants();
      members.forEach((member) => {
        member.data.pieceId = result.id;
      });
      // Groups below the piece, children that did not fit, and children in another location
      // start new pieces.
      members.forEach((member) => {
        const included = (member.children || []).map((child) => child.data);
        (member.data.children || [])
          .filter((child) => !included.includes(child))
          .forEach(cut);
      });
    };
    (skipRoot ? root.children || [] : [root]).forEach(cut);

    // Locations print in the order they first appear in the tree (groups without one last);
    // pieces keep tree order within a location.
    const locationOrder = [
      ...new Set(pieces.map((piece) => piece.location)),
    ].sort((a, b) => (a === '') - (b === ''));
    pieces.sort(
      (a, b) =>
        locationOrder.indexOf(a.location) - locationOrder.indexOf(b.location) ||
        a.id - b.id,
    );

    // First fit: beside the last row of pieces on a page, or in a new row below it.
    const pages = [];
    const place = (piece, page) => {
      const shelf = page.shelves[page.shelves.length - 1];
      const width = shelf.width + GAP_X * 2 + piece.width;
      const rows = Math.max(shelf.rows, piece.rows);
      if (width <= contentW && shelf.y + heightOf(rows) <= page.contentH) {
        piece.x = shelf.width + GAP_X * 2;
        shelf.width = width;
        shelf.rows = rows;
        return shelf;
      }
      const y = shelf.y + heightOf(shelf.rows) + GAP_Y;
      if (y + heightOf(piece.rows) <= page.contentH) {
        const below = { y, rows: piece.rows, width: piece.width };
        page.shelves.push(below);
        piece.x = 0;
        return below;
      }
      return null;
    };
    pieces.forEach((piece) => {
      for (const page of pages) {
        if (page.location !== piece.location) {
          continue;
        }
        const shelf = place(piece, page);
        if (shelf) {
          piece.page = page.number;
          piece.shelf = shelf;
          return;
        }
      }
      const shelf = { y: 0, rows: piece.rows, width: piece.width };
      const fullHeader = !pages.some(
        (page) => page.location === piece.location,
      );
      pages.push({
        number: pages.length + 1,
        location: piece.location,
        fullHeader,
        headerH: fullHeader ? headerFullH : headerCompactH,
        contentH: bodyH - (fullHeader ? headerFullH : headerCompactH),
        shelves: [shelf],
        nodes: [],
      });
      piece.x = 0;
      piece.page = pages.length;
      piece.shelf = shelf;
    });

    pieces.forEach((piece) => {
      const offset = (contentW - piece.shelf.width) / 2;
      piece.piece.descendants().forEach((member) => {
        const node = member.data;
        node.page = piece.page;
        node.px = offset + piece.x + member.x - piece.minX;
        node.py = piece.shelf.y + member.depth * PITCH_Y;
        pages[piece.page - 1].nodes.push(node);
      });
    });

    return {
      pages,
      skipRoot,
      rootName,
      cellW: CELL_W,
      cellH: CELL_H,
      contentW,
      contentH,
      pageW,
      pageH,
      paperCss: `${paper.css} ${options.orientation}`,
    };
  }

  /**
   * The egg as drawn in the chart on screen: circle, health icons, member count, coaching
   * fill. Text and buttons are left out (printed separately in the chosen language).
   */
  function liveNodesById() {
    const map = new Map();
    if (typeof document === 'undefined') {
      return map;
    }
    document.querySelectorAll(LIVE_NODE_SELECTOR).forEach((element) => {
      const datum = element.__data__;
      if (datum && datum.data) {
        map.set(String(datum.data.id), element);
      }
    });
    return map;
  }

  function ringHealthMarkup(d, labels) {
    // Icons on a ring just inside the circle; a ninth (and any beyond) go in the middle.
    const count = labels.health.length;
    const ring = Math.min(count, 8);
    const radius = R - HEALTH_ICON * 0.85;
    return labels.health
      .map((item, index) => {
        if (!item.icon) {
          return '';
        }
        let hx = 0;
        let hy = R;
        if (index < ring) {
          const angle = -Math.PI / 2 + (2 * Math.PI * index) / ring;
          hx = radius * Math.cos(angle);
          hy = R + radius * Math.sin(angle);
        } else {
          hx = (index - ring - (count - ring - 1) / 2) * (HEALTH_ICON + 2);
        }
        return `<image href="${item.icon}" x="${hx - HEALTH_ICON / 2}" y="${hy - HEALTH_ICON / 2}" width="${HEALTH_ICON}" height="${HEALTH_ICON}" opacity="${d[item.key] ? 1 : 0.18}"/>`;
      })
      .join('');
  }

  // Circle drawn with origin at the top centre of the circle, as on screen.
  function circleMarkup(d, live, labels) {
    if (live) {
      const clone = live.cloneNode(true);
      clone
        .querySelectorAll(LIVE_NODE_DROP)
        .forEach((element) => element.remove());
      return `<g class="${esc(live.getAttribute('class'))}">${clone.innerHTML}</g>`;
    }
    const common = window.GenMapperPrintCommon;
    if (common && typeof common.circleMarkup === 'function') {
      const cell = CIRCLE * 0.24;
      return (
        common.circleMarkup(d, 0, R, R) +
        common.healthGridMarkup(d, -cell * 1.5, R - cell * 1.5, cell)
      );
    }
    return `<circle cx="0" cy="${R}" r="${R}" fill="#fff" stroke="${d.active === false ? '#888' : '#000'}" stroke-width="1.5" ${d.group_type === 'church' ? '' : 'stroke-dasharray="5,4"'}/>${ringHealthMarkup(d, labels)}`;
  }

  // The write-in lines: counts then location on the left; leader/coach, start date, notes on the right.
  function sideLines(d, labels) {
    const left = labels.counts
      .slice(0, LINES_PER_SIDE)
      .map((count) => ({ label: count.label, value: d[count.key] ?? 0 }));
    if (left.length < LINES_PER_SIDE) {
      left.push({ label: labels.labels.location, value: d.location || '' });
    }
    while (left.length < LINES_PER_SIDE) {
      left.push({ label: '', value: '' });
    }
    const right = [
      { label: labels.labels.coach, value: d.coach || '' },
      {
        label: labels.labels.start_date,
        value: formatDate(d.start_date_timestamp, labels.locale),
      },
      { label: labels.strings.notes, value: '' },
    ];
    return { left, right };
  }

  function linesMarkup(lines, x, side) {
    const items = lines
      .map(
        (line) => `
          <div class="um-wl">
            <div class="um-wl-label">${line.label ? `${esc(line.label)}:` : ''}</div>
            <div class="um-wl-rule">${line.value !== '' ? `<span class="um-wl-value">${esc(line.value)}</span>` : ''}</div>
          </div>`,
      )
      .join('');
    return `
      <foreignObject x="${x}" y="${CIRCLE_TOP - 4}" width="${SIDE_W - 6}" height="${CIRCLE_PX + 8}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="um-side um-side-${side}">${items}</div>
      </foreignObject>`;
  }

  function renderEgg(node, layout, labels, liveNodes) {
    const d = node.data;
    const parent =
      node.parent && !(layout.skipRoot && node.parent.depth === 0)
        ? node.parent
        : null;
    let fromParent = '';
    if (parent && parent.pieceId !== node.pieceId) {
      const parentLocation = String(parent.data.location || '').trim();
      if (parentLocation !== String(d.location || '').trim()) {
        fromParent = format(
          labels.strings.from_parent_location,
          parent.data.name,
          parentLocation || labels.strings.no_location,
          parent.page,
        );
      } else if (parent.page === node.page) {
        fromParent = format(labels.strings.from_parent_here, parent.data.name);
      } else {
        fromParent = format(
          labels.strings.from_parent,
          parent.data.name,
          parent.page,
        );
      }
    }
    const generation =
      d.generation && labels.strings.generation
        ? format(labels.strings.generation, d.generation)
        : '';
    const topLine = [generation, fromParent].filter(Boolean).join(' · ');
    const childPages = [
      ...new Set(
        (node.children || [])
          .filter((child) => child.page !== node.page)
          .map((child) => child.page),
      ),
    ].sort((a, b) => a - b);
    const inactive = d.active === false;
    const { left, right } = sideLines(d, labels);

    return `
      <g transform="translate(${node.px}, ${node.py})">
        <foreignObject x="0" y="0" width="${CELL_W}" height="${TOP_H}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-top">${esc(topLine)}</div>
        </foreignObject>
        <g transform="translate(${CELL_W / 2}, ${CIRCLE_TOP}) scale(${EGG_SCALE})">${circleMarkup(d, liveNodes.get(String(d.id)), labels)}</g>
        ${linesMarkup(left, 0, 'left')}
        ${linesMarkup(right, SIDE_W + CENTER_W + 6, 'right')}
        <foreignObject x="0" y="${TEXT_Y}" width="${CELL_W}" height="${TEXT_H}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-text">
            <div class="um-name${inactive ? ' is-inactive' : ''}">${esc(d.name)}${inactive ? ` <span class="um-inactive">(${esc(labels.labels.inactive)})</span>` : ''}</div>
            <div class="um-leader-names">${esc(d.coach || '')}</div>
            ${childPages.length ? `<div class="um-continues">${esc(format(labels.strings.continues, childPages.join(', ')))}</div>` : ''}
          </div>
        </foreignObject>
      </g>`;
  }

  function renderLinks(page, layout) {
    return page.nodes
      .filter(
        (node) =>
          node.parent &&
          !(layout.skipRoot && node.parent.depth === 0) &&
          node.parent.pieceId === node.pieceId,
      )
      .map((node) => {
        const cx = node.px + CELL_W / 2;
        const cy = node.py + TOP_H;
        const px = node.parent.px + CELL_W / 2;
        const py = node.parent.py + TEXT_Y + 36;
        const mid = (cy + py) / 2;
        return `<path class="link" d="M${px},${py} C${px},${mid} ${cx},${mid} ${cx},${cy}" fill="none"/>`;
      })
      .join('');
  }

  // Every CSS rule from GenMapper's own stylesheets, so copied eggs look as they do on screen.
  function chartCss() {
    const common = window.GenMapperPrintCommon;
    if (common && typeof common.pluginCss === 'function') {
      return common.pluginCss();
    }
    return '';
  }

  function buildDocument(layout, labels) {
    const liveNodes = liveNodesById();
    const pages = layout.pages
      .map(
        (page) => `
        <section class="um-page">
          <div class="um-header-box" style="height:${page.headerH}px">${renderHeader(page, layout.pages.length, layout, labels)}</div>
          <svg xmlns="http://www.w3.org/2000/svg" width="${layout.contentW}" height="${page.contentH}" viewBox="0 0 ${layout.contentW} ${page.contentH}">
            ${renderLinks(page, layout)}
            ${page.nodes.map((node) => renderEgg(node, layout, labels, liveNodes)).join('')}
          </svg>
        </section>`,
      )
      .join('');

    return `<!DOCTYPE html>
      <html lang="${esc(labels.locale.replace('_', '-'))}" dir="${labels.rtl ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${esc(labels.strings.title)}</title>
        <style>
          ${chartCss()}
          /* Zero page margin leaves browsers no room for their own header/footer (URL, date, title). */
          @page { size: ${layout.paperCss}; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #fff; font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .um-page { width: ${layout.pageW}in; height: calc(${layout.pageH}in - 2px); padding: ${MARGIN_IN}in; overflow: hidden; break-after: page; page-break-after: always; }
          .um-page:last-child { break-after: auto; page-break-after: auto; }
          ${headerCss()}
          .um-header-box { overflow: hidden; }
          svg { display: block; overflow: hidden; background: #fff; }
          svg .link { fill: none; stroke: #ccc; stroke-width: 2px; }
          svg circle.node-church-box { fill: #fff; }
          .um-top { height: ${TOP_H}px; font-size: 11px; line-height: ${TOP_H}px; color: #555; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .um-side { display: flex; flex-direction: column; justify-content: space-between; height: ${CIRCLE_PX + 8}px; font-size: 11px; color: #333; }
          .um-wl-label { line-height: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          /* The current value sits on the line; the new value is written beside it. */
          .um-wl-rule { height: 17px; line-height: 17px; border-bottom: 1px solid #777; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .um-wl-value { color: #000; font-weight: bold; }
          .um-side-left { text-align: end; }
          .um-text { text-align: center; }
          .um-name { font-size: 15px; line-height: 19px; font-weight: bold; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .um-name.is-inactive { color: #888; }
          .um-inactive { font-weight: normal; font-size: 12px; }
          .um-leader-names { font-size: 13px; line-height: 17px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .um-continues { font-size: 10px; line-height: 14px; color: #555; text-align: end; }
        </style>
      </head>
      <body>${pages}</body>
      </html>`;
  }

  function showDialog() {
    const existing = document.getElementById('genmapper-update-map-dialog');
    if (existing) {
      existing.remove();
    }
    const overlay = document.createElement('div');
    overlay.id = 'genmapper-update-map-dialog';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:10000;display:flex;align-items:center;justify-content:center;';
    const languageOptions = settings.languages
      .map(
        (language) =>
          `<option value="${esc(language.code)}" ${language.code === settings.locale ? 'selected' : ''}>${esc(language.name)}</option>`,
      )
      .join('');
    overlay.innerHTML = `
      <form style="background:#fff;padding:20px;border-radius:6px;max-width:360px;width:calc(100% - 32px);">
        <h3 style="margin-top:0;">${esc(t.dialog_title)}</h3>
        <p style="font-size:.9em;">${esc(t.dialog_help)}</p>
        <label>${esc(t.language)}<select name="lang">${languageOptions}</select></label>
        <label>${esc(t.paper)}
          <select name="paper"><option value="letter">${esc(t.letter)}</option><option value="a4">A4</option></select>
        </label>
        <label>
          <select name="orientation"><option value="landscape">${esc(t.landscape)}</option><option value="portrait">${esc(t.portrait)}</option></select>
        </label>
        <p class="um-dialog-error" style="color:#b00;"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="button hollow" data-cancel>${esc(t.cancel)}</button>
          <button type="submit" class="button">${esc(t.print)}</button>
        </div>
      </form>`;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('form');
    overlay.querySelector('[data-cancel]').addEventListener('click', () => {
      overlay.remove();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      const options = {
        lang: form.elements.lang.value,
        paper: form.elements.paper.value,
        orientation: form.elements.orientation.value,
      };
      fetchLabels(options.lang)
        .then((labels) => {
          const layout = paginate(window.genmapper.data, options, labels);
          window.GenMapperPrintFrame.open(buildDocument(layout, labels));
          overlay.remove();
        })
        .catch((error) => {
          console.error(error);
          form.querySelector('.um-dialog-error').textContent = t.error;
          submit.disabled = false;
        });
    });
  }

  window.genmapperUpdateMap = {
    open: showDialog,
    buttonLabel: t.button,
    // Exposed for rendering outside the GenMapper page (e.g. previews and tests).
    paginate,
    buildDocument,
  };
})();
