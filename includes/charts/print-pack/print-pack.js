// Print pack dialog for the Groups chart: paper choice, page choice, size estimates, print.
(function () {
    'use strict';

    const common = window.GenMapperPrintCommon;
    const overview = window.GenMapperPrintOverview;
    const treePages = window.GenMapperPrintTreePages;

    const DIALOG_ID = 'pp-dialog';
    const DEFAULT_OPTIONS = { paper: 'a4', orientation: 'landscape', includeOverview: true, includeTrees: true };
    const PAPER_LABELS = { a4: 'A4', letter: 'Letter', a3: 'A3', tabloid: 'Tabloid (11×17)' };

    const currentTrees = () => common.firstGenerationTrees(window.genmapper && window.genmapper.nodes);

    const formatPt = (size) => `${Math.round(size * 10) / 10}pt`;

    // Build the printable HTML for the given options (also used for testing without printing)
    const buildHtml = (options = DEFAULT_OPTIONS) => {
        const settings = { ...DEFAULT_OPTIONS, ...options };
        const trees = currentTrees();
        const page = common.pageSize(settings.paper, settings.orientation);
        const pages = [];
        if (settings.includeOverview) {
            const result = overview.build(trees, page);
            if (result) {
                pages.push(result.markup);
            }
        }
        if (settings.includeTrees) {
            treePages.build(trees, page).forEach((result) => pages.push(result.markup));
        }
        const t = common.strings();
        return pages.length ? common.buildDocument(`${t.chart_label} — ${t.print_title}`, page, pages) : '';
    };

    const readOptions = (dialog) => ({
        paper: dialog.querySelector('[name=pp-paper]').value,
        orientation: dialog.querySelector('[name=pp-orientation]').value,
        includeOverview: dialog.querySelector('[name=pp-overview]').checked,
        includeTrees: dialog.querySelector('[name=pp-trees]').checked,
    });

    const updateEstimates = (dialog) => {
        const t = common.strings();
        const options = readOptions(dialog);
        const trees = currentTrees();
        const page = common.pageSize(options.paper, options.orientation);
        const overviewSize = overview.estimate(trees, page);
        const smallTrees = treePages.estimate(trees, page).filter((item) => item.fontSize < common.MIN_FONT_PT);

        const overviewNote = dialog.querySelector('.pp-overview-note');
        overviewNote.textContent = `${t.names_about} ${formatPt(overviewSize)}`
            + (overviewSize < common.MIN_FONT_PT ? ` — ${t.small_text_hint}` : '');
        overviewNote.classList.toggle('pp-warning', overviewSize < common.MIN_FONT_PT);

        const treeNote = dialog.querySelector('.pp-trees-note');
        treeNote.textContent = smallTrees.length
            ? `${t.small_text_trees} ${smallTrees.map((item) => `${item.name} (${formatPt(item.fontSize)})`).join(', ')} — ${t.small_text_hint}`
            : '';
        treeNote.classList.toggle('pp-warning', smallTrees.length > 0);

        dialog.querySelector('.pp-print').disabled = !options.includeOverview && !options.includeTrees;
    };

    const close = () => {
        const dialog = document.getElementById(DIALOG_ID);
        if (dialog) {
            dialog.remove();
        }
        document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (event) => {
        if (event.key === 'Escape') {
            close();
        }
    };

    const printPack = (dialog) => {
        const html = buildHtml(readOptions(dialog));
        close();
        if (!html) {
            window.genmapper.displayAlert(common.strings().nothing_to_print);
            return;
        }
        if (!window.GenMapperPrintDialog || !window.GenMapperPrintDialog.openPrintDialog(html)) {
            window.genmapper.displayAlert(common.strings().print_failed);
        }
    };

    const printClassicPoster = () => {
        close();
        document.dispatchEvent(new CustomEvent('generatePoster', {
            detail: { printType: 'horizontal', sourceElementId: 'genmapper-graph-svg' },
        }));
    };

    const dialogMarkup = (trees) => {
        const t = common.strings();
        const esc = common.escapeText;
        const paperOptions = Object.keys(PAPER_LABELS)
            .map((key) => `<option value="${key}"${key === DEFAULT_OPTIONS.paper ? ' selected' : ''}>${esc(PAPER_LABELS[key])}</option>`)
            .join('');
        return `<div class="pp-dialog" role="dialog" aria-modal="true" aria-labelledby="pp-dialog-title">
            <h3 id="pp-dialog-title">${esc(t.print_title)}</h3>
            <div class="pp-row">
                <label>${esc(t.paper)} <select name="pp-paper">${paperOptions}</select></label>
                <label>${esc(t.orientation)} <select name="pp-orientation">
                    <option value="landscape" selected>${esc(t.landscape)}</option>
                    <option value="portrait">${esc(t.portrait)}</option>
                </select></label>
            </div>
            <label class="pp-check"><input type="checkbox" name="pp-overview" checked> ${esc(t.include_overview)}</label>
            <p class="pp-note pp-overview-note"></p>
            <label class="pp-check"><input type="checkbox" name="pp-trees" checked> ${esc(t.include_trees)} (${trees.length})</label>
            <p class="pp-note pp-trees-note"></p>
            <div class="pp-actions">
                <button type="button" class="button pp-print">${esc(t.print)}</button>
                <button type="button" class="button hollow pp-cancel">${esc(t.cancel)}</button>
                <a href="#" class="pp-classic">${esc(t.classic_poster)}</a>
            </div>
        </div>`;
    };

    const open = () => {
        close();
        const trees = currentTrees();
        if (!trees.length) {
            window.genmapper.displayAlert(common.strings().nothing_to_print);
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = DIALOG_ID;
        overlay.className = 'pp-dialog-overlay';
        overlay.innerHTML = dialogMarkup(trees);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                close();
            }
        });
        overlay.querySelectorAll('select, input').forEach((input) => input.addEventListener('change', () => updateEstimates(overlay)));
        overlay.querySelector('.pp-print').addEventListener('click', () => printPack(overlay));
        overlay.querySelector('.pp-cancel').addEventListener('click', close);
        overlay.querySelector('.pp-classic').addEventListener('click', (event) => {
            event.preventDefault();
            printClassicPoster();
        });
        document.addEventListener('keydown', onKeydown);
        updateEstimates(overlay);
        overlay.querySelector('.pp-print').focus();
    };

    window.GenMapperPrintPack = { open, buildHtml };
})();
