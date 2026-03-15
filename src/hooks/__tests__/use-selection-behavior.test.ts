// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelectionBehavior } from "../use-selection-behavior";

const items = ["a", "b", "c", "d", "e"];

function useHook() {
  return useSelectionBehavior(items);
}

describe("useSelectionBehavior", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(useHook);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("plain click selects single item and deselects others", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("b", {}));
    expect([...result.current.selectedIds]).toEqual(["b"]);
    act(() => result.current.handleClick("d", {}));
    expect([...result.current.selectedIds]).toEqual(["d"]);
  });

  it("cmd/ctrl+click toggles item in selection", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("a", { metaKey: true }));
    act(() => result.current.handleClick("c", { metaKey: true }));
    expect([...result.current.selectedIds]).toEqual(["a", "c"]);
    act(() => result.current.handleClick("a", { metaKey: true }));
    expect([...result.current.selectedIds]).toEqual(["c"]);
  });

  it("shift+click selects range from anchor", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("b", {}));
    act(() => result.current.handleClick("d", { shiftKey: true }));
    expect([...result.current.selectedIds]).toEqual(["b", "c", "d"]);
  });

  it("shift+click selects range in reverse direction", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("d", {}));
    act(() => result.current.handleClick("b", { shiftKey: true }));
    expect([...result.current.selectedIds]).toEqual(["b", "c", "d"]);
  });

  it("clear() empties selection", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("a", {}));
    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("selectAll() selects all items", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.selectAll());
    expect([...result.current.selectedIds]).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("removeFromSelection removes specific ids", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.selectAll());
    act(() => result.current.removeFromSelection(["b", "d"]));
    expect([...result.current.selectedIds]).toEqual(["a", "c", "e"]);
  });

  it("isMultiSelect returns true when 2+ selected", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("a", {}));
    expect(result.current.isMultiSelect).toBe(false);
    act(() => result.current.handleClick("b", { metaKey: true }));
    expect(result.current.isMultiSelect).toBe(true);
  });

  it("handleClick sets focusedId", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("c", {}));
    expect(result.current.focusedId).toBe("c");
  });

  it("clear resets focusedId", () => {
    const { result } = renderHook(useHook);
    act(() => result.current.handleClick("b", {}));
    act(() => result.current.clear());
    expect(result.current.focusedId).toBeNull();
  });

  describe("moveFocus", () => {
    it("moves focus down and selects focused item", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("b", {}));
      act(() => result.current.moveFocus("down"));
      expect(result.current.focusedId).toBe("c");
      expect([...result.current.selectedIds]).toEqual(["c"]);
    });

    it("moves focus up and selects focused item", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("c", {}));
      act(() => result.current.moveFocus("up"));
      expect(result.current.focusedId).toBe("b");
      expect([...result.current.selectedIds]).toEqual(["b"]);
    });

    it("does not move past first item", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("a", {}));
      act(() => result.current.moveFocus("up"));
      expect(result.current.focusedId).toBe("a");
      expect([...result.current.selectedIds]).toEqual(["a"]);
    });

    it("does not move past last item", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("e", {}));
      act(() => result.current.moveFocus("down"));
      expect(result.current.focusedId).toBe("e");
      expect([...result.current.selectedIds]).toEqual(["e"]);
    });

    it("starts at first item when no focus exists and direction is down", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.moveFocus("down"));
      expect(result.current.focusedId).toBe("a");
      expect([...result.current.selectedIds]).toEqual(["a"]);
    });

    it("starts at last item when no focus exists and direction is up", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.moveFocus("up"));
      expect(result.current.focusedId).toBe("e");
      expect([...result.current.selectedIds]).toEqual(["e"]);
    });

    it("uses fallbackId when no focus exists", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.moveFocus("down", "c"));
      expect(result.current.focusedId).toBe("d");
      expect([...result.current.selectedIds]).toEqual(["d"]);
    });

    it("uses fallbackId for up direction", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.moveFocus("up", "c"));
      expect(result.current.focusedId).toBe("b");
      expect([...result.current.selectedIds]).toEqual(["b"]);
    });

    it("ignores fallbackId when focus already exists", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("d", {}));
      act(() => result.current.moveFocus("down", "a"));
      expect(result.current.focusedId).toBe("e");
    });
  });

  describe("extendSelection", () => {
    it("extends selection downward from anchor", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("b", {}));
      act(() => result.current.extendSelection("down"));
      expect(result.current.focusedId).toBe("c");
      expect([...result.current.selectedIds]).toEqual(["b", "c"]);
    });

    it("extends selection upward from anchor", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("d", {}));
      act(() => result.current.extendSelection("up"));
      expect(result.current.focusedId).toBe("c");
      expect([...result.current.selectedIds]).toEqual(["c", "d"]);
    });

    it("extends selection across multiple steps", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("b", {}));
      act(() => result.current.extendSelection("down"));
      act(() => result.current.extendSelection("down"));
      act(() => result.current.extendSelection("down"));
      expect(result.current.focusedId).toBe("e");
      expect([...result.current.selectedIds]).toEqual(["b", "c", "d", "e"]);
    });

    it("shrinks selection when moving back toward anchor", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("b", {}));
      act(() => result.current.extendSelection("down"));
      act(() => result.current.extendSelection("down"));
      act(() => result.current.extendSelection("up"));
      expect(result.current.focusedId).toBe("c");
      expect([...result.current.selectedIds]).toEqual(["b", "c"]);
    });

    it("does not extend past boundaries", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("e", {}));
      act(() => result.current.extendSelection("down"));
      expect(result.current.focusedId).toBe("e");
      expect([...result.current.selectedIds]).toEqual(["e"]);
    });

    it("uses fallbackId when no focus exists", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.extendSelection("down", "c"));
      expect(result.current.focusedId).toBe("d");
      expect([...result.current.selectedIds]).toEqual(["c", "d"]);
    });

    it("uses fallbackId for upward extension", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.extendSelection("up", "c"));
      expect(result.current.focusedId).toBe("b");
      expect([...result.current.selectedIds]).toEqual(["b", "c"]);
    });

    it("multi-step extension with fallbackId keeps correct anchor", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.extendSelection("down", "b"));
      act(() => result.current.extendSelection("down"));
      act(() => result.current.extendSelection("down"));
      expect(result.current.focusedId).toBe("e");
      expect([...result.current.selectedIds]).toEqual(["b", "c", "d", "e"]);
    });

    it("ignores fallbackId when focus already exists", () => {
      const { result } = renderHook(useHook);
      act(() => result.current.handleClick("d", {}));
      act(() => result.current.extendSelection("down", "a"));
      expect(result.current.focusedId).toBe("e");
      expect([...result.current.selectedIds]).toEqual(["d", "e"]);
    });
  });
});
