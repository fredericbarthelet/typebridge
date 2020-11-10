import { computeEventSize } from './index';

describe('Typebridge', () => {
  describe('#computeEventSize', () => {
    it('should compute event size', () => {
      expect(
        computeEventSize({
          DetailType: 'myType',
          Detail: JSON.stringify({ property: 'vaalue' }),
        }),
      ).toBe(27);
    });
  });
});
