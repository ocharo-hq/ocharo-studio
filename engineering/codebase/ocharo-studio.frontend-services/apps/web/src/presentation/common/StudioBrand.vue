<script setup lang="ts">
import { RouterLink } from "vue-router";
import "./StudioBrand.css";

/** Approved Ocharo artwork with optional intercepted in-app navigation. */
defineOptions({ name: "StudioBrand" });

const props = withDefaults(
  defineProps<{ href?: string; onNavigate?: () => void }>(),
  { href: "/" },
);

function navigate(
  event: MouseEvent,
  routerNavigate: (event: MouseEvent) => void,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  )
    return;
  if (!props.onNavigate) {
    routerNavigate(event);
    return;
  }
  event.preventDefault();
  props.onNavigate();
}
</script>

<template>
  <RouterLink
    v-slot="{ href: resolvedHref, navigate: routerNavigate }"
    :to="href"
    custom
  >
    <a
      class="brand brand-authentic"
      :href="resolvedHref"
      aria-label="Ocharo Studio home"
      @click="navigate($event, routerNavigate)"
    >
      <svg
        class="brand-wordmark"
        viewBox="288 325 1000 345"
        width="148"
        height="51"
        aria-hidden="true"
        focusable="false"
      >
        <image
          href="/assets/brand/ocharo-wordmark.webp"
          width="1536"
          height="1024"
        />
      </svg>
      <span class="brand-product" aria-hidden="true">studio</span>
    </a>
  </RouterLink>
</template>
