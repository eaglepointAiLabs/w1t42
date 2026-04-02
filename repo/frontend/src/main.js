import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { registerServiceWorker } from "./offline/sw-register";
import "./styles.css";

createApp(App).use(router).mount("#app");

registerServiceWorker();
