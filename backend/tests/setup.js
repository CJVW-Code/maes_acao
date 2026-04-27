import { jest } from "@jest/globals";

process.env.GROQ_API_KEY = "gsk_dummy_key_for_testing_purposes";
process.env.GEMINI_API_KEY = "dummy_gemini_key";

jest.unstable_mockModule("@upstash/qstash", () => ({
  Client: class { publishJSON() { return Promise.resolve({ messageId: "setup-mock" }); } },
  Receiver: class { verify() { return Promise.resolve(true); } },
  __esModule: true
}));

jest.unstable_mockModule("../src/config/supabase.js", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { protocolo: "SETUP-123" }, error: null }),
    select: jest.fn().mockReturnThis(),
    storage: { 
      from: jest.fn().mockReturnThis(), 
      upload: jest.fn().mockResolvedValue({ error: null }),
      download: jest.fn().mockResolvedValue({ data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }, error: null })
    },
  },
  isSupabaseConfigured: true,
  __esModule: true
}));

import { prisma } from "../src/config/prisma.js";

afterAll(async () => {
  await prisma.$disconnect();
});

