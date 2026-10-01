import { createApp } from "vue";
import AppRouter from "./bootstrap/AppRouter.vue";
import { router } from "./bootstrap/router";
import "./bootstrap/index.css";

createApp(AppRouter).use(router).mount("#root");
