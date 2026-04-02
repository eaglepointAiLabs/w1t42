import { reactive, readonly } from "vue";

const state = reactive({
  items: []
});

function pushToast(message, kind = "success") {
  const id = `${Date.now()}-${Math.random()}`;
  state.items.push({ id, message, kind });
  setTimeout(() => {
    const index = state.items.findIndex((item) => item.id === id);
    if (index >= 0) {
      state.items.splice(index, 1);
    }
  }, 2800);
}

export function useToast() {
  return {
    items: readonly(state.items),
    pushToast
  };
}
