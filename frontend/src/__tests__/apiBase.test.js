import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getApiBase — comportamento por ambiente", () => {
  it("expõe API_BASE como string (não undefined)", async () => {
    const { API_BASE } = await import("@/utils/apiBase.js");
    expect(typeof API_BASE).toBe("string");
  });
});

describe("authFetch — comportamento de sessão expirada", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();

    const localStorageMock = (() => {
      let store = {};
      return {
        getItem: (key) => store[key] ?? null,
        setItem: (key, val) => { store[key] = val; },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
      };
    })();
    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    global.window = {
      dispatchEvent: vi.fn(),
      location: { hostname: "localhost" },
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("lança erro 'Sessão expirada' ao receber status 401", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false });
    global.localStorage.setItem("defensorToken", "token-qualquer");

    const { authFetch } = await import("@/utils/apiBase.js");

    await expect(authFetch("/api/casos")).rejects.toThrow("Sessão expirada");
  });

  it("remove o token do localStorage ao receber 401", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false });
    global.localStorage.setItem("defensorToken", "token-qualquer");
    global.localStorage.setItem("defensorUser", '{"nome":"Teste"}');

    const { authFetch } = await import("@/utils/apiBase.js");

    try {
      await authFetch("/api/casos");
    } catch {
      // Esperado
    }

    expect(global.localStorage.getItem("defensorToken")).toBeNull();
    expect(global.localStorage.getItem("defensorUser")).toBeNull();
  });

  it("injeta Authorization header quando há token no localStorage", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({}) });
    global.localStorage.setItem("defensorToken", "meu-jwt-aqui");

    const { authFetch } = await import("@/utils/apiBase.js");

    await authFetch("/api/casos");

    const callArgs = global.fetch.mock.calls[0];
    const options = callArgs[1];
    expect(options.headers["Authorization"]).toBe("Bearer meu-jwt-aqui");
  });

  it("não injeta Authorization header quando não há token", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
    global.localStorage.removeItem("defensorToken");

    const { authFetch } = await import("@/utils/apiBase.js");

    await authFetch("/api/casos");

    const callArgs = global.fetch.mock.calls[0];
    const options = callArgs[1];
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("usa URL absoluta quando endpoint começa com http", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true });

    const { authFetch } = await import("@/utils/apiBase.js");
    const absoluteUrl = "https://api.exemplo.com/casos";

    await authFetch(absoluteUrl);

    expect(global.fetch.mock.calls[0][0]).toBe(absoluteUrl);
  });
});
