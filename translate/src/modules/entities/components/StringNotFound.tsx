import { Localized } from '@fluent/react';
import React, { useContext } from 'react';

import { emptyParams, Location } from '~/context/Location';

import type { EntityNotFound } from '../hooks';

import './StringNotFound.css';

function hasActiveFilters(location: Location): boolean {
  const status = location.status
    ? location.status.split(',').filter((s) => s && s !== 'all')
    : [];
  return (
    status.length > 0 ||
    Boolean(location.extra) ||
    Boolean(location.search) ||
    Boolean(location.tag) ||
    Boolean(location.author) ||
    Boolean(location.time) ||
    Boolean(location.created_time) ||
    Boolean(location.reviewer) ||
    Boolean(location.review_time) ||
    Boolean(location.exclude_self_reviewed)
  );
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
  const stringId = String(entityLocation.pk);
  const { project: stringProject, resource: stringResource } = entityLocation;
  const queryLabel =
    location.resource && location.resource !== 'all-resources'
      ? location.resource
      : location.project;

  const filtered = hasActiveFilters(location);

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
        {filtered ? (
          <Localized
            id='entities-StringNotFound--description-filtered'
            vars={{ stringId, stringProject, stringResource, queryLabel }}
          >
            <p className='description'>
              {`String ${stringId} is in ${stringResource} (${stringProject}), but it doesn’t match the filters active in ${queryLabel}.`}
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
