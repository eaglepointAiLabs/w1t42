import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import App from "./App.vue";

describe("App shell", () => {
  it("renders TrailForge title", () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }]
    });

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            template: "<a><slot /></a>"
          },
          RouterView: {
            template: "<div />"
          }
        }
      }
    });
    expect(wrapper.text()).toContain("TrailForge");
  });
});
