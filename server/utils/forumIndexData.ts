export function getForumIndexData() {
  return {
    stats: {
      totalThreads: 0,
      totalPosts: 0,
      totalMembers: 0,
      latestMember: null as { name: string } | null
    },
    categories: [] as Array<{
      id: number
      name: string
      nodes: Array<{
        id: number
        title: string
        description: string
        icon: string
        threads: string
        messages: string
        latestPost: { title: string, author: string, time: string, avatar: string }
      }>
    }>,
    latestPosts: [] as Array<{
      id: number
      title: string
      category: string
      replies: number
      views: number
      time: string
      avatar: string
    }>
  }
}
