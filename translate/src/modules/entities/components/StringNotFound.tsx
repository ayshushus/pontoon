import { Localized } from '@fluent/react';
import React, { useContext } from 'react';

import { emptyParams, Location } from '~/context/Location';

import type { EntityNotFound } from '../hooks';

import './StringNotFound.css';

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

  const viewProject = location.project;
  const viewResource = location.resource;
  const allProjects = viewProject === 'all-projects';
  const allResources = !viewResource || viewResource === 'all-resources';

  const queryLabel = allResources ? viewProject : viewResource;

  const filteredOut =
    !allProjects &&
    stringProject === viewProject &&
    (allResources || stringResource === viewResource);

  const goToString = () =>
    push({
      ...emptyParams,
      project: stringProject,
      resource: stringResource,
      entity: entityLocation.pk,
    });

  const showMatching = () => push({ entity: 0 });

  let description: React.ReactElement;
  if (filteredOut) {
    description = (
      <Localized
        id='entities-StringNotFound--description-filtered'
        vars={{ stringId, stringProject, stringResource }}
      >
        <p className='description'>
          {`String ${stringId} is in ${stringResource} (${stringProject}), but it doesn’t match your current filters.`}
        </p>
      </Localized>
    );
  } else if (allProjects) {
    description = (
      <Localized
        id='entities-StringNotFound--description-in-all-projects'
        vars={{ stringId, stringProject, stringResource }}
      >
        <p className='description'>
          {`String ${stringId} is in ${stringResource} (${stringProject}). You’re viewing all projects.`}
        </p>
      </Localized>
    );
  } else if (allResources) {
    description = (
      <Localized
        id='entities-StringNotFound--description-in-project'
        vars={{ stringId, stringProject, stringResource, viewProject }}
      >
        <p className='description'>
          {`String ${stringId} is in ${stringResource} (${stringProject}). You’re viewing ${viewProject}.`}
        </p>
      </Localized>
    );
  } else {
    description = (
      <Localized
        id='entities-StringNotFound--description-in-resource'
        vars={{
          stringId,
          stringProject,
          stringResource,
          viewResource,
          viewProject,
        }}
      >
        <p className='description'>
          {`String ${stringId} is in ${stringResource} (${stringProject}). You’re viewing ${viewResource} (${viewProject}).`}
        </p>
      </Localized>
    );
  }

  return (
    <section id='string-not-found'>
      <div className='inner'>
        {description}
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
              <span className='hint'>
                Search for the requested string, reset current filters.
              </span>
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
              <span className='hint'>
                Keep current filters, display the first available string.
              </span>
            </Localized>
          </div>
        </div>
      </div>
    </section>
  );
}
