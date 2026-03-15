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
});
