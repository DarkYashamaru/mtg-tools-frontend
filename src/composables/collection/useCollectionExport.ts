import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import type { CollectionRecord } from '@/components/collection/types'

import { formatCollectionExport, type CollectionExportOptions } from '@/components/collection/exporting'

interface Options {
  collection: Ref<CollectionRecord | null>
  filteredCollection: ComputedRef<CollectionRecord | null>
}

export function useCollectionExport({ collection, filteredCollection }: Options) {
  const exportOptions = ref<CollectionExportOptions>({
    includeMaybeboard: false,
    includeSectionHeaders: false,
    includeSetCode: false,
    includeCollectorNumber: false,
    includeColorTags: false,
  })

  const exportMessage = ref('')
  const exportableFilteredItems = computed(() =>
    (filteredCollection.value?.items ?? []).filter(
      (item) =>
        exportOptions.value.includeMaybeboard ||
        item.zone !== 'maybeboard',
    ),
  )

  const filteredCardCopies = computed(() =>
    exportableFilteredItems.value.reduce(
      (total, item) => total + item.amount,
      0,
    ),
  )

  const exportText = computed(() =>
    formatCollectionExport(
      exportableFilteredItems.value,
      exportOptions.value,
    ),
  )

  function exportFilename() {
    const name = (
      collection.value?.name ?? 'collection'
    )
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/-$|^-/g, '')

    return `${name || 'collection'}-export.txt`
  }

  async function copyExport() {
    exportMessage.value = ''

    try {
      await navigator.clipboard.writeText(
        exportText.value,
      )

      exportMessage.value =
        'Export copied to clipboard.'
    } catch {
      exportMessage.value =
        'Could not copy the export. Use Download TXT instead.'
    }
  }

  function downloadExport() {
    const blob = new Blob(
      [exportText.value],
      {
        type: 'text/plain;charset=utf-8',
      },
    )

    const url =
      window.URL.createObjectURL(blob)

    const link =
      document.createElement('a')

    link.href = url
    link.download = exportFilename()

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    window.URL.revokeObjectURL(url)

    exportMessage.value = 'Export downloaded.'
  }
  watch(
    () =>
      exportOptions.value.includeSetCode,
    (includeSetCode) => {
      if (!includeSetCode) {
        exportOptions.value.includeCollectorNumber =
          false
      }

      exportMessage.value = ''
    },
  )

  return {
    exportOptions,
    exportMessage,
    exportableFilteredItems,
    filteredCardCopies,
    exportText,
    copyExport,
    downloadExport,
  }
}
