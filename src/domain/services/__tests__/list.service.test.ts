import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListService } from "../list.service";
import type { IListRepository } from "../../repositories/list.repository";
import type { List } from "../../entities/list";

function makeList(overrides: Partial<List> = {}): List {
  return {
    id: "list-1",
    userId: "user-1",
    groupId: null,
    locationId: null,
    locationRadius: null,
    deviceContext: null,
    name: "Test list",
    icon: null,
    themeColor: null,
    isDefault: false,
    sortOrder: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IListRepository> = {}): IListRepository {
  return {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findByGroup: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    deleteNonDefault: vi.fn(),
    updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(),
    deleteManyNonDefault: vi.fn(),
    ...overrides,
  };
}

describe("ListService", () => {
  let repo: IListRepository;
  let service: ListService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ListService(repo);
  });

  describe("getById", () => {
    it("deleguje na repo", async () => {
      const list = makeList();
      vi.mocked(repo.findById).mockResolvedValue(list);

      const result = await service.getById("list-1", "user-1");

      expect(repo.findById).toHaveBeenCalledWith("list-1", "user-1");
      expect(result).toBe(list);
    });
  });

  describe("getByUser", () => {
    it("deleguje na repo", async () => {
      const lists = [makeList(), makeList({ id: "list-2", name: "Second" })];
      vi.mocked(repo.findByUser).mockResolvedValue(lists);

      const result = await service.getByUser("user-1");

      expect(repo.findByUser).toHaveBeenCalledWith("user-1");
      expect(result).toBe(lists);
    });
  });

  describe("getByGroup", () => {
    it("deleguje na repo", async () => {
      const lists = [makeList({ groupId: "group-1" })];
      vi.mocked(repo.findByGroup).mockResolvedValue(lists);

      const result = await service.getByGroup("group-1");

      expect(repo.findByGroup).toHaveBeenCalledWith("group-1");
      expect(result).toBe(lists);
    });
  });

  describe("create", () => {
    it("vypočítá sortOrder z maxima + 1", async () => {
      vi.mocked(repo.findMaxSortOrder).mockResolvedValue(3);
      vi.mocked(repo.create).mockResolvedValue(makeList({ sortOrder: 4 }));

      await service.create("user-1", { name: "New list" });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 4 }));
    });

    it("předá volitelné fieldy", async () => {
      vi.mocked(repo.create).mockResolvedValue(makeList());

      await service.create("user-1", {
        name: "Colored",
        icon: "star",
        themeColor: "#ff0000",
        groupId: "group-1",
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: "star",
          themeColor: "#ff0000",
          groupId: "group-1",
        }),
      );
    });
  });

  describe("update", () => {
    it("aktualizuje jen poskytnuté fieldy", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeList({ name: "Updated" }));

      await service.update("list-1", "user-1", { name: "Updated" });

      expect(repo.update).toHaveBeenCalledWith(
        "list-1",
        "user-1",
        expect.objectContaining({ name: "Updated" }),
      );
    });

    it("nastaví groupId na null explicitně", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeList());

      await service.update("list-1", "user-1", { groupId: null });

      expect(repo.update).toHaveBeenCalledWith(
        "list-1",
        "user-1",
        expect.objectContaining({ groupId: null }),
      );
    });
  });

  describe("delete", () => {
    it("deleguje na deleteNonDefault", async () => {
      await service.delete("list-1", "user-1");

      expect(repo.deleteNonDefault).toHaveBeenCalledWith("list-1", "user-1");
    });
  });

  describe("createDefaultList", () => {
    it("vytvoří výchozí seznam s isDefault=true a sortOrder=0", async () => {
      vi.mocked(repo.create).mockResolvedValue(makeList({ isDefault: true }));

      await service.createDefaultList("user-1");

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          name: "Tasks",
          isDefault: true,
          sortOrder: 0,
        }),
      );
    });
  });

  describe("reorder", () => {
    it("aktualizuje sortOrder pro každou položku", async () => {
      await service.reorder("user-1", [
        { id: "a", sortOrder: 2 },
        { id: "b", sortOrder: 0 },
      ]);

      expect(repo.updateSortOrder).toHaveBeenCalledTimes(2);
      expect(repo.updateSortOrder).toHaveBeenCalledWith("a", "user-1", 2);
      expect(repo.updateSortOrder).toHaveBeenCalledWith("b", "user-1", 0);
    });
  });
});
