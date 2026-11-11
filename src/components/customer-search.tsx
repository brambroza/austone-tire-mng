'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { matchesCustomer, searchCustomers, type CustomerSearchItem } from '@/lib/customer-search'

/** จำนวนรายการสูงสุดในรายการ dropdown */
const MAX_RESULTS = 20

export interface CustomerSearchProps<T extends CustomerSearchItem> {
  customers: readonly T[]
  /**
   * ลิงก์ที่จะพาไปเมื่อเลือก — ใส่ `{id}` แทน id ลูกค้า เช่น `/shop/service?company={id}`
   * (เป็น string ไม่ใช่ function เพื่อให้ server component ส่งมาได้)
   */
  hrefTemplate?: string
  /** callback เมื่อเลือก (ใช้แทนหรือควบคู่กับ hrefTemplate) */
  onSelect?: (customer: T | null) => void
  /** ชื่อ hidden input สำหรับส่งค่าในฟอร์ม GET/POST — ส่ง id ของลูกค้าที่เลือก */
  name?: string
  /** id ลูกค้าที่เลือกไว้แล้ว (โหมดฟอร์ม) */
  defaultValue?: string
  /** อนุญาตให้ล้างค่าเป็น "ทุกราย" (โหมดฟอร์ม/ตัวกรอง) */
  allowEmpty?: boolean
  /** ข้อความเมื่อยังไม่เลือก (โหมด allowEmpty) */
  emptyLabel?: string
  placeholder?: string
  inputId?: string
  autoFocus?: boolean
  className?: string
}

/**
 * ช่องค้นหาลูกค้าแบบ autocomplete — พิมพ์ชื่อ รหัส ผู้ติดต่อ หรือเบอร์โทร แล้วเลือกจากรายการ
 * ใช้ได้ 2 โหมด: พาไปลิงก์ (hrefTemplate) หรือเก็บค่าไว้ใน hidden input (name) สำหรับฟอร์มตัวกรอง
 */
export function CustomerSearch<T extends CustomerSearchItem>({
  customers,
  hrefTemplate,
  onSelect,
  name,
  defaultValue = '',
  allowEmpty = false,
  emptyLabel = 'ทุกราย',
  placeholder = 'พิมพ์ชื่อลูกค้า รหัส ผู้ติดต่อ หรือเบอร์โทร',
  inputId,
  autoFocus,
  className,
}: CustomerSearchProps<T>) {
  const router = useRouter()
  const generatedId = React.useId()
  const id = inputId ?? generatedId
  const listId = `${id}-list`

  const initial = React.useMemo(() => customers.find((c) => c.id === defaultValue) ?? null, [customers, defaultValue])
  const [selected, setSelected] = React.useState<T | null>(initial)
  const [query, setQuery] = React.useState(initial?.name ?? '')
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [pending, startTransition] = React.useTransition()
  const inputRef = React.useRef<HTMLInputElement>(null)

  // ช่องแสดงชื่อลูกค้าที่เลือกอยู่ — เมื่อพิมพ์ต่อให้ค้นจากทั้งรายการ ไม่ใช่เฉพาะชื่อที่เลือก
  const searching = selected ? query !== selected.name : true
  const matches = React.useMemo(
    () => searchCustomers(customers, searching ? query : '', MAX_RESULTS),
    [customers, query, searching],
  )
  const total = React.useMemo(
    () => (searching && query.trim() ? customers.filter((c) => matchesCustomer(c, query)).length : customers.length),
    [customers, query, searching],
  )

  /** เลือกลูกค้า: อัปเดตช่อง ปิดรายการ แล้วพาไปลิงก์ถ้ากำหนด */
  const choose = (customer: T) => {
    setSelected(customer)
    setQuery(customer.name)
    setOpen(false)
    onSelect?.(customer)
    if (hrefTemplate) startTransition(() => router.push(hrefTemplate.replace('{id}', encodeURIComponent(customer.id))))
  }

  /** ล้างค่าที่เลือกและคำค้น */
  const clear = () => {
    setSelected(null)
    setQuery('')
    setActive(0)
    onSelect?.(null)
    inputRef.current?.focus()
    setOpen(true)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // Enter ในช่องค้นหาไม่ส่งฟอร์ม — เลือกรายการที่ไฮไลต์แทน
      e.preventDefault()
      if (open && matches[active]) choose(matches[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // ออกจากช่องโดยไม่เลือก: คืนชื่อที่เลือกไว้ (หรือว่าง) เพื่อไม่ให้ค่าในฟอร์มกับข้อความไม่ตรงกัน
  const onBlur = () => {
    setOpen(false)
    setQuery(selected ? selected.name : '')
  }

  const showClear = query !== '' || (selected !== null && !allowEmpty)

  return (
    <div className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={selected?.id ?? ''} />}
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" />
      <input
        ref={inputRef}
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
          if (selected && e.target.value !== selected.name) {
            // พิมพ์แก้ = ยกเลิกตัวที่เลือกไว้ จนกว่าจะเลือกใหม่
            setSelected(null)
            onSelect?.(null)
          }
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={allowEmpty && !selected ? emptyLabel : placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="search"
        enterKeyHint="done"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        className={cn(
          'h-12 w-full rounded-xl border border-line bg-white pl-11 text-base text-ink-900',
          'placeholder:text-ink-400 transition-colors hover:border-brand-200 focus:border-brand-500',
          'focus:outline-none focus:ring-4 focus:ring-brand-100',
          showClear ? 'pr-12' : 'pr-3.5',
          pending && 'opacity-70',
        )}
      />
      {showClear && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
          aria-label="ล้างลูกค้าที่เลือก"
          className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-ink-400 hover:bg-slate-100 hover:text-ink-700"
        >
          <X className="size-4.5" />
        </button>
      )}

      {open && (
        <div
          id={listId}
          role="listbox"
          // กัน input หลุดโฟกัสตอนแตะรายการ — Safari ปิด dropdown ก่อน click ถ้าไม่กัน
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-30 mt-1 max-h-80 w-full overflow-auto overscroll-contain rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {allowEmpty && (
            <button
              type="button"
              role="option"
              aria-selected={selected === null}
              onClick={() => { setSelected(null); setQuery(''); setOpen(false); onSelect?.(null) }}
              className={cn('flex min-h-12 w-full items-center gap-2 px-4 py-2.5 text-left text-base text-ink-700 hover:bg-brand-50', selected === null && 'bg-brand-50')}
            >
              <span className="flex-1">{emptyLabel}</span>
              {selected === null && <Check className="size-5 shrink-0 text-brand-600" />}
            </button>
          )}

          {customers.length === 0 && <p className="px-4 py-3 text-sm text-ink-500">ยังไม่มีลูกค้า</p>}

          {customers.length > 0 && matches.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-500">ไม่พบลูกค้าตามคำค้น “{query.trim()}” — ลองพิมพ์บางส่วนของชื่อ รหัส หรือเบอร์โทร</p>
          )}

          {matches.map((c, index) => {
            const isSelected = selected?.id === c.id
            const detail = c.detail ?? [c.code, c.contact_name].filter(Boolean).join(' · ')
            return (
              <button
                key={c.id}
                id={`${listId}-${c.id}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(c)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-50 active:bg-brand-100',
                  index === active && 'bg-brand-50',
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-ink-900">{c.name}</span>
                  {detail && <span className="block truncate text-sm text-ink-500">{detail}</span>}
                </span>
                {isSelected && <Check className="size-5 shrink-0 text-brand-600" />}
              </button>
            )
          })}

          {matches.length >= MAX_RESULTS && total > MAX_RESULTS && (
            <p className="border-t border-line px-4 py-2.5 text-xs text-ink-500">แสดง {MAX_RESULTS} รายแรก — พิมพ์เพิ่มเพื่อจำกัดผล</p>
          )}
        </div>
      )}
    </div>
  )
}
