import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesCustomer, searchCustomers } from '../src/lib/customer-search.ts'

const list = [
  { id: '1', name: 'บริษัท ขนส่งทดสอบ จำกัด', code: 'C0001', contact_name: 'สมชาย', phone: '081-234-5678' },
  { id: '2', name: 'หจก. รถพ่วงไทย', code: 'C0002', contact_name: 'สมหญิง', phone: '02 111 2222' },
  { id: '3', name: 'ขนส่งเหนือ', code: 'C0003', contact_name: null, phone: null },
]

test('matchesCustomer เทียบชื่อ รหัส ผู้ติดต่อ เบอร์ (ไม่สนช่องว่าง/ขีด)', () => {
  assert.equal(matchesCustomer(list[0], 'ขนส่ง'), true)
  assert.equal(matchesCustomer(list[0], 'c0001'), true)
  assert.equal(matchesCustomer(list[0], 'สมชาย'), true)
  assert.equal(matchesCustomer(list[0], '0812345678'), true)
  assert.equal(matchesCustomer(list[1], '021112222'), true)
  assert.equal(matchesCustomer(list[0], 'พ่วง'), false)
  assert.equal(matchesCustomer(list[0], ''), false)
})

test('หลายคำต้องเจอครบ', () => {
  assert.equal(matchesCustomer(list[0], 'ขนส่ง C0001'), true)
  assert.equal(matchesCustomer(list[0], 'ขนส่ง C0002'), false)
})

test('searchCustomers จัดอันดับ: ขึ้นต้นด้วยคำค้นมาก่อน, จำกัดจำนวน', () => {
  const r = searchCustomers(list, 'ขนส่ง')
  assert.deepEqual(r.map((c) => c.id), ['3', '1'])
  assert.equal(searchCustomers(list, '', 2).length, 2)
  assert.equal(searchCustomers(list, 'ไม่มี').length, 0)
})
