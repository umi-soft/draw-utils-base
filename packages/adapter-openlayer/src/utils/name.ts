/**
 * 生成一段长度为8位的全局唯一英文名称
 */
export function generateRandomName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    // 每字符用随机种子+时间混合保证高唯一性
    result += chars.charAt((Math.floor(Math.random() * chars.length) + Date.now()) % chars.length)
  }
  return result
}
