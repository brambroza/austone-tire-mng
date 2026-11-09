import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OTHER_BRAND, isOtherBrand } from '../src/lib/other-brand.ts'

test('every real-world spelling of the generic brand is recognised', () => {
  assert.equal(OTHER_BRAND, 'อื่นๆ')
  for (const v of ['อื่นๆ', 'อื่น ๆ', ' อื่น ๆ ', 'ยางอื่นๆ', 'ยางอื่น ๆ', 'other', 'OTHER', 'Others']) {
    assert.equal(isOtherBrand(v), true, v)
  }
})

test('normal brands are not treated as the generic brand', () => {
  for (const v of ['AUSTONE', 'MICHELIN', 'ยาง', 'อื่น', '', null, undefined]) {
    assert.equal(isOtherBrand(v), false, String(v))
  }
})
