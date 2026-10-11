// Run with: node tests/js/timeline-print-layout.test.js
const assert = require('assert');
const layout = require('../../includes/charts/timeline/timeline-print-layout.js');

let passed = 0;
const test = (name, fn) => {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
};

test('paginateRows: later sheets repeat the previous last row, and every row is printed once as a new row', () => {
    const sheets = layout.paginateRows(10, 4);
    assert.deepStrictEqual(sheets, [
        { from: 0, to: 4, overlap: null },
        { from: 4, to: 7, overlap: 3 },
        { from: 7, to: 10, overlap: 6 },
    ]);
    sheets.slice(1).forEach((sheet, index) => assert.strictEqual(sheet.overlap, sheets[index].to - 1));
});

test('paginateRows: fits on one sheet, last sheet short, no rows', () => {
    assert.deepStrictEqual(layout.paginateRows(3, 29), [{ from: 0, to: 3, overlap: null }]);
    assert.deepStrictEqual(layout.paginateRows(30, 29)[1], { from: 29, to: 30, overlap: 28 });
    assert.deepStrictEqual(layout.paginateRows(0, 29), []);
    assert.throws(() => layout.paginateRows(5, 1));
});

test('paginateByHeight: fills sheets by height; an oversized item gets its own sheet', () => {
    const sheets = layout.paginateByHeight([2, 3, 1, 4, 9, 1.5], (n) => n, 6);
    assert.deepStrictEqual(sheets, [[2, 3, 1], [4], [9], [1.5]]);
    assert.deepStrictEqual(layout.paginateByHeight([], (n) => n, 6), []);
});

console.log(`${passed} tests passed`);
