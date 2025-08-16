<template>
  <i
    :class="iconClasses"
    :style="iconStyles"
    :aria-label="ariaLabel"
    role="img"
  />
</template>

<script setup lang="ts">
interface Props {
  /** Font Awesome icon name (e.g., 'fa-solid fa-home') */
  name: string
  /** Icon size - can be CSS size or Font Awesome size classes */
  size?: string | 'xs' | 'sm' | 'lg' | 'xl' | '2x' | '3x'
  /** Custom CSS color */
  color?: string
  /** Custom CSS classes */
  class?: string
  /** Accessibility label for screen readers */
  ariaLabel?: string
  /** Whether to add a spinning animation */
  spin?: boolean
  /** Whether to add a pulse animation */
  pulse?: boolean
  /** Whether to add a border */
  border?: boolean
  /** Whether to add a fixed width */
  fixedWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: '1em',
  color: 'currentColor',
  class: '',
  ariaLabel: '',
  spin: false,
  pulse: false,
  border: false,
  fixedWidth: false
})

const iconClasses = computed(() => {
  const classes = [props.name]

  if (props.spin) classes.push('fa-spin')
  if (props.pulse) classes.push('fa-pulse')
  if (props.border) classes.push('fa-border')
  if (props.fixedWidth) classes.push('fa-fw')

  // Add size class if it's a predefined Font Awesome size
  if (typeof props.size === 'string' && ['xs', 'sm', 'lg', 'xl', '2x', '3x'].includes(props.size)) {
    classes.push(`fa-${props.size}`)
  }

  if (props.class) classes.push(props.class)

  return classes.join(' ')
})

const iconStyles = computed(() => {
  const styles: Record<string, string> = {}

  // Apply custom size if it's not a predefined Font Awesome size
  if (typeof props.size === 'string' && !['xs', 'sm', 'lg', 'xl', '2x', '3x'].includes(props.size)) {
    styles.fontSize = props.size
  }

  if (props.color) {
    styles.color = props.color
  }

  return styles
})
</script>

<style scoped>
/* Ensure proper icon rendering */
i {
  display: inline-block;
  line-height: 1;
  vertical-align: middle;
}

/* Smooth animations */
.fa-spin,
.fa-pulse {
  animation-duration: 1s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}

.fa-spin {
  animation-name: fa-spin;
}

.fa-pulse {
  animation-name: fa-spin;
  animation-direction: reverse;
}

@keyframes fa-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
