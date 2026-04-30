export type ResourceFieldChoice = {
  label: string
  iconUrl?: string
}

export type ResourceFieldChoiceValue = string | ResourceFieldChoice

export type ResourceFieldChoiceRecord = Record<string, ResourceFieldChoiceValue>

export type NormalizedResourceFieldChoiceRecord = Record<string, ResourceFieldChoice>
