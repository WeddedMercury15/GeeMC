import { getResourceListItems } from '../../utils/resourceItems'

export default defineEventHandler(async () => {
  const items = await getResourceListItems()
  return {
    items,
    total: items.length
  }
})
