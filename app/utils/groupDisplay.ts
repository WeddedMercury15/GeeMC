export function normalizeGroupKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isGeeMcPrivilegedGroupName(name: string): boolean {
  const k = normalizeGroupKey(name)
  return k === 'super_admin' || k === 'administrator'
}
