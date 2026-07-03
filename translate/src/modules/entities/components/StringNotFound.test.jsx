import { createMemoryHistory } from 'history';
import { fireEvent } from '@testing-library/react';
import { expect, vi } from 'vitest';

import { createReduxStore, mountComponentWithStore } from '~/test/store';

import { StringNotFound } from './StringNotFound';

const ENTITY_LOCATION = { pk: 99, project: 'thunderbird', resource: 'foo.ftl' };

function mount(notFound) {
  const history = createMemoryHistory({
    initialEntries: ['/kg/firefox/all-resources/?status=missing&string=99'],
  });
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

    // The copy names the string + its resource/project, the current location,
    // and the specific active filter.
    getByText(/String 99 is in foo\.ftl \(thunderbird\)/);
    getByText(/browsing firefox, filtered by Status: Missing/);

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

  it('renders nothing without a string location', () => {
    const { container } = mount({ show: true, entityLocation: null });
    expect(container).toBeEmptyDOMElement();
  });
});
