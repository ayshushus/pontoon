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
  const stringProject = entityLocation.project;
  const stringResource = entityLocation.resource;

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

  let descriptionId: string;
  if (filteredOut) {
    descriptionId = 'entities-StringNotFound--description-filtered';
  } else if (allProjects) {
    descriptionId = 'entities-StringNotFound--description-in-all-projects';
  } else if (allResources) {
    descriptionId = 'entities-StringNotFound--description-in-project';
  } else {
    descriptionId = 'entities-StringNotFound--description-in-resource';
  }

  return (
    <section id='string-not-found'>
      <div className='inner'>
        <Localized
          id={descriptionId}
          vars={{
            stringId,
            stringProject,
            stringResource,
            viewProject,
            viewResource,
          }}
        >
          <p className='description' />
        </Localized>
        <div className='actions'>
          <div className='action'>
            <Localized
              id='entities-StringNotFound--go-to-string'
              vars={{ stringId, stringResource }}
            >
              <button onClick={goToString} />
            </Localized>
            <Localized id='entities-StringNotFound--go-to-string-hint'>
              <span className='hint' />
            </Localized>
          </div>
          <div className='action'>
            <Localized
              id='entities-StringNotFound--show-matching'
              vars={{ queryLabel }}
            >
              <button onClick={showMatching} />
            </Localized>
            <Localized id='entities-StringNotFound--show-matching-hint'>
              <span className='hint' />
            </Localized>
          </div>
        </div>
      </div>
    </section>
  );
}
