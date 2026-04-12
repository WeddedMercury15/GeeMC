import { getForumIndexData } from './forumIndexData'

export async function getForumHotSearchLabels(): Promise<string[]> {
  const { latestPosts } = getForumIndexData()
  return latestPosts.map(p => p.title).filter(Boolean)
}
