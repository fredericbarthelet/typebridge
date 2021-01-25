import Ajv from 'ajv';
import type { EventBridge } from 'aws-sdk';
import { FromSchema, JSONSchema } from 'json-schema-to-ts';
import type { EventBridgeEvent } from 'aws-lambda';

import { Bus, BusPutEvent } from './Bus';

const ajv = new Ajv();

export class Event<N extends string, S extends JSONSchema, P = FromSchema<S>> {
  private _name: N;
  private _source: string;
  private _bus: Bus;
  private _schema: S;
  private _validate: Ajv.ValidateFunction;
  private _pattern: { 'detail-type': [N]; source: string[] };

  constructor({
    name,
    source,
    bus,
    schema,
  }: {
    name: N;
    source: string;
    bus: Bus;
    schema: S;
  }) {
    this._name = name;
    this._source = source;
    this._bus = bus;
    this._schema = schema;
    this._validate = ajv.compile(schema);
    this._pattern = { source: [source], 'detail-type': [name] };
  }

  get name(): N {
    return this._name;
  }

  get source(): string {
    return this._source;
  }

  get bus(): Bus {
    return this._bus;
  }

  get schema(): S {
    return this._schema;
  }

  get pattern(): { 'detail-type': [N]; source: string[] } {
    return this._pattern;
  }

  get publishedEventSchema(): {
    type: 'object';
    properties: {
      source: { const: string };
      'detail-type': { const: N };
      detail: S;
    };
    required: ['source', 'detail-type', 'detail'];
  } {
    return {
      type: 'object',
      properties: {
        source: { const: this._source },
        'detail-type': { const: this._name },
        detail: this._schema,
      },
      required: ['source', 'detail-type', 'detail'],
    };
  }

  create(event: P): BusPutEvent {
    if (!this._validate(event)) {
      throw new Error('Event doest not satisfy schema');
    }

    return { Source: this._source, DetailType: this._name, Detail: event };
  }

  async publish(event: P): Promise<EventBridge.PutEventsResponse> {
    return this._bus.put([this.create(event)]);
  }
}

type GenericEvent = Event<
  string,
  Record<string, unknown>,
  Record<string, unknown>
>;

export type PublishedEvent<Event extends GenericEvent> = EventBridgeEvent<
  Event['name'],
  FromSchema<Event['schema']>
>;
