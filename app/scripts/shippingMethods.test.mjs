import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SHIPPING_METHOD,
  SHIPPING_METHODS,
  getShippingMethod,
  getShippingMethodDisplay,
  resolveShippingMethod,
} from '../lib/shippingMethods.ts';

test('shipping methods follow the Vinted-style carrier set', () => {
  const carriers = SHIPPING_METHODS.map((method) => method.carrier);
  assert.ok(carriers.includes('DHL'));
  assert.ok(carriers.includes('DPD'));
  assert.ok(carriers.includes('UPS'));
  assert.ok(carriers.includes('Mondial Relay / InPost'));
  assert.ok(carriers.includes('Homerr'));
  assert.ok(carriers.includes('Vinted Go'));
  assert.ok(carriers.includes('PostNL'));
  assert.ok(!carriers.includes('Budbee'));
  assert.ok(!carriers.includes('Local pickup'));
  assert.ok(SHIPPING_METHODS.every((method) => Number.isInteger(method.priceMicro)));
  assert.ok(SHIPPING_METHODS.every((method) => method.priceMicro >= 0));
});

test('resolves methods by id before falling back to price', () => {
  assert.equal(getShippingMethod('vinted-go-locker')?.carrier, 'Vinted Go');
  assert.equal(resolveShippingMethod('vinted-go-locker', 4_290_000).id, 'vinted-go-locker');
  assert.equal(resolveShippingMethod(null, 1_690_000).id, 'postnl-letterbox');
});

test('falls back safely for legacy listings without a method id', () => {
  assert.equal(resolveShippingMethod(null, 123).id, DEFAULT_SHIPPING_METHOD.id);
  assert.equal(
    getShippingMethodDisplay('dhl-servicepoint', 5_000_000),
    'DHL ServicePoint parcel'
  );
});
