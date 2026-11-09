import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SHOP_MOUNT_BRAND, UNKNOWN_SERIAL_PREFIX, generateUnknownSerial, isShopMountBrand, isUnknownSerial,
} from '../src/lib/shop-rules.ts'
import { SERIAL_MAX, SERIAL_PATTERN } from '../src/lib/utils.ts'

test('only AUSTONE passes the shop mount-brand rule, regardless of case and spacing', () => {
  assert.equal(SHOP_MOUNT_BRAND, 'AUSTONE')
  assert.equal(isShopMountBrand('AUSTONE'), true)
  assert.equal(isShopMountBrand('austone'), true)
  assert.equal(isShopMountBrand(' Aus tone '), true)
  assert.equal(isShopMountBrand('MICHELIN'), false)
  assert.equal(isShopMountBrand('อื่นๆ'), false)
  assert.equal(isShopMountBrand(null), false)
  assert.equal(isShopMountBrand(undefined), false)
  assert.equal(isShopMountBrand(''), false)
})

test('generated unknown serials are valid serials that encode the event date', () => {
  const serial = generateUnknownSerial(new Date(2026, 0, 31), () => 0)
  assert.equal(serial, 'UNK-260131-AAAAA')
  assert.ok(SERIAL_PATTERN.test(serial), 'must match the serial pattern')
  assert.ok(serial.length <= SERIAL_MAX)
  assert.ok(serial.startsWith(UNKNOWN_SERIAL_PREFIX))
})

test('random suffix stays inside the alphabet even at the upper bound', () => {
  const serial = generateUnknownSerial(new Date(2026, 11, 9), () => 0.999999)
  assert.equal(serial, 'UNK-261209-99999')
  assert.ok(SERIAL_PATTERN.test(serial))
})

test('two draws with different randomness give different serials', () => {
  let n = 0
  const random = () => ((n += 7) % 32) / 32
  const a = generateUnknownSerial(new Date(2026, 5, 1), random)
  const b = generateUnknownSerial(new Date(2026, 5, 1), random)
  assert.notEqual(a, b)
})

test('isUnknownSerial recognises generated serials only', () => {
  assert.equal(isUnknownSerial('UNK-260131-7KQ2M'), true)
  assert.equal(isUnknownSerial('unk-260131-7kq2m'), true)
  assert.equal(isUnknownSerial('UNKNOWN'), false)
  assert.equal(isUnknownSerial('111111'), false)
  assert.equal(isUnknownSerial(null), false)
})

test('shop mount grant matches by model id or by brand+model name', async () => {
  const { buildShopMountGrant, tireMatchesGrant, tireNameKey } = await import('../src/lib/shop-rules.ts')
  const grant = buildShopMountGrant([
    { id: 'm1', brand_name: 'AUSTONE', model_name: 'AT 118' },
    { id: 'm2', brand_name: 'AUSTONE', model_name: null },
  ])
  assert.equal(tireNameKey(' Aus tone', 'at 118 '), 'AUSTONE|AT118')
  assert.equal(tireMatchesGrant(grant, { tire_model_id: 'm1' }), true)
  assert.equal(tireMatchesGrant(grant, { tire_model_id: 'm2' }), true)
  assert.equal(tireMatchesGrant(grant, { tire_model_id: 'other', brand_name: 'AUSTONE', model_name: 'AT118' }), true)
  assert.equal(tireMatchesGrant(grant, { brand_name: 'austone', model_name: 'at 118' }), true)
  assert.equal(tireMatchesGrant(grant, { brand_name: 'MICHELIN', model_name: 'AT 118' }), false)
  assert.equal(tireMatchesGrant(grant, { tire_model_id: 'm9' }), false)
  assert.equal(tireMatchesGrant(grant, {}), false)
  assert.equal(tireMatchesGrant(grant, { brand_name: 'AUSTONE' }), false)
  assert.equal(tireMatchesGrant(buildShopMountGrant([]), { tire_model_id: 'm1' }), false)
})
