export const useGroupName = () => {
  function getGroupName(nameOrSlug: string, _slug?: string): string {
    return nameOrSlug
  }

  return { getGroupName }
}
