import Ajv from 'ajv';
import type {
  PutEventsRequestEntry,
  PutEventsResponse,
} from '@aws-sdk/client-eventbridge';
import { FromSchema, JSONSchema } from 'json-schema-to-ts';
import type { EventBridgeEvent } from 'aws-lambda';
import { DescribeSchemaCommand, DescribeSchemaCommandOutput, SchemasClient } from '@aws-sdk/client-schemas';
import { Bus } from './Bus';

const ajv = new Ajv();

export class Event<N extends string, S extends JSONSchema> {
  private _name: N;
  private _source: string;
  private _bus: Bus;
  private _schema: S;
  private _validate: Ajv.ValidateFunction;
  private _pattern: { 'detail-type': [N]; source: string[] };
  private _registryName?: string;

  constructor({
    name,
    source,
    bus,
    schema,
    registryName
  }: {
    name: N;
    source: string;
    bus: Bus;
    schema: S | string;
    registryName?: string;
  }) {
    this._name = name;
    this._source = source;
    this._bus = bus;
    let currentSchema: any;
    if (typeof (schema) == 'string' && registryName == undefined) {
      throw ('Need to supply registryName when supplying a schema')
    }

    if (typeof (schema) == 'string') {
      var schemas = new SchemasClient({});

      currentSchema = schemas.send(new DescribeSchemaCommand({ "RegistryName": registryName, "SchemaName": schema }), function(err: any, data: DescribeSchemaCommandOutput | undefined) {
        if (err) throw (err);
        else {
          if (!data || !data.Content) { throw ("Schema is empty!") }
          return JSON.parse(data.Content)
        }
      });
    } else {
      currentSchema = schema;
    }
    console.log(currentSchema)
    this._schema = currentSchema;
    this._validate = ajv.compile(currentSchema);
    this._pattern = { source: [source], 'detail-type': [name] };
    this._registryName = registryName;
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

  create(event: FromSchema<S>): PutEventsRequestEntry {
    // TODO
    if (!this._registryName && !this._validate(event)) {
      throw new Error(
        'Event does not satisfy schema' + JSON.stringify(this._validate.errors),
      );
    }
    if (this._registryName && !this._validate(event)) {
      throw new Error(
        'Event does not satisfy schema' + JSON.stringify(this._validate.errors),
      );
    }


    return {
      Source: this._source,
      DetailType: this._name,
      Detail: JSON.stringify(event),
    };
  }

  async publish(event: FromSchema<S>): Promise<PutEventsResponse> {
    return this._bus.put([this.create(event)]);
  }
}

type GenericEvent = Event<string, JSONSchema>;

export type PublishedEvent<Event extends GenericEvent> = EventBridgeEvent<
  Event['name'],
  FromSchema<Event['schema']>
>;
