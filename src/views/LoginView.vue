<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const { isAuthenticated, isLoading } = storeToRefs(authStore)

const username = ref('')
const password = ref('')
const errorMessage = ref('')

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

async function submitLogin() {
  errorMessage.value = ''

  if (!username.value.trim() || !password.value) {
    errorMessage.value = 'Enter both username and password.'
    return
  }

  try {
    await authStore.login({
      username: username.value.trim(),
      password: password.value,
    })

    router.replace(redirectTarget.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to log in.'
  }
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-copy">
        <span class="eyebrow">Account Access</span>
        <h1>Log in to your account</h1>
        <p class="description">
          Save favorite cards, manage your collections, and use Bulk Deck Builder.
        </p>
      </div>

      <form class="login-form" @submit.prevent="submitLogin">
        <label class="field">
          <span>Username</span>
          <input
            v-model="username"
            type="text"
            name="username"
            autocomplete="username"
            placeholder="Enter your username"
          >
        </label>

        <label class="field">
          <span>Password</span>
          <input
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Enter your password"
          >
        </label>

        <p v-if="errorMessage" class="status-message error">{{ errorMessage }}</p>
        <p v-else-if="isAuthenticated" class="status-message success">Authenticated. Redirecting...</p>

        <div class="actions-row">
          <button class="primary-button" type="submit" :disabled="isLoading">
            {{ isLoading ? 'Signing In...' : 'Log In' }}
          </button>
          <button class="secondary-button" type="button" @click="goHome">Back to Toolkit</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped src="./LoginView.css"></style>
