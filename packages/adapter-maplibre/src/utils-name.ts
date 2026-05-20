export function generateRandomName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt((Math.floor(Math.random() * chars.length) + Date.now()) % chars.length)
  }
  return result
}
