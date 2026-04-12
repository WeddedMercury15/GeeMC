export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }
  throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
})
