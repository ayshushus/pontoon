import { createMemoryHistory } from 'history';
import { fireEvent } from '@testing-library/react';
import { expect, vi } from 'vitest';

import { createReduxStore, mountComponentWithStore } from '~/test/store';

import { StringNotFound } from './StringNotFound';

const ENTITY_LOCATION = { pk: 99, project: 'thunderbird', resource: 'foo.ftl' };

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
  );
  return { ...result, spy };
}

describe('<StringNotFound>', () => {
  it('names the string and its resource, and navigates there', () => {
    const { getByRole, getByText, spy } = mount({
      show: true,
      entityLocation: ENTITY_LOCATION,
    });

    // The copy names the string + its resource/project and the current view.
    getByText(/String 99 is in foo\.ftl \(thunderbird\)/);

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

  it('reports filters are active without listing them', () => {
    const { getByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/all-resources/?status=missing,warnings,errors&string=99',
    );

    getByText(/doesn’t match the filters active in firefox/);
  });

  it('treats a search term as an active filter', () => {
    const { getByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/all-resources/?search=hi&string=99',
    );

    getByText(/doesn’t match the filters active in firefox/);
  });

  it('uses the unfiltered wording when no filters are active', () => {
    const { getByText, queryByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/all-resources/?string=99',
    );

    getByText(
      /String 99 is in foo\.ftl \(thunderbird\)\. You’re viewing firefox\./,
    );
    expect(queryByText(/doesn’t match the filters/)).toBeNull();
  });

  it('renders nothing without a string location', () => {
    const { container } = mount({ show: true, entityLocation: null });
    expect(container).toBeEmptyDOMElement();
  });
});
