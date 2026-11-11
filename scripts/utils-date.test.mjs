import test from 'node:test'
import assert from 'node:assert/strict'
import { todayISO } from '../src/lib/utils.ts'

test('todayISO ใช้วันที่ท้องถิ่น ไม่ใช่ UTC (01:30 น. ยังเป็นวันเดียวกัน)', () => {
  const local = new Date(2026, 10, 11, 1, 30) // 11 พ.ย. 2026 01:30 ตามเวลาเครื่อง
  assert.equal(todayISO(local), '2026-11-11')
})

test('todayISO เติมศูนย์หน้าเดือน/วัน', () => {
  assert.equal(todayISO(new Date(2026, 0, 5, 12)), '2026-01-05')
})
