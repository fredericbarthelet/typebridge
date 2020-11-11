# Typebridge

Typescript toolbox for AWS EventBridge

## Advantages

- Programmatical definition of your application events
- Typed publish and consume APIs
- Automatically batches `putEvents` call when publishing more than 10 events at a time
- Check for event payload size before publishing

## Quick install

### Add typebridge dependency

`npm i typebridge --save`

### Define your bus and events

```ts
import { EventBridge } from 'aws-sdk';
import { Bus, Event } from 'typebridge';

const MyBus = new Bus({
  name: 'applicationBus',
  EventBridge: new EventBridge(),
});

export type MyEventPayload = {
  stringAttribute: string;
  numberAttribute: number;
};

export const MyEvent = new Event<MyEventPayload>({
  name: 'MyEvent',
  bus: SafetrackerBus,
});
```

### Use the event to publish

```ts
import { MyEvent } from './events.ts';

export const handler = async (event) => {
  await MyEvent.publish({
    stringAttribute: 'string',
    numberAttribute: 12,
  })

  return 'Event published !'
};
```

Typechecking is automatically enabled:

```ts
  await MyEvent.publish({
    stringAttribute: 'string',
    numberAttribute: 12,
    // the following line will trigger a Typescript error
    anotherAttribute: 'wrong'
  })
```

### Use the event to generate trigger rules

Using the serverless framework with `serverless.ts` service file:


```ts
import type { Serverless } from 'serverless/aws';

const serverlessConfiguration: Serverless = {
  service: 'typebridge-test',
  provider: {
    name: 'aws',
    runtime: 'nodejs12.x',
  },
  functions: {
    hello: {
      handler: 'MyEventHandler.handler',
      events: [
        {
          eventBridge: {
            eventBus: 'applicationBus',
            pattern: NewUserConnectedEvent.computePattern(),
          },
        },
      ],
    }
  }
}

module.exports = serverlessConfiguration;
```

### Use the event to type input event

Using the serverless framework with `serverless.ts` service file:


```ts
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import { MyEvent, MyEventPayload } from './events.ts';

export const handler = (event: EventBridgeEvent<typeof MyEvent.name, MyEventPayload>) => {
  // Typed as string
  return event.stringAttribute;
}
```
