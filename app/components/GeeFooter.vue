<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <UFooter class="border-t border-(--ui-border) bg-(--ui-bg-accented)/35">
    <template #left>
      <div class="text-sm text-muted">
        © {{ year }} GeeMC
      </div>
    </template>
  </UFooter>
</template>
