import type { AWSError, EventBridge } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';

import { Bus } from './Bus';

export class Event<P extends Record<string, unknown>> {
  private _name: string;
  private _source: string;
  private _bus: Bus;
  constructor({
    name,
    source,
    bus,
  }: {
    name: string;
    source: string;
    bus: Bus;
  }) {
    this._name = name;
    this._source = source;
    this._bus = bus;
  }

  get name(): string {
    return this._name;
  }

  get source(): string {
    return this._source;
  }

  async publish(
    event: P,
  ): Promise<PromiseResult<EventBridge.PutEventsResponse, AWSError>[]> {
    return this._bus.put([
      { Source: this._source, DetailType: this._name, Detail: event },
    ]);
  }

  computePattern(): { 'detail-type': string[]; source: string[] } {
    return { source: [this._source], 'detail-type': [this._name] };
  }
}
