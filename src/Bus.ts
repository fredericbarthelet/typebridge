import type { EventBridge } from 'aws-sdk';
import { PutEventsResultEntryList } from 'aws-sdk/clients/eventbridge';

import { Event } from './Event';

interface BusPutEvent {
  Source: string;
  DetailType: string;
  Detail?: unknown;
}

export class Bus {
  private _name: string;
  private _eventBridge: EventBridge;
  constructor({
    name,
    EventBridge,
  }: {
    name: string;
    EventBridge: EventBridge;
  }) {
    this._name = name;
    this._eventBridge = EventBridge;
  }

  async put(
    events: BusPutEvent[],
  ): Promise<EventBridge.PutEventsResponse> {
    const entries = events.map((entry) => {
      const formattedEntry = Object.assign(
        {},
        {
          ...entry,
        },
        {
          Detail: JSON.stringify(entry.Detail),
          EventBusName: this._name,
        },
      );

      if (computeEventSize(formattedEntry) > 256000) {
        throw new Error('Event is too big');
      }

      return formattedEntry;
    });

    const eventBridgeChunkSize = 10;
    const chunkedEntries = [];
    for (let i = 0; i < entries.length; i += eventBridgeChunkSize) {
      chunkedEntries.push(entries.slice(i, i + eventBridgeChunkSize));
    }
    const results = await Promise.all(
      chunkedEntries.map((chunk) =>
        this._eventBridge.putEvents({ Entries: chunk }).promise(),
      ),
    );

    return results.reduce((returnValue, result) => {
      if (result.FailedEntryCount) {
        returnValue.FailedEntryCount += result.FailedEntryCount
      }
      if (result.Entries) {
        returnValue.Entries.push(...result.Entries);
      }

      return returnValue
    }, { Entries: [], FailedEntryCount: 0} as {Entries: PutEventsResultEntryList, FailedEntryCount: number})
  }

  computePattern(
    events: Event<Record<string, unknown>>[],
  ): { source?: string[]; 'detail-type'?: string[] } {
    const pattern = {};
    const areAllEventSourcesEqual = events.every(
      (event) => event.source === events[0].source,
    );
    const areAllEventDetailTypesEqual = events.every(
      (event) => event.name === events[0].name,
    );

    if (areAllEventSourcesEqual || areAllEventDetailTypesEqual) {
      Object.assign(pattern, { source: events.map((event) => event.source) });
    }
    Object.assign(pattern, {
      'detail-type': events.map((event) => event.name),
    });

    return pattern;
  }
}

export function computeEventSize(
  event: EventBridge.PutEventsRequestEntry,
): number {
  let size = 0;

  if (event.Time) size += 14;
  if (event.Detail) size += Buffer.byteLength(event.Detail, 'utf8');
  if (event.DetailType) size += Buffer.byteLength(event.DetailType, 'utf8');
  if (event.Source) size += Buffer.byteLength(event.Source, 'utf8');
  if (event.Resources) {
    event.Resources.forEach((resource) => Buffer.byteLength(resource, 'utf8'));
  }

  return size;
}
