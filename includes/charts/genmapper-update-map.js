/**
 * "Update map" print for the groups GenMapper.
 *
 * Prints the tree currently shown with room around every egg to write updated values:
 * a box beside each count, every church health icon (current ones dark, others faint)
 * to circle or cross out, and lines for leader/coach, location, start date and notes.
 *
 * Eggs keep a fixed, writable size, so large trees are split across pages. Pages are cut
 * between eggs (never through one); links that cross a page show "from #id (p. N)" on
 * the child and "more child groups: p. N" on the parent.
 *
 * The person printing chooses the smallest text size. Every font is at least that size,
 * and eggs and the page header grow to fit, so larger text means fewer groups per page.
 */
(function () {
  'use strict';

  const settings = window.genmapperUpdateMapSettings;
  if (!settings) {
    return;
  }
  const t = settings.translations;

  const DPI = 96;
  const PX_PER_PT = 96 / 72;
  const MARGIN_IN = 0.4;
  const GAP_X = 16;
  const GAP_Y = 26;
  const R = 46;
  const HEALTH_ICON = 17;
  const DEFAULT_MIN_PT = 9;
  const MIN_PT = 6;
  const MAX_PT = 16;
  const MIN_PT_STORAGE_KEY = 'genmapperUpdateMapMinPt';
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
      .replace('%s', values[0]);
  }

  function clampMinPt(value) {
    const pt = parseFloat(value);
    if (!Number.isFinite(pt)) {
      return DEFAULT_MIN_PT;
    }
    return Math.min(MAX_PT, Math.max(MIN_PT, pt));
  }

  /**
   * Font sizes and egg dimensions (in CSS px) for a smallest text size in points.
   * Each font keeps its design size unless the minimum is larger; spacing follows the fonts.
   */
  function sizing(minPt) {
    const m = clampMinPt(minPt) * PX_PER_PT;
    const atLeast = (base) => Math.max(base, m);
    const z = {
      minPt: clampMinPt(minPt),
      text: atLeast(9),
      small: atLeast(8),
      top: atLeast(8.5),
      id: atLeast(11),
      name: atLeast(11),
      header: atLeast(10),
      title: atLeast(11),
      countNum: atLeast(9),
      legendIcon: atLeast(10),
      // Location and leader names stay a step larger than everything else.
      location: Math.max(17, m * 1.5),
      leader: Math.max(13, m * 1.3),
    };
    // Write-in space scales with the body text.
    z.scale = z.text / 9;
    z.lineH = Math.ceil(Math.max(15, z.text * 1.5));
    z.leaderLineH = Math.ceil(z.leader * 1.22);
    z.topH = Math.ceil(Math.max(18, Math.max(z.id, z.top) * 1.35));
    z.countHeadH = Math.ceil(Math.max(18, z.countNum * 1.6));
    z.countsH = z.countHeadH + 26;
    z.countW = Math.max(50, Math.ceil(z.countNum * 4.6));
    z.circleCy = z.topH + z.countsH + 2 + R;
    z.textY = z.circleCy + R + 4;
    z.nameH = Math.ceil(z.name * 1.4);
    z.leadersH = Math.max(18, 2 * z.leaderLineH);
    z.continuesH = Math.ceil(z.small * 1.4);
    // Name, leaders (up to two lines), location, start date, two notes lines, page note.
    z.textH = z.nameH + z.leadersH + 4 * z.lineH + z.continuesH + 2;
    z.cellW = Math.max(
      Math.round(250 * Math.max(1, z.scale)),
      4 * z.countW + 3 * 8 + 10,
    );
    z.cellH = z.textY + z.textH;
    z.pitchX = z.cellW + GAP_X;
    z.pitchY = z.cellH + GAP_Y;
    return z;
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

  function headerCss(z) {
    return `
      .um-header { border-bottom: 1.5px solid #111; padding-bottom: 3px; font-size: ${z.header}px; font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #111; }
      .um-header * { box-sizing: border-box; }
      .um-header-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 2px 12px; }
      .um-header-row strong { font-size: ${z.title}px; }
      .um-location { font-size: ${z.location}px; font-weight: bold; margin-inline-end: 10px; }
      .um-legend { display: flex; flex-wrap: wrap; gap: 0 ${Math.round(10 * z.scale)}px; font-size: ${z.small}px; line-height: 1.4; color: #333; margin-top: 2px; }
      .um-legend > span { white-space: nowrap; }
      .um-legend > .um-instructions { white-space: normal; }
      .um-legend-item img { width: ${z.legendIcon}px; height: ${z.legendIcon}px; vertical-align: -2px; margin-inline-end: 2px; }
      .um-header .um-blank { display: inline-block; border-bottom: 1px solid #888; height: ${Math.round(z.header)}px; }
      .um-blank-fixed { width: ${Math.round(120 * z.scale)}px; }
      .um-blank-short { width: ${Math.round(70 * z.scale)}px; }`;
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
            ? `<div class="um-legend">${legendIcons(labels.counts)}<span>${esc(labels.strings.legend_counts)} ${esc(labels.strings.legend_lines)}</span></div>
        <div class="um-legend">${legendIcons(labels.health)}<span>${esc(labels.strings.legend_health)}</span></div>`
            : `<div class="um-legend"><span class="um-instructions">${esc(labels.strings.legend_counts)} ${esc(labels.strings.legend_lines)} ${esc(labels.strings.legend_health)}</span></div>`
        }
      </header>`;
  }

  /**
   * Height of the page header at this text size, measured in this document so wrapped
   * legend lines are never cut off. Without a document (or labels) fall back to an estimate.
   */
  function headerHeight(
    z,
    contentW,
    layoutLike,
    labels,
    longestLocation,
    full,
  ) {
    const estimate = Math.ceil(z.location * 1.3 + 2 * z.small * 1.4 * 2 + 12);
    if (!labels || typeof document === 'undefined' || !document.body) {
      return estimate;
    }
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;left:-10000px;top:0;visibility:hidden;width:${contentW}px;`;
    box.innerHTML = `<style>${headerCss(z)}</style>${renderHeader({ number: 999, location: longestLocation, fullHeader: full }, 999, layoutLike, labels)}`;
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
    const z = sizing(options.minPt ?? DEFAULT_MIN_PT);
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
      z,
      contentW,
      { rootName },
      labels,
      longestLocation,
      true,
    );
    const headerCompactH = Math.min(
      headerFullH,
      headerHeight(z, contentW, { rootName }, labels, longestLocation, false),
    );
    // A few px spare so rounding never pushes a page onto a second sheet.
    const bodyH = Math.floor((pageH - 2 * MARGIN_IN) * DPI) - 4;
    const contentH = bodyH - headerFullH;
    // Pieces are cut to fit the shortest sheet body (a first sheet, with the full key).
    const rowsPerPage = Math.max(1, Math.floor((contentH + GAP_Y) / z.pitchY));
    const heightOf = (rows) => rows * z.pitchY - GAP_Y;

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
        .nodeSize([z.pitchX, z.pitchY])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.08))(piece);
      const xs = piece.descendants().map((member) => member.x);
      const minX = Math.min(...xs);
      return {
        piece,
        minX,
        width: Math.max(...xs) - minX + z.cellW,
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
        node.py = piece.shelf.y + member.depth * z.pitchY;
        pages[piece.page - 1].nodes.push(node);
      });
    });

    return {
      pages,
      skipRoot,
      rootName,
      z,
      cellW: z.cellW,
      cellH: z.cellH,
      contentW,
      contentH,
      pageW,
      pageH,
      paperCss: `${paper.css} ${options.orientation}`,
    };
  }

  function healthPositions(count, z) {
    // Icons on a ring just inside the circle; a ninth (and any beyond) go in the middle.
    const ring = Math.min(count, 8);
    const radius = R - HEALTH_ICON * 0.85;
    const positions = [];
    for (let i = 0; i < ring; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / ring;
      positions.push([
        z.cellW / 2 + radius * Math.cos(angle),
        z.circleCy + radius * Math.sin(angle),
      ]);
    }
    for (let i = ring; i < count; i++) {
      const spread = (i - ring - (count - ring - 1) / 2) * (HEALTH_ICON + 2);
      positions.push([z.cellW / 2 + spread, z.circleCy]);
    }
    return positions;
  }

  function renderEgg(node, layout, labels) {
    const z = layout.z;
    const d = node.data;
    const x = node.px;
    const y = node.py;
    const isChurch = d.group_type === 'church';
    const inactive = d.active === false;
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
          parent.data.id,
          parentLocation || labels.strings.no_location,
          parent.page,
        );
      } else if (parent.page === node.page) {
        fromParent = format(labels.strings.from_parent_here, parent.data.id);
      } else {
        fromParent = format(
          labels.strings.from_parent,
          parent.data.id,
          parent.page,
        );
      }
    }
    const childPages = [
      ...new Set(
        (node.children || [])
          .filter((child) => child.page !== node.page)
          .map((child) => child.page),
      ),
    ].sort((a, b) => a - b);

    const counts = labels.counts
      .map(
        (count) => `
        <div class="um-count" title="${esc(count.label)}">
          <div class="um-count-head">
            ${count.icon ? `<img src="${count.icon}" alt="">` : `<span>${esc(count.label.slice(0, 3))}</span>`}
            <span class="um-current">${esc(d[count.key] ?? 0)}</span>
          </div>
          <div class="um-box"></div>
        </div>`,
      )
      .join('');

    const positions = healthPositions(labels.health.length, z);
    const health = labels.health
      .map((item, index) => {
        if (!item.icon) {
          return '';
        }
        const [hx, hy] = positions[index];
        return `<image href="${item.icon}" x="${hx - HEALTH_ICON / 2}" y="${hy - HEALTH_ICON / 2}" width="${HEALTH_ICON}" height="${HEALTH_ICON}" opacity="${d[item.key] ? 1 : 0.22}"/>`;
      })
      .join('');

    const line = (label, value) => `
      <div class="um-line">
        <b>${esc(label)}:</b>
        ${value ? `<span class="um-current">${esc(value)}</span>` : ''}
        <span class="um-blank"></span>
      </div>`;

    return `
      <g transform="translate(${x}, ${y})">
        <foreignObject x="0" y="0" width="${z.cellW}" height="${z.topH}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-top">
            <span class="um-from">${esc(fromParent)}</span>
            <span class="um-id">#${esc(d.id)}</span>
          </div>
        </foreignObject>
        <foreignObject x="0" y="${z.topH}" width="${z.cellW}" height="${z.countsH}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-counts">${counts}</div>
        </foreignObject>
        <circle cx="${z.cellW / 2}" cy="${z.circleCy}" r="${R}" fill="#fff"
          stroke="${inactive ? '#888' : '#000'}" stroke-width="1.5"
          ${isChurch ? '' : 'stroke-dasharray="5,4"'}/>
        ${health}
        <foreignObject x="0" y="${z.textY}" width="${z.cellW}" height="${z.textH}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-text">
            <div class="um-name">${esc(d.name)}${inactive ? ` <span class="um-inactive">(${esc(labels.labels.inactive)})</span>` : ''}</div>
            <div class="um-leaders">
              <b>${esc(labels.labels.coach)}:</b>
              ${d.coach ? `<span class="um-leader-names">${esc(d.coach)}</span>` : ''}
              <span class="um-blank"></span>
            </div>
            ${line(labels.labels.location, d.location)}
            ${line(labels.labels.start_date, formatDate(d.start_date_timestamp, labels.locale))}
            ${line(labels.strings.notes, '')}
            <div class="um-line"><span class="um-blank"></span></div>
            ${childPages.length ? `<div class="um-continues">${esc(format(labels.strings.continues, childPages.join(', ')))}</div>` : ''}
          </div>
        </foreignObject>
      </g>`;
  }

  function renderLinks(page, layout) {
    const z = layout.z;
    return page.nodes
      .filter(
        (node) =>
          node.parent &&
          !(layout.skipRoot && node.parent.depth === 0) &&
          node.parent.pieceId === node.pieceId,
      )
      .map((node) => {
        const cx = node.px + z.cellW / 2;
        const cy = node.py;
        const px = node.parent.px + z.cellW / 2;
        const py = node.parent.py + z.cellH;
        const mid = (cy + py) / 2;
        return `<path d="M${px},${py} C${px},${mid} ${cx},${mid} ${cx},${cy}" fill="none" stroke="#999" stroke-width="1.2"/>`;
      })
      .join('');
  }

  function buildDocument(layout, labels) {
    const z = layout.z;
    const pages = layout.pages
      .map(
        (page) => `
        <section class="um-page">
          <div class="um-header-box" style="height:${page.headerH}px">${renderHeader(page, layout.pages.length, layout, labels)}</div>
          <svg xmlns="http://www.w3.org/2000/svg" width="${layout.contentW}" height="${page.contentH}" viewBox="0 0 ${layout.contentW} ${page.contentH}">
            ${renderLinks(page, layout)}
            ${page.nodes.map((node) => renderEgg(node, layout, labels)).join('')}
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
          /* Zero page margin leaves browsers no room for their own header/footer (URL, date, title). */
          @page { size: ${layout.paperCss}; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .um-page { width: ${layout.pageW}in; height: calc(${layout.pageH}in - 2px); padding: ${MARGIN_IN}in; overflow: hidden; break-after: page; page-break-after: always; }
          .um-page:last-child { break-after: auto; page-break-after: auto; }
          ${headerCss(z)}
          .um-header-box { overflow: hidden; }
          svg { display: block; overflow: hidden; }
          .um-top { display: flex; justify-content: space-between; align-items: baseline; height: ${z.topH}px; font-size: ${z.top}px; color: #444; white-space: nowrap; }
          .um-from { overflow: hidden; text-overflow: ellipsis; }
          .um-id { font-weight: bold; font-size: ${z.id}px; color: #111; }
          .um-counts { display: flex; justify-content: center; gap: 8px; }
          .um-count { width: ${z.countW}px; }
          .um-count-head { display: flex; align-items: center; justify-content: center; gap: 3px; height: ${z.countHeadH}px; font-size: ${z.countNum}px; }
          .um-count-head img { width: ${Math.max(15, z.countNum * 1.3)}px; height: ${Math.max(15, z.countNum * 1.3)}px; }
          .um-box { height: 22px; border: 1.2px solid #111; border-radius: 3px; }
          .um-text { font-size: ${z.text}px; line-height: ${z.lineH}px; }
          .um-name { font-weight: bold; font-size: ${z.name}px; line-height: ${z.nameH}px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .um-inactive { font-weight: normal; color: #555; }
          .um-line { display: flex; align-items: baseline; gap: 4px; height: ${z.lineH}px; }
          /* The leader/coach names are what the person filling in the sheet recognises, so they sit
             right under the group name in larger type (up to two lines). */
          .um-leaders { display: flex; align-items: baseline; gap: 4px; min-height: 18px; max-height: ${z.leadersH}px; overflow: hidden; }
          .um-leaders b { white-space: nowrap; flex-shrink: 0; }
          .um-leader-names { font-size: ${z.leader}px; line-height: ${z.leaderLineH}px; font-weight: bold; color: #111; max-width: 78%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
          .um-leaders .um-blank { flex: 1 0 ${Math.round(40 * z.scale)}px; }
          .um-line b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%; flex-shrink: 1; }
          .um-current { color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 38%; flex-shrink: 1; }
          .um-text .um-blank { flex: 1 0 ${Math.round(64 * z.scale)}px; border-bottom: 1px solid #888; height: ${Math.round(z.text * 1.3)}px; }
          .um-continues { font-size: ${z.small}px; line-height: ${z.continuesH}px; color: #444; text-align: end; }
        </style>
      </head>
      <body>${pages}</body>
      </html>`;
  }

  function savedMinPt() {
    try {
      const saved = window.localStorage.getItem(MIN_PT_STORAGE_KEY);
      return saved ? clampMinPt(saved) : DEFAULT_MIN_PT;
    } catch (e) {
      return DEFAULT_MIN_PT;
    }
  }

  function saveMinPt(value) {
    try {
      window.localStorage.setItem(MIN_PT_STORAGE_KEY, String(value));
    } catch (e) {
      // Storage unavailable (private window, blocked): the default is used next time.
    }
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
        <label>${esc(t.min_font)}
          <input type="number" name="min_pt" min="${MIN_PT}" max="${MAX_PT}" step="0.5" value="${savedMinPt()}" required>
        </label>
        <p style="font-size:.85em;margin-top:-8px;">${esc(t.min_font_help)}</p>
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
        minPt: clampMinPt(form.elements.min_pt.value),
      };
      saveMinPt(options.minPt);
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
    sizing,
  };
})();
