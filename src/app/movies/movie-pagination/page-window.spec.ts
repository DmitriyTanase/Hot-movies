import { PageItem, pageWindow } from './page-window';

const E = 'ellipsis';

describe('pageWindow', () => {
  it.each<[number, number, PageItem[]]>([
    [1, 0, []],
    [1, 1, [1]],
    [3, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 10, [1, 2, 3, 4, 5, E, 10]],
    [4, 10, [1, 2, 3, 4, 5, E, 10]],
    [5, 10, [1, E, 4, 5, 6, E, 10]],
    [6, 10, [1, E, 5, 6, 7, E, 10]],
    [7, 10, [1, E, 6, 7, 8, 9, 10]],
    [10, 10, [1, E, 6, 7, 8, 9, 10]],
    [10, 500, [1, E, 9, 10, 11, E, 500]],
    [500, 500, [1, E, 496, 497, 498, 499, 500]],
  ])('pageWindow(%i, %i)', (current, total, expected) => {
    expect(pageWindow(current, total)).toEqual(expected);
  });

  it.each([8, 9, 20, 500])(
    'keeps the invariants for every current page when total is %i',
    (total) => {
      for (let current = 1; current <= total; current++) {
        const items = pageWindow(current, total);
        const numbers = items.filter((i): i is number => i !== E);

        expect(items.length).toBe(7);
        expect(items[0]).toBe(1);
        expect(items[items.length - 1]).toBe(total);
        expect(numbers).toContain(current);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
        expect(new Set(numbers).size).toBe(numbers.length);
        for (let i = 1; i < items.length; i++) {
          expect(items[i] === E && items[i - 1] === E).toBe(false);
        }
      }
    },
  );
});
