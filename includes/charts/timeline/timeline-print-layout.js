// Splitting the timelines print-out into A4 sheets. Pure functions (no DOM), tested in Node.
(function (root) {
    'use strict';

    /**
     * Swimlane rows per sheet, for taping sheets together top to bottom: every sheet after the
     * first repeats the previous sheet's last row (the overlap strip) above its own rows.
     * @param {number} rowCount rows in the chart
     * @param {number} rowsPerSheet rows that fit on one sheet, counting the overlap row (at least 2)
     * @returns {Array<{from: number, to: number, overlap: number|null}>} rows [from, to) and the repeated row
     */
    const paginateRows = (rowCount, rowsPerSheet) => {
        if (rowsPerSheet < 2) {
            throw new Error('paginateRows: a sheet must fit at least 2 rows');
        }
        const sheets = [];
        let from = 0;
        while (from < rowCount) {
            const overlap = sheets.length ? from - 1 : null;
            const room = overlap === null ? rowsPerSheet : rowsPerSheet - 1;
            const to = Math.min(rowCount, from + room);
            sheets.push({ from, to, overlap });
            from = to;
        }
        return sheets;
    };

    /**
     * Items of varying height (e.g. watch list rows with several reasons) split into sheets.
     * An item taller than a sheet gets a sheet of its own.
     * @param {Array} items
     * @param {Function} heightOf item -> its height (any unit)
     * @param {number} sheetHeight room on one sheet, in the same unit
     * @returns {Array<Array>} items per sheet
     */
    const paginateByHeight = (items, heightOf, sheetHeight) => {
        const sheets = [];
        let current = [];
        let used = 0;
        items.forEach((item) => {
            const height = heightOf(item);
            if (current.length && used + height > sheetHeight) {
                sheets.push(current);
                current = [];
                used = 0;
            }
            current = current.concat([item]);
            used += height;
        });
        return current.length ? sheets.concat([current]) : sheets;
    };

    const api = { paginateRows, paginateByHeight };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.GenMapperTimelinePrintLayout = api;
    }
})(typeof window !== 'undefined' ? window : this);
