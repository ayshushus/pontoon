import { Localized, ReactLocalization, useLocalization } from '@fluent/react';
import React, { useContext } from 'react';

import { emptyParams, Location } from '~/context/Location';

import type { EntityNotFound } from '../hooks';

import './StringNotFound.css';

const splitParam = (value: string | null): string[] =>
  value ? value.split(',').filter(Boolean) : [];

function activeFilterLabels(
  location: Location,
  l10n: ReactLocalization,
): string[] {
  const labels: string[] = [];
  for (const slug of splitParam(location.status)) {
    if (slug !== 'all') {
      labels.push(
        l10n.getString(
          `search-FiltersPanel--status-name-${slug}`,
          undefined,
          slug,
        ),
      );
    }
  }
  for (const slug of splitParam(location.extra)) {
    labels.push(
      l10n.getString(
        `search-FiltersPanel--extra-name-${slug}`,
        undefined,
        slug,
      ),
    );
  }
  if (location.search) {
    labels.push(
      l10n.getString(
        'entities-StringNotFound--filter-search',
        { search: location.search },
        `search “${location.search}”`,
      ),
    );
  }
  if (
    location.tag ||
    location.author ||
    location.time ||
    location.created_time ||
    location.reviewer ||
    location.review_time ||
    location.exclude_self_reviewed
  ) {
    labels.push(
      l10n.getString(
        'entities-StringNotFound--filter-other',
        undefined,
        'other filters',
      ),
    );
  }
  return labels;
}

/**
 * Shown in the editor panel when the `string` URL parameter points at a valid,
 * viewable string that doesn't match the rest of the query (#2921).
 */
export function StringNotFound({
  notFound,
}: {
  notFound: EntityNotFound;
}): React.ReactElement<'section'> | null {
  const location = useContext(Location);
  const { l10n } = useLocalization();
  const { entityLocation } = notFound;

  if (!entityLocation) {
    return null;
  }

  const { push } = location;
  const stringId = String(entityLocation.pk);
  const { project: stringProject, resource: stringResource } = entityLocation;
  const queryLabel =
    location.resource && location.resource !== 'all-resources'
      ? location.resource
      : location.project;

  // Join in the UI language (what the sentence is rendered in), not locale
  const uiLocale = [...l10n.bundles][0]?.locales[0] ?? 'en-US';
  const labels = activeFilterLabels(location, l10n);
  let filters = '';
  if (labels.length) {
    try {
      filters = new Intl.ListFormat(uiLocale, {
        style: 'long',
        type: 'conjunction',
      }).format(labels);
    } catch {
      filters = labels.join(', ');
    }
  }

  const goToString = () =>
    push({
      ...emptyParams,
      project: stringProject,
      resource: stringResource,
      entity: entityLocation.pk,
    });

  const showMatching = () => push({ entity: 0 });

  return (
    <section id='string-not-found'>
      <div className='inner'>
        {filters ? (
          <Localized
            id='entities-StringNotFound--description-filtered'
            vars={{
              stringId,
              stringProject,
              stringResource,
              queryLabel,
              filters,
            }}
          >
            <p className='description'>
              {`String ${stringId} is in ${stringResource} (${stringProject}). You’re viewing ${queryLabel}, filtered by ${filters}.`}
            </p>
          </Localized>
        ) : (
          <Localized
            id='entities-StringNotFound--description-unfiltered'
            vars={{ stringId, stringProject, stringResource, queryLabel }}
          >
            <p className='description'>
              {`String ${stringId} is in ${stringResource} (${stringProject}). You’re viewing ${queryLabel}.`}
            </p>
          </Localized>
        )}
        <div className='actions'>
          <div className='action'>
            <Localized
              id='entities-StringNotFound--go-to-string'
              vars={{ stringId, stringResource }}
            >
              <button
                onClick={goToString}
              >{`See string ${stringId} in ${stringResource}`}</button>
            </Localized>
            <Localized id='entities-StringNotFound--go-to-string-hint'>
              <span className='hint'>Keep the string, drop your filters.</span>
            </Localized>
          </div>
          <div className='action'>
            <Localized
              id='entities-StringNotFound--show-matching'
              vars={{ queryLabel }}
            >
              <button
                onClick={showMatching}
              >{`See other strings in ${queryLabel}`}</button>
            </Localized>
            <Localized id='entities-StringNotFound--show-matching-hint'>
              <span className='hint'>Keep your filters, drop the string.</span>
            </Localized>
          </div>
        </div>
      </div>
    </section>
  );
}
