import { createMemoryHistory } from 'history';
import { fireEvent } from '@testing-library/react';
import { expect, vi } from 'vitest';

import { createReduxStore, mountComponentWithStore } from '~/test/store';

import { StringNotFound } from './StringNotFound';

const ENTITY_LOCATION = { pk: 99, project: 'thunderbird', resource: 'foo.ftl' };

// Provide the filters panel's own label so the component resolves the active
// filter's name through the localization system, not a hardcoded string.
const FTL = `
search-FiltersPanel--status-name-missing = Missing
search-FiltersPanel--status-name-warnings = Warnings
search-FiltersPanel--status-name-errors = Errors
`;

function mount(
  notFound,
  url = '/kg/firefox/all-resources/?status=missing&string=99',
) {
  const history = createMemoryHistory({ initialEntries: [url] });
  const spy = vi.fn();
  history.listen(spy);
  const store = createReduxStore();
  const result = mountComponentWithStore(
    StringNotFound,
    store,
    { notFound },
    history,
    FTL,
  );
  return { ...result, spy };
}

describe('<StringNotFound>', () => {
  it('names the string and its resource, and navigates there', () => {
    const { getByRole, getByText, spy } = mount({
      show: true,
      entityLocation: ENTITY_LOCATION,
    });

    // The copy names the string + its resource/project, the current view, and
    // the active filter — using the filters panel's own localized label.
    getByText(/String 99 is in foo\.ftl \(thunderbird\)/);
    getByText(/viewing firefox, filtered by Missing/);

    fireEvent.click(getByRole('button', { name: 'See string 99 in foo.ftl' }));

    const { pathname, search } = spy.mock.calls.at(-1)[0];
    expect(pathname).toBe('/kg/thunderbird/foo.ftl/');
    expect(search).toBe('?string=99');
  });

  it('keeps the other parameters but drops the string', () => {
    const { getByRole, spy } = mount({
      show: true,
      entityLocation: ENTITY_LOCATION,
    });

    // No single resource selected, so the current view is named by project.
    fireEvent.click(
      getByRole('button', { name: 'See other strings in firefox' }),
    );

    const { pathname, search } = spy.mock.calls.at(-1)[0];
    expect(pathname).toBe('/kg/firefox/all-resources/');
    expect(search).toContain('status=missing');
    expect(search).not.toContain('string=');
  });

  it('joins multiple filter labels in the UI language', () => {
    const { getByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/all-resources/?status=missing,warnings,errors&string=99',
    );

    // en-US UI bundle -> Intl.ListFormat uses the English connector + commas.
    getByText(/filtered by Missing, Warnings, and Errors/);
  });

  it('shows the search term as its own filter', () => {
    const { getByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/all-resources/?search=hi&string=99',
    );

    getByText(/filtered by search .hi./);
  });

  it('omits the filter clause when no filters are active', () => {
    const { getByText, queryByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/all-resources/?string=99',
    );

    getByText(
      /String 99 is in foo\.ftl \(thunderbird\)\. You’re viewing firefox\./,
    );
    expect(queryByText(/filtered by/)).toBeNull();
  });

  it('renders nothing without a string location', () => {
    const { container } = mount({ show: true, entityLocation: null });
    expect(container).toBeEmptyDOMElement();
  });
});
