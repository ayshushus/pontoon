import { Localized } from '@fluent/react';
import React, { useContext } from 'react';

import { emptyParams, Location } from '~/context/Location';

import type { EntityNotFound } from '../hooks';

import './StringNotFound.css';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

/** A short, human summary of the filters narrowing the current results. */
function describeFilters(location: Location): string {
  const parts: string[] = [];
  if (location.status) {
    parts.push(`Status: ${capitalize(location.status)}`);
  }
  if (location.search) {
    parts.push(`Search: “${location.search}”`);
  }
  if (
    location.extra ||
    location.tag ||
    location.author ||
    location.time ||
    location.created_time ||
    location.reviewer ||
    location.review_time ||
    location.exclude_self_reviewed
  ) {
    parts.push('other filters');
  }
  return parts.join(', ');
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
  const { entityLocation } = notFound;

  if (!entityLocation) {
    return null;
  }

  const { push } = location;
  const string = String(entityLocation.pk);
  const { project: stringProject, resource: stringResource } = entityLocation;
  const queryLabel =
    location.resource && location.resource !== 'all-resources'
      ? location.resource
      : location.project;
  const filters = describeFilters(location);

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
        <Localized
          id='entities-StringNotFound--description'
          vars={{
            string,
            stringProject,
            stringResource,
            queryLabel,
            filters,
            hasFilters: filters ? 'filtered' : 'all',
          }}
        >
          <p className='description'>
            {`String ${string} is in ${stringResource} (${stringProject}). ` +
              (filters
                ? `You're browsing ${queryLabel}, filtered by ${filters}.`
                : `You're browsing ${queryLabel}.`)}
          </p>
        </Localized>
        <div className='actions'>
          <div className='action'>
            <Localized
              id='entities-StringNotFound--go-to-string'
              vars={{ string, stringResource }}
            >
              <button
                onClick={goToString}
              >{`See string ${string} in ${stringResource}`}</button>
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
