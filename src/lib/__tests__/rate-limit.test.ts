import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock must be hoisted — mock next/server before importing rateLimit
vi.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    body: unknown;

    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }

  class MockNextRequest {
    headers: Headers;
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.headers = new Headers(init?.headers);
    }
  }

  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse };
});

// Dynamic import so the mock is in place
const { rateLimit } = await import("../rate-limit");
const { NextRequest } = await import("next/server");

function makeRequest(headers: Record<string, string> = {}): InstanceType<typeof NextRequest> {
  return new NextRequest("http://localhost/api/test", { headers }) as never;
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clear the internal store between tests by using a unique key per test
    // (we cannot access the store directly, but unique keys isolate tests)
  });

  it("returns null (allowed) when under the limit", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1" });
    const result = rateLimit(req, { maxRequests: 5, key: "under-limit-test" });
    expect(result).toBeNull();
  });

  it("returns 429 response when over the limit", () => {
    const key = "over-limit-test";
    const req = makeRequest();

    for (let i = 0; i < 3; i++) {
      const res = rateLimit(req, { maxRequests: 3, key });
      expect(res).toBeNull();
    }

    const blocked = rateLimit(req, { maxRequests: 3, key });
    expect(blocked).not.toBeNull();
    expect((blocked as { status: number }).status).toBe(429);
  });

  it("respects windowMs — entries expire after the window", () => {
    const key = "window-test";
    const req = makeRequest();

    // Fill up the limit
    for (let i = 0; i < 3; i++) {
      rateLimit(req, { maxRequests: 3, windowMs: 10_000, key });
    }

    // Should be blocked now
    expect(rateLimit(req, { maxRequests: 3, windowMs: 10_000, key })).not.toBeNull();

    // Advance time past the window
    vi.advanceTimersByTime(10_001);

    // Should be allowed again
    expect(rateLimit(req, { maxRequests: 3, windowMs: 10_000, key })).toBeNull();
  });

  it("uses custom key instead of IP when provided", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.99" });

    // Exhaust limit for key "user-a"
    for (let i = 0; i < 2; i++) {
      rateLimit(req, { maxRequests: 2, key: "user-a" });
    }
    expect(rateLimit(req, { maxRequests: 2, key: "user-a" })).not.toBeNull();

    // Different key should still be allowed, even with the same IP
    expect(rateLimit(req, { maxRequests: 2, key: "user-b" })).toBeNull();
  });

  it("handles unknown IP gracefully (no x-forwarded-for, no x-real-ip)", () => {
    const req = makeRequest(); // no IP headers
    const key = "unknown-ip-test";

    const result = rateLimit(req, { maxRequests: 5, key });
    expect(result).toBeNull();
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "x-real-ip": "192.168.1.1" });
    // Use the IP-derived key by not providing a custom key
    // We just verify it does not throw and returns null
    const result = rateLimit(req, { maxRequests: 10 });
    expect(result).toBeNull();
  });

  it("cleans up expired entries within the sliding window", () => {
    const key = "cleanup-test";
    const req = makeRequest();

    // Make 2 requests at t=0
    rateLimit(req, { maxRequests: 3, windowMs: 5_000, key });
    rateLimit(req, { maxRequests: 3, windowMs: 5_000, key });

    // Advance 4 seconds, make 1 more (total 3 in window, but 2 will expire soon)
    vi.advanceTimersByTime(4_000);
    rateLimit(req, { maxRequests: 3, windowMs: 5_000, key });

    // Advance 2 more seconds — the first 2 timestamps are now > 5s old
    vi.advanceTimersByTime(2_000);

    // Only 1 request in the window now, so this should be allowed
    expect(rateLimit(req, { maxRequests: 3, windowMs: 5_000, key })).toBeNull();
  });

  it("extracts the first IP from a comma-separated x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    // Just verify it runs without error — the first IP (1.2.3.4) is used as key
    const result = rateLimit(req, { maxRequests: 10 });
    expect(result).toBeNull();
  });
});
