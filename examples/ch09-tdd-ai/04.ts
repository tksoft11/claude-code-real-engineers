import fc from 'fast-check';
import { calculateDiscount } from '../src/utils/pricing';

describe('calculateDiscount - Properties', () => {
  it('result should never exceed original price', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000 }),
        fc.float({ min: 0, max: 100 }),
        (price, discountPct) => {
          const result = calculateDiscount(price, discountPct);
          return result <= price;
        }
      )
    );
  });

  it('zero discount returns original price', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000 }),
        (price) => {
          return calculateDiscount(price, 0) === price;
        }
      )
    );
  });

  it('result should never be negative', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0 }),
        fc.float({ min: 0, max: 100 }),
        (price, discountPct) => {
          return calculateDiscount(price, discountPct) >= 0;
        }
      )
    );
  });
});
