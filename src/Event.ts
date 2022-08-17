import Ajv from 'ajv';
import type {
  PutEventsRequestEntry,
  PutEventsResponse,
} from '@aws-sdk/client-eventbridge';
import { FromSchema, JSONSchema } from 'json-schema-to-ts';
import { DescribeSchemaCommand, SchemasClient } from '@aws-sdk/client-schemas';
import { Bus } from './Bus';

const ajv = new Ajv({ removeAdditional: true, strictDefaults: false });

export class Event<N extends string, S extends JSONSchema> {
  private _name: N;
  private _source: string;
  private _bus: Bus;
  private _schema: S | string;
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
    schema: S | string; // either json schema or name of schema in registry
    registryName?: string;
  }) {
    this._name = name;
    this._source = source;
    this._bus = bus;
    if (typeof (schema) == 'string' && registryName == undefined) {
      throw ('Need to supply registryName when supplying a schema')
    }

    this._schema = schema
    this._pattern = { source: [source], 'detail-type': [name] };
    this._registryName = registryName;
  }

  async validate(input: any) {
    var schemas = new SchemasClient({});
    let currentSchema: any;

    let validate
    if (this._registryName && typeof this._schema == "string") {
      const currentSchemaResponse = await schemas.send(new DescribeSchemaCommand({ "RegistryName": this._registryName, "SchemaName": this._schema }));
      if (!currentSchemaResponse.Content) {
        throw ("couldnt fetch schema")
      }

      currentSchema = JSON.parse(currentSchemaResponse.Content)
      validate = ajv.compile(
        // TODO make AWSEvent a configurable variable
        Object.assign({ $ref: "#/components/schemas/AWSEvent" }, currentSchema)
      );
    } else if (typeof this._schema != "string") {
      validate = ajv.compile(this._schema);
    } else {
      throw ("impoosible case")
    }

    return validate(input)
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

  get schema(): S | string {
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
      detail: S | string;
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
    return {
      Source: this._source,
      DetailType: this._name,
      Detail: JSON.stringify(event),
    };
  }

  async publish(event: FromSchema<S>): Promise<PutEventsResponse> {
    if (this._registryName) {
      const valid = await this.validate(event)
      if (!valid)
        throw new Error(
          'Event does not satisfy schema' + JSON.stringify(valid),
        );
    }
    if (!this._registryName && !(await this.validate(event))) {
      throw new Error(
        'Event does not satisfy schema' + JSON.stringify(await this.validate(event)),
      );
    }

    return this._bus.put([this.create(event)]);
  }
}

//type GenericEvent = Event<string, JSONSchema>;

// export type PublishedEvent<Event extends GenericEvent> = EventBridgeEvent<
//   Event['name'],
//   FromSchema<Event['schema']>
// >;
