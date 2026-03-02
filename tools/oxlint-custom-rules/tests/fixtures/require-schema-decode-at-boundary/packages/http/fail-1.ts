export const parseRequest = async (request: Request) => {
  const payload = await request.json()
  return payload
}
