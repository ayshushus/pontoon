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

    fireEvent.click(
      getByRole('button', { name: 'See other strings in firefox' }),
    );

    const { pathname, search } = spy.mock.calls.at(-1)[0];
    expect(pathname).toBe('/kg/firefox/all-resources/');
    expect(search).toContain('status=missing');
    expect(search).not.toContain('string=');
  });

  it('blames the filters, not a place, when the string is in the open project', () => {
    const { getByText, queryByText } = mount({
      show: true,
      entityLocation: { pk: 99, project: 'firefox', resource: 'toolbar.ftl' },
    });

    getByText(
      /String 99 is in toolbar\.ftl \(firefox\), but it doesn’t match your current filters\./,
    );
    expect(queryByText(/You’re viewing/)).toBeNull();
  });

  it('names the viewed resource together with its project', () => {
    const { getByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/browser.ftl/?string=99',
    );

    getByText(/You’re viewing browser\.ftl \(firefox\)\./);
  });

  it('names the project when viewing a whole project', () => {
    const { getByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/firefox/all-resources/?string=99',
    );

    getByText(/You’re viewing firefox\./);
  });

  it('says "all projects" when viewing every project', () => {
    const { getByText } = mount(
      { show: true, entityLocation: ENTITY_LOCATION },
      '/kg/all-projects/all-resources/?string=99',
    );

    getByText(/You’re viewing all projects\./);
  });

  it('renders nothing without a string location', () => {
    const { container } = mount({ show: true, entityLocation: null });
    expect(container).toBeEmptyDOMElement();
  });
});
