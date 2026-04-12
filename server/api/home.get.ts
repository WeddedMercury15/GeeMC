import { computeHotSearchTags } from '../utils/hotSearchTags'

export default defineEventHandler(async () => {
  const hotSearchTags = await computeHotSearchTags()

  return {
    hotSearchTags,
    ecosystemEntries: [
      { key: 'resource', to: '/resources', icon: 'i-lucide-package-search' },
      { key: 'forum', to: '/forum', icon: 'i-lucide-messages-square' },
      { key: 'wiki', to: '#', icon: 'i-lucide-book' },
      { key: 'server', to: '#', icon: 'i-lucide-server' }
    ] as Array<{ key: string, to: string, icon: string }>,
    featuredResources: [] as Array<{
      id: string
      title: string
      description: string
      category: string
      categoryKey: string
      author: string
      authorAvatar: string
      downloads: string
      cover: string
      publishDate: string
    }>,
    hotTopics: [] as Array<{
      id: number
      title: string
      category: string
      replies: number
      views: number
      publishDate: string
    }>,
    announcements: [] as Array<{
      id: number
      type: 'primary' | 'warning' | 'success'
      typeLabel: string
      title: string
      date: string
    }>,
    forumStats: {
      totalThreads: 0,
      totalPosts: 0,
      totalMembers: 0,
      latestMember: undefined as { id: number, name: string } | undefined
    }
  }
})
