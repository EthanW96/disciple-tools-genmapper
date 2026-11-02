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
  const HEADER_H = 72;
  const CELL_W = 250;
  const CELL_H = 282;
  const GAP_X = 16;
  const GAP_Y = 26;
  const PITCH_X = CELL_W + GAP_X;
  const PITCH_Y = CELL_H + GAP_Y;
  const R = 46;
  const CIRCLE_CY = 66 + R;
  const HEALTH_ICON = 17;
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

  /**
   * Split the tree into pages without cutting any egg.
   *
   * The tree is cut into "pieces": starting at the top, each piece is a group plus as many
   * generations below it as fit on one page (fewer if the family is too wide). Groups just
   * below a piece start new pieces. Pieces are then packed in tree order onto pages, side
   * by side and in rows, so small families share a page.
   */
  function paginate(data, options) {
    const root = d3.stratify()(data.map((row) => ({ ...row })));
    // id 0 is GenMapper's placeholder root for "all first generation groups".
    const skipRoot = String(root.data.id) === '0';

    const paper = PAPER[options.paper];
    const pageW = options.orientation === 'landscape' ? paper.h : paper.w;
    const pageH = options.orientation === 'landscape' ? paper.w : paper.h;
    const contentW = Math.floor((pageW - 2 * MARGIN_IN) * DPI);
    const contentH = Math.floor((pageH - 2 * MARGIN_IN) * DPI) - HEADER_H;
    const rowsPerPage = Math.max(1, Math.floor((contentH + GAP_Y) / PITCH_Y));
    const heightOf = (rows) => rows * PITCH_Y - GAP_Y;

    // A piece: `node`, its first `childLimit` children and their descendants, `depth` generations deep.
    const layoutPiece = (node, depth, childLimit) => {
      const piece = d3.hierarchy(node, (n) => {
        if (!n.children || n.depth - node.depth >= depth - 1) {
          return null;
        }
        return n === node ? n.children.slice(0, childLimit) : n.children;
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
      const childCount = (node.children || []).length;
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
      pieces.push(result);
      const members = result.piece.descendants();
      members.forEach((member) => {
        member.data.pieceId = result.id;
      });
      // Groups below the piece, and children of the top group that did not fit, start new pieces.
      members.forEach((member) => {
        const included = (member.children || []).map((child) => child.data);
        (member.data.children || [])
          .filter((child) => !included.includes(child))
          .forEach(cut);
      });
    };
    (skipRoot ? root.children || [] : [root]).forEach(cut);

    // First fit: beside the last row of pieces on a page, or in a new row below it.
    const pages = [];
    const place = (piece, page) => {
      const shelf = page.shelves[page.shelves.length - 1];
      const width = shelf.width + GAP_X * 2 + piece.width;
      const rows = Math.max(shelf.rows, piece.rows);
      if (width <= contentW && shelf.y + heightOf(rows) <= contentH) {
        piece.x = shelf.width + GAP_X * 2;
        shelf.width = width;
        shelf.rows = rows;
        return shelf;
      }
      const y = shelf.y + heightOf(shelf.rows) + GAP_Y;
      if (y + heightOf(piece.rows) <= contentH) {
        const below = { y, rows: piece.rows, width: piece.width };
        page.shelves.push(below);
        piece.x = 0;
        return below;
      }
      return null;
    };
    pieces.forEach((piece) => {
      for (const page of pages) {
        const shelf = place(piece, page);
        if (shelf) {
          piece.page = page.number;
          piece.shelf = shelf;
          return;
        }
      }
      const shelf = { y: 0, rows: piece.rows, width: piece.width };
      pages.push({ number: pages.length + 1, shelves: [shelf], nodes: [] });
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
      rootName: skipRoot ? null : root.data.name,
      contentW,
      contentH,
      paperCss: `${paper.css} ${options.orientation}`,
    };
  }

  function healthPositions(count) {
    // Icons on a ring just inside the circle; a ninth (and any beyond) go in the middle.
    const ring = Math.min(count, 8);
    const radius = R - HEALTH_ICON * 0.85;
    const positions = [];
    for (let i = 0; i < ring; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / ring;
      positions.push([
        CELL_W / 2 + radius * Math.cos(angle),
        CIRCLE_CY + radius * Math.sin(angle),
      ]);
    }
    for (let i = ring; i < count; i++) {
      const spread = (i - ring - (count - ring - 1) / 2) * (HEALTH_ICON + 2);
      positions.push([CELL_W / 2 + spread, CIRCLE_CY]);
    }
    return positions;
  }

  function renderEgg(node, layout, labels) {
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
      fromParent =
        parent.page === node.page
          ? format(labels.strings.from_parent_here, parent.data.id)
          : format(labels.strings.from_parent, parent.data.id, parent.page);
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

    const positions = healthPositions(labels.health.length);
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
        <foreignObject x="0" y="0" width="${CELL_W}" height="18">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-top">
            <span class="um-from">${esc(fromParent)}</span>
            <span class="um-id">#${esc(d.id)}</span>
          </div>
        </foreignObject>
        <foreignObject x="0" y="18" width="${CELL_W}" height="46">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-counts">${counts}</div>
        </foreignObject>
        <circle cx="${CELL_W / 2}" cy="${CIRCLE_CY}" r="${R}" fill="#fff"
          stroke="${inactive ? '#888' : '#000'}" stroke-width="1.5"
          ${isChurch ? '' : 'stroke-dasharray="5,4"'}/>
        ${health}
        <foreignObject x="0" y="${CIRCLE_CY + R + 4}" width="${CELL_W}" height="${CELL_H - CIRCLE_CY - R - 4}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="um-text">
            <div class="um-name">${esc(d.name)}${inactive ? ` <span class="um-inactive">(${esc(labels.labels.inactive)})</span>` : ''}</div>
            ${line(labels.labels.coach, d.coach)}
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
    return page.nodes
      .filter(
        (node) =>
          node.parent &&
          !(layout.skipRoot && node.parent.depth === 0) &&
          node.parent.pieceId === node.pieceId,
      )
      .map((node) => {
        const cx = node.px + CELL_W / 2;
        const cy = node.py;
        const px = node.parent.px + CELL_W / 2;
        const py = node.parent.py + CELL_H;
        const mid = (cy + py) / 2;
        return `<path d="M${px},${py} C${px},${mid} ${cx},${mid} ${cx},${cy}" fill="none" stroke="#999" stroke-width="1.2"/>`;
      })
      .join('');
  }

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
          <strong>${esc(labels.strings.title)}: ${esc(layout.rootName ?? labels.strings.all_groups)}</strong>
          <span>${esc(format(labels.strings.page, page.number, total))}</span>
          <span>${esc(format(labels.strings.printed, formatDate(Date.now() / 1000, labels.locale)))}
            &nbsp; ${esc(labels.strings.updated_by)} <span class="um-blank um-blank-fixed"></span>
            ${esc(labels.strings.date)} <span class="um-blank um-blank-short"></span></span>
        </div>
        <div class="um-legend">${legendIcons(labels.counts)}<span>${esc(labels.strings.legend_counts)} ${esc(labels.strings.legend_lines)}</span></div>
        <div class="um-legend">${legendIcons(labels.health)}<span>${esc(labels.strings.legend_health)}</span></div>
      </header>`;
  }

  function buildDocument(layout, labels) {
    const pages = layout.pages
      .map(
        (page) => `
        <section class="um-page">
          ${renderHeader(page, layout.pages.length, layout, labels)}
          <svg xmlns="http://www.w3.org/2000/svg" width="${layout.contentW}" height="${layout.contentH}" viewBox="0 0 ${layout.contentW} ${layout.contentH}">
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
          @page { size: ${layout.paperCss}; margin: ${MARGIN_IN}in; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .um-page { width: ${layout.contentW}px; height: ${layout.contentH + HEADER_H}px; overflow: hidden; break-after: page; page-break-after: always; }
          .um-page:last-child { break-after: auto; page-break-after: auto; }
          .um-header { height: ${HEADER_H}px; border-bottom: 1.5px solid #111; font-size: 10px; }
          .um-header-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
          .um-header-row strong { font-size: 12px; }
          .um-legend { display: flex; flex-wrap: wrap; gap: 0 10px; font-size: 8px; line-height: 11px; color: #444; margin-top: 2px; max-height: 22px; overflow: hidden; }
          .um-legend > span { white-space: nowrap; }
          .um-legend-item img { width: 10px; height: 10px; vertical-align: -2px; margin-inline-end: 2px; }
          svg { display: block; overflow: hidden; }
          .um-top { display: flex; justify-content: space-between; font-size: 8.5px; color: #555; }
          .um-id { font-weight: bold; font-size: 11px; color: #111; }
          .um-counts { display: flex; justify-content: center; gap: 8px; }
          .um-count { width: 50px; }
          .um-count-head { display: flex; align-items: center; justify-content: center; gap: 3px; height: 18px; font-size: 9px; }
          .um-count-head img { width: 15px; height: 15px; }
          .um-box { height: 22px; border: 1.2px solid #111; border-radius: 3px; }
          .um-text { font-size: 9px; line-height: 15px; }
          .um-name { font-weight: bold; font-size: 11px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .um-inactive { font-weight: normal; color: #666; }
          .um-line { display: flex; align-items: baseline; gap: 4px; height: 16px; }
          .um-line b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%; flex-shrink: 1; }
          .um-current { color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 38%; flex-shrink: 1; }
          .um-blank { flex: 1 0 64px; border-bottom: 1px solid #888; height: 12px; }
          .um-blank-fixed { display: inline-block; width: 120px; }
          .um-blank-short { display: inline-block; width: 70px; }
          .um-continues { font-size: 8px; color: #555; text-align: end; }
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
          const layout = paginate(window.genmapper.data, options);
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
