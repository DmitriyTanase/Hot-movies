import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MoviePagination } from './movie-pagination';

@Component({
  imports: [MoviePagination],
  template: `<app-movie-pagination
    [currentPage]="current()"
    [totalPages]="total()"
    [disabled]="disabled()"
    (pageChange)="emitted.push($event)"
  />`,
})
class Host {
  readonly current = signal(1);
  readonly total = signal(10);
  readonly disabled = signal(false);
  readonly emitted: number[] = [];
}

describe('MoviePagination', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;

  const buttons = () => Array.from(el.querySelectorAll('button'));
  const byLabel = (label: string) => buttons().find((b) => b.getAttribute('aria-label') === label)!;
  const render = async (current: number, total: number, disabled = false) => {
    host.current.set(current);
    host.total.set(total);
    host.disabled.set(disabled);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it.each([0, 1])('renders nothing when total is %i', async (total) => {
    await render(1, total);
    expect(el.querySelector('nav')).toBeNull();
    expect(buttons().length).toBe(0);
  });

  it('is a labelled nav of native buttons with a hidden ellipsis', async () => {
    await render(10, 500);

    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination');
    expect(buttons().every((b) => b.type === 'button')).toBe(true);
    const ellipses = el.querySelectorAll('li[aria-hidden="true"]');
    expect(ellipses.length).toBe(2);
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Previous page',
      'Page 1',
      'Page 9',
      'Page 10',
      'Page 11',
      'Page 500',
      'Next page',
    ]);
  });

  it('marks exactly one page as current', async () => {
    await render(4, 10);

    const current = el.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('aria-label')).toBe('Page 4');
  });

  it('disables Previous on the first page and Next on the last', async () => {
    await render(1, 5);
    expect(byLabel('Previous page').disabled).toBe(true);
    expect(byLabel('Next page').disabled).toBe(false);

    await render(5, 5);
    expect(byLabel('Previous page').disabled).toBe(false);
    expect(byLabel('Next page').disabled).toBe(true);
  });

  it('disables every button when disabled', async () => {
    await render(3, 5, true);
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });

  it('emits the clicked page, Next and Previous', async () => {
    await render(3, 5);

    byLabel('Page 5').click();
    byLabel('Next page').click();
    byLabel('Previous page').click();

    expect(host.emitted).toEqual([5, 4, 2]);
  });

  it('emits nothing when the current page is clicked', async () => {
    await render(3, 5);

    byLabel('Page 3').click();

    expect(host.emitted).toEqual([]);
  });
});
