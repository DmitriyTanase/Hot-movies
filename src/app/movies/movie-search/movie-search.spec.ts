import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovieService } from '../movie.service';
import { MovieSearch } from './movie-search';

describe('MovieSearch', () => {
  let fixture: ComponentFixture<MovieSearch>;
  let el: HTMLElement;
  let setQuery: ReturnType<typeof vi.spyOn>;

  const input = () => el.querySelector('input') as HTMLInputElement;
  const clearButton = () => el.querySelector('button[aria-label="Clear search"]');

  const create = async () => {
    fixture = TestBed.createComponent(MovieSearch);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  };

  const type = async (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submit = () => {
    const event = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    setQuery = vi
      .spyOn(TestBed.inject(MovieService), 'setQuery')
      .mockImplementation(() => undefined);
  });

  afterEach(() => vi.useRealTimers());

  it('commits typed text only after 300 ms', async () => {
    await create();
    await type('bat');
    vi.advanceTimersByTime(299);
    expect(setQuery).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setQuery).toHaveBeenCalledExactlyOnceWith('bat');
  });

  it('commits once for several keystrokes', async () => {
    await create();
    await type('b');
    vi.advanceTimersByTime(200);
    await type('ba');
    vi.advanceTimersByTime(200);
    await type('bat');
    vi.advanceTimersByTime(300);
    expect(setQuery).toHaveBeenCalledExactlyOnceWith('bat');
  });

  it('commits immediately on submit and does not commit again at 300 ms', async () => {
    await create();
    await type('batman');
    const event = submit();
    expect(event.defaultPrevented).toBe(true);
    expect(setQuery).toHaveBeenCalledExactlyOnceWith('batman');
    vi.advanceTimersByTime(1000);
    expect(setQuery).toHaveBeenCalledTimes(1);
  });

  it('has a Search submit button inside the search form', async () => {
    await create();
    const button = el.querySelector('form[role="search"] button[type="submit"]');
    expect(button?.textContent).toContain('Search');
  });

  it('commits an empty query immediately when the text is cleared', async () => {
    await create();
    await type('bat');
    await type('');
    expect(setQuery).toHaveBeenCalledExactlyOnceWith('');
    vi.advanceTimersByTime(1000);
    expect(setQuery).toHaveBeenCalledTimes(1);
  });

  it('commits an empty query immediately for whitespace only', async () => {
    await create();
    await type('bat');
    await type('   ');
    expect(setQuery).toHaveBeenCalledExactlyOnceWith('');
    vi.advanceTimersByTime(1000);
    expect(setQuery).toHaveBeenCalledTimes(1);
  });

  it('clear button empties the draft and commits an empty query', async () => {
    await create();
    expect(clearButton()).toBeNull();
    await type('bat');
    (clearButton() as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(input().value).toBe('');
    expect(setQuery).toHaveBeenCalledExactlyOnceWith('');
    vi.advanceTimersByTime(1000);
    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(clearButton()).toBeNull();
  });

  it('returns focus to the search input after Clear', async () => {
    await create();
    document.body.appendChild(el);
    await type('bat');
    const button = clearButton() as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    fixture.detectChanges();
    expect(clearButton()).toBeNull();
    expect(document.activeElement).toBe(input());
    el.remove();
  });

  it('does not commit when destroyed with a pending timer', async () => {
    await create();
    await type('bat');
    fixture.destroy();
    vi.advanceTimersByTime(1000);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('seeds the draft from the current query', async () => {
    setQuery.mockRestore();
    TestBed.inject(MovieService).setQuery('batman');
    await create();
    expect(input().value).toBe('batman');
  });
});
