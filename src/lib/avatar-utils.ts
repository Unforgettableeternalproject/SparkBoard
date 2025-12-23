// Generate a consistent color based on a string (like username or user ID)
export function getAvatarColor(str: string): string {
  // Predefined pleasant colors that are easy on the eyes
  const colors = [
    'bg-blue-500',      // Blue
    'bg-purple-500',    // Purple
    'bg-pink-500',      // Pink
    'bg-green-500',     // Green
    'bg-teal-500',      // Teal
    'bg-indigo-500',    // Indigo
    'bg-cyan-500',      // Cyan
    'bg-emerald-500',   // Emerald
    'bg-violet-500',    // Violet
    'bg-fuchsia-500',   // Fuchsia
    'bg-rose-500',      // Rose
    'bg-amber-500',     // Amber
  ]

  // Generate a hash from the string
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32bit integer
  }

  // Use the hash to pick a color
  const index = Math.abs(hash) % colors.length
  return colors[index]
}
